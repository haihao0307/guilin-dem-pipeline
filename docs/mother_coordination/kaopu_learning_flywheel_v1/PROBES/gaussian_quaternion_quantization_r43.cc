#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>

using Quat = std::array<float, 4>;  // xyzw, as in GaussianCloud rotations

constexpr float kSqrtHalf = 0.7071067811865475244f;

Quat normalize(Quat q) {
  float n = std::sqrt(q[0]*q[0] + q[1]*q[1] + q[2]*q[2] + q[3]*q[3]);
  for (float& v : q) v /= n;
  return q;
}

std::array<uint8_t, 4> packSmallestThree(Quat q) {
  q = normalize(q);
  unsigned largest = 0;
  for (unsigned i = 1; i < 4; ++i) if (std::abs(q[i]) > std::abs(q[largest])) largest = i;
  unsigned negate = q[largest] < 0;
  uint32_t comp = largest;
  for (unsigned i = 0; i < 4; ++i) if (i != largest) {
    uint32_t negbit = (q[i] < 0) ^ negate;
    uint32_t mag = static_cast<uint32_t>(float((1u << 9u) - 1u) *
                                         (std::fabs(q[i]) / kSqrtHalf) + 0.5f);
    comp = (comp << 10u) | (negbit << 9u) | mag;
  }
  return {uint8_t(comp), uint8_t(comp >> 8), uint8_t(comp >> 16), uint8_t(comp >> 24)};
}

Quat unpackSmallestThree(const std::array<uint8_t, 4>& r) {
  uint32_t comp = uint32_t(r[0]) | (uint32_t(r[1]) << 8) |
                  (uint32_t(r[2]) << 16) | (uint32_t(r[3]) << 24);
  constexpr uint32_t mask = (1u << 9u) - 1u;
  int largest = comp >> 30;
  Quat q{};
  float sum = 0;
  for (int i = 3; i >= 0; --i) if (i != largest) {
    uint32_t mag = comp & mask;
    uint32_t negbit = (comp >> 9u) & 1u;
    comp >>= 10u;
    q[i] = kSqrtHalf * static_cast<float>(mag) / static_cast<float>(mask);
    if (negbit) q[i] = -q[i];
    sum += q[i] * q[i];
  }
  q[largest] = std::sqrt(1.0f - sum);
  return q;
}

uint32_t rngState = 0x43c0ffeeu;
uint32_t nextU32() {
  rngState ^= rngState << 13; rngState ^= rngState >> 17; rngState ^= rngState << 5;
  return rngState;
}
double unit() { return (double(nextU32()) + 0.5) / 4294967296.0; }

Quat uniformQuat() {
  double u1 = unit(), u2 = unit(), u3 = unit();
  double a = std::sqrt(1.0 - u1), b = std::sqrt(u1);
  double t1 = 2.0 * M_PI * u2, t2 = 2.0 * M_PI * u3;
  return normalize({float(a * std::sin(t1)), float(a * std::cos(t1)),
                    float(b * std::sin(t2)), float(b * std::cos(t2))});
}

std::array<double, 9> rotationMatrix(const Quat& q) {
  double x=q[0], y=q[1], z=q[2], w=q[3];
  return {1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w),
          2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w),
          2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)};
}

std::array<double, 9> covariance(const Quat& q, const std::array<double, 3>& d) {
  const auto r = rotationMatrix(q);
  std::array<double, 9> c{};
  for (int i=0;i<3;++i) for(int j=0;j<3;++j)
    for(int k=0;k<3;++k) c[i*3+j] += r[i*3+k]*d[k]*r[j*3+k];
  return c;
}

double angularError(const Quat& a, const Quat& b) {
  double dot=0; for(int i=0;i<4;++i) dot += double(a[i])*b[i];
  return 2.0 * std::acos(std::clamp(std::abs(dot), 0.0, 1.0));
}

