import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.LIP_STARTUP_SOURCE||fileURLToPath(new URL('../../kaopu-unified-human-workbench/lip-startup-r01/',import.meta.url));
const source=fs.readFileSync(root+'/AssetCache.mjs');
if(createHash('sha1').update('blob '+source.length+'\0').update(source).digest('hex')!=='665c3f920c644190e4a8dd9299c98973782d4bae')throw Error('Actual source mismatch');
// Isolated logic fixtures: no real network calls, browser quota or timing claims.
globalThis.location={origin:'https://unit.invalid'};
const db=new Map();let denied=false,active=0,maxActive=0;
const normalize=k=>new URL(typeof k==='string'?k:k.url,location.origin).href;
class FakeCache{
 constructor(){this.rows=new Map();}
 async match(k){return this.rows.get(normalize(k))?.clone();}
 async put(k,v){this.rows.set(normalize(k),v.clone());}
 async delete(k){return this.rows.delete(normalize(k));}
 async keys(){return Array.from(this.rows.keys(),url=>new Request(url));}
}
globalThis.caches={async open(n){if(denied)throw new DOMException('denied','SecurityError');if(!db.has(n))db.set(n,new FakeCache());return db.get(n);},async delete(n){return db.delete(n);}};
globalThis.fetch=async(url,{signal}={})=>{signal?.throwIfAborted();active++;maxActive=Math.max(maxActive,active);try{await new Promise(r=>setTimeout(r,25));signal?.throwIfAborted();return new Response(new Uint8Array([1,2,3,4,5,6,7,8]));}finally{active--;}};
const M=await import(pathToFileURL(root+'/AssetCache.mjs').href),h=await M.sha(new Uint8Array([1,2,3,4,5,6,7,8])),url=location.origin+'/payload',P=__LIP_STARTUP__,checks=[];
const test=(name,ok,detail)=>checks.push({name,ok,detail});
const sentinel=await caches.open('unrelated-project');await sentinel.put('/keep',new Response('preserve'));
await M.loadVerified(url,h);await P.cacheSettled();let n=P.requests;let b=await M.loadVerified(url,h);test('verified hit avoids fetch',P.requests===n&&P.cacheHits===1&&await M.sha(b)===h);
const c=await caches.open(M.CACHE_NAME),key=location.origin+'/.kaopu-lips-verified/'+h;await c.put(key,new Response('broken'));n=P.requests;b=await M.loadVerified(url,h);await P.cacheSettled();test('corrupt cache entry refetched and verified',P.requests===n+1&&await M.sha(b)===h);
denied=true;n=P.requests;b=await M.loadVerified(url,h);test('cache denied falls back to verified fetch',P.requests===n+1&&await M.sha(b)===h);
const aborter=new AbortController(),tasks=Array.from({length:12},(_,i)=>M.loadVerified(url+'?q='+i,h,i===11?aborter.signal:undefined));aborter.abort();const results=await Promise.allSettled(tasks),follow=await Promise.all(Array.from({length:7},(_,i)=>M.loadVerified(url+'?after='+i,h)));test('queued abort does not leak scheduler slot',results.filter(x=>x.status==='fulfilled').length===11&&results[11].reason?.name==='AbortError'&&follow.length===7);
denied=false;await P.clearAssetCache();const c2=await caches.open(M.CACHE_NAME);for(let i=0;i<2;i++)await c2.put('/large-'+i,new Response('x',{headers:{'x-kaopu-size':String(75*1024*1024)}}));await M.loadVerified(url,h);await P.cacheSettled();let size=0;for(const r of await c2.keys())size+=Number((await c2.match(r)).headers.get('x-kaopu-size')||0);test('128 MiB eviction accounting with simulated metadata',size<=P.cacheLimitBytes,{bytes:size});test('unrelated project preserved',await (await sentinel.match('/keep')).text()==='preserve');test('at most six simultaneous fixture requests',maxActive<=6,{maximum:maxActive});
const report={scope:'Node.js logic tests on actual AssetCache source; synthetic fetch and CacheStorage objects, NOT browser quota or performance tests',sourceBlob:'665c3f920c644190e4a8dd9299c98973782d4bae',checks,passed:checks.every(c=>c.ok)};
if(process.env.LIP_CACHE_REPORT)fs.writeFileSync(process.env.LIP_CACHE_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.passed)process.exit(1);
