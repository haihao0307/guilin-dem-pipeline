import fs from 'node:fs';
import * as K from './r045_round41_kernel.mjs';
import * as R40 from '../round-40/r045_round40_kernel.mjs';
import * as R39 from '../round-39/r045_round39_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
add('version',K.VERSION==='R045.41',K.VERSION,'R045.41');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R40.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R40.edges),{nodes:[R40.nodes.length,K.nodes.length],edges:[R40.edges.length,K.edges.length]},'exact inherited graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R40.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R40.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carriers');

const rows=[];for(let z=-132;z<=12;z+=6){const row=[];for(let x=-222;x<=120;x+=6)row.push({x,z,n:K.terraceStateAt(x,z),p:R40.terraceStateAt(x,z),o:R39.terraceStateAt(x,z),dd:R30.nearestExtendedDrainageDistance(x,z)});rows.push(row)}
function shape(row,key){let runs=0,best=0,cur=0;for(const c of row){const v=c[key].mask>.12;if(v){if(!cur)runs++;cur++;best=Math.max(best,cur)}else cur=0}return{runs,best:best*6}}
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.18,.24*step)&&Math.abs(a.index-b.index)<=3}
const neigh=[[6,0],[-6,0],[0,6],[0,-6],[6,6],[-6,6],[6,-6],[-6,-6]];
function supportDirs(fn,c,base){const dirs=[];for(const [dx,dz] of neigh){const q=fn(c.x+dx,c.z+dz);if(q.mask>.12&&compatible(base,q))dirs.push([dx,dz])}return dirs}
let dmax=0,change40=0,active=0,oldActive=0,core=0,oldCore=0,incGainCells=0,incThreshold=0,incIsolated=0,incCrossRow=0,unsafe=0,maxIncGain=0,rowRunsN=0,rowRunsP=0,existingActiveMaskChange=0,existingActiveDeltaChange=0;const groups=[0,0,0],longN=[],longP=[];
let totalGainCells=0,totalThreshold=0,totalJunction=0,totalCrossRow39=0,totalOpposite=0,maxTotalGain=0;
for(const row of rows){
 const a=shape(row,'n'),b=shape(row,'p');rowRunsN+=a.runs;rowRunsP+=b.runs;if(a.best)longN.push(a.best);if(b.best)longP.push(b.best);
 for(const c of row){const n=c.n,p=c.p,o=c.o,gi=n.mask-p.mask,gt=n.mask-o.mask;dmax=Math.max(dmax,Math.abs(n.delta));change40=Math.max(change40,Math.abs(n.delta-p.delta));
  if(n.mask>.12){active++;if(n.groupIndex>=0&&n.groupIndex<3)groups[n.groupIndex]++}if(p.mask>.12){oldActive++;existingActiveMaskChange=Math.max(existingActiveMaskChange,Math.abs(n.mask-p.mask));existingActiveDeltaChange=Math.max(existingActiveDeltaChange,Math.abs(n.delta-p.delta))}
  if(n.mask>.60)core++;if(p.mask>.60)oldCore++;
  if(gi>.004){incGainCells++;maxIncGain=Math.max(maxIncGain,gi);const riverGap=Math.abs(c.z-R30.riverZ(c.x));if(c.dd<=12||R35.broadTerraceEligibility(c.x,c.z)<.03||R35.terraceGroupEnvelope(c.x,c.z)<.035||riverGap<=R30.riverW(c.x)+18)unsafe++}
  if(p.mask<=.12&&n.mask>.12){incThreshold++;const dirs=supportDirs(R40.terraceStateAt,c,p);if(dirs.length<2)incIsolated++;if(dirs.some(v=>v[1]!==0))incCrossRow++;}
  if(gt>.004){totalGainCells++;maxTotalGain=Math.max(maxTotalGain,gt)}
  if(o.mask<=.12&&n.mask>.12){totalThreshold++;const dirs=supportDirs(R39.terraceStateAt,c,o);if(dirs.some(v=>v[1]!==0))totalCrossRow39++;const sectors=new Set(dirs.map(([dx,dz])=>dz>0?'U':dz<0?'D':dx>0?'R':'L'));if(sectors.size>=2)totalJunction++;let opp=false;for(let i=0;i<dirs.length;i++)for(let j=i+1;j<dirs.length;j++){const aa=dirs[i],bb=dirs[j],la=Math.hypot(...aa),lb=Math.hypot(...bb);if((aa[0]*bb[0]+aa[1]*bb[1])/(la*lb)<-.25)opp=true}if(opp)totalOpposite++;}
 }}
