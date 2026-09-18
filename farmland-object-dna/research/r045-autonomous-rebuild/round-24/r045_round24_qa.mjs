import fs from 'node:fs';
import * as K from './r045_round24_kernel.mjs';
import * as R23 from '../round-23/r045_round23_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.24',K.VERSION,'R045.24');
add('three_inherited_outlet_profiles',K.receivingPlainProfiles.length===3,K.receivingPlainProfiles.map(p=>p.id),'exactly three profiles from inherited outletContinuum');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R23.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R23.edges),{nodes:[R23.nodes.length,K.nodes.length],edges:[R23.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R23.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R23.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

const signatures=K.receivingPlainProfiles.map(p=>({id:p.id,widthRatio:p.width1/p.width0,offset0:p.offset0,swing:p.swing,depth:p.depth,shoulder:p.shoulder,nested:p.nested}));
const ratios=signatures.map(s=>s.widthRatio),swings=signatures.map(s=>s.swing),depths=signatures.map(s=>s.depth);
add('receiving_profiles_are_not_clones',new Set(signatures.map(s=>JSON.stringify(s))).size===3,signatures,'all three parameter signatures unique');
add('width_expansion_is_unequal',Math.max(...ratios)-Math.min(...ratios)>.70,ratios,'profile width ratios differ by >0.70');
add('lateral_bending_is_directionally_distinct',Math.max(...swings)-Math.min(...swings)>55,swings,'signed swing range >55 m');
add('receiving_depths_are_unequal',Math.max(...depths)-Math.min(...depths)>.08,depths,'depth range >0.08 m');

let max=0,sum=0,n=0,at=null,maxStep=0,maxStepAt=null,nearMax=0,upperMax=0,receiverMax=0,outsideMax=0;
let lowerSum=0,lowerN=0,pos=0,neg=0;
for(let x=-220;x<=220;x+=6)for(let z=28;z<=132;z+=4){
  const raw=K.receivingPlainDelta(x,z),a=Math.abs(raw);if(a>max){max=a;at=[x,z]}sum+=a;n++;
  if(z>=50&&z<=108){lowerSum+=a;lowerN++}
  if(raw>0)pos+=raw;else neg+=-raw;
  const q=Math.abs(K.receivingPlainDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}
}
for(let x=-220;x<=220;x+=10){
  for(const z of [-300,-220,-160,-132,-80,-20,0,20,24,26,136,142,170,205])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R23.height(x,z)));
  for(const z of [-240,-180,-132,-80,-20,0,12,20,24,26])upperMax=Math.max(upperMax,Math.abs(K.height(x,z)-R23.height(x,z)));
  for(let z=32;z<=128;z+=8)if(R23.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R23.height(x,z)));
  const rz=K.riverZ(x);for(const dz of [-8,-4,0,4,8])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R23.height(x,rz+dz)));
}
const delta={max,mean:sum/(n||1),coreMean:lowerSum/(lowerN||1),n,at,maxStep,maxStepAt,positiveMass:pos,negativeMass:neg};
add('receiving_plain_change_is_substantive',max>.18&&max<.80,delta,'0.18 m < max added delta < 0.80 m');
add('receiving_plain_change_is_broad',delta.coreMean>.025&&delta.coreMean<.24,delta.coreMean,'0.025 m < mean abs delta in z 50..108 < 0.24 m');
add('receiving_plain_is_hollow_dominant',neg>pos*1.25,{positiveMass:pos,negativeMass:neg,ratio:neg/(pos||1)},'negative receiving mass >1.25x positive shoulder mass');
add('added_field_is_longitudinally_gradual',maxStep<.22,{maxStep,at:maxStepAt},'<0.22 m change in added field per 4 m z');
add('r23_upper_work_untouched',upperMax<1e-9,upperMax,'zero sampled R24 change at z<=26');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside receiving-plain support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

// Sample each carrier-tied component independently so a parameter-only difference cannot satisfy
// the planform-diversity gate while producing the same occupied mass.
const componentStats=K.receivingPlainProfiles.map(p=>{
  let m=0,wx=0,wz=0,peak=0,peakAt=null,count=0;
  for(let x=-220;x<=220;x+=8)for(let z=32;z<=128;z+=6){
    const a=Math.abs(K.receivingPlainComponent(p,x,z));if(a>peak){peak=a;peakAt=[x,z]}m+=a;wx+=x*a;wz+=z*a;if(a>.01)count++;
  }
  return{id:p.id,mass:m,centroid:[wx/(m||1),wz/(m||1)],peak,peakAt,count};
});
let minCentroidSep=1e9;for(let i=0;i<componentStats.length;i++)for(let j=i+1;j<componentStats.length;j++)minCentroidSep=Math.min(minCentroidSep,Math.hypot(componentStats[i].centroid[0]-componentStats[j].centroid[0],componentStats[i].centroid[1]-componentStats[j].centroid[1]));
add('carrier_tied_planforms_are_spatially_distinct',minCentroidSep>12,{minCentroidSep,componentStats},'pairwise component centroid separation >12 m');
add('all_three_components_are_visible_in_numeric_field',componentStats.every(s=>s.peak>.04&&s.count>18),componentStats,'each component peak >0.04 m and >18 sampled occupied cells');

function worstForward(M){let v=-Infinity,where=null;for(let x=-205;x<=205;x+=10)for(let z=28;z<=128;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R23),newForward=worstForward(K);
add('receiving_planform_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.18,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R23 + 0.18 m');

let tNear=[],tFar=[],permChanged=0;for(let x=-190;x<=190;x+=10)for(let z=-126;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p);permChanged=Math.max(permChanged,Math.abs(p-R23.terracePermission(x,z)))}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.03,mean(tFar),'>0.03 while geometry remains locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('terrace_pilot_locked',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round24?.logicCorrection?.includes('arbitrary extra lobes')&&K.snapshot.round24?.logicCorrection?.includes('inherited outlet carrier'),K.snapshot.round24?.logicCorrection,'must reject arbitrary decoration and bind new morphology to inherited carriers');
add('xiaoma_state_boundary_retained',K.snapshot.round24?.xiaomaBoundary?.includes('geometry evidence only')&&K.snapshot.round24?.xiaomaBoundary?.includes('do not establish hydraulic connectivity'),K.snapshot.round24?.xiaomaBoundary,'geometry evidence must not be promoted to hydraulic-state evidence');
add('mrrolord_frame_audit_reused',K.snapshot.round24?.mrRolordUse?.includes('frame audit was reread')&&K.snapshot.round24?.mrRolordUse?.includes('river hierarchy'),K.snapshot.round24?.mrRolordUse,'saved frame audit reread; hydrology-first ordering retained');
add('reference_is_not_metric_truth',K.snapshot.round24?.referenceUse?.includes('image(173).png')&&K.snapshot.round24?.referenceUse?.includes('no terrace width'),K.snapshot.round24?.referenceUse,'visual hierarchy only; no metric extraction');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round24?.forbiddenClaims)&&K.snapshot.round24.forbiddenClaims.length>=10,K.snapshot.round24?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,signatures,componentStats,minCentroidSep,nearMax,upperMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permChanged}};
fs.writeFileSync(new URL('./r045_round24_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
