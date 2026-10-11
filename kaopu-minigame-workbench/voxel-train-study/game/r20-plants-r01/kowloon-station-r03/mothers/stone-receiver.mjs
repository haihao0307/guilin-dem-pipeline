// New bounded radial receiver around the unchanged STONE_STUDY CPU field.
// Material kernel is from that SAME HTML, not the unrelated R3.12 stone branch.
import {createMetricStoneField} from './stone-metric-adapter.mjs';
import {OriginalStoneMother as G} from './stone-study/stone-original.mjs';
export {STONE_MATERIAL_GLSL,STONE_MATERIAL_SOURCE} from './stone-material-kernel.mjs';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(x,name)=>{if(!Number.isFinite(x))throw Error('Finite '+name+' required');return x;};
export function resolveStoneFabric({age=.5,repair=0,moisture=.35,wear=.15}={}){
 for(const [k,v]of Object.entries({age,repair,moisture,wear}))if(finite(v,k)<0||v>1)throw Error(k+' must be 0..1 authored state');
 const retainedAge=age*(1-repair),damage=clamp(.08+1.10*retainedAge+.30*wear,0,1.6),weathering=clamp(.08+1.00*retainedAge+.35*moisture*(1-repair),0,1.6);
 return Object.freeze({age,repair,moisture,wear,retainedAge,damage,weathering,level:clamp(.08+.60*retainedAge+.12*wear,0,1),wet:clamp(moisture*(.45+.55*retainedAge)*(1-.45*repair)),roughBias:.07*retainedAge+.025*wear-.06*repair,policy:'new authored bounded bridge; no calibrated age/decay law'});
}
export function makeStoneChart(sizeM,segments=6){
 if(sizeM.length!==3||!sizeM.every(v=>Number.isFinite(v)&&v>0))throw Error('Positive sizeM required');
 if(!Number.isInteger(segments)||segments<5||segments>7)throw Error('segments 5..7 required (152..296 unique vertices)');
 const points=[],indices=[],map=new Map();
 function vertex(p){const k=p.join(',');if(map.has(k))return map.get(k);const id=points.length;map.set(k,id);points.push(p.map((v,i)=>v/segments*sizeM[i]/2));return id;}
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){const u=(axis+1)%3,v=(axis+2)%3;const face=[];
  for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){const p=[0,0,0];p[axis]=sign*segments;p[u]=i*2-segments;p[v]=j*2-segments;face.push(vertex(p));}
  for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){const a=face[j*(segments+1)+i],b=face[j*(segments+1)+i+1],c=face[(j+1)*(segments+1)+i],d=face[(j+1)*(segments+1)+i+1];indices.push(...(sign>0?[a,b,d,a,d,c]:[a,d,b,a,c,d]));}
 }
 return {points,indices:new Uint16Array(indices),segments,vertexCount:points.length,triangleCount:indices.length/3};
}
export class StoneReceiverRejection extends Error{constructor(code,details){super('STONE_RECEIVER_REJECTED '+code+': '+JSON.stringify(details));this.name='StoneReceiverRejection';this.code=code;this.details=details;}}
export function sampleStoneRadial(field,sizeM,{segments=6,radialProbes=128,bisections=22,maxVertexResidualM=2e-6,maxTriangleResidualM=Math.min(...sizeM)*.085,checkTriangleRays=true}={}){
 if(!field?.sdf||!field?.normal)throw Error('Metric source field required');
 if(!Number.isInteger(radialProbes)||radialProbes<64||radialProbes>512)throw Error('radialProbes 64..512 required');
 const chart=makeStoneChart(sizeM,segments),minDim=Math.min(...sizeM),margin=minDim*.6,initial=field.sdf([0,0,0]);
 const reject=(code,details)=>{throw new StoneReceiverRejection(code,details);};
 if(!Number.isFinite(initial)||initial>=-1e-8)reject('origin_not_inside',{value:initial});
 let evaluations=1,rays=0,maxResidual=0,maxTriangleResidual=0;
 const evaluate=p=>{evaluations++;const d=field.sdf(p);if(!Number.isFinite(d))reject('nonfinite_field',{p});return d;};
 function root(q,kind,id){
  rays++;const tMax=Math.min(...q.map((v,i)=>Math.abs(v)>1e-12?(sizeM[i]/2+margin)/Math.abs(v):Infinity));let lastT=0,lastD=initial,transitions=0,lo=0,hi=0;
  for(let j=1;j<=radialProbes;j++){const t=tMax*j/radialProbes,d=evaluate(q.map(v=>v*t));if((lastD<=0)!==(d<=0)){transitions++;if(transitions===1){lo=lastT;hi=t;}}lastT=t;lastD=d;}
  if(lastD<=0)reject('outside_bracket_missing',{kind,id,lastD,tMax});
  if(transitions!==1)reject('non_star_multiple_crossings',{kind,id,transitions,radialProbes});
  for(let j=0;j<bisections;j++){const mid=(lo+hi)/2;if(evaluate(q.map(v=>v*mid))<=0)lo=mid;else hi=mid;}
  const p=q.map(v=>v*(lo+hi)/2),residual=Math.abs(evaluate(p));maxResidual=Math.max(maxResidual,residual);if(residual>maxVertexResidualM)reject('vertex_residual',{kind,id,residual,limit:maxVertexResidualM});return p;
 }
 const points=chart.points.map((q,i)=>root(q,'vertex',i)),positions=new Float32Array(points.flat()),normals=new Float32Array(points.length*3);
 // Float32 upload coordinates, not merely the discarded JS doubles, are checked.
 for(let i=0;i<points.length;i++){const p=Array.from(positions.slice(i*3,i*3+3)),n=field.normal(p,Math.min(.00015,minDim/200));const norm=Math.hypot(...n),d=Math.abs(evaluate(p));if(!Number.isFinite(norm)||norm<.99||norm>1.01)reject('invalid_normal',{i,n});if(d>maxVertexResidualM)reject('float32_vertex_residual',{i,residual:d,limit:maxVertexResidualM});maxResidual=Math.max(maxResidual,d);normals.set(n,i*3);}
 for(let i=0;i<chart.indices.length;i+=3){const ids=Array.from(chart.indices.slice(i,i+3)),ps=ids.map(k=>Array.from(positions.slice(k*3,k*3+3))),c=[0,1,2].map(k=>(ps[0][k]+ps[1][k]+ps[2][k])/3),ab=ps[1].map((v,k)=>v-ps[0][k]),ac=ps[2].map((v,k)=>v-ps[0][k]),cross=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
  if(Math.hypot(...cross)<1e-12||cross.reduce((s,v,k)=>s+v*c[k],0)<=0)reject('degenerate_or_inverted_triangle',{triangle:i/3});
  const d=Math.abs(evaluate(c));maxTriangleResidual=Math.max(maxTriangleResidual,d);if(d>maxTriangleResidualM)reject('triangle_residual',{triangle:i/3,residual:d,limit:maxTriangleResidualM});
  if(checkTriangleRays){const q=[0,1,2].map(k=>(chart.points[ids[0]][k]+chart.points[ids[1]][k]+chart.points[ids[2]][k])/3);root(q,'triangle_centroid',i/3);}
 }
 const sourcePositions=new Float32Array(positions.length);for(let i=0;i<positions.length;i++)sourcePositions[i]=positions[i]/(field.scaleM??1);
 return {positions,normals,sourcePositions,indices:chart.indices,proof:{vertices:positions.length/3,triangles:chart.indices.length/3,rayCount:rays,radialProbes,evaluations,maxVertexResidualM:maxResidual,maxTriangleCentroidResidualM:maxTriangleResidual,triangleResidualLimitM:maxTriangleResidualM,originalSDF:true,sourceFunctionsRewritten:false,fullBuildMeshCalled:false,sampledStarDomainAccepted:true,starProofScope:'sample vertices and triangle-centroid rays only; not exhaustive between-ray topology proof',subProbePoresAndUndercutsNotGuaranteed:true,failClosedOnDetectedInvalidity:true,gpuVerified:false,visualAccepted:false}};
}
export function stoneMaterialParameters(field,resolved,{kind=0,materialScale=1,mineral=.7,chroma=1,relief=1}={}){
 if(!Number.isInteger(kind)||kind<0||kind>3)throw Error('Original stone kind 0..3 required');
 const seeds=field.source.seeds,events=field.source.damage.formationEvents.slice(0,20),centers=new Float32Array(80),sizes=new Float32Array(80);
 events.forEach((e,i)=>{centers.set([e.center.x,e.center.y,e.center.z,e.typeCode],4*i);sizes.set([e.size.x,e.size.y,e.size.z,e.strength],4*i);});
 return {sKind:kind,sSurface:[materialScale,mineral,resolved.wet,resolved.roughBias],sDisplay:[0,1,0,chroma],sRelief:relief,uColorSeed:seeds.color,uPoreSeed:seeds.pore,uWeatherSeed:seeds.weather,uEventCount:events.length,uEventCenter:centers,uEventSize:sizes,sourceScaleM:field.scaleM,geometryDamage:resolved.damage,geometryWeathering:resolved.weathering};
}
export function createRadialStoneReceiver(input={}){
 const {sizeM=[.42,.18,.24],seed=8231,kind=0,age=.5,repair=0,moisture=.35,wear=.15,controls={},sampling={},material={}}=input;
 const state=resolveStoneFabric({age,repair,moisture,wear}),field=createMetricStoneField({sizeM,seed,damage:state.damage,weathering:state.weathering,level:state.level,controls}),t0=performance.now(),geometry=sampleStoneRadial(field,sizeM,sampling),uniforms=stoneMaterialParameters(field,state,{...material,kind});
 return {geometry,uniforms,state,field,proof:{...geometry.proof,sourceHTML:'STONE_STUDY.html',geometryAndMaterialSameMother:true,newAgeRepairBridge:true,stateResolvedBeforeGeometry:true,cpuBuildMs:performance.now()-t0},dispose(){}};
}
// Official station entry: preserve original marching-tetra mesh, including non-star topology.
// Construct once per full parameter tuple; never invoke this in a frame loop.
export function createStoneReceiver(input={}){
 const {sizeM=[.42,.18,.24],seed=8231,kind=0,age=.5,repair=0,moisture=.35,wear=.15,controls={},quality=.56,mobilePreview=false,material={},residualSamples=64}=input;
 if(!Number.isFinite(quality)||quality<.20||quality>1)throw Error('Explicit original mesh quality .20..1 required');
 if(!Number.isInteger(residualSamples)||residualSamples<0||residualSamples>2048)throw Error('residualSamples 0..2048 required');
 const state=resolveStoneFabric({age,repair,moisture,wear}),field=createMetricStoneField({sizeM,seed,damage:state.damage,weathering:state.weathering,level:state.level,controls}),t0=performance.now();
 const raw=G.buildMesh(field.profile,{master:seed},{...field.settings,mobilePreview:mobilePreview?1:0},state.level,quality),buildMs=performance.now()-t0;
 if(!raw.vertices||![...raw.positions,...raw.normals].every(Number.isFinite))throw Error('Invalid original stone mesh; no substitute emitted');
 const positions=new Float32Array(raw.positions.length),normals=raw.normals,sourcePositions=raw.positions;
 for(let i=0;i<positions.length;i++)positions[i]=raw.positions[i]*field.scaleM;
 let maxResidual=0,residualSum=0,n=0;for(let j=0;j<Math.min(raw.vertices,residualSamples);j++){const i=Math.floor(j*raw.vertices/Math.min(raw.vertices,residualSamples));const d=Math.abs(field.sdf(Array.from(positions.slice(i*3,i*3+3))));if(!Number.isFinite(d))throw Error('Invalid source residual');maxResidual=Math.max(maxResidual,d);residualSum+=d;n++;}
 const uniforms=stoneMaterialParameters(field,state,{...material,kind});
 // Provenance consistency rather than treating one material wrapper as shared-state proof.
 if(JSON.stringify(raw.seedDNA)!==JSON.stringify(field.source.seeds)||JSON.stringify(raw.damage)!==JSON.stringify(field.source.damage))throw Error('Original geometry/material source-state mismatch');
 const geometry={positions,normals,sourcePositions,indices:null,vertexCount:raw.vertices,triangleCount:raw.triangles};
 const proof={sourceHTML:'STONE_STUDY.html',geometryAndMaterialSameMother:true,originalBuildMeshCalled:true,sourceFunctionsRewritten:false,sourceNoiseUnchanged:true,radialApproximation:false,rawPositionsScaledUniformlyOnly:true,rawNormalsPreserved:true,rawTriangleSoup:true,vertices:raw.vertices,triangles:raw.triangles,grid:raw.grid,quality,mobilePreview,sourceUnitScaleM:field.scaleM,newAgeRepairBridge:true,stateResolvedBeforeGeometry:true,geometryMaterialSeedDamageEqual:true,residualSamples:n,maxSampledVertexResidualM:maxResidual,meanSampledVertexResidualM:n?residualSum/n:null,residualScope:'Sample of original marching-tetra interpolation vertices; not a zero-residual promise or complete topology verification',lowResolutionDetailNotGuaranteed:true,cpuBuildMs:buildMs,cpuTotalMs:performance.now()-t0,gpuVerified:false,visualAccepted:false};
 return {geometry,uniforms,state,field,sourceMesh:raw,proof,dispose(){}};
}
export function createStoneReceiverCache({capacity=4}={}){
 if(!Number.isInteger(capacity)||capacity<1||capacity>16)throw Error('Explicit capacity 1..16 required');const entries=new Map();let hits=0,misses=0;
 const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 return {prepare(input={}){const key=JSON.stringify(canonical(input));if(entries.has(key)){hits++;return entries.get(key);}if(entries.size>=capacity)throw Error('Stone template capacity reached; no implicit seed alias or eviction');const e=createStoneReceiver(input);entries.set(key,e);misses++;return e;},get stats(){return {entries:entries.size,capacity,hits,misses,cpuGeometryBytes:[...entries.values()].reduce((n,e)=>n+['positions','normals','sourcePositions','indices'].reduce((a,k)=>a+(e.geometry[k]?.byteLength??0),0),0)};},dispose(){entries.clear();}};
}
