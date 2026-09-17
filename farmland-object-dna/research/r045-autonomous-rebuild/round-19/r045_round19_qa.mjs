import fs from 'node:fs';
import * as K from './r045_round19_kernel.mjs';
import * as R18 from '../round-18/r045_round18_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
function wallPersistence(model,distanceFn,z0=-218,z1=-160,clearance=16,threshold=.55){let worst=null,totalEligible=0,rowsWithEligible=0;for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}if(eligible>0)rowsWithEligible++;totalEligible+=eligible;const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10),row={fraction,z,count,eligible,maxContiguousSpan:span};if(!worst||fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst=row}return{...(worst||{fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0}),clearance,threshold,totalEligible,rowsWithEligible}}
function rowWall(model,distanceFn,z,clearance=16,threshold=.55){let count=0,eligible=0,maxRise=-Infinity,at=null;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>maxRise){maxRise=rise;at=x}if(rise>threshold)count++}return{z,count,eligible,fraction:count/(eligible||1),maxRise,at}}

add('version',K.VERSION==='R045.19',K.VERSION,'R045.19');
add('water_graph_identity_preserved',K.nodes.length===R18.nodes.length&&K.edges.length===R18.edges.length,{nodes:[R18.nodes.length,K.nodes.length],edges:[R18.edges.length,K.edges.length]},'unchanged');
add('terrain_carrier_inventory_preserved',K.terrainChannels.length===R18.terrainChannels.length&&K.outletContinuum.length===R18.outletContinuum.length,{terrainChannels:[R18.terrainChannels.length,K.terrainChannels.length],outlets:[R18.outletContinuum.length,K.outletContinuum.length]},'unchanged');
add('r18_headwater_profiles_preserved',JSON.stringify(K.headwaterFootprintProfiles)===JSON.stringify(R18.headwaterFootprintProfiles),K.headwaterFootprintProfiles.map(p=>({id:p.id,angleDeg:p.angleDeg,major:p.major,minor:p.minor,centerShift:p.centerShift})),'exact R18 profile definitions');

let maxDelta=0,sumDelta=0,nDelta=0,at=null,nearDrain=0,nearN=0,outside=0,permissionDiff=0,receiver=0;
const activeRows=new Map();
for(let x=-220;x<=220;x+=6)for(let z=-218;z<=-182;z+=2){const d=Math.abs(K.upperWallContinuityRepairDelta(x,z));if(d>maxDelta){maxDelta=d;at=[x,z]}sumDelta+=d;nDelta++;const key=Math.round(z);activeRows.set(key,Math.max(activeRows.get(key)||0,d));if(K.nearestExtendedDrainageDistance(x,z)<=11.5){nearDrain=Math.max(nearDrain,d);nearN++}}
for(let x=-220;x<=220;x+=10){for(const z of [-300,-240,-220,-180,-170,-158,-140,-80,0,80,140])outside=Math.max(outside,Math.abs(K.height(x,z)-R18.height(x,z)));for(const z of [-158,-140,-80,0,80,140])permissionDiff=Math.max(permissionDiff,Math.abs(K.terracePermission(x,z)-R18.terracePermission(x,z)));const rz=K.riverZ(x);for(const dz of [-6,0,6])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R18.height(x,rz+dz)))}
const delta={max:maxDelta,mean:sumDelta/(nDelta||1),n:nDelta,at};
add('continuity_repair_is_substantive',maxDelta>.08&&maxDelta<=.781,delta,'0.08 < max <= 0.781 m');
add('continuity_repair_is_bounded',delta.mean<.14,delta.mean,'mean absolute repair <0.14 m');
add('complete_drainage_skeleton_is_protected',nearN>50&&nearDrain<1e-9,{nearN,nearDrain},'sampled d<=11.5 m: zero R19 delta');
add('repair_is_band_limited',outside<1e-9,outside,'0 sampled change outside upper repair band');
add('terrace_permission_is_exactly_inherited',permissionDiff<1e-12,permissionDiff,'0 sampled permission difference');
add('front_receiver_unchanged',receiver<1e-9,receiver,'0 sampled change around front receiver');
const activeZ=[...activeRows.entries()].filter(([,v])=>v>.015).map(([z])=>z);
add('repair_is_not_single_row_qa_patch',activeZ.length>=8,{activeRows:activeZ.length,zMin:Math.min(...activeZ),zMax:Math.max(...activeZ)},'>=8 sampled z rows with >0.015 m repair');

