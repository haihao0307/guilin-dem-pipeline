import fs from 'node:fs';
import * as K from './r045_round58_kernel.mjs';
import * as R56 from '../round-56/r045_round56_kernel.mjs';
import * as R47 from '../round-47/r045_round47_kernel.mjs';

const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const xs=[];for(let x=-216;x<=114;x+=6)xs.push(x);const zs=[];for(let z=-126;z<=6;z+=6)zs.push(z);
let active=0,groups=[0,0,0],maskChange=0,stepChange=0,phaseChange=0,indexChange=0,baseChange=0,strongErr=0,maxChange=0,changed=0,mediumChanged=0,coverageGainSum=0,coverageGainMax=0,unsupportedChanged=0,hardChanged=0,unsafeChanged=0,receiverChanged=0;
const changedGroups=new Set(),changedPts=[];
for(const x of xs)for(const z of zs){
  const n=K.terraceStateAt(x,z),p=R56.terraceStateAt(x,z),b=R47.terraceStateAt(x,z),d=Math.abs(n.delta-p.delta),dd=K.nearestExtendedDrainageDistance(x,z);
  if(n.mask>.12){active++;if(n.groupIndex>=0&&n.groupIndex<3)groups[n.groupIndex]++}
  maskChange=Math.max(maskChange,Math.abs(n.mask-b.mask));stepChange=Math.max(stepChange,Math.abs(n.step-b.step));phaseChange=Math.max(phaseChange,Math.abs(n.phase-b.phase));indexChange=Math.max(indexChange,Math.abs(n.index-b.index));baseChange=Math.max(baseChange,Math.abs(n.base-b.base));
  if(b.mask>=.64)strongErr=Math.max(strongErr,d);
  maxChange=Math.max(maxChange,d);
  if(d>1e-6){
    changed++;changedPts.push({x,z,change:n.delta-p.delta,mask:b.mask,groupIndex:b.groupIndex,coverageGain:n.coverageProfileGain||0,dd});
    if(b.mask>.22&&b.mask<.64){mediumChanged++;changedGroups.add(b.groupIndex);coverageGainSum+=n.coverageProfileGain||0;coverageGainMax=Math.max(coverageGainMax,n.coverageProfileGain||0)}else unsupportedChanged++;
    if(dd<=12)hardChanged++;if(dd<12)unsafeChanged++;
    const gap=Math.abs(z-K.riverZ(x)),w=K.riverW(x);if(gap<=w+12)receiverChanged++;
  }
}
let maxInc=0,maxIncAt=null;
for(const p of changedPts){
  const{x,z}=p,c=K.terraceDelta(x,z),tests=[[x+3,z],[x-3,z],[x,z+3],[x,z-3]];
  for(const [xx,zz] of tests){const inc=Math.abs(K.terraceDelta(xx,zz)-c);if(inc>maxInc){maxInc=inc;maxIncAt={x,z,xx,zz,inc}}}
}
const avgCoverageGain=mediumChanged?coverageGainSum/mediumChanged:0;
add('version',K.VERSION==='R045.58',K.VERSION,'R045.58');
add('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R47.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R47.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact inherited graph');
add('plan_frame_frozen',maskChange===0&&stepChange===0&&phaseChange===0&&indexChange===0&&baseChange===0,{maskChange,stepChange,phaseChange,indexChange,baseChange},'exact R47 mask/step/phase/index/base');
add('strong_core_exact',strongErr<1e-12,strongErr,'R56 exact at R47 mask >=0.64');
add('medium_support_material',mediumChanged>=6,{mediumChanged,changed,active},'>=6 changed 6m audit cells in inherited medium support');
add('medium_support_multifamily',changedGroups.size>=2,[...changedGroups],'>=2 terrace families participate');
add('coverage_gain_material',avgCoverageGain>.01&&coverageGainMax>.03,{avgCoverageGain,coverageGainMax},'mean >0.01 and max >0.03');
add('height_change_bounded',maxChange>.002&&maxChange<.10,maxChange,'0.002m < max terrace-delta change <0.10m');
add('support_localized',unsupportedChanged===0,unsupportedChanged,'no change outside R47 0.22<mask<0.64 band');
add('hard_drainage_exact',hardChanged===0&&unsafeChanged===0,{hardChanged,unsafeChanged},'zero R58 changes inside <=12m drainage core');
add('foreground_receiver_unchanged',receiverChanged===0,receiverChanged,'zero changed samples within receiver +12m band');
add('original_three_meter_cliff_gate_restored',maxInc<1.05,{maxInc,maxIncAt,r57FailedValue:1.112919833351231},'<1.05m terrace increment / 3m at every changed 6m audit cell; R57 failed at 1.112919833351231m');
add('three_groups_retained',groups.every(v=>v>20),groups,'three terrace families material on 6m lattice');
add('locks_retained',K.snapshot.visualAcceptance===false&&K.snapshot.parcelGenerationEnabled===false&&K.snapshot.waterStateKnown===false&&K.snapshot.productionReady===false,{visual:K.snapshot.visualAcceptance,parcel:K.snapshot.parcelGenerationEnabled,water:K.snapshot.waterStateKnown,production:K.snapshot.productionReady},'all false pending manual fixed-view review');
add('measurement_coarsening_fallacy_rejected',K.snapshot.round58?.logicCorrection?.includes('measurement-coarsening fallacy')&&K.snapshot.round58?.logicCorrection?.includes('restores the 6 m'),K.snapshot.round58?.logicCorrection,'coarser audit cannot erase a finer-grid failure');
add('field_constraint_explicit',K.snapshot.round58?.constraint?.includes('synthetic morphology/QA parameters')&&K.snapshot.round58?.constraint?.includes('cannot provide'),K.snapshot.round58?.constraint,'field truth missing');
add('xiaoma_boundary_retained',K.snapshot.round58?.xiaomaBoundary?.includes('do not establish'),K.snapshot.round58?.xiaomaBoundary,'geometry evidence != hydraulic truth');
add('mrrolord_ordering_only',K.snapshot.round58?.mrRolordUse?.includes('ordering discipline')&&K.snapshot.round58?.mrRolordUse?.includes('not agricultural truth'),K.snapshot.round58?.mrRolordUse,'ordering only');
add('reference_nonmetric',K.snapshot.round58?.referenceUse?.includes('non-metric')&&K.snapshot.round58?.referenceUse?.includes('No width'),K.snapshot.round58?.referenceUse,'nonmetric only');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{active,groups,mediumChanged,changed,changedGroups:[...changedGroups],changedPoints:changedPts.slice(0,24),avgCoverageGain,coverageGainMax,strongErr,maxChange,unsupportedChanged,hardChanged,receiverChanged,maxInc,maxIncAt,maskChange,stepChange,phaseChange,indexChange,baseChange,qaScope:'authoritative 6m whole-slope change search; 3m neighbor cliff checks at every changed 6m cell; unchanged areas inherit R56 which already passed its global 3m gate'}};
fs.writeFileSync(new URL('./r045_round58_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
