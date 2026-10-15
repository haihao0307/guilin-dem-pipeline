/** Close slight-ease material spans using the original adjacent stitch sites.
 * No rest-coordinate edits, extra vertices or relaxed acceptance limits.
 * High-ratio gathers keep the existing construction model: they need folds,
 * not a forced straight-line collapse.
 */
export function closeLightEaseSpans(lab,baseRows,{maximumRatio=1.12,radiusM=.0001}={}){
 if(!Number.isFinite(maximumRatio)||maximumRatio<=1||!Number.isFinite(radiusM)||radiusM<=0)throw Error('SEAM_SPAN_CONFIGURATION');
 const panels=new Map(lab.spec.panels.map(p=>[p.id,p])),allowed=new Set(),eligible=[],excluded=[];
 for(const s of lab.spec.seams){if(!s.numericalStitchPlan||s.sourceSeam?.isDart||s.a.panelId===s.b.panelId)continue;
  const la=s.sourceSeam.lengthAMm,lb=s.sourceSeam.lengthBMm,ratio=Math.max(la,lb)/Math.min(la,lb);if(!Number.isFinite(ratio))throw Error('SEAM_SPAN_SOURCE_LENGTH');
  if(ratio>maximumRatio+1e-12){excluded.push({seamId:s.id,ratio,reason:'high-ratio gathering needs an explicit folded seam model'});continue;}
  let A=s.a,B=s.b,pairs=s.stitchVertexPairs;if(la>lb){[A,B]=[B,A];pairs=pairs.map(([a,b])=>[b,a]);}
  const pa=panels.get(A.panelId),pb=panels.get(B.panelId),oa=lab.offsets.get(pa.id),ob=lab.offsets.get(pb.id),be=B.reverse?[...pb.edges[B.edge]].reverse():pb.edges[B.edge];let count=0;
  for(let k=0;k+1<pairs.length;k++){const[a0,b0]=pairs[k],[a1,b1]=pairs[k+1],j0=be.indexOf(b0),j1=be.indexOf(b1);if(j0<0||j1<=j0)throw Error('SEAM_SPAN_ORDER');
   if(!pa.triangles.some(t=>t.includes(a0)&&t.includes(a1)))continue;
   for(let j=j0+1;j<j1;j++){allowed.add([oa+a0,oa+a1,ob+be[j]].join(','));count++;}
  }eligible.push({seamId:s.id,ratio,intermediateSites:count});
 }
 const rows=[],distance=[];let corrected=0;
 for(const g of baseRows){if(allowed.has([g.ids[0],g.ids[1],g.ids[3]].join(','))){
   rows.push({...g,margin:0});distance.push({...g,margin:-radiusM});corrected++;
  }else rows.push(g);
 }
 rows.push(...distance);
 return{rows,report:{schema:'kaopu-native-light-ease-seam-spans@1',distanceRows:distance.length,correctedBoundaryGuideOffsets:corrected,previousOffsetM:.0003,boundaryGuideOffsetM:0,distanceTubeRadiusM:radiusM,maximumSourceLengthRatio:maximumRatio,eligible,excluded,negativeMarginABIMeaning:'point-to-source-stitch-span distance tube, not a side inequality',restMaterialChanged:false,qualityThresholdChanged:false,highRatioGatheringCertified:false}};
}
