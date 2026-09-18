import fs from 'node:fs';
import * as K from './r045_round38_kernel.mjs';
import * as R37 from '../round-37/r045_round37_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
add('version',K.VERSION==='R045.38',K.VERSION,'R045.38');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R37.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R37.edges),{nodes:[R37.nodes.length,K.nodes.length],edges:[R37.edges.length,K.edges.length]},'exact inherited graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R37.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R37.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carriers');

const rows=[];for(let z=-132;z<=10;z+=6){const row=[];for(let x=-220;x<=120;x+=6)row.push({x,z,n:K.terraceStateAt(x,z),o:R37.terraceStateAt(x,z),b:R35.terraceStateAt(x,z),dd:R30.nearestExtendedDrainageDistance(x,z)});rows.push(row)}
function shape(row,key){let runs=0,best=0,cur=0;for(const c of row){const v=c[key].mask>.12;if(v){if(!cur)runs++;cur++;best=Math.max(best,cur)}else cur=0}return{runs,best:best*6}}
let dmax=0,change37=0,active=0,oldActive=0,core=0,oldCore=0,gainCells=0,thresholdCross=0,isolatedCross=0,hardCoreActive=0,hardCoreDelta=0,unsafe=0,maxGain=0,rowRunsN=0,rowRunsO=0;const groups=[0,0,0],longN=[],longO=[];
for(const row of rows){const a=shape(row,'n'),b=shape(row,'o');rowRunsN+=a.runs;rowRunsO+=b.runs;if(a.best)longN.push(a.best);if(b.best)longO.push(b.best);for(let i=0;i<row.length;i++){const c=row[i],n=c.n,o=c.o,g=n.mask-o.mask;dmax=Math.max(dmax,Math.abs(n.delta));change37=Math.max(change37,Math.abs(n.delta-o.delta));if(n.mask>.12){active++;if(n.groupIndex>=0&&n.groupIndex<3)groups[n.groupIndex]++}if(o.mask>.12)oldActive++;if(n.mask>.60)core++;if(o.mask>.60)oldCore++;if(g>.004){gainCells++;maxGain=Math.max(maxGain,g);const riverGap=Math.abs(c.z-R30.riverZ(c.x));if(c.dd<=12||R35.broadTerraceEligibility(c.x,c.z)<.03||R35.terraceGroupEnvelope(c.x,c.z)<.035||riverGap<=R30.riverW(c.x)+18)unsafe++;}if(o.mask<=.12&&n.mask>.12){thresholdCross++;const left=i>0&&row[i-1].o.mask>.12,right=i<row.length-1&&row[i+1].o.mask>.12;if(!left&&!right)isolatedCross++;}if(c.dd<=12){if(n.mask>.01)hardCoreActive++;hardCoreDelta=Math.max(hardCoreDelta,Math.abs(n.delta))}}}
const burdenN=rowRunsN/(active||1),burdenO=rowRunsO/(oldActive||1),burden35=0.1557377049180328;
const geom={deltaMax:dmax,changeFrom37:change37,active,oldActive,core,oldCore,gainCells,thresholdCross,isolatedCross,maxGain,unsafe,hardCoreActive,hardCoreDelta,groups,rowRunsN,rowRunsO,fragmentationBurdenN:burdenN,fragmentationBurdenO:burdenO,fragmentationBurdenR35:burden35,medianLongestN:median(longN),medianLongestO:median(longO),maxLongestN:Math.max(...longN),maxLongestO:Math.max(...longO)};
add('terrace_geometry_substantive_bounded',dmax>.20&&dmax<.95,geom,'.20m < max delta < .95m');
add('run_end_extension_material',gainCells>8&&maxGain>.008,{gainCells,maxGain},'>8 samples gain >.004 and max gain >.008');
add('run_end_extension_changes_topology',thresholdCross>3,{thresholdCross},'>3 R37-weak samples cross .12');
add('r38_change_from_r37_bounded',change37>.004&&change37<.22,change37,'.004m < sampled max change < .22m');
add('support_does_not_shrink',active>=oldActive,{active,oldActive},'active support >= R37');
add('core_does_not_shrink',core>=oldCore,{core,oldCore},'core support >= R37');
add('row_runs_do_not_increase',rowRunsN<=rowRunsO,{rowRunsN,rowRunsO},'new row-run count <= R37');
add('fragmentation_burden_improves',burdenN<burdenO*.995,{burdenN,burdenO},'runs/active improves by >=0.5% vs R37');
add('fragmentation_returns_within_r35_gate',burdenN<=burden35*1.01,{burdenN,burden35},'runs/active <=1.01x verified R35');
add('no_isolated_threshold_crossings',isolatedCross===0,{isolatedCross},'every newly active sample touches an already-active R37 row neighbour');
add('longest_ribbons_hold_or_improve',median(longN)>=median(longO),{medianNew:median(longN),medianOld:median(longO),maxNew:Math.max(...longN),maxOld:Math.max(...longO)},'median longest run >= R37');
add('all_three_groups_remain_material',groups.every(n=>n>20),groups,'each group >20 active samples');
add('extension_candidates_stay_safe',unsafe===0,{unsafe},'no gained sample in drainage core/outside eligibility/receiver');
add('hard_drainage_core_empty',hardCoreActive===0&&hardCoreDelta<1e-9,{hardCoreActive,hardCoreDelta},'zero support/delta <=12m drainage');

