import fs from 'node:fs';
import * as K from './r045_round21_kernel.mjs';
import * as R20 from '../round-20/r045_round20_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.21',K.VERSION,'R045.21');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R20.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R20.edges),{nodes:[R20.nodes.length,K.nodes.length],edges:[R20.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R20.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R20.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

let max=0,sum=0,n=0,at=null,nearMax=0,upperMax=0,receiverMax=0,outsideMax=0,pos=0,neg=0,posN=0,negN=0,weightedX=0,weightedMass=0,maxStep=0,maxStepAt=null;
for(let x=-220;x<=220;x+=6)for(let z=-136;z<=92;z+=4){const raw=K.agriculturalFaceDelta(x,z),a=Math.abs(raw);if(a>max){max=a;at=[x,z]}sum+=a;n++;if(x>=0){pos+=a;posN++}else{neg+=a;negN++}weightedX+=x*a;weightedMass+=a;const q=Math.abs(K.agriculturalFaceDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}}
for(let x=-220;x<=220;x+=10){for(const z of [-300,-240,-228,-200,-180,-160,-140,-138,94,110,140,180])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R20.height(x,z)));for(const z of [-240,-220,-200,-180,-160,-140,-138])upperMax=Math.max(upperMax,Math.abs(K.height(x,z)-R20.height(x,z)));for(let z=-132;z<=88;z+=8)if(R20.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R20.height(x,z)));const rz=K.riverZ(x);for(const dz of [-8,-4,0,4,8])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R20.height(x,rz+dz)))}
const delta={max,mean:sum/(n||1),n,at,maxStep,maxStepAt,centroidX:weightedX/(weightedMass||1),leftMean:neg/(negN||1),rightMean:pos/(posN||1)};
add('agricultural_face_change_is_substantive',max>.45&&max<1.25,delta,'0.45 m < max delta < 1.25 m synthetic macro-massing sanity');
add('change_is_broad_not_single_patch',delta.mean>.08&&delta.mean<.55,delta.mean,'0.08 m < mean abs delta < 0.55 m across lower-slope audit band');
add('one_sided_mass_is_measurably_asymmetric',Math.abs(delta.centroidX)>12&&Math.abs(delta.leftMean-delta.rightMean)>.035,{centroidX:delta.centroidX,leftMean:delta.leftMean,rightMean:delta.rightMean},'|delta centroid x| >12 m and left/right mean difference >0.035 m');
add('added_field_is_longitudinally_gradual',maxStep<.22,{maxStep,at:maxStepAt},'<0.22 m change in delta per 4 m');
add('r20_upper_repair_and_headwaters_untouched',upperMax<1e-9,upperMax,'zero sampled change at z<=-138');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside lower-slope support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

function worstForward(M){let v=-Infinity,where=null;for(let x=-205;x<=205;x+=10)for(let z=-132;z<=88;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R20),newForward=worstForward(K);
add('lower_slope_does_not_gain_new_longitudinal_wall',newForward.maxRise<=oldForward.maxRise+.18,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R20 + 0.18 m');

let tNear=[],tFar=[],permChanged=0;for(let x=-190;x<=190;x+=10)for(let z=-126;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p);permChanged=Math.max(permChanged,Math.abs(p-R20.terracePermission(x,z)))}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.035,mean(tFar),'>0.035 while geometry remains locked');
add('permission_is_recomputed_from_new_ground',permChanged>1e-4,permChanged,'permission mask should respond to changed ground rather than remain stale');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round21?.logicCorrection?.includes('land-use pattern')&&K.snapshot.round21?.logicCorrection?.includes('macro ground'),K.snapshot.round21?.logicCorrection,'must distinguish terrace pattern from causal landform');
add('xiaoma_state_boundary_retained',K.snapshot.round21?.xiaomaBoundary?.includes('water state remain separate')&&K.snapshot.round21?.xiaomaBoundary?.includes('does not establish hydraulic connectivity'),K.snapshot.round21?.xiaomaBoundary,'visual/geometry continuity must not become hydraulic-state claim');
add('mrrolord_provenance_is_honest',K.snapshot.round21?.mrRolordUse?.includes('does not claim a fresh viewing'),K.snapshot.round21?.mrRolordUse,'saved research may be reused but not misreported as fresh video viewing');
add('references_are_not_metric_truth',K.snapshot.round21?.referenceUse?.includes('no dimensions are extracted'),K.snapshot.round21?.referenceUse,'visual hierarchy only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round21?.forbiddenClaims)&&K.snapshot.round21.forbiddenClaims.length>=8,K.snapshot.round21?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,nearMax,upperMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permChanged}};
fs.writeFileSync(new URL('./r045_round21_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
