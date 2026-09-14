import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {sharedPool,retryableIndex,checkedGzip,sha256,readExact,scopedName,fetchInfo} from '../../site/dist/r3-8/checked-transport.js';
const delay=ms=>new Promise(r=>setTimeout(r,ms));let tests=0;
const run=async(name,fn)=>{await fn();tests++;console.log('PASS',name);};
await run('two consumers one fetch; cancel one preserves other',async()=>{
 const pool=sharedPool(2),a=new AbortController(),b=new AbortController();let called=0;
 const load=async s=>{called++;await delay(15);assert.equal(s.aborted,false);return 7;};
 const p=pool.get('a',load,a.signal),q=pool.get('a',load,b.signal);
 const rejected=assert.rejects(p,{name:'AbortError'});a.abort();await rejected;assert.equal(await q,7);assert.equal(called,1);assert.equal(pool.stats().cacheEntries,1);
});
await run('A B A reentry; stale failure cannot delete fresh cache',async()=>{
 const pool=sharedPool(2),a=new AbortController();const old=pool.get('A',async()=>{await delay(20);throw Error('old');},a.signal);
 await delay(1);const rejected=assert.rejects(old,{name:'AbortError'});a.abort();await rejected;
 assert.equal(await pool.get('A',async()=>9),9);await delay(30);assert.equal(await pool.get('A',()=>{throw Error('cache missing');}),9);assert.equal(pool.stats().pendingJobs,0);
});
await run('LRU bounds and pre-abort',async()=>{
 const pool=sharedPool(2);for(let i=0;i<8;i++)assert.equal(await pool.get(i,async()=>i),i);
 const a=new AbortController();a.abort();await assert.rejects(pool.get('never',()=>{throw Error('bad');},a.signal),{name:'AbortError'});assert.equal(pool.stats().cacheEntries,2);assert.equal(pool.stats().starts,8);
});
await run('failed manifest retries; parallel manifest dedup',async()=>{
 let attempts=0;const get=retryableIndex(async()=>{attempts++;return attempts===1?new Response('',{status:503}):Response.json({ok:true});},'x',m=>assert(m.ok));
 await assert.rejects(get());const [a,b]=await Promise.all([get(),get()]);assert(a.ok&&b.ok);assert.equal(attempts,2);
});
await run('gzip exact bytes hash rejection and decompression bound',async()=>{
 const raw=Uint8Array.from({length:512},(_,i)=>i%251),gz=gzipSync(raw),hash=await sha256(gz);
 assert.deepEqual(await checkedGzip(async()=>new Response(gz),'x',gz.length,hash,512),raw);
 await assert.rejects(checkedGzip(async()=>new Response(gz),'x',gz.length,'0'.repeat(64),512),/SHA/);
 await assert.rejects(checkedGzip(async()=>new Response(gz),'x',gz.length,hash,511),/超过/);
 await assert.rejects(readExact(new Blob([raw]).stream(),513),/不符/);
});
await run('origin and path scope; Request AbortSignal',async()=>{
 globalThis.location={href:'https://review.test/x/site/dist/r3-8/index.html'};const base=new URL('./data/soil/',location.href);
 assert.equal(scopedName(new URL('https://other.test/x/site/dist/r3-8/data/soil/a.i16le'),[base]),null);
 assert.equal(scopedName(new URL('https://review.test/other/site/dist/r3-8/data/soil/a.i16le'),[base]),null);
 const a=new AbortController(),request=new Request(new URL('a.i16le',base),{signal:a.signal});a.abort();assert(fetchInfo(request).signal.aborted);
});
console.log(JSON.stringify({passed:true,tests}));
