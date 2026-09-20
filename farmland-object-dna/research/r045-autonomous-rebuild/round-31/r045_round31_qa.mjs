import fs from 'node:fs';
import * as K from './r045_round31_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
add('version',K.VERSION==='R045.31',K.VERSION,'R045.31');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R30.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R30.edges),{nodes:[R30.nodes.length,K.nodes.length],edges:[R30.edges.length,K.edges.length]},'exact inherited planimetric graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R30.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R30.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carrier arrays');

let dmax=0,dsum=0,dn=0,pos=0,neg=0,maxStep=0,maxStepAt=null,active=0,core=0;
let stepVals=[],phaseVals=[],activeRows=new Map(),runsRows=0;
for(let z=-132;z<=10;z+=4){
  const xs=[];
  for(let x=-220;x<=120;x+=4){
    const st=K.terraceStateAt(x,z),a=Math.abs(st.delta);dmax=Math.max(dmax,a);dsum+=a;dn++;if(st.delta>0)pos+=st.delta;else neg+=-st.delta;
    if(st.mask>.12){active++;stepVals.push(st.step);phaseVals.push(st.phase);xs.push(x)}
    if(st.mask>.60)core++;
    const s=Math.abs(K.terraceDelta(x,z+4)-st.delta);if(s>maxStep){maxStep=s;maxStepAt=[x,z]}
  }
  if(xs.length){activeRows.set(z,{min:Math.min(...xs),max:Math.max(...xs),mean:mean(xs),count:xs.length});let runs=1;for(let i=1;i<xs.length;i++)if(xs[i]-xs[i-1]>6)runs++;if(runs>=2)runsRows++;}
}
const geom={deltaMax:dmax,deltaMean:dsum/(dn||1),pos,neg,maxStep,maxStepAt,active,core};
add('terrace_geometry_is_substantive_but_bounded',dmax>.20&&dmax<.90,geom,'.20 m < max terrace delta < .90 m');
add('terrace_geometry_has_both_cut_and_fill',pos>5&&neg>5,{pos,neg},'both signed responses >5 aggregate sample-m');
add('pilot_has_broad_core',core>80,{active,core},'>80 samples with mask >.60');
add('terrace_increment_is_not_a_cliff',maxStep<1.05,{maxStep,maxStepAt},'<1.05 m change in added terrace delta per 4 m z');
const stepRange=Math.max(...stepVals)-Math.min(...stepVals),phaseRange=Math.max(...phaseVals)-Math.min(...phaseVals);
add('synthetic_step_spacing_varies',stepRange>.24,{min:Math.min(...stepVals),max:Math.max(...stepVals),range:stepRange},'>.24 m variation in synthetic step-height control');
add('contour_phase_is_warped',phaseRange>.28,{min:Math.min(...phaseVals),max:Math.max(...phaseVals),range:phaseRange},'>.28 m phase range');
const rows=[...activeRows.values()],centres=rows.map(r=>r.mean),widths=rows.map(r=>r.max-r.min),counts=rows.map(r=>r.count);
const rowMetrics={rows:rows.length,centreRange:Math.max(...centres)-Math.min(...centres),widthRange:Math.max(...widths)-Math.min(...widths),countRange:Math.max(...counts)-Math.min(...counts),multiRunRows:runsRows};
add('pilot_planform_is_not_a_rectangle',rowMetrics.centreRange>18&&rowMetrics.widthRange>28,rowMetrics,'centre drift >18 m and occupied width variation >28 m');
add('pilot_contains_real_skips_or_splits',runsRows>=3,rowMetrics,'>=3 sampled rows contain more than one active run');
add('notch_operator_is_material',K.pilotNotchFactor(-8,-63)<.42,K.pilotNotchFactor(-8,-63),' <.42 at designed non-metric morphology notch');

const benchRat=[],riserRat=[],benchSlope=[],riserSlope=[];let benchN=0,riserN=0;
for(let x=-200;x<=90;x+=5)for(let z=-126;z<=0;z+=4){
  const st=K.terraceStateAt(x,z);if(st.mask<.72||R30.nearestExtendedDrainageDistance(x,z)<20)continue;
  const bg=R30.gradient(x,z).mag,ng=K.gradient(x,z).mag;if(bg<.035||bg>.55)continue;
  if(st.frac<.26||st.frac>.74){benchN++;benchRat.push(ng/bg);benchSlope.push(ng)}
  if(st.frac>.46&&st.frac<.54){riserN++;riserRat.push(ng/bg);riserSlope.push(ng)}
}
const terrMetrics={benchN,riserN,benchRatioMean:mean(benchRat),benchRatioMedian:median(benchRat),riserRatioMean:mean(riserRat),riserRatioMedian:median(riserRat),benchSlopeMean:mean(benchSlope),riserSlopeMean:mean(riserSlope)};
add('bench_and_riser_samples_exist',benchN>24&&riserN>10,terrMetrics,'>24 bench and >10 riser core samples');
add('benches_are_flatter_than_r30_substrate',median(benchRat)<.72,terrMetrics,'median bench/base gradient ratio <.72');
add('risers_are_steeper_than_benches',median(riserSlope)>median(benchSlope)*1.45,{benchMedianSlope:median(benchSlope),riserMedianSlope:median(riserSlope)},'median riser slope > 1.45x median bench slope');
add('risers_steepen_relative_to_r30',median(riserRat)>1.35,terrMetrics,'median riser/base gradient ratio >1.35');

