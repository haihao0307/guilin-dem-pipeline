// Execution-only split: original geometry and material functions remain authoritative.
// Each query record continues the SAME point/camera snapshot across GPU dispatches.
export const WAVEFRONT_WGSL=String.raw`
struct FieldContext {
 point:vec4<f32>,march:vec4<f32>,bracket:vec4<f32>,
 best:GeoHit,bestMeta:vec4<f32>,pending:GeoHit,
 excluded:array<vec2<u32>,32>,counts:vec4<u32>,
 glass:vec4<f32>,through:vec4<f32>,padding:vec4<f32>
}
// 512B per temporary query; 256 primary rays or 1024 normal sample points.
@group(0) @binding(8) var<storage,read_write> contexts:array<FieldContext,1024>;
fn vacantGeo(p:vec3<f32>)->GeoHit{return GeoHit(220.,0u,0u,0u,0u,p,vec3<f32>(0.,1.,0.),0u);}
fn resetPoint(c0:FieldContext,p:vec3<f32>)->FieldContext{var c=c0;c.point=vec4<f32>(p,c.point.w);c.best=vacantGeo(p);c.bestMeta=vec4<f32>(220.,0.,0.,0.);c.counts.x=0u;c.counts.y=1u;c.counts.z=0u;return c;}
@compute @workgroup_size(64) fn initializePrimary(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x;if(id>=256u){return;}var c:FieldContext;c.counts=vec4<u32>(0u);c.point.w=1.;
 if(id%16u<u.tile.z&&id/16u<u.tile.w){let pixel=vec2<f32>(u.tile.xy+vec2<u32>(id%16u,id/16u))+vec2<f32>(.5);let rd=cameraRay(pixel);c.march=vec4<f32>(.01,.01,1e6,0.);c.bracket=vec4<f32>(0.);c.glass=vec4<f32>(0.,0.,0.,-1.);c.through=vec4<f32>(1.,1.,1.,0.);c=resetPoint(c,u.eye.xyz+rd*.01);}
 contexts[id]=c;
}
@compute @workgroup_size(64) fn initializeNormals(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x;if(id>=1024u){return;}let pixelId=id/4u;let axis=id%4u;var c:FieldContext;c.counts=vec4<u32>(0u);c.point.w=2.;normalSamples[id]=0.;let h=hits[pixelId];
 if(pixelId%16u<u.tile.z&&pixelId/16u<u.tile.w&&h.ray.w==1.&&h.normal.w==0.){let pixel=vec2<f32>(u.tile.xy+vec2<u32>(pixelId%16u,pixelId/16u))+vec2<f32>(.5);let rd=cameraRay(pixel);let p=u.eye.xyz+rd*h.ray.x;let ep=clamp(footprint(p,h.normal.xyz,rd)*.32,.00008,.035);c=resetPoint(c,p+normalDirection(axis)*ep);}
 contexts[id]=c;
}
@compute @workgroup_size(64) fn queryCandidate(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x;if(id>=1024u){return;}var c=contexts[id];if(c.counts.y==0u){return;}
 fieldCompetition=true;fieldExcludedCount=c.counts.x;for(var j=0u;j<fieldExcludedCount;j++){fieldExcluded[j]=c.excluded[j];}
 // ONLY the geometry closure is reachable from this entry point.
 let h=querySettlement(c.point.xyz,220.);fieldCompetition=false;c.pending=h;
 let lower=h.d-MATERIAL_DISTANCE_BOUND;
 if(lower>=c.bestMeta.x){c.counts.z=2u;}
 else if(h.materialId==0u||h.d>.04){c.pending.d=lower;c.pending.materialId=0u;c.counts.z=3u;}
 else{c.counts.z=1u;}
 contexts[id]=c;
}
fn consumeField(c0:FieldContext,f:SettlementField,id:u32)->FieldContext{
 var c=c0;let invalid=f.geo.componentId==4294967295u;
 if(invalid){atomicAdd(&stats.candidateOverflows,1u);}
 if(c.point.w==2.){normalSamples[id]=f.d;c.counts.y=0u;return c;}
 var t=c.march.x;var steps=u32(c.march.w)+1u;c.march.w=f32(steps);
 if(steps==180u){atomicAdd(&stats.retried,1u);}if(steps==1024u){atomicAdd(&stats.extendedPrimary,1u);}
 if(invalid){hits[id]=packSample(f,t,steps,2u,c.glass,c.through);c.counts.y=0u;return c;}
 let pixel=vec2<f32>(u.tile.xy+vec2<u32>(id%16u,id/16u))+vec2<f32>(.5);let rd=cameraRay(pixel);var accept=false;var refining=false;
 if(c.bracket.z>0.){if(c.bracket.z==1.){c.bracket.z=0.;accept=true;}else{if(f.d>0.){c.bracket.x=t;}else{c.bracket.y=t;}c.bracket.z-=1.;t=(c.bracket.x+c.bracket.y)*.5;refining=true;}}
 else if(f.geo.materialId>0u){if(f.d<0.&&c.march.z>0.&&c.march.z<1e5){c.bracket=vec4<f32>(c.march.y,t,8.,0.);t=(c.bracket.x+c.bracket.y)*.5;refining=true;}else if(abs(f.d)<.00055){accept=true;}}
 if(accept&&f.geo.materialId>0u){
  if(f.geo.materialId==5u&&f.sectionCap==0u){if(c.glass.w<0.){c.glass=vec4<f32>(f.geo.n,.04+.96*pow(1.-abs(dot(-rd,f.geo.n)),5.));atomicAdd(&stats.glassRays,1u);}c.through=vec4<f32>(c.through.xyz*vec3<f32>(.88,.94,.92),c.through.w+1.);t+=.026/max(.07,abs(dot(rd,f.geo.n)));c.march.z=1e6;}
  else{hits[id]=packSample(f,t,steps,1u,c.glass,c.through);c.counts.y=0u;return c;}
 }else if(!refining){c.march.y=t;c.march.z=f.d;t+=clamp(abs(f.d)*.64,.00018,4.0);}
 c.march.x=t;
 if(t>220.){hits[id]=packSample(f,t,steps,0u,c.glass,c.through);c.counts.y=0u;return c;}
 if(steps>=max(4096u,min(8192u,u32(u.controls.w)))&&c.bracket.z==0.){hits[id]=packSample(f,t,steps,2u,c.glass,c.through);c.counts.y=0u;return c;}
 return resetPoint(c,u.eye.xyz+rd*t);
}
@compute @workgroup_size(64) fn resolveCandidate(@builtin(global_invocation_id) gid:vec3<u32>){
 let id=gid.x;if(id>=1024u){return;}var c=contexts[id];if(c.counts.y==0u){return;}var result=SettlementField(c.bestMeta.x,c.best,u32(c.bestMeta.y));var finished=false;
 if(c.counts.z==2u){finished=true;}
 else if(c.counts.z==3u){result=SettlementField(c.pending.d,c.pending,0u);finished=true;}
 else if(c.counts.z==1u){
  // ONLY the original material closure is reachable here; no geometry call tree.
  var f=materialDistance(c.pending,c.point.xyz);
  if(u.cut.w<500.&&c.pending.stateId!=0u){let cd=dot(c.point.xyz,u.cut.xyz)-u.cut.w;if(cd>f.d){f.d=cd;f.sectionCap=1u;if(f.geo.materialId==1u){f.geo.materialId=2u;}f.geo.n=u.cut.xyz;}}
  if(f.d<c.bestMeta.x){c.best=f.geo;c.bestMeta=vec4<f32>(f.d,f32(f.sectionCap),0.,0.);}
  c.excluded[c.counts.x]=vec2<u32>(c.pending.stateId,c.pending.componentId);c.counts.x++;
  if(c.counts.x>=32u){result=SettlementField(0.,c.best,0u);result.geo.componentId=4294967295u;finished=true;}
 }
 if(finished){c=consumeField(c,result,id);}contexts[id]=c;
}
@compute @workgroup_size(64) fn countActive(@builtin(global_invocation_id) gid:vec3<u32>){let id=gid.x;if(id<1024u&&contexts[id].counts.y!=0u){atomicAdd(&stats.activeQueries,1u);}}
`;
