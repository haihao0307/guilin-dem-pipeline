/**
 * Read-only audit of the frozen R02 collision evidence. This script writes only
 * this experiment's docs/R02_SIX_COLLISION_WITNESSES.json, never the R02 tree.
 * Run from any cwd: node /path/to/tests/audit-r02-witnesses.mjs
 * This is reproducible baseline evidence, not a new mechanism or geometry fix.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {buildLocomotiveMechanics} from '../../student-native-r01/src/locomotive-mechanics.mjs';
import {buildDrivingWheel} from '../../student-native-r01/src/driving-wheel.mjs';
import {correctA6Mechanics} from '../../a6-native-r02/src/a6-motion-corrections.mjs';
import {createA6MotionModel,evaluateA6Motion,transformA6Point,inspectA6MeshSurfacePair} from '../../a6-native-r02/src/a6-motion.mjs';

const experimentRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const projectRoot=path.dirname(experimentRoot),r02Root=path.join(projectRoot,'a6-native-r02');
const reportPath=path.join(experimentRoot,'docs/R02_SIX_COLLISION_WITNESSES.json');
const sourcePath=path.join(projectRoot,'student-native-r01/src/locomotive-mechanics.mjs');
const sha256=value=>createHash('sha256').update(value).digest('hex');
function canonical(value){
  if(ArrayBuffer.isView(value))return Array.from(value);
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));
  return value;
}
const objectHash=value=>sha256(JSON.stringify(canonical(value)));
function fileManifest(root){
  const result={};
  function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const file=path.join(dir,item.name);
    if(item.isDirectory())walk(file);
    else if(item.isFile())result[path.relative(root,file).split(path.sep).join('/')]={sha256:sha256(fs.readFileSync(file)),bytes:fs.statSync(file).size};
    else throw Error(`Unexpected non-regular frozen entry: ${file}`);
  }}
  walk(root);return result;
}
function componentHashes(parts){return Object.fromEntries(parts.map(p=>[p.name,{
  sha256:objectHash(p),vertexCount:p.positions.length/3,triangleCount:p.indices.length/3,
}]).sort(([a],[b])=>a.localeCompare(b)));}
function worldMesh(part,matrix){
  if(!matrix)return {...part,positions:Array.from(part.positions)};
  const positions=[];
  for(let i=0;i<part.positions.length;i+=3)positions.push(...transformA6Point(matrix,Array.from(part.positions.slice(i,i+3))));
  return {...part,positions};
}
function triangle(mesh,id){
  assert(Number.isInteger(id)&&id>=0&&3*id+2<mesh.indices.length);
  const vertexIndices=Array.from(mesh.indices.slice(3*id,3*id+3));
  return {triangleId:id,vertexIndices,verticesM:vertexIndices.map(i=>Array.from(mesh.positions.slice(3*i,3*i+3)))};
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const distance=(a,b)=>Math.hypot(...sub(a,b));
const epsilonM=1e-9;
/** Independent geometric check: segment/plane intersections plus barycentric
 * containment, not the R02 SAT or its BVH. Coplanar edges use a 2D projection. */
