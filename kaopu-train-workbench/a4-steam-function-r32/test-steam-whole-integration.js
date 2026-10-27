'use strict';const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const B=require('./r32-tests/legacy-test-bootstrap.cjs'),retained=B.assertRetainedScene();
// This regression deliberately retains its original R31 stage; R32 overlay is covered separately by the703-field integration test.
const base=B.loadModel(B.historical('r30')),live=B.loadModel(__dirname,{until:'steam-path-adapter.js',material:true}),S=live.scene,D=live.dynamic,C=D.steamPathCandidate;
assert(C,'Actual page must install the candidate');
for(const [name,source]of Object.entries(base.scene.sources))assert.strictEqual(S.sources[name],source,'Retained source changed '+name);
assert.deepStrictEqual(JSON.parse(JSON.stringify(S.parts.slice(0,base.scene.parts.length))),JSON.parse(JSON.stringify(base.scene.parts)),'Original part metadata changed');
const baseline=D.snapshot({mode:'baseline',beta:.11}),candidate=D.snapshot({mode:'candidate',beta:.126});
assert.strictEqual(S.parts.filter(p=>D.visible(p,baseline)).length,519);assert(C.parts.length>0);
assert.strictEqual(S.parts.filter(p=>D.visible(p,candidate)).length,662+C.parts.length);
const hostIDs=Object.keys(C.hostCuts);assert(hostIDs.length>0);assert(hostIDs.every(id=>!id.includes('frame')&&!id.includes('axle')));
for(const old of base.scene.parts){const p=S.parts.find(p=>p.id===old.id),before=base.dynamic.scalar(old),after=D.scalar(p);if(hostIDs.includes(p.id)){assert(after.includes('installationCandidate==1?max('));assert(after.includes(before));assert(after.endsWith(':'+before+')'));}else assert.strictEqual(after,before,'Unrelated scalar changed '+p.id);}
const A=live.context.createSurfaceAppearance(S,D,live.context.ANALYTIC_MATERIAL_WAVES,live.context.createMaterialCoordinates);
let stateChecks=0,maxChamberPartitionError=0;
for(const beta of [.11,.126,.16])for(let k=0;k<=72;k++){
 const theta=.4+2*Math.PI*k/72,inst=D.snapshot({mode:'candidate',beta}),info=C.inspection(theta,inst);
 assert.strictEqual(info.theta,theta);assert.strictEqual(info.workingChambers.length,3);
 for(const q of info.workingChambers){const delta=Math.abs((q.rearRange[1]-q.rearRange[0])+(q.frontRange[1]-q.frontRange[0])+(q.pistonFront-q.pistonRear)-(q.frontEnd-q.rearEnd));maxChamberPartitionError=Math.max(maxChamberPartitionError,delta);assert(delta<1e-12);assert(q.rearRange[1]>q.rearRange[0]&&q.frontRange[1]>q.frontRange[0]);assert(q.theta===theta);}
 for(const p of C.parts){assert(D.visible(p,inst)&&!D.visible(p,baseline));assert(p.source==='steamPath');const b=D.bounds(p,theta,inst);assert(b.every(x=>x.every(Number.isFinite)));const frame=A.frame(p,theta,inst);assert(frame.assignment&&frame.coordinates);assert(p.materialDescriptor);}
 assert(info.knownBreaks.length>0);stateChecks++;
}
assert(C.status.headerPrePostSeparated);assert.strictEqual(C.status.superheaterElementLoopComplete,false);assert.strictEqual(C.status.completeSteamFlow,false);assert.strictEqual(C.status.historicalValveEventsVerified,false);
const report={retainedSceneLock:retained,stage:'Actual page model dependencies through R31 steam adapter; no R32 overlay in this historical regression',status:'PASS_SCOPED_WHOLE_INTEGRATION',sourceSHA256:crypto.createHash('sha256').update(C.source).digest('hex'),commonSourceSHA256:crypto.createHash('sha256').update(C.commonSource).digest('hex'),definedFields:S.parts.length,baselineFields:519,candidateFields:662+C.parts.length,steamFields:C.parts.length,modifiedHostIDs:hostIDs,hostCutsSubtractOnly:true,originalSourcesAndMetadataUnchanged:true,stateChecks,maxChamberPartitionError,sameTimeChambers:true,completeSteamNetwork:false,historicalValveEventsVerified:false,globalClearanceCertificate:false,browser:'NOT_RUN_BY_THIS_TEST'};
fs.writeFileSync(B.output('STEAM_WHOLE_INTEGRATION_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
