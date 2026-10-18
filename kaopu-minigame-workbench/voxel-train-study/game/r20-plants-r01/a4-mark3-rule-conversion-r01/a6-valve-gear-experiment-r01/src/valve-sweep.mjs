/** Full finite native triangle sweep, confined to the independent experiment.
 * The conservative broad phase is continuous; sampled triangle clearance is not.
 * No tessellation, body, old static reference, or default shell is removed.
 */
import {evaluateA6Motion,transformA6Point,trianglesIntersectA6} from '../../a6-native-r02/src/a6-motion.mjs';
import {buildA6LocomotiveShell} from '../../a6-native-r02/src/a6-locomotive-shell.mjs';
import {evaluateValveNativeAdapter} from './valve-native-adapter.mjs';
const TAU=2*Math.PI,EPS=1e-9;
const pairKey=(a,b)=>[a,b].sort().join('|');
const overlap=(a,b,epsilon=0)=>a.min.every((v,k)=>v<=b.max[k]+epsilon&&a.max[k]+epsilon>=b.min[k]);
function boundsOf(positions,matrix){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<positions.length;i+=3){const q=[positions[i],positions[i+1],positions[i+2]],p=matrix?transformA6Point(matrix,q):q;for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}}
  return {min,max};
}
function validateMesh(p){
  if(!p||typeof p.name!=='string'||!p.positions?.length||p.positions.length%3||!p.indices?.length||p.indices.length%3)throw Error('Expected complete named indexed native mesh');
  if(!p.positions.every(Number.isFinite)||!p.indices.every(i=>Number.isInteger(i)&&i>=0&&i<p.positions.length/3))throw Error(`Invalid mesh: ${p.name}`);
}
function validateBounds(b,name){if(!b||!b.min?.every(Number.isFinite)||!b.max?.every(Number.isFinite)||b.min.some((v,i)=>v>b.max[i]))throw Error(`Missing rigorous continuous bounds: ${name}`);}
function trianglesOf(body,matrix){
  let p=body.positions;
  if(matrix){p=new Float64Array(p.length);for(let i=0;i<p.length;i+=3){const q=transformA6Point(matrix,[body.positions[i],body.positions[i+1],body.positions[i+2]]);p[i]=q[0];p[i+1]=q[1];p[i+2]=q[2];}}
  const tris=[];
  for(let i=0;i<body.indices.length;i+=3){const points=[0,1,2].map(k=>{const j=body.indices[i+k]*3;return[p[j],p[j+1],p[j+2]];});tris.push({points,bounds:boundsOf(points.flat()),index:i/3});}
  return tris;
}
/** Exact BVH over every original indexed triangle, adapted from frozen R02. */
function bvh(tris){
  const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const t of tris)for(let k=0;k<3;k++){box.min[k]=Math.min(box.min[k],t.bounds.min[k]);box.max[k]=Math.max(box.max[k],t.bounds.max[k]);}
  if(tris.length<=12)return{box,tris};
  const spans=box.max.map((v,k)=>v-box.min[k]),axis=spans.indexOf(Math.max(...spans));
  tris.sort((a,b)=>(a.bounds.min[axis]+a.bounds.max[axis])-(b.bounds.min[axis]+b.bounds.max[axis]));
  const middle=Math.floor(tris.length/2);return{box,left:bvh(tris.slice(0,middle)),right:bvh(tris.slice(middle))};
}
function firstIntersection(a,b,counter){
  if(!overlap(a.box,b.box,EPS))return null;
  if(a.tris&&b.tris){for(const x of a.tris)for(const y of b.tris)if(overlap(x.bounds,y.bounds,EPS)){counter.tests++;if(trianglesIntersectA6(x.points,y.points))return{triangleA:x.index,triangleB:y.index};}return null;}
  if(a.tris)return firstIntersection(a,b.left,counter)||firstIntersection(a,b.right,counter);
  if(b.tris)return firstIntersection(a.left,b,counter)||firstIntersection(a.right,b,counter);
  return firstIntersection(a.left,b.left,counter)||firstIntersection(a.left,b.right,counter)||firstIntersection(a.right,b.left,counter)||firstIntersection(a.right,b.right,counter);
}
function triangleEvidence(body,id){
  const vertexIndices=Array.from(body.indices.slice(id*3,id*3+3));
  return{triangleId:id,vertexIndices,verticesM:vertexIndices.map(i=>{const p=Array.from(body.positions.slice(i*3,i*3+3));return body.matrix?transformA6Point(body.matrix,p):p;})};
}
/** Only exact frozen R02 rigid-assembly exemptions; working eyes remain tested. */
function declaredContacts(adapter){
  const model=adapter.baseModel,pairs=new Map();
  const note=(a,b,reason)=>pairs.set(pairKey(a,b),reason);
  for(const w of model.wheelInstances){
    const axis=model.axes.find(a=>a.index===w.axleIndex);
    note(w.name,`driver-${axis.index-1}-axle-shaft`,'Original coaxial wheel-hub/axle-shaft assembly fit; no working-fit tolerance validation');
    note(w.name,`coupling-crank-pin-extension-${w.side}-${w.axleIndex}`,'Coaxial rigid crankpin extension and wheel crankpin belong to the same rotating crank assembly');
  }
  for(const s of[-1,1]){
    note(`outside-piston-rod-${s}`,`a6-piston-rod-hidden-extension-${s}`,'Rigid butt joint between original rod and explicit native extension; both lengths fixed');
    note(`outside-piston-rod-${s}`,`outside-crosshead-${s}`,'Rigid original piston-rod/crosshead attachment');
    note(`a6-piston-rod-hidden-extension-${s}`,`a6-working-piston-head-${s}`,'Rigid piston-head/rod joint; head/cylinder and rod/gland interfaces remain tested');
    note(`coupling-crank-pin-extension-${s}-3`,`outside-main-rod-big-end-pin-${s}`,'Coaxial rigid middle crankpin/big-end pin stack; separate moving rod eyes remain checked');
  }
  for(const contact of adapter.allowedContacts)note(...contact.pair,contact.reason);
  // These are free working interfaces, never rigid-assembly exemptions.
  for(const side of[-1,1])for(const [a,b]of[
    [`return-crank-${side}`,`eccentric-rod-${side}`],
    [`eccentric-rod-${side}`,`slotted-expansion-link-${side}`],
    [`radius-rod-${side}`,`valve-experiment-expansion-die-${side}`],
    [`slotted-expansion-link-${side}`,`valve-experiment-expansion-die-${side}`],
    [`radius-rod-${side}`,`valve-experiment-lifting-die-${side}`],
    [`reverser-lifting-link-${side}`,`valve-experiment-lifting-die-${side}`],
    [`valve-rod-crosshead-${side}`,`valve-experiment-valve-crosshead-guide-${side}`],
    [`slotted-expansion-link-${side}`,`expansion-link-trunnion-${side}`],
    [`combination-lever-${side}`,`valve-rod-crosshead-${side}`],
    [`combination-lever-${side}`,`radius-rod-${side}`],
    [`combination-lever-${side}`,`union-link-${side}`],
    [`union-link-${side}`,`valve-experiment-crosshead-pin-${side}`],
  ])if(pairs.has(pairKey(a,b)))throw Error(`A working pin/eye, die/slot or body/guide pair cannot be exempted: ${a} / ${b}`);
  return pairs;
}
export const ORIGINAL_SIX_PAIRS=Object.freeze([-1,1].flatMap(s=>[
  [`outside-crosshead-${s}`,`combination-lever-${s}`],
  [`outside-crosshead-${s}`,`union-link-${s}`],
  [`outside-main-rod-big-end-pin-${s}`,`return-crank-${s}`],
]));
/** Default shell is ALWAYS present. obstacles adds further world-coordinate meshes. */
export function screenFiniteValveSweep(adapter,{stepDegrees=1,obstacles=[]}={}){
  if(!Number.isFinite(stepDegrees)||stepDegrees<=0||stepDegrees>45)throw Error('stepDegrees must be in (0,45]');
  if(!Array.isArray(obstacles))throw Error('obstacles must be an array');
  const started=Date.now(),model=adapter.baseModel,intervals=Math.ceil(360/stepDegrees),h=TAU/intervals,half=h/2;
  const shell=buildA6LocomotiveShell({topHeight:4.03,cabShift:0}),revised=new Set(Object.keys(adapter.replacementParts)),supplemental=new Set(adapter.supplementalParts.map(p=>p.name));
  const inheritedParts=[...adapter.mechanics.parts,...model.supplementalParts,...adapter.supplementalParts],partByName=new Map(inheritedParts.map(p=>[p.name,p]));
  if(adapter.mechanics.parts.length!==338||new Set(adapter.mechanics.parts.map(p=>p.name)).size!==338)throw Error('All original 338 component names must be retained exactly once');
  if(model.movingPartNames.some(n=>adapter.movingPartNames.includes(n)))throw Error('Conflicting base and valve motion ownership');
  const moving=[...model.descriptors.map(d=>({...partByName.get(d.name),speedBound:d.speedBound,motionKind:'base'})),...adapter.descriptors.map(d=>{validateBounds(d.continuousBounds,d.name);return{...d.part,continuousBounds:d.continuousBounds,motionKind:'valve'};}),...model.wheelInstances.map(w=>({name:w.name,...model.wheelGeometry,speedBound:w.speedBound,motionKind:'wheel',wheel:true}))];
  const movingNames=new Set(moving.map(p=>p.name));
  const staticBodies=[...inheritedParts,...shell.parts,...obstacles].filter(p=>!movingNames.has(p.name)).map(p=>({...p,bounds:boundsOf(p.positions,adapter.staticPartTransforms?.[p.name]),matrix:adapter.staticPartTransforms?.[p.name],experimentStatic:revised.has(p.name)||supplemental.has(p.name)}));
  for(const p of[...moving,...staticBodies])validateMesh(p);
  const allNames=[...moving,...staticBodies].map(p=>p.name);if(new Set(allNames).size!==allNames.length)throw Error('Collision bodies must have unique names, including obstacles');
  for(const p of moving)if(p.motionKind!=='valve'&&(!Number.isFinite(p.speedBound)||p.speedBound<0))throw Error(`No valid analytic speed bound for ${p.name}`);
  const allowed=declaredContacts(adapter),candidates=new Map(),staticTrees=new Map(),counter={tests:0};let intervalPairTests=0,staticPairTests=0,staticTreeBuilds=0,phaseTreeBuilds=0;
  const makePairAudit=pair=>({pair,continuousLateralBoundsM:null,minimumContinuousLateralGapM:Infinity,continuousLateralSeparationPass:false,sampledPhasesCovered:0,sampledAABBSeparatedPoses:0,exactTrianglePosesTested:0,sampledSurfaceWitness:null});
  const originalSix=ORIGINAL_SIX_PAIRS.map(makePairAudit),previousExperimentMovingWitnessPairs=[-1,1].map(side=>makePairAudit([`eccentric-rod-${side}`,`valve-experiment-return-crank-pin-${side}`]));
  const trackedPairs=[...originalSix,...previousExperimentMovingWitnessPairs],originalSixMap=new Map(trackedPairs.map(x=>[pairKey(...x.pair),x]));
  const getTree=(body,trees)=>{const cache=body.motionKind?trees:staticTrees;if(!cache.has(body.name)){cache.set(body.name,bvh(trianglesOf(body,body.matrix)));if(body.motionKind)phaseTreeBuilds++;else staticTreeBuilds++;}return cache.get(body.name);};
  function inspect(a,b,trees,angle){
    const hit=firstIntersection(getTree(a,trees),getTree(b,trees),counter);
    return hit?{phaseDegrees:angle*180/Math.PI,...hit,triangles:[triangleEvidence(a,hit.triangleA),triangleEvidence(b,hit.triangleB)],meaning:'Exact native mesh surfaces intersect or touch at this sampled pose; not a penetration-depth, load or engineering failure measurement.'}:null;
  }
  function consider(a,b,i,angle,trees,isStatic=false){
    if(isStatic)staticPairTests++;else intervalPairTests++;
    const key=pairKey(a.name,b.name);if(allowed.has(key))return;
    const aa=a.swept??a.bounds,bb=b.swept??b.bounds,original=originalSixMap.get(key);
    if(original){
      const gap=Math.max(aa.min[0]-bb.max[0],bb.min[0]-aa.max[0]);
      original.minimumContinuousLateralGapM=Math.min(original.minimumContinuousLateralGapM,gap);
      original.continuousLateralBoundsM=[aa,bb].map(x=>[x.min[0],x.max[0]]);original.sampledPhasesCovered++;
      if(!overlap(a.bounds,b.bounds,EPS))original.sampledAABBSeparatedPoses++;
      else {original.exactTrianglePosesTested++;const witness=inspect(a,b,trees,angle);if(witness&&!original.sampledSurfaceWitness)original.sampledSurfaceWitness=witness;}
    }
    if(!overlap(aa,bb,EPS))return;
    let record=candidates.get(key);
    if(!record){record={pair:[a.name,b.name],pairType:isStatic?'changed-static-versus-static':a.motionKind&&b.motionKind?'moving-versus-moving':'moving-versus-static',firstIntervalDegrees:isStatic?[0,360]:[i*360/intervals,(i+1)*360/intervals],lastIntervalDegrees:null,intervalCount:0,sampledSurfaceWitness:null,sampledPosesTested:0,sampledAABBOverlapPoses:0,involvesNewOrRevisedValveGeometry:revised.has(a.name)||revised.has(b.name)||supplemental.has(a.name)||supplemental.has(b.name),involvesShell:shell.parts.some(p=>p.name===a.name||p.name===b.name)};candidates.set(key,record);}
    record.intervalCount+=isStatic?intervals:1;record.lastIntervalDegrees=isStatic?[0,360]:[i*360/intervals,(i+1)*360/intervals];
    if(overlap(a.bounds,b.bounds,EPS)){
      record.sampledAABBOverlapPoses++;
      if(!record.sampledSurfaceWitness){record.sampledPosesTested++;record.sampledSurfaceWitness=original?.sampledSurfaceWitness??inspect(a,b,trees,angle);}
    }
  }
  // Any static part replaced or introduced by this experiment must also be
  // screened against every other static part; retained-static pairs alone skip.
  for(let a=0;a<staticBodies.length;a++)for(let b=a+1;b<staticBodies.length;b++)if(staticBodies[a].experimentStatic||staticBodies[b].experimentStatic)consider(staticBodies[a],staticBodies[b],0,0,new Map(),true);
  for(let i=0;i<intervals;i++){
    const angle=(i+.5)*h,base=evaluateA6Motion(model,angle),valve=evaluateValveNativeAdapter(adapter,angle),wheelMatrices=new Map(base.wheelTransforms.map(w=>[w.name,w.matrix])),trees=new Map();
    const dynamic=moving.map(body=>{
      const matrix=body.wheel?wheelMatrices.get(body.name):body.motionKind==='valve'?valve.partTransforms[body.name]:base.partTransforms[body.name];
      if(!matrix)throw Error(`Missing pose transform for ${body.name}`);
      const bounds=boundsOf(body.positions,matrix);let swept;
      if(body.motionKind==='valve'){
        swept=body.continuousBounds;
        if(bounds.min.some((v,k)=>v<swept.min[k]-1e-8)||bounds.max.some((v,k)=>v>swept.max[k]+1e-8))throw Error(`Pose escapes declared continuous bounds: ${body.name} at ${angle*180/Math.PI}`);
      }else{const padding=body.speedBound*half+EPS;swept={min:bounds.min.map((v,k)=>v-(k?padding:0)),max:bounds.max.map((v,k)=>v+(k?padding:0))};}
      return{...body,matrix,bounds,swept};
    });
    for(let a=0;a<dynamic.length;a++){for(const b of staticBodies)consider(dynamic[a],b,i,angle,trees);for(let b=a+1;b<dynamic.length;b++)consider(dynamic[a],dynamic[b],i,angle,trees);}
  }
  for(const x of trackedPairs){x.continuousLateralSeparationPass=x.minimumContinuousLateralGapM>EPS;x.sampledFullCycleSurfacePass=x.sampledPhasesCovered===intervals&&!x.sampledSurfaceWitness;x.status=x.continuousLateralSeparationPass?'continuously-separated-by-rigorous-lateral-bounds':x.sampledSurfaceWitness?'sampled-native-surface-witness':'unresolved-continuous-clearance';}
  const list=[...candidates.values()].sort((a,b)=>Number(!!b.sampledSurfaceWitness)-Number(!!a.sampledSurfaceWitness)||a.pair.join('|').localeCompare(b.pair.join('|')));
  for(const c of list)c.status=c.sampledSurfaceWitness?'sampled-native-surface-witness':'unresolved-continuous-candidate';
  const witnesses=list.filter(c=>c.sampledSurfaceWitness);
  return{schema:'finite-native-valve-sweep/1',status:witnesses.length?'sampled-intersections-found':list.length?'unresolved-continuous-candidates':'continuous-envelopes-separated-in-declared-scope',phaseRangeDegrees:[0,360],intervals,intervalDegrees:360/intervals,elapsedSeconds:(Date.now()-started)/1000,
    method:'All original indexed triangles at interval midpoints. Base and wheel continuous interval AABBs use frozen R02 analytic vertex speed bounds; valve continuous AABBs use the adapter’s fixed-length-chain whole-revolution reachable bounds. Static and per-phase BVHs cache complete exact triangles. No fitted or sampled velocity bound is used.',
    defaultShellParameters:{topHeight:4.03,cabShift:0},defaultShellIncluded:true,defaultShellBodyCount:shell.parts.length,additionalObstacleCount:obstacles.length,
    sampledPairTermination:'Narrow phase stops after the first genuine surface witness for a pair; the original six pairs are separately screened over every midpoint. Disjoint exact full-vertex AABBs safely prune triangle checks.',
    geometrySource:'338 inherited names exactly once, with explicitly declared same-name valve replacements; all 16 supplemental components, six full native wheel instances, full default locomotive shell; no mesh decimation',
    inheritedComponents:adapter.mechanics.parts.length,baseSupplementalComponents:model.supplementalParts.length,valveSupplementalComponents:adapter.supplementalParts.length,movingBodyCount:moving.length,baseMovingBodyCount:model.descriptors.length,valveMovingBodyCount:adapter.descriptors.length,wheelInstanceCount:model.wheelInstances.length,staticBodyCount:staticBodies.length,
    nativeTriangleCount:[...moving,...staticBodies].reduce((n,p)=>n+p.indices.length/3,0),changedStaticParts:staticBodies.filter(p=>p.experimentStatic).map(p=>p.name),intervalPairTests,staticPairTests,triangleTests:counter.tests,staticTreeBuilds,phaseTreeBuilds,
    candidateCount:list.length,sampledSurfaceWitnessCount:witnesses.length,unresolvedNoWitnessCandidateCount:list.length-witnesses.length,candidates:list,originalSixPairChecks:originalSix,previousExperimentMovingWitnessPairChecks:previousExperimentMovingWitnessPairs,
    allowedContacts:[...allowed].map(([k,reason])=>({pair:k.split('|'),reason})),continuousBroadPhaseComplete:true,continuousTriangleNarrowPhaseComplete:false,finiteSampledTrianglesComplete:true,fullVehicleApproval:false,actualA4ValveTiming:false,
    limitations:['No-witness continuous broad-phase candidates remain unresolved.','Dense midpoint triangle checks are not a continuous triangle time-of-impact proof.','Only retained-static versus retained-static pairs are excluded; added or replaced static valve parts are tested against every static body.','Within-one-rigid-body self-intersections and full solid containment are not tested.','Only declared rigid assembly pairs are exempted. Working pin/eye, finite die/slot and body/guide pairs remain in the screen.','Inside motion, Gresley coupling, steam ports, lap/lead, admission, forces, elasticity, manufacture and historical A4 timing remain unverified.']};
}
