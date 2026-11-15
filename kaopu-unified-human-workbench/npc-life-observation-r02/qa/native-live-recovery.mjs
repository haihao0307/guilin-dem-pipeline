/** Actual production LifeWorld + native body surface probe. No renderer,
 * substituted actor solver, kinematic prop override or success-state writes. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {LifeWorld,DIM} from '../LifeWorld.mjs';
process.env.NPC_NATIVE_FIXTURE_ONLY='1';
const {actors,source,qa,here,sourceHashes,geometrySourceHashes,WINDOW_DIM}=await import('./native-frame-recovery.mjs');
const dt=1/120,startedAt=new Date().toISOString(),arr=p=>[p.x,p.y,p.z];
const candidateTableMarginM=Number(process.env.NPC_BOTTLE_MARGIN_M||DIM.bottleWithdrawTableMarginM);
const metadata=()=>({rigBaselineHead:source.sourceHead,sourceUnderTest:{sourceHashes,geometrySourceHashes,startedAt,completedAt:new Date().toISOString()},
  source:'Production LifeWorld/Cannon simulation and actual native 104-bone body/CSR surface; full-head/material/GPU acceptance remains Chromium.'});
const metrics=()=>({samples:0,maxBoneErrorM:0,maxFootJointErrorM:0,maxFootSurfaceErrorM:0,maxSolidPenetrationM:0,maxCylinderPenetrationM:0,
  minHandTableClearanceM:Infinity,minForearmTableClearanceM:Infinity,minTableSignedDistanceM:Infinity,maxPalmErrorM:0,reachClamped:false,worstSolid:null,worstCylinder:null});
function record(r,d,stage,time){
  assert(d.finite);assert(d.boneLengthErrorM<1e-8);assert(Number.isFinite(d.footJointErrorM),'Full Actor diagnostics are required, not WindowInteraction\'s reduced audit projection');assert(d.footJointErrorM<1e-8);
  r.samples++;r.maxBoneErrorM=Math.max(r.maxBoneErrorM,d.boneLengthErrorM);r.maxFootJointErrorM=Math.max(r.maxFootJointErrorM,d.footJointErrorM);
  r.maxFootSurfaceErrorM=Math.max(r.maxFootSurfaceErrorM,d.footSurfaceErrorM);r.maxPalmErrorM=Math.max(r.maxPalmErrorM,d.handErrorM);r.reachClamped ||= d.reachClamped;
  if(d.handTableSampleCount)r.minHandTableClearanceM=Math.min(r.minHandTableClearanceM,d.handTableClearanceM);
  if(d.forearmTableSampleCount)r.minForearmTableClearanceM=Math.min(r.minForearmTableClearanceM,d.forearmTableClearanceM);
  const table=d.solidByBox?.['table-top']||d.solidByBox?.table;
  if(table)r.minTableSignedDistanceM=Math.min(r.minTableSignedDistanceM,table.minimumSignedDistanceM);
  if(d.solidMaxPenetrationM>r.maxSolidPenetrationM){r.maxSolidPenetrationM=d.solidMaxPenetrationM;r.worstSolid={stage,time,penetrationM:d.solidMaxPenetrationM,...d.solidDeepest,palm:d.palm};}
  if(d.bottleMaxPenetrationM>r.maxCylinderPenetrationM){r.maxCylinderPenetrationM=d.bottleMaxPenetrationM;r.worstCylinder={stage,time,penetrationM:d.bottleMaxPenetrationM,vertex:d.bottleDeepestVertex,point:d.bottleDeepestPointWorld,palm:d.palm};}
}
function prepare(scenario,window=false){
  for(const [i,a] of actors.entries()){a.rest();a.setSide('L');a.root.position.set(1.5+i*.6,a.floorOffset,-.13);}
  const actor=actors.find(a=>a.id===scenario.id),single={A:.10,B:.05,C:.08};
  actor.setSide(scenario.side);actor.root.position.set(scenario.pair?(scenario.id==='A'?-.31:.38):-.12,actor.floorOffset,scenario.pair?(scenario.id==='A'?.08:.05):single[actor.id]);
  if(window)actor.root.position.set(-.12,actor.floorOffset,.10);
  return {actor,world:new LifeWorld(actors)};
}
function tableGeometry(world){return {tableTopY:DIM.tableTop,tableBounds:{minX:DIM.tableCentre[0]-DIM.tableHalf[0],maxX:DIM.tableCentre[0]+DIM.tableHalf[0],minZ:DIM.tableCentre[2]-DIM.tableHalf[2],maxZ:DIM.tableCentre[2]+DIM.tableHalf[2]},
  solidBoxes:[{id:'table-top',position:arr(world.table.position),quaternion:world.table.quaternion.toArray(),halfExtents:arr(world.table.shapes[0].halfExtents)}]};}
async function windowCancel({early=false,candidateEarlyRest=false,supportEnabled=true}={}){
  const {actor,world}=prepare({id:'A',side:'L',pair:false},true),window=world.window,a=window.agents.get('A');
  if(!supportEnabled)world.setSupport(false);
  if(candidateEarlyRest){
    // Isolated controller candidate; all rigid bodies continue production physics.
    // The source implementation is unchanged until the producer accepts this path.
    const current=window.beginWithdrawal.bind(window);
    window.beginWithdrawal=function(agent){
      world.table.updateAABB();const safePalmZ=world.table.aabb.lowerBound.z-WINDOW_DIM.withdrawTableMarginM,from=this.hand(agent);
      if(agent.firstContactErrorM===null&&from[2]<=safePalmZ){
        agent.actor.beginRest({duration:WINDOW_DIM.restSeconds});agent.recovery={phase:'rest',time:0,nextPoseAt:.1,safePalmZ};
        this.samplePose(agent,'rest-start');return;
      }
      current(agent);
    };
  }
  assert(window.request('A','open','native-actual-cancel-probe'));
  const r={...metrics(),cancel:null,phaseSamples:{}};
  for(let step=0;step<3600;step++){
    world.tick(dt);const angleDeg=window.angle()*180/Math.PI;
    const cancelNow=early?a.phase==='approach'&&a.phaseTime>=.1:window.heldBy==='A'&&angleDeg< -8&&angleDeg> -30;
    if(!r.cancel&&cancelNow){
      r.cancel={time:world.time,angleDeg,angularVelocity:arr(window.leaf.angularVelocity),hand:window.hand(a)};
      assert(window.cancel('A'));r.cancel.after={heldBy:window.heldBy,reservedBy:window.reservedBy,gripPresent:!!window.grip,hingePresent:world.world.constraints.includes(window.hinge)};
    }
    if(window.heldBy==='A'||r.cancel){
      const stage=a.recovery?.phase||a.phase,d=actor.diagnostics({...tableGeometry(world),
        bottle:{position:window.handleCenter(),quaternion:window.leaf.quaternion,radius:DIM.radius,height:DIM.height},solidBoxes:window.solidBoxes()});
      record(r,d,stage,world.time);
      r.phaseSamples[stage]??=metrics();record(r.phaseSamples[stage],d,stage,world.time);
    }
    if(r.cancel&&!a.recovery&&!actor.hasRecovery())break;
  }
  assert(r.cancel,early?'Actual production approach must start before early cancellation':'Actual native hand must acquire and swing the physical window before cancellation');
  r.completed=!a.recovery&&!actor.hasRecovery();r.finalAngleDeg=window.angle()*180/Math.PI;r.finalRestPoseErrorRad=actor.diagnostics().restPoseErrorRad;
  r.angularTravelAfterCancelDeg=r.finalAngleDeg-r.cancel.angleDeg;
  r.passed=r.completed&&r.maxSolidPenetrationM<=.003&&r.maxCylinderPenetrationM<=.005&&!r.reachClamped&&r.finalRestPoseErrorRad<1e-5&&
    !window.heldBy&&!window.reservedBy&&!window.grip&&world.world.constraints.includes(window.hinge);
  const report={schema:'npc-native-window-dynamic-cancel/1',...metadata(),cancelKind:early?'approach-0.1s':'swing-after-minus8deg',candidateEarlyRest,supportEnabled,
    tolerances:{assistedHandlePenetrationM:.005,solidBoxPenetrationM:.003,boneAndFootJointErrorM:1e-8},...r,window:window.snapshot()};
  const filename='native-window-cancel-'+(early?'early':'dynamic')+(candidateEarlyRest?'-candidate':'')+(!supportEnabled?'-support-off':'')+'.json';
  fs.writeFileSync(path.join(qa,filename),JSON.stringify(report,null,2)+'\n');
  console.log((early?'WINDOW_EARLY_CANCEL ':'WINDOW_CANCEL ')+JSON.stringify({...r,phaseSamples:undefined}));
}
async function bottleCapture(scenario,event){
  const {actor,world}=prepare(scenario),a=world.agents.get(actor.id);assert(world.request(actor.id,'native-release-recovery-probe'));
  let captured=false;
  for(let step=0;step<3600;step++){
    world.tick(dt);
    if(event==='release'&&a.phase==='verify'){captured=true;break;}
    if(event==='cancel'&&a.phase==='lift'&&a.phaseTime>=.75&&world.heldBy===actor.id){world.cancel(actor.id);captured=true;break;}
    if(['failed','done','cancelled'].includes(a.phase)&&!captured)break;
  }
  assert(captured,JSON.stringify({scenario,event,phase:a.phase,result:a.result}));
  const from=world.hand(a),legacyTarget=event==='release'?a.retreat.slice():a.retraction.to.slice(),shape=tableGeometry(world);
  const capture={scenario,event,phase:a.phase,time:world.time,palm:from,bottlePosition:arr(world.bottle.position),bottleQuaternion:world.bottle.quaternion.toArray(),
    actualHeldBy:world.heldBy,actualReservedBy:world.reservedBy,sourceRetreat:legacyTarget};
  const safeZ=shape.tableBounds.minZ-candidateTableMarginM,safeTarget=[from[0],from[1]+DIM.bottleWithdrawLiftM,Math.min(from[2]-DIM.bottleWithdrawMinimumM,safeZ)];
  const paths=[];
  const pathDefinitions=[['current-production',legacyTarget]];
  if(process.env.NPC_BOTTLE_MARGIN_M)pathDefinitions.push(['candidate-table-clearance',safeTarget]);
  for(const [method,to] of pathDefinitions){
    actor.setReach(from,0,scenario.side);const r={method,to,...metrics()};
    for(let step=0;step<=108;step++){
      const t=step/108,ease=t*t*t*(10+t*(-15+6*t)),target=from.map((v,i)=>v+(to[i]-v)*ease);
      actor.setReach(target,0,scenario.side);record(r,actor.diagnostics(shape),'withdraw',step*dt);
    }
    actor.beginRest({duration:.65});let done=false;
    for(let step=1;step<=90&&!done;step++){done=actor.updateRecovery(dt);record(r,actor.diagnostics(shape),'rest',.9+step*dt);}
    r.complete=done;r.finalRestPoseErrorRad=actor.diagnostics().restPoseErrorRad;
    r.passed=done&&!r.reachClamped&&r.maxPalmErrorM<.00035&&r.maxSolidPenetrationM<=.003&&r.finalRestPoseErrorRad<1e-5;
    paths.push(r);
  }
  const result={capture,paths};console.log('BOTTLE '+JSON.stringify({scenario,event,paths:paths.map(p=>({method:p.method,passed:p.passed,maxSolidPenetrationM:p.maxSolidPenetrationM,reachClamped:p.reachClamped,minTableSignedDistanceM:p.minTableSignedDistanceM,to:p.to}))}));
  return result;
}
if(process.argv[2]==='final'){
  await windowCancel();await windowCancel({early:true});await windowCancel({early:true,supportEnabled:false});
}
else if(process.argv[2]==='window-early-candidate-off')await windowCancel({early:true,candidateEarlyRest:true,supportEnabled:false});
else if(process.argv[2]==='window-early-candidate')await windowCancel({early:true,candidateEarlyRest:true});
else if(process.argv[2]==='window-early-off')await windowCancel({early:true,supportEnabled:false});
else if(process.argv[2]==='window-early-only')await windowCancel({early:true});
else if(process.argv[2]!=='bottle-only')await windowCancel();
if(!['window-only','window-early-only','window-early-off','window-early-candidate','window-early-candidate-off'].includes(process.argv[2])){
  const scenarios=[{id:'A',side:'L',pair:false},{id:'B',side:'L',pair:false},{id:'C',side:'L',pair:false},{id:'A',side:'L',pair:true},{id:'B',side:'R',pair:true}],results=[];
  for(const scenario of scenarios)for(const event of ['release','cancel'])results.push(await bottleCapture(scenario,event));
  const current=results.map(r=>r.paths.find(p=>p.method==='current-production')),candidate=results.map(r=>r.paths.find(p=>p.method==='candidate-table-clearance')).filter(Boolean);
  const report={schema:'npc-native-bottle-recovery/1',...metadata(),passed:current.every(r=>r.passed),currentProductionPassed:current.every(r=>r.passed),
    candidatePassed:candidate.length?candidate.every(r=>r.passed):null,
    productionProtocol:{verticalOffsetM:DIM.bottleWithdrawLiftM,rearwardMinimumM:DIM.bottleWithdrawMinimumM,tableRearMarginM:DIM.bottleWithdrawTableMarginM},
    candidate:candidate.length?{verticalOffsetM:DIM.bottleWithdrawLiftM,rearwardMinimumM:DIM.bottleWithdrawMinimumM,tableRearMarginM:candidateTableMarginM}:null,results,
    limits:'Captured real production release and mid-lift cancel poses. Subsequent pose-path comparison checks the physical table surface; browser suite still verifies the full continuing rigid world and rendering.'};
  fs.writeFileSync(path.join(qa,'native-bottle-recovery.json'),JSON.stringify(report,null,2)+'\n');
}
