// Original-surface oral fields. Pure numeric generator; no geometry creation,
// source writes, browser APIs or renderer dependencies.
export const VERSION='LEGACY_GILL_ONLY_SOURCE_GRAPH_C2_R04';
export function generateLegacyOralFields(positions,indices,originalWeights,metadata){
 const VERSION='LEGACY_GILL_ONLY_SOURCE_GRAPH_C2_R04'; // Self-contained for function.toString() Worker injection.
 const N=positions.length/3,stride=12;if(originalWeights.length!==N*stride)throw Error('Legacy source weight layout mismatch');
 const groups=new Map(),alias=new Uint32Array(N),first=[],jawSource=[],gillSource=[];let oldAliasWeightSpread=0;
 for(let i=0;i<N;i++){
  const k=i*3,key=Math.round(positions[k]*1e7)+','+Math.round(positions[k+1]*1e7)+','+Math.round(positions[k+2]*1e7);let g=groups.get(key);
  const j=originalWeights[i*stride+2]/255,h=originalWeights[i*stride+3]/255;
  if(g===undefined){g=first.length;groups.set(key,g);first.push(i);jawSource.push(j);gillSource.push(h);}
  else{oldAliasWeightSpread=Math.max(oldAliasWeightSpread,Math.abs(j-jawSource[g]),Math.abs(h-gillSource[g]));jawSource[g]=Math.max(jawSource[g],j);gillSource[g]=Math.max(gillSource[g],h);}
  alias[i]=g;
 }
 const G=first.length,local=new Int32Array(G);local.fill(-1);const activeGroups=[];
 for(let g=0;g<G;g++)if(jawSource[g]>0||gillSource[g]>0){local[g]=activeGroups.length;activeGroups.push(g);}
 const A=activeGroups.length,degree=new Uint32Array(A),boundaryJaw=new Uint8Array(A),boundaryGill=new Uint8Array(A);let skinny=0;
 const eachTriangle=visit=>{for(let t=0;t<indices.length;t+=3)visit(alias[indices[t]],alias[indices[t+1]],alias[indices[t+2]],t);};
 eachTriangle((a,b,c,t)=>{
  const gs=[a,b,c],ls=gs.map(g=>local[g]);if(ls.every(i=>i<0))return;
  const pa=first[a]*3,pb=first[b]*3,pc=first[c]*3,x=positions[pb]-positions[pa],y=positions[pb+1]-positions[pa+1],z=positions[pb+2]-positions[pa+2],u=positions[pc]-positions[pa],v=positions[pc+1]-positions[pa+1],w=positions[pc+2]-positions[pa+2],area=Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u),scale=x*x+y*y+z*z+u*u+v*v+w*w,thin=area/Math.max(scale,1e-30)<1e-5;if(thin)skinny++;
  const bj=thin||gs.some(g=>jawSource[g]===0),bg=thin||gs.some(g=>gillSource[g]===0);
  for(const i of ls)if(i>=0){if(bj)boundaryJaw[i]=1;if(bg)boundaryGill[i]=1;}
  for(const [i,j] of [[ls[0],ls[1]],[ls[1],ls[2]],[ls[2],ls[0]]])if(i>=0&&j>=0&&i!==j){degree[i]++;degree[j]++;}
 });
 const offset=new Uint32Array(A+1);for(let i=0;i<A;i++)offset[i+1]=offset[i]+degree[i];const cursor=offset.slice(),neighbors=new Uint32Array(offset[A]),lengths=new Float32Array(offset[A]);
 eachTriangle((a,b,c)=>{
  for(const [g,h] of [[a,b],[b,c],[c,a]]){const i=local[g],j=local[h];if(i<0||j<0||i===j)continue;const p=first[g]*3,q=first[h]*3,d=Math.hypot(positions[p]-positions[q],positions[p+1]-positions[q+1],positions[p+2]-positions[q+2]);let k=cursor[i]++;neighbors[k]=j;lengths[k]=d;k=cursor[j]++;neighbors[k]=i;lengths[k]=d;}
 });
 // Maximum jaw lever ~.123m at .038rad gives ~.0047m motion. Quintic slope
 // <=1.875/band needs a ~.05L collar to bound the added spatial derivative.
 // Both collars remain inside the measured original source-positive domains.
 // These are deformation widths, not biological amplitude/frequency claims.
 const length=metadata.continuum.body.endXM-metadata.continuum.body.sourceXM,jawBand=.050*length,gillBand=.040*length;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
 function distanceField(source,boundary,band){
  const distance=new Float64Array(A);distance.fill(Infinity);const heap=[];
  const push=(d,i)=>{let k=heap.length;heap.push([d,i]);while(k){const p=(k-1)>>1;if(heap[p][0]<=d)break;heap[k]=heap[p];k=p;}heap[k]=[d,i];};
  const pop=()=>{const best=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1][0]<heap[c][0])c++;if(heap[c][0]>=last[0])break;heap[k]=heap[c];k=c;}heap[k]=last;}return best;};
  let seeds=0;for(let i=0;i<A;i++)if(source[activeGroups[i]]>0&&boundary[i]){distance[i]=0;push(0,i);seeds++;}
  while(heap.length){const [d,i]=pop();if(d>distance[i]+1e-12)continue;if(d>=band)continue;for(let k=offset[i];k<offset[i+1];k++){const j=neighbors[k];if(source[activeGroups[j]]===0)continue;const nd=d+lengths[k];if(nd<distance[j]-1e-12){distance[j]=nd;push(nd,j);}}}
  const field=new Float32Array(G);let max=0,positive=0,full=0;for(let i=0;i<A;i++)if(source[activeGroups[i]]>0){const value=smooth(distance[i]/band);field[activeGroups[i]]=value;max=Math.max(max,value);if(value>0)positive++;if(value===1)full++;}
  return {field,proof:{seeds,positiveUniquePositions:positive,fullUniquePositions:full,maxWeight:max,collarM:band}};
 }
 const jaw=distanceField(jawSource,boundaryJaw,jawBand),gill=distanceField(gillSource,boundaryGill,gillBand);
 // Area-weighted actual source-triangle barycentric gradients at position
 // aliases. Float64 accumulation prevents cancellation/round-off drift.
 function gradients(field){const sums=new Float64Array(G*3),areaSum=new Float64Array(G);
  eachTriangle((a,b,c)=>{const wa=field[a],wb=field[b],wc=field[c];const A=first[a]*3,B=first[b]*3,C=first[c]*3,x=positions[B]-positions[A],y=positions[B+1]-positions[A+1],z=positions[B+2]-positions[A+2],u=positions[C]-positions[A],v=positions[C+1]-positions[A+1],w=positions[C+2]-positions[A+2],nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u,L2=nx*nx+ny*ny+nz*nz;if(L2<1e-24)return;const L=Math.sqrt(L2),dB=wb-wa,dC=wc-wa,gx=((v*nz-w*ny)*dB+(ny*z-nz*y)*dC)/L2,gy=((w*nx-u*nz)*dB+(nz*x-nx*z)*dC)/L2,gz=((u*ny-v*nx)*dB+(nx*y-ny*x)*dC)/L2;for(const g of [a,b,c]){sums[g*3]+=gx*L;sums[g*3+1]+=gy*L;sums[g*3+2]+=gz*L;areaSum[g]+=L;}});
  const out=new Float32Array(N*3);for(let i=0;i<N;i++){const g=alias[i],scale=areaSum[g]||1;for(let k=0;k<3;k++)out[i*3+k]=sums[g*3+k]/scale;}return out;
 }
 // Formal R04 routing: jaw candidate failed the full source triangle-area
 // gate. Keep all jaw floats exactly zero, including gradients. The rejected
 // nonzero generator is preserved in scripts/research-fixtures, not runtime.
 const jawWeight=new Float32Array(N),jawGradient=new Float32Array(N*3),gillWeight=new Float32Array(N);for(let i=0;i<N;i++)gillWeight[i]=gill.field[alias[i]];
 return {jawWeight,gillWeight,jaw:jawWeight,gill:gillWeight,jawGradient,gillGradient:gradients(gill.field),proof:{version:VERSION,vertices:N,triangles:indices.length/3,sourcePositionsUnchanged:true,sourceIndicesUnchanged:true,originalWeightsUnchanged:true,aliasToleranceM:1e-7,uniquePositions:G,oralUniquePositions:A,originalAliasWeightSpread:oldAliasWeightSpread,sourceSkinnyOralTrianglesHeld:skinny,jaw:{status:'HOLD_LOCAL_TRIANGLE_GRADIENT_SOURCE',enabled:false,maxWeight:0,maxGradient:0,reason:'Original thin source triangle27216 has true face gradient495.738/m and2.3167 area ratio under rejected graph-distance jaw field; vertex averages cannot pass this gate'},gill:{...gill.proof,status:'SOURCE_GILL_ONLY_CONTINUOUS_FIELD',passed:true,maxTestedDisplacementM:.00135},fieldMeaning:'Gill only: original source-positive domains and quintic C2 collar over original graph, source cross-domain triangles zero. Jaw explicitly disabled; gill motion must not be called mouth opening. No new topology or cavity.',productionReady:false}};
}
