import fs from 'node:fs';
import * as K from './r045_round28_kernel.mjs';
import * as R27 from '../round-27/r045_round27_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);

add('version',K.VERSION==='R045.28',K.VERSION,'R045.28');
add('three_contact_profiles',K.contactProfiles.length===3,K.contactProfiles.map(p=>[p.id,p.scaleClass]),'exactly three inherited outlet-tied contact profiles');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R27.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R27.edges),{nodes:[R27.nodes.length,K.nodes.length],edges:[R27.edges.length,K.edges.length]},'exact planimetric graph identity');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R27.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R27.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');
add('r27_transition_identity_preserved',JSON.stringify(K.transitionProfiles)===JSON.stringify(R27.transitionProfiles),K.transitionProfiles.map(p=>p.id),'exact R27 transition definitions retained');

const sig=K.contactProfiles.map(p=>({id:p.id,scaleClass:p.scaleClass,zStart:p.zStart,zEnd:p.zEnd,width0:p.width0,width1:p.width1,centre0:p.centre0,sweep:p.sweep,bend:p.bend,pocket:p.pocket,tongue:p.tongue,notch:p.notch,counter:p.counter,edgeSign:p.edgeSign}));
add('contact_profiles_are_not_clones',new Set(sig.map(s=>JSON.stringify(s))).size===3,sig,'three unique contact signatures');
add('declared_contact_scales_are_ordered',K.contactProfiles[0].width1>K.contactProfiles[1].width1&&K.contactProfiles[1].width1>K.contactProfiles[2].width1&&((K.contactProfiles[0].zEnd-K.contactProfiles[0].zStart)>(K.contactProfiles[1].zEnd-K.contactProfiles[1].zStart))&&((K.contactProfiles[1].zEnd-K.contactProfiles[1].zStart)>(K.contactProfiles[2].zEnd-K.contactProfiles[2].zStart)),sig,'major > subordinate > local in declared width and support length');
add('contact_sweeps_change_direction',Math.sign(K.contactProfiles[0].sweep)!==Math.sign(K.contactProfiles[1].sweep)&&Math.sign(K.contactProfiles[1].sweep)!==Math.sign(K.contactProfiles[2].sweep),K.contactProfiles.map(p=>p.sweep),'adjacent hierarchy members use opposite lateral sweep');

let max=0,sum=0,n=0,coreSum=0,coreN=0,pos=0,neg=0,maxStep=0,maxStepAt=null,maxAt=null;
for(let x=-230;x<=230;x+=6)for(let z=-8;z<=108;z+=4){
  const raw=K.contactDelta(x,z),a=Math.abs(raw);if(a>max){max=a;maxAt=[x,z]}sum+=a;n++;
  if(z>=8&&z<=78){coreSum+=a;coreN++}if(raw>0)pos+=raw;else neg+=-raw;
  const q=Math.abs(K.contactDelta(x,z+4)-raw);if(q>maxStep){maxStep=q;maxStepAt=[x,z]}
}
const delta={max,mean:sum/(n||1),coreMean:coreSum/(coreN||1),n,maxAt,maxStep,maxStepAt,positiveMass:pos,negativeMass:neg,positiveToNegative:pos/(neg||1)};
add('contact_change_is_substantive',max>.025&&max<.32,delta,'0.025 m < max R28 delta < 0.32 m');
add('contact_change_is_broad_but_low_relief',delta.coreMean>.003&&delta.coreMean<.10,delta.coreMean,'0.003 m < core mean abs delta < 0.10 m');
add('concave_and_convex_relief_both_survive',pos>neg*.01&&pos<neg*2,{positiveMass:pos,negativeMass:neg,ratio:pos/(neg||1)},'positive tongue/counter mass is 1%..200% of negative pocket/notch mass');
add('added_contact_is_longitudinally_gradual',maxStep<.14,{maxStep,at:maxStepAt},'<0.14 m change in R28 field per 4 m z');

let footCount=0,plainCount=0,overlap27=0;
for(let x=-220;x<=220;x+=8){
  for(let z=0;z<=28;z+=4)if(Math.abs(K.contactDelta(x,z))>.003)footCount++;
  for(let z=42;z<=96;z+=4){const a=Math.abs(K.contactDelta(x,z));if(a>.003)plainCount++;if(a>.003&&Math.abs(R27.transitionDelta(x,z))>.003)overlap27++;}
}
add('contact_reaches_footslope',footCount>35,footCount,'>35 active samples at z=0..28');
add('contact_reaches_receiving_plain',plainCount>90,plainCount,'>90 active samples at z=42..96');
add('contact_overlaps_r27_transition',overlap27>25,overlap27,'>25 cells where R28 contact and R27 transition both have substantive signal');

const componentStats=K.contactProfiles.map(p=>{
  let m=0,wx=0,wz=0,peak=0,peakAt=null,count=0,rows=new Set(),positive=0,negative=0;
  for(let x=-230;x<=230;x+=8)for(let z=-8;z<=108;z+=6){
    const raw=K.contactComponent(p,x,z),a=Math.abs(raw);if(a>peak){peak=a;peakAt=[x,z]}
    m+=a;wx+=x*a;wz+=z*a;if(a>.004){count++;rows.add(z)}if(raw>0)positive+=raw;else negative+=-raw;
  }
  return{id:p.id,scaleClass:p.scaleClass,mass:m,centroid:[wx/(m||1),wz/(m||1)],peak,peakAt,count,occupiedRows:rows.size,positive,negative};
});
const [major,subordinate,local]=componentStats;
add('all_three_contact_components_exist',componentStats.every(s=>s.peak>.012&&s.count>20),componentStats,'each component peak >0.012 m and >20 occupied samples');
add('actual_contact_scale_hierarchy_survives',major.count>subordinate.count*1.05&&subordinate.count>local.count*1.05,componentStats.map(s=>({id:s.id,count:s.count,rows:s.occupiedRows})),'actual occupied samples major > subordinate > local by >5% each step');
let minSep=1e9;for(let i=0;i<componentStats.length;i++)for(let j=i+1;j<componentStats.length;j++)minSep=Math.min(minSep,Math.hypot(componentStats[i].centroid[0]-componentStats[j].centroid[0],componentStats[i].centroid[1]-componentStats[j].centroid[1]));
add('contact_components_remain_spatially_distinct',minSep>15,{minSep,componentStats},'pairwise component centroid separation >15 m');

