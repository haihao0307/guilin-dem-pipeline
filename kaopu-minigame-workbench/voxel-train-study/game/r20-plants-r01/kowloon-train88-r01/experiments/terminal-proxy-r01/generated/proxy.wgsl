// Generated isolated g0 light program. Input SHA256: fa540676720626a10de4d1329b3b17aa240ede0e2e51414afc9bf164583801c2
// Discard leaves stencil0; a separate unchanged original g0 program handles it.
// This does not claim that a branch inside the heavy program makes it cheaper.
struct Params{eye:vec3<f32>,age:f32,forward:vec3<f32>,fov:f32,right:vec3<f32>,aspect:f32,up:vec3<f32>,debug:f32,resolution:vec2<f32>,pad:vec2<f32>}
struct HostFrame{inverseProjection:mat4x4<f32>,cameraToLocal:mat4x4<f32>,localToClip:mat4x4<f32>,viewport:vec4<f32>,controls:vec4<f32>,}
struct GroupQueryControl {offsetAndPhase:vec4<f32>,options:vec4<f32>,}
@group(0)@binding(0)var<uniform>u:Params;
@group(0)@binding(1)var<uniform>frame:HostFrame;
@group(0) @binding(2) var<uniform> groupQueryControl:GroupQueryControl;
@group(1)@binding(0)var traceInput:texture_2d<f32>;
@group(1) @binding(5) var fullHitA:texture_2d<f32>;
fn localPoint(v:vec4<f32>)->vec3<f32>{let p=frame.cameraToLocal*frame.inverseProjection*v;return p.xyz/p.w;}
fn hostRay(pixel:vec2<f32>)->mat2x3<f32>{var ndc=pixel/frame.viewport.xy*2.-vec2<f32>(1.);if(frame.viewport.z>.5){ndc.y=-ndc.y;}let a=localPoint(vec4<f32>(ndc,-1.,1.));let b=localPoint(vec4<f32>(ndc,1.,1.));return mat2x3<f32>(a,normalize(b-a));}
fn box(p:vec3<f32>,b:vec3<f32>)->f32{let q=abs(p)-b;return length(max(q,vec3<f32>(0.)))+min(max(q.x,max(q.y,q.z)),0.);}
fn mergeCompactTrace(previous:vec4<f32>,a:vec4<f32>,raw:f32,localOverflow:bool)->vec4<f32>{
 var merged=previous;let rawCount=previous.z+raw;
 let overflow=(u32(previous.w)&1u)!=0u||localOverflow||rawCount>96.;
 if(a.x<merged.x){merged.x=a.x;merged.y=a.y;merged.w=select(0.,2.,!all(abs(a)<vec4<f32>(1e30)));}
 merged.z=rawCount;if(overflow){return vec4<f32>(0.,999.,rawCount,1.);}return merged;
}
fn terminalProxyFinite(value:f32)->bool{return (bitcast<u32>(value)&0x7f800000u)!=0x7f800000u;}
fn terminalProxyFinite3(value:vec3<f32>)->bool{return terminalProxyFinite(value.x)&&terminalProxyFinite(value.y)&&terminalProxyFinite(value.z);}
fn terminalProxyFinite4(value:vec4<f32>)->bool{return terminalProxyFinite3(value.xyz)&&terminalProxyFinite(value.w);}
@fragment fn stationTerminalProxy(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{
 let ij=vec2<i32>(pixel.xy);let trace=textureLoad(traceInput,ij,0);
 let ray=hostRay(pixel.xy);let p=ray[0]+ray[1]*trace.x+groupQueryControl.offsetAndPhase.xyz;
 var merged=vec4<f32>(10000.,0.,0.,0.);
 let phase=groupQueryControl.offsetAndPhase.w;
 if(!terminalProxyFinite4(trace)||!terminalProxyFinite3(ray[0])||!terminalProxyFinite3(ray[1])||!terminalProxyFinite3(p)||!terminalProxyFinite4(groupQueryControl.offsetAndPhase)||!terminalProxyFinite4(groupQueryControl.options)){discard;}
 if((phase!=0.&&phase!=1.)||(trace.w!=0.&&trace.w!=1.&&trace.w!=2.&&trace.w!=3.)||(groupQueryControl.options.x!=0.&&groupQueryControl.options.x!=1.&&groupQueryControl.options.x!=2.&&groupQueryControl.options.x!=3.)){discard;}
 if((phase==0.&&trace.w!=0.)||(phase==1.&&trace.w!=1.)){return merged;}
 let mode=groupQueryControl.options.x;var skipRoof=mode==1.;var skipFloor=mode==2.;
 if(mode==3.){let full=textureLoad(fullHitA,ij,0);if(!terminalProxyFinite4(full)){discard;}skipRoof=full.y==15.;skipFloor=full.y==17.;if(!skipRoof&&!skipFloor){return merged;}}
 let terminalEnvelope=box(p-vec3<f32>(-5.100000000000001,7.401409219306774,-0.46752835745067056),vec3<f32>(38.53001,7.9814192193067734,9.56248164254933));
 if(!terminalProxyFinite(terminalEnvelope)){discard;}
 if(terminalEnvelope<.15){discard;}
 // recordPart(id0) increments rawCount once. id0 is non-native; no material
 // displacement is applied. The original strict winner retains10000 at ties.
 var d=10000.;if(terminalEnvelope<d){d=terminalEnvelope;}
 return mergeCompactTrace(merged,vec4<f32>(d,0.,d,0.),1.,false);
}
