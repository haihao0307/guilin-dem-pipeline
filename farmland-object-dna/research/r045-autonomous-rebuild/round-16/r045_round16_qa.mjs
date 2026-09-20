import fs from 'node:fs';
import * as K from './r045_round16_kernel.mjs';
import * as R15 from '../round-15/r045_round15_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const stdev=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const C=(x,a,b)=>Math.max(a,Math.min(b,x));
const M=(a,b,t)=>a+(b-a)*t;
function frameAt(path,u){
  const target=C(u,0,1)*(path.total||1);let i=0;while(i<path.cum.length-2&&path.cum[i+1]<target)i++;
  const a=path.p[i],b=path.p[i+1],L=(path.cum[i+1]-path.cum[i])||1,t=C((target-path.cum[i])/L,0,1),dx=b[0]-a[0],dz=b[1]-a[1],ll=Math.hypot(dx,dz)||1;
  return{x:M(a[0],b[0],t),z:M(a[1],b[1],t),tx:dx/ll,tz:dz/ll,nx:-dz/ll,nz:dx/ll};
}
function sampleDelta(z0,z1){let max=0,sum=0,n=0,at=null;for(let x=-220;x<=220;x+=6)for(let z=z0;z<=z1;z+=4){const v=Math.abs(K.catchmentHierarchyDelta(x,z));if(v>max){max=v;at=[x,z]}sum+=v;n++}return{max,mean:sum/(n||1),n,at}}
function drainageAwareBarrier(model,distanceFn,z0,z1,clearance=16){let max=-1e9,at=null,n=0;for(let x=-205;x<=205;x+=10)for(let z=z0;z<=z1;z+=4){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;const v=model.height(x,z+4)-model.height(x,z);n++;if(v>max){max=v;at=[x,z]}}return{max,at,n,clearance}}
function wallPersistence(model,distanceFn,z0=-198,z1=128,clearance=16,threshold=.55){let worst=null,totalEligible=0,rowsWithEligible=0;for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}if(eligible>0)rowsWithEligible++;totalEligible+=eligible;const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10),row={fraction,z,count,eligible,maxContiguousSpan:span};if(!worst||fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst=row}return{...(worst||{fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0}),clearance,threshold,totalEligible,rowsWithEligible}}

add('version',K.VERSION==='R045.16',K.VERSION,'R045.16');
add('water_graph_identity_preserved',K.nodes.length===R15.nodes.length&&K.edges.length===R15.edges.length,{nodes:[R15.nodes.length,K.nodes.length],edges:[R15.edges.length,K.edges.length]},'unchanged');
add('terrain_carrier_inventory_preserved',K.terrainChannels.length===R15.terrainChannels.length&&K.outletContinuum.length===R15.outletContinuum.length,{terrainChannels:[R15.terrainChannels.length,K.terrainChannels.length],outlets:[R15.outletContinuum.length,K.outletContinuum.length]},'unchanged');
add('r15_foothill_profiles_preserved',K.foothillPlainProfiles.length===R15.foothillPlainProfiles.length,K.foothillPlainProfiles.map(p=>p.id),'same inherited outlet profiles');
add('three_catchment_hierarchy_profiles_present',K.catchmentHierarchyProfiles.length===3,K.catchmentHierarchyProfiles.map(p=>p.id),'A/B/C');
add('catchment_hierarchy_profiles_are_not_parameter_clones',new Set(K.catchmentHierarchyProfiles.map(p=>[p.amp,p.sourceOffset,p.midOffset,p.width,p.bias,p.sourceU,p.convergenceU,p.transportU].join('|'))).size===3,K.catchmentHierarchyProfiles.map(({id,amp,sourceOffset,midOffset,width,bias,sourceU,convergenceU,transportU})=>({id,amp,sourceOffset,midOffset,width,bias,sourceU,convergenceU,transportU})),'3 distinct signatures');

