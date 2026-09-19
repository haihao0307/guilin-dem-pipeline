import fs from 'node:fs';
import * as K from './r045_round26_kernel.mjs';
import * as R25 from '../round-25/r045_round25_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.26',K.VERSION,'R045.26');
add('three_receiving_hierarchy_profiles',K.receivingHierarchy.length===3,K.receivingHierarchy.map(p=>[p.id,p.scaleClass]),'exactly three inherited outlet-tied hierarchy profiles');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R25.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R25.edges),{nodes:[R25.nodes.length,K.nodes.length],edges:[R25.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R25.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R25.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

const sig=K.receivingHierarchy.map(p=>({id:p.id,scaleClass:p.scaleClass,zStart:p.zStart,zEnd:p.zEnd,width0:p.width0,width1:p.width1,centre0:p.centre0,sweep:p.sweep,bend:p.bend,depth:p.depth,shoulder:p.shoulder,nested:p.nested,edgeSign:p.edgeSign}));
add('hierarchy_profiles_are_not_clones',new Set(sig.map(s=>JSON.stringify(s))).size===3,sig,'three unique signatures');
add('declared_scale_classes_are_ordered',K.receivingHierarchy[0].width1>K.receivingHierarchy[1].width1&&K.receivingHierarchy[1].width1>K.receivingHierarchy[2].width1&&((K.receivingHierarchy[0].zEnd-K.receivingHierarchy[0].zStart)>(K.receivingHierarchy[1].zEnd-K.receivingHierarchy[1].zStart))&&((K.receivingHierarchy[1].zEnd-K.receivingHierarchy[1].zStart)>(K.receivingHierarchy[2].zEnd-K.receivingHierarchy[2].zStart)),sig,'major > subordinate > local in declared width and support length');

let max=0,sum=0,n=0,coreSum=0,coreN=0,pos=0,neg=0,maxStep=0,maxStepAt=null,maxAt=null;
for(let x=-230;x<=230;x+=6)for(let z=22;z<=132;z+=4){
  const raw=K.hierarchyDelta(x,z),a=Math.abs(raw);if(a>max){max=a;maxAt=[x,z]}sum+=a;n++;
  if(z>=44&&z<=108){coreSum+=a;coreN++}if(raw>0)pos+=raw;else neg+=-raw;
  const q=Math.abs(K.hierarchyDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}
}
const delta={max,mean:sum/(n||1),coreMean:coreSum/(coreN||1),n,maxAt,maxStep,maxStepAt,positiveMass:pos,negativeMass:neg,positiveToNegative:pos/(neg||1)};
add('hierarchy_change_is_substantive',max>.045&&max<.46,delta,'0.045 m < max R26 delta < 0.46 m');
add('hierarchy_change_is_broad_but_shallow',delta.coreMean>.006&&delta.coreMean<.13,delta.coreMean,'0.006 m < core mean abs delta < 0.13 m');
add('signed_shoulders_survive',pos>neg*.003&&pos<neg*.80,{positiveMass:pos,negativeMass:neg,ratio:pos/(neg||1)},'positive shoulder mass is 0.3%..80% of negative receiving mass');
add('added_field_is_longitudinally_gradual',maxStep<.15,{maxStep,at:maxStepAt},'<0.15 m change in R26 field per 4 m z');

const componentStats=K.receivingHierarchy.map(p=>{
  let m=0,wx=0,wz=0,peak=0,peakAt=null,count=0,rows=new Set(),positive=0,negative=0;
  for(let x=-230;x<=230;x+=8)for(let z=20;z<=132;z+=6){
    const raw=K.hierarchyComponent(p,x,z),a=Math.abs(raw);if(a>peak){peak=a;peakAt=[x,z]}
    m+=a;wx+=x*a;wz+=z*a;if(a>.008){count++;rows.add(z)}if(raw>0)positive+=raw;else negative+=-raw;
  }
  return{id:p.id,scaleClass:p.scaleClass,mass:m,centroid:[wx/(m||1),wz/(m||1)],peak,peakAt,count,occupiedRows:rows.size,positive,negative};
});
const [major,subordinate,local]=componentStats;
add('all_three_hierarchy_components_exist',componentStats.every(s=>s.peak>.018&&s.count>20),componentStats,'each component peak >0.018 m and >20 occupied samples');
add('numeric_footprint_scale_hierarchy_survives',major.count>subordinate.count*1.12&&subordinate.count>local.count*1.12,componentStats.map(s=>({id:s.id,scaleClass:s.scaleClass,count:s.count,rows:s.occupiedRows})),'actual occupied samples major > subordinate > local by >12% each step');
add('longitudinal_scale_hierarchy_survives',major.occupiedRows>subordinate.occupiedRows&&subordinate.occupiedRows>local.occupiedRows,componentStats.map(s=>({id:s.id,rows:s.occupiedRows})),'actual occupied row count major > subordinate > local');
let minSep=1e9;for(let i=0;i<componentStats.length;i++)for(let j=i+1;j<componentStats.length;j++)minSep=Math.min(minSep,Math.hypot(componentStats[i].centroid[0]-componentStats[j].centroid[0],componentStats[i].centroid[1]-componentStats[j].centroid[1]));
add('carrier_tied_hierarchy_components_remain_spatially_distinct',minSep>16,{minSep,componentStats},'pairwise component centroid separation >16 m');

const rows=[];for(let z=34;z<=112;z+=6){let mass=0,wx=0,count=0;for(let x=-230;x<=230;x+=4){const a=Math.abs(K.hierarchyDelta(x,z));if(a>.012)count++;mass+=a;wx+=x*a}if(mass>0)rows.push({z,count,centroid:wx/mass})}
const countRange=rows.length?Math.max(...rows.map(r=>r.count))-Math.min(...rows.map(r=>r.count)):0;
const centroidRange=rows.length?Math.max(...rows.map(r=>r.centroid))-Math.min(...rows.map(r=>r.centroid)):0;
add('whole_scene_hierarchy_occupancy_evolves',rows.length>=8&&countRange>6,{rows,countRange},'>=8 active rows and occupied-cell count range >6');
add('whole_scene_hierarchy_sweeps_laterally',centroidRange>5,{centroidRange,rows},'weighted planform centroid shifts by >5 m');

let upperMax=0,nearMax=0,receiverMax=0,outsideMax=0;
for(let x=-230;x<=230;x+=10){
  for(const z of [-300,-220,-160,-80,-20,0,10,18,20,132,136,150,190])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R25.height(x,z)));
  for(const z of [-240,-180,-132,-80,-20,0,10,18,20])upperMax=Math.max(upperMax,Math.abs(K.height(x,z)-R25.height(x,z)));
  for(let z=24;z<=128;z+=8)if(R25.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R25.height(x,z)));
  const rz=K.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R25.height(x,rz+dz)));
}
add('r25_upper_work_untouched',upperMax<1e-9,upperMax,'zero sampled R26 change at z<=20');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside R26 support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=10)for(let z=20;z<=128;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R25),newForward=worstForward(K);
add('nested_hierarchy_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.12,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R25 + 0.12 m');

