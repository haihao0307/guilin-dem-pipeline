#include <bit>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <limits>

using U32 = std::uint32_t;

static float f32_closed(U32 h) {
    return static_cast<float>(h) / static_cast<float>(0xffffffffU);
}

static float top24_half_open(U32 h) {
    return static_cast<float>(h >> 8U) * 0x1p-24f;
}

static float mantissa23_half_open(U32 h) {
    return std::bit_cast<float>(0x3f800000U | (h >> 9U)) - 1.0f;
}

static double js_closed(U32 h) {
    return static_cast<double>(h) / 4294967295.0;
}

static void print_float(float v) {
    std::cout << std::setprecision(10) << v;
}

int main() {
    const U32 vectors[] = {0U, 1U, 0x000000ffU, 0x00000100U,
                           0xffffff7fU, 0xffffff80U, 0xfffffffeU, 0xffffffffU};
    std::uint64_t f32_endpoint_count = 0;
    U32 first_f32_one = 0;
    for (std::uint64_t n = 0xffffff00ULL; n <= 0xffffffffULL; ++n) {
        U32 h = static_cast<U32>(n);
        if (f32_closed(h) == 1.0f) {
            if (f32_endpoint_count == 0) first_f32_one = h;
            ++f32_endpoint_count;
        }
    }

    const bool g1 = js_closed(0xffffffffU) == 1.0;
    const bool g2 = js_closed(0xffffffffU) * (9.0 - 2.0) + 2.0 == 9.0;
    const bool g3 = f32_endpoint_count == 128 && first_f32_one == 0xffffff80U;
    const bool g4 = top24_half_open(0xffffffffU) == 1.0f - 0x1p-24f;
    const bool g5 = mantissa23_half_open(0xffffffffU) == 1.0f - 0x1p-23f;
    const bool g6 = top24_half_open(0U) == 0.0f && mantissa23_half_open(0U) == 0.0f;
    const bool g7 = std::bit_cast<U32>(static_cast<float>(0xffffffffU)) == 0x4f800000U;
    const bool g8 = std::bit_cast<U32>(static_cast<float>(0xffffffffU)) ==
                    std::bit_cast<U32>(static_cast<float>(0x100000000ULL));
    const int passed = int(g1)+int(g2)+int(g3)+int(g4)+int(g5)+int(g6)+int(g7)+int(g8);

    std::cout << "{\n"
              << "  \"schema\": \"kaopu-u32-float-mapping-n17-v1\",\n"
              << "  \"sourceAudit\": {\n"
              << "    \"houseCommit\": \"c6223d36ceeb827e3894fc181340c284b1cbfa73\",\n"
              << "    \"eventKernelBlob\": \"b28e0dafc37778d68e6649eb0c56c03cd704cf7e\",\n"
              << "    \"transferKernelBlob\": \"cb84cae8217299b6822f6a027c31ad1a41bdf183\",\n"
              << "    \"observedJavaScriptExpression\": \"uint32 / 0xffffffff\",\n"
              << "    \"observedContract\": \"closed [0,1] with exact upper endpoint\"\n"
              << "  },\n"
              << "  \"float32ClosedDivision\": {\n"
              << "    \"denominatorLiteralRoundsToBits\": \"0x4f800000\",\n"
              << "    \"denominatorValue\": 4294967296,\n"
              << "    \"firstHashMappingToOne\": \"0xffffff80\",\n"
              << "    \"hashesMappingToOne\": " << f32_endpoint_count << "\n"
              << "  },\n"
              << "  \"halfOpenCandidates\": {\n"
              << "    \"top24\": {\"formula\": \"float(h >> 8) * 2^-24\", \"distinctValues\": 16777216, \"discardedLowBits\": 8, \"maximum\": ";
    print_float(top24_half_open(0xffffffffU));
    std::cout << "},\n    \"mantissa23\": {\"formula\": \"bitcastFloat(0x3f800000 | (h >> 9)) - 1\", \"distinctValues\": 8388608, \"discardedLowBits\": 9, \"maximum\": ";
    print_float(mantissa23_half_open(0xffffffffU));
    std::cout << "}\n  },\n  \"vectors\": [\n";
    for (std::size_t i=0; i<std::size(vectors); ++i) {
        U32 h=vectors[i];
        std::cout << "    {\"hash\": \"0x" << std::hex << std::setw(8) << std::setfill('0') << h
                  << std::dec << std::setfill(' ') << "\", \"jsClosed\": " << std::setprecision(17) << js_closed(h)
                  << ", \"f32ClosedBits\": \"0x" << std::hex << std::setw(8) << std::setfill('0') << std::bit_cast<U32>(f32_closed(h))
                  << "\", \"top24Bits\": \"0x" << std::setw(8) << std::bit_cast<U32>(top24_half_open(h))
                  << "\", \"mantissa23Bits\": \"0x" << std::setw(8) << std::bit_cast<U32>(mantissa23_half_open(h))
                  << std::dec << std::setfill(' ') << "\"}" << (i+1<std::size(vectors)?",":"") << "\n";
    }
    std::cout << "  ],\n  \"gates\": {\"checks\": 8, \"passed\": " << passed
              << ", \"failed\": " << (8-passed) << ", \"status\": \"" << (passed==8?"pass":"fail") << "\"}\n}\n";
    return passed==8 ? 0 : 1;
}
