import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const spec=JSON.parse(fs.readFileSync(path.join(root,'REGRESSION_CASES','CANDIDATE_MOTION_OBJECT_CUSTODY_CONTINUITY_001.json'),'utf8'));
function classify(f){
  if(!f.subjectBound)return 'HOLD_TESTED_SUBJECT_UNBOUND';
  if(!f.frameTimelineBound)return 'HOLD_HANDOFF_FRAME_TIMELINE_UNBOUND';
  if(!f.singleObjectIdentityBound||!f.ownershipStateMachineBound||!f.transformContinuityBound||!f.notReadyFullSequenceBound)return 'HOLD_HANDOFF_TRANSFER_INVARIANTS_UNBOUND';
  if(!f.transitionContactEvidenceBound)return 'HOLD_HANDOFF_TRANSITION_CONTACT_UNBOUND';
  if(f.duplicateObjectViolation)return 'REJECT_HANDOFF_OBJECT_INSTANCE_MULTIPLICITY';
  if(f.transformJumpViolation)return 'REJECT_HANDOFF_OBJECT_TRANSFORM_DISCONTINUITY';
  if(f.earlyTransferViolation)return 'REJECT_HANDOFF_TRANSFER_WITHOUT_RECEIVER_CONTACT';
  if(f.unreadyReleaseViolation)return 'REJECT_HANDOFF_UNREADY_RELEASE';
  if(!f.earlyTransferControlDetected||!f.transformJumpControlDetected||!f.duplicateObjectControlDetected)return 'HOLD_HANDOFF_GATE_POSITIVE_CONTROL_MISSING';
  return 'SCOPED_MOTION_HANDOFF_CUSTODY_CONTINUITY_PASS';
}
const results=spec.fixtures.map(f=>{const actual=classify(f);return{id:f.id,expected:f.expected,actual,pass:actual===f.expected};});
const out={caseId:spec.caseId,passed:results.filter(x=>x.pass).length,total:results.length,success:results.every(x=>x.pass),results};
fs.writeFileSync(path.join(here,'motion_object_custody_continuity_result_n153.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
if(!out.success)process.exitCode=1;
