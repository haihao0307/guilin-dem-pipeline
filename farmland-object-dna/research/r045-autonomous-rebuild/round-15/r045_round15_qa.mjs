import fs from 'node:fs';
import * as K from './r045_round15_kernel.mjs';
import * as R14 from '../round-14/r045_round14_kernel.mjs';
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
function sampleDelta(z0,z1){let max=0,sum=0,n=0,at=null;for(let x=-220;x<=220;x+=6)for(let z=z0;z<=z1;z+=4){const v=Math.abs(K.foothillPlainDelta(x,z));if(v>max){max=v;at=[x,z]}sum+=v;n++}return{max,mean:sum/(n||1),n,at}}
function drainageAwareBarrier(model,distanceFn,z0,z1,clearance=16){let max=-1e9,at=null,n=0;for(let x=-205;x<=205;x+=10)for(let z=z0;z<=z1;z+=4){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;const v=model.height(x,z+4)-model.height(x,z);n++;if(v>max){max=v;at=[x,z]}}return{max,at,n,clearance}}
function wallPersistence(model,distanceFn,z0=-198,z1=128,clearance=16,threshold=.55){
  // Keep an explicit sampled-row sentinel. The previous implementation initialized fraction=0 and
  // therefore reported eligible=0 whenever every sampled row had zero failures; that was a reporting
  // fallacy, not evidence of zero coverage. This version proves the wall gate actually sampled terrain.
  let worst=null,totalEligible=0,rowsWithEligible=0;
  for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}if(eligible>0)rowsWithEligible++;totalEligible+=eligible;const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10),row={fraction,z,count,eligible,maxContiguousSpan:span};if(!worst||fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst=row}
  return{...(worst||{fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0}),clearance,threshold,totalEligible,rowsWithEligible};
}

add('version',K.VERSION==='R045.15',K.VERSION,'R045.15');
add('water_graph_identity_preserved',K.nodes.length===R14.nodes.length&&K.edges.length===R14.edges.length,{nodes:[R14.nodes.length,K.nodes.length],edges:[R14.edges.length,K.edges.length]},'unchanged');
add('terrain_carrier_inventory_preserved',K.terrainChannels.length===R14.terrainChannels.length&&K.outletContinuum.length===R14.outletContinuum.length,{terrainChannels:[R14.terrainChannels.length,K.terrainChannels.length],outlets:[R14.outletContinuum.length,K.outletContinuum.length]},'unchanged');
add('three_foothill_plain_profiles_present',K.foothillPlainProfiles.length===3,K.foothillPlainProfiles.map(p=>p.id),'3 inherited trunk outlets');
add('outlet_aprons_expand_downslope',K.foothillPlainProfiles.every(p=>p.width1>p.width0*1.9),K.foothillPlainProfiles.map(p=>({id:p.id,width0:p.width0,width1:p.width1,ratio:p.width1/p.width0})),'width1 > 1.9 * width0');
add('outlet_incision_decays_downslope',K.foothillPlainProfiles.every(p=>p.depth1<p.depth0*.40),K.foothillPlainProfiles.map(p=>({id:p.id,depth0:p.depth0,depth1:p.depth1,ratio:p.depth1/p.depth0})),'depth1 < 0.40 * depth0');

