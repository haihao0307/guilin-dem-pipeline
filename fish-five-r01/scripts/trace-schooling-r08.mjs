import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),B=require('../src/behavior.js'),base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),anchor=JSON.parse(fs.readFileSync(path.join(base,'TASK_ANCHOR_R08.json')));
const experiments=[];
for(const id of Object.keys(B.profiles))for(const environment of ['old-invisible-box','camera-follow-open-ocean']){
 const s=B.create(id,30,723);s.school.params.bounds=environment==='old-invisible-box'?[7,2.8,5]:null;s.school.reviewMetrics=true;
 let firstGuard=null,maxScalarAcceleration=0,maxWorldAcceleration=0,min=Infinity,guards=0,maxResidual=0,maxInfeasiblePairs=0,sumCruise=0,nCruise=0;const old=s.actors.map(a=>({speed:a.speed,v:a.velocity.slice()}));
 s.school.review=e=>{firstGuard??={...e,explanation:'Actual exact endpoint plane rate includes heading and rotated support; tangentUpperBound is not a nonlinear global-optimum certificate.'};};
 for(let f=0;f<7200;f++){
  const mode=['cruise','burst','turn','cruise','hover','cruise','rest','cruise'][Math.floor(f/900)];B.update(s,1/60,{mode});
  guards+=s.school.operations.safetyClamps;min=Math.min(min,s.contact.minimumClearance+s.shape.gap);maxResidual=Math.max(maxResidual,s.school.reviewMetricsResult.worst);maxInfeasiblePairs=Math.max(maxInfeasiblePairs,s.school.reviewMetricsResult.infeasible);
  for(let i=0;i<30;i++){const a=s.actors[i],p=old[i];maxScalarAcceleration=Math.max(maxScalarAcceleration,Math.abs(a.speed-p.speed)*60);maxWorldAcceleration=Math.max(maxWorldAcceleration,Math.hypot(...a.velocity.map((v,k)=>(v-p.v[k])*60)));p.speed=a.speed;p.v=a.velocity.slice();if(mode==='cruise'&&f>300){sumCruise+=a.speed;nCruise++;}}
 }
 const data={id,seed:723,seconds:120,environment,bounds:s.school.params.bounds,sameFullSourceHalf:s.actors[0].half,initialGap:s.school.params.initialGap,sourceGap:s.shape.gap,minFullBoxClearance:min,safetyClamps:guards,maxScalarAcceleration,maxWorldAcceleration,maxBarrierResidual:maxResidual,maxInfeasibleCachedPairs:maxInfeasiblePairs,meanCruiseSpeed:sumCruise/nCruise,finalMeanSpeed:s.actors.reduce((x,a)=>x+a.speed/30,0),firstGuard};experiments.push(data);console.log(JSON.stringify({...data,firstGuard:firstGuard?{time:firstGuard.time,i:firstGuard.i,j:firstGuard.j,remainingResidual:firstGuard.remainingResidual}:null}));
}
const sourceHashes=Object.fromEntries(['src/behavior.js','src/schooling-r08.js'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex')]));
fs.writeFileSync(path.join(base,'evidence/R08_ENVIRONMENT_ROOT_CAUSE.json'),JSON.stringify({schema:'fish.r08.environment-rca/1',taskId:anchor.taskId,createdAt:new Date().toISOString(),sourceHashes,status:'ROOT_CAUSE_REVIEW_MATCHED_EXPERIMENT',method:'Same source, seed, 30 actors, full envelope, initial positions/margins, modes, 120s; only solver bounds differ. Old-box failures are negative controls, not candidates.',experiments,visualAcceptance:false,productionReady:false},null,2));
