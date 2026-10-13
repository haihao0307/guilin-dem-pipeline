import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const spec=JSON.parse(fs.readFileSync(path.resolve(here,'../REGRESSION_CASES/CANDIDATE_RENDER_DEVICE_CAPABILITY_IDENTITY_001.json'),'utf8'));

function whole(v){return Number.isInteger(v)&&v>=0;}
function classify(x){
  if(!x.subjectBound||!x.targetProfileBound)return 'HOLD_TARGET_CAPABILITY_PROFILE_UNBOUND';
  if(!x.finalProgramObserved||typeof x.linkStatus!=='boolean')return 'HOLD_DRIVER_PROGRAM_LINK_UNBOUND';
  if(!whole(x.fragmentSamplers)||!whole(x.vertexSamplers)||!whole(x.combinedSamplers)||!whole(x.fragmentLimit)||!whole(x.vertexLimit)||!whole(x.combinedLimit))return 'HOLD_DRIVER_PROGRAM_LINK_UNBOUND';
  if(x.budgetExceededByDriver||x.fragmentSamplers>x.fragmentLimit||x.vertexSamplers>x.vertexLimit||x.combinedSamplers>x.combinedLimit)return 'REJECT_SHADER_RESOURCE_BUDGET_EXCEEDED';
  if(!x.linkStatus)return 'REJECT_DRIVER_PROGRAM_LINK_FAILED';
  if(x.fallbackActive||!x.featureSetMatches)return 'REJECT_CAPABILITY_SILENT_FEATURE_FALLBACK';
  if(!x.firstFrameReadbackBound||!x.firstFramePassed)return 'HOLD_FIRST_FRAME_RENDER_UNBOUND';
  if(!x.positiveControlInjected||!x.positiveControlDetected)return 'HOLD_CAPABILITY_GATE_POSITIVE_CONTROL_MISSING';
  return 'SCOPED_RENDER_CAPABILITY_IDENTITY_PASS';
}

const results=spec.fixtures.map(x=>({id:x.id,expected:x.expected,actual:classify(x),pass:x.expected===classify(x)}));
const report={caseId:spec.caseId,passed:results.filter(x=>x.pass).length,total:results.length,success:results.every(x=>x.pass),results};
fs.writeFileSync(path.join(here,'render_device_capability_result_n152.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.success)process.exitCode=1;
