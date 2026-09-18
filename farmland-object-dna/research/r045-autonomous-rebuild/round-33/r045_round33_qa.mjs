import fs from 'node:fs';
import * as K from './r045_round33_kernel.mjs';
import * as R32 from '../round-32/r045_round32_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
add('version',K.VERSION==='R045.33',K.VERSION,'R045.33');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R32.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R32.edges),{nodes:[R32.nodes.length,K.nodes.length],edges:[R32.edges.length,K.edges.length]},'exact inherited planimetric graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R32.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R32.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

let dmax=0,dsum=0,dn=0,pos=0,neg=0,maxStep=0,maxStepAt=null,active=0,core=0,oldActive=0,oldCore=0,changeFrom32=0;
let activeRows=0,rowCounts=[],rowLongestRuns=[],rowSpans=[],groupCounts=[0,0,0],overlap01=0,overlap12=0;
let shoulderNew=0,shoulderOld=0,hardCoreActive=0,hardCoreMaxDelta=0;
for(let z=-132;z<=10;z+=4){
  const xs=[];
  for(let x=-220;x<=120;x+=4){
    const st=K.terraceStateAt(x,z),old=R32.terraceStateAt(x,z),a=Math.abs(st.delta);dmax=Math.max(dmax,a);dsum+=a;dn++;if(st.delta>0)pos+=st.delta;else neg+=-st.delta;
    changeFrom32=Math.max(changeFrom32,Math.abs(K.height(x,z)-R32.height(x,z)));
    if(st.mask>.12){active++;xs.push(x);groupCounts[st.groupIndex]++}
    if(st.mask>.60)core++;
    if(old.mask>.12)oldActive++;if(old.mask>.60)oldCore++;
    const dd=R30.nearestExtendedDrainageDistance(x,z);
    if(dd>12&&dd<30){if(st.mask>.12)shoulderNew++;if(old.mask>.12)shoulderOld++}
    if(dd<=12){if(st.mask>.01)hardCoreActive++;hardCoreMaxDelta=Math.max(hardCoreMaxDelta,a)}
    const w=K.terraceGroupWeights(x,z);if(w[0]>.24&&w[1]>.24)overlap01++;if(w[1]>.24&&w[2]>.24)overlap12++;
    const s=Math.abs(K.terraceDelta(x,z+4)-st.delta);if(s>maxStep){maxStep=s;maxStepAt=[x,z]}
  }
  if(xs.length){
    activeRows++;rowCounts.push(xs.length);rowSpans.push(xs[xs.length-1]-xs[0]);
    let run=1,best=1;for(let i=1;i<xs.length;i++){if(xs[i]-xs[i-1]<=8){run++;best=Math.max(best,run)}else run=1}rowLongestRuns.push(best*4);
  }
}
const longestContinuousRunM=Math.max(...rowLongestRuns),maxFamilySpanM=Math.max(...rowSpans);
const geom={deltaMax:dmax,deltaMean:dsum/(dn||1),pos,neg,maxStep,maxStepAt,active,core,oldActive,oldCore,changeFrom32,activeRows,groupCounts,overlap01,overlap12,rowCountMedian:median(rowCounts),longestContinuousRunM,maxFamilySpanM,shoulderNew,shoulderOld,shoulderRatio:shoulderNew/(shoulderOld||1),hardCoreActive,hardCoreMaxDelta};
add('terrace_geometry_remains_substantive_but_bounded',dmax>.20&&dmax<.95,geom,'.20 m < max terrace delta < .95 m');
add('r33_is_a_real_but_bounded_change_from_r32',changeFrom32>.025&&changeFrom32<.65,changeFrom32,'.025 m < sampled max R33-R32 surface change < .65 m');
add('terrace_geometry_has_both_cut_and_fill',pos>8&&neg>8,{pos,neg},'both signed responses >8 aggregate sample-m');
add('terrace_support_does_not_shrink',active>=oldActive*.98,{active,oldActive,ratio:active/(oldActive||1)},'R33 active support >=0.98x R32');
add('terrace_core_does_not_collapse',core>=oldCore*.92,{core,oldCore,ratio:core/(oldCore||1)},'R33 core support >=0.92x R32');
add('drainage_shoulders_are_actually_stitched',shoulderNew>shoulderOld*1.20,{shoulderNew,shoulderOld,ratio:shoulderNew/(shoulderOld||1)},'active samples 12-30 m from drainage >1.20x R32');
add('hard_drainage_core_stays_empty',hardCoreActive===0&&hardCoreMaxDelta<1e-9,{hardCoreActive,hardCoreMaxDelta},'zero terrace support/delta at <=12 m drainage distance');
add('terrace_families_still_span_the_slope',activeRows>=28&&maxFamilySpanM>120,{activeRows,maxFamilySpanM,rowCountMedian:median(rowCounts)},'>=28 active rows and >120 m family span');
add('between_drain_segments_remain_substantial',longestContinuousRunM>48,{longestContinuousRunM},'>48 m continuous terrace segment between hard drainage gaps');
add('all_three_nested_groups_remain_material',groupCounts.every(n=>n>45),groupCounts,'each dominant terrace group has >45 active samples');
add('adjacent_groups_still_overlap',overlap01>12&&overlap12>12,{overlap01,overlap12},'each adjacent pair has >12 support-overlap samples');
add('terrace_increment_is_not_a_cliff',maxStep<1.05,{maxStep,maxStepAt},'<1.05 m change in added terrace delta per 4 m z');

