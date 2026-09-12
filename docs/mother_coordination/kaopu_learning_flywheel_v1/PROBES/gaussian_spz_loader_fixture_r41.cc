#include <cmath>
#include <cstdint>
#include <iostream>
#include <string>

#include "load-spz.h"

namespace {

uint32_t nextRandom(uint32_t& state) {
  state ^= state << 13;
  state ^= state >> 17;
  state ^= state << 5;
  return state;
}

float signedUnit(uint32_t& state) {
  return static_cast<float>(nextRandom(state) & 0xffffu) / 32767.5f - 1.0f;
}

int shVectors(int degree) {
  static const int kVectors[] = {0, 3, 8, 15};
  return kVectors[degree];
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 5) {
    std::cerr << "usage: gaussian_spz_loader_fixture_r41 <output.spz> <count> <degree> <compressible|varied>\n";
    return 2;
  }
  const std::string output = argv[1];
  const int count = std::stoi(argv[2]);
  const int degree = std::stoi(argv[3]);
  const bool varied = std::string(argv[4]) == "varied";
  if (count <= 0 || degree < 0 || degree > 3) return 3;

  spz::GaussianCloud cloud;
  cloud.numPoints = count;
  cloud.shDegree = degree;
  cloud.antialiased = true;
  cloud.positions.resize(static_cast<size_t>(count) * 3);
  cloud.scales.resize(static_cast<size_t>(count) * 3);
  cloud.rotations.resize(static_cast<size_t>(count) * 4);
  cloud.alphas.resize(count);
  cloud.colors.resize(static_cast<size_t>(count) * 3);
  cloud.sh.resize(static_cast<size_t>(count) * shVectors(degree) * 3);

  uint32_t state = 0x41c0ffeeu;
  for (int i = 0; i < count; ++i) {
    const float a = varied ? signedUnit(state) : 0.0f;
    const float b = varied ? signedUnit(state) : 0.0f;
    const float c = varied ? signedUnit(state) : 0.0f;
    cloud.positions[i * 3] = a * 100.0f;
    cloud.positions[i * 3 + 1] = b * 100.0f;
    cloud.positions[i * 3 + 2] = c * 100.0f;
    cloud.scales[i * 3] = -2.0f + a * 0.5f;
    cloud.scales[i * 3 + 1] = -2.0f + b * 0.5f;
    cloud.scales[i * 3 + 2] = -2.0f + c * 0.5f;
    const float half = varied ? a * 0.5f : 0.0f;
    cloud.rotations[i * 4] = 0.0f;
    cloud.rotations[i * 4 + 1] = 0.0f;
    cloud.rotations[i * 4 + 2] = std::sin(half);
    cloud.rotations[i * 4 + 3] = std::cos(half);
    cloud.alphas[i] = varied ? b * 2.0f : 0.0f;
    cloud.colors[i * 3] = varied ? a * 0.4f : 0.0f;
    cloud.colors[i * 3 + 1] = varied ? b * 0.4f : 0.0f;
    cloud.colors[i * 3 + 2] = varied ? c * 0.4f : 0.0f;
  }
  for (float& value : cloud.sh) value = varied ? signedUnit(state) * 0.5f : 0.0f;

  spz::PackOptions pack;
  pack.version = 4;
  pack.from = spz::CoordinateSystem::RDF;
  pack.sh1Bits = 5;
  pack.shRestBits = 4;
  if (!spz::saveSpz(cloud, pack, output)) return 4;
  std::cout << "{\"count\":" << count << ",\"degree\":" << degree
            << ",\"pattern\":\"" << (varied ? "varied" : "compressible") << "\"}\n";
  return 0;
}
