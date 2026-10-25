'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert'),S=require('./stack_candidate'),I=require('./integration_spec');
const c={};c.window=c;vm.createContext(c);for(const f of ['scene.js','dynamic.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c);
const g=require('../gresley-reconstruction/gresley_solver').createGresleySolver(c.SCENE,c.DYNAMIC,require('../outside_valve_solver').createOutsideValveSolver(c.DYNAMIC));
const prof=S.inspect(c.SCENE,g.reference),d=S.derive(prof,g.reference,{}, {terminalEyes:true}),ref=I.pack(d,prof,g.pose(.4));
let maxScalarError=0,maxForwardInverseError=0,maxYChange=0,checks=0,seed=15998429;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
for(let k=0;k<=360;k++){
 const pose=g.pose(.4+2*Math.PI*k/360),now=S.parts(d,prof,pose);
 for(let i=0;i<now.length;i++){
  const frame=g.transformFor(ref.fields[i].referenceRigidFrameSourcePartId,pose);assert(frame);
  const box=S.bounds(ref.parts[i]);
  for(let j=0;j<20;j++){
   const q=[0,1,2].map(a=>box[0][a]+rand()*(box[1][a]-box[0][a])),world=g.transformPoint(q,frame),back=g.transformPoint(world,frame,true);
   maxScalarError=Math.max(maxScalarError,Math.abs(S.scalar(ref.parts[i],q)-S.scalar(now[i],world)));
   maxForwardInverseError=Math.max(maxForwardInverseError,Math.hypot(...q.map((v,a)=>v-back[a])));maxYChange=Math.max(maxYChange,Math.abs(q[1]-world[1]));checks++;
  }
 }
}
assert(maxScalarError<1e-12);assert(maxForwardInverseError<1e-12);assert(maxYChange===0);
const result={pass:true,phaseCount:361,scalarComparisons:checks,maxScalarErrorM:maxScalarError,maxForwardInverseErrorM:maxForwardInverseError,YChangeM:maxYChange,referenceFields:73,referenceCompilationSupported:true,coordinateRule:'Compile reference candidate shapes once, query exact common-pose inverseXZ of referenceRigidFrameSourcePartId. No second outside/Gresley transform.',physicalSupportOrWholeTrainAcceptance:false};
fs.writeFileSync(path.join(__dirname,'INTEGRATION_FRAME_QA.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
