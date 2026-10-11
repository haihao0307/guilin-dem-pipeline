import {validateWeatherDomain,createWeatherStateCache,packInstancePatches,samplePackedPatch} from './cache.mjs';
import {createWeatherNumericSampler} from './gpu-sampler.mjs';
export function errorStatistics(values){if(!values.length)throw Error('Nonempty errors required');const sorted=Array.from(values,x=>{if(!Number.isFinite(x)||x<0)throw Error('Invalid error');return x;}).sort((a,b)=>a-b);return {count:sorted.length,max:sorted.at(-1),p99:sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.99)-1)],mean:sorted.reduce((a,b)=>a+b,0)/sorted.length};}
function comparisonSummary(sample){const values=sample.values,waterErrors=[];let min=Infinity,max=-Infinity,referenceSum=0;for(let i=0;i<values.length;i+=4){const ref=values[i];waterErrors.push(Math.abs(ref-values[i+2]));min=Math.min(min,ref);max=Math.max(max,ref);referenceSum+=ref;}return {water:errorStatistics(waterErrors),referenceWater:{min,max,mean:referenceSum/(values.length/4)},gpu:sample.metrics};}
// Deterministic coverage, not a replacement noise field. Real surface-space
// samples only: interior, domain edges, damp heights and shared grid boundaries.
export function makeNumericalProbePositions(cache,{randomCount=2048}={}){
 if(!Number.isSafeInteger(randomCount)||randomCount<32||randomCount>65536)throw Error('Probe count must be 32..65536');
 const d=cache.domain.fullDimensionsMetres,points=[];for(let i=0;i<randomCount;i++)points.push([(i*.7548776662466927%1-.5)*d[0],(i*.5698402909980532%1-.5)*d[1],(i*.4385790217733487%1-.5)*d[2]]);
 for(const y of [0,.06,.16,.34,.52,.78,1])for(const x of [-.5,-.23,0,.23,.5])for(const z of [-.5,0,.5])points.push([x*d[0],(y-.5)*d[1],z*d[2]]);
 for(let a=0;a<3;a++){const axis=cache.axes[a];for(let i=2;i<axis.count-2;i++){for(const sign of [-1,0,1]){const p=[0,-.25*d[1],0];p[a]=axis.origin+i*axis.step+sign*1e-6;points.push(p);}}}
 return new Float32Array(points.flat());
}
function cachedPairs(cache,positions){const pairs=new Float32Array(positions.length/3*2);for(let i=0;i<positions.length/3;i++)pairs.set(cache.sampleParent(positions.subarray(i*3,i*3+3)),i*2);return pairs;}
export function checkPatchSeams(cache){
 const {axes,domain}=cache,probes=[],bounds=[];
 // Compare the SAME parent point, using staggered/overlapping patch origins.
 for(const a of [0,1,2]){if(axes[a].count<6)continue;for(let idx=2;idx<axes[a].count-3;idx++){const centre=[0,-.23*domain.fullDimensionsMetres[1],0];centre[a]=axes[a].origin+idx*axes[a].step;
  for(const sign of [-1,1]){const c=centre.slice();c[a]+=(sign*.15)*axes[a].step;const radius=axes.map(v=>v.step*.45);bounds.push({min:c.map((v,j)=>v-radius[j]),max:c.map((v,j)=>v+radius[j])});}probes.push(centre);
 }}
 if(!probes.length)throw Error('Insufficient cache seam probes');const packed=packInstancePatches(cache,bounds),lowErrors=[],nodeErrors=[];
 probes.forEach((p,i)=>{const left=samplePackedPatch(cache,packed,i*2,p),right=samplePackedPatch(cache,packed,i*2+1,p),full=cache.sampleParent(p);for(let c=0;c<2;c++){lowErrors.push(Math.abs(left[c]-right[c]));nodeErrors.push(Math.abs(left[c]-full[c]),Math.abs(right[c]-full[c]));}});
 return {samePointCrossBrickLowState:errorStatistics(lowErrors),packedVersusGlobalInterpolant:errorStatistics(nodeErrors),probePairs:probes.length,definition:'Same parent-space position read through different per-instance patch origins; mathematical cache seam, not physical separation between mortar and brick surfaces',gpuPatchShaderEvaluated:false,packed,probes};
}
export function runWaterCacheNumericalQA({renderer,domain,gridOptions={},randomCount=2048,maxWaterError=null,p99WaterError=null}={}){
 const raw=domain&&Object.isFrozen(domain)?Object.fromEntries(Object.entries(domain).filter(([k])=>k!=='horizontalAxis')):domain,d=validateWeatherDomain(raw),sampler=createWeatherNumericSampler(renderer);let cache;
 try{cache=createWeatherStateCache({sampler,domain:d,...gridOptions});const positions=makeNumericalProbePositions(cache,{randomCount});
  const exactLow=sampler.sampleLow(d,positions),identity=comparisonSummary(sampler.compare(d,positions,exactLow.values));
  const grid=comparisonSummary(sampler.compare(d,positions,cachedPairs(cache,positions))),seams=checkPatchSeams(cache);
  const pointBounds=Array.from({length:positions.length/3},(_,i)=>{const p=Array.from(positions.subarray(i*3,i*3+3));return {min:p,max:p};}),pointPatches=packInstancePatches(cache,pointBounds),gpuPatch=comparisonSummary(sampler.comparePatches(cache,positions,pointPatches));
  const seamPositions=new Float32Array(seams.probes.flatMap(p=>[...p,...p])),gpuSeamSample=sampler.comparePatches(cache,seamPositions,seams.packed),gpuSeamErrors=[];for(let i=0;i<gpuSeamSample.values.length;i+=8)gpuSeamErrors.push(Math.abs(gpuSeamSample.values[i+2]-gpuSeamSample.values[i+6]));
  const report={source:cache.provenance,domain:d,cache:cache.metrics,axes:cache.axes,samples:positions.length/3,splitIdentity:identity,cacheAgainstOriginalFullField:grid,actualPatchShaderAgainstOriginalFullField:gpuPatch,crossBrickSeams:{samePointCrossBrickLowState:seams.samePointCrossBrickLowState,packedVersusGlobalInterpolant:seams.packedVersusGlobalInterpolant,probePairs:seams.probePairs,definition:seams.definition,gpuPatchShaderEvaluated:true,actualGPUWaterSeams:errorStatistics(gpuSeamErrors),gpu:gpuSeamSample.metrics},perFrame:{valueNoise3:0,gradientNoise3:0,hash31:5,numericPatchScalarBytesPerInstance:144},visualAcceptance:false,interactiveAcceptance:false};
  if(Math.max(...gpuSeamErrors)>2e-6)throw Object.assign(Error('V26 GPU per-instance patch seam exceeds 2e-6'),{report});
  if(identity.water.max>2e-6)throw Object.assign(Error('V26 split identity differs from original'),{report});
  for(const [name,limit,actual]of [['maxWaterError',maxWaterError,Math.max(grid.water.max,gpuPatch.water.max)],['p99WaterError',p99WaterError,Math.max(grid.water.p99,gpuPatch.water.p99)]]){if(limit!==null&&(!Number.isFinite(limit)||limit<0||limit>1))throw Error('Invalid '+name);if(limit!==null&&actual>limit)throw Object.assign(Error(`${name} ${actual} exceeds requested ${limit}`),{report});}
  return report;
 }finally{sampler.dispose();}
}
