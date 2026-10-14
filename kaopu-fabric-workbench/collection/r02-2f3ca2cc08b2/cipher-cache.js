/* Only ciphertext is persisted. The existing authenticated decoder still checks every read. */
const NAME='kaopu-fabric-ciphertext-r02-v1',hits=new Map();
const key=r=>'https://fabric-cache.invalid/'+r.sha256;
export async function readCiphertext(url,record,signal){
 signal?.throwIfAborted();let cached;
 try{cached=await (await caches.open(NAME)).match(key(record));}catch{}
 hits.set(record.sha256,!!cached);
 if(cached)return cached;
 return fetch(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
}
export async function storeCiphertext(record,bytes){
 if(hits.get(record.sha256))return;
 try{await (await caches.open(NAME)).put(key(record),new Response(bytes));}catch{}
}
export function wasCached(record){return !!hits.get(record.sha256);}
export async function evictCiphertext(record){try{await (await caches.open(NAME)).delete(key(record));}catch{}}
