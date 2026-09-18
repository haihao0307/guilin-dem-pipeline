import fs from 'node:fs';
import * as K from './r045_round22_kernel.mjs';
import * as R21 from '../round-21/r045_round21_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.22',K.VERSION,'R045.22');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R21.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R21.edges),{nodes:[R21.nodes.length,K.nodes.length],edges:[R21.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R21.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R21.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

let max=0,sum=0,n=0,at=null,maxStep=0,maxStepAt=null,nearMax=0,upperMax=0,receiverMax=0,outsideMax=0;
let posMass=0,posWX=0,negMass=0,negWX=0;
const bands=[[-124,-72],[-68,-16],[-12,40],[44,84]].map(([lo,hi])=>({lo,hi,m:0,wx:0,n:0,sum:0}));
for(let x=-220;x<=220;x+=6)for(let z=-132;z<=92;z+=4){
  const raw=K.directionalFaceDelta(x,z),a=Math.abs(raw);if(a>max){max=a;at=[x,z]}sum+=a;n++;
  if(raw>0){posMass+=raw;posWX+=x*raw}else if(raw<0){negMass+=-raw;negWX+=x*(-raw)}
  for(const b of bands)if(z>=b.lo&&z<=b.hi){b.m+=a;b.wx+=x*a;b.n++;b.sum+=a}
  const q=Math.abs(K.directionalFaceDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}
}
for(let x=-220;x<=220;x+=10){
  for(const z of [-300,-240,-200,-160,-140,-134,98,110,140,180])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R21.height(x,z)));
  for(const z of [-240,-220,-200,-180,-160,-140,-134])upperMax=Math.max(upperMax,Math.abs(K.height(x,z)-R21.height(x,z)));
  for(let z=-128;z<=88;z+=8)if(R21.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R21.height(x,z)));
  const rz=K.riverZ(x);for(const dz of [-8,-4,0,4,8])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R21.height(x,rz+dz)));
}
const bandStats=bands.map(b=>({range:[b.lo,b.hi],centroidX:b.wx/(b.m||1),meanAbs:b.sum/(b.n||1),mass:b.m}));
const bandXs=bandStats.map(b=>b.centroidX),bandShift=Math.max(...bandXs)-Math.min(...bandXs);
const signed={positiveCentroidX:posWX/(posMass||1),negativeCentroidX:negWX/(negMass||1),separation:posWX/(posMass||1)-negWX/(negMass||1),positiveMass:posMass,negativeMass:negMass};
const delta={max,mean:sum/(n||1),n,at,maxStep,maxStepAt,bandStats,bandShift,signed};
add('directional_face_change_is_substantive',max>.30&&max<.95,delta,'0.30 m < max added delta < 0.95 m');
add('directional_change_is_broad',delta.mean>.05&&delta.mean<.38,delta.mean,'0.05 m < mean abs delta < 0.38 m');
add('occupancy_moves_across_slope_downhill',bandShift>22,{bandStats,bandShift},'absolute-delta x centroid range across z bands >22 m');
add('bay_and_shoulder_are_spatially_separated',signed.separation>120,signed,'positive and negative morphology centroids separated by >120 m in x');
add('added_field_is_longitudinally_gradual',maxStep<.20,{maxStep,at:maxStepAt},'<0.20 m change in added field per 4 m z');
add('r21_upper_headwater_work_untouched',upperMax<1e-9,upperMax,'zero sampled R22 change at z<=-134');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside lower-slope support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

function worstForward(M){let v=-Infinity,where=null;for(let x=-205;x<=205;x+=10)for(let z=-128;z<=88;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R21),newForward=worstForward(K);
add('directional_massing_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.20,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R21 + 0.20 m');

let tNear=[],tFar=[],permChanged=0;for(let x=-190;x<=190;x+=10)for(let z=-126;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p);permChanged=Math.max(permChanged,Math.abs(p-R21.terracePermission(x,z)))}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.03,mean(tFar),'>0.03 while geometry remains locked');
add('permission_recomputed_from_directional_ground',permChanged>1e-4,permChanged,'permission mask must respond to R22 ground');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round22?.logicCorrection?.includes('magnify')&&K.snapshot.round22?.logicCorrection?.includes('occupancy and direction'),K.snapshot.round22?.logicCorrection,'must reject amplitude-only response to parallel-ribbon artifact');
add('xiaoma_state_boundary_retained',K.snapshot.round22?.xiaomaBoundary?.includes('do not establish hydraulic connectivity')&&K.snapshot.round22?.xiaomaBoundary?.includes('water depth'),K.snapshot.round22?.xiaomaBoundary,'terrain appearance must not become hydraulic-state claim');
add('mrrolord_provenance_is_honest',K.snapshot.round22?.mrRolordUse?.includes('no fresh original-video viewing is claimed'),K.snapshot.round22?.mrRolordUse,'saved research may be reused but not misreported as fresh viewing');
add('references_are_not_metric_truth',K.snapshot.round22?.referenceUse?.includes('no bench width')&&K.snapshot.round22?.referenceUse?.includes('no') ,K.snapshot.round22?.referenceUse,'visual hierarchy only; no metric extraction');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round22?.forbiddenClaims)&&K.snapshot.round22.forbiddenClaims.length>=9,K.snapshot.round22?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,nearMax,upperMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permChanged}};
fs.writeFileSync(new URL('./r045_round22_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
