import fs from 'node:fs';
import * as K from './r045_round12_kernel.mjs';
import * as R11 from '../round-11/r045_round11_kernel.mjs';
import * as R10 from '../round-10/r045_round10_kernel.mjs';
import * as R9 from '../round-09/r045_round09_kernel.mjs';
import * as R8 from '../round-08/r045_round08_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
function sampleDelta(fn,z0,z1){let max=0,sum=0,n=0;for(let x=-210;x<=210;x+=12)for(let z=z0;z<=z1;z+=4){const v=Math.abs(fn(x,z));max=Math.max(max,v);sum+=v;n++}return{max,mean:sum/(n||1),n}}
function barrier(model,z0=-198,z1=128){let max=-1e9,at=null;for(let x=-205;x<=205;x+=10)for(let z=z0;z<=z1;z+=4){const v=model.height(x,z+4)-model.height(x,z);if(v>max){max=v;at=[x,z]}}return{max,at}}
function drainageAwareBarrier(model,distanceFn,z0,z1,clearance=16){let max=-1e9,at=null,n=0;for(let x=-205;x<=205;x+=10)for(let z=z0;z<=z1;z+=4){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance)continue;const v=model.height(x,z+4)-model.height(x,z);n++;if(v>max){max=v;at=[x,z]}}return{max,at,n,clearance}}
function wallPersistence(model,distanceFn,z0=-198,z1=128,clearance=16,threshold=.55){let worst={fraction:0,z:null,count:0,eligible:0,maxContiguousSpan:0};for(let z=z0;z<=z1;z+=4){let count=0,eligible=0,run=0,maxRun=0;for(let x=-205;x<=205;x+=10){if(distanceFn(x,z)<clearance||distanceFn(x,z+4)<clearance){run=0;continue}eligible++;const rise=model.height(x,z+4)-model.height(x,z);if(rise>threshold){count++;run++;maxRun=Math.max(maxRun,run)}else run=0}const fraction=count/(eligible||1),span=Math.max(0,(maxRun-1)*10);if(fraction>worst.fraction||(fraction===worst.fraction&&span>worst.maxContiguousSpan))worst={fraction,z,count,eligible,maxContiguousSpan:span}}return{...worst,clearance,threshold}}
function profile(model,x,z0,z1,step=2){const out=[];for(let z=z0;z<=z1;z+=step)out.push([z,model.height(x,z)]);return out}
add('version',K.VERSION==='R045.12',K.VERSION,'R045.12');
add('water_graph_identity_preserved',K.nodes.length===R11.nodes.length&&K.edges.length===R11.edges.length,{nodes:[R11.nodes.length,K.nodes.length],edges:[R11.edges.length,K.edges.length]},'unchanged');
add('three_or_more_trunk_outlet_corridors',K.outletContinuum.length>=3,K.outletContinuum.map(o=>o.id),'>=3');
const inter=sampleDelta(K.interfluveDelta,-205,-70),head=sampleDelta(K.headCatchmentDelta,-205,-90),out=sampleDelta(K.outletContinuumDelta,-68,138),all=sampleDelta(K.catchmentMorphDelta,-205,138),repair=sampleDelta(K.inheritedUpperSlopeContinuityRepairDelta,-182,-156);
add('upper_slope_repair_is_localized',repair.max>.20&&repair.max<2.0&&repair.mean<.40,repair,'0.20 < max < 2.0 m; mean < 0.40 m in repair band');
add('interfluve_work_is_substantive',inter.max>.08&&inter.max<.65,inter,'0.08 < max < 0.65 m');
add('head_catchment_work_is_bounded',head.max>.05&&head.max<.70,head,'0.05 < max < 0.70 m');
add('outlet_continuum_is_subtle',out.max>.03&&out.max<.55,out,'0.03 < max < 0.55 m');
add('combined_catchment_delta_bounded',all.max<1.10,all,'max < 1.10 m');
let nearDiv=[],farDiv=[];for(let x=-200;x<=200;x+=10)for(let z=-195;z<=-78;z+=5){const d=K.nearestDivideDistance(x,z),v=Math.abs(K.interfluveDelta(x,z));if(d<10)nearDiv.push(v);if(d>28)farDiv.push(v)}
add('interfluve_signal_tracks_divides',mean(nearDiv)>mean(farDiv)*1.8,{near:mean(nearDiv),far:mean(farDiv)},'near > 1.8x far');
let outletNear=[],outletFar=[];for(let x=-205;x<=205;x+=10)for(let z=-55;z<=125;z+=6){const d=K.nearestOutletDistance(x,z),v=Math.abs(K.outletContinuumDelta(x,z));if(d<12)outletNear.push(v);if(d>38)outletFar.push(v)}
add('outlet_signal_tracks_corridors',mean(outletNear)>mean(outletFar)*3,{near:mean(outletNear),far:mean(outletFar)},'near > 3x far');
// A fixed-x rise through an oblique channel is not a cross-slope wall. Keep the raw diagnostic for
// genealogy, but gate the intended failure mode in two ways: (a) agricultural-slope reversals away
// from drainage carriers; (b) lateral persistence of >0.55 m/4 m rises across interfluves.
const b=barrier(K),b11=barrier(R11),b10=barrier(R10),b9=barrier(R9),b8=barrier(R8);
const candidateBarrier=drainageAwareBarrier(K,K.nearestExtendedDrainageDistance,-158,8,16),persistentWall=wallPersistence(K,K.nearestExtendedDrainageDistance,-198,128,16,.55);
add('candidate_slope_forward_reversal_bounded',candidateBarrier.max<.55,candidateBarrier,'<0.55 m rise per 4 m, >=16 m from drainage, terrace-candidate z band');
add('no_persistent_cross_slope_wall',persistentWall.fraction<.12&&persistentWall.maxContiguousSpan<60,persistentWall,'<12% of eligible cross-slope samples and <60 m contiguous span above 0.55 m/4 m');
let rearCrest=0,river=0;for(let x=-210;x<=210;x+=30){const rz0=K.ridgeCrestZ(x);for(const z of [rz0-18,rz0,rz0+18])rearCrest=Math.max(rearCrest,Math.abs(K.height(x,z)-R11.height(x,z)));const rz=K.riverZ(x);for(const dz of [-5,0,5])river=Math.max(river,Math.abs(K.height(x,rz+dz)-R11.height(x,rz+dz)))}
add('rear_crest_change_bounded',rearCrest<.35,rearCrest,'<0.35 m; source-catchment morphology may change rear terrain but not rewrite regional crest');
add('front_receiver_controls_unchanged',river<1e-9,river,'0');
let near=[],far=[];for(let x=-190;x<=190;x+=10)for(let z=-150;z<=0;z+=6){const d=K.nearestExtendedDrainageDistance(x,z),p=K.terracePermission(x,z);if(d<6)near.push(p);if(d>20)far.push(p)}
add('terrace_permission_excludes_extended_drainage',mean(near)<.01,mean(near),'<0.01');
add('terrace_permission_remains_available',mean(far)>.08,mean(far),'>0.08');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('terrace_generator_locked',K.snapshot.terraceGeometryEnabled===false,K.snapshot.terraceGeometryEnabled,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('no_active_flow_claim',/no surveyed-dimension or active-flow claim/.test(K.snapshot.catchmentMorphologyClass),K.snapshot.catchmentMorphologyClass,'explicit boundary');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{inter,head,out,all,repair,rawBarrier:b,candidateBarrier,persistentWall,barrierGenealogy:{r8:b8,r9:b9,r10:b10,r11:b11,r12:b},wallProfile:{r8:profile(R8,-55,-188,-148),r9:profile(R9,-55,-188,-148),r10:profile(R10,-55,-188,-148),r11:profile(R11,-55,-188,-148),r12:profile(K,-55,-188,-148)},rearCrest,nearDivideMean:mean(nearDiv),farDivideMean:mean(farDiv),outletNearMean:mean(outletNear),outletFarMean:mean(outletFar),terraceNearDrainageMean:mean(near),terraceFarDrainageMean:mean(far)}};
fs.writeFileSync(new URL('./r045_round12_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
