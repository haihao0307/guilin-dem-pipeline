import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {cpus} from 'node:os';
import {CoupledCloth} from './mp05-r10/coupled-cloth.mjs';
import {ReducedCloth} from './mp05-r10/reduced-cloth.mjs';
import {BodySDF} from './mp05-r10/material-physics.mjs';
import {refineSewnBoundaries} from './mp05-r10/seam-refinement.mjs';
import {refineRiseTriangles} from './mp05-r10/rise-refinement.mjs';
import {withSettings} from './mp05-r10/material-settings.mjs';

const ROOT=new URL('./mp05-r10/',import.meta.url),DT=1/60,WARMUP=60,SAMPLES=120;
const read=async name=>JSON.parse(await fs.readFile(new URL(name,ROOT),'utf8'));
const unzip=async name=>JSON.parse(gunzipSync(await fs.readFile(new URL(name,ROOT))));
const [source,materials,meta,p,raw]=await Promise.all([read('SOURCE_LOCK.json'),read('materials.json'),read('assets/body-sdf-grid.json'),unzip('assets/native-person.json.gz'),fs.readFile(new URL('assets/common-body.sdfd.gz',ROOT))]);
const delta=gunzipSync(raw),sdf=new BodySDF(meta,new Int16Array(delta.buffer,delta.byteOffset,delta.byteLength/2),source.person.groundShiftM);
const actor={rig:p.rig,positions:p.positions,faces:p.faces,bodyCount:p.bodyCount,boneOrder:p.boneOrder,headSkinIndices:p.canonical.headSkinIndices,headSkinWeights:p.canonical.headSkinWeights};
const rows=[];
for(const name of ['T03','P02']){
 const packet=await refineRiseTriangles(await refineSewnBoundaries(await unzip('native/'+name+'.json.gz')));
 const positions=new Float32Array(packet.record.positionsMm.length*3);
 packet.record.positionsMm.forEach((v,i)=>positions.set([Math.fround(v[0]/1000),Math.fround(Math.fround(v[1]/1000)-source.person.groundShiftM),Math.fround(v[2]/1000)],i*3));
 rows.push({packet,positions,info:withSettings(materials.find(m=>m.id==='denim-bleach'))});
}
const worlds=[],construction=[];
for(let i=0;i<4;i++){
 const start=performance.now(),world=new CoupledCloth(rows,{sdf,actor,settings:{gravity:1,bend:1,softness:1,damping:7,clearanceMM:4}});
 world.bodyActive=true;world.bodyRevision=0;world.clothRevision=0;world.topologyRevision=1;
 new ReducedCloth(world);world.setMotion('step');world.initial=world.solvers.map(s=>s.p.slice());
 worlds.push(world);construction.push(performance.now()-start);
}
const stats=values=>{if(!values.length)return null;const v=values.toSorted((a,b)=>a-b);return{n:v.length,mean:v.reduce((s,x)=>s+x,0)/v.length,p50:v[Math.floor(v.length*.5)],p95:v[Math.min(v.length-1,Math.ceil(v.length*.95)-1)],min:v[0],max:v.at(-1)};};
const stageKeys=['poseMS','referenceMS','dynamicsMS','contactMS','reconstructionMS'];
const fineKeys=['refitMS','coarseMS','fineMS'];
const scalars=()=>({maxOffsetMM:0,maxFineOffsetMM:0,maxCorrectionMM:0,maxFinePasses:0,peakLowerQueries:0,totalLowerQueries:0,totalLowerSkippedQueries:0,peakImplicitSweeps:0});
function updateScalars(s,w){
 const m=w.acceleration.metrics,l=m.lowerBodyContact||{};
 s.maxOffsetMM=Math.max(s.maxOffsetMM,m.maxOffsetMM||0);s.maxFineOffsetMM=Math.max(s.maxFineOffsetMM,l.maxFineOffsetMM||0);s.maxCorrectionMM=Math.max(s.maxCorrectionMM,l.maxCorrectionMM||0);s.maxFinePasses=Math.max(s.maxFinePasses,l.passes||0);
 s.peakLowerQueries=Math.max(s.peakLowerQueries,l.queries||0);s.totalLowerQueries+=l.queries||0;s.totalLowerSkippedQueries+=l.safelySkippedQueries||0;s.peakImplicitSweeps=Math.max(s.peakImplicitSweeps,m.averageImplicitIterations||0);
}
function healthSnapshot(w){
 const native=w.actor.audit();w.bodyActive=true;
 const contact=w.audit(true),garments=w.solvers.map(s=>{const a=s.referenceAudit(false,{skipStaticContact:true});return{vertices:s.output.length/3,seamGapMM:a.seamGapMM,minEdgeStretch:a.minEdgeStretch,maxEdgeStretch:a.maxEdgeStretch,finite:s.p.every(Number.isFinite)&&s.v.every(Number.isFinite)&&s.output.every(Number.isFinite)};});
 return{simulationSeconds:w.elapsed,motionSeconds:w.motionTime,frameSequence:w.frameSequence,garmentSubsteps:w.solvers.map(s=>s.steps),safetyTrips:w.safetyTrips,rollbacks:w.acceleration.metrics.rollbacks,maxBoneLengthErrorMM:native.maxBoneLengthErrorMM,bodyMinimumSampleMM:contact.bodyMinimumSampleMM,pairMinimumSampleMM:contact.pairMinimumSampleMM,pairTargetMM:contact.pairTargetMM,pairSamples:contact.pairSamples,garments,penetrationObserved:contact.bodyMinimumSampleMM<0||contact.pairMinimumSampleMM<0,fullSelfCollisionCertified:false,fullDynamicClothCertified:false};
}
const report={schema:'native-cloth-component-benchmark@2',startedUTC:new Date().toISOString(),source:{runtimeRevision:'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49',directory:'kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef'},scope:{componentOnly:true,rendering:false,gpuMeasured:false,latestR07Fit:false,referencePerson:'original retained common 104-bone / 25417-control-vertex fit snapshot',garments:['T03','P02'],material:'denim-bleach',motion:'original native procedural step joint motion',physicalModel:'unchanged ReducedCloth regional implicit secondary dynamics',liveInitFitSkipped:'original garment/rest-person correspond; no R07 grading or GPU/WASM fitting transient',physicalTimeStepSeconds:DT,parallelWorkers:false,measurement:'actual CPU wall time of all active independent solver worlds stepped sequentially; not rendered FPS',qualityChecks:'existing solver rollback gates active; full body vertex+triangle-centroid and pair sample checks outside timed interval at scenario start/end',qualityChecksAreNotCompleteCollisionCertificate:true},environment:{node:process.version,cpuModel:cpus()[0]?.model,logicalCpus:cpus().length},settings:{roundPopulationOrders:[[1,2,4],[4,2,1]],warmupStepsPerScenario:WARMUP,measuredStepsPerScenario:SAMPLES},constructionMS:construction,counts:worlds[0].solvers.map((s,i)=>({garment:rows[i].packet.binding.presetId,visualControlVertices:s.output.length/3,sewnPhysicalVertices:s.count,physicalTriangles:s.faces.length/3,seamPairs:s.seamPairs.length,sourceDistanceConstraints:s.edges.length,sourceBendConstraints:s.bends.length,liveRegionalParticles:worlds[0].acceleration.models[i].count})),scenarios:[]};
const output=new URL('./cloth-component-bench-r02.json',import.meta.url);
async function checkpoint(){await fs.writeFile(output,JSON.stringify(report,(_,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2));}
for(let round=0;round<report.settings.roundPopulationOrders.length;round++)for(const population of report.settings.roundPopulationOrders[round]){
 const active=worlds.slice(0,population);for(const w of active){w.reset();w.setMotion('step');w.bodyActive=true;}
 const start=active.map(healthSnapshot),sc={round:round+1,population,startUTC:new Date().toISOString(),requestedWarmupSteps:WARMUP,requestedMeasuredSteps:SAMPLES,completedWarmupSteps:0,completedMeasuredSteps:0,dtSeconds:DT,failure:null,startState:start,timingMS:[],stagesMS:Object.fromEntries(stageKeys.map(k=>[k,[]])),lowerContactMS:Object.fromEntries(fineKeys.map(k=>[k,[]])),extrema:scalars()};
 const scenarioStart=performance.now();
 for(let f=0;f<WARMUP+SAMPLES;f++){
  const startTime=performance.now();
  try{for(const w of active)await w.step(DT);}catch(e){sc.failure={phase:f<WARMUP?'warmup':'measurement',requestedFrame:f+1,message:e.message,originalGateActive:true};break;}
  const elapsed=performance.now()-startTime;
  for(const w of active)updateScalars(sc.extrema,w);
  if(f<WARMUP){sc.completedWarmupSteps++;continue;}
  sc.completedMeasuredSteps++;sc.timingMS.push(elapsed);
  for(const key of stageKeys)sc.stagesMS[key].push(active.reduce((s,w)=>s+(w.acceleration.metrics[key]||0),0));
  for(const key of fineKeys)sc.lowerContactMS[key].push(active.reduce((s,w)=>s+(w.acceleration.metrics.lowerBodyContact?.[key]||0),0));
 }
 sc.executionWallMS=performance.now()-scenarioStart;sc.endState=active.map(healthSnapshot);
 sc.actualActorSteps=active.reduce((sum,w,i)=>sum+w.frameSequence-start[i].frameSequence,0);sc.actualActorSimulationSeconds=active.reduce((sum,w,i)=>sum+w.elapsed-start[i].simulationSeconds,0);
 sc.frameMS=stats(sc.timingMS);sc.stagesMS=Object.fromEntries(Object.entries(sc.stagesMS).map(([k,v])=>[k,stats(v)]));sc.lowerContactMS=Object.fromEntries(Object.entries(sc.lowerContactMS).map(([k,v])=>[k,stats(v)]));
 sc.gates={requestedStepsCompleted:sc.completedWarmupSteps===WARMUP&&sc.completedMeasuredSteps===SAMPLES,allFinalCoordinatesFinite:sc.endState.every(a=>a.garments.every(g=>g.finite)),newSafetyTrips:sc.endState.reduce((n,a,i)=>n+a.safetyTrips-start[i].safetyTrips,0),newRollbacks:sc.endState.reduce((n,a,i)=>n+a.rollbacks-start[i].rollbacks,0),penetrationObservedAtStartOrEnd:[...sc.startState,...sc.endState].some(a=>a.penetrationObserved),wearingQualityAccepted:false};
 report.scenarios.push(sc);await checkpoint();
 console.log(JSON.stringify({round:sc.round,population,warmup:sc.completedWarmupSteps,samples:sc.completedMeasuredSteps,meanMS:sc.frameMS?.mean,p95MS:sc.frameMS?.p95,gates:sc.gates,failure:sc.failure}));
}
report.finishedUTC=new Date().toISOString();await checkpoint();
