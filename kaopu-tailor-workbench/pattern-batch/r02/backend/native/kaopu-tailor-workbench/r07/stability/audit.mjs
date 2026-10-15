// Positive-area coplanar overlap in mm; shared edges alone have zero area.
// Final-state check only. Does not certify the trajectory or physical fabric.
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const orient=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
export function coplanarPositiveOverlap(a,b){
 const n=cross(sub(a[1],a[0]),sub(a[2],a[0])),nn=Math.hypot(...n);if(nn<1e-12)return false;
 const unit=n.map(v=>v/nn);if(b.some(p=>Math.abs(dot(sub(p,a[0]),unit))>1e-5))return false;
 const axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs))),proj=p=>p.filter((_,k)=>k!==axis),clip=b.map(proj);let polygon=a.map(proj);
 const sign=Math.sign(orient(clip[0],clip[1],clip[2]));if(!sign)return false;
 for(let i=0;i<3;i++){
  const A=clip[i],B=clip[(i+1)%3],input=polygon;polygon=[];if(!input.length)return false;
  for(let j=0;j<input.length;j++){
   const P=input[j],Q=input[(j+1)%input.length],dp=orient(A,B,P)*sign,dq=orient(A,B,Q)*sign,ip=dp>=0,iq=dq>=0;
   if(ip)polygon.push(P);
   if(ip!==iq){const t=dp/(dp-dq);polygon.push(P.map((v,k)=>v+t*(Q[k]-v)));}
  }
 }
 let area=0;for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length];area+=p[0]*q[1]-q[0]*p[1];}
 return Math.abs(area)*.5>1e-4;
}
export function staticGate(lab,record,regions,intersections){
 let minimumDistance=Infinity,invalidBodySamples=0;const q=new Float64Array(5);
 for(let i=0;i<lab.positions.length;i++)if(lab.stitchGroups.find(i)===i){lab.sdf.sample(...lab.positions[i],q);if(!q[4])invalidBodySamples++;else minimumDistance=Math.min(minimumDistance,q[0]*1000);}
 let compression=0;for(const t of lab.strainTriangles){
  const U=[0,0,0],V=[0,0,0];for(let j=0;j<3;j++)for(let k=0;k<3;k++){U[k]+=t.c[j]*lab.positions[t.ids[j]][k];V[k]+=t.d[j]*lab.positions[t.ids[j]][k];}
  const a=dot(U,U),b=dot(V,V),ab=dot(U,V),lo=Math.sqrt(Math.max(0,(a+b-Math.hypot(a-b,2*ab))*.5));compression=Math.max(compression,1-lo);
 }
 const failures=[];if(!record.metrics.finite)failures.push('nonfinite');if(invalidBodySamples)failures.push('outside-body-field');if(minimumDistance<-.05)failures.push('inside-body');if(intersections.bodyIntersectingFaceCount)failures.push('body-intersections');if(intersections.selfStrictTriangleIntersectionCount)failures.push('cloth-intersections');if(regions.all.maximumPercent>15)failures.push('tension-over-15pct');if(compression>.15)failures.push('compression-over-15pct');if(record.metrics.activeMaxGapMm>.25)failures.push('needle-gap-over-0.25mm');
 return {schema:'kaopu-static-garment-check@1',passed:!failures.length,failures,maximumCompressionPercent:compression*100,minimumBodyVertexDistanceMm:minimumDistance,invalidBodySamples,thresholds:{maximumTensionPercent:15,maximumCompressionPercent:15,maximumNeedleGapMm:.25,minimumBodyDistanceMm:-.05},engineeringThresholdsNotFabricCalibration:true,continuousCollisionCertified:false,dynamicWearCertified:false};
}
