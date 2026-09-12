#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>

using Quat=std::array<float,4>;
using Mat3=std::array<double,9>;
struct Ellipse { double a,b,c,lambda1,lambda2,scale1,scale2,angle; bool capped; };

constexpr float kSqrtHalf=0.7071067811865475244f;
constexpr double kKernel2D=0.3;
constexpr double kEigenRadiusFloor=1e-7;
constexpr double kMaxScreenScale=1024.0;

Quat normalize(Quat q){float n=std::hypot(std::hypot(q[0],q[1]),std::hypot(q[2],q[3]));for(float&v:q)v/=n;return q;}
std::array<uint8_t,4> packQuat(Quat q){
 q=normalize(q);unsigned largest=0;for(unsigned i=1;i<4;++i)if(std::abs(q[i])>std::abs(q[largest]))largest=i;
 unsigned negate=q[largest]<0;uint32_t comp=largest;
 for(unsigned i=0;i<4;++i)if(i!=largest){uint32_t negbit=(q[i]<0)^negate;uint32_t mag=uint32_t(float(511)*(std::fabs(q[i])/kSqrtHalf)+0.5f);comp=(comp<<10)|(negbit<<9)|mag;}
 return {uint8_t(comp),uint8_t(comp>>8),uint8_t(comp>>16),uint8_t(comp>>24)};
}
Quat unpackQuat(const std::array<uint8_t,4>& r){
 uint32_t comp=uint32_t(r[0])|(uint32_t(r[1])<<8)|(uint32_t(r[2])<<16)|(uint32_t(r[3])<<24);int largest=comp>>30;Quat q{};float sum=0;
 for(int i=3;i>=0;--i)if(i!=largest){uint32_t mag=comp&511,neg=(comp>>9)&1;comp>>=10;q[i]=kSqrtHalf*float(mag)/511.0f;if(neg)q[i]=-q[i];sum+=q[i]*q[i];}
 q[largest]=std::sqrt(1.0f-sum);return q;
}
uint8_t packScale(float s){return uint8_t(std::clamp(std::round((s+10.0f)*16.0f),0.0f,255.0f));}
float unpackScale(uint8_t v){return float(v)/16.0f-10.0f;}

uint32_t rngState=0x46c0ffeeu;
uint32_t nextU32(){rngState^=rngState<<13;rngState^=rngState>>17;rngState^=rngState<<5;return rngState;}
double unit(){return(double(nextU32())+0.5)/4294967296.0;}
Quat uniformQuat(){double u1=unit(),u2=unit(),u3=unit(),a=std::sqrt(1-u1),b=std::sqrt(u1);double t1=2*M_PI*u2,t2=2*M_PI*u3;return normalize({float(a*std::sin(t1)),float(a*std::cos(t1)),float(b*std::sin(t2)),float(b*std::cos(t2))});}

Mat3 rotation(const Quat&q){double x=q[0],y=q[1],z=q[2],w=q[3];return{1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)};}
Mat3 covariance(const Quat&q,const std::array<float,3>&s){auto r=rotation(q);std::array<double,3>d{};for(int i=0;i<3;++i)d[i]=std::exp(2.0*double(s[i]));Mat3 c{};for(int i=0;i<3;++i)for(int j=0;j<3;++j)for(int k=0;k<3;++k)c[i*3+j]+=r[i*3+k]*d[k]*r[j*3+k];return c;}

Ellipse project(const Mat3&v,const std::array<double,3>&p,double focal){
 double z=std::min(p[2],-0.01),iz=1/z,iz2=iz*iz;
 double j00=-focal*iz,j11=-focal*iz,j02=focal*p[0]*iz2,j12=focal*p[1]*iz2;
 double ab=j00*j00*v[0]+2*j00*j02*v[2]+j02*j02*v[8];
 double b=j00*j11*v[1]+j00*j12*v[2]+j02*j11*v[5]+j02*j12*v[8];
 double cb=j11*j11*v[4]+2*j11*j12*v[5]+j12*j12*v[8];
 double a=ab+kKernel2D,c=cb+kKernel2D,half=(a+c)*0.5;
 double radius=std::sqrt(std::max(((a-c)*0.5)*((a-c)*0.5)+b*b,kEigenRadiusFloor));
 double l1=std::max(half+radius,1e-7),l2=std::max(half-radius,1e-7);
 double raw1=std::sqrt(l1),raw2=std::sqrt(l2);
 return{a,b,c,l1,l2,std::min(raw1,kMaxScreenScale),std::min(raw2,kMaxScreenScale),0.5*std::atan2(2*b,a-c),raw1>kMaxScreenScale||raw2>kMaxScreenScale};
}
double axisAngleDelta(double a,double b){double d=std::fmod(std::abs(a-b),M_PI);return std::min(d,M_PI-d);}