// R32 chooses one dominant family when assigning terrace phase/step. R33 blends those frames continuously.
// Verify the new blended phase field is smooth at locations where two family supports compete.
const seamGrad=[];let seamN=0;
for(let x=-210;x<=110;x+=3)for(let z=-128;z<=6;z+=3){
  const w=R32.terraceGroupWeights(x,z).slice().sort((a,b)=>b-a);
  if(w[0]<.22||w[1]<.16||w[0]-w[1]>.16||R30.nearestExtendedDrainageDistance(x,z)<24)continue;
  const p0=K.terraceFrameAt(x-1,z).phase,p1=K.terraceFrameAt(x+1,z).phase;
  seamGrad.push(Math.abs(p1-p0)/2);seamN++;
}
const seam={n:seamN,meanPhaseGradient:mean(seamGrad),medianPhaseGradient:median(seamGrad),maxPhaseGradient:seamGrad.length?Math.max(...seamGrad):0};
add('blended_family_phase_has_samples',seamN>30,seam,'>30 family-overlap seam samples');
add('blended_family_phase_is_smooth',seam.maxPhaseGradient<.035&&seam.medianPhaseGradient<.018,seam,'max phase gradient <.035 m/m and median <.018 m/m');

const benchRat=[],riserRat=[],benchSlope=[],riserSlope=[];let benchN=0,riserN=0;
for(let x=-210;x<=110;x+=5)for(let z=-128;z<=4;z+=4){
  const st=K.terraceStateAt(x,z);if(st.mask<.68||R30.nearestExtendedDrainageDistance(x,z)<18)continue;
  const bg=R30.gradient(x,z).mag,ng=K.gradient(x,z).mag;if(bg<.03||bg>.60)continue;
  if(st.frac<.25||st.frac>.75){benchN++;benchRat.push(ng/bg);benchSlope.push(ng)}
  if(st.frac>.46&&st.frac<.54){riserN++;riserRat.push(ng/bg);riserSlope.push(ng)}
}
const terrMetrics={benchN,riserN,benchRatioMean:mean(benchRat),benchRatioMedian:median(benchRat),riserRatioMean:mean(riserRat),riserRatioMedian:median(riserRat),benchSlopeMean:mean(benchSlope),benchSlopeMedian:median(benchSlope),riserSlopeMean:mean(riserSlope),riserSlopeMedian:median(riserSlope)};
add('bench_and_riser_samples_exist',benchN>45&&riserN>12,terrMetrics,'>45 bench and >12 riser core samples');
add('benches_are_flatter_than_r30_substrate',median(benchRat)<.82,terrMetrics,'median bench/base gradient ratio <.82');
add('risers_are_steeper_than_benches',median(riserSlope)>median(benchSlope)*1.35,{benchMedianSlope:median(benchSlope),riserMedianSlope:median(riserSlope)},'median riser slope >1.35x median bench slope');
add('risers_steepen_relative_to_r30',median(riserRat)>1.18,terrMetrics,'median riser/base gradient ratio >1.18');

