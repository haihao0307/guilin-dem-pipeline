// SPDX-License-Identifier: Apache-2.0
// Self-authored numerical harness. Calls the unmodified Adobe OpenPBR implementation.
// Adobe/GLM copyrights and licenses remain with their respective authors.
#include <glm/glm.hpp>
#include "openpbr.h"
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <limits>
#include <map>
#include <string>
#include <vector>

constexpr double AbsTol = 1e-5;
constexpr double RelTol = 5e-4;
constexpr double NormTol = 5e-5;
constexpr int SamplesPerView = 4096;
constexpr double Pi = 3.14159265358979323846;
static float random_float(std::uint32_t& state) {
    state = state * 1664525u + 1013904223u;
    return static_cast<float>(state >> 8u) * 0x1.0p-24f;
}
static vec3 direction(float degrees) {
    const float radians = degrees * static_cast<float>(Pi / 180.0);
    return vec3(std::sin(radians), 0.f, std::cos(radians));
}
static bool finite(vec3 v) { return std::isfinite(v.x) && std::isfinite(v.y) && std::isfinite(v.z); }
static bool nonnegative(vec3 v) { return v.x >= -1e-7f && v.y >= -1e-7f && v.z >= -1e-7f; }
static void rgb(std::ostream& out, vec3 v) { out << '[' << v.x << ',' << v.y << ',' << v.z << ']'; }
struct Case { std::string name; OpenPBR_ResolvedInputs input; bool black = false; };
static std::vector<Case> cases() {
    std::vector<Case> out;
    auto p = openpbr_make_default_resolved_inputs();
    p.base_color = vec3(.8f,.3f,.1f); p.specular_roughness = .4f;
    out.push_back({"dielectric", p});
    p.base_diffuse_roughness = .8f; out.push_back({"rough_diffuse", p});
    p = openpbr_make_default_resolved_inputs();
    p.base_color = vec3(.30f,.32f,.31f); p.base_metalness = 1.f; p.specular_roughness = .34f;
    out.push_back({"steel", p});
    p.specular_color = vec3(.8f,.95f,1.f); p.specular_roughness_anisotropy = .6f;
    out.push_back({"metal_f82_anisotropic", p});
    p.specular_color = vec3(1.f); p.specular_roughness_anisotropy = 0.f;
    p.coat_weight = .7f; p.coat_roughness = .25f; p.coat_color = vec3(.9f,.95f,1.f);
    out.push_back({"coated_steel", p});
    p.base_metalness = 0.f; p.base_color = vec3(.085f,.12f,.105f);
    out.push_back({"coated_dielectric", p});
    p = openpbr_make_default_resolved_inputs(); p.base_color = vec3(.25f,.4f,.6f);
    p.specular_roughness = .5f; p.fuzz_weight = .7f; p.fuzz_color = vec3(.7f,.8f,1.f); p.fuzz_roughness = .6f;
    out.push_back({"fuzz", p});
    p = openpbr_make_default_resolved_inputs(); p.transmission_weight = 1.f; p.specular_roughness = .3f;
    p.transmission_color = vec3(.8f,.9f,1.f);
    out.push_back({"solid_transmission_surface_tint", p});
    p.transmission_depth = 2.f; p.transmission_scatter = vec3(.02f);
    out.push_back({"solid_transmission_volume", p});
    p.transmission_depth = 0.f; p.transmission_scatter = vec3(0.f); p.geometry_thin_walled = true;
    out.push_back({"thin_walled_transmission", p});
    p = openpbr_make_default_resolved_inputs(); p.base_weight = 0.f; p.specular_weight = 0.f;
    out.push_back({"black_absorber_default_zero_coat_roughness", p, true});
    p.coat_roughness = .25f;
    out.push_back({"black_absorber_conditioned_unused_coat", p, true});
    return out;
}
struct Stats {
    long attempts = 0, valid = 0, zero_pdf = 0, queries = 0, checks = 0, failures = 0, delta = 0, pdf_failures = 0, response_failures = 0;
    double max_pdf_abs = 0, max_pdf_scaled = 0, max_response_abs = 0, max_response_scaled = 0, max_norm_error = 0;
    std::map<unsigned, long> flags;
    std::vector<std::string> examples;
    void check(bool good, const std::string& label) { ++checks; if (!good) { ++failures; if (examples.size()<12) examples.push_back(label); } }
    void compare(float a, float b, bool is_pdf, const std::string& where) {
        double err = std::abs(static_cast<double>(a)-b);
        double scaled = err / (AbsTol + RelTol * std::max(std::abs(static_cast<double>(a)),std::abs(static_cast<double>(b))));
        if (is_pdf) { max_pdf_abs = std::max(max_pdf_abs,err); max_pdf_scaled = std::max(max_pdf_scaled,scaled); }
        else { max_response_abs = std::max(max_response_abs,err); max_response_scaled = std::max(max_response_scaled,scaled); }
        bool good = std::isfinite(a) && std::isfinite(b) && scaled <= 1.;
        if(!good) { if(is_pdf) ++pdf_failures; else ++response_failures; }
        check(good,where+"_returned="+std::to_string(a)+"_queried="+std::to_string(b));
    }
};
static void print_stats(const Stats& s) {
    std::cout << "\"attempts\":"<<s.attempts<<",\"valid\":"<<s.valid<<",\"zero_pdf\":"<<s.zero_pdf
      <<",\"fixed_queries\":"<<s.queries<<",\"checks\":"<<s.checks<<",\"failures\":"<<s.failures<<",\"delta_samples\":"<<s.delta
      <<",\"pdf_failures\":"<<s.pdf_failures<<",\"response_failures\":"<<s.response_failures
      <<",\"max_pdf_absolute_error\":"<<s.max_pdf_abs<<",\"max_pdf_tolerance_ratio\":"<<s.max_pdf_scaled
      <<",\"max_response_absolute_error\":"<<s.max_response_abs<<",\"max_response_tolerance_ratio\":"<<s.max_response_scaled
      <<",\"max_direction_norm_error\":"<<s.max_norm_error<<",\"lobe_flags\":{";
    bool first=true; for(auto [flag,n]:s.flags){if(!first)std::cout<<',';first=false;std::cout<<'"'<<flag<<"\":"<<n;}
    std::cout << "},\"first_failures\":["; first=true;
    for(auto& e:s.examples){if(!first)std::cout<<',';first=false;std::cout<<'"'<<e<<'"';} std::cout<<']';
}
static int contracts() {
    long failures=0,checks=0,attempts=0,valid=0,zero=0;
    std::cout << "{\"schema\":\"openpbr-contract-results-1\",\"adobe_commit\":\"c91aad1d1ce1693e803f039d7c92c2965c4eb013\","
      <<"\"glm_commit\":\"6f14f4792a0cde5d0cf2c910506724d61cb95834\",\"absolute_tolerance\":"<<AbsTol<<",\"relative_tolerance\":"<<RelTol
      <<",\"direction_norm_tolerance\":"<<NormTol<<",\"seed\":12345,\"samples_per_view\":"<<SamplesPerView<<",\"cases\":[\n";
    bool first=true;
    for(const Case& c:cases()) {
        Stats s; std::uint32_t rng=12345u;
        for(float angle:{0.f,45.f,80.f}) {
            vec3 view=direction(angle);
            auto prepared=openpbr_prepare(c.input,vec3(1.f),OpenPBR_BaseRgbWavelengths_nm,OpenPBR_VacuumIor,view);
            s.check(finite(prepared.emission)&&finite(prepared.volume.extinction_coefficient)&&finite(prepared.volume.albedo)&&std::isfinite(prepared.volume.anisotropy),"prepare_public_outputs_finite");
            // Sample both hemispheres at fixed angles, including the horizon approximation.
            for(float light_angle:{-170.f,-135.f,-90.f,-80.f,-45.f,0.f,45.f,80.f,90.f,135.f,170.f}) {
                vec3 light=direction(light_angle); auto e=openpbr_eval(prepared,light); float q=openpbr_pdf(prepared,light); ++s.queries;
                s.check(finite(e.diffuse)&&finite(e.specular)&&std::isfinite(q),"fixed_eval_pdf_finite");
                s.check(nonnegative(e.diffuse)&&nonnegative(e.specular)&&q>=0.f,"fixed_eval_pdf_nonnegative");
                if(c.black) s.check(glm::length(e.diffuse)+glm::length(e.specular)==0.f,"black_fixed_response_zero");
            }
            for(int i=0;i<SamplesPerView;++i) {
                float x=random_float(rng),y=random_float(rng),z=random_float(rng);
                vec3 light; OpenPBR_DiffuseSpecular weight; float p=std::numeric_limits<float>::quiet_NaN(); OpenPBR_BsdfLobeType type;
                openpbr_sample(prepared,vec3(x,y,z),light,weight,p,type); ++s.attempts;
                s.check(std::isfinite(p)&&p>=0.f,"sample_pdf_finite_nonnegative");
                if(!std::isfinite(p)||p<0.f) continue;
                // Public contract: no other outputs may be inspected after a null sample.
                if(p==0.f){++s.zero_pdf;continue;}
                ++s.valid; ++s.flags[static_cast<unsigned>(type)];
                bool good=finite(light)&&finite(weight.diffuse)&&finite(weight.specular);
                s.check(good,"valid_sample_finite"); if(!good)continue;
                s.check(nonnegative(weight.diffuse)&&nonnegative(weight.specular),"sample_weight_nonnegative");
                if(c.black) s.check(glm::length(weight.diffuse)+glm::length(weight.specular)==0.f,"black_sample_weight_zero");
                double normerr=std::abs(static_cast<double>(glm::length(light))-1.); s.max_norm_error=std::max(s.max_norm_error,normerr);
                s.check(normerr<=NormTol,"sample_direction_unit");
                if(type&OpenPBR_BsdfLobeTypeSpecular){++s.delta;s.check(false,"unexpected_delta_public_prepare_disables_delta");continue;}
                // Keep the returned direction unchanged for the exact API consistency check.
                float q=openpbr_pdf(prepared,light);auto e=openpbr_eval(prepared,light);
                std::string where=c.name+"_view"+std::to_string(static_cast<int>(angle))+"_sample"+std::to_string(i);
                s.compare(p,q,true,"pdf_"+where);
                for(int k=0;k<3;++k){s.compare(weight.diffuse[k]*p,e.diffuse[k],false,"diffuse_"+where+"_c"+std::to_string(k));s.compare(weight.specular[k]*p,e.specular[k],false,"specular_"+where+"_c"+std::to_string(k));}
            }
        }
        if(!first)std::cout<<",\n";first=false;std::cout<<"{\"name\":\""<<c.name<<"\",";print_stats(s);std::cout<<'}';
        failures+=s.failures;checks+=s.checks;attempts+=s.attempts;valid+=s.valid;zero+=s.zero_pdf;
    }
    std::cout<<"\n],\"summary\":{\"passed\":"<<(failures==0?"true":"false")<<",\"failures\":"<<failures<<",\"checks\":"<<checks<<",\"attempts\":"<<attempts<<",\"valid\":"<<valid<<",\"zero_pdf\":"<<zero<<"}}\n";
    return failures==0?0:1;
}

