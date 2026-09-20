import fs from 'node:fs';
import * as K from './r045_round65_kernel.mjs';
import * as R58 from '../round-58/r045_round58_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';

const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const xs=[];for(let x=-216;x<=114;x+=6)xs.push(x);const zs=[];for(let z=-126;z<=6;z+=6)zs.push(z);
const med=a=>{if(!a.length)return null;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
function macroNormal(x,z){const e=2,gx=(R30.height(x+e,z)-R30.height(x-e,z))/(2*e),gz=(R30.height(x,z+e)-R30.height(x,z-e))/(2*e),m=Math.hypot(gx,gz);return m<1e-9?{nx:1,nz:0}:{nx:gx/m,nz:gz/m}}
function dirAbs(fn,x,z,h=.6){const n=macroNormal(x,z);return Math.abs((fn(x+h*n.nx,z+h*n.nz)-fn(x-h*n.nx,z-h*n.nz))/(2*h))}
function receiverBand(x,z){return Math.abs(z-R30.riverZ(x))<=R30.riverW(x)+12}

let activeN=0,activeP=0,thresholdCross=0,maskErr=0,stepErr=0,phaseErr=0,indexErr=0,baseErr=0,groupErr=0;
let eligible=0,changed=0,changedEligible=0,inactiveChanged=0,hardChanged=0,receiverChanged=0,unsupportedChanged=0,strongErr=0,maxChange=0,maxGain=0,sumGain=0;
const groups=[0,0,0],changedGroups=new Set(),changedPts=[];const benchN=[],benchP=[],riserN=[],riserP=[];
for(const x of xs)for(const z of zs){
  const n=K.terraceStateAt(x,z),p=R58.terraceStateAt(x,z),b=R47.terraceStateAt(x,z),blend=K.coverageBlendAt(x,z),d=Math.abs(n.delta-p.delta),dd=R30.nearestExtendedDrainageDistance(x,z);
  if(n.mask>.12){activeN++;if(n.groupIndex>=0&&n.groupIndex<3)groups[n.groupIndex]++}if(p.mask>.12)activeP++;if((p.mask>.12)!==(n.mask>.12))thresholdCross++;
  maskErr=Math.max(maskErr,Math.abs(n.mask-b.mask));stepErr=Math.max(stepErr,Math.abs(n.step-b.step));phaseErr=Math.max(phaseErr,Math.abs(n.phase-b.phase));indexErr=Math.max(indexErr,Math.abs(n.index-b.index));baseErr=Math.max(baseErr,Math.abs(n.base-b.base));if(n.groupIndex!==b.groupIndex)groupErr++;
  if(b.mask>=.55)strongErr=Math.max(strongErr,d);
  const isEligible=b.mask>.12&&blend.gain>1e-7&&dd>12&&!receiverBand(x,z);if(isEligible){eligible++;sumGain+=blend.gain;maxGain=Math.max(maxGain,blend.gain)}
  if(d>1e-6){changed++;maxChange=Math.max(maxChange,d);if(isEligible)changedEligible++;else unsupportedChanged++;if(b.mask<=.12)inactiveChanged++;if(dd<=12)hardChanged++;if(receiverBand(x,z))receiverChanged++;changedGroups.add(b.groupIndex);const u=(b.base+b.phase)/b.step,f=u-Math.floor(u);changedPts.push({x,z,change:n.delta-p.delta,mask:b.mask,groupIndex:b.groupIndex,coverageGain:blend.gain,phaseFrac:f,dd});
    if(f<=.34||f>=.66){benchN.push(dirAbs(K.height,x,z));benchP.push(dirAbs(R58.height,x,z))}
    if(f>=.44&&f<=.56){riserN.push(dirAbs(K.terraceDelta,x,z));riserP.push(dirAbs(R58.terraceDelta,x,z))}
  }
}
const meanGain=eligible?sumGain/eligible:0;
let maxInc=0,maxIncAt=null;for(const p of changedPts){const c=K.terraceDelta(p.x,p.z);for(const[xx,zz]of[[p.x+3,p.z],[p.x-3,p.z],[p.x,p.z+3],[p.x,p.z-3]]){const inc=Math.abs(K.terraceDelta(xx,zz)-c);if(inc>maxInc){maxInc=inc;maxIncAt={x:p.x,z:p.z,xx,zz,inc}}}}
let outside=0,hard=0,receiver=0;for(let x=-216;x<=216;x+=36){for(const z of [-300,-220,-170,-145,30,70,130])outside=Math.max(outside,Math.abs(K.terraceDelta(x,z)));for(let z=-126;z<=6;z+=18)if(R30.nearestExtendedDrainageDistance(x,z)<=12)hard=Math.max(hard,Math.abs(K.terraceDelta(x,z)-R58.terraceDelta(x,z)));const rz=R30.riverZ(x);for(const dz of [-8,0,8])receiver=Math.max(receiver,Math.abs(K.terraceDelta(x,rz+dz)-R58.terraceDelta(x,rz+dz)))}
const bench={n:benchN.length,newMedian:med(benchN),priorMedian:med(benchP)};bench.ratio=bench.n&&bench.priorMedian>1e-9?bench.newMedian/bench.priorMedian:null;
const riser={n:riserN.length,newMedian:med(riserN),priorMedian:med(riserP)};riser.ratio=riser.n&&riser.priorMedian>1e-9?riser.newMedian/riser.priorMedian:null;
const contrast=(bench.n&&riser.n&&bench.newMedian>1e-9&&bench.priorMedian>1e-9)?{new:riser.newMedian/bench.newMedian,prior:riser.priorMedian/bench.priorMedian,ratio:(riser.newMedian/bench.newMedian)/(riser.priorMedian/bench.priorMedian)}:null;

add('version',K.VERSION==='R045.65',K.VERSION,'R045.65');
add('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R58.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R58.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact R58 inherited graph');
add('plan_frame_exact',maskErr===0&&stepErr===0&&phaseErr===0&&indexErr===0&&baseErr===0&&groupErr===0,{maskErr,stepErr,phaseErr,indexErr,baseErr,groupErr},'exact R47/R58 mask/group/step/phase/index/base');
add('active_footprint_exact',activeN===activeP&&thresholdCross===0,{activeN,activeP,thresholdCross},'exact accepted R58 active footprint; zero threshold crossings');
add('weak_active_coverage_material',eligible>=12&&changedEligible>=8&&changedEligible/Math.max(1,eligible)>=.55,{eligible,changedEligible,ratio:changedEligible/Math.max(1,eligible)},'>=12 eligible existing-active cells; >=8 material height changes; >=55% realization');
add('coverage_gain_material',meanGain>.006&&maxGain>.02,{meanGain,maxGain},'mean >0.006 and max >0.02 blend gain on eligible support');
add('multifamily_profile_change',changedGroups.size>=2,[...changedGroups],'>=2 terrace families participate');
add('inactive_cells_exact',inactiveChanged===0,inactiveChanged,'zero change where inherited mask <=0.12');
add('strong_profile_exact',strongErr<1e-12,strongErr,'exact R58 at inherited mask >=0.55');
add('all_changes_supported',unsupportedChanged===0,unsupportedChanged,'every changed 6m cell belongs to eligible existing-active profile band');
add('hard_drainage_exact',hardChanged===0&&hard<1e-12,{hardChanged,hard},'zero R65-R58 change in <=12m drainage core');
add('foreground_receiver_exact',receiverChanged===0&&receiver<1e-12,{receiverChanged,receiver},'zero R65-R58 change in receiver +12m band');
add('support_localized',outside<1e-9,outside,'0 outside terrace support domain');
add('height_change_bounded',maxChange>.002&&maxChange<.10,maxChange,'0.002m < max R65-R58 delta <0.10m');
add('three_meter_cliff_gate',maxInc<1.05,{maxInc,maxIncAt},'<1.05m terrace increment / 3m at every changed 6m cell');
add('three_groups_retained',groups.every(v=>v>20),groups,'three terrace families material');
add('directional_profile_not_degraded',(bench.n<3||bench.ratio<=1.12)&&(riser.n<3||riser.ratio>=.90),{bench,riser},'where sampled: composed bench <=112% R58 and terrace riser >=90% R58');
add('profile_contrast_not_degraded',contrast===null||contrast.ratio>=.90,contrast,'riser/bench directional contrast >=90% R58');
add('locks_retained',K.snapshot.visualAcceptance===false&&K.snapshot.parcelGenerationEnabled===false&&K.snapshot.waterStateKnown===false&&K.snapshot.productionReady===false,{visual:K.snapshot.visualAcceptance,parcel:K.snapshot.parcelGenerationEnabled,water:K.snapshot.waterStateKnown,production:K.snapshot.productionReady},'all false pending fixed-view review');
add('wrong_bottleneck_corrected',K.snapshot.round65?.logicCorrection?.includes('wrong bottleneck')&&K.snapshot.round65?.logicCorrection?.includes('548 already-active terrace cells')&&K.snapshot.round65?.logicCorrection?.includes('16 inactive weak cells'),K.snapshot.round65?.logicCorrection,'footprint-promotion quota rejected as materiality proxy');
add('field_constraint_explicit',K.snapshot.round65?.constraint?.includes('synthetic morphology/QA scales')&&K.snapshot.round65?.constraint?.includes('cannot supply'),K.snapshot.round65?.constraint,'field truth missing');
add('xiaoma_boundary_retained',K.snapshot.round65?.xiaomaBoundary?.includes('do not establish'),K.snapshot.round65?.xiaomaBoundary,'geometry != hydraulic truth');
add('mrrolord_ordering_only',K.snapshot.round65?.mrRolordUse?.includes('ordering discipline')&&K.snapshot.round65?.mrRolordUse?.includes('not agricultural truth'),K.snapshot.round65?.mrRolordUse,'ordering only');
add('reference_nonmetric',K.snapshot.round65?.referenceUse?.includes('non-metric')&&K.snapshot.round65?.referenceUse?.includes('No width'),K.snapshot.round65?.referenceUse,'nonmetric only');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{activeN,activeP,thresholdCross,groups,eligible,changed,changedEligible,changedGroups:[...changedGroups],meanGain,maxGain,changedPoints:changedPts,inactiveChanged,unsupportedChanged,hardChanged,receiverChanged,strongErr,maxChange,maxInc,maxIncAt,outside,hard,receiver,bench,riser,contrast,qaScope:'authoritative 6m whole-slope existing-active profile-coverage sweep + exact plan/footprint locks + directional cross-contour profile diagnostics + 3m local cliff checks at every changed 6m cell'}};
fs.writeFileSync(new URL('./r045_round65_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
