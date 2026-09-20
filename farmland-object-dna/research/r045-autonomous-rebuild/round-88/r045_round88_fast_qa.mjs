import fs from 'node:fs';
import * as K from './r045_round88_kernel.mjs';
import * as R87 from '../round-87/r045_round87_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const EXPECT=K.R88_CONTRACT,src=process.env.GITHUB_SHA||'local',PROOF=1.045,CLIFF=1.05,CAP=.045,EPS=1e-6;
const q87=JSON.parse(fs.readFileSync(new URL('../round-87/r045_round87_qa_result.json',import.meta.url)));
if(!q87.passed)throw Error('R87 accepted baseline required');
const A=q87.audit,plan=A.plan,receiver=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12,cand=plan.filter(c=>c.accepted===true&&c.mask>.48&&c.dd>12&&!receiver(c.x,c.z));
const sk=(x,z)=>`${Number(x).toFixed(3)},${Number(z).toFixed(3)}`,samples=new Map(),side=f=>f<=.34?-1:f>=.66?1:0;
for(const c of cand)for(const[xx,zz]of[[c.x,c.z],[c.x+3,c.z],[c.x-3,c.z],[c.x,c.z+3],[c.x,c.z-3]])samples.set(sk(xx,zz),{x:xx,z:zz});
const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:.5*(b[m-1]+b[m])};
let changed=[],groups=new Set(),halves=new Set(),projected=0,maxChange=0,maxRequest=0,maxAllowance=0,hardLeak=0,receiverLeak=0,sumAbs=0,directedWork=0,broadQueryLeak=0;
for(const p of samples.values()){
 const r=K.r88CorrectionAt(p.x,p.z),old=R47.terraceStateAt(p.x,p.z),a=Math.abs(r.delta),bs=side(old.frac);maxRequest=Math.max(maxRequest,Math.abs(r.requested));maxAllowance=Math.max(maxAllowance,r.allowance||0);
 if(bs!==0)broadQueryLeak=Math.max(broadQueryLeak,a);
 if(a>1e-7){const expectedDir=Math.sign(r.trendSlope)*r.phaseHalf,directed=r.delta*expectedDir;changed.push({...p,change:r.delta,requested:r.requested,allowance:r.allowance,projected:r.projected,reason:r.reason,phaseHalf:r.phaseHalf,shape:r.shape,trendSlope:r.trendSlope,trendSpan:r.trendSpan,trendCount:r.trendCount,directed,frac:old.frac,groupIndex:old.groupIndex,index:old.index,mask:old.mask,dd:R30.nearestExtendedDrainageDistance(p.x,p.z)});groups.add(old.groupIndex);halves.add(r.phaseHalf);maxChange=Math.max(maxChange,a);if(r.projected)projected++;if(R30.nearestExtendedDrainageDistance(p.x,p.z)<=12)hardLeak++;if(receiver(p.x,p.z))receiverLeak++;sumAbs+=a;directedWork+=directed}
}
const changeAbs=changed.map(c=>Math.abs(c.change)),medianChange=median(changeAbs),minDirected=changed.length?Math.min(...changed.map(c=>c.directed)):0;
let pairSeen=new Set(),allPairs=[],changedPairCount=0,newProofViolation=0,newCliffViolation=0,inheritedUnsafeTouched=0,inheritedUnsafeWorsened=0,maxBeforeInc=0,maxAfterInc=0,maxBeforeAt=null,maxGlobalWorsening=-Infinity,maxGlobalWorseningAt=null,maxBroadPairDrift=0,riserPairCount=0,riserStraddlePairs=0,riserStronger=0,riserWeaker=0,riserGainSum=0;
for(const p of samples.values())for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){
 const p0=sk(p.x,p.z),p1=sk(xx,zz),pk=p0<p1?`${p0}|${p1}`:`${p1}|${p0}`;if(pairSeen.has(pk))continue;pairSeen.add(pk);
 const b=Math.abs(R87.terraceDelta(p.x,p.z)-R87.terraceDelta(xx,zz)),a=Math.abs(K.terraceDelta(p.x,p.z)-K.terraceDelta(xx,zz)),d0=Math.abs(K.r88CorrectionAt(p.x,p.z).delta),d1=Math.abs(K.r88CorrectionAt(xx,zz).delta),touched=d0>1e-7||d1>1e-7,w=a-b,sa=R47.terraceStateAt(p.x,p.z),sb=R47.terraceStateAt(xx,zz),s0=side(sa.frac),s1=side(sb.frac),same=sa.groupIndex===sb.groupIndex&&sa.index===sb.index;
 const rec={x:p.x,z:p.z,xx,zz,before:b,after:a,worsening:w,touched,d0,d1,aState:{frac:sa.frac,side:s0,groupIndex:sa.groupIndex,index:sa.index,mask:sa.mask},bState:{frac:sb.frac,side:s1,groupIndex:sb.groupIndex,index:sb.index,mask:sb.mask},sameStair:same};allPairs.push(rec);
 if(b>maxBeforeInc){maxBeforeInc=b;maxBeforeAt=rec}maxAfterInc=Math.max(maxAfterInc,a);if(w>maxGlobalWorsening){maxGlobalWorsening=w;maxGlobalWorseningAt=rec}
 if(touched){changedPairCount++;if(b<=PROOF+EPS&&a>PROOF+EPS)newProofViolation++;if(b<CLIFF-EPS&&a>=CLIFF)newCliffViolation++;if(b>PROOF+EPS){inheritedUnsafeTouched++;if(a>b+EPS)inheritedUnsafeWorsened++}}
 if(same&&s0!==0&&s0===s1)maxBroadPairDrift=Math.max(maxBroadPairDrift,Math.abs(a-b));
 if(same&&s0===0&&s1===0){riserPairCount++;if((sa.frac-.5)*(sb.frac-.5)<0){riserStraddlePairs++;const g=a-b;riserGainSum+=g;if(g>1e-7)riserStronger++;else if(g<-1e-7)riserWeaker++}}
}
let id=0,wire=0,nodeChanged=0;const nodeChanges=[];for(const c of cand){const n=K.terraceStateAt(c.x,c.z),p=R87.terraceStateAt(c.x,c.z),d=n.delta-p.delta;if(Math.abs(d)>1e-7){nodeChanged++;nodeChanges.push({...c,change:d,phaseHalf:K.r88CorrectionAt(c.x,c.z).phaseHalf,reason:K.r88CorrectionAt(c.x,c.z).reason})}wire=Math.max(wire,Math.abs(d-K.r88CorrectionAt(c.x,c.z).delta));id=Math.max(id,Math.abs(n.mask-p.mask),Math.abs(n.step-p.step),Math.abs(n.phase-p.phase),Math.abs(n.index-p.index),Math.abs(n.base-p.base),Math.abs(n.groupIndex-p.groupIndex))}
const guards=[...plan.filter(c=>c.dd<=12).slice(0,20),...plan.filter(c=>c.mask<=.12&&c.dd>12).slice(0,20),...plan.filter(c=>receiver(c.x,c.z)).slice(0,20),...plan.filter(c=>c.mask>.48&&c.accepted!==true&&c.dd>12&&!receiver(c.x,c.z)).slice(0,20)];let guardLeak=0;for(const c of guards)guardLeak=Math.max(guardLeak,Math.abs(K.r88CorrectionAt(c.x,c.z).delta));
const im=q87.metrics.maxBeforeAt,ia=im?.aState,ib=im?.bState,inheritSame=!!ia&&!!ib&&ia.groupIndex===ib.groupIndex&&ia.index===ib.index,inheritRiser=inheritSame&&side(ia.frac)===0&&side(ib.frac)===0,inheritStraddle=inheritRiser&&(ia.frac-.5)*(ib.frac-.5)<0,inheritD0=im?Math.abs(K.r88CorrectionAt(im.x,im.z).delta):Infinity,inheritD1=im?Math.abs(K.r88CorrectionAt(im.xx,im.zz).delta):Infinity,inheritAfter=im?Math.abs(K.terraceDelta(im.x,im.z)-K.terraceDelta(im.xx,im.zz)):Infinity;
const inheritedClassification={before:im?.before||0,after:inheritAfter,sameFamilyExactStair:inheritSame,middlePhaseRiser:inheritRiser,straddlesHalfPhase:inheritStraddle,fracA:ia?.frac,fracB:ib?.frac,deltaA:inheritD0,deltaB:inheritD1,classification:inheritRiser?'inherited-riser-transition':'unclassified'};
const checks=[],ck=(name,pass,value,limit)=>checks.push({name,pass:!!pass,value,limit});
ck('version_contract',K.VERSION==='R045.88'&&EXPECT==='R045.88-proof-preserving-riser-concentration-v1',{version:K.VERSION,contract:EXPECT},'exact');
ck('accepted_r87',q87.passed&&q87.version==='R045.87',{passed:q87.passed,version:q87.version},'accepted R045.87');
ck('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R87.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R87.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact');
ck('material_riser_work',changed.length>=4&&nodeChanged>=2&&sumAbs>=.01,{sampleCount:samples.size,changed:changed.length,nodeChanged,groups:[...groups],halves:[...halves],sumAbs},'>=4 changed queries, >=2 authority nodes, >=10 mm total physical work');
ck('riser_directed_concentration',changed.length>0&&minDirected>0&&directedWork>=.01,{directedWork,minDirected,medianChange,maxChange,projected},'every physical change moves outward in inherited stair direction; >=10 mm directed work');
ck('broad_bench_exact_lock',broadQueryLeak<1e-12&&maxBroadPairDrift<1e-10,{broadQueryLeak,maxBroadPairDrift},'0 broad-bench correction/drift');
ck('inherited_max_classified_riser',inheritedClassification.before>CLIFF&&inheritSame&&inheritRiser&&inheritD0<1e-12&&inheritD1<1e-12&&Math.abs(inheritAfter-inheritedClassification.before)<1e-10,inheritedClassification,'existing >1.05 m maximum must classify as same-stair middle-phase riser and remain untouched');
ck('bounded_riser_work',maxChange<=CAP+1e-9&&maxRequest<=CAP+1e-9&&maxAllowance<=CAP+1e-9,{maxChange,maxRequest,maxAllowance,medianChange,projected},'<=45 mm and predecessor-margin projected');
ck('changed_pair_proof',newProofViolation===0&&newCliffViolation===0,{changedPairCount,newProofViolation,newCliffViolation},'no new 1.045/1.05 m crossing');
ck('inherited_unsafe_untouched',inheritedUnsafeTouched===0&&inheritedUnsafeWorsened===0,{inheritedUnsafeTouched,inheritedUnsafeWorsened},'predecessor over-limit debt is not touched or worsened');
ck('global_max_no_worsening',maxAfterInc<=maxBeforeInc+EPS,{maxBeforeInc,maxAfterInc,maxGlobalWorsening,maxGlobalWorseningAt},'global inherited maximum may not increase');
ck('riser_pair_diagnostic',riserPairCount>=1,{riserPairCount,riserStraddlePairs,riserStronger,riserWeaker,riserGainSum},'>=1 measured same-stair riser pair; directional counts diagnostic only');
ck('drainage_query_guards',hardLeak===0&&receiverLeak===0,{hardLeak,receiverLeak},'0');
ck('negative_guards',guardLeak<1e-12,guardLeak,'0');
ck('identity_wiring',wire<1e-10&&id<1e-10,{wire,id},'exact');
ck('locks_false',!K.snapshot.visualAcceptance&&!K.snapshot.parcelGenerationEnabled&&!K.snapshot.waterStateKnown&&!K.snapshot.productionReady,K.snapshot,'false');
ck('evidence_boundaries',K.snapshot.round88.logicCorrection.includes('not sufficient')&&K.snapshot.round88.constraint.includes('cannot recover')&&K.snapshot.round88.xiaomaBoundary.includes('do not establish')&&K.snapshot.round88.mrRolordUse.includes('unavailable for replay'),K.snapshot.round88,'preserved');
const before=A.after.map(r=>r.slice()),after=before.map(r=>r.slice());for(const c of nodeChanges)after[c.j][c.i]=before[c.j][c.i]+c.change;
const passed=checks.every(c=>c.pass),metrics={candidates:cand.length,sampleCount:samples.size,changedQueries:changed.length,changedGroups:[...groups],changedHalves:[...halves],nodeChanged,maxChange,maxRequest,maxAllowance,medianChange,projected,sumAbs,directedWork,minDirected,broadQueryLeak,maxBroadPairDrift,riserPairCount,riserStraddlePairs,riserStronger,riserWeaker,riserGainSum,changedPairCount,newProofViolation,newCliffViolation,inheritedUnsafeTouched,inheritedUnsafeWorsened,maxBeforeInc,maxAfterInc,maxBeforeAt,maxGlobalWorsening,maxGlobalWorseningAt,inheritedClassification,hardLeak,receiverLeak,guardLeak,wireErr:wire,idErr:id,changedPoints:changed,nodeChangedPoints:nodeChanges};
const result={version:K.VERSION,qaContract:EXPECT,sourceSha:src,passed,gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics,audit:{...A,before,after,plan:plan.map(c=>({...c,r88Changed:nodeChanges.some(n=>n.i===c.i&&n.j===c.j)})),rivers:A.rivers},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round88_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:K.VERSION,passed,passedCount:result.passedCount,gateCount:result.gateCount,changedQueries:changed.length,nodeChanged,groups:[...groups],halves:[...halves],sumAbs,directedWork,medianChange,maxChange,riserPairCount,riserStraddlePairs,riserStronger,riserWeaker,riserGainSum,maxBeforeInc,maxAfterInc,inheritedClassification},null,2));
if(!passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}
