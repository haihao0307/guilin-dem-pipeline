import fs from 'node:fs';
import * as K from './r045_round91_kernel.mjs';
import * as R90 from '../round-90/r045_round90_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const EXPECT=K.R91_CONTRACT,src=process.env.GITHUB_SHA||'local',PROOF=1.045,CLIFF=1.05,CAP=.018,EPS=1e-6;
const q90=JSON.parse(fs.readFileSync(new URL('../round-90/r045_round90_qa_result.json',import.meta.url)));
if(!q90.passed)throw Error('R90 accepted baseline required');
const A=q90.audit,plan=A.plan,receiver=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12,side=f=>f<=.34?-1:f>=.66?1:0;
const cand=plan.filter(c=>c.accepted===true&&c.mask>.48&&c.dd>12&&!receiver(c.x,c.z));
const sk=(x,z)=>`${Number(x).toFixed(3)},${Number(z).toFixed(3)}`,predCache=new Map(),stateCache=new Map(),corrCache=new Map();
const pred=(x,z)=>{const k=sk(x,z);if(!predCache.has(k))predCache.set(k,R90.terraceDelta(x,z));return predCache.get(k)};
const st47=(x,z)=>{const k=sk(x,z);if(!stateCache.has(k))stateCache.set(k,R47.terraceStateAt(x,z));return stateCache.get(k)};
const corr=(x,z)=>{const k=sk(x,z);if(!corrCache.has(k))corrCache.set(k,K.r91CorrectionAt(x,z));return corrCache.get(k)};
const sameBench=(a,b)=>side(a.frac)!==0&&side(a.frac)===side(b.frac)&&a.groupIndex===b.groupIndex&&a.index===b.index&&a.mask>.48&&b.mask>.48;

// Authority-first audit: evaluate the full accepted R90 6 m carrier once, then expand
// only physically changed authority nodes to their real +/-3 m pair neighbourhoods.
// This keeps every geometry/materiality/identity/drainage/safety proof while avoiding the
// previous all-candidate 3 m halo recomputation. More recomputation is not more evidence.
let changed=[],nodeChanges=[],groups=new Set(),sides=new Set(),sumAbs=0,projected=0,maxChange=0,maxRequest=0,maxAllowance=0,riserLeak=0,hardLeak=0,receiverLeak=0,unsupported=0,wrongWay=0,supportedQueries=0,residualBefore=0,residualAfter=0,minNeighbors=Infinity,maxNeighbors=0,minFar=Infinity,maxFar=0;
for(const c of cand){
 const s=st47(c.x,c.z),r=corr(c.x,c.z),a=Math.abs(r.delta);if(r.neighborCount>=4&&r.farNeighborCount>=2&&r.axisCount>=2)supportedQueries++;
 maxRequest=Math.max(maxRequest,Math.abs(r.requested||0));maxAllowance=Math.max(maxAllowance,r.allowance||0);if(side(s.frac)===0)riserLeak=Math.max(riserLeak,a);
 if(a>1e-7){if(r.neighborCount<4||r.farNeighborCount<2||r.axisCount<2)unsupported++;const before=Math.abs(r.localResidual),after=Math.abs(r.localResidual-r.delta);if(!(after+1e-10<before))wrongWay++;const item={...c,x:c.x,z:c.z,change:r.delta,requested:r.requested,allowance:r.allowance,neighborCount:r.neighborCount,farNeighborCount:r.farNeighborCount,axisCount:r.axisCount,neighborMedian:r.neighborMedian,centerBefore:r.centerBefore,localResidual:r.localResidual,residualBefore:before,residualAfter:after,projected:r.projected,frac:s.frac,groupIndex:s.groupIndex,index:s.index,mask:s.mask,benchSide:side(s.frac)};changed.push(item);nodeChanges.push(item);groups.add(s.groupIndex);sides.add(side(s.frac));sumAbs+=a;residualBefore+=before;residualAfter+=after;minNeighbors=Math.min(minNeighbors,r.neighborCount);maxNeighbors=Math.max(maxNeighbors,r.neighborCount);minFar=Math.min(minFar,r.farNeighborCount);maxFar=Math.max(maxFar,r.farNeighborCount);maxChange=Math.max(maxChange,a);if(r.projected)projected++;if(R30.nearestExtendedDrainageDistance(c.x,c.z)<=12)hardLeak++;if(receiver(c.x,c.z))receiverLeak++}
}
if(!changed.length){minNeighbors=0;minFar=0}

