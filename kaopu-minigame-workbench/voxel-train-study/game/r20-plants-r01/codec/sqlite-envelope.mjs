/** Strict real-SQLite envelope derived from the reviewed R04 fixed-layout method.
 * It reads data only. It never runs SQL or incoming scripts. SHA256 is integrity,
 * not authentication. Other SQLite / .KaoPu profiles are intentionally rejected.
 */
import {LAYOUT,BASE_CHUNKS} from './template-data.mjs';
export const PROFILE=LAYOUT.profile,MAX_FILE_BYTES=LAYOUT.fileBytes,MAX_PAYLOAD_BYTES=LAYOUT.capacityBytes;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
let base=null,immutableRanges=null;
function template(){
 if(!base){base=new Uint8Array(MAX_FILE_BYTES);for(const [at,text] of BASE_CHUNKS)base.set(Uint8Array.from(atob(text),c=>c.charCodeAt(0)),at);
  const mutable=[...LAYOUT.segments.map(([,at,n])=>[at,at+n]),[LAYOUT.digestOffset,LAYOUT.digestOffset+64]].sort((a,b)=>a[0]-b[0]);immutableRanges=[];let p=0;for(const [a,b] of mutable){if(a>p)immutableRanges.push([p,a]);p=Math.max(p,b);}if(p<base.length)immutableRanges.push([p,base.length]);
 }return base;
}
export function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
export async function sha256(bytes){if(!globalThis.crypto?.subtle)throw new Error('WEB_CRYPTO_REQUIRES_SECURE_CONTEXT');return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');}
export function validateData(value){let nodes=0;const visit=(x,depth)=>{
 if(++nodes>700000||depth>32)throw new Error('SAVE_DATA_COMPLEXITY_LIMIT');
 if(x===null||typeof x==='boolean')return;
 if(typeof x==='number'){if(!Number.isFinite(x))throw new Error('NON_FINITE_SAVE_NUMBER');return;}
 if(typeof x==='string'){if(x.length>524288||/^\s*data:/i.test(x))throw new Error('SAVE_STRING_LIMIT');return;}
 if(typeof x!=='object')throw new Error('SAVE_REQUIRES_JSON_DATA');
 if(Array.isArray(x)){if(x.length>100000)throw new Error('SAVE_ARRAY_LIMIT');for(let i=0;i<x.length;i++){if(!(i in x))throw new Error('SPARSE_SAVE_ARRAY');visit(x[i],depth+1);}return;}
 if(![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw new Error('SAVE_REQUIRES_PLAIN_OBJECT');
 const keys=Reflect.ownKeys(x);if(keys.length>256)throw new Error('SAVE_OBJECT_KEY_LIMIT');
 for(const key of keys){if(typeof key!=='string'||key.length>128||['__proto__','prototype','constructor'].includes(key))throw new Error('UNSAFE_SAVE_KEY');const d=Object.getOwnPropertyDescriptor(x,key);if(!d.enumerable||!('value' in d))throw new Error('SAVE_ACCESSOR_FORBIDDEN');visit(d.value,depth+1);}
 };visit(value,0);return true;}
export async function encodeEnvelope(value){
 validateData(value);const json=encoder.encode(canonical(value));if(json.length>MAX_PAYLOAD_BYTES)throw new Error('SAVE_PAYLOAD_TOO_LARGE');
 const payload=new Uint8Array(MAX_PAYLOAD_BYTES).fill(32);payload.set(json);const digest=await sha256(payload),out=template().slice();
 for(const [logical,at,n] of LAYOUT.segments)out.set(payload.subarray(logical,logical+n),at);out.set(encoder.encode(digest),LAYOUT.digestOffset);return out;
}
export async function decodeEnvelope(input){
 if(!(input instanceof Uint8Array)&&!(input instanceof ArrayBuffer))throw new Error('SAVE_BYTES_REQUIRED');
 if(input.byteLength!==MAX_FILE_BYTES)throw new Error('SAVE_FILE_SIZE_MISMATCH');
 const raw=input instanceof ArrayBuffer?new Uint8Array(input.slice(0)):input.slice(),expectedBase=template();
 if(decoder.decode(raw.subarray(0,16))!=='SQLite format 3\0')throw new Error('BAD_SQLITE_SIGNATURE');
 for(const [start,end] of immutableRanges)for(let i=start;i<end;i++)if(raw[i]!==expectedBase[i])throw new Error('SQLITE_CONTAINER_OR_PROFILE_MISMATCH');
 const payload=new Uint8Array(MAX_PAYLOAD_BYTES);for(const [logical,at,n] of LAYOUT.segments)payload.set(raw.subarray(at,at+n),logical);
 const digest=decoder.decode(raw.subarray(LAYOUT.digestOffset,LAYOUT.digestOffset+64));if(!/^[a-f0-9]{64}$/.test(digest)||await sha256(payload)!==digest)throw new Error('SAVE_PAYLOAD_HASH_MISMATCH');
 let result;try{result=JSON.parse(decoder.decode(payload));}catch{throw new Error('INVALID_SAVE_JSON');}validateData(result);
 const json=encoder.encode(canonical(result));for(let i=0;i<payload.length;i++)if(payload[i]!==((i<json.length)?json[i]:32))throw new Error('NON_CANONICAL_SAVE_PAYLOAD');return result;
}
export const formatInfo=Object.freeze({profile:PROFILE,container:'Real SQLite KAOPU prototype envelope',generalKAOPUSupport:false,oldDesktopImageReaderSupported:false,oldR04RestartReaderSupported:false,restoreMode:'verified-session-replay',authentication:false,fileBytes:MAX_FILE_BYTES,payloadCapacityBytes:MAX_PAYLOAD_BYTES});
