import {KP_BRICK_WGSL} from './mothers/brick-core.mjs';
import {KP_PLASTER_WGSL} from './mothers/plaster-core.mjs';
import {KP_V26_WGSL} from './mothers/v26-wet.mjs';
import {KP_WOOD_WGSL} from './mothers/wood-core.mjs';
import {KP_STONE_WGSL} from './mothers/stone-fields.mjs';
import {KP_STONE_SLATE_WGSL} from './mothers/stone-slate.mjs';
import {KP_METAL_WGSL} from './mothers/metal.mjs';
import {KP_CLOTH_COARSE_WGSL} from './mothers/cloth-coarse.mjs';
import {skipZeroContributions} from './evaluation.mjs';
export const MOTHER_WGSL=skipZeroContributions([KP_BRICK_WGSL,KP_PLASTER_WGSL,KP_V26_WGSL,KP_WOOD_WGSL,KP_STONE_WGSL,KP_STONE_SLATE_WGSL,KP_METAL_WGSL].join('\n'))+'\n'+KP_CLOTH_COARSE_WGSL;
export const MATERIAL_CALLS={plaster:['kpPlasterMacro','kpPlasterMicro','kpPlasterOriginalField'],wet:['kpV26WaterWeather','kpFabricState','kpApplyFabricSurface'],brick:['kpBrickBaseDistance','kpBrickOriginalSurface'],wood:['kpWoodMacroDisplacement','kpWoodOriginalSample'],metal:['kpMetalSurface','kpMetalCorrosion'],stone:['kpStoneSlateSurface'],newBridges:['whole-building facade orientation and metric brick cells','dated storey age, located drainage and local maintenance','glass straight transmission and sky Fresnel; no full refraction','screen footprint filtering without changing physical shape']};
MATERIAL_CALLS.cloth=['kpClothCoarsePattern','kpClothCoarseSurface','kpClothCoarseLight'];
export const MATERIAL_DOMAIN_WGSL=String.raw`
struct MaterialResult{surface:KpSurface,metal:f32,cavity:f32,specular:f32,coat:f32,coatRough:f32}
struct SettlementField{d:f32,geo:GeoHit,sectionCap:u32}
fn dna(h:GeoHit)->vec4<f32>{if(h.stateId==0u){return vec4<f32>(.24,.1,0.,0.);}let a=rec(h.stateId-1u,0u);let c=rec(h.stateId-1u,2u);return vec4<f32>(c.x,f32(h.stateId)*.731,c.y,a.y);}
fn materialUV(p:vec3<f32>,n:vec3<f32>)->vec2<f32>{if(abs(n.x)>.6){return p.zy;}if(abs(n.z)>.6){return p.xy;}return p.xz;}
fn sourceSky(h:GeoHit)->f32{if(h.buildingId==0u||h.componentId>=900000u){return .95;}let a=rec(h.stateId-1u,0u);let b=rec(h.stateId-1u,1u);let outward=abs(h.q.z)<.3||abs(h.q.x)<.3;return select(.42,.76,outward)+.12*clamp(a.y/38.,0.,1.);}
fn sourcePlasterParams(h:GeoHit,p:vec3<f32>)->KpPlasterParams{var dark=vec3<f32>(.265,.235,.18);var light=vec3<f32>(.49,.435,.335);if(h.buildingId==2u){dark=vec3<f32>(.19,.24,.215);light=vec3<f32>(.365,.425,.365);}let d=dna(h);if(d.z>.3){dark=mix(dark,vec3<f32>(.32,.30,.245),d.z);light=mix(light,vec3<f32>(.52,.49,.405),d.z);}return KpPlasterParams(vec2<f32>(0.,1.35),vec2<f32>(2.,1.5),.0165,.0085,0.,.008,.025,.0002,dark,light,.0008,.000008,.018);}
fn wallCoordinates(h:GeoHit,p:vec3<f32>)->vec3<f32>{let uv=materialUV(p,h.n);return vec3<f32>(uv.x,p.y-dna(h).w,h.d);}
fn fabricAt(h:GeoHit,p:vec3<f32>)->KpFabricState{let a=rec(h.stateId-1u,0u);let b=rec(h.stateId-1u,1u);let d=dna(h);let q=wallCoordinates(h,p);let params=sourcePlasterParams(h,p);let local=p-vec3<f32>(a.x,a.y+a.w*.5,(b.x+b.y)*.5);let water=kpV26WaterWeather(p/4.,h.n,local,vec3<f32>(a.z,a.w,b.y-b.x),17.+d.y*53.,65.+d.y*53.);let pipeMask=(1.-smoothstep(.10,.48,length(p.xz-vec2<f32>(a.x+a.z*.5-.15,b.x-.14))))*(1.-smoothstep(a.w-.04,a.w+.05,p.y-a.y));let seam=(1.-smoothstep(.02,.30,abs(p.y-a.y)))*.18;let exterior=select(.12,1.,abs(p.z-b.x)<.25||abs(p.z-b.y)<.25||abs(abs(p.x-a.x)-a.z*.5)<.25);let wet=clamp(exterior*(.05*water.x+.55*pipeMask+seam),0.,.85);let exposure=clamp(.06+exterior*(.12*water.y+.5*pipeMask+seam),0.,1.);let macroTone=kpPlasterMacro(q,params);let microTone=kpPlasterMicro(q,params);let thickness=clamp(params.thicknessM+params.reliefM*macroTone,params.minThicknessM,params.maxThicknessM);return kpFabricState(d.x,exposure,wet,water.y,.1,d.z,macroTone,microTone,thickness,.001,.025);}
fn brickCoordinate(h:GeoHit,p:vec3<f32>,baseD:f32)->vec3<f32>{let uv=materialUV(p,h.n);let row=floor(uv.y/.07);let shift=f32(i32(row)&1)*.125;return vec3<f32>(fract((uv.x-shift)/.25)*.25-.125,fract(uv.y/.07)*.07-.035,.055384615+baseD+.0165);}
fn brickIdentity(h:GeoHit,p:vec3<f32>)->vec2<f32>{let uv=materialUV(p,h.n);let seed=dna(h).y+floor(uv.x/.25)*13.7+floor(uv.y/.07)*41.3;return vec2<f32>(seed,floor(br_h11(seed)*4.));}
fn woodNormal(h:GeoHit,n:vec3<f32>)->vec3<f32>{let axis=h.componentId%4u;if(axis==1u){return n.yxz;}if(axis==2u){return n.zyx;}return n;}
fn stoneParameters(h:GeoHit)->KpStoneSlateParams{var a=kpStoneSlateDefaultParams();a.sourceScaleM=select(.8,2.5,h.buildingId==0u);a.relief=.06;return a;}
fn sceneMaterial(h:GeoHit,p:vec3<f32>,n:vec3<f32>,fp:f32,cap:u32)->MaterialResult{var s=KpSurface(0.,vec3<f32>(.3),.8);var metal=0.;var cavity=1.;var spec=1.;var coat=0.;var coatRough=.25;let d=dna(h);
 if(h.materialId==1u){s=kpPlasterOriginalField(wallCoordinates(h,p),sourcePlasterParams(h,p),fp).surface;if(cap==0u){s=kpApplyFabricSurface(s,fabricAt(h,p));}}
 if(h.materialId==2u){let id=brickIdentity(h,p);s=kpBrickOriginalSurface(brickCoordinate(h,p,0.),id.x,i32(id.y),.42,fp);if(cap==0u){s=kpApplyFabricSurface(s,fabricAt(h,p));}}
 if(h.materialId==3u){let q=vec3<f32>(h.q.x,p.y-d.w,h.q.z);let wet=(1.-smoothstep(.04,.22,abs(q.y)))*.18;s=kpMetalSurface(q,d.x,wet,d.z,fp);metal=.70*(1.-smoothstep(.05,.30,kpMetalCorrosion(q,d.x,wet,d.z)));}
 if(h.materialId==4u){let wn=woodNormal(h,n);let sample=kpWoodOriginalSample(h.q,wn,select(0.,1.,abs(wn.x)>.72),kpWoodDefaultParams(),fp,length(p-u.eye.xyz));s=sample.surface;cavity=sample.cavity;spec=sample.specularLevel;coat=sample.clearcoat;coatRough=sample.clearcoatRoughness;}
 if(h.materialId==5u){s=KpSurface(0.,vec3<f32>(.65,.75,.72),.12);}
 if(h.materialId==6u){s=kpStoneSlateSurface(vec3<f32>(p.x,p.z,p.y),stoneParameters(h),d.x,.06,d.z,fp);}
 if(h.materialId==7u){s=kpClothCoarseSurface(h.q.xz,fp);spec=.6;}
 return MaterialResult(s,metal,cavity,spec,coat,coatRough);}
fn materialDistance(h:GeoHit,p:vec3<f32>)->SettlementField{var g=h;var d=h.d;
 if(h.materialId==1u){let state=fabricAt(h,p);let original=kpPlasterOriginalField(wallCoordinates(h,p),sourcePlasterParams(h,p),.00003);let remain=state.thicknessM*smoothstep(-.05,.08,state.retention);let coating=max(h.d+.0165-remain-original.surface.height,-state.retention*.018);let id=brickIdentity(h,p);var masonry=h.d+.0265;if(h.d<.025){masonry=min(masonry,kpBrickBaseDistance(brickCoordinate(h,p,h.d),id.x,i32(id.y),.42));}d=min(coating,masonry);if(masonry<coating){g.materialId=2u;}}
 else if(h.materialId==3u){let v=dna(h);d-=kpMetalSurface(vec3<f32>(h.q.x,p.y-v.w,h.q.z),v.x,.10,v.z,.00003).height;}
 else if(h.materialId==4u){let wp=kpWoodDefaultParams();let wn=woodNormal(h,h.n);let cls=select(0.,1.,abs(wn.x)>.72);let sample=kpWoodOriginalSample(h.q,wn,cls,wp,.00003,0.);d-=kpWoodMacroDisplacement(h.q,cls,wp)+sample.surface.height+(sample.parallaxHeight01-.5)*wp.parallaxM;}
 else if(h.materialId==7u){d-=kpClothCoarseSurface(h.q.xz,0.).height;}
 else if(h.materialId==6u){d-=kpStoneSlateSurface(vec3<f32>(p.x,p.z,p.y),stoneParameters(h),dna(h).x,.06,0.,.00003).height;}
 return SettlementField(d,g,0u);}
fn resolveSceneField(h:GeoHit,p:vec3<f32>)->SettlementField{var r=SettlementField(h.d-.036,h,0u);if(h.materialId>0u&&h.d<.04){r=materialDistance(h,p);}if(u.cut.w<500.){let cd=dot(p,u.cut.xyz)-u.cut.w;if(cd>r.d){r.d=cd;r.sectionCap=1u;if(r.geo.materialId==1u){r.geo.materialId=2u;}r.geo.n=u.cut.xyz;}let ground=GeoHit(p.y,6u,0u,0u,0u,p,vec3<f32>(0.,1.,0.),0u);var gd=p.y-.036;if(p.y<.04){gd=materialDistance(ground,p).d;}if(gd<r.d){r=SettlementField(gd,ground,0u);}}return r;}
fn sceneField(p:vec3<f32>)->SettlementField{return resolveSceneField(querySettlement(p,220.),p);}
fn raySceneField(p:vec3<f32>,rd:vec3<f32>)->SettlementField{return sceneField(p);}
`;
