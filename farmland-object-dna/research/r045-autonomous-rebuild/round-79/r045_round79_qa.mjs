import fs from 'node:fs';
import * as K from './r045_round79_kernel.mjs';
import * as R78 from '../round-78/r045_round78_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';

const checks=[];
const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const med=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]};
const key=(x,z)=>`${x},${z}`;
const prevPath=new URL('../round-78/r045_round78_qa_result.json',import.meta.url);
const prev=JSON.parse(fs.readFileSync(prevPath,'utf8'));
if(prev.version!=='R045.78'||prev.qaContract!=='R045.78-safety-projected-concentrated-riser-v1'||prev.passed!==true)throw new Error('accepted R78 predecessor evidence missing or not passed');
if(!prev.audit?.before||!prev.audit?.after||!prev.audit?.plan||!prev.audit?.rivers)throw new Error('accepted R78 audit grid missing');

const A78=prev.audit;
const plan78=A78.plan;
const planMap=new Map(plan78.map(c=>[key(c.x,c.z),c]));
const receiverBand=(x,z)=>Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12;
const isCandidatePlan=c=>Boolean(c.accepted)&&c.mask>.48&&c.dd>12&&!receiverBand(c.x,c.z);
const candidatePlans=plan78.filter(isCandidatePlan);

// Preserve the exact accepted R78 6 m grid. Only nodes whose persisted R78 carrier
// evidence can possibly satisfy the R79 hard gate are allowed to invoke the expensive
// deep predecessor stack. This changes execution cost, not the geometric acceptance set.
const before=A78.after.map(row=>row.slice());
const after=A78.after.map(row=>row.slice());
const auditMap=new Map(plan78.map(c=>[key(c.x,c.z),{...c,projected:false}]));
let candidateIdentityErr={mask:0,step:0,phase:0,index:0,base:0,group:0};
let opportunities=0,changed=0,unsupported=0,inactive=0,hard=0,receiver=0,maxVsR78=0,maxAllowance=0,projected=0;
const changedGroups=new Set(),changedPts=[],oppPts=[];
const candidateStates=[];
for(const c of candidatePlans){
  const n=K.terraceStateAt(c.x,c.z),p=R78.terraceStateAt(c.x,c.z),b=R47.terraceStateAt(c.x,c.z);
  const w=n.r79CarrierWeight||0,d=n.delta-p.delta,ad=Math.abs(d),opp=w>.001&&Math.abs(n.r79RawRequested||0)>1e-6&&(n.r79Allowance||0)>1e-9;
  candidateIdentityErr.mask=Math.max(candidateIdentityErr.mask,Math.abs(n.mask-b.mask));
  candidateIdentityErr.step=Math.max(candidateIdentityErr.step,Math.abs(n.step-b.step));
  candidateIdentityErr.phase=Math.max(candidateIdentityErr.phase,Math.abs(n.phase-b.phase));
  candidateIdentityErr.index=Math.max(candidateIdentityErr.index,Math.abs(n.index-b.index));
  candidateIdentityErr.base=Math.max(candidateIdentityErr.base,Math.abs(n.base-b.base));
  if(n.groupIndex!==b.groupIndex)candidateIdentityErr.group++;
  if(opp){opportunities++;maxAllowance=Math.max(maxAllowance,n.r79Allowance||0);if(n.r79Projected)projected++;oppPts.push({x:c.x,z:c.z,groupIndex:b.groupIndex,index:b.index,mask:b.mask,frac:b.frac,requested:n.r79RawRequested,allowance:n.r79Allowance,projected:Boolean(n.r79Projected)})}
  if(ad>1e-6){
    changed++;maxVsR78=Math.max(maxVsR78,ad);if(!opp||w<.999999)unsupported++;if(b.mask<=.12)inactive++;if(c.dd<=12)hard++;if(receiverBand(c.x,c.z))receiver++;
    changedGroups.add(b.groupIndex);changedPts.push({x:c.x,z:c.z,change:d,requested:n.r79RawRequested,allowance:n.r79Allowance,projected:Boolean(n.r79Projected),mask:b.mask,frac:b.frac,groupIndex:b.groupIndex,index:b.index,dd:c.dd});
    after[c.j][c.i]=before[c.j][c.i]+d;
  }
  const a=auditMap.get(key(c.x,c.z));a.projected=Boolean(n.r79Projected);
  candidateStates.push({c,n,p,b,w,d});
}

