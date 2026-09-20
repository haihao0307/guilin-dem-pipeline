import fs from 'node:fs';
import * as K from './r045_round17_kernel.mjs';
import * as R16 from '../round-16/r045_round16_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const stdev=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
function frameAt(path,u){const target=C(u,0,1)*(path.total||1);let i=0;while(i<path.cum.length-2&&path.cum[i+1]<target)i++;const a=path.p[i],b=path.p[i+1],L=(path.cum[i+1]-path.cum[i])||1,t=C((target-path.cum[i])/L,0,1),dx=b[0]-a[0],dz=b[1]-a[1],ll=Math.hypot(dx,dz)||1;return{x:M(a[0],b[0],t),z:M(a[1],b[1],t),nx:-dz/ll,nz:dx/ll}}
function sampleDelta(z0,z1){let max=0,sum=0,n=0,at=null;for(let x=-220;x<=220;x+=6)for(let z=z0;z<=z1;z+=4){const v=Math.abs(K.nestedBasinDelta(x,z));if(v>max){max=v;at=[x,z]}sum+=v;n++}return{max,mean:sum/(n||1),n,at}}
function drainageAwareBarrier(model,distanceFn,z0,z1,clearance=16){let max=-1e9,at=null,n=0;for(let x=-205;x<=205;x+=10)for(let z=z0;z<=z1;z+=4){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;const v=model.height(x,z+4)-model.height(x,z);n++;if(v>max){max=v;at=[x,z]}}return{max,at,n,clearance}}
function wallPersistence(model,distanceFn,z0=-198,z1=128,clearance=16,threshold=.55){let worst=null,totalEligible=0,rowsWithEligible=0;for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}if(eligible>0)rowsWithEligible++;totalEligible+=eligible;const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10),row={fraction,z,count,eligible,maxContiguousSpan:span};if(!worst||fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst=row}return{...(worst||{fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0}),clearance,threshold,totalEligible,rowsWithEligible}}

add('version',K.VERSION==='R045.17',K.VERSION,'R045.17');
add('water_graph_identity_preserved',K.nodes.length===R16.nodes.length&&K.edges.length===R16.edges.length,{nodes:[R16.nodes.length,K.nodes.length],edges:[R16.edges.length,K.edges.length]},'unchanged');
add('terrain_carrier_inventory_preserved',K.terrainChannels.length===R16.terrainChannels.length&&K.outletContinuum.length===R16.outletContinuum.length,{terrainChannels:[R16.terrainChannels.length,K.terrainChannels.length],outlets:[R16.outletContinuum.length,K.outletContinuum.length]},'unchanged');
add('three_nested_basin_profiles_present',K.nestedBasinProfiles.length===3,K.nestedBasinProfiles.map(p=>p.id),'A/B/C');
add('nested_profiles_are_not_parameter_clones',new Set(K.nestedBasinProfiles.map(p=>[p.amp,p.sourceSpan,p.transportSpan,p.width,p.skew,p.drift,p.phase].join('|'))).size===3,K.nestedBasinProfiles.map(({id,amp,sourceSpan,transportSpan,width,skew,drift,phase})=>({id,amp,sourceSpan,transportSpan,width,skew,drift,phase})),'3 distinct signatures');

