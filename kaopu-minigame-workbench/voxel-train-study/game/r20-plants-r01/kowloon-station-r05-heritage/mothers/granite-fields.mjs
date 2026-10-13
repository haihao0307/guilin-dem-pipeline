// Isolated kind-2 leaf. Append after the UNCHANGED stone-fields.mjs and the
// shared KpSurface declaration. Reuses its exact st_* arithmetic and seeds.
// No renderer, bindings, texture, cache, new noise family or kind-0 override.
export const KP_GRANITE_WGSL = /* wgsl */ `
// STONE_STUDY kind 2: original equations + an explicit unmeasured metre bridge.
// 0.026 m/source-unit gives a nominal scell grid spacing of 2 mm at scale 1.
// This is a design setting, not a measured granite diameter or calibration.
const KP_GRANITE_SCALE_M:f32 = 0.026;
const KP_GRANITE_SOURCE_SCALE:f32 = 1.0;
const KP_GRANITE_SOURCE_MINERAL:f32 = 0.7;
const KP_GRANITE_SOURCE_CHROMA:f32 = 1.0;
const KP_GRANITE_SOURCE_RELIEF:f32 = 1.0;
const KP_GRANITE_CELL_M:f32 = KP_GRANITE_SCALE_M / (13.0 * KP_GRANITE_SOURCE_SCALE);
// Inherited master 8231; original color/pore/weather seeds 8632/8538/8832.
// All source coordinates enter through gr_sourceQ; height is converted once.

// Filtering settings are authored observation rules, NOT original parameters.
// The material-only crossfade replaces unresolved mineral identity with a
// declared uniform-crystal-hash ensemble between 0.5 and 2 source cells.
const GR_FILTER_CELL_START:f32 = 0.5;
const GR_FILTER_CELL_END:f32 = 2.0;
// Source-noise octave response fades to its 0.5 ensemble mean over these
// lattice footprints. A continuous statistical approximation, not an exact
// pixel convolution or proof of band-limiting. Geometry never uses this rule.
const GR_FILTER_OCTAVE_START:f32 = 0.35;
const GR_FILTER_OCTAVE_END:f32 = 1.0;
// Deterministic 48^3 source-pore quadrature; see sources/granite.json.
// Used only by the unresolved wet/cavity appearance, never by source height.
const GR_FILTER_PIT_MEAN:f32 = 0.01728213205072705;
const GR_GAUSS_OFFSET:f32 = 0.2886751345948129;
// Three exact flat-palette intervals and 3-node Gauss on each original
// smoothstep transition. Each pair is (original crystal.x, probability).
const GR_MINERAL_QUADRATURE:array<vec2<f32>,9> = array<vec2<f32>,9>(
 vec2<f32>(0.14,0.28), vec2<f32>(0.48,0.28), vec2<f32>(0.84,0.32),
 vec2<f32>(0.2867620999227555,0.01666666666666667),
 vec2<f32>(0.31,0.02666666666666667),
 vec2<f32>(0.3332379000772445,0.01666666666666667),
 vec2<f32>(0.6267620999227555,0.01666666666666667),
 vec2<f32>(0.65,0.02666666666666667),
 vec2<f32>(0.6732379000772445,0.01666666666666667)
);

// Faithful scell port: original z/y/x order, all 27 neighbors, strict < tie.
// crystal.y is piecewise constant. Its maximum height jump is 78 micrometres
// at this design scale. This field is NOT a smooth or conservative SDF.
fn gr_scell(p:vec3<f32>)->vec4<f32> {
 let ip=floor(p);let fp=fract(p);var md=100.0;var id=vec3<f32>(0.0);
 for(var z:i32= -1;z<=1;z++){
  for(var y:i32= -1;y<=1;y++){
   for(var x:i32= -1;x<=1;x++){
    let off=vec3<f32>(f32(x),f32(y),f32(z));let ix=ip+off;
    let v=off+st_hash33(ix)-fp;let d=dot(v,v);
    if(d<md){md=d;id=ix;}
   }
  }
 }
 return vec4<f32>(st_hash33(id+vec3<f32>(3.4)),sqrt(md));
}
fn gr_sourceQ(pLocalM:vec3<f32>)->vec3<f32> {
 let pos=pLocalM/KP_GRANITE_SCALE_M;
 let p=pos*KP_GRANITE_SOURCE_SCALE;
 return st_warp(p,st_seedVector(KP_STONE_COLOR_SEED,0.071));
}
fn gr_pits(q:vec3<f32>)->f32 {
 return pow(max(0.0,(st_sf(q*19.0+st_seedVector(KP_STONE_PORE_SEED,0.061))-0.57)/0.43),2.0);
}
struct KpGraniteOriginalFields {
 q:vec3<f32>,crystal:vec4<f32>,broad:f32,grain:f32,pits:f32,
}
fn gr_originalFields(pLocalM:vec3<f32>)->KpGraniteOriginalFields {
 let seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);let q=gr_sourceQ(pLocalM);
 return KpGraniteOriginalFields(q,gr_scell(q*13.0+seed),st_sf(q*1.35+seed),st_valueNoise3(q*49.0+seed),gr_pits(q));
}
fn gr_heightFromFields(f:KpGraniteOriginalFields)->f32 {
 let h=(f.crystal.y-0.5)*0.003+(f.broad-0.5)*0.009+(f.grain-0.5)*0.00035-f.pits*0.007;
 return h*KP_GRANITE_SOURCE_RELIEF*KP_GRANITE_SCALE_M;
}
// Geometry-only query: original q/crystal/broad/grain/pits; NO color, region,
// weather, roughness, footprint, maintenance multiplier or filtered geometry.
fn kpGraniteHeight(pLocalM:vec3<f32>)->f32 {
 return gr_heightFromFields(gr_originalFields(pLocalM));
}
// Original kind-2 color/mineral/rough/wet/chroma equations. Inactive kind-0
// veins/lines and kinds 1/3 are omitted. Original uEventCount=0, geomCavity=0.
fn gr_response(crystalX:f32,region:f32,weather:f32,pits:f32,sourceWet:f32,roughBias:f32)->vec4<f32> {
 let a=smoothstep(0.28,0.34,crystalX);let b=smoothstep(0.62,0.68,crystalX);
 var col=mix(vec3<f32>(0.18,0.20,0.20),vec3<f32>(0.67,0.66,0.59),a);
 col=mix(col,vec3<f32>(0.73,0.49,0.41),b*0.83);col*=0.80+0.29*region;
 let mineral=(1.0-a*0.7)*KP_GRANITE_SOURCE_MINERAL;
 let rough=mix(0.66,0.28,mineral);
 let cav=clamp(pits*1.4,0.0,1.0);
 let wet=clamp(sourceWet*(0.18+0.82*smoothstep(0.32,0.75,weather+cav*0.25)),0.0,1.0);
 let lum=dot(col,vec3<f32>(0.2126,0.7152,0.0722));
 col=mix(vec3<f32>(lum),col,KP_GRANITE_SOURCE_CHROMA);
 var linear=st_srgbToLinear(clamp(col,vec3<f32>(0.025),vec3<f32>(0.95)));
 linear*=1.0-wet*0.38;
 return vec4<f32>(linear,clamp(mix(rough+roughBias,0.17,wet),0.12,0.98));
}
fn gr_pointResponse(q:vec3<f32>,crystalX:f32,pits:f32,sourceWet:f32,roughBias:f32)->vec4<f32> {
 let seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);
 let region=st_sf(q*3.2+seed+vec3<f32>(11.0));
 let weather=st_sf(q*2.2+st_seedVector(KP_STONE_WEATHER_SEED,0.09));
 return gr_response(crystalX,region,weather,pits,sourceWet,roughBias);
}
// Public, unfiltered point reference for original GLSL kind-2 GPU comparison.
fn kpGraniteOriginalSurface(pLocalM:vec3<f32>,sourceWet:f32,roughBias:f32)->KpSurface {
 let f=gr_originalFields(pLocalM);
 let r=gr_pointResponse(f.q,f.crystal.x,f.pits,sourceWet,roughBias);
 return KpSurface(gr_heightFromFields(f),r.xyz,r.w);
}

// Same ORIGINAL three octave fields, offsets and weights. Each unresolved
// octave tends continuously to its declared ensemble mean, without generating
// another field. The resolved region/weather content therefore remains live.
fn gr_statisticalSf(p:vec3<f32>,sourceFootprint:f32)->f32 {
 let g0=1.0-smoothstep(GR_FILTER_OCTAVE_START,GR_FILTER_OCTAVE_END,sourceFootprint);
 let g1=1.0-smoothstep(GR_FILTER_OCTAVE_START,GR_FILTER_OCTAVE_END,sourceFootprint*2.07);
 let g2=1.0-smoothstep(GR_FILTER_OCTAVE_START,GR_FILTER_OCTAVE_END,sourceFootprint*4.11);
 var response=0.5;
 if(g0>0.0){response+=(st_valueNoise3(p)-0.5)*0.57*g0;}
 if(g1>0.0){response+=(st_valueNoise3(p*2.07+vec3<f32>(13.7))-0.5)*0.28*g1;}
 if(g2>0.0){response+=(st_valueNoise3(p*4.11+vec3<f32>(27.2))-0.5)*0.15*g2;}
 return response;
}
fn gr_meanResponse(q:vec3<f32>,sourceFootprint:f32,sourceWet:f32,roughBias:f32)->vec4<f32> {
 let seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);
 let region=gr_statisticalSf(q*3.2+seed+vec3<f32>(11.0),sourceFootprint*3.2);
 let weather=gr_statisticalSf(q*2.2+st_seedVector(KP_STONE_WEATHER_SEED,0.09),sourceFootprint*2.2);
 var result=vec4<f32>(0.0);
 for(var i:u32=0u;i<9u;i++){
  let tap=GR_MINERAL_QUADRATURE[i];
  result+=tap.y*gr_response(tap.x,region,weather,GR_FILTER_PIT_MEAN,sourceWet,roughBias);
 }
 return result;
}
// Four deterministic 2D tangent-plane Gauss samples approximate a square
// footprint of side physicalFootprintM. Normal is in pLocalM's own frame.
// Linear colors and roughness RESPONSES are averaged, never sRGB pigments.
// Mineral identity fully disappears by two warped source-cell footprints;
// low-frequency original region/weather survives until itself unresolved.
// The scalar footprint is isotropic: no anisotropic screen derivative claim.
fn gr_filteredSurface(pLocalM:vec3<f32>,normal:vec3<f32>,sourceWet:f32,roughBias:f32,physicalFootprintM:f32)->KpSurface {
 let fp=max(physicalFootprintM,0.0);
 if(fp==0.0){return kpGraniteOriginalSurface(pLocalM,sourceWet,roughBias);}
 var n=vec3<f32>(0.0,1.0,0.0);
 if(dot(normal,normal)>1e-20){n=normalize(normal);}
 let axis=select(vec3<f32>(0.0,0.0,1.0),vec3<f32>(0.0,1.0,0.0),abs(n.z)>0.9);
 let tangent=normalize(cross(axis,n));let bitangent=cross(n,tangent);
 var points:array<vec3<f32>,4>;
 for(var i:u32=0u;i<4u;i++){
  let sx=select(-1.0,1.0,(i&1u)!=0u);let sy=select(-1.0,1.0,(i&2u)!=0u);
  points[i]=gr_sourceQ(pLocalM+(tangent*sx+bitangent*sy)*(GR_GAUSS_OFFSET*fp));
 }
 // Chords of the SAME source warp estimate footprint magnification. Never
 // shrink below the metric nominal footprint; this is not a Lipschitz bound.
 let nominalFootprint=fp/KP_GRANITE_SCALE_M*KP_GRANITE_SOURCE_SCALE;
 let span=max(max(length(points[1]-points[0]),length(points[3]-points[2])),max(length(points[2]-points[0]),length(points[3]-points[1])));
 let sourceFootprint=max(nominalFootprint,span/(2.0*GR_GAUSS_OFFSET));
 let meanWeight=smoothstep(GR_FILTER_CELL_START,GR_FILTER_CELL_END,sourceFootprint*13.0);
 let seed=st_seedVector(KP_STONE_COLOR_SEED,0.071);var response=vec4<f32>(0.0);
 for(var i:u32=0u;i<4u;i++){
  let q=points[i];var sample=vec4<f32>(0.0);
  if(meanWeight<1.0){
   let crystal=gr_scell(q*13.0+seed);
   sample+=(1.0-meanWeight)*gr_pointResponse(q,crystal.x,gr_pits(q),sourceWet,roughBias);
  }
  if(meanWeight>0.0){sample+=meanWeight*gr_meanResponse(q,sourceFootprint,sourceWet,roughBias);}
  response+=sample*0.25;
 }
 // The physical surface height remains EXACTLY the same source point query.
 return KpSurface(kpGraniteHeight(pLocalM),response.xyz,response.w);
}
// Existing resolveStoneFabric bridge, unchanged from the kind-0 leaf.
// Its original default wear=0.15 is fixed. Age/wet/repair alter appearance
// controls only; geometry and the returned height keep the original equation.
fn kpGraniteSurface(pLocalM:vec3<f32>,normal:vec3<f32>,age:f32,wet:f32,repair:f32,physicalFootprintM:f32)->KpSurface {
 let a=clamp(age,0.0,1.0);let r=clamp(repair,0.0,1.0);let m=clamp(wet,0.0,1.0);
 let retainedAge=a*(1.0-r);
 let sourceWet=clamp(m*(0.45+0.55*retainedAge)*(1.0-0.45*r),0.0,1.0);
 let roughBias=0.07*retainedAge+0.025*0.15-0.06*r;
 return gr_filteredSurface(pLocalM,normal,sourceWet,roughBias,physicalFootprintM);
}
`;
