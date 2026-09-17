#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <random>
#include <string>
#include <vector>

namespace {

constexpr double kPi = 3.141592653589793238462643383279502884;

struct V2 { double x, y; };
struct Sample { double value; V2 gradient; };
struct ErrorStats { double valueRmse = 0, valueMax = 0, gradientRmse = 0, gradientMax = 0; };
struct Check { std::string name; bool pass; };

double glslMod(double x, double y) { return x - y * std::floor(x / y); }
double fract(double x) { return x - std::floor(x); }

Sample psrdnoise(V2 x, V2 period, double alpha) {
    const V2 uv{x.x + x.y * 0.5, x.y};
    const V2 i0{std::floor(uv.x), std::floor(uv.y)};
    const V2 f0{fract(uv.x), fract(uv.y)};
    const double cmp = f0.x >= f0.y ? 1.0 : 0.0;
    const V2 o1{cmp, 1.0 - cmp};
    const V2 i1{i0.x + o1.x, i0.y + o1.y};
    const V2 i2{i0.x + 1.0, i0.y + 1.0};

    const V2 v0{i0.x - i0.y * 0.5, i0.y};
    const V2 v1{v0.x + o1.x - o1.y * 0.5, v0.y + o1.y};
    const V2 v2{v0.x + 0.5, v0.y + 1.0};
    const std::array<V2, 3> d{{{x.x-v0.x, x.y-v0.y}, {x.x-v1.x, x.y-v1.y}, {x.x-v2.x, x.y-v2.y}}};

    std::array<double, 3> iu{{i0.x, i1.x, i2.x}};
    std::array<double, 3> iv{{i0.y, i1.y, i2.y}};
    if (period.x > 0.0 || period.y > 0.0) {
        const std::array<V2, 3> v{{v0, v1, v2}};
        for (int k = 0; k < 3; ++k) {
            double xw = period.x > 0.0 ? glslMod(v[k].x, period.x) : v[k].x;
            double yw = period.y > 0.0 ? glslMod(v[k].y, period.y) : v[k].y;
            iu[k] = std::floor(xw + 0.5*yw + 0.5);
            iv[k] = std::floor(yw + 0.5);
        }
    }

    std::array<V2, 3> g;
    std::array<double, 3> w, gdot;
    for (int k = 0; k < 3; ++k) {
        double hash = glslMod(iu[k], 289.0);
        hash = glslMod((hash*51.0 + 2.0)*hash + iv[k], 289.0);
        hash = glslMod((hash*34.0 + 10.0)*hash, 289.0);
        const double psi = hash * 0.07482 + alpha;
        g[k] = {std::cos(psi), std::sin(psi)};
        w[k] = std::max(0.8 - (d[k].x*d[k].x + d[k].y*d[k].y), 0.0);
        gdot[k] = g[k].x*d[k].x + g[k].y*d[k].y;
    }

    double n = 0.0, gx = 0.0, gy = 0.0;
    for (int k = 0; k < 3; ++k) {
        const double w2 = w[k]*w[k];
        const double w3 = w2*w[k];
        const double w4 = w2*w2;
        n += w4*gdot[k];
        const double dw = -8.0*w3*gdot[k];
        gx += w4*g[k].x + dw*d[k].x;
        gy += w4*g[k].y + dw*d[k].y;
    }
    return {10.9*n, {10.9*gx, 10.9*gy}};
}

ErrorStats compareShift(const std::vector<V2>& points, V2 period, double alpha, V2 shift) {
    ErrorStats out;
    double sv = 0.0, sg = 0.0;
    for (const auto& p : points) {
        const Sample a = psrdnoise(p, period, alpha);
        const Sample b = psrdnoise({p.x+shift.x, p.y+shift.y}, period, alpha);
        const double dv = b.value-a.value;
        const double dx = b.gradient.x-a.gradient.x;
        const double dy = b.gradient.y-a.gradient.y;
        const double gm = std::sqrt(dx*dx+dy*dy);
        sv += dv*dv; sg += dx*dx+dy*dy;
        out.valueMax = std::max(out.valueMax, std::abs(dv));
        out.gradientMax = std::max(out.gradientMax, gm);
    }
    out.valueRmse = std::sqrt(sv/points.size());
    out.gradientRmse = std::sqrt(sg/points.size());
    return out;
}

ErrorStats compareAlpha(const std::vector<V2>& points, V2 period, double a0, double a1) {
    ErrorStats out;
    double sv=0.0, sg=0.0;
    for (const auto& p:points) {
        const Sample a=psrdnoise(p,period,a0), b=psrdnoise(p,period,a1);
        const double dv=b.value-a.value, dx=b.gradient.x-a.gradient.x, dy=b.gradient.y-a.gradient.y;
        const double gm=std::sqrt(dx*dx+dy*dy);
        sv+=dv*dv; sg+=dx*dx+dy*dy;
        out.valueMax=std::max(out.valueMax,std::abs(dv));
        out.gradientMax=std::max(out.gradientMax,gm);
    }
    out.valueRmse=std::sqrt(sv/points.size());
    out.gradientRmse=std::sqrt(sg/points.size());
    return out;
}

struct DerivativeStats { double rmse=0, max=0; };
DerivativeStats derivativeError(const std::vector<V2>& points, V2 period, double alpha, double h) {
    double ss=0.0, mx=0.0;
    for (const auto& p:points) {
        const Sample s=psrdnoise(p,period,alpha);
        const double dx=(psrdnoise({p.x+h,p.y},period,alpha).value-psrdnoise({p.x-h,p.y},period,alpha).value)/(2*h);
        const double dy=(psrdnoise({p.x,p.y+h},period,alpha).value-psrdnoise({p.x,p.y-h},period,alpha).value)/(2*h);
        const double e=std::hypot(dx-s.gradient.x,dy-s.gradient.y);
        ss+=e*e; mx=std::max(mx,e);
    }
    return {std::sqrt(ss/points.size()),mx};
}

struct ScaledDerivativeStats { double correctedRmse=0, omittedChainRmse=0; };
ScaledDerivativeStats scaledDerivativeError(const std::vector<V2>& points, double frequency, V2 worldPeriod, double alpha, double h) {
    const V2 shaderPeriod{worldPeriod.x*frequency,worldPeriod.y*frequency};
    double sc=0.0, so=0.0;
    for(const auto& p:points) {
        const V2 q{p.x*frequency,p.y*frequency};
        const Sample s=psrdnoise(q,shaderPeriod,alpha);
        auto f=[&](V2 z){return psrdnoise({z.x*frequency,z.y*frequency},shaderPeriod,alpha).value;};
        const double dx=(f({p.x+h,p.y})-f({p.x-h,p.y}))/(2*h);
        const double dy=(f({p.x,p.y+h})-f({p.x,p.y-h}))/(2*h);
        const double ec=std::hypot(dx-frequency*s.gradient.x,dy-frequency*s.gradient.y);
        const double eo=std::hypot(dx-s.gradient.x,dy-s.gradient.y);
        sc+=ec*ec; so+=eo*eo;
    }
    return {std::sqrt(sc/points.size()),std::sqrt(so/points.size())};
}

struct AdvectionFit { double vx=0,vy=0,dtRmse=0,residualRmse=0,relativeResidual=0; };
AdvectionFit constantAdvectionFit(const std::vector<V2>& points,V2 period,double alpha,double h) {
    double a=0,b=0,c=0,rx=0,ry=0,dt2=0;
    struct Row{double gx,gy,rhs;}; std::vector<Row> rows; rows.reserve(points.size());
    for(const auto& p:points){
        const Sample s=psrdnoise(p,period,alpha);
        const double dt=(psrdnoise(p,period,alpha+h).value-psrdnoise(p,period,alpha-h).value)/(2*h);
        const double rhs=-dt;
        rows.push_back({s.gradient.x,s.gradient.y,rhs});
        a+=s.gradient.x*s.gradient.x; b+=s.gradient.x*s.gradient.y; c+=s.gradient.y*s.gradient.y;
        rx+=s.gradient.x*rhs; ry+=s.gradient.y*rhs; dt2+=dt*dt;
    }
    const double det=a*c-b*b;
    const double vx=(rx*c-ry*b)/det, vy=(a*ry-b*rx)/det;
    double ss=0; for(const auto&r:rows){const double e=r.gx*vx+r.gy*vy-r.rhs; ss+=e*e;}
    const double dtRmse=std::sqrt(dt2/rows.size()), residual=std::sqrt(ss/rows.size());
    return {vx,vy,dtRmse,residual,residual/dtRmse};
}

void writeError(std::ostream& o,const ErrorStats&s){o<<"{\"valueRmse\": "<<s.valueRmse<<", \"valueMax\": "<<s.valueMax<<", \"gradientRmse\": "<<s.gradientRmse<<", \"gradientMax\": "<<s.gradientMax<<"}";}

} // namespace

