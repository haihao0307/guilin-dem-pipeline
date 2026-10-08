const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(root+'/index.html','utf8'),geometry=html.match(/<script id="geometry">([\s\S]*?)<\/script>/)[1];
const context={};vm.createContext(context);vm.runInContext(geometry,context);const H=context.HyperMath;
const close=(a,b,e=1e-8)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const results=[],origin=[0,0,1];let maxNormError=0,maxDistanceError=0,maxRoundtrip=0;
for(const k of [0,.3]){
 for(let i=0;i<120;i++){
  const a=H.point((i%25)*.21,i*.817,k),b=H.point((i%31)*.17,i*.512+1,k);
  if(k)maxNormError=Math.max(maxNormError,Math.abs(H.dot(a,a)-1));
  close(H.distance(a,b,k),H.distance(b,a,k));close(H.distance(origin,a,k),(i%25)*.21,2e-7);
  if(H.distance(a,b,k)>.001){const v=H.tangent(a,b,k),d=H.distance(a,b,k),m=H.interpolate(a,b,.37,k);if(k){close(H.dot(a,v),0);close(H.dot(v,v),-1);}maxDistanceError=Math.max(maxDistanceError,Math.abs(H.distance(a,m,k)-d*.37),Math.abs(H.distance(m,b,k)-d*.63));}
 }
 let frame=H.initial();for(let i=0;i<1000;i++){const d=.03+(i%7)*.01,df=Math.sin(i),dr=Math.cos(i);const next=H.step(frame,df,dr,d,k);if(k){close(H.dot(next.p,next.p),1);close(H.dot(next.f,next.f),-1);close(H.dot(next.r,next.r),-1);close(H.dot(next.p,next.f),0);close(H.dot(next.p,next.r),0);close(H.dot(next.f,next.r),0);}const back=H.step(next,-df,-dr,d,k);maxRoundtrip=Math.max(maxRoundtrip,H.distance(frame.p,back.p,k));frame=H.turn(frame,.032);}
 const points=[0,1,2].map(i=>H.point(3.6,i*Math.PI*2/3,k)),tri=H.triangle(points,k);for(const p of points)close(H.distance(origin,p,k),3.6);tri.sides.forEach(s=>close(s,tri.sides[0]));tri.angles.forEach(a=>close(a,tri.angles[0]));if(k){assert(tri.sum<Math.PI);close(tri.area*k*k,tri.defect);}else close(tri.sum,Math.PI);
 results.push({curvature:-k*k,centerToBeacon:3.6,side:tri.sides[0],anglesDegrees:tri.angles.map(a=>a*180/Math.PI),angleSumDegrees:tri.sum*180/Math.PI,defectDegrees:tri.defect*180/Math.PI,area:tri.area});
}
for(let i=0;i<50;i++){const a=H.point(i*.06,.7*i,.3),b=H.point(i*.05,1.2*i,.3),x=(i-25)*.014,c=Math.cosh(x),s=Math.sinh(x),boost=p=>[c*p[0]+s*p[2],p[1],s*p[0]+c*p[2]];close(H.distance(a,b,.3),H.distance(boost(a),boost(b),.3),5e-7);}
assert(results[0].side<results[1].side);assert(maxRoundtrip<1e-6);assert(maxDistanceError<1e-7);
const report={status:'PASS',testType:'Actual numerical geometry kernel extracted from the delivered single HTML file',checks:['hyperboloid norm','distance symmetry','radial distances in both geometries','unit tangent and orthogonality','geodesic interpolation distance','parallel transport orthonormality','1000 forward/reverse movements per mode','Lorentz isometry preserves pairwise distance','three beacon distances held constant','equilateral triangle side consistency','negative-curvature angle deficit','Euclidean angle sum 180 degrees','Gauss-Bonnet area/defect identity'],maxNormError,maxDistanceError,maxRoundtrip,comparisons:results};fs.writeFileSync(root+'/tests/math-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