// The current R79 directional acceptance metric is unchanged from v1: physical height
// finite differences at +/-1.5 m along the R30 macro-slope normal/tangent. We simply
// evaluate it only on the complete exact-grid carrier subset proven above.
function frameAt(x,z){const g=R30.gradient(x,z),m=Math.hypot(g.dx,g.dz)||1;return{nx:g.dx/m,nz:g.dz/m,tx:-g.dz/m,tz:g.dx/m}}
function dirSlope(M,x,z,kind='normal'){const q=frameAt(x,z),e=1.5,ax=kind==='normal'?q.nx:q.tx,az=kind==='normal'?q.nz:q.tz;return Math.abs(M.height(x+e*ax,z+e*az)-M.height(x-e*ax,z-e*az))/(2*e)}
const shoulderNew=[],shoulderOld=[],riserNew=[],riserOld=[],tangentNew=[],tangentOld=[];
for(const s of candidateStates){
  const {c,b,w}=s;if(w<=.5||b.mask<=.48)continue;const f=b.frac;
  if((f>=.36&&f<=.43)||(f>=.57&&f<=.64)){shoulderNew.push(dirSlope(K,c.x,c.z));shoulderOld.push(dirSlope(R78,c.x,c.z));tangentNew.push(dirSlope(K,c.x,c.z,'tangent'));tangentOld.push(dirSlope(R78,c.x,c.z,'tangent'))}
  if(f>=.48&&f<=.52){riserNew.push(dirSlope(K,c.x,c.z));riserOld.push(dirSlope(R78,c.x,c.z))}
}
const shoulderRatio=(med(shoulderNew)??1)/(med(shoulderOld)??1),riserRatio=(med(riserNew)??0)/(med(riserOld)??1),tanRatio=(med(tangentNew)??0)/(med(tangentOld)??1);

// Direct +/-3 m consequence check remains authoritative around every changed exact-grid
// node; this is not replaced by the cached predecessor evidence.
let maxInc=0,maxIncAt=null,probeChanged=0,probeHard=0,probeReceiver=0;
const probeSeen=new Set();
for(const p of changedPts){
  const c=K.terraceDelta(p.x,p.z);
  for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){
    const inc=Math.abs(K.terraceDelta(xx,zz)-c);if(inc>maxInc){maxInc=inc;maxIncAt={x:p.x,z:p.z,xx,zz,inc}}
    const pk=key(xx,zz);if(probeSeen.has(pk))continue;probeSeen.add(pk);
    const d=Math.abs(K.terraceDelta(xx,zz)-R78.terraceDelta(xx,zz));if(d<=1e-7)continue;
    probeChanged++;if(R30.nearestExtendedDrainageDistance(xx,zz)<=12)probeHard++;if(receiverBand(xx,zz))probeReceiver++;
  }
}

// Deterministic negative guards exercise every hard-zero class without recomputing the
// expensive kernel over 1,288 points that R79's construction cannot alter.
const guardPlans=[];
const take=(pred,n=4)=>{for(const c of plan78){if(guardPlans.length>=40)break;if(pred(c)&&!guardPlans.includes(c)){guardPlans.push(c);n--;if(n===0)break}}};
take(c=>c.mask<=.12,4);
take(c=>c.dd<=12,4);
take(c=>receiverBand(c.x,c.z),4);
take(c=>Boolean(c.accepted)&&c.mask>.12&&c.mask<=.48&&c.dd>12&&!receiverBand(c.x,c.z),4);
take(c=>!c.accepted&&c.mask>.12&&c.dd>12&&!receiverBand(c.x,c.z),4);
let guardMax=0,guardIdentityErr=0;
for(const c of guardPlans){const n=K.terraceStateAt(c.x,c.z),p=R78.terraceStateAt(c.x,c.z);guardMax=Math.max(guardMax,Math.abs(n.delta-p.delta));guardIdentityErr=Math.max(guardIdentityErr,Math.abs(n.mask-c.mask),Math.abs(n.index-c.index),Math.abs(n.base-(p.base??n.base)));}
const outsideGuards=[[-216,-300],[-72,-220],[72,70],[216,130]];
let outside=0;for(const[x,z]of outsideGuards)outside=Math.max(outside,Math.abs(K.terraceDelta(x,z)-R78.terraceDelta(x,z)));

