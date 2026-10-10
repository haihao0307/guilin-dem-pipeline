/** FH88 controlled SQLite-envelope codec; experimental, not general KAOPU support.
 * No SQL, WASM, dependency downloads, evaluation, network, or incoming executable code.
 * SHA256 detects corruption; this is NOT cryptographic author authentication.
 */
import {LAYOUT, TEMPLATE_BASE64} from './template-data.mjs';
import DEFAULT_PARAMETERS from './default-parameters.mjs';
import {DrivingPhysics, validateParameters} from './frozen/driving-physics.mjs';
export const PROFILE = LAYOUT.profile;
export const MAX_FILE_BYTES = LAYOUT.fileBytes;
export const MAX_PAYLOAD_BYTES = LAYOUT.capacityBytes;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal:true});
const copy = x => structuredClone(x);
const fail = (code, detail='') => {throw new Error(code+(detail?':'+detail:''));};
const SOURCE_PAYLOAD_KEYS=new Set(['positions','indices','bufferviews','accessors','imagepayload','fieldpayload','vertices','normals','uvs','imagedata','texturedata','vertexdata','meshdata','animationsamples','sampledpositions','keyframes','arraybuffer','binarypayload']);
const BASE = Uint8Array.from(atob(TEMPLATE_BASE64), c=>c.charCodeAt(0));
const mutable = new Uint8Array(BASE.length);
for(const s of LAYOUT.segments)mutable.fill(1,s.fileOffset,s.fileOffset+s.length);
mutable.fill(1,LAYOUT.digestOffset,LAYOUT.digestOffset+64);
const eq = (a,b) => canonical(a)===canonical(b);
function canonical(x){
 if(x===null||typeof x!=='object')return Object.is(x,-0)?'-0':JSON.stringify(x);
 if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';
 return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';
}
function jsonData(value){
 let nodes=0;
 const visit=(x,depth)=>{
  if(++nodes>16000||depth>20)fail('DATA_COMPLEXITY_LIMIT');
  if(x===null||typeof x==='boolean')return;
  if(typeof x==='number'){if(!Number.isFinite(x))fail('NON_FINITE_NUMBER');return;}
  if(typeof x==='string'){if(x.length>8192)fail('STRING_TOO_LONG');if(/^\s*data:/i.test(x)||(x.length>=512&&x.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(x)))fail('SOURCE_PAYLOAD_FORBIDDEN');return;}
  if(typeof x!=='object')fail('NON_JSON_VALUE');
  if(Array.isArray(x)){if(x.length>64)fail('ARRAY_TOO_LONG');for(let i=0;i<x.length;i++){if(!(i in x))fail('SPARSE_ARRAY');visit(x[i],depth+1);}return;}
  if(Object.getPrototypeOf(x)!==Object.prototype&&Object.getPrototypeOf(x)!==null)fail('PLAIN_OBJECT_REQUIRED');
  const keys=Reflect.ownKeys(x);if(keys.length>256)fail('TOO_MANY_OBJECT_KEYS');
  for(const key of keys){if(typeof key!=='string'||key.length>128||['__proto__','prototype','constructor'].includes(key))fail('INVALID_OBJECT_KEY');if(SOURCE_PAYLOAD_KEYS.has(key.replace(/[-_]/g,'').toLowerCase()))fail('SOURCE_PAYLOAD_FORBIDDEN',key);const d=Object.getOwnPropertyDescriptor(x,key);if(!d.enumerable||!('value'in d))fail('PLAIN_JSON_PROPERTY_REQUIRED');visit(d.value,depth+1);}
 };
 visit(value,0);
 return value;
}
function keys(value, allowed, path){
 if(!value||typeof value!=='object'||Array.isArray(value)||!eq(Object.keys(value).sort(),[...allowed].sort()))fail('SCHEMA_KEYS',path);
}
function sameShape(value, model, path){
 if(model&&typeof model==='object'&&!Array.isArray(model)){
  keys(value,Object.keys(model),path);
  for(const k of Object.keys(model))sameShape(value[k],model[k],path+'.'+k);
 }else if(typeof value!==typeof model)fail('PARAMETER_TYPE',path);
}
function finiteTree(x){if(typeof x==='number'&&!Number.isFinite(x))fail('DERIVED_STATE_NON_FINITE');if(x&&typeof x==='object')for(const v of Object.values(x))finiteTree(v);}
export function pinnedDependencies(){return copy(LAYOUT.static.dependencies);}
export function mechanismIdentity(){return copy(LAYOUT.static.mechanism);}
export function defaultParameters(){return copy(DEFAULT_PARAMETERS);}
export function validateRecipe(recipe){
 jsonData(recipe);
 keys(recipe,['schema','profileVersion','restoreMode','identity','dependencies','parameters','initial','scene','mechanism','archivedSnapshot'],'recipe');
 if(recipe.schema!==PROFILE||recipe.profileVersion!==1)fail('UNKNOWN_PROFILE');
 if(recipe.restoreMode!=='restart-recipe-only')fail('UNSUPPORTED_RESTORE_MODE');
 keys(recipe.identity,['instanceId','assemblyId'],'identity');
 if(typeof recipe.identity.instanceId!=='string'||!/^[-A-Za-z0-9_.:]{1,96}$/.test(recipe.identity.instanceId))fail('INVALID_INSTANCE_ID');
 if(recipe.identity.assemblyId!=='FH88_METRIC_ASSEMBLY_R04')fail('UNKNOWN_ASSEMBLY');
 if(!eq(recipe.dependencies,LAYOUT.static.dependencies))fail('RULE_DEPENDENCY_MISMATCH');
 if(!eq(recipe.mechanism,LAYOUT.static.mechanism))fail('PART_OR_CONNECTION_IDENTITY_MISMATCH');
 sameShape(recipe.parameters,DEFAULT_PARAMETERS,'parameters');
 for(const group of ['clock','train','engine','supply','rail'])for(const v of Object.values(recipe.parameters[group]))if(Math.abs(v)>1e12)fail('PARAMETER_MAGNITUDE_LIMIT');
 if(recipe.parameters.clock.maxStepsPerAdvance>120000)fail('STEP_BUDGET_LIMIT');
 validateParameters(recipe.parameters);
 const p=recipe.parameters;
 if(p.train.wheelDiameterM!==1.9||p.engine.cylinderCount!==3||p.engine.strokeM!==.711)fail('MECHANISM_PARAMETER_MISMATCH');
 keys(recipe.initial,['positionM','speedMps','pressurePa','coalKg','waterKg','controls'],'initial');
 if(Math.abs(recipe.initial.positionM)>1e9)fail('INITIAL_POSITION_LIMIT');
 keys(recipe.initial.controls,Object.keys(DEFAULT_PARAMETERS.initialControls),'initial.controls');
 const physics=new DrivingPhysics(p);
 finiteTree(physics.reset(recipe.initial));
 keys(recipe.scene,['paused','view'],'scene');
 if(recipe.scene.paused!==true)fail('RELOAD_MUST_START_PAUSED');
 keys(recipe.scene.view,['mode','camera'],'scene.view');
 if(!['full','mechanism'].includes(recipe.scene.view.mode)||!['overview','side','inside','cab'].includes(recipe.scene.view.camera))fail('UNKNOWN_VIEW');
 if(recipe.archivedSnapshot!==null){
  keys(recipe.archivedSnapshot,['purpose','capturedAtSimulationTimeS','unifiedInstance'],'archivedSnapshot');
  if(recipe.archivedSnapshot.purpose!=='inspection-only-not-restored')fail('ARCHIVE_RESTORE_FORBIDDEN');
  const t=recipe.archivedSnapshot.capturedAtSimulationTimeS;
  if(typeof t!=='number'||!Number.isFinite(t)||t<0)fail('ARCHIVE_TIME_INVALID');
  if(!recipe.archivedSnapshot.unifiedInstance||typeof recipe.archivedSnapshot.unifiedInstance!=='object'||Array.isArray(recipe.archivedSnapshot.unifiedInstance))fail('ARCHIVE_OBJECT_REQUIRED');
 }
 return true;
}
/** Save explicit initial recipe and optional full live snapshot for inspection only.
 * Never infer restart conditions from a running snapshot. User reload always pauses.
 */
