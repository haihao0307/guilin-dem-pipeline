/** GNM female research candidate: bounded, actual-neck-mesh tip repair.
 * Keeps original GNM roots, teacher part and hair shader unchanged.
 * No universal contact guarantee: this only resolves local neck-tip contact.
 */
export function repairFemaleNeckTips(binding){
 if(binding.region!=='scalp'||!binding.neckCollisionBVH)return {applied:false};
 const b=binding,bvh=b.neckCollisionBVH,p=b.positions,per=b.per,base=p.slice(),gap=.00022,maxMove=.006,affected=new Set();let repairs=0,capCount=0;
 const read=q=>[p[q],p[q+1],p[q+2]],write=(q,point,i)=>{const d=point.map((x,k)=>x-base[q+k]),len=Math.hypot(...d),s=len>maxMove?maxMove/len:1;if(s<1)capCount++;for(let k=0;k<3;k++)p[q+k]=base[q+k]+d[k]*s;affected.add(i);repairs++;};
 const nearNeck=v=>v[1]>.11&&v[1]<.205&&Math.abs(v[0])>.045&&v[2]>-.085&&v[2]<.07;
 const signedHit=v=>{let h=bvh.nearest(v);if(!h)return null;return{...h,signed:v.reduce((a,x,k)=>a+(x-h.p[k])*h.n[k],0)};};
 for(let pass=0;pass<4;pass++)for(let i=0;i<b.count;i++){
  // Only terminal quarter. Roots and the authored upper shape never move.
  const first=Math.max(1,b.segments-6);
  for(let j=first;j<=b.segments;j++){
   const q=(i*per+j)*3,v=read(q);if(!nearNeck(v))continue;const h=signedHit(v);
   if(h&&h.distance<.01&&h.signed<gap)write(q,v.map((x,k)=>x+h.n[k]*(gap-h.signed)),i);
  }
  for(let j=first;j<b.segments;j++){
   const q=(i*per+j)*3,a=read(q),z=read(q+3),mid=a.map((x,k)=>(x+z[k])*.5);if(!nearNeck(mid))continue;
   const h=signedHit(mid),hit=bvh.segmentHit(a,z);if(!h||(!hit&&h.signed>=gap)||h.distance>.01)continue;
   const d=Math.max(gap-h.signed,hit?.00025:0);write(q,a.map((x,k)=>x+h.n[k]*d),i);write(q+3,z.map((x,k)=>x+h.n[k]*d),i);
  }
 }
 let maxDisplacement=0;
 for(const i of affected)for(let j=1;j<per;j++){
  const q=(i*per+j)*3;maxDisplacement=Math.max(maxDisplacement,Math.hypot(p[q]-base[q],p[q+1]-base[q+1],p[q+2]-base[q+2]));
 }
 for(const i of affected)for(let j=0;j<per;j++){
  let q=(i*per+j)*3,a=(i*per+Math.max(0,j-1))*3,z=(i*per+Math.min(b.segments,j+1))*3;
  let d=[0,1,2].map(k=>p[z+k]-p[a+k]),len=Math.hypot(...d)||1;for(let k=0;k<3;k++)b.tangents[q+k]=d[k]/len;
 }
 const result={applied:true,affectedStrands:affected.size,repairs,maxDisplacement,capCount,maxAllowedDisplacement:maxMove,clearance:gap,rootMoved:0,scope:'Actual deformed GNM neck mesh, terminal quarter only; not a full contact certificate'};b.femaleNeckSafety=result;return result;
}

import {TeacherSkinBVH} from './TeacherGroomBinding.js';
/** Repair only strands whose centerline actually crosses current skin/eyes.
 * Bounded local response; roots and untriggered strands are untouched.
 */
export function repairFemaleShaftContacts(b){
 if(b.region!=='scalp')return {applied:false};
 const tree=new TeacherSkinBVH(b.model,b.surfacePositions,null,[0,1,2]),p=b.positions,base=p.slice(),affected=new Set(),gap=.00028,cap=.006;let initialHits=0,remainingHits=0,capped=0;
 const point=q=>[p[q],p[q+1],p[q+2]];
 for(let pass=0;pass<5;pass++){
  const changes=new Map();let hits=0;
  for(let i=0;i<b.count;i++)for(let j=3;j<b.segments;j++){
   const q=(i*b.per+j)*3,a=point(q),z=point(q+3),hit=tree.segmentHit(a,z);if(!hit||hit.t<=1e-6||hit.t>=1-1e-6)continue;hits++;affected.add(i);
   for(const jj of [j,j+1]){
    const qq=(i*b.per+jj)*3,v=point(qq),h=tree.nearest(v),signed=v.reduce((s,x,k)=>s+(x-h.p[k])*h.n[k],0);
    const amount=Math.max(gap-signed,.00030),delta=h.n.map(x=>x*amount);
    for(let near=Math.max(3,jj-1);near<=Math.min(b.segments,jj+1);near++){
     const key=(i*b.per+near)*3,w=near===jj?1:.4,old=changes.get(key)||[0,0,0];
     if(Math.hypot(...old)<Math.hypot(...delta)*w)changes.set(key,delta.map(x=>x*w));
    }
   }
  }
  if(pass===0)initialHits=hits;remainingHits=hits;if(!hits)break;
  for(const[q,delta]of changes){const desired=delta.map((x,k)=>p[q+k]+x-base[q+k]),len=Math.hypot(...desired),s=len>cap?cap/len:1;if(s<1)capped++;for(let k=0;k<3;k++)p[q+k]=base[q+k]+desired[k]*s;}
 }
 let maxDisplacement=0;for(const i of affected)for(let j=0;j<b.per;j++){
  const q=(i*b.per+j)*3;maxDisplacement=Math.max(maxDisplacement,Math.hypot(...[0,1,2].map(k=>p[q+k]-base[q+k])));
  const a=(i*b.per+Math.max(0,j-1))*3,z=(i*b.per+Math.min(b.segments,j+1))*3,d=[0,1,2].map(k=>p[z+k]-p[a+k]),n=Math.hypot(...d)||1;for(let k=0;k<3;k++)b.tangents[q+k]=d[k]/n;
 }
 b.femaleShaftSafety={applied:true,initialHits,lastPassHits:remainingHits,affectedStrands:affected.size,maxDisplacement,cap,capCount:capped,rootMoved:0,scope:'Only actual current-surface centerline crossings; not finite-radius contact certification'};return b.femaleShaftSafety;
}
