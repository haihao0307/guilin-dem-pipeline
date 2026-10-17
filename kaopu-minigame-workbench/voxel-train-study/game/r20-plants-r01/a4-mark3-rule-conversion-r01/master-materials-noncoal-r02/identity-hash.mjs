/** Byte-identical exported SHA/runtimeLock utility excerpt from the frozen non-coal decoder. No shader/decoder implementation changed. */
export async function sha256(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function runtimeLock(value){
 const tagged=x=>{
  if(x===null)return ['null'];if(typeof x==='boolean')return ['bool',x];
  if(typeof x==='number'){const b=new ArrayBuffer(8);new DataView(b).setFloat64(0,x,false);return ['number64',[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('')];}
  if(typeof x==='string')return ['string',x];
  if(Array.isArray(x))return ['array',x.map(tagged)];
  return ['object',Object.keys(x).sort().map(k=>[k,tagged(x[k])])];
 };
 return sha256(new TextEncoder().encode(JSON.stringify(tagged(value))));
}
