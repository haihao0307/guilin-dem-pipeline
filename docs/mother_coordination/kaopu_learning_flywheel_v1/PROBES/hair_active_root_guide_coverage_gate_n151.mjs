import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const casePath=path.resolve(here,'../REGRESSION_CASES/CANDIDATE_HAIR_SCALP_ROOT_FIELD_IDENTITY_001.json');
const spec=JSON.parse(fs.readFileSync(casePath,'utf8'));

function nonnegativeIntegers(a){return Array.isArray(a)&&a.length===6&&a.every(Number.isInteger)&&a.every(v=>v>=0);}
function finiteNonnegative(a){return Array.isArray(a)&&a.length===6&&a.every(Number.isFinite)&&a.every(v=>v>=0);}

function classify(x){
  if(!x.subjectAndDigestsBound||!x.regionCountsBound||!x.mappingDigestBound)
    return 'HOLD_ACTIVE_ROOT_TO_GUIDE_COVERAGE_UNBOUND';
  if(!nonnegativeIntegers(x.unassignedRootCounts)||!nonnegativeIntegers(x.perRegionGuideCounts)||!finiteNonnegative(x.perRegionMaxDistancesMM)||!finiteNonnegative(x.perRegionBoundsMM))
    return 'HOLD_ACTIVE_ROOT_TO_GUIDE_COVERAGE_UNBOUND';
  if(x.carrierDistanceMetricId!=='CARRIER_SURFACE_GEODESIC_OR_ADJACENCY_CONSTRAINED')
    return 'REJECT_CARRIER_DISTANCE_METRIC_INVALID';
  if(x.unassignedRootCounts.some(v=>v>0))return 'REJECT_ACTIVE_ROOTS_UNASSIGNED';
  if(x.perRegionGuideCounts.some(v=>v===0)||x.perRegionMaxDistancesMM.some((v,i)=>v>x.perRegionBoundsMM[i]))
    return 'REJECT_REGIONAL_GUIDE_COVERAGE_GAP';
  if(!x.interpolationPolicyBound)return 'HOLD_GUIDE_INTERPOLATION_POLICY_UNBOUND';
  if(!x.thinRegionControlInjected||!x.thinRegionControlDetected||!x.crossSurfaceControlInjected||!x.crossSurfaceControlDetected)
    return 'HOLD_GUIDE_COVERAGE_POSITIVE_CONTROL_MISSING';
  return 'SCOPED_ACTIVE_ROOT_TO_GUIDE_COVERAGE_PASS';
}

const fixtures=spec.guideCoverageExtensionN151.fixtures;
const results=fixtures.map(x=>({id:x.id,expected:x.expected,actual:classify(x),pass:x.expected===classify(x)}));
const report={caseId:spec.caseId,extension:'guideCoverageExtensionN151',passed:results.filter(x=>x.pass).length,total:results.length,success:results.every(x=>x.pass),results};
const out=path.join(here,'hair_active_root_guide_coverage_result_n151.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.success)process.exitCode=1;
