// New unit/shape wrapper; original field functions are unchanged.
import {OriginalStoneMother as G,originalStoneProfile} from './stone-study/stone-original.mjs';
export function createMetricStoneField({sizeM=[.42,.18,.24],seed=8231,damage=.76,weathering=.88,level=.48,controls={}}={}){
 if(sizeM.length!==3||!sizeM.every(v=>Number.isFinite(v)&&v>0))throw Error('Positive metres required');
 const profile={...originalStoneProfile,runtimeDNA:{...originalStoneProfile.runtimeDNA,shapeRatio:[...sizeM]}};
 const settings={...originalStoneProfile.compositeDefaults,...controls,damage,weathering,benchmarkSlab:0};
 const scaleM=Math.max(...sizeM)/3.4;
 const source=G.createSDF(profile,{master:seed},settings,level);
 function sdf(p){const a=Array.isArray(p)?p:[p.x,p.y,p.z];return source.sdf(G.vec3(...a.map(v=>v/scaleM)))*scaleM;}
 function normal(p,epsilonM=.0002){const a=Array.isArray(p)?p:[p.x,p.y,p.z];const n=a.map((_,i)=>{const hi=[...a],lo=[...a];hi[i]+=epsilonM;lo[i]-=epsilonM;return sdf(hi)-sdf(lo);});const l=Math.hypot(...n);return n.map(v=>v/l);}
 return {sdf,normal,source,profile,settings,scaleM,sizeM:[...sizeM],proof:{originalField:true,metricWrapperNew:true,arbitrarySizeIsAuthoredNotMeasured:true,sourceUnitCalibration:'unknown',gpuTested:false}};
}
