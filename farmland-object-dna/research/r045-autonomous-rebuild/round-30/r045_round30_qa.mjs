import fs from 'node:fs';
import * as K from './r045_round30_kernel.mjs';
import * as R29 from '../round-29/r045_round29_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
add('version',K.VERSION==='R045.30',K.VERSION,'R045.30');
add('three_aspect_profiles',K.aspectProfiles.length===3,K.aspectProfiles.map(p=>[p.id,p.scaleClass]),'three outlet-tied aspect profiles');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R29.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R29.edges),{nodes:[R29.nodes.length,K.nodes.length],edges:[R29.edges.length,K.edges.length]},'exact inherited planimetric graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R29.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R29.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');
add('r29_break_profiles_preserved',JSON.stringify(K.breakProfiles)===JSON.stringify(R29.breakProfiles),K.breakProfiles.map(p=>p.id),'R29 breakline definitions unchanged');
const sig=K.aspectProfiles.map(p=>({id:p.id,scaleClass:p.scaleClass,zStart:p.zStart,zEnd:p.zEnd,width0:p.width0,width1:p.width1,centre0:p.centre0,sweep:p.sweep,bend:p.bend,twist:p.twist,counter:p.counter}));
add('aspect_profiles_are_not_clones',new Set(sig.map(s=>JSON.stringify(s))).size===3,sig,'three unique aspect signatures');
add('declared_aspect_scales_are_ordered',K.aspectProfiles[0].width1>K.aspectProfiles[1].width1&&K.aspectProfiles[1].width1>K.aspectProfiles[2].width1&&(K.aspectProfiles[0].zEnd-K.aspectProfiles[0].zStart)>(K.aspectProfiles[1].zEnd-K.aspectProfiles[1].zStart)&&(K.aspectProfiles[1].zEnd-K.aspectProfiles[1].zStart)>(K.aspectProfiles[2].zEnd-K.aspectProfiles[2].zStart),sig,'major > subordinate > local in width and support length');
add('aspect_handedness_changes',Math.sign(K.aspectProfiles[0].twist)!==Math.sign(K.aspectProfiles[1].twist)&&Math.sign(K.aspectProfiles[1].twist)!==Math.sign(K.aspectProfiles[2].twist),K.aspectProfiles.map(p=>p.twist),'adjacent hierarchy members rotate opposite ways');
let deltaMax=0,deltaSum=0,deltaN=0,pos=0,neg=0,coreSum=0,coreN=0,maxStep=0,maxAt=null;
for(let x=-230;x<=230;x+=6)for(let z=-92;z<=94;z+=4){const d=K.aspectDelta(x,z),a=Math.abs(d);deltaMax=Math.max(deltaMax,a);deltaSum+=a;deltaN++;if(z>=-66&&z<=66){coreSum+=a;coreN++}if(d>0)pos+=d;else neg+=-d;const s=Math.abs(K.aspectDelta(x,z+4)-d);if(s>maxStep){maxStep=s;maxAt=[x,z]}}
const delta={deltaMax,deltaMean:deltaSum/(deltaN||1),coreMean:coreSum/(coreN||1),pos,neg,maxStep,maxAt};
add('aspect_articulation_is_substantive_but_bounded',deltaMax>.08&&deltaMax<=.851,delta,'.08 m < max aspect delta <= .851 m');
add('aspect_articulation_is_broad',delta.coreMean>.004&&delta.coreMean<.30,delta.coreMean,'core mean abs delta >.004 m and <.30 m');
add('both_relief_signs_survive',pos>1&&neg>1,{pos,neg},'raised and lowered flanks both survive');
add('aspect_field_is_longitudinally_gradual',maxStep<.18,{maxStep,maxAt},'<.18 m added delta change per 4 m z');
let lower=0,foot=0,plain=0,overlap29=0;for(let x=-220;x<=220;x+=8){for(let z=-80;z<=-16;z+=4)if(Math.abs(K.aspectDelta(x,z))>.004)lower++;for(let z=-12;z<=28;z+=4)if(Math.abs(K.aspectDelta(x,z))>.004)foot++;for(let z=32;z<=82;z+=4){const a=Math.abs(K.aspectDelta(x,z));if(a>.004)plain++;if(a>.004&&Math.abs(R29.breakWarpDelta(x,z))>.004)overlap29++;}}
add('aspect_reaches_lower_agricultural_slope',lower>30,lower,'>30 active samples at z=-80..-16');
add('aspect_reaches_footslope',foot>30,foot,'>30 active samples at z=-12..28');
add('aspect_reaches_receiving_plain',plain>30,plain,'>30 active samples at z=32..82');
add('aspect_overlaps_r29_contact_break_system',overlap29>20,overlap29,'>20 cells overlap substantive R29 break response');
const componentStats=K.aspectProfiles.map(p=>{let m=0,wx=0,wz=0,peak=0,count=0,rows=new Set(),pp=0,nn=0;for(let x=-230;x<=230;x+=8)for(let z=-92;z<=94;z+=6){const raw=K.aspectComponent(p,x,z),a=Math.abs(raw);peak=Math.max(peak,a);m+=a;wx+=x*a;wz+=z*a;if(a>.012){count++;rows.add(z)}if(raw>0)pp+=raw;else nn+=-raw;}return{id:p.id,scaleClass:p.scaleClass,mass:m,centroid:[wx/(m||1),wz/(m||1)],peak,count,occupiedRows:rows.size,pos:pp,neg:nn};});
const [major,subordinate,local]=componentStats;
add('all_three_aspect_components_exist',componentStats.every(s=>s.peak>.05&&s.count>12&&s.pos>0&&s.neg>0),componentStats,'each component has substantive two-sided response');
add('actual_aspect_scale_hierarchy_survives',major.count>subordinate.count*1.03&&subordinate.count>local.count*1.03,componentStats.map(s=>({id:s.id,count:s.count,rows:s.occupiedRows})),'occupied samples major > subordinate > local by >3% each step');
let minSep=1e9;for(let i=0;i<componentStats.length;i++)for(let j=i+1;j<componentStats.length;j++)minSep=Math.min(minSep,Math.hypot(componentStats[i].centroid[0]-componentStats[j].centroid[0],componentStats[i].centroid[1]-componentStats[j].centroid[1]));
add('aspect_components_remain_spatially_distinct',minSep>15,{minSep,componentStats},'pairwise component centroid separation >15 m');
let angles=[],signedPos=0,signedNeg=0,angleMax=0,angleAt=null;for(let x=-210;x<=210;x+=10)for(let z=-80;z<=80;z+=6){if(Math.abs(K.aspectDelta(x,z))<.01||R29.nearestExtendedDrainageDistance(x,z)<18)continue;const a=R29.gradient(x,z),b=K.gradient(x,z),la=Math.hypot(a.dx,a.dz),lb=Math.hypot(b.dx,b.dz);if(la<.01||lb<.01)continue;const c=clamp((a.dx*b.dx+a.dz*b.dz)/(la*lb),-1,1),deg=Math.acos(c)*180/Math.PI;angles.push(deg);if(deg>angleMax){angleMax=deg;angleAt=[x,z]}const cross=a.dx*b.dz-a.dz*b.dx;if(cross>1e-7)signedPos++;if(cross<-1e-7)signedNeg++;}
const angleMean=mean(angles);
add('surface_aspect_actually_rotates',angles.length>40&&angleMax>.45&&angleMean>.04,{samples:angles.length,angleMax,angleMean,angleAt},'>40 samples, max rotation >.45 deg, mean >.04 deg');
add('surface_aspect_rotation_is_bounded',angleMax<35,{angleMax,angleAt},'max sampled rotation <35 deg');
add('both_rotation_handednesses_survive',signedPos>8&&signedNeg>8,{signedPos,signedNeg},'>8 sampled rotations in each handedness');
let farUpstreamMax=0,nearMax=0,receiverMax=0,outsideMax=0;for(let x=-230;x<=230;x+=10){for(const z of [-300,-220,-160,-120,-105,110,130,160,190])outsideMax=Math.max(outsideMax,Math.abs(K.height(x,z)-R29.height(x,z)));for(const z of [-300,-220,-160,-120,-105])farUpstreamMax=Math.max(farUpstreamMax,Math.abs(K.height(x,z)-R29.height(x,z)));for(let z=-88;z<=92;z+=8)if(R29.nearestExtendedDrainageDistance(x,z)<12)nearMax=Math.max(nearMax,Math.abs(K.height(x,z)-R29.height(x,z)));const rz=K.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiverMax=Math.max(receiverMax,Math.abs(K.height(x,rz+dz)-R29.height(x,rz+dz)));}
add('far_upstream_work_untouched',farUpstreamMax<1e-9,farUpstreamMax,'zero sampled R30 change at z<=-105');
add('support_is_band_limited',outsideMax<1e-9,outsideMax,'zero sampled change outside R30 support');
add('drainage_axes_are_protected',nearMax<1e-9,nearMax,'zero sampled change within 12 m of inherited drainage axes');
add('foreground_receiver_is_unchanged',receiverMax<1e-9,receiverMax,'zero sampled change around receiver river');
function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=10)for(let z=-92;z<=94;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}const oldForward=worstForward(R29),newForward=worstForward(K);
add('aspect_articulation_does_not_create_new_wall',newForward.maxRise<=oldForward.maxRise+.14,{old:oldForward,new:newForward},'new worst 4 m uphill rise <= R29 +.14 m');
let permMaxChange=0,tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-126;z<=6;z+=6){const p=K.terracePermission(x,z),old=R29.terracePermission(x,z),d=K.nearestExtendedDrainageDistance(x,z);permMaxChange=Math.max(permMaxChange,Math.abs(p-old));if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_recomputed_after_gradient_change',permMaxChange>1e-8,permMaxChange,'permission must respond to R30 gradient/curvature change');
add('permission_change_remains_bounded',permMaxChange<.60,permMaxChange,'localized aspect update must not globally overturn suitability');
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<.01');
add('future_terrace_candidates_remain',mean(tFar)>.02,mean(tFar),'>.02 while geometry remains locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);add('terrace_pilot_locked',K.snapshot.terracePilotPreviewEnabled===false,K.snapshot.terracePilotPreviewEnabled,false);add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('logic_error_explicitly_corrected',K.snapshot.round30?.logicCorrection?.includes('does not imply')&&K.snapshot.round30?.logicCorrection?.includes('aspect'),K.snapshot.round30?.logicCorrection,'must reject amplitude/terrace-stripe shortcut');
add('xiaoma_boundary_retained',K.snapshot.round30?.xiaomaBoundary?.includes('no selected parcel')&&K.snapshot.round30?.xiaomaBoundary?.includes('unknown'),K.snapshot.round30?.xiaomaBoundary,'checkpoint unknowns remain explicit');
add('mrrolord_ordering_only',K.snapshot.round30?.mrRolordUse?.includes('river hierarchy')&&K.snapshot.round30?.mrRolordUse?.includes('not copied'),K.snapshot.round30?.mrRolordUse,'reuse process ordering only, not Blender implementation truth');
add('user_reference_reopened_without_metric_inference',K.snapshot.round30?.referenceUse?.includes('reopened this round')&&K.snapshot.round30?.referenceUse?.includes('no terrace width'),K.snapshot.round30?.referenceUse,'image(173).png used only for visible morphology');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round30?.forbiddenClaims)&&K.snapshot.round30.forbiddenClaims.length>=14,K.snapshot.round30?.forbiddenClaims,'explicit evidence boundary');
add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,signatures:sig,lowerCount:lower,footCount:foot,plainCount:plain,overlap29,componentStats,minCentroidSep:minSep,aspectRotation:{samples:angles.length,meanDeg:angleMean,maxDeg:angleMax,maxAt:angleAt,signedPos,signedNeg},farUpstreamMax,nearMax,receiverMax,outsideMax,oldForward,newForward,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),permissionMaxChange:permMaxChange}};
fs.writeFileSync(new URL('./r045_round30_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
