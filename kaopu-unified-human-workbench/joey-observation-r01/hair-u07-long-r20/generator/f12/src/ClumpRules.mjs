import {clamp} from './approved/LegacyFoundation.mjs';
// These intervals are on the intrinsic SCALP, never sections of a hair shell.
export function clumpRule(id,r){
 const part=r.partMM*.001;
 let axis=0,edges;
 if(r.family==='u07-center-long'&&id==='bang-sweep')edges=Array.from({length:5},(_,i)=>part-.063+i*.063/4);
 else if(r.family==='u07-center-long'&&id==='bang-wisps')edges=Array.from({length:5},(_,i)=>part+i*.063/4);
 else if(id==='bang-sweep')edges=Array.from({length:6},(_,i)=>part-.063+i*.012);
 else if(id==='bang-wisps')edges=Array.from({length:4},(_,i)=>part-.003+i*.003);
 else if(id.startsWith('frame')){axis=2;edges=[.045,.063,.081,.099,.2];}
 else if(id.startsWith('outer')){axis=2;edges=[-.027,-.009,.009,.027,.045];}
 else if(id.startsWith('under')){axis=2;edges=[-.027,-.003,.021,.045];}
 else if(id==='back-left')edges=[-.2,-.055,-.030,Math.min(-.010,part-.005),part];
 else if(id==='back-right')edges=[part,Math.max(.025,part+.005),.045,.065,.2];
 else if(id==='nape')edges=[-.2,-.045,-.015,.015,.045,.2];
 else return null;
 return {axis,edges,min:edges[0],max:edges.at(-1),count:edges.length-1};
}
export function clumpOf(id,c,r,forced=null){const rule=clumpRule(id,r);if(!rule)return {id:id+'/0',index:0,count:1};let index=forced?Number(forced.split('/').at(-1)):rule.edges.findIndex((v,i)=>i>0&&c[rule.axis]<v)-1;if(!forced&&index<0)index=rule.count-1;if(!Number.isInteger(index)||index<0||index>=rule.count)throw Error('子束归属无效');const min=rule.edges[index],max=rule.edges[index+1];return {id:id+'/'+index,index,count:rule.count,axis:rule.axis,min,max,center:(min+max)*.5};}
