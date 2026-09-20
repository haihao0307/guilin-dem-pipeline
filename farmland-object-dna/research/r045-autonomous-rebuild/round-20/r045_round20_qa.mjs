import fs from 'node:fs';
import * as K from './r045_round20_kernel.mjs';
import * as R18 from '../round-18/r045_round18_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
function wallPersistence(model,z0=-210,z1=-186,threshold=.55){let worst=null,total=0;for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,maxRise=-Infinity,at=null,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){eligible++;total++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>maxRise){maxRise=rise;at=x}if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}const row={z,count,eligible,fraction:count/(eligible||1),maxRise,at,maxContiguousSpan:Math.max(0,(maxRun-1)*10)};if(!worst||row.fraction>worst.fraction||(row.fraction===worst.fraction&&row.maxRise>worst.maxRise))worst=row}return{...worst,total,threshold}}

add('version',K.VERSION==='R045.20',K.VERSION,'R045.20');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R18.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R18.edges),{nodes:[R18.nodes.length,K.nodes.length],edges:[R18.edges.length,K.edges.length]},'exact planimetric water graph identity');
add('terrain_carriers_planimetry_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R18.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R18.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');
add('r18_headwater_profile_definitions_preserved',JSON.stringify(K.headwaterFootprintProfiles)===JSON.stringify(R18.headwaterFootprintProfiles),K.headwaterFootprintProfiles.map(p=>({id:p.id,angleDeg:p.angleDeg,major:p.major,minor:p.minor,centerShift:p.centerShift})),'exact R18 source-footprint definitions');

let maxDelta=0,sumDelta=0,nDelta=0,at=null,outside=0,farLower=0,receiver=0,permissionDiff=0,positiveDelta=0,endDelta=0;const activeRows=new Map();
for(let x=-220;x<=220;x+=6)for(let z=-226;z<=-140;z+=2){const raw=K.upperWallContinuityRepairDelta(x,z),d=Math.abs(raw);if(d>maxDelta){maxDelta=d;at=[x,z]}if(raw>positiveDelta)positiveDelta=raw;sumDelta+=d;nDelta++;activeRows.set(z,Math.max(activeRows.get(z)||0,d));if(z===-140)endDelta=Math.max(endDelta,d)}
for(let x=-220;x<=220;x+=10){for(const z of [-300,-240,-228,-138,-120,-80,0,80,140])outside=Math.max(outside,Math.abs(K.height(x,z)-R18.height(x,z)));for(const z of [-138,-120,-80,0,80,140]){farLower=Math.max(farLower,Math.abs(K.height(x,z)-R18.height(x,z)));permissionDiff=Math.max(permissionDiff,Math.abs(K.terracePermission(x,z)-R18.terracePermission(x,z)))}const rz=K.riverZ(x);for(const dz of [-6,0,6])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R18.height(x,rz+dz)))}
const delta={max:maxDelta,mean:sumDelta/(nDelta||1),n:nDelta,at,positiveMax:positiveDelta,endDelta};
add('repair_is_substantive_for_multi_metre_debt',maxDelta>1&&maxDelta<9,delta,'1 m < max correction < 9 m numerical sanity only');
add('repair_only_lowers_false_uphill_barriers',positiveDelta<1e-9,positiveDelta,'correction must never raise terrain');
add('repair_remains_spatially_bounded',delta.mean<.45,delta.mean,'mean absolute correction <0.45 m over z=-226..-140 audit band');
add('repair_is_band_limited',outside<1e-9,outside,'zero sampled change outside z=-226..-140');
add('far_lower_agricultural_slope_unchanged',farLower<1e-9,farLower,'zero sampled height change at z>=-138');
add('terrace_permission_exactly_inherited',permissionDiff<1e-12,permissionDiff,'zero permission difference');
add('front_receiver_unchanged',receiver<1e-9,receiver,'zero sampled change around receiver river');
const activeZ=[...activeRows.entries()].filter(([,v])=>v>.02).map(([z])=>z);
add('repair_is_band_wide_not_single_row_patch',activeZ.length>=12,{activeRows:activeZ.length,zMin:Math.min(...activeZ),zMax:Math.max(...activeZ)},'>=12 z rows with >0.02 m repair');
add('downstream_profile_rejoins_inherited_terrain',endDelta<.05,endDelta,'max abs correction at z=-140 <0.05 m; otherwise band must extend instead of forcing a seam');

const oldWall=wallPersistence(R18),newWall=wallPersistence(K);
add('r18_inherited_wall_debt_is_real',oldWall.fraction>.15&&oldWall.maxRise>1,{oldWall},'R18 worst interior fraction >0.15 and max rise >1 m/4 m');
add('final_terrain_wall_fraction_is_removed',newWall.fraction===0,{oldWall,newWall},'R20 interior worst fraction = 0 at 0.55 m/4 m gate');
add('final_terrain_uphill_step_is_bounded',newWall.maxRise<=.500001,{old:oldWall.maxRise,new:newWall.maxRise,at:[newWall.at,newWall.z]},'R20 max interior 4 m uphill rise <=0.50 m');
add('contiguous_upper_wall_span_removed',newWall.maxContiguousSpan===0,{old:oldWall.maxContiguousSpan,new:newWall.maxContiguousSpan},'zero contiguous failing span');

let fullMax=-Infinity,fullAt=null;for(let x=-205;x<=205;x+=10)for(let z=-226;z<=-138;z+=4){const rise=K.height(x,z+4)-K.height(x,z);if(rise>fullMax){fullMax=rise;fullAt=[x,z]}}
add('full_repair_band_has_no_new_large_uphill_barrier',fullMax<1.25,{maxRise:fullMax,at:fullAt},'<1.25 m uphill rise per 4 m across repair and rejoin');

let peakRepair=[];for(const p of K.headwaterFootprintProfiles){let max=0,px=0,pz=0;for(let x=-210;x<=210;x+=8)for(let z=-216;z<=-160;z+=4){const v=R18.headwaterFootprintComponent(p,x,z);if(v>max){max=v;px=x;pz=z}}peakRepair.push({id:p.id,sourcePeak:max,at:[px,pz],r20Correction:Math.abs(K.upperWallContinuityRepairDelta(px,pz))})}
add('source_footprint_functions_remain_present',peakRepair.every(p=>p.sourcePeak>.05),peakRepair,'all inherited A/B/C source components remain non-zero as source-shape functions; final elevation may be continuity-corrected');

let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-130;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.04,mean(tFar),'>0.04; geometry remains locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
const logic=K.snapshot.round20?.logicCorrection||'';
add('failed_logic_is_explicitly_corrected',logic.includes('moved the barrier')||logic.includes('relocates the barrier'),logic,'must acknowledge that short blend moves/relocates rather than solves barrier');
add('references_are_not_metric_truth',K.snapshot.round20?.referenceUse?.includes('no dimensions are extracted'),K.snapshot.round20?.referenceUse,'visual/method hierarchy only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round20?.forbiddenClaims)&&K.snapshot.round20.forbiddenClaims.length>=7,K.snapshot.round20?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,activeZ,oldWall,newWall,fullBand:{maxRise:fullMax,at:fullAt},outside,farLower,receiver,permissionDiff,peakRepair,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar)}};
fs.writeFileSync(new URL('./r045_round20_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
