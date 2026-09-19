import fs from 'node:fs';import * as K from './r045_round57_kernel.mjs';import * as R56 from '../round-56/r045_round56_kernel.mjs';import * as R47 from '../round-47/r045_round47_kernel.mjs';
const checks=[];const add=(n,p,v,l)=>checks.push({name:n,pass:Boolean(p),value:v,limit:l});
// R56 already validated the 0.30 m strong-support profile. R57 changes only coverage, so use a bounded 12 m
// whole-slope lattice plus focused 3 m cliff checks only where the new profile actually differs.
const xs=[];for(let x=-216;x<=120;x+=12)xs.push(x);const zs=[];for(let z=-126;z<=6;z+=12)zs.push(z);
let active=0,groups=[0,0,0],maskChange=0,stepChange=0,phaseChange=0,indexChange=0,baseChange=0,strongErr=0,maxChange=0,changed=0,mediumChanged=0,coverageGainSum=0,coverageGainMax=0,unsafeChanged=0,unsupportedChanged=0,hardChanged=0,receiverChanged=0,maxInc=0;const changedGroups=new Set(),changedPts=[];
for(const x of xs)for(const z of zs){
 const n=K.terraceStateAt(x,z),p=R56.terraceStateAt(x,z),b=R47.terraceStateAt(x,z),d=Math.abs(n.delta-p.delta),dd=K.nearestExtendedDrainageDistance(x,z);
 if(n.mask>.12){active++;if(n.groupIndex>=0&&n.groupIndex<3)groups[n.groupIndex]++}
 maskChange=Math.max(maskChange,Math.abs(n.mask-b.mask));stepChange=Math.max(stepChange,Math.abs(n.step-b.step));phaseChange=Math.max(phaseChange,Math.abs(n.phase-b.phase));indexChange=Math.max(indexChange,Math.abs(n.index-b.index));baseChange=Math.max(baseChange,Math.abs(n.base-b.base));
 if(b.mask>=.64)strongErr=Math.max(strongErr,d);
 maxChange=Math.max(maxChange,d);if(d>1e-6){changed++;changedPts.push([x,z]);if(b.mask>.22&&b.mask<.64){mediumChanged++;changedGroups.add(b.groupIndex);coverageGainSum+=n.coverageProfileGain||0;coverageGainMax=Math.max(coverageGainMax,n.coverageProfileGain||0)}else unsupportedChanged++;if(dd<=12)hardChanged++;const gap=Math.abs(z-K.riverZ(x)),w=K.riverW(x);if(gap<=w+12)receiverChanged++;if(dd<12)unsafeChanged++;}
}
for(const [x,z] of changedPts){maxInc=Math.max(maxInc,Math.abs(K.terraceDelta(x+3,z)-K.terraceDelta(x,z)),Math.abs(K.terraceDelta(x-3,z)-K.terraceDelta(x,z)),Math.abs(K.terraceDelta(x,z+3)-K.terraceDelta(x,z)),Math.abs(K.terraceDelta(x,z-3)-K.terraceDelta(x,z)))}
const avgCoverageGain=mediumChanged?coverageGainSum/mediumChanged:0;
add('version',K.VERSION==='R045.57',K.VERSION,'R045.57');
add('water_graph_identity',JSON.stringify(K.nodes)===JSON.stringify(R47.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R47.edges),{nodes:K.nodes.length,edges:K.edges.length},'exact inherited graph');
add('plan_frame_frozen',maskChange===0&&stepChange===0&&phaseChange===0&&indexChange===0&&baseChange===0,{maskChange,stepChange,phaseChange,indexChange,baseChange},'exact R47 plan frame');
add('strong_core_exact',strongErr<1e-12,strongErr,'R56/R54 exact at R47 mask >=0.64');
add('medium_support_material',mediumChanged>=4,{mediumChanged,changed,active},'>=4 changed 12m audit cells in inherited medium support');
add('medium_support_multifamily',changedGroups.size>=2,[...changedGroups],'>=2 terrace families participate');
add('coverage_gain_material',avgCoverageGain>.015&&coverageGainMax>.04,{avgCoverageGain,coverageGainMax},'mean >0.015 and max >0.04');
add('height_change_bounded',maxChange>.002&&maxChange<.18,maxChange,'0.002m < max terrace-delta change <0.18m');
add('support_localized',unsupportedChanged===0,unsupportedChanged,'no change outside R47 0.22<mask<0.64 band');
add('hard_drainage_exact',hardChanged===0&&unsafeChanged===0,{hardChanged,unsafeChanged},'zero new change inside <=12m drainage core');
add('foreground_receiver_unchanged',receiverChanged===0,receiverChanged,'zero changed samples within receiver +12m band');
add('three_meter_cliff_bound',maxInc<1.05,maxInc,'<1.05m terrace increment / 3m at changed cells');
add('three_groups_retained',groups.every(v=>v>5),groups,'three groups present on bounded audit lattice');
add('locks_retained',K.snapshot.visualAcceptance===false&&K.snapshot.parcelGenerationEnabled===false&&K.snapshot.waterStateKnown===false&&K.snapshot.productionReady===false,{visual:K.snapshot.visualAcceptance,parcel:K.snapshot.parcelGenerationEnabled,water:K.snapshot.waterStateKnown,production:K.snapshot.productionReady},'all false pending fixed-view manual review');
add('coverage_fallacy_corrected',K.snapshot.round57?.logicCorrection?.includes('sampling-to-coverage fallacy')&&K.snapshot.round57?.logicCorrection?.includes('not sufficient'),K.snapshot.round57?.logicCorrection,'local validity != slope-scale coverage');
add('field_constraint_explicit',K.snapshot.round57?.constraint?.includes('synthetic morphology/QA parameters')&&K.snapshot.round57?.constraint?.includes('cannot provide'),K.snapshot.round57?.constraint,'field truth missing');
add('xiaoma_boundary_retained',K.snapshot.round57?.xiaomaBoundary?.includes('do not establish'),K.snapshot.round57?.xiaomaBoundary,'geometry evidence != hydraulic truth');
add('mrrolord_ordering_only',K.snapshot.round57?.mrRolordUse?.includes('ordering discipline')&&K.snapshot.round57?.mrRolordUse?.includes('not agricultural truth'),K.snapshot.round57?.mrRolordUse,'ordering only');
add('reference_nonmetric',K.snapshot.round57?.referenceUse?.includes('non-metric')&&K.snapshot.round57?.referenceUse?.includes('No width'),K.snapshot.round57?.referenceUse,'nonmetric only');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{active,groups,mediumChanged,changed,changedGroups:[...changedGroups],avgCoverageGain,coverageGainMax,strongErr,maxChange,unsupportedChanged,hardChanged,receiverChanged,maxInc,maskChange,stepChange,phaseChange,indexChange,baseChange,qaScope:'12m whole-slope plan-frame audit plus focused 3m cliff checks at changed cells; browser fixed view built separately'}};fs.writeFileSync(new URL('./r045_round57_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
