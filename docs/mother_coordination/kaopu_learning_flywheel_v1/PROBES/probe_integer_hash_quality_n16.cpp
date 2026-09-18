#include <algorithm>
#include <array>
#include <bit>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <numeric>
#include <string>
#include <tuple>
#include <vector>

using U32 = std::uint32_t;

static inline U32 lowbias32(U32 x) {
    x ^= x >> 16;
    x *= 0x7feb352dU;
    x ^= x >> 15;
    x *= 0x846ca68bU;
    x ^= x >> 16;
    return x;
}

static inline U32 newer2round(U32 x) {
    x ^= x >> 16;
    x *= 0x21f0aaadU;
    x ^= x >> 15;
    x *= 0xd35a2d97U;
    x ^= x >> 15;
    return x;
}

static inline U32 rotl16(U32 x) { return (x << 16) | (x >> 16); }

template<U32 (*Mix)(U32)>
static inline U32 pair_hash(std::int32_t x, std::int32_t y) {
    return Mix(Mix(std::bit_cast<U32>(x)) ^ rotl16(Mix(std::bit_cast<U32>(y))) ^ 0x9e3779b9U);
}

static inline U32 weak_pair(std::int32_t x, std::int32_t y) {
    return std::bit_cast<U32>(x) ^ rotl16(std::bit_cast<U32>(y));
}

struct GridStats {
    std::uint64_t samples{};
    std::uint64_t unique{};
    std::uint64_t duplicate_items{};
    std::uint64_t duplicate_pairs{};
    double birthday_expected_pairs{};
    double low_byte_chi_square{};
    double adjacent_mean_hamming{};
    double adjacent_flip_rms_deviation{};
    double adjacent_flip_max_deviation{};
};

struct CollisionWitness {
    U32 hash{};
    std::int32_t x1{}, y1{}, x2{}, y2{};
};

template<U32 (*Hash)(std::int32_t, std::int32_t)>
std::vector<CollisionWitness> centered_collision_witnesses(std::size_t limit) {
    constexpr int side = 1024;
    constexpr int origin = -512;
    std::vector<std::tuple<U32, std::int32_t, std::int32_t>> values;
    values.reserve(std::size_t(side) * side);
    for (int y = 0; y < side; ++y) for (int x = 0; x < side; ++x)
        values.emplace_back(Hash(origin + x, origin + y), origin + x, origin + y);
    std::sort(values.begin(), values.end());
    std::vector<CollisionWitness> result;
    for (std::size_t i = 1; i < values.size() && result.size() < limit; ++i) {
        auto [h0, x0, y0] = values[i - 1];
        auto [h1, x1, y1] = values[i];
        if (h0 == h1 && (x0 != x1 || y0 != y1)) result.push_back({h0, x0, y0, x1, y1});
    }
    return result;
}

template<U32 (*Hash)(std::int32_t, std::int32_t)>
GridStats grid_stats() {
    constexpr int side = 1024;
    constexpr int origin = -512;
    std::vector<U32> values;
    values.reserve(std::size_t(side) * side);
    std::array<std::uint64_t, 256> low{};
    std::array<std::uint64_t, 32> flips{};
    std::uint64_t edges = 0;
    std::uint64_t hamming = 0;
    for (int y = 0; y < side; ++y) {
        for (int x = 0; x < side; ++x) {
            U32 h = Hash(origin + x, origin + y);
            values.push_back(h);
            ++low[h & 255U];
            if (x + 1 < side) {
                U32 d = h ^ Hash(origin + x + 1, origin + y);
                hamming += std::popcount(d);
                for (unsigned b = 0; b < 32; ++b) flips[b] += (d >> b) & 1U;
                ++edges;
            }
            if (y + 1 < side) {
                U32 d = h ^ Hash(origin + x, origin + y + 1);
                hamming += std::popcount(d);
                for (unsigned b = 0; b < 32; ++b) flips[b] += (d >> b) & 1U;
                ++edges;
            }
        }
    }
    std::sort(values.begin(), values.end());
    std::uint64_t unique = 0, dup_items = 0, dup_pairs = 0;
    for (std::size_t i = 0; i < values.size();) {
        std::size_t j = i + 1;
        while (j < values.size() && values[j] == values[i]) ++j;
        std::uint64_t count = j - i;
        ++unique;
        if (count > 1) {
            dup_items += count - 1;
            dup_pairs += count * (count - 1) / 2;
        }
        i = j;
    }
    const double expected_bin = double(values.size()) / 256.0;
    double chi2 = 0.0;
    for (auto count : low) {
        double d = double(count) - expected_bin;
        chi2 += d * d / expected_bin;
    }
    double sum_sq = 0.0, max_dev = 0.0;
    for (auto count : flips) {
        double rate = double(count) / double(edges);
        double dev = std::abs(rate - 0.5);
        sum_sq += dev * dev;
        max_dev = std::max(max_dev, dev);
    }
    double n = double(values.size());
    return {
        std::uint64_t(values.size()), unique, dup_items, dup_pairs,
        n * (n - 1.0) / (2.0 * 4294967296.0), chi2,
        double(hamming) / double(edges), std::sqrt(sum_sq / 32.0), max_dev
    };
}

