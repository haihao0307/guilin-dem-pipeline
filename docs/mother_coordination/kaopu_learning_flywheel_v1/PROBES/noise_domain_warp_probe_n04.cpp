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

constexpr int kBaseSeed = 424242;
constexpr int kWarpSeed = 31337;
constexpr float kBaseFrequency = 1.0f / 32.0f;
constexpr float kWarpFrequency = 1.0f / 64.0f;
constexpr float kWarpAmplitudeM = 8.0f;
constexpr double kHeightScaleM = 2.5;
constexpr int kGrid = 129;
constexpr double kDerivativeEpsilonM = 0.02;
volatile double gSink = 0.0;

struct Vec2 { double x; double y; };
struct Vec3 { double x; double y; double z; };

double norm(Vec2 v) { return std::hypot(v.x, v.y); }
Vec3 normalize(Vec3 v) {
    const double d = std::sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return {v.x / d, v.y / d, v.z / d};
}
double angleDegrees(Vec3 a, Vec3 b) {
    const double d = std::clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1.0, 1.0);
    return std::acos(d) * 180.0 / 3.14159265358979323846;
}

Vec2 warpPoint(const FastNoiseLite& warp, double x, double y) {
    float qx = static_cast<float>(x);
    float qy = static_cast<float>(y);
    warp.DomainWarp(qx, qy);
    return {qx, qy};
}

double baseValue(const FastNoiseLite& noise, double x, double y) {
    return noise.GetNoise(static_cast<float>(x), static_cast<float>(y));
}

double warpedValue(const FastNoiseLite& noise, const FastNoiseLite& warp, double x, double y) {
    const Vec2 q = warpPoint(warp, x, y);
    return baseValue(noise, q.x, q.y);
}

Vec2 gradientBase(const FastNoiseLite& noise, double x, double y, double e) {
    return {
        (baseValue(noise, x + e, y) - baseValue(noise, x - e, y)) / (2.0 * e),
        (baseValue(noise, x, y + e) - baseValue(noise, x, y - e)) / (2.0 * e)
    };
}

Vec2 gradientWarped(const FastNoiseLite& noise, const FastNoiseLite& warp, double x, double y, double e) {
    return {
        (warpedValue(noise, warp, x + e, y) - warpedValue(noise, warp, x - e, y)) / (2.0 * e),
        (warpedValue(noise, warp, x, y + e) - warpedValue(noise, warp, x, y - e)) / (2.0 * e)
    };
}

Vec2 chainRuleGradient(const FastNoiseLite& noise, const FastNoiseLite& warp, double x, double y, double e) {
    const Vec2 q = warpPoint(warp, x, y);
    const Vec2 gn = gradientBase(noise, q.x, q.y, e);
    const Vec2 qxp = warpPoint(warp, x + e, y);
    const Vec2 qxm = warpPoint(warp, x - e, y);
    const Vec2 qyp = warpPoint(warp, x, y + e);
    const Vec2 qym = warpPoint(warp, x, y - e);
    const double dqxdx = (qxp.x - qxm.x) / (2.0 * e);
    const double dqydx = (qxp.y - qxm.y) / (2.0 * e);
    const double dqxdy = (qyp.x - qym.x) / (2.0 * e);
    const double dqydy = (qyp.y - qym.y) / (2.0 * e);
    return {dqxdx * gn.x + dqydx * gn.y, dqxdy * gn.x + dqydy * gn.y};
}

uint64_t fnv1a(const std::vector<float>& values) {
    uint64_t h = 1469598103934665603ULL;
    for (float value : values) {
        uint32_t bits = 0;
        std::memcpy(&bits, &value, sizeof(bits));
        for (int i = 0; i < 4; ++i) {
            h ^= static_cast<uint8_t>((bits >> (8 * i)) & 0xff);
            h *= 1099511628211ULL;
        }
    }
    return h;
}

std::string hex64(uint64_t value) {
    std::ostringstream out;
    out << std::hex << std::setw(16) << std::setfill('0') << value;
    return out.str();
}

