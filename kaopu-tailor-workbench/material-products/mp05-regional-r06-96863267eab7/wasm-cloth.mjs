import{WaistAttachments}from './waist-attachments.mjs';
export async function loadClothKernel(bytes=null){const imports={env:{atan2:Math.atan2}};const raw=bytes||await(await fetch(new URL('./cloth-kernel.wasm',import.meta.url))).arrayBuffer();return(await WebAssembly.instantiate(raw,imports)).instance;}
export class WasmCloth {
 constructor(world,instance){this.world=world;this.e=instance.exports;this.memory=this.e.memory;this.poolBytes=0;const allocate=(T,data)=>{const a=typeof data==='number'?new T(data):T.from(data),ptr=this.e.alloc(a.byteLength);if(ptr+a.byteLength>this.memory.buffer.byteLength)throw Error('物理内存预算不足');const view=new T(this.memory.buffer,ptr,a.length);view.set(a);this.poolBytes+=a.byteLength;return{ptr,view};};this.allocate=allocate;
 const sdf=world.sdf;this.sdf=allocate(Int16Array,sdf.data);this.meta=allocate(Float64Array,[...sdf.n,...sdf.o,sdf.h,sdf.q,sdf.shift]);
 this.solvers=world.solvers.map(s=>{const a={s};for(const k of ['p','v','old','w']){a[k]=allocate(Float64Array,s[k]);s[k]=a[k].view;}a.faces=allocate(Int32Array,s.faces);a.edges=allocate(Float64Array,s.edges.flatMap(e=>[e.a,e.b,e.rest,0]));a.bends=allocate(Float64Array,s.bends.flatMap(b=>[b.a,b.b,b.c,b.d,0,b.rest]));a.cache=allocate(Int32Array,new Int32Array(s.count+s.edges.length+s.faces.length/3).fill(-1));return a;});
 world.bottomSurface.p=world.solvers[1].p;this.bottom=this.mesh(world.bottomSurface,this.solvers[1].p);this.body=world.body?this.mesh(world.body):null;if(world.forceBodyTriangles){world.bodyActive=true;this.body.p.view.set(world.actor.positions);this.refit(this.body);}this.pairCache=allocate(Int32Array,new Int32Array(world.solvers[0].count).fill(-1));this.pairInteriorCache=allocate(Int32Array,new Int32Array(world.solvers[0].edges.length+world.solvers[0].faces.length/3).fill(-1));this.actorPrevious=world.actor?.positions.slice();this.actorTarget=world.actor?.positions.slice();this.waist=world.actor?new WaistAttachments(world):null;
 this.rollback=this.solvers.map(a=>({p:new Float64Array(a.s.p.length),v:new Float64Array(a.s.v.length),old:new Float64Array(a.s.old.length),edges:new Float64Array(a.edges.view.length),bends:new Float64Array(a.bends.view.length)}));
 this.actorRollback=world.actor?{previous:this.actorPrevious.slice(),target:this.actorTarget.slice(),positions:world.actor.positions.slice(),native:world.actor.native.slice(),waistPrevious:this.waist.previous.slice(),waistTarget:this.waist.target.slice()}:null;
 this.metrics={steps:0,rollbacks:0,rowsPrepared:0,rollbackBytes:this.rollback.reduce((n,r)=>n+r.p.byteLength+r.v.byteLength+r.old.byteLength+r.edges.byteLength+r.bends.byteLength,0)};
 world.bodyRevision=0;world.topologyRevision=1;world.clothRevision=0;
 world.backend='WASM / same metric constraints + actual triangle contacts';world.wasmBytes=this.poolBytes;
 }
 mesh(mesh,shared=null){const a=this.allocate,p=shared||a(Float64Array,mesh.p),normal=a(Float64Array,mesh.p.length),faces=a(Int32Array,mesh.faces),order=a(Int32Array,mesh.tri),nodes=a(Float64Array,mesh.nodes.flatMap(n=>[n.lo,n.hi,n.left,n.right,...n.box]));const result={p,normal,faces,order,nodes,count:mesh.p.length/3,nFaces:mesh.faces.length/3,nNodes:mesh.nodes.length};this.refit(result);return result;}
 refit(m){this.e.refit(m.p.ptr,m.faces.ptr,m.nFaces,m.normal.ptr,m.nodes.ptr,m.nNodes,m.order.ptr,m.count);}
 project(a,refresh,dense){const w=this.world,m=this.body,kind=w.bodyActive?1:0;return this.e.body_project(a.p.ptr,a.w.ptr,a.s.count,a.faces.ptr,a.s.faces.length/3,a.edges.ptr,a.s.edges.length,kind,this.sdf.ptr,this.meta.ptr,m?.p.ptr||0,m?.normal.ptr||0,m?.faces.ptr||0,m?.nodes.ptr||0,m?.order.ptr||0,a.cache.ptr,a.s.settings.clearanceMM*.001,refresh?1:0,dense?1:0);}
 pair(refresh,oneWay){const [a,b]=this.solvers,m=this.bottom;return this.e.pair_project(a.p.ptr,a.w.ptr,a.s.count,b.p.ptr,b.w.ptr,m.normal.ptr,m.faces.ptr,m.nodes.ptr,m.order.ptr,this.pairCache.ptr,this.world.contactGap,refresh?1:0,oneWay?1:0);}
 pairDense(){const [a,b]=this.solvers,m=this.bottom;return this.e.pair_surface(a.p.ptr,a.w.ptr,a.faces.ptr,a.s.faces.length/3,a.edges.ptr,a.s.edges.length,b.p.ptr,b.w.ptr,m.normal.ptr,m.faces.ptr,m.nodes.ptr,m.order.ptr,this.pairInteriorCache.ptr,this.world.contactGap,1,1);}
 residual(h){let elastic=0,bend=0,strain=0;for(const a of this.solvers){const s=a.s,alpha=(s.family==='knit'?.00035:s.family==='leather'?.00003:.00006)*s.settings.softness/(h*h),ba=(s.family==='leather'?2800:s.family==='denim'?6000:12000)/(Math.max(.05,s.settings.bend)*h*h);elastic=Math.max(elastic,this.e.elastic_residual?.(a.p.ptr,a.edges.ptr,s.edges.length,alpha)||0);bend=Math.max(bend,this.e.bending_residual?.(a.p.ptr,a.bends.ptr,s.bends.length,ba)||0);strain=Math.max(strain,this.e.strain_residual?.(a.p.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12)||0);}return{elasticMM:elastic*1000,bendRadians:bend,strainMM:strain*1000};}
 step(dt=1/60,advanceMotion=true){if(!Number.isFinite(dt)||dt<=0||dt>.05)throw Error('无效模拟步长');const t0=performance.now(),w=this.world,snapshot=this.rollback,oldTime=w.motionTime,oldElapsed=w.elapsed,oldBodyRevision=w.bodyRevision,oldClothRevision=w.clothRevision,oldPairContacts=w.pairContacts,oldSimulationMS=w.simulationMs,sub=Math.max(1,Math.ceil(dt*240)),h=dt/sub,e=this.e;w.pairContacts=0;
 for(let i=0;i<this.solvers.length;i++){const a=this.solvers[i],r=snapshot[i];r.p.set(a.s.p);r.v.set(a.s.v);r.old.set(a.s.old);r.edges.set(a.edges.view);r.bends.set(a.bends.view);r.time=a.s.time;r.steps=a.s.steps;r.contacts=a.s.contacts;}
 const ar=this.actorRollback;if(ar){ar.previous.set(this.actorPrevious);ar.target.set(this.actorTarget);ar.positions.set(w.actor.positions);ar.native.set(w.actor.native);ar.pose=w.actor.pose;ar.waistPrevious.set(this.waist.previous);ar.waistTarget.set(this.waist.target);}
 try{
 if(w.actor&&advanceMotion&&w.motion!=='idle'){this.actorPrevious.set(w.actor.positions);w.motionTime+=dt;w.actor.at(w.motion,w.motionTime);this.actorTarget.set(w.actor.positions);this.waist?.begin();w.bodyRevision++;w.bodyActive=true;}
 for(let ss=0;ss<sub;ss++){
  if(w.bodyActive){const p=this.body.p.view,a=this.actorPrevious,b=this.actorTarget,f=(ss+1)/sub;for(let i=0;i<p.length;i++)p[i]=a[i]*(1-f)+b[i]*f;this.refit(this.body);this.waist?.apply(f);}
  for(const a of this.solvers){const s=a.s;e.predict(a.p.ptr,a.v.ptr,a.old.ptr,a.w.ptr,s.count,h,Math.exp(-s.settings.damping*h),9.81*s.settings.gravity);e.reset_lambda(a.edges.ptr,s.edges.length,4,3);e.reset_lambda(a.bends.ptr,s.bends.length,6,4);}
  this.refit(this.bottom);
  for(let it=0;it<16;it++){
   for(const a of this.solvers){const s=a.s,alpha=(s.family==='knit'?.00035:s.family==='leather'?.00003:.00006)*s.settings.softness/(h*h);e.distance_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,alpha);if(it%2===0)e.bend_batch(a.p.ptr,a.w.ptr,a.bends.ptr,s.bends.length,(s.family==='leather'?2800:s.family==='denim'?6000:12000)/(Math.max(.05,s.settings.bend)*h*h));e.strain_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12);s.contacts=this.project(a,it===0&&ss===0,it===15);}
   if(it%2===0)w.pairContacts+=this.pair(it===0&&ss===0,false);
   if(this.config?.stageProfile&&it%2===1){this.metrics.curve??=[];this.metrics.curve.push({substep:ss,iteration:it+1,...this.residual(h)});}

  }
  for(let it=0;it<12;it++){for(const a of this.solvers){const s=a.s;e.strain_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12);s.contacts+=this.project(a,ss===sub-1&&it===11,it===11);}this.refit(this.bottom);w.pairContacts+=this.pair(it===11,it>=10);if(it>=10)w.pairContacts+=this.pairDense();}
  for(const a of this.solvers)this.project(a,false,false);this.refit(this.bottom);w.pairContacts+=this.pair(true,true);for(let j=0;j<3;j++){w.pairContacts+=this.pairDense();w.pairContacts+=this.pair(false,true);}
  for(const a of this.solvers){if(!e.finish(a.p.ptr,a.v.ptr,a.old.ptr,a.w.ptr,a.s.count,h,1)){w.safetyTrips++;throw Error('物理已暂停：无效数值');}a.s.time+=h;a.s.steps++;}
  w.elapsed+=h;
 }
 for(const a of this.solvers)a.s.expand();
 if(this.solvers.some(a=>{const r=a.s.audit(false);return !Number.isFinite(r.maxEdgeStretch)||r.maxEdgeStretch>1.45;}))throw Error('物理应变超出工程安全范围');
 w.frameSequence++;w.clothRevision++;this.metrics.steps++;w.simulationMs=performance.now()-t0;
 }catch(error){
  for(let i=0;i<this.solvers.length;i++){const a=this.solvers[i],r=snapshot[i];a.s.p.set(r.p);a.s.v.set(r.v);a.s.old.set(r.old);a.edges.view.set(r.edges);a.bends.view.set(r.bends);a.s.time=r.time;a.s.steps=r.steps;a.s.contacts=r.contacts;a.s.expand();a.cache.view.fill(-1);}
  w.pairContacts=oldPairContacts;w.simulationMs=oldSimulationMS;w.motionTime=oldTime;w.elapsed=oldElapsed;w.bodyRevision=oldBodyRevision;w.clothRevision=oldClothRevision;
  if(ar){w.actor.evaluate(ar.pose);w.actor.positions.set(ar.positions);w.actor.native.set(ar.native);this.actorPrevious.set(ar.previous);this.actorTarget.set(ar.target);this.waist.previous.set(ar.waistPrevious);this.waist.target.set(ar.waistTarget);this.body.p.view.set(ar.positions);this.refit(this.body);w.body.refit(ar.positions);}
  this.refit(this.bottom);this.pairCache.view.fill(-1);this.pairInteriorCache.view.fill(-1);w.safetyTrips++;this.metrics.rollbacks++;throw Error(error.message+'，已完整回滚本步状态');
 }

 }
}
export function accelerateWorld(world,instance){const backend=new WasmCloth(world,instance);world.step=backend.step.bind(backend);world.acceleration=backend;return world;}
