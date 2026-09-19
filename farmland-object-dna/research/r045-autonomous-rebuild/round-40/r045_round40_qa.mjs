import fs from 'node:fs';
import * as K from './r045_round40_kernel.mjs';
import * as R39 from '../round-39/r045_round39_kernel.mjs';
import * as R35 from '../round-35/r045_round35_kernel.mjs';
import * as R30 from '../round-30/r045_round30_kernel.mjs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const median=a=>{if(!a.length)return 0;const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length%2?b[m]:(b[m-1]+b[m])/2};
add('version',K.VERSION==='R045.40',K.VERSION,'R045.40');
add('water_graph_identity_preserved',JSON.stringify(K.nodes)===JSON.stringify(R39.nodes)&&JSON.stringify(K.edges)===JSON.stringify(R39.edges),{nodes:[R39.nodes.length,K.nodes.length],edges:[R39.edges.length,K.edges.length]},'exact inherited graph');
add('terrain_carriers_identity_preserved',JSON.stringify(K.terrainChannels)===JSON.stringify(R39.terrainChannels)&&JSON.stringify(K.outletContinuum)===JSON.stringify(R39.outletContinuum),{terrainChannels:K.terrainChannels.length,outlets:K.outletContinuum.length},'exact inherited carriers');

const rows=[];for(let z=-132;z<=12;z+=6){const row=[];for(let x=-222;x<=120;x+=6)row.push({x,z,n:K.terraceStateAt(x,z),o:R39.terraceStateAt(x,z),dd:R30.nearestExtendedDrainageDistance(x,z)});rows.push(row)}
function shape(row,key){let runs=0,best=0,cur=0;for(const c of row){const v=c[key].mask>.12;if(v){if(!cur)runs++;cur++;best=Math.max(best,cur)}else cur=0}return{runs,best:best*6}}
const activeAt=(x,z)=>R39.terraceStateAt(x,z);
function compatible(a,b){if(a.groupIndex!==b.groupIndex)return false;const step=.5*(a.step+b.step);return Math.abs(a.step-b.step)<=Math.max(.18,.24*step)&&Math.abs(a.index-b.index)<=3}
const neigh=[[6,0],[-6,0],[0,6],[0,-6],[6,6],[-6,6],[6,-6],[-6,-6]];
let dmax=0,change39=0,active=0,oldActive=0,core=0,oldCore=0,gainCells=0,thresholdCross=0,isolatedCross=0,junctionCross=0,oppositeCross=0,crossRowCross=0,hardCoreActive=0,hardCoreDelta=0,unsafe=0,maxGain=0,rowRunsN=0,rowRunsO=0,existingActiveMaskChange=0,existingActiveDeltaChange=0;const groups=[0,0,0],longN=[],longO=[];
for(const row of rows){
 const a=shape(row,'n'),b=shape(row,'o');rowRunsN+=a.runs;rowRunsO+=b.runs;if(a.best)longN.push(a.best);if(b.best)longO.push(b.best);
 for(const c of row){const n=c.n,o=c.o,g=n.mask-o.mask;dmax=Math.max(dmax,Math.abs(n.delta));change39=Math.max(change39,Math.abs(n.delta-o.delta));
  if(n.mask>.12){active++;if(n.groupIndex>=0&&n.groupIndex<3)groups[n.groupIndex]++}if(o.mask>.12){oldActive++;existingActiveMaskChange=Math.max(existingActiveMaskChange,Math.abs(n.mask-o.mask));existingActiveDeltaChange=Math.max(existingActiveDeltaChange,Math.abs(n.delta-o.delta))}
  if(n.mask>.60)core++;if(o.mask>.60)oldCore++;
  if(g>.004){gainCells++;maxGain=Math.max(maxGain,g);const riverGap=Math.abs(c.z-R30.riverZ(c.x));if(c.dd<=12||R35.broadTerraceEligibility(c.x,c.z)<.03||R35.terraceGroupEnvelope(c.x,c.z)<.035||riverGap<=R30.riverW(c.x)+18)unsafe++}
  if(o.mask<=.12&&n.mask>.12){thresholdCross++;const dirs=[];for(const [dx,dz] of neigh){const q=activeAt(c.x+dx,c.z+dz);if(q.mask>.12&&compatible(o,q))dirs.push([dx,dz])}if(dirs.length<2)isolatedCross++;if(dirs.some(v=>v[1]!==0))crossRowCross++;const sectors=new Set(dirs.map(([dx,dz])=>dz>0?'U':dz<0?'D':dx>0?'R':'L'));if(sectors.size>=2)junctionCross++;let opp=false;for(let i=0;i<dirs.length;i++)for(let j=i+1;j<dirs.length;j++){const a=dirs[i],b=dirs[j],la=Math.hypot(...a),lb=Math.hypot(...b);if((a[0]*b[0]+a[1]*b[1])/(la*lb)<-.25)opp=true}if(opp)oppositeCross++;}
  if(c.dd<=12){if(n.mask>.01)hardCoreActive++;hardCoreDelta=Math.max(hardCoreDelta,Math.abs(n.delta))}
 }}
