from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=root/'baseline';out=root/'candidate'
src=(base/'wasm-cloth.mjs').read_text(encoding='utf-8')
src=src.replace('this.waist=world.actor?new WaistAttachments(world):null;', '''this.waist=world.actor?new WaistAttachments(world):null;
 this.rollback=this.solvers.map(a=>({p:new Float64Array(a.s.p.length),v:new Float64Array(a.s.v.length),old:new Float64Array(a.s.old.length),edges:new Float64Array(a.edges.view.length),bends:new Float64Array(a.bends.view.length)}));
 this.actorRollback=world.actor?{previous:this.actorPrevious.slice(),target:this.actorTarget.slice(),positions:world.actor.positions.slice(),native:world.actor.native.slice(),waistPrevious:this.waist.previous.slice(),waistTarget:this.waist.target.slice()}:null;
 this.metrics={steps:0,rollbacks:0,rowsPrepared:0,rollbackBytes:this.rollback.reduce((n,r)=>n+r.p.byteLength+r.v.byteLength+r.old.byteLength+r.edges.byteLength+r.bends.byteLength,0)};
 world.bodyRevision=0;world.topologyRevision=1;world.clothRevision=0;''')
old='snapshot=this.solvers.map(a=>({p:a.s.p.slice(),v:a.s.v.slice(),time:a.s.time,steps:a.s.steps})),oldTime=w.motionTime,oldElapsed=w.elapsed,'
new='snapshot=this.rollback,oldTime=w.motionTime,oldElapsed=w.elapsed,oldBodyRevision=w.bodyRevision,oldClothRevision=w.clothRevision,oldPairContacts=w.pairContacts,oldSimulationMS=w.simulationMs,'
assert old in src
src=src.replace(old,new)
src=src.replace('w.pairContacts=0;', '''w.pairContacts=0;
 for(let i=0;i<this.solvers.length;i++){const a=this.solvers[i],r=snapshot[i];r.p.set(a.s.p);r.v.set(a.s.v);r.old.set(a.s.old);r.edges.set(a.edges.view);r.bends.set(a.bends.view);r.time=a.s.time;r.steps=a.s.steps;r.contacts=a.s.contacts;}
 const ar=this.actorRollback;if(ar){ar.previous.set(this.actorPrevious);ar.target.set(this.actorTarget);ar.positions.set(w.actor.positions);ar.native.set(w.actor.native);ar.pose=w.actor.pose;ar.waistPrevious.set(this.waist.previous);ar.waistTarget.set(this.waist.target);}
 try{''')
