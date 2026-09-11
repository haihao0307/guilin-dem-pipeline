#include <cmath>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <string>
#include <vector>

#include "load-spz.h"

namespace {

void printArray(const std::vector<float>& values) {
  std::cout << "[";
  for (size_t i = 0; i < values.size(); ++i) {
    if (i) std::cout << ",";
    std::cout << std::setprecision(9) << values[i];
  }
  std::cout << "]";
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 3) {
    std::cerr << "usage: gaussian_spz_three_interop_r34 <output.spz> <negative.spz>\n";
    return 2;
  }

  spz::GaussianCloud cloud;
  cloud.numPoints = 2;
  cloud.shDegree = 3;
  cloud.antialiased = true;
  cloud.positions = {
      1.250113f, 2.500117f, 3.750121f,
      -0.125119f, 0.375123f, -1.500127f,
  };
  cloud.scales = {
      std::log(0.5f), std::log(1.25f), std::log(2.0f),
      std::log(0.2f), std::log(0.7f), std::log(1.7f),
  };
  const float half = 0.5f * 0.7853981633974483f;
  cloud.rotations = {
      0.0f, 0.0f, std::sin(half), std::cos(half),
      std::sin(half), 0.0f, 0.0f, std::cos(half),
  };
  cloud.alphas = {1.25f, -0.75f};
  cloud.colors = {0.2f, -0.1f, 0.5f, -0.25f, 0.35f, 0.05f};
  cloud.sh.resize(static_cast<size_t>(cloud.numPoints) * 15 * 3);
  for (size_t i = 0; i < cloud.sh.size(); ++i) {
    cloud.sh[i] = static_cast<float>((static_cast<int>(i % 17) - 8) * 0.03125);
  }

  spz::PackOptions pack;
  pack.version = 4;
  pack.from = spz::CoordinateSystem::RDF;
  pack.sh1Bits = 5;
  pack.shRestBits = 4;
  if (!spz::saveSpz(cloud, pack, std::string(argv[1]))) {
    std::cerr << "saveSpz failed\n";
    return 3;
  }

  spz::UnpackOptions unpack;
  unpack.to = spz::CoordinateSystem::RUB;
  const spz::GaussianCloud decoded = spz::loadSpz(std::string(argv[1]), unpack);
  if (decoded.numPoints != cloud.numPoints || decoded.shDegree != 3) {
    std::cerr << "round-trip metadata mismatch\n";
    return 4;
  }

  spz::GaussianCloud negative;
  negative.numPoints = 1;
  negative.shDegree = 0;
  negative.positions = {2048.0f, 0.0f, 0.0f};
  negative.scales = {-11.0f, 6.0f, 0.0f};
  negative.rotations = {0.0f, 0.0f, 0.0f, 1.0f};
  negative.alphas = {0.0f};
  negative.colors = {0.0f, 0.0f, 0.0f};
  if (!spz::saveSpz(negative, pack, std::string(argv[2]))) {
    std::cerr << "negative saveSpz failed\n";
    return 5;
  }
  const spz::GaussianCloud negativeDecoded = spz::loadSpz(std::string(argv[2]), unpack);
  std::cout << "{\"numPoints\":" << decoded.numPoints
            << ",\"shDegree\":" << decoded.shDegree
            << ",\"antialiased\":" << (decoded.antialiased ? "true" : "false")
            << ",\"positions\":";
  printArray(decoded.positions);
  std::cout << ",\"scales\":";
  printArray(decoded.scales);
  std::cout << ",\"rotations_xyzw\":";
  printArray(decoded.rotations);
  std::cout << ",\"alphas_logit\":";
  printArray(decoded.alphas);
  std::cout << ",\"colors_sh0\":";
  printArray(decoded.colors);
  std::cout << ",\"sh\":";
  printArray(decoded.sh);
  std::cout << ",\"negativeFixture\":{\"inputPositionRdf\":";
  printArray(negative.positions);
  std::cout << ",\"decodedPositionRub\":";
  printArray(negativeDecoded.positions);
  std::cout << ",\"inputLogScales\":";
  printArray(negative.scales);
  std::cout << ",\"decodedLogScales\":";
  printArray(negativeDecoded.scales);
  std::cout << "}}\n";
  return 0;
}
