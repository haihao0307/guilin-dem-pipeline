import{KP_BRICK_WGSL}from'./mothers/brick-core.mjs';
import{KP_WOOD_WGSL}from'./mothers/wood-core.mjs';
import{KP_PLASTER_WGSL}from'./mothers/plaster-core.mjs';
import{KP_STONE_WGSL}from'./mothers/stone-fields.mjs';
import{KP_METAL_WGSL}from'./mothers/metal.mjs';
import{KP_CONCRETE_WGSL}from'./mothers/concrete-kst.mjs';
import{STATION_MATTER_WGSL}from'./station-matter.mjs';
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
${KP_CONCRETE_WGSL}
${KP_PLASTER_WGSL}
fn stationPlasterParams(extent:vec3<f32>)->KpPlasterParams{return KpPlasterParams(vec2<f32>(0.),max(extent.xy,vec2<f32>(.08)),.0165,.0012+.0018*u.age,0.,.013,.020,.0001,vec3<f32>(.48,.44,.35),vec3<f32>(.82,.76,.64),.0008,.000008,.018);}
${STATION_FIELD_WGSL}
${STATION_MATTER_WGSL}
struct Trace{t:f32,status:u32,steps:u32,h:HitField}
fn groundRay(ro:vec3<f32>,rd:vec3<f32>)->vec2<f32>{var best=vec2<f32>(1e6,0.);if(rd.y< -0.0000001){let land=(-.28-ro.y)/rd.y;let sea=(-.52-ro.y)/rd.y;if(land>.001&&(ro+rd*land).z<=27.){best=vec2<f32>(land,6.);}if(sea>.001&&(ro+rd*sea).z>=27.&&sea<best.x){best=vec2<f32>(sea,10.);}}if(abs(rd.z)>.0000001){let coast=(27.-ro.z)/rd.z;let yy=(ro+rd*coast).y;if(coast>.001&&yy>=-.52&&yy<=-.28&&coast<best.x){best=vec2<f32>(coast,6.);}}return best;}
// Ray-specific empty-space bound for the roof's OUTER cylinder. All other
// objects retain their ordinary conservative distance, with a 3cm material shell.
// A negative discriminant proves this ray cannot touch this barrel shell.
fn barrelAdvance(p:vec3<f32>,rd:vec3<f32>,h:HitField)->f32{if(h.id!=15u){return 0.;}let r=12.856;let v=rd.xy;let A=dot(v,v);if(A<=.0000001){return 0.;}var t=1e5;for(var barrel= -1;barrel<=1;barrel++){let q=vec2<f32>(p.x-f32(barrel)*20.,p.y-1.2);if(length(q)<=r){return 0.;}let B=dot(q,v);let C=dot(q,q)-r*r;let disc=B*B-A*C;if(disc>=0.){let near=(-B-sqrt(disc))/A;if(near>0.){t=min(t,near);}}}let other=max(0.,stationDomain(p,true).d-.03)*.60;return min(t*.98,other);}
fn march(ro:vec3<f32>,rd:vec3<f32>,limit:f32)->Trace{let ground=groundRay(ro,rd);let end=min(limit,ground.x);var t=.02;var h=stationField(ro+rd*t);for(var i=0u;i<1400u;i++){h=stationField(ro+rd*t);let eps=clamp(t*.000015,.00065,.006);if(abs(h.d)<eps&&h.id!=0u){return Trace(t,1u,i+1u,h);}t+=max(max(abs(h.d)*.60,barrelAdvance(ro+rd*t,rd,h)),.00018);if(t>=end){if(ground.x<=limit){let p=ro+rd*ground.x;return Trace(ground.x,1u,i+1u,HitField(0.,u32(ground.y),p,0.,0.,vec3<f32>(1.)));}return Trace(t,0u,i+1u,h);}}return Trace(t,2u,1400u,h);}

