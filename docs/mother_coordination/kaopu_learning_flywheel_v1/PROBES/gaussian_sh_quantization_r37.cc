#include "load-spz.h"

#include <cstdint>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

namespace {

spz::GaussianCloud makeCloud(int count) {
  spz::GaussianCloud cloud;
  cloud.numPoints = count;
  cloud.shDegree = 3;
  cloud.antialiased = false;
  cloud.positions.resize(static_cast<size_t>(count) * 3);
  cloud.scales.assign(static_cast<size_t>(count) * 3, 0.0f);
  cloud.rotations.resize(static_cast<size_t>(count) * 4);
  cloud.alphas.assign(count, 0.0f);
  cloud.colors.assign(static_cast<size_t>(count) * 3, 0.0f);
  cloud.sh.resize(static_cast<size_t>(count) * 45);
  for (int i = 0; i < count; ++i) {
    cloud.positions[static_cast<size_t>(i) * 3] = static_cast<float>(i) / 100.0f;
    cloud.rotations[static_cast<size_t>(i) * 4 + 3] = 1.0f;
  }
  return cloud;
}

uint32_t xorshift32(uint32_t& state) {
  state ^= state << 13;
  state ^= state >> 17;
  state ^= state << 5;
  return state;
}

void printArray(const std::vector<float>& values) {
  std::cout << '[';
  for (size_t i = 0; i < values.size(); ++i) {
    if (i) std::cout << ',';
    std::cout << std::setprecision(9) << values[i];
  }
  std::cout << ']';
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 3) {
    std::cerr << "usage: gaussian_sh_quantization_r37 in-range.spz out-of-range.spz\n";
    return 2;
  }

  spz::GaussianCloud positive = makeCloud(64);
  uint32_t state = 0x6d2b79f5u;
  for (float& value : positive.sh) {
    const uint32_t sample = xorshift32(state) % 1900001u;
    value = static_cast<float>(sample) / 1000000.0f - 0.95f;
  }
  spz::GaussianCloud converted = positive;
  converted.convertCoordinates(spz::CoordinateSystem::RDF, spz::CoordinateSystem::RUB);

  spz::GaussianCloud negative = makeCloud(1);
  negative.sh.assign(45, 0.0f);
  negative.sh[0] = -1.25f;
  negative.sh[1] = 1.25f;
  spz::GaussianCloud negativeConverted = negative;
  negativeConverted.convertCoordinates(spz::CoordinateSystem::RDF, spz::CoordinateSystem::RUB);

  spz::PackOptions options;
  options.version = 4;
  options.from = spz::CoordinateSystem::RDF;
  if (!spz::saveSpz(positive, options, std::string(argv[1])) ||
      !spz::saveSpz(negative, options, std::string(argv[2]))) {
    std::cerr << "saveSpz failed\n";
    return 1;
  }

  std::cout << "{\"numPoints\":64,\"shDegree\":3,\"sourceShRdf\":";
  printArray(positive.sh);
  std::cout << ",\"convertedShRub\":";
  printArray(converted.sh);
  std::cout << ",\"negativeConvertedShRub\":";
  printArray(negativeConverted.sh);
  std::cout << "}\n";
  return 0;
}
