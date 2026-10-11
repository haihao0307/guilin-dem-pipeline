import {replay,ROLE_COMMANDS} from '../session.mjs';
import recipe from './recipe.mjs';
import design from './design.mjs';
import {A4_DIMENSIONS} from './dimensions.mjs';
import {A4_GAME_PARAMETERS} from '../physics/parameters.mjs';
import {DEPENDENCIES} from '../codec/dependency-manifest.mjs';
import {PROFILE,MAX_FILE_BYTES,encodeEnvelope,decodeEnvelope,canonical,sha256,validateData,formatInfo} from '../codec/sqlite-envelope.mjs';
export {formatInfo,MAX_FILE_BYTES};
const clone=x=>structuredClone(x),equal=(a,b)=>canonical(a)===canonical(b);
function exactKeys(x,keys,label){if(!x||typeof x!=='object'||Array.isArray(x)||!equal(Object.keys(x).sort(),keys.slice().sort()))throw new Error('SAVE_SCHEMA_KEYS:'+label);}
export const BRANDING_PARAMETERS=Object.freeze({rule:'native-a4/branding/install.mjs',assets:['wordmark.mjs','wordmark-gold.mjs','angel_left.mjs','angel_right.mjs','company_plaque-gold.mjs','number88.mjs'],palette:{gold:0xd6aa61,red:0xa22515,green:0x142b22},wordmarkWidthM:6,tenderAngelWidthM:3.5,cabCompanyWidthM:.45,cabNumberWidthM:.55,noseNumberWidthM:.30,coachWordmarkWidthM:4.8,coachAngelWidthM:1.45,coachCompanyWidthM:.75,tailWordmarkWidthM:2.2,tailCompanyWidthM:1.05,tailAngelWidthM:1.30,scope:'Current original-source contour assets and exact pinned placement rule; no raster or mesh payload in this save'});
export function appearanceRecipe(){return clone({identity:'Flying Hongkonger 88',shape:recipe,dimensions:A4_DIMENSIONS,mechanism:design,physics:A4_GAME_PARAMETERS,branding:BRANDING_PARAMETERS});}
export function pinnedDependencies(){return clone(DEPENDENCIES);}
export async function verifyDependencyBytes(available){for(const d of DEPENDENCIES){const raw=available?.[d.id];if(!(raw instanceof Uint8Array)&&!(raw instanceof ArrayBuffer))throw new Error('MISSING_GAME_RULE_BYTES:'+d.id);const bytes=raw instanceof ArrayBuffer?new Uint8Array(raw.slice(0)):raw.slice();if(await sha256(bytes)!==d.sha256)throw new Error('GAME_RULE_HASH_MISMATCH:'+d.id);}return true;}
let verification=null;
/** Browser-only source verification. Node callers supply dependencyBytes instead. */
export async function verifyRuntimeDependencies(){
 if(!verification)verification=(async()=>{const bytes={};await Promise.all(DEPENDENCIES.map(async d=>{const url=new URL('../'+d.path,import.meta.url),r=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw new Error('GAME_RULE_FETCH_FAILED:'+d.id);bytes[d.id]=new Uint8Array(await r.arrayBuffer());}));return verifyDependencyBytes(bytes);})().catch(e=>{verification=null;throw e;});
 return verification;
}
async function verifyOptions(options){if(options.dependencyBytes)await verifyDependencyBytes(options.dependencyBytes);else await verifyRuntimeDependencies();}
export function validatePacket(packet){
 validateData(packet);exactKeys(packet,['version','physicsModel','config','ticks','inputs'],'packet');
 if(packet.version!==2||packet.physicsModel!=='FH88_A4_SI_R01')throw new Error('INCOMPATIBLE_GAME_PHYSICS_VERSION');
 exactKeys(packet.config,['line','seed','routeCount','durationMinutes'],'config');const c=packet.config;
 if(!['legacy','kcr1'].includes(c.line)||typeof c.seed!=='string'||c.seed.length>256||!Number.isInteger(c.routeCount)||!(c.line==='kcr1'?c.routeCount===9:[6,180].includes(c.routeCount))||![10,15,20].includes(c.durationMinutes))throw new Error('INVALID_GAME_CONFIG');
 if(!Number.isInteger(packet.ticks)||packet.ticks<0||packet.ticks>108000||!Array.isArray(packet.inputs)||packet.inputs.length>50000)throw new Error('GAME_REPLAY_BUDGET_LIMIT');
 let previousTick=-1,previousSequence=0;
 for(const input of packet.inputs){exactKeys(input,['version','tick','sequence','actorId','role','type','value'],'input');
  if(input.version!==1||!Number.isInteger(input.tick)||input.tick<previousTick||input.tick>packet.ticks||!Number.isInteger(input.sequence)||input.sequence<=previousSequence||input.sequence>1e9||input.role!=='driver'||typeof input.actorId!=='string'||input.actorId.length>128||!ROLE_COMMANDS.driver.includes(input.type))throw new Error('INVALID_GAME_INPUT');
  if(['pause','brake'].includes(input.type)?![null,true,false].includes(input.value):input.value!==null)throw new Error('INVALID_GAME_INPUT_VALUE');
  previousTick=input.tick;previousSequence=input.sequence;
 }return true;
}
function validateManifest(value){
 exactKeys(value,['schema','version','restoreMode','dependencies','appearance','packet','verification'],'manifest');
 if(value.schema!==PROFILE||value.version!==1||value.restoreMode!=='verified-session-replay')throw new Error('UNKNOWN_GAME_SAVE_PROFILE');
 if(!equal(value.dependencies,DEPENDENCIES))throw new Error('PINNED_GAME_RULE_MISMATCH');
 if(!equal(value.appearance,appearanceRecipe()))throw new Error('GAME_APPEARANCE_OR_PARAMETER_MISMATCH');
 validatePacket(value.packet);exactKeys(value.verification,['signature','physics','stateFlags'],'verification');
 if(typeof value.verification.signature!=='string')throw new Error('GAME_SIGNATURE_REQUIRED');
 exactKeys(value.verification.stateFlags,['started','paused','finishing','door'],'stateFlags');
 return true;
}
function replayVerified(value){
 let session;try{session=replay(value.packet);}catch(e){throw new Error('GAME_REPLAY_FAILED:'+e.message);}
 const view=session.view(),flags={started:view.started,paused:view.paused,finishing:view.finishing,door:view.door};
 if(session.signature()!==value.verification.signature||!equal(view.physics,value.verification.physics)||!equal(flags,value.verification.stateFlags))throw new Error('GAME_REPLAY_STATE_MISMATCH');
 return session;
}
/** Capture synchronously before any await; caller can keep the live game running. */
export async function encodeGame(session,options={}){
 const packet=session.replayPacket();validatePacket(packet);
 const view=session.view(),value={schema:PROFILE,version:1,restoreMode:'verified-session-replay',dependencies:pinnedDependencies(),appearance:appearanceRecipe(),packet:clone(packet),verification:{signature:session.signature(),physics:clone(view.physics),stateFlags:{started:view.started,paused:view.paused,finishing:view.finishing,door:view.door}}};
 validateManifest(value);await verifyOptions(options);replayVerified(value);return encodeEnvelope(value);
}
/** Pure candidate decode. Never touches the live game. Parent may atomically replace
 * it only after success; the returned Session reproduces saved running/paused state.
 * UI may then explicitly pause through Session.command, preserving replay history.
 */
export async function decodeGame(bytes,options={}){
 const value=await decodeEnvelope(bytes);validateManifest(value);await verifyOptions(options);
 const session=replayVerified(value);
 return {packet:clone(value.packet),session,appearance:clone(value.appearance),dependencies:pinnedDependencies(),verification:clone(value.verification),restoreMode:value.restoreMode};
}
export async function decodeGameFile(file,options={}){if(!file||typeof file.arrayBuffer!=='function'||file.size!==MAX_FILE_BYTES)throw new Error('SAVE_FILE_SIZE_MISMATCH');return decodeGame(await file.arrayBuffer(),options);}
