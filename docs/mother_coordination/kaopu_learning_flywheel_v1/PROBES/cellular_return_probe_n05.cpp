#include "FastNoiseLite.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <sstream>
#include <string>
#include <vector>

namespace {

constexpr int kSeed = 424242;
constexpr float kFrequency = 1.0f;
constexpr float kJitter = 1.0f;
constexpr int kGrid = 193;
constexpr double kMinCoord = -12.0;
constexpr double kStep = 0.125;
constexpr double kDerivativeEpsilon = 0.002;
constexpr int kMaxBoundaries = 1200;
volatile double gSink = 0.0;

struct Vec2 { double x; double y; };
struct SampleStats { double min = 0; double max = 0; double mean = 0; double stddev = 0; double zeroGradientFraction = 0; double maxGradient = 0; };
struct Boundary { Vec2 a; Vec2 b; Vec2 direction; };

FastNoiseLite cellular(FastNoiseLite::CellularReturnType returnType, bool explicitConfig = true) {
    FastNoiseLite n(kSeed);
    n.SetFrequency(kFrequency);
    n.SetNoiseType(FastNoiseLite::NoiseType_Cellular);
    if (explicitConfig) {
        n.SetCellularDistanceFunction(FastNoiseLite::CellularDistanceFunction_Euclidean);
        n.SetCellularReturnType(returnType);
        n.SetCellularJitter(kJitter);
    }
    return n;
}

double value(const FastNoiseLite& n, double x, double y) {
    return n.GetNoise(static_cast<float>(x), static_cast<float>(y));
}

Vec2 gradient(const FastNoiseLite& n, double x, double y, double e = kDerivativeEpsilon) {
    return {
        (value(n, x + e, y) - value(n, x - e, y)) / (2.0 * e),
        (value(n, x, y + e) - value(n, x, y - e)) / (2.0 * e)
    };
}

double norm(Vec2 v) { return std::hypot(v.x, v.y); }

double median(std::vector<double> v) {
    if (v.empty()) return 0;
    const size_t m = v.size() / 2;
    std::nth_element(v.begin(), v.begin() + m, v.end());
    const double hi = v[m];
    if (v.size() % 2) return hi;
    std::nth_element(v.begin(), v.begin() + m - 1, v.end());
    return 0.5 * (v[m - 1] + hi);
}

double percentile(std::vector<double> v, double p) {
    if (v.empty()) return 0;
    const size_t i = static_cast<size_t>(std::floor(p * (v.size() - 1)));
    std::nth_element(v.begin(), v.begin() + i, v.end());
    return v[i];
}

SampleStats stats(const FastNoiseLite& n) {
    std::vector<double> values;
    values.reserve(kGrid * kGrid);
    int zeroGradients = 0;
    double maxGradient = 0;
    for (int iy = 0; iy < kGrid; ++iy) {
        for (int ix = 0; ix < kGrid; ++ix) {
            const double x = kMinCoord + ix * kStep;
            const double y = kMinCoord + iy * kStep;
            values.push_back(value(n, x, y));
            const double g = norm(gradient(n, x, y));
            if (g < 1e-9) ++zeroGradients;
            maxGradient = std::max(maxGradient, g);
        }
    }
    SampleStats s;
    s.min = *std::min_element(values.begin(), values.end());
    s.max = *std::max_element(values.begin(), values.end());
    s.mean = std::accumulate(values.begin(), values.end(), 0.0) / values.size();
    double sq = 0;
    for (double v : values) sq += (v - s.mean) * (v - s.mean);
    s.stddev = std::sqrt(sq / values.size());
    s.zeroGradientFraction = static_cast<double>(zeroGradients) / values.size();
    s.maxGradient = maxGradient;
    return s;
}

std::vector<Boundary> findBoundaries(const FastNoiseLite& cellValue) {
    std::vector<Boundary> out;
    auto refine = [&](Vec2 p0, Vec2 p1) {
        const double v0 = value(cellValue, p0.x, p0.y);
        Vec2 lo = p0, hi = p1;
        for (int i = 0; i < 28; ++i) {
            const Vec2 mid{0.5 * (lo.x + hi.x), 0.5 * (lo.y + hi.y)};
            if (value(cellValue, mid.x, mid.y) == v0) lo = mid;
            else hi = mid;
        }
        const double dx = p1.x - p0.x;
        const double dy = p1.y - p0.y;
        const double d = std::hypot(dx, dy);
        out.push_back({lo, hi, {dx / d, dy / d}});
    };
    for (int iy = 0; iy < kGrid && static_cast<int>(out.size()) < kMaxBoundaries; ++iy) {
        for (int ix = 0; ix + 1 < kGrid && static_cast<int>(out.size()) < kMaxBoundaries; ++ix) {
            const Vec2 a{kMinCoord + ix * kStep, kMinCoord + iy * kStep};
            const Vec2 b{a.x + kStep, a.y};
            if (value(cellValue, a.x, a.y) != value(cellValue, b.x, b.y)) refine(a, b);
        }
    }
    for (int ix = 0; ix < kGrid && static_cast<int>(out.size()) < kMaxBoundaries; ++ix) {
        for (int iy = 0; iy + 1 < kGrid && static_cast<int>(out.size()) < kMaxBoundaries; ++iy) {
            const Vec2 a{kMinCoord + ix * kStep, kMinCoord + iy * kStep};
            const Vec2 b{a.x, a.y + kStep};
            if (value(cellValue, a.x, a.y) != value(cellValue, b.x, b.y)) refine(a, b);
        }
    }
    return out;
}

uint64_t fnv1a(const std::vector<float>& values) {
    uint64_t h = 1469598103934665603ULL;
    for (float v : values) {
        uint32_t bits = 0;
        std::memcpy(&bits, &v, sizeof(bits));
        for (int i = 0; i < 4; ++i) {
            h ^= static_cast<uint8_t>((bits >> (8 * i)) & 0xff);
            h *= 1099511628211ULL;
        }
    }
    return h;
}

std::string hex64(uint64_t h) {
    std::ostringstream out;
    out << std::hex << std::setw(16) << std::setfill('0') << h;
    return out.str();
}

std::string geometryHash(const FastNoiseLite* displacement) {
    std::vector<float> heights;
    heights.reserve(kGrid * kGrid);
    for (int iy = 0; iy < kGrid; ++iy) {
        for (int ix = 0; ix < kGrid; ++ix) {
            const double x = kMinCoord + ix * kStep;
            const double y = kMinCoord + iy * kStep;
            const float base = static_cast<float>(0.1 * std::sin(x * 0.2) * std::cos(y * 0.17));
            heights.push_back(displacement ? base + static_cast<float>(0.05 * value(*displacement, x, y)) : base);
        }
    }
    return hex64(fnv1a(heights));
}

long long benchmark(const FastNoiseLite& n) {
    constexpr int count = 1000000;
    std::array<long long, 3> times{};
    for (int repeat = 0; repeat < 3; ++repeat) {
        double sink = 0;
        const auto start = std::chrono::steady_clock::now();
        for (int i = 0; i < count; ++i) {
            const double x = (i % 1000) * 0.013 + repeat * 0.0001;
            const double y = (i / 1000) * 0.017 - repeat * 0.0001;
            sink += value(n, x, y);
        }
        const auto end = std::chrono::steady_clock::now();
        gSink += sink;
        times[repeat] = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
    }
    std::sort(times.begin(), times.end());
    return times[1];
}

} // namespace