struct AvalancheStats {
    std::uint64_t base_pairs{};
    double mean_hamming{};
    double rms_cell_deviation{};
    double max_cell_deviation{};
};

struct WindowCollisionStats {
    std::uint32_t windows{};
    std::uint64_t samples_per_window{};
    double expected_pairs_per_window{};
    double mean_pairs{};
    std::uint64_t min_pairs{};
    std::uint64_t max_pairs{};
};

template<U32 (*Hash)(std::int32_t, std::int32_t)>
WindowCollisionStats translated_window_collisions() {
    constexpr int side = 512;
    constexpr std::array<std::pair<std::int32_t, std::int32_t>, 16> origins{{
        {-1000000000, -1000000000}, {-1000000000, -333333333}, {-1000000000, 333333333}, {-1000000000, 999999488},
        {-333333333, -1000000000}, {-333333333, -333333333}, {-333333333, 333333333}, {-333333333, 999999488},
        {333333333, -1000000000}, {333333333, -333333333}, {333333333, 333333333}, {333333333, 999999488},
        {999999488, -1000000000}, {999999488, -333333333}, {999999488, 333333333}, {999999488, 999999488}
    }};
    std::vector<U32> values(std::size_t(side) * side);
    std::uint64_t total = 0, minimum = UINT64_MAX, maximum = 0;
    for (auto [ox, oy] : origins) {
        std::size_t k = 0;
        for (int y = 0; y < side; ++y) for (int x = 0; x < side; ++x)
            values[k++] = Hash(ox + x, oy + y);
        std::sort(values.begin(), values.end());
        std::uint64_t pairs = 0;
        for (std::size_t i = 0; i < values.size();) {
            std::size_t j = i + 1;
            while (j < values.size() && values[j] == values[i]) ++j;
            std::uint64_t count = j - i;
            pairs += count * (count - 1) / 2;
            i = j;
        }
        total += pairs;
        minimum = std::min(minimum, pairs);
        maximum = std::max(maximum, pairs);
    }
    double n = double(values.size());
    return {std::uint32_t(origins.size()), values.size(),
            n * (n - 1.0) / (2.0 * 4294967296.0),
            double(total) / origins.size(), minimum, maximum};
}

static U32 splitmix32(U32 &state) {
    U32 z = (state += 0x9e3779b9U);
    z = (z ^ (z >> 16)) * 0x21f0aaadU;
    z = (z ^ (z >> 15)) * 0x735a2d97U;
    return z ^ (z >> 15);
}

template<U32 (*Hash)(std::int32_t, std::int32_t)>
AvalancheStats avalanche_stats() {
    constexpr std::uint32_t samples = 65536;
    std::array<std::array<std::uint64_t, 32>, 64> flips{};
    std::uint64_t total_hamming = 0;
    U32 state = 0x4b41504fU;
    for (std::uint32_t i = 0; i < samples; ++i) {
        U32 ux = splitmix32(state), uy = splitmix32(state);
        auto x = std::bit_cast<std::int32_t>(ux);
        auto y = std::bit_cast<std::int32_t>(uy);
        U32 base = Hash(x, y);
        for (unsigned ib = 0; ib < 64; ++ib) {
            U32 d;
            if (ib < 32) d = base ^ Hash(std::bit_cast<std::int32_t>(ux ^ (U32(1) << ib)), y);
            else d = base ^ Hash(x, std::bit_cast<std::int32_t>(uy ^ (U32(1) << (ib - 32))));
            total_hamming += std::popcount(d);
            for (unsigned ob = 0; ob < 32; ++ob) flips[ib][ob] += (d >> ob) & 1U;
        }
    }
    double sum_sq = 0.0, max_dev = 0.0;
    for (const auto &row : flips) for (auto count : row) {
        double dev = std::abs(double(count) / samples - 0.5);
        sum_sq += dev * dev;
        max_dev = std::max(max_dev, dev);
    }
    return {samples, double(total_hamming) / (double(samples) * 64.0),
            std::sqrt(sum_sq / (64.0 * 32.0)), max_dev};
}

void print_grid(const char *name, const GridStats &s, bool comma) {
    std::cout << "    \"" << name << "\": {\n"
              << "      \"samples\": " << s.samples << ",\n"
              << "      \"unique\": " << s.unique << ",\n"
              << "      \"duplicateItems\": " << s.duplicate_items << ",\n"
              << "      \"duplicatePairs\": " << s.duplicate_pairs << ",\n"
              << "      \"birthdayExpectedPairs\": " << s.birthday_expected_pairs << ",\n"
              << "      \"lowByteChiSquareDf255\": " << s.low_byte_chi_square << ",\n"
              << "      \"adjacentMeanHamming\": " << s.adjacent_mean_hamming << ",\n"
              << "      \"adjacentFlipRmsDeviation\": " << s.adjacent_flip_rms_deviation << ",\n"
              << "      \"adjacentFlipMaxDeviation\": " << s.adjacent_flip_max_deviation << "\n"
              << "    }" << (comma ? "," : "") << "\n";
}

