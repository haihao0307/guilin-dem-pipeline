/** Neutral-GNM ear clearance, not a replacement head or a dynamics solver.
 * Reuses R12's measured conservative ear fits, refitted to actual triangle vertices.
 * Changes a shaft ONLY after an exact segment/ear-triangle intersection.
 * The root is immutable. A smooth local outward displacement clears the convex
 * envelope; remaining segment intersections are counted rather than hidden.
 */
import {TeacherSkinBVH} from './TeacherGroomBinding.js';
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),sub=(a,b)=>a.map((x,k)=>x-b[k]);
const clamp=x=>Math.max(0,Math.min(1,x));
export class NeutralEarGuard {
 constructor(model){
  const p=model.template,tr=model.triangles;
  this.ears=[{side:-1,center:[-.07675252,.26868798,.02327114],radii:[.01916620,.05351353,.03739677]},{side:1,center:[.07671676,.26864847,.02327088],radii:[.01928778,.05340873,.03732307]}].map(f=>{
   const ids=new Set(),triangles=new Set();
   for(let t=0;t<tr.length/3;t++){
    const vs=[tr[t*3],tr[t*3+1],tr[t*3+2]];if(vs.some(v=>model.componentId[v]!==0))continue;
    if(vs.some(v=>p[v*3]*f.side>.063&&p[v*3+1]>.235&&p[v*3+1]<.314&&p[v*3+2]>-.005&&p[v*3+2]<.05)){triangles.add(t);vs.forEach(v=>ids.add(v));}
   }
   let factor=1;for(const id of ids)factor=Math.max(factor,Math.hypot(...f.center.map((c,k)=>(p[id*3+k]-c)/f.radii[k])));
   return {...f,radii:f.radii.map(v=>v*factor*1.00001),bvh:new TeacherSkinBVH(model,p,triangles),vertices:ids.size,triangles:triangles.size};
  });
  this.total={curvesChecked:0,triggered:0,corrected:0,unresolvedSegments:0,maxDisplacement:0};
 }
 overlap(a,b,ear){const box=ear.bvh.root;for(let k=0;k<3;k++)if(Math.min(a[k],b[k])>box.max[k]+.00015||Math.max(a[k],b[k])<box.min[k]-.00015)return false;return true;}
 need(a,b,ear){
  const c=ear.center,r=ear.radii.map(v=>v+.0004),side=ear.side,u=a.map((x,k)=>(x-c[k])/r[k]),v=b.map((x,k)=>(x-a[k])/r[k]);
  const A=v[1]*v[1]+v[2]*v[2],B=2*(u[1]*v[1]+u[2]*v[2]),C=u[1]*u[1]+u[2]*u[2]-1;let lo=0,hi=1;
  if(A>1e-16){const disc=B*B-4*A*C;if(disc<0)return 0;const q=Math.sqrt(disc);lo=Math.max(0,(-B-q)/(2*A));hi=Math.min(1,(-B+q)/(2*A));if(lo>hi)return 0;}else if(C>0)return 0;
  const required=t=>side*c[0]+r[0]*Math.sqrt(Math.max(0,1-(u[1]+v[1]*t)**2-(u[2]+v[2]*t)**2))-side*(a[0]+(b[0]-a[0])*t);
  let l=lo,h=hi,x=h-(h-l)*.61803398875,y=l+(h-l)*.61803398875,fx=required(x),fy=required(y);
  for(let i=0;i<24;i++){if(fx<fy){l=x;x=y;fx=fy;y=l+(h-l)*.61803398875;fy=required(y);}else{h=y;y=x;fy=fx;x=h-(h-l)*.61803398875;fx=required(x);}}
  return Math.max(0,required(lo),required(hi),fx,fy)+.00005;
 }
 apply(points){
  this.total.curvesChecked++;const original=points.map(p=>p.slice()),n=points.length,arc=[0];for(let j=1;j<n;j++)arc.push(arc[j-1]+Math.hypot(...sub(points[j],points[j-1])));
  let triggered=false;
  for(let pass=0;pass<3;pass++){
   let changed=false;
   for(const ear of this.ears){
    const req=new Float64Array(n);let hits=0;
    for(let j=1;j<n;j++)if(this.overlap(points[j-1],points[j],ear)&&ear.bvh.segmentHit(points[j-1],points[j])){const d=this.need(points[j-1],points[j],ear);if(d>0){req[j]=Math.max(req[j],d);if(j>1)req[j-1]=Math.max(req[j-1],d);hits++;}}
    if(!hits)continue;triggered=true;changed=true;const shift=new Float64Array(n);
    for(let j=1;j<n;j++)for(let k=1;k<n;k++)if(req[k]>0){const t=Math.abs(arc[j]-arc[k])/.025;if(t<1)shift[j]=Math.max(shift[j],req[k]*(1-t*t*(3-2*t)));}
    for(let j=1;j<n;j++)points[j][0]+=ear.side*shift[j];
   }
   if(!changed)break;
  }
  if(triggered){
   this.total.triggered++;this.total.corrected++;
   for(let j=1;j<n;j++){this.total.maxDisplacement=Math.max(this.total.maxDisplacement,Math.hypot(...sub(points[j],original[j])));for(const ear of this.ears)if(this.overlap(points[j-1],points[j],ear)&&ear.bvh.segmentHit(points[j-1],points[j]))this.total.unresolvedSegments++;}
  }
  return points;
 }
 diagnostics(){return{...this.total,scope:'neutral ears; exact triggering; convex proxy correction; root fixed; no full swept-radius guarantee',fittedTriangles:this.ears.map(e=>e.triangles),fittedVertices:this.ears.map(e=>e.vertices)};}
}
