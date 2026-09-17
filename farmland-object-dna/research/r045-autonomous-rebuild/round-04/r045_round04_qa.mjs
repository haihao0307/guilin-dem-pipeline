import * as R3 from '../round-03/r045_round03_kernel.mjs';
import * as K from './r045_round04_kernel.mjs';
import fs from 'node:fs';
const checks=[];const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const transfers=K.edges.filter(e=>e.transportPermitted);
const graph=new Map(K.nodes.map(n=>[n.id,[]]));for(const e of transfers)if(e.from&&e.to)graph.get(e.from)?.push(e.to);
function reachable(a,b){const q=[a],seen=new Set;while(q.length){const u=q.shift();if(u===b)return true;if(seen.has(u))continue;seen.add(u);q.push(...(graph.get(u)||[]))}return false}
function acyclic(){const state=new Map;function dfs(u){const s=state.get(u)||0;if(s===1)return false;if(s===2)return true;state.set(u,1);for(const v of graph.get(u)||[])if(!dfs(v))return false;state.set(u,2);return true}return [...graph.keys()].every(dfs)}
function corr(a,b){const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,v)=>s+(v-ma)**2,0)),sb=Math.sqrt(b.reduce((s,v)=>s+(v-mb)**2,0));if(sa===0||sb===0)return 1;let n=0;for(let i=0;i<a.length;i++)n+=(a[i]-ma)*(b[i]-mb);return n/(sa*sb)}
function profileCorr(Kernel){const xs=[-205,-155,-105,-55,-5,45,95,145,195],zs=[];for(let z=-282;z<=-145;z+=7)zs.push(z);const ps=xs.map(x=>zs.map(z=>Kernel.height(x,z)));const cs=[];for(let i=0;i<ps.length-1;i++)cs.push(corr(ps[i],ps[i+1]));return{avg:mean(cs),max:Math.max(...cs),min:Math.min(...cs),all:cs}}

add('hydrology_node_count',K.nodes.length===22,K.nodes.length,22);
add('permitted_transfer_count',transfers.length===37,transfers.length,37);
add('unknown_current_water_state',transfers.every(e=>e.currentGateState===null&&e.currentFlowM3s===null&&e.storedVolumeM3===null),transfers.filter(e=>e.currentFlowM3s!==null).length,0);
add('all_sources_reach_front_river',['SRC-A','SRC-B','SRC-C'].every(s=>reachable(s,'RIVER')),['SRC-A','SRC-B','SRC-C'].map(s=>reachable(s,'RIVER')),true);
add('transfer_graph_acyclic',acyclic(),acyclic(),true);

const crestSamples=[];for(let x=-220;x<=220;x+=10){const z=K.ridgeCrestZ(x);crestSamples.push({x,z,h:K.height(x,z),front:K.height(x,z+58)});}
const crestRelief=crestSamples.map(p=>p.h-p.front);add('connected_rear_ridge_min_relief',Math.min(...crestRelief)>6.5,Math.min(...crestRelief),'> 6.5m');
add('connected_rear_ridge_coverage',crestRelief.filter(v=>v>9).length/crestRelief.length>.68,crestRelief.filter(v=>v>9).length/crestRelief.length,'> 0.68');
const saddleDepths=K.saddleXs.map(x=>{const z=K.ridgeCrestZ(x),c=K.height(x,z),l=K.height(x-34,K.ridgeCrestZ(x-34)),r=K.height(x+34,K.ridgeCrestZ(x+34));return((l+r)/2)-c});
add('saddles_remain_lower_sections',saddleDepths.every(v=>v>1.8&&v<30),saddleDepths,'1.8..30m');

const firstOrder=K.naturalStreams.filter(s=>s.o===1&&['A1','A2','B1','B2','C1','C2','C3'].includes(s.id));
const streamRises=firstOrder.map(s=>{let worst=-Infinity;for(let i=0;i<s.p.length-1;i++)worst=Math.max(worst,K.height(...s.p[i+1])-K.height(...s.p[i]));return worst});
add('headwater_paths_no_large_uphill_step',streamRises.every(v=>v<1.2),streamRises,'< 1.2m segment rise');

