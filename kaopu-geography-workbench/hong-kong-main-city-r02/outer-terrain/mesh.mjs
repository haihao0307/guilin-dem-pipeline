// Display cache only. Source coefficients/masks and all old owned samples remain unchanged.
export const DEFAULT_JOIN=Object.freeze({enabled:true,widthM:120,kind:'exterior_display_only_land_to_land'});
export function insideOwned(E,N,b){return E>=b[0]&&E<=b[2]&&N>=b[1]&&N<=b[3];}
export function nearestBoundary(E,N,b){return [Math.max(b[0],Math.min(b[2],E)),Math.max(b[1],Math.min(b[3],N))];}
export function sampleOldNode(E,N,host){const {HK,hkHeights,hkMask}=host;if(!hkHeights||!hkMask)return null;const col=Math.round((E-HK.x0)/HK.step),row=Math.round((HK.y0-N)/HK.step);if(col<0||row<0||col>=HK.width||row>=HK.height)return null;const i=row*HK.width+col,H=hkHeights[i];return Number.isFinite(H)?{heightM:H,isLand:hkMask[i]===1,mask:hkMask[i]}:null;}
export function displayedHeight(E,N,{sourceAt,oldAt,ownedBounds,join=DEFAULT_JOIN,stats}){
 const q=sourceAt(E,N);if(!q)return null;
 if(insideOwned(E,N,ownedBounds)){const old=oldAt(E,N),landPair=old?.isLand&&q.waterClass===0;return {heightM:landPair?old.heightM:q.heightM,waterClass:q.waterClass,owned:true,corrected:false,joinStatus:landPair?'owned_land_boundary':'owned_water_or_mask_conflict'};}
 if(!join.enabled)return {...q,corrected:false};
 const p=nearestBoundary(E,N,ownedBounds),distance=Math.hypot(E-p[0],N-p[1]);if(distance>=join.widthM)return {...q,corrected:false};
 const old=oldAt(...p),boundary=sourceAt(...p);
 if(q.waterClass!==0||boundary?.waterClass!==0||!old?.isLand){if(stats)stats.joinBlocked++;return {...q,corrected:false,joinStatus:'water_unknown_or_mask_conflict'};}
 const t=distance/join.widthM,w=1-t*t*(3-2*t),delta=w*(old.heightM-boundary.heightM);
 if(stats){stats.correctedNodes++;stats.maxAbsCorrectionM=Math.max(stats.maxAbsCorrectionM,Math.abs(delta));}
 return {...q,heightM:q.heightM+delta,corrected:true,correctionM:delta};
}
export function buildOuterMesh(chunk,{sourceAt,oldAt,ownedBounds,join=DEFAULT_JOIN}){
 const {meta,waterClass}=chunk,[rows,cols]=meta.shapeRC,[E0,N0]=meta.nodeOriginEastingNorthing;
 const stats={correctedNodes:0,joinBlocked:0,maxAbsCorrectionM:0,ownedCellsSkipped:0,oceanCellsSkipped:0,sourceNonwaterNodes:0};
 const vertices=new Float32Array(rows*cols*6),heights=new Float64Array(rows*cols),indices=[];
 const at=(E,N,record=false)=>displayedHeight(E,N,{sourceAt,oldAt,ownedBounds,join,stats:record?stats:null});
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const E=E0+c*30,N=N0-r*30,i=r*cols+c,q=at(E,N,true);if(!q||!Number.isFinite(q.heightM))throw Error('Missing terrain support '+meta.id);heights[i]=q.heightM;
  const H=q.heightM,xm=at(E-30,N)?.heightM??H,xp=at(E+30,N)?.heightM??H,zm=at(E,N+30)?.heightM??H,zp=at(E,N-30)?.heightM??H,n=[xm-xp,60,zm-zp],l=Math.hypot(...n);
  vertices.set([E-834000,H,827000-N,...n.map(x=>x/l)],i*6);if(waterClass[i]===0&&!insideOwned(E,N,ownedBounds))stats.sourceNonwaterNodes++;
 }
 for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){
  const E=E0+(c+.5)*30,N=N0-(r+.5)*30;if(insideOwned(E,N,ownedBounds)){stats.ownedCellsSkipped++;continue;}
  const i=r*cols+c,ids=[i,i+1,i+cols,i+cols+1];if(ids.every(k=>waterClass[k]===1||waterClass[k]===255)){stats.oceanCellsSkipped++;continue;}
  // Keep any cell supporting a tiny land node; fragment mask remains exact 30m nearest classification.
  indices.push(i,i+cols,i+1,i+1,i+cols,i+cols+1);
 }
 const indexArray=new Uint32Array(indices),remap=new Int32Array(rows*cols).fill(-1);let count=0;for(const i of indexArray)if(remap[i]<0)remap[i]=count++;
 const compact=new Float32Array(count*6);for(let i=0;i<remap.length;i++)if(remap[i]>=0)compact.set(vertices.subarray(i*6,i*6+6),remap[i]*6);for(let i=0;i<indexArray.length;i++)indexArray[i]=remap[indexArray[i]];
 stats.sourceGridVertices=rows*cols;stats.residentVertices=count;stats.unreferencedVerticesOmitted=rows*cols-count;
 return {vertices:compact,indices:indexArray,waterClass,stats,bytes:compact.byteLength+indexArray.byteLength+waterClass.byteLength,heights};
}
