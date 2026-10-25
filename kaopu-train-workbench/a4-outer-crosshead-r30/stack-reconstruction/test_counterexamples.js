'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert'),S=require('./stack_candidate');
const c={};c.window=c;vm.createContext(c);for(const f of ['scene.js','dynamic.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
const g=require('../gresley-reconstruction/gresley_solver').createGresleySolver(c.SCENE,c.DYNAMIC,require('../outside_valve_solver').createOutsideValveSolver(c.DYNAMIC));
const p=S.inspect(c.SCENE,g.reference),d=S.derive(p,g.reference,{}, {terminalEyes:true});
let closest={distance:Infinity};
for(let i=0;i<=14400;i++){const s=g.pose(.4+2*Math.PI*i/14400),distance=Math.hypot(s.pins.E[0]-s.pins.O[0],s.pins.E[2]-s.pins.O[2]);if(distance<closest.distance)closest={pose:s,distance};}
const s=closest.pose,parts=S.parts(d,p,s),goodO=parts.find(p=>p.id==='pin/O'),E=parts.find(p=>p.id==='pin/E');
const rejectedShift=d.derived.upperFaceGap-d.derived.lowerFaceGap,badO={...goodO,y:goodO.y.map(y=>y-rejectedShift)};
const low=Math.max(badO.y[0],E.y[0]),high=Math.min(badO.y[1],E.y[1]);
const w=[(s.pins.O[0]+s.pins.E[0])/2,(low+high)/2,(s.pins.O[2]+s.pins.E[2])/2],values=[S.scalar(badO,w),S.scalar(E,w)];
assert(Math.max(...values)<-.001);
const reference=g.pose(.4),bodyParts=S.parts(d,p,reference),connections=[];
for(const k of ['R','L','M']){
 const eye=bodyParts.find(p=>p.id==='terminal_eye/'+k),stem=bodyParts.find(p=>p.id==='spindle/'+k),pin=bodyParts.find(p=>p.id==='pin/'+k),q=reference.pins[k].slice();q[2]-=.02;
 const f=[S.scalar(eye,q),S.scalar(stem,q)];assert(Math.max(...f)<-.006);
 assert(S.scalar(stem,reference.pins[k])>0&&S.scalar(pin,reference.pins[k])<0);
 connections.push({joint:k,eyeToDrilledStemMaterialContinuity:{witness:q,scalarValues:f,commonInteriorBallRadiusM:.006},pinCenterAfterExplicitCut:{stemScalar:S.scalar(stem,reference.pins[k]),pinScalar:S.scalar(pin,reference.pins[k]),pinNoLongerInsideStem:true},strengthOrManufactureProved:false});
}
const report={pass:true,rejectedSimplification:{description:'Replace the derived upper face gap 12.5 mm with the lower spacer-only gap 3 mm. O shaft then overlaps E shaft during the cycle; plate separation alone is not sufficient.',theta:s.theta,O_E_projectedCenterDistanceM:closest.distance,badOPinY:badO.y,EPinY:E.y,witness:w,scalarValues:values,commonInteriorBallRadiusM:.001,correctCandidateAxialGapM:goodO.y[0]-E.y[1]},localInputConnections:connections,loadPathAudit:{fixedO:{kinematicallyFixed:true,modeledPinAndBushing:true,frameConnectionKnown:false,supportBearingSeatKnown:false,forceReactionsOrStressesComputed:false,status:'UNRESOLVED: pin center fixation is a kinematic condition, not physical frame support'},RLM:{explicitTerminalEyeAndBoreRequired:true,nominalLocalMaterialContinuity:true,actualManufacturingDetailKnown:false},middleSlider:{YRetained:1.48,translationAlongZ:true,guideOrChestModeled:false,status:'UNRESOLVED: prescribed straight spindle path is not a physical prismatic support'}},wholeMechanicalAcceptance:false};
fs.writeFileSync(path.join(__dirname,'COUNTEREXAMPLES_AND_SUPPORT_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
