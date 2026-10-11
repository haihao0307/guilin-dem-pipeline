/** Native WebGPU implicit surface receiver derived from the existing R02.7
 * three-vertex WGSL entry/trace organization. No Three/WebGL fallback. */
export function receiverWGSL(fields,domain){return String.raw`
struct Params { ro:vec3<f32>,age:f32,fw:vec3<f32>,wetness:f32,rt:vec3<f32>,microscope:f32,up:vec3<f32>,aspect:f32,resolution:vec2<f32>,debug:u32,clothLocalBudget:u32,stoneFloor:vec4<f32>,stoneFrame:vec4<f32>,tileOrigin:vec2<u32>,tileExtent:vec2<u32>,clothFilter:u32, };
@group(0) @binding(0) var<uniform> u:Params;
fn receiverFootprint(p:vec3<f32>)->f32{return max(.00001,length(p-u.ro)*.96/u.resolution.y);}
${fields}
fn kpIdentityHash(p:f32)->f32{return br_h11(p);}
${domain}
// Every unresolved ray is explicit. A finite cloth interval receives a separate
// local refinement budget; global empty-space/opaque traversal stays at 180.
struct Hit { t:f32,hit:bool,exhausted:bool,steps:u32,localSteps:u32,field:RoomField };
fn clothRayInterval(ro:vec3<f32>,rd:vec3<f32>)->vec2<f32>{
 let q=ro-vec3<f32>(1.2,2.08,2.15);let half=vec3<f32>(.474,.684,.068);
 var nearT=0.;var farT=1e4;
 for(var axis=0;axis<3;axis++){if(abs(rd[axis])<1e-8){if(abs(q[axis])>half[axis]){return vec2<f32>(1.,-1.);}}else{let a=(-half[axis]-q[axis])/rd[axis];let b=(half[axis]-q[axis])/rd[axis];nearT=max(nearT,min(a,b));farT=min(farT,max(a,b));}}
 return vec2<f32>(nearT,farT);
}
// Ray-direction Taylor bound for the authored macro fold, outside the source
// yarn amplitude shell. The other scene fields still cap every advance.
fn clothEmptyIntervalStep(p:vec3<f32>,rd:vec3<f32>)->f32{
 let q=p-vec3<f32>(1.2,2.08,2.15);let phase=q.y*5.+q.x*3.;let g=q.z-.045*sin(q.x*8.)-.018*sin(phase);let gap=abs(g)-.00042;if(gap<=0.){return 0.;}
 let a=rd.x*8.;let b=rd.y*5.+rd.x*3.;let slope=rd.z-.045*cos(q.x*8.)*a-.018*cos(phase)*b;let curvature=.045*a*a+.018*b*b;
 let den=abs(slope)+sqrt(slope*slope+2.*curvature*gap);return min(.55,.9*2.*gap/max(den,1e-8));
}
fn traceWorld(ro:vec3<f32>,rd:vec3<f32>,farT:f32)->Hit{
 var t=.001;var prevT=t;var prevD=1.;var f=rawField(1e4,0,ro);var regularSteps=0u;var localSteps=0u;let interval=clothRayInterval(ro,rd);
 for(var i=0u;i<692u;i++){
 if(t>farT){return Hit(farT,false,false,i,localSteps,rawField(1e4,0,ro+rd*farT));}
 let local=u.clothLocalBudget>0u&&t>=interval.x&&t<=interval.y;
 if(local){if(localSteps>=min(u.clothLocalBudget,512u)){return Hit(t,false,true,i,localSteps,f);}localSteps++;}else{if(regularSteps>=180u){return Hit(t,false,true,i,localSteps,f);}regularSteps++;}
 let sample=sceneSample(ro+rd*t);f=sample.field;if(u.clothLocalBudget>0u&&!local){f=sample.other;}let eps=.000008+t*.000001;
 if(abs(f.d)<eps){return Hit(t,true,false,i+1u,localSteps,f);}if(f.d<0. && prevD>0.){var a=prevT;var b=t;for(var j=0;j<9;j++){let m=(a+b)*.5;let d=sceneField(ro+rd*m).d;if(d>0.){a=m;}else{b=m;}}t=(a+b)*.5;return Hit(t,true,false,i+1u,localSteps,sceneField(ro+rd*t));}
 prevT=t;prevD=f.d;var advance=clamp(abs(f.d)*.48,.000006,.55);if(local&&f.id==8){let possible=clothEmptyIntervalStep(ro+rd*t,rd);if(possible>advance){let other=sample.other;advance=max(advance,min(possible,clamp(abs(other.d)*.48,.000006,.55)));}}if(u.clothLocalBudget>0u&&interval.x<=interval.y&&t<interval.x){advance=min(advance,interval.x-t);}t+=advance;}
 return Hit(t,false,true,692u,localSteps,f);
}
struct RayStatistics { primaryHit:atomic<u32>,trueMiss:atomic<u32>,primaryExhausted:atomic<u32>,secondaryExhausted:atomic<u32>,maxPrimarySteps:atomic<u32>,maxLocalSteps:atomic<u32>,primaryRefined:atomic<u32>,reserved:atomic<u32> };
@group(0) @binding(2) var<storage,read_write> rayStats:RayStatistics;
fn countPrimary(h:Hit){atomicMax(&rayStats.maxPrimarySteps,h.steps);atomicMax(&rayStats.maxLocalSteps,h.localSteps);if(h.localSteps>0u){atomicAdd(&rayStats.primaryRefined,1u);}if(h.hit){atomicAdd(&rayStats.primaryHit,1u);}else if(h.exhausted){atomicAdd(&rayStats.primaryExhausted,1u);}else{atomicAdd(&rayStats.trueMiss,1u);}}
fn fieldNormal(p:vec3<f32>)->vec3<f32>{let e=max(.00001,receiverFootprint(p)*.25);let a=vec3<f32>(1,-1,-1);let b=vec3<f32>(-1,-1,1);let c=vec3<f32>(-1,1,-1);let d=vec3<f32>(1,1,1);return normalize(a*sceneField(p+a*e).d+b*sceneField(p+b*e).d+c*sceneField(p+c*e).d+d*sceneField(p+d*e).d);}
fn worldShadow(p:vec3<f32>,n:vec3<f32>,ld:vec3<f32>)->f32{var t=.004;var shade=1.;for(var i=0;i<42;i++){let f=sceneField(p+n*.002+ld*t);if(f.id==6&&abs(f.d)<.018){shade*=.88;t+=.026;continue;}if(f.d<.00025){return .0;}shade=min(shade,12.*max(f.d,.0001)/t);t+=clamp(abs(f.d)*.52,.003,.35);if(t>9.){break;}}return clamp(shade,0.,1.);}
fn sky(rd:vec3<f32>)->vec3<f32>{return mix(vec3<f32>(.42,.50,.54),vec3<f32>(.15,.29,.38),smoothstep(-.2,.9,rd.y));}
fn surface(f:RoomField,p:vec3<f32>,nWorld:vec3<f32>)->KpSurface{
 if(f.id==2){return kpApplyFabricSurface(kpBrickOriginalSurface(f.q,f.seed,f.variant,.42,receiverFootprint(p)),wallState(p));}
 if(f.id==3){return stoneMemberSurface(f,p,receiverFootprint(p));}
 if(f.id==4){let n=woodLocalNormal(f);return kpWoodOriginalSurface(f.q,n,select(0.,1.,abs(n.x)>.72),kpWoodDefaultParams(),receiverFootprint(p),0.);}
 if(f.id==5){return kpMetalSurface(p,u.age,historyAt(p)*u.wetness,repairAt(p),receiverFootprint(p));}
 if(f.id==7){return kpCableSurface(p,receiverFootprint(p));}
 if(f.id==8){let yarn=clothNative(f.q);return KpSurface(0.,yarn.albedo*(1.-.02*.15),yarn.roughness);}
 return kpApplyFabricSurface(kpPlasterOriginalField(p,plasterParams(),receiverFootprint(p)).surface,wallState(p));
}
fn shadeOpaqueCore(p:vec3<f32>,n:vec3<f32>,rd:vec3<f32>,f:RoomField,filtered:KpSurface)->vec3<f32>{var m=KpSurface(0.,vec3<f32>(0.),1.);var cavity=1.;var specularLevel=1.;var coat=0.;var coatRough=.25;if(f.id==4){let wn=woodLocalNormal(f);let ws=kpWoodOriginalSample(f.q,wn,select(0.,1.,abs(wn.x)>.72),kpWoodDefaultParams(),receiverFootprint(p),length(p-u.ro));m=ws.surface;cavity=ws.cavity;specularLevel=ws.specularLevel;coat=ws.clearcoat;coatRough=ws.clearcoatRoughness;}else{m=surface(f,p,n);if(f.id==8&&filtered.roughness>=0.){m=filtered;}}let ld=normalize(vec3<f32>(-3.,6.,-4.));let sh=worldShadow(p,n,ld);let nl=max(dot(n,ld),0.);let ndv=max(dot(n,-rd),.01);let h=normalize(ld-rd);let ndh=max(dot(n,h),0.);let vh=max(dot(-rd,h),0.);let oxide=kpMetalCorrosion(p,u.age,historyAt(p)*u.wetness,repairAt(p));let metal=select(0.,.68*(1.-smoothstep(.06,.34,oxide)),f.id==5);let rough=max(.08,m.roughness);let a=rough*rough;let a2=a*a;let den=ndh*ndh*(a2-1.)+1.;let D=a2/max(3.14159265*den*den,.0001);let k=(rough+1.)*(rough+1.)/8.;let G=nl/(nl*(1.-k)+k)*ndv/(ndv*(1.-k)+k);let F0=mix(vec3<f32>(.04),m.albedo,metal);let F=F0+(vec3<f32>(1.)-F0)*pow(1.-vh,5.);let spec=D*G*F/max(4.*nl*ndv,.001);let ambient=.21+.22*max(n.y,0.);let ca=max(.02,coatRough)*max(.02,coatRough);let cden=ndh*ndh*(ca*ca-1.)+1.;let coatD=ca*ca/max(3.14159265*cden*cden,.0001);let coatF=.04+.96*pow(1.-vh,5.);let coatSpec=coat*coatD*G*coatF/max(4.*nl*ndv,.001);return m.albedo*(ambient+(1.-metal)*nl*sh*.90)*cavity*(1.-coat*.04)+spec*nl*sh*1.65*specularLevel+vec3<f32>(coatSpec*nl*sh);}
// Fixed 32x32 tile visibility records live only on GPU, reused for every tile.
// They are intersection results, not geometry or an appearance/field texture.
struct GpuHit {distances:vec4<f32>,coordinates:vec4<f32>,state:vec4<f32>,identity:vec4<u32>};
@group(0) @binding(3) var<storage,read_write> tileHits:array<GpuHit,1024>;
fn cameraRay(pixel:vec2<f32>)->vec3<f32>{let uv=(pixel/u.resolution*2.-vec2<f32>(1.))*vec2<f32>(u.aspect,-1.);return normalize(u.fw+(u.rt*uv.x+u.up*uv.y)*.48);}
@compute @workgroup_size(8,8) fn primaryMain(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=u.tileExtent)){return;}let rd=cameraRay(vec2<f32>(u.tileOrigin+gid.xy)+vec2<f32>(.5));let h=traceWorld(u.ro,rd,32.);countPrimary(h);let status=select(select(0u,2u,h.exhausted),1u,h.hit);tileHits[gid.y*32u+gid.x]=GpuHit(vec4<f32>(h.t,h.field.d,f32(h.steps),f32(h.localSteps)),vec4<f32>(h.field.q,h.field.seed),vec4<f32>(h.field.wet,h.field.repair,h.field.age,0.),vec4<u32>(u32(h.field.id),u32(h.field.variant),status,0u));}
fn readPrimary(pixel:vec2<f32>)->Hit{let local=vec2<u32>(pixel)-u.tileOrigin;let r=tileHits[local.y*32u+local.x];return Hit(r.distances.x,r.identity.z==1u,r.identity.z==2u,u32(r.distances.z),u32(r.distances.w),RoomField(r.distances.y,i32(r.identity.x),r.coordinates.xyz,r.coordinates.w,i32(r.identity.y),r.state.x,r.state.y,r.state.z));}
fn shadeOpaque(p:vec3<f32>,n:vec3<f32>,rd:vec3<f32>,f:RoomField)->vec3<f32>{return shadeOpaqueCore(p,n,rd,f,KpSurface(0.,vec3<f32>(0.),-1.));}
struct GpuCoverage {surface:vec4<f32>,coverageInfo:vec4<f32>};
@group(0) @binding(4) var<storage,read_write> tileCoverage:array<GpuCoverage,1024>;
@compute @workgroup_size(8,8) fn coverageMain(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=u.tileExtent)){return;}let pixel=vec2<f32>(u.tileOrigin+gid.xy)+vec2<f32>(.5);let h=readPrimary(pixel);var result=GpuCoverage(vec4<f32>(0.,0.,0.,-1.),vec4<f32>(0.));if(h.hit&&h.field.id==8){let rd=cameraRay(pixel);let mean=clothProjectedCoverage(h.field,u.ro+rd*h.t,rd);result=GpuCoverage(vec4<f32>(mean.albedo*(1.-.02*.15),mean.roughness),vec4<f32>(mean.coverage,mean.unresolvedFraction,0.,0.));if(mean.unresolvedFraction>0.){atomicAdd(&rayStats.reserved,1u);}}tileCoverage[gid.y*32u+gid.x]=result;}
fn readCoverage(pixel:vec2<f32>)->GpuCoverage{let local=vec2<u32>(pixel)-u.tileOrigin;return tileCoverage[local.y*32u+local.x];}
struct Frag { @location(0) color:vec4<f32>,@builtin(frag_depth) depth:f32, };
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));return vec4<f32>(p[i],0,1);}
@fragment fn fsOpaque(@builtin(position) pixel:vec4<f32>)->Frag{
 let rd=cameraRay(pixel.xy);let tr=readPrimary(pixel.xy);var col=sky(rd);var depth=1.;if(tr.exhausted){return Frag(vec4<f32>(1.,0.,1.,1.),.999999);}if(u.debug==6u){return Frag(vec4<f32>(select(vec3<f32>(0.,.2,1.),vec3<f32>(0.,.75,.1),tr.hit),1.),.999999);}
 if(tr.hit){let p=u.ro+rd*tr.t;let z=dot(p-u.ro,u.fw);depth=clamp(32./(32.-.05)-32.*.05/((32.-.05)*max(z,.05)),0.,1.);if(u.debug==3u){return Frag(vec4<f32>(fract(f32(tr.field.id)*.37),fract(f32(tr.field.id)*.57),fract(f32(tr.field.id)*.79),1.),depth);}if((u.debug==7u||u.debug==8u)&&tr.field.id==8){let mean=readCoverage(pixel.xy);if(u.debug==8u){return Frag(vec4<f32>(mean.coverageInfo.x,mean.coverageInfo.y,0.,1.),depth);}return Frag(vec4<f32>(pow(max(mean.surface.xyz,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.),depth);}if(u.debug==4u){let m=surface(tr.field,p,vec3<f32>(0,1,0));return Frag(vec4<f32>(pow(max(m.albedo,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.),depth);}let n=fieldNormal(p);if(u.debug==1u){return Frag(vec4<f32>(n*.5+vec3<f32>(.5),1.),depth);}if(u.debug==5u){let sh=worldShadow(p,n,normalize(vec3<f32>(-3.,6.,-4.)));return Frag(vec4<f32>(vec3<f32>(sh),1.),depth);}
 if(tr.field.id==6&&u.debug==0u){discard;}var materialOverride=KpSurface(0.,vec3<f32>(0.),-1.);if(tr.field.id==8&&u.clothFilter>0u){let mean=readCoverage(pixel.xy);if(mean.coverageInfo.y>0.){return Frag(vec4<f32>(1.,0.,1.,1.),depth);}materialOverride=KpSurface(0.,mean.surface.xyz,mean.surface.w);}col=shadeOpaqueCore(p,n,rd,tr.field,materialOverride);if(u.debug==1u){col=n*.5+vec3<f32>(.5);}if(u.debug==2u){col=vec3<f32>(surface(tr.field,p,n).roughness);}if(u.debug==3u){col=vec3<f32>(fract(f32(tr.field.id)*.37),fract(f32(tr.field.id)*.57),fract(f32(tr.field.id)*.79));}}
 col=col/(vec3<f32>(1.)+col);return Frag(vec4<f32>(pow(max(col,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.),depth);
}
@fragment fn fsGlass(@builtin(position) pixel:vec4<f32>)->Frag{
 if(u.debug!=0u){discard;}let rd=cameraRay(pixel.xy);let tr=readPrimary(pixel.xy);if(!tr.hit||tr.field.id!=6){discard;}let p=u.ro+rd*tr.t;let n=fieldNormal(p);let z=dot(p-u.ro,u.fw);let depth=clamp(32./(32.-.05)-32.*.05/((32.-.05)*max(z,.05)),0.,1.);var col=vec3<f32>(0.);
let fresnel=.04+.96*pow(1.-abs(dot(-rd,n)),5.);let exitZ=select(-.069,-.061,rd.z>0.);let exitT=max(0.,(exitZ-p.z)/select(-1e-7,1e-7,rd.z>=0.));let slabExit=select(max(0.,(exitZ-p.z)/rd.z),exitT,abs(rd.z)<1e-7);let throughOrigin=p+rd*(slabExit+.001);let transmitted=traceWorld(throughOrigin,rd,24.);var behind=sky(rd);if(transmitted.exhausted){atomicAdd(&rayStats.secondaryExhausted,1u);behind=vec3<f32>(1.,0.,1.);}if(transmitted.hit){let pp=throughOrigin+rd*transmitted.t;behind=shadeOpaque(pp,fieldNormal(pp),rd,transmitted.field);}let reflected=traceWorld(p+n*.006,reflect(rd,n),24.);var reflection=sky(reflect(rd,n));if(reflected.exhausted){atomicAdd(&rayStats.secondaryExhausted,1u);reflection=vec3<f32>(1.,0.,1.);}if(reflected.hit){let pp=p+n*.006+reflect(rd,n)*reflected.t;reflection=shadeOpaque(pp,fieldNormal(pp),reflect(rd,n),reflected.field);}col=mix(behind*vec3<f32>(.88,.94,.92),reflection,fresnel);

 col=col/(vec3<f32>(1.)+col);return Frag(vec4<f32>(pow(max(col,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.),depth);
}
@group(0) @binding(1) var<storage,read_write> probeOut:array<vec4<f32>,8>;
@compute @workgroup_size(1) fn probeMain(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;if(i>=8u){return;}let origins=array<vec3<f32>,8>(vec3<f32>(-2.3,1.4,-2),vec3<f32>(-.85,1.3,-2),vec3<f32>(1.35,1.97,-2),vec3<f32>(-2.5,.07,-2),vec3<f32>(-1.62,2,2.18),vec3<f32>(1.2,2.08,1.5),vec3<f32>(.5,1.07,-2),vec3<f32>(0,2.93,-1));let dirs=array<vec3<f32>,8>(vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,-1,0),vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,0,1));let h=traceWorld(origins[i],dirs[i],20.);probeOut[i]=vec4<f32>(h.t,f32(h.field.id),select(0.,1.,h.hit),h.field.d);}
`;}