export function createRestartRecipe(parameters=defaultParameters(), options={}){
 jsonData(parameters);jsonData(options);
 for(const k of Object.keys(options))if(!['instanceId','initial','view','archivedSnapshot','capturedAtSimulationTimeS'].includes(k))fail('UNKNOWN_OPTION',k);
 const p=copy(parameters), initial=options.initial??{};
 for(const k of Object.keys(initial))if(!['positionM','speedMps','pressurePa','coalKg','waterKg','controls'].includes(k))fail('UNKNOWN_INITIAL_FIELD',k);
 const archive=options.archivedSnapshot??null;
 if(archive===null&&options.capturedAtSimulationTimeS!==undefined)fail('ARCHIVE_TIME_WITHOUT_SNAPSHOT');
 const result={schema:PROFILE,profileVersion:1,restoreMode:'restart-recipe-only',
  identity:{instanceId:options.instanceId??'fh88-main',assemblyId:'FH88_METRIC_ASSEMBLY_R04'},
  dependencies:pinnedDependencies(),parameters:p,
  initial:{positionM:initial.positionM??0,speedMps:initial.speedMps??0,pressurePa:initial.pressurePa??p.supply.initialPressurePa,coalKg:initial.coalKg??p.supply.coalInitialKg,waterKg:initial.waterKg??p.supply.waterInitialKg,controls:{...p.initialControls,...initial.controls}},
  scene:{paused:true,view:{mode:'full',camera:'overview',...options.view}},mechanism:mechanismIdentity(),
  archivedSnapshot:archive===null?null:{purpose:'inspection-only-not-restored',capturedAtSimulationTimeS:options.capturedAtSimulationTimeS??archive.physics?.timeS??archive.timeS??0,unifiedInstance:copy(archive)}};
 validateRecipe(result);return result;
}
async function sha256(bytes){
 if(!globalThis.crypto?.subtle)fail('WEB_CRYPTO_REQUIRED_USE_SECURE_CONTEXT');
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}
function bytesOf(input){
 // Snapshot caller memory so mutation across await cannot change verified content.
 if(input instanceof ArrayBuffer){if(input.byteLength!==MAX_FILE_BYTES)fail('FILE_SIZE_MISMATCH');return new Uint8Array(input.slice(0));}
 if(input instanceof Uint8Array){if(input.byteLength!==MAX_FILE_BYTES)fail('FILE_SIZE_MISMATCH');return input.slice();}
 fail('UINT8ARRAY_OR_ARRAYBUFFER_REQUIRED');
}
/** Uint8Array containing a real SQLite database; do not stringify this result. */
export async function encode(recipe){
 validateRecipe(recipe);
 const json=encoder.encode(canonical(recipe));
 if(json.byteLength>MAX_PAYLOAD_BYTES)fail('PAYLOAD_TOO_LARGE');
 const payload=new Uint8Array(MAX_PAYLOAD_BYTES).fill(32);payload.set(json);
 const hash=await sha256(payload), out=BASE.slice();
 for(const s of LAYOUT.segments)out.set(payload.subarray(s.logicalOffset,s.logicalOffset+s.length),s.fileOffset);
 out.set(encoder.encode(hash),LAYOUT.digestOffset);
 return out;
}
/** Strict fixed-layout decoder. Other valid SQLite/KAOPU profiles are rejected.
 * The result includes every archived snapshot field. Nothing from it is restored.
 */
