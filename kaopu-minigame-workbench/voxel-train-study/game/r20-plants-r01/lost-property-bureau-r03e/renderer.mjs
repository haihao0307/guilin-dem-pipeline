import { DOMAIN } from './domain.mjs';
import { KP_BRICK_WGSL } from './mothers/brick-core.mjs';
import { KP_PLASTER_WGSL } from './mothers/plaster-core.mjs';
import { KP_V26_WGSL } from './mothers/v26-wet.mjs';
import { KP_WOOD_WGSL } from './mothers/wood-core.mjs';
import { KP_STONE_WGSL } from './mothers/stone-fields.mjs';
import { KP_STONE_SLATE_WGSL } from './mothers/stone-slate.mjs';
import { KP_METAL_WGSL } from './metal.mjs';
import { selectStageSource } from './stage-source.mjs';
import { skipZeroContributions } from './evaluation.mjs';
export const VIEWS={exterior:{eye:[78,48,-88],target:[4,3,0],cut:0},section:{eye:[66,81,-66],target:[3,1,0],cut:1},hall:{eye:[-37.6,2.3,-23.2],target:[-29.3,3.1,-14.0],cut:0},warehouse:{eye:[4,3.2,-27],target:[11,4.0,18],cut:0},freight:{eye:[65,32,65],target:[12,3,22],cut:1},street:{eye:[-87,23,-23],target:[-36,5,-12],cut:0},window:{eye:[-42.0,7.9,3.1],target:[-38.55,7.65,0],cut:0},roof:{eye:[32,20,-55],target:[33,13.6,-35.7],cut:0}};
const HEADER=String.raw`
struct Params { eye:vec4<f32>,forward:vec4<f32>,right:vec4<f32>,up:vec4<f32>,resolution:vec4<f32>,options:vec4<f32>,clock:vec4<f32>,counts:vec4<u32>,tile:vec4<u32> };
struct ItemRecord {position:vec4<f32>,size:vec4<f32>};
@group(0) @binding(0) var<uniform> u:Params;
@group(0) @binding(1) var<storage,read> items:array<ItemRecord,128>;
struct Hit {distance:f32,status:u32,steps:u32,mat:u32};
@group(0) @binding(2) var<storage,read_write> hits:array<Hit,1024>;
struct Queue {count:atomic<u32>,indices:array<u32,1024>};
@group(0) @binding(3) var<storage,read_write> retry:Queue;
struct Stats {hit:atomic<u32>,miss:atomic<u32>,exhausted:atomic<u32>,retried:atomic<u32>,maxSteps:atomic<u32>,glassRays:atomic<u32>,glassMiss:atomic<u32>,glassExhausted:atomic<u32>};
@group(0) @binding(4) var<storage,read_write> stats:Stats;
struct Transmission {distance:f32,status:u32,steps:u32,depth:f32};
@group(0) @binding(5) var<storage,read_write> transmission:array<Transmission,1024>;
struct ShadingRecord {positionDistance:vec4<f32>,normalAO:vec4<f32>,glassNormalDepth:vec4<f32>,params:vec4<f32>,localSeed:vec4<f32>,flags:vec4<u32>};
@group(0) @binding(6) var<storage,read_write> shadingRecords:array<ShadingRecord,1024>;
@group(0) @binding(7) var<storage,read_write> normalSamples:array<f32,8192>;
`;
const RECEIVER=String.raw`
fn ray(pixel:vec2<f32>)->vec3<f32>{let q=(pixel/u.resolution.xy*2.-vec2<f32>(1.))*vec2<f32>(u.resolution.z,-1.);return normalize(u.forward.xyz+(u.right.xyz*q.x+u.up.xyz*q.y)*.48);}
fn march(ro:vec3<f32>,rd:vec3<f32>,start:Hit,budget:u32)->Hit {var t=start.distance;var steps=start.steps;for(var i=0u;i<budget;i++){let f=sceneField(ro+rd*t);steps++;let eps=max(.002,min(.025,t/u.resolution.y*.013));if(f.d<eps&&f.mat!=0u){return Hit(t,1u,steps,f.mat);}t+=max(.0015,abs(f.d)*.76);if(t>320.){return Hit(t,0u,steps,0u);}}return Hit(t,2u,steps,0u);}
@compute @workgroup_size(8,8) fn primary(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=u.tile.zw)){return;}let idx=gid.y*32u+gid.x;let rd=ray(vec2<f32>(u.tile.xy+gid.xy)+vec2<f32>(.5));let h=march(u.eye.xyz,rd,Hit(.01,2u,0u,0u),220u);hits[idx]=h;if(h.status==2u){let n=atomicAdd(&retry.count,1u);retry.indices[n]=idx;atomicAdd(&stats.retried,1u);}}
@compute @workgroup_size(64) fn resume(@builtin(global_invocation_id) gid:vec3<u32>){if(gid.x>=atomicLoad(&retry.count)){return;}let idx=retry.indices[gid.x];let pix=u.tile.xy+vec2<u32>(idx%32u,idx/32u);hits[idx]=march(u.eye.xyz,ray(vec2<f32>(pix)+vec2<f32>(.5)),hits[idx],1400u);}
@compute @workgroup_size(8,8) fn finalize(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=u.tile.zw)){return;}let h=hits[gid.y*32u+gid.x];atomicMax(&stats.maxSteps,h.steps);if(h.status==1u){atomicAdd(&stats.hit,1u);}else if(h.status==0u){atomicAdd(&stats.miss,1u);}else{atomicAdd(&stats.exhausted,1u);}}
fn normal(p:vec3<f32>,t:f32)->vec3<f32>{let e=max(.002,min(.03,t/u.resolution.y*.08));let a=vec3<f32>(1,-1,-1);let b=vec3<f32>(-1,-1,1);let c=vec3<f32>(-1,1,-1);let d=vec3<f32>(1,1,1);return normalize(a*sceneField(p+a*e).d+b*sceneField(p+b*e).d+c*sceneField(p+c*e).d+d*sceneField(p+d*e).d);}
fn shadow(p:vec3<f32>,n:vec3<f32>,light:vec3<f32>)->f32{var t=.05;var s=1.;for(var i=0u;i<24u;i++){let f=sceneField(p+n*.025+light*t);if(f.mat==8u){t+=max(.025,abs(f.d));continue;}if(f.d<.004){return .10;}s=min(s,9.*f.d/t);t+=clamp(f.d*.8,.025,3.);if(t>45.){break;}}return clamp(s,.12,1.);}
fn surfaceRaw(f:Field,p:vec3<f32>,n:vec3<f32>,fp:f32)->KpSurface {
 let weather=f.age*f.wet;let noise=br_noise3(p*2.1);var m=KpSurface(0.,vec3<f32>(.3),.8);
 if(f.mat==1u||f.mat==19u){let pp=receiverPlasterParams();let plasterP=plasterCoordinates(p);let pf=kpPlasterOriginalField(plasterP,pp,fp);let ps=kpFabricState(f.age,f.wet,f.wet,pf.macroTone,.42,.08,pf.macroTone,pf.micro,pf.thicknessM,.004,.025);m=kpApplyFabricSurface(pf.surface,ps);m.albedo*=vec3<f32>(1.26,1.24,1.12);let dampBase=(1.-smoothstep(.15,1.25,p.y))*f.wet;let contact=(1.-smoothstep(.35,.80,abs(p.y-1.15)))*.025;let worn=f.age*clamp(dampBase*.32+contact,0.,.09);m.albedo=mix(m.albedo,vec3<f32>(.35,.30,.23),worn);m.albedo*=1.-weather*.12;}
 if(f.mat==2u){let axis=select(p.x,p.z,abs(n.x)>.6);let row=floor(p.y/.075);let stagger=fract(row*.5)*.25;let cell=floor((axis+stagger)/.25);let bx=(axis+stagger)-cell*.25;let bq=vec3<f32>(bx-.125,fract(p.y/.075)*.075-.0375,.055);let seed=cell+row*17.;m=kpBrickOriginalSurface(bq,seed,i32(abs(seed))%4,.42,fp);let edge=max(abs(bq.x)-.118,abs(bq.y)-.0305);let mortar=smoothstep(-max(.001,fp*.55),max(.001,fp*.55),edge);m.albedo=mix(m.albedo,vec3<f32>(.43,.40,.32),mortar);m.height=mix(m.height,-.003,mortar);m.albedo*=1.-weather*.16;}

 if(f.mat==3u){m=kpStoneSurface(p,f.age,f.wet*.35,0.,fp);let mineralTone=dot(m.albedo,vec3<f32>(.2126,.7152,.0722));m.albedo=vec3<f32>(.49,.445,.35)*(.92+clamp(mineralTone,.06,.40)*.32);m.height*=.22;m.roughness=clamp(m.roughness,.55,.80);if(n.y>.75&&p.y<.15){let phase=fract(p.xz/vec2<f32>(.85,.55));let edge=min(min(phase.x,1.-phase.x)*.85,min(phase.y,1.-phase.y)*.55);let joint=1.-smoothstep(.002,.005+fp*.55,edge);m.albedo=mix(m.albedo,vec3<f32>(.24,.225,.19),joint*.48);m.height-=joint*.001;}}
 if(f.mat==4u||f.mat==14u||f.mat==18u){var wp=kpWoodDefaultParams();wp.seed+=f.seed*.013;wp.textureScale=.70;wp.roughness=select(.63,.31,f.mat==18u);wp.clearcoat=select(.08,.48,f.mat==18u);m=kpWoodOriginalSurface(f.local,n,select(0.,1.,abs(n.x)>.7),wp,fp,0.);if(f.mat==14u){let wear=smoothstep(.52,.77,br_noise3(f.local*9.+vec3<f32>(f.seed)))*f.age*.20;m.albedo=mix(vec3<f32>(.19,.23,.18)*(1.+m.height*120.),m.albedo,wear);m.roughness=.46+wear*.15;}m.albedo*=1.-weather*.12;}
 if(f.mat==5u||f.mat==9u){m=kpMetalSurface(p,f.age,f.wet,0.,fp);if(f.mat==9u){m.albedo=mix(m.albedo,vec3<f32>(.28,.12,.035),.55);}m.albedo*=1.25;}
 if(f.mat==7u){var sp=kpStoneSlateDefaultParams();sp.sourceScaleM=.125;sp.materialScale=.42;sp.mineral=.16;sp.chroma=.22;sp.relief=.24;let across=select(p.z,p.x,abs(n.z)>abs(n.x));let slope=select(p.x,p.z,abs(n.z)>abs(n.x));let slateP=vec3<f32>(across,0.,slope);m=kpStoneSlateSurface(slateP,sp,f.age,f.wet*.25,0.,fp);let row=floor(slope/.38);let phase=fract(vec2<f32>(across+fract(row*.5)*.30,slope)/vec2<f32>(.30,.38));let edge=min(min(phase.x,1.-phase.x)*.30,min(phase.y,1.-phase.y)*.38);let joint=1.-smoothstep(.0015,.0035+fp*.45,edge);m.albedo*=1.-joint*.16;m.height-=joint*.0008;}
 if(f.mat==8u){m=KpSurface((br_noise3(p*5.)-.5)*.0001,vec3<f32>(.85,.93,.89),.09+f.wet*.08);}
 if(f.mat==10u){m=KpSurface(0.,mix(vec3<f32>(.21,.23,.22),vec3<f32>(.27,.29,.27),noise),.95);let line=abs(abs(p.x)-.5);if(p.z< -42.&&p.z> -53.&&line<.07){m.albedo=vec3<f32>(.69,.62,.39);}}
 if(f.mat==15u||f.mat==16u){m=kpStoneSurface(p*.45,f.age,.015,0.,fp*.45);if(f.mat==15u){let tile=floor(p.x/.52)+floor(p.z/.52);let dark=fract(tile*.5)>.25;let tilePhase=fract(p.xz/.52);let joint=min(min(tilePhase.x,1.-tilePhase.x),min(tilePhase.y,1.-tilePhase.y))*.52;let grout=1.-smoothstep(.0015,.0045+fp*.50,joint);let base=select(vec3<f32>(.53,.47,.34),vec3<f32>(.075,.105,.099),dark);m.albedo=mix(base*(.90+.20*br_noise3(p*1.3)),vec3<f32>(.29,.26,.21),grout);let walk=1.-smoothstep(.4,2.1,abs(p.x+35.3));m.roughness=.52-walk*.18;m.height*=.13;}else{let aggregateTone=dot(m.albedo,vec3<f32>(.2126,.7152,.0722));m.albedo=vec3<f32>(.275,.265,.23)*(.94+clamp(aggregateTone,.04,.40)*.24);let lane=1.-smoothstep(.6,1.6,abs(p.x-4.));m.roughness=.86-lane*.13;m.height*=.10;}}
 if(f.mat==17u){m=KpSurface(0.,vec3<f32>(1.,.77,.40),.24);}
 if(f.mat==11u){m=KpSurface(0.,vec3<f32>(1.,.32,.03),.5);}
 if(f.mat==12u){m=KpSurface(0.,vec3<f32>(.023,.065,.054),.42);}
 if(f.mat==13u){m=KpSurface(0.,vec3<f32>(.82,.72,.48),.55);}
 return m;
}
// Bounded tangent-footprint integration of unchanged stone mothers. No texture cache.
fn surface(f:Field,p:vec3<f32>,n:vec3<f32>,fp:f32,dx:vec3<f32>,dy:vec3<f32>)->KpSurface {
 let tangentFp=max(fp,max(length(dx),length(dy)));if((f.mat!=3u&&f.mat!=7u&&f.mat!=2u&&f.mat!=15u&&f.mat!=16u)||tangentFp<.020){return surfaceRaw(f,p,n,tangentFp);}
 var albedo=vec3<f32>(0.);var rough=0.;var height=0.;
 for(var iy=0;iy<4;iy++){for(var ix=0;ix<4;ix++){let offset=dx*((f32(ix)+.5)/4.-.5)+dy*((f32(iy)+.5)/4.-.5);let sm=surfaceRaw(f,p+offset,n,tangentFp*.25);albedo+=sm.albedo;rough+=sm.roughness;height+=sm.height;}}
 return KpSurface(height/16.,albedo/16.,rough/16.);
}
fn sky(rd:vec3<f32>)->vec3<f32>{let horizon=vec3<f32>(.65,.73,.78);let zenith=vec3<f32>(.19,.40,.62);return mix(horizon,zenith,smoothstep(-.1,1.,rd.y));}
// The original material height now participates in the resolved surface normal.
fn materialNormal(f:Field,p:vec3<f32>,n:vec3<f32>,fp:f32)->vec3<f32>{
 // Symmetric derivatives share one physical footprint. Never subtract a raw
 // neighbour from a pixel-filtered centre (that created false floor ripples).
 if(fp>.030||f.mat==8u||f.mat==11u||f.mat==17u){return n;}
 let t=normalize(cross(n,select(vec3<f32>(0.,1.,0.),vec3<f32>(1.,0.,0.),abs(n.y)>.85)));let b=cross(n,t);let e=max(.0025,fp);
 var fxp=f;var fxm=f;var fyp=f;var fym=f;fxp.local+=t*e;fxm.local-=t*e;fyp.local+=b*e;fym.local-=b*e;
 let hx=(surfaceRaw(fxp,p+t*e,n,fp).height-surfaceRaw(fxm,p-t*e,n,fp).height)/(2.*e);
 let hy=(surfaceRaw(fyp,p+b*e,n,fp).height-surfaceRaw(fym,p-b*e,n,fp).height)/(2.*e);
 let retained=1.-smoothstep(.008,.030,fp);return normalize(n-t*clamp(hx,-.18,.18)*retained-b*clamp(hy,-.18,.18)*retained);
}
fn resolvedWeather(f:Field,p:vec3<f32>,n:vec3<f32>,m:KpSurface)->KpSurface {
 if(f.wet<.08||!(f.mat==1u||f.mat==2u||f.mat==3u||f.mat==7u)){return m;}
 let ww=kpV26WaterWeather(p*.10,n,vec3<f32>(p.x,p.y-6.,p.z),vec3<f32>(92.,12.,80.),117.+f.seed,63.+f.seed);
 let state=kpFabricState(f.age,f.wet,ww.x,ww.y,.42,.08,.5,.5,.016,.004,.018);
 return kpApplyFabricSurface(m,state);
}
fn litSurface(f:Field,p:vec3<f32>,ng:vec3<f32>,rd:vec3<f32>,fp:f32,dx:vec3<f32>,dy:vec3<f32>,ao:f32,sh:f32)->vec3<f32>{
 let tangentFp=max(fp,max(length(dx),length(dy)));let raw=surface(f,p,ng,tangentFp,dx,dy);let n=materialNormal(f,p,ng,tangentFp);let m=resolvedWeather(f,p,n,raw);
 let light=normalize(vec3<f32>(-3.,7.,-4.));let nl=max(dot(n,light),0.);
 let inTower=p.x> -42.2&&p.x< -28.7&&p.z> -25.8&&p.z< -10.2&&p.y<6.4;
 let inHall=p.x> -38.45&&p.x< -28.1&&p.z> -39.5&&p.z<39.5&&p.y<11.3;
 let inStore=p.x> -28.1&&p.x<44.5&&p.z> -28.2&&p.z<34.7&&p.y<12.3;
 var ambient=vec3<f32>(.19,.245,.30)*(.65+.35*max(n.y,0.))*ao;
 if(inHall||inTower){ambient=vec3<f32>(.22,.23,.215)*(.50+.50*exp(-abs(p.x+38.4)*.13))*ao;}
 if(inStore){let ridge=abs(repeatX(p.z-3.25,20.833333,1.));ambient=vec3<f32>(.14,.18,.20)*(.55+.45*exp(-ridge*.16))*ao;}
 let spec=pow(max(dot(n,normalize(light-rd)),0.),mix(130.,5.,m.roughness))*(1.-m.roughness)*sh*.55;
 var color=m.albedo*(ambient+vec3<f32>(1.10,1.01,.83)*nl*sh*1.48)+vec3<f32>(spec);
 // Limited fixture fill is tied to actual pendant locations, not a global emissive wash.
 if(inHall||inStore||inTower){let zone=select(select(0u,2u,inStore),5u,inTower);let lp=interiorLightPosition(zone,interiorNearestLight(p,zone))-p;let ld=length(lp);color+=m.albedo*vec3<f32>(1.,.76,.46)*max(dot(n,normalize(lp)),0.)*1.15/(1.+ld*ld*.13);}
 if(f.mat==11u||f.mat==17u){color=m.albedo*select(1.8,2.4,f.mat==17u);}return color;
}
// Secondary intersection is its own compute pass. No material is evaluated here.
fn throughGlass(ro:vec3<f32>,rd:vec3<f32>,start:Hit)->Transmission {
 var t=start.distance+.003;var glassDepth=0.;
 for(var i=0u;i<1400u;i++){let q=ro+rd*t;let f=sceneField(q);if(f.mat==8u&&f.d<.010){let step=max(.003,min(.015,abs(f.d)+.003));glassDepth+=select(0.,step,f.d<0.);t+=step;continue;}
 if(f.d<.003&&f.mat!=0u){return Transmission(t,1u,i+1u,glassDepth);}
 t+=max(.003,abs(f.d)*.75);if(t>start.distance+180.){return Transmission(t,0u,i+1u,glassDepth);}}
 return Transmission(t,2u,1400u,glassDepth);
}
@compute @workgroup_size(8,8) fn transmit(@builtin(global_invocation_id) gid:vec3<u32>){
 if(any(gid.xy>=u.tile.zw)){return;}let idx=gid.y*32u+gid.x;let h=hits[idx];transmission[idx]=Transmission(0.,0u,0u,0.);
 if(h.status!=1u||h.mat!=8u){return;}atomicAdd(&stats.glassRays,1u);
 let rd=ray(vec2<f32>(u.tile.xy+gid.xy)+vec2<f32>(.5));let g=throughGlass(u.eye.xyz,rd,h);transmission[idx]=g;
 if(g.status==2u){atomicAdd(&stats.glassExhausted,1u);}else if(g.status==0u){atomicAdd(&stats.glassMiss,1u);}
}
// Each geometry stage has one textual domain evaluation site. Four tetrahedral
// normal samples are independent invocations, not four cloned building shaders.
fn normalDirection(i:u32)->vec3<f32>{let v=array<vec3<f32>,4>(vec3<f32>(1.,-1.,-1.),vec3<f32>(-1.,-1.,1.),vec3<f32>(-1.,1.,-1.),vec3<f32>(1.,1.,1.));return v[i%4u];}
@compute @workgroup_size(8,8) fn sampleNormals(@builtin(global_invocation_id) gid:vec3<u32>){
 if(any(gid.xy>=u.tile.zw)||gid.z>=8u){return;}let idx=gid.y*32u+gid.x;let h=hits[idx];let g=transmission[idx];let second=gid.z>=4u;
 normalSamples[idx*8u+gid.z]=0.;if(h.status!=1u){return;}if(second&&h.mat!=8u){return;}if(!second&&h.mat==8u&&g.status!=1u){return;}
 let distance=select(select(h.distance,g.distance,h.mat==8u),h.distance,second);let rd=ray(vec2<f32>(u.tile.xy+gid.xy)+vec2<f32>(.5));let ep=max(.002,min(.03,distance/u.resolution.y*.08));
 normalSamples[idx*8u+gid.z]=sceneField(u.eye.xyz+rd*distance+normalDirection(gid.z)*ep).d;
}
fn sampledNormal(idx:u32,offset:u32)->vec3<f32>{var sum=vec3<f32>(0.);for(var i=0u;i<4u;i++){sum+=normalDirection(i)*normalSamples[idx*8u+offset+i];}return normalize(sum);}
@compute @workgroup_size(8,8) fn gatherSurface(@builtin(global_invocation_id) gid:vec3<u32>){
 if(any(gid.xy>=u.tile.zw)){return;}let idx=gid.y*32u+gid.x;let h=hits[idx];let g=transmission[idx];var r:ShadingRecord;
 r.flags=vec4<u32>(h.status,h.mat,0u,0u);r.params=vec4<f32>(0.,0.,1.,h.distance);if(h.status!=1u){shadingRecords[idx]=r;return;}
 var distance=h.distance;if(h.mat==8u){r.flags.z=1u;r.flags.x=g.status;r.glassNormalDepth=vec4<f32>(sampledNormal(idx,4u),g.depth);if(g.status!=1u){shadingRecords[idx]=r;return;}distance=g.distance;}
 let rd=ray(vec2<f32>(u.tile.xy+gid.xy)+vec2<f32>(.5));let p=u.eye.xyz+rd*distance;let f=sceneField(p);
 r.positionDistance=vec4<f32>(p,distance);r.normalAO=vec4<f32>(sampledNormal(idx,0u),1.);r.params=vec4<f32>(f.age,f.wet,1.,h.distance);r.localSeed=vec4<f32>(f.local,f.seed);r.flags.y=f.mat;shadingRecords[idx]=r;
}
@compute @workgroup_size(8,8) fn geometryVisibility(@builtin(global_invocation_id) gid:vec3<u32>){
 if(any(gid.xy>=u.tile.zw)){return;}let idx=gid.y*32u+gid.x;var r=shadingRecords[idx];if(r.flags.x!=1u){return;}
 let p=r.positionDistance.xyz;let n=r.normalAO.xyz;let light=normalize(vec3<f32>(-3.,7.,-4.));var t=.05;var shadowValue=1.;
 for(var i=0u;i<25u;i++){let query=select(p+n*.025+light*t,p+n*.28,i==0u);let f=sceneField(query);
 if(i==0u){r.normalAO.w=clamp(f.d/.28,.24,1.);continue;}
 if(f.mat==8u){t+=max(.025,abs(f.d));continue;}if(f.d<.004){shadowValue=.10;break;}
 shadowValue=min(shadowValue,9.*f.d/t);t+=clamp(f.d*.8,.025,3.);if(t>45.){break;}}
 r.params.z=clamp(shadowValue,.12,1.);shadingRecords[idx]=r;
}
@vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4<f32>{let p=array<vec2<f32>,3>(vec2<f32>(-1,-1),vec2<f32>(3,-1),vec2<f32>(-1,3));return vec4<f32>(p[i],0.,1.);}
@fragment fn shade(@builtin(position) pix:vec4<f32>)->@location(0) vec4<f32>{
 let q=vec2<u32>(pix.xy)-u.tile.xy;let idx=q.y*32u+q.x;let r=shadingRecords[idx];let rd=ray(pix.xy);var color=sky(rd);
 if(r.flags.x==2u){return vec4<f32>(1.,0.,1.,1.);}
 if(r.flags.x==1u){let p=r.positionDistance.xyz;let distance=r.positionDistance.w;let n=r.normalAO.xyz;let f=Field(0.,r.flags.y,r.localSeed.xyz,r.localSeed.w,r.params.x,r.params.y);
 if(u.options.w>.5){return vec4<f32>(fract(vec3<f32>(.37,.57,.79)*f32(f.mat)),1.);}
 let fp=max(.0003,distance*.96/u.resolution.y);let rx=ray(pix.xy+vec2<f32>(1.,0.));let ry=ray(pix.xy+vec2<f32>(0.,1.));let plane=dot(p-u.eye.xyz,n);let dx=clamp(plane/dot(rx,n),0.,320.)*rx-distance*rd;let dy=clamp(plane/dot(ry,n),0.,320.)*ry-distance*rd;
 color=litSurface(f,p,n,rd,fp,dx,dy,r.normalAO.w,r.params.z);}
 if(r.flags.z==1u){let gn=r.glassNormalDepth.xyz;let fresnel=.045+.955*pow(1.-abs(dot(gn,rd)),5.);let transmitted=color*exp(-vec3<f32>(.7,.20,.45)*r.glassNormalDepth.w)*vec3<f32>(.97,.99,.98);color=mix(transmitted,sky(reflect(rd,gn)),clamp(fresnel,.06,.84));}
 if(r.flags.x==1u){color=mix(color,vec3<f32>(.58,.68,.72),1.-exp(-r.params.w*.00018));}
 color=clamp((color*(2.51*color+vec3<f32>(.03)))/(color*(2.43*color+vec3<f32>(.59))+vec3<f32>(.14)),vec3<f32>(0.),vec3<f32>(1.));color=pow(max(color,vec3<f32>(0.)),vec3<f32>(1./2.2));return vec4<f32>(color,1.);
}

`;
export function shaderSource(){return HEADER+skipZeroContributions([KP_BRICK_WGSL,KP_PLASTER_WGSL,KP_V26_WGSL,KP_WOOD_WGSL,KP_STONE_WGSL,KP_STONE_SLATE_WGSL,KP_METAL_WGSL].join('\n'))+DOMAIN+RECEIVER;}
const norm=a=>{const n=Math.hypot(...a);return a.map(x=>x/n)},sub=(a,b)=>a.map((x,i)=>x-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export async function createRenderer(canvas,onProgress=()=>{}){
 const proof={version:'bureau-r03e-right-entry-field-candidate',ready:false,vertexBuffers:0,indexBuffers:0,instanceGeometry:0,appearanceTextures:0,drawVertices:3,compilation:[],errors:[],frames:[],adapter:null};
 if(!navigator.gpu)throw Error('此浏览器没有 WebGPU；没有启用 WebGL 或模型替代。');const adapter=await navigator.gpu.requestAdapter();if(!adapter)throw Error('没有可用的 WebGPU 适配器。');const device=await adapter.requestDevice();proof.adapter={vendor:adapter.info.vendor,device:adapter.info.device,architecture:adapter.info.architecture};device.addEventListener('uncapturederror',e=>proof.errors.push(e.error.message));device.lost.then(e=>proof.errors.push(e.message));onProgress({stage:'device',adapter:proof.adapter});
 const format=navigator.gpu.getPreferredCanvasFormat(),context=canvas.getContext('webgpu');context.configure({device,format,alphaMode:'opaque',usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_DST});
 const uniform=device.createBuffer({size:144,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});const itemBuffer=device.createBuffer({size:128*32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});const hitBuffer=device.createBuffer({size:16384,usage:GPUBufferUsage.STORAGE});const queueBuffer=device.createBuffer({size:4100,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});const statBuffer=device.createBuffer({size:32,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});const transmissionBuffer=device.createBuffer({size:16384,usage:GPUBufferUsage.STORAGE});const shadingBuffer=device.createBuffer({size:98304,usage:GPUBufferUsage.STORAGE});const normalBuffer=device.createBuffer({size:32768,usage:GPUBufferUsage.STORAGE});
 const layout=device.createBindGroupLayout({entries:[{binding:0,visibility:6,buffer:{type:'uniform'}},{binding:1,visibility:6,buffer:{type:'read-only-storage'}},...[2,3,4,5,6,7].map(binding=>({binding,visibility:6,buffer:{type:'storage'}}))]});const pipelineLayout=device.createPipelineLayout({bindGroupLayouts:[layout]});const bind=device.createBindGroup({layout,entries:[uniform,itemBuffer,hitBuffer,queueBuffer,statBuffer,transmissionBuffer,shadingBuffer,normalBuffer].map((buffer,binding)=>({binding,resource:{buffer}}))});
 const full=shaderSource(),pipelines={};for(const [name,entry]of Object.entries({primary:['primary'],resume:['resume'],transmit:['transmit'],sampleNormals:['sampleNormals'],gatherSurface:['gatherSurface'],geometryVisibility:['geometryVisibility'],finalize:['finalize'],shade:['vs','shade']})){const stage=selectStageSource(full,entry);onProgress({stage:'compile-start',name,bytes:stage.bytes});const module=device.createShaderModule({code:stage.code});const info=await module.getCompilationInfo();proof.compilation.push(...info.messages.map(x=>({stage:name,type:x.type,message:x.message,lineNum:x.lineNum})));if(info.messages.some(x=>x.type==='error'))throw Error(JSON.stringify(proof.compilation));pipelines[name]=name==='shade'?await device.createRenderPipelineAsync({layout:pipelineLayout,vertex:{module,entryPoint:'vs'},fragment:{module,entryPoint:'shade',targets:[{format}]},primitive:{topology:'triangle-list'}}):await device.createComputePipelineAsync({layout:pipelineLayout,compute:{module,entryPoint:name}});onProgress({stage:'pipeline',name});}
 let busy=false,texture;async function render(snapshot){if(busy)throw Error('已有画面正在计算');busy=true;proof.ready=false;try{const start=performance.now();const snap=structuredClone(snapshot);const width=snap.width??480,height=snap.height??320;canvas.width=width;canvas.height=height;texture?.destroy();texture=device.createTexture({size:[width,height],format,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC});
 const objects=snap.items??[];if(objects.length>128)throw Error('展示数据超过128个物品的明确上限');const itemData=new Float32Array(128*8);objects.forEach((r,i)=>{itemData.set([...r.position,i+19,...r.size,0],i*8)});device.queue.writeBuffer(itemBuffer,0,itemData);device.queue.writeBuffer(statBuffer,0,new Uint32Array(8));const fw=norm(sub(snap.camera.target,snap.camera.eye)),rt=norm(cross(fw,[0,1,0])),up=norm(cross(rt,fw));let tiles=0;const total=Math.ceil(width/32)*Math.ceil(height/32);
 for(let y=0;y<height;y+=32){for(let x=0;x<width;x+=32){const w=Math.min(32,width-x),h=Math.min(32,height-y),ub=new ArrayBuffer(144),fl=new Float32Array(ub),ui=new Uint32Array(ub);fl.set([...snap.camera.eye,0,...fw,0,...rt,0,...up,0,width,height,width/height,0,snap.cut??0,snap.age??.7,1,snap.debug??0,snap.seconds??0,snap.running===false?0:1,0,0]);ui.set([objects.length,0,0,0,x,y,w,h],28);device.queue.writeBuffer(uniform,0,ub);device.queue.writeBuffer(queueBuffer,0,new Uint32Array(1));const encoder=device.createCommandEncoder();for(const name of['primary','resume','transmit','sampleNormals','gatherSurface','geometryVisibility','finalize']){const pass=encoder.beginComputePass();pass.setPipeline(pipelines[name]);pass.setBindGroup(0,bind);if(name==='resume')pass.dispatchWorkgroups(16);else pass.dispatchWorkgroups(Math.ceil(w/8),Math.ceil(h/8),name==='sampleNormals'?8:1);pass.end();}const pass=encoder.beginRenderPass({colorAttachments:[{view:texture.createView(),clearValue:{r:.35,g:.43,b:.45,a:1},loadOp:tiles?'load':'clear',storeOp:'store'}]});pass.setPipeline(pipelines.shade);pass.setBindGroup(0,bind);pass.setScissorRect(x,y,w,h);pass.draw(3);pass.end();device.queue.submit([encoder.finish()]);await device.queue.onSubmittedWorkDone();tiles++;if(tiles%8===0||tiles===total){const present=device.createCommandEncoder();present.copyTextureToTexture({texture},{texture:context.getCurrentTexture()},[width,height]);device.queue.submit([present.finish()]);onProgress({stage:'render',tiles,total,ms:performance.now()-start});}}}
 const read=device.createBuffer({size:32,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),e=device.createCommandEncoder();e.copyBufferToBuffer(statBuffer,0,read,0,32);device.queue.submit([e.finish()]);await read.mapAsync(GPUMapMode.READ);const values=Array.from(new Uint32Array(read.getMappedRange()));read.unmap();read.destroy();const stats=Object.fromEntries(['hit','miss','exhausted','retried','maxSteps','glassRays','glassMiss','glassExhausted'].map((key,i)=>[key,values[i]]));const frame={view:snap.view,cut:snap.cut,width,height,renderThroughCompletionMs:performance.now()-start,stats,items:objects.length,camera:snap.camera,worldTime:snap.worldTime};proof.frames.push(frame);proof.ready=true;onProgress({stage:'complete',...frame});return frame;}finally{busy=false;}}
 proof.shaderBytes=new TextEncoder().encode(full).length;proof.knownBuffersBytes=144+4096+16384+4100+32+16384+98304+32768;return {render,proof,isBusy:()=>busy};
}
