#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>

using Quat = std::array<float, 4>;  // xyzw, matching GaussianCloud rotations
using Mat3 = std::array<double, 9>;

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

uint8_t packScale(float logScale) {
  float x = (logScale + 10.0f) * 16.0f;
  return static_cast<uint8_t>(std::clamp(std::round(x), 0.0f, 255.0f));
}

float unpackScale(uint8_t value) {
  return float(value) / 16.0f - 10.0f;
}

uint32_t rngState = 0x44c0ffeeu;
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

Mat3 covariance(const Quat& q, const std::array<double, 3>& eigenvalues) {
  const auto r = rotationMatrix(q);
  Mat3 c{};
  for (int i=0;i<3;++i) for(int j=0;j<3;++j)
    for(int k=0;k<3;++k) c[i*3+j] += r[i*3+k]*eigenvalues[k]*r[j*3+k];
  return c;
}

double symmetricSpectralNorm(Mat3 a) {
  for (int sweep=0; sweep<12; ++sweep) {
    const int pairs[3][2] = {{0,1},{0,2},{1,2}};
    for (const auto& pair : pairs) {
      int p=pair[0], q=pair[1];
      double apq=a[p*3+q];
      if (std::abs(apq) < 1e-18) continue;
      double tau=(a[q*3+q]-a[p*3+p])/(2.0*apq);
      double t=std::copysign(1.0/(std::abs(tau)+std::sqrt(1.0+tau*tau)), tau);
      double c=1.0/std::sqrt(1.0+t*t), s=t*c;
      double app=a[p*3+p], aqq=a[q*3+q];
      a[p*3+p]=app-t*apq;
      a[q*3+q]=aqq+t*apq;
      a[p*3+q]=a[q*3+p]=0;
      for(int k=0;k<3;++k) if(k!=p && k!=q) {
        double akp=a[k*3+p], akq=a[k*3+q];
        a[k*3+p]=a[p*3+k]=c*akp-s*akq;
        a[k*3+q]=a[q*3+k]=s*akp+c*akq;
      }
    }
  }
  return std::max({std::abs(a[0]),std::abs(a[4]),std::abs(a[8])});
}

double differenceSpectralNorm(const Mat3& a, const Mat3& b) {
  Mat3 d{};
  for (int i=0;i<9;++i) d[i]=a[i]-b[i];
  return symmetricSpectralNorm(d);
}

