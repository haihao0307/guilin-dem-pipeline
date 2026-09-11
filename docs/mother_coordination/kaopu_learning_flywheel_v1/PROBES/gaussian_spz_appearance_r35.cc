#include <cmath>
#include <cstdint>
#include <iostream>
#include <string>

#include "load-spz.h"

int main(int argc, char** argv) {
  if (argc != 2) {
    std::cerr << "usage: gaussian_spz_appearance_r35 <output.spz>\n";
    return 2;
  }

  constexpr int kCount = 256;
  spz::GaussianCloud cloud;
  cloud.numPoints = kCount;
  cloud.shDegree = 0;
  cloud.antialiased = false;
  cloud.positions.reserve(kCount * 3);
  cloud.scales.reserve(kCount * 3);
  cloud.rotations.reserve(kCount * 4);
  cloud.alphas.reserve(kCount);
  cloud.colors.reserve(kCount * 3);

  for (int i = 0; i < kCount; ++i) {
    cloud.positions.insert(cloud.positions.end(), {i / 16.0f, 0.0f, 0.0f});
    cloud.scales.insert(cloud.scales.end(), {0.0f, 0.0f, 0.0f});
    cloud.rotations.insert(cloud.rotations.end(), {0.0f, 0.0f, 0.0f, 1.0f});
    const float p = i / 255.0f;
    const float rawAlpha = i == 0 ? -100.0f : (i == 255 ? 100.0f : std::log(p / (1.0f - p)));
    cloud.alphas.push_back(rawAlpha);
    const float dc = (p - 0.5f) / 0.15f;
    cloud.colors.insert(cloud.colors.end(), {dc, dc, dc});
  }

  spz::PackOptions options;
  options.version = 4;
  options.from = spz::CoordinateSystem::RUB;
  if (!spz::saveSpz(cloud, options, std::string(argv[1]))) {
    std::cerr << "saveSpz failed\n";
    return 3;
  }

  const spz::PackedGaussians packed = spz::loadSpzPacked(std::string(argv[1]));
  int colorByteMismatches = 0;
  int alphaByteMismatches = 0;
  for (int i = 0; i < kCount; ++i) {
    if (packed.alphas[i] != static_cast<uint8_t>(i)) alphaByteMismatches++;
    for (int channel = 0; channel < 3; ++channel) {
      if (packed.colors[i * 3 + channel] != static_cast<uint8_t>(i)) colorByteMismatches++;
    }
  }

  std::cout << "{\"numPoints\":" << packed.numPoints
            << ",\"version\":" << packed.version
            << ",\"shDegree\":" << packed.shDegree
            << ",\"colorByteMismatches\":" << colorByteMismatches
            << ",\"alphaByteMismatches\":" << alphaByteMismatches
            << "}\n";
  return colorByteMismatches == 0 && alphaByteMismatches == 0 ? 0 : 4;
}
