/** Read-only replay of the frozen SIX_FINAL prefix through E's entry.
 * Only observations and the final loop boundary differ; no motion, navigation,
 * contact, object, inventory, or receipt code is replaced.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),url=require('node:url');
const root=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const frozen=path.join(__dirname,'capture-recovery-six-final-runtime.snapshot.mjs');
 if(!fs.existsSync(frozen))fs.copyFileSync(path.join(__dirname,'.capture-recovery-chain-runtime.mjs'),frozen);
 const bytes=fs.readFileSync(frozen),expected='5ae53a60725775610bae7d29ba7d0a9bdee1d4810d6b17754e5b8e86f66d2756';
 if(sha(bytes)!==expected)throw Error('Original SIX_FINAL bundle differs');
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'CAPTURE_RECOVERY_CHAIN_SIX_FINAL.json'))),oldTrace=JSON.parse(fs.readFileSync(path.join(__dirname,'CAPTURE_RECOVERY_CHAIN_SIX_FINAL_TRACE.json')));
 let source=bytes.toString(),observations=[],currentFrame=-1;
 globalThis.__ENTRY_OBSERVE__=(stage,helper,input)=>{
  if(!['C','E','D'].includes(helper.actor.id))return;
  const a=helper.actor,m=helper.motion,r=helper.rig;
  const row={actor:a.id,stage,frame:currentFrame,input,rootWorld:a.root.position.toArray(),rootQuaternion:a.root.quaternion.toArray(),rootYaw:a.root.rotation.y,
   rootTranslation:r.rootTranslation.slice(),skinMatrices:r.skinMatrices.map(x=>Array.from(x)),posedMatrices:r.posedMatrices.map(x=>Array.from(x)),rotationDeltas:r.rotationDeltas.map(x=>Array.from(x)),
   lastInput:m.lastInput,lastFeet:m.lastFeet,lastMode:m.lastMode,lastReport:m.lastReport};
  if(stage==='after')row.entry=helper.entry;
  observations.push(JSON.parse(JSON.stringify(row)));
 };
 globalThis.__ENTRY_FRAME__=n=>{currentFrame=n;};
 const replacements=[
  ['  _start({ x, z, yaw: yaw2, target, progress }) {','  _start({ x, z, yaw: yaw2, target, progress }) {\n    globalThis.__ENTRY_OBSERVE__("before",this,{x,z,yaw:yaw2,target,progress});'],
  ['    this._applyPacked(packed);\n  }\n  update({ dt: dt2, time, x, z, yaw: yaw2, progress, target, grip, pickupAttached = false }) {','    this._applyPacked(packed);\n    globalThis.__ENTRY_OBSERVE__("after",this,{x,z,yaw:yaw2,target,progress});\n  }\n  update({ dt: dt2, time, x, z, yaw: yaw2, progress, target, grip, pickupAttached = false }) {'],
  ['for (let frame = 0; frame < maxSeconds / dt; frame++) {','for (let frame = 0; frame < maxSeconds / dt; frame++) {\n  globalThis.__ENTRY_FRAME__(frame);'],
  ['    if (failure) break;','    if (failure || frame===434) break;']
 ];
 for(const [from,to]of replacements){if(source.split(from).length!==2)throw Error('Unique prefix observer boundary missing: '+from.slice(0,70));source=source.replace(from,to);}
 const tail='for (const p2 of Object.values(perActor)) {';
 const at=source.lastIndexOf(tail);if(at<0)throw Error('Summary boundary missing');
 const originalTail=source.slice(at);source=source.slice(0,at)+'globalThis.__ENTRY_PREFIX_RESULT__={trace, failure};\n';
 const reconstructed=(source.slice(0,source.lastIndexOf('globalThis.__ENTRY_PREFIX_RESULT__'))+originalTail);
 let restored=reconstructed;for(const [from,to]of replacements)restored=restored.replace(to,from);
 if(!Buffer.from(restored).equals(bytes))throw Error('Observer removal failed to recover original bundle bytes');
 globalThis.__NPC_QA_THREE__=await require('../build.cjs').loadNativeThreeForQA();globalThis.__CAPTURE_QA_ROOT__=root;globalThis.__CAPTURE_QA_SOURCE_HASHES__=original.sourceHashes;
 process.env.ACTOR_IDS='A,B,C,D,E,F';process.env.EXTRA_BOTTLES='1';process.env.RUN_TAG='SIX_ENTRY_BOUNDARY_ONLY';
 const runtime=path.join(__dirname,'.six-entry-boundaries-runtime.mjs');fs.writeFileSync(runtime,source);
 await import(url.pathToFileURL(runtime).href+'?t='+Date.now());
 const result=globalThis.__ENTRY_PREFIX_RESULT__,reference=oldTrace.filter(r=>r.frame<=434);
 if(JSON.stringify(result.trace)!==JSON.stringify(reference))throw Error('Observed historical prefix changed');
 if(result.failure)throw Error('Unexpected original-prefix failure');
 const data={schema:'actual-native-entry-boundaries/1',actors:['C','E','D'],frozenBundleSHA256:expected,originalTracePrefixExact:true,throughFrame:434,
  scope:'Read-only original six-person prefix. Observations preserve exact real previous walk/arrival state for isolated entry replay; not a new complete transport certificate.',
  sourceHashes:original.sourceHashes,observations};
 const out=Buffer.from(JSON.stringify(data));fs.writeFileSync(path.join(__dirname,'CAPTURE_ENTRY_BOUNDARIES_CED.json'),out);
 const receipt={schema:data.schema,frozenBundleSHA256:expected,originalTracePrefixExact:true,prefixFramesThrough:434,prefixRows:result.trace.length,
  runtime:{bytes:Buffer.byteLength(source),sha256:sha(source)},output:{path:'CAPTURE_ENTRY_BOUNDARIES_CED.json',bytes:out.length,sha256:sha(out)},
  observations:observations.map(r=>({actor:r.actor,stage:r.stage,frame:r.frame,rootYaw:r.rootYaw,lastInput:r.lastInput,previousPlanted:r.lastFeet&&Object.fromEntries(Object.entries(r.lastFeet).map(([k,v])=>[k,v.planted]))})),
  command:'node evidence/replay-six-entry-boundaries.cjs'};
 fs.writeFileSync(path.join(__dirname,'CAPTURE_ENTRY_BOUNDARIES_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
