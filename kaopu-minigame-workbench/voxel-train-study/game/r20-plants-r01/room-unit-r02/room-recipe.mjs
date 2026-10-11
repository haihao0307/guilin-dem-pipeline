export const ROOM_SCHEMA='kaopu.dwelling-unit/2';
export const ROOM_OPERATOR='kaopu.dwelling-unit';
const PRESETS=['yunnan_dark_aged_v2','yunnan_warm_medium_v2','yunnan_light_weathered_v2','yunnan_lacquered_chestnut_v2'];
export function normalizeRoomScore(input={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error('Plain room recipe required');
 const allowed=new Set(['schema','kind','id','seed','width','depth','height','doorOpen','presetId','wallBindingMode']);
 for(const k of Reflect.ownKeys(input)){if(typeof k!=='string'||!allowed.has(k)||!('value' in Object.getOwnPropertyDescriptor(input,k)))throw Error('Unexpected room recipe field');}
 const s={schema:ROOM_SCHEMA,kind:'dwelling',id:'original-production-room-r02',seed:198107,width:4,depth:4,height:3,doorOpen:true,presetId:'yunnan_light_weathered_v2',wallBindingMode:'declared',...input};
 if(s.schema!==ROOM_SCHEMA||s.kind!=='dwelling'||typeof s.id!=='string'||!/^[-a-zA-Z0-9_.]{1,96}$/.test(s.id)||!Number.isSafeInteger(s.seed)||s.seed<0||s.seed>65535*100||s.width!==4||s.depth!==4||s.height!==3||typeof s.doorOpen!=='boolean'||!PRESETS.includes(s.presetId)||!['legacy','declared'].includes(s.wallBindingMode))throw Error('Outside verified native-source recipe envelope');
 return Object.freeze(s);
}
export function canonicalRoomScore(input){const s=normalizeRoomScore(input);return JSON.stringify(Object.fromEntries(Object.entries(s).sort(([a],[b])=>a.localeCompare(b))));}