src=src.replace('this.actorTarget.set(w.actor.positions);this.waist?.begin();', 'this.actorTarget.set(w.actor.positions);this.waist?.begin();w.bodyRevision++;')
start=src.index(' for(const a of this.solvers)a.s.expand();if(')
end=src.index('\n }\n}',start)
src=src[:start]+''' for(const a of this.solvers)a.s.expand();
 if(this.solvers.some(a=>{const r=a.s.audit(false);return !Number.isFinite(r.maxEdgeStretch)||r.maxEdgeStretch>1.45;}))throw Error('物理应变超出工程安全范围');
 w.frameSequence++;w.clothRevision++;this.metrics.steps++;w.simulationMs=performance.now()-t0;
 }catch(error){
  for(let i=0;i<this.solvers.length;i++){const a=this.solvers[i],r=snapshot[i];a.s.p.set(r.p);a.s.v.set(r.v);a.s.old.set(r.old);a.edges.view.set(r.edges);a.bends.view.set(r.bends);a.s.time=r.time;a.s.steps=r.steps;a.s.contacts=r.contacts;a.s.expand();a.cache.view.fill(-1);}
  w.pairContacts=oldPairContacts;w.simulationMs=oldSimulationMS;w.motionTime=oldTime;w.elapsed=oldElapsed;w.bodyRevision=oldBodyRevision;w.clothRevision=oldClothRevision;
  if(ar){w.actor.evaluate(ar.pose);w.actor.positions.set(ar.positions);w.actor.native.set(ar.native);this.actorPrevious.set(ar.previous);this.actorTarget.set(ar.target);this.waist.previous.set(ar.waistPrevious);this.waist.target.set(ar.waistTarget);this.body.p.view.set(ar.positions);this.refit(this.body);w.body.refit(ar.positions);}
  this.refit(this.bottom);this.pairCache.view.fill(-1);this.pairInteriorCache.view.fill(-1);w.safetyTrips++;this.metrics.rollbacks++;throw Error(error.message+'，已完整回滚本步状态');
 }
''' + src[end:]
src=src.replace(' step(dt=1/60,advanceMotion=true){',''' residual(h){let elastic=0,bend=0,strain=0;for(const a of this.solvers){const s=a.s,alpha=(s.family==='knit'?.00035:s.family==='leather'?.00003:.00006)*s.settings.softness/(h*h),ba=(s.family==='leather'?2800:s.family==='denim'?6000:12000)/(Math.max(.05,s.settings.bend)*h*h);elastic=Math.max(elastic,this.e.elastic_residual?.(a.p.ptr,a.edges.ptr,s.edges.length,alpha)||0);bend=Math.max(bend,this.e.bending_residual?.(a.p.ptr,a.bends.ptr,s.bends.length,ba)||0);strain=Math.max(strain,this.e.strain_residual?.(a.p.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12)||0);}return{elasticMM:elastic*1000,bendRadians:bend,strainMM:strain*1000};}
 step(dt=1/60,advanceMotion=true){''')
src=src.replace('if(it%2===0)w.pairContacts+=this.pair(it===0&&ss===0,false);','''if(it%2===0)w.pairContacts+=this.pair(it===0&&ss===0,false);
   if(this.config?.stageProfile&&it%2===1){this.metrics.curve??=[];this.metrics.curve.push({substep:ss,iteration:it+1,...this.residual(h)});}
''')
(out/'wasm-cloth.mjs').write_text(src,encoding='utf-8')
src=(base/'coupled-cloth.mjs').read_text(encoding='utf-8')
src=src.replace('this.saved=this.solvers.map(s=>s.p.slice());','''this.saved=this.solvers.map(s=>s.p.slice());
 this.staticRows=this.solvers.map(s=>{let offset=0;const indices=[];for(const p of s.packet.spec.panels){for(const t of p.triangles)for(const i of t)indices.push(i+offset);offset+=p.uvMm.length;}return{indices:Uint32Array.from(indices),orientation:s.orientation,vertices:s.output.length/3};});
 this.outputMetrics={prepared:0,staticTopologyBuilds:this.solvers.length};''')
start=src.index(' rows(){');end=src.index('\n set(settings)',start)
src=src[:start]+''' rows(target=null,includeStatic=true){this.outputMetrics.prepared++;return this.solvers.map((s,i)=>{const row=target?.[i]||{positions:new Float32Array(s.output.length),normals:new Float32Array(s.normals.length)};row.positions.set(s.output);row.normals.set(s.normals);if(includeStatic)Object.assign(row,this.staticRows[i]);else{delete row.indices;delete row.orientation;}row.audit={...s.audit(false),...(this.bodyActive?{minBodyVertexDistanceMM:null,minBodyInteriorSampleMM:null}:{}),pairedGarmentContacts:this.pairContacts,pairedGapMM:this.contactGap*1000,bodyContactSource:this.bodyActive?'same-frame original animated body triangles':'original static SDF',frameSequence:this.frameSequence};return row;});}
''' +src[end:]
src=src.replace("this.frameSequence++;this.acceleration?", "this.frameSequence++;this.bodyRevision++;this.clothRevision++;this.acceleration?")
src=src.replace('return this.rows();','return undefined;')
(out/'coupled-cloth.mjs').write_text(src,encoding='utf-8')
