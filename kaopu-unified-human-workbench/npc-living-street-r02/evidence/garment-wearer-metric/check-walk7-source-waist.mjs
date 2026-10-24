/** Read only: original WaistAttachments target transport on the existing
 * accepted neutral material and the already observed walk7 body. No solve.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import {loadNativeBodyFixture} from '../native-body-fixtures.mjs';
import {createWholeGarmentBinding,captureNeutralWearerRest,originalContactSamples} from '../../src/NativeGarmentFit.mjs';
import {createWearerRestSolver} from '../../src/NativeGarmentMetric.mjs';
import {MeshContact} from '../../vendor/appearance/cloth-r10/mesh-contact.mjs';
import {WaistAttachments} from '../../vendor/appearance/cloth-r10/waist-attachments.mjs';
const base=new URL('../../',import.meta.url),folder=new URL('./',import.meta.url);
const bytes=p=>fs.readFileSync(new URL(p,base)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const load=p=>JSON.parse(bytes(p)),gz=p=>JSON.parse(zlib.gunzipSync(bytes(p)));
const waistPath='vendor/appearance/cloth-r10/waist-attachments.mjs';
if(hash(bytes(waistPath))!=='bf63216f946e834ace38ccd2118f822de52bab3045d757d49b79a140e9269bd6')throw Error('ORIGINAL_WAIST_SOURCE_BYTES_CHANGED');
const frozen=load('evidence/garment-wearer-metric/D_CONTINUOUS_NEUTRAL_STATE.json'),csr=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json');
const input=load('evidence/CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_CONTACT_POSES.json'),state=input.states.find(s=>s.frame===7);
const geometry=load('evidence/garment-wearer-metric/D-full-initial-history-first-failure-corrective-geometry.json');
if(geometry.pose!==state.id)throw Error('ONLY_THE_EXISTING_OBSERVED_WALK7_INPUT');
const raw=loadNativeBodyFixture('D'),W=raw.packet.weights,values=new Float64Array(W.values.length);
for(let i=0;i<csr.bodyVertexCount;i++)for(let n=0;n<csr.displayRange[i*4+1];n++)values[W.ptr[i]+n]=csr.displayPacked[(csr.displayRange[i*4]+n)*8+4];
const target={...raw,positions:Float64Array.from(frozen.bodyPositions),packet:{...raw.packet,weights:{...W,values}}};
const packet=gz('vendor/appearance/cloth-r10/native/P01.json.gz'),source=gz('vendor/appearance/cloth-r10/assets/native-person.json.gz');
const initial=await createWholeGarmentBinding({sourcePerson:source,targetBody:target,packet,role:'bottom',family:'denim'});
const saved=frozen.rows.find(r=>r.id==='P01'),binding=captureNeutralWearerRest(initial,Float64Array.from(saved.positions),{kind:'same accepted neutral; no additional material or contact solve'});
const metric=binding.metric,solver=createWearerRestSolver(metric);solver.p.set(metric.fittedNative);
const world={solvers:[null,solver],body:new MeshContact(target.positions,binding.source.faces),actor:{positions:target.positions}};
const waist=new WaistAttachments(world),pins=new Set(solver.pins);
let maximumNeutralReconstructionM=0;
for(let i=0;i<waist.rows.length;i++){const id=waist.rows[i].id;maximumNeutralReconstructionM=Math.max(maximumNeutralReconstructionM,Math.hypot(...[0,1,2].map(c=>waist.target[i*3+c]-metric.fittedNative[id*3+c])));}
if(maximumNeutralReconstructionM>1e-12)throw Error('ORIGINAL_SOURCE_ANCHOR_NEUTRAL_IDENTITY_FAILED');
const body=Float64Array.from(geometry.body.positions),reference=binding.sample(body,state.skinMatrices),originalReference=reference.positions.slice();
world.actor.positions=body;waist.begin();waist.apply();
const sourceReference=reference.positions.slice();let maximumAnchorChangeM=0;
for(const id of solver.pins){sourceReference.set(solver.p.subarray(id*3,id*3+3),id*3);maximumAnchorChangeM=Math.max(maximumAnchorChangeM,Math.hypot(...[0,1,2].map(c=>sourceReference[id*3+c]-originalReference[id*3+c])));}
const samples=originalContactSamples(metric).filter(s=>s.ids.every(id=>pins.has(id)));
function audit(P){
  let inside=0,below4MM=0,minimumOutsideM=Infinity,worst=null;const results=[];
  for(const s of samples){const point=[0,0,0];for(let i=0;i<s.ids.length;i++)for(let c=0;c<3;c++)point[c]+=P[s.ids[i]*3+c]*s.weights[i];
    const actual=binding.contact.inspect(...point),row={sample:s,point,actual};results.push(row);if(actual.inside)inside++;else{if(actual.distance<minimumOutsideM){minimumOutsideM=actual.distance;worst=row;}if(actual.distance<.004-1e-10)below4MM++;}
  }return{samples:samples.length,inside,below4MM,minimumOutsideM,worst,results};
}
const current=audit(originalReference),originalSource=audit(sourceReference),targetEdge=a=>a.results.find(r=>r.sample.kind==='edge'&&r.sample.ids.includes(5983)&&r.sample.ids.includes(5984));
const targetRows=waist.rows.filter(r=>r.id===5983||r.id===5984).map(r=>({...r,bodyIds:Array.from(binding.source.faces.subarray(r.f,r.f+3)),continuous:Array.from(originalReference.subarray(r.id*3,r.id*3+3)),originalSource:Array.from(sourceReference.subarray(r.id*3,r.id*3+3))}));
const out={schema:'same-input-original-waist-target-readonly/1',frame:7,pose:state.id,additionalClothSolve:false,parametersChanged:false,sourceAuditMarginM:.004,localPlanningGuardM:.00001,
  source:{repository:'haihao0307/guilin-dem-pipeline',commit:'c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49',path:'kaopu-tailor-workbench/material-products/mp05-studio-r10-3fc034fa91ef/waist-attachments.mjs',sha256:hash(bytes(waistPath)),gitBlob:'ea7d4c3d531e0d3be5ccedefb1a6bb6aed092c87'},
  inputHashes:Object.fromEntries(['evidence/garment-wearer-metric/D_CONTINUOUS_NEUTRAL_STATE.json','evidence/CAPTURE_RECOVERY_D_CLEARANCE_INITIAL_CONTACT_POSES.json','evidence/CAPTURE_RECOVERY_D_CLEARANCE_DISPLAY_CSR.json','src/NativeGarmentFit.mjs'].map(p=>[p,hash(bytes(p))])),
  originalPinCount:solver.pins.length,maximumNeutralReconstructionM,maximumAnchorChangeM,
  currentContinuous:{...current,results:undefined},originalSource:{...originalSource,results:undefined},
  knownEdge:{current:targetEdge(current),originalSource:targetEdge(originalSource),sourceAnchorRows:targetRows},
  sourceContractRetained:'Unchanged original WaistAttachments constructor/begin/apply. It reads exact actual posed full-CSR body vertices; no material point except the original declared waist pins is overridden.',
  possibleToProceed:originalSource.inside===0&&originalSource.below4MM===0,
  conclusion:originalSource.inside===0&&originalSource.below4MM===0?'Original fixed triangle+bary+local offset targets meet the strict 4mm audit for all fixed-only waist samples in this same observed pose. This is evidence to restore that omitted source anchor contract; it is not a full material candidate or sequence acceptance.':'The unchanged original waist targets do not satisfy every strict fixed-only 4mm sample on this input. Do not increase the planning guard or claim the source contract resolves the gate.'};
fs.writeFileSync(new URL('D_WALK7_ORIGINAL_WAIST_TARGETS.json',folder),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({...out,inputHashes:undefined,knownEdge:{current:out.knownEdge.current,originalSource:out.knownEdge.originalSource}},null,2));
