import test from 'node:test';import assert from 'node:assert/strict';import helper from './bridge-resource-accounting.cjs';
function measuredBridge(){let t=0;const ledger=helper.createBufferLedger(()=>++t);const sizes=[105408,105408,105408,26352];for(let i=0;i<4;i++){const buffer={},array=new Uint8Array(sizes[i]);ledger.registerSource(array,{kind:'host-bridge',geometryId:'bridge',attribute:String(i)});ledger.created(buffer);ledger.uploaded(buffer,array,array.byteLength);}return{id:'bridge',name:'Straight railway truss bridge',geometryBytes:342576,resident:true,disposed:false,gpuBuffers:ledger.snapshot()};}
test('actual GPU-object identities and first uploads, not matching total-size constants, establish bridge ownership',()=>{
 const record=measuredBridge();assert.equal(helper.bridgeAdjustedBufferBytes(16341368,[record]).adjustedBytes,15998792);
 assert.equal(helper.bridgeAdjustedBufferBytes(15998792,[]).adjustedBytes,15998792);
 assert(record.gpuBuffers.every(b=>b.firstUploadAt>b.createdAt&&b.uploadCount===1));
 for(const change of [r=>delete r.gpuBuffers,r=>r.gpuBuffers[0].firstUploadAt=null,r=>r.gpuBuffers[0].owners=[],r=>r.gpuBuffers[1].id=r.gpuBuffers[0].id,r=>r.gpuBuffers[0].bytes++,r=>r.disposed=true]){const r=structuredClone(record);change(r);assert.throws(()=>helper.bridgeAdjustedBufferBytes(20000000,[r]));}
 assert(helper.bridgeAdjustedBufferBytes(16441368,[record]).adjustedBytes-15998792>65536,'unowned 100 KB growth still fails the unchanged budget');
});
test('GPU lifetime tracking supports late identity registration and actual deleteBuffer without retaining objects',()=>{
 let time=0;const ledger=helper.createBufferLedger(()=>++time),buffer={},array=new Float32Array(8);ledger.created(buffer);ledger.uploaded(buffer,array,32);ledger.registerSource(array,{kind:'street',loadCount:1,geometryId:'g',attribute:'position'});
 let [r]=ledger.snapshot();assert.equal(r.bytes,32);assert.equal(r.deletedAt,null);assert.equal(r.owners[0].kind,'street');ledger.deleted(buffer);[r]=ledger.snapshot();assert(r.deletedAt>r.firstUploadAt);assert.throws(()=>ledger.uploaded(buffer,array,32));assert.throws(()=>ledger.uploaded({},array,32));
 const copied=ledger.snapshot();copied[0].owners[0].kind='tamper';assert.equal(ledger.snapshot()[0].owners[0].kind,'street');
});
