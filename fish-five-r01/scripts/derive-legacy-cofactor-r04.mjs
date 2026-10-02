// Root-cause review: algebraically equivalent rank-two cofactor, not a quality
// fallback. This file does not edit a shader or rebuild a production artifact.
import fs from 'node:fs';
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=v=>v.map(x=>x/Math.hypot(...v));let seed=44;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};let maxError=0,maxNormalAngle=0;
for(let sample=0;sample<100000;sample++){
 const u=[(rand()-.5)*.02,(rand()-.5)*.02,0],v=[0,0,rand()*.003],a=Array.from({length:3},()=> (rand()-.5)*250),b=Array.from({length:3},()=> (rand()-.5)*250),n=unit(Array.from({length:3},()=>rand()-.5)),J=[0,1,2].map(k=>[0,1,2].map(j=>(j===k?1:0)+u[j]*a[k]+v[j]*b[k]));
 const C=[cross(J[1],J[2]),cross(J[2],J[0]),cross(J[0],J[1])],full=[0,1,2].map(j=>C.reduce((s,col,k)=>s+col[j]*n[k],0)),uv=cross(u,v),rank=[0,1,2].map(k=>n[k]*(1+dot(a,u)+dot(b,v))-a[k]*dot(u,n)-b[k]*dot(v,n)+uv[k]*dot(cross(a,b),n));maxError=Math.max(maxError,...full.map((x,k)=>Math.abs(x-rank[k])));maxNormalAngle=Math.max(maxNormalAngle,Math.acos(Math.min(1,Math.max(-1,dot(unit(full),unit(rank)))))*180/Math.PI);
}
const report={schema:'FISH_R04_ROOT_CAUSE_RANK_TWO_COFACTOR',verifiedAt:new Date().toISOString(),samples:100000,maxError,maxNormalAngle,passed:maxError<1e-12&&maxNormalAngle<.00001,identity:'J=Rz(j)*(I+u*a^T+v*b^T); cofactor(A)n=(1+a.u+b.v)n-a(u.n)-b(v.n)+(u cross v)((a cross b).n)',productionModified:false};fs.writeFileSync('fish-five-r01/evidence/R04_RANK_TWO_COFACTOR_PROOF.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
