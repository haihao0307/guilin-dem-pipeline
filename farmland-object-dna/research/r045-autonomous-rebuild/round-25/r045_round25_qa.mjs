import fs from 'node:fs';
import * as K from './r045_round25_kernel.mjs';
import * as R24 from '../round-24/r045_round24_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.25',K.VERSION,'R045.25');
add('three_inherited_apron_profiles',K.apronProfiles.length===3,K.apronProfiles.map(p=>p.id),'exactly three profiles inherited from R24 receiving/outlet carriers');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R24.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R24.edges),{nodes:[R24.nodes.length,K.nodes.length],edges:[R24.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R24.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R24.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

const signatures=K.apronProfiles.map(p=>({id:p.id,width0:p.width0,width1:p.width1,offset:p.offset,sweep:p.sweep,depth:p.depth,shoulder:p.shoulder,nested:p.nested,edgeSign:p.edgeSign}));
add('apron_profiles_are_not_clones',new Set(signatures.map(s=>JSON.stringify(s))).size===3,signatures,'all three signatures unique');
add('aprons_are_broader_than_r24_bays',K.apronProfiles.every((p,i)=>p.width1>R24.receivingPlainProfiles[i].width1+25),K.apronProfiles.map((p,i)=>({id:p.id,r24:R24.receivingPlainProfiles[i].width1,r25:p.width1})),'every downstream apron width exceeds R24 bay width by >25 m');
add('lateral_sweeps_are_directionally_distinct',Math.max(...K.apronProfiles.map(p=>p.sweep))-Math.min(...K.apronProfiles.map(p=>p.sweep))>80,K.apronProfiles.map(p=>p.sweep),'signed sweep range >80 m');

let max=0,sum=0,n=0,at=null,maxStep=0,maxStepAt=null,coreSum=0,coreN=0,pos=0,neg=0;
for(let x=-230;x<=230;x+=6)for(let z=14;z<=130;z+=4){
  const raw=K.apronDelta(x,z),a=Math.abs(raw);if(a>max){max=a;at=[x,z]}sum+=a;n++;if(z>=38&&z<=108){coreSum+=a;coreN++}
  if(raw>0)pos+=raw;else neg+=-raw;
  const q=Math.abs(K.apronDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}
}
const delta={max,mean:sum/(n||1),coreMean:coreSum/(coreN||1),n,at,maxStep,maxStepAt,positiveMass:pos,negativeMass:neg,positiveToNegative:pos/(neg||1)};
add('apron_change_is_substantive',max>.10&&max<.62,delta,'0.10 m < max added delta < 0.62 m');
add('apron_change_is_broad_but_shallow',delta.coreMean>.015&&delta.coreMean<.16,delta.coreMean,'0.015 m < mean abs delta in z 38..108 < 0.16 m');
add('signed_shoulders_survive',pos>neg*.005&&pos<neg*.85,{positiveMass:pos,negativeMass:neg,ratio:pos/(neg||1)},'positive mass is 0.5%..85% of negative receiving mass');
add('added_field_is_longitudinally_gradual',maxStep<.18,{maxStep,at:maxStepAt},'<0.18 m change in added field per 4 m z');

// Actual occupied planform, not parameter declarations.
const rowWidths=[],rowCentroids=[];
for(let z=36;z<=106;z+=6){
  const xs=[];let mass=0,wx=0;
  for(let x=-230;x<=230;x+=4){const a=Math.abs(K.apronDelta(x,z));if(a>.018)xs.push(x);mass+=a;wx+=x*a}
  if(xs.length){rowWidths.push({z,width:Math.max(...xs)-Math.min(...xs),count:xs.length});rowCentroids.push({z,x:wx/(mass||1)})}
}
const meanWidth=mean(rowWidths.map(r=>r.width));
const widthRange=rowWidths.length?Math.max(...rowWidths.map(r=>r.width))-Math.min(...rowWidths.map(r=>r.width)):0;
const centroidRange=rowCentroids.length?Math.max(...rowCentroids.map(r=>r.x))-Math.min(...rowCentroids.map(r=>r.x)):0;
add('whole_scene_planform_is_broadly_occupied',rowWidths.length>=8&&meanWidth>120,{rows:rowWidths.length,meanWidth},'>=8 occupied rows and mean lateral occupied width >120 m');
add('whole_scene_planform_is_not_constant_width',widthRange>18,{widthRange,rowWidths},'occupied width varies by >18 m across downslope rows');
add('whole_scene_planform_sweeps_laterally',centroidRange>6,{centroidRange,rowCentroids},'abs-delta planform centroid shifts by >6 m across rows');

const componentStats=K.apronProfiles.map(p=>{
  let m=0,wx=0,wz=0,peak=0,peakAt=null,count=0;
  for(let x=-230;x<=230;x+=8)for(let z=20;z<=124;z+=6){const a=Math.abs(K.apronComponent(p,x,z));if(a>peak){peak=a;peakAt=[x,z]}m+=a;wx+=x*a;wz+=z*a;if(a>.008)count++}
  return{id:p.id,mass:m,centroid:[wx/(m||1),wz/(m||1)],peak,peakAt,count};
});
let minCentroidSep=1e9;for(let i=0;i<componentStats.length;i++)for(let j=i+1;j<componentStats.length;j++)minCentroidSep=Math.min(minCentroidSep,Math.hypot(componentStats[i].centroid[0]-componentStats[j].centroid[0],componentStats[i].centroid[1]-componentStats[j].centroid[1]));
add('carrier_tied_aprons_are_spatially_distinct',minCentroidSep>18,{minCentroidSep,componentStats},'pairwise component centroid separation >18 m');
add('all_three_aprons_exist_in_numeric_field',componentStats.every(s=>s.peak>.025&&s.count>20),componentStats,'each component peak >0.025 m and >20 sampled occupied cells');

let nearMax=0,upperMax=0,receiverMax=0,outsideMax=0;
for(let x=-230;x<=230;x+=10){
  for(const z of [-300,-220,-160,-132,-80,-20,0,8,10,132,136,150,190])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R24.height(x,z)));
  for(const z of [-240,-180,-132,-80,-20,0,8,10])upperMax=Math.max(upperMax,Math.abs(K.height(x,z)-R24.height(x,z)));
  for(let z=16;z<=128;z+=8)if(R24.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R24.height(x,z)));
  const rz=K.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R24.height(x,rz+dz)));
}
add('r24_upper_work_untouched',upperMax<1e-9,upperMax,'zero sampled R25 change at z<=10');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside apron support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=10)for(let z=14;z<=128;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R24),newForward=worstForward(K);
add('apron_planform_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.12,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R24 + 0.12 m');

