/** Lossless LOCAL cache of previously compiled results. Two entries / 128MB.
 * Cache is optional: corruption, quota denial or timeout always recompiles the
 * original algorithm at original quality. Never a server-baked hairstyle. */
const TYPES={curves:Float32Array,normals:Float32Array,tangents:Float32Array,randoms:Float32Array,active:Uint8Array,guideMap:Uint32Array,weights:Float32Array,lengths:Float32Array};
const LIMIT=128000000,SCHEMA=1;
const enc=new TextEncoder(),hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const digest=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes));
const req=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=t=>new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onabort=t.onerror=()=>reject(t.error||Error('Cache transaction aborted'));});
function bounded(p,ms=3000){let timer;return Promise.race([p,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Local cache timeout')),ms);})]).finally(()=>clearTimeout(timer));}
export class GroomResultCache{
 constructor(signature){this.signature=signature;this.db=null;this.pending=Promise.resolve();this.closed=false;this.stats={hits:0,misses:0,invalid:0,writes:0,readMs:0,writeMs:0,storedBytes:0,warnings:[],maxBytes:LIMIT,maxEntries:2};}
 warn(e){this.stats.warnings.push(String(e?.message||e));if(this.stats.warnings.length>8)this.stats.warnings.shift();}
 async open(){if(this.closed)return null;if(this.db)return this.db;try{
  const r=indexedDB.open('kaopu-hair-l03-compiled-local-v1',1);r.onupgradeneeded=()=>{r.result.createObjectStore('results');r.result.createObjectStore('meta');};
  const d=await bounded(req(r),1200);if(this.closed){d.close();return null;}d.onversionchange=()=>{d.close();this.db=null;};this.db=d;return d;
 }catch(e){this.warn(e);return null;}}
 key(recipe){const sorted=Object.fromEntries(Object.keys(recipe).sort().map(k=>[k,recipe[k]]));return JSON.stringify({schema:SCHEMA,signature:this.signature,recipe:sorted});}
 async load(recipe,cancel=()=>false){const start=performance.now(),key=this.key(recipe);try{
  const db=await this.open();if(!db){this.stats.misses++;return null;}
  const t=db.transaction('results','readonly'),record=await bounded(req(t.objectStore('results').get(key)),2500);if(cancel())return null;
  if(!record){this.stats.misses++;return null;}
  if(record.key!==key||record.schema!==SCHEMA||typeof record.metadata!=='string'||record.metadata.length>8000000)throw Error('Invalid cached metadata');
  if(await digest(enc.encode(record.metadata))!==record.metaSHA)throw Error('Cached metadata integrity mismatch');
  const result=JSON.parse(record.metadata),count=this.signature.count,per=25;
  if(result.count!==count||result.segments!==24||result.per!==per)throw Error('Cached strand structure mismatch');
  const lengths={curves:count*per*3,normals:count*per*3,tangents:count*per*3,randoms:count,active:count,guideMap:count*3,weights:count*3,lengths:count};let total=0;
  for(const[name,C]of Object.entries(TYPES)){const item=record.arrays?.[name];if(!item||!(item.bytes instanceof ArrayBuffer)||item.bytes.byteLength!==lengths[name]*C.BYTES_PER_ELEMENT||item.type!==C.name)throw Error('Cached array size/type mismatch: '+name);total+=item.bytes.byteLength;if(total>LIMIT)throw Error('Cached payload exceeds budget');if(await digest(item.bytes)!==item.sha256)throw Error('Cached array integrity mismatch: '+name);result[name]=new C(item.bytes);}
  if(cancel())return null;this.stats.hits++;this.stats.readMs=performance.now()-start;return result;
 }catch(e){this.stats.invalid++;this.warn(e);try{const t=this.db?.transaction(['results','meta'],'readwrite');if(t){t.objectStore('results').delete(key);t.objectStore('meta').delete(key);}}catch{}this.stats.misses++;return null;}}
 save(result){const operation=async()=>{if(this.closed)return false;const start=performance.now();try{
  const db=await this.open();if(!db)return false;const arrays={},metadata={};let bytes=0;
  for(const[k,v]of Object.entries(result)){if(Object.hasOwn(TYPES,k))continue;metadata[k]=v;}
  for(const[name,C]of Object.entries(TYPES)){const a=result[name];if(!(a instanceof C))throw Error('Original compiler array mismatch: '+name);const b=a.byteOffset===0&&a.byteLength===a.buffer.byteLength?a.buffer:a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength);bytes+=b.byteLength;arrays[name]={bytes:b,type:C.name,sha256:await digest(b)};}
  const text=JSON.stringify(metadata);bytes+=enc.encode(text).byteLength;if(bytes>LIMIT){this.warn('Result exceeds local cache budget; original quality retained');return false;}
  const key=this.key(result.recipe),record={schema:SCHEMA,key,metadata:text,metaSHA:await digest(enc.encode(text)),arrays};if(this.closed)return false;
  const summaries=await req(db.transaction('meta','readonly').objectStore('meta').getAll());let total=bytes,keep=0,remove=[];
  for(const s of summaries.sort((a,b)=>b.at-a.at)){if(s.key===key)continue;if(keep<1&&total+s.bytes<=LIMIT){total+=s.bytes;keep++;}else remove.push(s.key);}
  const t=db.transaction(['results','meta'],'readwrite'),complete=done(t);for(const k of remove){t.objectStore('results').delete(k);t.objectStore('meta').delete(k);}t.objectStore('results').put(record,key);t.objectStore('meta').put({key,bytes,at:Date.now()},key);await complete;
  this.stats.writes++;this.stats.storedBytes=total;this.stats.writeMs=performance.now()-start;return true;
 }catch(e){this.warn(e);return false;}};this.pending=this.pending.then(operation,operation);return this.pending;
 }
 async clear(){await this.pending;const db=await this.open();if(!db)return;const t=db.transaction(['results','meta'],'readwrite'),p=done(t);t.objectStore('results').clear();t.objectStore('meta').clear();await p;}
 flush(){return this.pending;}
 close(){this.closed=true;this.db?.close();this.db=null;}
 diagnostics(){return{...this.stats,warnings:[...this.stats.warnings]};}
}