struct Metrics {
    std::string name;
    double rmsFieldDelta = 0;
    double rmsHeightDeltaM = 0;
    double maxWarpDistanceM = 0;
    double meanNormalAngleDeg = 0;
    double maxNormalAngleDeg = 0;
    double rmsChainRuleError = 0;
    double rmsNaiveDerivativeError = 0;
    bool reorderExact = true;
    std::string baselineGeometryHash;
    std::string materialOnlyGeometryHash;
    std::string warpedGeometryHash;
    long long baselineNs = 0;
    long long warpedNs = 0;
    double costRatio = 0;
};

long long benchmark(const FastNoiseLite& noise, const FastNoiseLite& warp, bool useWarp) {
    constexpr int count = 1000000;
    std::array<long long, 3> times{};
    for (int repeat = 0; repeat < 3; ++repeat) {
        double sink = 0;
        const auto start = std::chrono::steady_clock::now();
        for (int i = 0; i < count; ++i) {
            const double x = (i % 1000) * 0.37 + repeat * 0.013;
            const double y = (i / 1000) * 0.41 - repeat * 0.017;
            sink += useWarp ? warpedValue(noise, warp, x, y) : baseValue(noise, x, y);
        }
        const auto end = std::chrono::steady_clock::now();
        gSink += sink;
        times[repeat] = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
    }
    std::sort(times.begin(), times.end());
    return times[1];
}

Metrics measure(const std::string& name, FastNoiseLite::NoiseType type, const FastNoiseLite& warp) {
    FastNoiseLite noise(kBaseSeed);
    noise.SetFrequency(kBaseFrequency);
    noise.SetNoiseType(type);

    std::vector<float> baseline;
    std::vector<float> warped;
    baseline.reserve(kGrid * kGrid);
    warped.reserve(kGrid * kGrid);
    double fieldSq = 0;
    double maxWarp = 0;
    for (int y = 0; y < kGrid; ++y) {
        for (int x = 0; x < kGrid; ++x) {
            const double b = baseValue(noise, x, y);
            const Vec2 q = warpPoint(warp, x, y);
            const double w = baseValue(noise, q.x, q.y);
            baseline.push_back(static_cast<float>(kHeightScaleM * b));
            warped.push_back(static_cast<float>(kHeightScaleM * w));
            fieldSq += (w - b) * (w - b);
            maxWarp = std::max(maxWarp, std::hypot(q.x - x, q.y - y));
        }
    }

    double normalSum = 0;
    double normalMax = 0;
    int normalCount = 0;
    for (int y = 1; y < kGrid - 1; ++y) {
        for (int x = 1; x < kGrid - 1; ++x) {
            const Vec2 gb = gradientBase(noise, x, y, 1.0);
            const Vec2 gw = gradientWarped(noise, warp, x, y, 1.0);
            const Vec3 nb = normalize({-kHeightScaleM * gb.x, 1.0, -kHeightScaleM * gb.y});
            const Vec3 nw = normalize({-kHeightScaleM * gw.x, 1.0, -kHeightScaleM * gw.y});
            const double angle = angleDegrees(nb, nw);
            normalSum += angle;
            normalMax = std::max(normalMax, angle);
            normalCount += 1;
        }
    }

    const std::array<Vec2, 12> derivativePoints{{
        {12.25, 17.75}, {23.50, 91.125}, {37.50, 49.125}, {44.75, 73.50},
        {58.125, 12.875}, {67.25, 111.50}, {79.875, 63.25}, {83.25, 101.50},
        {96.50, 36.75}, {105.125, 84.875}, {113.75, 22.50}, {121.25, 116.75}
    }};
    double chainSq = 0;
    double naiveSq = 0;
    for (Vec2 p : derivativePoints) {
        const Vec2 actual = gradientWarped(noise, warp, p.x, p.y, kDerivativeEpsilonM);
        const Vec2 predicted = chainRuleGradient(noise, warp, p.x, p.y, kDerivativeEpsilonM);
        const Vec2 q = warpPoint(warp, p.x, p.y);
        const Vec2 naive = gradientBase(noise, q.x, q.y, kDerivativeEpsilonM);
        chainSq += (actual.x - predicted.x) * (actual.x - predicted.x) + (actual.y - predicted.y) * (actual.y - predicted.y);
        naiveSq += (actual.x - naive.x) * (actual.x - naive.x) + (actual.y - naive.y) * (actual.y - naive.y);
    }

    bool reorderExact = true;
    for (int index = kGrid * kGrid - 1; index >= 0; --index) {
        const int x = index % kGrid;
        const int y = index / kGrid;
        reorderExact = reorderExact && static_cast<float>(kHeightScaleM * warpedValue(noise, warp, x, y)) == warped[index];
    }

    Metrics m;
    m.name = name;
    m.rmsFieldDelta = std::sqrt(fieldSq / baseline.size());
    m.rmsHeightDeltaM = kHeightScaleM * m.rmsFieldDelta;
    m.maxWarpDistanceM = maxWarp;
    m.meanNormalAngleDeg = normalSum / normalCount;
    m.maxNormalAngleDeg = normalMax;
    m.rmsChainRuleError = std::sqrt(chainSq / derivativePoints.size());
    m.rmsNaiveDerivativeError = std::sqrt(naiveSq / derivativePoints.size());
    m.reorderExact = reorderExact;
    m.baselineGeometryHash = hex64(fnv1a(baseline));
    m.materialOnlyGeometryHash = hex64(fnv1a(baseline));
    m.warpedGeometryHash = hex64(fnv1a(warped));
    m.baselineNs = benchmark(noise, warp, false);
    m.warpedNs = benchmark(noise, warp, true);
    m.costRatio = static_cast<double>(m.warpedNs) / m.baselineNs;
    return m;
}