const burdenN=rowRunsN/(active||1),burdenO=rowRunsO/(oldActive||1),medN=median(longN),medO=median(longO),maxN=Math.max(...longN),maxO=Math.max(...longO);
const geom={deltaMax:dmax,changeFrom39:change39,active,oldActive,core,oldCore,gainCells,thresholdCross,isolatedCross,junctionCross,oppositeCross,crossRowCross,maxGain,unsafe,hardCoreActive,hardCoreDelta,groups,rowRunsN,rowRunsO,fragmentationBurdenN:burdenN,fragmentationBurdenO:burdenO,medianLongestN:medN,medianLongestO:medO,maxLongestN:maxN,maxLongestO:maxO,existingActiveMaskChange,existingActiveDeltaChange};
add('terrace_geometry_substantive_bounded',dmax>.20&&dmax<.95,geom,'.20m < max delta < .95m');
add('family_organization_material',gainCells>8&&maxGain>.006,{gainCells,maxGain},'>8 weak samples gain >.004 and max gain >.006');
add('family_organization_changes_topology',thresholdCross>=6&&junctionCross>=4&&crossRowCross===thresholdCross,{thresholdCross,junctionCross,crossRowCross},'>=6 threshold crossings; >=4 multi-sector junctions; every crossing has cross-row R39 support');
add('branch_remerge_evidence_present',oppositeCross>=2,{oppositeCross},'>=2 promoted junctions have opposed inherited support directions');
add('r40_change_from_r39_bounded',change39>.002&&change39<.16,change39,'.002m < sampled max change < .16m');
add('existing_r39_active_surface_exact',existingActiveMaskChange<1e-12&&existingActiveDeltaChange<1e-12,{existingActiveMaskChange,existingActiveDeltaChange},'R40 changes only R39-weak support; all already-active R39 samples exact');
add('support_does_not_shrink',active>=oldActive,{active,oldActive},'active support >= R39');
add('core_does_not_shrink',core>=oldCore,{core,oldCore},'core support >= R39');
add('fragmentation_not_worse',burdenN<=burdenO*1.01,{burdenN,burdenO},'runs/active <= 101% of R39 while branch junctions may add legitimate row runs');
add('no_isolated_threshold_crossings',isolatedCross===0,{isolatedCross},'every newly active sample has >=2 already-active compatible R39 neighbours');
add('longest_ribbons_hold',medN>=medO-6&&maxN>=maxO,{medianNew:medN,medianOld:medO,maxNew:maxN,maxOld:maxO},'median longest loses at most one 6m cell and max longest >= R39');
add('all_three_groups_remain_material',groups.every(n=>n>20),groups,'each group >20 active samples');
add('organization_candidates_stay_safe',unsafe===0,{unsafe},'no gained sample in drainage core/outside eligibility/receiver');
add('hard_drainage_core_empty',hardCoreActive===0&&hardCoreDelta<1e-9,{hardCoreActive,hardCoreDelta},'zero support/delta <=12m drainage');

