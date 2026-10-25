'use strict';
const fs=require('fs'),assert=require('assert'),path=require('path'),crypto=require('crypto');
const load=require('./load-r29'),api=require('./outer-crosshead'),install=require('./outer-crosshead-adapter');
const c=load(),S=c.SCENE,D=c.DYNAMIC,original=JSON.stringify(S),baseline=D.snapshot({mode:'baseline'}),candidate=D.snapshot({mode:'candidate'});
const originalVisible=S.parts.filter(p=>D.visible(p,baseline)).map(p=>p.id),originalSources={...S.sources},originalParts=S.parts.slice(),waveHash=crypto.createHash('sha256').update(JSON.stringify(c.ANALYTIC_MATERIAL_WAVES.presets)).digest('hex');
const C=install(S,D,api),A=c.createSurfaceAppearance(S,D,c.ANALYTIC_MATERIAL_WAVES,c.createMaterialCoordinates);
assert.strictEqual(originalVisible.length,519);assert.deepStrictEqual(S.parts.filter(p=>D.visible(p,baseline)).map(p=>p.id),originalVisible);
for(const [k,v]of Object.entries(originalSources))assert.strictEqual(S.sources[k],v);
assert.strictEqual(JSON.stringify(originalParts),JSON.stringify(JSON.parse(original).parts));
assert(C.suppress.every(id=>!D.visible(S.parts.find(p=>p.id===id),candidate)));
assert(C.parts.every(p=>D.visible(p,candidate)&&!D.visible(p,baseline)));
let maxAdvectError=0,maxInverseError=0,maxPoseResidual=0,minCoverGap=Infinity,minUpperGap=Infinity,maxShaderLiteralError=0;
const traces=[];
for(let i=0;i<=1440;i++){
 const theta=.4+i*2*Math.PI/1440,poses=D.outsideValvePose(theta);
 for(const side of ['left','right']){
  const pose=poses[side],V=pose.pins.valveCrossheadPin;
  minCoverGap=Math.min(minCoverGap,api.parameters.coverContactZ-V[2]-api.parameters.cheekFrontZ);
  minUpperGap=Math.min(minUpperGap,pose.pins.combinationUpperPin[1]-.012-(V[1]+api.parameters.cheekY));
  maxPoseResidual=Math.max(maxPoseResidual,pose.maxEquationResidual);
  if(i%20===0)traces.push({theta,side,V,combinationAngle:pose.combinationAngle,U:pose.pins.combinationUpperPin,L:pose.pins.combinationLowerPin});
 }
 // Exact same-theta inverse and material advection of every new part.
 for(const part of C.parts){
  const f=D.valveFrame(part,theta,candidate),ref=part.origin.map((v,j)=>v+(j===0?.003:j===1?.009:.013)),world=f?D.valvePoint(ref,f):ref;
  const back=f?D.valvePoint(world,f,true):world;maxInverseError=Math.max(maxInverseError,...back.map((v,j)=>Math.abs(v-ref[j])));
  const mf=A.frame(part,theta,candidate).coordinates,mref=A.frame(part,.4,candidate).coordinates.local(ref),loc=mf.local(world);
  maxAdvectError=Math.max(maxAdvectError,...loc.map((v,j)=>Math.abs(v-mref[j])));
  assert.strictEqual(mf.theta,theta);
  assert.strictEqual(mf.scalarArgument,D.argument(part));
  assert(D.bounds(part,theta,candidate).every(a=>a.every(Number.isFinite)));
  if(part.frameKind==='translate')assert.strictEqual(f.angle,0);
 }
}
assert(maxInverseError<1e-12);assert(maxAdvectError<1e-12);assert(minCoverGap>.002);assert(minUpperGap>.030);
// Direct finite assembly checks at known boundary, solid and void witnesses.
const P=api.parameters,body='outside_joint/left_fork_crosshead_and_shoes',ref=api.reference.left;
const local=(id,p)=>C.referenceScalar(id,p.map((v,i)=>v+ref[i]));
assert(local(body,[0,0,0])>0,'Fork must remain empty at V');
assert(local(body,[.025,.020,0])<0,'Long cheek must contain finite solid');
assert(local(body,[.025,0,0])>0,'Transverse pin bore must remain empty');
assert(local(body,[0,.020,.046])<0,'Socket has finite wall');
assert(local(body,[0,0,.046])>0,'Axial socket bore must remain open');
assert(local(body,[.035,0,.049])>0,'Cotter slot must remain open through cheeks');
assert(local('outside_joint/left_canonical_valve_spindle',[0,0,0])>0,'Spindle must not enter lever V');
assert(local('outside_joint/left_canonical_valve_spindle',[0,0,.045])<0,'Spindle enters socket');
assert(local('outside_joint/left_canonical_valve_spindle',[0,0,.049])>0,'Spindle cotter slot must remain open');
assert(local('outside_joint/left_canonical_valve_spindle',[0,0,1.15])>0,'Preserve front Y-axis bore');
assert(local('outside_joint/left_transverse_pin',[0,0,0])<0);
assert(local('outside_joint/left_transverse_pin',[.052,.011,0])>0,'Finite end-stop groove must exist');
assert(local('outside_joint/left_split_end_stop',[.052,0,.015])<0);
assert(local('outside_joint/left_split_end_stop',[.052,.015,0])>0,'Retainer must be split');
// The front input eye stays exactly the original stack capsule with its Y bore.
const oldStack=originalParts.find(p=>p.id==='stack_candidate/spindle/L'),frontPoints=[];
function oldFront(q){const z=Math.max(0,Math.min(1.15,q[2]));return Math.max(Math.hypot(q[0],q[1],q[2]-z)-.016,.0135-Math.hypot(q[0],q[2]-1.15));}
let seed=1234567;function rnd(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
let frontError=0,boundsFailures=0;
for(let i=0;i<5000;i++){
 const q=[(rnd()-.5)*.050,(rnd()-.5)*.050,1.10+rnd()*.09];frontError=Math.max(frontError,Math.abs(local('outside_joint/left_canonical_valve_spindle',q)-oldFront(q)));
}
assert(frontError<1e-12,'Front capsule/eye must remain unchanged');
for(const part of C.parts){const b=api.bounds(part.ast);for(let i=0;i<100;i++){const q=b[0].map((v,j)=>v+(b[1][j]-v)*rnd());const value=api.scalar(part.ast,q);assert(Number.isFinite(value));}}
assert.strictEqual(crypto.createHash('sha256').update(JSON.stringify(c.ANALYTIC_MATERIAL_WAVES.presets)).digest('hex'),waveHash);
const jsonPart=p=>{const q={...p};delete q.referenceScalar;return q;};
const exportData={version:C.version,parameters:C.parameters,provenance:C.provenance,parts:C.parts.map(jsonPart),suppress:C.suppress,mountInterface:C.mountInterface,limitations:C.limitations};
fs.writeFileSync(path.join(__dirname,'CANDIDATE_FIELDS.json'),JSON.stringify(exportData,null,2));
fs.writeFileSync(path.join(__dirname,'outer-crosshead-fields.glsl'),C.source);
fs.writeFileSync(path.join(__dirname,'SAME_TIME_TRACES.json'),JSON.stringify(traces,null,2));
const report={status:'PASS candidate API / exact reference preservation / same-time CPU material mapping; NOT whole acceptance',baselineVisible:519,priorDefined:originalParts.length,newFields:C.parts.length,candidateDefined:S.parts.length,candidateVisible:S.parts.filter(p=>D.visible(p,candidate)).length,suppressed:C.suppress,phasesPerSide:1441,maxInverseError,maxMaterialAdvectError:maxAdvectError,maxSolverResidual:maxPoseResidual,minWideBodyCoverAxialGap_m:minCoverGap,minUpperPinVerticalGap_m:minUpperGap,frontCapAndYBoreMaximumError:frontError,wavePresetHash:waveHash,originalSourceMutation:false,independentClock:false,geometryDisplacement:0,cpuGLSL:'Same expression tree emits all primitives, CSG and holes. GPU numerical parity is not yet run.',mechanicalAcceptance:false,continuousCollisionProof:false,fastenerStrengthCertification:false};
fs.writeFileSync(path.join(__dirname,'CPU_ADAPTER_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
