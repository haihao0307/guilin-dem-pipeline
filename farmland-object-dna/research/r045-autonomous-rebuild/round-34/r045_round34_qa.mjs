import fs from 'node:fs';
import * as K from './r045_round34_kernel.mjs';
import * as R33 from '../round-33/r045_round33_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
add('version',K.VERSION==='R045.34',K.VERSION,'R045.34');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R33.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R33.edges),{nodes:[R33.nodes.length,K.nodes.length],edges:[R33.edges.length,K.edges.length]},'exact inherited planimetric graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R33.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R33.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

let dmax=0,dsum=0,dn=0,pos=0,neg=0,maxStep=0,maxStepAt=null,active=0,core=0,oldActive=0,oldCore=0,changeFrom33=0;
let groupCounts=[0,0,0],hardCoreActive=0,hardCoreMaxDelta=0,bridgeLift=0,unionLift=0,contourLift=0;
let rowRunsNew=0,rowRunsOld=0,rowLongestNew=[],rowLongestOld=[],activeRowsNew=0,activeRowsOld=0,softGapNew=0,softGapOld=0;
function rowStats(M,z){
  const cells=[];for(let x=-220;x<=120;x+=4){const st=M.terraceStateAt(x,z),dd=R30.nearestExtendedDrainageDistance(x,z),riverGap=Math.abs(z-R30.riverZ(x));cells.push({x,a:st.mask>.12,dd,eligible:R33.terraceGroupEnvelope(x,z)>.10&&dd>12&&riverGap>R30.riverW(x)+18})}
  let runs=0,best=0,cur=0;for(const c of cells){if(c.a){if(cur===0)runs++;cur++;best=Math.max(best,cur)}else cur=0}
  let gaps=0;let i=1;while(i<cells.length-1){if(cells[i].a||!cells[i].eligible){i++;continue}const s=i;while(i<cells.length&&!cells[i].a&&cells[i].eligible)i++;const e=i-1,len=e-s+1;if(s>0&&i<cells.length&&cells[s-1].a&&cells[i].a&&len<=6)gaps+=len}
  return{runs,longest:best*4,gaps,active:cells.some(c=>c.a)};
}
for(let z=-132;z<=10;z+=4){
  const rn=rowStats(K,z),ro=rowStats(R33,z);rowRunsNew+=rn.runs;rowRunsOld+=ro.runs;softGapNew+=rn.gaps;softGapOld+=ro.gaps;if(rn.active){activeRowsNew++;rowLongestNew.push(rn.longest)}if(ro.active){activeRowsOld++;rowLongestOld.push(ro.longest)}
  for(let x=-220;x<=120;x+=4){
    const st=K.terraceStateAt(x,z),old=R33.terraceStateAt(x,z),a=Math.abs(st.delta);dmax=Math.max(dmax,a);dsum+=a;dn++;if(st.delta>0)pos+=st.delta;else neg+=-st.delta;
    changeFrom33=Math.max(changeFrom33,Math.abs(K.height(x,z)-R33.height(x,z)));
    if(st.mask>.12){active++;groupCounts[st.groupIndex]++}if(st.mask>.60)core++;if(old.mask>.12)oldActive++;if(old.mask>.60)oldCore++;
    const dd=R30.nearestExtendedDrainageDistance(x,z);if(dd<=12){if(st.mask>.01)hardCoreActive++;hardCoreMaxDelta=Math.max(hardCoreMaxDelta,a)}
    const u=K.terraceGroupUnionEnvelope(x,z)-R33.terraceGroupEnvelope(x,z);if(u>.025)unionLift++;
    const cp=K.contourBridgePermission(x,z)-R33.permissionBridge(x,z);if(cp>.025)contourLift++;
    if(st.mask-old.mask>.05&&dd>12)bridgeLift++;
    const s=Math.abs(K.terraceDelta(x,z+4)-st.delta);if(s>maxStep){maxStep=s;maxStepAt=[x,z]}
  }
}
const geom={deltaMax:dmax,deltaMean:dsum/(dn||1),pos,neg,maxStep,maxStepAt,active,core,oldActive,oldCore,changeFrom33,groupCounts,hardCoreActive,hardCoreMaxDelta,bridgeLift,unionLift,contourLift,rowRunsNew,rowRunsOld,softGapNew,softGapOld,activeRowsNew,activeRowsOld,medianLongestNew:median(rowLongestNew),medianLongestOld:median(rowLongestOld),maxLongestNew:Math.max(...rowLongestNew),maxLongestOld:Math.max(...rowLongestOld)};
add('terrace_geometry_remains_substantive_but_bounded',dmax>.20&&dmax<.95,geom,'.20 m < max terrace delta < .95 m');
add('r34_is_a_real_but_bounded_change_from_r33',changeFrom33>.008&&changeFrom33<.60,changeFrom33,'.008 m < sampled max R34-R33 surface change < .60 m');
add('terrace_geometry_has_both_cut_and_fill',pos>8&&neg>8,{pos,neg},'both signed responses >8 aggregate sample-m');
add('terrace_support_does_not_shrink',active>=oldActive*.995,{active,oldActive,ratio:active/(oldActive||1)},'R34 active support >=0.995x R33');
add('terrace_core_does_not_collapse',core>=oldCore*.98,{core,oldCore,ratio:core/(oldCore||1)},'R34 core support >=0.98x R33');
add('contour_tangent_closing_is_material',contourLift>12,{contourLift},'>12 samples with >0.025 contour-permission lift');
add('family_overlap_union_is_material',unionLift>12,{unionLift},'>12 samples with >0.025 overlap-union lift');
add('support_stitching_is_material',bridgeLift>12,{bridgeLift},'>12 samples gain >0.05 mask away from hard drainage core');
add('row_fragmentation_does_not_increase',rowRunsNew<=rowRunsOld,{rowRunsNew,rowRunsOld},'total active row runs <= R33');
add('small_soft_gaps_do_not_increase',softGapNew<=softGapOld,{softGapNew,softGapOld},'small non-drainage interior gap cells <= R33');
add('continuous_ribbons_do_not_shorten',median(rowLongestNew)>=median(rowLongestOld),{medianNew:median(rowLongestNew),medianOld:median(rowLongestOld),maxNew:Math.max(...rowLongestNew),maxOld:Math.max(...rowLongestOld)},'median longest active row run >= R33');
add('active_vertical_extent_is_preserved',activeRowsNew>=activeRowsOld,{activeRowsNew,activeRowsOld},'active row count >= R33');
add('hard_drainage_core_stays_empty',hardCoreActive===0&&hardCoreMaxDelta<1e-9,{hardCoreActive,hardCoreMaxDelta},'zero terrace support/delta at <=12 m drainage distance');
add('all_three_nested_groups_remain_material',groupCounts.every(n=>n>45),groupCounts,'each dominant terrace group has >45 active samples');
add('terrace_increment_is_not_a_cliff',maxStep<1.05,{maxStep,maxStepAt},'<1.05 m change in added terrace delta per 4 m z');

