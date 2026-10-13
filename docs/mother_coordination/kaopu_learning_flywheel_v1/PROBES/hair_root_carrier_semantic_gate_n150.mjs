import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const casePath=path.resolve(here,'../REGRESSION_CASES/CANDIDATE_HAIR_SCALP_ROOT_FIELD_IDENTITY_001.json');
const spec=JSON.parse(fs.readFileSync(casePath,'utf8'));

function classify(x){
  if(!x.testedSubjectBound||!x.carrierMeshBound||!x.semanticRegionPartitionBound||!x.authorizedScalpRegionBound||!x.authorizedSideburnCorridorBound||!x.forbiddenPinnaRegionBound)
    return 'HOLD_ROOT_CARRIER_SEMANTIC_DOMAIN_UNBOUND';
  if(!Number.isInteger(x.activeRootCountOnForbiddenPinna)||x.activeRootCountOnForbiddenPinna<0||!Number.isInteger(x.sideburnPinnaOverlapCount)||x.sideburnPinnaOverlapCount<0)
    return 'HOLD_ROOT_CARRIER_SEMANTIC_DOMAIN_UNBOUND';
  if(x.activeRootCountOnForbiddenPinna>0)return 'REJECT_ROOTS_ON_FORBIDDEN_PINNA_CARRIER';
  if(x.sideburnPinnaOverlapCount>0)return 'REJECT_AUTHORIZED_SIDEBURN_OVERLAPS_PINNA';
  if(!x.earRootPositiveControlInjected||!x.earRootPositiveControlDetected)return 'HOLD_EAR_EXCLUSION_POSITIVE_CONTROL_MISSING';
  return 'SCOPED_ROOT_CARRIER_DOMAIN_PASS';
}

const results=spec.carrierDomainExtensionN150.fixtures.map(x=>({id:x.id,expected:x.expected,actual:classify(x),pass:x.expected===classify(x)}));
const report={caseId:spec.caseId,extension:'carrierDomainExtensionN150',passed:results.filter(x=>x.pass).length,total:results.length,success:results.every(x=>x.pass),results};
const out=path.join(here,'hair_root_carrier_semantic_result_n150.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.success)process.exitCode=1;