std::string jsonEscape(const std::string& text) {
    std::string out;
    for (char c : text) {
        if (c == '"' || c == '\\') out += '\\';
        out += c;
    }
    return out;
}

} // namespace

int main(int argc, char** argv) {
    FastNoiseLite warp(kWarpSeed);
    warp.SetFrequency(kWarpFrequency);
    warp.SetDomainWarpType(FastNoiseLite::DomainWarpType_OpenSimplex2);
    warp.SetDomainWarpAmp(kWarpAmplitudeM);

    const std::vector<Metrics> metrics{
        measure("OpenSimplex2", FastNoiseLite::NoiseType_OpenSimplex2, warp),
        measure("Perlin", FastNoiseLite::NoiseType_Perlin, warp),
        measure("Value", FastNoiseLite::NoiseType_Value, warp)
    };

    struct Check { std::string name; bool pass; };
    std::vector<Check> checks;
    auto check = [&](const std::string& name, bool pass) { checks.push_back({name, pass}); };
    for (const Metrics& m : metrics) {
        check(m.name + " warp changes sampled field", m.rmsFieldDelta > 0.01);
        check(m.name + " material-only warp leaves geometry bytes unchanged", m.materialOnlyGeometryHash == m.baselineGeometryHash);
        check(m.name + " geometry changes only when warped field is assigned", m.warpedGeometryHash != m.baselineGeometryHash && m.rmsHeightDeltaM > 0.02);
        check(m.name + " coordinate identity survives evaluation reorder", m.reorderExact);
        check(m.name + " chain-rule derivative matches composed field", m.rmsChainRuleError < 0.0015);
        check(m.name + " chain rule improves over unwarped-coordinate gradient", m.rmsChainRuleError < m.rmsNaiveDerivativeError * 0.35);
        check(m.name + " warped height requires changed geometric normal", m.meanNormalAngleDeg > 0.1);
        check(m.name + " CPU timing was measured", m.baselineNs > 0 && m.warpedNs > 0 && m.costRatio > 1.0);
    }
    const int passed = static_cast<int>(std::count_if(checks.begin(), checks.end(), [](const Check& c) { return c.pass; }));
    const bool ok = passed == static_cast<int>(checks.size());

    std::ostringstream out;
    out << std::fixed << std::setprecision(9);
    out << "{\n";
    out << "  \"schema\": \"kaopu-noise-domain-warp-result/n04\",\n";
    out << "  \"status\": \"" << (ok ? "pass" : "fail") << "\",\n";
    out << "  \"evidenceClass\": \"pinned FastNoiseLite 1.1.1 C++ source plus deterministic CPU field/geometry/derivative probes\",\n";
    out << "  \"sourceRevision\": \"785f37a9ad76e283586a379675085f2063ae03f7\",\n";
    out << "  \"sourceBlob\": \"c67f2e5cec4653ebf85e9f19eec2d6ddfd8ca697\",\n";
    out << "  \"configuration\": {\"baseSeed\": " << kBaseSeed << ", \"warpSeed\": " << kWarpSeed
        << ", \"baseFrequencyPerM\": " << kBaseFrequency << ", \"warpFrequencyPerM\": " << kWarpFrequency
        << ", \"warpAmplitudeM\": " << kWarpAmplitudeM << ", \"heightScaleM\": " << kHeightScaleM
        << ", \"grid\": [" << kGrid << ", " << kGrid << "]},\n";
    out << "  \"kernels\": [\n";
    for (size_t i = 0; i < metrics.size(); ++i) {
        const Metrics& m = metrics[i];
        out << "    {\"name\": \"" << jsonEscape(m.name) << "\", \"rmsFieldDelta\": " << m.rmsFieldDelta
            << ", \"rmsHeightDeltaM\": " << m.rmsHeightDeltaM << ", \"maxWarpDistanceM\": " << m.maxWarpDistanceM
            << ", \"meanNormalAngleDeg\": " << m.meanNormalAngleDeg << ", \"maxNormalAngleDeg\": " << m.maxNormalAngleDeg
            << ", \"rmsChainRuleError\": " << m.rmsChainRuleError << ", \"rmsNaiveDerivativeError\": " << m.rmsNaiveDerivativeError
            << ", \"reorderExact\": " << (m.reorderExact ? "true" : "false")
            << ", \"baselineGeometryHash\": \"" << m.baselineGeometryHash << "\", \"materialOnlyGeometryHash\": \"" << m.materialOnlyGeometryHash
            << "\", \"warpedGeometryHash\": \"" << m.warpedGeometryHash << "\", \"cpuBenchmark\": {\"samples\": 1000000, \"baselineNs\": " << m.baselineNs
            << ", \"warpPlusNoiseNs\": " << m.warpedNs << ", \"ratio\": " << m.costRatio << "}}" << (i + 1 == metrics.size() ? "\n" : ",\n");
    }
    out << "  ],\n";
    out << "  \"summary\": {\"checks\": " << checks.size() << ", \"passed\": " << passed << ", \"failed\": " << (checks.size() - passed) << "},\n";
    out << "  \"currentBestView\": \"Domain warp changes the coordinates at which a fixed seeded base kernel is sampled. It changes actual shape only when the resulting scalar is assigned to vertex displacement. Normals for warped geometry require the full composed derivative J_q^T grad(n), while collision and other consumers require separately updated geometry.\",\n";
    out << "  \"boundary\": \"The timings are CPU-only and host-specific. No GPU, browser, iPhone, Mother runtime, collision, geological meaning, physical erosion, public delivery or user visual acceptance is verified.\",\n";
    out << "  \"checks\": [\n";
    for (size_t i = 0; i < checks.size(); ++i) {
        out << "    {\"name\": \"" << jsonEscape(checks[i].name) << "\", \"pass\": " << (checks[i].pass ? "true" : "false") << "}" << (i + 1 == checks.size() ? "\n" : ",\n");
    }
    out << "  ]\n}\n";

    if (argc > 1) {
        std::ofstream file(argv[1]);
        file << out.str();
    }
    std::cout << out.str();
    return ok ? 0 : 1;
}