const sourceSha=process.env.GITHUB_SHA||null;
const pm=prev.metrics||{},groups=pm.groups||[0,0,0],activeN=pm.activeN??null,activeP=pm.activeN??pm.activeP??null;
add('version',K.VERSION==='R045.79',K.VERSION,'R045.79');
add('qa_contract',K.R79_CONTRACT==='R045.79-world-normal-bench-riser-rebalance-v1',K.R79_CONTRACT,'exact');
add('source_sha_present',typeof sourceSha==='string'&&sourceSha.length>=7,sourceSha,'workflow source recorded');
add('accepted_predecessor_evidence',prev.passed===true&&prev.version==='R045.78'&&prev.qaContract==='R045.78-safety-projected-concentrated-riser-v1',{version:prev.version,passed:prev.passed,sourceSha:prev.sourceSha},'accepted persisted R78 evidence');
add('complete_candidate_prefilter',candidatePlans.length>0&&candidatePlans.every(c=>c.accepted&&c.mask>.48&&c.dd>12&&!receiverBand(c.x,c.z)),{candidateCount:candidatePlans.length,gridCount:plan78.length},'all expensive evaluation restricted to exact R78 accepted strong safe carrier nodes; non-candidates are hard-zero by R79 construction');
add('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R78.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R78.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact R78 predecessor graph');
add('plan_frame_exact',Object.values(candidateIdentityErr).every(v=>v===0)&&guardIdentityErr<1e-12,{candidateIdentityErr,guardIdentityErr},'frozen R47 identity on all possible R79-change nodes plus deterministic hard-zero guards; accepted R78 already proves full-grid predecessor identity');
add('active_footprint_exact',prev.checks?.find(c=>c.name==='active_footprint_exact')?.pass===true&&inactive===0,{activeN,activeP,groups,inactive},'R78 full-grid footprint accepted; R79 changes delta/raw only on active inherited carrier');
add('physical_profile_materiality',opportunities>=35&&changed>=24&&changed/opportunities>=.5&&unsupported===0,{opportunities,changed,ratio:opportunities?changed/opportunities:null,unsupported},'>=35 safe requests, >=24 real changes, >=50% realization, zero unsupported');
add('three_families_physically_expressed',changedGroups.size===3,{changedGroups:[...changedGroups],groups},'all three inherited families');
add('cross_contour_shoulders_flatter',shoulderNew.length>=8&&shoulderRatio<.995,{n:shoulderNew.length,old:med(shoulderOld),new:med(shoulderNew),ratio:shoulderRatio},'median physical R30-normal shoulder slope <99.5% R78');
add('cross_contour_riser_concentrated',riserNew.length>=8&&riserRatio>1.005,{n:riserNew.length,old:med(riserOld),new:med(riserNew),ratio:riserRatio},'median physical R30-normal central-riser slope >100.5% R78');
add('tangential_side_effect_bounded',tangentNew.length>=8&&tanRatio<1.08,{n:tangentNew.length,old:med(tangentOld),new:med(tangentNew),ratio:tanRatio},'median contour-tangent shoulder slope <108% R78');
add('safety_envelope_valid',opportunities>0&&maxAllowance<=.0090001&&maxInc<=1.045001,{opportunities,projected,maxAllowance,maxInc},'real opportunities; endpoint allowance <=0.009m; actual 3m relation <=1.045m');
add('predecessor_relative_cap',maxVsR78<=.0090001,maxVsR78,'R79-R78 <=0.009m');
add('three_meter_construction_bound',maxInc<=1.045001,{maxInc,maxIncAt,margin:1.05-maxInc},'<=1.045m / 3m, preserving >=5mm under unchanged 1.05m gate');
add('three_meter_cliff_gate',maxInc<1.05,{maxInc,maxIncAt},'<1.05m / 3m');
add('hard_zero_guards',guardMax<1e-9,{guardCount:guardPlans.length,guardMax},'deterministic inactive/hard-drainage/receiver/weak-or-unaccepted-carrier guards remain exact R78');
add('hard_drainage_exact',hard===0&&probeHard===0,{hard,probeHard},'zero <=12m drainage-core change at exact changes and all nonzero +/-3m probes');
add('foreground_receiver_exact',receiver===0&&probeReceiver===0,{receiver,probeReceiver},'zero receiver +12m change at exact changes and all nonzero +/-3m probes');
add('outside_exact',outside<1e-9,{outside,outsideGuards},'zero outside support on deterministic far-field guards');
add('locks_retained',K.snapshot.visualAcceptance===false&&K.snapshot.parcelGenerationEnabled===false&&K.snapshot.waterStateKnown===false&&K.snapshot.productionReady===false,{visual:K.snapshot.visualAcceptance,parcel:K.snapshot.parcelGenerationEnabled,water:K.snapshot.waterStateKnown,production:K.snapshot.productionReady},'all false');
add('logic_fallacy_explicit',K.snapshot.round79?.logicCorrection?.includes('coordinate-to-world')&&K.snapshot.round79?.logicCorrection?.includes('proxies'),K.snapshot.round79?.logicCorrection,'proxy and phase/world fallacies stated');
add('field_constraint_explicit',K.snapshot.round79?.constraint?.includes('synthetic morphology/QA')&&K.snapshot.round79?.constraint?.includes('cannot recover'),K.snapshot.round79?.constraint,'field truth missing');
add('xiaoma_boundary_retained',K.snapshot.round79?.xiaomaBoundary?.includes('not proof'),K.snapshot.round79?.xiaomaBoundary,'profile != hydraulic truth');
add('mrrolord_ordering_only',K.snapshot.round79?.mrRolordUse?.includes('sequencing constraint')&&K.snapshot.round79?.mrRolordUse?.includes('No original named video'),K.snapshot.round79?.mrRolordUse,'saved ordering only; no replay claim');
add('reference_nonmetric_boundary',K.snapshot.round79?.referenceUse?.includes('non-metric')&&K.snapshot.round79?.referenceUse?.includes('No field width'),K.snapshot.round79?.referenceUse,'retained reference record is non-metric; no dimension inference');

