import{KP_BRICK_WGSL}from'./mothers/brick-core.mjs';
import{KP_WOOD_WGSL}from'./mothers/wood-core.mjs';
import{KP_STONE_WGSL}from'./mothers/stone-fields.mjs';
import{KP_METAL_WGSL}from'./mothers/metal.mjs';
import{STATION_FIELD_WGSL}from'./station-field.mjs';
export const WGSL=String.raw`
struct Params{eye:vec3<f32>,age:f32,forward:vec3<f32>,fov:f32,right:vec3<f32>,aspect:f32,up:vec3<f32>,debug:f32,resolution:vec2<f32>,pad:vec2<f32>}
@group(0)@binding(0)var<uniform>u:Params;
struct Stats{hit:atomic<u32>,miss:atomic<u32>,exhausted:atomic<u32>,maxSteps:atomic<u32>}
@group(0)@binding(1)var<storage,read_write>stats:Stats;
${KP_BRICK_WGSL}
${KP_WOOD_WGSL}
${KP_STONE_WGSL}
${KP_METAL_WGSL}
${STATION_FIELD_WGSL}
struct Trace{t:f32,status:u32,steps:u32,h:HitField}
fn march(ro:vec3<f32>,rd:vec3<f32>,limit:f32)->Trace{var t=.02;var h=stationField(ro+rd*t);for(var i=0u;i<900u;i++){h=stationField(ro+rd*t);let eps=clamp(t*.000015,.00065,.006);if(abs(h.d)<eps){return Trace(t,1u,i+1u,h);}t+=max(abs(h.d)*.60,.00018);if(t>limit){return Trace(t,0u,i+1u,h);}}return Trace(t,2u,900u,h);}
fn fieldNormal(p:vec3<f32>)->vec3<f32>{let e=.00045;let a=vec3<f32>(1,-1,-1);let b=vec3<f32>(-1,-1,1);let c=vec3<f32>(-1,1,-1);let d=vec3<f32>(1,1,1);return normalize(a*stationField(p+a*e).d+b*stationField(p+b*e).d+c*stationField(p+c*e).d+d*stationField(p+d*e).d);}
fn sky(rd:vec3<f32>)->vec3<f32>{return mix(vec3<f32>(.72,.78,.76),vec3<f32>(.22,.38,.54),smoothstep(-.15,.85,rd.y));}
fn shadow(p:vec3<f32>,n:vec3<f32>,ld:vec3<f32>)->f32{var t=.04;var res=1.;for(var i=0;i<38;i++){let d=stationMacro(p+n*.018+ld*t).d;if(d<.001){return .1;}res=min(res,12.*d/t);t+=clamp(d*.65,.025,3.);if(t>70.){break;}}return clamp(res,.1,1.);}
fn ao(p:vec3<f32>,n:vec3<f32>)->f32{var occ=0.;var weight=1.;for(var i=1;i<5;i++){let d=f32(i)*.20;occ+=max(0.,d-stationMacro(p+n*d).d)*weight;weight*=.55;}return clamp(1.-occ*.7,.28,1.);}
fn shade(tr:Trace,ro:vec3<f32>,rd:vec3<f32>)->vec3<f32>{let p=ro+rd*tr.t;let h=tr.h;var n=fieldNormal(p);let fp=max(.00001,tr.t*2.*u.fov/u.resolution.y);let wet=stateWet(p);let repair=repairAt(p);var s=KpSurface(0.,vec3<f32>(.34,.33,.28),.85);var metal=0.;var cavity=1.;var specular=1.;
 if(h.id==1u||h.id==12u){s=kpBrickOriginalSurface(h.q,h.seed,i32(abs(h.seed))%4,.42,fp);let mortar=min(.125-abs(h.q.x),.0365-abs(h.q.y));if(mortar<.004){s=KpSurface(0.,vec3<f32>(.28,.26,.21),.94);}s.albedo*=1.-wet*.18;}
 if(h.id==2u){s=kpStoneSurface(h.q,u.age,wet,repair,fp);}
 if(h.id==3u){s=kpMetalSurface(h.q,u.age,wet,repair,fp);metal=.45;}
 if(h.id==4u){let wn=select(n,n.zxy,h.seed==38.);let ws=kpWoodOriginalSample(h.q,wn,select(0.,1.,abs(wn.x)>.72),kpWoodDefaultParams(),fp,tr.t);s=ws.surface;cavity=ws.cavity;specular=ws.specularLevel;}
 if(h.id==6u){s=KpSurface(0.,vec3<f32>(.21,.225,.215),.92);}
 if(h.id==7u){s=KpSurface(0.,vec3<f32>(.82,.77,.62),.3);}
 if(h.id==8u){s=KpSurface(0.,vec3<f32>(.025,.031,.028),.35);metal=.25;}
 if(h.id==9u){s=KpSurface(0.,vec3<f32>(.045,.105,.075),.27);}
 if(h.id==10u){n=normalize(vec3<f32>(.09*sin(p.x*.37+p.z*.18),1.,.04*cos(p.z*.6)));let fre=.03+.97*pow(1.-abs(dot(-rd,n)),5.);s=KpSurface(0.,mix(vec3<f32>(.09,.21,.25),sky(reflect(rd,n)),fre),.17);metal=.18;}
 if(u.debug==1.){return n*.5+vec3<f32>(.5);}if(u.debug==2.){return s.albedo;}if(u.debug==3.){return fract(vec3<f32>(.37,.57,.79)*f32(h.id));}
 let ld=normalize(vec3<f32>(-.45,.78,.38));let sh=shadow(p,n,ld);let ambient=ao(p,n);let diffuse=max(dot(n,ld),0.);let hemi=.20+.21*max(n.y,0.);let reflected=reflect(-ld,n);let gloss=pow(max(dot(reflected,-rd),0.),mix(95.,8.,s.roughness));let F=mix(vec3<f32>(.04),s.albedo,metal);
 var color=s.albedo*(vec3<f32>(hemi,hemi*1.02,hemi*1.08)*ambient+vec3<f32>(1.55,1.39,1.18)*diffuse*sh)*cavity+F*gloss*sh*specular*.8;
 let fog=1.-exp(-tr.t*.0014);return mix(color,sky(rd),fog);
}
@vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1.,-1.),vec2<f32>(3.,-1.),vec2<f32>(-1.,3.));return vec4<f32>(p[i],0.,1.);}
@fragment fn fs(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let uv=(pixel.xy/u.resolution*2.-vec2<f32>(1.))*vec2<f32>(u.aspect,-1.);let rd=normalize(u.forward+(u.right*uv.x+u.up*uv.y)*u.fov);let tr=march(u.eye,rd,420.);atomicMax(&stats.maxSteps,tr.steps);var color=sky(rd);if(tr.status==2u){atomicAdd(&stats.exhausted,1u);return vec4<f32>(1.,0.,1.,1.);}if(tr.status==1u){atomicAdd(&stats.hit,1u);color=shade(tr,u.eye,rd);}else{atomicAdd(&stats.miss,1u);}color=color/(vec3<f32>(1.)+color*.38);return vec4<f32>(pow(max(color,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.);}
`;
