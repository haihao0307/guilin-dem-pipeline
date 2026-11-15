/** Measured controller-path candidates only; never imported by the workbench. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.NPC_NATIVE_FIXTURE_ONLY='1';
const {actors,source,geometryAt,actualGeometryAt,withdrawalFor,rotate,add,scale,qa,here,sourceHashes,geometrySourceHashes,WINDOW_DIM}=await import('./native-frame-recovery.mjs');
const startedAt=new Date().toISOString();
const scenarios=[{id:'A',side:'L',pair:false},{id:'B',side:'L',pair:false},{id:'C',side:'L',pair:false},{id:'B',side:'R',pair:true}];
const results=[];
function measure(scenario,degrees,withdrawalM,upM=.03,direction='negative-palm'){
  const actual=mode.startsWith('actual'),{id,side,pair}=scenario,actor=actors.find(a=>a.id===id),shape=(actual?actualGeometryAt:geometryAt)(degrees*Math.PI/180);
  actor.rest();actor.setSide(side);actor.root.position.set(pair?.60:-.12,actor.floorOffset,pair?.05:{A:.10,B:.05,C:.08}[id]);
  const frame={palm:shape.palm,forward:rotate([side==='L'?1:-1,0,0],shape.q)};
  const from=add(shape.center,scale(shape.palm,-.032));
  if(mode==='actual')withdrawalM=withdrawalFor(from,frame,shape).distanceM;
  if(mode==='actual-clearance')withdrawalM=Math.max(withdrawalM,(from[2]-(shape.tableBounds.minZ-.15))/shape.palm[2]);
  const offset=direction==='world-back'?[0,0,-withdrawalM]:scale(shape.palm,-withdrawalM),to=add(add(from,offset),[0,upM,0]);
  const r={actor:id,side,pair,degrees,withdrawalM,upM,direction,from,to,minReachMarginM:Infinity,maxReachErrorM:0,reachClamped:false,maxWithdrawPenetrationM:0,
    maxRestPenetrationM:0,minRestSignedDistanceM:Infinity,maxBoneErrorM:0,maxFootJointErrorM:0,maxFootSurfaceErrorM:0,
    minTableSignedDistanceM:Infinity,minHandTableClearanceM:Infinity,minForearmTableClearanceM:Infinity,deepestWitness:null};
  function record(d,stage,step){
    assert(d.finite);assert(d.boneLengthErrorM<1e-8,'Exact native bone length');assert(d.footJointErrorM<1e-8,'Exact native foot joints');assert(d.footSurfaceErrorM<2e-5,'Accepted Float32 foot sample');
    r.maxBoneErrorM=Math.max(r.maxBoneErrorM,d.boneLengthErrorM);r.maxFootJointErrorM=Math.max(r.maxFootJointErrorM,d.footJointErrorM);r.maxFootSurfaceErrorM=Math.max(r.maxFootSurfaceErrorM,d.footSurfaceErrorM);
    const table=d.solidByBox['table-top']||d.solidByBox.table;
    if(table)r.minTableSignedDistanceM=Math.min(r.minTableSignedDistanceM,table.minimumSignedDistanceM);
    if(d.handTableSampleCount)r.minHandTableClearanceM=Math.min(r.minHandTableClearanceM,d.handTableClearanceM);
    if(d.forearmTableSampleCount)r.minForearmTableClearanceM=Math.min(r.minForearmTableClearanceM,d.forearmTableClearanceM);
    if(stage==='withdraw'){
      r.maxWithdrawPenetrationM=Math.max(r.maxWithdrawPenetrationM,d.solidMaxPenetrationM);
      r.maxReachErrorM=Math.max(r.maxReachErrorM,d.handErrorM);r.reachClamped ||=d.reachClamped;
    }else{
      r.maxRestPenetrationM=Math.max(r.maxRestPenetrationM,d.solidMaxPenetrationM);
      r.minRestSignedDistanceM=Math.min(r.minRestSignedDistanceM,d.solidMinimumSignedDistanceM);
    }
    if(!r.deepestWitness||d.solidMaxPenetrationM>r.deepestWitness.penetrationM)
      r.deepestWitness={stage,step,timeS:stage==='withdraw'?step*.9/(actual?108:36):step/120,penetrationM:d.solidMaxPenetrationM,signedDistanceM:d.solidMinimumSignedDistanceM,...d.solidDeepest,palm:d.palm};
  }
  const withdrawalSteps=actual?108:36;
  for(let step=0;step<=withdrawalSteps;step++){
    const t=step/withdrawalSteps,ease=actual?t*t*t*(10+t*(-15+6*t)):t,target=from.map((v,i)=>v+(to[i]-v)*ease),reach=actor.reachability(target,side,frame);
    r.minReachMarginM=Math.min(r.minReachMarginM,reach.maxM-reach.distanceM);
    actor.setReach(target,0,side,frame);record(actor.diagnostics(shape),'withdraw',step);
  }
  actor.beginRest({duration:.65});let step=0,complete=false;
  while(!complete&&step<90){complete=actor.updateRecovery(1/120);step++;record(actor.diagnostics(shape),'rest',step);}
  assert(complete);r.complete=complete;r.restPoseErrorRad=actor.diagnostics().restPoseErrorRad;
  r.passed=!r.reachClamped&&r.maxReachErrorM<.00035&&r.maxWithdrawPenetrationM<=.003&&r.maxRestPenetrationM<=.003&&r.restPoseErrorRad<1e-5;
  results.push(r);return r;
}
const mode=process.argv[2]||'focus';
if(mode==='lowering'){
  for(const direction of ['negative-palm','world-back'])for(const distanceM of [.12,.16,.20])for(const upM of [-.06,-.10,-.14]){
    const r=measure(scenarios[2],-35,distanceM,upM,direction);console.log(JSON.stringify(r));
  }
}else if(mode==='directions'){
  for(const distanceM of [.12,.16,.20,.24])for(const upM of [.03,0,-.03]){
    const r=measure(scenarios[2],-35,distanceM,upM,'world-back');console.log(JSON.stringify(r));
  }
}else if(mode==='focus'){
  for(const distanceM of [.12,.16,.20,.24,.28,.32])for(const degrees of [-35,-17.5,0]){
    const r=measure(scenarios[2],degrees,distanceM);console.log(JSON.stringify(r));
  }
}else{
  const distanceM=mode.startsWith('actual')?WINDOW_DIM.withdrawNormalDistanceM:Number(process.argv[3]);assert(Number.isFinite(distanceM)&&distanceM>0);
  for(const scenario of scenarios)for(const degrees of [0,-5,-10,-15,-17.5,-20,-25,-30,-35]){
    const r=measure(scenario,degrees,distanceM,mode.startsWith('actual')?WINDOW_DIM.withdrawVerticalOffsetM:Number(process.argv[5]||.03),process.argv[4]||'negative-palm');console.log(JSON.stringify({actor:r.actor,side:r.side,degrees,withdrawalM:r.withdrawalM,passed:r.passed,reachClamped:r.reachClamped,minReachMarginM:r.minReachMarginM,maxWithdrawPenetrationM:r.maxWithdrawPenetrationM,maxRestPenetrationM:r.maxRestPenetrationM,minRestSignedDistanceM:r.minRestSignedDistanceM}));
  }
}
const report={schema:'npc-native-withdraw-clearance/1',passed:results.every(r=>r.passed),mode,rigBaselineHead:source.sourceHead,
  sourceUnderTest:{directory:path.basename(here),sourceHashes,startedAt,completedAt:new Date().toISOString()},
  geometry:mode.startsWith('actual')?'Actual WINDOW_DIM leaf rails/pane/handle mounts/frame/stops/blocker boxes and DIM table; true weighted native hand and forearm; unchanged stations. Blocker included conservatively at every angle. Static geometric samples, not a dynamics claim.':'Specified conservative leaf envelope OBB; actual weighted native hand and forearm surface vertices; unchanged actor stations; no world simulation or actual pane-depth claim',
  geometrySourceHashes:mode.startsWith('actual')?geometrySourceHashes:null,
  sampleTimeStepS:mode.startsWith('actual')?1/120:null,withdrawalEasing:mode.startsWith('actual')?'production quintic':'uniform geometric path',
  solidLimitM:.003,results};
fs.writeFileSync(path.join(qa,'native-withdraw-clearance-'+mode+'.json'),JSON.stringify(report,null,2)+'\n');
