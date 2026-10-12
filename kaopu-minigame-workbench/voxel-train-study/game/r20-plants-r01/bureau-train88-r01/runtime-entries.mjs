import{PIXEL_FOOTPRINT_WGSL}from'./pixel-footprint.mjs';
export const RUNTIME_HEADER=String.raw`
struct HostFrame{inverseProjection:mat4x4<f32>,cameraToLocal:mat4x4<f32>,localToClip:mat4x4<f32>,viewport:vec4<f32>,controls:vec4<f32>,}
@group(0)@binding(1)var<uniform>frame:HostFrame;
@group(1)@binding(0)var traceInput:texture_2d<f32>;
fn localPoint(v:vec4<f32>)->vec3<f32>{let p=frame.cameraToLocal*frame.inverseProjection*v;return p.xyz/p.w;}
fn hostRay(pixel:vec2<f32>)->mat2x3<f32>{var ndc=pixel/frame.viewport.xy*2.-vec2<f32>(1.);if(frame.viewport.z>.5){ndc.y=-ndc.y;}let a=localPoint(vec4<f32>(ndc,-1.,1.));let b=localPoint(vec4<f32>(ndc,1.,1.));return mat2x3<f32>(a,normalize(b-a));}
${PIXEL_FOOTPRINT_WGSL}
fn hostRayLength(pixel:vec2<f32>)->f32{var ndc=pixel/frame.viewport.xy*2.-vec2<f32>(1.);if(frame.viewport.z>.5){ndc.y=-ndc.y;}return length(localPoint(vec4<f32>(ndc,1.,1.))-localPoint(vec4<f32>(ndc,-1.,1.)));}
fn bureauRayInterval(ro:vec3<f32>,rd:vec3<f32>,rayMax:f32)->vec2<f32>{let lo=vec3<f32>(-91.,-.70,-76.);let hi=vec3<f32>(91.,32.,76.);var near=0.;var far=rayMax;for(var axis=0u;axis<3u;axis++){if(abs(rd[axis])<.0000001){if(ro[axis]<lo[axis]||ro[axis]>hi[axis]){return vec2<f32>(1.,-1.);}}else{let a=(lo[axis]-ro[axis])/rd[axis];let b=(hi[axis]-ro[axis])/rd[axis];near=max(near,min(a,b));far=min(far,max(a,b));}}return vec2<f32>(near,far);}
`;
export const STEP_ENTRY=String.raw`
@fragment fn stepRays(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 if(frame.controls.x<.5){let previous=textureLoad(traceInput,vec2<i32>(pixel.xy),0);if(previous.w!=0.){return previous;}}
 let ray=hostRay(pixel.xy);let ro=ray[0];let rd=ray[1];let interval=bureauRayInterval(ro,rd,hostRayLength(pixel.xy));if(interval.y<interval.x){return vec4<f32>(0.,0.,0.,2.);}var tr=vec4<f32>(interval.x,0.,0.,0.);if(frame.controls.x<.5){tr=textureLoad(traceInput,vec2<i32>(pixel.xy),0);}
 for(var i=0u;i<u32(frame.viewport.w);i++){let h=sceneField(ro+rd*tr.x);tr.y=f32(h.mat);tr.z+=1.;let eps=clamp(tr.x*.000015,.00065,.004);if(h.mat==8u&&frame.controls.w>.5){tr.x+=max(.025,abs(h.d));if(tr.x>interval.y){tr.w=2.;break;}if(tr.z>=frame.controls.z){tr.w=3.;break;}continue;}if(h.mat!=0u&&abs(h.d)<eps){tr.w=1.;break;}tr.x+=max(abs(h.d)*.76,.00018);if(tr.x>interval.y){tr.w=2.;break;}if(tr.z>=frame.controls.z){tr.w=3.;break;}}
 return tr;
}
`;
export const GLASS_ENTRY=String.raw`
@fragment fn transmitGlass(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let tr=textureLoad(traceInput,vec2<i32>(pixel.xy),0);if(tr.w!=1.||tr.y!=8.){return vec4<f32>(tr.x,tr.y,0.,tr.w);}let ray=hostRay(pixel.xy);let g=throughGlass(ray[0],ray[1],Hit(tr.x,1u,u32(tr.z),8u));if(g.distance>hostRayLength(pixel.xy)){return vec4<f32>(g.distance,0.,g.depth,2.);}var mat=0.;if(g.status==1u){mat=f32(sceneField(ray[0]+ray[1]*g.distance).mat);}return vec4<f32>(g.distance,mat,g.depth,select(select(3.,2.,g.status==0u),1.,g.status==1u));}
`;
export const GEOMETRY_HEADER='@group(1)@binding(1)var transmissionInput:texture_2d<f32>;\n';
export const NORMAL_ENTRY=String.raw`
struct GeometryRecord{@location(0)positionDistance:vec4<f32>,@location(1)glassNormalDepth:vec4<f32>,@location(2)normalMaterial:vec4<f32>,}
@fragment fn recordGeometry(@builtin(position)pixel:vec4<f32>)->GeometryRecord{let ij=vec2<i32>(pixel.xy);let tr=textureLoad(traceInput,ij,0);let g=textureLoad(transmissionInput,ij,0);if(tr.w!=1.){return GeometryRecord(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.));}let ray=hostRay(pixel.xy);let p=ray[0]+ray[1]*g.x;var gradient=vec3<f32>(0.);var glass=vec3<f32>(0.);let axes=array<vec3<f32>,4>(vec3<f32>(1.,-1.,-1.),vec3<f32>(-1.,-1.,1.),vec3<f32>(-1.,1.,-1.),vec3<f32>(1.,1.,1.));for(var i=0u;i<4u;i++){if(g.w==1.){gradient+=axes[i]*sceneField(p+axes[i]*.002).d;}if(tr.y==8.){glass+=axes[i]*sceneField(ray[0]+ray[1]*tr.x+axes[i]*.002).d;}}return GeometryRecord(vec4<f32>(p,select(-1.,g.x,g.w==1.)),vec4<f32>(normalize(glass+vec3<f32>(0.,.00000001,0.)),g.z),vec4<f32>(normalize(gradient+vec3<f32>(0.,.00000001,0.)),g.y));}
`;
export const MATTER_HEADER=String.raw`
@group(1)@binding(1)var positionInput:texture_2d<f32>;
@group(1)@binding(2)var glassInput:texture_2d<f32>;
@group(1)@binding(3)var normalInput:texture_2d<f32>;
`;
export const MATTER_ENTRY=String.raw`
struct MatterRecord{@location(0)albedoRoughness:vec4<f32>,@location(1)response:vec4<f32>,@location(2)finish:vec4<f32>,@location(3)materialNormal:vec4<f32>,}
@fragment fn recordMatter(@builtin(position)pixel:vec4<f32>)->MatterRecord{let ij=vec2<i32>(pixel.xy);let tr=textureLoad(traceInput,ij,0);if(tr.w!=1.||textureLoad(positionInput,ij,0).w<0.){return MatterRecord(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.));}let p=textureLoad(positionInput,ij,0).xyz;let n=textureLoad(normalInput,ij,0).xyz;let f=sceneField(p);let differential=hostSurfaceDifferentials(pixel.xy,p,n);let fp=max(.0003,max(length(differential[0]),length(differential[1])));let tfp=componentFootprint(f,fp,differential[0],differential[1]);let r=receiverResponse(f,p,n,tfp,differential[0],differential[1]);let mn=materialNormal(f,p,n,tfp);let m=resolvedWeather(f,p,mn,r.surface);let emission=select(select(0.,1.8,f.mat==11u),2.4,f.mat==17u);return MatterRecord(vec4<f32>(m.albedo,m.roughness),vec4<f32>(select(0.,1.,f.mat==5u||f.mat==9u),r.cavity,r.specularLevel,m.height),vec4<f32>(r.clearcoat,r.clearcoatRoughness,r.parallaxHeight01,emission),vec4<f32>(mn,0.));}
`;