fn fieldNormal(p:vec3<f32>)->vec3<f32>{let e=.00045;var gradient=vec3<f32>(0.);let axes=array<vec3<f32>,4>(vec3<f32>(1,-1,-1),vec3<f32>(-1,-1,1),vec3<f32>(-1,1,-1),vec3<f32>(1,1,1));for(var i=0u;i<4u;i++){gradient+=axes[i]*stationField(p+axes[i]*e).d;}return normalize(gradient);}
fn sky(rd:vec3<f32>)->vec3<f32>{return mix(vec3<f32>(.72,.78,.76),vec3<f32>(.22,.38,.54),smoothstep(-.15,.85,rd.y));}
fn shadow(p:vec3<f32>,n:vec3<f32>,ld:vec3<f32>)->f32{var t=.04;var res=1.;for(var i=0;i<38;i++){let d=stationDomain(p+n*.018+ld*t,false).d;if(d<.001){return .1;}res=min(res,12.*d/t);t+=clamp(d*.65,.025,3.);if(t>70.){break;}}return clamp(res,.1,1.);}
fn ao(p:vec3<f32>,n:vec3<f32>)->f32{var occ=0.;var weight=1.;for(var i=1;i<5;i++){let d=f32(i)*.20;occ+=max(0.,d-stationDomain(p+n*d,false).d)*weight;weight*=.55;}return clamp(1.-occ*.7,.28,1.);}
fn surfaceAt(p:vec3<f32>,n:vec3<f32>,fp:f32)->StationMatter{var h=stationDomain(p,false);h.d=h.baseD;return evaluateStationMatter(h,p,n,fp);}
fn shade(tr:Trace,ro:vec3<f32>,rd:vec3<f32>)->vec3<f32>{let p=ro+rd*tr.t;let h=tr.h;var n=vec3<f32>(0.,1.,0.);if(h.id!=6u&&h.id!=10u){n=fieldNormal(p);}let fp=max(.00001,tr.t*2.*u.fov/u.resolution.y);let wet=stateWet(p);let repair=repairAt(p);var s=KpSurface(0.,vec3<f32>(.34,.33,.28),.85);var metal=0.;var cavity=1.;var specular=1.;
 if(h.id==1u||h.id==2u||h.id==3u||h.id==4u||h.id==12u||h.id==13u||h.id==15u||h.id==17u){var nominal=h;nominal.d=h.baseD;let matter=evaluateStationMatter(nominal,p,n,fp);s=matter.surface;metal=matter.metal;cavity=matter.cavity;specular=matter.specular;
  // Source micro-height changes PBR normal only; geometry uses the explicitly
  // separate macro/thickness field above. No second geometric skin is rendered.
  if(tr.t<18.&&fp<.02&&abs(matter.microHeight)>0.){let axis=select(vec3<f32>(0.,1.,0.),vec3<f32>(1.,0.,0.),abs(n.y)>.8);let t1=normalize(cross(axis,n));let t2=cross(n,t1);let e=max(.0007,fp*.5);var dh=vec2<f32>(0.);for(var tap=0u;tap<4u;tap++){let tangent=select(t1,t2,tap>=2u);let signTap=select(1.,-1.,(tap&1u)==1u);let height=surfaceAt(p+tangent*(e*signTap),n,fp).microHeight*signTap/(2.*e);if(tap<2u){dh.x+=height;}else{dh.y+=height;}}let dh1=dh.x;let dh2=dh.y;n=normalize(n-t1*dh1-t2*dh2);}
 }
 if(h.id==6u){s=KpSurface(0.,vec3<f32>(.21,.225,.215),.92);}
 if(h.id==7u){s=KpSurface(0.,vec3<f32>(.82,.77,.62),.3);}
 if(h.id==8u){s=KpSurface(0.,vec3<f32>(.025,.031,.028),.35);metal=.25;}
 if(h.id==9u){s=KpSurface(0.,vec3<f32>(.045,.105,.075),.27);}
 if(h.id==10u){n=normalize(vec3<f32>(.09*sin(p.x*.37+p.z*.18),1.,.04*cos(p.z*.6)));let fre=.03+.97*pow(1.-abs(dot(-rd,n)),5.);s=KpSurface(0.,mix(vec3<f32>(.09,.21,.25),sky(reflect(rd,n)),fre),.17);metal=.18;}
 if(u.debug==1.){return n*.5+vec3<f32>(.5);}if(u.debug==2.){return s.albedo;}if(u.debug==3.){return fract(vec3<f32>(.37,.57,.79)*f32(h.id));}
 // Energy-conserving direct GGX response. Material inputs remain mother outputs;
 // skylight is an explicit approximate environment, not claimed path-traced GI.
 let ld=normalize(vec3<f32>(-.45,.78,.38));let sh=shadow(p,n,ld);let ambient=ao(p,n);let vd=-rd;let hv=normalize(ld+vd);let nl=max(dot(n,ld),0.);let nv=max(dot(n,vd),.001);let nh=max(dot(n,hv),0.);let vh=max(dot(vd,hv),0.);let rough=clamp(s.roughness,.065,.98);let alpha=rough*rough;let alpha2=alpha*alpha;let den=nh*nh*(alpha2-1.)+1.;let D=alpha2/(3.14159265*den*den);let k=(rough+1.)*(rough+1.)*.125;let G=(nl/(nl*(1.-k)+k))*(nv/(nv*(1.-k)+k));let F0=mix(vec3<f32>(.04),s.albedo,metal);let F=F0+(vec3<f32>(1.)-F0)*pow(1.-vh,5.);let spec=D*G*F/max(.004,4.*nl*nv)*specular;let diffuse=(vec3<f32>(1.)-F)*(1.-metal)*s.albedo/3.14159265;
 let hemi=.22+.30*max(n.y,0.);let skyDiffuse=vec3<f32>(.83,.92,1.08)*hemi;let envSpec=sky(reflect(rd,n))*F0*(1.-rough*.72)*.15;
 var color=((diffuse+spec)*vec3<f32>(4.6,4.24,3.75)*nl*sh+s.albedo*skyDiffuse*ambient+envSpec*ambient)*cavity;
 let fog=1.-exp(-tr.t*.00065);return mix(color,sky(rd),fog);
}
@vertex fn vs(@builtin(vertex_index)i:u32)->@builtin(position)vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1.,-1.),vec2<f32>(3.,-1.),vec2<f32>(-1.,3.));return vec4<f32>(p[i],0.,1.);}
// Per-frame ray results only. This is not a sampled world field or texture atlas.
@group(0)@binding(3)var<storage,read_write>rayHits:array<Trace>;
fn stationRay(pixel:vec2<f32>)->vec3<f32>{let uv=(pixel/u.resolution*2.-vec2<f32>(1.))*vec2<f32>(u.aspect,-1.);return normalize(u.forward+(u.right*uv.x+u.up*uv.y)*u.fov);}
@compute @workgroup_size(8,8)fn primaryRays(@builtin(global_invocation_id)gid:vec3<u32>){let pixel=gid.xy+vec2<u32>(u.pad);if(any(pixel>=vec2<u32>(u.resolution))){return;}let rd=stationRay(vec2<f32>(pixel)+vec2<f32>(.5));let tr=march(u.eye,rd,420.);rayHits[pixel.y*u32(u.resolution.x)+pixel.x]=tr;atomicMax(&stats.maxSteps,tr.steps);if(tr.status==2u){atomicAdd(&stats.exhausted,1u);}else if(tr.status==1u){atomicAdd(&stats.hit,1u);}else{atomicAdd(&stats.miss,1u);}}
@fragment fn fs(@builtin(position)pixel:vec4<f32>)->@location(0)vec4<f32>{let rd=stationRay(pixel.xy);let tr=rayHits[u32(pixel.y)*u32(u.resolution.x)+u32(pixel.x)];var color=sky(rd);if(tr.status==2u){return vec4<f32>(1.,0.,1.,1.);}if(tr.status==1u){color=shade(tr,u.eye,rd);}color=clamp((color*(2.51*color+vec3<f32>(.03)))/(color*(2.43*color+vec3<f32>(.59))+vec3<f32>(.14)),vec3<f32>(0.),vec3<f32>(1.));return vec4<f32>(pow(max(color,vec3<f32>(0.)),vec3<f32>(1./2.2)),1.);}

@group(0)@binding(2)var<storage,read_write>matterProbe:array<vec4<f32>,576>;
@compute @workgroup_size(32)fn probeMatter(@builtin(global_invocation_id)gid:vec3<u32>){let index=gid.x;if(index>=192u){return;}let family=index/32u;let cell=index%32u;let ids=array<u32,6>(1u,2u,3u,4u,13u,17u);let q=vec3<f32>(f32(cell)*.13-1.5,.1+f32(cell%3u)*.037,.03+f32(cell%5u)*.021);let p=vec3<f32>(f32(cell)*.11,.15+f32(cell%8u)*.12,8.3);let h=HitField(0.,ids[family],q,select(19.,38.,family==3u),0.,vec3<f32>(2.,1.5,.3));let m=evaluateStationMatter(h,p,vec3<f32>(0.,1.,0.),.0005);matterProbe[index*3u]=vec4<f32>(m.d,m.surface.height,m.surface.roughness,f32(m.layer));matterProbe[index*3u+1u]=vec4<f32>(m.surface.albedo,m.microHeight);let st=resolveStationState(p);matterProbe[index*3u+2u]=vec4<f32>(st.age,st.wet,st.repair,st.retained);}
`;
