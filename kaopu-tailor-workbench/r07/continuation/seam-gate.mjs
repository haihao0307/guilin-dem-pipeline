import {staticGate as priorStaticGate} from '../stability/audit.mjs';
import {auditSeamSpans} from '../../learning/patterngsl-r01/seam-span.mjs';
export function continuationStaticGate(lab,record,regions,intersections){
 const prior=priorStaticGate(lab,record,regions,intersections),failures=[...prior.failures];
 let spans;
 try{
  spans=auditSeamSpans(lab.spec,record.positionsMm,{activeSeamIds:record.activeSeams,toleranceMm:.02,reviewThresholdMm:.25});
  if(spans.measuredSeams!==record.activeSeams.length)failures.push('unmeasured-active-seams');
  if(spans.separatedSeamIds.length)failures.push('whole-seam-separation-over-0.25mm');
  if(spans.unresolvedSeamIds.length)failures.push('whole-seam-audit-unresolved');
 }catch(e){failures.push('whole-seam-audit-error');spans={error:String(e.message||e),allWithinReviewThreshold:false};}
 record.wholeSeamAudit=spans;
 return{...prior,schema:'kaopu-static-garment-check@2',passed:failures.length===0,failures,wholeSeamAudit:spans,
  priorNeedleOnlyGatePassed:prior.passed,thresholds:{...prior.thresholds,maximumWholeSeamSeparationMm:.25},
  geometricClosureOnly:true,seamAllowanceAndFoldConstructionCertified:false,dynamicWearCertified:false};
}
