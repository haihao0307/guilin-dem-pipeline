/* Numerical receipts. No unmeasured visual pass flags. */
export function gridHeight(heights,n,x,z){
 const gx=Math.min(n-1.000001,Math.max(0,x+1024)),gz=Math.min(n-1.000001,Math.max(0,z+1024));
 const ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,a=heights[iz*n+ix],b=heights[iz*n+ix+1],c=heights[(iz+1)*n+ix],d=heights[(iz+1)*n+ix+1];
 return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);
}
export function auditRibbon(mesh,heights,n){
 const {positions:p,indices:idx}=mesh,rows=2049,cols=65,vertices=p.length/3;
 const parent=new Int32Array(vertices);for(let i=0;i<vertices;i++)parent[i]=i;
 const find=x=>{while(parent[x]!==x){parent[x]=parent[parent[x]];x=parent[x]}return x},join=(a,b)=>{const aa=find(a),bb=find(b);if(aa!==bb)parent[bb]=aa};
 let invalid=0,degenerate=0,patternErrors=0,minClearance=Infinity,maxClearance=-Infinity,minArea=Infinity;
 for(let r=0;r<rows-1;r++)for(let c=0;c<cols-1;c++){
  const a=r*cols+c,expect=[a,a+cols,a+1,a+1,a+cols,a+cols+1],k=(r*(cols-1)+c)*6;
  for(let j=0;j<6;j++)if(idx[k+j]!==expect[j])patternErrors++;
 }
 for(let i=0;i<vertices;i++){
  const x=p[i*3],y=p[i*3+1],z=p[i*3+2];if(![x,y,z].every(Number.isFinite)){invalid++;continue}
  const clear=y-gridHeight(heights,n,x,z);minClearance=Math.min(minClearance,clear);maxClearance=Math.max(maxClearance,clear);
 }
 for(let k=0;k<idx.length;k+=3){
  const [a,b,c]=[idx[k],idx[k+1],idx[k+2]];if([a,b,c].some(v=>v<0||v>=vertices)){invalid++;continue}join(a,b);join(b,c);
  const area=(p[b*3]-p[a*3])*(p[c*3+2]-p[a*3+2])-(p[c*3]-p[a*3])*(p[b*3+2]-p[a*3+2]);minArea=Math.min(minArea,Math.abs(area)/2);if(Math.abs(area)<1e-9)degenerate++;
  const x=(p[a*3]+p[b*3]+p[c*3])/3,y=(p[a*3+1]+p[b*3+1]+p[c*3+1])/3,z=(p[a*3+2]+p[b*3+2]+p[c*3+2])/3;
  minClearance=Math.min(minClearance,y-gridHeight(heights,n,x,z));
 }
 const roots=new Set();for(let i=0;i<vertices;i++)roots.add(find(i));
 const fullCoverage=idx.length===(rows-1)*(cols-1)*6&&patternErrors===0;
 const boundaryValid=p[2]===-1024&&p[(vertices-1)*3+2]===1024;
 const pass=invalid===0&&degenerate===0&&roots.size===1&&fullCoverage&&boundaryValid&&minClearance>=0;
 return {method:'index-union-find+complete-quad-coverage+all-vertices-and-triangle-centroid-bed-clearance',sourceType:'authored-procedural-curve',vertexCount:vertices,triangleCount:idx.length/3,connectedComponents:roots.size,patternErrors,completeQuadCoverage:fullCoverage,invalidValues:invalid,degenerateTriangles:degenerate,minTriangleAreaM2:minArea,minBedClearanceM:minClearance,maxBedClearanceM:maxClearance,internalHoleCount:fullCoverage?0:null,boundaryEndpointsVerified:boundaryValid,technicalPass:pass,visualGapCount:null,truthHydrologyClaim:false,visualApproved:false};
}
export function auditSeams(tiles){
 const map=new Map(tiles.map(t=>[t.x+','+t.z,t]));let bytesCompared=0,mismatchedBytes=0,edgePairs=0;
 for(const t of tiles){const a=new Uint8Array(t.buffer);for(const [dx,dz]of [[128,0],[0,128]]){const next=map.get((t.x+dx)+','+(t.z+dz));if(!next)continue;edgePairs++;const b=new Uint8Array(next.buffer);
   for(let i=0;i<129;i++)for(let j=0;j<16;j++){let ai=dx?(i*129+128)*16+j:(128*129+i)*16+j,bi=dx?i*129*16+j:i*16+j;bytesCompared++;if(a[ai]!==b[bi])mismatchedBytes++}
 }}
 return {method:'shared-edge-full-vertex-byte-comparison',edgePairs,bytesCompared,mismatchedBytes,passed:edgePairs>0&&mismatchedBytes===0};
}
