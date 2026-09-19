import fs from 'node:fs';
import * as K from './r045_round84_kernel.mjs';
import * as R83 from '../round-83/r045_round83_kernel.mjs';
const q=JSON.parse(fs.readFileSync(new URL('./r045_round84_qa_result.json',import.meta.url),'utf8'));
if(!q.audit?.plan||!q.audit?.rivers)throw new Error('R84 audit inputs missing');
const A=q.audit,m=q.metrics||{},nx=96,nz=56,before=[],after=[];
for(let j=0;j<=nz;j++){const z=A.z0+(A.z1-A.z0)*j/nz,br=[],ar=[];for(let i=0;i<=nx;i++){const x=A.x0+(A.x1-A.x0)*i/nx;br.push(R83.height(x,z));ar.push(K.height(x,z))}before.push(br);after.push(ar)}
let mn=Infinity,mx=-Infinity,maxDense=0,denseChanged=0;for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){mn=Math.min(mn,before[j][i],after[j][i]);mx=Math.max(mx,before[j][i],after[j][i]);const d=Math.abs(after[j][i]-before[j][i]);maxDense=Math.max(maxDense,d);if(d>.0005)denseChanged++}
const data={version:q.version,qaContract:q.qaContract,sourceSha:q.sourceSha,terrain:{x0:A.x0,x1:A.x1,z0:A.z0,z1:A.z1,nx,nz,before,after,sharedMin:mn,sharedMax:mx},rivers:A.rivers,planSpec:A.planSpec,plan:A.plan,exactChanges:m.changedPoints||[],nodeChanges:m.nodeChangedPoints||[],state:{qaPassed:q.passed===true,candidates:m.candidates||0,sampleCount:m.sampleCount||0,changedQueries:m.changedQueries||0,nodeChanged:m.nodeChanged||0,riserMean:m.riserMean||0,benchMean:m.benchMean||0,concentration:m.concentration||0,benchMax:m.benchMax||0,maxChange:m.maxChange||0,projected:m.projected||0,maxInc:m.maxInc||0,maxDense,denseChanged,visualAcceptance:false},generatedAt:new Date().toISOString(),source:'R045.84 fixed-view diagnostic: accepted R045.83 versus query-safe zero-mean riser toe/crest concentration. A/B use one shared height range and the same hillshade light; orange marks actual off-grid query changes. A browser pass is rendering evidence only, not visual morphology acceptance.'};
fs.writeFileSync(new URL('./r045_round84_audit_cache.mjs',import.meta.url),`export const AUDIT=${JSON.stringify(data)};\n`);
console.log(JSON.stringify(data.state,null,2));
