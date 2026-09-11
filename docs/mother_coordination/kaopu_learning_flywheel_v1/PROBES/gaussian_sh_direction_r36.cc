#include "load-spz.h"

#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

namespace {

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
  if (argc != 2) {
    std::cerr << "usage: gaussian_sh_direction_r36 output.spz\n";
    return 2;
  }

  spz::GaussianCloud source;
  source.numPoints = 1;
  source.shDegree = 3;
  source.antialiased = false;
  source.positions = {0.0f, 0.0f, 0.0f};
  source.scales = {0.0f, 0.0f, 0.0f};
  source.rotations = {0.0f, 0.0f, 0.0f, 1.0f};
  source.alphas = {0.0f};
  source.colors = {0.0f, 0.0f, 0.0f};

  // Coefficient-major, RGB-channel-minor. Multiples of 1/8 are exact under
  // the default SPZ 5-bit SH1 and 4-bit SH2+ quantizers.
  source.sh.resize(45);
  for (size_t i = 0; i < source.sh.size(); ++i) {
    source.sh[i] = static_cast<float>((static_cast<int>(i * 5) % 13) - 6) / 8.0f;
  }

  spz::GaussianCloud converted = source;
  converted.convertCoordinates(spz::CoordinateSystem::RDF, spz::CoordinateSystem::RUB);

  spz::PackOptions options;
  options.version = 4;
  options.from = spz::CoordinateSystem::RDF;
  if (!spz::saveSpz(source, options, std::string(argv[1]))) {
    std::cerr << "saveSpz failed\n";
    return 1;
  }

  std::cout << "{\"numPoints\":1,\"shDegree\":3,\"from\":\"RDF\",\"to\":\"RUB\",\"sourceSh\":";
  printArray(source.sh);
  std::cout << ",\"directConvertedSh\":";
  printArray(converted.sh);
  std::cout << "}\n";
  return 0;
}