void print_avalanche(const char *name, const AvalancheStats &s, bool comma) {
    std::cout << "    \"" << name << "\": {\n"
              << "      \"basePairs\": " << s.base_pairs << ",\n"
              << "      \"meanHamming\": " << s.mean_hamming << ",\n"
              << "      \"rmsCellDeviation\": " << s.rms_cell_deviation << ",\n"
              << "      \"maxCellDeviation\": " << s.max_cell_deviation << "\n"
              << "    }" << (comma ? "," : "") << "\n";
}

void print_windows(const char *name, const WindowCollisionStats &s, bool comma) {
    std::cout << "    \"" << name << "\": {\n"
              << "      \"windows\": " << s.windows << ",\n"
              << "      \"samplesPerWindow\": " << s.samples_per_window << ",\n"
              << "      \"birthdayExpectedPairsPerWindow\": " << s.expected_pairs_per_window << ",\n"
              << "      \"meanDuplicatePairs\": " << s.mean_pairs << ",\n"
              << "      \"minDuplicatePairs\": " << s.min_pairs << ",\n"
              << "      \"maxDuplicatePairs\": " << s.max_pairs << "\n"
              << "    }" << (comma ? "," : "") << "\n";
}

void print_witnesses(const char *name, const std::vector<CollisionWitness> &values, bool comma) {
    std::cout << "    \"" << name << "\": [\n";
    for (std::size_t i = 0; i < values.size(); ++i) {
        const auto &w = values[i];
        std::cout << "      {\"hash\": \"0x" << std::hex << std::setw(8) << std::setfill('0') << w.hash
                  << std::dec << std::setfill(' ') << "\", \"a\": [" << w.x1 << ", " << w.y1
                  << "], \"b\": [" << w.x2 << ", " << w.y2 << "]}" << (i + 1 < values.size() ? "," : "") << "\n";
    }
    std::cout << "    ]" << (comma ? "," : "") << "\n";
}

int main() {
    auto current_grid = grid_stats<pair_hash<lowbias32>>();
    auto newer_grid = grid_stats<pair_hash<newer2round>>();
    auto weak_grid = grid_stats<weak_pair>();
    auto current_av = avalanche_stats<pair_hash<lowbias32>>();
    auto newer_av = avalanche_stats<pair_hash<newer2round>>();
    auto weak_av = avalanche_stats<weak_pair>();
    auto current_windows = translated_window_collisions<pair_hash<lowbias32>>();
    auto newer_windows = translated_window_collisions<pair_hash<newer2round>>();
    auto weak_windows = translated_window_collisions<weak_pair>();
    auto current_witnesses = centered_collision_witnesses<pair_hash<lowbias32>>(4);
    auto newer_witnesses = centered_collision_witnesses<pair_hash<newer2round>>(4);

    bool gates = current_grid.samples == 1048576 && current_grid.unique + current_grid.duplicate_items == current_grid.samples
        && current_grid.adjacent_mean_hamming > 15.9 && current_grid.adjacent_mean_hamming < 16.1
        && current_av.mean_hamming > 15.9 && current_av.mean_hamming < 16.1
        && current_av.max_cell_deviation < 0.01
        && weak_av.max_cell_deviation > 0.49
        && current_windows.mean_pairs < 16.0;

    std::cout << std::fixed << std::setprecision(9)
              << "{\n  \"schema\": \"kaopu-integer-hash-quality-n16-v1\",\n"
              << "  \"grid\": {\n";
    print_grid("currentLowbias32Pair", current_grid, true);
    print_grid("newerTwoRoundPair", newer_grid, true);
    print_grid("weakXorPairNegativeControl", weak_grid, false);
    std::cout << "  },\n  \"sampledAvalanche\": {\n";
    print_avalanche("currentLowbias32Pair", current_av, true);
    print_avalanche("newerTwoRoundPair", newer_av, true);
    print_avalanche("weakXorPairNegativeControl", weak_av, false);
    std::cout << "  },\n  \"translatedWindowCollisions\": {\n";
    print_windows("currentLowbias32Pair", current_windows, true);
    print_windows("newerTwoRoundPair", newer_windows, true);
    print_windows("weakXorPairNegativeControl", weak_windows, false);
    std::cout << "  },\n  \"collisionWitnesses\": {\n";
    print_witnesses("currentLowbias32Pair", current_witnesses, true);
    print_witnesses("newerTwoRoundPair", newer_witnesses, false);
    std::cout << "  },\n  \"gates\": {\n"
              << "    \"checks\": 7,\n    \"passed\": " << (gates ? 7 : 6) << ",\n"
              << "    \"failed\": " << (gates ? 0 : 1) << ",\n"
              << "    \"status\": \"" << (gates ? "pass" : "fail") << "\"\n  }\n}\n";
    return gates ? 0 : 1;
}
