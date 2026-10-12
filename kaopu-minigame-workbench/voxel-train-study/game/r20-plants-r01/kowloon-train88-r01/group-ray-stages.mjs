import{extraction}from'./shader-closure.mjs';
import{RUNTIME_HEADER}from'./runtime-entries.mjs';
// Query staging changes execution only. Ray limits, hit epsilon, escape rule,
// native material ids, 1400-step limit, roof/floor advances all remain original.
const INIT=String.raw`
@fragment fn initializeGroupedRays(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let ray=hostRay(pixel.xy);let interval=stationRayInterval(ray[0],ray[1],hostRayLength(pixel.xy));
 if(interval.y<interval.x){return vec4<f32>(0.,0.,0.,2.);}return vec4<f32>(interval.x,0.,0.,0.);
}
`;
const ADVANCE_HEADER=String.raw`
@group(1)@binding(1)var fullFieldInput:texture_2d<f32>;
@group(1)@binding(2)var alternateFieldInput:texture_2d<f32>;
var<private>stationOtherDistance:f32;
`;
const ADVANCE=String.raw`
@fragment fn advanceGroupedRays(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let ij=vec2<i32>(pixel.xy);var tr=textureLoad(traceInput,ij,0);if(tr.w!=0.){return tr;}
 let a=textureLoad(fullFieldInput,ij,0);let ray=hostRay(pixel.xy);let ro=ray[0];let rd=ray[1];let p=ro+rd*tr.x;
 let h=HitField(a.x,u32(a.y),p,a.w,a.z,vec3<f32>(1.),0.);tr.y=f32(h.id);tr.z+=1.;
 if(h.id==999u||!all(abs(a)<vec4<f32>(1e30))){tr.w=3.;return tr;}let eps=clamp(tr.x*.000015,.00065,.004);
 if(h.id!=0u&&abs(h.d)<eps){tr.w=1.;return tr;}
 let alternate=textureLoad(alternateFieldInput,ij,0);if(alternate.y==999.||!all(abs(alternate)<vec4<f32>(1e30))){tr.w=3.;return tr;}stationOtherDistance=alternate.x;
 tr.x+=max(max(max(abs(h.d)*.60,barrelAdvance(p,rd,h)),floorAdvance(p,rd,h)),.00018);
 let interval=stationRayInterval(ro,rd,hostRayLength(pixel.xy));
 if(tr.x>interval.y){tr.w=2.;return tr;}if(tr.z>=frame.controls.z){tr.w=3.;}return tr;
}
`;
const PACK=String.raw`
struct GroupNormalControl{axisAndStep:vec4<f32>,}
@group(0)@binding(2)var<uniform>normalControl:GroupNormalControl;
@group(1)@binding(1)var groupHitA:texture_2d<f32>;
@group(1)@binding(2)var groupHitB:texture_2d<f32>;
@group(1)@binding(3)var groupHitC:texture_2d<f32>;
@group(1)@binding(4)var previousQ:texture_2d<f32>;
@group(1)@binding(5)var previousExtent:texture_2d<f32>;
@group(1)@binding(6)var previousNormal:texture_2d<f32>;
@group(1)@binding(7)var previousError:texture_2d<f32>;
struct GroupGeometryRecord{@location(0)qSeed:vec4<f32>,@location(1)extentSource:vec4<f32>,@location(2)normalBase:vec4<f32>,@location(3)error:vec4<f32>,}
@fragment fn packGroupedGeometry(@builtin(position)pixel:vec4<f32>)->GroupGeometryRecord{
 let ij=vec2<i32>(pixel.xy);let tr=textureLoad(traceInput,ij,0);
 if(tr.w!=1.){return GroupGeometryRecord(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.));}
 let a=textureLoad(groupHitA,ij,0);var error=select(0.,1.,a.y==999.||!all(abs(a)<vec4<f32>(1e30)));
 if(normalControl.axisAndStep.w<.5){let b=textureLoad(groupHitB,ij,0);let c=textureLoad(groupHitC,ij,0);error=max(error,select(0.,1.,a.y!=tr.y||!all(abs(b)<vec4<f32>(1e30))||!all(abs(c)<vec4<f32>(1e30))));return GroupGeometryRecord(vec4<f32>(b.xyz,a.w),vec4<f32>(c.xyz,b.w),vec4<f32>(0.,0.,0.,a.z),vec4<f32>(error,0.,0.,0.));}
 error=max(error,textureLoad(previousError,ij,0).x);
 let n=textureLoad(previousNormal,ij,0);var gradient=n.xyz+normalControl.axisAndStep.xyz*a.x;
 if(normalControl.axisAndStep.w>3.5){if(!all(abs(gradient)<vec3<f32>(1e30))||dot(gradient,gradient)<=0.){error=1.;gradient=vec3<f32>(0.,1.,0.);}else{gradient=normalize(gradient);}}
 return GroupGeometryRecord(textureLoad(previousQ,ij,0),textureLoad(previousExtent,ij,0),vec4<f32>(gradient,n.w),vec4<f32>(error,0.,0.,0.));
}
`;
export function createGroupedRayStages(source){
 const original=extraction(source),header=original.header+RUNTIME_HEADER;
 // Only substitute the two nested full-domain queries with the exact staged
 // results at this same point/state. The actual analytic guards are unchanged.
 const noQueries=source.replace('stationDomain(p,true,false).d','stationOtherDistance').replace('stationDomain(p,false,true).d','stationOtherDistance');
 if(noQueries===source)throw Error('Original alternate-union acceleration calls absent');
 const selected=extraction(noQueries),advanceBody=selected.closure(['barrelAdvance','floorAdvance']);
 if(/fn stationDomain\(/.test(advanceBody))throw Error('Advance must not inline complete geometry');
 return{
  'group-init':{entry:'initializeGroupedRays',source:header+original.closure([],INIT)+INIT},
  'group-advance':{entry:'advanceGroupedRays',source:header+ADVANCE_HEADER+advanceBody+ADVANCE},
  'group-normal-pack':{entry:'packGroupedGeometry',source:header+original.closure([],PACK)+PACK},
 };
}
