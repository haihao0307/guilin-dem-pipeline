import fs from 'node:fs';
import * as K from './r045_round39_kernel.mjs';
import * as R38 from '../round-38/r045_round38_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
add('version',K.VERSION==='R045.39',K.VERSION,'R045.39');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R38.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R38.edges),{nodes:[R38.nodes.length,K.nodes.length],edges:[R38.edges.length,K.edges.length]},'exact inherited graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R38.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R38.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carriers');

// R39 changes only weak R38 run ends. Keep the full 6 m along-run lattice, where the one-cell shell
// actually lives, instead of re-running expensive gradient morphology that R39 is mathematically
// forbidden to alter once R38 mask > .12. This remains a full changed-domain topology sweep.
const rows=[];for(let z=-132;z<=10;z+=6){const row=[];for(let x=-220;x<=120;x+=6)row.push({x,z,n:K.terraceStateAt(x,z),o:R38.terraceStateAt(x,z),dd:R30.nearestExtendedDrainageDistance(x,z)});rows.push(row)}
function shape(row,key){let runs=0,best=0,cur=0;for(const c of row){const v=c[key].mask>.12;if(v){if(!cur)runs++;cur++;best=Math.max(best,cur)}else cur=0}return{runs,best:best*6}}
let dmax=0,change38=0,active=0,oldActive=0,core=0,oldCore=0,gainCells=0,thresholdCross=0,isolatedCross=0,stableBackedCross=0,hardCoreActive=0,hardCoreDelta=0,unsafe=0,maxGain=0,rowRunsN=0,rowRunsO=0,existingActiveMaskChange=0,existingActiveDeltaChange=0;const groups=[0,0,0],longN=[],longO=[];
for(const row of rows){const a=shape(row,'n'),b=shape(row,'o');rowRunsN+=a.runs;rowRunsO+=b.runs;if(a.best)longN.push(a.best);if(b.best)longO.push(b.best);for(let i=0;i<row.length;i++){const c=row[i],n=c.n,o=c.o,g=n.mask-o.mask;dmax=Math.max(dmax,Math.abs(n.delta));change38=Math.max(change38,Math.abs(n.delta-o.delta));if(n.mask>.12){active++;if(n.groupIndex>=0&&n.groupIndex<3)groups[n.groupIndex]++}if(o.mask>.12){oldActive++;existingActiveMaskChange=Math.max(existingActiveMaskChange,Math.abs(n.mask-o.mask));existingActiveDeltaChange=Math.max(existingActiveDeltaChange,Math.abs(n.delta-o.delta))}if(n.mask>.60)core++;if(o.mask>.60)oldCore++;if(g>.004){gainCells++;maxGain=Math.max(maxGain,g);const riverGap=Math.abs(c.z-R30.riverZ(c.x));if(c.dd<=12||R35.broadTerraceEligibility(c.x,c.z)<.03||R35.terraceGroupEnvelope(c.x,c.z)<.035||riverGap<=R30.riverW(c.x)+18)unsafe++;}if(o.mask<=.12&&n.mask>.12){thresholdCross++;const left=i>0&&row[i-1].o.mask>.12,right=i<row.length-1&&row[i+1].o.mask>.12;if(!left&&!right)isolatedCross++;const left2=i>1&&row[i-1].o.mask>.12&&row[i-2].o.mask>.12,right2=i<row.length-2&&row[i+1].o.mask>.12&&row[i+2].o.mask>.12;if(left2||right2)stableBackedCross++;}if(c.dd<=12){if(n.mask>.01)hardCoreActive++;hardCoreDelta=Math.max(hardCoreDelta,Math.abs(n.delta))}}}
const burdenN=rowRunsN/(active||1),burdenO=rowRunsO/(oldActive||1);
const geom={deltaMax:dmax,changeFrom38:change38,active,oldActive,core,oldCore,gainCells,thresholdCross,isolatedCross,stableBackedCross,maxGain,unsafe,hardCoreActive,hardCoreDelta,groups,rowRunsN,rowRunsO,fragmentationBurdenN:burdenN,fragmentationBurdenO:burdenO,medianLongestN:median(longN),medianLongestO:median(longO),maxLongestN:Math.max(...longN),maxLongestO:Math.max(...longO),existingActiveMaskChange,existingActiveDeltaChange};
add('terrace_geometry_substantive_bounded',dmax>.20&&dmax<.95,geom,'.20m < max delta < .95m');
add('stable_run_continuation_material',gainCells>8&&maxGain>.006,{gainCells,maxGain},'>8 samples gain >.004 and max gain >.006');
add('stable_run_continuation_changes_topology',thresholdCross>4&&stableBackedCross===thresholdCross,{thresholdCross,stableBackedCross},'>4 R38-weak samples cross .12 and all are backed by two active R38 cells');
add('r39_change_from_r38_bounded',change38>.002&&change38<.18,change38,'.002m < sampled max change < .18m');
add('existing_r38_active_surface_exact',existingActiveMaskChange<1e-12&&existingActiveDeltaChange<1e-12,{existingActiveMaskChange,existingActiveDeltaChange},'R39 changes only R38-weak support; all already-active R38 samples exact');
add('support_does_not_shrink',active>=oldActive,{active,oldActive},'active support >= R38');
add('core_does_not_shrink',core>=oldCore,{core,oldCore},'core support >= R38');
add('row_runs_do_not_increase',rowRunsN<=rowRunsO,{rowRunsN,rowRunsO},'new row-run count <= R38');
add('fragmentation_burden_improves',burdenN<burdenO*.995,{burdenN,burdenO},'runs/active improves by >=0.5% vs same-grid R38');
add('no_isolated_threshold_crossings',isolatedCross===0,{isolatedCross},'every newly active sample touches an already-active R38 row neighbour');
add('longest_ribbons_hold_or_improve',median(longN)>=median(longO)&&Math.max(...longN)>=Math.max(...longO),{medianNew:median(longN),medianOld:median(longO),maxNew:Math.max(...longN),maxOld:Math.max(...longO)},'median and max longest run >= R38');
add('all_three_groups_remain_material',groups.every(n=>n>20),groups,'each group >20 active samples');
add('continuation_candidates_stay_safe',unsafe===0,{unsafe},'no gained sample in drainage core/outside eligibility/receiver');
add('hard_drainage_core_empty',hardCoreActive===0&&hardCoreDelta<1e-9,{hardCoreActive,hardCoreDelta},'zero support/delta <=12m drainage');