int main() {
  constexpr int n = 1000000;
  const std::array<std::array<double,3>,3> spectra{{{1,1,1},{1,0.25,0.0625},{1,0.01,0.0001}}};
  std::array<double,3> maxCovRelFrob{};
  double maxAngle=0, sumAngle2=0, maxAxisAngle=0, maxNormError=0;
  for(int s=0;s<n;++s) {
    Quat q=uniformQuat(), d=unpackSmallestThree(packSmallestThree(q));
    double angle=angularError(q,d); maxAngle=std::max(maxAngle,angle); sumAngle2 += angle*angle;
    double norm=std::sqrt(double(d[0])*d[0]+double(d[1])*d[1]+double(d[2])*d[2]+double(d[3])*d[3]);
    maxNormError=std::max(maxNormError,std::abs(norm-1.0));
    auto r0=rotationMatrix(q), r1=rotationMatrix(d);
    double axisDot=std::abs(r0[0]*r1[0]+r0[3]*r1[3]+r0[6]*r1[6]);
    maxAxisAngle=std::max(maxAxisAngle,std::acos(std::clamp(axisDot,0.0,1.0)));
    for (int si=0;si<3;++si) {
      auto c0=covariance(q,spectra[si]), c1=covariance(d,spectra[si]);
      double num=0,den=0; for(int i=0;i<9;++i){double e=c0[i]-c1[i];num+=e*e;den+=c0[i]*c0[i];}
      maxCovRelFrob[si]=std::max(maxCovRelFrob[si],std::sqrt(num/den));
    }
  }
  double componentHalfStep = double(kSqrtHalf) / (2.0 * 511.0);
  double storedError = std::sqrt(3.0) * componentHalfStep;
  double storedNormMax = std::sqrt(0.75) + storedError;
  double reconstructedMin = std::sqrt(1.0 - storedNormMax*storedNormMax);
  double largestError = (2.0*std::sqrt(0.75)*storedError + storedError*storedError) /
                        (0.5 + reconstructedMin);
  double quatChordBound = std::sqrt(storedError*storedError + largestError*largestError);
  double angleBound = 4.0 * std::asin(quatChordBound / 2.0);
  double relativeSpectralCovarianceBound = 4.0 * std::sin(angleBound / 2.0);
  bool pass = maxAngle <= angleBound && maxNormError < 2e-7;
  std::cout << std::setprecision(15)
    << "{\n  \"schema\": \"kaopu-gaussian-quaternion-quantization-probe/r43\",\n"
    << "  \"status\": \"" << (pass?"Candidate-pass":"Candidate-fail") << "\",\n"
    << "  \"sourceRevision\": \"affd0ecea7fbb4c265ee119475af7ee5b2997482\",\n"
    << "  \"samples\": " << n << ",\n"
    << "  \"fixtureCovarianceEigenvalueSpectra\": [[1,1,1],[1,0.25,0.0625],[1,0.01,0.0001]],\n"
    << "  \"componentHalfStep\": " << componentHalfStep << ",\n"
    << "  \"conservativeAngularBoundRadians\": " << angleBound << ",\n"
    << "  \"conservativeAngularBoundDegrees\": " << angleBound*180.0/M_PI << ",\n"
    << "  \"conservativeRelativeSpectralCovarianceBound\": " << relativeSpectralCovarianceBound << ",\n"
    << "  \"observedMaxAngularErrorRadians\": " << maxAngle << ",\n"
    << "  \"observedMaxAngularErrorDegrees\": " << maxAngle*180.0/M_PI << ",\n"
    << "  \"observedRmsAngularErrorDegrees\": " << std::sqrt(sumAngle2/n)*180.0/M_PI << ",\n"
    << "  \"observedMaxMajorAxisErrorDegrees\": " << maxAxisAngle*180.0/M_PI << ",\n"
    << "  \"observedMaxRelativeCovarianceFrobeniusErrorBySpectrum\": [" << maxCovRelFrob[0] << ", " << maxCovRelFrob[1] << ", " << maxCovRelFrob[2] << "],\n"
    << "  \"observedMaxDecodedNormError\": " << maxNormError << ",\n"
    << "  \"checks\": {\n"
    << "    \"observedAngleWithinDerivedBound\": " << (maxAngle<=angleBound?"true":"false") << ",\n"
    << "    \"decodedQuaternionUnitWithin2eMinus7\": " << (maxNormError<2e-7?"true":"false") << "\n  },\n"
    << "  \"limits\": {\n"
    << "    \"realAssetDistributionMeasured\": false,\n"
    << "    \"pixelErrorMeasured\": false,\n"
    << "    \"humanAcceptancePerformed\": false\n  }\n}\n";
  return pass ? 0 : 1;
}