let farUp=0,nearDrain=0,receiver=0,outside=0;
for(let x=-230;x<=230;x+=8){
  for(const z of [-300,-220,-170,-145,25,55,90,130,170])outside=Math.max(outside,Math.abs(K.height(x,z)-R30.height(x,z)));
  for(const z of [-300,-220,-170,-145])farUp=Math.max(farUp,Math.abs(K.height(x,z)-R30.height(x,z)));
  for(let z=-128;z<=6;z+=6)if(R30.nearestExtendedDrainageDistance(x,z)<=12)nearDrain=Math.max(nearDrain,Math.abs(K.height(x,z)-R30.height(x,z)));
  const rz=R30.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R30.height(x,rz+dz)));
}
add('far_upstream_work_untouched',farUp<1e-9,farUp,'zero sampled R33 change far upstream');
add('support_is_localized_to_agricultural_slope',outside<1e-9,outside,'zero sampled change outside terrace support');
add('drainage_axis_cores_are_protected',nearDrain<1e-9,nearDrain,'zero sampled change within 12 m inherited drainage axes');
add('foreground_receiver_is_unchanged',receiver<1e-9,receiver,'zero sampled change around receiver river');
function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=8)for(let z=-132;z<=12;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R32),newForward=worstForward(K);
add('stitched_terraces_do_not_create_pathological_wall',newForward.maxRise<=oldForward.maxRise+1.05,{old:oldForward,new:newForward},'new worst 4 m forward rise <= R32 +1.05 m');

add('terrace_geometry_enabled_only_as_pilot',K.snapshot.terraceGeometryEnabled===true&&K.snapshot.terracePilotPreviewEnabled===true,{terraceGeometryEnabled:K.snapshot.terraceGeometryEnabled,terracePilotPreviewEnabled:K.snapshot.terracePilotPreviewEnabled},'synthetic terrace morphology ON');
add('global_visual_acceptance_remains_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
add('logic_errors_explicitly_corrected',K.snapshot.round33?.logicCorrection?.includes('do not prove')&&K.snapshot.round33?.logicCorrection?.includes('wide blank setback'),K.snapshot.round33?.logicCorrection,'reject low-riser and wide-setback shortcuts');
add('real_world_constraint_is_explicit',K.snapshot.round33?.constraint?.includes('cannot be reconstructed quickly')&&K.snapshot.round33?.constraint?.includes('bankfull width'),K.snapshot.round33?.constraint,'state missing real-world evidence that blocks fast realization');
add('xiaoma_truth_boundary_retained',K.snapshot.round33?.xiaomaBoundary?.includes('unknown')&&K.snapshot.round33?.xiaomaBoundary?.includes('no water head'),K.snapshot.round33?.xiaomaBoundary,'no necessary-condition -> sufficient-condition error');
add('mrrolord_ordering_only',K.snapshot.round33?.mrRolordUse?.includes('drainage hierarchy')&&K.snapshot.round33?.mrRolordUse?.includes('does not copy'),K.snapshot.round33?.mrRolordUse,'process ordering only');
add('user_reference_reopened_without_metric_inference',K.snapshot.round33?.referenceUse?.includes('reopened this round')&&K.snapshot.round33?.referenceUse?.includes('no metric terrace width'),K.snapshot.round33?.referenceUse,'morphology only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round33?.forbiddenClaims)&&K.snapshot.round33.forbiddenClaims.length>=15,K.snapshot.round33?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{geometry:geom,seam,terraceMorphology:terrMetrics,farUp,nearDrain,receiver,outside,oldForward,newForward}};
fs.writeFileSync(new URL('./r045_round33_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