function trianglePointCheck(point,t){
  const u=sub(t[1],t[0]),v=sub(t[2],t[0]),w=sub(point,t[0]),n=cross(u,v),nn=Math.hypot(...n);
  assert(nn>1e-14,'Degenerate triangle is not a valid audit witness');
  const uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),uw=dot(u,w),vw=dot(v,w),den=uu*vv-uv*uv;
  const b=(vv*uw-uv*vw)/den,c=(uu*vw-uv*uw)/den,barycentric=[1-b-c,b,c];
  const planeDistanceM=Math.abs(dot(w,n))/nn;
  return {inside:planeDistanceM<=epsilonM&&barycentric.every(x=>x>=-epsilonM&&x<=1+epsilonM),barycentric,planeDistanceM};
}
function segmentTriangleHits(a,b,t){
  const n=cross(sub(t[1],t[0]),sub(t[2],t[0])),nn=Math.hypot(...n);
  const da=dot(sub(a,t[0]),n)/nn,db=dot(sub(b,t[0]),n)/nn;
  const hits=[];
  const addIfInside=(p,edgeParameter)=>{if(trianglePointCheck(p,t).inside)hits.push({pointM:p,edgeParameter});};
  if(Math.abs(da)<=epsilonM)addIfInside(a,0);
  if(Math.abs(db)<=epsilonM)addIfInside(b,1);
  if((da>epsilonM&&db>epsilonM)||(da<-epsilonM&&db<-epsilonM))return hits;
  if(Math.abs(da-db)>1e-14){
    const s=da/(da-db);if(s>=-epsilonM&&s<=1+epsilonM)addIfInside(add(a,mul(sub(b,a),s)),s);
  }else if(Math.abs(da)<=epsilonM&&Math.abs(db)<=epsilonM){
    const drop=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
    const project=p=>p.filter((_,i)=>i!==drop),cross2=(u,v)=>u[0]*v[1]-u[1]*v[0];
    const pa=project(a),r=sub(project(b),pa);
    for(let i=0;i<3;i++){
      const q=project(t[i]),s=sub(project(t[(i+1)%3]),q),den=cross2(r,s);
      if(Math.abs(den)<1e-14)continue;
      const parameter=cross2(sub(q,pa),s)/den,other=cross2(sub(q,pa),r)/den;
      if(parameter>=-epsilonM&&parameter<=1+epsilonM&&other>=-epsilonM&&other<=1+epsilonM)addIfInside(add(a,mul(sub(b,a),parameter)),parameter);
    }
  }
  return hits;
}
function independentIntersection(a,b){
  const hits=[];
  for(const [label,edges,target]of [['A',a,b],['B',b,a]])for(let edge=0;edge<3;edge++){
    for(const hit of segmentTriangleHits(edges[edge],edges[(edge+1)%3],target)){
      const checkA=trianglePointCheck(hit.pointM,a),checkB=trianglePointCheck(hit.pointM,b);
      if(checkA.inside&&checkB.inside&&!hits.some(h=>distance(h.pointM,hit.pointM)<1e-11))hits.push({...hit,fromTriangle:label,edgeIndex:edge,checkA,checkB});
    }
  }
  return {method:'Independent segment-plane intersections and barycentric containment, with coplanar 2D edge fallback; does not call trianglesIntersectA6',epsilonM,intersects:hits.length>0,intersectionPoints:hits};
}