int main(int argc,char**argv){
    const std::string outPath=argc>1?argv[1]:"psrdnoise_contract_result_n07.json";
    std::mt19937_64 rng(20260917);
    std::uniform_real_distribution<double> dist(-31.0,31.0);
    std::vector<V2> points; points.reserve(4096);
    for(int i=0;i<4096;++i) points.push_back({dist(rng)+0.137,dist(rng)-0.219});

    const double alpha=0.37;
    const ErrorStats validX=compareShift(points,{5,4},alpha,{5,0});
    const ErrorStats validY=compareShift(points,{5,4},alpha,{0,4});
    const ErrorStats validXY=compareShift(points,{5,4},alpha,{5,4});
    const ErrorStats oddYDeclared=compareShift(points,{5,3},alpha,{0,3});
    const ErrorStats oddYActual=compareShift(points,{5,3},alpha,{0,6});
    const ErrorStats fractionalX=compareShift(points,{4.5,4},alpha,{4.5,0});
    const ErrorStats partialX=compareShift(points,{5,0},alpha,{5,0});
    const ErrorStats partialYNoWrap=compareShift(points,{5,0},alpha,{0,4});
    const ErrorStats alphaTurn=compareAlpha(points,{5,4},alpha,alpha+2*kPi);
    const ErrorStats alphaOne=compareAlpha(points,{5,4},alpha,alpha+1.0);
    const DerivativeStats derivative=derivativeError(points,{5,4},alpha,1e-5);
    const ScaledDerivativeStats scaled=scaledDerivativeError(points,1.5,{4,4},alpha,1e-5);
    const ErrorStats validWorldScaled=compareShift(points,{6,6},alpha,{6,0}); // q shift: 4m * 1.5
    const ErrorStats invalidWorldScaled=compareShift(points,{7.5,6},alpha,{7.5,0}); // q shift: 5m * 1.5
    const AdvectionFit advection=constantAdvectionFit(points,{5,4},alpha,1e-5);

    std::vector<Check> checks;
    auto check=[&](std::string name,bool pass){checks.push_back({std::move(name),pass});};
    check("integer x period repeats value and gradient",validX.valueMax<1e-10&&validX.gradientMax<1e-9);
    check("even integer y period repeats value and gradient",validY.valueMax<1e-10&&validY.gradientMax<1e-9);
    check("combined valid period repeats value and gradient",validXY.valueMax<1e-10&&validXY.gradientMax<1e-9);
    check("odd declared y period is not its actual repeat",oddYDeclared.valueRmse>0.05);
    check("odd declared y period repeats after twice the value",oddYActual.valueMax<1e-10&&oddYActual.gradientMax<1e-9);
    check("fractional x period does not satisfy seamless contract",fractionalX.valueRmse>0.05);
    check("zero y period still permits x wrapping",partialX.valueMax<1e-10&&partialX.gradientMax<1e-9);
    check("zero y period disables y wrapping",partialYNoWrap.valueRmse>0.05);
    check("alpha is periodic after two pi radians",alphaTurn.valueMax<1e-10&&alphaTurn.gradientMax<1e-9);
    check("alpha plus one is not a full turn",alphaOne.valueRmse>0.05);
    check("analytic gradient matches finite difference",derivative.rmse<1e-6&&derivative.max<1e-4);
    check("scaled-coordinate gradient applies chain factor",scaled.correctedRmse<1e-6&&scaled.omittedChainRmse>0.1);
    check("valid world period times frequency maps to valid lattice period",validWorldScaled.valueMax<1e-10);
    check("fractional lattice period from world scaling fails tiling",invalidWorldScaled.valueRmse>0.05);
    check("alpha evolution is not one constant-velocity translation",advection.relativeResidual>0.5);

    int passed=0; for(const auto&c:checks) if(c.pass) ++passed;
    std::ofstream out(outPath); out<<std::fixed<<std::setprecision(12);
    out<<"{\n  \"schema\": \"kaopu-psrdnoise-contract-result/n07\",\n";
    out<<"  \"status\": \""<<(passed==(int)checks.size()?"pass":"fail")<<"\",\n";
    out<<"  \"evidenceClass\": \"pinned psrdnoise GLSL source plus deterministic CPU semantic port\",\n";
    out<<"  \"sourceRevision\": \"419175a270862ce7ae692038fafafb42ec0427e9\",\n";
    out<<"  \"configuration\": {\"samples\": "<<points.size()<<", \"alphaRadians\": "<<alpha<<", \"finiteDifferenceStep\": 0.000010000000},\n";
    out<<"  \"periodicity\": {\n    \"validX_5\": ";writeError(out,validX);out<<",\n    \"validY_4\": ";writeError(out,validY);out<<",\n    \"validXY_5_4\": ";writeError(out,validXY);out<<",\n    \"oddYDeclared_3\": ";writeError(out,oddYDeclared);out<<",\n    \"oddYActual_6\": ";writeError(out,oddYActual);out<<",\n    \"fractionalX_4_5\": ";writeError(out,fractionalX);out<<",\n    \"partialXWrapped\": ";writeError(out,partialX);out<<",\n    \"partialYDisabled\": ";writeError(out,partialYNoWrap);out<<"\n  },\n";
    out<<"  \"phase\": {\"alphaPlusTwoPi\": ";writeError(out,alphaTurn);out<<", \"alphaPlusOne\": ";writeError(out,alphaOne);out<<"},\n";
    out<<"  \"derivative\": {\"analyticVsFiniteRmse\": "<<derivative.rmse<<", \"analyticVsFiniteMax\": "<<derivative.max<<", \"scaledCoordinateCorrectedRmse\": "<<scaled.correctedRmse<<", \"scaledCoordinateOmittedChainRmse\": "<<scaled.omittedChainRmse<<"},\n";
    out<<"  \"worldPeriodScaling\": {\"validWorld4Frequency1_5\": ";writeError(out,validWorldScaled);out<<", \"invalidWorld5Frequency1_5\": ";writeError(out,invalidWorldScaled);out<<"},\n";
    out<<"  \"constantAdvectionNegativeControl\": {\"bestFitVelocity\": ["<<advection.vx<<", "<<advection.vy<<"], \"phaseDerivativeRmse\": "<<advection.dtRmse<<", \"residualRmse\": "<<advection.residualRmse<<", \"relativeResidual\": "<<advection.relativeResidual<<"},\n";
    out<<"  \"summary\": {\"checks\": "<<checks.size()<<", \"passed\": "<<passed<<", \"failed\": "<<(checks.size()-passed)<<"},\n";
    out<<"  \"currentBestView\": \"The pinned 2-D psrdnoise contract tiles for positive integer x periods and positive even integer y periods; an odd y input repeats only after twice that input. Nonpositive components disable wrapping independently. Alpha is radians and repeats after two pi, but rotates lattice gradients rather than transporting material state. Analytic spatial derivatives require the ordinary coordinate-chain factor after scaling.\",\n";
    out<<"  \"boundary\": \"The CPU port mirrors the pinned scalar GLSL equations but is not a shader-runtime observation. It does not verify GLSL precision, WGSL/HLSL parity, GPU cost, multioctave filtering, material advection, physical flow, Mother adoption or visual acceptance.\",\n";
    out<<"  \"checks\": [\n";
    for(size_t i=0;i<checks.size();++i){out<<"    {\"name\": \""<<checks[i].name<<"\", \"pass\": "<<(checks[i].pass?"true":"false")<<"}"<<(i+1<checks.size()?",":"")<<"\n";}
    out<<"  ]\n}\n";
    out.close();
    std::ifstream in(outPath); std::cout<<in.rdbuf();
    return passed==(int)checks.size()?0:1;
}
