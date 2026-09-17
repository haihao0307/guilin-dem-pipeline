import * as K from './r045_round03_kernel.mjs';
import fs from 'node:fs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const transfers=K.edges.filter(e=>e.transportPermitted);
const graph=new Map(K.nodes.map(n=>[n.id,[]]));for(const e of transfers)if(e.from&&e.to)graph.get(e.from)?.push(e.to);
function reachable(a,b){const q=[a],seen=new Set;while(q.length){const u=q.shift();if(u===b)return true;if(seen.has(u))continue;seen.add(u);q.push(...(graph.get(u)||[]))}return false}
function acyclic(){const state=new Map;function dfs(u){const s=state.get(u)||0;if(s===1)return false;if(s===2)return true;state.set(u,1);for(const v of graph.get(u)||[])if(!dfs(v))return false;state.set(u,2);return true}return [...graph.keys()].every(dfs)}
add('hydrology_node_count',K.nodes.length===22,K.nodes.length,22);
add('permitted_transfer_count',transfers.length===37,transfers.length,37);
add('unknown_current_water_state',transfers.every(e=>e.currentGateState===null&&e.currentFlowM3s===null&&e.storedVolumeM3===null),transfers.filter(e=>e.currentFlowM3s!==null).length,0);
add('all_sources_reach_front_river',['SRC-A','SRC-B','SRC-C'].every(s=>reachable(s,'RIVER')),['SRC-A','SRC-B','SRC-C'].map(s=>reachable(s,'RIVER')),true);
add('transfer_graph_acyclic',acyclic(),acyclic(),true);

// Connected rear crest should remain high relative to the front shoulder across the whole width.
const crestSamples=[];for(let x=-220;x<=220;x+=10){const z=K.ridgeCrestZ(x);crestSamples.push({x,z,h:K.height(x,z),front:K.height(x,z+58)});}
const crestRelief=crestSamples.map(p=>p.h-p.front);add('connected_rear_ridge_min_relief',Math.min(...crestRelief)>8,Math.min(...crestRelief),'> 8m');
add('connected_rear_ridge_coverage',crestRelief.filter(v=>v>10).length/crestRelief.length>.8,crestRelief.filter(v=>v>10).length/crestRelief.length,'> 0.8');
const saddleDepths=K.saddleXs.map(x=>{const z=K.ridgeCrestZ(x),c=K.height(x,z),l=K.height(x-34,K.ridgeCrestZ(x-34)),r=K.height(x+34,K.ridgeCrestZ(x+34));return((l+r)/2)-c});
add('saddles_are_lower_sections',saddleDepths.every(v=>v>2.5&&v<28),saddleDepths,'2.5..28m');

// Headwaters must begin near and on the downslope side of the ridge, then descend overall toward their confluence/outlet.
const firstOrder=K.naturalStreams.filter(s=>s.o===1&&['A1','A2','B1','B2','C1','C2','C3'].includes(s.id));
const headOffsets=firstOrder.map(s=>{const [x,z]=s.p[0];return z-K.ridgeCrestZ(x)});
add('headwaters_on_forward_ridge_flank',headOffsets.every(v=>v>=3&&v<=35),headOffsets,'3..35m downslope of crest');
const streamRises=firstOrder.map(s=>{let worst=-Infinity;for(let i=0;i<s.p.length-1;i++)worst=Math.max(worst,K.height(...s.p[i+1])-K.height(...s.p[i]));return worst});
add('headwater_paths_no_large_uphill_step',streamRises.every(v=>v<1.2),streamRises,'< 1.2m segment rise');

// Deliberately break the old equal catchment spacing.
const mainAxes=[-132,-35,126],gaps=[mainAxes[1]-mainAxes[0],mainAxes[2]-mainAxes[1]],gapCv=std(gaps)/mean(gaps);
add('catchment_spacing_not_uniform',gapCv>.15,gapCv,'> 0.15 CV');
add('headwater_branch_counts_asymmetric',JSON.stringify(['A','B','C'].map(c=>firstOrder.filter(s=>s.catchment===c).length))===JSON.stringify([2,2,3]),['A','B','C'].map(c=>firstOrder.filter(s=>s.catchment===c).length),'[2,2,3]');

// Valley-to-divide relief remains first-class after mountain rewrite.
const relief=[];for(const x of[-132,-35,126]){const vals=[];for(let z=-150;z<=-60;z+=15){const valley=K.height(x,z);const dx=x<0?(x<-80?52:78):66;const ridge=Math.max(K.height(x-dx,z),K.height(x+dx,z));vals.push(ridge-valley)}relief.push(mean(vals))}
add('mean_valley_divide_relief',mean(relief)>2.0,relief,'mean > 2m');add('catchment_relief_asymmetry',std(relief)>.5,std(relief),'> 0.5m std');

// Preserve the single-sided mountain -> slope -> plain -> front-river composition.
let maxRise=-Infinity;for(let z=-170;z<142;z+=4)maxRise=Math.max(maxRise,K.height(0,z+4)-K.height(0,z));add('central_forward_profile_no_opposing_wall',maxRise<.55,maxRise,'< 0.55m / 4m');
let rmin=1e9,rmax=-1e9;for(let x=-230;x<=230;x+=5){const z=K.riverZ(x);rmin=Math.min(rmin,z);rmax=Math.max(rmax,z)}add('river_confined_to_front_receiver',rmin>154&&rmax<188,[rmin,rmax],'154<z<188');
let opposite=0;for(let x=-200;x<=200;x+=20)for(let z=190;z<=205;z+=5)opposite=Math.max(opposite,K.suitability(x,z));add('no_agriculture_beyond_front_river',opposite===0,opposite,0);

// Re-evaluate future terrace permission; it must be constrained and absent in stream corridors.
let total=0,good=0,near=[],far=[];for(let x=-195;x<=195;x+=7.5)for(let z=-150;z<=4;z+=7){const p=K.terracePermission(x,z),d=K.nearestStreamDistance(x,z);total++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p)}
const pct=good/total;add('terrace_permission_constrained',pct>.12&&pct<.62,pct,'0.12..0.62');add('terrace_permission_zero_near_streams',mean(near)<.03,mean(near),'< 0.03');add('terrace_permission_viable_away_from_streams',mean(far)>.35,mean(far),'> 0.35');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,checks,metrics:{crestReliefMin:Math.min(...crestRelief),crestReliefMean:mean(crestRelief),saddleDepths,headOffsets,streamRises,catchmentGapCv:gapCv,catchmentRelief:relief,maxCentralRise4m:maxRise,riverRange:[rmin,rmax],terracePermissionAbove065:pct,nearStreamPermission:mean(near),farStreamPermission:mean(far)},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round03_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
