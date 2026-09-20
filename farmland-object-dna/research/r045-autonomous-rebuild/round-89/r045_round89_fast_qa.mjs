import fs from 'node:fs';
import * as K from './r045_round89_kernel.mjs';
import * as R88 from '../round-88/r045_round88_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const EXPECT=K.R89_CONTRACT,src=process.env.GITHUB_SHA||'local',PROOF=1.045,CLIFF=1.05,CAP=.006,EPS=1e-6;
const q88=JSON.parse(fs.readFileSync(new URL('../round-88/r045_round88_qa_result.json',import.meta.url)));
if(!q88.passed)throw Error('R88 accepted baseline required');
const A=q88.audit,plan=A.plan,receiver=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12,cand=plan.filter(c=>c.accepted===true&&c.mask>.48&&c.dd>12&&!receiver(c.x,c.z));
const sk=(x,z)=>`${Number(x).toFixed(3)},${Number(z).toFixed(3)}`,samples=new Map(),side=f=>f<=.34?-1:f>=.66?1:0,half=f=>f<.5?-1:f>.5?1:0;
for(const c of cand)for(const[xx,zz]of[[c.x,c.z],[c.x+3,c.z],[c.x-3,c.z],[c.x,c.z+3],[c.x,c.z-3]])samples.set(sk(xx,zz),{x:xx,z:zz});
let changed=[],nodeChanges=[],groups=new Set(),halves=new Set(),sumAbs=0,projected=0,maxChange=0,maxRequest=0,maxAllowance=0,broadLeak=0,hardLeak=0,receiverLeak=0,unsupported=0,wrongWay=0,supportedQueries=0,residualBefore=0,residualAfter=0,minSupport=Infinity,maxSupport=0;
for(const p of samples.values()){
 const st=R47.terraceStateAt(p.x,p.z),r=K.r89CorrectionAt(p.x,p.z),u=K.r89SupportAt(p.x,p.z);if(u.valid)supportedQueries++;
 const a=Math.abs(r.delta);maxRequest=Math.max(maxRequest,Math.abs(r.requested||0));maxAllowance=Math.max(maxAllowance,r.allowance||0);if(side(st.frac)!==0)broadLeak=Math.max(broadLeak,a);
 if(a>1e-7){if(!u.valid||r.supportCount<1)unsupported++;if(!(r.supportResidualAfter+1e-10<r.supportResidualBefore))wrongWay++;changed.push({...p,change:r.delta,requested:r.requested,allowance:r.allowance,supportCount:r.supportCount,supportTarget:r.supportTarget,residualBefore:r.supportResidualBefore,residualAfter:r.supportResidualAfter,projected:r.projected,frac:st.frac,groupIndex:st.groupIndex,index:st.index,mask:st.mask,phaseHalf:half(st.frac),r88Correction:R88.r88CorrectionAt(p.x,p.z).delta});groups.add(st.groupIndex);halves.add(half(st.frac));sumAbs+=a;residualBefore+=r.supportResidualBefore;residualAfter+=r.supportResidualAfter;minSupport=Math.min(minSupport,r.supportCount);maxSupport=Math.max(maxSupport,r.supportCount);maxChange=Math.max(maxChange,a);if(r.projected)projected++;if(R30.nearestExtendedDrainageDistance(p.x,p.z)<=12)hardLeak++;if(receiver(p.x,p.z))receiverLeak++}
}
if(!changed.length)minSupport=0;
for(const c of cand){const d=K.terraceDelta(c.x,c.z)-R88.terraceDelta(c.x,c.z);if(Math.abs(d)>1e-7)nodeChanges.push({...c,change:d,reason:K.r89CorrectionAt(c.x,c.z).reason,supportCount:K.r89CorrectionAt(c.x,c.z).supportCount,residualBefore:K.r89CorrectionAt(c.x,c.z).supportResidualBefore,residualAfter:K.r89CorrectionAt(c.x,c.z).supportResidualAfter})}
let pairSeen=new Set(),changedPairCount=0,newProofViolation=0,newCliffViolation=0,inheritedUnsafeTouched=0,inheritedUnsafeWorsened=0,maxBeforeInc=0,maxAfterInc=0,maxWorsening=-Infinity;
for(const p of samples.values())for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){const a0=sk(p.x,p.z),a1=sk(xx,zz),pk=a0<a1?`${a0}|${a1}`:`${a1}|${a0}`;if(pairSeen.has(pk))continue;pairSeen.add(pk);const b=Math.abs(R88.terraceDelta(p.x,p.z)-R88.terraceDelta(xx,zz)),a=Math.abs(K.terraceDelta(p.x,p.z)-K.terraceDelta(xx,zz)),d0=Math.abs(K.r89CorrectionAt(p.x,p.z).delta),d1=Math.abs(K.r89CorrectionAt(xx,zz).delta),touched=d0>1e-7||d1>1e-7;maxBeforeInc=Math.max(maxBeforeInc,b);maxAfterInc=Math.max(maxAfterInc,a);maxWorsening=Math.max(maxWorsening,a-b);if(touched){changedPairCount++;if(b<=PROOF+EPS&&a>PROOF+EPS)newProofViolation++;if(b<CLIFF-EPS&&a>=CLIFF)newCliffViolation++;if(b>PROOF+EPS){inheritedUnsafeTouched++;if(a>b+EPS)inheritedUnsafeWorsened++}}}
let wire=0,id=0;for(const c of cand){const n=K.terraceStateAt(c.x,c.z),p=R88.terraceStateAt(c.x,c.z),d=n.delta-p.delta;wire=Math.max(wire,Math.abs(d-K.r89CorrectionAt(c.x,c.z).delta));id=Math.max(id,Math.abs(n.mask-p.mask),Math.abs(n.step-p.step),Math.abs(n.phase-p.phase),Math.abs(n.index-p.index),Math.abs(n.base-p.base),Math.abs(n.groupIndex-p.groupIndex))}
const guards=[...plan.filter(c=>c.dd<=12).slice(0,30),...plan.filter(c=>c.mask<=.12&&c.dd>12).slice(0,30),...plan.filter(c=>receiver(c.x,c.z)).slice(0,30),...plan.filter(c=>c.mask>.48&&c.accepted!==true&&c.dd>12&&!receiver(c.x,c.z)).slice(0,30)];let guardLeak=0;for(const c of guards)guardLeak=Math.max(guardLeak,Math.abs(K.r89CorrectionAt(c.x,c.z).delta));
const checks=[],ck=(name,pass,value,limit)=>checks.push({name,pass:!!pass,value,limit});
ck('version_contract',K.VERSION==='R045.89'&&EXPECT==='R045.89-riser-run-coherence-v2',{version:K.VERSION,contract:EXPECT},'exact');
ck('accepted_r88',q88.passed&&q88.version==='R045.88',{passed:q88.passed,version:q88.version},'accepted R045.88');
ck('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R88.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R88.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact');
ck('material_coherence_work',changed.length>=4&&nodeChanges.length>=1&&sumAbs>=.006,{changedQueries:changed.length,nodeChanged:nodeChanges.length,sumAbs,groups:[...groups],halves:[...halves],supportedQueries},'>=4 changed queries, >=1 authority node, >=6 mm total work');
ck('support_residual_reduced',changed.length>0&&wrongWay===0&&residualAfter<residualBefore-.002,{residualBefore,residualAfter,improvement:residualBefore-residualAfter,wrongWay,minSupport,maxSupport},'every physical change moves toward non-recursive R88 support median; total residual improvement >2 mm');
ck('support_semantics',unsupported===0,{unsupported,supportedQueries},'every change has coherent same-stair/same-half segment-checked R88 support');
ck('broad_bench_lock',broadLeak<1e-12,broadLeak,'0');
ck('bounded_coherence',maxChange<=CAP+1e-9&&maxRequest<=CAP+1e-9&&maxAllowance<=CAP+1e-9,{maxChange,maxRequest,maxAllowance,projected},'<=6 mm and predecessor-margin projected');
ck('changed_pair_proof',newProofViolation===0&&newCliffViolation===0,{changedPairCount,newProofViolation,newCliffViolation},'no new 1.045/1.05 m crossing');
ck('inherited_unsafe_not_worsened',inheritedUnsafeWorsened===0,{inheritedUnsafeTouched,inheritedUnsafeWorsened},'no inherited unsafe pair worsened');
ck('drainage_guards',hardLeak===0&&receiverLeak===0,{hardLeak,receiverLeak},'0');
ck('negative_guards',guardLeak<1e-12,guardLeak,'0');
ck('identity_wiring',wire<1e-10&&id<1e-10,{wire,id},'exact');
ck('locks_false',!K.snapshot.visualAcceptance&&!K.snapshot.parcelGenerationEnabled&&!K.snapshot.waterStateKnown&&!K.snapshot.productionReady,K.snapshot,'false');
ck('evidence_boundaries',K.snapshot.round89.logicCorrection.includes('not riser continuity')&&K.snapshot.round89.logicCorrection.includes('not equivalent')&&K.snapshot.round89.constraint.includes('cannot recover')&&K.snapshot.round89.xiaomaBoundary.includes('do not establish')&&K.snapshot.round89.mrRolordUse.includes('unavailable for replay'),K.snapshot.round89,'preserved');
const before=A.after.map(r=>r.slice()),after=before.map(r=>r.slice());for(const c of nodeChanges)after[c.j][c.i]=before[c.j][c.i]+c.change;
const passed=checks.every(c=>c.pass),metrics={candidates:cand.length,sampleCount:samples.size,supportedQueries,changedQueries:changed.length,nodeChanged:nodeChanges.length,changedGroups:[...groups],changedHalves:[...halves],sumAbs,projected,maxChange,maxRequest,maxAllowance,residualBefore,residualAfter,residualImprovement:residualBefore-residualAfter,minSupport,maxSupport,unsupported,wrongWay,broadLeak,changedPairCount,newProofViolation,newCliffViolation,inheritedUnsafeTouched,inheritedUnsafeWorsened,maxBeforeInc,maxAfterInc,maxWorsening,hardLeak,receiverLeak,guardLeak,wireErr:wire,idErr:id,changedPoints:changed,nodeChangedPoints:nodeChanges};
const result={version:K.VERSION,qaContract:EXPECT,sourceSha:src,passed,gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics,audit:{...A,before,after,plan:plan.map(c=>({...c,r89Changed:nodeChanges.some(n=>n.i===c.i&&n.j===c.j)})),rivers:A.rivers},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round89_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:K.VERSION,passed,passedCount:result.passedCount,gateCount:result.gateCount,supportedQueries,changedQueries:changed.length,nodeChanged:nodeChanges.length,sumAbs,residualBefore,residualAfter,maxChange,newProofViolation,newCliffViolation},null,2));
if(!passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}
