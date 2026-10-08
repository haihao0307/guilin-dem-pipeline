import {SweptContact} from './swept-contact.mjs';
// Additional collision-only WASM backend; original cloth f64 kernel is retained.
let scWasmModule;
export function configureContactWasm(bytes){scWasmModule=new WebAssembly.Module(bytes);}
export class FastSweptContact extends SweptContact {
 constructor(lab,options={}){super(lab,options);if(!scWasmModule)throw Error('Contact WASM must be initialized before cloth');this.kernel=new WebAssembly.Instance(scWasmModule,{env:{abort:()=>{throw Error('CONTACT_KERNEL_ABORT');}}}).exports;this.capacity=0;}
 capture(){if(!this.collecting)super.capture();}
 contact(ids,face){if(this.rows.length/5>=250000)throw Error('CONTACT_CANDIDATE_BUDGET: unstable or excessive contact set; refusing to omit candidates');this.rows.push(face?1:0,...ids);}
 project(){
  this.rows=[];this.collecting=true;super.project();this.collecting=false;
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
 report(){return{...super.report(),jointMaterialBodyContactIterations:1,maxCandidatePairs:250000,correctionHistory:'one freshly rebuilt contact sweep per original integration substep',backend:'additional f64 WASM narrow phase; original cloth kernel unchanged'};}
}
