import fs from 'node:fs';
import * as K from './r045_round13_kernel.mjs';
import * as R12 from '../round-12/r045_round12_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
function sampleDelta(fn,z0,z1){let max=0,sum=0,n=0,at=null;for(let x=-210;x<=210;x+=10)for(let z=z0;z<=z1;z+=2){const v=Math.abs(fn(x,z));if(v>max){max=v;at=[x,z]}sum+=v;n++}return{max,mean:sum/(n||1),n,at}}
function drainageAwareBarrier(model,distanceFn,z0,z1,clearance=16){let max=-1e9,at=null,n=0;for(let x=-205;x<=205;x+=10)for(let z=z0;z<=z1;z+=4){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;const v=model.height(x,z+4)-model.height(x,z);n++;if(v>max){max=v;at=[x,z]}}return{max,at,n,clearance}}
function wallPersistence(model,distanceFn,z0=-198,z1=128,clearance=16,threshold=.55){let worst={fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0};for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10);if(fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst={fraction,z,count,eligible,maxContiguousSpan:span}}return{...worst,clearance,threshold}}
function wallAt(model,distanceFn,z,clearance=16,threshold=.55){let count=0,eligible=0,max=-1e9;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;eligible++;const rise=model.height(x,z+4)-model.height(x,z);max=Math.max(max,rise);if(rise>threshold)count++}return{z,count,eligible,fraction:count/(eligible||1),max,clearance,threshold}}
function profile(model,x,z0,z1,step=2){const out=[];for(let z=z0;z<=z1;z+=step)out.push([z,model.height(x,z)]);return out}

add('version',K.VERSION==='R045.13',K.VERSION,'R045.13');
add('water_graph_identity_preserved',K.nodes.length===R12.nodes.length&&K.edges.length===R12.edges.length,{nodes:[R12.nodes.length,K.nodes.length],edges:[R12.edges.length,K.edges.length]},'unchanged');
add('terrain_carrier_inventory_preserved',K.terrainChannels.length===R12.terrainChannels.length&&K.outletContinuum.length===R12.outletContinuum.length,{terrainChannels:[R12.terrainChannels.length,K.terrainChannels.length],outlets:[R12.outletContinuum.length,K.outletContinuum.length]},'unchanged');

const delta=sampleDelta(K.interfluveContinuityDelta,K.continuityBand.z0,K.continuityBand.z1);
add('continuity_repair_is_substantive',delta.max>.70&&delta.max<=3.41,delta,'0.70 < max <= 3.41 m');
add('continuity_repair_mean_is_bounded',delta.mean<1.25,delta.mean,'<1.25 m over repair band');
let near=[],mid=[],far=[];for(let x=-205;x<=205;x+=10)for(let z=-188;z<=-148;z+=4){const d=K.nearestExtendedDrainageDistance(x,z),v=Math.abs(K.interfluveContinuityDelta(x,z));if(d<10)near.push(v);else if(d>=18&&d<28)mid.push(v);else if(d>=34)far.push(v)}
add('drainage_axes_are_protected',Math.max(...near,0)<1e-9,{max:Math.max(...near,0),mean:mean(near)},'zero change <10 m from drainage');
add('repair_acts_on_interfluves',mean(far)>mean(near)+.08&&mean(mid)>mean(near)+.02,{near:mean(near),mid:mean(mid),far:mean(far)},'far > near+0.08 m and transition > near+0.02 m');
let outside=0;for(let x=-205;x<=205;x+=20)for(const z of [-260,-220,-198,-194,-142,-120,-40,40,120,160])outside=Math.max(outside,Math.abs(K.height(x,z)-R12.height(x,z)));
add('outside_repair_band_unchanged',outside<1e-9,outside,'0');

const oldWall=wallPersistence(R12,R12.nearestExtendedDrainageDistance),newWall=wallPersistence(K,K.nearestExtendedDrainageDistance);
add('persistent_cross_slope_wall_removed',newWall.fraction<.12&&newWall.maxContiguousSpan<60,{r12:oldWall,r13:newWall},'R13 fraction <12% and contiguous span <60 m');
add('wall_fraction_materially_improves',newWall.fraction<=oldWall.fraction*.40,{r12:oldWall.fraction,r13:newWall.fraction},'R13 <=40% of R12 worst fraction');
const row12=wallAt(R12,R12.nearestExtendedDrainageDistance,-174),row13=wallAt(K,K.nearestExtendedDrainageDistance,-174);
add('known_z174_wall_repaired',row13.fraction<.12&&row13.max<.55,{r12:row12,r13:row13},'fraction <12%; max rise <0.55 m/4m');
const candidate=drainageAwareBarrier(K,K.nearestExtendedDrainageDistance,-158,8,16);
add('candidate_slope_forward_reversal_bounded',candidate.max<.55,candidate,'<0.55 m rise per 4 m, >=16 m from drainage');

let rear=0,river=0;for(let x=-210;x<=210;x+=30){const rz0=K.ridgeCrestZ(x);for(const z of [rz0-18,rz0,rz0+18])rear=Math.max(rear,Math.abs(K.height(x,z)-R12.height(x,z)));const rz=K.riverZ(x);for(const dz of [-5,0,5])river=Math.max(river,Math.abs(K.height(x,rz+dz)-R12.height(x,rz+dz)))}
add('rear_crest_controls_unchanged',rear<1e-9,rear,'0');
add('front_receiver_controls_unchanged',river<1e-9,river,'0');
let tNear=[],tFar=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)tNear.push(p);if(d>20)tFar.push(p)}
add('terrace_permission_excludes_drainage',mean(tNear)<.01,mean(tNear),'<0.01');
add('future_terrace_candidates_remain',mean(tFar)>.08,mean(tFar),'>0.08; geometry still locked');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('survey_claims_forbidden',Array.isArray(K.snapshot.round13?.forbiddenClaims)&&K.snapshot.round13.forbiddenClaims.length>=5,K.snapshot.round13?.forbiddenClaims,'explicit synthetic/evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{delta,interfluveResponse:{near:mean(near),mid:mean(mid),far:mean(far)},oldWall,newWall,row174:{r12:row12,r13:row13},candidate,rear,river,terraceNearDrainageMean:mean(tNear),terraceFarDrainageMean:mean(tFar),profiles:{r12:profile(R12,-55,-196,-140),r13:profile(K,-55,-196,-140)}}};
fs.writeFileSync(new URL('./r045_round13_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
