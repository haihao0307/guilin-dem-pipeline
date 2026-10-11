import {MOTHER_WGSL,MATERIAL_DOMAIN_WGSL} from './materials.mjs';
// New whole-settlement receiver, retaining the proven GPU-only tiled execution,
// reachable-stage pruning and explicit hit/miss/exhausted semantics. No old room.
export function receiverWGSL(geometry){return String.raw`
struct Frame { eye:vec4<f32>,forward:vec4<f32>,right:vec4<f32>,up:vec4<f32>,cut:vec4<f32>,size:vec4<f32>,tile:vec4<u32>,controls:vec4<f32> }
@group(0) @binding(0) var<uniform> u:Frame;
${geometry}
${MOTHER_WGSL}
${MATERIAL_DOMAIN_WGSL}
struct Stats {hit:atomic<u32>,miss:atomic<u32>,exhausted:atomic<u32>,maximumSteps:atomic<u32>,retried:atomic<u32>,glassRays:atomic<u32>,boundOnly:atomic<u32>,reserved:atomic<u32>}
@group(0) @binding(2) var<storage,read_write> stats:Stats;
struct HitRecord { ray:vec4<f32>,local:vec4<f32>,ids:vec4<u32>,normal:vec4<f32>,glass:vec4<f32>,through:vec4<f32> }
@group(0) @binding(3) var<storage,read_write> hits:array<HitRecord,256>;
struct RetryQueue {count:atomic<u32>,indices:array<u32,256>}
@group(0) @binding(4) var<storage,read_write> retry:RetryQueue;
fn cameraRay(pixel:vec2<f32>)->vec3<f32>{let uv=(pixel/u.size.xy*2.-vec2<f32>(1.))*vec2<f32>(u.size.x/u.size.y,-1.);return normalize(u.forward.xyz+(u.right.xyz*uv.x+u.up.xyz*uv.y)*u.forward.w);}
fn footprint(p:vec3<f32>,n:vec3<f32>,rd:vec3<f32>)->f32{return max(.00005,length(p-u.eye.xyz)*2.*u.forward.w/u.size.y/max(.18,abs(dot(n,-rd))));}
fn packSample(f:SettlementField,t:f32,steps:u32,status:u32,glass:vec4<f32>,through:vec4<f32>)->HitRecord{return HitRecord(vec4<f32>(t,f.geo.d,f32(steps),f32(status)),vec4<f32>(f.geo.q,0.),vec4<u32>(f.geo.materialId,f.geo.buildingId,f.geo.componentId,f.geo.stateId),vec4<f32>(f.geo.n,f32(f.sectionCap)),glass,through);}
fn fromRecord(h:HitRecord)->GeoHit {var g:GeoHit;g.d=h.ray.y;g.materialId=h.ids.x;g.buildingId=h.ids.y;g.componentId=h.ids.z;g.stateId=h.ids.w;g.q=h.local.xyz;g.n=h.normal.xyz;return g;}
fn trace(ro:vec3<f32>,rd:vec3<f32>,startT:f32,startSteps:u32,budget:u32,oldGlass:vec4<f32>,oldThrough:vec4<f32>)->HitRecord{
 var t=startT;var prevT=t;var prevD=1e6;var glass=oldGlass;var through=oldThrough;var steps=startSteps;var f=sceneField(ro+rd*t);
 loop{if(steps>=budget){return packSample(f,t,steps,2u,glass,through);}if(t>220.){return packSample(f,t,steps,0u,glass,through);}f=sceneField(ro+rd*t);steps++;
  if(f.geo.materialId>0u){
   if(abs(f.d)<.00055||(f.d<0.&&prevD>0.&&prevD<1e5)){
    if(f.d<0.&&prevD>0.&&prevD<1e5){var lo=prevT;var hi=t;for(var j=0;j<7;j++){let mid=(lo+hi)*.5;let m=sceneField(ro+rd*mid);if(m.d>0.){lo=mid;}else{hi=mid;}}t=(lo+hi)*.5;f=sceneField(ro+rd*t);}
    if(f.geo.materialId==5u&&f.sectionCap==0u){if(glass.w<0.){glass=vec4<f32>(f.geo.n,.04+.96*pow(1.-abs(dot(-rd,f.geo.n)),5.));atomicAdd(&stats.glassRays,1u);}through=vec4<f32>(through.xyz*vec3<f32>(.88,.94,.92),through.w+1.);t+=.026/max(.07,abs(dot(rd,f.geo.n)));prevD=1e6;continue;}
    return packSample(f,t,steps,1u,glass,through);
   }
  }
  prevT=t;prevD=f.d;t+=clamp(abs(f.d)*.64,.00018,4.0);
 }
}
@compute @workgroup_size(8,8) fn primaryMain(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=u.tile.zw)){return;}let id=gid.y*16u+gid.x;let pixel=vec2<f32>(u.tile.xy+gid.xy)+vec2<f32>(.5);let rd=cameraRay(pixel);let h=trace(u.eye.xyz,rd,.01,0u,180u,vec4<f32>(0.,0.,0.,-1.),vec4<f32>(1.,1.,1.,0.));hits[id]=h;if(h.ray.w==2.){let slot=atomicAdd(&retry.count,1u);retry.indices[slot]=id;atomicAdd(&stats.retried,1u);}}
@compute @workgroup_size(64) fn resumeMain(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=atomicLoad(&retry.count)){return;}let id=retry.indices[gid.x];let old=hits[id];let pixel=vec2<f32>(u.tile.xy+vec2<u32>(id%16u,id/16u))+vec2<f32>(.5);hits[id]=trace(u.eye.xyz,cameraRay(pixel),old.ray.x,u32(old.ray.z),1024u,old.glass,old.through);}
@compute @workgroup_size(8,8) fn finalizeMain(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=u.tile.zw)){return;}let h=hits[gid.y*16u+gid.x];atomicMax(&stats.maximumSteps,u32(h.ray.z));if(h.ray.w==1.){atomicAdd(&stats.hit,1u);}else if(h.ray.w==0.){atomicAdd(&stats.miss,1u);}else{atomicAdd(&stats.exhausted,1u);}}
fn sky(rd:vec3<f32>)->vec3<f32>{return mix(vec3<f32>(.63,.65,.62),vec3<f32>(.19,.32,.43),smoothstep(-.15,.9,rd.y));}
fn fieldNormal(p:vec3<f32>,rd:vec3<f32>,baseN:vec3<f32>)->vec3<f32>{let e=clamp(footprint(p,baseN,rd)*.32,.00008,.035);let a=vec3<f32>(1,-1,-1);let b=vec3<f32>(-1,-1,1);let c=vec3<f32>(-1,1,-1);let d=vec3<f32>(1,1,1);return normalize(a*sceneField(p+a*e).d+b*sceneField(p+b*e).d+c*sceneField(p+c*e).d+d*sceneField(p+d*e).d);}
fn macroShadow(p:vec3<f32>,n:vec3<f32>,ld:vec3<f32>)->f32{
 var t=.045;var shade=1.;for(var i=0;i<64;i++){let q=p+n*.012+ld*t;let h=querySettlement(q,80.);var d=h.d;if(u.cut.w<500.){d=max(d,dot(q,u.cut.xyz)-u.cut.w);}if(h.materialId==5u){t+=.06;shade*=.94;continue;}if(d<.004&&h.materialId>0u){return .10;}shade=min(shade,8.*max(d,.002)/t);t+=clamp(abs(d)*.7,.025,2.5);if(t>65.){break;}}return clamp(shade,.10,1.);
}
fn shade(p:vec3<f32>,rd:vec3<f32>,h:GeoHit,cap:u32)->vec3<f32>{
 let n=select(fieldNormal(p,rd,h.n),normalize(u.cut.xyz),cap==1u);let fp=footprint(p,n,rd);let m=sceneMaterial(h,p,n,fp,cap);let ld=normalize(vec3<f32>(-3.,7.,-4.));let sh=macroShadow(p,n,ld);let nl=max(dot(n,ld),0.);let ndv=max(dot(n,-rd),.01);let halfV=normalize(ld-rd);let ndh=max(dot(n,halfV),0.);let vh=max(dot(-rd,halfV),0.);let rough=max(.09,m.surface.roughness);let alpha=rough*rough;let a2=alpha*alpha;let den=ndh*ndh*(a2-1.)+1.;let D=a2/max(3.14159265*den*den,.0001);let k=(rough+1.)*(rough+1.)/8.;let G=nl/(nl*(1.-k)+k)*ndv/(ndv*(1.-k)+k);let F0=mix(vec3<f32>(.04),m.surface.albedo,m.metal);let F=F0+(vec3<f32>(1.)-F0)*pow(1.-vh,5.);let spec=D*G*F/max(4.*nl*ndv,.001)*m.specular;
 let hemi=.22+.18*max(n.y,0.);let reflected=m.surface.albedo*(hemi+(1.-m.metal)*nl*sh*1.25)*m.cavity+spec*nl*sh*1.7;
 // Complete original wood sample channels are retained; no cloned shader override.
 let clear=m.coat*.04*pow(max(dot(reflect(-ld,n),-rd),0.),mix(100.,6.,m.coatRough))*sh;
 return reflected*(1.-m.coat*.04)+vec3<f32>(clear);
}
struct Frag { @location(0) color:vec4<f32>, @builtin(frag_depth) depth:f32 }
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{let a=array<vec2<f32>,3>(vec2<f32>(-1.,-1.),vec2<f32>(3.,-1.),vec2<f32>(-1.,3.));return vec4<f32>(a[i],0.,1.);}
@fragment fn fs(@builtin(position) pixel:vec4<f32>)->Frag{
 let localPixel=vec2<u32>(pixel.xy)-u.tile.xy;let r=hits[localPixel.y*16u+localPixel.x];let rd=cameraRay(pixel.xy);var c=sky(rd);var depth=1.;
 if(r.ray.w==2.){return Frag(vec4<f32>(1.,0.,1.,1.),.99999);}if(r.ray.w==1.){let p=u.eye.xyz+rd*r.ray.x;let g=fromRecord(r);c=shade(p,rd,g,u32(r.normal.w));let z=dot(p-u.eye.xyz,u.forward.xyz);depth=clamp(220./219.9-22./(219.9*max(z,.1)),0.,1.);if(u.controls.x==1.){c=g.n*.5+vec3<f32>(.5);}if(u.controls.x==2.){c=vec3<f32>(fract(f32(g.materialId)*.37),fract(f32(g.materialId)*.57),fract(f32(g.materialId)*.79));}}
 if(r.glass.w>=0.){c=mix(c*r.through.xyz,sky(reflect(rd,r.glass.xyz)),r.glass.w);}
 c=c/(vec3<f32>(1.)+c);return Frag(vec4<f32>(pow(max(c,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.),depth);
}
`}