// Directly measure the claimed broad-bench quantity on accepted 6 m authority pairs.
// This is independent of changed-point count or maximum displacement.
const byIJ=new Map(cand.map(c=>[`${c.i},${c.j}`,c]));
let broadPairs=0,broadBeforeSum=0,broadAfterSum=0,broadBeforeSq=0,broadAfterSq=0,broadImproved=0,broadWorsened=0;
for(const c of cand){for(const[di,dj]of[[1,0],[0,1]]){const n=byIJ.get(`${c.i+di},${c.j+dj}`);if(!n)continue;const s0=st47(c.x,c.z),s1=st47(n.x,n.z);if(!sameBench(s0,s1))continue;const b=Math.abs(pred(c.x,c.z)-pred(n.x,n.z)),a=Math.abs((pred(c.x,c.z)+corr(c.x,c.z).delta)-(pred(n.x,n.z)+corr(n.x,n.z).delta));broadPairs++;broadBeforeSum+=b;broadAfterSum+=a;broadBeforeSq+=b*b;broadAfterSq+=a*a;if(a<b-EPS)broadImproved++;else if(a>b+EPS)broadWorsened++}}
const broadMeanBefore=broadPairs?broadBeforeSum/broadPairs:0,broadMeanAfter=broadPairs?broadAfterSum/broadPairs:0,broadRmsBefore=broadPairs?Math.sqrt(broadBeforeSq/broadPairs):0,broadRmsAfter=broadPairs?Math.sqrt(broadAfterSq/broadPairs):0,broadMeanRatio=broadMeanBefore?broadMeanAfter/broadMeanBefore:1,broadRmsRatio=broadRmsBefore?broadRmsAfter/broadRmsBefore:1;

// Expand only changed authority nodes to real 3 m pairs. Both endpoints are evaluated
// with the exact R91 kernel; inherited unsafe pairs may be touched only if not worsened.
let pairSeen=new Set(),changedPairCount=0,newProofViolation=0,newCliffViolation=0,inheritedUnsafeTouched=0,inheritedUnsafeWorsened=0,maxBeforeInc=0,maxAfterInc=0,maxWorsening=-Infinity;
for(const p of changed)for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){const a0=sk(p.x,p.z),a1=sk(xx,zz),pk=a0<a1?`${a0}|${a1}`:`${a1}|${a0}`;if(pairSeen.has(pk))continue;pairSeen.add(pk);const b=Math.abs(pred(p.x,p.z)-pred(xx,zz)),a=Math.abs((pred(p.x,p.z)+corr(p.x,p.z).delta)-(pred(xx,zz)+corr(xx,zz).delta));maxBeforeInc=Math.max(maxBeforeInc,b);maxAfterInc=Math.max(maxAfterInc,a);maxWorsening=Math.max(maxWorsening,a-b);changedPairCount++;if(b<=PROOF+EPS&&a>PROOF+EPS)newProofViolation++;if(b<CLIFF-EPS&&a>=CLIFF)newCliffViolation++;if(b>PROOF+EPS){inheritedUnsafeTouched++;if(a>b+EPS)inheritedUnsafeWorsened++}}
if(maxWorsening===-Infinity)maxWorsening=0;

// Wiring/identity is checked on all changed authority nodes plus a deterministic unchanged
// control sample; guards explicitly probe drainage, weak and unaccepted domains.
let wire=0,id=0;const controls=[...changed,...cand.filter(c=>Math.abs(corr(c.x,c.z).delta)<=1e-7).slice(0,24)];for(const c of controls){const n=K.terraceStateAt(c.x,c.z),p=R90.terraceStateAt(c.x,c.z),d=n.delta-p.delta;wire=Math.max(wire,Math.abs(d-corr(c.x,c.z).delta));id=Math.max(id,Math.abs(n.mask-p.mask),Math.abs(n.step-p.step),Math.abs(n.phase-p.phase),Math.abs(n.index-p.index),Math.abs(n.base-p.base),Math.abs(n.groupIndex-p.groupIndex))}
const guards=[...plan.filter(c=>c.dd<=12).slice(0,24),...plan.filter(c=>c.mask<=.12&&c.dd>12).slice(0,24),...plan.filter(c=>receiver(c.x,c.z)).slice(0,24),...plan.filter(c=>c.mask>.48&&c.accepted!==true&&c.dd>12&&!receiver(c.x,c.z)).slice(0,24)];let guardLeak=0;for(const c of guards)guardLeak=Math.max(guardLeak,Math.abs(corr(c.x,c.z).delta));

