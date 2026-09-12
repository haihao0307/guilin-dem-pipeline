#include <fstream>
#include <iostream>
#include <string>
#include <vector>

#include "load-spz.h"

namespace {

bool writeBrushLikePly(const std::string& path, const std::string& mode) {
  std::ofstream out(path, std::ios::binary);
  if (!out.good()) return false;
  out << "ply\n"
      << "format binary_little_endian 1.0\n"
      << "comment Exported from Brush\n"
      << "comment SplatRenderMode: " << mode << "\n"
      << "element vertex 1\n"
      << "property float x\nproperty float y\nproperty float z\n"
      << "property float scale_0\nproperty float scale_1\nproperty float scale_2\n"
      << "property float rot_0\nproperty float rot_1\nproperty float rot_2\nproperty float rot_3\n"
      << "property float opacity\n"
      << "property float f_dc_0\nproperty float f_dc_1\nproperty float f_dc_2\n"
      << "end_header\n";
  const std::vector<float> values = {
      0.25f, -0.5f, 1.0f,
      -0.2f, 0.1f, 0.4f,
      1.0f, 0.0f, 0.0f, 0.0f,
      0.25f,
      0.1f, -0.2f, 0.3f,
  };
  out.write(reinterpret_cast<const char*>(values.data()), values.size() * sizeof(float));
  return out.good();
}

int headerFlag(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  char header[32] = {};
  in.read(header, sizeof(header));
  return in.gcount() == sizeof(header) ? static_cast<unsigned char>(header[14]) : -1;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 4) {
    std::cerr << "usage: gaussian_antialias_handoff_r38 <mip.ply> <cli-path.spz> <explicit-mip.spz>\n";
    return 2;
  }
  if (!writeBrushLikePly(argv[1], "mip")) return 3;

  spz::UnpackOptions unpack;
  unpack.to = spz::CoordinateSystem::RUB;
  spz::GaussianCloud fromPly = spz::loadSplatFromPly(argv[1], unpack);
  if (fromPly.numPoints != 1) return 4;

  spz::PackOptions pack;
  pack.version = 4;
  pack.from = spz::CoordinateSystem::RUB;
  if (!spz::saveSpz(fromPly, pack, std::string(argv[2]))) return 5;

  spz::GaussianCloud explicitMip = fromPly;
  explicitMip.antialiased = true;
  if (!spz::saveSpz(explicitMip, pack, std::string(argv[3]))) return 6;

  const spz::GaussianCloud cliDecoded = spz::loadSpz(std::string(argv[2]), unpack);
  const spz::GaussianCloud mipDecoded = spz::loadSpz(std::string(argv[3]), unpack);
  std::cout << "{\"plyLoaderAntialiased\":" << (fromPly.antialiased ? "true" : "false")
            << ",\"cliPathHeaderFlags\":" << headerFlag(argv[2])
            << ",\"explicitMipHeaderFlags\":" << headerFlag(argv[3])
            << ",\"cliPathDecodedAntialiased\":" << (cliDecoded.antialiased ? "true" : "false")
            << ",\"explicitMipDecodedAntialiased\":" << (mipDecoded.antialiased ? "true" : "false")
            << "}\n";
  return 0;
}

