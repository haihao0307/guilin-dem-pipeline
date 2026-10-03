import fs from 'node:fs';import crypto from 'node:crypto';import {performance} from 'node:perf_hooks';
import {installLegacySchool} from '../src/legacy-school-r08.js';
const kernelSource=fs.readFileSync('fish-five-r01/src/schooling-r08.js','utf8'),scope={};new Function('globalThis','module',kernelSource)(scope,undefined);globalThis.FishSchoolingR08=scope.FishSchoolingR08;
new Function('globalThis',fs.readFileSync('local-r14/src/school.js','utf8'))(scope);const native=scope.KaopuSchoolMotion,rows=[];
for(const seed of [90401,90402,90403]){
 const r={state:{mode:'CRUISE'},school:native.create(30,seed),resetAll(){this.school=native.create(30,seed);}},api={renderer:r,school:native},adapter=installLegacySchool(api),old=r.school.fish.map(f=>({v:f.v.slice(),speed:Math.hypot(...f.v),rate:0}));
 const center=r.school.fish.reduce((p,f)=>p.map((x,k)=>x+f.p[k]/30),[0,0,0]);let t=0,j=0,clamps=0,minClearance=Infinity,maxSpeedDerivative=0,maxYawAcceleration=0,maxVectorAcceleration=0,cpu=0,maxPitch=0,maxRoll=0;
 while(t<120-1e-9){const dt=Math.min(seed===90402?[1/120,1/30,1/60,1/75,1/24][j%5]:1/60,120-t);r.state.mode=t<20?'CRUISE':t<40?'TURN_LEFT':t<60?'BURST':t<80?'GLIDE':'CRUISE';native.setPointer(r.school,t>=82&&t<88?{origin:[center[0],center[1],center[2]-4],direction:[0,0,1]}:null);if(t<82&&t+dt>=82)native.disturb(r.school,center);
  const before=r.school.time,start=performance.now();api.school.update(r.school,dt,1);cpu+=performance.now()-start;const accepted=r.school.time-before;
  if(accepted>0){for(let i=0;i<30;i++){const f=r.school.fish[i],p=old[i],speed=Math.hypot(...f.v);maxVectorAcceleration=Math.max(maxVectorAcceleration,Math.hypot(...f.v.map((x,k)=>(x-p.v[k])/accepted)));maxSpeedDerivative=Math.max(maxSpeedDerivative,Math.abs(speed-p.speed)/accepted);maxYawAcceleration=Math.max(maxYawAcceleration,Math.abs(f.turnRate-p.rate)/accepted);maxPitch=Math.max(maxPitch,Math.abs(f.pitch));maxRoll=Math.max(maxRoll,Math.abs(f.roll));p.v=f.v.slice();p.speed=speed;p.rate=f.turnRate;}clamps=adapter.simulation.totals.safetyClamps;minClearance=Math.min(minClearance,r.school.minClearance);}
  t+=dt;j++;
 }
 const final=adapter.snapshot();rows.push({seed,seconds:t,steps:final.totals.steps,clamps,minClearance,maxSpeedDerivative,maxYawAcceleration,maxVectorAcceleration,maxPitch,maxRoll,cpuAveragePerCallMs:cpu/j,final,producerCandidateNotApproval:true});adapter.dispose();
}
const report={kernelSha256:crypto.createHash('sha256').update(kernelSource).digest('hex'),rows,passed:rows.every(r=>r.clamps===0&&r.minClearance>0&&r.maxSpeedDerivative<.200001&&r.maxYawAcceleration<.340001&&r.maxPitch<.240001&&r.maxRoll<.110001)};
fs.writeFileSync('fish-five-r01/evidence/R08_ROOT_LEGACY_LONG_CANDIDATE.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,rows:rows.map(({final,...r})=>({...r,meanSpeed:final.meanSpeed}))},null,2));if(!report.passed)process.exitCode=1;
