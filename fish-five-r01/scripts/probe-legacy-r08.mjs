import fs from 'node:fs';import {performance} from 'node:perf_hooks';import crypto from 'node:crypto';
import {installLegacySchool} from '../src/legacy-school-r08.js';
const kernelSource=fs.readFileSync('fish-five-r01/src/schooling-r08.js','utf8'),kernelScope={};new Function('globalThis','module',kernelSource)(kernelScope,undefined);globalThis.FishSchoolingR08=kernelScope.FishSchoolingR08;
const isolated={};new Function('globalThis',fs.readFileSync('local-r14/src/school.js','utf8'))(isolated);
const native=isolated.KaopuSchoolMotion,angle=x=>Math.atan2(Math.sin(x),Math.cos(x)),rows=[];
for(const mode of ['CRUISE','TURN_LEFT','BURST','GLIDE']){
 const school=native.create(30,90401),api={school:native,renderer:{school,state:{mode},resetAll(){this.school=native.create(30,90401);}}},adapter=installLegacySchool(api);
 const before=school.fish.map(f=>({v:f.v.slice(),rate:f.turnRate||0}));
 let maxAcceleration=0,maxAngularAcceleration=0,minClearance=Infinity,clamps=0,cpu=0;
 for(let j=0;j<600;j++){
  const start=performance.now();api.school.update(school,1/60,1);cpu+=performance.now()-start;
  for(let i=0;i<30;i++){const f=school.fish[i],p=before[i];maxAcceleration=Math.max(maxAcceleration,Math.hypot(...f.v.map((x,k)=>(x-p.v[k])*60)));maxAngularAcceleration=Math.max(maxAngularAcceleration,Math.abs(f.turnRate-p.rate)*60);p.v=f.v.slice();p.rate=f.turnRate;}
  clamps+=adapter.simulation.operations.safetyClamps;minClearance=Math.min(minClearance,school.minClearance);
 }
 rows.push({mode,maxAcceleration,maxAngularAcceleration,minClearance,clamps,cpuAverageMs:cpu/600,final:adapter.snapshot()});adapter.dispose();
}
fs.mkdirSync('fish-five-r01/evidence',{recursive:true});fs.writeFileSync('fish-five-r01/evidence/R08_ROOT_LEGACY_PROBE.json',JSON.stringify({candidateOnly:true,producerProbeNotApproval:true,kernelSha256:crypto.createHash('sha256').update(kernelSource).digest('hex'),rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(({final,...r})=>({...r,speed:final.meanSpeed,bytes:final.allocatedBytes})),null,2));
