/** Resolve a construction-side offset that exceeded the separate seam acceptance limit.
 * Applies only to explicitly selected light-ease native joins. No mesh/UV changes.
 * This is a static sewing construction condition, not a fabric thickness model.
 */
import {closeLightEaseSpans} from './correctives/r043c/seam-spans.mjs';
export function compatibleSeamClearance(lab, baseRows, {sideMarginM=.00006}={}) {
 if(!Number.isFinite(sideMarginM)||sideMarginM<0||sideMarginM>.0001)throw Error('SEAM_SIDE_CLEARANCE_RANGE');
 if(baseRows.some(g=>!Number.isFinite(g.margin)||g.margin<0))throw Error('SEAM_SIDE_INVALID_BASE_ROWS');
 const extended=closeLightEaseSpans(lab,baseRows),boundaryKeys=new Set(extended.rows.filter(g=>g.margin<0).map(g=>g.ids.join(',')));
 let changed=0;
 const rows=baseRows.map(g=>{if(!boundaryKeys.has(g.ids.join(',')))return g;changed++;return {...g,margin:sideMarginM};});
 if(rows.length!==baseRows.length)throw Error('SEAM_SIDE_ROW_COUNT_CHANGED');
 return {rows,report:{schema:'kaopu-native-seam-side-clearance@1',changedBoundaryRows:changed,
  originalSideOffsetM:.0003,constructionSideOffsetM:sideMarginM,maximumSourceLengthRatio:1.12,
  eligible:extended.report.eligible,excluded:extended.report.excluded,distanceTubeAdded:false,
  originalConstraintIdsPreserved:true,restMaterialChanged:false,acceptanceThresholdsChanged:false,
  highRatioGatheringCertified:false,fabricThicknessCalibrated:false}};
}
