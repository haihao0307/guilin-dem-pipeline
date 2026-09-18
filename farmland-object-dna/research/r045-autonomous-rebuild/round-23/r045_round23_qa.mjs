import fs from 'node:fs';
import * as K from './r045_round23_kernel.mjs';
import * as R22 from '../round-22/r045_round22_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.23',K.VERSION,'R045.23');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R22.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R22.edges),{nodes:[R22.nodes.length,K.nodes.length],edges:[R22.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R22.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R22.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

const contacts=[];for(let x=-220;x<=220;x+=10)contacts.push({x,z:K.foothillContactZ(x)});
const contactZs=contacts.map(v=>v.z),contactRange=Math.max(...contactZs)-Math.min(...contactZs);
add('foothill_contact_is_not_horizontal',contactRange>28&&contactRange<70,{min:Math.min(...contactZs),max:Math.max(...contactZs),range:contactRange},'28 m < synthetic contact-z range < 70 m across x');

let max=0,sum=0,n=0,at=null,maxStep=0,maxStepAt=null,nearMax=0,upperMax=0,receiverMax=0,outsideMax=0;
let posMass=0,posWZ=0,negMass=0,negWZ=0,lowerSum=0,lowerN=0;
for(let x=-220;x<=220;x+=6)for(let z=8;z<=138;z+=4){
  const raw=K.foothillContactDelta(x,z),a=Math.abs(raw);if(a>max){max=a;at=[x,z]}sum+=a;n++;
  if(z>=38&&z<=118){lowerSum+=a;lowerN++}
  if(raw>0){posMass+=raw;posWZ+=z*raw}else if(raw<0){negMass+=-raw;negWZ+=z*(-raw)}
  const q=Math.abs(K.foothillContactDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}
}
for(let x=-220;x<=220;x+=10){
  for(const z of [-300,-220,-160,-140,-132,-20,0,4,142,150,180,205])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R22.height(x,z)));
  for(const z of [-240,-200,-160,-132,-80,-20,0,4])upperMax=Math.max(upperMax,Math.abs(K.height(x,z)-R22.height(x,z)));
  for(let z=12;z<=132;z+=8)if(R22.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R22.height(x,z)));
  const rz=K.riverZ(x);for(const dz of [-8,-4,0,4,8])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R22.height(x,rz+dz)));
}
const signed={positiveCentroidZ:posWZ/(posMass||1),negativeCentroidZ:negWZ/(negMass||1),separation:(negWZ/(negMass||1))-(posWZ/(posMass||1)),positiveMass:posMass,negativeMass:negMass};
const delta={max,mean:sum/(n||1),lowerMean:lowerSum/(lowerN||1),n,at,maxStep,maxStepAt,signed,contactRange};
add('foothill_change_is_substantive',max>.35&&max<1.20,delta,'0.35 m < max added delta < 1.20 m');
add('foothill_change_is_broad',delta.lowerMean>.045&&delta.lowerMean<.50,delta.lowerMean,'0.045 m < mean abs delta in z 38..118 < 0.50 m');
add('toe_and_apron_are_downslope_separated',signed.separation>18,signed,'negative receiving-apron centroid is >18 m downslope of positive toe centroid');
add('added_field_is_longitudinally_gradual',maxStep<.24,{maxStep,at:maxStepAt},'<0.24 m change in added field per 4 m z');
add('upper_r22_work_untouched',upperMax<1e-9,upperMax,'zero sampled R23 change at z<=4');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside foothill support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

function worstForward(M){let v=-Infinity,where=null;for(let x=-205;x<=205;x+=10)for(let z=8;z<=136;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R22),newForward=worstForward(K);
add('foothill_massing_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.22,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R22 + 0.22 m');

let tNear=[],tFar=[],permChanged=0;for(let x=-190;x<=190;x+=10)for(let z=-126;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p);permChanged=Math.max(permChanged,Math.abs(p-R22.terracePermission(x,z)))}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.03,mean(tFar),'>0.03 while geometry remains locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('terrace_pilot_locked',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round23?.logicCorrection?.includes('Terrace')||K.snapshot.round23?.logicCorrection?.includes('terrace'),K.snapshot.round23?.logicCorrection,'must reject terrace-pattern masking of unresolved foothill substrate');
add('xiaoma_state_boundary_retained',K.snapshot.round23?.xiaomaBoundary?.includes('does not establish hydraulic connectivity')&&K.snapshot.round23?.xiaomaBoundary?.includes('rendered-ground'),K.snapshot.round23?.xiaomaBoundary,'topology/rendered-ground evidence before water-state claims');
add('mrrolord_provenance_is_honest',K.snapshot.round23?.mrRolordUse?.includes('not located')&&K.snapshot.round23?.mrRolordUse?.includes('no fresh viewing is claimed'),K.snapshot.round23?.mrRolordUse,'saved ordering may be reused but not misreported as fresh viewing');
add('reference_is_not_metric_truth',K.snapshot.round23?.referenceUse?.includes('image(173).png')&&K.snapshot.round23?.referenceUse?.includes('no terrace width'),K.snapshot.round23?.referenceUse,'visual hierarchy only; no metric extraction');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round23?.forbiddenClaims)&&K.snapshot.round23.forbiddenClaims.length>=9,K.snapshot.round23?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,contact:{samples:contacts,min:Math.min(...contactZs),max:Math.max(...contactZs),range:contactRange},nearMax,upperMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permChanged}};
fs.writeFileSync(new URL('./r045_round23_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
