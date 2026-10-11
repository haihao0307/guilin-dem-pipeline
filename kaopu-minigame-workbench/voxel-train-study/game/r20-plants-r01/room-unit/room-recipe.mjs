import {createRoomSurfaceRecipe} from './room-weathering.mjs';
export const ROOM_SCHEMA='kaopu.dwelling-unit/1';
export function createRoomRecipe(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||(Object.getPrototypeOf(input)!==Object.prototype&&Object.getPrototypeOf(input)!==null)||Object.values(Object.getOwnPropertyDescriptors(input)).some(d=>d.get||d.set))throw Error('Room recipe object required');
 const allowed=new Set(['schema','kind','seed','id','width','depth','height','wallThickness','ageYears','wetness','doorOpen']);for(const k of Object.keys(input))if(!allowed.has(k))throw Error('Unknown room recipe field: '+k);
 if(input.schema!=null&&input.schema!==ROOM_SCHEMA)throw Error('Unknown room schema');if(input.kind!=null&&input.kind!=='dwelling')throw Error('Unknown room kind');
 const s={schema:ROOM_SCHEMA,id:input.id??'walled-city-single-room-r01',seed:input.seed??198107,width:input.width??3.6,depth:input.depth??4.3,height:input.height??2.75,wallThickness:input.wallThickness??.18,ageYears:input.ageYears??48,wetness:input.wetness??.38,doorOpen:input.doorOpen??true};
 for(const k of ['seed','width','depth','height','wallThickness','ageYears','wetness'])if(!Number.isFinite(s[k]))throw Error('Finite room value required: '+k);
 if(s.width<3.4||s.width>4.3||s.depth<4||s.depth>4.9||s.height<2.5||s.height>3.2||s.wallThickness<.15||s.wallThickness>.25||s.ageYears<0||s.ageYears>100||s.wetness<0||s.wetness>1||typeof s.doorOpen!=='boolean')throw Error('Outside tested dwelling envelope');
 if(typeof s.id!=='string'||!/^[-a-zA-Z0-9_.]{1,96}$/.test(s.id)||!Number.isSafeInteger(s.seed)||s.seed<0||s.seed>4294967295)throw Error('Invalid room identity/seed');
 s.door={x:-.96,width:.97,height:2.05,bottom:0};
 s.frontWindow={x:.67,width:1.22,bottom:.93,height:1.12};
 s.sideWindow={z:-2.6,width:1.0,bottom:1.0,height:1.05};
 s.surface=createRoomSurfaceRecipe({seed:s.seed,wallThickness:s.wallThickness,ageYears:s.ageYears,wetness:s.wetness,rainExposure:.92,groundY:0,groundContact:true,saltExposure:.7,
 sills:[{position:[.67,.93,.13],normal:[0,0,1],width:1.30,length:1.8,strength:1},{position:[s.width/2+.12,1,-2.6],normal:[1,0,0],width:1.10,length:1.7,strength:1}],
 drips:[{position:[.01,2.14,.12],normal:[0,0,1],radius:.04,length:1.7,strength:1,rust:1},{position:[1.34,2.14,.12],normal:[0,0,1],radius:.04,length:1.6,strength:1,rust:.9},{position:[1.59,2.68,.17],normal:[0,0,1],radius:.075,length:2.55,strength:1,rust:.65},{position:[1.59,1.45,.17],normal:[0,0,1],radius:.055,length:1.35,strength:1,rust:.75}],
 rainShadows:[{position:[0,s.height-.05,.10],normal:[0,0,1],width:s.width+.2,length:.50,strength:.90},{position:[s.width/2+.09,s.height-.05,-s.depth/2],normal:[1,0,0],width:s.depth+.1,length:.18,strength:.65}],
 repairs:[{position:[-1.62,.90,.095],normal:[0,0,1],width:.30,height:.65,strength:1},{position:[1.48,1.30,.095],normal:[0,0,1],width:.20,height:.35,strength:.8}]});
 return s;
}

export const ROOM_OPERATOR="kaopu.dwelling-unit";
export function normalizeRoomScore(input){const s=createRoomRecipe(input);return Object.fromEntries([["schema",ROOM_SCHEMA],["kind","dwelling"],...["id","seed","width","depth","height","wallThickness","ageYears","wetness","doorOpen"].map(k=>[k,s[k]])]);}
export function canonicalRoomScore(input){const o=normalizeRoomScore(input);return JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a],[b])=>a.localeCompare(b))));}
