import {SweptContact} from './swept-contact.mjs';
// Additional collision-only WASM backend; original cloth f64 kernel is retained.
let scWasmModule;
export function configureContactWasm(bytes){scWasmModule=new WebAssembly.Module(bytes);}
export class FastSweptContact extends SweptContact {
 constructor(lab,options={}){super(lab,options);if(!scWasmModule)throw Error('Contact WASM must be initialized before cloth');this.kernel=new WebAssembly.Instance(scWasmModule,{env:{abort:()=>{throw Error('CONTACT_KERNEL_ABORT');}}}).exports;this.capacity=0;}
 rebuild(){
  this.refreshTopology();const l=this.lab,tb=l.triangles.map(t=>this.bounds(t.ids)),eb=l.meshEdges.map(e=>this.bounds(e));
  const contains=(a,b)=>a.lo.every((v,k)=>v<=b.lo[k]&&a.hi[k]>=b.hi[k]);
  // Reuse only spatial buckets, never contact candidates. Every current swept
  // primitive must remain inside its cached padded box; otherwise rebuild all.
  const reusable=this.cachedTB&&tb.every((b,i)=>contains(this.cachedTB[i],b))&&eb.every((b,i)=>contains(this.cachedEB[i],b));
  this.tb=tb;this.eb=eb;
  if(reusable){this.bucketReuses=(this.bucketReuses||0)+1;return;}
  const pad=b=>({lo:b.lo.map(v=>v-.002),hi:b.hi.map(v=>v+.002)});
  this.cachedTB=tb.map(pad);this.cachedEB=eb.map(pad);this.hash.clear();this.edgeHash.clear();
  for(let i=0;i<tb.length;i++)this.cells(this.cachedTB[i],key=>{let a=this.hash.get(key);if(!a)this.hash.set(key,a=[]);a.push(i);});
  for(let i=0;i<eb.length;i++)this.cells(this.cachedEB[i],key=>{let a=this.edgeHash.get(key);if(!a)this.edgeHash.set(key,a=[]);a.push(i);});
  this.bucketRebuilds=(this.bucketRebuilds||0)+1;
 }
 overlaps(a,b){return a.lo[0]<=b.hi[0]&&b.lo[0]<=a.hi[0]&&a.lo[1]<=b.hi[1]&&b.lo[1]<=a.hi[1]&&a.lo[2]<=b.hi[2]&&b.lo[2]<=a.hi[2];}
 nextStamp(){if(!this.triangleSeen){this.triangleSeen=new Int32Array(this.lab.triangles.length);this.edgeSeen=new Int32Array(this.lab.meshEdges.length);this.stamp=0;}if(this.stamp>=2147483646){this.triangleSeen.fill(0);this.edgeSeen.fill(0);this.stamp=0;}return ++this.stamp;}
 collectCandidates(){
  const l=this.lab;
  for(let i=0;i<l.positions.length;i++){
   if(l.stitchGroups.find(i)!==i)continue;const vb=this.bounds([i]),stamp=this.nextStamp();
   this.cells(vb,key=>{const bucket=this.hash.get(key);if(!bucket)return;for(const t of bucket){if(this.triangleSeen[t]===stamp)continue;this.triangleSeen[t]=stamp;const ids=l.triangles[t].ids;if(!this.overlaps(vb,this.tb[t])||this.exclude([i],ids))continue;this.contact([i,ids[0],ids[1],ids[2]],true);}});
  }
  for(let e=0;e<l.meshEdges.length;e++){
   const a=l.meshEdges[e],stamp=this.nextStamp();this.cells(this.eb[e],key=>{const bucket=this.edgeHash.get(key);if(!bucket)return;for(const f of bucket){if(f<=e||this.edgeSeen[f]===stamp)continue;this.edgeSeen[f]=stamp;const b=l.meshEdges[f];if(!this.overlaps(this.eb[e],this.eb[f])||this.exclude(a,b))continue;this.contact([a[0],a[1],b[0],b[1]],false);}});
  }
 }
 capture(){if(!this.collecting)super.capture();}
 contact(ids,face){if(this.rows.length/5>=250000)throw Error('CONTACT_CANDIDATE_BUDGET: unstable or excessive contact set; refusing to omit candidates');this.rows.push(face?1:0,ids[0],ids[1],ids[2],ids[3]);}
 project(){
  this.rows=[];this.collectCandidates();
  const l=this.lab,k=this.kernel,count=this.rows.length/5,n=l.positions.length;
  if(!this.capacity||count>this.capacity){this.capacity=Math.max(1024,Math.ceil(count*1.5));k.setup(n,this.capacity);}
  const b=k.memory.buffer,ps=new Float64Array(b,k.positions(),n*3),old=new Float64Array(b,k.previous(),n*3),mass=new Float64Array(b,k.weights(),n),alias=new Int32Array(b,k.aliases(),n),pairs=new Int32Array(b,k.pairs(),count*5);
  for(let i=0;i<n;i++){ps.set(l.positions[i],i*3);mass[i]=l.invMass[i];alias[i]=l.stitchGroups.find(i);}old.set(this.previous);pairs.set(this.rows);
  k.project(count,this.h);
  for(let i=0;i<n;i++)if(alias[i]===i){for(let axis=0;axis<3;axis++)l.positions[i][axis]=ps[i*3+axis];}
  this.corrections+=k.corrections.value;this.sweptHits+=k.sweptHits.value;this.discreteHits+=k.discreteHits.value;this.unresolved+=k.unresolved.value;
  // No cached candidate reuse across future nonlinear relaxation motions.
  // Contact is rebuilt for each original integration substep.
  if(l.kernel)l.kernel.vertices(l.clearance);
  this.capture();
 }
 report(){return{...super.report(),spatialBucketRebuilds:this.bucketRebuilds||0,conservativeBucketReuses:this.bucketReuses||0,jointMaterialBodyContactIterations:1,maxCandidatePairs:250000,correctionHistory:'one freshly rebuilt contact sweep per original integration substep',backend:'additional f64 WASM narrow phase; original cloth kernel unchanged'};}
}
