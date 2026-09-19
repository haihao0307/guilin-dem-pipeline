import * as R4 from '../round-04/r045_round04_kernel.mjs';
import * as K from './r045_round05_kernel.mjs';
import fs from 'node:fs';

const checks=[];
const add=(name,pass,value,limit)=>checks.push({name,pass:Boolean(pass),value,limit});
const mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1);
const std=a=>{const m=mean(a);return Math.sqrt(mean(a.map(v=>(v-m)**2)))};
const corr=(a,b)=>{const ma=mean(a),mb=mean(b),sa=Math.sqrt(a.reduce((s,v)=>s+(v-ma)**2,0)),sb=Math.sqrt(b.reduce((s,v)=>s+(v-mb)**2,0));if(sa===0||sb===0)return 1;let n=0;for(let i=0;i<a.length;i++)n+=(a[i]-ma)*(b[i]-mb);return n/(sa*sb)};

const transfers=K.edges.filter(e=>e.transportPermitted);
const graph=new Map(K.nodes.map(n=>[n.id,[]]));
for(const e of transfers)if(e.from&&e.to)graph.get(e.from)?.push(e.to);
function reachable(a,b){const q=[a],seen=new Set;while(q.length){const u=q.shift();if(u===b)return true;if(seen.has(u))continue;seen.add(u);q.push(...(graph.get(u)||[]))}return false}
function acyclic(){const state=new Map;function dfs(u){const s=state.get(u)||0;if(s===1)return false;if(s===2)return true;state.set(u,1);for(const v of graph.get(u)||[])if(!dfs(v))return false;state.set(u,2);return true}return [...graph.keys()].every(dfs)}
function hollowContrast(Ker,h){const j=Math.min(2,h.p.length-2),a=h.p[j-1],p=h.p[j],b=h.p[j+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz)||1,nx=-dz/L,nz=dx/L,off=h.width*1.1,center=Ker.height(...p),left=Ker.height(p[0]+nx*off,p[1]+nz*off),right=Ker.height(p[0]-nx*off,p[1]-nz*off);return ((left+right)/2)-center}
function rearProfileCorr(Ker){const xs=[-205,-155,-105,-55,-5,45,95,145,195],zs=[];for(let z=-282;z<=-145;z+=7)zs.push(z);const ps=xs.map(x=>zs.map(z=>Ker.height(x,z))),cs=[];for(let i=0;i<ps.length-1;i++)cs.push(corr(ps[i],ps[i+1]));return{avg:mean(cs),min:Math.min(...cs),max:Math.max(...cs),all:cs}}
function midCrossCorr(Ker){const zs=[-155,-140,-125,-110,-95,-80],xs=[];for(let x=-205;x<=205;x+=5)xs.push(x);const ps=zs.map(z=>xs.map(x=>Ker.height(x,z))),cs=[];for(let i=0;i<ps.length-1;i++)cs.push(corr(ps[i],ps[i+1]));return{avg:mean(cs),min:Math.min(...cs),max:Math.max(...cs),all:cs}}

add('hydrology_node_count',K.nodes.length===22,K.nodes.length,22);
add('permitted_transfer_count',transfers.length===37,transfers.length,37);
add('unknown_current_water_state',transfers.every(e=>e.currentGateState===null&&e.currentFlowM3s===null&&e.storedVolumeM3===null),transfers.filter(e=>e.currentFlowM3s!==null).length,0);
add('all_sources_reach_front_river',['SRC-A','SRC-B','SRC-C'].every(s=>reachable(s,'RIVER')),['SRC-A','SRC-B','SRC-C'].map(s=>reachable(s,'RIVER')),true);
add('transfer_graph_acyclic',acyclic(),acyclic(),true);

const crestSamples=[];for(let x=-220;x<=220;x+=10){const z=K.ridgeCrestZ(x);crestSamples.push({x,z,h:K.height(x,z),front:K.height(x,z+58)})}
const crestRelief=crestSamples.map(p=>p.h-p.front);
add('connected_rear_ridge_min_relief',Math.min(...crestRelief)>6.5,Math.min(...crestRelief),'> 6.5m');
add('connected_rear_ridge_coverage',crestRelief.filter(v=>v>9).length/crestRelief.length>.68,crestRelief.filter(v=>v>9).length/crestRelief.length,'> 0.68');
const saddleDepths=K.saddleXs.map(x=>{const z=K.ridgeCrestZ(x),c=K.height(x,z),l=K.height(x-34,K.ridgeCrestZ(x-34)),r=K.height(x+34,K.ridgeCrestZ(x+34));return((l+r)/2)-c});
add('saddles_remain_lower_sections',saddleDepths.every(v=>v>1.8&&v<30),saddleDepths,'1.8..30m');

const firstOrder=K.naturalStreams.filter(s=>s.o===1&&['A1','A2','B1','B2','C1','C2','C3'].includes(s.id));
const streamRises=firstOrder.map(s=>{let worst=-Infinity;for(let i=0;i<s.p.length-1;i++)worst=Math.max(worst,K.height(...s.p[i+1])-K.height(...s.p[i]));return worst});
add('headwater_paths_no_large_uphill_step',streamRises.every(v=>v<1.2),streamRises,'< 1.2m segment rise');

