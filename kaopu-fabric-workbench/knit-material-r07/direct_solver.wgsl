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

