/** Re-audit saved Float64 checkpoints without another solve. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../../../..');
const APP=path.resolve(ROOT,process.env.APP||process.argv[2]||'kaopu-tailor-workbench/clo-learning-r02');
const OUT=path.resolve(ROOT,process.env.OUT||process.argv[3]||'contact-learning-output/clo-contact-learning-20261022');
const EXPECTED_WORKER_SHA256='84f3d41aa9bfc34f0eb317a755972d49f90f8349a2225e80f2214356176fae0d';
const hash=x=>createHash('sha256').update(x).digest('hex');
const review=JSON.parse(await fs.readFile(path.join(OUT,'TRACE_REVIEW.json'),'utf8'));
if(review.sourceHead!=='c5c99dd6e7fb2124435653843c618bc6a4e4c47b'||review.originalWorkerUnchanged!==true||review.paperPacketUnchanged!==true)throw Error('Replay source provenance incomplete');
const original=await fs.readFile(path.join(APP,'generated/native-adapter.mjs'));
if(hash(original)!==EXPECTED_WORKER_SHA256||hash(original)!==review.originalWorkerSHA256)throw Error('Original worker changed');
const b=original.toString();
const a=b.indexOf('// tailor-unify-20261007/work/kaopu-tailor-workbench/garments-r04/src/intersection-audit.mjs');
const z=b.indexOf('// garment-catalogue-assembly-20261007/src/analytic-mesher.mjs',a);
if(a<0||z<a)throw Error('Audit boundaries changed');
const backend=path.join(APP,'upstream/kaopu-tailor-workbench/pattern-batch/r02/backend');
const imported=await import(pathToFileURL(path.join(backend,'native/kaopu-tailor-workbench/r07/stability/audit.mjs')).href);
const exactAudit=new Function('coplanarPositiveOverlap',b.slice(a,z)+'\nreturn {strictIntersectionAudit,prepareBodyAudit};')(imported.coplanarPositiveOverlap);
const bodyBytes=await fs.readFile(path.join(backend,'assets/common-body.json'));
if(hash(bodyBytes)!==review.assetHashes['common-body.json'])throw Error('Body changed');
const body=exactAudit.prepareBodyAudit(JSON.parse(bodyBytes));
const saved=await fs.readFile(path.join(OUT,review.artifacts.checkpoints.file));
if(hash(saved)!==review.artifacts.checkpoints.sha256)throw Error('Saved checkpoint hash mismatch');
const record=JSON.parse(gunzipSync(saved));
const expectedLabels=['started','after-darts','after-waist','after-sides','after-shell','after-seam-relax','after-seam-finish','after-release','after-refine','after-joint','done'];
if(JSON.stringify(record.checkpoints.map(c=>c.label))!==JSON.stringify(expectedLabels))throw Error('Checkpoint coverage mismatch');
const rows=record.checkpoints.map(c=>{
 const before=hash(JSON.stringify({spec:c.spec,positions:c.positionsMm,groups:c.materialToSolverGroup}));
 const actual=exactAudit.strictIntersectionAudit(c.spec,c.positionsMm,c.materialToSolverGroup,body);
 const after=hash(JSON.stringify({spec:c.spec,positions:c.positionsMm,groups:c.materialToSolverGroup}));
 if(before!==after||JSON.stringify(actual)!==JSON.stringify(c.intersections))throw Error('Checkpoint failed replay: '+c.label);
 if(JSON.stringify(c.observedStateHashesBefore)!==JSON.stringify(c.observedStateHashesAfter))throw Error('Checkpoint audit not read-only: '+c.label);
 return {label:c.label,clothPairs:actual.selfStrictTriangleIntersectionCount,bodyFaces:actual.bodyIntersectingFaceCount,
  exactAuditEqual:true,serializedInputsUnchanged:true,recordedLiveStateUnchanged:true};
});
const finalRecordBytes=await fs.readFile(path.join(OUT,review.artifacts.done.file));
if(hash(finalRecordBytes)!==review.artifacts.done.sha256)throw Error('Done hash mismatch');
const done=JSON.parse(gunzipSync(finalRecordBytes)),last=record.checkpoints.at(-1);
if(JSON.stringify(last.positionsMm)!==JSON.stringify(done.record.positionsMm)||JSON.stringify(last.intersections)!==JSON.stringify(done.intersections))throw Error('Final record and checkpoint differ');
if(done.record.staticGate.passed!==(done.record.staticGate.failures.length===0)||done.record.staticGate.failures.includes('cloth-intersections')!==(done.intersections.selfStrictTriangleIntersectionCount>0)||done.record.staticGate.failures.includes('body-intersections')!==(done.intersections.bodyIntersectingFaceCount>0))throw Error('Final gate and evidence disagree');
if(done.record.solver.selfCollision!==false||done.record.trial.runtimeSelfContact!==false)throw Error('Frozen contact capability changed');
if(JSON.stringify(rows.map(r=>[r.label,r.clothPairs,r.bodyFaces]))!==JSON.stringify(review.checkpointSummary.map(r=>[r.label,r.clothPairs,r.bodyFaces])))throw Error('Summary and saved checkpoints disagree');
const report={schema:'kaopu.frozen-checkpoint-readback-review/1',sourceHead:review.sourceHead,passed:true,rows,
 finalCheckpointEqualsDone:true,finalGateMatchesEvidence:true,referenceResultEqualityRequired:false,originalWorkerSHA256:hash(original),bodySHA256:hash(bodyBytes),checkpointsSHA256:hash(saved),
 methodology:'Re-read saved snapshots and run the unchanged original intersection audit; no physical solve. Separate longdouble analysis checks 14 final intersections independently.',
 limitations:['This verifies serialization and repeatability of the existing discrete checker, not its universal geometric completeness or continuous collision safety.']};
await fs.writeFile(path.join(OUT,'CHECKPOINT_READBACK_REVIEW.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:true,checkpoints:rows.length,clothPairs:rows.map(x=>x.clothPairs)}));
