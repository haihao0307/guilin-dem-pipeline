'use strict';
const {verifyCache}=require('./AssetContract.cjs');
function standalonePayload(here,manifestBytes){
 const checked=verifyCache(here,manifestBytes);
 const packetEntries=Object.fromEntries([...checked.chunkBuffers].map(([url,b])=>[url,b.toString('base64')]));
 const imageEntries=Object.fromEntries([...checked.imageBuffers].map(([url,b])=>[url,'data:image/png;base64,'+b.toString('base64')]));
 const script=`(function(){
const packetEntries=${JSON.stringify(packetEntries)};const imageEntries=${JSON.stringify(imageEntries)};
const decoded=new Map();
const state={mode:'embedded',packetIds:${JSON.stringify(checked.lock.packetIds)},allNativePackets:false,compressedBytes:44303931,imageBytes:1374970,served:[],imagesServed:[],missing:[],networkRequests:0};
window.__NPC_ASSETS__=state;
const originalFetch=globalThis.fetch.bind(globalThis);
function absolute(input){return new URL(typeof input==='string'?input:input.url||String(input),location.href).href;}
function denied(url){state.missing.push(url);const error=Error('完整人物资源未包含在本页：'+url);window.__NPC_BOOT__?.fail(error,{code:'MISSING_STANDALONE_ASSET'});return error;}
window.__NPC_IMAGE_URL__=function(input){const url=absolute(input);if(Object.prototype.hasOwnProperty.call(imageEntries,url)){state.imagesServed.push(url);return imageEntries[url];}if(url.startsWith('data:')||url.startsWith('blob:'))return url;throw denied(url);};
globalThis.fetch=async function(input,init){
 const url=absolute(input),signal=init&&init.signal||(input&&input.signal);
 if(signal&&signal.aborted)throw new DOMException('The operation was aborted','AbortError');
 if(Object.prototype.hasOwnProperty.call(packetEntries,url)){
  if(!decoded.has(url)){const encoded=packetEntries[url],binary=atob(encoded),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);decoded.set(url,bytes);packetEntries[url]=null;}
  const bytes=decoded.get(url);state.served.push(url);window.__NPC_BOOT__?.progress('正在读取完整人物数据（'+new Set(state.served).size+'/55）');
  return new Response(bytes,{status:200,headers:{'Content-Type':'application/octet-stream','Content-Length':String(bytes.byteLength),'X-NPC-Asset':'embedded-native'}});
 }
 if(url.startsWith('data:')||url.startsWith('blob:'))return originalFetch(input,init);
 throw denied(url);
};
})();`;
 return{script,lock:checked.lock,images:checked.images,embeddedBytes:45678901};
}
module.exports={standalonePayload};