const burdenN=rowRunsN/(active||1),burdenP=rowRunsP/(oldActive||1),medN=median(longN),medP=median(longP),maxN=Math.max(...longN),maxP=Math.max(...longP);
const geom={deltaMax:dmax,changeFrom40:change40,active,oldActive,core,oldCore,incGainCells,incThreshold,incIsolated,incCrossRow,maxIncGain,totalGainCells,totalThreshold,totalJunction,totalCrossRow39,totalOpposite,maxTotalGain,unsafe,groups,rowRunsN,rowRunsP,fragmentationBurdenN:burdenN,fragmentationBurdenP:burdenP,medianLongestN:medN,medianLongestP:medP,maxLongestN:maxN,maxLongestP:maxP,existingActiveMaskChange,existingActiveDeltaChange};
add('terrace_geometry_substantive_bounded',dmax>.20&&dmax<.95,geom,'.20m < max delta < .95m');
add('r40_failed_materiality_gate_repaired',totalGainCells>8&&maxTotalGain>.006,{totalGainCells,maxTotalGain},'original R40 total standard retained: >8 weak samples gain >.004 and max gain >.006');
add('r40_failed_topology_gate_repaired',totalThreshold>=6&&totalJunction>=4&&totalCrossRow39>=6,{totalThreshold,totalJunction,totalCrossRow39},'original material threshold retained: >=6 total crossings, >=4 junctions, and >=6 crossings have direct cross-row R39 support');
add('branch_remerge_evidence_present',totalOpposite>=2,{totalOpposite},'>=2 total promoted junctions have opposed inherited R39 support directions');
add('r41_increment_is_material',incGainCells>=3&&incThreshold>=2&&maxIncGain>.004,{incGainCells,incThreshold,maxIncGain},'>=3 incremental gain samples, >=2 new threshold crossings, max incremental gain >.004');
add('r41_increment_crossrow_supported',incCrossRow===incThreshold&&incIsolated===0,{incThreshold,incCrossRow,incIsolated},'every new R41 crossing has >=2 compatible R40 neighbours and adjacent-row support');
add('r41_change_from_r40_bounded',change40>.001&&change40<.14,change40,'.001m < sampled max change < .14m');
add('existing_r40_active_surface_exact',existingActiveMaskChange<1e-12&&existingActiveDeltaChange<1e-12,{existingActiveMaskChange,existingActiveDeltaChange},'R41 changes only R40-weak support; all already-active R40 samples exact');
add('support_does_not_shrink',active>=oldActive,{active,oldActive},'active support >= R40');
add('core_does_not_shrink',core>=oldCore,{core,oldCore},'core support >= R40');
add('fragmentation_not_worse',burdenN<=burdenP*1.01,{burdenN,burdenP},'runs/active <= 101% of R40');
add('longest_ribbons_hold',medN>=medP-6&&maxN>=maxP,{medianNew:medN,medianOld:medP,maxNew:maxN,maxOld:maxP},'median longest loses at most one 6m cell and max longest >= R40');
add('all_three_groups_remain_material',groups.every(n=>n>20),groups,'each group >20 active samples');
add('repair_candidates_stay_safe',unsafe===0,{unsafe},'no incremental gained sample in drainage core/outside eligibility/receiver');
let hardCoreActive=0,hardCoreDelta=0;for(const row of rows)for(const c of row)if(c.dd<=12){if(c.n.mask>.01)hardCoreActive++;hardCoreDelta=Math.max(hardCoreDelta,Math.abs(c.n.delta))}add('hard_drainage_core_empty',hardCoreActive===0&&hardCoreDelta<1e-9,{hardCoreActive,hardCoreDelta},'zero support/delta <=12m drainage');