const checks=[],ck=(name,pass,value,limit)=>checks.push({name,pass:!!pass,value,limit});
ck('version_contract',K.VERSION==='R045.91'&&EXPECT==='R045.91-multiscale-bench-relaxation-v1',{version:K.VERSION,contract:EXPECT},'exact');
ck('accepted_r90',q90.passed&&q90.version==='R045.90',{passed:q90.passed,version:q90.version},'accepted R045.90');
ck('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R90.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R90.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact');
ck('material_bench_work',changed.length>=8&&sumAbs>=.018,{supportedQueries,changedAuthority:changed.length,sumAbs,groups:[...groups],sides:[...sides]},'>=8 changed authority nodes and >=18 mm total distributed work');
ck('multiscale_support',unsupported===0&&minNeighbors>=4&&minFar>=2,{unsupported,minNeighbors,maxNeighbors,minFar,maxFar,supportedQueries},'every change has >=4 neighbours, >=2 far neighbours and both axes');
ck('median_residual_reduced',changed.length>0&&wrongWay===0&&residualAfter<residualBefore*.9,{residualBefore,residualAfter,ratio:residualBefore?residualAfter/residualBefore:1,wrongWay},'every physical change moves toward predecessor multiscale median; aggregate residual >=10% lower');
ck('broad_bench_mean_gradient',broadPairs>=12&&broadMeanRatio<=.985,{broadPairs,broadMeanBefore,broadMeanAfter,broadMeanRatio,broadImproved,broadWorsened},'>=12 same-identity authority broad-bench pairs and mean 6 m terrace gradient >=1.5% lower');
ck('broad_bench_rms_not_worse',broadRmsRatio<=1.000001,{broadRmsBefore,broadRmsAfter,broadRmsRatio},'RMS 6 m broad-bench terrace gradient not worse');
ck('middle_riser_exact_lock',riserLeak<1e-12,riserLeak,'0');
ck('bounded_bench_work',maxChange<=CAP+1e-9&&maxRequest<=CAP+1e-9&&maxAllowance<=CAP+1e-9,{maxChange,maxRequest,maxAllowance,projected},'<=18 mm and predecessor-margin projected');
ck('changed_pair_proof',changedPairCount>0&&newProofViolation===0&&newCliffViolation===0,{changedPairCount,newProofViolation,newCliffViolation,maxBeforeInc,maxAfterInc},'real touched +/-3 m pairs checked; no new 1.045/1.05 m crossing');
ck('inherited_unsafe_not_worsened',inheritedUnsafeWorsened===0,{inheritedUnsafeTouched,inheritedUnsafeWorsened,maxWorsening},'no inherited unsafe pair worsened');
ck('drainage_guards',hardLeak===0&&receiverLeak===0,{hardLeak,receiverLeak},'0');
ck('negative_guards',guardLeak<1e-12,guardLeak,'0');
ck('identity_wiring',wire<1e-10&&id<1e-10,{wire,id,controlCount:controls.length},'exact');
ck('locks_false',!K.snapshot.visualAcceptance&&!K.snapshot.parcelGenerationEnabled&&!K.snapshot.waterStateKnown&&!K.snapshot.productionReady,K.snapshot,'false');
ck('evidence_boundaries',K.snapshot.round91.logicCorrection.includes('not sufficient')&&K.snapshot.round91.constraint.includes('cannot recover')&&K.snapshot.round91.xiaomaBoundary.includes('does not establish')&&K.snapshot.round91.mrRolordUse.includes('unavailable for replay')&&K.snapshot.round91.referenceUse.includes('reread directly'),K.snapshot.round91,'preserved');
const before=A.after.map(r=>r.slice()),after=before.map(r=>r.slice());for(const c of nodeChanges)after[c.j][c.i]=before[c.j][c.i]+c.change;
const passed=checks.every(c=>c.pass),metrics={candidates:cand.length,sampleCount:cand.length,supportedQueries,changedQueries:changed.length,nodeChanged:nodeChanges.length,changedGroups:[...groups],changedSides:[...sides],sumAbs,projected,maxChange,maxRequest,maxAllowance,residualBefore,residualAfter,residualRatio:residualBefore?residualAfter/residualBefore:1,minNeighbors,maxNeighbors,minFar,maxFar,unsupported,wrongWay,riserLeak,broadPairs,broadMeanBefore,broadMeanAfter,broadMeanRatio,broadRmsBefore,broadRmsAfter,broadRmsRatio,broadImproved,broadWorsened,changedPairCount,newProofViolation,newCliffViolation,inheritedUnsafeTouched,inheritedUnsafeWorsened,maxBeforeInc,maxAfterInc,maxWorsening,hardLeak,receiverLeak,guardLeak,wireErr:wire,idErr:id,changedPoints:changed,nodeChangedPoints:nodeChanges,qaScope:'full accepted R90 authority carrier + exact real +/-3 m neighbourhood of every changed authority node; no all-candidate 3 m halo'};
const result={version:K.VERSION,qaContract:EXPECT,sourceSha:src,passed,gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics,audit:{...A,before,after,plan:plan.map(c=>({...c,r91Changed:nodeChanges.some(n=>n.i===c.i&&n.j===c.j)})),rivers:A.rivers},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round91_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:K.VERSION,passed,passedCount:result.passedCount,gateCount:result.gateCount,candidates:cand.length,supportedQueries,changedAuthority:changed.length,sumAbs,residualRatio:metrics.residualRatio,broadPairs,broadMeanRatio,broadRmsRatio,changedPairCount,maxChange,newProofViolation,newCliffViolation},null,2));
if(!passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}