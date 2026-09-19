import fs from 'node:fs';
import * as K from './r045_round84_kernel.mjs';
import * as R83 from '../round-83/r045_round83_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const EXPECT=K.R84_CONTRACT,src=process.env.GITHUB_SHA||'local',PROOF=1.045,CLIFF=1.05,CAP=.012;
const q83=JSON.parse(fs.readFileSync(new URL('../round-83/r045_round83_qa_result.json',import.meta.url)));
if(!q83.passed)throw Error('R83 accepted baseline required');
const A=q83.audit,plan=A.plan,receiver=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12,cand=plan.filter(c=>c.accepted===true&&c.mask>.48&&c.dd>12&&!receiver(c.x,c.z));
const sk=(x,z)=>`${Number(x).toFixed(3)},${Number(z).toFixed(3)}`,samples=new Map();
for(const c of cand)for(const[xx,zz]of[[c.x,c.z],[c.x+3,c.z],[c.x-3,c.z],[c.x,c.z+3],[c.x,c.z-3]])samples.set(sk(xx,zz),{x:xx,z:zz});
let changed=[],groups=new Set(),riserAbs=[],benchAbs=[],midAbs=[],projected=0,maxChange=0,maxRequest=0,maxAllowance=0,hardLeak=0,receiverLeak=0;
for(const p of samples.values()){
 const r=K.r84CorrectionAt(p.x,p.z),old=R47.terraceStateAt(p.x,p.z),a=Math.abs(r.delta);maxRequest=Math.max(maxRequest,Math.abs(r.requested));maxAllowance=Math.max(maxAllowance,r.allowance);
 if(a>1e-7){changed.push({...p,change:r.delta,requested:r.requested,allowance:r.allowance,projected:r.projected,frac:old.frac,groupIndex:old.groupIndex,index:old.index,mask:old.mask,dd:R30.nearestExtendedDrainageDistance(p.x,p.z)});groups.add(old.groupIndex);maxChange=Math.max(maxChange,a);if(r.projected)projected++;if(R30.nearestExtendedDrainageDistance(p.x,p.z)<=12)hardLeak++;if(receiver(p.x,p.z))receiverLeak++}
 if(old.mask>.48&&R30.nearestExtendedDrainageDistance(p.x,p.z)>12&&!receiver(p.x,p.z)){
  if(Math.abs(old.frac-.5)<=.14)riserAbs.push(a);else if(old.frac<=.28||old.frac>=.72)benchAbs.push(a);else midAbs.push(a);
 }
}
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),quant=(a,q)=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*q,l=Math.floor(i),h=Math.ceil(i);return b[l]+(b[h]-b[l])*(i-l)};
const riserMean=mean(riserAbs),benchMean=mean(benchAbs),benchMax=benchAbs.length?Math.max(...benchAbs):0,concentration=riserMean/Math.max(1e-9,benchMean);
let maxInc=0,maxIncAt=null;for(const p of samples.values()){const c=K.terraceDelta(p.x,p.z);for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){const inc=Math.abs(K.terraceDelta(xx,zz)-c);if(inc>maxInc){maxInc=inc;maxIncAt={x:p.x,z:p.z,xx,zz,inc}}}}
let id=0,wire=0,nodeChanged=0;const nodeChanges=[];for(const c of cand){const n=K.terraceStateAt(c.x,c.z),p=R83.terraceStateAt(c.x,c.z),b=R47.terraceStateAt(c.x,c.z),d=n.delta-p.delta;if(Math.abs(d)>1e-7){nodeChanged++;nodeChanges.push({...c,change:d,projected:K.r84CorrectionAt(c.x,c.z).projected})}wire=Math.max(wire,Math.abs(d-K.r84CorrectionAt(c.x,c.z).delta));id=Math.max(id,Math.abs(n.mask-b.mask),Math.abs(n.step-b.step),Math.abs(n.phase-b.phase),Math.abs(n.index-b.index),Math.abs(n.base-b.base),Math.abs(n.groupIndex-b.groupIndex))}
const guards=[...plan.filter(c=>c.dd<=12).slice(0,16),...plan.filter(c=>c.mask<=.12&&c.dd>12).slice(0,16),...plan.filter(c=>receiver(c.x,c.z)).slice(0,16),...plan.filter(c=>c.mask>.48&&c.accepted!==true&&c.dd>12&&!receiver(c.x,c.z)).slice(0,16)];let guardLeak=0;for(const c of guards)guardLeak=Math.max(guardLeak,Math.abs(K.r84CorrectionAt(c.x,c.z).delta));
const checks=[],ck=(name,pass,value,limit)=>checks.push({name,pass:!!pass,value,limit});
ck('version_contract',K.VERSION==='R045.84'&&EXPECT==='R045.84-query-safe-riser-normal-concentration-v1',{version:K.VERSION,contract:EXPECT},'exact');
ck('accepted_r83',q83.passed&&q83.version==='R045.83',{passed:q83.passed,version:q83.version},'accepted R045.83');
ck('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R83.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R83.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact');
ck('carrier_identity',cand.length===q83.metrics.candidates,cand.length,q83.metrics.candidates);
ck('offgrid_materiality',changed.length>=18&&groups.size===3,{sampleCount:samples.size,changed:changed.length,groups:[...groups],nodeChanged},'>=18 changed query probes across 3 families');
ck('riser_concentration',riserAbs.length>=8&&riserMean>=.0008&&concentration>=4,{riserCount:riserAbs.length,benchCount:benchAbs.length,riserMean,benchMean,concentration},'>=0.8mm mean and >=4x bench mean');
ck('broad_bench_preservation',benchMax<=.0015,{benchMax,benchMedian:quant(benchAbs,.5)},'<=1.5mm added on broad benches');
ck('bounded_microprofile',maxChange<=CAP+1e-9&&maxRequest<=CAP+1e-9&&maxAllowance<=CAP+1e-9,{maxChange,maxRequest,maxAllowance,projected},'<=12mm');
ck('actual_3m_proof',maxInc<=PROOF+1e-6,{maxInc,maxIncAt,margin:CLIFF-maxInc},'<=1.045m');
ck('cliff_gate',maxInc<CLIFF,maxInc,'<1.05m');
ck('drainage_query_guards',hardLeak===0&&receiverLeak===0,{hardLeak,receiverLeak},'0');
ck('negative_guards',guardLeak<1e-12,guardLeak,'0');
ck('identity_wiring',wire<1e-10&&id<1e-10,{wire,id},'exact');
ck('accepted_long_carriers_preserved',(q83.metrics.runs||[]).length>=9,{runs:(q83.metrics.runs||[]).length,largest:(q83.metrics.runs||[])[0]||null},'>=9 inherited accepted long runs');
ck('locks_false',!K.snapshot.visualAcceptance&&!K.snapshot.parcelGenerationEnabled&&!K.snapshot.waterStateKnown&&!K.snapshot.productionReady,K.snapshot,'false');
ck('evidence_boundaries',K.snapshot.round84.logicCorrection.includes('not evidence')&&K.snapshot.round84.constraint.includes('cannot recover')&&K.snapshot.round84.xiaomaBoundary.includes('do not establish')&&K.snapshot.round84.mrRolordUse.includes('unavailable for replay')&&K.snapshot.round84.referenceUse.includes('non-metric'),K.snapshot.round84,'preserved');
const before=A.after.map(r=>r.slice()),after=before.map(r=>r.slice());for(const c of nodeChanges)after[c.j][c.i]=before[c.j][c.i]+c.change;
const passed=checks.every(c=>c.pass),metrics={candidates:cand.length,sampleCount:samples.size,changedQueries:changed.length,changedGroups:[...groups],nodeChanged,riserCount:riserAbs.length,benchCount:benchAbs.length,midCount:midAbs.length,riserMean,benchMean,benchMax,concentration,medianChanged:quant(changed.map(c=>Math.abs(c.change)),.5),p75Changed:quant(changed.map(c=>Math.abs(c.change)),.75),maxChange,maxRequest,maxAllowance,projected,maxInc,maxIncAt,hardLeak,receiverLeak,guardLeak,wireErr:wire,idErr:id,inheritedRuns:q83.metrics.runs||[],changedPoints:changed,nodeChangedPoints:nodeChanges};
const result={version:K.VERSION,qaContract:EXPECT,sourceSha:src,passed,gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics,audit:{...A,before,after,plan:plan.map(c=>({...c,r84Changed:nodeChanges.some(n=>n.i===c.i&&n.j===c.j)})),rivers:A.rivers},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round84_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:K.VERSION,passed,passedCount:result.passedCount,gateCount:result.gateCount,samples:samples.size,changedQueries:changed.length,groups:[...groups],nodeChanged,riserMean,benchMean,concentration,benchMax,maxChange,projected,maxInc,guardLeak},null,2));
if(!passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}