const rows=[];for(let z=2;z<=98;z+=6){let mass=0,wx=0,count=0,posCells=0,negCells=0,minX=999,maxX=-999;for(let x=-230;x<=230;x+=4){const d=K.contactDelta(x,z),a=Math.abs(d);if(a>.006){count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);if(d>0)posCells++;if(d<0)negCells++}mass+=a;wx+=x*a}if(mass>0)rows.push({z,count,centroid:wx/mass,span:maxX>=minX?maxX-minX:0,posCells,negCells})}
const countRange=rows.length?Math.max(...rows.map(r=>r.count))-Math.min(...rows.map(r=>r.count)):0;
const centroidRange=rows.length?Math.max(...rows.map(r=>r.centroid))-Math.min(...rows.map(r=>r.centroid)):0;
const spanRange=rows.length?Math.max(...rows.map(r=>r.span))-Math.min(...rows.map(r=>r.span)):0;
const mixedRows=rows.filter(r=>r.posCells>0&&r.negCells>0).length;
add('whole_contact_occupancy_evolves',rows.length>=9&&countRange>5,{rows,countRange},'>=9 active rows and occupied-cell count range >5');
add('whole_contact_sweeps_laterally',centroidRange>7,{centroidRange,rows},'weighted planform centroid shifts by >7 m');
add('whole_contact_width_evolves',spanRange>12,{spanRange,rows},'active planform span changes by >12 m');
add('interleaved_signed_rows_exist',mixedRows>=3,{mixedRows,rows},'>=3 rows contain both convex tongue and concave pocket cells');

let farUpstreamMax=0,nearMax=0,receiverMax=0,outsideMax=0;
for(let x=-230;x<=230;x+=10){
  for(const z of [-300,-220,-160,-100,-70,-50,-30,-20,-14,116,124,150,190])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R27.height(x,z)));
  for(const z of [-300,-220,-160,-100,-70,-50,-30,-20,-14])farUpstreamMax=Math.max(farUpstreamMax,Math.abs(K.height(x,z)-R27.height(x,z)));
  for(let z=-4;z<=108;z+=8)if(R27.nearestExtendedDrainageDistance(x,z)<10)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R27.height(x,z)));
  const rz=K.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R27.height(x,rz+dz)));
}
add('far_upstream_work_untouched',farUpstreamMax<1e-9,farUpstreamMax,'zero sampled R28 change at z<=-14');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside R28 support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 10 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');

function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=10)for(let z=-8;z<=108;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R27),newForward=worstForward(K);
add('contact_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.10,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R27 + 0.10 m');

let permMaxChange=0,tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-126;z<=6;z+=6){const p=K.terracePermission(x,z),old=R27.terracePermission(x,z),d=K.nearestExtendedDrainageDistance(x,z);permMaxChange=Math.max(permMaxChange,Math.abs(p-old));if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_recomputed_after_surface_change',permMaxChange>1e-8,permMaxChange,'permission must respond to R28 contact change near candidate substrate');
add('permission_change_remains_bounded',permMaxChange<.65,permMaxChange,'localized substrate update must not globally overturn suitability');
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.03,mean(tFar),'>0.03 while geometry remains locked');

add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('terrace_pilot_locked',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round28?.logicCorrection?.includes('does not imply')&&K.snapshot.round28?.logicCorrection?.includes('footprint'),K.snapshot.round28?.logicCorrection,'must reject amplitude-only visibility fix');
add('xiaoma_boundary_retained',K.snapshot.round28?.xiaomaBoundary?.includes('do not establish')&&K.snapshot.round28?.xiaomaBoundary?.includes('common-datum'),K.snapshot.round28?.xiaomaBoundary,'macro morphology cannot be promoted to surveyed/hydraulic truth');
add('mrrolord_ordering_only',K.snapshot.round28?.mrRolordUse?.includes('river hierarchy')&&K.snapshot.round28?.mrRolordUse?.includes('does not copy Blender'),K.snapshot.round28?.mrRolordUse,'reuse ordering only, not dimensions or truth');
add('user_reference_reopened_without_metric_inference',K.snapshot.round28?.referenceUse?.includes('reopened this round')&&K.snapshot.round28?.referenceUse?.includes('no terrace width'),K.snapshot.round28?.referenceUse,'image(173).png reopened only for visible planform hierarchy');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round28?.forbiddenClaims)&&K.snapshot.round28.forbiddenClaims.length>=12,K.snapshot.round28?.forbiddenClaims,'explicit evidence boundary');
add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,signatures:sig,footCount,plainCount,overlap27,componentStats,minCentroidSep:minSep,rows,countRange,centroidRange,spanRange,mixedRows,farUpstreamMax,nearMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permMaxChange}};
fs.writeFileSync(new URL('./r045_round28_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
