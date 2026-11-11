// KNIT-MATERIAL-R04: source P02 centreline, shared swept-field approximation.
// A distance-only / B analytic pixel-footprint / C fixed six noise bands.
// No triangle draw calls; fuzzy volume is a new model, not original 960 explicit fibres.
struct Params { eye:vec4<f32>, forward:vec4<f32>, right:vec4<f32>, up:vec4<f32>,
 view:vec4<f32>, control:vec4<f32>, appearance:vec4<f32>, dims:vec4<u32>, geom:vec4<f32>, fabric:vec4<f32>, palette:vec4<f32>, pattern:vec4<f32>, fibre:vec4<f32>, optimization:vec4<f32>, }
struct Segment { a:vec4<f32>, b:vec4<f32>, }
struct Field { sd:f32, t:f32, lane:f32, theta:f32, n:vec3<f32>, tangent:vec3<f32>, }
@group(0) @binding(0) var<uniform> g:Params;
@group(0) @binding(1) var<storage,read> segs:array<Segment>;
@group(0) @binding(2) var<storage,read> bins:array<vec2<u32>>;
@group(0) @binding(3) var<storage,read> ids:array<vec4<i32>>;
@group(0) @binding(4) var<storage,read_write> policy:array<vec4<f32>>;
@group(0) @binding(5) var<storage,read_write> pixels:array<vec4<f32>>;
@group(0) @binding(6) var outputTex:texture_storage_2d<rgba8unorm,write>;
@group(0) @binding(7) var<storage,read_write> hairAccum:array<atomic<u32>>;
const PI:f32=3.14159265359;
const TAU:f32=6.28318530718;


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
 let shift=swatchShift();let q=p+shift;let cell=vec2<i32>(floor(q.xy/vec2<f32>(g.geom.x,g.geom.x*.5*g.geom.y)));let local=q.xy-vec2<f32>(cell)*vec2<f32>(g.geom.x,g.geom.x*.5*g.geom.y);let uv=clamp(vec2<u32>(local/vec2<f32>(g.geom.x,g.geom.x*.5*g.geom.y)*vec2<f32>(16.,8.)),vec2<u32>(0),vec2<u32>(15,7));
 let bin=bins[uv.y*16u+uv.x];var best=1.e8;var bestT=0.;var bestLane=0.;var bestN=vec3<f32>(0.,0.,1.);var bestTan=vec3<f32>(1.,0.,0.);
 for(var k=0u;k<bin.y;k++){let record=ids[bin.x+k];let col=cell.x+record.y;let row=cell.y+record.z;if(col<0||col>=i32(g.fabric.x)||row<0||row>=i32(g.fabric.y)){continue;}let s=segs[u32(record.x)];let offset=vec3<f32>(f32(col)*g.geom.x,f32(row)*g.geom.x*.5*g.geom.y,0.);let a=s.a.xyz+offset;let v=s.b.xyz-s.a.xyz;let t=clamp(dot(q-a,v)/dot(v,v),0.,1.);let d=q-a-v*t;let ds=dot(d,d);if(ds<best){best=ds;bestT=f32(col)+mix(s.a.w,s.b.w,t);bestLane=f32(row);bestN=d;bestTan=normalize(v);}}
 if(best>1.e7){return Field(4.,0.,0.,0.,vec3<f32>(0.,0.,1.),vec3<f32>(1.,0.,0.));}
 let n=normalize(bestN+vec3<f32>(1.e-12));let B=normalize(cross(bestTan,vec3<f32>(0.,0.,1.))+vec3<f32>(1.e-12));let W=normalize(cross(B,bestTan));let a=atan2(dot(n,W),dot(n,B));let phase=hash(u32(i32(floor(bestT)+bestLane*4099.)))*TAU;let ft=fract(bestT);
 let rad=materialYarnRadius(bestT,a,bestLane);let envelope=1.;
 return Field(sqrt(best)-rad*envelope,bestT,bestLane,a,n,bestTan);
}
fn slab(ro:vec3<f32>,rd:vec3<f32>)->vec2<f32>{let sh=swatchShift();let lo=vec3<f32>(-sh.xy-vec2<f32>(g.geom.x),-g.geom.x*.4*g.geom.w-g.geom.z-1.35);let hi=vec3<f32>(sh.xy+vec2<f32>(g.geom.x),g.geom.x*.4*g.geom.w+g.geom.z+1.35);var a=0.;var b=1.e8;for(var k=0u;k<3u;k++){if(abs(rd[k])<1.e-9){if(ro[k]<lo[k]||ro[k]>hi[k]){return vec2<f32>(1.,-1.);}}else{let x=(lo[k]-ro[k])/rd[k];let y=(hi[k]-ro[k])/rd[k];a=max(a,min(x,y));b=min(b,max(x,y));}}return vec2<f32>(a,b);}

