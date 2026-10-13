// Source-derived floor enclosures. They are ray-jump guards, never surfaces.
import {STATION_SCORE} from './station-score.mjs';
import {terminalHallFloorBounds} from './native-terminal-hall.mjs';
import {stationWaterfrontFloorBounds} from './native-station-waterfront.mjs';
export function stationFloorBounds({construction=null}={}){
 const score=STATION_SCORE,{shed,site}=score,host=construction?.host,deck=host?.boardingIsland.topLocalYM??.85;
 const out=[...terminalHallFloorBounds({...score.hall,deck}).map(b=>({...b,id:'terminal-'+b.id})),...stationWaterfrontFloorBounds({site}).map(b=>({...b,id:'waterfront-'+b.id}))];
 const slab=(id,c,h)=>out.push({id,min:c.map((v,i)=>v-h[i]-.001),max:c.map((v,i)=>v+h[i]+.001)});
 for(let i=0;i<4;i++){let x=-30+i*20,half=3.4;if(host&&x===10){x=host.boardingIsland.centerLocalXM;half=host.boardingIsland.halfWidthM;}slab('platform-'+i,[x,.275,shed.front-shed.length/2],[half,.575,shed.length/2+1.3]);}
 slab('goods',[site.goods.centerX+1.7,.275,site.goods.front-site.goods.length/2],[4.7,.575,site.goods.length/2+.6]);
 slab('passenger-walk',[49,.275,13],[18,.575,1.8]);slab('forecourt',[0,.275,11.8],[31.2,.575,3]);
 return out;
}
const f=n=>Number.isInteger(n)?n+'.':String(n),v=a=>`vec3<f32>(${a.map(f).join(',')})`;
export function stationFloorAdvanceWGSL(options={}){
 const b=stationFloorBounds(options);let s='fn floorAdvance(p:vec3<f32>,rd:vec3<f32>,h:HitField)->f32{if(h.id!=17u){return 0.;}var near=1e5;\n';
 for(const q of b){const c=q.min.map((x,i)=>(x+q.max[i])/2),h=q.min.map((x,i)=>(q.max[i]-x)/2);s+=`// ${q.id}\n{let entry=floorRayBox(p,rd,${v(c)},${v(h)});if(entry<0.){return 0.;}near=min(near,entry);}\n`;}
 return s+'let other=max(0.,stationDomain(p,false,true).d-.03)*.60;return min(near*.98,other);}\n';
}
