import{STATION_RAY_BOUNDS}from'./field-coverage.mjs';
const rayBoundVector=a=>'vec3<f32>('+a.map(x=>Number.isInteger(x)?x+'.':String(x)).join(',')+')';
import{PIXEL_FOOTPRINT_WGSL}from'./pixel-footprint.mjs';
// Raster staging stores only current-frame ray/HitField values. None of these
// attachments is a surface map, baked appearance, mesh or persistent world grid.
export const RUNTIME_HEADER=String.raw`
struct HostFrame{inverseProjection:mat4x4<f32>,cameraToLocal:mat4x4<f32>,localToClip:mat4x4<f32>,viewport:vec4<f32>,controls:vec4<f32>,}
@group(0)@binding(1)var<uniform>frame:HostFrame;
@group(1)@binding(0)var traceInput:texture_2d<f32>;
fn localPoint(v:vec4<f32>)->vec3<f32>{let p=frame.cameraToLocal*frame.inverseProjection*v;return p.xyz/p.w;}
fn hostRay(pixel:vec2<f32>)->mat2x3<f32>{var ndc=pixel/frame.viewport.xy*2.-vec2<f32>(1.);if(frame.viewport.z>.5){ndc.y=-ndc.y;}let a=localPoint(vec4<f32>(ndc,-1.,1.));let b=localPoint(vec4<f32>(ndc,1.,1.));return mat2x3<f32>(a,normalize(b-a));}
// Closed envelope for every authored station solid, including rail approaches.
// Harbour plane/sky/retained host streets are NOT stationField solids.
// Shared source-derived coverage includes the 84m pier end and -3.47m piles.
// Envelope margins exceed every proven material displacement; no ingredient is omitted.
${PIXEL_FOOTPRINT_WGSL}
fn stationRayInterval(ro:vec3<f32>,rd:vec3<f32>)->vec2<f32>{
 let lo=${rayBoundVector(STATION_RAY_BOUNDS.lo)};let hi=${rayBoundVector(STATION_RAY_BOUNDS.hi)};var near=0.;var far=frame.controls.y;
 for(var axis=0u;axis<3u;axis++){if(abs(rd[axis])<.0000001){if(ro[axis]<lo[axis]||ro[axis]>hi[axis]){return vec2<f32>(1.,-1.);}}else{let a=(lo[axis]-ro[axis])/rd[axis];let b=(hi[axis]-ro[axis])/rd[axis];near=max(near,min(a,b));far=min(far,max(a,b));}}
 return vec2<f32>(near,far);
}
`;
export const STEP_ENTRY=String.raw`
@fragment fn stepRays(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 // Terminal rays need no camera transform, box query, construction or mother work.
 if(frame.controls.x<.5){let previous=textureLoad(traceInput,vec2<i32>(pixel.xy),0);if(previous.w!=0.){return previous;}}
 let ray=hostRay(pixel.xy);let ro=ray[0];let rd=ray[1];let interval=stationRayInterval(ro,rd);if(interval.y<interval.x){return vec4<f32>(0.,0.,0.,2.);}var tr=vec4<f32>(interval.x,0.,0.,0.);
 if(frame.controls.x<.5){tr=textureLoad(traceInput,vec2<i32>(pixel.xy),0);}
 // tr=(metric ray distance, material id, query count, status). 0=active,
 // 1=actual hit, 2=escaped/miss, 3=budget unresolved. Bounds never hit.
 if(tr.w!=0.){return tr;}
 for(var i=0u;i<u32(frame.viewport.w);i++){
  let p=ro+rd*tr.x;let h=stationField(p);tr.y=f32(h.id);tr.z+=1.;
  if(h.id==999u){tr.w=3.;break;}let eps=clamp(tr.x*.000015,.00065,.004);
  if(h.id!=0u&&abs(h.d)<eps){tr.w=1.;break;}
  tr.x+=max(max(max(abs(h.d)*.60,barrelAdvance(p,rd,h)),floorAdvance(p,rd,h)),.00018);
  if(tr.x>interval.y){tr.w=2.;break;}
  if(tr.z>=frame.controls.z){tr.w=3.;break;}
 }
 return tr;
}
`;
export const NORMAL_ENTRY=String.raw`
struct GeometryRecord{@location(0)qSeed:vec4<f32>,@location(1)extentSource:vec4<f32>,@location(2)normalBase:vec4<f32>,}
@fragment fn recordGeometry(@builtin(position)pixel:vec4<f32>)->GeometryRecord{
 let tr=textureLoad(traceInput,vec2<i32>(pixel.xy),0);if(tr.w!=1.){return GeometryRecord(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.));}
 let ray=hostRay(pixel.xy);let p=ray[0]+ray[1]*tr.x;var center=HitField(0.,0u,p,0.,0.,vec3<f32>(1.),0.);var gradient=vec3<f32>(0.);
 let axes=array<vec3<f32>,5>(vec3<f32>(0.),vec3<f32>(1.,-1.,-1.),vec3<f32>(-1.,-1.,1.),vec3<f32>(-1.,1.,-1.),vec3<f32>(1.,1.,1.));
 for(var i=0u;i<5u;i++){let h=stationField(p+axes[i]*.00045);if(i==0u){center=h;}else{gradient+=axes[i]*h.d;}}
 return GeometryRecord(vec4<f32>(center.q,center.seed),vec4<f32>(center.extent,center.sourceSeed),vec4<f32>(normalize(gradient),center.baseD));
}
`;
export const MATTER_HEADER=String.raw`
@group(1)@binding(1)var qSeedInput:texture_2d<f32>;
@group(1)@binding(2)var extentInput:texture_2d<f32>;
@group(1)@binding(3)var normalInput:texture_2d<f32>;
`;
export const MATTER_ENTRY=String.raw`
struct MatterRecord{@location(0)albedoRoughness:vec4<f32>,@location(1)response:vec4<f32>,@location(2)finish:vec4<f32>,}
@fragment fn recordMatter(@builtin(position)pixel:vec4<f32>)->MatterRecord{
 let ij=vec2<i32>(pixel.xy);let tr=textureLoad(traceInput,ij,0);if(tr.w!=1.){return MatterRecord(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.));}
 let a=textureLoad(qSeedInput,ij,0);let b=textureLoad(extentInput,ij,0);let c=textureLoad(normalInput,ij,0);let ray=hostRay(pixel.xy);let p=ray[0]+ray[1]*tr.x;
 let h=HitField(c.w,u32(tr.y),a.xyz,a.w,c.w,b.xyz,b.w);let differential=hostSurfaceDifferentials(pixel.xy,p,c.xyz);let fp=max(.00001,max(length(differential[0]),length(differential[1])));let m=evaluateStationMatter(h,p,c.xyz,fp);
 var albedo=m.surface.albedo;var rough=m.surface.roughness;

 return MatterRecord(vec4<f32>(albedo,rough),vec4<f32>(m.metal,m.cavity,m.specular,m.microHeight),vec4<f32>(m.clearcoat,m.clearcoatRoughness,m.parallaxHeight01,stationLampEmission(h)));
}
`;