const delta=sampleDelta(-217,-37);
add('nested_basin_change_is_substantive',delta.max>.16&&delta.max<=1.321,delta,'0.16 < max <= 1.321 m');
add('nested_basin_change_is_bounded',delta.mean<.20,delta.mean,'absolute mean <0.20 m');
let nearDrain=0,nearN=0,upper=0,lower=0,receiver=0;for(let x=-220;x<=220;x+=10){for(let z=-216;z<=-38;z+=6){if(K.nearestExtendedDrainageDistance(x,z)<=11.5){nearDrain=Math.max(nearDrain,Math.abs(K.nestedBasinDelta(x,z)));nearN++}}for(const z of [-300,-260,-230,-220])upper=Math.max(upper,Math.abs(K.height(x,z)-R16.height(x,z)));for(const z of [0,40,80,120])lower=Math.max(lower,Math.abs(K.height(x,z)-R16.height(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R16.height(x,rz+dz)))}
add('complete_drainage_skeleton_is_protected',nearN>20&&nearDrain<1e-9,{nearN,nearDrain},'sampled d<=11.5 m: zero nested delta');
add('rear_ridge_controls_unchanged',upper<1e-9,upper,'0 sampled change z<=-220');
add('r16_lower_foothill_plain_and_receiver_unchanged',lower<1e-9&&receiver<1e-9,{lower,receiver},'0 sampled change at z>=0 and around receiver');

const signatures=[];for(const p of K.nestedBasinProfiles){const samples=[];for(const u of [.20,.45,.67]){const f=frameAt(p.path,u);const progress=C((u-.08)/.68,0,1),span=M(p.sourceSpan,p.transportSpan,progress),drift=p.drift*(.62*Math.sin(Math.PI*(u*1.08)+p.phase)+.38*(u-.46));const lc=span+drift,rc=span*.94-drift*.58;const l=K.nestedBasinComponent(p,f.x+f.nx*lc,f.z+f.nz*lc),r=K.nestedBasinComponent(p,f.x-f.nx*rc,f.z-f.nz*rc);samples.push({u,z:f.z,left:l,right:r,mean:(l+r)/2,lr:l-r,drift,lc,rc})}signatures.push({id:p.id,samples,meanShoulder:mean(samples.map(s=>s.mean)),meanLR:mean(samples.map(s=>s.lr)),driftRange:Math.max(...samples.map(s=>s.drift))-Math.min(...samples.map(s=>s.drift)),centreShiftRange:Math.max(...samples.map(s=>s.lc))-Math.min(...samples.map(s=>s.lc))})}
add('all_three_basins_gain_nested_macro_relief',signatures.every(s=>s.meanShoulder>.02),signatures,'each sampled mean shoulder response >0.02 m');
add('basin_cross_sections_are_not_clones',stdev(signatures.map(s=>s.meanLR))>.02,signatures,'cross-basin L/R signature stdev >0.02 m');
add('transverse_centres_drift_along_each_basin',signatures.every(s=>s.driftRange>7&&s.centreShiftRange>8),signatures,'each basin drift range >7 m and centre shift >8 m');

let maxStep=0,stepAt=null;for(let x=-215;x<=215;x+=10)for(let z=-216;z<=-38;z+=4){const v=Math.abs(K.nestedBasinDelta(x,z+4)-K.nestedBasinDelta(x,z));if(v>maxStep){maxStep=v;stepAt=[x,z]}}
add('nested_field_has_no_new_longitudinal_step',maxStep<.22,{maxStep,at:stepAt},'<0.22 m delta change per 4 m');
const rowStats=[];for(let z=-196;z<=-52;z+=12){const a=[];for(let x=-210;x<=210;x+=10)a.push(K.nestedBasinDelta(x,z));rowStats.push({z,mean:mean(a),stdev:stdev(a),max:Math.max(...a),min:Math.min(...a)})}
add('macro_relief_is_cross_slope_structured_not_uniform_lift',rowStats.filter(r=>r.stdev>.04).length>=5,rowStats,'at least 5 rows delta stdev >0.04 m');

const oldWall=wallPersistence(R16,R16.nearestExtendedDrainageDistance),newWall=wallPersistence(K,K.nearestExtendedDrainageDistance);
add('wall_gate_has_real_sampling_coverage',oldWall.totalEligible>500&&newWall.totalEligible>500&&oldWall.rowsWithEligible>20&&newWall.rowsWithEligible>20,{r16:{totalEligible:oldWall.totalEligible,rowsWithEligible:oldWall.rowsWithEligible},r17:{totalEligible:newWall.totalEligible,rowsWithEligible:newWall.rowsWithEligible}},'>500 samples and >20 rows each');
add('persistent_cross_slope_wall_not_reintroduced',newWall.fraction<.12&&newWall.maxContiguousSpan<60,{r16:oldWall,r17:newWall},'R17 fraction <12%, contiguous span <60 m');
const candidate=drainageAwareBarrier(K,K.nearestExtendedDrainageDistance,-158,8,16);
add('candidate_slope_forward_reversal_bounded',candidate.max<.55,candidate,'<0.55 m rise per 4 m, >=16 m from drainage');

let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.04,mean(tFar),'>0.04; geometry still locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('reference_is_visual_not_metric_truth',K.snapshot.round17?.referenceUse?.includes('no metric extraction'),K.snapshot.round17?.referenceUse,'visual hierarchy only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round17?.forbiddenClaims)&&K.snapshot.round17.forbiddenClaims.length>=7,K.snapshot.round17?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,nearDrainProtection:{nearN,nearDrain},upper,lower,receiver,signatures,maxLongitudinalDeltaStep:{value:maxStep,at:stepAt},rowStats,oldWall,newWall,candidate,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar)}};
fs.writeFileSync(new URL('./r045_round17_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
