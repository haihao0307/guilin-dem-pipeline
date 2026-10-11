/** Independent PLANT_FUNCTION_R04 experimental profile, not a universal KAOPU reader.
 * Real SQLite fixed envelope + physical BLOB slices, adapted from FH88 codec R04.
 * No SQL/WASM/network/eval/new dependency. Nothing here mutates a scene.
 * SHA256 is integrity, not authentication. Serve over HTTPS/localhost for WebCrypto.
 */
import {LAYOUT as generatedLayout, TEMPLATE_BASE64} from './template-data.mjs';
const LAYOUT=structuredClone(generatedLayout); // Do not expose mutable validation pins.
export const PROFILE=LAYOUT.profile;
export const MAX_FILE_BYTES=LAYOUT.fileBytes;
export const MAX_PAYLOAD_BYTES=LAYOUT.capacityBytes;
const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
const BASE=Uint8Array.from(atob(TEMPLATE_BASE64),c=>c.charCodeAt(0));
const mutable=new Uint8Array(BASE.length);
for(const s of LAYOUT.segments)mutable.fill(1,s.fileOffset,s.fileOffset+s.length);
mutable.fill(1,LAYOUT.digestOffset,LAYOUT.digestOffset+64);
const copy=x=>structuredClone(x);
const fail=(code,detail='')=>{throw new Error(code+(detail?':'+detail:''));};
const forbidden=new Set(['url','code','script','mesh','meshes','vertex','vertices','positions','indices','bufferviews','accessors','pixels','imagepayload','fieldpayload','normals','uvs','imagedata','texturedata','vertexdata','meshdata','animationsamples','sampledpositions','keyframes','arraybuffer','binarypayload']);
function canonical(x){
 if(x===null||typeof x!=='object')return JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
const eq=(a,b)=>canonical(a)===canonical(b);
function jsonData(value){
 let nodes=0;
 const visit=(x,depth)=>{
  if(++nodes>4096||depth>12)fail('DATA_COMPLEXITY_LIMIT');
  if(x===null||typeof x==='boolean')return;
  if(typeof x==='number'){if(!Number.isFinite(x))fail('NON_FINITE_NUMBER');return;}
  if(typeof x==='string'){if(x.length>2048)fail('STRING_TOO_LONG');if(/^\s*(data|javascript|blob):/i.test(x))fail('SOURCE_PAYLOAD_FORBIDDEN');return;}
  if(typeof x!=='object')fail('NON_JSON_VALUE');
  if(Array.isArray(x)){
   if(Object.getPrototypeOf(x)!==Array.prototype||x.length>64)fail('ARRAY_SHAPE_LIMIT');
   if(Reflect.ownKeys(x).length!==x.length+1)fail('ARRAY_EXTRA_PROPERTIES');
   for(let i=0;i<x.length;i++){const d=Object.getOwnPropertyDescriptor(x,String(i));if(!d||!d.enumerable||!('value'in d))fail('PLAIN_ARRAY_PROPERTY_REQUIRED');visit(d.value,depth+1);}return;
  }
  if(Object.getPrototypeOf(x)!==Object.prototype&&Object.getPrototypeOf(x)!==null)fail('PLAIN_OBJECT_REQUIRED');
  const all=Reflect.ownKeys(x);if(all.length>64)fail('TOO_MANY_OBJECT_KEYS');
  for(const key of all){
   if(typeof key!=='string'||key.length>128||['__proto__','prototype','constructor'].includes(key))fail('INVALID_OBJECT_KEY');
   if(forbidden.has(key.replace(/[-_]/g,'').toLowerCase()))fail('SOURCE_PAYLOAD_FORBIDDEN',key);
   const d=Object.getOwnPropertyDescriptor(x,key);if(!d.enumerable||!('value'in d))fail('PLAIN_JSON_PROPERTY_REQUIRED');visit(d.value,depth+1);
  }
 };
 visit(value,0);return value;
}
function keys(value,allowed,path){
 if(!value||typeof value!=='object'||Array.isArray(value)||!eq(Object.keys(value).sort(),[...allowed].sort()))fail('SCHEMA_KEYS',path);
}
function optionalKeys(value,allowed,path){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('OBJECT_REQUIRED',path);
 for(const k of Object.keys(value))if(!allowed.includes(k))fail('UNKNOWN_OPTION',path+'.'+k);
}
export function pinnedDependencies(){return copy(LAYOUT.static.dependencies);}
export function pinnedResources(){return copy(LAYOUT.static.resources);}
export function defaultProfile(){return copy(LAYOUT.static.profile76);}
export function validateRecipe(recipe){
 jsonData(recipe);
 keys(recipe,['schema','profileVersion','operator','ruleSet','dependencies','source','profile','units','instance','motion','resources','metadata'],'recipe');
 const pinned=LAYOUT.static;
 if(recipe.schema!==PROFILE||recipe.profileVersion!==1)fail('UNKNOWN_PROFILE');
 if(recipe.operator!==pinned.operator||recipe.ruleSet!==pinned.ruleSet)fail('UNKNOWN_OPERATOR');
 if(!eq(recipe.dependencies,pinned.dependencies))fail('RULE_DEPENDENCY_MISMATCH');
 if(!eq(recipe.source,pinned.source))fail('SOURCE_CLOSURE_MISMATCH');
 if(!eq(recipe.profile,pinned.profile76))fail('UNTESTED_PLANT_PROFILE');
 if(!eq(recipe.units,pinned.units))fail('UNSUPPORTED_UNITS_OR_SCALE');
 if(!eq(recipe.resources,pinned.resources))fail('RESOURCE_DEPENDENCY_MISMATCH');
 if(!eq(recipe.metadata,pinned.metadata))fail('METADATA_MISMATCH');
 keys(recipe.instance,['id','positionM','yawRadians'],'instance');
 const inst=recipe.instance;
 if(typeof inst.id!=='string'||!/^[-A-Za-z0-9_.]{1,96}$/.test(inst.id))fail('INVALID_INSTANCE_ID');
 if(!Array.isArray(inst.positionM)||inst.positionM.length!==3||inst.positionM.some(v=>typeof v!=='number'||Math.abs(v)>100000))fail('INVALID_POSITION_METRES');
 if(typeof inst.yawRadians!=='number'||Math.abs(inst.yawRadians)>Math.PI*2)fail('INVALID_YAW_RADIANS');
 keys(recipe.motion,['timeSource','timeUnit','model','strength'],'motion');
 if(recipe.motion.timeSource!=='host.elapsed'||recipe.motion.timeUnit!=='second'||recipe.motion.model!=='native76')fail('HOST_CLOCK_REQUIRED');
 if(typeof recipe.motion.strength!=='number'||recipe.motion.strength<0||recipe.motion.strength>1)fail('INVALID_MOTION_STRENGTH');
 return true;
}
/** Only tested native seed 761014 / juvenile / sheltered is admitted in this release.
 * Options may override instance id/placement/yaw and native wind strength [0,1].
 * A supplied profile must equal the complete pinned Profile76, not partial settings.
 */
export function createPlantRecipe(options={}){
 jsonData(options);optionalKeys(options,['profile','instance','motion'],'options');
 if(options.instance!==undefined)optionalKeys(options.instance,['id','positionM','yawRadians'],'instance');
 if(options.motion!==undefined)optionalKeys(options.motion,['timeSource','timeUnit','model','strength'],'motion');
 const p=LAYOUT.static;
 const result={schema:PROFILE,profileVersion:1,operator:p.operator,ruleSet:p.ruleSet,
  dependencies:pinnedDependencies(),source:copy(p.source),profile:copy(options.profile===undefined?p.profile76:options.profile),units:copy(p.units),
  instance:{id:'station-rear-young-ficus',positionM:[-56.2,0.081,-9],yawRadians:0,...copy(options.instance??{})},
  motion:{timeSource:'host.elapsed',timeUnit:'second',model:'native76',strength:0.25,...copy(options.motion??{})},
  resources:pinnedResources(),metadata:copy(p.metadata)};
 validateRecipe(result);return result;
}
async function sha256(bytes){
 if(!globalThis.crypto?.subtle)fail('WEB_CRYPTO_REQUIRED_USE_SECURE_CONTEXT');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
}
function bytesOf(input){
 if(input instanceof ArrayBuffer){if(input.byteLength!==MAX_FILE_BYTES)fail('FILE_SIZE_MISMATCH');return new Uint8Array(input.slice(0));}
 if(input instanceof Uint8Array&&input.buffer instanceof ArrayBuffer){if(input.byteLength!==MAX_FILE_BYTES)fail('FILE_SIZE_MISMATCH');return Uint8Array.from(input);}
 fail('UINT8ARRAY_OR_ARRAYBUFFER_REQUIRED');
}
/** Returns actual SQLite bytes, never JSON with a renamed suffix. */
export async function encode(recipe){
 validateRecipe(recipe);
 const json=encoder.encode(canonical(recipe));
 if(json.byteLength>MAX_PAYLOAD_BYTES)fail('PAYLOAD_TOO_LARGE');
 const payload=new Uint8Array(MAX_PAYLOAD_BYTES).fill(32);payload.set(json);
 const hash=await sha256(payload),out=BASE.slice();
 for(const s of LAYOUT.segments)out.set(payload.subarray(s.logicalOffset,s.logicalOffset+s.length),s.fileOffset);
 out.set(encoder.encode(hash),LAYOUT.digestOffset);return out;
}
/** Validate only. No loading, fetching, evaluation, mesh generation or scene mutation. */
export async function decode(input){
 const raw=bytesOf(input);
 for(let i=0;i<16;i++)if(raw[i]!==BASE[i])fail('BAD_SQLITE_SIGNATURE');
 for(let i=0;i<raw.length;i++)if(!mutable[i]&&raw[i]!==BASE[i])fail('IMMUTABLE_CONTAINER_MISMATCH',String(i));
 const payload=new Uint8Array(MAX_PAYLOAD_BYTES);
 for(const s of LAYOUT.segments)payload.set(raw.subarray(s.fileOffset,s.fileOffset+s.length),s.logicalOffset);
 let expected;try{expected=decoder.decode(raw.subarray(LAYOUT.digestOffset,LAYOUT.digestOffset+64));}catch{fail('ASSET_HASH_FORMAT');}
 if(!/^[0-9a-f]{64}$/.test(expected))fail('ASSET_HASH_FORMAT');
 if(await sha256(payload)!==expected)fail('ASSET_HASH_MISMATCH');
 let recipe;try{recipe=JSON.parse(decoder.decode(payload));}catch{fail('INVALID_JSON_PAYLOAD');}
 validateRecipe(recipe);
 const json=encoder.encode(canonical(recipe));
 for(let i=0;i<payload.length;i++)if(payload[i]!==((i<json.length)?json[i]:32))fail('NON_CANONICAL_PAYLOAD');
 return recipe;
}
/** Reject oversized File/Blob before allocation. Extension and MIME are not trusted. */
export async function decodeFile(file){
 if(!file||typeof file.arrayBuffer!=='function'||file.size!==MAX_FILE_BYTES)fail('FILE_SIZE_MISMATCH');
 return decode(await file.arrayBuffer());
}
async function verifyBytes(available,pins,kind){
 if(!available||typeof available!=='object'||Array.isArray(available))fail('BYTE_MAP_REQUIRED');
 // Snapshot every input before the first await so caller mutation cannot mix releases.
 const snapshots=pins.map(d=>{
  const prop=Object.getOwnPropertyDescriptor(available,d.id);
  if(!prop||!('value'in prop))fail('MISSING_'+kind+'_BYTES',d.id);
  const b=prop.value;
  if(!(b instanceof Uint8Array)&&!(b instanceof ArrayBuffer))fail('MISSING_'+kind+'_BYTES',d.id);
  if(b.byteLength!==d.bytes)fail('LOADED_'+kind+'_SIZE_MISMATCH',d.id);
  if(b instanceof Uint8Array&&!(b.buffer instanceof ArrayBuffer))fail('UNSHARED_BYTES_REQUIRED',d.id);
  return b instanceof ArrayBuffer?new Uint8Array(b.slice(0)):Uint8Array.from(b);
 });
 for(let i=0;i<pins.length;i++)if(await sha256(snapshots[i])!==pins[i].sha256)fail('LOADED_'+kind+'_HASH_MISMATCH',pins[i].id);
 return true;
}
/** Hash exact already-loaded release artifacts; never fetch/import a recipe-supplied URL. */
export async function verifyDependencyBytes(map){return verifyBytes(map,LAYOUT.static.dependencies,'RULE');}
/** Hash original generated Uint8 RGBA resources before installing a candidate tree. */
export async function verifyResourceBytes(map){return verifyBytes(map,LAYOUT.static.resources,'RESOURCE');}
export const formatInfo=Object.freeze({profile:PROFILE,profileVersion:1,operator:'PLANT_FUNCTION_R04',ruleSet:'native-tropical78-ficus',
 container:'SQLite KAOPU prototype envelope',applicationId:LAYOUT.applicationId,userVersion:1,
 fileBytes:MAX_FILE_BYTES,payloadCapacityBytes:MAX_PAYLOAD_BYTES,restoreMode:'regenerate-from-profile',
 oldFH88DrivingReaderSupported:false,oldFunctionalRailReaderSupported:false,oldDesktopImageReaderSupported:false,
 generalKAOPUSupport:false,authentication:false,embeddedRecipeGeometry:false,embeddedRecipePixels:false,
 ruleResourcesIncludeCC0ProxyBarkPixels:true});
