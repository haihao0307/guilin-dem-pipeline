import fs from 'node:fs';
import * as K from './r045_round14_kernel.mjs';
import * as R13 from '../round-13/r045_round13_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const stdev=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
function sampleDelta(z0,z1){let max=0,sum=0,n=0,at=null;for(let x=-210;x<=210;x+=6)for(let z=z0;z<=z1;z+=3){const v=Math.abs(K.basinShoulderDelta(x,z));if(v>max){max=v;at=[x,z]}sum+=v;n++}return{max,mean:sum/(n||1),n,at}}
function drainageAwareBarrier(model,distanceFn,z0,z1,clearance=16){let max=-1e9,at=null,n=0;for(let x=-205;x<=205;x+=10)for(let z=z0;z<=z1;z+=4){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;const v=model.height(x,z+4)-model.height(x,z);n++;if(v>max){max=v;at=[x,z]}}return{max,at,n,clearance}}
function wallPersistence(model,distanceFn,z0=-198,z1=128,clearance=16,threshold=.55){let worst={fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0};for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10);if(fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst={fraction,z,count,eligible,maxContiguousSpan:span}}return{...worst,clearance,threshold}}
function wallAt(model,distanceFn,z,clearance=16,threshold=.55){let count=0,eligible=0,max=-1e9;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;eligible++;const rise=model.height(x,z+4)-model.height(x,z);max=Math.max(max,rise);if(rise>threshold)count++}return{z,count,eligible,fraction:count/(eligible||1),max,clearance,threshold}}
function xAtZ(points,z){for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];if((a[1]-z)*(b[1]-z)<=0&&Math.abs(b[1]-a[1])>1e-9){const t=(z-a[1])/(b[1]-a[1]);return a[0]+(b[0]-a[0])*t}}return null}

add('version',K.VERSION==='R045.14',K.VERSION,'R045.14');
add('water_graph_identity_preserved',K.nodes.length===R13.nodes.length&&K.edges.length===R13.edges.length,{nodes:[R13.nodes.length,K.nodes.length],edges:[R13.edges.length,K.edges.length]},'unchanged');
add('terrain_carrier_inventory_preserved',K.terrainChannels.length===R13.terrainChannels.length&&K.outletContinuum.length===R13.outletContinuum.length,{terrainChannels:[R13.terrainChannels.length,K.terrainChannels.length],outlets:[R13.outletContinuum.length,K.outletContinuum.length]},'unchanged');
add('three_basin_profiles_present',K.basinProfiles.length===3&&K.basinProfiles.map(x=>x.id).join('')==='ABC',K.basinProfiles.map(x=>x.id),'A/B/C');

const delta=sampleDelta(-205,-23);
add('basin_relief_is_substantive',delta.max>.32&&delta.max<=1.21,delta,'0.32 < max <= 1.21 m');
add('basin_relief_mean_is_bounded',delta.mean<.28,delta.mean,'<0.28 m absolute mean');
let near=[],shoulder=[],far=[];for(let x=-205;x<=205;x+=8)for(let z=-198;z<=-30;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),v=Math.abs(K.basinShoulderDelta(x,z));if(d<9)near.push(v);else if(d>=22&&d<=72)shoulder.push(v);else if(d>92)far.push(v)}
add('drainage_axes_are_protected',Math.max(...near,0)<1e-9,{max:Math.max(...near,0),mean:mean(near)},'zero change <9 m from drainage');
add('broad_shoulders_receive_response',mean(shoulder)>.025&&mean(shoulder)>mean(near)+.025,{near:mean(near),shoulder:mean(shoulder),far:mean(far)},'22..72 m shoulder mean >0.025 m and > near+0.025');
add('response_does_not_become_global_noise',mean(far)<mean(shoulder)*.80+.015,{shoulder:mean(shoulder),far:mean(far)},'far response materially below shoulder response');

const asym=[];for(const b of K.basinProfiles){const src=K.naturalStreams.find(s=>s.id===b.id),z=-112,x=xAtZ(src.p,z);const l=K.basinShoulderDelta(x-b.offset,z),r=K.basinShoulderDelta(x+b.offset,z);asym.push({id:b.id,x,z,left:l,right:r,difference:Math.abs(l-r)})}
add('basin_shoulders_are_asymmetric',asym.filter(a=>a.difference>.07).length>=2,asym,'at least two basins left/right shoulder difference >0.07 m');
add('basin_signatures_are_not_clones',stdev(asym.map(a=>a.difference))>.025,{differences:asym.map(a=>a.difference),stdev:stdev(asym.map(a=>a.difference))},'>0.025 m stdev');
let maxStep=0,stepAt=null;for(let x=-205;x<=205;x+=10)for(let z=-196;z<=-32;z+=4){if(K.nearestExtendedDrainageDistance(x,z)<16)continue;const v=Math.abs(K.basinShoulderDelta(x,z+4)-K.basinShoulderDelta(x,z));if(v>maxStep){maxStep=v;stepAt=[x,z]}}
add('basin_field_changes_slowly_downslope',maxStep<.22,{maxStep,at:stepAt},'<0.22 m delta change per 4 m');
let outside=0;for(let x=-205;x<=205;x+=20)for(const z of [-300,-240,-212,-208,-20,-16,20,100,170])outside=Math.max(outside,Math.abs(K.height(x,z)-R13.height(x,z)));
add('outside_basin_band_unchanged',outside<1e-9,outside,'0');

const oldWall=wallPersistence(R13,R13.nearestExtendedDrainageDistance),newWall=wallPersistence(K,K.nearestExtendedDrainageDistance);
add('r13_wall_fix_not_regressed',newWall.fraction<.12&&newWall.maxContiguousSpan<60,{r13:oldWall,r14:newWall},'R14 fraction <12% and contiguous span <60 m');
const row13=wallAt(R13,R13.nearestExtendedDrainageDistance,-174),row14=wallAt(K,K.nearestExtendedDrainageDistance,-174);
add('known_z174_row_remains_repaired',row14.fraction<.12&&row14.max<.55,{r13:row13,r14:row14},'fraction <12%; max rise <0.55 m/4m');
const candidate=drainageAwareBarrier(K,K.nearestExtendedDrainageDistance,-158,8,16);
add('candidate_slope_forward_reversal_bounded',candidate.max<.55,candidate,'<0.55 m rise per 4 m, >=16 m from drainage');

let rear=0,river=0;for(let x=-210;x<=210;x+=30){const rz0=K.ridgeCrestZ(x);for(const z of [rz0-18,rz0,rz0+18])rear=Math.max(rear,Math.abs(K.height(x,z)-R13.height(x,z)));const rz=K.riverZ(x);for(const dz of [-5,0,5])river=Math.max(river,Math.abs(K.height(x,rz+dz)-R13.height(x,rz+dz)))}
add('rear_crest_controls_unchanged',rear<1e-9,rear,'0');
add('front_receiver_controls_unchanged',river<1e-9,river,'0');
let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.06,mean(tFar),'>0.06; geometry still locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('survey_claims_forbidden',Array.isArray(K.snapshot.round14?.forbiddenClaims)&&K.snapshot.round14.forbiddenClaims.length>=5,K.snapshot.round14?.forbiddenClaims,'explicit synthetic/evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,response:{near:mean(near),shoulder:mean(shoulder),far:mean(far)},asymmetry:asym,maxLongitudinalDeltaStep:{value:maxStep,at:stepAt},oldWall,newWall,row174:{r13:row13,r14:row14},candidate,rear,river,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar)}};
fs.writeFileSync(new URL('./r045_round14_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