int main(){
 constexpr int samples=1000000;constexpr double h=844.0;const double focal=h/(2*std::tan(M_PI/6));
 double maxRawMajorRel=0,maxRawMinorRel=0,maxShownMajorRel=0,maxShownMinorRel=0,maxAngle=0,maxCov2dRel=0;int capped=0,kernelDominated=0,angleCompared=0;
 for(int n=0;n<samples;++n){
  int depthCode=410+int(nextU32()%40551);double depth=double(depthCode)/4096.0;
  int xCode=int((unit()*0.4-0.2)*depthCode),yCode=int((unit()*0.8-0.4)*depthCode);
  std::array<double,3>p={double(xCode)/4096.0,double(yCode)/4096.0,-depth};
  Quat q=uniformQuat(),qd=unpackQuat(packQuat(q));std::array<float,3>s{},sd{};
  for(int i=0;i<3;++i){s[i]=float(-5.0+6.0*unit());sd[i]=unpackScale(packScale(s[i]));}
  Ellipse a=project(covariance(q,s),p,focal),b=project(covariance(qd,sd),p,focal);
  double rawA1=std::sqrt(a.lambda1),rawA2=std::sqrt(a.lambda2),rawB1=std::sqrt(b.lambda1),rawB2=std::sqrt(b.lambda2);
  maxRawMajorRel=std::max(maxRawMajorRel,std::abs(rawB1/rawA1-1));maxRawMinorRel=std::max(maxRawMinorRel,std::abs(rawB2/rawA2-1));
  maxShownMajorRel=std::max(maxShownMajorRel,std::abs(b.scale1/a.scale1-1));maxShownMinorRel=std::max(maxShownMinorRel,std::abs(b.scale2/a.scale2-1));
  double da=a.a-b.a,db=a.b-b.b,dc=a.c-b.c;double norm=std::max(std::abs((da+dc)*0.5)+std::sqrt(((da-dc)*0.5)*((da-dc)*0.5)+db*db),0.0);
  maxCov2dRel=std::max(maxCov2dRel,norm/a.lambda1);
  if(a.capped||b.capped)++capped;if((a.lambda1-kKernel2D)<kKernel2D)++kernelDominated;
  if(a.lambda1/a.lambda2>=1.1&&b.lambda1/b.lambda2>=1.1&&!a.capped&&!b.capped){maxAngle=std::max(maxAngle,axisAngleDelta(a.angle,b.angle));++angleCompared;}
 }
 std::array<double,3>center={0,0,-1};Quat identity={0,0,0,1};
 std::array<float,3>capS={0.7187f,0.6887f,-5.0f},capD{};for(int i=0;i<3;++i)capD[i]=unpackScale(packScale(capS[i]));
 Ellipse capA=project(covariance(identity,capS),center,focal),capB=project(covariance(identity,capD),center,focal);
 double capRawDifference=std::abs(std::sqrt(capA.lambda1)-std::sqrt(capB.lambda1));double capShownDifference=std::abs(capA.scale1-capB.scale1);
 std::array<float,3>tinyS={-9.97f,-9.97f,-9.97f},tinyD{};for(int i=0;i<3;++i)tinyD[i]=unpackScale(packScale(tinyS[i]));
 std::array<double,3>farCenter={0,0,-10};Ellipse tinyA=project(covariance(identity,tinyS),farCenter,focal),tinyB=project(covariance(identity,tinyD),farCenter,focal);
 double tinyBaseScale=focal*std::exp(double(tinyS[0]))/10.0;
 double isotropicMinRadius=std::sqrt(kEigenRadiusFloor),isotropicScale1=std::sqrt(kKernel2D+isotropicMinRadius),isotropicScale2=std::sqrt(kKernel2D-isotropicMinRadius);
 bool fallbackReachable=isotropicMinRadius<=0.00001;
 bool pass=capRawDifference>10&&capShownDifference==0&&tinyBaseScale<0.01&&!fallbackReachable&&angleCompared>100000;
 std::cout<<std::setprecision(15)
  <<"{\n  \"schema\": \"kaopu-gaussian-ellipse-projection-probe/r46\",\n  \"status\": \""<<(pass?"Candidate-pass":"Candidate-fail")<<"\",\n"
  <<"  \"sources\": {\"spzRevision\": \"affd0ecea7fbb4c265ee119475af7ee5b2997482\", \"threeRevision\": \"148ef33ecb6d2502ff796d4554abd1549c95d519\"},\n"
  <<"  \"samples\": "<<samples<<",\n  \"cameraFixture\": {\"viewport\": [390,844], \"verticalFovDegrees\": 60, \"focalPixels\": "<<focal<<", \"identityModelView\": true},\n"
  <<"  \"r186Constants\": {\"kernel2D\": "<<kKernel2D<<", \"eigenRadiusFloor\": "<<kEigenRadiusFloor<<", \"maxScreenScalePixels\": "<<kMaxScreenScale<<", \"quadCutoffMultiplier\": 2},\n"
  <<"  \"observed\": {\n    \"maxProjectedCovarianceRelativeSpectralError\": "<<maxCov2dRel<<",\n    \"maxRawMajorScaleRelativeError\": "<<maxRawMajorRel<<",\n    \"maxRawMinorScaleRelativeError\": "<<maxRawMinorRel<<",\n    \"maxDisplayedMajorScaleRelativeError\": "<<maxShownMajorRel<<",\n    \"maxDisplayedMinorScaleRelativeError\": "<<maxShownMinorRel<<",\n    \"maxPrincipalAxisErrorDegreesWhenBothAnisotropyAtLeast1Point1AndUncapped\": "<<maxAngle*180/M_PI<<",\n    \"angleComparedSamples\": "<<angleCompared<<",\n    \"cappedSamples\": "<<capped<<",\n    \"kernelDominatedSamples\": "<<kernelDominated<<"\n  },\n"
  <<"  \"capCounterexample\": {\n    \"sourceRawMajorScalePixels\": "<<std::sqrt(capA.lambda1)<<",\n    \"decodedRawMajorScalePixels\": "<<std::sqrt(capB.lambda1)<<",\n    \"rawDifferencePixels\": "<<capRawDifference<<",\n    \"sourceDisplayedScalePixels\": "<<capA.scale1<<",\n    \"decodedDisplayedScalePixels\": "<<capB.scale1<<",\n    \"displayedDifferencePixels\": "<<capShownDifference<<"\n  },\n"
  <<"  \"kernelCounterexample\": {\n    \"sourceBaseScalePixelsBeforeKernel\": "<<tinyBaseScale<<",\n    \"sourceScaleAfterKernelPixels\": "<<tinyA.scale1<<",\n    \"decodedScaleAfterKernelPixels\": "<<tinyB.scale1<<"\n  },\n"
  <<"  \"isotropicRadiusFloor\": {\n    \"minimumRadius\": "<<isotropicMinRadius<<",\n    \"angleFallbackThreshold\": 0.00001,\n    \"angleFallbackReachable\": "<<(fallbackReachable?"true":"false")<<",\n    \"forcedScale1PixelsAtKernelOnly\": "<<isotropicScale1<<",\n    \"forcedScale2PixelsAtKernelOnly\": "<<isotropicScale2<<"\n  },\n"
  <<"  \"checks\": {\n    \"capCanMaskRawDifference\": "<<((capRawDifference>10&&capShownDifference==0)?"true":"false")<<",\n    \"kernelCanDominateTinyFootprint\": "<<(tinyBaseScale<0.01?"true":"false")<<",\n    \"declaredAngleFallbackUnreachableFromRadiusFloor\": "<<(!fallbackReachable?"true":"false")<<"\n  },\n"
  <<"  \"limits\": {\"realAssetMeasured\": false, \"gpuRasterizationMeasured\": false, \"compositedPixelErrorMeasured\": false, \"deviceOrHumanAcceptancePerformed\": false}\n}\n";
 return pass?0:1;
}
