// Bounded sky-only reflection. Geometry and material evaluations are separated.
// 8 deterministic GGX-NDF importance samples, a 50/50 mixture for coated wood.
// No fitted light, environment image, bounce shading, denoiser or material changes.
export const ENVIRONMENT_RESPONSE=String.raw`
struct EnvironmentRay { direction:vec4<f32>,weight:vec4<f32>,transmittance:vec4<f32>,evidence:vec4<f32> };
@group(0) @binding(8) var<storage,read_write> environmentRays:array<EnvironmentRay,8192>;
fn environmentMaterial(mat:u32)->bool {return mat==3u||mat==4u||mat==14u||mat==18u;}
fn environmentD(rough:f32,nh:f32)->f32 {let a=rough*rough;let a2=a*a;let d=nh*nh*(a2-1.)+1.;return a2/max(3.14159265*d*d,.000001);}
fn environmentG(rough:f32,nl:f32,nv:f32)->f32 {let k=(rough+1.)*(rough+1.)/8.;return nl/max(nl*(1.-k)+k,.000001)*nv/max(nv*(1.-k)+k,.000001);}
fn environmentHalf(n:vec3<f32>,rough:f32,sample:u32,count:u32)->vec3<f32> {
 let u0=(f32(sample)+.5)/f32(count);let u1=f32(reverseBits(sample))*2.3283064365386963e-10+.125;
 let alpha=rough*rough;let ct=sqrt((1.-u0)/(1.+(alpha*alpha-1.)*u0));let st=sqrt(max(0.,1.-ct*ct));let phi=6.28318530718*u1;
 let t=normalize(cross(select(vec3<f32>(0.,1.,0.),vec3<f32>(1.,0.,0.),abs(n.y)>.95),n));let b=cross(n,t);
 return normalize(t*(st*cos(phi))+b*(st*sin(phi))+n*ct);
}
@compute @workgroup_size(8,8) fn environmentPrepare(@builtin(global_invocation_id) gid:vec3<u32>){
 if(any(gid.xy>=u.tile.zw)){return;}let idx=gid.y*32u+gid.x;let r=shadingRecords[idx];
 for(var s=0u;s<8u;s++){environmentRays[idx*8u+s]=EnvironmentRay(vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.),vec4<f32>(0.));}
 if(u.clock.w<1.5||r.flags.x!=1u||!environmentMaterial(r.flags.y)){return;}
 let pix=vec2<f32>(u.tile.xy+gid.xy)+vec2<f32>(.5);let rd=ray(pix);let p=r.positionDistance.xyz;let distance=r.positionDistance.w;let ng=r.normalAO.xyz;
 let f=Field(0.,r.flags.y,r.localSeed.xyz,r.localSeed.w,r.params.x,r.params.y,MaterialFrame(mat3x3<f32>(r.frame0.xyz,r.frame1.xyz,r.frame2.xyz),r.frameLower.xyz,r.frameUpper.xyz,r.frame0.w));
 let fp=max(.0003,distance*.96/u.resolution.y);let rx=ray(pix+vec2<f32>(1.,0.));let ry=ray(pix+vec2<f32>(0.,1.));let plane=dot(p-u.eye.xyz,ng);let dx=clamp(plane/dot(rx,ng),0.,320.)*rx-distance*rd;let dy=clamp(plane/dot(ry,ng),0.,320.)*ry-distance*rd;
 let tfp=componentFootprint(f,fp,dx,dy);let rr=receiverResponse(f,p,ng,tfp,dx,dy);let n=materialNormal(f,p,ng,tfp);let m=resolvedWeather(f,p,n,rr.surface);let v=-rd;let nv=max(dot(n,v),.001);let rough=clamp(m.roughness,.08,1.);let cr=clamp(rr.clearcoatRoughness,.08,1.);let coated=rr.clearcoat>0.;
 for(var s=0u;s<8u;s++){
  let coatSample=coated&&(s%2u==1u);let h=environmentHalf(n,select(rough,cr,coatSample),select(s,s/2u,coated),select(8u,4u,coated));let vh=dot(v,h);let l=reflect(-v,h);let nl=dot(n,l);let nh=max(dot(n,h),0.);var er:EnvironmentRay;er.direction=vec4<f32>(l,0.);er.weight=vec4<f32>(0.);er.transmittance=vec4<f32>(0.);er.evidence=vec4<f32>(0.);
  if(vh>0.&&nl>0.&&dot(ng,l)>.0001){
   let D=environmentD(rough,nh);let cD=environmentD(cr,nh);let pdf=select(D,(D+cD)*.5,coated)*nh/max(4.*vh,.000001);
   let F=.04+.96*pow(1.-vh,5.);let cF=rr.clearcoat*F;let base=D*environmentG(rough,nl,nv)*F*rr.specularLevel*(1.-cF)/max(4.*nl*nv,.000001);let coat=cD*environmentG(cr,nl,nv)*cF/max(4.*nl*nv,.000001);
   er.direction.w=1.;er.weight=vec4<f32>(vec3<f32>((base+coat)*nl/max(pdf,.000001)/8.),0.);
  }
  environmentRays[idx*8u+s]=er;
 }
}
// One invocation per direction and one textual sceneField site. No materials.
// State 0 inactive, 1 escaped to original sky, 2 real opaque blocker, 3 unresolved.
@compute @workgroup_size(8,8) fn environmentVisibility(@builtin(global_invocation_id) gid:vec3<u32>){
 if(any(gid.xy>=u.tile.zw)||gid.z>=8u){return;}let idx=gid.y*32u+gid.x;let ei=idx*8u+gid.z;var er=environmentRays[ei];let r=shadingRecords[idx];
 if(er.direction.w<.5){if(r.flags.x==1u&&environmentMaterial(r.flags.y)){atomicAdd(&stats.envInactive,1u);}return;}
 atomicAdd(&stats.envRays,1u);let dir=er.direction.xyz;let origin=r.positionDistance.xyz+r.normalAO.xyz*.015;var t=.005;var depth=0.;var resolved=false;var state=3u;var blocker=0u;var steps=0u;
 for(var i=0u;i<768u;i++){
  let q=origin+dir*t;
  // All bureau structure is inside |x|/|z|<100 and y<33. The finite ground slab also lies inside this envelope.
  // A ray leaving this complete world envelope cannot hit later structure.
  if(q.y>33.||(abs(q.x)>100.||abs(q.z)>100.)){state=1u;resolved=true;break;}
  let f=sceneField(q);steps++;
  if(f.mat!=0u&&f.mat!=8u&&f.d<.0035){state=2u;blocker=f.mat;resolved=true;break;}
  if(f.mat==8u&&f.d<.010){let ds=max(.003,min(.015,abs(f.d)+.003));depth+=select(0.,ds,f.d<0.);t+=ds;}else{t+=clamp(abs(f.d)*.82,.003,4.);}
  if(t>240.){break;}
 }
 atomicMax(&stats.envMaxSteps,steps);if(state==1u){atomicAdd(&stats.envOpen,1u);}else if(state==2u){atomicAdd(&stats.envBlocked,1u);if(t<.05){atomicAdd(&stats.envNearBlock,1u);}}else{atomicAdd(&stats.envUnresolved,1u);}
 if(depth>0.){atomicAdd(&stats.envGlass,1u);}let tint=select(vec3<f32>(1.),exp(-vec3<f32>(.7,.20,.45)*depth)*vec3<f32>(.97,.99,.98),depth>0.);
 er.transmittance=vec4<f32>(select(vec3<f32>(0.),tint,state==1u),f32(state));er.evidence=vec4<f32>(t,f32(blocker),f32(steps),depth);environmentRays[ei]=er;
}
fn environmentRadiance(idx:u32)->vec3<f32>{if(u.clock.w<1.5){return vec3<f32>(0.);}var c=vec3<f32>(0.);for(var s=0u;s<8u;s++){let e=environmentRays[idx*8u+s];c+=sky(e.direction.xyz)*e.weight.xyz*e.transmittance.xyz;}return c;}
fn environmentStatus(idx:u32)->vec3<f32>{if(u.clock.w<1.5){return vec3<f32>(0.);}var c=vec3<f32>(0.);for(var s=0u;s<8u;s++){let state=environmentRays[idx*8u+s].transmittance.w;c+=vec3<f32>(select(0.,1.,state==2.),select(0.,1.,state==1.),select(0.,1.,state==3.))/8.;}return c;}
`;