const delta=sampleDelta(-75,131);
add('foothill_plain_change_is_substantive',delta.max>.055&&delta.max<=.301,delta,'0.055 < max <= 0.301 m');
add('foothill_plain_change_is_bounded',delta.mean<.075,delta.mean,'absolute mean <0.075 m');
let upper=0,receiver=0;for(let x=-220;x<=220;x+=20){for(const z of [-300,-240,-208,-160,-100,-80])upper=Math.max(upper,Math.abs(K.height(x,z)-R14.height(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R14.height(x,rz+dz)))}
add('upper_slope_and_basin_shoulders_unchanged',upper<1e-9,upper,'0 sampled change at z<=-80');
add('front_receiver_controls_unchanged',receiver<1e-9,receiver,'0 sampled change around receiver');

const sections=[];for(const p of K.foothillPlainProfiles){for(const u of [.30,.58,.82]){const f=frameAt(p.path,u),w=M(p.width0,p.width1,u),c=K.foothillPlainComponent(p,f.x,f.z),l=K.foothillPlainComponent(p,f.x+f.nx*w,f.z+f.nz*w),r=K.foothillPlainComponent(p,f.x-f.nx*w,f.z-f.nz*w);sections.push({id:p.id,u,z:f.z,center:c,left:l,right:r,shoulderMean:(l+r)/2,contrast:(l+r)/2-c})}}
add('outlet_centres_read_below_toe_shoulders',sections.filter(s=>s.contrast>.008).length>=7,sections,'at least 7/9 sampled sections shoulderMean-center >0.008 m');
const perOutlet=K.foothillPlainProfiles.map(p=>{const ss=sections.filter(s=>s.id===p.id);return{id:p.id,meanContrast:mean(ss.map(s=>s.contrast)),lrBias:mean(ss.map(s=>s.left-s.right))}});
add('all_three_outlets_have_readable_toe_relief',perOutlet.every(o=>o.meanContrast>.008),perOutlet,'each mean contrast >0.008 m');
add('toe_aprons_are_not_clone_signatures',stdev(perOutlet.map(o=>o.lrBias))>.005,perOutlet,'left/right bias signature stdev >0.005 m');

let maxStep=0,stepAt=null;for(let x=-215;x<=215;x+=10)for(let z=-76;z<=128;z+=4){const v=Math.abs(K.foothillPlainDelta(x,z+4)-K.foothillPlainDelta(x,z));if(v>maxStep){maxStep=v;stepAt=[x,z]}}
add('foothill_field_has_no_new_longitudinal_step',maxStep<.085,{maxStep,at:stepAt},'<0.085 m delta change per 4 m');
const rowMeans=[];for(let z=-60;z<=112;z+=12){const a=[];for(let x=-210;x<=210;x+=10)a.push(K.foothillPlainDelta(x,z));rowMeans.push({z,mean:mean(a),stdev:stdev(a),max:Math.max(...a),min:Math.min(...a)})}
add('transition_is_not_a_uniform_horizontal_shelf',rowMeans.filter(r=>r.stdev>.012).length>=6,rowMeans,'at least 6 rows cross-slope stdev >0.012 m');

const oldWall=wallPersistence(R14,R14.nearestExtendedDrainageDistance),newWall=wallPersistence(K,K.nearestExtendedDrainageDistance);
add('wall_gate_has_real_sampling_coverage',oldWall.totalEligible>500&&newWall.totalEligible>500&&oldWall.rowsWithEligible>20&&newWall.rowsWithEligible>20,{r14:{totalEligible:oldWall.totalEligible,rowsWithEligible:oldWall.rowsWithEligible},r15:{totalEligible:newWall.totalEligible,rowsWithEligible:newWall.rowsWithEligible}},'>500 eligible samples and >20 sampled rows in each version');
add('r14_wall_state_not_regressed',newWall.fraction<.12&&newWall.maxContiguousSpan<60,{r14:oldWall,r15:newWall},'R15 fraction <12% and contiguous span <60 m');
const candidate=drainageAwareBarrier(K,K.nearestExtendedDrainageDistance,-158,8,16);
add('candidate_slope_forward_reversal_bounded',candidate.max<.55,candidate,'<0.55 m rise per 4 m, >=16 m from drainage');

let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.055,mean(tFar),'>0.055; geometry still locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('reference_is_visual_not_metric_truth',K.snapshot.round15?.referenceUse?.includes('visual hierarchy'),K.snapshot.round15?.referenceUse,'visual hierarchy only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round15?.forbiddenClaims)&&K.snapshot.round15.forbiddenClaims.length>=6,K.snapshot.round15?.forbiddenClaims,'explicit synthetic/evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,sections,perOutlet,maxLongitudinalDeltaStep:{value:maxStep,at:stepAt},rowMeans,oldWall,newWall,candidate,upper,receiver,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar)}};
fs.writeFileSync(new URL('./r045_round15_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
