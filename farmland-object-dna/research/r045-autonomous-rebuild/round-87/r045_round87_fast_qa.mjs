import fs from 'node:fs';
import * as K from './r045_round87_kernel.mjs';
import * as R86 from '../round-86/r045_round86_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const EXPECT=K.R87_CONTRACT,src=process.env.GITHUB_SHA||'local',PROOF=1.045,CLIFF=1.05,CAP=.006,EPS=1e-6;
const q86=JSON.parse(fs.readFileSync(new URL('../round-86/r045_round86_qa_result.json',import.meta.url)));
if(!q86.passed)throw Error('R86 accepted baseline required');
const A=q86.audit,plan=A.plan,receiver=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12,cand=plan.filter(c=>c.accepted===true&&c.mask>.48&&c.dd>12&&!receiver(c.x,c.z));
const sk=(x,z)=>`${Number(x).toFixed(3)},${Number(z).toFixed(3)}`,samples=new Map();
for(const c of cand)for(const[xx,zz]of[[c.x,c.z],[c.x+3,c.z],[c.x-3,c.z],[c.x,c.z+3],[c.x,c.z-3]])samples.set(sk(xx,zz),{x:xx,z:zz});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),rms=a=>Math.sqrt(a.reduce((s,v)=>s+v*v,0)/(a.length||1));
const side=f=>f<=.34?-1:f>=.66?1:0;
let changed=[],groups=new Set(),sides=new Set(),projected=0,maxChange=0,maxRequest=0,maxAllowance=0,hardLeak=0,receiverLeak=0,sumDelta=0,sumAbs=0;
for(const p of samples.values()){
 const r=K.r87CorrectionAt(p.x,p.z),old=R47.terraceStateAt(p.x,p.z),a=Math.abs(r.delta);maxRequest=Math.max(maxRequest,Math.abs(r.requested));maxAllowance=Math.max(maxAllowance,r.allowance||0);
 if(a>1e-7){changed.push({...p,change:r.delta,requested:r.requested,allowance:r.allowance,pairCap:r.pairCap,projected:r.projected,reason:r.reason,benchSide:r.benchSide,neighborCount:r.neighborCount,localResidual:r.localResidual,frac:old.frac,groupIndex:old.groupIndex,index:old.index,mask:old.mask,dd:R30.nearestExtendedDrainageDistance(p.x,p.z)});groups.add(old.groupIndex);sides.add(r.benchSide);maxChange=Math.max(maxChange,a);if(r.projected)projected++;if(R30.nearestExtendedDrainageDistance(p.x,p.z)<=12)hardLeak++;if(receiver(p.x,p.z))receiverLeak++;sumDelta+=r.delta;sumAbs+=a}
}
let benchPairs=[],beforeGrad=[],afterGrad=[],improvedPairs=0,worsenedPairs=0;const benchSeen=new Set();
for(const c of cand){const a=R47.terraceStateAt(c.x,c.z);for(const[xx,zz]of[[c.x+3,c.z],[c.x-3,c.z],[c.x,c.z+3],[c.x,c.z-3]]){const b=R47.terraceStateAt(xx,zz),sa=side(a.frac),sb=side(b.frac);if(!sa||sa!==sb||a.groupIndex!==b.groupIndex||a.index!==b.index)continue;if(R30.nearestExtendedDrainageDistance(xx,zz)<=12||receiver(xx,zz))continue;const p0=sk(c.x,c.z),p1=sk(xx,zz),pk=p0<p1?`${p0}|${p1}`:`${p1}|${p0}`;if(benchSeen.has(pk))continue;benchSeen.add(pk);const gb=Math.abs(R86.terraceDelta(c.x,c.z)-R86.terraceDelta(xx,zz)),ga=Math.abs(K.terraceDelta(c.x,c.z)-K.terraceDelta(xx,zz));benchPairs.push({x:c.x,z:c.z,xx,zz,before:gb,after:ga,side:sa,groupIndex:a.groupIndex,index:a.index,touched:Math.abs(K.r87CorrectionAt(c.x,c.z).delta)>1e-7||Math.abs(K.r87CorrectionAt(xx,zz).delta)>1e-7});beforeGrad.push(gb);afterGrad.push(ga);if(ga<gb-1e-9)improvedPairs++;else if(ga>gb+1e-9)worsenedPairs++}}
const benchBefore=mean(beforeGrad),benchAfter=mean(afterGrad),benchRatio=benchAfter/Math.max(1e-12,benchBefore),energyBefore=rms(beforeGrad),energyAfter=rms(afterGrad),energyRatio=energyAfter/Math.max(1e-12,energyBefore);
let pairSeen=new Set(),allPairs=[],changedPairCount=0,newProofViolation=0,newCliffViolation=0,inheritedUnsafeTouched=0,inheritedUnsafeWorsened=0,maxBeforeInc=0,maxAfterInc=0,maxGlobalWorsening=-Infinity,maxGlobalWorseningAt=null,maxBeforeAt=null;
for(const p of samples.values())for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){
 const p0=sk(p.x,p.z),p1=sk(xx,zz),pk=p0<p1?`${p0}|${p1}`:`${p1}|${p0}`;if(pairSeen.has(pk))continue;pairSeen.add(pk);
 const b=Math.abs(R86.terraceDelta(p.x,p.z)-R86.terraceDelta(xx,zz)),a=Math.abs(K.terraceDelta(p.x,p.z)-K.terraceDelta(xx,zz)),d0=Math.abs(K.r87CorrectionAt(p.x,p.z).delta),d1=Math.abs(K.r87CorrectionAt(xx,zz).delta),touched=d0>1e-7||d1>1e-7,w=a-b,sa=R47.terraceStateAt(p.x,p.z),sb=R47.terraceStateAt(xx,zz);
 const rec={x:p.x,z:p.z,xx,zz,before:b,after:a,worsening:w,touched,d0,d1,aState:{frac:sa.frac,side:side(sa.frac),groupIndex:sa.groupIndex,index:sa.index,mask:sa.mask},bState:{frac:sb.frac,side:side(sb.frac),groupIndex:sb.groupIndex,index:sb.index,mask:sb.mask},sameBroadBench:side(sa.frac)!==0&&side(sa.frac)===side(sb.frac)&&sa.groupIndex===sb.groupIndex&&sa.index===sb.index};allPairs.push(rec);
 if(b>maxBeforeInc){maxBeforeInc=b;maxBeforeAt=rec}maxAfterInc=Math.max(maxAfterInc,a);if(w>maxGlobalWorsening){maxGlobalWorsening=w;maxGlobalWorseningAt=rec}
 if(touched){changedPairCount++;if(b<=PROOF+EPS&&a>PROOF+EPS)newProofViolation++;if(b<CLIFF-EPS&&a>=CLIFF)newCliffViolation++;if(b>PROOF+EPS){inheritedUnsafeTouched++;if(a>b+EPS)inheritedUnsafeWorsened++}}
}
let id=0,wire=0,nodeChanged=0;const nodeChanges=[];for(const c of cand){const n=K.terraceStateAt(c.x,c.z),p=R86.terraceStateAt(c.x,c.z),d=n.delta-p.delta;if(Math.abs(d)>1e-7){nodeChanged++;nodeChanges.push({...c,change:d,benchSide:K.r87CorrectionAt(c.x,c.z).benchSide,reason:K.r87CorrectionAt(c.x,c.z).reason})}wire=Math.max(wire,Math.abs(d-K.r87CorrectionAt(c.x,c.z).delta));id=Math.max(id,Math.abs(n.mask-p.mask),Math.abs(n.step-p.step),Math.abs(n.phase-p.phase),Math.abs(n.index-p.index),Math.abs(n.base-p.base),Math.abs(n.groupIndex-p.groupIndex))}
const guards=[...plan.filter(c=>c.dd<=12).slice(0,20),...plan.filter(c=>c.mask<=.12&&c.dd>12).slice(0,20),...plan.filter(c=>receiver(c.x,c.z)).slice(0,20),...plan.filter(c=>c.mask>.48&&c.accepted!==true&&c.dd>12&&!receiver(c.x,c.z)).slice(0,20)];let guardLeak=0;for(const c of guards)guardLeak=Math.max(guardLeak,Math.abs(K.r87CorrectionAt(c.x,c.z).delta));
const checks=[],ck=(name,pass,value,limit)=>checks.push({name,pass:!!pass,value,limit});
ck('version_contract',K.VERSION==='R045.87'&&EXPECT==='R045.87-monotone-bench-extremum-relaxation-v1',{version:K.VERSION,contract:EXPECT},'exact');
ck('accepted_r86',q86.passed&&q86.version==='R045.86',{passed:q86.passed,version:q86.version},'accepted R045.86');
ck('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R86.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R86.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact');
ck('material_extremum_work',changed.length>=6&&nodeChanged>=3,{sampleCount:samples.size,changed:changed.length,nodeChanged,groups:[...groups],sides:[...sides]},'>=6 changed queries and >=3 authoritative nodes');
ck('broad_bench_pair_domain',benchPairs.length>=q86.metrics.benchPairCount*.95,{pairs:benchPairs.length,r86Pairs:q86.metrics.benchPairCount},'>=95% predecessor measured pair domain');
ck('mean_flattening',benchBefore>1e-6&&benchAfter<benchBefore-.00015,{beforeMean:benchBefore,afterMean:benchAfter,improvement:benchBefore-benchAfter,ratio:benchRatio},'>0.15 mm mean reduction');
ck('rms_flattening',energyAfter<energyBefore,{beforeRms:energyBefore,afterRms:energyAfter,ratio:energyRatio},'candidate RMS < predecessor');
ck('pairwise_monotonicity',worsenedPairs===0&&improvedPairs>=4,{improvedPairs,worsenedPairs,unchanged:benchPairs.length-improvedPairs-worsenedPairs},'0 worsened and >=4 improved same-identity broad-bench pairs');
ck('bounded_relaxation',maxChange<=CAP+1e-9&&maxRequest<=CAP+1e-9&&maxAllowance<=CAP+1e-9,{maxChange,maxRequest,maxAllowance,projected},'<=6 mm');
ck('changed_pair_proof',newProofViolation===0&&newCliffViolation===0,{changedPairCount,newProofViolation,newCliffViolation},'no new 1.045/1.05 m crossing');
ck('inherited_unsafe_untouched',inheritedUnsafeTouched===0&&inheritedUnsafeWorsened===0,{inheritedUnsafeTouched,inheritedUnsafeWorsened,maxBeforeAt},'predecessor over-limit debt is not touched or worsened');
ck('global_max_no_worsening',maxAfterInc<=maxBeforeInc+EPS,{maxBeforeInc,maxAfterInc,maxGlobalWorsening,maxGlobalWorseningAt},'global inherited maximum may not increase');
ck('drainage_query_guards',hardLeak===0&&receiverLeak===0,{hardLeak,receiverLeak},'0');
ck('negative_guards',guardLeak<1e-12,guardLeak,'0');
ck('identity_wiring',wire<1e-10&&id<1e-10,{wire,id},'exact');
ck('locks_false',!K.snapshot.visualAcceptance&&!K.snapshot.parcelGenerationEnabled&&!K.snapshot.waterStateKnown&&!K.snapshot.productionReady,K.snapshot,'false');
ck('evidence_boundaries',K.snapshot.round87.logicCorrection.includes('does not imply')&&K.snapshot.round87.constraint.includes('cannot recover')&&K.snapshot.round87.xiaomaBoundary.includes('do not establish')&&K.snapshot.round87.mrRolordUse.includes('unavailable for replay'),K.snapshot.round87,'preserved');
const before=A.after.map(r=>r.slice()),after=before.map(r=>r.slice());for(const c of nodeChanges)after[c.j][c.i]=before[c.j][c.i]+c.change;
const passed=checks.every(c=>c.pass),metrics={candidates:cand.length,sampleCount:samples.size,changedQueries:changed.length,changedGroups:[...groups],changedSides:[...sides],nodeChanged,maxChange,maxRequest,maxAllowance,projected,sumDelta,sumAbs,balanceRatio:Math.abs(sumDelta)/Math.max(1e-12,sumAbs),benchPairCount:benchPairs.length,benchBeforeMean:benchBefore,benchAfterMean:benchAfter,benchGradientRatio:benchRatio,benchImprovement:benchBefore-benchAfter,benchBeforeRms:energyBefore,benchAfterRms:energyAfter,benchEnergyRatio:energyRatio,improvedPairs,worsenedPairs,changedPairCount,newProofViolation,newCliffViolation,inheritedUnsafeTouched,inheritedUnsafeWorsened,maxBeforeInc,maxAfterInc,maxBeforeAt,maxGlobalWorsening,maxGlobalWorseningAt,hardLeak,receiverLeak,guardLeak,wireErr:wire,idErr:id,changedPoints:changed,nodeChangedPoints:nodeChanges,benchPairs};
const result={version:K.VERSION,qaContract:EXPECT,sourceSha:src,passed,gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics,audit:{...A,before,after,plan:plan.map(c=>({...c,r87Changed:nodeChanges.some(n=>n.i===c.i&&n.j===c.j)})),rivers:A.rivers},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round87_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:K.VERSION,passed,passedCount:result.passedCount,gateCount:result.gateCount,changedQueries:changed.length,nodeChanged,groups:[...groups],benchPairs:benchPairs.length,benchBefore,benchAfter,benchImprovement:benchBefore-benchAfter,energyRatio,improvedPairs,worsenedPairs,maxChange,maxBeforeInc,maxAfterInc,maxBeforeAt},null,2));
if(!passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}