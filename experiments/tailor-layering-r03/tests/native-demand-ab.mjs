/**
 * Frozen R02 / R03 OFF / R03 ON, identical complete native input.
 * Discrete physical-state equality and independently audited geometry only;
 * not a browser, dynamic-body, continuous-time or rendered-yarn certificate.
 *
 * node tests/native-demand-ab.mjs --input /absolute/native-world-input.json \
 *   --output /absolute/evidence --steps 8
 *
 * Original typed-array captures are restored byte for byte. A plain numeric
 * public Worker observation is also supported, but is explicitly labelled as
 * reconstructed Float32 body/garment positions and Uint32 body faces; it is not
 * relabelled as a fresh byte capture from the current browser.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {auditMeshIntersections} from './mesh-intersections.mjs';
import {createBodyEnvelopeAudit} from './body-envelope-audit.mjs';

const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args={source:project,baseline:path.resolve(project,'../tailor-layering-r02'),input:'evidence/native-world-input.json',output:'evidence/native-demand-ab',steps:8};
for(let i=2;i<process.argv.length;i++){
  const key=process.argv[i];
  if(!/^--(source|baseline|input|output|steps)$/.test(key)||!process.argv[i+1])throw Error('Unknown/incomplete argument: '+key);
  args[key.slice(2)]=process.argv[++i];
}
args.steps=Number(args.steps);
assert.ok(Number.isInteger(args.steps)&&args.steps>=8&&args.steps<=1000,'steps must be an integer in 8–1000');
for(const key of ['source','baseline','input','output'])args[key]=path.resolve(args[key]);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const inputBytes=await fs.readFile(args.input),rawInput=JSON.parse(inputBytes);
const types={Float32Array,Float64Array,Int32Array,Uint32Array,Int16Array,Uint16Array,Int8Array,Uint8Array,Uint8ClampedArray};
const hasTyped=Array.isArray(rawInput.typedArrays)&&rawInput.typedArrays.length>0;
const inputMode=hasTyped?'original-typed-array-byte-capture':'public-observation-numeric-reconstruction';
function restoreInput(){
  const root=JSON.parse(inputBytes),input=root.traffic?.init??root;
  if(hasTyped){
    const restored=new Set();
    for(const entry of input.typedArrays){
      const T=types[entry.type],bytes=Buffer.from(entry.base64||'','base64'),keys=entry.path.split('/').slice(1);
      assert.ok(T&&bytes.byteLength===entry.byteLength&&bytes.byteLength===entry.length*T.BYTES_PER_ELEMENT,'invalid typed-array capture '+entry.path);
      assert.ok(keys.length>=2&&!keys.some(k=>['__proto__','prototype','constructor'].includes(k)),'unsafe captured array path');
      let parent=input;for(const key of keys.slice(0,-1)){assert.ok(parent&&Object.hasOwn(parent,key),'missing captured array path');parent=parent[key];}
      parent[keys.at(-1)]=new T(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));restored.add(entry.path);
    }
    for(const key of ['/body/positions','/body/faces',...input.rows.map((_,i)=>'/rows/'+i+'/positions')])assert.ok(restored.has(key),'original bytes missing for '+key);
  }else{
    assert.ok(Array.isArray(input.body?.positions)&&Array.isArray(input.body?.faces)&&Array.isArray(input.rows),'complete public numeric init required');
    input.body.positions=Float32Array.from(input.body.positions);
    input.body.faces=Uint32Array.from(input.body.faces);
    for(const row of input.rows){assert.ok(Array.isArray(row.positions),'numeric garment positions missing');row.positions=Float32Array.from(row.positions);}
  }
  assert.ok(input.body.positions.length>3000&&input.body.faces.length>3000&&input.rows.length===3,'complete original body and three independent garments required');
  return input;
}

// Execution instrumentation and the two R03-only explanatory schema strings
// are recorded separately. All geometry, materials, convergence reports and
// physical work-limit values remain compared, including complete histories.
const omitted=new Set(['timings','solverMS','stageTimingsMS','settlingMS','measurementMS','elapsedMS','creationMS','initializationMS','work','execution','timingRelationships','stageTimingContract','reentrySemantics']);
function physical(value){
  if(ArrayBuffer.isView(value))return Array.from(value);
  if(Array.isArray(value))return value.map(physical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!omitted.has(k)).map(([k,v])=>[k,physical(v)]));
  return value;
}
function history(world){
  const c=world.contacts;
  return physical({history:[...c._history],sides:[...c._sides],frameSides:[...c._frameSides],edgeReferences:[...c._edgeReferences],
    pending:[...c._pending].map(([key,{a,b,...contact}])=>[key,{...contact,a:{id:a.id,count:a.count},b:{id:b.id,count:b.count}}])});
}
function bytes(view){return Buffer.from(view.buffer,view.byteOffset,view.byteLength);}
function equalArray(a,b,label){
  assert.equal(a.constructor.name,b.constructor.name,label+' type');assert.equal(a.length,b.length,label+' length');
  if(!bytes(a).equals(bytes(b))){let first=0;while(first<a.length&&Object.is(a[first],b[first]))first++;throw Error(label+' differs at '+first+': '+a[first]+' / '+b[first]);}
}
function equalRecord(a,b,label){
  const pa=physical(a),pb=physical(b),x=JSON.stringify(pa),y=JSON.stringify(pb);
  if(x!==y){let first=0;while(first<x.length&&x[first]===y[first])first++;throw Error(label+' differs at serialized offset '+first+': '+x.slice(Math.max(0,first-80),first+120)+' / '+y.slice(Math.max(0,first-80),first+120));}
  // JSON alone collapses -0 to 0 and nonfinite numbers to null. The readable
  // mismatch above is followed by strict numeric/scalar equality as well.
  assert.deepStrictEqual(pa,pb,label+' strict values');
  return sha(x);
}
function compare(reference,candidate,label){
  assert.equal(candidate.rows.length,reference.rows.length,label+' garment count');
  for(let i=0;i<reference.rows.length;i++){
    const a=reference.rows[i],b=candidate.rows[i];assert.equal(a.id,b.id,label+' garment identity');
    for(const key of ['p','v','old','w','faces','initial','mass'])equalArray(a.s[key],b.s[key],label+'/'+a.id+'/'+key);
    equalArray(a.saved,b.saved,label+'/'+a.id+'/saved');
    equalArray(a.edges.view,b.edges.view,label+'/'+a.id+'/edge-state');
    equalArray(a.bends.view,b.bends.view,label+'/'+a.id+'/bend-state');
    equalRecord(a.s.settings,b.s.settings,label+'/'+a.id+'/settings');
    assert.equal(a.s.time,b.s.time,label+'/'+a.id+'/clock');assert.equal(a.s.steps,b.s.steps,label+'/'+a.id+'/steps');
  }
  assert.equal(reference.time,candidate.time,label+'/world-clock');assert.equal(reference.steps,candidate.steps,label+'/world-steps');
  equalRecord(reference.options,candidate.options,label+'/physical-options');
  const historySHA256=equalRecord(history(reference),history(candidate),label+'/contact-history');
  const sa=reference.snapshot(),sb=candidate.snapshot();
  assert.equal(sa.rows.length,sb.rows.length,label+'/render-row-count');
  for(let i=0;i<sa.rows.length;i++)for(const key of ['positions','normals','indices'])equalArray(sa.rows[i][key],sb.rows[i][key],label+'/render/'+sa.rows[i].id+'/'+key);
  const snapshotSHA256=equalRecord(sa,sb,label+'/complete-snapshot');
  return {historySHA256,snapshotSHA256,exactParticleArrays:true,exactRenderedArrays:true};
}

await fs.mkdir(args.output,{recursive:true});
const logPath=path.join(args.output,'states.ndjson'),summaryPath=path.join(args.output,'summary.json');
await fs.writeFile(logPath,'');
const temps=[],lanes=[],summary={schema:'kaopu-native-contact-demand-ab@1',passed:false,inputPath:args.input,inputSHA256:sha(inputBytes),inputMode,
  inputBoundary:hasTyped?'Exact original typed-array bytes restored.':'Float32/Uint32 reconstructed from complete numeric R02 public Worker init. This is a historical input A/B, not fresh current-browser input capture.',
  sourceAnnotation:rawInput.reconstruction??rawInput.source??null,baselineSource:args.baseline,candidateSource:args.source,
  excludedInstrumentationAndSchemaFields:[...omitted],
  comparisonNormalization:'Only listed instrumentation fields and R03-only explanatory strings are excluded. New strings are separately recorded per lane. Typed physical/render arrays use byte comparison; normalized scalars and full histories additionally use deep strict equality, preserving signed zero.',
  environment:{node:process.version,platform:process.platform,arch:process.arch,logicalCPUs:os.cpus().length},requestedSteps:args.steps,completedSteps:0,
  perturbations:[{beforeStep:3,garment:'outer',kind:'push'},{beforeStep:6,garment:'inner',kind:'tug'}],
  limits:{maxDynamicEdgeStretch:1.45,maxSeamGapMM:.01,maxClothResidualMM:.5,maxBodyHalfThicknessGapMM:.001,fixedDriftMM:.001},
  scope:'One shared, independently audited geometry at every accepted state after all three complete worlds prove byte-identical p/v/old and render snapshots. Static original body; no full CCD, self collision or per-yarn collision guarantee.',
  sourceSHA256:{},testSHA256:{},lanes:{},states:[],physicalProgressRequired:true,rollbacksAllowedForPass:false};
for(const file of ['native-demand-ab.mjs','mesh-intersections.mjs','body-envelope-audit.mjs'])summary.testSHA256[file]=sha(await fs.readFile(new URL(file,import.meta.url)));
const save=()=>fs.writeFile(summaryPath,JSON.stringify(summary,null,2)+'\n');
const percentile=(values,p)=>{const s=[...values].sort((a,b)=>a-b);return s[Math.max(0,Math.ceil(s.length*p)-1)]??null;};
const median=values=>{const s=[...values].sort((a,b)=>a-b),n=s.length;return n?(s[Math.floor((n-1)/2)]+s[Math.floor(n/2)])/2:null;};
const memory=()=>({...process.memoryUsage()});
function updateSummaryTiming(){
  for(const lane of lanes){const times=lane.timings.filter(t=>t.step>0).map(t=>t.wallMS);summary.lanes[lane.id]={...summary.lanes[lane.id],maximumPerStepParticleCoordinateChangeM:lane.world.rows.map((a,i)=>({id:a.id,value:lane.maximumMove[i]})),stepTiming:{samples:times.length,medianMS:median(times),p95MS:percentile(times,.95),quantileMethod:'arithmetic median; p95 nearest rank',totalMS:times.reduce((a,b)=>a+b,0)}};}
}

try{
  for(const descriptor of [{id:'r02',source:args.baseline},{id:'r03-off',source:args.source,enabled:false},{id:'r03-on',source:args.source,enabled:true}]){
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'native-demand-'+descriptor.id+'-'));temps.push(dir);
    const hashes={};
    for(const file of await fs.readdir(path.join(descriptor.source,'src')))if(file.endsWith('.mjs')){const data=await fs.readFile(path.join(descriptor.source,'src',file));hashes['src/'+file]=sha(data);await fs.writeFile(path.join(dir,file),data);}
    const upstream=path.join(descriptor.source,'reference/mp05-studio-r10');await fs.symlink(upstream,path.join(dir,'upstream'),'dir');
    for(const file of ['cloth-kernel.wasm','cloth-physics.mjs','material-physics.mjs','mesh-contact.mjs','source-contract.mjs','seam-refinement.mjs'])hashes['upstream/'+file]=sha(await fs.readFile(path.join(upstream,file)));
    summary.sourceSHA256[descriptor.id]=hashes;
    const {LayerWorld}=await import(pathToFileURL(path.join(dir,'layer-world.mjs'))),input=restoreInput(),kernel=await fs.readFile(path.join(upstream,'cloth-kernel.wasm'));
    const cpu=process.cpuUsage(),began=performance.now(),world=await LayerWorld.create(input.body,input.rows,kernel,input.options,...(descriptor.id==='r02'?[]:[{contactDemand:descriptor.enabled}])),creationMS=performance.now()-began,used=process.cpuUsage(cpu);
    if(descriptor.id!=='r02'){assert.equal(typeof world.setExecution,'function','R03 execution interface not ready');assert.equal(world.audit().execution.contactDemand,descriptor.enabled,'execution switch must be set before initialization');}
    const lane={...descriptor,input,world,timings:[],fixed:world.rows.map(a=>a.s.p.slice()),maximumMove:world.rows.map(()=>0)};lanes.push(lane);
    const laneAudit=world.audit();
    summary.lanes[lane.id]={creationMS,creationCPUms:{user:used.user/1000,system:used.system/1000,total:(used.user+used.system)/1000},creationMemory:memory(),wasmMemoryBytes:world.memory.buffer.byteLength,wasmReservedBytes:world.poolBytes,execution:laneAudit.execution??null,explanatorySchema:{stageTimingContract:laneAudit.stageTimingContract??null,reentrySemantics:laneAudit.reentrySemantics??null}};
    console.log(JSON.stringify({phase:'created',lane:lane.id,creationMS}));await save();
  }
  for(const key of Object.keys(summary.sourceSHA256.r02).filter(k=>k.startsWith('upstream/')))assert.equal(summary.sourceSHA256.r02[key],summary.sourceSHA256['r03-on'][key],'unchanged native dependency '+key);
  const auditor=createBodyEnvelopeAudit(lanes[0].input.body);
  for(let step=0;step<=args.steps;step++){
    if(step){
      const perturbation=summary.perturbations.find(p=>p.beforeStep===step);
      if(perturbation)for(const lane of lanes)lane.world.perturb(perturbation.garment,perturbation.kind);
      // Rotate order to avoid assigning every warm/cold scheduling position to
      // the same execution path. Worlds are stepped serially, not concurrently.
      for(let k=0;k<lanes.length;k++){
        const lane=lanes[(step+k)%lanes.length],w=lane.world,before=w.rows.map(a=>a.s.p.slice()),cpu=process.cpuUsage(),began=performance.now();
        w.step(1/120);const wallMS=performance.now()-began,used=process.cpuUsage(cpu),audit=w.audit();
        const timing={step,wallMS,processCPUms:{user:used.user/1000,system:used.system/1000,total:(used.user+used.system)/1000},solverMS:audit.solverMS,stageTimingsMS:audit.stageTimingsMS,execution:audit.execution??null,memory:memory()};lane.timings.push(timing);
        for(let i=0;i<w.rows.length;i++)for(let j=0;j<before[i].length;j++)lane.maximumMove[i]=Math.max(lane.maximumMove[i],Math.abs(before[i][j]-w.rows[i].s.p[j]));
      }
    }
    const reference=lanes[0].world,comparisons={};
    for(const lane of lanes.slice(1))comparisons[lane.id]=compare(reference,lane.world,lane.id+'/step-'+step);
    const audit=reference.audit({bodySamples:true}),contact=step===0?reference.contacts.measure(reference.surfaces()):audit.contact;
    assert.equal(reference.steps,step,'accepted world steps');assert.ok(Math.abs(reference.time-step/120)<1e-9,'physical clock advanced');
    for(const lane of lanes)for(let row=0;row<lane.world.rows.length;row++){
      const a=lane.world.rows[row],s=a.s;
      for(const key of ['p','v','old'])assert.ok(s[key].every(Number.isFinite),lane.id+'/'+a.id+'/'+key+' finite');
      for(let i=0;i<s.count;i++)if(!s.w[i])assert.ok(Math.hypot(s.p[i*3]-lane.fixed[row][i*3],s.p[i*3+1]-lane.fixed[row][i*3+1],s.p[i*3+2]-lane.fixed[row][i*3+2])*1000<=.001,'fixed-particle drift');
    }
    assert.ok(Number.isFinite(audit.maxEdgeStretch)&&(!step||audit.maxEdgeStretch<=1.45),'dynamic edge stretch');
    assert.ok(Number.isFinite(audit.seamGapMM)&&audit.seamGapMM<=.01,'seam gap');
    assert.ok(Number.isFinite(contact.residualMaxPenetration)&&contact.residualMaxPenetration*1000<=.5,'cloth contact residual');
    assert.equal(audit.bodyInsideVertices,0,'body inside particles');assert.ok(Number.isFinite(audit.bodyThicknessOverlapMM)&&audit.bodyThicknessOverlapMM<=.001,'body particle half-thickness gap');
    assert.equal(audit.bodySampledVertices,reference.rows.reduce((n,a)=>n+a.s.count,0),'all particles audited against body');
    const auditStarted=performance.now(),geometry=auditMeshIntersections([...reference.rows.map(a=>({id:a.id,positions:a.s.p,indices:a.s.faces})),{id:'__actual_native_body__',positions:lanes[0].input.body.positions,indices:lanes[0].input.body.faces}],{sampleLimit:8});
    const envelope=auditor.measure(reference.surfaces(),{sampleLimit:8});
    assert.equal(geometry.scope?.allNondegenerateInputTrianglePairsCovered,true,'complete intersection audit');assert.equal(geometry.degenerateTriangles,0,'no degenerate triangles');assert.equal(geometry.hasReportedIntersections,false,'no full triangle intersections');
    assert.equal(envelope.scope?.completeForInputTriangles,true,'complete body envelope audit');assert.equal(envelope.degenerateTriangles,0,'no degenerate envelope triangles');assert.ok(Number.isFinite(envelope.maxHalfThicknessOverlapMM)&&envelope.maxHalfThicknessOverlapMM<=.001,'independent body half-thickness gap');
    const row={step,physicalSeconds:reference.time,comparisons,metrics:{maxEdgeStretch:audit.maxEdgeStretch,seamGapMM:audit.seamGapMM,contactResidualMM:contact.residualMaxPenetration*1000,bodyThicknessOverlapMM:audit.bodyThicknessOverlapMM},geometry,independentBodyEnvelope:envelope,independentAuditMS:performance.now()-auditStarted,timings:Object.fromEntries(lanes.map(l=>[l.id,l.timings.at(-1)??null]))};
    summary.states.push(row);summary.completedSteps=step;summary.independentlyAuditedDiscreteStates=step+1;updateSummaryTiming();await fs.appendFile(logPath,JSON.stringify(row)+'\n');await save();
    console.log(JSON.stringify({phase:'accepted-identical',step,physicalSeconds:reference.time,metrics:row.metrics,wallMS:Object.fromEntries(lanes.map(l=>[l.id,l.timings.at(-1)?.wallMS??null]))}));
  }
  for(const lane of lanes)for(let i=0;i<lane.world.rows.length;i++)if(lane.world.rows[i].s.w.some(w=>w>0))assert.ok(lane.maximumMove[i]>1e-8,lane.id+'/'+lane.world.rows[i].id+' must actually move');
  summary.passed=true;
}catch(error){
  summary.error={message:error.message,stack:error.stack,diagnostics:physical(error.diagnostics)};
  for(const lane of lanes){const w=lane.world;await fs.writeFile(path.join(args.output,lane.id+'.failure-state.json.gz'),gzipSync(JSON.stringify(physical({label:lane.id,worldSteps:w.steps,worldTime:w.time,rows:w.rows.map(a=>({id:a.id,p:a.s.p,v:a.s.v,old:a.s.old,faces:a.s.faces})),snapshot:w.snapshot(),history:history(w)}))));}
  process.exitCode=1;
}finally{
  updateSummaryTiming();summary.finalMemory=memory();await save();
  for(const temp of temps)await fs.rm(temp,{recursive:true,force:true});
}
console.log(JSON.stringify({passed:summary.passed,completedSteps:summary.completedSteps,requestedSteps:args.steps,inputMode,output:args.output,error:summary.error?.message??null}));