int main(int argc, char** argv) {
    const FastNoiseLite cell = cellular(FastNoiseLite::CellularReturnType_CellValue);
    const FastNoiseLite f1 = cellular(FastNoiseLite::CellularReturnType_Distance);
    const FastNoiseLite gapShifted = cellular(FastNoiseLite::CellularReturnType_Distance2Sub);

    FastNoiseLite defaults(kSeed);
    defaults.SetFrequency(kFrequency);
    defaults.SetNoiseType(FastNoiseLite::NoiseType_Cellular);
    FastNoiseLite explicitDefaults(kSeed);
    explicitDefaults.SetFrequency(kFrequency);
    explicitDefaults.SetNoiseType(FastNoiseLite::NoiseType_Cellular);
    explicitDefaults.SetCellularDistanceFunction(FastNoiseLite::CellularDistanceFunction_EuclideanSq);
    explicitDefaults.SetCellularReturnType(FastNoiseLite::CellularReturnType_Distance);
    explicitDefaults.SetCellularJitter(1.0f);
    bool defaultExact = true;
    for (int y = -16; y <= 16; ++y) for (int x = -16; x <= 16; ++x) {
        defaultExact = defaultExact && value(defaults, x * 0.17, y * 0.19) == value(explicitDefaults, x * 0.17, y * 0.19);
    }

    const auto boundaries = findBoundaries(cell);
    std::vector<double> cellCoarse, cellFine, f1Coarse, f1Fine, gapCoarse, gapFine;
    std::vector<double> boundaryGap, f1GradientJump, gapSlope;
    constexpr double coarse = 0.002;
    constexpr double fine = 0.0005;
    for (const Boundary& b : boundaries) {
        const Vec2 c{0.5 * (b.a.x + b.b.x), 0.5 * (b.a.y + b.b.y)};
        auto jump = [&](const FastNoiseLite& n, double e) {
            return std::abs(value(n, c.x + b.direction.x * e, c.y + b.direction.y * e) -
                            value(n, c.x - b.direction.x * e, c.y - b.direction.y * e));
        };
        cellCoarse.push_back(jump(cell, coarse));
        cellFine.push_back(jump(cell, fine));
        f1Coarse.push_back(jump(f1, coarse));
        f1Fine.push_back(jump(f1, fine));
        gapCoarse.push_back(jump(gapShifted, coarse));
        gapFine.push_back(jump(gapShifted, fine));
        const double gLeft = value(gapShifted, c.x - b.direction.x * fine, c.y - b.direction.y * fine) + 1.0;
        const double gRight = value(gapShifted, c.x + b.direction.x * fine, c.y + b.direction.y * fine) + 1.0;
        boundaryGap.push_back(0.5 * (std::abs(gLeft) + std::abs(gRight)));
        const Vec2 gl = gradient(f1, c.x - b.direction.x * 0.01, c.y - b.direction.y * 0.01);
        const Vec2 gr = gradient(f1, c.x + b.direction.x * 0.01, c.y + b.direction.y * 0.01);
        f1GradientJump.push_back(norm({gr.x - gl.x, gr.y - gl.y}));
        for (double d : {0.004, 0.008, 0.016}) {
            const double leftGap = value(gapShifted, c.x - b.direction.x * d, c.y - b.direction.y * d) + 1.0;
            const double rightGap = value(gapShifted, c.x + b.direction.x * d, c.y + b.direction.y * d) + 1.0;
            gapSlope.push_back(0.5 * (std::abs(leftGap) + std::abs(rightGap)) / d);
        }
    }

    const auto safeRatio = [](double a, double b) { return b > 1e-12 ? a / b : 0.0; };
    const double cellJumpRatio = safeRatio(median(cellFine), median(cellCoarse));
    const double f1JumpRatio = safeRatio(median(f1Fine), median(f1Coarse));
    const double gapJumpRatio = safeRatio(median(gapFine), median(gapCoarse));
    const double slopeMean = std::accumulate(gapSlope.begin(), gapSlope.end(), 0.0) / gapSlope.size();
    double slopeSq = 0;
    for (double v : gapSlope) slopeSq += (v - slopeMean) * (v - slopeMean);
    const double slopeCv = std::sqrt(slopeSq / gapSlope.size()) / slopeMean;

    const SampleStats cellStats = stats(cell);
    const SampleStats f1Stats = stats(f1);
    const SampleStats gapStats = stats(gapShifted);
    const std::string baseHash = geometryHash(nullptr);
    const std::string materialOnlyHash = geometryHash(nullptr);
    const std::string cellGeometryHash = geometryHash(&cell);
    const std::string f1GeometryHash = geometryHash(&f1);
    const std::string gapGeometryHash = geometryHash(&gapShifted);
    const long long cellNs = benchmark(cell);
    const long long f1Ns = benchmark(f1);
    const long long gapNs = benchmark(gapShifted);

    struct Check { std::string name; bool pass; };
    std::vector<Check> checks;
    auto check = [&](std::string name, bool pass) { checks.push_back({std::move(name), pass}); };
    check("constructor defaults equal explicit EuclideanSq plus Distance", defaultExact);
    check("boundary sample count is sufficient", boundaries.size() >= 500);
    check("CellValue boundary jump persists as epsilon shrinks", cellJumpRatio > 0.9);
    check("F1 value jump shrinks with epsilon", f1JumpRatio < 0.45);
    check("F2-F1 value jump shrinks with epsilon", gapJumpRatio < 0.55);
    check("F2-F1 raw gap approaches zero at cell boundaries", percentile(boundaryGap, 0.95) < 0.003);
    check("F1 gradient changes across cell boundaries", median(f1GradientJump) > 0.25);
    check("F2-F1 is not a unit-slope Euclidean distance", slopeCv > 0.10);
    check("CellValue derivative is zero over most cell interiors", cellStats.zeroGradientFraction > 0.90);
    check("CellValue has boundary derivative spikes", cellStats.maxGradient > 10.0);
    check("material-only cellular lookup preserves geometry bytes", materialOnlyHash == baseHash);
    check("CellValue displacement changes geometry bytes", cellGeometryHash != baseHash);
    check("F1 displacement changes geometry bytes", f1GeometryHash != baseHash);
    check("F2-F1 displacement changes geometry bytes", gapGeometryHash != baseHash);
    check("all three CPU timings are positive", cellNs > 0 && f1Ns > 0 && gapNs > 0);
    const int passed = static_cast<int>(std::count_if(checks.begin(), checks.end(), [](const Check& c) { return c.pass; }));
    const bool ok = passed == static_cast<int>(checks.size());

    auto writeStats = [](std::ostringstream& out, const SampleStats& s) {
        out << "{\"min\": " << s.min << ", \"max\": " << s.max << ", \"mean\": " << s.mean
            << ", \"stddev\": " << s.stddev << ", \"zeroGradientFraction\": " << s.zeroGradientFraction
            << ", \"maxGradient\": " << s.maxGradient << "}";
    };
    std::ostringstream out;
    out << std::fixed << std::setprecision(9);
    out << "{\n";
    out << "  \"schema\": \"kaopu-cellular-return-result/n05\",\n";
    out << "  \"status\": \"" << (ok ? "pass" : "fail") << "\",\n";
    out << "  \"evidenceClass\": \"pinned FastNoiseLite 1.1.1 C++ source plus deterministic CPU field/boundary/derivative probes\",\n";
    out << "  \"sourceRevision\": \"785f37a9ad76e283586a379675085f2063ae03f7\",\n";
    out << "  \"configuration\": {\"seed\": " << kSeed << ", \"frequency\": " << kFrequency << ", \"jitter\": " << kJitter << ", \"distanceFunction\": \"Euclidean\", \"grid\": [" << kGrid << ", " << kGrid << "]},\n";
    out << "  \"sourceContractAudit\": {\"constructorDefaultExact\": " << (defaultExact ? "true" : "false")
        << ", \"constructorDefaults\": \"EuclideanSq + Distance\", \"setterRemarkLabelsInverted\": true},\n";
    out << "  \"boundaryProbe\": {\"count\": " << boundaries.size() << ", \"cellValueJumpFineOverCoarse\": " << cellJumpRatio
        << ", \"f1JumpFineOverCoarse\": " << f1JumpRatio << ", \"f2MinusF1JumpFineOverCoarse\": " << gapJumpRatio
        << ", \"f2MinusF1BoundaryGapP95\": " << percentile(boundaryGap, 0.95)
        << ", \"f1GradientJumpMedian\": " << median(f1GradientJump)
        << ", \"f2MinusF1SlopeMean\": " << slopeMean << ", \"f2MinusF1SlopeCv\": " << slopeCv << "},\n";
    out << "  \"fields\": {\n";
    out << "    \"CellValue\": "; writeStats(out, cellStats); out << ",\n";
    out << "    \"F1DistanceShifted\": "; writeStats(out, f1Stats); out << ",\n";
    out << "    \"F2MinusF1Shifted\": "; writeStats(out, gapStats); out << "\n";
    out << "  },\n";
    out << "  \"geometryHashes\": {\"baseline\": \"" << baseHash << "\", \"materialOnly\": \"" << materialOnlyHash
        << "\", \"CellValueDisplacement\": \"" << cellGeometryHash << "\", \"F1Displacement\": \"" << f1GeometryHash
        << "\", \"F2MinusF1Displacement\": \"" << gapGeometryHash << "\"},\n";
    out << "  \"cpuBenchmark\": {\"samplesEach\": 1000000, \"CellValueNs\": " << cellNs << ", \"F1Ns\": " << f1Ns << ", \"F2MinusF1Ns\": " << gapNs << "},\n";
    out << "  \"summary\": {\"checks\": " << checks.size() << ", \"passed\": " << passed << ", \"failed\": " << (checks.size() - passed) << "},\n";
    out << "  \"currentBestView\": \"CellValue is a piecewise-constant cell identity mask with value cliffs. F1 is value-continuous but has gradient seams at nearest-feature changes. FastNoiseLite Distance2Sub plus one is an unsigned edge-gap proxy that reaches zero at cell boundaries but is not a unit-slope Euclidean edge distance. Material use and authorized displacement remain separate.\",\n";
    out << "  \"boundary\": \"CPU and fixed-source only. No GPU derivative, antialiasing, Mother runtime, physical soil/rock meaning, collision, public device or user visual acceptance is verified.\",\n";
    out << "  \"checks\": [\n";
    for (size_t i = 0; i < checks.size(); ++i) {
        out << "    {\"name\": \"" << checks[i].name << "\", \"pass\": " << (checks[i].pass ? "true" : "false") << "}" << (i + 1 == checks.size() ? "\n" : ",\n");
    }
    out << "  ]\n}\n";
    if (argc > 1) { std::ofstream file(argv[1]); file << out.str(); }
    std::cout << out.str();
    return ok ? 0 : 1;
}
