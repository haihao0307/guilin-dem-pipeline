#include <cstdint>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include <zstd.h>

uint32_t nextRandom(uint32_t& state) {
  state ^= state << 13;
  state ^= state >> 17;
  state ^= state << 5;
  return state;
}

int main(int argc, char** argv) {
  if (argc != 4) {
    std::cerr << "usage: gaussian_zstd_stream_fixture_r42 <output.zst> <raw-bytes> <zero|varied>\n";
    return 2;
  }
  const std::string output = argv[1];
  const size_t rawSize = static_cast<size_t>(std::stoull(argv[2]));
  const bool varied = std::string(argv[3]) == "varied";
  std::vector<uint8_t> raw(rawSize, 0);
  if (varied) {
    uint32_t state = 0x42c0ffeeu;
    for (uint8_t& value : raw) value = static_cast<uint8_t>(nextRandom(state) & 0xffu);
  }
  std::vector<uint8_t> compressed(ZSTD_compressBound(raw.size()));
  ZSTD_CCtx* context = ZSTD_createCCtx();
  if (context == nullptr) return 3;
  if (ZSTD_isError(ZSTD_CCtx_setParameter(context, ZSTD_c_compressionLevel, 3))) return 3;
  const size_t compressedSize = ZSTD_compress2(context, compressed.data(), compressed.size(), raw.data(), raw.size());
  ZSTD_freeCCtx(context);
  if (ZSTD_isError(compressedSize)) {
    return 3;
  }
  std::ofstream stream(output, std::ios::binary);
  stream.write(reinterpret_cast<const char*>(compressed.data()), static_cast<std::streamsize>(compressedSize));
  if (!stream) return 4;
  std::cout << "{\"rawBytes\":" << rawSize << ",\"compressedBytes\":" << compressedSize
            << ",\"pattern\":\"" << (varied ? "varied" : "zero") << "\"}\n";
  return 0;
}
