import {KP_BRICK_WGSL} from './mothers/brick-core.mjs';
import {KP_PLASTER_WGSL} from './mothers/plaster-core.mjs';
import {KP_V26_WGSL} from './mothers/v26-wet.mjs';
import {KP_WOOD_WGSL} from './mothers/wood-core.mjs';
import {KP_STONE_WGSL} from './mothers/stone-fields.mjs';
import {KP_STONE_SLATE_WGSL} from './mothers/stone-slate.mjs';
import {KP_METAL_WGSL} from './mothers/metal.mjs';
import {skipZeroContributions} from './evaluation.mjs';
export const MOTHER_WGSL=skipZeroContributions([KP_BRICK_WGSL,KP_PLASTER_WGSL,KP_V26_WGSL,KP_WOOD_WGSL,KP_STONE_WGSL,KP_STONE_SLATE_WGSL,KP_METAL_WGSL].join('\n'));
export const MATERIAL_CALLS={plaster:['kpPlasterMacro','kpPlasterMicro','kpPlasterOriginalField'],wet:['kpV26WaterWeather','kpFabricState','kpApplyFabricSurface'],brick:['kpBrickBaseDistance','kpBrickOriginalSurface'],wood:['kpWoodMacroDisplacement','kpWoodOriginalSample'],metal:['kpMetalSurface','kpMetalCorrosion'],stone:['kpStoneSlateSurface'],newBridges:['whole-building facade orientation and metric brick cells','dated storey age, located drainage and local maintenance','glass straight transmission and sky Fresnel; no full refraction','screen footprint filtering without changing physical shape']};
export const MATERIAL_DOMAIN_WGSL=String.raw`
struct MaterialResult { surface:KpSurface, metal:f32, cavity:f32, specular:f32, coat:f32, coatRough:f32, }
struct SettlementField { d:f32, geo:GeoHit, sectionCap:u32, }
fn materialUV(p:vec3<f32>,n:vec3<f32>)->vec2<f32>{if(abs(n.x)>.6){return vec2<f32>(p.z,p.y);}if(abs(n.z)>.6){return p.xy;}return p.xz;}
fn sourcePlasterParams(h:GeoHit,p:vec3<f32>)->KpPlasterParams{
 let dna=geoFabric(h.stateId);let k=h.buildingId%4u;
 var dark=vec3<f32>(.18,.19,.165);var light=vec3<f32>(.34,.345,.29);
 if(k==1u){dark=vec3<f32>(.20,.175,.145);light=vec3<f32>(.41,.35,.265);}
 if(k==2u){dark=vec3<f32>(.15,.19,.18);light=vec3<f32>(.30,.37,.335);}
 if(k==3u){dark=vec3<f32>(.20,.205,.21);light=vec3<f32>(.39,.395,.38);}
 return KpPlasterParams(vec2<f32>(0.,1.4),vec2<f32>(2.,1.5),.0165,.0085,0.,.008,.025,.0002,dark,light,.0008,.000008,.018);
}
fn wallCoordinates(h:GeoHit,p:vec3<f32>)->vec3<f32>{let dna=geoFabric(h.stateId);let uv=materialUV(p,h.n);return vec3<f32>(uv.x-f32(h.buildingId)*.371,p.y-dna.w,h.d);}
fn fabricAt(h:GeoHit,p:vec3<f32>)->KpFabricState{
 let dna=geoFabric(h.stateId);let q=wallCoordinates(h,p);let params=sourcePlasterParams(h,p);
 let water=kpV26WaterWeather(vec3<f32>(q.x/4.,p.y/4.,0.),h.n,vec3<f32>(q.x,q.y-1.4,0.),vec3<f32>(4.,2.8,.24),17.+dna.y*53.,65.+dna.y*53.);
 // The leak centre comes from the SAME packed external drain used by geometry.
 // Sources are limited to each actual pipe/storey joint, plus the real ground edge.
 var pipeMask=0.;var exterior=0.;if(h.buildingId>0u){let off=i32(geo_get(1).x)+(i32(h.buildingId)-1)*8;let a=geo_get(off);let axes=geo_get(off+2);let service=geo_get(off+4);
  let pipeXZ=vec2<f32>(a.x+axes.x*(a.z*.5-service.x),a.y+axes.y*(a.w*.5-service.y));
  let gap=length(p.xz-pipeXZ);let fall=(1.-smoothstep(2.3,2.8,q.y))*smoothstep(-.1,.1,q.y);
  pipeMask=(1.-smoothstep(.08,.45,gap))*fall;
  let part=h.componentId%256u;exterior=select(0.,1.,part>=2u&&part<=5u);
 }
 let groundEdge=(1.-smoothstep(.06,.45,p.y))*exterior;
 let damp=clamp((.015+.30*pipeMask+.12*groundEdge)*(.7+.3*water.x),0.,1.);
 let macroTone=kpPlasterMacro(q,params);let microTone=kpPlasterMicro(q,params);
 let thickness=clamp(params.thicknessM+params.reliefM*macroTone,params.minThicknessM,params.maxThicknessM);
 return kpFabricState(dna.x,mix(.24,.72,exterior),damp,water.y,.10,dna.z,macroTone,microTone,thickness,.001,.025);
}
fn brickCoordinate(h:GeoHit,p:vec3<f32>,baseDistance:f32)->vec3<f32>{
 let uv=materialUV(p,h.n);let row=floor(uv.y/.07);let shift=f32(i32(row)&1)*.125;
 return vec3<f32>(fract((uv.x-shift)/.25)*.25-.125,fract(uv.y/.07)*.07-.035,.055384615+baseDistance+.0165);
}
fn brickIdentity(h:GeoHit,p:vec3<f32>)->vec2<f32>{let uv=materialUV(p,h.n);let row=floor(uv.y/.07);let seed=geoFabric(h.stateId).y+floor(uv.x/.25)*13.7+row*41.3;return vec2<f32>(seed,floor(br_h11(seed)*4.));}
fn metalCoordinates(h:GeoHit,p:vec3<f32>)->vec3<f32>{var base=geoFabric(h.stateId).w;if(h.componentId%65536u>=60000u&&h.buildingId>0u){base=geoBuildingHeight(h.buildingId);}return vec3<f32>(h.q.x,p.y-base,h.q.z);}
fn woodCoordinates(h:GeoHit)->vec3<f32>{if(h.buildingId==0u){return h.q.zxy;}if(h.componentId%2u==0u&&abs(h.q.y)>.88){return h.q;}return h.q.yxz;}
fn woodNormal(h:GeoHit,n:vec3<f32>)->vec3<f32>{if(h.buildingId==0u){return n.zxy;}if(h.componentId%2u==0u&&abs(h.q.y)>.88){return n;}return n.yxz;}
fn sceneMaterial(h:GeoHit,p:vec3<f32>,n:vec3<f32>,footprint:f32,cap:u32)->MaterialResult{
 var s=KpSurface(0.,vec3<f32>(.3),.8);var metal=0.;var cavity=1.;var spec=1.;var coat=0.;var coatRough=.25;
 let dna=geoFabric(h.stateId);
 if(h.materialId==1u){let q=wallCoordinates(h,p);s=kpPlasterOriginalField(q,sourcePlasterParams(h,p),footprint).surface;if(cap==0u){s=kpApplyFabricSurface(s,fabricAt(h,p));}}
 if(h.materialId==2u){let ident=brickIdentity(h,p);let q=brickCoordinate(h,p,0.);s=kpBrickOriginalSurface(q,ident.x,i32(ident.y),.42,footprint);if(cap==0u){s=kpApplyFabricSurface(s,fabricAt(h,p));}}
 if(h.materialId==3u){let q=metalCoordinates(h,p);let wet=(1.-smoothstep(.04,.22,abs(q.y)))*.18;s=kpMetalSurface(q,dna.x,wet,dna.z,footprint);let oxide=kpMetalCorrosion(q,dna.x,wet,dna.z);metal=.70*(1.-smoothstep(.05,.30,oxide));}
 if(h.materialId==4u){let q=woodCoordinates(h);let wn=woodNormal(h,n);let wp=kpWoodDefaultParams();let sample=kpWoodOriginalSample(q,wn,select(0.,1.,abs(wn.x)>.72),wp,footprint,length(p-u.eye.xyz));s=sample.surface;cavity=sample.cavity;spec=sample.specularLevel;coat=sample.clearcoat;coatRough=sample.clearcoatRoughness;}
 if(h.materialId==5u){s=KpSurface(0.,vec3<f32>(.65,.75,.72),.12);}
 if(h.materialId==6u){var a=kpStoneSlateDefaultParams();a.sourceScaleM=.1235294118;s=kpStoneSlateSurface(vec3<f32>(p.x,p.z,p.y),a,dna.x,.06,dna.z,footprint);}
 return MaterialResult(s,metal,cavity,spec,coat,coatRough);
}
fn materialDistance(h:GeoHit,p:vec3<f32>)->SettlementField{
 var g=h;var d=h.d;
 if(h.materialId==1u){
  let state=fabricAt(h,p);let q=wallCoordinates(h,p);let orig=kpPlasterOriginalField(q,sourcePlasterParams(h,p),.00003);
  let remain=state.thicknessM*smoothstep(-.05,.08,state.retention);
  let coating=select(1e4,h.d+.0165-remain-orig.surface.height,remain>.0004);
  let brickq=brickCoordinate(h,p,h.d);let ident=brickIdentity(h,p);
  var masonry=h.d+.0265;
  if(h.d<.025){masonry=min(masonry,kpBrickBaseDistance(brickq,ident.x,i32(ident.y),.42));}
  d=min(coating,masonry);if(masonry<coating){g.materialId=2u;}
 }else if(h.materialId==2u){let q=brickCoordinate(h,p,h.d-.0165);let ident=brickIdentity(h,p);d=min(h.d+.010,kpBrickBaseDistance(q,ident.x,i32(ident.y),.42));}
 else if(h.materialId==3u){let q=metalCoordinates(h,p);let wet=(1.-smoothstep(.04,.22,abs(q.y)))*.18;let dna=geoFabric(h.stateId);d-=kpMetalSurface(q,dna.x,wet,dna.z,.00003).height;}
 else if(h.materialId==4u){let wp=kpWoodDefaultParams();let q=woodCoordinates(h);let wn=woodNormal(h,h.n);let cls=select(0.,1.,abs(wn.x)>.72);let sample=kpWoodOriginalSample(q,wn,cls,wp,.00003,0.);d-=kpWoodMacroDisplacement(q,cls,wp)+sample.surface.height+(sample.parallaxHeight01-.5)*wp.parallaxM;}
 else if(h.materialId==6u){var a=kpStoneSlateDefaultParams();a.sourceScaleM=.1235294118;d-=kpStoneSlateSurface(vec3<f32>(p.x,p.z,p.y),a,geoFabric(h.stateId).x,.06,0.,.00003).height;}
 return SettlementField(d,g,0u);
}
fn sceneField(p:vec3<f32>)->SettlementField{
 let h=querySettlement(p,600.);var result=SettlementField(h.d-.036,h,0u);
 // All sources have an explicit fixed world displacement shell. Screen footprint
 // never changes the geometry or the construction/repair state.
 if(h.materialId>0u&&h.d<.04){result=materialDistance(h,p);}
 if(u.cut.w<500.){let cd=dot(p,u.cut.xyz)-u.cut.w;if(cd>result.d){result.d=cd;result.sectionCap=1u;if(result.geo.materialId==1u){result.geo.materialId=2u;}result.geo.n=u.cut.xyz;}}
 return result;
}
`;