let frameN=0,maxStep=0,maxPhase=0,maxRaw=0;for(let x=-210;x<=110;x+=32)for(let z=-128;z<=2;z+=20){const n=K.terraceStateAt(x,z),p=R40.terraceStateAt(x,z);frameN++;maxStep=Math.max(maxStep,Math.abs(n.step-p.step));maxPhase=Math.max(maxPhase,Math.abs(n.phase-p.phase));maxRaw=Math.max(maxRaw,Math.abs(n.raw-p.raw))}add('r40_stair_frame_exact',maxStep<1e-12&&maxPhase<1e-12&&maxRaw<1e-12,{frameN,maxStep,maxPhase,maxRaw},'step/phase/raw exactly inherited');
let far=0,near=0,receiver=0,outside=0;for(let x=-216;x<=216;x+=36){for(const z of [-300,-220,-170,-145])far=Math.max(far,Math.abs(K.terraceDelta(x,z)));for(const z of [-300,-220,-170,-145,30,70,130])outside=Math.max(outside,Math.abs(K.terraceDelta(x,z)));for(let z=-126;z<=0;z+=18)if(R30.nearestExtendedDrainageDistance(x,z)<=12)near=Math.max(near,Math.abs(K.terraceDelta(x,z)));const rz=R30.riverZ(x);for(const dz of [-8,0,8])receiver=Math.max(receiver,Math.abs(K.terraceDelta(x,rz+dz)))}add('far_upstream_untouched',far<1e-9,far,'0');add('support_localized',outside<1e-9,outside,'0');add('drainage_core_protected',near<1e-9,near,'0');add('foreground_receiver_unchanged',receiver<1e-9,receiver,'0');
let maxInc=0;for(let x=-210;x<=110;x+=18)for(let z=-126;z<=0;z+=12){maxInc=Math.max(maxInc,Math.abs(K.terraceDelta(x+6,z)-K.terraceDelta(x,z)),Math.abs(K.terraceDelta(x,z+6)-K.terraceDelta(x,z)))}add('terrace_increment_not_cliff',maxInc<1.25,maxInc,'<1.25m per 6m at focused samples');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);add('parcel_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);add('water_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
add('logic_error_explicit',K.snapshot.round41?.logicCorrection?.includes('does not prove')&&K.snapshot.round41?.logicCorrection?.includes('does not prove an agricultural'),K.snapshot.round41?.logicCorrection,'browser/fragmentation are not topology truth');
add('real_world_constraint_explicit',K.snapshot.round41?.constraint?.includes('13.5 m')&&K.snapshot.round41?.constraint?.includes('cannot provide'),K.snapshot.round41?.constraint,'synthetic radius and missing field truth explicit');
add('xiaoma_boundary_retained',K.snapshot.round41?.xiaomaBoundary?.includes('do not establish parcel ownership'),K.snapshot.round41?.xiaomaBoundary,'continuity/adjacency/conservation != ownership/hydraulics');
add('mrrolord_ordering_only',K.snapshot.round41?.mrRolordUse?.includes('drainage hierarchy')&&K.snapshot.round41?.mrRolordUse?.includes('not agricultural truth'),K.snapshot.round41?.mrRolordUse,'ordering only');
add('reference_nonmetric',K.snapshot.round41?.referenceUse?.includes('reread')&&K.snapshot.round41?.referenceUse?.includes('No metric'),K.snapshot.round41?.referenceUse,'visual morphology only');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{geometry:geom,far,near,receiver,outside,maxInc,qaScope:'full 6m R41 weak-domain repair sweep + retained original R40 total material/topology standards + exact existing-R40 inheritance + drainage/receiver boundary checks'}};fs.writeFileSync(new URL('./r045_round41_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
