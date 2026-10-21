/** Read-only observer replay of the exact accepted D_CLEARANCE runtime.
 * The observer is installed before the original initial idle call so that the
 * material solver receives real idle -> walk -> entry history, not a cold jump.
 * Removing the two observer blocks must restore every byte of the frozen file.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),url=require('node:url');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=path.join(__dirname,'capture-recovery-d-clearance-runtime.snapshot.mjs');
const expected='1eab57122c8898ed55f527d1b0d269f6d04f064dd6a1d9e5f80f1be832845829';
const bindingPath='CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json';
const bindingExpected='ca59eea6d83df1265635cdc1e63678a7e075ae6c7f961c0d7391c755f13bb31c';
(async()=>{
  const frozenBytes=fs.readFileSync(frozen),frozenText=frozenBytes.toString('utf8');
  if(sha(frozenBytes)!==expected)throw Error('Original D_CLEARANCE runtime hash differs');
  const original=JSON.parse(fs.readFileSync(path.join(__dirname,'CAPTURE_RECOVERY_CHAIN_D_CLEARANCE.json')));
  if(!original.passed||original.actorIds.join(',')!=='D'||original.successfulBottleCount!==1)throw Error('Expected the accepted original one-D, one-bottle run');
  const bindingBytes=fs.readFileSync(path.join(__dirname,bindingPath));
  if(sha(bindingBytes)!==bindingExpected)throw Error('Previously verified exact display CSR changed');
  const anchor='for (const actor of actors) {\n  const state = sim.actor(actor.id);\n  reports[actor.id] = actor.motion.update({ mode: "idle", dt: 0, time: 0, x: state.x, z: state.z, yaw: state.yaw });\n}';
  if(frozenText.split(anchor).length!==2)throw Error('Unique original initial-idle observer boundary not found');
  const before=String.raw`
// BEGIN READ-ONLY INITIAL-HISTORY OBSERVER
var exactInitialHistory=[];
var exactInitialCalls=new Map();
var exactInitialStopped=new Set();
for(const observedActor of actors){
  const originalUpdate=observedActor.motion.update;
  observedActor.motion.update=function(...args){
    const result=originalUpdate.apply(this,args);
    const call=exactInitialCalls.get(observedActor.id)||0;
    exactInitialCalls.set(observedActor.id,call+1);
    if(exactInitialStopped.has(observedActor.id))return result;
    const state=sim.actor(observedActor.id),input=args[0];
    const frame=call-1;
    exactInitialHistory.push({
      id:observedActor.id+(frame<0?'-actual-initial-idle':'-actual-frame-'+frame),
      actor:observedActor.id,frame,time:sim.time,dt:input.dt,
      mode:result.mode,phase:frame<0?'initial-idle':result.stage,
      sourceFrame:result.capturedPickup?.sourceFrame??null,
      attached:result.capturedPickup?.acquisitionInput??false,
      token:state.task?.token??null,
      input:JSON.parse(JSON.stringify(input)),state:JSON.parse(JSON.stringify(state)),
      report:JSON.parse(JSON.stringify(result)),
      skinMatrices:observedActor.rig.skinMatrices.map(m=>Array.from(m)),
      posedMatrices:observedActor.rig.posedMatrices.map(m=>Array.from(m)),
      rootMatrix:Array.from(observedActor.root.matrixWorld.elements),
      rootWorld:observedActor.root.position.toArray(),
      rootTranslation:observedActor.rig.rootTranslation.slice(),
      feet:JSON.parse(JSON.stringify(result.feet))
    });
    if(result.mode==='pickup'&&result.stage==='contact-hold'&&result.capturedPickup?.sourceFrame===99)exactInitialStopped.add(observedActor.id);
    return result;
  };
}
// END READ-ONLY INITIAL-HISTORY OBSERVER
`;
  const after=String.raw`
// BEGIN READ-ONLY INITIAL-HISTORY EXPORT
const initialHistoryReference=globalThis.__D_CLEARANCE_REFERENCE__;
if(!report.passed||successful.length!==1||successful[0].id!=='D')throw Error('Unchanged original D transaction did not pass');
if(sha2(traceBytes)!==initialHistoryReference.evidence.trace.sha256)throw Error('Observer replay differs from the exact accepted original trace');
if(exactInitialHistory[0]?.frame!==-1||exactInitialHistory[0]?.dt!==0||exactInitialHistory[0]?.mode!=='idle')throw Error('The real initial idle call was not captured');
for(let i=1;i<exactInitialHistory.length;i++)if(exactInitialHistory[i].frame!==i-1)throw Error('Observed actual update sequence has a gap');
const initialHistoryLast=exactInitialHistory.at(-1);
if(initialHistoryLast.phase!=='contact-hold'||initialHistoryLast.sourceFrame!==99)throw Error('Initial history did not reach the original measured contact event');
const initialHistoryBinding=globalThis.__D_CLEARANCE_INITIAL_BINDING__;
const initialHistoryActor=actors.find(a=>a.id==='D');
const initialHistoryData={
  schema:'actual-native-initial-contact-history/1',actorIds:['D'],bodyVertexCount:9253,
  faces:Array.from(initialHistoryActor.nativeSource.faces),sourceHashes,
  frozenRuntimeSha256:'1eab57122c8898ed55f527d1b0d269f6d04f064dd6a1d9e5f80f1be832845829',
  sameOriginalTraceSha256:sha2(traceBytes),headIncluded:false,
  capture:'Immediately after each unchanged actual NativeMotion.update and before that step of physics. First row is the original dt=0 idle update before public bottle spawn; subsequent rows are every actual frame without interpolation.',
  binding:initialHistoryBinding,
  boundary:'No cloth state was computed by this motion observer. The material solver may initialize against the actual initial idle body and must then consume these measured frames in order.',
  scope:'One frozen D pickup transaction using its original compiled shoe and motion snapshot; not current shoes, six actors, head, cloth, food or rendered verification.',
  states:exactInitialHistory
};
const initialHistoryBytes=Buffer.from(JSON.stringify(initialHistoryData));
const initialHistoryFile=path2.join(root2,'evidence/CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_CONTACT_POSES.json');
fs2.writeFileSync(initialHistoryFile,initialHistoryBytes);
globalThis.__D_CLEARANCE_INITIAL_RESULT__={
  schema:'exact-frozen-pickup-initial-history-replay/1',actorIds:['D'],originalGatesUnchanged:true,originalGates:report.gates,
  originalTraceExact:true,originalTraceSha256:sha2(traceBytes),sourceHashes,
  states:exactInitialHistory.length,first:{frame:exactInitialHistory[0].frame,mode:exactInitialHistory[0].mode,dt:exactInitialHistory[0].dt},
  last:{frame:initialHistoryLast.frame,phase:initialHistoryLast.phase,sourceFrame:initialHistoryLast.sourceFrame},
  stageCounts:Object.fromEntries([...new Set(exactInitialHistory.map(r=>r.phase||r.mode))].map(k=>[k,exactInitialHistory.filter(r=>(r.phase||r.mode)===k).length])),
  poses:{path:path2.basename(initialHistoryFile),bytes:initialHistoryBytes.length,sha256:sha2(initialHistoryBytes)},binding:initialHistoryBinding,
  scope:initialHistoryData.scope,boundary:initialHistoryData.boundary
};
console.log(JSON.stringify({initialHistoryReplay:true,states:exactInitialHistory.length,output:globalThis.__D_CLEARANCE_INITIAL_RESULT__.poses}));
// END READ-ONLY INITIAL-HISTORY EXPORT
`;
  const observedText=frozenText.replace(anchor,before+anchor)+after;
  const restored=observedText.slice(0,-after.length).replace(before,'');
  if(!Buffer.from(restored).equals(frozenBytes))throw Error('Removing observers did not restore the exact frozen original');
  globalThis.__NPC_QA_THREE__=await require('../build.cjs').loadNativeThreeForQA();
  globalThis.__CAPTURE_QA_ROOT__=root;globalThis.__CAPTURE_QA_SOURCE_HASHES__=original.sourceHashes;
  globalThis.__D_CLEARANCE_REFERENCE__=original;
  globalThis.__D_CLEARANCE_INITIAL_BINDING__={path:bindingPath,bytes:bindingBytes.length,sha256:bindingExpected};
  process.env.ACTOR_IDS='D';process.env.EXTRA_BOTTLES='0';process.env.RUN_TAG='D_CLEARANCE_INITIAL_HISTORY_REPLAY';
  const observed=path.join(__dirname,'capture-recovery-d-clearance-initial-observed.runtime.mjs');
  fs.writeFileSync(observed,observedText);
  await import(url.pathToFileURL(observed).href+'?t='+Date.now());
  const receipt={...globalThis.__D_CLEARANCE_INITIAL_RESULT__,
    frozenBundle:{path:path.relative(root,frozen),bytes:frozenBytes.length,sha256:expected},
    observer:{originalBytesRecoverableExactly:true,bytes:Buffer.byteLength(before+after),sha256:sha(before+after),insertion:'before the exact original initial idle update; end export appended'},
    combinedBundle:{bytes:Buffer.byteLength(observedText),sha256:sha(observedText)},
    command:'node evidence/replay-d-clearance-initial-history.cjs'};
  fs.writeFileSync(path.join(__dirname,'CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_HISTORY_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
