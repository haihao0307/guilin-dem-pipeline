/** QA-only independent execution strategy: same scalar primitive expressions,
 * no building/bridge/flight bound early returns, all floors, no 1m distance cap.
 * Not imported by the runtime or used to draw a different world.
 */
function exact(source,from,to,n=1){const parts=source.split(from);if(parts.length-1!==n)throw Error(`Reference guard count changed: ${from.slice(0,44)}`);return parts.join(to);}
export function withoutAcceleration(source){
 let s=exact(source,'if(bb>h.d){return h;}','',2);
 s=exact(s,'if(bb>0.30){return geo_take(h,bb,0u,bid,0u,0u,vec3f(u,y,v),vec3f(0.0,1.0,0.0));}','');
 s=exact(s,'if(bb>0.30){return geo_take(h,bb,0u,bid,0u,sid,vec3f(t,y,w),vec3f(0.0,1.0,0.0));}','');
 s=exact(s,'if(env>h.d){return h;}','');
 s=exact(s,'var first=max(0,f0-1);var last=min(i32(b.z)-1,f0+1);','var first=0;var last=i32(b.z)-1;');
 return exact(s,'if(h.d>1.0){return geo_empty(1.0);}return h;','return h;');
}
export const BOUND_DIAGNOSTIC_WGSL=String.raw`
@group(0) @binding(0) var<storage,read> probePoints:array<vec4f>;
@group(0) @binding(2) var<storage,read_write> probeAnswers:array<vec4f>;
fn sourceBuildingBound(p:vec3f,bi:i32)->f32{
 let off=i32(geo_get(1).x)+bi*8;let a=geo_get(off);let b=geo_get(off+1);let c=geo_get(off+2);
 let u=a.z*.5-(p.x-a.x)*c.x;let v=a.w*.5-(p.z-a.y)*c.y;let top=b.w;
 return geo_box(u-a.z*.5,p.y-top*.5-.45,v-a.w*.5,a.z*.5+1.05,top*.5+.70,a.w*.5+1.05);
}
@compute @workgroup_size(32) fn macroProbe(@builtin(global_invocation_id) gid:vec3u){
 let i=gid.x;if(i>=arrayLength(&probePoints)){return;}let p=probePoints[i].xyz;let h=querySettlement(p,600.);
 var kind=0.;var index=-1.;var d=0.;
 if(h.materialId==0u&&h.componentId==0u){
  if(h.buildingId>0u&&h.stateId==0u){kind=1.;index=f32(h.buildingId)-1.;d=sourceBuildingBound(p,i32(index));}
  else if(h.buildingId==0u&&h.stateId==0u&&h.d==1.){kind=3.;d=1.;}
  else{kind=9.;}
 }
 probeAnswers[i*2u]=vec4f(h.d,f32(h.materialId),f32(h.buildingId),f32(h.componentId));
 probeAnswers[i*2u+1u]=vec4f(f32(h.stateId),kind,index,d);
}
`;
