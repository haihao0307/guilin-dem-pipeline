/** Original area-weighted barycentric pore seeds, restricted to the bound ear.
 * Seeds attach to triangle IDs, not a projected plane. Evaluation uses CURRENT
 * surface-space millimetres, so bending cannot stretch the circular kernel.
 * Sampling density/radii are authored appearance parameters, not histology. */
export const CELL_MM=.50, MAX_BUCKET=128;
export const hashCell=(x,y,z,mask)=>((Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791))>>>0)&mask;
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const at=(p,i)=>[p[3*i],p[3*i+1],p[3*i+2]];
const unit=p=>{const l=Math.hypot(...p)||1;return p.map(x=>x/l)};
export const baryPoint=(P,ids,b)=>[0,1,2].map(k=>P[ids[0]*3+k]*b[0]+P[ids[1]*3+k]*b[1]+P[ids[2]*3+k]*b[2]);
export function seedPores(g,seed=731047){
 const R=g.attributes.fRest.array,W=g.attributes.eWeight.array,I=g.index.array,tri=[],cum=[];let area=0;
 let state=seed>>>0;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 for(let k=0;k<I.length;k+=3){const ids=[I[k],I[k+1],I[k+2]];if(ids.some(i=>W[i]<.08))continue;
  const a=at(R,ids[0]),b=at(R,ids[1]),c=at(R,ids[2]),ar=Math.hypot(...cross(sub(b,a),sub(c,a)))*5e5;
  if(ar<=1e-8)continue;area+=ar;tri.push(ids);cum.push(area);
 }
 if(!area)throw Error('No owned pinna area for surface sampling');
 const goal=Math.min(24000,Math.round(area/1.0)),samples=[],grid=new Map(),spacing=.34;
 for(let tries=0;tries<goal*7&&samples.length<goal;tries++){
  const q=rand()*area;let lo=0,hi=cum.length-1;while(lo<hi){const m=(lo+hi)>>1;if(cum[m]<q)lo=m+1;else hi=m}
  const r=Math.sqrt(rand()),b=[1-r,r*(1-rand()),0];b[2]=1-b[0]-b[1];const ids=tri[lo],p=baryPoint(R,ids,b).map(x=>x*1000),cell=p.map(x=>Math.floor(x/spacing));
  let close=false;for(let x=-1;x<=1&&!close;x++)for(let y=-1;y<=1&&!close;y++)for(let z=-1;z<=1&&!close;z++)for(const v of grid.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))||[]){if(p.reduce((s,a,k)=>s+(a-v[k])**2,0)<spacing**2){close=true;break}}
  if(close)continue;const key=cell.join(',');if(!grid.has(key))grid.set(key,[]);grid.get(key).push(p);
  samples.push({ids,b,radiusMM:.032+rand()*.022,depthMM:.003+rand()*.002,rest:p});
 }
 return {samples,areaMM2:area,seed,method:'area CDF + sqrt barycentric sampling + 3D Poisson rejection on owned template',minimumSeedSeparationMM:spacing};
}
export function updateSamples(binding,g){
 const P=g.attributes.position.array,N=g.attributes.normal.array,records=[];
 for(const s of binding.samples){const p=baryPoint(P,s.ids,s.b).map(x=>x*1000),n=unit(baryPoint(N,s.ids,s.b));records.push({p,n,r:s.radiusMM,h:s.depthMM,ids:s.ids,b:s.b})}
 return records;
}
/** Every cell intersecting a bounded support is populated, not only the cell
 * containing the center. Hash collisions retain all records; resize on overflow. */
export function packSamples(records){
 const support=.36;
 for(let size=32768;size<=524288;size*=2){
  const ids=new Float32Array(size*MAX_BUCKET);ids.fill(-1);const counts=new Uint16Array(size);let overflow=false;
  for(let i=0;i<records.length&&!overflow;i++){
   const p=records[i].p,a=p.map(x=>Math.floor((x-support)/CELL_MM)),b=p.map(x=>Math.floor((x+support)/CELL_MM)),seen=new Set();
   for(let x=a[0];x<=b[0]&&!overflow;x++)for(let y=a[1];y<=b[1]&&!overflow;y++)for(let z=a[2];z<=b[2];z++){
    const h=hashCell(x,y,z,size-1);if(seen.has(h))continue;seen.add(h);const c=counts[h];if(c===MAX_BUCKET){overflow=true;break}ids[h*MAX_BUCKET+c]=i;counts[h]++;
   }
  }
  if(overflow)continue;
  const data=new Float32Array(Math.ceil(records.length*2/512)*512*4);
  for(let i=0;i<records.length;i++){const s=records[i];data.set([...s.p,s.r,...s.n,s.h],i*8)}
  const entries=counts.reduce((a,b)=>a+b,0),compact=new Float32Array(Math.ceil((size+Math.ceil(entries/4))/512)*512*4);let cursor=size*4;
  for(let h=0;h<size;h++){compact[h*4]=cursor;compact[h*4+1]=counts[h];for(let j=0;j<counts[h];j++)compact[cursor++]=ids[h*MAX_BUCKET+j];}
  return {ids:compact,data,size,maxBucket:counts.reduce((a,b)=>Math.max(a,b),0),records:records.length,supportMM:support,bytes:compact.byteLength+data.byteLength};
 }
 throw Error('Pore spatial hash exceeded its bounded memory budget; refusing silent sample loss');
}
/** Rotationally invariant tangential profile used by CPU regression. */
export function poreProfile(delta,normal,radius){const dn=delta.reduce((s,x,k)=>s+x*normal[k],0),r2=delta.reduce((s,x)=>s+x*x,0)-dn*dn;return Math.exp(-Math.max(0,r2)/(radius*radius));}
