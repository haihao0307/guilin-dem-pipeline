/** Internal numerical fixture. Runs the production Actor/Binding/Rig functions
 * on the accepted R07 native body triangles and every original CSR influence.
 * It is never imported by the workbench and does not render a substitute human.
 * Final full-head/material/GPU and rigid-world acceptance remains Chromium QA.
 * Usage: node qa/native-frame-recovery.mjs [baseline-artifact-directory]
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {unpack} from '../../human-integrated-r06/DataPack.mjs';
import {NativeRig,math} from '../NativeRig.mjs';
import {WINDOW_DIM} from '../WindowInteraction.mjs';
import {DIM} from '../LifeWorld.mjs';

const qa=path.dirname(fileURLToPath(import.meta.url)),here=path.resolve(qa,'..'),project=path.resolve(here,'..');
const startedAt=new Date().toISOString();
const baseline=path.resolve(process.env.NPC_NATIVE_BASELINE||(process.env.NPC_NATIVE_FIXTURE_ONLY!=='1'?process.argv[2]:null)||path.join(here,'../../../ci/857-interaction'));
const read=file=>fs.readFileSync(file,'utf8'),json=file=>JSON.parse(read(file));
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sourceFiles=['ActorAdapter.mjs','NativeBinding.mjs','NativeRig.mjs'];
const sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,hash(path.join(here,file))]));
const geometrySourceHashes=Object.fromEntries(['WindowInteraction.mjs','LifeWorld.mjs'].map(file=>[file,hash(path.join(here,file))]));
const source=json(path.join(baseline,'native-rigs.json')),initial=json(path.join(baseline,'initial.json'));
const build=read(path.join(here,'build.cjs')),host=read(path.join(project,'human-integrated-r07/preview.html'));
const mapStart=build.indexOf('const nativeThree = '),mapEnd=build.indexOf('\n};',mapStart)+3;
assert(mapStart>=0&&mapEnd>mapStart,'Native Three export map is present');
const nativeThree=new Function(build.slice(mapStart,mapEnd)+';return nativeThree;')();
const core=[...host.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('Wd=We(()=>'))?.[1];
assert(core,'Exact R07 native Three initialization closure is present');
const end=core.indexOf('var Ke=We(()=>{Wd()});'),context={console};assert(end>0);
vm.runInNewContext(core.slice(0,end)+'Wd();globalThis.native={'+Object.entries(nativeThree).map(([k,v])=>k+':'+v).join(',')+'};})();',context,{timeout:10000});
const THREE=context.native;
const bindingSource=read(path.join(here,'NativeBinding.mjs')).replace(/^import .*;$/gm,'').replace('export {THREE};','').replaceAll('export class ','class ');
const {NativeBinding,RigidPoseSampler}=new Function('THREE',bindingSource+';return {NativeBinding,RigidPoseSampler};')(THREE);
const adapterSource=read(path.join(here,'ActorAdapter.mjs')).replace(/^import .*;$/gm,'').replace('export {THREE};','').replace('export async function createActors','async function createActors');
const window={portraitBank:{presets:()=>source.actors.map(a=>({id:a.identity.portraitId,name:a.identity.portraitName}))}};
const {makeActor}=new Function('THREE','NativeBinding','RigidPoseSampler','NativeRig','math','window',adapterSource+';return {makeActor};')(THREE,NativeBinding,RigidPoseSampler,NativeRig,math,window);

const manifest=json(path.join(project,'human-integrated-r06/StreamingManifest.json'));
const hot=manifest.files.find(f=>f.id==='hot');assert(hot);
// Read the explicitly accepted R01 cache for unchanged canonical topology;
// R02's runtime asset packaging is owned and verified by the build producer.
const canonicalAssets=path.join(project,'npc-life-observation-r01/vendor/assets');
const bytes=zlib.gunzipSync(Buffer.concat(hot.chunks.map(c=>fs.readFileSync(path.join(canonicalAssets,path.basename(c.url))))));
const {meta}=unpack(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
const scene=new THREE.Scene();

function makeNativeFixture(saved){
  const weights=saved.rig.weights,N=weights.ptr.length-1,positions=new Float32Array((N+2)*3);
  const rest=saved.rig.restPositionsPerInfluence;
  for(let i=0;i<N;i++)for(let c=0;c<3;c++){
    let sum=0;for(let k=weights.ptr[i];k<weights.ptr[i+1];k++)sum+=weights.values[k]*rest[k*3+c];positions[i*3+c]=sum;
  }
  // Unreferenced height sentinels preserve the original stature used by the
  // production hand selector. They are not hand/foot/face surface evidence.
  positions.set([0,0,saved.measurements.heightM-saved.measurements.floorOffsetM],N*3);
  positions.set([0,0,-saved.measurements.floorOffsetM],(N+1)*3);
  const faces=[];for(let k=0;k<meta.canonical.faces.length;k+=3){const f=meta.canonical.faces.slice(k,k+3);if(f.every(i=>i<N))faces.push(...f);}
  const displayed=new Float32Array(positions.length);
  for(let i=0;i<N+2;i++)displayed.set([positions[i*3],positions[i*3+2],-positions[i*3+1]],i*3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(displayed,3));
  geometry.setIndex(faces);geometry.computeVertexNormals();geometry.addGroup(0,faces.length,0);geometry.addGroup(faces.length,0,1);
  const head=saved.rig.names.indexOf('head'),materials=[new THREE.MeshStandardMaterial(),new THREE.MeshStandardMaterial()];
  const model={positions,vertexCount:N+2,bodyCount:N,faces,state:{owners:{rig:'anny'}},
    canonical:{headSkinIndices:[[head],[head]],headSkinWeights:[[1],[1]]},
    lastBodyDriver:{rig:{names:saved.rig.names,parents:saved.rig.parents,restMatrices:saved.rig.restMatrices},
      packet:{weights,restPositionsPerInfluence:new Float64Array(rest)}}};
  const mesh=new THREE.Mesh(geometry,materials),viewer={mesh,geometry,scene,renderer:null,
    surfaces:new Map([['native-body-test',{geometry,levels:[]}]]),currentOcular:{source:geometry,geometry,pairs:[]}};
  const actor=makeActor(model,viewer,{id:saved.id,label:saved.identity.label,portrait:saved.identity.portraitId,side:'L',x:-.12,z:{A:.10,B:.05,C:.08}[saved.id]},saved.identity,saved.measurements);
  const report=actor.configureGrasp({radius:.032,height:.14});assert(report.admissible,saved.id+' has admissible native hand fits');
  const accepted=initial.actorDiagnostics.find(a=>a.id===saved.id);
  for(const side of ['L','R']){
    const p=actor.contactReport.palms[side],reference=accepted.contactReport.palms[side];
    assert.equal(p.vertex,reference.vertex,'Native hand support selects the same accepted triangle vertex');
    assert(Math.hypot(...p.rest.map((v,i)=>v-reference.rest[i]))<1e-6,'Native body fixture matches the accepted palm surface');
  }
  assert.equal(actor.rig.count,104);assert.equal(actor.binding.report.weightsTruncated,false);
  return actor;
}

const actors=source.actors.map(makeNativeFixture);
const vector=p=>new THREE.Vector3(...p),quaternion=t=>new THREE.Quaternion().setFromAxisAngle(vector([0,1,0]),t);
const rotate=(p,q)=>vector(p).applyQuaternion(q).toArray();
const add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const maxMatrixDifference=(a,b)=>Math.max(...a.flatMap((m,j)=>Array.from(m,(v,k)=>Math.abs(v-b[j][k]))));
const poseCopy=actor=>actor.rig.skinMatrices.map(m=>Array.from(m));
export {actors,source,initial,THREE,NativeBinding,RigidPoseSampler,NativeRig,math,makeNativeFixture,geometryAt,actualGeometryAt,withdrawalFor,vector,rotate,add,scale,distance,poseCopy,qa,here,project,startedAt,sourceHashes,geometrySourceHashes,hash,WINDOW_DIM,DIM};
const withdrawalDistanceM=WINDOW_DIM.withdrawNormalDistanceM,withdrawalUpM=WINDOW_DIM.withdrawVerticalOffsetM;
const rows=[],recoveries=[];
let maxBoneErrorM=0,maxFootJointErrorM=0,maxFootErrorM=0,maxFootWorldYM=0;
function geometryCheck(actor,d){
  assert(d.finite);assert(d.boneLengthErrorM<1e-8,actor.id+' fixed bone lengths: '+d.boneLengthErrorM);
  assert(d.footJointErrorM<1e-8,actor.id+' exact native foot joints: '+d.footJointErrorM);
  assert(d.footSurfaceErrorM<2e-5,actor.id+' planted native foot surface');
  assert(Math.max(...Object.values(d.footWorldYM).map(Math.abs))<.003,actor.id+' actual floor Y');
  maxBoneErrorM=Math.max(maxBoneErrorM,d.boneLengthErrorM);maxFootJointErrorM=Math.max(maxFootJointErrorM,d.footJointErrorM);maxFootErrorM=Math.max(maxFootErrorM,d.footSurfaceErrorM);
  maxFootWorldYM=Math.max(maxFootWorldYM,...Object.values(d.footWorldYM).map(Math.abs));
}
function geometryAt(t){
  const q=quaternion(t),pivot=[.64,1.20,.55],center=add(pivot,rotate([-.45,0,-.11],q));
  return {q,center,palm:rotate([0,0,1],q),bottle:{position:center,quaternion:q.toArray(),radius:.032,height:.14},
    solidBoxes:[{id:'specified-window-leaf',position:add(pivot,rotate([-.27,.2275,0],q)),quaternion:q.toArray(),halfExtents:[.27,.3525,.018]}]};
}
function actualGeometryAt(t){
  const q=quaternion(t),pivot=WINDOW_DIM.pivot,leafCenter=add(pivot,rotate(WINDOW_DIM.leafCentre.map((v,i)=>v-pivot[i]),q));
  const center=add(leafCenter,rotate(WINDOW_DIM.handleLocal,q));
  const solidBoxes=WINDOW_DIM.leafParts.filter(part=>part.kind==='box').map(part=>({id:part.id,
    position:add(leafCenter,rotate(part.position,q)),quaternion:q.clone().multiply(new THREE.Quaternion(...part.quaternion)).toArray(),halfExtents:part.halfExtents}));
  for(const part of [...WINDOW_DIM.staticParts,WINDOW_DIM.blocker])solidBoxes.push({id:part.id,position:part.position,quaternion:part.quaternion,halfExtents:part.halfExtents});
  solidBoxes.push({id:'table-top',position:DIM.tableCentre,quaternion:[0,0,0,1],halfExtents:DIM.tableHalf});
  return {q,center,palm:rotate([0,0,1],q),bottle:{position:center,quaternion:q.toArray(),radius:WINDOW_DIM.handleRadius,height:WINDOW_DIM.handleHeight},solidBoxes,
    tableTopY:DIM.tableTop,tableBounds:{minX:DIM.tableCentre[0]-DIM.tableHalf[0],maxX:DIM.tableCentre[0]+DIM.tableHalf[0],minZ:DIM.tableCentre[2]-DIM.tableHalf[2],maxZ:DIM.tableCentre[2]+DIM.tableHalf[2]}};
}
function withdrawalFor(from,frame,shape){
  assert(frame.palm[2]>0,'Fixed window station withdrawal needs a palm normal toward positive world Z');
  const rearZ=shape.tableBounds.minZ,safePalmZ=rearZ-WINDOW_DIM.withdrawTableMarginM;
  const distanceM=Math.max(WINDOW_DIM.withdrawNormalDistanceM,(from[2]-safePalmZ)/frame.palm[2]);
  return {distanceM,rearZ,safePalmZ,to:add(add(from,scale(frame.palm,-distanceM)),[0,WINDOW_DIM.withdrawVerticalOffsetM,0])};
}
function probe(actor,side,pair=false){
  actor.rest();actor.setSide(side);actor.root.position.set(pair ? .60 : -.12,actor.floorOffset,pair ? .05 : {A:.10,B:.05,C:.08}[actor.id]);
  const restingPalm=actor.handAnchor().toArray(),beforeOthers=actors.filter(a=>a!==actor).map(a=>({a,pose:poseCopy(a)}));
  const sourceRoot=actor.root.position.toArray();
  for(let deg=0;deg<=35;deg+=5){
    const shape=actualGeometryAt(-deg*Math.PI/180),frame={palm:shape.palm,forward:rotate([side==='L'?1:-1,0,0],shape.q)};
    const goal=add(shape.center,scale(shape.palm,-.032));
    const reach=actor.reachability(goal,side,frame);assert(reach.reachable,actor.id+' fixed native reach');
    for(const grip of [0,.25,.5,.75,1]){
      actor.setReach(goal,grip,side,frame);const d=actor.diagnostics(shape);geometryCheck(actor,d);
      assert(!d.reachClamped&&d.handErrorM<.00035,'Actual weighted native palm reaches the framed goal');
      assert(d.bottleMaxPenetrationM<.003,'Rotated native cylinder fit stays below 3mm penetration');
      assert(d.solidSampleCount>d.handSurfaceSampleCount&&d.solidParts.forearm.sampleCount>0,'Actual forearm surface participates');
      rows.push({actor:actor.id,side,pair,degrees:-deg,grip,handErrorM:d.handErrorM,reachMarginM:reach.maxM-reach.distanceM,
        bottlePenetrationM:d.bottleMaxPenetrationM,solidPenetrationM:d.solidMaxPenetrationM,solidDeepest:d.solidDeepest,
        handSamples:d.solidParts.hand.sampleCount,forearmSamples:d.solidParts.forearm.sampleCount,boneErrorM:d.boneLengthErrorM});
    }
  }
  // Default direction remains exactly the old bottle contract.
  const bottleGoal=[0,1.0908,.338];actor.setReach(bottleGoal,.7,side);const defaultPose=poseCopy(actor);
  actor.setReach(bottleGoal,.7,side,{palm:[0,0,1],forward:[side==='L'?1:-1,0,0]});
  assert(maxMatrixDifference(defaultPose,actor.rig.skinMatrices)<1e-12,'Omitted frame preserves the original direction');
  assert.throws(()=>actor.setReach(bottleGoal,0,side,{palm:[0,0,1],forward:[0,0,2]}),/parallel/);
  assert.throws(()=>actor.beginRest(),/Release/,'A closed hand cannot silently enter rest recovery');
  const shape=actualGeometryAt(-35*Math.PI/180),frame={palm:shape.palm,forward:rotate([side==='L'?1:-1,0,0],shape.q)};
  const start=add(shape.center,scale(shape.palm,-.032));actor.setReach(start,0,side,frame);
  const withdrawalPlan=withdrawalFor(start,frame,shape),withdrawal=withdrawalPlan.to;
  let maxWithdrawalSolidPenetrationM=0;
  for(let k=1;k<=108;k++){const t=k/108,ease=t*t*t*(10+t*(-15+6*t));actor.setReach(start.map((v,i)=>v+(withdrawal[i]-v)*ease),0,side,frame);const d=actor.diagnostics(shape);geometryCheck(actor,d);assert(!d.reachClamped);maxWithdrawalSolidPenetrationM=Math.max(maxWithdrawalSolidPenetrationM,d.solidMaxPenetrationM);}
  const before=poseCopy(actor),startError=actor.diagnostics().restPoseErrorRad;
  assert.equal(actor.beginRest({duration:.65}),false);assert.equal(actor.hasRecovery(),true);
  assert.equal(maxMatrixDifference(before,actor.rig.skinMatrices),0,'Beginning recovery does not jump to rest');
  let previous=startError,steps=0,maxRestSolidPenetrationM=0,deepestRestWitness=null,complete=false;
  while(!complete&&steps<90){
    complete=actor.updateRecovery(1/120);steps++;const d=actor.diagnostics(shape);geometryCheck(actor,d);
    assert(d.restPoseErrorRad<=previous+1e-5,'Recovery follows monotonically decreasing local rotation error');
    previous=d.restPoseErrorRad;
    if(d.solidMaxPenetrationM>maxRestSolidPenetrationM){maxRestSolidPenetrationM=d.solidMaxPenetrationM;deepestRestWitness={step:steps,timeS:steps/120,penetrationM:d.solidMaxPenetrationM,...d.solidDeepest,palm:d.palm};}
  }
  assert(complete&&!actor.hasRecovery());assert(previous<1e-5);assert.equal(actor.updateRecovery(0),true);
  assert(distance(actor.handAnchor().toArray(),restingPalm)<2e-6,'Hand returns to its own measured natural rest');
  assert.deepEqual(actor.root.position.toArray(),sourceRoot,'Recovery does not move or scale the character root');
  for(const {a,pose}of beforeOthers)assert.equal(maxMatrixDifference(pose,a.rig.skinMatrices),0,'Other native actors retain independent poses');
  recoveries.push({actor:actor.id,side,pair,steps,startErrorRad:startError,endErrorRad:previous,
    restPalmErrorM:distance(actor.handAnchor().toArray(),restingPalm),withdrawalPlan,maxWithdrawalSolidPenetrationM,maxRestSolidPenetrationM,deepestRestWitness,complete});
  // A small actual box centered on the true palm must be reported as an
  // intersection. This checks oriented-solid diagnostics cannot pass by zeros.
  const point=actor.handAnchor().toArray();const d=actor.diagnostics({solidBoxes:[{id:'diagnostic-negative-control',position:point,
    quaternion:quaternion(.43).toArray(),halfExtents:[.005,.005,.005]}]});
  assert(d.solidParts.hand.maxPenetrationM>.0049);assert.equal(d.solidDeepest.objectId,'diagnostic-negative-control');
}
if(process.env.NPC_NATIVE_FIXTURE_ONLY!=='1'){
for(const actor of actors)probe(actor,'L');
probe(actors.find(a=>a.id==='B'),'R',true);
const recoverySolidClearancePassed=recoveries.every(r=>r.maxRestSolidPenetrationM<=.003&&r.maxWithdrawalSolidPenetrationM<=.003);
const framedSolidClearancePassed=rows.every(r=>r.solidPenetrationM<=.003);
const report={schema:'npc-native-frame-recovery-qa/2',passed:recoverySolidClearancePassed&&framedSolidClearancePassed,rigBaselineHead:source.sourceHead,
  sourceUnderTest:{directory:'npc-life-observation-r02',sourceHashes,startedAt,completedAt:new Date().toISOString()},
  fixture:'Accepted R07 native body triangles, full 104-bone rig and all CSR influence rest points; unrendered height sentinels only',
  actualProductionFunctions:true,fullHeadAndGPUVerified:false,rigidWorldVerified:false,
  limits:'The current WINDOW_DIM real box parts, frame, stops, blocker and DIM table are geometrically checked at prescribed yaw samples; actual dynamic contacts, moving-leaf release and full R07 rendering still require current Chromium acceptance.',
  geometrySourceHashes,
  sourceActors:source.actors.map(a=>({id:a.id,heightM:a.measurements.heightM,bodyVertices:a.rig.weights.ptr.length-1,influences:a.rig.weights.values.length})),
  rotatedSamples:rows.length,maxHandErrorM:Math.max(...rows.map(r=>r.handErrorM)),
  maxBottlePenetrationM:Math.max(...rows.map(r=>r.bottlePenetrationM)),maxLeafPenetrationM:Math.max(...rows.map(r=>r.solidPenetrationM)),
  minReachMarginM:Math.min(...rows.map(r=>r.reachMarginM)),maxBoneErrorM,maxFootJointErrorM,maxFootErrorM,maxFootWorldYM,
  defaultFrameUnchanged:true,otherActorsRemainIndependent:true,solidNegativeControlPassed:true,
  recoverySolidClearancePassed,framedSolidClearancePassed,withdrawalDistanceM,withdrawalUpM,withdrawalTableMarginM:WINDOW_DIM.withdrawTableMarginM,recoverySolidLimitM:.003,recoveries,rows};
fs.writeFileSync(path.join(qa,'native-frame-recovery.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rows:undefined},null,2));
assert(framedSolidClearancePassed,'Framed reach surface must not intersect the specified window leaf by more than 3 mm');
assert(recoverySolidClearancePassed,'Recovery surface must not intersect the specified window leaf by more than 3 mm');
}