let frameN=0,maxStepDiff=0,maxPhaseDiff=0,maxRawDiff=0;
for(let x=-210;x<=110;x+=7)for(let z=-128;z<=6;z+=5){const n=K.terraceStateAt(x,z),o=R33.terraceStateAt(x,z);frameN++;maxStepDiff=Math.max(maxStepDiff,Math.abs(n.step-o.step));maxPhaseDiff=Math.max(maxPhaseDiff,Math.abs(n.phase-o.phase));maxRawDiff=Math.max(maxRawDiff,Math.abs(n.raw-o.raw))}
const frameIdentity={samples:frameN,maxStepDiff,maxPhaseDiff,maxRawDiff};
add('r33_quantization_frame_is_exactly_preserved',maxStepDiff<1e-12&&maxPhaseDiff<1e-12&&maxRawDiff<1e-12,frameIdentity,'step, phase and raw stair response exactly inherited from R33');

const benchRat=[],riserRat=[],benchSlope=[],riserSlope=[];let benchN=0,riserN=0;
for(let x=-210;x<=110;x+=5)for(let z=-128;z<=4;z+=4){const st=K.terraceStateAt(x,z);if(st.mask<.68||R30.nearestExtendedDrainageDistance(x,z)<18)continue;const bg=R30.gradient(x,z).mag,ng=K.gradient(x,z).mag;if(bg<.03||bg>.60)continue;if(st.frac<.25||st.frac>.75){benchN++;benchRat.push(ng/bg);benchSlope.push(ng)}if(st.frac>.46&&st.frac<.54){riserN++;riserRat.push(ng/bg);riserSlope.push(ng)}}
const terrMetrics={benchN,riserN,benchRatioMean:mean(benchRat),benchRatioMedian:median(benchRat),riserRatioMean:mean(riserRat),riserRatioMedian:median(riserRat),benchSlopeMean:mean(benchSlope),benchSlopeMedian:median(benchSlope),riserSlopeMean:mean(riserSlope),riserSlopeMedian:median(riserSlope)};
add('bench_and_riser_samples_exist',benchN>45&&riserN>12,terrMetrics,'>45 bench and >12 riser core samples');
add('benches_are_flatter_than_r30_substrate',median(benchRat)<.82,terrMetrics,'median bench/base gradient ratio <.82');
add('risers_are_steeper_than_benches',median(riserSlope)>median(benchSlope)*1.35,{benchMedianSlope:median(benchSlope),riserMedianSlope:median(riserSlope)},'median riser slope >1.35x median bench slope');
add('risers_steepen_relative_to_r30',median(riserRat)>1.18,terrMetrics,'median riser/base gradient ratio >1.18');