let farUp=0,nearDrain=0,receiver=0,outside=0;
for(let x=-230;x<=230;x+=8){
  for(const z of [-300,-220,-170,-145,25,55,90,130,170])outside=Math.max(outside,Math.abs(K.height(x,z)-R30.height(x,z)));
  for(const z of [-300,-220,-170,-145])farUp=Math.max(farUp,Math.abs(K.height(x,z)-R30.height(x,z)));
  for(let z=-128;z<=6;z+=6)if(R30.nearestExtendedDrainageDistance(x,z)<12)nearDrain=Math.max(nearDrain,Math.abs(K.height(x,z)-R30.height(x,z)));
  const rz=R30.riverZ(x);for(const dz of [-10,-6,-2,0,2,6,10])receiver=Math.max(receiver,Math.abs(K.height(x,rz+dz)-R30.height(x,rz+dz)));
}
add('far_upstream_work_untouched',farUp<1e-9,farUp,'zero sampled R31 change far upstream');
add('support_is_localized_to_agricultural_slope',outside<1e-9,outside,'zero sampled change outside pilot support');
add('drainage_axis_cores_are_protected',nearDrain<1e-9,nearDrain,'zero sampled change within 12 m inherited drainage axes');
add('foreground_receiver_is_unchanged',receiver<1e-9,receiver,'zero sampled change around receiver river');
function worstForward(M){let v=-Infinity,where=null;for(let x=-210;x<=210;x+=8)for(let z=-132;z<=12;z+=4){const r=M.height(x,z+4)-M.height(x,z);if(r>v){v=r;where=[x,z]}}return{maxRise:v,at:where}}
const oldForward=worstForward(R30),newForward=worstForward(K);
add('terrace_risers_do_not_create_pathological_wall',newForward.maxRise<=oldForward.maxRise+1.05,{old:oldForward,new:newForward},'new worst 4 m forward rise <= R30 +1.05 m');

add('terrace_geometry_enabled_only_as_pilot',K.snapshot.terraceGeometryEnabled===true&&K.snapshot.terracePilotPreviewEnabled===true,{terraceGeometryEnabled:K.snapshot.terraceGeometryEnabled,terracePilotPreviewEnabled:K.snapshot.terracePilotPreviewEnabled},'localized pilot geometry ON');
add('global_visual_acceptance_remains_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);
add('parcel_generator_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);
add('water_state_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);
add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
add('logic_error_explicitly_corrected',K.snapshot.round31?.logicCorrection?.includes('does not imply')&&K.snapshot.round31?.logicCorrection?.includes('amplitude'),K.snapshot.round31?.logicCorrection,'must reject numeric-pass->visual-pass and weak-visibility->more-height shortcuts');
add('r30_fixed_view_was_reopened',K.snapshot.round31?.stageAdvanceReason?.includes('actually reopened'),K.snapshot.round31?.stageAdvanceReason,'actual R30 fixed view reviewed before stage advance');
add('xiaoma_truth_boundary_retained',K.snapshot.round31?.xiaomaBoundary?.includes('synthetic morphology')&&K.snapshot.round31?.xiaomaBoundary?.includes('hydraulic truth'),K.snapshot.round31?.xiaomaBoundary,'no survey/hydraulic overclaim');
add('mrrolord_ordering_only',K.snapshot.round31?.mrRolordUse?.includes('drainage hierarchy')&&K.snapshot.round31?.mrRolordUse?.includes('not copied'),K.snapshot.round31?.mrRolordUse,'process ordering only');
add('user_reference_reopened_without_metric_inference',K.snapshot.round31?.referenceUse?.includes('reopened this round')&&K.snapshot.round31?.referenceUse?.includes('no metric terrace width'),K.snapshot.round31?.referenceUse,'morphology only');
add('survey_claims_forbidden',Array.isArray(K.snapshot.round31?.forbiddenClaims)&&K.snapshot.round31.forbiddenClaims.length>=14,K.snapshot.round31?.forbiddenClaims,'explicit evidence boundary');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{geometry:geom,rowMetrics,terraceMorphology:terrMetrics,stepRange,phaseRange,farUp,nearDrain,receiver,outside,oldForward,newForward}};
fs.writeFileSync(new URL('./r045_round31_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