const h4=K.headwaterHollows.map(h=>hollowContrast(R4,h)),h5=K.headwaterHollows.map(h=>hollowContrast(K,h));
add('headwater_convergence_retained',mean(h5)>1.2&&h5.filter(v=>v>.2).length===7,h5,'mean >1.2m and all 7 >0.2m');
add('strongest_slot_relief_reduced',Math.max(...h5)<Math.max(...h4)*.92,[Math.max(...h4),Math.max(...h5)],'R05 max < 0.92 * R04 max');
add('headwater_mean_not_flattened',mean(h5)>.75*mean(h4)&&mean(h5)<mean(h4),[mean(h4),mean(h5)],'0.75*R04 < R05 < R04');

const swaleAngles=K.middleSwales.map(s=>{const a=s.p[0],b=s.p.at(-1),dx=b[0]-a[0],dz=b[1]-a[1];return Math.atan2(Math.abs(dx),Math.abs(dz))*180/Math.PI});
add('middle_swales_oblique_not_vertical',mean(swaleAngles)>40&&Math.min(...swaleAngles)>30,swaleAngles,'mean >40deg; min >30deg from fall-line');
const swaleRises=K.middleSwales.map(s=>{let worst=-Infinity;for(let i=0;i<s.p.length-1;i++)worst=Math.max(worst,K.height(...s.p[i+1])-K.height(...s.p[i]));return worst});
add('middle_swales_follow_downhill',swaleRises.every(v=>v<.8),swaleRises,'<0.8m worst segment rise');

const cross4=midCrossCorr(R4),cross5=midCrossCorr(K);
add('middle_slope_parallel_rhythm_reduced',cross5.avg<cross4.avg-.008,[cross4.avg,cross5.avg],'R05 < R04 - 0.008');
const rear4=rearProfileCorr(R4),rear5=rearProfileCorr(K);
add('rear_hierarchy_not_recollapsed',rear5.avg<rear4.avg+.02,[rear4.avg,rear5.avg],'< R04 + 0.02');

const apronRatios=K.foothillAprons.map(f=>f.width1/f.width0);
add('foothill_aprons_spread_downstream',apronRatios.every(v=>v>2.5),apronRatios,'all width1/width0 >2.5');
const apronRelief=K.foothillAprons.map(f=>{const sample=d=>{const t=Math.min(1,d/f.length),cx=f.x+Math.tan(f.azimuth)*d,w=f.width0+(f.width1-f.width0)*(t*t*(3-2*t)),z=f.z+d,c=K.height(cx,z),fl=(K.height(cx+w*1.05,z)+K.height(cx-w*1.05,z))/2;return c-fl};return{prox:sample(8),dist:sample(Math.min(60,f.length*.82))}});
add('foothill_apron_relief_decays_downstream',apronRelief.every(v=>v.prox>v.dist*1.35&&v.dist>.35),apronRelief,'prox >1.35*dist and dist >0.35m');

let maxRise=-Infinity;for(let z=-170;z<142;z+=4)maxRise=Math.max(maxRise,K.height(0,z+4)-K.height(0,z));
add('central_forward_profile_no_opposing_wall',maxRise<.65,maxRise,'<0.65m / 4m');
let rmin=1e9,rmax=-1e9;for(let x=-230;x<=230;x+=5){const z=K.riverZ(x);rmin=Math.min(rmin,z);rmax=Math.max(rmax,z)}
add('river_confined_to_front_receiver',rmin>154&&rmax<188,[rmin,rmax],'154<z<188');
let opposite=0;for(let x=-200;x<=200;x+=20)for(let z=190;z<=205;z+=5)opposite=Math.max(opposite,K.suitability(x,z));
add('no_agriculture_beyond_front_river',opposite===0,opposite,0);

let total=0,good=0,near=[],far=[],newSwaleNear=[];
for(let x=-195;x<=195;x+=7.5)for(let z=-150;z<=4;z+=7){
  const p=K.terracePermission(x,z),d=K.nearestTerrainDrainageDistance(x,z),dn=K.nearestStreamDistance(x,z);
  total++;if(p>.65)good++;if(d<6)near.push(p);if(d>18)far.push(p);if(d<6&&dn>8)newSwaleNear.push(p);
}
const pct=good/total;
add('terrace_permission_constrained',pct>.10&&pct<.62,pct,'0.10..0.62');
add('terrace_permission_zero_near_all_drainage',mean(near)<.03,mean(near),'<0.03');
add('terrace_permission_excludes_new_swales',newSwaleNear.length>20&&mean(newSwaleNear)<.03,[newSwaleNear.length,mean(newSwaleNear)],'>20 samples and mean <0.03');
add('terrace_permission_viable_away_from_drainage',mean(far)>.28,mean(far),'>0.28');

const result={
  version:K.VERSION,
  passed:checks.every(c=>c.pass),
  gateCount:checks.length,
  checks,
  metrics:{
    crestReliefMin:Math.min(...crestRelief),crestReliefMean:mean(crestRelief),saddleDepths,streamRises,
    hollowContrastR04:h4,hollowContrastR05:h5,hollowMeanR04:mean(h4),hollowMeanR05:mean(h5),
    middleSwaleAnglesDeg:swaleAngles,middleSwaleWorstSegmentRise:swaleRises,
    midCrossCorrelationR04:cross4,midCrossCorrelationR05:cross5,rearProfileCorrelationR04:rear4,rearProfileCorrelationR05:rear5,
    foothillApronWidthRatios:apronRatios,foothillApronRelief:apronRelief,
    maxCentralRise4m:maxRise,riverRange:[rmin,rmax],terracePermissionAbove065:pct,
    nearDrainagePermission:mean(near),newSwaleNearPermission:mean(newSwaleNear),farDrainagePermission:mean(far)
  },
  snapshot:K.snapshot
};
fs.writeFileSync(new URL('./r045_round05_qa_result.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!result.passed)process.exitCode=2;
