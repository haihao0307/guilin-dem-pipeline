// KNIT-DISTANCE-R03: source P02 centreline, shared swept-field approximation.
// A distance-only / B analytic pixel-footprint / C fixed six noise bands.
// No triangle draw calls; fuzzy volume is a new model, not original 960 explicit fibres.
struct Params { eye:vec4<f32>, forward:vec4<f32>, right:vec4<f32>, up:vec4<f32>,
 view:vec4<f32>, control:vec4<f32>, appearance:vec4<f32>, dims:vec4<u32>, }
struct Segment { a:vec4<f32>, b:vec4<f32>, }
struct Field { sd:f32, t:f32, lane:f32, theta:f32, n:vec3<f32>, tangent:vec3<f32>, }
@group(0) @binding(0) var<uniform> g:Params;
@group(0) @binding(1) var<storage,read> segs:array<Segment>;
@group(0) @binding(2) var<storage,read> bins:array<vec2<u32>>;
@group(0) @binding(3) var<storage,read> ids:array<vec4<i32>>;
@group(0) @binding(4) var<storage,read_write> policy:array<vec4<f32>>;
@group(0) @binding(5) var<storage,read_write> pixels:array<vec4<f32>>;
@group(0) @binding(6) var outputTex:texture_storage_2d<rgba8unorm,write>;
const PI:f32=3.14159265359;
const TAU:f32=6.28318530718;
const PITCH:f32=11.6;
const RADIUS:f32=1.72;
fn hash(x:u32)->f32{var n=(x^4291u)*73244475u;n=(n^(n>>16u))*73244475u;return f32(n^(n>>16u))/4294967296.;}
fn h3(p:vec3<i32>)->f32{let x=u32(p.x)*1597334677u;let y=u32(p.y)*3812015801u;let z=u32(p.z)*2798796415u;return hash(x^y^z);}
fn noise(p:vec3<f32>)->f32{let i=vec3<i32>(floor(p));let f=fract(p);let u=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3<i32>(1,0,0)),u.x),mix(h3(i+vec3<i32>(0,1,0)),h3(i+vec3<i32>(1,1,0)),u.x),u.y),mix(mix(h3(i+vec3<i32>(0,0,1)),h3(i+vec3<i32>(1,0,1)),u.x),mix(h3(i+vec3<i32>(0,1,1)),h3(i+vec3<i32>(1,1,1)),u.x),u.y),u.z);}
fn direction(px:vec2<f32>)->vec3<f32>{let q=(px/g.view.xy*2.-1.)*vec2<f32>(g.view.x/g.view.y,-1.);return normalize(g.forward.xyz+g.view.z*(g.right.xyz*q.x+g.up.xyz*q.y));}
fn planePoint(rd:vec3<f32>)->vec3<f32>{let z=select(rd.z,select(-.0001,.0001,rd.z>=0.),abs(rd.z)<.0001);let t=clamp(-g.eye.z/z,0.,20000.);return g.eye.xyz+rd*t;}
fn detailWeights(distance:f32)->array<f32,6>{var a:array<f32,6>;for(var i=0u;i<6u;i++){let end=160.*pow(2.,f32(5u-i))*g.control.y;a[i]=1.-smoothstep(end*.55,end,distance);}return a;}
@compute @workgroup_size(8,8) fn controls(@builtin(global_invocation_id) gid:vec3<u32>){let px=gid.xy;if(any(px>=g.dims.xy)){return;}let index=px.y*g.dims.x+px.x;var measure=g.control.x;
 // Route 0 never reads the viewport, projection scale or yarn/pixel diameter for policy selection.
 // Camera projection still necessarily uses the viewport in every route.
 if(g.dims.z==1u){let rd=direction(vec2<f32>(px)+.5);let p=planePoint(rd);let dx=planePoint(direction(vec2<f32>(px)+vec2<f32>(1.5,.5)))-p;let dy=planePoint(direction(vec2<f32>(px)+vec2<f32>(.5,1.5)))-p;let footprint=max(length(dx),length(dy));measure=footprint/(.68865522658/448.);}
 var w=detailWeights(measure);if(g.dims.z==2u){for(var i=0u;i<6u;i++){w[i]=1.;}}
 // Diagnostic-only locked budget isolates controller overhead without changing detail work.
 if(g.control.z>.5){for(var i=0u;i<6u;i++){w[i]=1.;}}
 policy[index*2u]=vec4<f32>(w[0],w[1],w[2],w[3]);policy[index*2u+1u]=vec4<f32>(w[4],w[5],g.control.x,measure);
}
fn field(p:vec3<f32>)->Field{
 let shift=vec3<f32>(162.4,156.6,0.);let q=p+shift;let cell=vec2<i32>(floor(q.xy/vec2<f32>(PITCH,PITCH*.5)));let local=q.xy-vec2<f32>(cell)*vec2<f32>(PITCH,PITCH*.5);let uv=clamp(vec2<u32>(local/vec2<f32>(PITCH,PITCH*.5)*vec2<f32>(16.,8.)),vec2<u32>(0),vec2<u32>(15,7));
 let bin=bins[uv.y*16u+uv.x];var best=1.e8;var bestT=0.;var bestLane=0.;var bestN=vec3<f32>(0.,0.,1.);var bestTan=vec3<f32>(1.,0.,0.);
 for(var k=0u;k<bin.y;k++){let record=ids[bin.x+k];let col=cell.x+record.y;let row=cell.y+record.z;if(col<0||col>=28||row<0||row>=54){continue;}let s=segs[u32(record.x)];let offset=vec3<f32>(f32(col)*PITCH,f32(row)*PITCH*.5,0.);let a=s.a.xyz+offset;let v=s.b.xyz-s.a.xyz;let t=clamp(dot(q-a,v)/dot(v,v),0.,1.);let d=q-a-v*t;let ds=dot(d,d);if(ds<best){best=ds;bestT=f32(col)+mix(s.a.w,s.b.w,t);bestLane=f32(row);bestN=d;bestTan=normalize(v);}}
 if(best>1.e7){return Field(4.,0.,0.,0.,vec3<f32>(0.,0.,1.),vec3<f32>(1.,0.,0.));}
 let n=normalize(bestN+vec3<f32>(1.e-12));let B=normalize(cross(bestTan,vec3<f32>(0.,0.,1.))+vec3<f32>(1.e-12));let W=normalize(cross(B,bestTan));let a=atan2(dot(n,W),dot(n,B));let phase=hash(u32(i32(floor(bestT)+bestLane*4099.)))*TAU;let ft=fract(bestT);
 let rad=RADIUS*(1.+.038*sin(ft*21.+phase)+.022*sin(ft*49.+phase*3.));let envelope=1.+.055*cos(3.*(a+ft*TAU*2.8*.55))+.022*sin(5.*a+phase+ft*11.);
 return Field(sqrt(best)-rad*envelope,bestT,bestLane,a,n,bestTan);
}
fn slab(ro:vec3<f32>,rd:vec3<f32>)->vec2<f32>{let lo=vec3<f32>(-164.8,-164.,-7.6);let hi=vec3<f32>(164.8,166.,7.6);var a=0.;var b=1.e8;for(var k=0u;k<3u;k++){if(abs(rd[k])<1.e-9){if(ro[k]<lo[k]||ro[k]>hi[k]){return vec2<f32>(1.,-1.);}}else{let x=(lo[k]-ro[k])/rd[k];let y=(hi[k]-ro[k])/rd[k];a=max(a,min(x,y));b=min(b,max(x,y));}}return vec2<f32>(a,b);}
fn volume(f:Field,w:array<f32,6>)->f32{
 if(f.sd<0.||f.sd>1.35||g.appearance.x<.001){return 0.;}
 let height=f.sd;let longCoord=f.t*45.55;let circum=f.theta*RADIUS;var density=.065;var frequency=1.;
 // Six nested anisotropic 3D fields. All coordinates are anchored to yarn/material space.
 // An absent band contributes its approximate mean, never a fully evaluated invisible band.
 for(var i=0u;i<6u;i++){let a=w[i];let mean=.038/(1.+f32(i)*.25);density+=mean*(1.-a);if(a>0.||g.control.w>.5){let q=vec3<f32>(longCoord*.10*frequency,circum*3.1*frequency+sin(longCoord*.16+height)*.18,height*1.3*frequency+f.lane*17.);let ridged=pow(max(0.,1.-abs(noise(q)*2.-1.)),18.);density+=a*ridged*.48/(1.+f32(i)*.25);}frequency*=1.65;}
 return g.appearance.x*density*exp(-height*3.4);
}
fn surfaceNoise(f:Field,w:array<f32,6>)->vec3<f32>{var color=0.;var fibre=0.;var energy=0.;var freq=1.;for(var i=0u;i<6u;i++){let a=w[i];if(a>0.||g.control.w>.5){let phase=f.theta*18.*freq+f.t*TAU*2.8;let v=noise(vec3<f32>(f.t*8.*freq,f.theta*10.*freq+sin(f.t*27.)*.3,f.lane*13.));let wave=sin(phase+v*1.1);color+=a*(v-.5)*.12/pow(1.5,f32(i));fibre+=a*wave*.14/pow(1.4,f32(i));}energy+=(1.-a)*.022;freq*=1.9;}return vec3<f32>(color,fibre,energy);}
fn softShadow(p:vec3<f32>,L:vec3<f32>)->f32{var v=1.;var t=.35;for(var i=0u;i<8u;i++){let d=field(p+L*t).sd;v=min(v,clamp(4.*d/t,0.,1.));t+=max(.35,d*.8);}return .22+.78*v;}
fn surface(f:Field,p:vec3<f32>,rd:vec3<f32>,w:array<f32,6>)->vec3<f32>{let micro=surfaceNoise(f,w);var n=normalize(f.n+cross(f.tangent,f.n)*micro.y);if(dot(n,-rd)<0.){n=-n;}let base=g.appearance.yzw*(1.+micro.x+.025*sin(f.t*31.+f.lane));let L1=normalize(vec3<f32>(-.6,.65,1.));let L2=normalize(vec3<f32>(.7,.25,.85));let H1=normalize(L1-rd);let H2=normalize(L2-rd);let sh=softShadow(p+f.n*.08,L1);let nv=max(0.,dot(n,-rd));let velvet=(.08+micro.z)*pow(1.-nv,2.);let soft=.13+.13*sqrt(max(0.,1.-pow(dot(f.tangent,L1),2.)));let diff1=max(dot(n,L1),0.);let diff2=max(dot(n,L2),0.);let shine=.045*pow(max(0.,dot(n,H1)),12.)+.025*pow(max(0.,dot(n,H2)),12.);return base*(soft+vec3<f32>(1.8,1.48,1.12)*diff1*sh+vec3<f32>(.45,.64,.95)*diff2)+vec3<f32>(velvet+shine);}
fn renderRay(rd:vec3<f32>,w:array<f32,6>)->vec4<f32>{let span=slab(g.eye.xyz,rd);var color=vec3<f32>(.035);if(span.x>span.y){return vec4<f32>(color,1.e8);}var t=span.x;var alpha=0.;var fur=vec3<f32>(0.);var depth=1.e8;
 for(var i=0u;i<128u;i++){if(t>span.y){break;}let p=g.eye.xyz+rd*t;let f=field(p);if(f.sd<.018){color=surface(f,p,rd,w);depth=t;break;}var step=clamp(f.sd*.65,.035,1.7);
  if(f.sd<1.35&&g.appearance.x>.001){step=min(step,.16);let density=volume(f,w);let a=1.-exp(-density*step*3.);let lum=.45+.45*pow(clamp(dot(-rd,normalize(vec3<f32>(.7,.25,.85))),0.,1.),3.);fur+=(1.-alpha)*a*g.appearance.yzw*lum;alpha+=(1.-alpha)*a;}
  t+=step;
 }
 return vec4<f32>(color*(1.-alpha)+fur,depth);
}
@compute @workgroup_size(8,8) fn render(@builtin(global_invocation_id) gid:vec3<u32>){let p=gid.xy;if(any(p>=g.dims.xy)){return;}let index=p.y*g.dims.x+p.x;let a=policy[index*2u];let b=policy[index*2u+1u];let w=array<f32,6>(a.x,a.y,a.z,a.w,b.x,b.y);var sum=vec3<f32>(0.);var depth=1.e8;for(var s=0u;s<2u;s++){let ray=direction(vec2<f32>(p)+select(vec2<f32>(.25,.25),vec2<f32>(.75,.75),s==1u));let c=renderRay(ray,w);sum+=c.xyz*.5;depth=min(depth,c.w);}let color=pow(max(sum/(vec3<f32>(1.)+sum),vec3<f32>(0.)),vec3<f32>(1./2.2));pixels[index]=vec4<f32>(color,depth);textureStore(outputTex,vec2<i32>(p),vec4<f32>(color,1.));}