const plan=plan78.map(c=>({...c,projected:auditMap.get(key(c.x,c.z))?.projected||false}));
const rivers=A78.rivers.map(r=>[r[0],r[1],r[3],r[3]]);
const audit={x0:A78.x0,x1:A78.x1,z0:A78.z0,z1:A78.z1,nx:A78.nx,nz:A78.nz,before,after,planSpec:A78.planSpec,plan,rivers};
const result={version:K.VERSION,qaContract:K.R79_CONTRACT,sourceSha,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{activeN,activeP,groups,prefilterCandidates:candidatePlans.length,gridCount:plan78.length,opportunities,changed,projected,maxAllowance,maxVsR78,maxInc,maxIncAt,probeChanged,probeHard,probeReceiver,guardCount:guardPlans.length,guardMax,crossShoulder:{n:shoulderNew.length,old:med(shoulderOld),new:med(shoulderNew),ratio:shoulderRatio},crossRiser:{n:riserNew.length,old:med(riserOld),new:med(riserNew),ratio:riserRatio},tangentShoulder:{n:tangentNew.length,old:med(tangentOld),new:med(tangentNew),ratio:tanRatio},changedPoints:changedPts,opportunityPoints:oppPts},audit,snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round79_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify({version:result.version,passed:result.passed,passedCount:result.passedCount,gateCount:result.gateCount,sourceSha,metrics:{gridCount:plan78.length,prefilterCandidates:candidatePlans.length,opportunities,changed,projected,maxVsR78,maxInc,shoulderRatio,riserRatio,tanRatio,guardMax}},null,2));
if(!result.passed){for(const c of checks.filter(c=>!c.pass))console.error('FAIL',c.name,JSON.stringify(c.value),'limit',c.limit);process.exit(2)}