//__MATERIAL__
// R06 direct ray / swept-yarn intersection. The original R04 field marcher remains
// available as the reference path and as a conservative fallback for grazing rays
// and silhouette/fuzz-only pixels. No triangle mesh is introduced.
struct YarnFrame { P:vec3<f32>, T:vec3<f32>, B:vec3<f32>, W:vec3<f32>, };
fn centreline(t:f32,lane:f32)->vec3<f32>{
 let local=fract(t);let scaled=local*80.;let si=min(79u,u32(scaled));let u=scaled-f32(si);let s=segs[si];
 return mix(s.a.xyz,s.b.xyz,u)+vec3<f32>(floor(t)*g.geom.x,lane*g.geom.x*.5*g.geom.y,0.)-swatchShift();
}
fn yarnFrame(t:f32,lane:f32)->YarnFrame{
 let P=centreline(t,lane);let T=normalize(centreline(t+.00008,lane)-centreline(t-.00008,lane));
 let B=normalize(cross(T,vec3<f32>(0.,0.,1.))+vec3<f32>(1.e-10));let W=normalize(cross(B,T));return YarnFrame(P,T,B,W);
}
fn yarnPoint(t:f32,theta:f32,lane:f32)->vec3<f32>{
 let f=yarnFrame(t,lane);let radius=materialYarnRadius(t,theta,lane);return f.P+(f.B*cos(theta)+f.W*sin(theta))*radius;
}
fn capsuleMayHitRay(ro:vec3<f32>,rd:vec3<f32>,a:vec3<f32>,b:vec3<f32>,radius:f32)->bool{
 var x=a-ro;var y=b-ro;x-=rd*dot(x,rd);y-=rd*dot(y,rd);let d=y-x;let u=clamp(-dot(x,d)/max(1.e-16,dot(d,d)),0.,1.);let q=x+d*u;return dot(q,q)<=radius*radius;
}
fn solveYarn(ro:vec3<f32>,rd:vec3<f32>,lane:f32,lo:f32,hi:f32,seedT:f32,seedTheta:f32)->vec4<f32>{
 var t=clamp(seedT,lo,hi);var theta=seedTheta;var depth=dot(yarnPoint(t,theta,lane)-ro,rd);
 for(var it=0u;it<10u;it++){
  let S=yarnPoint(t,theta,lane);let residual=S-ro-rd*depth;if(dot(residual,residual)<1.e-8){break;}
  let du=(yarnPoint(t+.00004,theta,lane)-yarnPoint(t-.00004,theta,lane))/.00008;
  let dv=(yarnPoint(t,theta+.0004,lane)-yarnPoint(t,theta-.0004,lane))/.0008;
  let cv=cross(dv,-rd);let det=dot(du,cv);if(abs(det)<1.e-10){break;}
  let delta=vec3<f32>(dot(residual,cv),dot(du,cross(residual,-rd)),dot(du,cross(dv,residual)))/det;
  t-=clamp(delta.x,-.025,.025);theta-=clamp(delta.y,-.65,.65);depth-=clamp(delta.z,-g.geom.x*.5,g.geom.x*.5);
  if(t<lo-.001||t>hi+.001){break;}
 }
 let err=length(yarnPoint(t,theta,lane)-ro-rd*depth);let ok=err<.0015&&t>=lo-.0005&&t<=hi+.0005&&depth>0.;return vec4<f32>(t,theta,depth,select(0.,1.,ok));
}
fn directQuery(ro:vec3<f32>,rd:vec3<f32>)->vec4<f32>{
 if(abs(rd.z)<.045){return vec4<f32>(0.,0.,1.e8,-1.);}
 let planeT=-ro.z/rd.z;if(planeT<=0.){return vec4<f32>(0.,0.,1.e8,-1.);}
 let plane=ro+rd*planeT;let q=plane+swatchShift();let cell=vec2<i32>(floor(q.xy/vec2<f32>(g.geom.x,g.geom.x*.5*g.geom.y)));
 if(cell.x< -2||cell.x>i32(g.fabric.x)+1||cell.y< -4||cell.y>i32(g.fabric.y)+4){return vec4<f32>(0.,0.,1.e8,-1.);}
 let local=q.xy-vec2<f32>(cell)*vec2<f32>(g.geom.x,g.geom.x*.5*g.geom.y);
 let uv=clamp(vec2<u32>(local/vec2<f32>(g.geom.x,g.geom.x*.5*g.geom.y)*vec2<f32>(16.,8.)),vec2<u32>(0),vec2<u32>(15,7));let bin=bins[uv.y*16u+uv.x];
 var best=vec4<f32>(0.,0.,1.e8,-1.);
 for(var k=0u;k<bin.y;k++){
  let rec=ids[bin.x+k];let col=cell.x+rec.y;let row=cell.y+rec.z;
  if(col<0||col>=i32(g.fabric.x)||row<0||row>=i32(g.fabric.y)){continue;}
  let si=u32(rec.x);let s=segs[si];let offset=vec3<f32>(f32(col)*g.geom.x,f32(row)*g.geom.x*.5*g.geom.y,0.)-swatchShift();
  let A=s.a.xyz+vec3<f32>(f32(col)*g.geom.x,f32(row)*g.geom.x*.5*g.geom.y,0.)-swatchShift();let B=s.b.xyz+vec3<f32>(f32(col)*g.geom.x,f32(row)*g.geom.x*.5*g.geom.y,0.)-swatchShift();
  let broadRadius=g.geom.z*1.18+.12;if(!capsuleMayHitRay(ro,rd,A,B,broadRadius)){continue;}
  // Seed Newton from closest approach of the ray and the centreline segment.
  let av=A-ro;let bv=B-ro;let ap=av-rd*dot(av,rd);let bp=bv-rd*dot(bv,rd);let dv=bp-ap;let u=clamp(-dot(ap,dv)/max(1.e-12,dot(dv,dv)),0.,1.);
  let seedT=f32(col)+mix(s.a.w,s.b.w,u);let cp=mix(A,B,u);let rayDepth=dot(cp-ro,rd);let radial=ro+rd*rayDepth-cp;let frame=yarnFrame(seedT,f32(row));let theta=atan2(dot(radial,frame.W),dot(radial,frame.B));
  let lo=f32(col)+s.a.w;let hi=f32(col)+s.b.w;let hit=solveYarn(ro,rd,f32(row),lo,hi,seedT,theta);
  if(hit.w>0.&&hit.z<best.z){best=vec4<f32>(hit.xyz,f32(row));}
 }
 return best;
}
fn directSurface(f:Field,p:vec3<f32>,rd:vec3<f32>,w:array<f32,6>)->vec3<f32>{return surface(f,p,rd,w);}
fn renderRayDirect(rd:vec3<f32>,w:array<f32,6>)->vec4<f32>{
 let span=slab(g.eye.xyz,rd);if(span.x>span.y){return vec4<f32>(.035,.035,.035,1.e8);}
 if(abs(rd.z)>=.045){let pt=-g.eye.z/rd.z;let q=(g.eye.xyz+rd*pt)+swatchShift();let half=vec2<f32>(g.fabric.x*g.geom.x*.5,g.fabric.y*g.geom.x*.25*g.geom.y);if(pt>0.&&(abs(q.x)>half.x+3.0||abs(q.y)>half.y+3.0)){return vec4<f32>(.035,.035,.035,1.e8);}}
 let h=directQuery(g.eye.xyz,rd);
 // Conservative fallback preserves grazing/silhouette cases and any ray whose
 // direct Newton solve did not converge. This is not silently treated as a miss.
 if(h.w<0.||h.z<span.x-.02||h.z>span.y+.02){atomicAdd(&hairAccum[g.dims.x*g.dims.y*4u],1u);return renderRayMarch(rd,w);}atomicAdd(&hairAccum[g.dims.x*g.dims.y*4u+1u],1u);
 let p=g.eye.xyz+rd*h.z;let fr=yarnFrame(h.x,h.w);let B=fr.B;let W=fr.W;let n=normalize(B*cos(h.y)+W*sin(h.y));let f=Field(0.,h.x,h.w,h.y,n,fr.T);
 var alpha=0.;var fur=vec3<f32>(0.);
 // Integrate the same short-fuzz field in a bounded band immediately outside the
 // exact yarn hit; 6 samples replace the full 128-step search for this ray.
 for(var i=0u;i<6u;i++){
  let sampleDepth=max(span.x,h.z-(f32(i)+.5)*.16);let sampleP=g.eye.xyz+rd*sampleDepth;let sf=field(sampleP);
  if(sf.sd>=0.&&sf.sd<1.35&&g.appearance.x>.001&&g.fibre.z>.001){let density=volume(sf,w);let a=1.-exp(-density*.16*3.);let lum=.45+.45*pow(clamp(dot(-rd,normalize(vec3<f32>(.7,.25,.85))),0.,1.),3.);fur+=(1.-alpha)*a*materialColor(vec2<f32>(sf.t,sf.lane))*lum;alpha+=(1.-alpha)*a;}
 }
 let color=directSurface(f,p,rd,w);return vec4<f32>(color*(1.-alpha)+fur,h.z);
}