let frameN=0,maxStep=0,maxPhase=0,maxRaw=0;for(let x=-210;x<=110;x+=16)for(let z=-128;z<=2;z+=10){const n=K.terraceStateAt(x,z),o=R37.terraceStateAt(x,z);frameN++;maxStep=Math.max(maxStep,Math.abs(n.step-o.step));maxPhase=Math.max(maxPhase,Math.abs(n.phase-o.phase));maxRaw=Math.max(maxRaw,Math.abs(n.raw-o.raw))}add('r37_stair_frame_exact',maxStep<1e-12&&maxPhase<1e-12&&maxRaw<1e-12,{frameN,maxStep,maxPhase,maxRaw},'step/phase/raw exactly inherited');

const br=[],rr=[],bs=[],rs=[];let bn=0,rn=0;for(let x=-204;x<=108;x+=12)for(let z=-126;z<=2;z+=8){const st=K.terraceStateAt(x,z);if(st.mask<.68||R30.nearestExtendedDrainageDistance(x,z)<18)continue;const bg=R30.gradient(x,z).mag,ng=K.gradient(x,z).mag;if(bg<.03||bg>.60)continue;if(st.frac<.25||st.frac>.75){bn++;br.push(ng/bg);bs.push(ng)}if(st.frac>.46&&st.frac<.54){rn++;rr.push(ng/bg);rs.push(ng)}}const terr={benchN:bn,riserN:rn,benchRatioMedian:median(br),riserRatioMedian:median(rr),benchSlopeMedian:median(bs),riserSlopeMedian:median(rs)};add('bench_riser_samples_exist',bn>10&&rn>3,terr,'>10 bench and >3 riser samples');add('benches_flatter_than_r30',median(br)<.90,terr,'bench/base median <.90');add('risers_steeper_than_benches',median(rs)>median(bs)*1.25,terr,'riser slope >1.25x bench');add('risers_steepen_vs_r30',median(rr)>1.08,terr,'riser/base median >1.08');

let far=0,near=0,receiver=0,outside=0;for(let x=-216;x<=216;x+=18){for(const z of [-300,-220,-170,-145])far=Math.max(far,Math.abs(K.terraceDelta(x,z)));for(const z of [-300,-220,-170,-145,30,70,130])outside=Math.max(outside,Math.abs(K.terraceDelta(x,z)));for(let z=-126;z<=0;z+=12)if(R30.nearestExtendedDrainageDistance(x,z)<=12)near=Math.max(near,Math.abs(K.terraceDelta(x,z)));const rz=R30.riverZ(x);for(const dz of [-8,-2,0,2,8])receiver=Math.max(receiver,Math.abs(K.terraceDelta(x,rz+dz)))}add('far_upstream_untouched',far<1e-9,far,'0');add('support_localized',outside<1e-9,outside,'0');add('drainage_core_protected',near<1e-9,near,'0');add('foreground_receiver_unchanged',receiver<1e-9,receiver,'0');
let maxInc=0;for(let x=-210;x<=110;x+=12)for(let z=-126;z<=0;z+=6)maxInc=Math.max(maxInc,Math.abs(K.terraceDelta(x,z+6)-K.terraceDelta(x,z)));add('terrace_increment_not_cliff',maxInc<1.25,maxInc,'<1.25m per 6m');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);add('parcel_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);add('water_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
add('logic_error_explicit',K.snapshot.round38?.logicCorrection?.includes('does not cancel')&&K.snapshot.round38?.logicCorrection?.includes('weakening'),K.snapshot.round38?.logicCorrection,'renderability != topology pass; do not weaken gate');
add('real_world_constraint_explicit',K.snapshot.round38?.constraint?.includes('12.5 m')&&K.snapshot.round38?.constraint?.includes('cannot provide'),K.snapshot.round38?.constraint,'missing field truth explicit');
add('xiaoma_boundary_retained',K.snapshot.round38?.xiaomaBoundary?.includes('cannot establish ownership'),K.snapshot.round38?.xiaomaBoundary,'surface continuity != ownership/hydraulics');
add('mrrolord_ordering_only',K.snapshot.round38?.mrRolordUse?.includes('drainage hierarchy')&&K.snapshot.round38?.mrRolordUse?.includes('not agricultural truth'),K.snapshot.round38?.mrRolordUse,'ordering only');
add('reference_nonmetric',K.snapshot.round38?.referenceUse?.includes('reopened')&&K.snapshot.round38?.referenceUse?.includes('No metric'),K.snapshot.round38?.referenceUse,'visual morphology only');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{geometry:geom,terraceMorphology:terr,far,near,receiver,outside,maxInc}};fs.writeFileSync(new URL('./r045_round38_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
