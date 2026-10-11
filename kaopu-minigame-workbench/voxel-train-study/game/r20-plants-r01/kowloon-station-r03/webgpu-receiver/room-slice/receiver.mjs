/** Native WebGPU implicit surface receiver derived from the existing R02.7
 * three-vertex WGSL entry/trace organization. No Three/WebGL fallback. */
export function receiverWGSL(fields,domain){return String.raw`
struct Params { ro:vec3<f32>,age:f32,fw:vec3<f32>,wetness:f32,rt:vec3<f32>,microscope:f32,up:vec3<f32>,aspect:f32,resolution:vec2<f32>,debug:u32,components:u32, };
@group(0) @binding(0) var<uniform> u:Params;
fn receiverFootprint(p:vec3<f32>)->f32{return max(.00001,length(p-u.ro)*.96/u.resolution.y);}
${fields}
fn kpIdentityHash(p:f32)->f32{return br_h11(p);}
${domain}
struct Hit { t:f32,hit:bool,field:RoomField };
fn traceWorld(ro:vec3<f32>,rd:vec3<f32>,farT:f32)->Hit{
 var t=.001;var prevT=t;var prevD=1.;var f=rawField(1e4,0,ro);
 for(var i=0;i<180;i++){f=sceneField(ro+rd*t);let eps=.000008+t*.000001;
 if(abs(f.d)<eps){return Hit(t,true,f);}if(f.d<0. && prevD>0.){var a=prevT;var b=t;for(var j=0;j<9;j++){let m=(a+b)*.5;let d=sceneField(ro+rd*m).d;if(d>0.){a=m;}else{b=m;}}t=(a+b)*.5;return Hit(t,true,sceneField(ro+rd*t));}
 prevT=t;prevD=f.d;t+=clamp(abs(f.d)*.48,.000006,.55);if(t>farT){break;}}
 return Hit(farT,false,f);
}
fn fieldNormal(p:vec3<f32>)->vec3<f32>{let e=max(.00001,receiverFootprint(p)*.25);let a=vec3<f32>(1,-1,-1);let b=vec3<f32>(-1,-1,1);let c=vec3<f32>(-1,1,-1);let d=vec3<f32>(1,1,1);return normalize(a*sceneField(p+a*e).d+b*sceneField(p+b*e).d+c*sceneField(p+c*e).d+d*sceneField(p+d*e).d);}
fn worldShadow(p:vec3<f32>,n:vec3<f32>,ld:vec3<f32>)->f32{var t=.004;var shade=1.;for(var i=0;i<42;i++){let f=sceneField(p+n*.002+ld*t);if(f.id==6&&abs(f.d)<.018){shade*=.88;t+=.026;continue;}if(f.d<.00025){return .0;}shade=min(shade,12.*max(f.d,.0001)/t);t+=clamp(abs(f.d)*.52,.003,.35);if(t>9.){break;}}return clamp(shade,0.,1.);}
fn sky(rd:vec3<f32>)->vec3<f32>{return mix(vec3<f32>(.42,.50,.54),vec3<f32>(.15,.29,.38),smoothstep(-.2,.9,rd.y));}
fn surface(f:RoomField,p:vec3<f32>,nWorld:vec3<f32>)->KpSurface{
 if(f.id==2){return kpApplyFabricSurface(kpBrickOriginalSurface(f.q,f.seed,f.variant,.42,receiverFootprint(p)),wallState(p));}
 if(f.id==3){return kpStoneSurface(p,u.age,u.wetness*.12,0.,receiverFootprint(p));}
 if(f.id==4){let n=woodLocalNormal(f);return kpWoodOriginalSurface(f.q,n,select(0.,1.,abs(n.x)>.72),kpWoodDefaultParams(),receiverFootprint(p),0.);}
 if(f.id==5){return kpMetalSurface(p,u.age,historyAt(p)*u.wetness,repairAt(p),receiverFootprint(p));}
 if(f.id==7){return kpCableSurface(p,receiverFootprint(p));}
 if(f.id==8){let yarn=clothNative(f.q);return KpSurface(0.,yarn.albedo*(1.-.02*.15),yarn.roughness);}
 return kpApplyFabricSurface(kpPlasterOriginalField(p,plasterParams(),receiverFootprint(p)).surface,wallState(p));
}
fn shadeOpaque(p:vec3<f32>,n:vec3<f32>,rd:vec3<f32>,f:RoomField)->vec3<f32>{var m=KpSurface(0.,vec3<f32>(0.),1.);var cavity=1.;var specularLevel=1.;var coat=0.;var coatRough=.25;if(f.id==4){let wn=woodLocalNormal(f);let ws=kpWoodOriginalSample(f.q,wn,select(0.,1.,abs(wn.x)>.72),kpWoodDefaultParams(),receiverFootprint(p),length(p-u.ro));m=ws.surface;cavity=ws.cavity;specularLevel=ws.specularLevel;coat=ws.clearcoat;coatRough=ws.clearcoatRoughness;}else{m=surface(f,p,n);}let ld=normalize(vec3<f32>(-3.,6.,-4.));let sh=worldShadow(p,n,ld);let nl=max(dot(n,ld),0.);let ndv=max(dot(n,-rd),.01);let h=normalize(ld-rd);let ndh=max(dot(n,h),0.);let vh=max(dot(-rd,h),0.);let oxide=kpMetalCorrosion(p,u.age,historyAt(p)*u.wetness,repairAt(p));let metal=select(0.,.68*(1.-smoothstep(.06,.34,oxide)),f.id==5);let rough=max(.08,m.roughness);let a=rough*rough;let a2=a*a;let den=ndh*ndh*(a2-1.)+1.;let D=a2/max(3.14159265*den*den,.0001);let k=(rough+1.)*(rough+1.)/8.;let G=nl/(nl*(1.-k)+k)*ndv/(ndv*(1.-k)+k);let F0=mix(vec3<f32>(.04),m.albedo,metal);let F=F0+(vec3<f32>(1.)-F0)*pow(1.-vh,5.);let spec=D*G*F/max(4.*nl*ndv,.001);let ambient=.21+.22*max(n.y,0.);let ca=max(.02,coatRough)*max(.02,coatRough);let cden=ndh*ndh*(ca*ca-1.)+1.;let coatD=ca*ca/max(3.14159265*cden*cden,.0001);let coatF=.04+.96*pow(1.-vh,5.);let coatSpec=coat*coatD*G*coatF/max(4.*nl*ndv,.001);return m.albedo*(ambient+(1.-metal)*nl*sh*.90)*cavity*(1.-coat*.04)+spec*nl*sh*1.65*specularLevel+vec3<f32>(coatSpec*nl*sh);}
struct Frag { @location(0) color:vec4<f32>,@builtin(frag_depth) depth:f32, };
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));return vec4<f32>(p[i],0,1);}
@fragment fn fs(@builtin(position) pixel:vec4<f32>)->Frag{
 let uv=(pixel.xy/u.resolution*2.-vec2<f32>(1.))*vec2<f32>(u.aspect,-1.);let rd=normalize(u.fw+(u.rt*uv.x+u.up*uv.y)*.48);let tr=traceWorld(u.ro,rd,32.);var col=sky(rd);var depth=1.;
 if(tr.hit){let p=u.ro+rd*tr.t;let z=dot(p-u.ro,u.fw);depth=clamp(32./(32.-.05)-32.*.05/((32.-.05)*max(z,.05)),0.,1.);if(u.debug==3u){return Frag(vec4<f32>(fract(f32(tr.field.id)*.37),fract(f32(tr.field.id)*.57),fract(f32(tr.field.id)*.79),1.),depth);}if(u.debug==4u){let m=surface(tr.field,p,vec3<f32>(0,1,0));return Frag(vec4<f32>(pow(max(m.albedo,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.),depth);}let n=fieldNormal(p);if(u.debug==1u){return Frag(vec4<f32>(n*.5+vec3<f32>(.5),1.),depth);}if(u.debug==5u){let sh=worldShadow(p,n,normalize(vec3<f32>(-3.,6.,-4.)));return Frag(vec4<f32>(vec3<f32>(sh),1.),depth);}
 if(tr.field.id==6){let fresnel=.04+.96*pow(1.-abs(dot(-rd,n)),5.);let exitZ=select(-.069,-.061,rd.z>0.);let exitT=max(0.,(exitZ-p.z)/select(-1e-7,1e-7,rd.z>=0.));let slabExit=select(max(0.,(exitZ-p.z)/rd.z),exitT,abs(rd.z)<1e-7);let throughOrigin=p+rd*(slabExit+.001);let transmitted=traceWorld(throughOrigin,rd,24.);var behind=sky(rd);if(transmitted.hit){let pp=throughOrigin+rd*transmitted.t;behind=shadeOpaque(pp,fieldNormal(pp),rd,transmitted.field);}let reflected=traceWorld(p+n*.006,reflect(rd,n),24.);var reflection=sky(reflect(rd,n));if(reflected.hit){let pp=p+n*.006+reflect(rd,n)*reflected.t;reflection=shadeOpaque(pp,fieldNormal(pp),reflect(rd,n),reflected.field);}col=mix(behind*vec3<f32>(.88,.94,.92),reflection,fresnel);
 }else{col=shadeOpaque(p,n,rd,tr.field);}if(u.debug==1u){col=n*.5+vec3<f32>(.5);}if(u.debug==2u){col=vec3<f32>(surface(tr.field,p,n).roughness);}if(u.debug==3u){col=vec3<f32>(fract(f32(tr.field.id)*.37),fract(f32(tr.field.id)*.57),fract(f32(tr.field.id)*.79));}}
 col=col/(vec3<f32>(1.)+col);return Frag(vec4<f32>(pow(max(col,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.),depth);
}
@group(0) @binding(1) var<storage,read_write> probeOut:array<vec4<f32>,8>;
@compute @workgroup_size(1) fn probeMain(@builtin(global_invocation_id) gid:vec3<u32>){let i=gid.x;if(i>=8u){return;}let origins=array<vec3<f32>,8>(vec3<f32>(-2.3,1.4,-2),vec3<f32>(-.85,1.3,-2),vec3<f32>(1.35,1.97,-2),vec3<f32>(-2.5,.07,-2),vec3<f32>(-1.62,2,2.18),vec3<f32>(1.2,2.08,1.5),vec3<f32>(.5,1.07,-2),vec3<f32>(0,2.93,-1));let dirs=array<vec3<f32>,8>(vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,-1,0),vec3<f32>(0,0,1),vec3<f32>(0,0,1),vec3<f32>(0,0,1));let h=traceWorld(origins[i],dirs[i],20.);probeOut[i]=vec4<f32>(h.t,f32(h.field.id),select(0.,1.,h.hit),h.field.d);}
`;}