let farUp=0,nearDrain=0,receiver=0,outside=0;
for(let x=-230;x<=230;x+=8){for(const z of [-300,-220,-170,-145,25,55,90,130,170])outside=Math.max(outside,Math.abs(K.height(x,z)-R30.height(x,z)));for(const z of [-300,-220,-170,-145])farUp=Math.max(farUp,Math.abs(K.height(x,z)-R30.height(x,z)));for(let z=-128;z<=6;z+=6)if(R30.nearestExtendedDrainageDistance(x,z)<=12)nearDrain=Math.max(nearDrain,Math.abs(K.height(x,z)-R30.height(x,z)));const rz=R30.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R30.height(x,rz+dz)))}
add('far_upstream_work_untouched',farUp<1e-9,farUp,'zero sampled R34 change far upstream');
add('support_is_localized_to_agricultural_slope',outside<1e-9,outside,'zero sampled change outside terrace support');
add('drainage_axis_cores_are_protected',nearDrain<1e-9,nearDrain,'zero sampled change within 12 m inherited drainage axes');
add('foreground_receiver_is_unchanged',receiver<1e-9,receiver,'zero sampled change around receiver river');
function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=8)for(let z=-132;z<=12;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R33),newForward=worstForward(K);
add('stitched_terraces_do_not_create_pathological_wall',newForward.maxRise<=oldForward.maxRise+.45,{old:oldForward,new:newForward},'new worst 4 m forward rise <= R33 +0.45 m');

add('terrace_geometry_enabled_only_as_pilot',K.snapshot.terraceGeometryEnabled===true&&K.snapshot.terracePilotPreviewEnabled===true,{terraceGeometryEnabled:K.snapshot.terraceGeometryEnabled,terracePilotPreviewEnabled:K.snapshot.terracePilotPreviewEnabled},'synthetic terrace morphology ON');
add('global_visual_acceptance_remains_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
add('logic_errors_explicitly_corrected',K.snapshot.round34?.logicCorrection?.includes('does not prove')&&K.snapshot.round34?.logicCorrection?.includes('indiscriminate dilation')&&K.snapshot.round34?.logicCorrection?.includes('both sides'),K.snapshot.round34?.logicCorrection,'reject low-riser and indiscriminate-outward-growth shortcuts');
add('real_world_constraint_is_explicit',K.snapshot.round34?.constraint?.includes('cannot be reconstructed quickly')&&K.snapshot.round34?.constraint?.includes('management boundaries'),K.snapshot.round34?.constraint,'state missing real-world evidence that blocks fast realization');
add('xiaoma_truth_boundary_retained',K.snapshot.round34?.xiaomaBoundary?.includes('unknown')&&K.snapshot.round34?.xiaomaBoundary?.includes('not sufficient evidence'),K.snapshot.round34?.xiaomaBoundary,'no geometric-continuity -> hydraulic-truth error');
add('mrrolord_ordering_only',K.snapshot.round34?.mrRolordUse?.includes('drainage hierarchy')&&K.snapshot.round34?.mrRolordUse?.includes('does not copy'),K.snapshot.round34?.mrRolordUse,'process ordering only');
add('user_reference_reopened_without_metric_inference',K.snapshot.round34?.referenceUse?.includes('reopened this round')&&K.snapshot.round34?.referenceUse?.includes('No metric terrace width'),K.snapshot.round34?.referenceUse,'morphology only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round34?.forbiddenClaims)&&K.snapshot.round34.forbiddenClaims.length>=16,K.snapshot.round34?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{geometry:geom,frameIdentity,terraceMorphology:terrMetrics,farUp,nearDrain,receiver,outside,oldForward,newForward}};
fs.writeFileSync(new URL('./r045_round34_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
