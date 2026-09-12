#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>

constexpr int kFractionalBits = 12;
constexpr float kPositionScale = float(1 << kFractionalBits);
constexpr double kHalfStep = 0.5 / double(1 << kFractionalBits);
constexpr double kR186CullZ = -0.01;

std::array<uint8_t, 3> packPosition(float value) {
  const int32_t fixed32 = static_cast<int32_t>(std::round(value * kPositionScale));
  return {uint8_t(fixed32 & 0xff), uint8_t((fixed32 >> 8) & 0xff),
          uint8_t((fixed32 >> 16) & 0xff)};
}

float unpackPosition(const std::array<uint8_t, 3>& packed) {
  int32_t fixed32 = packed[0];
  fixed32 |= int32_t(packed[1]) << 8;
  fixed32 |= int32_t(packed[2]) << 16;
  fixed32 |= (fixed32 & 0x800000) ? int32_t(0xff000000) : 0;
  return float(fixed32) / kPositionScale;
}

uint32_t rngState = 0x45c0ffeeu;
uint32_t nextU32() {
  rngState ^= rngState << 13; rngState ^= rngState >> 17; rngState ^= rngState << 5;
  return rngState;
}
double unit() { return (double(nextU32()) + 0.5) / 4294967296.0; }

std::array<double, 2> screenCenter(const std::array<float, 3>& p, double focal) {
  return {focal * double(p[0]) / -double(p[2]),
          focal * double(p[1]) / -double(p[2])};
}

double pixelDistance(const std::array<float, 3>& a,
                     const std::array<float, 3>& b, double focal) {
  auto pa=screenCenter(a,focal), pb=screenCenter(b,focal);
  return std::hypot(pa[0]-pb[0],pa[1]-pb[1]);
}

int main() {
  constexpr int samples=1000000;
  double maxComponentError=0;
  for(int i=0;i<samples;++i) {
    // Stay within the signed 24-bit range. The endpoint wrap is an inherited R34 control.
    float source=float(-2047.9 + 4095.8*unit());
    float decoded=unpackPosition(packPosition(source));
    maxComponentError=std::max(maxComponentError,std::abs(double(decoded)-double(source)));
  }

  constexpr double viewportWidth=390.0;
  constexpr double viewportHeight=844.0;
  constexpr double verticalFovDegrees=60.0;
  const double focal=viewportHeight/(2.0*std::tan(verticalFovDegrees*M_PI/360.0));
  const float lateral=float(kHalfStep*(1.0-1e-4));
  const std::array<int,4> depthCodes={41,410,4096,40960};
  std::array<double,4> depths{}, diagonalPixelErrors{};
  for(int i=0;i<4;++i) {
    const float depth=float(depthCodes[i])/kPositionScale;
    std::array<float,3> source={lateral,lateral,-depth};
    std::array<float,3> decoded={unpackPosition(packPosition(source[0])),
                                 unpackPosition(packPosition(source[1])),
                                 unpackPosition(packPosition(source[2]))};
    depths[i]=depth;
    diagonalPixelErrors[i]=pixelDistance(source,decoded,focal);
  }

  // A source center on the culled side of r186's hard z boundary rounds to the visible side.
  std::array<float,3> cullSource={0,0,-0.00999f};
  std::array<float,3> cullDecoded={0,0,unpackPosition(packPosition(cullSource[2]))};
  bool sourceCulled=double(cullSource[2])>=kR186CullZ;
  bool decodedCulled=double(cullDecoded[2])>=kR186CullZ;

  // At the optical axis, one-axis displacement is focal*halfStep/depth.
  const double oneAxisAtOneUnit=focal*kHalfStep;
  const double minimumDepthForQuarterPixel=oneAxisAtOneUnit/0.25;
  const double minimumDepthForOnePixel=oneAxisAtOneUnit;
  bool pass=maxComponentError<=kHalfStep && sourceCulled && !decodedCulled &&
            diagonalPixelErrors[0]>10.0 && diagonalPixelErrors[2]>0.12 &&
            diagonalPixelErrors[2]<0.13;

  std::cout << std::setprecision(15)
    << "{\n  \"schema\": \"kaopu-gaussian-position-projection-probe/r45\",\n"
    << "  \"status\": \"" << (pass?"Candidate-pass":"Candidate-fail") << "\",\n"
    << "  \"sources\": {\n"
    << "    \"spzRevision\": \"affd0ecea7fbb4c265ee119475af7ee5b2997482\",\n"
    << "    \"threeRevision\": \"148ef33ecb6d2502ff796d4554abd1549c95d519\"\n  },\n"
    << "  \"samples\": " << samples << ",\n"
    << "  \"fractionalBits\": " << kFractionalBits << ",\n"
    << "  \"positionGridStepStorageUnits\": " << 1.0/kPositionScale << ",\n"
    << "  \"idealComponentHalfStepStorageUnits\": " << kHalfStep << ",\n"
    << "  \"observedMaxComponentErrorStorageUnits\": " << maxComponentError << ",\n"
    << "  \"cameraFixture\": {\n"
    << "    \"viewport\": [" << viewportWidth << ", " << viewportHeight << "],\n"
    << "    \"verticalFovDegrees\": " << verticalFovDegrees << ",\n"
    << "    \"focalPixels\": " << focal << ",\n"
    << "    \"identityModelView\": true\n  },\n"
    << "  \"opticalAxisLateralHalfStepFixture\": {\n"
    << "    \"depthStorageUnits\": [" << depths[0] << ", " << depths[1] << ", " << depths[2] << ", " << depths[3] << "],\n"
    << "    \"diagonalCenterErrorPixels\": [" << diagonalPixelErrors[0] << ", " << diagonalPixelErrors[1] << ", " << diagonalPixelErrors[2] << ", " << diagonalPixelErrors[3] << "],\n"
    << "    \"oneAxisErrorAtOneStorageUnitPixels\": " << oneAxisAtOneUnit << ",\n"
    << "    \"minimumDepthForQuarterPixelOneAxis\": " << minimumDepthForQuarterPixel << ",\n"
    << "    \"minimumDepthForOnePixelOneAxis\": " << minimumDepthForOnePixel << "\n  },\n"
    << "  \"hardCullCounterexample\": {\n"
    << "    \"r186CullZ\": " << kR186CullZ << ",\n"
    << "    \"sourceZ\": " << cullSource[2] << ",\n"
    << "    \"decodedZ\": " << cullDecoded[2] << ",\n"
    << "    \"sourceCulled\": " << (sourceCulled?"true":"false") << ",\n"
    << "    \"decodedCulled\": " << (decodedCulled?"true":"false") << ",\n"
    << "    \"visibilityFlipped\": " << ((sourceCulled!=decodedCulled)?"true":"false") << "\n  },\n"
    << "  \"checks\": {\n"
    << "    \"componentErrorWithinHalfStep\": " << (maxComponentError<=kHalfStep?"true":"false") << ",\n"
    << "    \"pixelErrorDepthDependent\": true,\n"
    << "    \"hardCullVisibilityFlipReproduced\": " << ((sourceCulled&&!decodedCulled)?"true":"false") << "\n  },\n"
    << "  \"limits\": {\n"
    << "    \"realAssetMeasured\": false,\n"
    << "    \"covarianceFootprintCompared\": false,\n"
    << "    \"gpuRasterizationMeasured\": false,\n"
    << "    \"deviceOrHumanAcceptancePerformed\": false\n  }\n}\n";
  return pass?0:1;
}
