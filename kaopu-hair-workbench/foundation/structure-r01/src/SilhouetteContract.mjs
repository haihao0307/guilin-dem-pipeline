const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
export function assertSilhouetteField(f){
 if(f.revision!=='silhouette-wisps-08'||f.protectedArc!==.045||!['silhouette-round','silhouette-framing'].includes(f.preset))throw Error('Invalid silhouette revision/root protection');
 if(!Number.isFinite(f.strength)||f.strength<0||f.strength>1||!Number.isFinite(f.blendArc)||f.blendArc<.05||f.blendArc>.15||!Number.isFinite(f.wispSpread)||f.wispSpread<.5||f.wispSpread>1.2)throw Error('Invalid silhouette blending');
 if(!f.loft||Object.values(f.loft).some(v=>!Number.isFinite(v))||f.loft.width<.085||f.loft.width>.12||f.loft.depth<.085||f.loft.depth>.13||f.loft.shoulderFlare<0||f.loft.shoulderFlare>.015)throw Error('Invalid P01 loft bounds');
 if(!f.faceFrame||!Number.isFinite(f.faceFrame.tipDrop)||f.faceFrame.tipDrop<0||f.faceFrame.tipDrop>.025||!(f.faceFrame.angleSpan>0)||!Number.isFinite(f.faceFrame.angleStart))throw Error('Invalid temple-linked graduation');
 if(!f.collision||!Number.isFinite(f.collision.clearance)||f.collision.clearance<0||f.collision.clearance>.005||!Number.isInteger(f.collision.iterations)||f.collision.iterations<1||f.collision.iterations>32)throw Error('Invalid silhouette collision limits');return true;
}
export function assertSilhouettePreserved(source,output,protectedArc=.045){
 if(source.length!==output.length||protectedArc!==.045)throw Error('Invalid silhouette guide count or root protection');
 let changed=0,maxProtectedErrorMM=0;
 for(let i=0;i<source.length;i++){
  const a=source[i],b=output[i];if(a.id!==b.id||a.rootId!==b.rootId||a.zone!==b.zone||a.macro!==b.macro||a.route!==b.route||JSON.stringify(a.root)!==JSON.stringify(b.root)||a.points.length!==b.points.length)throw Error('Silhouette changed native identity or material route');
  if(a.zone<=1||a.zone===6||a.zone===7){for(const k of ['points','frames','arcLengths','length'])if(JSON.stringify(a[k])!==JSON.stringify(b[k]))throw Error('Protected fringe/temple changed');continue;}
  for(let n=0;n<a.arcLengths.length;n++)if(a.arcLengths[n]<=protectedArc){const d=distance(a.points.slice(n*3,n*3+3),b.points.slice(n*3,n*3+3));maxProtectedErrorMM=Math.max(maxProtectedErrorMM,d*1000);if(d>1e-10)throw Error('Silhouette moved protected root flow');}
  const sa=Math.sign(a.points.at(-3)),sb=Math.sign(b.points.at(-3));if(sa&&sa!==sb)throw Error('Silhouette switched material side');
  if(b.points.some((v,k)=>Math.abs(v-a.points[k])>1e-7))changed++;
 }
 return{guides:output.length,changedGuides:changed,maxProtectedErrorMM};
}