const hollowContrasts=[];for(const h of K.headwaterHollows){const j=Math.min(2,h.p.length-2),a=h.p[j-1],p=h.p[j],b=h.p[j+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L,off=h.width*1.1,center=K.height(...p),left=K.height(p[0]+nx*off,p[1]+nz*off),right=K.height(p[0]-nx*off,p[1]-nz*off);hollowContrasts.push(((left+right)/2)-center)}
add('headwater_hollows_have_convergent_relief',mean(hollowContrasts)>1.0&&hollowContrasts.filter(v=>v>.35).length>=5,hollowContrasts,'mean >1m and >=5/7 >0.35m');

const pc3=profileCorr(R3),pc4=profileCorr(K);add('ridge_wall_profile_similarity_reduced',pc4.avg<pc3.avg-.035,[pc3.avg,pc4.avg],'R04 < R03 - 0.035');
add('ridge_wall_not_uniformly_replaced',pc4.max-pc4.min>.08,[pc4.min,pc4.max],'>0.08 correlation spread');

const crestLengths=K.secondaryCrests.map(c=>{let d=0;for(let i=0;i<c.p.length-1;i++)d+=Math.hypot(c.p[i+1][0]-c.p[i][0],c.p[i+1][1]-c.p[i][1]);return d});
const spurLengths=K.branchSpurs.map(c=>{let d=0;for(let i=0;i<c.p.length-1;i++)d+=Math.hypot(c.p[i+1][0]-c.p[i][0],c.p[i+1][1]-c.p[i][1]);return d});
add('secondary_crest_lengths_not_uniform',std(crestLengths)/mean(crestLengths)>.07,std(crestLengths)/mean(crestLengths),'>0.07 CV');
add('branch_spur_lengths_not_uniform',std(spurLengths)/mean(spurLengths)>.05,std(spurLengths)/mean(spurLengths),'>0.05 CV');

const shoulderCurv=[];for(const s of K.middleShoulders){const p=s.p[Math.floor(s.p.length/2)];shoulderCurv.push(Math.abs(K.curvature(...p)))}
add('middle_shoulders_create_local_slope_breaks',mean(shoulderCurv)>.006,shoulderCurv,'mean abs curvature > .006');
let maxRise=-Infinity;for(let z=-170;z<142;z+=4)maxRise=Math.max(maxRise,K.height(0,z+4)-K.height(0,z));add('central_forward_profile_no_opposing_wall',maxRise<.65,maxRise,'< 0.65m / 4m');
let rmin=1e9,rmax=-1e9;for(let x=-230;x<=230;x+=5){const z=K.riverZ(x);rmin=Math.min(rmin,z);rmax=Math.max(rmax,z)}add('river_confined_to_front_receiver',rmin>154&&rmax<188,[rmin,rmax],'154<z<188');
let opposite=0;for(let x=-200;x<=200;x+=20)for(let z=190;z<=205;z+=5)opposite=Math.max(opposite,K.suitability(x,z));add('no_agriculture_beyond_front_river',opposite===0,opposite,0);

let total=0,good=0,near=[],far=[];for(let x=-195;x<=195;x+=7.5)for(let z=-150;z<=4;z+=7){const p=K.terracePermission(x,z),d=K.nearestStreamDistance(x,z);total++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p)}
const pct=good/total;add('terrace_permission_constrained',pct>.10&&pct<.62,pct,'0.10..0.62');add('terrace_permission_zero_near_streams',mean(near)<.03,mean(near),'< 0.03');add('terrace_permission_viable_away_from_streams',mean(far)>.28,mean(far),'> 0.28');

const result={version:K.VERSION,passed:checks.every(c=>c.pass),gateCount:checks.length,checks,metrics:{crestReliefMin:Math.min(...crestRelief),crestReliefMean:mean(crestRelief),saddleDepths,streamRises,hollowContrasts,profileCorrelationR03:pc3,profileCorrelationR04:pc4,secondaryCrestLengthCv:std(crestLengths)/mean(crestLengths),branchSpurLengthCv:std(spurLengths)/mean(spurLengths),shoulderCurvature:shoulderCurv,maxCentralRise4m:maxRise,riverRange:[rmin,rmax],terracePermissionAbove065:pct,nearStreamPermission:mean(near),farStreamPermission:mean(far)},snapshot:K.snapshot};
fs.writeFileSync(new URL('./r045_round04_qa_result.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.passed)process.exitCode=2;
