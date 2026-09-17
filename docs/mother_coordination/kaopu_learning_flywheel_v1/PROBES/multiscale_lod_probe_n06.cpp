#include "FastNoiseLite.h"

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <sstream>
#include <string>
#include <vector>

namespace {
constexpr int kSeed = 98765;
constexpr double kBaseFrequency = 1.0 / 32.0;
constexpr double kLacunarity = 2.0;
constexpr double kGain = 0.5;
constexpr int kOctaves = 8;
constexpr double kDomain = 64.0;
constexpr double kFineStep = 0.125;
constexpr int kFineN = 512;
constexpr double kHeightScale = 2.5;
constexpr double kClamp = 1.0;
volatile double gSink = 0;

enum class Mode { FBm, Ridged };

struct Distribution { double min, max, mean, stddev, clippedFraction, energy; };
struct LodMetrics {
    double spacing;
    int keptOctaves;
    double fullRmse, preserveRmse, renormRmse, compensatedRmse;
    double fullSilhouetteRmse, preserveSilhouetteRmse, renormSilhouetteRmse, compensatedSilhouetteRmse;
};

std::vector<double> weights(int octaves) {
    double sum = 0, amp = 1;
    std::vector<double> w(octaves);
    for (int i = 0; i < octaves; ++i) { w[i] = amp; sum += amp; amp *= kGain; }
    for (double& v : w) v /= sum;
    return w;
}

std::vector<FastNoiseLite> octaveNoise(int octaves) {
    std::vector<FastNoiseLite> out;
    for (int i = 0; i < octaves; ++i) {
        FastNoiseLite n(kSeed + i);
        n.SetNoiseType(FastNoiseLite::NoiseType_Perlin);
        n.SetFrequency(static_cast<float>(kBaseFrequency * std::pow(kLacunarity, i)));
        out.push_back(n);
    }
    return out;
}

double signal(const FastNoiseLite& n, Mode mode, double x, double y) {
    const double v = n.GetNoise(static_cast<float>(x), static_cast<float>(y));
    return mode == Mode::FBm ? v : 1.0 - 2.0 * std::abs(v);
}

double field(const std::vector<FastNoiseLite>& noises, const std::vector<double>& w, Mode mode,
             double x, double y, int keep, bool renormalize, const std::vector<double>* means) {
    double sum = 0, keptWeight = 0;
    for (int i = 0; i < keep; ++i) { sum += w[i] * signal(noises[i], mode, x, y); keptWeight += w[i]; }
    if (renormalize && keptWeight > 0) sum /= keptWeight;
    if (means) for (int i = keep; i < static_cast<int>(w.size()); ++i) sum += w[i] * (*means)[i];
    return sum;
}

Distribution distribution(const std::vector<double>& v, bool clamp) {
    std::vector<double> x(v.size());
    int clipped = 0;
    for (size_t i = 0; i < v.size(); ++i) {
        const double raw = kHeightScale * v[i];
        if (std::abs(raw) > kClamp) ++clipped;
        x[i] = clamp ? std::clamp(raw, -kClamp, kClamp) : raw;
    }
    Distribution d{};
    d.min = *std::min_element(x.begin(), x.end());
    d.max = *std::max_element(x.begin(), x.end());
    d.mean = std::accumulate(x.begin(), x.end(), 0.0) / x.size();
    double sq = 0, energy = 0;
    for (double z : x) { sq += (z - d.mean) * (z - d.mean); energy += z * z; }
    d.stddev = std::sqrt(sq / x.size());
    d.energy = energy / x.size();
    d.clippedFraction = static_cast<double>(clipped) / x.size();
    return d;
}

double rmse(double sumSq, size_t n) { return std::sqrt(sumSq / n); }

std::vector<LodMetrics> lodStudy(const std::vector<double>& fine, const std::vector<FastNoiseLite>& noises,
                                 const std::vector<double>& w, Mode mode, const std::vector<double>& means) {
    std::vector<LodMetrics> all;
    for (double spacing : {0.5, 1.0, 2.0, 4.0, 8.0}) {
        const int factor = static_cast<int>(std::llround(spacing / kFineStep));
        const int n = kFineN / factor;
        int keep = 0;
        const double nyquist = 0.5 / spacing;
        while (keep < kOctaves && kBaseFrequency * std::pow(kLacunarity, keep) <= nyquist + 1e-12) ++keep;
        keep = std::max(1, keep);
        double ssFull = 0, ssPreserve = 0, ssRenorm = 0, ssComp = 0;
        std::vector<double> silRef(n, -1e30), silFull(n, -1e30), silPreserve(n, -1e30), silRenorm(n, -1e30), silComp(n, -1e30);
        for (int cy = 0; cy < n; ++cy) {
            for (int cx = 0; cx < n; ++cx) {
                double ref = 0;
                for (int sy = 0; sy < factor; ++sy) for (int sx = 0; sx < factor; ++sx)
                    ref += fine[(cy * factor + sy) * kFineN + cx * factor + sx];
                ref /= factor * factor;
                const double x = (cx + 0.5) * spacing;
                const double y = (cy + 0.5) * spacing;
                const double full = field(noises, w, mode, x, y, kOctaves, false, nullptr);
                const double preserve = field(noises, w, mode, x, y, keep, false, nullptr);
                const double renorm = field(noises, w, mode, x, y, keep, true, nullptr);
                const double comp = field(noises, w, mode, x, y, keep, false, &means);
                ssFull += (full - ref) * (full - ref);
                ssPreserve += (preserve - ref) * (preserve - ref);
                ssRenorm += (renorm - ref) * (renorm - ref);
                ssComp += (comp - ref) * (comp - ref);
                silRef[cy] = std::max(silRef[cy], ref);
                silFull[cy] = std::max(silFull[cy], full);
                silPreserve[cy] = std::max(silPreserve[cy], preserve);
                silRenorm[cy] = std::max(silRenorm[cy], renorm);
                silComp[cy] = std::max(silComp[cy], comp);
            }
        }
        double sFull = 0, sPreserve = 0, sRenorm = 0, sComp = 0;
        for (int i = 0; i < n; ++i) {
            sFull += (silFull[i] - silRef[i]) * (silFull[i] - silRef[i]);
            sPreserve += (silPreserve[i] - silRef[i]) * (silPreserve[i] - silRef[i]);
            sRenorm += (silRenorm[i] - silRef[i]) * (silRenorm[i] - silRef[i]);
            sComp += (silComp[i] - silRef[i]) * (silComp[i] - silRef[i]);
        }
        const size_t cells = static_cast<size_t>(n) * n;
        all.push_back({spacing, keep, rmse(ssFull, cells), rmse(ssPreserve, cells), rmse(ssRenorm, cells), rmse(ssComp, cells),
                       rmse(sFull, n), rmse(sPreserve, n), rmse(sRenorm, n), rmse(sComp, n)});
    }
    return all;
}

long long benchmarkOctaves(int octaves, Mode mode) {
    FastNoiseLite n(kSeed);
    n.SetNoiseType(FastNoiseLite::NoiseType_Perlin);
    n.SetFrequency(static_cast<float>(kBaseFrequency));
    n.SetFractalType(mode == Mode::FBm ? FastNoiseLite::FractalType_FBm : FastNoiseLite::FractalType_Ridged);
    n.SetFractalOctaves(octaves);
    n.SetFractalLacunarity(static_cast<float>(kLacunarity));
    n.SetFractalGain(static_cast<float>(kGain));
    n.SetFractalWeightedStrength(0.0f);
    constexpr int count = 250000;
    std::array<long long, 3> times{};
    for (int r = 0; r < 3; ++r) {
        double sink = 0;
        const auto start = std::chrono::steady_clock::now();
        for (int i = 0; i < count; ++i) sink += n.GetNoise(static_cast<float>((i % 500) * 0.071), static_cast<float>((i / 500) * 0.067));
        const auto end = std::chrono::steady_clock::now();
        gSink += sink;
        times[r] = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();
    }
    std::sort(times.begin(), times.end());
    return times[1];
}

double builtInDifference(int aOctaves, int bOctaves, Mode mode) {
    auto make = [&](int octaves) {
        FastNoiseLite n(kSeed); n.SetNoiseType(FastNoiseLite::NoiseType_Perlin); n.SetFrequency(static_cast<float>(kBaseFrequency));
        n.SetFractalType(mode == Mode::FBm ? FastNoiseLite::FractalType_FBm : FastNoiseLite::FractalType_Ridged);
        n.SetFractalOctaves(octaves); n.SetFractalLacunarity(static_cast<float>(kLacunarity)); n.SetFractalGain(static_cast<float>(kGain)); n.SetFractalWeightedStrength(0);
        return n;
    };
    const auto a = make(aOctaves), b = make(bOctaves);
    double sq = 0; int count = 0;
    for (int y = 0; y < 129; ++y) for (int x = 0; x < 129; ++x) {
        const double d = a.GetNoise(x * 0.5f, y * 0.5f) - b.GetNoise(x * 0.5f, y * 0.5f);
        sq += d * d; ++count;
    }
    return std::sqrt(sq / count);
}

void writeDist(std::ostringstream& out, const Distribution& d) {
    out << "{\"min\": " << d.min << ", \"max\": " << d.max << ", \"mean\": " << d.mean << ", \"stddev\": " << d.stddev
        << ", \"clippedFraction\": " << d.clippedFraction << ", \"meanSquare\": " << d.energy << "}";
}

void writeLods(std::ostringstream& out, const std::vector<LodMetrics>& v) {
    out << "[\n";
    for (size_t i = 0; i < v.size(); ++i) {
        const auto& m = v[i];
        out << "      {\"spacingM\": " << m.spacing << ", \"keptOctaves\": " << m.keptOctaves
            << ", \"fieldRmse\": {\"full\": " << m.fullRmse << ", \"preserve\": " << m.preserveRmse << ", \"renormalized\": " << m.renormRmse << ", \"meanCompensated\": " << m.compensatedRmse
            << "}, \"silhouetteRmse\": {\"full\": " << m.fullSilhouetteRmse << ", \"preserve\": " << m.preserveSilhouetteRmse << ", \"renormalized\": " << m.renormSilhouetteRmse << ", \"meanCompensated\": " << m.compensatedSilhouetteRmse << "}}" << (i + 1 == v.size() ? "\n" : ",\n");
    }
    out << "    ]";
}
}

