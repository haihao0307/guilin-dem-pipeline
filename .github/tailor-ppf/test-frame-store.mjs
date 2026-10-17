import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {FrameStore} from './web/codec.mjs';
const root=path.resolve(process.argv[2]||'ppf-teacher-20261007/web/data/belt');
const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
globalThis.location={href:'https://example.invalid/'};
let requests=0,corrupt=false,delayed=false;
globalThis.fetch=async(url,{signal}={})=>{
  requests++;
  if(delayed)await new Promise((resolve,reject)=>{const t=setTimeout(resolve,30);signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'));},{once:true});});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  const filename=path.basename(new URL(url).pathname);const bytes=new Uint8Array(await fs.readFile(path.join(root,filename)));
  if(corrupt)bytes[bytes.length-1]^=1;
  return new Response(bytes,{status:200});
};
const abort=new AbortController(),store=new FrameStore('https://example.invalid/data/',manifest,{signal:abort.signal});
for(const index of [0,8,16,24]){const p=await store.frame(index);assert.equal(p.length,manifest.vertexCount*3);assert(store.cache.size<=3);}
assert.equal(requests,4);assert.deepEqual([...store.cache.keys()],[8,16,24]);
await store.frame(9);assert.equal(requests,4);assert.deepEqual([...store.cache.keys()],[16,24,8]);
await store.frame(0);assert.equal(requests,5);assert.equal(store.cache.size,3);
assert.rejects(()=>store.frame(-1),/outside/);
store.dispose();assert.equal(store.cache.size,0);await assert.rejects(()=>store.frame(0),{name:'AbortError'});
corrupt=true;const bad=new FrameStore('https://example.invalid/data/',manifest);await assert.rejects(()=>bad.frame(0),/checksum mismatch/);assert.equal(bad.cache.size,0);bad.dispose();corrupt=false;
delayed=true;const stop=new AbortController(),late=new FrameStore('https://example.invalid/data/',manifest,{signal:stop.signal});
const pending=late.frame(0);late.dispose();stop.abort();await assert.rejects(()=>pending,{name:'AbortError'});assert.equal(late.cache.size,0);
console.log(JSON.stringify({threeBlockLru:true,cacheReuse:true,corruptionRejected:true,disposedBufferReleased:true,lateFetchRejected:true}));
