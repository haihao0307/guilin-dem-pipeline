/** One research replay of a frozen public R02 material packet.
 * No R02 file is written. Relative imports are resolved in an isolated clone;
 * appended exports load immutable evidence and perform read-only checkpoints.
 * Solver code, stages, numeric constants and acceptance gates are unchanged.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import os from 'node:os';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../../..');
const rooted=p=>path.resolve(ROOT,p);
const APP=rooted(process.env.APP||process.argv[2]||'kaopu-tailor-workbench/clo-learning-r02');
const PAPER=rooted(process.env.PAPER||process.argv[3]||'docs/handoffs/clo-learning-r02-20261022/acceptance/public/public-browser-smoke.packet-3-paper-request-2.json.gz');
const DONE=rooted(process.env.DONE||process.argv[4]||'docs/handoffs/clo-learning-r02-20261022/acceptance/public/public-browser-smoke.packet-4-done-request-2.json.gz');
const OUT=rooted(process.env.OUT||process.argv[5]||'contact-learning-output/clo-contact-learning-20261022');
const EXPECTED_WORKER_SHA256='84f3d41aa9bfc34f0eb317a755972d49f90f8349a2225e80f2214356176fae0d';
const EXPECTED_PAPER_PACKET_SHA256='fb4d2d90c237f42b7efe2de1d6be5bb58c2a0939d926637f1ab1c2171ea3fb47';
const EXPECTED_DONE_PACKET_SHA256='bab71beee5c7a177e77199e1766af65c64972f5c026d16dc24b060ce7d86382e';
const hash=x=>createHash('sha256').update(x).digest('hex');
await fs.mkdir(OUT,{recursive:true});
const sourceFile=path.join(APP,'generated/native-adapter.mjs');
const sourceBytes=await fs.readFile(sourceFile);const sourceText=sourceBytes.toString();
const paperBytes=await fs.readFile(PAPER),doneBytes=await fs.readFile(DONE);
if(hash(sourceBytes)!==EXPECTED_WORKER_SHA256)throw Error('Frozen generated worker identity mismatch');
if(hash(paperBytes)!==EXPECTED_PAPER_PACKET_SHA256||hash(doneBytes)!==EXPECTED_DONE_PACKET_SHA256)throw Error('Frozen public packet bytes mismatch');
const paperWrapper=JSON.parse(gunzipSync(paperBytes)),expectedDone=JSON.parse(gunzipSync(doneBytes));
if(paperWrapper.sourceHead!=='c5c99dd6e7fb2124435653843c618bc6a4e4c47b'||expectedDone.sourceHead!==paperWrapper.sourceHead)throw Error('Unexpected source version');
if(paperWrapper.packet.type!=='paper'||paperWrapper.packet.requestId!==2||paperWrapper.packet.binding.operation.deltaMm!==100||paperWrapper.packet.binding.operation.slitDeltaMm!==-40)throw Error('Unexpected frozen input');
const imports=[];
const rewritten=sourceText.replace(/(from\s*['"])(\.{1,2}\/[^'"\r\n]+)(['"])/g,(_,a,p,b)=>{
 const resolved=path.resolve(path.dirname(sourceFile),p);imports.push({from:p,resolved});return a+pathToFileURL(resolved).href+b;
});
const extension=String.raw`
// RESEARCH-ONLY APPENDED EXPORTS. No original solver body is modified.
import {createHash as researchCreateHash} from 'node:crypto';
const researchHash=x=>researchCreateHash('sha256').update(x).digest('hex');
const researchCanonical=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(researchCanonical):Object.fromEntries(Object.keys(x).sort().map(k=>[k,researchCanonical(x[k])])):x;
export async function researchLoadFrozenPaper(p){
 if(p.type!=='paper'||p.requestId!==2||p.binding.presetId!=='S03')throw Error('FROZEN_INPUT_IDENTITY');
 requirePerson(p.binding.person,R04_LOCK.person);
 if(await materialHash(p.spec)!==p.binding.materialSHA256)throw Error('FROZEN_MATERIAL_HASH');
 if(await sha(JSON.stringify(p.analytic))!==p.binding.paperSHA256)throw Error('FROZEN_ANALYTIC_HASH');
 if(await sha(JSON.stringify(researchCanonical(p.binding.operation)))!==p.binding.operationSHA256)throw Error('FROZEN_OPERATION_HASH');
 if(JSON.stringify(p.spec.source.nativeBinding)!==JSON.stringify(p.binding))throw Error('FROZEN_NESTED_BINDING');
 if(p.binding.basePaperSHA256!==R04_ROWS.S03.decodedSHA256)throw Error('FROZEN_BASE_PAPER');
 validate2(p.spec);
 stop();requestId=p.requestId;spec=structuredClone(p.spec);analytic=structuredClone(p.analytic);lab=null;resetContinuation();
 nativeBinding=structuredClone(p.binding);
 config={kind:'analytic',variant43:true,recipe:{bodyCm:structuredClone(analytic.bodyCm),design:{style:'PencilSkirt',...structuredClone(analytic.design)}}};
 for(const key in profile)profile[key]=0;
 if(preflightSizing(analytic).blocking)throw Error('FROZEN_PREFLIGHT_BLOCKED');
 return {materialSHA256:await materialHash(spec),paperSHA256:await sha(JSON.stringify(analytic)),requestId};
}
function researchFingerprint(){
 const state={frameCount:lab.frameCount,elapsed:lab.elapsed,seamElapsed:lab.seamElapsed,stageIndex,stageFrame,
  constraints:lab.constraints,seamConstraints:lab.seamConstraints,active:[...lab.active],pins:[...lab.pins],support:lab.support,
  groups:{parent:lab.stitchGroups.parent,rank:lab.stitchGroups.rank,groupCount:lab.stitchGroups.groupCount,representatives:lab.stitchGroups.representatives},
  gravityScale:lab.gravityScale,substeps:lab.substeps,iterations:lab.iterations,strainGuard:lab.strainGuard,
  collisions:lab.collisions,selfCollisionEnabled:lab.selfCollisionEnabled};
 return {wasmMemorySHA256:researchHash(new Uint8Array(lab.kernel.memory.buffer)),
  solverJSStateSHA256:researchHash(JSON.stringify(state)),specSHA256:researchHash(JSON.stringify(spec)),
  analyticSHA256:researchHash(JSON.stringify(analytic)),bindingSHA256:researchHash(JSON.stringify(nativeBinding)),
  bodyMeshSHA256:researchHash(JSON.stringify(bodyAudit))};
}
export function researchAuditCheckpoint(label){
 if(!lab||!bodyAudit)throw Error('NO_CHECKPOINT_STATE');
 const before=researchFingerprint(),start=performance.now();
 const positionsMm=lab.positions.map(v=>Array.from(v,x=>x*1000));
 const materialToSolverGroup=Array.from(lab.alias);
 const intersections=strictIntersectionAudit(spec,positionsMm,materialToSolverGroup,bodyAudit);
 const auditMs=performance.now()-start,after=researchFingerprint();
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('AUDIT_MUTATED_STATE');
 return {label,stageIndex,stageFrame,frameCount:lab.frameCount,elapsedSimulationSeconds:lab.elapsed,
  activeSeams:[...lab.active],positionsMm,materialToSolverGroup,spec:structuredClone(spec),intersections,auditMs,
  observedStateHashesBefore:before,observedStateHashesAfter:after,observedStateUnchanged:true};
}
`;
const clone=path.join(OUT,'research-worker.mjs');await fs.writeFile(clone,rewritten+extension);
const backend=path.join(APP,'upstream/kaopu-tailor-workbench/pattern-batch/r02/backend');
const assetPaths={
 'common-body.json':'assets/common-body.json','common-body.sdfd.gz':'assets/common-body.sdfd.gz',
 'body-sdf-grid.json':'assets/body-sdf-grid.json','joint-r043c.wasm':'correctives/r043c/joint-r043c.wasm'
};
const assets={};for(const[k,p]of Object.entries(assetPaths))assets[k]=await fs.readFile(path.join(backend,p));
const imported=[];for(const i of imports)imported.push({...i,sha256:hash(await fs.readFile(i.resolved))});
globalThis.self=globalThis;
globalThis.fetch=async u=>{const url=new URL(String(u));if(url.origin!=='https://kaopu-embedded.invalid')throw Error('Unexpected network access');const x=assets[url.pathname.split('/').at(-1)];if(!x)throw Error('Missing frozen asset');return new Response(x,{status:200});};
let worker,resolve,reject,finished=false;const checkpoints=[];
const completion=new Promise((r,j)=>{resolve=r;reject=j;});const started=performance.now();
let observedDone;
globalThis.postMessage=d=>{
 try{
  if(d.type==='started'||d.type==='stage'||d.type==='done'){
   const label=d.type==='stage'?'after-'+d.completedStage:d.type;
   const c=worker.researchAuditCheckpoint(label);checkpoints.push(c);
   console.log(JSON.stringify({checkpoint:label,clothPairs:c.intersections.selfStrictTriangleIntersectionCount,bodyFaces:c.intersections.bodyIntersectingFaceCount,stateUnchanged:c.observedStateUnchanged,auditMs:Math.round(c.auditMs)}));
  }
  if(d.type==='paused'&&d.budgetCheckpoint)throw Error('Research replay exceeded original 180 second budget; no automatic continuation');
  if(d.type==='error')throw Error(d.message);
  if(d.type==='done'){observedDone=structuredClone(d);finished=true;resolve();}
 }catch(e){finished=true;reject(e);}
};
const timeout=setTimeout(()=>{if(!finished)reject(Error('REPLAY_TIMEOUT'));},175000);
try{
 worker=await import(pathToFileURL(clone).href);
 await self.onmessage({data:{type:'boot',root:'https://kaopu-embedded.invalid/backend/',patternBase:'https://kaopu-embedded.invalid/disabled-python/'}});
 const inputVerified=await worker.researchLoadFrozenPaper(paperWrapper.packet);
 await self.onmessage({data:{type:'run',requestId:2,person:paperWrapper.packet.binding.person}});
 await completion;
 const elapsed=(performance.now()-started)/1000;
 const beforePaperSHA=hash(paperBytes),afterPaperSHA=hash(await fs.readFile(PAPER));
 const sourceUnchanged=hash(sourceBytes)===hash(await fs.readFile(sourceFile));
 if(!sourceUnchanged||beforePaperSHA!==afterPaperSHA||hash(doneBytes)!==hash(await fs.readFile(DONE)))throw Error('Frozen source or reference bytes changed during replay');
 const labels=['started','after-darts','after-waist','after-sides','after-shell','after-seam-relax','after-seam-finish','after-release','after-refine','after-joint','done'];
 if(JSON.stringify(checkpoints.map(c=>c.label))!==JSON.stringify(labels))throw Error('Incomplete stage checkpoint coverage');
 const record=observedDone.record,intersections=observedDone.intersections;
 const vertexCount=observedDone.spec.panels.reduce((n,p)=>n+p.uvMm.length,0),faceCount=observedDone.spec.panels.reduce((n,p)=>n+p.triangles.length,0);
 if(observedDone.requestId!==paperWrapper.packet.requestId||JSON.stringify(observedDone.binding)!==JSON.stringify(paperWrapper.packet.binding)||JSON.stringify(record.nativeBinding)!==JSON.stringify(observedDone.binding))throw Error('Final result binding mismatch');
 if(record.positionsMm.length!==vertexCount||record.positionsMm.some(p=>p.length!==3||p.some(x=>!Number.isFinite(x)))||!record.metrics.finite)throw Error('Incomplete or nonfinite final positions');
 if(!Number.isInteger(intersections.selfStrictTriangleIntersectionCount)||intersections.selfStrictTriangleIntersectionCount<0||intersections.selfPairs.length!==intersections.selfStrictTriangleIntersectionCount||intersections.selfPairs.some(p=>p.length!==2||p.some(x=>!Number.isInteger(x)||x<0||x>=faceCount)||p[0]>=p[1])||new Set(intersections.selfPairs.map(p=>p.join(','))).size!==intersections.selfPairs.length)throw Error('Malformed final cloth intersection evidence');
 if(!Number.isInteger(intersections.bodyIntersectingFaceCount)||intersections.bodyIntersectingFaceCount<0||intersections.bodyIntersectingFaces.length!==intersections.bodyIntersectingFaceCount||intersections.bodyIntersectingFaces.some(x=>!Number.isInteger(x)||x<0||x>=faceCount)||new Set(intersections.bodyIntersectingFaces).size!==intersections.bodyIntersectingFaces.length)throw Error('Malformed final body intersection evidence');
 const failures=record.staticGate.failures;
 if(record.staticGate.passed!==(failures.length===0)||failures.includes('cloth-intersections')!==(intersections.selfStrictTriangleIntersectionCount>0)||failures.includes('body-intersections')!==(intersections.bodyIntersectingFaceCount>0))throw Error('Final gate disagrees with final evidence');
 if(record.solver.selfCollision!==false||record.trial.runtimeSelfContact!==false||record.trial.continuousCollision!==false)throw Error('Frozen contact capability changed');
 if(JSON.stringify(record.staticGate.thresholds)!==JSON.stringify(expectedDone.packet.record.staticGate.thresholds))throw Error('Frozen acceptance thresholds changed');
 const samePositions=JSON.stringify(observedDone.record.positionsMm)===JSON.stringify(expectedDone.packet.record.positionsMm);
 let maxPositionDifferenceMm=0;
 observedDone.record.positionsMm.forEach((p,i)=>p.forEach((v,k)=>{maxPositionDifferenceMm=Math.max(maxPositionDifferenceMm,Math.abs(v-expectedDone.packet.record.positionsMm[i][k]));}));
 const summary={schema:'kaopu.frozen-material-stage-trace/1',sourceHead:paperWrapper.sourceHead,
  originalWorkerSHA256:hash(sourceBytes),researchCloneSHA256:hash(rewritten+extension),originalWorkerUnchanged:sourceUnchanged,
  resultStateChecks:{completeCheckpointSequence:true,finiteCompletePositions:true,bindingMatchesFrozenInput:true,intersectionArraysWellFormed:true,gateMatchesEvidence:true,unchangedThresholds:true,unchangedContactCapability:true,referenceResultEqualityRequired:false},
  paperPacketSHA256:beforePaperSHA,paperPacketUnchanged:beforePaperSHA===afterPaperSHA,donePacketSHA256:hash(doneBytes),inputVerified,
  runtime:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,osRelease:os.release()},
  importedModules:imported,assetHashes:Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,hash(v)])),
  checkpointSummary:checkpoints.map(c=>({label:c.label,stageIndex:c.stageIndex,stageFrame:c.stageFrame,clothPairs:c.intersections.selfStrictTriangleIntersectionCount,bodyFaces:c.intersections.bodyIntersectingFaceCount,auditMs:c.auditMs,observedStateUnchanged:c.observedStateUnchanged})),
  completion:{staticPassed:observedDone.record.staticGate.passed,failures:observedDone.record.staticGate.failures,clothPairs:observedDone.intersections.selfStrictTriangleIntersectionCount,bodyFaces:observedDone.intersections.bodyIntersectingFaceCount,
   publicComparison:{positionsExactlyEqual:samePositions,maxPositionCoordinateDifferenceMm:maxPositionDifferenceMm,intersectionPairsExactlyEqual:JSON.stringify(observedDone.intersections.selfPairs)===JSON.stringify(expectedDone.packet.intersections.selfPairs)}},
  wallSecondsIncludingDiagnostics:elapsed,createdAt:new Date().toISOString(),
  limitations:['One Node replay from frozen Chromium material, not a browser trajectory observation or cross-runtime equivalence certificate.',
   'Checks sample started and stage endpoints only; first nonzero checkpoint is not exact time of first collision.',
   'Diagnostic costs alter wall timing, not the checked positions/velocity/constraints/memory; not a performance benchmark.',
   'No self-contact response was enabled and no solver stage, threshold or production file was changed.',
   'Final-state association with a seam or stage does not prove a specific cause.']};
 const checkpointsFile=path.join(OUT,'CHECKPOINTS.json.gz');const resultFile=path.join(OUT,'REPLAY_DONE.json.gz');
 await fs.writeFile(checkpointsFile,gzipSync(JSON.stringify({schema:'kaopu.frozen-material-checkpoints/1',sourceHead:paperWrapper.sourceHead,checkpoints}),{level:9}));
 await fs.writeFile(resultFile,gzipSync(JSON.stringify(observedDone),{level:9}));
 summary.artifacts={checkpoints:{file:'CHECKPOINTS.json.gz',sha256:hash(await fs.readFile(checkpointsFile))},done:{file:'REPLAY_DONE.json.gz',sha256:hash(await fs.readFile(resultFile))}};
 await fs.writeFile(path.join(OUT,'TRACE_REVIEW.json'),JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify({complete:true,...summary.completion,wallSecondsIncludingDiagnostics:elapsed}));
}catch(error){
 await fs.writeFile(path.join(OUT,'TRACE_FAILURE.json'),JSON.stringify({message:error.message,stack:error.stack,checkpoints},null,2));
 throw error;
}finally{clearTimeout(timeout);}