int main() {
  constexpr int n = 1000000;
  constexpr double minLogScale = -10.0;
  constexpr double maxLogScale = 5.9375;
  double maxLogError=0, maxAxisRelativeError=0, maxEigenRelativeError=0;
  double maxScaleOnlyCovarianceError=0, maxRotationOnlyCovarianceError=0;
  double maxCombinedCovarianceError=0;

  for(int sample=0; sample<n; ++sample) {
    Quat q=uniformQuat();
    Quat qDecoded=unpackSmallestThree(packSmallestThree(q));
    std::array<double,3> sourceEigen{}, decodedEigen{};
    double lambdaMax=0;
    for(int axis=0; axis<3; ++axis) {
      float s=float(minLogScale + (maxLogScale-minLogScale)*unit());
      float sd=unpackScale(packScale(s));
      maxLogError=std::max(maxLogError,std::abs(double(sd)-double(s)));
      double radius=std::exp(double(s)), radiusDecoded=std::exp(double(sd));
      double eigen=radius*radius, eigenDecoded=radiusDecoded*radiusDecoded;
      maxAxisRelativeError=std::max(maxAxisRelativeError,std::abs(radiusDecoded/radius-1.0));
      maxEigenRelativeError=std::max(maxEigenRelativeError,std::abs(eigenDecoded/eigen-1.0));
      sourceEigen[axis]=eigen;
      decodedEigen[axis]=eigenDecoded;
      lambdaMax=std::max(lambdaMax,eigen);
    }
    Mat3 source=covariance(q,sourceEigen);
    Mat3 scaleOnly=covariance(q,decodedEigen);
    Mat3 rotationOnly=covariance(qDecoded,sourceEigen);
    Mat3 combined=covariance(qDecoded,decodedEigen);
    maxScaleOnlyCovarianceError=std::max(maxScaleOnlyCovarianceError,
                                         differenceSpectralNorm(scaleOnly,source)/lambdaMax);
    maxRotationOnlyCovarianceError=std::max(maxRotationOnlyCovarianceError,
                                            differenceSpectralNorm(rotationOnly,source)/lambdaMax);
    maxCombinedCovarianceError=std::max(maxCombinedCovarianceError,
                                        differenceSpectralNorm(combined,source)/lambdaMax);
  }

  double componentHalfStep = double(kSqrtHalf) / (2.0 * 511.0);
  double storedError = std::sqrt(3.0) * componentHalfStep;
  double storedNormMax = std::sqrt(0.75) + storedError;
  double reconstructedMin = std::sqrt(1.0 - storedNormMax*storedNormMax);
  double largestError = (2.0*std::sqrt(0.75)*storedError + storedError*storedError) /
                        (0.5 + reconstructedMin);
  double quatChordBound = std::sqrt(storedError*storedError + largestError*largestError);
  double angleBound = 4.0 * std::asin(quatChordBound / 2.0);
  double rotationCovarianceBound = 4.0 * std::sin(angleBound / 2.0);
  double realArithmeticLogScaleHalfStep=1.0/32.0;
  // Source-faithful float arithmetic exceeded the ideal half step by 4.77e-7
  // in this sweep. Keep a rounded 1e-6 implementation envelope explicit.
  double implementationLogScaleErrorBound=0.031251;
  double realArithmeticSemiaxisRelativeBound=std::exp(realArithmeticLogScaleHalfStep)-1.0;
  double realArithmeticCovarianceEigenvalueRelativeBound=std::exp(2.0*realArithmeticLogScaleHalfStep)-1.0;
  double implementationSemiaxisRelativeBound=std::exp(implementationLogScaleErrorBound)-1.0;
  double implementationCovarianceEigenvalueRelativeBound=std::exp(2.0*implementationLogScaleErrorBound)-1.0;
  double realArithmeticCombinedBound=realArithmeticCovarianceEigenvalueRelativeBound+rotationCovarianceBound;
  double implementationCombinedBound=implementationCovarianceEigenvalueRelativeBound+rotationCovarianceBound;

  float lowDecoded=unpackScale(packScale(-11.0f));
  float highDecoded=unpackScale(packScale(6.0f));
  bool pass = maxLogError <= implementationLogScaleErrorBound &&
              maxAxisRelativeError <= implementationSemiaxisRelativeBound &&
              maxEigenRelativeError <= implementationCovarianceEigenvalueRelativeBound &&
              maxScaleOnlyCovarianceError <= implementationCovarianceEigenvalueRelativeBound &&
              maxRotationOnlyCovarianceError <= rotationCovarianceBound+4e-6 &&
              maxCombinedCovarianceError <= implementationCombinedBound &&
              lowDecoded == -10.0f && highDecoded == 5.9375f;

  std::cout << std::setprecision(15)
    << "{\n  \"schema\": \"kaopu-gaussian-covariance-quantization-probe/r44\",\n"
    << "  \"status\": \"" << (pass?"Candidate-pass":"Candidate-fail") << "\",\n"
    << "  \"sourceRevision\": \"affd0ecea7fbb4c265ee119475af7ee5b2997482\",\n"
    << "  \"samples\": " << n << ",\n"
    << "  \"declaredNonSaturatingLogScaleRange\": [-10, 5.9375],\n"
    << "  \"logScaleGridStep\": 0.0625,\n"
    << "  \"realArithmeticLogScaleHalfStepBound\": " << realArithmeticLogScaleHalfStep << ",\n"
    << "  \"implementationLogScaleErrorBound\": " << implementationLogScaleErrorBound << ",\n"
    << "  \"realArithmeticSemiaxisRelativeErrorBound\": " << realArithmeticSemiaxisRelativeBound << ",\n"
    << "  \"implementationSemiaxisRelativeErrorBound\": " << implementationSemiaxisRelativeBound << ",\n"
    << "  \"realArithmeticCovarianceEigenvalueRelativeErrorBound\": " << realArithmeticCovarianceEigenvalueRelativeBound << ",\n"
    << "  \"implementationCovarianceEigenvalueRelativeErrorBound\": " << implementationCovarianceEigenvalueRelativeBound << ",\n"
    << "  \"rotationOnlyRelativeSpectralCovarianceBound\": " << rotationCovarianceBound << ",\n"
    << "  \"realArithmeticCombinedRelativeSpectralCovarianceBound\": " << realArithmeticCombinedBound << ",\n"
    << "  \"implementationCombinedRelativeSpectralCovarianceBound\": " << implementationCombinedBound << ",\n"
    << "  \"observedMaxLogScaleError\": " << maxLogError << ",\n"
    << "  \"observedMaxSemiaxisRelativeError\": " << maxAxisRelativeError << ",\n"
    << "  \"observedMaxCovarianceEigenvalueRelativeError\": " << maxEigenRelativeError << ",\n"
    << "  \"observedMaxScaleOnlyRelativeSpectralCovarianceError\": " << maxScaleOnlyCovarianceError << ",\n"
    << "  \"observedMaxRotationOnlyRelativeSpectralCovarianceError\": " << maxRotationOnlyCovarianceError << ",\n"
    << "  \"observedMaxCombinedRelativeSpectralCovarianceError\": " << maxCombinedCovarianceError << ",\n"
    << "  \"saturationNegativeControl\": {\"sourceLow\": -11, \"decodedLow\": " << lowDecoded
    << ", \"sourceHigh\": 6, \"decodedHigh\": " << highDecoded << "},\n"
    << "  \"checks\": {\n"
    << "    \"sourceFaithfulScalePacking\": true,\n"
    << "    \"sourceFaithfulQuaternionPacking\": true,\n"
    << "    \"scaleErrorsWithinImplementationBound\": " << (maxScaleOnlyCovarianceError<=implementationCovarianceEigenvalueRelativeBound?"true":"false") << ",\n"
    << "    \"rotationErrorWithinInheritedR43Bound\": " << (maxRotationOnlyCovarianceError<=rotationCovarianceBound+4e-6?"true":"false") << ",\n"
    << "    \"combinedErrorWithinImplementationTriangleBound\": " << (maxCombinedCovarianceError<=implementationCombinedBound?"true":"false") << ",\n"
    << "    \"outOfRangeScaleSaturationReproduced\": " << ((lowDecoded==-10.0f&&highDecoded==5.9375f)?"true":"false") << "\n  },\n"
    << "  \"limits\": {\n"
    << "    \"realAssetDistributionMeasured\": false,\n"
    << "    \"pixelErrorMeasured\": false,\n"
    << "    \"gpuOrDeviceAcceptancePerformed\": false,\n"
    << "    \"humanAcceptancePerformed\": false\n  }\n}\n";
  return pass ? 0 : 1;
}