fn softShadow(p:vec3<f32>,L:vec3<f32>)->f32{var v=1.;var t=.35;for(var i=0u;i<8u;i++){let d=field(p+L*t).sd;v=min(v,clamp(4.*d/t,0.,1.));t+=max(.35,d*.8);}return .22+.78*v;}
fn surface(f:Field,p:vec3<f32>,rd:vec3<f32>,w:array<f32,6>)->vec3<f32>{let micro=surfaceNoise(f,w);var n=normalize(f.n+cross(f.tangent,f.n)*micro.y);if(dot(n,-rd)<0.){n=-n;}let base=materialColor(vec2<f32>(f.t,f.lane))*(1.+micro.x+.025*sin(f.t*31.+f.lane));let L1=normalize(vec3<f32>(-.6,.65,1.));let L2=normalize(vec3<f32>(.7,.25,.85));let H1=normalize(L1-rd);let H2=normalize(L2-rd);let sh=softShadow(p+f.n*.08,L1);let nv=max(0.,dot(n,-rd));let velvet=(.08+micro.z)*pow(1.-nv,2.);let soft=.13+.13*sqrt(max(0.,1.-pow(dot(f.tangent,L1),2.)));let diff1=max(dot(n,L1),0.);let diff2=max(dot(n,L2),0.);let shine=.045*pow(max(0.,dot(n,H1)),12.)+.025*pow(max(0.,dot(n,H2)),12.);return base*(soft+vec3<f32>(1.8,1.48,1.12)*diff1*sh+vec3<f32>(.45,.64,.95)*diff2)+vec3<f32>(velvet+shine);}
fn renderRayMarch(rd:vec3<f32>,w:array<f32,6>)->vec4<f32>{if(g.fibre.w>.5){let p=planePoint(rd);let sh=swatchShift();if(abs(p.x)<sh.x&&abs(p.y)<sh.y){let t=length(p-g.eye.xyz);let check=f32((i32(floor(p.x/10.))+i32(floor(p.y/10.)))&1);return vec4<f32>(vec3<f32>(.18+.04*check),t);}return vec4<f32>(.035,.035,.035,1.e8);}
 let span=slab(g.eye.xyz,rd);var color=vec3<f32>(.035);if(span.x>span.y){return vec4<f32>(color,1.e8);}var t=span.x;var alpha=0.;var fur=vec3<f32>(0.);var depth=1.e8;
 for(var i=0u;i<128u;i++){if(t>span.y){break;}let p=g.eye.xyz+rd*t;let f=field(p);if(f.sd<.018){color=surface(f,p,rd,w);depth=t;break;}var step=clamp(f.sd*.65,.035,1.7);
  if(f.sd<1.35&&g.appearance.x>.001&&g.fibre.z>.001){step=min(step,.16);let density=volume(f,w);let a=1.-exp(-density*step*3.);let lum=.45+.45*pow(clamp(dot(-rd,normalize(vec3<f32>(.7,.25,.85))),0.,1.),3.);fur+=(1.-alpha)*a*materialColor(vec2<f32>(f.t,f.lane))*lum;alpha+=(1.-alpha)*a;}
  t+=step;
 }
 return vec4<f32>(color*(1.-alpha)+fur,depth);
}
fn renderRay(rd:vec3<f32>,w:array<f32,6>)->vec4<f32>{if(g.optimization.y>.5&&g.fibre.w<.5){return renderRayDirect(rd,w);}return renderRayMarch(rd,w);}
@compute @workgroup_size(8,8) fn render(@builtin(global_invocation_id) gid:vec3<u32>){let p=gid.xy+vec2<u32>(0u,g.dims.w);if(any(p>=g.dims.xy)){return;}let index=p.y*g.dims.x+p.x;let a=policy[index*2u];let b=policy[index*2u+1u];let w=array<f32,6>(a.x,a.y,a.z,a.w,b.x,b.y);var sum=vec3<f32>(0.);var depth=1.e8;for(var s=0u;s<2u;s++){let ray=direction(vec2<f32>(p)+select(vec2<f32>(.25,.25),vec2<f32>(.75,.75),s==1u));let c=renderRay(ray,w);sum+=c.xyz*.5;depth=min(depth,c.w);}let color=pow(max(sum/(vec3<f32>(1.)+sum),vec3<f32>(0.)),vec3<f32>(1./2.2));pixels[index]=vec4<f32>(sum,depth);textureStore(outputTex,vec2<i32>(p),vec4<f32>(color,1.));}