export async function decode(input){
 const raw=bytesOf(input);
 if(decoder.decode(raw.subarray(0,16))!=='SQLite format 3\0')fail('BAD_SQLITE_SIGNATURE');
 for(let i=0;i<raw.length;i++)if(!mutable[i]&&raw[i]!==BASE[i])fail('IMMUTABLE_CONTAINER_MISMATCH',String(i));
 const payload=new Uint8Array(MAX_PAYLOAD_BYTES);
 for(const s of LAYOUT.segments)payload.set(raw.subarray(s.fileOffset,s.fileOffset+s.length),s.logicalOffset);
 const expected=decoder.decode(raw.subarray(LAYOUT.digestOffset,LAYOUT.digestOffset+64));
 if(!/^[0-9a-f]{64}$/.test(expected))fail('ASSET_HASH_FORMAT');
 if(await sha256(payload)!==expected)fail('ASSET_HASH_MISMATCH');
 let recipe;
 try{recipe=JSON.parse(decoder.decode(payload));}catch{fail('INVALID_JSON_PAYLOAD');}
 validateRecipe(recipe);
 const canonicalBytes=encoder.encode(canonical(recipe));
 if(canonicalBytes.length>MAX_PAYLOAD_BYTES)fail('PAYLOAD_TOO_LARGE');
 for(let i=0;i<payload.length;i++)if(payload[i]!==((i<canonicalBytes.length)?canonicalBytes[i]:32))fail('NON_CANONICAL_PAYLOAD');
 return recipe;
}
/** Files are size-checked before allocation. No MIME/extension trust. */
export async function decodeFile(file){
 if(!file||typeof file.arrayBuffer!=='function'||file.size!==MAX_FILE_BYTES)fail('FILE_SIZE_MISMATCH');
 return decode(await file.arrayBuffer());
}
/** Pure restart plan. Caller must explicitly reset/recreate the simulator and pause.
 * archivedSnapshot is returned separately to retain diagnostics across subsequent saves.
 */
export function restartPlan(recipe){
 validateRecipe(recipe);
 return {parameters:copy(recipe.parameters),initial:copy(recipe.initial),view:copy(recipe.scene.view),paused:true,
  identity:copy(recipe.identity),mechanism:copy(recipe.mechanism),dependencies:copy(recipe.dependencies),
  archivedSnapshot:copy(recipe.archivedSnapshot),restoreMode:'restart-recipe-only',
  warnings:recipe.archivedSnapshot?['已保留完整运行快照供查看；本轮不恢复中途热状态、动力状态或积分器状态。重载将按初始配方复位并暂停。']:['重载将按初始配方复位并暂停。']};
}
/** Verify actual already-loaded rule bytes before applying a restart plan.
 * Map every pinned dependency id to Uint8Array or ArrayBuffer; no fetch or execution.
 */
export async function verifyDependencyBytes(available){
 for(const d of LAYOUT.static.dependencies){const b=available?.[d.id];if(!(b instanceof Uint8Array)&&!(b instanceof ArrayBuffer))fail('MISSING_RULE_BYTES',d.id);if(await sha256(b)!==d.sha256)fail('LOADED_RULE_HASH_MISMATCH',d.id);}
 return true;
}
export const formatInfo = Object.freeze({profile:PROFILE,container:'SQLite KAOPU prototype envelope',profileVersion:1,fileBytes:MAX_FILE_BYTES,payloadCapacityBytes:MAX_PAYLOAD_BYTES,restoreMode:'restart-recipe-only',oldDesktopImageReaderSupported:false,oldFunctionalRailReaderSupported:false,generalKAOPUSupport:false,authentication:false});