let permMaxChange=0,tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-126;z<=0;z+=6){const p=K.terracePermission(x,z),old=R24.terracePermission(x,z),d=K.nearestExtendedDrainageDistance(x,z);permMaxChange=Math.max(permMaxChange,Math.abs(p-old));if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_unchanged_before_terrace_stage',permMaxChange<1e-12,permMaxChange,'exact inherited permission because R25 support starts below candidate zone');
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.03,mean(tFar),'>0.03 while geometry remains locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('terrace_pilot_locked',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round25?.logicCorrection?.includes('not evidence that vertical amplitude')&&K.snapshot.round25?.logicCorrection?.includes('lateral occupancy'),K.snapshot.round25?.logicCorrection,'must reject amplitude-only visibility fix and change carrier-tied planform occupancy');
add('xiaoma_state_boundary_retained',K.snapshot.round25?.xiaomaBoundary?.includes('12.5 m')&&K.snapshot.round25?.xiaomaBoundary?.includes('do not establish'),K.snapshot.round25?.xiaomaBoundary,'macro geometry must not be promoted to field-scale/hydraulic truth');
add('mrrolord_frame_audit_reread',K.snapshot.round25?.mrRolordUse?.includes('frame audit was reread')&&K.snapshot.round25?.mrRolordUse?.includes('river hierarchy'),K.snapshot.round25?.mrRolordUse,'saved frame audit reread; hydrology-first ordering retained');
add('reference_reread_without_metric_inference',K.snapshot.round25?.referenceUse?.includes('image(173).png')&&K.snapshot.round25?.referenceUse?.includes('no terrace width'),K.snapshot.round25?.referenceUse,'reference used only for visual hierarchy');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round25?.forbiddenClaims)&&K.snapshot.round25.forbiddenClaims.length>=10,K.snapshot.round25?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,signatures,rowWidths,rowCentroids,meanWidth,widthRange,centroidRange,componentStats,minCentroidSep,nearMax,upperMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permMaxChange}};
fs.writeFileSync(new URL('./r045_round25_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
