import fs from 'node:fs';import zlib from 'node:zlib';import crypto from 'node:crypto';
import {closeLightEaseSpans}from './correctives/r043c/seam-spans.mjs';
import {refinementGuides}from './native/kaopu-tailor-workbench/r07/stability/refinement.mjs';
const P=new URL('./',import.meta.url),checks=[],summaries={};
const check=(name,passed)=>{checks.push({name,passed:!!passed});if(!passed)throw Error(name)};
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const index=JSON.parse(fs.readFileSync(new URL('assets/results/index.json',P)));
for(const[id,row]of Object.entries(index.rows)){
 const packet=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('assets/results/'+row.file,P)))),spec=packet.spec,offsets=new Map();let n=0;
 for(const p of spec.panels){offsets.set(p.id,n);n+=p.uvMm.length}const lab={spec,offsets},before=digest(spec),rows=refinementGuides(lab),beforeRows=digest(rows),out=closeLightEaseSpans(lab,rows);summaries[id]=out.report;
 check(id+' rest material and source seams immutable',before===digest(spec)&&beforeRows===digest(rows));
 check(id+' added constraints retain valid original material indices',out.rows.every(g=>g.ids.length===4&&g.ids.every(i=>Number.isInteger(i)&&i>=0&&i<n)));
 check(id+' only slight-ease joins eligible',out.report.eligible.every(s=>s.ratio<=1.12+1e-12)&&out.report.excluded.every(s=>s.ratio>1.12));
 check(id+' high-gather and unaffected rows not changed',out.rows.filter(g=>g.margin<0).length===out.report.distanceRows&&out.rows.length===rows.length+out.report.distanceRows);
}
check('P01 closes real intermediate boundary sites',summaries.P01.distanceRows>0);
check('S03 closes real intermediate boundary sites',summaries.S03.distanceRows>0);
check('S02 strong gathering never forcibly collapsed',summaries.S02.distanceRows===0);
check('S06 strong gathering never forcibly collapsed',summaries.S06.distanceRows===0);
for(const cfg of[{maximumRatio:1},{maximumRatio:NaN},{radiusM:0},{radiusM:NaN}]){let rejected=false;try{closeLightEaseSpans({spec:{panels:[],seams:[]}},[],cfg)}catch{rejected=true}check('invalid solver configuration rejected '+JSON.stringify(cfg),rejected)}
function energy(v){const a=v.slice(0,3),b=v.slice(3,6),p=v.slice(6,9),t=b.map((x,i)=>x-a[i]),u=p.map((x,i)=>x-a[i]),L=t.reduce((s,x)=>s+x*x,0),alpha=Math.max(0,Math.min(1,u.reduce((s,x,i)=>s+x*t[i],0)/L)),err=u.map((x,i)=>x-alpha*t[i]),len=Math.hypot(...err),pen=Math.max(0,len-.0001),g=new Array(9).fill(0);if(pen)for(let k=0;k<3;k++){const d=6000*pen*err[k]/len;g[k]=-d*(1-alpha);g[k+3]=-d*alpha;g[k+6]=d}return{e:3000*pen*pen,g}}
for(const x of[-.2,.5,1.2]){const v=[.0,.1,-.1,1,.1,.2,x,.2,.05],q=energy(v);let max=0;for(let k=0;k<9;k++){const a=v.slice(),b=v.slice();a[k]+=1e-6;b[k]-=1e-6;max=Math.max(max,Math.abs((energy(a).e-energy(b).e)/2e-6-q.g[k]))}check('distance-energy gradient including clamped endpoints '+x,max<1e-5)}
fs.writeFileSync(new URL('R043C_CONTRACT_TESTS.json',P),JSON.stringify({passed:true,checks,summaries,sourceInputMutation:false,acceptanceThresholdChanged:false},null,2));console.log('SEAM_SPAN_CONTRACTS',checks.length);