// CPU transcription of the actual R05 vendored Three r170 direct-light equations.
// No IBL, tone mapping, derivative geometry roughness, normal perturbation, coat or fuzz.
static vec3 three_direct(vec3 color,float metalness,float roughness,vec3 v,vec3 l) {
    float nv=std::max(v.z,0.f),nl=std::max(l.z,0.f); if(nv<=0.f||nl<=0.f)return vec3(0.f);
    vec3 h=glm::normalize(v+l);float nh=std::max(h.z,0.f),vh=std::clamp(glm::dot(v,h),0.f,1.f);
    float r=std::clamp(std::max(roughness,.0525f),0.f,1.f),alpha=r*r,a2=alpha*alpha;
    float gv=nl*std::sqrt(a2+(1.f-a2)*nv*nv),gl=nv*std::sqrt(a2+(1.f-a2)*nl*nl);
    float visibility=.5f/std::max(gv+gl,1e-6f),denom=nh*nh*(a2-1.f)+1.f;
    float distribution=static_cast<float>(1./Pi)*a2/(denom*denom);
    vec3 f0=glm::mix(vec3(.04f),color,metalness);
    float q=std::exp2((-5.55473f*vh-6.98316f)*vh);vec3 fresnel=f0*(1.f-q)+vec3(q);
    return nl*(color*(1.f-metalness)*static_cast<float>(1./Pi)+fresnel*(visibility*distribution));
}
static OpenPBR_ResolvedInputs phase(vec3 color,float metalness,float roughness) {
    auto p=openpbr_make_default_resolved_inputs();p.base_color=color;p.base_metalness=metalness;p.specular_roughness=roughness;return p;
}
static int reference() {
    vec3 paint(.085f,.12f,.105f),steel(.30f,.32f,.31f);
    std::cout<<"{\"schema\":\"openpbr-r05-coverage-reference-1\",\"adobe_commit\":\"c91aad1d1ce1693e803f039d7c92c2965c4eb013\","
     <<"\"glm_commit\":\"6f14f4792a0cde5d0cf2c910506724d61cb95834\",\"r05_commit\":\"9556ad7273b7fc57bb30480cb2df97c035a95469\","
     <<"\"adobe_model_version\":\"1.1.1\",\"three_revision\":\"170\",\"generator\":\"contract_tests.cpp --reference; real openpbr_prepare/eval calls\","
     <<"\"quantity\":\"linear RGB BSDF times light-side cosine, sr^-1; unit incident radiance per solid angle\","
     <<"\"coordinates\":\"unit directions away from surface; normal +Z; view and signed light angles in XZ plane\","
     <<"\"scope\":\"opaque paint and steel coverage, one direct light, no environment/tone mapping/normal or geometry roughness. Three values are a CPU transcription, not a GPU measurement. Colors are R05 artistic inputs, not measured steel reflectance. Area mixing assumes unresolved side-by-side phases, not a transparent coating.\","
     <<"\"parameters\":{\"paint_color\":[0.085,0.12,0.105],\"steel_color\":[0.30,0.32,0.31],\"paint_metalness\":0,\"steel_metalness\":1,\"base_weight\":1,\"base_diffuse_roughness\":0,\"specular_weight\":1,\"specular_color\":[1,1,1],\"specular_ior\":1.5,\"coat_weight\":0,\"fuzz_weight\":0,\"transmission_weight\":0,\"subsurface_weight\":0,\"thin_film_weight\":0,\"exterior_ior\":1,\"path_throughput\":[1,1,1]},"
     <<"\"columns\":[\"roughness_mode\",\"view_deg\",\"light_deg\",\"steel_coverage\",\"paint_roughness\",\"steel_roughness\",\"adobe_area_rgb\",\"adobe_parameter_rgb\",\"three_area_rgb\",\"three_parameter_rgb\"],\"rows\":[\n";
    bool first=true;long count=0;int invalid=0;
    for(int mode=0;mode<4;++mode) {
        float pr=mode==0?.43f:mode==1?.2f:mode==2?.4f:.7f;
        float sr=mode==0?.34f:pr;
        std::string name=mode==0?"r05_native":mode==1?"uniform_0.2":mode==2?"uniform_0.4":"uniform_0.7";
        for(float view_angle:{0.f,30.f,60.f,80.f}) {
            vec3 v=direction(view_angle);auto p=phase(paint,0.f,pr),s=phase(steel,1.f,sr);
            auto pp=openpbr_prepare(p,vec3(1.f),OpenPBR_BaseRgbWavelengths_nm,OpenPBR_VacuumIor,v);
            auto ps=openpbr_prepare(s,vec3(1.f),OpenPBR_BaseRgbWavelengths_nm,OpenPBR_VacuumIor,v);
            for(float coverage:{0.f,.25f,.5f,.75f,1.f}) {
                vec3 color=glm::mix(paint,steel,coverage);float roughness=glm::mix(pr,sr,coverage);
                auto pm=openpbr_prepare(phase(color,coverage,roughness),vec3(1.f),OpenPBR_BaseRgbWavelengths_nm,OpenPBR_VacuumIor,v);
                for(int light_angle=-80;light_angle<=80;light_angle+=5) {
                    vec3 l=direction(static_cast<float>(light_angle));
                    vec3 aa=glm::mix(openpbr_get_sum_of_diffuse_specular(openpbr_eval(pp,l)),openpbr_get_sum_of_diffuse_specular(openpbr_eval(ps,l)),coverage);
                    vec3 ap=openpbr_get_sum_of_diffuse_specular(openpbr_eval(pm,l));
                    vec3 ta=glm::mix(three_direct(paint,0.f,pr,v,l),three_direct(steel,1.f,sr,v,l),coverage);
                    vec3 tp=three_direct(color,coverage,roughness,v,l);
                    if(!finite(aa)||!finite(ap)||!finite(ta)||!finite(tp)||!nonnegative(aa)||!nonnegative(ap)||!nonnegative(ta)||!nonnegative(tp))++invalid;
                    if(!first)std::cout<<",\n";first=false;
                    std::cout<<"[\""<<name<<"\","<<view_angle<<','<<light_angle<<','<<coverage<<','<<pr<<','<<sr<<',';rgb(std::cout,aa);std::cout<<',';rgb(std::cout,ap);std::cout<<',';rgb(std::cout,ta);std::cout<<',';rgb(std::cout,tp);std::cout<<']';++count;
                }
            }
        }
    }
    std::cout<<"\n],\"row_count\":"<<count<<",\"invalid_rows\":"<<invalid<<"}\n";return invalid?1:0;
}
int main(int argc,char** argv){std::cout<<std::setprecision(9);return argc==2&&std::string(argv[1])=="--reference"?reference():contracts();}
