/** Native body/CSR surface check for the specific bottle/window overlap found
 * in real 29b3 Chromium frames. It does not replace full R07 GPU verification. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {LifeWorld,DIM} from '../LifeWorld.mjs';
process.env.NPC_NATIVE_FIXTURE_ONLY='1';
const {actors,source,qa,sourceHashes,geometrySourceHashes}=await import('./native-frame-recovery.mjs');
const mode=process.argv[2]||'poses',dt=1/120,startedAt=new Date().toISOString();
let scenarios=[{id:'A',side:'L'},{id:'B',side:'L'},{id:'C',side:'L'},{id:'A',side:'L',pair:true},{id:'B',side:'R',pair:true}];
if(process.env.NPC_CROSS_CASES)scenarios=scenarios.filter(s=>process.env.NPC_CROSS_CASES.split(',').includes(s.id+'-'+(s.pair?'pair':'single')));
const xyz=p=>[p.x,p.y,p.z],mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),ease=t=>t*t*t*(10+t*(-15+6*t));
const metadata=()=>({rigBaselineHead:source.sourceHead,startedAt,completedAt:new Date().toISOString(),sourceHashes,geometrySourceHashes,
  scope:'Exact production native Actor/104-bone/CSR body-surface math and actual scene collision descriptors. Full R07 head/material/GPU visibility remains separate.'});
function prepare(scenario){
  for(const [i,a] of actors.entries()){a.rest();a.setSide('L');a.root.position.set(1.5+i*.6,a.floorOffset,-.13);}
  const a=actors.find(a=>a.id===scenario.id);a.setSide(scenario.side);
  a.root.position.set(scenario.pair?(a.id==='A'?-.31:.38):-.12,a.floorOffset,scenario.pair?(a.id==='A'?.08:.05):{A:.10,B:.05,C:.08}[a.id]);
  return {actor:a,world:new LifeWorld(actors)};
}
function geometry(world,bottle=world.bottle){return {tableTopY:DIM.tableTop,
  tableBounds:{minX:DIM.tableCentre[0]-DIM.tableHalf[0],maxX:DIM.tableCentre[0]+DIM.tableHalf[0],minZ:DIM.tableCentre[2]-DIM.tableHalf[2],maxZ:DIM.tableCentre[2]+DIM.tableHalf[2]},
  bottle:{position:bottle.position,quaternion:bottle.quaternion,radius:DIM.radius,height:DIM.height},
  solidBoxes:world.window.solidBoxes(),solidCylinders:[world.window.handleCylinder()]};}
const metrics=()=>({samples:0,maxBoneErrorM:0,maxFootJointErrorM:0,maxOtherSolidPenetrationM:0,maxOperatedCylinderPenetrationM:0,
  minHandleSignedDistanceM:Infinity,minTableSignedDistanceM:Infinity,minReachMarginM:Infinity,clampedSamples:0,maxPalmErrorM:0,worstReach:null,worstOther:null,worstOperated:null,maxOperatedDuringHoldM:0,maxOperatedWithoutHoldM:0,stages:{}});
function record(r,d,stage,time,state=null){
  assert(d.finite);assert(d.boneLengthErrorM<1e-8);assert(d.footJointErrorM<1e-8);
  const handle=d.solidByCylinder?.['window-handle-01'];assert(handle?.sampleCount>0,'The non-operated real handle must actually be sampled');
  assert(d.solidParts.hand.sampleCount>0&&d.solidParts.forearm.sampleCount>0,'Both full selected hand and forearm surfaces must be sampled');
  r.samples++;r.stages[stage]=(r.stages[stage]||0)+1;r.maxBoneErrorM=Math.max(r.maxBoneErrorM,d.boneLengthErrorM);r.maxFootJointErrorM=Math.max(r.maxFootJointErrorM,d.footJointErrorM);
  if(d.handErrorM>r.maxPalmErrorM){r.maxPalmErrorM=d.handErrorM;r.worstReach={stage,time,errorM:d.handErrorM,palm:d.palm,clamped:d.reachClamped};}if(d.reachClamped)r.clampedSamples++;
  if((d.bottleMaxPenetrationM||0)>r.maxOperatedCylinderPenetrationM){r.maxOperatedCylinderPenetrationM=d.bottleMaxPenetrationM;r.worstOperated={stage,time,penetrationM:d.bottleMaxPenetrationM,pointWorld:d.bottleDeepestPointWorld,vertex:d.bottleDeepestVertex,palm:d.palm,state};}
  if(state?.heldBy)r.maxOperatedDuringHoldM=Math.max(r.maxOperatedDuringHoldM,d.bottleMaxPenetrationM||0);else r.maxOperatedWithoutHoldM=Math.max(r.maxOperatedWithoutHoldM,d.bottleMaxPenetrationM||0);
  r.minHandleSignedDistanceM=Math.min(r.minHandleSignedDistanceM,handle.minimumSignedDistanceM);
  if(d.solidByBox['table-top'])r.minTableSignedDistanceM=Math.min(r.minTableSignedDistanceM,d.solidByBox['table-top'].minimumSignedDistanceM);
  if(d.solidMaxPenetrationM>r.maxOtherSolidPenetrationM){r.maxOtherSolidPenetrationM=d.solidMaxPenetrationM;r.worstOther={stage,time,...d.solidDeepest,penetrationM:d.solidMaxPenetrationM,palm:d.palm};}
}
function posePath(scenario,region){
  const {actor,world}=prepare(scenario),dest=(region==='alternate'?DIM.alternateTarget:DIM.target).slice(),r={scenario,region,target:dest,...metrics()},source=DIM.source.slice(),anchor=p=>[p[0],p[1]+DIM.gripHeight,p[2]-DIM.radius];
  const up=p=>[p[0],p[1]+.14,p[2]],lower=[dest[0],dest[1]+.004,dest[2]];
  const segments=[['close',source,source,0,1],['lift',source,up(source),1,1],['transfer',up(source),up(dest),1,1],['lower',up(dest),lower,1,1],['release',lower,lower,1,0]];
  let time=0;
  for(const [stage,from,to,g0,g1] of segments)for(let k=0;k<=24;k++){
    const t=k/24,center=mix(from,to,ease(t)),goal=anchor(center),reach=actor.reachability(goal,scenario.side);r.minReachMarginM=Math.min(r.minReachMarginM,reach.maxM-reach.distanceM);actor.setReach(goal,g0+(g1-g0)*t,scenario.side);
    record(r,actor.diagnostics(geometry(world,{position:center,quaternion:[0,0,0,1]})),stage,time);time+=dt;
  }
  const from=actor.handAnchor().toArray();world.table.updateAABB();const to=[from[0],from[1]+DIM.bottleWithdrawLiftM,Math.min(from[2]-DIM.bottleWithdrawMinimumM,world.table.aabb.lowerBound.z-DIM.bottleWithdrawTableMarginM)];
  for(let k=1;k<=108;k++){const goal=mix(from,to,ease(k/108)),reach=actor.reachability(goal,scenario.side);r.minReachMarginM=Math.min(r.minReachMarginM,reach.maxM-reach.distanceM);actor.setReach(goal,0,scenario.side);record(r,actor.diagnostics(geometry(world,{position:lower,quaternion:[0,0,0,1]})),'withdraw',time);time+=dt;}
  actor.beginRest({duration:.65});while(actor.hasRecovery()){actor.updateRecovery(dt);record(r,actor.diagnostics(geometry(world,{position:lower,quaternion:[0,0,0,1]})),'rest',time);time+=dt;}
  r.finalRestPoseErrorRad=actor.diagnostics().restPoseErrorRad;r.passed=r.maxOtherSolidPenetrationM<=.003&&r.maxOperatedCylinderPenetrationM<=.005&&r.clampedSamples===0&&r.finalRestPoseErrorRad<1e-5;
  console.log('POSE '+JSON.stringify(r));return r;
}
function livePath(scenario,region,event='release'){
  const {actor,world}=prepare(scenario),a=world.agents.get(actor.id);
  if(region==='alternate')world.moveTarget();
  assert.deepEqual(world.target,region==='alternate'?DIM.alternateTarget:DIM.target,'Both regions are selected through the real production task API');
  const r={scenario,region,target:world.target.slice(),event,taskInputOverride:false,...metrics()},phaseSamples={};
  assert(world.request(actor.id,'native-cross-object-clearance'));
  for(let step=0;step<3600;step++){
    world.tick(dt);
    if(event==='cancel'&&!r.cancel&&a.phase==='lift'&&a.phaseTime>=.75&&world.heldBy===actor.id){world.cancel(actor.id);r.cancel={time:world.time,palm:world.hand(a)};}
    const stage=a.retraction?.stage||a.phase;
    if(!['idle','waiting'].includes(stage)){
      const d=actor.diagnostics(geometry(world)),state={phase:a.phase,heldBy:world.heldBy,reservedBy:world.reservedBy,grip01:a.gripValue,bottlePosition:xyz(world.bottle.position),bottleQuaternion:world.bottle.quaternion.toArray(),bottleVelocity:xyz(world.bottle.velocity),requestedPalm:a.handTarget};
      if(d.bottleMaxPenetrationM>.005&&!r.firstOperatedOver5mm){r.firstOperatedOver5mm={stage,time:world.time,penetrationM:d.bottleMaxPenetrationM,pointWorld:d.bottleDeepestPointWorld,vertex:d.bottleDeepestVertex,palm:d.palm,state};console.log('OPERATED_FIRST_OVER_5MM '+JSON.stringify({scenario,region,...r.firstOperatedOver5mm}));}
      // The existing approach orientation may initially request beyond the
      // arm's limit while still clear of props. Preserve that known distinction.
      if(stage==='approach'){phaseSamples.approach??=metrics();record(phaseSamples.approach,d,stage,world.time,state);}
      else{record(r,d,stage,world.time,state);if(a.handTarget&&!actor.hasRecovery()&&!['rest','done','failed','cancelled'].includes(stage)){const reach=actor.reachability(a.handTarget,scenario.side);r.minReachMarginM=Math.min(r.minReachMarginM,reach.maxM-reach.distanceM);}}
    }
    if(['done','failed','cancelled'].includes(a.phase)&&!a.retraction&&!actor.hasRecovery())break;
  }
  r.result=a.result;r.finalPhase=a.phase;r.phaseSamples=phaseSamples;r.finalRestPoseErrorRad=actor.diagnostics().restPoseErrorRad;
  r.metricsScope='Main metrics exclude initial approach, whose full measured data and solid gate are included separately in phaseSamples.approach.';
  r.finalWorld={heldBy:world.heldBy,reservedBy:world.reservedBy,gripCount:world.gripConstraintCount(),goal:world.goal(),bottle:xyz(world.bottle.position)};
  r.passed=r.maxOtherSolidPenetrationM<=.003&&r.maxOperatedCylinderPenetrationM<=.005&&r.clampedSamples===0&&r.finalRestPoseErrorRad<1e-5&&
    !world.heldBy&&!world.reservedBy&&!world.grip&&(event==='cancel'?!!r.cancel:a.result?.result==='completed')&&
    (!phaseSamples.approach||phaseSamples.approach.maxOtherSolidPenetrationM<=.003);
  r.failedChecks=[];if(r.maxOtherSolidPenetrationM>.003)r.failedChecks.push('other-solid-after-approach');if(r.maxOperatedCylinderPenetrationM>.005)r.failedChecks.push('operated-cylinder-any-task-sample');if(phaseSamples.approach?.maxOtherSolidPenetrationM>.003)r.failedChecks.push('approach-other-solid');if(r.clampedSamples)r.failedChecks.push('reach-after-approach');
  console.log('LIVE '+JSON.stringify(r));return r;
}
const equivalence=[];
for(const actor of actors){actor.setReach(DIM.source.map((v,i)=>v+(i===2?-DIM.radius:0)),1);for(const quaternion of [[0,0,0,1],[Math.SQRT1_2,0,0,Math.SQRT1_2],[0,0,Math.sin(.31),Math.cos(.31)]]){
  const shape={id:'same-finite-cylinder',position:DIM.source,quaternion,radius:DIM.radius,height:DIM.height},d=actor.diagnostics({bottle:shape,solidCylinders:[shape]});
  assert.equal(d.solidParts.hand.minimumSignedDistanceM,d.bottleMinimumSignedDistanceM,'Extra oriented cylinder hand SDF equals the retained operated-cylinder SDF, including caps');
  assert(d.solidParts.forearm.sampleCount>0);equivalence.push({actor:actor.id,quaternion,handSamples:d.solidParts.hand.sampleCount,forearmSamples:d.solidParts.forearm.sampleCount,maximumDistanceDifferenceM:0});
}}
const results=[];
if(mode==='poses')for(const scenario of scenarios)for(const region of ['primary','alternate'])results.push(posePath(scenario,region));
else for(const scenario of scenarios){for(const region of ['primary','alternate'])results.push(livePath(scenario,region,'release'));if(process.env.NPC_CROSS_RELEASE_ONLY!=='1')results.push(livePath(scenario,'primary','cancel'));}
const report={schema:'npc-native-cross-object-clearance/1',...metadata(),mode,passed:results.every(r=>r.passed),productionPassed:mode==='production'?results.every(r=>r.passed):null,
  operatedObjectId:'bottle-01',otherCylinderId:'window-handle-01',tolerances:{otherSolidsM:.003,operatedCylinderM:.005,boneAndFootJointM:1e-8},equivalence,results,
  limits:mode==='poses'?'Authored candidate contact/transfer/release poses using production Actor math and actual closed scene descriptors. It is not physical task completion.':'Actual production LifeWorld/Cannon simulation; new candidate task region is explicitly marked if overridden. Original native skin math; full mesh/material/GPU must still be verified in Chromium.'};
const suffix=process.env.NPC_CROSS_REPORT_SUFFIX||'';assert(!suffix||/^[a-z0-9-]+$/.test(suffix));
fs.writeFileSync(path.join(qa,'native-cross-object-'+mode+(suffix?'-'+suffix:'')+'.json'),JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify({mode,passed:report.passed,productionPassed:report.productionPassed,cases:results.length}));