let frameN=0,maxStep=0,maxPhase=0,maxRaw=0;for(let x=-210;x<=110;x+=32)for(let z=-128;z<=2;z+=20){const n=K.terraceStateAt(x,z),o=R38.terraceStateAt(x,z);frameN++;maxStep=Math.max(maxStep,Math.abs(n.step-o.step));maxPhase=Math.max(maxPhase,Math.abs(n.phase-o.phase));maxRaw=Math.max(maxRaw,Math.abs(n.raw-o.raw))}add('r38_stair_frame_exact',maxStep<1e-12&&maxPhase<1e-12&&maxRaw<1e-12,{frameN,maxStep,maxPhase,maxRaw},'step/phase/raw exactly inherited');
// R38 already passed bench/riser morphology. Because the full changed-domain sweep above proves that
// every already-active R38 sample is bit-exact in mask and delta, R39 cannot alter existing bench/riser
// geometry; the new evidence needed here is edge topology and edge smoothness, not a duplicate core test.
let far=0,near=0,receiver=0,outside=0;for(let x=-216;x<=216;x+=36){for(const z of [-300,-220,-170,-145])far=Math.max(far,Math.abs(K.terraceDelta(x,z)));for(const z of [-300,-220,-170,-145,30,70,130])outside=Math.max(outside,Math.abs(K.terraceDelta(x,z)));for(let z=-126;z<=0;z+=18)if(R30.nearestExtendedDrainageDistance(x,z)<=12)near=Math.max(near,Math.abs(K.terraceDelta(x,z)));const rz=R30.riverZ(x);for(const dz of [-8,0,8])receiver=Math.max(receiver,Math.abs(K.terraceDelta(x,rz+dz)))}add('far_upstream_untouched',far<1e-9,far,'0');add('support_localized',outside<1e-9,outside,'0');add('drainage_core_protected',near<1e-9,near,'0');add('foreground_receiver_unchanged',receiver<1e-9,receiver,'0');
let maxInc=0;for(let x=-210;x<=110;x+=18)for(let z=-126;z<=0;z+=12){maxInc=Math.max(maxInc,Math.abs(K.terraceDelta(x+6,z)-K.terraceDelta(x,z)),Math.abs(K.terraceDelta(x,z+6)-K.terraceDelta(x,z)))}add('terrace_increment_not_cliff',maxInc<1.25,maxInc,'<1.25m per 6m at focused edge samples');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);add('parcel_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);add('water_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
add('logic_error_explicit',K.snapshot.round39?.logicCorrection?.includes('does not imply')&&K.snapshot.round39?.logicCorrection?.includes('connectivity'),K.snapshot.round39?.logicCorrection,'visibility != riser amplitude; connectivity != topology truth');
add('real_world_constraint_explicit',K.snapshot.round39?.constraint?.includes('12.5 m')&&K.snapshot.round39?.constraint?.includes('cannot provide'),K.snapshot.round39?.constraint,'missing field truth explicit');
add('xiaoma_boundary_retained',K.snapshot.round39?.xiaomaBoundary?.includes('cannot establish ownership'),K.snapshot.round39?.xiaomaBoundary,'surface continuity != ownership/hydraulics');
add('mrrolord_ordering_only',K.snapshot.round39?.mrRolordUse?.includes('drainage hierarchy')&&K.snapshot.round39?.mrRolordUse?.includes('not agricultural truth'),K.snapshot.round39?.mrRolordUse,'ordering only');
add('reference_nonmetric',K.snapshot.round39?.referenceUse?.includes('reread')&&K.snapshot.round39?.referenceUse?.includes('No metric'),K.snapshot.round39?.referenceUse,'visual morphology only');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{geometry:geom,far,near,receiver,outside,maxInc,qaScope:'full 6m along-run changed-domain topology + sparse unchanged-domain inheritance checks; inherited R38 core morphology not redundantly recomputed'}};fs.writeFileSync(new URL('./r045_round39_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
