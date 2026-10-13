import {KP_BRICK_WGSL} from '../../runtime/mothers/brick-core.mjs';
import {KP_PLASTER_WGSL} from '../../runtime/mothers/plaster-core.mjs';
import {KP_V26_WGSL} from '../../runtime/mothers/v26-wet.mjs';
import {KP_WOOD_WGSL} from '../../runtime/mothers/wood-core.mjs';
import {KP_STONE_WGSL} from '../../runtime/mothers/stone-fields.mjs';
import {KP_STONE_SLATE_WGSL} from '../../runtime/mothers/stone-slate.mjs';
import {KP_METAL_WGSL} from '../../runtime/mothers/metal.mjs';
import {KP_CLOTH_COARSE_WGSL} from '../../runtime/mothers/cloth-coarse.mjs';
import {KP_CONCRETE_WGSL} from '../../runtime/mothers/concrete-kst.mjs';
import {KP_MORTAR_WGSL} from '../../runtime/mortar-binding.mjs';
import {skipZeroContributions} from '../../runtime/evaluation.mjs';
export const MOTHER_WGSL=skipZeroContributions([KP_BRICK_WGSL,KP_PLASTER_WGSL,KP_V26_WGSL,KP_WOOD_WGSL,KP_STONE_WGSL,KP_STONE_SLATE_WGSL,KP_METAL_WGSL].join('\n'))+'\n'+KP_CLOTH_COARSE_WGSL+'\n'+KP_MORTAR_WGSL+'\n'+KP_CONCRETE_WGSL;
export const MATERIAL_CALLS={plaster:['kpPlasterMacro','kpPlasterMicro','kpPlasterOriginalField'],wet:['kpV26WaterWeather','kpFabricState','kpApplyFabricSurface'],brick:['kpBrickBaseDistance','kpBrickOriginalSurface'],wood:['kpWoodMacroDisplacement','kpWoodOriginalSample'],metal:['kpMetalSurface','kpMetalCorrosion'],stone:['kpStoneSlateSurface'],newBridges:['whole-building facade orientation and metric brick cells','dated storey age, located drainage and local maintenance','glass straight transmission and sky Fresnel; no full refraction','screen footprint filtering without changing physical shape']};
MATERIAL_CALLS.concrete=['kpConcreteStation','KST1-surfaces-2 ST_FAMILY8'];
MATERIAL_CALLS.mortar=['kpMortarOriginalSurface','R3.12 shadeSoil surface-channel extraction'];
MATERIAL_CALLS.cloth=['kpClothCoarsePattern','kpClothCoarseSurface','kpClothCoarseLight'];
export const MATERIAL_DOMAIN_WGSL=String.raw`
struct MaterialResult{surface:KpSurface,metal:f32,cavity:f32,specular:f32,coat:f32,coatRough:f32}
struct PhysicalState{age:f32,wet:f32,repair:f32,q:vec3<f32>}
fn physicalState(h:GeoHit,p:vec3<f32>)->PhysicalState{let d=dna(h);var q=h.q;var wet=.06;if(h.materialId==3u){q=vec3<f32>(h.q.x,p.y-d.w,h.q.z);wet=(1.-smoothstep(.04,.22,abs(q.y)))*.18;}else if(h.materialId==6u){q=vec3<f32>(p.x,p.z,p.y);}else if(h.materialId==9u){let a=rec(h.stateId-1u,0u);let b=rec(h.stateId-1u,1u);q=p-vec3<f32>(a.x,a.y,b.x);}return PhysicalState(d.x,wet,d.z,q);}
struct SettlementField{d:f32,geo:GeoHit,sectionCap:u32}
fn dna(h:GeoHit)->vec4<f32>{if(h.stateId==0u){return vec4<f32>(.24,.1,0.,0.);}let a=rec(h.stateId-1u,0u);let c=rec(h.stateId-1u,2u);let event=rec(h.stateId-1u,3u);let added=event.y>.5&&((h.componentId>=1000000u&&h.componentId<1001000u)||(h.componentId>=4000000u&&h.componentId<4004000u));let shelter=h.componentId>=1200000u&&h.componentId<1201000u;let eventYear=select(event.w,rec(h.stateId-1u,5u).y,shelter);let age=select(c.x,clamp((u.size.w-eventYear)/40.,0.,1.),added||shelter);return vec4<f32>(age,f32(h.stateId)*.731+select(0.,9.17,added),select(c.y,.05,added),a.y);}
fn materialUV(p:vec3<f32>,n:vec3<f32>)->vec2<f32>{if(abs(n.x)>.6){return p.zy;}if(abs(n.z)>.6){return p.xy;}return p.xz;}
fn sourceSky(h:GeoHit)->f32{if(h.buildingId==0u||h.componentId>=900000u){return .95;}let a=rec(h.stateId-1u,0u);let b=rec(h.stateId-1u,1u);let outward=abs(h.q.z)<.3||abs(h.q.x)<.3;return select(.42,.76,outward)+.12*clamp(a.y/38.,0.,1.);}
fn sourcePlasterParams(h:GeoHit,p:vec3<f32>)->KpPlasterParams{var dark=vec3<f32>(.265,.235,.18);var light=vec3<f32>(.49,.435,.335);if(h.buildingId==2u){dark=vec3<f32>(.19,.24,.215);light=vec3<f32>(.365,.425,.365);}let d=dna(h);if(d.z>.3){dark=mix(dark,vec3<f32>(.32,.30,.245),d.z);light=mix(light,vec3<f32>(.52,.49,.405),d.z);}return KpPlasterParams(vec2<f32>(0.,1.35),vec2<f32>(2.,1.5),.0165,.0085,0.,.008,.025,.0002,dark,light,.0008,.000008,.018);}
fn wallCoordinates(h:GeoHit,p:vec3<f32>)->vec3<f32>{let uv=materialUV(p,h.n);return vec3<f32>(uv.x,p.y-dna(h).w,h.d);}
fn fabricAt(h:GeoHit,p:vec3<f32>)->KpFabricState{let a=rec(h.stateId-1u,0u);let b=rec(h.stateId-1u,1u);let d=dna(h);let q=wallCoordinates(h,p);let params=sourcePlasterParams(h,p);let local=p-vec3<f32>(a.x,a.y+a.w*.5,(b.x+b.y)*.5);let water=kpV26WaterWeather(p/4.,h.n,local,vec3<f32>(a.z,a.w,b.y-b.x),17.+d.y*53.,65.+d.y*53.);let pipeMask=(1.-smoothstep(.10,.48,length(p.xz-vec2<f32>(a.x+a.z*.5-.15,b.x-.14))))*(1.-smoothstep(a.w-.04,a.w+.05,p.y-a.y));let seam=(1.-smoothstep(.02,.30,abs(p.y-a.y)))*.18;let event=rec(h.stateId-1u,3u);let additionExterior=event.y>.5&&h.componentId>=1000000u&&h.componentId<1001000u;let exterior=select(.12,1.,additionExterior||abs(p.z-b.x)<.25||abs(p.z-b.y)<.25||abs(abs(p.x-a.x)-a.z*.5)<.25);// Rain reaches the same real opening corners and shelter footprints used by geometry.
 let cell=frontageCell(h.stateId-1u,p.x);let ap=frontageAperture(h.stateId-1u,cell);let sill=ap.y-ap.w;let below=(1.-smoothstep(sill-.04,sill+.10,p.y))*smoothstep(a.y+.08,a.y+.45,p.y);let corner=1.-smoothstep(.05,.24,abs(abs(p.x-ap.x)-ap.z));let frontContact=1.-smoothstep(.12,.26,abs(p.z-b.x));let runoff=below*corner*frontContact;let fb=frontageBounds(h.stateId-1u,cell);let hasShelter=(u32(rec(h.stateId-1u,4u).z)&(1u<<cell))!=0u;let sheltered=hasShelter&&abs(p.x-(fb.x+fb.y)*.5)<(fb.y-fb.x)*.44&&p.y<a.y+a.w-.40;let cover=select(1.,.56,sheltered&&frontContact>.5);let wet=clamp(exterior*cover*(.12+.68*water.x+.50*runoff+.62*pipeMask+seam),0.,.95);let exposure=clamp(exterior*cover*(.55+.32*water.y+.40*runoff+.42*pipeMask+seam),0.,1.);let macroTone=kpPlasterMacro(q,params);let microTone=kpPlasterMicro(q,params);let thickness=clamp(params.thicknessM+params.reliefM*macroTone,params.minThicknessM,params.maxThicknessM);return kpFabricState(d.x,exposure,wet,water.y,.1,d.z,macroTone,microTone,thickness,.001,.025);}
fn brickCoordinate(h:GeoHit,p:vec3<f32>,baseD:f32)->vec3<f32>{let uv=materialUV(p,h.n);let row=floor(uv.y/.07);let shift=f32(i32(row)&1)*.125;return vec3<f32>(fract((uv.x-shift)/.25)*.25-.125,fract(uv.y/.07)*.07-.035,.055384615+baseD+.0165);}
fn brickIdentity(h:GeoHit,p:vec3<f32>)->vec2<f32>{let uv=materialUV(p,h.n);let row=floor(uv.y/.07);let shift=f32(i32(row)&1)*.125;let seed=dna(h).y+floor((uv.x-shift)/.25)*13.7+row*41.3;return vec2<f32>(seed,floor(br_h11(seed)*4.));}
fn woodNormal(h:GeoHit,n:vec3<f32>)->vec3<f32>{let axis=h.componentId%4u;if(axis==1u){return n.yxz;}if(axis==2u){return n.zyx;}return n;}
fn stoneParameters(h:GeoHit)->KpStoneSlateParams{var a=kpStoneSlateDefaultParams();a.sourceScaleM=select(.8,2.5,h.buildingId==0u);a.relief=.06;return a;}
fn sceneMaterial(h:GeoHit,p:vec3<f32>,n:vec3<f32>,fp:f32,cap:u32)->MaterialResult{var s=KpSurface(0.,vec3<f32>(.3),.8);var metal=0.;var cavity=1.;var spec=1.;var coat=0.;var coatRough=.25;let d=dna(h);
 if(h.stateId==0u){return MaterialResult(KpSurface(0.,vec3<f32>(.28),.92),0.,1.,1.,0.,.25);}
 if(h.materialId==1u){s=kpPlasterOriginalField(wallCoordinates(h,p),sourcePlasterParams(h,p),fp).surface;if(cap==0u){s=kpApplyFabricSurface(s,fabricAt(h,p));}}
 if(h.materialId==2u){let id=brickIdentity(h,p);s=kpBrickOriginalSurface(brickCoordinate(h,p,h.d),id.x,i32(id.y),.42,fp);if(cap==0u){s=kpApplyFabricSurface(s,fabricAt(h,p));}}
 if(h.materialId==8u){s=kpMortarOriginalSurface(wallCoordinates(h,p),fp);if(cap==0u){s=kpApplyFabricSurface(s,fabricAt(h,p));}}
 if(h.materialId==3u){let state=physicalState(h,p);s=kpMetalSurface(state.q,state.age,state.wet,state.repair,fp);metal=.70*(1.-smoothstep(.05,.30,kpMetalCorrosion(state.q,state.age,state.wet,state.repair)));}
 if(h.materialId==4u){let wn=woodNormal(h,n);let sample=kpWoodOriginalSample(h.q,wn,select(0.,1.,abs(wn.x)>.72),kpWoodDefaultParams(),fp,length(p-u.eye.xyz));s=sample.surface;cavity=sample.cavity;spec=sample.specularLevel;coat=sample.clearcoat;coatRough=sample.clearcoatRoughness;}
 if(h.materialId==5u){s=KpSurface(0.,vec3<f32>(.65,.75,.72),.12);}
 if(h.materialId==6u){let state=physicalState(h,p);s=kpStoneSlateSurface(state.q,stoneParameters(h),state.age,state.wet,state.repair,fp);}
 if(h.materialId==9u){let state=physicalState(h,p);s=kpConcreteStation(state.q,state.age,state.wet,state.repair,fp);}
 if(h.materialId==7u){s=kpClothCoarseSurface(h.q.xz,fp);spec=.6;}
 return MaterialResult(s,metal,cavity,spec,coat,coatRough);}
fn materialDistance(h:GeoHit,p:vec3<f32>)->SettlementField{var g=h;var d=h.d;
 if(h.stateId==0u){return SettlementField(d,g,0u);}
 if(h.materialId==1u){let state=fabricAt(h,p);let original=kpPlasterOriginalField(wallCoordinates(h,p),sourcePlasterParams(h,p),.00003);let remain=state.thicknessM*smoothstep(-.05,.08,state.retention);let coating=max(h.d+.0165-remain-original.surface.height,-state.retention*.018);let id=brickIdentity(h,p);let mortarSample=kpMortarOriginalSurface(wallCoordinates(h,p),.00003);let mortar=h.d+.0265+.002*state.damage-mortarSample.height;var brick=1e6;if(h.d<.025){let brickQ=brickCoordinate(h,p,h.d);let brickMicro=kpBrickOriginalSurface(brickQ,id.x,i32(id.y),.42,.00003).height;brick=kpBrickBaseDistance(brickQ,id.x,i32(id.y),.42)-brickMicro;}let masonry=min(mortar,brick);d=min(coating,masonry);if(masonry<coating){g.materialId=select(2u,8u,mortar<=brick);}}
 else if(h.materialId==3u){let state=physicalState(h,p);d-=kpMetalSurface(state.q,state.age,state.wet,state.repair,.00003).height;}
 else if(h.materialId==4u){let wp=kpWoodDefaultParams();let wn=woodNormal(h,h.n);let cls=select(0.,1.,abs(wn.x)>.72);let sample=kpWoodOriginalSample(h.q,wn,cls,wp,.00003,0.);d-=kpWoodMacroDisplacement(h.q,cls,wp)+sample.surface.height+(sample.parallaxHeight01-.5)*wp.parallaxM;}
 else if(h.materialId==9u){let state=physicalState(h,p);d-=kpConcreteStation(state.q,state.age,state.wet,state.repair,.00003).height;}
 else if(h.materialId==7u){d-=kpClothCoarseSurface(h.q.xz,0.).height;}
 else if(h.materialId==6u){let state=physicalState(h,p);d-=kpStoneSlateSurface(state.q,stoneParameters(h),state.age,state.wet,state.repair,.00003).height;}
 return SettlementField(d,g,0u);}
// Analytic current-parameter bounds are recorded in qa/material-distance-bounds.txt.
// 0.012m is deliberately wider than every possible displacement; this is a
// distance-value bound, not a claim that the displaced field is a strict SDF.
const MATERIAL_DISTANCE_BOUND:f32=.012;
fn sceneField(p:vec3<f32>)->SettlementField{
 fieldCompetition=true;fieldExcludedCount=0u;
 var best=SettlementField(220.,GeoHit(220.,0u,0u,0u,0u,p,vec3<f32>(0.,1.,0.),0u),0u);
 let rounds=min(32u,arrayLength(&worldRules));
 for(var roundIndex=0u;roundIndex<rounds;roundIndex++){
  // A single textual geometry invocation and a single mother invocation. Never
  // assume that the undisplaced closest object remains the closest afterwards.
  let h=querySettlement(p,220.);let lower=h.d-MATERIAL_DISTANCE_BOUND;
  if(lower>=best.d){fieldCompetition=false;return best;}
  var f=SettlementField(lower,h,0u);
  if(h.materialId==0u||h.d>.04){f.geo.materialId=0u;fieldCompetition=false;if(f.d<best.d){return f;}return best;}
  f=materialDistance(h,p);
  // Section each real object, while keeping the same world's ground intact.
  if(u.cut.w<500.&&h.stateId!=0u){let cd=dot(p,u.cut.xyz)-u.cut.w;if(cd>f.d){f.d=cd;f.sectionCap=1u;if(f.geo.materialId==1u){f.geo.materialId=2u;}f.geo.n=u.cut.xyz;}}
  if(f.d<best.d){best=f;}
  fieldExcluded[fieldExcludedCount]=vec2<u32>(h.stateId,h.componentId);fieldExcludedCount++;
 }
 fieldCompetition=false;
 // Fixed storage exhausted: explicit invalid result, never an arbitrary winner.
 best.geo.componentId=4294967295u;best.d=0.;return best;
}
fn raySceneField(p:vec3<f32>,rd:vec3<f32>)->SettlementField{return sceneField(p);}
`;