int main(int argc, char** argv) {
    const auto noises = octaveNoise(kOctaves);
    const auto w = weights(kOctaves);
    std::vector<double> fineFbm(kFineN * kFineN), fineRidged(kFineN * kFineN);
    std::vector<double> meansFbm(kOctaves, 0), meansRidged(kOctaves, 0);
    for (int y = 0; y < kFineN; ++y) for (int x = 0; x < kFineN; ++x) {
        const double px = (x + 0.5) * kFineStep, py = (y + 0.5) * kFineStep;
        double f = 0, r = 0;
        for (int i = 0; i < kOctaves; ++i) {
            const double sf = signal(noises[i], Mode::FBm, px, py), sr = signal(noises[i], Mode::Ridged, px, py);
            meansFbm[i] += sf; meansRidged[i] += sr; f += w[i] * sf; r += w[i] * sr;
        }
        fineFbm[y * kFineN + x] = f; fineRidged[y * kFineN + x] = r;
    }
    for (double& v : meansFbm) v /= fineFbm.size();
    for (double& v : meansRidged) v /= fineRidged.size();

    const auto fbmLod = lodStudy(fineFbm, noises, w, Mode::FBm, meansFbm);
    const auto ridgedLod = lodStudy(fineRidged, noises, w, Mode::Ridged, meansRidged);
    const Distribution fbmPre = distribution(fineFbm, false), fbmPost = distribution(fineFbm, true);
    const Distribution ridgedPre = distribution(fineRidged, false), ridgedPost = distribution(fineRidged, true);
    const double fbm8vs17 = builtInDifference(8, 17, Mode::FBm);
    const double ridged8vs17 = builtInDifference(8, 17, Mode::Ridged);
    const long long fbm8Ns = benchmarkOctaves(8, Mode::FBm), fbm17Ns = benchmarkOctaves(17, Mode::FBm);

    FastNoiseLite builtFbm(kSeed), builtRidged(kSeed);
    for (auto* n : {&builtFbm, &builtRidged}) { n->SetNoiseType(FastNoiseLite::NoiseType_Perlin); n->SetFrequency(kBaseFrequency); n->SetFractalOctaves(kOctaves); n->SetFractalLacunarity(kLacunarity); n->SetFractalGain(kGain); n->SetFractalWeightedStrength(0); }
    builtFbm.SetFractalType(FastNoiseLite::FractalType_FBm); builtRidged.SetFractalType(FastNoiseLite::FractalType_Ridged);
    double manualFbmSq = 0, manualRidgedSq = 0; int compareCount = 0;
    for (int y = 0; y < 65; ++y) for (int x = 0; x < 65; ++x) {
        const double px = x * 0.71, py = y * 0.67;
        const double df = builtFbm.GetNoise(px, py) - field(noises, w, Mode::FBm, px, py, kOctaves, false, nullptr);
        const double dr = builtRidged.GetNoise(px, py) - field(noises, w, Mode::Ridged, px, py, kOctaves, false, nullptr);
        manualFbmSq += df * df; manualRidgedSq += dr * dr; ++compareCount;
    }
    const double manualFbmRmse = std::sqrt(manualFbmSq / compareCount), manualRidgedRmse = std::sqrt(manualRidgedSq / compareCount);

    struct Check { std::string name; bool pass; }; std::vector<Check> checks;
    auto check = [&](std::string n, bool p) { checks.push_back({std::move(n), p}); };
    check("manual fBm composition matches pinned implementation", manualFbmRmse < 2e-5);
    check("manual ridged composition matches pinned implementation", manualRidgedRmse < 2e-5);
    check("normalized fBm remains inside source amplitude bound", fbmPre.min >= -kHeightScale - 1e-6 && fbmPre.max <= kHeightScale + 1e-6);
    check("normalized ridged remains inside source amplitude bound", ridgedPre.min >= -kHeightScale - 1e-6 && ridgedPre.max <= kHeightScale + 1e-6);
    check("fBm sampled mean is not asserted exact zero", std::abs(fbmPre.mean) > 1e-5);
    check("ridged transform has nonzero sampled mean", std::abs(ridgedPre.mean) > 0.05);
    check("fBm clamp changes distribution", fbmPre.clippedFraction > 0.01 && fbmPost.stddev < fbmPre.stddev);
    check("ridged clamp changes distribution", ridgedPre.clippedFraction > 0.01 && ridgedPost.stddev < ridgedPre.stddev);
    check("LOD octave count decreases with coarser sampling", fbmLod[0].keptOctaves > fbmLod[4].keptOctaves);
    check("coarse fBm filtering improves 4m and 8m silhouette plus 8m field error",
          fbmLod[3].compensatedSilhouetteRmse < fbmLod[3].fullSilhouetteRmse &&
          fbmLod[4].compensatedSilhouetteRmse < fbmLod[4].fullSilhouetteRmse &&
          fbmLod[4].compensatedRmse < fbmLod[4].fullRmse);
    check("coarse ridged mean-compensated filtering beats full point sampling", ridgedLod[3].compensatedRmse < ridgedLod[3].fullRmse && ridgedLod[4].compensatedRmse < ridgedLod[4].fullRmse);
    check("renormalizing retained fBm octaves is worse than preserving weights", fbmLod[4].renormRmse > fbmLod[4].preserveRmse);
    check("ridged removed-octave mean compensation improves preserved cutoff", ridgedLod[4].compensatedRmse < ridgedLod[4].preserveRmse);
    check("17 octaves are measurably more expensive than 8", fbm17Ns > fbm8Ns * 1.5);
    check("8 to 17 octave RMS delta is bounded for gain one-half", fbm8vs17 < 0.01 && ridged8vs17 < 0.01);
    const int passed = std::count_if(checks.begin(), checks.end(), [](const Check& c){ return c.pass; });
    const bool ok = passed == static_cast<int>(checks.size());

    std::ostringstream out; out << std::fixed << std::setprecision(9);
    out << "{\n  \"schema\": \"kaopu-multiscale-lod-result/n06\",\n  \"status\": \"" << (ok ? "pass" : "fail") << "\",\n";
    out << "  \"evidenceClass\": \"pinned FastNoiseLite 1.1.1 source plus deterministic CPU multiscale/resampling probe\",\n";
    out << "  \"sourceRevision\": \"785f37a9ad76e283586a379675085f2063ae03f7\",\n";
    out << "  \"configuration\": {\"seed\": " << kSeed << ", \"baseFrequencyPerM\": " << kBaseFrequency << ", \"lacunarity\": " << kLacunarity << ", \"gain\": " << kGain << ", \"octaves\": " << kOctaves << ", \"fineStepM\": " << kFineStep << ", \"domainM\": " << kDomain << "},\n";
    out << "  \"compositionEquivalenceRmse\": {\"fBm\": " << manualFbmRmse << ", \"ridged\": " << manualRidgedRmse << "},\n";
    out << "  \"distribution\": {\"fBmPreClamp\": "; writeDist(out, fbmPre); out << ", \"fBmPostClamp\": "; writeDist(out, fbmPost); out << ", \"ridgedPreClamp\": "; writeDist(out, ridgedPre); out << ", \"ridgedPostClamp\": "; writeDist(out, ridgedPost); out << "},\n";
    out << "  \"lod\": {\n    \"fBm\": "; writeLods(out, fbmLod); out << ",\n    \"ridged\": "; writeLods(out, ridgedLod); out << "\n  },\n";
    out << "  \"octaveBudget\": {\"fBm8Vs17Rmse\": " << fbm8vs17 << ", \"ridged8Vs17Rmse\": " << ridged8vs17 << ", \"fBm8Ns250k\": " << fbm8Ns << ", \"fBm17Ns250k\": " << fbm17Ns << ", \"costRatio17Over8\": " << static_cast<double>(fbm17Ns) / fbm8Ns << "},\n";
    out << "  \"summary\": {\"checks\": " << checks.size() << ", \"passed\": " << passed << ", \"failed\": " << checks.size() - passed << "},\n";
    out << "  \"currentBestView\": \"Fractal bounding limits worst-case amplitude but does not guarantee zero mean, preserved distribution, alias-free resampling or silhouette stability. LOD filtering should remove octaves above the sampling Nyquist limit while preserving original octave weights; nonzero-mean transforms such as ridged noise also require an explicit removed-band mean policy. Clamp statistics must be recorded before and after clipping. Octave count is an error/cost decision, not a mandatory layer count.\",\n";
    out << "  \"boundary\": \"CPU and fixed-source only. Nominal frequency cutoff is a conservative probe, not a proof of exact kernel bandwidth. No GPU derivatives, browser/device performance, Mother runtime, collision, physical geology or user visual acceptance is verified.\",\n";
    out << "  \"checks\": [\n";
    for (size_t i = 0; i < checks.size(); ++i) out << "    {\"name\": \"" << checks[i].name << "\", \"pass\": " << (checks[i].pass ? "true" : "false") << "}" << (i + 1 == checks.size() ? "\n" : ",\n");
    out << "  ]\n}\n";
    if (argc > 1) { std::ofstream f(argv[1]); f << out.str(); }
    std::cout << out.str(); return ok ? 0 : 1;
}
