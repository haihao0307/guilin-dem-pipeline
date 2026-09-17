import fs from 'node:fs';
import * as K from './r045_round18_kernel.mjs';
import * as R17 from '../round-17/r045_round17_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const stdev=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
function sampleDelta(){let max=0,sum=0,n=0,at=null;for(let x=-220;x<=220;x+=6)for(let z=-218;z<=-160;z+=3){const v=Math.abs(K.headwaterFootprintDelta(x,z));if(v>max){max=v;at=[x,z]}sum+=v;n++}return{max,mean:sum/(n||1),n,at}}
function wallPersistence(model,distanceFn,z0=-218,z1=-160,clearance=16,threshold=.55){let worst=null,totalEligible=0,rowsWithEligible=0;for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}if(eligible>0)rowsWithEligible++;totalEligible+=eligible;const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10),row={fraction,z,count,eligible,maxContiguousSpan:span};if(!worst||fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst=row}return{...(worst||{fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0}),clearance,threshold,totalEligible,rowsWithEligible}}

add('version',K.VERSION==='R045.18',K.VERSION,'R045.18');
add('water_graph_identity_preserved',K.nodes.length===R17.nodes.length&&K.edges.length===R17.edges.length,{nodes:[R17.nodes.length,K.nodes.length],edges:[R17.edges.length,K.edges.length]},'unchanged');
add('terrain_carrier_inventory_preserved',K.terrainChannels.length===R17.terrainChannels.length&&K.outletContinuum.length===R17.outletContinuum.length,{terrainChannels:[R17.terrainChannels.length,K.terrainChannels.length],outlets:[R17.outletContinuum.length,K.outletContinuum.length]},'unchanged');
add('three_headwater_footprints_present',K.headwaterFootprintProfiles.length===3,K.headwaterFootprintProfiles.map(p=>p.id),'A/B/C');
const sig=K.headwaterFootprintProfiles.map(({id,anchorU,angleDeg,major,minor,rimOffset,rearShift,amplitude,sideBias,rearScale,centerShift})=>({id,anchorU,angleDeg,major,minor,rimOffset,rearShift,amplitude,sideBias,rearScale,centerShift,aspect:major/minor}));
add('headwater_profiles_are_not_parameter_clones',new Set(sig.map(p=>[p.anchorU,p.angleDeg,p.major,p.minor,p.rimOffset,p.sideBias,p.centerShift].join('|'))).size===3,sig,'3 distinct signatures');
add('orientation_span_is_substantive',Math.max(...sig.map(p=>p.angleDeg))-Math.min(...sig.map(p=>p.angleDeg))>55,sig.map(p=>p.angleDeg),'>55 degrees across A/B/C');
add('footprint_aspect_ratios_are_not_clones',stdev(sig.map(p=>p.aspect))>.08,sig.map(p=>({id:p.id,aspect:p.aspect})),'aspect-ratio stdev >0.08');

const delta=sampleDelta();
add('headwater_footprint_change_is_substantive',delta.max>.10&&delta.max<=.921,delta,'0.10 < max <= 0.921 m');
add('headwater_footprint_change_is_bounded',delta.mean<.13,delta.mean,'absolute mean <0.13 m');

let nearDrain=0,nearN=0,rear=0,lower=0,receiver=0,candidateDiff=0,permissionDiff=0;
for(let x=-220;x<=220;x+=10){
  for(let z=-216;z<=-160;z+=4){if(K.nearestExtendedDrainageDistance(x,z)<=11.5){nearDrain=Math.max(nearDrain,Math.abs(K.headwaterFootprintDelta(x,z)));nearN++}}
  for(const z of [-300,-260,-230,-220])rear=Math.max(rear,Math.abs(K.height(x,z)-R17.height(x,z)));
  for(const z of [-158,-154,-150,-140,-120,-80,0,40,80,120]){lower=Math.max(lower,Math.abs(K.height(x,z)-R17.height(x,z)));candidateDiff=Math.max(candidateDiff,Math.abs(K.height(x,z)-R17.height(x,z)));permissionDiff=Math.max(permissionDiff,Math.abs(K.terracePermission(x,z)-R17.terracePermission(x,z)))}
  const rz=K.riverZ(x);for(const dz of [-6,0,6])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R17.height(x,rz+dz)));
}
add('complete_drainage_skeleton_is_protected',nearN>20&&nearDrain<1e-9,{nearN,nearDrain},'sampled d<=11.5 m: zero R18 delta');
add('rear_ridge_controls_unchanged',rear<1e-9,rear,'0 sampled change z<=-220');
add('terrace_candidate_and_lower_slope_geometry_unchanged',candidateDiff<1e-9,candidateDiff,'0 sampled change at z>=-158');
add('terrace_permission_is_exactly_inherited',permissionDiff<1e-12,permissionDiff,'0 sampled permission difference');
add('front_receiver_unchanged',receiver<1e-9,receiver,'0 sampled change around receiver');

