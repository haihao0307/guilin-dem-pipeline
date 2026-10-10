'use strict';
// QA only. Metadata does not retain WebGLBuffer or TypedArray objects.
function createBufferLedger(now = () => performance.now()) {
 const bufferIds=new WeakMap(),sourceOwners=new WeakMap(),sourceIds=new WeakMap(),records=[];
 const attach=(r,owner)=>{if(!r.owners.some(o=>JSON.stringify(o)===JSON.stringify(owner)))r.owners.push({...owner});};
 return {
  registerSource(array,owner){if(!ArrayBuffer.isView(array))throw new TypeError('Expected actual typed-array identity');sourceOwners.set(array,{...owner});for(const id of sourceIds.get(array)||[])attach(records[id-1],owner);},
  created(buffer){const id=records.length+1;bufferIds.set(buffer,id);records.push({id,createdAt:now(),firstUploadAt:null,deletedAt:null,bytes:0,uploadCount:0,owners:[]});},
  uploaded(buffer,array,bytes){const id=bufferIds.get(buffer);if(!id)throw new Error('Upload for unknown GPU object');const r=records[id-1];if(r.deletedAt!==null)throw new Error('Upload after deletion');const at=now();r.firstUploadAt??=at;r.lastUploadAt=at;r.bytes=bytes;r.uploadCount++;if(ArrayBuffer.isView(array)){let ids=sourceIds.get(array);if(!ids)sourceIds.set(array,ids=new Set());ids.add(id);const owner=sourceOwners.get(array);if(owner)attach(r,owner);}},
  deleted(buffer){const id=bufferIds.get(buffer);if(id)records[id-1].deletedAt??=now();},
  snapshot(){return records.map(r=>({...r,owners:r.owners.map(o=>({...o}))}));}
 };
}
function bridgeAdjustedBufferBytes(rawBytes,records=[]){
 if(!Number.isSafeInteger(rawBytes)||rawBytes<0)throw new TypeError('Invalid raw allocation');
 const ids=new Set(),residents=[];
 for(const r of records){
  const live=(r.gpuBuffers||[]).filter(b=>b.deletedAt===null);
  if(!live.length){if(r.resident&&!r.disposed)throw new Error('Rendered bridge lacks observed GPU allocations');continue;}
  if(r.disposed||r.name!=='Straight railway truss bridge')throw new Error('Unrelated/disposed geometry cannot be subtracted');
  if(live.length!==4)throw new Error('Unexpected actual bridge GPU buffer count');
  let bytes=0;for(const b of live){
   if(!b.id||ids.has(b.id)||!Number.isFinite(b.firstUploadAt)||b.firstUploadAt<0||!Number.isSafeInteger(b.bytes)||b.bytes<1)throw new Error('Missing, duplicate or invalid actual GPU allocation');
   if(!b.owners.some(o=>o.kind==='host-bridge'&&o.geometryId===r.id))throw new Error('GPU object has no matching source-array owner');
   ids.add(b.id);bytes+=b.bytes;
  }
  if(bytes!==r.geometryBytes)throw new Error('Actual bridge buffer bytes differ from source attributes');
  residents.push({id:r.id,bytes,gpuBuffers:live});
 }
 const bridgeBytes=residents.reduce((s,r)=>s+r.bytes,0);if(bridgeBytes>rawBytes)throw new Error('Bridge allocations exceed measured driver total');
 return{rawBytes,bridgeBytes,adjustedBytes:rawBytes-bridgeBytes,residents};
}
module.exports={createBufferLedger,bridgeAdjustedBufferBytes};
