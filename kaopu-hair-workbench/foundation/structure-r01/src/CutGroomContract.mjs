// Deliberately independent of the cut producer: check source path geometry and
// its retained corners, not the producer's self-reported success flags.
const distance=(a,b)=>Math.hypot(...a.map((v,k)=>v-b[k]));
export function assertCutPrefix(source,output,protectedArc=.085){
 if(source.length!==output.length)throw Error('Cut lost a complete guide');
 let maxPathError=0,maxProtectedError=0,maxRemoved=0,edited=0;
 for(let i=0;i<source.length;i++){
  const a=source[i],b=output[i];if(a.id!==b.id||a.rootId!==b.rootId||JSON.stringify(a.root)!==JSON.stringify(b.root)||a.zone!==b.zone||['macro','route'].some(k=>a[k]!==b[k]))throw Error('Cut changed guide/root/semantic-route identity');
  const A=Array.from({length:a.arcLengths.length},(_,n)=>a.points.slice(n*3,n*3+3)),B=Array.from({length:b.arcLengths.length},(_,n)=>b.points.slice(n*3,n*3+3));
  if(A.length!==B.length||distance(A[0],B[0])>1e-10)throw Error('Cut moved root or changed sample layout');
  if(a.zone<=1||a.zone===6||a.zone===7){if(['points','frames','arcLengths','cut','length'].some(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])))throw Error('Cut edited protected fringe/temple');continue;}
  let previous=-1,lastArc=0;
  for(const p of B){let best=Infinity,sourceArc=0;for(let n=1;n<A.length;n++){const v=A[n].map((x,k)=>x-A[n-1][k]),w=p.map((x,k)=>x-A[n-1][k]),d2=v.reduce((s,x)=>s+x*x,0),t=Math.max(0,Math.min(1,w.reduce((s,x,k)=>s+x*v[k],0)/d2)),q=A[n-1].map((x,k)=>x+v[k]*t),d=distance(p,q);if(d<best){best=d;sourceArc=a.arcLengths[n-1]+Math.sqrt(d2)*t;}}
   maxPathError=Math.max(maxPathError,best);if(best>4e-9||sourceArc<previous-4e-9)throw Error('Cut introduced a new path or reversed original flow');previous=sourceArc;lastArc=sourceArc;
  }
  for(let n=0;n<A.length;n++){
   if(a.arcLengths[n]<=protectedArc){const d=distance(A[n],B[n]);maxProtectedError=Math.max(maxProtectedError,d);if(d>1e-10)throw Error('Cut modified protected upper flow');}
   if(a.arcLengths[n]<lastArc-4e-9&&!B.some(p=>distance(A[n],p)<2e-9))throw Error('Cut skipped an original flow corner');
  }
  if(b.length>a.length+4e-9||Math.abs(b.length-lastArc)>2e-7)throw Error('Cut extended or scaled the source curve');
  const removed=a.length-b.length;maxRemoved=Math.max(maxRemoved,removed);if(removed>1e-7)edited++;
 }
 return{guides:output.length,editedGuides:edited,maxPathErrorMM:maxPathError*1000,maxProtectedErrorMM:maxProtectedError*1000,maxRemovedArcMM:maxRemoved*1000};
}