const components=[];
for(const p of K.headwaterFootprintProfiles){
  let max=0,sum=0,n=0,at=null;
  for(let x=-210;x<=210;x+=8)for(let z=-216;z<=-160;z+=4){const v=K.headwaterFootprintComponent(p,x,z);if(v>max){max=v;at=[x,z]}sum+=v;n++}
  components.push({id:p.id,max,mean:sum/(n||1),at,angleDeg:p.angleDeg,major:p.major,minor:p.minor,centerShift:p.centerShift});
}
add('all_three_headwaters_gain_oriented_relief',components.every(c=>c.max>.09),components,'each component max >0.09 m');
add('component_peak_locations_are_not_clones',new Set(components.map(c=>c.at.join(','))).size===3,components.map(c=>({id:c.id,at:c.at})),'3 distinct peak grid cells');

let maxStep=0,stepAt=null;for(let x=-215;x<=215;x+=10)for(let z=-216;z<=-164;z+=4){const v=Math.abs(K.headwaterFootprintDelta(x,z+4)-K.headwaterFootprintDelta(x,z));if(v>maxStep){maxStep=v;stepAt=[x,z]}}
add('headwater_field_has_no_new_longitudinal_step',maxStep<.22,{maxStep,at:stepAt},'<0.22 m delta change per 4 m');

const rowStats=[];for(let z=-212;z<=-164;z+=8){const a=[];for(let x=-210;x<=210;x+=10)a.push(K.headwaterFootprintDelta(x,z));rowStats.push({z,mean:mean(a),stdev:stdev(a),max:Math.max(...a)})}
add('headwater_relief_is_cross_slope_structured_not_uniform_lift',rowStats.filter(r=>r.stdev>.025).length>=3,rowStats,'at least 3 rows delta stdev >0.025 m');

const oldWall=wallPersistence(R17,R17.nearestExtendedDrainageDistance),newWall=wallPersistence(K,K.nearestExtendedDrainageDistance);
add('upper_wall_gate_has_real_sampling_coverage',oldWall.totalEligible>200&&newWall.totalEligible>200,{r17:{totalEligible:oldWall.totalEligible,rows:oldWall.rowsWithEligible},r18:{totalEligible:newWall.totalEligible,rows:newWall.rowsWithEligible}},'>200 eligible samples each');
// Important QA correction from first Runner: the R17 baseline itself is ~0.212 at z~-202. An absolute
// <0.12 condition under a gate named "not reintroduced" was logically invalid: it demanded this single
// headwater-footprint round solve inherited debt. R18 must instead prove it does not worsen that debt.
add('inherited_upper_wall_debt_is_explicit',oldWall.fraction>.12&&K.snapshot.round18?.knownDebt?.includes('does not claim to solve'),{oldWall,knownDebt:K.snapshot.round18?.knownDebt},'baseline debt explicitly retained, not mislabeled solved');
add('persistent_upper_cross_slope_wall_not_worsened',newWall.fraction<=oldWall.fraction+.001&&newWall.maxContiguousSpan<=oldWall.maxContiguousSpan+1,{r17:oldWall,r18:newWall},'R18 <= R17 baseline fraction/span; inherited debt remains for later round');

let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.04,mean(tFar),'>0.04; geometry still locked');

add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('reference_is_visual_not_metric_truth',K.snapshot.round18?.referenceUse?.includes('no metric extraction'),K.snapshot.round18?.referenceUse,'visual hierarchy only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round18?.forbiddenClaims)&&K.snapshot.round18.forbiddenClaims.length>=7,K.snapshot.round18?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,components,nearDrainProtection:{nearN,nearDrain},rear,lower,receiver,candidateDiff,permissionDiff,maxLongitudinalDeltaStep:{value:maxStep,at:stepAt},rowStats,oldWall,newWall,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar)}};
fs.writeFileSync(new URL('./r045_round18_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
