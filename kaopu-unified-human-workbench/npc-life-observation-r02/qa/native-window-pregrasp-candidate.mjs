/** Single authored pregrasp candidate requested after measured approach/handle
 * intersection. No production scene/body/pose implementation is edited here. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
process.env.NPC_NATIVE_FIXTURE_ONLY='1';
const {actors,source,qa,sourceHashes,geometrySourceHashes,actualGeometryAt,rotate,add,scale,DIM}=await import('./native-frame-recovery.mjs');
const startedAt=new Date().toISOString(),dt=1/120,preDistance=.14,preSeconds=1.15,enterSeconds=.65,ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(10+t*(-15+6*t));};
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*ease(t)),rows=[];
const scenarios=[{id:'A',side:'L'},{id:'B',side:'L'},{id:'C',side:'L'},{id:'A',side:'L',pair:true},{id:'B',side:'R',pair:true}];
for(const scenario of scenarios)for(const degrees of [0,-35]){
  for(const [i,a] of actors.entries()){a.rest();a.root.position.set(1.5+i*.6,a.floorOffset,-.13);}
  const a=actors.find(a=>a.id===scenario.id);a.setSide(scenario.side);a.root.position.set(scenario.pair&&a.id==='B'?.60:-.12,a.floorOffset,{A:.10,B:.05,C:.08}[a.id]);
  const shape=actualGeometryAt(degrees*Math.PI/180);shape.solidCylinders=[{id:'bottle-01',position:DIM.source,quaternion:[0,0,0,1],radius:DIM.radius,height:DIM.height}];
  const frame={palm:shape.palm,forward:rotate([scenario.side==='L'?1:-1,0,0],shape.q)},from=a.handAnchor().toArray(),goal=add(shape.center,scale(frame.palm,-shape.bottle.radius)),pre=add(goal,scale(frame.palm,-preDistance));
  const preReach=a.reachability(pre,scenario.side,frame),contactReach=a.reachability(goal,scenario.side,frame);
  const r={scenario,degrees,station:a.root.position.toArray(),from,pre,goal,preReachMarginM:preReach.maxM-preReach.distanceM,contactReachMarginM:contactReach.maxM-contactReach.distanceM,
    samples:0,maxOwnHandlePenetrationM:0,maxOtherSolidPenetrationM:0,maxBoneErrorM:0,maxFootJointErrorM:0,maxPalmErrorM:0,clampedSamples:0,normalEntryClampedSamples:0,
    minOtherBottleSignedDistanceM:Infinity,minTableSignedDistanceM:Infinity,worstOwn:null,worstOther:null,worstReach:null};
  for(let step=1;step<=Math.round((preSeconds+enterSeconds)/dt);step++){
    const t=step*dt,leg=t<=preSeconds?'pregrasp':'normal-entry',target=leg==='pregrasp'?mix(from,pre,t/preSeconds):mix(pre,goal,(t-preSeconds)/enterSeconds);
    a.setReach(target,0,scenario.side,frame);const d=a.diagnostics(shape);
    assert(d.finite&&d.boneLengthErrorM<1e-8&&d.footJointErrorM<1e-8);assert(d.solidByCylinder['bottle-01'].sampleCount>0);
    r.samples++;r.maxBoneErrorM=Math.max(r.maxBoneErrorM,d.boneLengthErrorM);r.maxFootJointErrorM=Math.max(r.maxFootJointErrorM,d.footJointErrorM);
    r.minOtherBottleSignedDistanceM=Math.min(r.minOtherBottleSignedDistanceM,d.solidByCylinder['bottle-01'].minimumSignedDistanceM);
    r.minTableSignedDistanceM=Math.min(r.minTableSignedDistanceM,d.solidByBox['table-top'].minimumSignedDistanceM);
    const evidence=()=>({leg,time:t,requested:target,actualPalm:d.palm});
    if(d.handErrorM>r.maxPalmErrorM){r.maxPalmErrorM=d.handErrorM;r.worstReach={...evidence(),errorM:d.handErrorM,clamped:d.reachClamped};}
    if(d.reachClamped){r.clampedSamples++;if(leg==='normal-entry')r.normalEntryClampedSamples++;}
    if(d.bottleMaxPenetrationM>r.maxOwnHandlePenetrationM){r.maxOwnHandlePenetrationM=d.bottleMaxPenetrationM;r.worstOwn={...evidence(),pointWorld:d.bottleDeepestPointWorld,vertex:d.bottleDeepestVertex,penetrationM:d.bottleMaxPenetrationM};}
    if(d.solidMaxPenetrationM>r.maxOtherSolidPenetrationM){r.maxOtherSolidPenetrationM=d.solidMaxPenetrationM;r.worstOther={...evidence(),...d.solidDeepest,penetrationM:d.solidMaxPenetrationM};}
  }
  const end=a.diagnostics(shape);r.endPalmErrorM=end.handErrorM;r.geometryPassed=r.maxOwnHandlePenetrationM<=.005&&r.maxOtherSolidPenetrationM<=.003;
  r.endpointsReachable=preReach.reachable&&contactReach.reachable;r.fullRequestedPathReachable=r.clampedSamples===0;
  r.passed=r.geometryPassed&&r.endpointsReachable&&r.fullRequestedPathReachable&&r.endPalmErrorM<.00035;
  rows.push(r);console.log('PREGRASP '+JSON.stringify(r));
}
const report={schema:'npc-native-window-pregrasp-candidate/1',rigBaselineHead:source.sourceHead,startedAt,completedAt:new Date().toISOString(),sourceHashes,geometrySourceHashes,
  candidate:{preNormalDistanceM:preDistance,preSeconds,normalEntrySeconds:enterSeconds,interpolation:'two quintic world-palm segments; fixed native world wrist frame at each sampled window angle'},
  passed:rows.every(r=>r.passed),geometryPassed:rows.every(r=>r.geometryPassed),fullRequestedPathsReachable:rows.every(r=>r.fullRequestedPathReachable),rows,
  limits:'Exact original native hand/forearm surface math, five fixed window workstations, two static actual-shape window angles. These are authored candidate paths, not a real dynamic window-controller run. Includes the existing authored blocker conservatively at both angles. No production source or body pose changed by this fixture.'};
fs.writeFileSync(path.join(qa,'native-window-pregrasp-candidate.json'),JSON.stringify(report,null,2)+'\n');
console.log('SUMMARY '+JSON.stringify({passed:report.passed,geometryPassed:report.geometryPassed,fullRequestedPathsReachable:report.fullRequestedPathsReachable,cases:rows.length}));