let frameN=0,maxStep=0,maxPhase=0,maxRaw=0;for(let x=-210;x<=110;x+=32)for(let z=-128;z<=2;z+=20){const n=K.terraceStateAt(x,z),o=R39.terraceStateAt(x,z);frameN++;maxStep=Math.max(maxStep,Math.abs(n.step-o.step));maxPhase=Math.max(maxPhase,Math.abs(n.phase-o.phase));maxRaw=Math.max(maxRaw,Math.abs(n.raw-o.raw))}add('r39_stair_frame_exact',maxStep<1e-12&&maxPhase<1e-12&&maxRaw<1e-12,{frameN,maxStep,maxPhase,maxRaw},'step/phase/raw exactly inherited');
let far=0,near=0,receiver=0,outside=0;for(let x=-216;x<=216;x+=36){for(const z of [-300,-220,-170,-145])far=Math.max(far,Math.abs(K.terraceDelta(x,z)));for(const z of [-300,-220,-170,-145,30,70,130])outside=Math.max(outside,Math.abs(K.terraceDelta(x,z)));for(let z=-126;z<=0;z+=18)if(R30.nearestExtendedDrainageDistance(x,z)<=12)near=Math.max(near,Math.abs(K.terraceDelta(x,z)));const rz=R30.riverZ(x);for(const dz of [-8,0,8])receiver=Math.max(receiver,Math.abs(K.terraceDelta(x,rz+dz)))}add('far_upstream_untouched',far<1e-9,far,'0');add('support_localized',outside<1e-9,outside,'0');add('drainage_core_protected',near<1e-9,near,'0');add('foreground_receiver_unchanged',receiver<1e-9,receiver,'0');
let maxInc=0;for(let x=-210;x<=110;x+=18)for(let z=-126;z<=0;z+=12){maxInc=Math.max(maxInc,Math.abs(K.terraceDelta(x+6,z)-K.terraceDelta(x,z)),Math.abs(K.terraceDelta(x,z+6)-K.terraceDelta(x,z)))}add('terrace_increment_not_cliff',maxInc<1.25,maxInc,'<1.25m per 6m at focused samples');
add('visual_acceptance_locked',K.snapshot.visualAcceptance===false,K.snapshot.visualAcceptance,false);add('parcel_locked',K.snapshot.parcelGenerationEnabled===false,K.snapshot.parcelGenerationEnabled,false);add('water_unknown',K.snapshot.waterStateKnown===false,K.snapshot.waterStateKnown,false);add('production_locked',K.snapshot.productionReady===false,K.snapshot.productionReady,false);
add('logic_error_explicit',K.snapshot.round40?.logicCorrection?.includes('does not imply')&&K.snapshot.round40?.logicCorrection?.includes('does not prove'),K.snapshot.round40?.logicCorrection,'visibility != riser amplitude; connectivity != topology truth');
add('real_world_constraint_explicit',K.snapshot.round40?.constraint?.includes('12.5 m')&&K.snapshot.round40?.constraint?.includes('cannot provide'),K.snapshot.round40?.constraint,'missing field truth explicit');
add('xiaoma_boundary_retained',K.snapshot.round40?.xiaomaBoundary?.includes('cannot establish parcel ownership'),K.snapshot.round40?.xiaomaBoundary,'surface continuity != ownership/hydraulics');
add('mrrolord_ordering_only',K.snapshot.round40?.mrRolordUse?.includes('drainage hierarchy')&&K.snapshot.round40?.mrRolordUse?.includes('not agricultural truth'),K.snapshot.round40?.mrRolordUse,'ordering only');
add('reference_nonmetric',K.snapshot.round40?.referenceUse?.includes('reread')&&K.snapshot.round40?.referenceUse?.includes('No metric'),K.snapshot.round40?.referenceUse,'visual morphology only');
const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,passedCount:checks.filter(c=>c.pass).length,checks,metrics:{geometry:geom,far,near,receiver,outside,maxInc,qaScope:'full 6m higher-order weak-domain topology sweep + exact existing-R39 inheritance + drainage/receiver boundary checks'}};fs.writeFileSync(new URL('./r045_round40_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