const auditTriangle=[[0,0,0],[1,0,0],[0,1,0]];
assert(independentIntersection(auditTriangle,[[.2,.2,-1],[.2,.2,1],[.7,.2,0]]).intersects,'Independent test must find a noncoplanar intersection');
assert(independentIntersection(auditTriangle,[[.1,.1,0],[.2,.1,0],[.1,.2,0]]).intersects,'Independent test must find a coplanar contained triangle');
assert(!independentIntersection(auditTriangle,[[2,0,0],[3,0,0],[2,1,0]]).intersects,'Independent test must reject coplanar disjoint triangles');
const frozenFilesBefore=fileManifest(r02Root);
const originalReport=JSON.parse(fs.readFileSync(path.join(r02Root,'docs/MOTION_CORRECTED_SWEEP.json'),'utf8'));
const recorded=originalReport.sweep.candidates.filter(c=>c.sampledSurfaceWitness);
assert.equal(recorded.length,6,'The frozen report must still contain six sampled witnesses');
for(const [file,expected]of Object.entries(originalReport.sourceHashes))assert.equal(frozenFilesBefore[file].sha256,expected,`Frozen report source hash mismatch: ${file}`);
const source=buildLocomotiveMechanics(),sourceHashesBefore=componentHashes(source.parts);
const corrected=correctA6Mechanics(source),wheel=buildDrivingWheel();
const correctedHashesBefore=componentHashes(corrected.mechanics.parts),wheelHashesBefore=componentHashes(wheel.parts);
const originalNames=source.parts.map(p=>p.name).sort(),correctedNames=corrected.mechanics.parts.map(p=>p.name).sort();
assert.equal(originalNames.length,338);assert.equal(new Set(originalNames).size,338);
assert.deepEqual(correctedNames,originalNames,'All 338 original names must be retained exactly');
const model=createA6MotionModel({mechanics:corrected.mechanics,wheel});
const byName=new Map(corrected.mechanics.parts.map(p=>[p.name,p]));
const witnesses=recorded.map((entry,index)=>{
  const original=entry.sampledSurfaceWitness;
  assert.equal(original.phaseDegrees,.5);
  const pose=evaluateA6Motion(model,original.phaseDegrees*Math.PI/180);
  const originals=entry.pair.map(name=>{assert(byName.has(name));return byName.get(name);});
  const meshes=originals.map(p=>worldMesh(p,pose.partTransforms[p.name]));
  const recomputed=inspectA6MeshSurfacePair(meshes[0],meshes[1]);
  assert.deepEqual(recomputed.surfaceWitness,{triangleA:original.triangleA,triangleB:original.triangleB});
  const triangles=meshes.map((p,k)=>triangle(p,k?original.triangleB:original.triangleA));
  const independent=independentIntersection(triangles[0].verticesM,triangles[1].verticesM);
  assert(independent.intersects,`Independent coordinate witness missing: ${entry.pair.join(' / ')}`);
  return {id:index+1,pair:entry.pair,requestedPhaseDegrees:original.phaseDegrees,evaluatedPhaseDegrees:pose.phaseDegrees,originalRecordedWitness:original,
    recomputedMeshInspection:recomputed,originalTriangleIdsMatch:true,involvesUnsupportedReference:entry.involvesUnsupportedReference,
    parts:originals.map((p,k)=>({name:p.name,sourceComponentSHA256:sourceHashesBefore[p.name].sha256,correctedComponentSHA256:correctedHashesBefore[p.name].sha256,
      transformedComponentSHA256:objectHash(meshes[k]),transformColumnMajor:pose.partTransforms[p.name]??[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
      motionStatus:pose.partTransforms[p.name]?'R02 supported rigid body at the requested phase':'Frozen static reference; no actuator transform',
      correctedReferenceTriangle:triangle(p,k?original.triangleB:original.triangleA),transformedTriangle:triangles[k]})),
    independentlyRecomputedCoordinateWitness:independent};
});

// Source-derived original eccentric fourbar reach. These are the original static
// coordinates, not the experiment's newly chosen candidate dimensions.
const p=source.parameters,O=[p.driveDiameter/2,p.axisZ[3]],Q=[1.58,3.55];
const E0=[p.driveDiameter/2+p.crankRadius+.22,p.axisZ[3]-.20],T0=[1.31,3.51];
for(const [actual,expected]of [[O,[1.016,5.7912]],[Q,[1.58,3.55]],[E0,[1.5662,5.5912]],[T0,[1.31,3.51]]])assert(distance(actual,expected)<1e-14);
const d=distance(O,Q),e=distance(O,E0),rodLength=distance(E0,T0),rockerRadius=distance(Q,T0),maxRequired=d+e,maxAvailable=rodLength+rockerRadius;
assert(maxRequired>maxAvailable);
const TAU=2*Math.PI,referenceAngle=Math.atan2(E0[1]-O[1],E0[0]-O[0]);
const maximumPhaseRad=((Math.atan2(O[1]-Q[1],O[0]-Q[0])-referenceAngle)%TAU+TAU)%TAU;
const Emax=add(O,mul(sub(O,Q),e/d));
assert(Math.abs(distance(Q,Emax)-maxRequired)<1e-14);
const sourceText=fs.readFileSync(sourcePath,'utf8'),sourceLines=sourceText.split('\n');
function evidence(fragment){const index=sourceLines.findIndex(line=>line.includes(fragment));assert(index>=0,`Missing source evidence: ${fragment}`);return {file:'student-native-r01/src/locomotive-mechanics.mjs',line:index+1,text:sourceLines[index].trim()};}
const frozenFilesAfter=fileManifest(r02Root);
assert.deepEqual(frozenFilesAfter,frozenFilesBefore,'Frozen R02 files changed during the audit');
assert.deepEqual(componentHashes(source.parts),sourceHashesBefore,'Original component buffers changed');
assert.deepEqual(componentHashes(corrected.mechanics.parts),correctedHashesBefore,'Corrected component buffers changed during motion evaluation');
assert.deepEqual(componentHashes(wheel.parts),wheelHashesBefore,'Wheel buffers changed during motion evaluation');
const buildDependencyFiles=['student-native-r01/src/locomotive-mechanics.mjs','student-native-r01/src/driving-wheel.mjs','student-native-r01/src/dimensions.mjs','student-native-r01/src/surface-builder.mjs','a6-native-r02/src/a6-motion-corrections.mjs','a6-native-r02/src/a6-motion.mjs','a6-native-r02/src/a6-geometry.mjs'];
const artifact={schema:'a6-r02-six-collision-witnesses/1',status:'reproduced-frozen-baseline-not-a-fix',units:'m',coordinateSystem:'[x lateral, y height above rail, z rearwards]; all full binary64 values are serialized without decimal rounding',
  auditScript:'tests/audit-r02-witnesses.mjs',auditScriptSHA256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  frozenReport:'a6-native-r02/docs/MOTION_CORRECTED_SWEEP.json',frozenR02Unchanged:true,frozenR02FileCount:Object.keys(frozenFilesBefore).length,
  frozenR02FilesSHA256:frozenFilesBefore,frozenR02ManifestSHA256:objectHash(frozenFilesBefore),
  reportSourceHashesMatched:true,buildDependencyFilesSHA256:Object.fromEntries(buildDependencyFiles.map(f=>[f,sha256(fs.readFileSync(path.join(projectRoot,f)))])),
  componentRetention:{sourceCount:338,correctedCount:338,uniqueOriginalNames:338,allNamesRetained:true,missingNames:[],addedNames:[],originalNames,
    originalBuffersUnchanged:true,correctedBuffersUnchangedDuringAudit:true,supplementalMotionModelParts:model.supplementalParts.map(p=>p.name),
    note:'The four explicitly added piston extensions/heads are model supplements and do not replace or remove any of the original 338 component names.'},
  componentHashConvention:'SHA-256 of UTF-8 JSON with recursively sorted object keys and typed arrays converted to numeric arrays; each complete component object is included, not only its name',
  originalComponentHashes:sourceHashesBefore,correctedComponentHashes:correctedHashesBefore,wheelComponentHashes:wheelHashesBefore,
  witnessCount:witnesses.length,allRecordedTriangleIdsMatch:true,allIndependentCoordinateWitnessesPass:true,independentCheckSmokeTests:{noncoplanarIntersection:true,coplanarContainment:true,coplanarSeparation:true},witnesses,
  originalEccentricFourbar:{status:'unreachable-through-full-revolution',coordinateSystem:'[y,z] in metres',O,Q,E0,T0,
    definitions:{d:'distance O–Q, between fixed driver centre and expansion-link trunnion',e:'distance O–E0, eccentric pitch radius about the driver centre',rodLength:'distance E0–T0, fixed eccentric rod length',rockerRadius:'distance Q–T0, fixed expansion-link tail radius'},
    dM:d,eM:e,eccentricRodLengthM:rodLength,rockerRadiusM:rockerRadius,requiredQEDistanceRangeM:[Math.abs(d-e),maxRequired],
    achievableQEDistanceRangeM:[Math.abs(rodLength-rockerRadius),maxAvailable],maximumRequiredDistanceM:maxRequired,maximumAvailableDistanceM:maxAvailable,
    maximumReachDeficitM:maxRequired-maxAvailable,maximumReachPhaseDegrees:maximumPhaseRad*180/Math.PI,eccentricPointAtMaximumReachM:Emax,
    inequality:'d + e > eccentric rod length + rocker radius',maximumReachPass:false,
    minimumReachDeficitM:Math.abs(rodLength-rockerRadius)-Math.abs(d-e),
    reasoning:'For a wheel-fixed return crank completing 360 degrees, E travels a circle about O. The largest Q–E separation is exactly d+e. Two circles centred at E and Q with radii rodLength and rockerRadius cannot meet if their centre distance exceeds their radius sum. This is an analytic impossibility proof for the original dimensions, independent of triangle collision sampling.',
    sourceEvidence:[evidence('const eccentric='),evidence('make(`eccentric-rod-'),evidence('pin(`expansion-link-trunnion-')]},
  sourceTopologyGaps:[
    {id:'missing-distinct-third-combination-lever-pin',status:'confirmed-in-original-source',
      finding:'The combination lever is one two-eye eyeLink between combBottom and combTop. The radius rod terminates at combTop and the valve-rod crosshead attachment uses that same [1.94, crossheadZ-.23] location. No separate third valve-output pin or three-pin lever arms are defined.',
      combinationBottomYZM:[1.14,p.crossheadZ-.18],combinationTopYZM:[1.94,p.crossheadZ-.23],valveAttachmentYZM:[1.94,p.crossheadZ-.23],
      sourceEvidence:[evidence('function eyeLink('),evidence('for(const c of[a,b])annulus'),evidence('make(`radius-rod-'),evidence('make(`combination-lever-'),evidence('make(`valve-rod-crosshead-')]},
    {id:'missing-radius-rod-support-slot-and-die',status:'confirmed-in-original-source',
      finding:'The radius rod is a two-eye link from slider to combTop, with no rear support slot or sliding die definition. The reverser lifting link shares slider and joins [2.10,3.75] directly. The curved expansion-link slot geometry exists, but its existence does not supply a working die-block constraint or an independent radius-rod support slot.',
      sourceEvidence:[evidence('make(`radius-rod-'),evidence('make(`reverser-lifting-link-'),evidence('make(`slotted-expansion-link-'),evidence("missing:['reversing shaft, lifting arm geometry and die-block working fit'")]}
  ],
  limits:['This audit changes no R02 source, mesh, preview, or release file.','A triangle surface intersection is a contact/intersection witness, not penetration depth or a force/failure calculation.','Only the six already recorded 0.5-degree witnesses are reproduced here; this is not a new continuous sweep or a no-collision proof.','Static reference valve parts remain unactuated in the frozen R02 model.','The original eccentric-loop reach contradiction and missing topology are recorded as baseline defects; no new geometry or mechanism repair is asserted.']};
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(artifact,null,2)+'\n');
// Read back the sole generated output and verify key assertions after saving.
const saved=JSON.parse(fs.readFileSync(reportPath,'utf8'));
assert.equal(saved.witnessCount,6);assert(saved.frozenR02Unchanged&&saved.componentRetention.allNamesRetained);
assert(saved.witnesses.every(w=>w.originalTriangleIdsMatch&&w.independentlyRecomputedCoordinateWitness.intersects));
assert.deepEqual(fileManifest(r02Root),frozenFilesBefore);
console.log(JSON.stringify({status:'PASS: frozen R02 baseline reproduced',artifact:path.relative(projectRoot,reportPath),witnesses:6,recordedTriangleIdsMatched:6,independentCoordinateWitnesses:6,originalNamesRetained:338,frozenR02FilesUnchanged:Object.keys(frozenFilesBefore).length,maximumRequiredQEDistanceM:maxRequired,eccentricRodPlusRockerM:maxAvailable,reachDeficitM:maxRequired-maxAvailable,sourceTopologyGaps:artifact.sourceTopologyGaps.map(g=>g.id)},null,2));
