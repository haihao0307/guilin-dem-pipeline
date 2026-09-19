import fs from 'node:fs';
import * as K from './r045_round60_kernel.mjs';
import * as B from '../round-58/r045_round58_kernel.mjs';
const x0=-222,x1=114,z0=-132,z1=12,step=12,nx=(x1-x0)/step,nz=(z1-z0)/step,before=[],after=[];
for(let j=0;j<=nz;j++){const z=z0+j*step,rb=[],ra=[];for(let i=0;i<=nx;i++){const x=x0+i*step;rb.push(B.height(x,z));ra.push(K.height(x,z))}before.push(rb);after.push(ra)}
const rivers=[];for(let x=x0;x<=x1+.01;x+=24){const z=K.riverZ(x);rivers.push([x,z,B.height(x,z)+.28,K.height(x,z)+.28])}
let qr={metrics:{changedPoints:[]}};try{qr=JSON.parse(fs.readFileSync(new URL('./r045_round60_qa_result.json',import.meta.url),'utf8'))}catch{}
const exactChanges=(qr.metrics?.changedPoints||[]).filter(p=>Math.abs(p.change)>1e-6);
const plan=[];for(let z=z0;z<=z1;z+=6)for(let x=x0;x<=x1;x+=6){const n=K.terraceStateAt(x,z),p=B.terraceStateAt(x,z);plan.push({x,z,mask:n.mask,priorMask:p.mask,groupIndex:n.groupIndex,frac:n.frac,dd:K.nearestExtendedDrainageDistance(x,z),gain:n.contourRunGain||0,span:n.contourRunSupport?.span||0,forward:n.contourRunSupport?.d1||0})}
const data={version:K.VERSION,terrain:{x0,x1,z0,z1,nx,nz,before,after},rivers,plan,exactChanges,metrics:qr.metrics||{},generatedAt:new Date().toISOString(),source:'R045.60 fixed view: A=accepted R58, B=frozen-R58 contour endpoint extrapolation; orange markers are authoritative 6m promotions; blue-grey preserves hard drainage core'};
fs.writeFileSync(new URL('./r045_round60_audit_cache.mjs',import.meta.url),`export const AUDIT=${JSON.stringify(data)};\n`);console.log(JSON.stringify({version:data.version,terrainVertices:(nx+1)*(nz+1),planCells:plan.length,exactChanges:exactChanges.length},null,2));
