// One deterministic SI clock. Cargo never shares the public floor.
export const REVISION='LPB-R01-machine-20261011';
export const SOURCES=['rail','air','sea'];
export const SOURCE_NAMES=['鐵路轉運','航空轉運','船運轉運'];
export const SOURCE_X=[-12,-5,2], SOURCE_Z=[-2,-4,-6], LEVELS=[3.2,7.2,11.2];
export const BUILDING={width:44,depth:38,height:21,units:'metre',floor:[0,6,12],publicZone:{min:[-20,0,10],max:[20,5.5,18]},machineZone:{min:[-21,0,-18],max:[21,17,8.8]}};
export function routeFor(source){const x=SOURCE_X[source],z=SOURCE_Z[source],y=LEVELS[source],slot=10+source*3.5;return [
 {t:0,p:[x,1.6,-22],stage:'到貨'}, {t:15,p:[x,1.6,-10],stage:'登記'},
 {t:19,p:[x,1.6,-10],stage:'查驗'}, {t:29,p:[x,1.6,z],stage:'提升'},
 {t:40,p:[x,y,z],stage:'分流'}, {t:55,p:[6,y,z],stage:'庫前移載'},
 {t:61,p:[6,y,-7],stage:'上架'}, {t:70,p:[slot,y,-7],stage:'儲存'},
 {t:86,p:[slot,y,-7],stage:'提取'}, {t:94,p:[6,y,-7],stage:'回送'},
 {t:102,p:[6,y,2],stage:'回送'}, {t:112,p:[19,y,2],stage:'下降'},
 {t:122,p:[19,1.6,2],stage:'交還'}, {t:130,p:[19,1.6,8.5],stage:'已交還'} ];}
export function sampleRoute(source,age){const route=routeFor(source);if(age<0||age>=130)return null;let i=0;while(i<route.length-2&&age>=route[i+1].t)i++;const a=route[i],b=route[i+1],u=Math.max(0,Math.min(1,(age-a.t)/(b.t-a.t)));return {position:a.p.map((v,j)=>v+(b.p[j]-v)*u),stage:a.stage,segment:i,age,stored:age>=70&&age<86};}
export function snapshot(time){if(!Number.isFinite(time)||time<0||time>1e7)throw Error('Invalid simulation seconds');const packages=[],counts={rail:0,air:0,sea:0,stored:0,delivered:0};for(let source=0;source<3;source++){const first=source*9;for(let n=Math.max(0,Math.floor((time-first-130)/81));n<=Math.floor((time-first)/81);n++){const born=first+n*81,age=time-born;if(age>=130){counts.delivered++;continue;}const q=sampleRoute(source,age);if(q){packages.push({id:`${SOURCES[source].toUpperCase()}-${String(n+1).padStart(3,'0')}`,source,...q});counts[SOURCES[source]]++;if(q.stored)counts.stored++;}}counts.delivered+=Math.max(0,Math.floor((time-first-130)/81));}return {time,packages,counts,power:1,shaftAngle:time*1.35,units:'metre',pressureModel:'abstract mechanical demonstration; no real pressure-vessel design'};}
export class BureauClock{constructor(time=68){this.time=time;this.paused=false;this.speed=1;}advance(seconds){if(!Number.isFinite(seconds)||seconds<0)throw Error('Invalid dt');if(!this.paused)this.time+=seconds*this.speed;return this.state();}state(){return {...snapshot(this.time),paused:this.paused,speed:this.speed};}reset(){this.time=0;this.paused=true;return this.state();}seek(seconds){snapshot(seconds);this.time=seconds;return this.state();}}
