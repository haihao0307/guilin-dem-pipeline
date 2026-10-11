import * as THREE from '../full/source/registration-vendor/three.module.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const unit=a=>{const n=Math.hypot(...a);if(n<1e-10)throw Error('Degenerate ocular contact frame');return a.map(x=>x/n);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const point=(a,i)=>[a[i*3],a[i*3+1],a[i*3+2]];
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
/** Measured intersection of the current skin surface with the current ocular
 * envelope. Not a drawn ellipse or extra floating tear-line mesh. The field
 * changes shading only; it never edits native geometry or eyelid animation.
 */
export class EyeContactField {
 constructor(model){
  this.model=model;this.updates=0;this.bound=[];
  const skin=model.eyeSurface.skin;
  for(let k=0;k<model.faces.length;k+=3){const t=Array.from(model.faces.slice(k,k+3));if(t.every(i=>skin[i]))this.bound.push(t);}
  this.cachedGeometry=null;this.lastPositions=null;
 }
 update(geometry){
  const model=this.model,P=model.positions;
  if(this.cachedGeometry===geometry&&this.lastPositions&&P.every((v,i)=>v===this.lastPositions[i]))return;
  const L=i=>model.eyeSurface.landmark(i),C=L(27),D=L(8),F=L(30),A=L(36),B=L(45);
  const x=unit(sub(B,A));let y=sub(C,D);y=unit(y.map((v,i)=>v-x[i]*dot(y,x)));let z=unit(cross(x,y));if(dot(z,sub(F,C))<0)z=z.map(v=>-v);
  const project=p=>{const q=sub(p,C);return[dot(q,x),dot(q,y),dot(q,z)];};
  const local=Array.from({length:model.vertexCount},(_,i)=>project(point(P,i))),rows=[],fields=[];
  for(const eye of model.eyeSurface.eyes){
   const pts=eye.vertices.map(i=>local[i]);const lo=[0,1].map(k=>Math.min(...pts.map(p=>p[k]))),hi=[0,1].map(k=>Math.max(...pts.map(p=>p[k]))),n=22,dx=(hi[0]-lo[0])/n,dy=(hi[1]-lo[1])/n,bins=Array.from({length:n*n},()=>[]);
   const cell=(u,v)=>[clamp(Math.floor((u-lo[0])/dx),0,n-1),clamp(Math.floor((v-lo[1])/dy),0,n-1)];
   for(const t of eye.triangles){const p=t.map(i=>local[i]),a=cell(Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1]))),b=cell(Math.max(...p.map(q=>q[0])),Math.max(...p.map(q=>q[1])));for(let j=a[1];j<=b[1];j++)for(let i=a[0];i<=b[0];i++)bins[j*n+i].push(p);}
   const support=(u,v)=>{if(u<lo[0]||u>hi[0]||v<lo[1]||v>hi[1])return null;const c=cell(u,v);let h=-Infinity;for(const[a,b,c0]of bins[c[1]*n+c[0]]){const den=(b[1]-c0[1])*(a[0]-c0[0])+(c0[0]-b[0])*(a[1]-c0[1]);if(Math.abs(den)<1e-14)continue;const aa=((b[1]-c0[1])*(u-c0[0])+(c0[0]-b[0])*(v-c0[1]))/den,bb=((c0[1]-a[1])*(u-c0[0])+(a[0]-c0[0])*(v-c0[1]))/den,cc=1-aa-bb;if(Math.min(aa,bb,cc)<-1e-6)continue;h=Math.max(h,aa*a[2]+bb*b[2]+cc*c0[2]);}return Number.isFinite(h)?h:null;};
   const delta=new Map();for(let i=model.bodyCount;i<model.vertexCount;i++){if(!model.eyeSurface.skin[i])continue;const q=local[i],h=support(q[0],q[1]);if(h!==null&&Math.abs(q[2]-h)<.015)delta.set(i,q[2]-h);}
   const segments=[];
   for(const t of this.bound){if(!t.every(i=>delta.has(i)))continue;const d=t.map(i=>delta.get(i));if(Math.min(...d)>=0||Math.max(...d)<0)continue;const cuts=[];for(let k=0;k<3;k++){const j=(k+1)%3;if((d[k]>=0)===(d[j]>=0))continue;const a=local[t[k]],b=local[t[j]],f=d[k]/(d[k]-d[j]);cuts.push(a.map((v,i)=>v*(1-f)+b[i]*f));}if(cuts.length===2&&Math.hypot(cuts[0][0]-cuts[1][0],cuts[0][1]-cuts[1][1])>1e-8)segments.push(cuts);}
   const side=eye.side==='left'?0:1,center=project(L(eye.side==='left'?42:39));
   fields.push({segments,lo,hi,side,center});rows.push({side:eye.side,contactSegments:segments.length,sourceVertices:eye.vertices.length,sourceTriangles:eye.triangles.length,insideSkinVertices:[...delta.values()].filter(d=>d<0).length});
  }
  const a=geometry.attributes.position,types=geometry.attributes.csType,eyeCoords=geometry.attributes.fEye;
  let attr=geometry.attributes.neContact;if(!attr||attr.count!==a.count){attr=new THREE.BufferAttribute(new Float32Array(a.count*4),4);geometry.setAttribute('neContact',attr);}
  attr.array.fill(0);let samples=0;
  for(let i=model.bodyCount;i<a.count;i++){
   const kind=types.array[i];if(kind>0.5&&kind<3.5)continue;
   const q=project([a.array[i*3],-a.array[i*3+2],a.array[i*3+1]]);
   let nearest=Infinity,weight=0,side=0;
   for(const f of fields){if(q[0]<f.lo[0]-.003||q[0]>f.hi[0]+.003||q[1]<f.lo[1]-.003||q[1]>f.hi[1]+.003)continue;if(kind>3.5&&Math.round(eyeCoords.array[i*4+3])!==f.side)continue;
    for(const[u,v]of f.segments){const vx=v[0]-u[0],vy=v[1]-u[1],len=vx*vx+vy*vy,t=clamp(((q[0]-u[0])*vx+(q[1]-u[1])*vy)/Math.max(len,1e-16),0,1),cx=u[0]+t*vx,cy=u[1]+t*vy,cz=u[2]+t*(v[2]-u[2]),d=Math.hypot(q[0]-cx,q[1]-cy);if(d<nearest&&Math.abs(q[2]-cz)<.010){nearest=d;weight=1;side=f.side;}}
   }
   if(weight){attr.array[i*4]=Math.min(nearest*1000,12);attr.array[i*4+1]=1;attr.array[i*4+2]=kind>3.5?1:0;attr.array[i*4+3]=side;samples++;}
  }
  attr.needsUpdate=true;this.updates++;this.report={version:'ET16-contact@1',updates:this.updates,method:'current native skin/ocular intersection; view-independent; appearance field only',eyes:rows,shadedVertices:samples,addedGeometry:0,nativePositionsChanged:0,clinicalMeasurement:false};this.cachedGeometry=geometry;this.lastPositions=P.slice();
 }
 dispose(){this.cachedGeometry=null;this.lastPositions=null;this.model=null;this.bound=[];}
}