let permMaxChange=0,tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-126;z<=0;z+=6){const p=K.terracePermission(x,z),old=R25.terracePermission(x,z),d=K.nearestExtendedDrainageDistance(x,z);permMaxChange=Math.max(permMaxChange,Math.abs(p-old));if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_unchanged_before_terrace_stage',permMaxChange<1e-12,permMaxChange,'exact inherited permission because R26 remains below candidate zone');
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.03,mean(tFar),'>0.03 while geometry remains locked');

add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('terrace_pilot_locked',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round26?.logicCorrection?.includes('does not justify simply increasing relief amplitude')&&K.snapshot.round26?.logicCorrection?.includes('nested planform scale'),K.snapshot.round26?.logicCorrection,'must reject amplitude-only visibility fix');
add('xiaoma_boundary_retained',K.snapshot.round26?.xiaomaBoundary?.includes('12.5 m')&&K.snapshot.round26?.xiaomaBoundary?.includes('does not establish'),K.snapshot.round26?.xiaomaBoundary,'macro terrain cannot be promoted to field/hydraulic truth');
add('mrrolord_frame_audit_reread',K.snapshot.round26?.mrRolordUse?.includes('frame audit was reread')&&K.snapshot.round26?.mrRolordUse?.includes('river hierarchy'),K.snapshot.round26?.mrRolordUse,'saved video-frame audit reread, hydrology-first ordering retained');
add('user_reference_reopened_without_metric_inference',K.snapshot.round26?.referenceUse?.includes('reopened this round')&&K.snapshot.round26?.referenceUse?.includes('no terrace width'),K.snapshot.round26?.referenceUse,'image(173).png reopened only for visible hierarchy');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round26?.forbiddenClaims)&&K.snapshot.round26.forbiddenClaims.length>=10,K.snapshot.round26?.forbiddenClaims,'explicit evidence boundary');
add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,signatures:sig,componentStats,minCentroidSep:minSep,rows,countRange,centroidRange,upperMax,nearMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permMaxChange}};
fs.writeFileSync(new URL('./r045_round26_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