// Analytic planar carrier. These are shader functions, not a triangle mesh.
fn swatchShift()->vec3<f32>{return vec3<f32>(g.fabric.x*g.geom.x*.5,g.fabric.y*g.geom.x*.25*g.geom.y,0.);}
fn project(p:vec3<f32>)->vec3<f32>{let q=p-g.eye.xyz;let z=dot(q,g.forward.xyz);let ndc=vec2<f32>(dot(q,g.right.xyz)/(g.view.z*g.view.x/g.view.y),-dot(q,g.up.xyz)/g.view.z)/max(.001,z);return vec3<f32>((ndc*.5+.5)*g.view.xy,z);}
@compute @workgroup_size(8,8) fn clearHairs(@builtin(global_invocation_id) gid:vec3<u32>){if(any(gid.xy>=g.dims.xy)){return;}let i=(gid.y*g.dims.x+gid.x)*4u;for(var j=0u;j<4u;j++){atomicStore(&hairAccum[i+j],0u);}if(gid.x==0u&&gid.y==0u){atomicStore(&hairAccum[g.dims.x*g.dims.y*4u],0u);atomicStore(&hairAccum[g.dims.x*g.dims.y*4u+1u],0u);}}
@compute @workgroup_size(64) fn hairs(@builtin(global_invocation_id) gid:vec3<u32>){
    if(g.fibre.w>.5||g.appearance.x<.001){return;}
    let index=gid.x+gid.y*16384u+g.dims.w;let count=u32(g.fabric.z);let total=u32(g.fabric.x*g.fabric.y)*count;
    if(index>=total||count==0u){return;}
    let needle=index/count;let col=needle%u32(g.fabric.x);let row=needle/u32(g.fabric.x);let j=index%count;
    let id=(row*4099u+col)*997u+j+u32(g.pattern.z)*391u;
    let at=hash(id*13u+4u);let seg=min(79u,u32(at*80.));let s=segs[seg];let u=fract(at*80.);
    let T=normalize(s.b.xyz-s.a.xyz);let B=normalize(cross(T,vec3<f32>(0.,0.,1.))+vec3<f32>(1.e-9));let W=normalize(cross(B,T));
    let theta=hash(id*7u+1u)*TAU;let Q=normalize(B*cos(theta)+W*sin(theta));
    let root=mix(s.a.xyz,s.b.xyz,u)+vec3<f32>(f32(col)*g.geom.x,f32(row)*g.geom.x*.5*g.geom.y,0.)-swatchShift()+Q*(materialYarnRadius(f32(col)+at,theta,f32(row))+.025);
    let population=hash(id*29u);let len=g.fabric.w*(.3+.7*pow(hash(id*31u),1.2))*select(1.,1.7,population>.985);
    let projected=project(root);let reach=len*2.*g.view.y/(max(1.,projected.z)*g.view.z)+4.;
    if(projected.z<1.||any(projected.xy<vec2<f32>(-reach))||any(projected.xy>g.view.xy+vec2<f32>(reach))){return;}
    let V=normalize(g.eye.xyz-root);let light=normalize(vec3<f32>(-.6,.65,1.));
    let nl=max(0.,dot(Q,light));let wrap=.40+.38*sqrt(max(0.,1.-pow(dot(T,light),2.)));
    let fiberColor=materialColor(vec2<f32>(f32(col)+at,f32(row)))*(wrap+nl*.9)*(.86+.28*hash(id*97u));
    var a=project(root);
    for(var k=1u;k<=8u;k++){
        let b=project(strandPoint(root,T,B,W,Q,id,f32(k)/8.,len));
        if(min(a.z,b.z)<1.){a=b;continue;}
        let physicalRadius=g.fibre.x*.5*g.view.y/(g.view.z*(a.z+b.z));let radius=max(.55,physicalRadius);
        let lo=max(vec2<i32>(0),vec2<i32>(floor(min(a.xy,b.xy)-vec2<f32>(radius+1.))));let hi=min(vec2<i32>(g.dims.xy)-vec2<i32>(1),vec2<i32>(ceil(max(a.xy,b.xy)+vec2<f32>(radius+1.))));
        let d=b.xy-a.xy;let dd=max(.000001,dot(d,d));
        for(var y=lo.y;y<=hi.y;y++){for(var x=lo.x;x<=hi.x;x++){
            let xy=vec2<f32>(f32(x)+.5,f32(y)+.5);let t=clamp(dot(xy-a.xy,d)/dd,0.,1.);let edge=length(xy-a.xy-d*t);
            let cover=(1.-smoothstep(max(0.,radius-.5),radius+.5,edge))*min(1.,physicalRadius/.55);
            if(cover<.002){continue;}
            let z=1./mix(1./a.z,1./b.z,t);let pi=u32(y)*g.dims.x+u32(x);let baseDepth=pixels[pi].w*dot(direction(xy),g.forward.xyz);
            if(z>baseDepth+.025){continue;}
            // Hair depth test is real; hair/hair transparency is an optical-depth approximation.
            let tau=min(.7,cover*.38*g.appearance.x);let weight=u32(tau*65536.);let off=pi*4u;
            atomicAdd(&hairAccum[off],u32(fiberColor.x*f32(weight)));atomicAdd(&hairAccum[off+1u],u32(fiberColor.y*f32(weight)));atomicAdd(&hairAccum[off+2u],u32(fiberColor.z*f32(weight)));atomicAdd(&hairAccum[off+3u],weight);
        }}a=b;
    }
}
@compute @workgroup_size(8,8) fn composite(@builtin(global_invocation_id) gid:vec3<u32>){
    let p=gid.xy;if(any(p>=g.dims.xy)){return;}let i=p.y*g.dims.x+p.x;let off=i*4u;let weight=f32(atomicLoad(&hairAccum[off+3u]));var c=pixels[i].xyz;
    if(weight>0.){let hair=vec3<f32>(f32(atomicLoad(&hairAccum[off])),f32(atomicLoad(&hairAccum[off+1u])),f32(atomicLoad(&hairAccum[off+2u])))/weight;let alpha=1.-exp(-weight/65536.);c=mix(c,hair,alpha);}
    c=pow(max(c/(vec3<f32>(1.)+c),vec3<f32>(0.)),vec3<f32>(1./2.2));pixels[i]=vec4<f32>(c,pixels[i].w);textureStore(outputTex,vec2<i32>(p),vec4<f32>(c,1.));
}