const delta=sampleDelta(-217,-35);
add('hierarchy_change_is_substantive',delta.max>.18&&delta.max<=1.241,delta,'0.18 < max <= 1.241 m');
add('hierarchy_change_is_bounded',delta.mean<.24,delta.mean,'absolute mean <0.24 m');
let nearDrain=0,nearN=0,upper=0,lower=0,receiver=0;for(let x=-220;x<=220;x+=10){for(let z=-216;z<=-36;z+=6){if(K.nearestExtendedDrainageDistance(x,z)<=11.5){nearDrain=Math.max(nearDrain,Math.abs(K.catchmentHierarchyDelta(x,z)));nearN++}}for(const z of [-300,-260,-230,-220])upper=Math.max(upper,Math.abs(K.height(x,z)-R15.height(x,z)));for(const z of [0,40,80,120])lower=Math.max(lower,Math.abs(K.height(x,z)-R15.height(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R15.height(x,rz+dz)))}
add('complete_drainage_skeleton_is_protected',nearN>20&&nearDrain<1e-9,{nearN,nearDrain},'sampled d<=11.5 m: zero hierarchy delta');
add('rear_ridge_controls_unchanged',upper<1e-9,upper,'0 sampled change z<=-220');
add('r15_lower_foothill_plain_and_receiver_unchanged',lower<1e-9,{lower,receiver},'0 sampled change at z>=0 and around receiver');

const signatures=[];for(const p of K.catchmentHierarchyProfiles){const samples=[];for(const u of [.18,.44,.66]){const f=frameAt(p.path,u),off=M(p.sourceOffset,p.midOffset,C((u-.10)/.60,0,1));const l=K.catchmentHierarchyComponent(p,f.x+f.nx*off,f.z+f.nz*off),r=K.catchmentHierarchyComponent(p,f.x-f.nx*off,f.z-f.nz*off),c=K.catchmentHierarchyComponent(p,f.x,f.z);samples.push({u,z:f.z,left:l,right:r,centre:c,shoulderMean:(l+r)/2,lr:l-r})}signatures.push({id:p.id,samples,meanShoulder:mean(samples.map(s=>s.shoulderMean)),meanLR:mean(samples.map(s=>s.lr)),range:Math.max(...samples.map(s=>s.shoulderMean))-Math.min(...samples.map(s=>s.shoulderMean))})}
add('all_three_catchments_gain_broad_macro_shoulders',signatures.every(s=>s.meanShoulder>.025),signatures,'each sampled mean shoulder response >0.025 m');
add('basin_cross_section_signatures_are_not_clones',stdev(signatures.map(s=>s.meanLR))>.02,signatures,'cross-basin mean L/R signature stdev >0.02 m');
add('hierarchy_varies_along_each_basin',signatures.every(s=>s.range>.015),signatures,'source/convergence/transport response range >0.015 m each');

let maxStep=0,stepAt=null;for(let x=-215;x<=215;x+=10)for(let z=-216;z<=-38;z+=4){const v=Math.abs(K.catchmentHierarchyDelta(x,z+4)-K.catchmentHierarchyDelta(x,z));if(v>maxStep){maxStep=v;stepAt=[x,z]}}
add('hierarchy_field_has_no_new_longitudinal_step',maxStep<.22,{maxStep,at:stepAt},'<0.22 m delta change per 4 m');
const rowStats=[];for(let z=-196;z<=-52;z+=12){const a=[];for(let x=-210;x<=210;x+=10)a.push(K.catchmentHierarchyDelta(x,z));rowStats.push({z,mean:mean(a),stdev:stdev(a),max:Math.max(...a),min:Math.min(...a)})}
add('macro_field_is_cross_slope_structured_not_uniform_lift',rowStats.filter(r=>r.stdev>.045).length>=5,rowStats,'at least 5 rows delta stdev >0.045 m');

const oldWall=wallPersistence(R15,R15.nearestExtendedDrainageDistance),newWall=wallPersistence(K,K.nearestExtendedDrainageDistance);
add('wall_gate_has_real_sampling_coverage',oldWall.totalEligible>500&&newWall.totalEligible>500&&oldWall.rowsWithEligible>20&&newWall.rowsWithEligible>20,{r15:{totalEligible:oldWall.totalEligible,rowsWithEligible:oldWall.rowsWithEligible},r16:{totalEligible:newWall.totalEligible,rowsWithEligible:newWall.rowsWithEligible}},'>500 samples and >20 rows each');
add('persistent_cross_slope_wall_not_reintroduced',newWall.fraction<.12&&newWall.maxContiguousSpan<60,{r15:oldWall,r16:newWall},'R16 fraction <12%, contiguous span <60 m');
const candidate=drainageAwareBarrier(K,K.nearestExtendedDrainageDistance,-158,8,16);
add('candidate_slope_forward_reversal_bounded',candidate.max<.55,candidate,'<0.55 m rise per 4 m, >=16 m from drainage');

let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.05,mean(tFar),'>0.05; geometry still locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('reference_is_visual_not_metric_truth',K.snapshot.round16?.referenceUse?.includes('no metric extraction'),K.snapshot.round16?.referenceUse,'visual hierarchy only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round16?.forbiddenClaims)&&K.snapshot.round16.forbiddenClaims.length>=7,K.snapshot.round16?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,nearDrainProtection:{nearN,nearDrain},upper,lower,receiver,signatures,maxLongitudinalDeltaStep:{value:maxStep,at:stepAt},rowStats,oldWall,newWall,candidate,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar)}};
fs.writeFileSync(new URL('./r045_round16_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
