import {GPUCloth}from'./gpu-cloth.mjs';
import {ReducedCloth}from'./reduced-cloth.mjs';
import {BodySDF}from'./material-physics.mjs';
import {CoupledCloth}from'./coupled-cloth.mjs';
import {loadClothKernel,accelerateWorld}from'./wasm-cloth.mjs';
let world=null,settings=null,chain=Promise.resolve(),generation=0,lastBody=-1,pool=[];
const DT=1/60,clock={wallTarget:0,simLagMs:0,overBudget:false,activeWallSeconds:0};
function resetClock(){Object.assign(clock,{wallTarget:world?.elapsed||0,simLagMs:0,overBudget:false,activeWallSeconds:0,mode:'paused'});}
const digest=async b=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function checked(url,hash){const r=await fetch(url);if(!r.ok)throw Error('物理资源 HTTP '+r.status);const b=await r.arrayBuffer();if(hash&&await digest(b)!==hash)throw Error('物理来源散列不符');return b;}
function newSlot(id){return{id,free:true,rows:world.solvers.map(s=>({positions:new Float32Array(s.output.length),normals:new Float32Array(s.normals.length)})),body:new Float32Array(world.actor.native.length)};}
function send(id,{dense=false,initial=false,liveSteps=0}={}){
 const start=performance.now();let slot=pool.find(s=>s.free);if(!slot)throw Error('有界输出邮箱未归还缓冲区');if(world.acceleration.config?.reuseTransport===false){slot=newSlot(slot.id);pool[slot.id]=slot;}slot.free=false;
 const rows=world.rows(slot.rows,initial||world.acceleration.config?.staticTopology===false),bodyChanged=initial||lastBody!==world.bodyRevision||world.acceleration.config?.bodyRevision===false;
 const body=bodyChanged&&(initial||!world.actor.bindingPacked)?slot.body:null;if(body){body.set(world.actor.native);lastBody=world.bodyRevision;}
 const audit={...(dense?world.audit(true):{}),physicsSource:'live',backend:world.acceleration.backend||(world.acceleration instanceof GPUCloth?'webgpu-compute':'wasm-webgl'),gpuFallbackReason:world.gpuFallbackReason||null,skinMatrices:world.actor.skin.map(m=>Array.from(m)),motion:world.motion,motionTime:world.motionTime,simulationSeconds:world.elapsed,simulationTimeSeconds:world.elapsed,advanceSteps:liveSteps,frameSequence:world.frameSequence,topologyRevision:world.topologyRevision,bodyRevision:world.bodyRevision,clothRevision:world.clothRevision,materialRevision:world.materialRevision||0,bodyFrameMatchesCloth:true,cachedPhysicalReplay:false,continuousCollision:false,allSelfCollision:false,solverMs:world.simulationMs,clock:{...clock},pipeline:{...world.acceleration.metrics,...world.outputMetrics,poolSlots:pool.length,fullBodyOutputs:(world.fullBodyOutputs=(world.fullBodyOutputs||0)+(body?1:0)),outputPackMS:performance.now()-start},nativeRig:bodyChanged?world.actor.audit():null,safetyTrips:world.safetyTrips};
 const transfer=rows.flatMap(r=>[r.positions.buffer,r.normals.buffer]);if(body)transfer.push(body.buffer);
 audit.transferredBytes=transfer.reduce((n,b)=>n+b.byteLength,0);
 self.postMessage({id,generation,slot:slot.id,rows,body,audit},transfer);
}
function recycle(d){const slot=pool[d.slot];if(!slot||slot.free)throw Error('无效缓冲区所有权归还');let i=0;for(const row of slot.rows){row.positions=new Float32Array(d.buffers[i++]);row.normals=new Float32Array(d.buffers[i++]);}if(d.body)slot.body=new Float32Array(d.buffers[i]);slot.free=true;}
async function handle(d){
 if(d.command==='recycle'){recycle(d);return;}
 if(d.command==='init'){
  generation=d.generation||0;const meta=JSON.parse(new TextDecoder().decode(await checked(new URL('./assets/body-sdf-grid.json',import.meta.url),d.lock.sdfMetadataSHA256))),compressed=await checked(new URL('./assets/common-body.sdfd.gz',import.meta.url),d.lock.sdfFileSHA256),raw=await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  world=new CoupledCloth(d.rows,{sdf:new BodySDF(meta,new Int16Array(raw),d.lock.groundShiftM),actor:d.actor,settings:d.settings});world.actor.evaluate({});const finalBody=world.actor.positions.slice(),origin=d.actor.fittingOrigin;if(origin){world.actor.positions.set(origin);world.body.refit(world.actor.positions);}try{await GPUCloth.create(world);}catch(e){if(d.actor?.sourceRevision)world.forceBodyTriangles=true;accelerateWorld(world,await loadClothKernel());world.gpuFallbackReason=e.message;world.bodyActive=!!d.actor?.sourceRevision;}settings={...d.settings};
  const fittingSteps=origin?48:8;for(let i=0;i<fittingSteps;i++){if(origin){const f=Math.min(1,(i+1)/32),target=Float32Array.from(finalBody,(v,k)=>origin[k]+(v-origin[k])*f);if(world.acceleration instanceof GPUCloth){world.acceleration.fittingTarget=target;world.acceleration.fitFraction=f;}else{world.actor.positions.set(target);world.acceleration.actorTarget.set(target);world.acceleration.waist.begin();}}await world.step(origin?1/60:1/30,false);self.postMessage({id:d.id,progress:(i+1)/fittingSteps,phase:'最新人物体型适配 · 原裁片实时松弛'});}
  world.initial=world.solvers.map(s=>s.p.slice());world.initialTime=world.elapsed;world.acceleration.dispose?.();new ReducedCloth(world);world.initial=world.solvers.map(s=>s.p.slice());resetClock();pool=Array.from({length:3},(_,i)=>newSlot(i));send(d.id,{dense:true,initial:true});return;
 }
 if(!world)throw Error('实时服装尚未初始化');
 if(d.command==='advance'){
  const target=Number(d.targetSeconds);if(!Number.isFinite(target)||target<world.elapsed-DT)throw Error('非单调模拟目标');
  const required=Math.max(0,Math.floor((target-world.elapsed+1e-9)/DT)),batchLimit=Math.max(1,Math.min(4,Math.floor(12/Math.max(.1,world.simulationMs||1)))),steps=Math.min(batchLimit,required);
  for(let i=0;i<steps;i++){await world.step(DT);if(world.acceleration.config?.resultOnce===false)world.rows();}
  clock.mode='realtime';clock.wallTarget=target;clock.activeWallSeconds=d.activeWallSeconds;clock.simLagMs=Math.max(0,(target-world.elapsed)*1000);clock.overBudget=clock.simLagMs>DT*2000||world.simulationMs>DT*1000;
  if(!steps){self.postMessage({id:d.id,statusOnly:true,audit:{clock:{...clock},simulationSeconds:world.elapsed,simulationTimeSeconds:world.elapsed,advanceSteps:0,frameSequence:world.frameSequence}});return;}
  send(d.id,{liveSteps:steps});return;
 }
 if(d.command==='step'){await world.step(DT);clock.mode='fixed-step-test';send(d.id);}
 else if(d.command==='motion'){world.setMotion(d.motion);world.bodyRevision++;send(d.id);}
 else if(d.command==='tug'){world.tug();if(!(world.acceleration instanceof ReducedCloth))world.acceleration.uploadState?.();await world.step(DT);send(d.id);}
 else if(d.command==='reset'){world.reset();resetClock();lastBody=-1;send(d.id,{dense:true});}
 else if(d.command==='settings'){world.set(d.settings);settings={...settings,...d.settings};world.materialRevision=(world.materialRevision||0)+1;send(d.id);}
 else if(d.command==='settle'){const n=Math.max(1,Math.min(120,Math.ceil((d.seconds||.5)/DT)));for(let i=0;i<n;i++)await world.step(DT);send(d.id,{dense:true});}
 else if(d.command==='audit')send(d.id,{dense:true});
 else if(d.command==='config'){Object.assign(world.acceleration.config||(world.acceleration.config={}),d.config);if(d.config.queryReuse!==undefined)world.acceleration.e?.set_cache_enabled(d.config.queryReuse?1:0);send(d.id);}
 else throw Error('未知实时命令 '+d.command);
}
self.onmessage=({data:d})=>{chain=chain.then(()=>handle(d)).catch(e=>{if(d.id)self.postMessage({id:d.id,error:e.message,stack:e.stack,failureAudit:{pipeline:world?{...world.acceleration.metrics}:null,safetyTrips:world?.safetyTrips,simulationSeconds:world?.elapsed,motionTime:world?.motionTime}});else self.postMessage({error:e.message});});};