let maxRepairStep=0,stepAt=null;for(let x=-215;x<=215;x+=10)for(let z=-216;z<=-186;z+=4){const v=Math.abs(K.upperWallContinuityRepairDelta(x,z+4)-K.upperWallContinuityRepairDelta(x,z));if(v>maxRepairStep){maxRepairStep=v;stepAt=[x,z]}}
add('repair_field_has_no_new_longitudinal_step',maxRepairStep<.26,{maxRepairStep,at:stepAt},'<0.26 m repair-delta change per 4 m');

const oldWall=wallPersistence(R18,R18.nearestExtendedDrainageDistance),newWall=wallPersistence(K,K.nearestExtendedDrainageDistance);
const old202=rowWall(R18,R18.nearestExtendedDrainageDistance,-202),new202=rowWall(K,K.nearestExtendedDrainageDistance,-202);
add('upper_wall_gate_has_real_sampling_coverage',oldWall.totalEligible>200&&newWall.totalEligible>200,{r18:{totalEligible:oldWall.totalEligible,rows:oldWall.rowsWithEligible},r19:{totalEligible:newWall.totalEligible,rows:newWall.rowsWithEligible}},'>200 eligible samples each');
add('r18_debt_is_present_before_repair',oldWall.fraction>.18,{oldWall,old202},'R18 worst fraction >0.18');
add('upper_wall_debt_is_materially_reduced',newWall.fraction<.12&&newWall.fraction<=oldWall.fraction-.07,{r18:oldWall,r19:newWall},'R19 worst fraction <0.12 and improves by >=0.07');
add('upper_wall_contiguous_span_not_worsened',newWall.maxContiguousSpan<=oldWall.maxContiguousSpan,{r18:oldWall.maxContiguousSpan,r19:newWall.maxContiguousSpan},'R19 <= R18 span');
add('z202_wall_is_reduced',new202.fraction<old202.fraction&&new202.maxRise<old202.maxRise,{r18:old202,r19:new202},'both fraction and maximum rise lower at z=-202');

let peakRepair=[];for(const p of K.headwaterFootprintProfiles){let max=0,px=0,pz=0;for(let x=-210;x<=210;x+=8)for(let z=-216;z<=-160;z+=4){const v=R18.headwaterFootprintComponent(p,x,z);if(v>max){max=v;px=x;pz=z}}peakRepair.push({id:p.id,sourcePeak:max,at:[px,pz],r19Repair:Math.abs(K.upperWallContinuityRepairDelta(px,pz))})}
add('r18_source_footprints_not_erased_at_component_peaks',peakRepair.every(p=>p.r19Repair<.42),peakRepair,'R19 repair <0.42 m at each inherited source-component peak');

let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.04,mean(tFar),'>0.04; geometry still locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('qa_overfit_shortcut_rejected',K.snapshot.round19?.logicCorrection?.includes('overfit'),K.snapshot.round19?.logicCorrection,'band-wide repair, not z=-202 row patch');
add('reference_is_visual_not_metric_truth',K.snapshot.round19?.referenceUse?.includes('no metric extraction'),K.snapshot.round19?.referenceUse,'visual hierarchy only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round19?.forbiddenClaims)&&K.snapshot.round19.forbiddenClaims.length>=7,K.snapshot.round19?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,nearDrainProtection:{nearN,nearDrain},outside,permissionDiff,receiver,activeZ,maxRepairDeltaStep:{value:maxRepairStep,at:stepAt},oldWall,newWall,old202,new202,peakRepair,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar)}};
fs.writeFileSync(new URL('./r045_round19_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
