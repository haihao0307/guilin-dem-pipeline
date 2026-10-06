import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSceneModel,pathAt,SPEC,LENGTH} from '../scene.mjs';
const epsilon=1e-5;
for(let s=-100;s<100;s+=.013){const a=pathAt(s),b=pathAt(s+LENGTH);for(let i=0;i<3;i++)assert.ok(Math.abs(a.position[i]-b.position[i])<epsilon);assert.ok(Math.abs(Math.hypot(...a.tangent)-1)<epsilon);assert.ok(Math.abs(a.tangent[0]*a.normal[0]+a.tangent[1]*a.normal[1])<epsilon);}
for(const s of [SPEC.halfRun,SPEC.halfRun+Math.PI*SPEC.radius,3*SPEC.halfRun+Math.PI*SPEC.radius,3*SPEC.halfRun+2*Math.PI*SPEC.radius]){const a=pathAt(s-1e-7),b=pathAt(s+1e-7);assert.ok(Math.hypot(...a.position.map((p,i)=>p-b.position[i]))<epsilon,'position seam');assert.ok(Math.hypot(...a.tangent.map((p,i)=>p-b.tangent[i]))<epsilon,'tangent seam');}
const model=createSceneModel();assert.ok(model.stats.trainBlocks>2000);assert.ok(model.stats.environmentBlocks>10000);for(const mesh of [model.train,model.environment]){const p=mesh.geometry.attributes.position.array;assert.ok(Array.from(p).every(Number.isFinite));const idx=mesh.geometry.index.array;assert.ok(idx.length%3===0);for(const n of idx)assert.ok(n<p.length/3);}
model.setTime(0);const p0=model.phase.value;model.setTime(6);assert.ok(Math.abs(model.phase.value+LENGTH-p0)<epsilon);
const pBefore=pathAt(3).position,pAfter=pathAt(3-LENGTH/6*.05).position;assert.ok(pAfter[0]<pBefore[0],'top surface must travel toward the train rear');
const second=createSceneModel();for(const part of ['train','environment']){const a=model[part].geometry.attributes.position.array,b=second[part].geometry.attributes.position.array;assert.equal(a.length,b.length);for(let i=0;i<a.length;i++)assert.equal(a[i],b[i],'deterministic procedural scene');}second.dispose();
const report={status:'passed',scope:'Offline geometry and continuous bend math; browser rendering has not been tested here',stats:model.stats,loopSeconds:SPEC.period,pathLength:LENGTH,sourceReferenceSeconds:6,browser:'not_run'};
console.log(JSON.stringify(report,null,2));
if(process.env.QA_REPORT)fs.writeFileSync(process.env.QA_REPORT,JSON.stringify(report,null,2));
