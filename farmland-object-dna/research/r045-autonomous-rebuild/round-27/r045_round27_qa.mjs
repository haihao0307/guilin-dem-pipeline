import fs from 'node:fs';
import * as K from './r045_round27_kernel.mjs';
import * as R26 from '../round-26/r045_round26_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.27',K.VERSION,'R045.27');
add('three_transition_profiles',K.transitionProfiles.length===3,K.transitionProfiles.map(p=>[p.id,p.scaleClass]),'exactly three inherited outlet-tied transition profiles');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R26.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R26.edges),{nodes:[R26.nodes.length,K.nodes.length],edges:[R26.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R26.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R26.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');
add('r26_receiving_hierarchy_identity_preserved',JSON.stringify(K.receivingHierarchy)===JSON.stringify(R26.receivingHierarchy),K.receivingHierarchy.map(p=>[p.id,p.scaleClass,p.zStart,p.zEnd,p.width0,p.width1]),'exact R26 receiving-hierarchy definitions retained');

const sig=K.transitionProfiles.map(p=>({id:p.id,scaleClass:p.scaleClass,zStart:p.zStart,zEnd:p.zEnd,width0:p.width0,width1:p.width1,centre0:p.centre0,sweep:p.sweep,bend:p.bend,hollow:p.hollow,shoulder:p.shoulder,nested:p.nested,edgeSign:p.edgeSign}));
add('transition_profiles_are_not_clones',new Set(sig.map(s=>JSON.stringify(s))).size===3,sig,'three unique transition signatures');
add('declared_transition_scales_are_ordered',K.transitionProfiles[0].width1>K.transitionProfiles[1].width1&&K.transitionProfiles[1].width1>K.transitionProfiles[2].width1&&((K.transitionProfiles[0].zEnd-K.transitionProfiles[0].zStart)>(K.transitionProfiles[1].zEnd-K.transitionProfiles[1].zStart))&&((K.transitionProfiles[1].zEnd-K.transitionProfiles[1].zStart)>(K.transitionProfiles[2].zEnd-K.transitionProfiles[2].zStart)),sig,'major > subordinate > local in declared width and support length');

let max=0,sum=0,n=0,coreSum=0,coreN=0,pos=0,neg=0,maxStep=0,maxStepAt=null,maxAt=null;
for(let x=-230;x<=230;x+=6)for(let z=-30;z<=82;z+=4){
  const raw=K.transitionDelta(x,z),a=Math.abs(raw);if(a>max){max=a;maxAt=[x,z]}sum+=a;n++;
  if(z>=-8&&z<=58){coreSum+=a;coreN++}if(raw>0)pos+=raw;else neg+=-raw;
  const q=Math.abs(K.transitionDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}
}
const delta={max,mean:sum/(n||1),coreMean:coreSum/(coreN||1),n,maxAt,maxStep,maxStepAt,positiveMass:pos,negativeMass:neg,positiveToNegative:pos/(neg||1)};
add('transition_change_is_substantive',max>.02&&max<.32,delta,'0.02 m < max R27 delta < 0.32 m');
add('transition_change_is_broad_but_shallow',delta.coreMean>.002&&delta.coreMean<.09,delta.coreMean,'0.002 m < core mean abs delta < 0.09 m');
add('signed_transition_shoulders_survive',pos>neg*.0015&&pos<neg*.95,{positiveMass:pos,negativeMass:neg,ratio:pos/(neg||1)},'positive shoulder mass is 0.15%..95% of negative transition mass');
add('added_field_is_longitudinally_gradual',maxStep<.12,{maxStep,at:maxStepAt},'<0.12 m change in R27 field per 4 m z');

let slopeSideCount=0,receiverSideCount=0,overlapCount=0;
for(let x=-220;x<=220;x+=8){
  for(let z=-20;z<=6;z+=4)if(Math.abs(K.transitionDelta(x,z))>.003)slopeSideCount++;
  for(let z=28;z<=68;z+=4){const a=Math.abs(K.transitionDelta(x,z));if(a>.003)receiverSideCount++;if(a>.003&&Math.abs(R26.hierarchyDelta(x,z))>.003)overlapCount++;}
}
add('transition_reaches_agricultural_slope_side',slopeSideCount>25,slopeSideCount,'>25 active samples at z=-20..6');
add('transition_reaches_receiving_plain_side',receiverSideCount>80,receiverSideCount,'>80 active samples at z=28..68');
add('transition_overlaps_r26_receiving_hierarchy',overlapCount>35,overlapCount,'>35 cells where R27 connector and R26 hierarchy both have substantive signal');

const componentStats=K.transitionProfiles.map(p=>{
  let m=0,wx=0,wz=0,peak=0,peakAt=null,count=0,rows=new Set(),positive=0,negative=0;
  for(let x=-230;x<=230;x+=8)for(let z=-30;z<=82;z+=6){
    const raw=K.transitionComponent(p,x,z),a=Math.abs(raw);if(a>peak){peak=a;peakAt=[x,z]}
    m+=a;wx+=x*a;wz+=z*a;if(a>.004){count++;rows.add(z)}if(raw>0)positive+=raw;else negative+=-raw;
  }
  return{id:p.id,scaleClass:p.scaleClass,mass:m,centroid:[wx/(m||1),wz/(m||1)],peak,peakAt,count,occupiedRows:rows.size,positive,negative};
});
const [major,subordinate,local]=componentStats;
add('all_three_transition_components_exist',componentStats.every(s=>s.peak>.01&&s.count>20),componentStats,'each component peak >0.01 m and >20 occupied samples');
add('actual_transition_scale_hierarchy_survives',major.count>subordinate.count*1.06&&subordinate.count>local.count*1.06,componentStats.map(s=>({id:s.id,count:s.count,rows:s.occupiedRows})),'actual occupied samples major > subordinate > local by >6% each step');
let minSep=1e9;for(let i=0;i<componentStats.length;i++)for(let j=i+1;j<componentStats.length;j++)minSep=Math.min(minSep,Math.hypot(componentStats[i].centroid[0]-componentStats[j].centroid[0],componentStats[i].centroid[1]-componentStats[j].centroid[1]));
add('transition_components_remain_spatially_distinct',minSep>12,{minSep,componentStats},'pairwise component centroid separation >12 m');

const rows=[];for(let z=-16;z<=68;z+=6){let mass=0,wx=0,count=0;for(let x=-230;x<=230;x+=4){const a=Math.abs(K.transitionDelta(x,z));if(a>.006)count++;mass+=a;wx+=x*a}if(mass>0)rows.push({z,count,centroid:wx/mass})}
const countRange=rows.length?Math.max(...rows.map(r=>r.count))-Math.min(...rows.map(r=>r.count)):0;
const centroidRange=rows.length?Math.max(...rows.map(r=>r.centroid))-Math.min(...rows.map(r=>r.centroid)):0;
add('whole_transition_occupancy_evolves',rows.length>=8&&countRange>5,{rows,countRange},'>=8 active rows and occupied-cell count range >5');
add('whole_transition_sweeps_laterally',centroidRange>5,{centroidRange,rows},'weighted planform centroid shifts by >5 m');

let farUpstreamMax=0,nearMax=0,receiverMax=0,outsideMax=0;
for(let x=-230;x<=230;x+=10){
  for(const z of [-300,-220,-160,-100,-70,-50,-42,-36,88,96,120,150,190])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R26.height(x,z)));
  for(const z of [-300,-220,-160,-100,-70,-50,-42,-36])farUpstreamMax=Math.max(farUpstreamMax,Math.abs(K.height(x,z)-R26.height(x,z)));
  for(let z=-28;z<=80;z+=8)if(R26.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R26.height(x,z)));
  const rz=K.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R26.height(x,rz+dz)));
}
add('far_upstream_work_untouched',farUpstreamMax<1e-9,farUpstreamMax,'zero sampled R27 change at z<=-36');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside R27 support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=10)for(let z=-30;z<=82;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R26),newForward=worstForward(K);
add('transition_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.10,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R26 + 0.10 m');

