#!/usr/bin/env node
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {fitRegion,depthAt,depthStepM} from './camera.mjs';
import {float32DepthDiagnostic} from './shared-near-test-candidate.mjs';
import {projectionForFrame} from './shared-projection.mjs';
const codes=2**24-1,report={schema:'hk-sea-low-island-depth-separation/1',gpuStatus:'NOT RUN',sampleMeaning:'Nine synthetic same-X/Z sea-height-0 versus height+1/+3 m samples spanning the whole rectangle; not claimed to be observed island elevations',baselinePolicy:'near=clamp(distance*.001,.15,100)',adoptedPolicy:'near=clamp(distance*.02,.15,3000)',viewports:[]};
const points=[-37680,-1020,35640].flatMap(x=>[-29720,775,31270].map(z=>[x,0,z]));
for(const [w,h]of[[1920,1080],[390,844],[360,800]]){
 const fit=fitRegion(w/h),c=fit.camera,viewport={width:w,height:h,distanceM:fit.state.distance,policies:[]};
 for(const [name,scale,cap]of[['baseline001',.001,100],['candidate002',.02,3000]]){
  const near=Math.min(cap,Math.max(.15,fit.state.distance*scale));if(name==='candidate002')assert.equal(near,projectionForFrame({mode:'map',distance:fit.state.distance}).clipNear);const spec={near,far:150000},policy={name,near,heights:[]};
  for(const height of[1,3]){
   const samples=points.map(p=>{const z=p.reduce((s,x,i)=>s+(x-c.cam[i])*c.fw[i],0),landZ=z+height*c.fw[1],seaCode=Math.round(depthAt(z,spec)*codes),landCode=Math.round(depthAt(landZ,spec)*codes),seaFloat=float32DepthDiagnostic(z,spec),landFloat=float32DepthDiagnostic(landZ,spec);return {xz:[p[0],p[2]],seaViewDepthM:z,landViewDepthM:landZ,seaCode,landCode,idealD24CodeDifference:seaCode-landCode,nonFusedFloat32CodeDifference:seaFloat.emulatedD24-landFloat.emulatedD24,seaOneLSBApproxM:depthStepM(z,24,spec)};});
   const r={heightM:height,idealD24Collisions:samples.filter(s=>s.idealD24CodeDifference===0).length,nonFusedFloat32Collisions:samples.filter(s=>s.nonFusedFloat32CodeDifference===0).length,idealD24CodeDifferenceRange:[Math.min(...samples.map(s=>s.idealD24CodeDifference)),Math.max(...samples.map(s=>s.idealD24CodeDifference))],samples};if(name==='candidate002')assert(samples.every(s=>s.idealD24CodeDifference>0&&s.nonFusedFloat32CodeDifference>0));policy.heights.push(r);
  }viewport.policies.push(policy);
 }report.viewports.push(viewport);
}
report.baselineHasConfirmedIdealQuantizationCollisions=report.viewports.some(v=>v.policies[0].heights.some(h=>h.idealD24Collisions>0));assert(report.baselineHasConfirmedIdealQuantizationCollisions);report.candidateAllSyntheticSamplesSeparatedInCPUModels=true;
await fs.writeFile(new URL('SURFACE-DEPTH-RESULTS.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({baselineFailsIdealD24:true,candidateCpuSeparated:true,gpuStatus:'NOT RUN',viewports:report.viewports.map(v=>({width:v.width,height:v.height,policies:v.policies.map(p=>({name:p.name,near:p.near,heights:p.heights.map(({heightM,idealD24Collisions,nonFusedFloat32Collisions,idealD24CodeDifferenceRange})=>({heightM,idealD24Collisions,nonFusedFloat32Collisions,idealD24CodeDifferenceRange}))}))}))},null,2));
