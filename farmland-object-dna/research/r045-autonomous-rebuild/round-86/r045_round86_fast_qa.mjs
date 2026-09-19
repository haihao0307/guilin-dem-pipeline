import fs from 'node:fs';
import * as K from './r045_round86_kernel.mjs';
import * as R84 from '../round-84/r045_round84_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const EXPECT=K.R86_CONTRACT,src=process.env.GITHUB_SHA||'local',PROOF=1.045,CLIFF=1.05,CAP=.012;
const q84=JSON.parse(fs.readFileSync(new URL('../round-84/r045_round84_qa_result.json',import.meta.url)));
const q85=JSON.parse(fs.readFileSync(new URL('../round-85/r045_round85_qa_result.json',import.meta.url)));
if(!q84.passed)throw Error('R84 accepted baseline required');
const A=q84.audit,plan=A.plan,receiver=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12,cand=plan.filter(c=>c.accepted===true&&c.mask>.48&&c.dd>12&&!receiver(c.x,c.z));
const sk=(x,z)=>`${Number(x).toFixed(3)},${Number(z).toFixed(3)}`,samples=new Map();
for(const c of cand)for(const[xx,zz]of[[c.x,c.z],[c.x+3,c.z],[c.x-3,c.z],[c.x,c.z+3],[c.x,c.z-3]])samples.set(sk(xx,zz),{x:xx,z:zz});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/(a.length||1)),quant=(a,q)=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),i=(b.length-1)*q,l=Math.floor(i),h=Math.ceil(i);return b[l]+(b[h]-b[l])*(i-l)};
const side=f=>f<=.34?-1:f>=.66?1:0;
let changed=[],groups=new Set(),sides=new Set(),projected=0,maxChange=0,maxRequest=0,maxAllowance=0,hardLeak=0,receiverLeak=0,sumDelta=0,sumAbs=0,maxMidRiserLeak=0;
for(const p of samples.values()){
 const r=K.r86CorrectionAt(p.x,p.z),old=R47.terraceStateAt(p.x,p.z),a=Math.abs(r.delta);maxRequest=Math.max(maxRequest,Math.abs(r.requested));maxAllowance=Math.max(maxAllowance,r.allowance);
 if(old.frac>=.40&&old.frac<=.60)maxMidRiserLeak=Math.max(maxMidRiserLeak,a);
 if(a>1e-7){changed.push({...p,change:r.delta,requested:r.requested,allowance:r.allowance,projected:r.projected,benchSide:r.benchSide,neighborCount:r.neighborCount,localResidual:r.localResidual,frac:old.frac,groupIndex:old.groupIndex,index:old.index,mask:old.mask,dd:R30.nearestExtendedDrainageDistance(p.x,p.z)});groups.add(old.groupIndex);sides.add(r.benchSide);maxChange=Math.max(maxChange,a);if(r.projected)projected++;if(R30.nearestExtendedDrainageDistance(p.x,p.z)<=12)hardLeak++;if(receiver(p.x,p.z))receiverLeak++;sumDelta+=r.delta;sumAbs+=a}
}
// Authoritative objective: real +/-3 m pairs that stay on one broad-bench side,
// same family and exact stair. Each undirected pair is counted once.
let benchPairs=[],beforeGrad=[],afterGrad=[],improvedPairs=0,worsenedPairs=0;const seen=new Set();
for(const c of cand){const a=R47.terraceStateAt(c.x,c.z);for(const[xx,zz]of[[c.x+3,c.z],[c.x-3,c.z],[c.x,c.z+3],[c.x,c.z-3]]){const b=R47.terraceStateAt(xx,zz),sa=side(a.frac),sb=side(b.frac);if(!sa||sa!==sb)continue;if(a.groupIndex!==b.groupIndex||a.index!==b.index)continue;if(R30.nearestExtendedDrainageDistance(xx,zz)<=12||receiver(xx,zz))continue;const p0=sk(c.x,c.z),p1=sk(xx,zz),pk=p0<p1?`${p0}|${p1}`:`${p1}|${p0}`;if(seen.has(pk))continue;seen.add(pk);const gb=Math.abs(R84.terraceDelta(c.x,c.z)-R84.terraceDelta(xx,zz)),ga=Math.abs(K.terraceDelta(c.x,c.z)-K.terraceDelta(xx,zz));benchPairs.push({x:c.x,z:c.z,xx,zz,before:gb,after:ga,side:sa,groupIndex:a.groupIndex,index:a.index});beforeGrad.push(gb);afterGrad.push(ga);if(ga<gb-1e-9)improvedPairs++;else if(ga>gb+1e-9)worsenedPairs++}}
const benchBefore=mean(beforeGrad),benchAfter=mean(afterGrad),benchRatio=benchAfter/Math.max(1e-12,benchBefore),energyBefore=rms(beforeGrad),energyAfter=rms(afterGrad),energyRatio=energyAfter/Math.max(1e-12,energyBefore);
let maxInc=0,maxIncAt=null;for(const p of samples.values()){const c=K.terraceDelta(p.x,p.z);for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){const inc=Math.abs(K.terraceDelta(xx,zz)-c);if(inc>maxInc){maxInc=inc;maxIncAt={x:p.x,z:p.z,xx,zz,inc}}}}
let id=0,wire=0,nodeChanged=0;const nodeChanges=[];for(const c of cand){const n=K.terraceStateAt(c.x,c.z),p=R84.terraceStateAt(c.x,c.z),b=R47.terraceStateAt(c.x,c.z),d=n.delta-p.delta;if(Math.abs(d)>1e-7){nodeChanged++;nodeChanges.push({...c,change:d,projected:K.r86CorrectionAt(c.x,c.z).projected,benchSide:K.r86CorrectionAt(c.x,c.z).benchSide})}wire=Math.max(wire,Math.abs(d-K.r86CorrectionAt(c.x,c.z).delta));id=Math.max(id,Math.abs(n.mask-b.mask),Math.abs(n.step-b.step),Math.abs(n.phase-b.phase),Math.abs(n.index-b.index),Math.abs(n.base-b.base),Math.abs(n.groupIndex-b.groupIndex))}
const guards=[...plan.filter(c=>c.dd<=12).slice(0,16),...plan.filter(c=>c.mask<=.12&&c.dd>12).slice(0,16),...plan.filter(c=>receiver(c.x,c.z)).slice(0,16),...plan.filter(c=>c.mask>.48&&c.accepted!==true&&c.dd>12&&!receiver(c.x,c.z)).slice(0,16)];let guardLeak=0;for(const c of guards)guardLeak=Math.max(guardLeak,Math.abs(K.r86CorrectionAt(c.x,c.z).delta));
const r85Fail=(q85.checks||[]).find(c=>c.name==='broad_bench_flattening');
const checks=[],ck=(name,pass,value,limit)=>checks.push({name,pass:!!pass,value,limit});
ck('version_contract',K.VERSION==='R045.86'&&EXPECT==='R045.86-query-safe-identity-bench-laplacian-v1',{version:K.VERSION,contract:EXPECT},'exact');
ck('accepted_r84',q84.passed&&q84.version==='R045.84',{passed:q84.passed,version:q84.version},'accepted R045.84');
ck('r85_failure_is_diagnostic_not_baseline',q85.passed===false&&r85Fail?.pass===false,{r85Passed:q85.passed,r85BenchGate:r85Fail||null},'R85 failed broad_bench_flattening');
ck('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R84.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R84.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact');
ck('carrier_identity',cand.length===q84.metrics.candidates,cand.length,q84.metrics.candidates);
ck('distributed_materiality',changed.length>=40&&nodeChanged>=24&&groups.size===3&&sides.has(-1)&&sides.has(1),{sampleCount:samples.size,changed:changed.length,nodeChanged,groups:[...groups],sides:[...sides]},'>=40 changed queries, >=24 nodes, 3 families, both bench sides');
ck('broad_bench_pair_domain',benchPairs.length>=24,{pairs:benchPairs.length,beforeMean:benchBefore,afterMean:benchAfter},'>=24 same-identity broad-bench 3m pairs');
ck('broad_bench_flattening',benchBefore>1e-6&&benchRatio<=.97,{beforeMean:benchBefore,afterMean:benchAfter,ratio:benchRatio,improvement:1-benchRatio},'candidate mean <=97% predecessor');
ck('broad_bench_energy_reduction',energyBefore>1e-6&&energyRatio<=.97,{beforeRms:energyBefore,afterRms:energyAfter,ratio:energyRatio,improvement:1-energyRatio},'candidate RMS <=97% predecessor');
ck('pair_direction_consistency',improvedPairs>worsenedPairs,{improvedPairs,worsenedPairs,unchanged:benchPairs.length-improvedPairs-worsenedPairs},'improved pairs > worsened pairs');
ck('riser_lock',maxMidRiserLeak<1e-12,maxMidRiserLeak,'0 correction for frac 0.40..0.60');
ck('balanced_relaxation',sumAbs>0&&Math.abs(sumDelta)/sumAbs<=.45,{sumDelta,sumAbs,balanceRatio:Math.abs(sumDelta)/Math.max(1e-12,sumAbs)},'net absolute bias <=45% of moved magnitude');
ck('bounded_relaxation',maxChange<=CAP+1e-9&&maxRequest<=CAP+1e-9&&maxAllowance<=CAP+1e-9,{maxChange,maxRequest,maxAllowance,projected},'<=12mm');
ck('actual_3m_proof',maxInc<=PROOF+1e-6,{maxInc,maxIncAt,margin:CLIFF-maxInc},'<=1.045m');
ck('cliff_gate',maxInc<CLIFF,maxInc,'<1.05m');
ck('drainage_query_guards',hardLeak===0&&receiverLeak===0,{hardLeak,receiverLeak},'0');
ck('negative_guards',guardLeak<1e-12,guardLeak,'0');
ck('identity_wiring',wire<1e-10&&id<1e-10,{wire,id},'exact');
ck('accepted_long_carriers_preserved',(q84.metrics.inheritedRuns||[]).length>=9,{runs:(q84.metrics.inheritedRuns||[]).length,largest:(q84.metrics.inheritedRuns||[])[0]||null},'>=9 inherited accepted long runs');
ck('locks_false',!K.snapshot.visualAcceptance&&!K.snapshot.parcelGenerationEnabled&&!K.snapshot.waterStateKnown&&!K.snapshot.productionReady,K.snapshot,'false');
ck('evidence_boundaries',K.snapshot.round86.logicCorrection.includes('did not establish')&&K.snapshot.round86.constraint.includes('cannot recover')&&K.snapshot.round86.xiaomaBoundary.includes('do not establish')&&K.snapshot.round86.mrRolordUse.includes('unavailable for replay')&&K.snapshot.round86.referenceUse.includes('non-metric'),K.snapshot.round86,'preserved');
const before=A.after.map(r=>r.slice()),after=before.map(r=>r.slice());for(const c of nodeChanges)after[c.j][c.i]=before[c.j][c.i]+c.change;
const passed=checks.every(c=>c.pass),metrics={candidates:cand.length,sampleCount:samples.size,changedQueries:changed.length,changedGroups:[...groups],changedSides:[...sides],nodeChanged,medianChanged:quant(changed.map(c=>Math.abs(c.change)),.5),p75Changed:quant(changed.map(c=>Math.abs(c.change)),.75),maxChange,maxRequest,maxAllowance,projected,sumDelta,sumAbs,balanceRatio:Math.abs(sumDelta)/Math.max(1e-12,sumAbs),benchPairCount:benchPairs.length,benchBeforeMean:benchBefore,benchAfterMean:benchAfter,benchGradientRatio:benchRatio,benchImprovement:1-benchRatio,benchBeforeRms:energyBefore,benchAfterRms:energyAfter,benchEnergyRatio:energyRatio,benchEnergyImprovement:1-energyRatio,improvedPairs,worsenedPairs,maxMidRiserLeak,maxInc,maxIncAt,hardLeak,receiverLeak,guardLeak,wireErr:wire,idErr:id,inheritedRuns:q84.metrics.inheritedRuns||[],changedPoints:changed,nodeChangedPoints:nodeChanges,benchPairs,r85Diagnostic:{passed:q85.passed,benchGate:r85Fail||null}};
const result={version:K.VERSION,qaContract:EXPECT,sourceSha:src,passed,gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics,audit:{...A,before,after,plan:plan.map(c=>({...c,r86Changed:nodeChanges.some(n=>n.i===c.i&&n.j===c.j)})),rivers:A.rivers},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round86_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:K.VERSION,passed,passedCount:result.passedCount,gateCount:result.gateCount,samples:samples.size,changedQueries:changed.length,nodeChanged,groups:[...groups],sides:[...sides],benchPairs:benchPairs.length,benchBefore,benchAfter,benchRatio,energyRatio,improvedPairs,worsenedPairs,balanceRatio:metrics.balanceRatio,maxChange,projected,maxInc,guardLeak},null,2));
if(!passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}
