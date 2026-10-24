/** Replays one already-certified exact compiled snapshot to retain its dense
 * material input. Appending an observer leaves every original byte unchanged.
 * It is neither a new motion candidate nor a current-shoe certification.
 */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),url=require('node:url');
const root=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const frozen=path.join(__dirname,'capture-recovery-d-clearance-runtime.snapshot.mjs'),expected='1eab57122c8898ed55f527d1b0d269f6d04f064dd6a1d9e5f80f1be832845829';
(async()=>{
 const bytes=fs.readFileSync(frozen);if(hash(bytes)!==expected)throw Error('Exact D_CLEARANCE compiled snapshot changed');
 const original=JSON.parse(fs.readFileSync(path.join(__dirname,'CAPTURE_RECOVERY_CHAIN_D_CLEARANCE.json')));
 if(!original.passed||original.actorIds.join(',')!=='D'||original.successfulBottleCount!==1)throw Error('Frozen D reference is not the accepted one-actor transaction');
 globalThis.__NPC_QA_THREE__=await require('../build.cjs').loadNativeThreeForQA();globalThis.__CAPTURE_QA_ROOT__=root;globalThis.__CAPTURE_QA_SOURCE_HASHES__=original.sourceHashes;
 globalThis.__D_CLEARANCE_REFERENCE__=original;process.env.ACTOR_IDS='D';process.env.EXTRA_BOTTLES='0';process.env.RUN_TAG='D_CLEARANCE_WARMSTART_REPLAY';
 const observer=String.raw`
// BEGIN READ-ONLY DENSE OBSERVER; the exact frozen runtime above is intact.
const denseReplayFS=await import('node:fs'),denseReplayPath=await import('node:path'),denseReplayCrypto=await import('node:crypto');
const denseReplayHash=b=>denseReplayCrypto.createHash('sha256').update(b).digest('hex');
const denseReplayActor=actors.find(a=>a.id==='D'),denseReplaySuccess=successful.find(r=>r.id==='D'),denseReplayRows=poses.get(denseReplaySuccess?.token);
if(!report.passed||!denseReplayRows)throw Error('Exact frozen D replay failed its unchanged original gates');
const denseReplayReference=globalThis.__D_CLEARANCE_REFERENCE__;
if(denseReplayHash(traceBytes)!==denseReplayReference.evidence.trace.sha256)throw Error('Frozen replay trace differs from the accepted D_CLEARANCE trace');
const denseReplayStates=denseReplayRows.filter(r=>['entry','down','contact-hold'].includes(r.phase)).map(r=>({...r,id:'D-actual-'+r.phase+'-'+r.frame,
 skinMatrices:Array.from({length:104},(_,j)=>Array.from(r.skinMatrices.slice(j*16,j*16+16))),posedMatrices:Array.from({length:104},(_,j)=>Array.from(r.posedMatrices.slice(j*16,j*16+16))),rootMatrix:Array.from(r.rootMatrix)}));
const denseReplayBinding={schema:'native-actual-display-csr/1',actor:'D',bodyVertexCount:denseReplayActor.binding.N,faces:Array.from(denseReplayActor.nativeSource.faces),
 displayRange:Array.from(denseReplayActor.binding.displayRange),displayPacked:Array.from(denseReplayActor.binding.displayPacked),rigNames:denseReplayActor.rig.names,
 source:'The exact runtime full displayed-body CSR, including both neutral residual corrections and Float32 packed entries; no truncation or raw-packet substitute.',
 sampleFormula:'For each vertex, all displayRange 4-stride entries: sum w*(skinMatrix[j] * packedNativeXYZ); matrices row-major, each packed entry stride8 [x,y,z,joint,w,...].',headIncluded:false};
const denseReplayBindingBytes=Buffer.from(JSON.stringify(denseReplayBinding)),denseReplayBindingFile=denseReplayPath.join(root2,'evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json');denseReplayFS.writeFileSync(denseReplayBindingFile,denseReplayBindingBytes);
const denseReplayData={schema:'actual-native-captured-entry-contact-poses/1',actorIds:['D'],bodyVertexCount:9253,faces:Array.from(denseReplayActor.nativeSource.faces),sourceHashes,
 source:'All measured source frames from entry through actual contact99, replayed from the unchanged accepted D_CLEARANCE compiled snapshot. Original full trace SHA matched exactly.',
 bundleSha256:'1eab57122c8898ed55f527d1b0d269f6d04f064dd6a1d9e5f80f1be832845829',sameOriginalTraceSha256:denseReplayHash(traceBytes),headIncluded:false,
 binding:{path:denseReplayPath.basename(denseReplayBindingFile),bytes:denseReplayBindingBytes.length,sha256:denseReplayHash(denseReplayBindingBytes)},states:denseReplayStates};
const denseReplayBytes=Buffer.from(JSON.stringify(denseReplayData)),denseReplayFile=denseReplayPath.join(root2,'evidence/CAPTURE_RECOVERY_D_CLEARANCE_ENTRY_CONTACT_POSES.json');denseReplayFS.writeFileSync(denseReplayFile,denseReplayBytes);
globalThis.__D_CLEARANCE_DENSE_RESULT__={schema:'exact-frozen-pickup-warmstart-replay/1',actorIds:['D'],originalGatesUnchanged:true,originalGates:report.gates,originalTraceExact:true,
 originalTraceSha256:denseReplayHash(traceBytes),sourceHashes,frames:denseReplayStates.length,first:denseReplayStates[0]&&{frame:denseReplayStates[0].frame,phase:denseReplayStates[0].phase,sourceFrame:denseReplayStates[0].sourceFrame},
 last:denseReplayStates.at(-1)&&{frame:denseReplayStates.at(-1).frame,phase:denseReplayStates.at(-1).phase,sourceFrame:denseReplayStates.at(-1).sourceFrame},
 poses:{path:denseReplayPath.basename(denseReplayFile),bytes:denseReplayBytes.length,sha256:denseReplayHash(denseReplayBytes)},binding:denseReplayData.binding,
 scope:'Additional output from exactly the accepted single D/one-bottle transaction; no new candidate, current-shoe, whole-six, food, head, cloth or visual certificate.'};
console.log(JSON.stringify({denseReplay:true,frames:denseReplayStates.length,poses:globalThis.__D_CLEARANCE_DENSE_RESULT__.poses,binding:denseReplayData.binding}));
// END READ-ONLY DENSE OBSERVER
`;
 const combined=Buffer.concat([bytes,Buffer.from(observer)]);if(!combined.subarray(0,bytes.length).equals(bytes))throw Error('Original compiled snapshot prefix was modified');
 const observed=path.join(__dirname,'capture-recovery-d-clearance-observed.runtime.mjs');fs.writeFileSync(observed,combined);
 await import(url.pathToFileURL(observed).href+'?t='+Date.now());
 const receipt={...globalThis.__D_CLEARANCE_DENSE_RESULT__,frozenBundle:{path:path.relative(root,frozen),bytes:bytes.length,sha256:expected},
 observer:{onlyAppended:true,bytes:Buffer.byteLength(observer),sha256:hash(observer)},combinedBundle:{bytes:combined.length,sha256:hash(combined)},
 command:'node evidence/replay-d-clearance-warmstart.cjs'};
 fs.writeFileSync(path.join(__dirname,'CAPTURE_RECOVERY_D_CLEARANCE_WARMSTART_RECEIPT.json'),JSON.stringify(receipt,null,2)+'\n');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