let permMaxChange=0,tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-126;z<=6;z+=6){const p=K.terracePermission(x,z),old=R26.terracePermission(x,z),d=K.nearestExtendedDrainageDistance(x,z);permMaxChange=Math.max(permMaxChange,Math.abs(p-old));if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_recomputed_after_surface_change',permMaxChange>1e-7,permMaxChange,'permission must not remain bit-identical after R27 touches candidate substrate');
add('permission_change_remains_bounded',permMaxChange<.65,permMaxChange,'localized substrate update must not globally overturn suitability');
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.03,mean(tFar),'>0.03 while geometry remains locked');

add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('terrace_pilot_locked',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round27?.logicCorrection?.includes('Visibility is not causality')&&K.snapshot.round27?.logicCorrection?.includes('planform connection'),K.snapshot.round27?.logicCorrection,'must reject amplitude-only or terrace-overlay visibility fix');
add('stale_permission_logic_corrected',K.snapshot.round27?.permissionCorrection?.includes('stale')&&K.snapshot.round27?.permissionCorrection?.includes('recomputed'),K.snapshot.round27?.permissionCorrection,'surface change in candidate zone requires permission recomputation');
add('xiaoma_boundary_retained',K.snapshot.round27?.xiaomaBoundary?.includes('does not establish hydraulic connectivity')&&K.snapshot.round27?.xiaomaBoundary?.includes('microtopography'),K.snapshot.round27?.xiaomaBoundary,'continuous morphology cannot be promoted to hydraulic truth');
add('mrrolord_ordering_only',K.snapshot.round27?.mrRolordUse?.includes('river hierarchy/carriers')&&K.snapshot.round27?.mrRolordUse?.includes('No Blender dimension'),K.snapshot.round27?.mrRolordUse,'reuse ordering only, not dimensions or truth');
add('user_reference_reopened_without_metric_inference',K.snapshot.round27?.referenceUse?.includes('reopened this round')&&K.snapshot.round27?.referenceUse?.includes('no terrace width'),K.snapshot.round27?.referenceUse,'image(173).png reopened only for visible hierarchy');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round27?.forbiddenClaims)&&K.snapshot.round27.forbiddenClaims.length>=10,K.snapshot.round27?.forbiddenClaims,'explicit evidence boundary');
add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,signatures:sig,slopeSideCount,receiverSideCount,overlapCount,componentStats,minCentroidSep:minSep,rows,countRange,centroidRange,farUpstreamMax,nearMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permMaxChange}};
fs.writeFileSync(new URL('./r045_round27_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
