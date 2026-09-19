import fs from 'node:fs';
import * as K from './r045_round83_kernel.mjs';
import * as R81 from '../round-81/r045_round81_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const EXPECT=K.R83_CONTRACT,src=process.env.GITHUB_SHA||'local',PROOF=1.045,CLIFF=1.05,CAP=.04;
const q81=JSON.parse(fs.readFileSync(new URL('../round-81/r045_round81_qa_result.json',import.meta.url)));
const q82=JSON.parse(fs.readFileSync(new URL('../round-82/r045_round82_qa_result.json',import.meta.url)));
if(!q81.passed)throw Error('R81 accepted baseline required');
const A=q81.audit,plan=A.plan,by=new Map(plan.map(c=>[`${c.i},${c.j}`,c])),receiver=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12,cand=plan.filter(c=>c.accepted===true&&c.mask>.48&&c.dd>12&&!receiver(c.x,c.z));
const opp=[],chg=[],groups=new Set(),abs=[],lo0=[],lo1=[],hi0=[],hi1=[];let maxChange=0,projected=0,maxAllowance=0;
for(const c of cand){
 const n=K.r83NodeDeltaAt(c.x,c.z),o=R81.r81NodeDeltaAt(c.x,c.z).orientation||0;
 if(Math.abs(n.requested)>1e-8&&n.allowance>1e-12){opp.push(c);if(n.projected)projected++;maxAllowance=Math.max(maxAllowance,n.allowance)}
 if(Math.abs(n.delta)>1e-7){chg.push({...c,change:n.delta,requested:n.requested,allowance:n.allowance,projected:n.projected});groups.add(c.groupIndex);abs.push(Math.abs(n.delta));maxChange=Math.max(maxChange,Math.abs(n.delta))}
 if(o){const a=o*(R81.terraceDelta(c.x,c.z)-R78.terraceDelta(c.x,c.z)),b=o*(K.terraceDelta(c.x,c.z)-R78.terraceDelta(c.x,c.z));if(c.frac<.44){lo0.push(a);lo1.push(b)}else if(c.frac>.56){hi0.push(a);hi1.push(b)}}
}
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),quant=(a,q)=>{if(!a.length)return 0;let b=[...a].sort((x,y)=>x-y),i=(b.length-1)*q,l=Math.floor(i),h=Math.ceil(i);return b[l]+(b[h]-b[l])*(i-l)},priorContrast=mean(hi0)-mean(lo0),currentContrast=mean(hi1)-mean(lo1),contrastGain=currentContrast-priorContrast,contrastRatio=priorContrast>1e-12?currentContrast/priorContrast:0;
const keys=new Set(chg.map(c=>`${c.i},${c.j}`)),seen=new Set(),runs=[];
for(const c of chg){let k=`${c.i},${c.j}`;if(seen.has(k))continue;let st=[c],comp=[];seen.add(k);while(st.length){let a=st.pop();comp.push(a);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;let n=by.get(`${a.i+di},${a.j+dj}`),nk=n&&`${n.i},${n.j}`;if(!n||seen.has(nk)||!keys.has(nk)||n.groupIndex!==a.groupIndex||n.index!==a.index)continue;seen.add(nk);st.push(n)}}let span=0;for(const a of comp)for(const b of comp)span=Math.max(span,Math.hypot(a.x-b.x,a.z-b.z));if(comp.length>=6&&span>=30)runs.push({cells:comp.length,span,groupIndex:c.groupIndex,index:c.index})}
runs.sort((a,b)=>b.cells-a.cells||b.span-a.span);
let maxInc=0,maxIncAt=null,probeHard=0,probeReceiver=0,maxProbeAdded=0,maxRequestAmplification=0;const probeSeen=new Set();
// Check every accepted carrier node, not just changed nodes. R83's claim is a
// query-local 3 m safety invariant, so midpoint probes are part of the authority.
for(const p of cand){
 const c=K.terraceDelta(p.x,p.z);
 for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){
  const inc=Math.abs(K.terraceDelta(xx,zz)-c);if(inc>maxInc){maxInc=inc;maxIncAt={x:p.x,z:p.z,xx,zz,inc}}
  const pk=`${xx},${zz}`;if(probeSeen.has(pk))continue;probeSeen.add(pk);
  const d=Math.abs(K.terraceDelta(xx,zz)-R81.terraceDelta(xx,zz));maxProbeAdded=Math.max(maxProbeAdded,d);
  const req=Math.abs(K.r83RequestedFieldAt(xx,zz));if(req>CAP)maxRequestAmplification=Math.max(maxRequestAmplification,req-CAP);
  if(d>1e-7){if(R30.nearestExtendedDrainageDistance(xx,zz)<=12)probeHard++;if(receiver(xx,zz))probeReceiver++}
 }
}
let wire=0,id=0;for(const c of chg.slice(0,16)){let n=K.terraceStateAt(c.x,c.z),p=R81.terraceStateAt(c.x,c.z),b=R47.terraceStateAt(c.x,c.z);wire=Math.max(wire,Math.abs((n.delta-p.delta)-c.change));id=Math.max(id,Math.abs(n.mask-b.mask),Math.abs(n.step-b.step),Math.abs(n.phase-b.phase),Math.abs(n.index-b.index),Math.abs(n.base-b.base),Math.abs(n.groupIndex-b.groupIndex))}
const guards=[...plan.filter(c=>c.dd<=12).slice(0,12),...plan.filter(c=>c.mask<=.12&&c.dd>12).slice(0,12),...plan.filter(c=>receiver(c.x,c.z)).slice(0,12),...plan.filter(c=>c.mask>.48&&c.accepted!==true&&c.dd>12&&!receiver(c.x,c.z)).slice(0,12)];let leak=0;for(const c of guards)leak=Math.max(leak,Math.abs(K.r83NodeDeltaAt(c.x,c.z).delta));
const prior82Max=q82.metrics?.maxInc||0,checks=[],ck=(name,pass,value,limit)=>checks.push({name,pass:!!pass,value,limit});
ck('version_contract',K.VERSION==='R045.83'&&EXPECT==='R045.83-query-safe-3m-envelope-v1',{version:K.VERSION,contract:EXPECT},'exact');
ck('accepted_r81',q81.passed,q81.version,'accepted');
ck('failed_r82_repaired',q82.passed===false&&prior82Max>=CLIFF&&maxInc<=PROOF+1e-6,{r82MaxInc:prior82Max,r83MaxInc:maxInc,r82Passed:q82.passed},'R82 >=1.05 and failed; R83 <=1.045');
ck('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R81.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R81.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact');
ck('bounded_carrier',cand.length>=90&&cand.length<=160,cand.length,'90..160');
ck('distributed_materiality',opp.length>=cand.length*.65&&chg.length>=cand.length*.65&&chg.length/Math.max(1,opp.length)>=.9,{candidates:cand.length,opportunities:opp.length,changed:chg.length,coverage:chg.length/cand.length,realization:chg.length/Math.max(1,opp.length)},'>=65% coverage, >=90% realization');
ck('three_families',groups.size===3,[...groups],'3');
ck('contrast_gain',priorContrast>0&&contrastRatio>=1.5&&contrastGain>=.003,{priorContrast,currentContrast,contrastGain,contrastRatio},'>=1.5x and >=3mm');
ck('distributed_signal',quant(abs,.5)>=.004&&quant(abs,.75)>=.008,{median:quant(abs,.5),p75:quant(abs,.75),max:maxChange},'>=4/8mm');
ck('continuity',runs.length>=Math.max(2,(q81.metrics.runs||[]).length-1),{count:runs.length,prior:(q81.metrics.runs||[]).length,largest:runs[0]||null},'no material regression');
ck('identity_wiring',wire<1e-10&&id<1e-10,{wire,id},'exact');
ck('negative_guards',leak<1e-12,leak,'0');
ck('node_and_allowance_caps',maxChange<=CAP+1e-9&&maxAllowance<=CAP+1e-9,{maxChange,maxAllowance,projected},'<=0.04m');
ck('query_request_nonamplifying',maxRequestAmplification<1e-12,maxRequestAmplification,'0');
ck('actual_3m_proof',maxInc<=PROOF+1e-6,{maxInc,maxIncAt,margin:CLIFF-maxInc},'<=1.045');
ck('cliff_gate',maxInc<CLIFF,maxInc,'<1.05');
ck('drainage_probes',probeHard===0&&probeReceiver===0,{probeHard,probeReceiver,maxProbeAdded},'0');
ck('locks_false',!K.snapshot.visualAcceptance&&!K.snapshot.parcelGenerationEnabled&&!K.snapshot.waterStateKnown&&!K.snapshot.productionReady,K.snapshot,'false');
ck('evidence_boundaries',K.snapshot.round83.logicCorrection.includes('renormalized interpolation')&&K.snapshot.round83.constraint.includes('cannot recover')&&K.snapshot.round83.xiaomaBoundary.includes('do not establish')&&K.snapshot.round83.mrRolordUse.includes('not available to replay')&&K.snapshot.round83.referenceUse.includes('non-metric'),K.snapshot.round83,'preserved');
const after=A.after.map(r=>r.slice());for(const c of chg)after[c.j][c.i]=A.after[c.j][c.i]+c.change;
const passed=checks.every(c=>c.pass),metrics={candidates:cand.length,opportunities:opp.length,changed:chg.length,coverage:chg.length/cand.length,changedGroups:[...groups],projected,maxAllowance,maxChange,medianAdded:quant(abs,.5),p75Added:quant(abs,.75),priorContrast,currentContrast,contrastGain,contrastRatio,runs,maxInc,maxIncAt,prior82Max,probeHard,probeReceiver,maxProbeAdded,maxRequestAmplification,guardLeak:leak,wireErr:wire,changedPoints:chg,opportunityPoints:opp.map(c=>({x:c.x,z:c.z,mask:c.mask,frac:c.frac,groupIndex:c.groupIndex,index:c.index,dd:c.dd}))};
const result={version:K.VERSION,qaContract:EXPECT,sourceSha:src,passed,gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics,audit:{...A,before:A.after,after,plan:plan.map(c=>({...c,r83Changed:keys.has(`${c.i},${c.j}`)})),rivers:A.rivers},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round83_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:K.VERSION,passed,passedCount:result.passedCount,gateCount:result.gateCount,candidates:cand.length,opportunities:opp.length,changed:chg.length,coverage:metrics.coverage,projected,maxChange,medianAdded:metrics.medianAdded,p75Added:metrics.p75Added,contrastRatio,longRuns:runs.length,largest:runs[0]||null,prior82Max,maxInc,probeHard,probeReceiver,leak},null,2));
if(!passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}
