import assert from 'node:assert/strict';
import {anchorError,crankPin,sliderCrank,placeBuilding,facadeGrid,crossingInitial,stepCrossing,crossingOutputs} from './assembly_rules.mjs';
import fs from 'node:fs';
const I=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],move=[...I];move[12]=5;
assert.equal(anchorError(move,[0,0,0],I,[5,0,0]),0);
assert.equal(anchorError(move,[0,0,0],I,[4,0,0]),1);
for(const a of [0,.4,1.9,4.7]){const p=crankPin({center:[0,0,0],radius:1,phase:0,angle:a}),q=crankPin({center:[0,0,0],radius:1,phase:Math.PI/2,angle:a});assert(Math.abs(p[1]*q[1]+p[2]*q[2])<1e-12);const slider=sliderCrank({angle:a,radius:1,rodLength:4});assert(Math.abs(Math.hypot(slider-p[2],p[1])-4)<1e-12)}
const params={z:0,width:8,depth:5,height:15,railHalfWidth:2,clearance:1},right=placeBuilding({...params,side:1}),left=placeBuilding({...params,side:-1});assert.equal(right.bounds.min[0],3);assert.equal(left.bounds.max[0],-3);assert.equal(right.frontNormal[0],-1);assert.equal(left.frontNormal[0],1);
const blocked=placeBuilding({...params,side:-1,cameraVolumes:[{min:[-8,0,-5],max:[-4,7,5]}]});assert.deepEqual(blocked.cameraConflicts,[0]);
assert.equal(facadeGrid({floors:5,bays:4,floorHeight:3,bayWidth:2,side:1,frontX:3}).length,20);
const request={powered:true,roadClear:true,request:true,occupied:false};let a=crossingInitial(),b=crossingInitial();a=stepCrossing(a,request,6);for(let i=0;i<60;i++)b=stepCrossing(b,request,.1);assert.equal(a.phase,'CLOSED');assert.equal(b.phase,'CLOSED');assert.equal(a.gate,b.gate);
assert(crossingOutputs(a,request).railProceed);assert(!crossingOutputs(a,request).roadProceed);
const saved=JSON.parse(JSON.stringify(b));assert.deepEqual(stepCrossing(saved,request,0),saved);
a=stepCrossing(a,{...request,occupied:true},1);assert.equal(a.phase,'TRAIN_IN');assert(!crossingOutputs(a,{...request,occupied:true}).roadProceed);
a=stepCrossing(a,{...request,request:false},4);assert.equal(a.phase,'OPEN');assert(crossingOutputs(a,{...request,request:false}).roadProceed);
const fault=stepCrossing(crossingInitial(),{...request,occupied:true},.1);assert.equal(fault.phase,'FAULT');assert(!crossingOutputs(fault,request).railProceed);assert(!crossingOutputs(fault,request).roadProceed);
const obstacle=stepCrossing(b,{...request,roadClear:false},1);assert.equal(obstacle.phase,'FAULT');
const report={status:'PASS',scope:'Independent candidate game mathematics, not source behavior or real railway validation',checks:['world anchors detect correct and wrong attachment','quarter crank phase and constant main rod length','opposing facades and rail/camera volumes','large time step vs split steps','save/zero-time resume','crossing entry/release and conflict fault'],realRailwayValidated:false,sceneIntegrated:false};fs.writeFileSync(new URL('./rules_verification.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
