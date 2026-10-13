import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import fs from 'node:fs';
import {unpackVerified} from '../src/EmbeddedHead.js';
import {checkedDownload} from '../../r14/src/AssetLoader.js';
const report={success:false,checks:[]};const ok=(name)=>report.checks.push({name,pass:true});
try{
 const raw=Buffer.from('GNM exact original asset test'.repeat(100)),gz=gzipSync(raw),spec={base64:gz.toString('base64'),compressedSize:gz.length,size:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
 assert.deepEqual(Buffer.from(await unpackVerified(spec)),raw);ok('lossless decompress + SHA256');
 await assert.rejects(unpackVerified({...spec,base64:spec.base64.slice(4)}),e=>e.code==='HEAD_PAYLOAD_TRUNCATED');ok('truncated document rejected before model creation');
 await assert.rejects(unpackVerified({...spec,sha256:'0'.repeat(64)}),e=>e.code==='HEAD_HASH_MISMATCH');ok('tampered bytes rejected');
 await assert.rejects(unpackVerified({...spec,size:raw.length-1}),e=>e.code==='HEAD_SIZE_MISMATCH');ok('unpack strictly bounded');
 const a=new AbortController();a.abort(new DOMException('test','AbortError'));await assert.rejects(unpackVerified({...spec,signal:a.signal}),e=>e.name==='AbortError');ok('cancellation preserved');
 let received=0,cancelled=false;
 await assert.rejects(checkedDownload('https://invalid.test/gnm.bin',{size:34937952,sha256:spec.sha256,idleMs:30,totalMs:1000,fetchImpl:async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(2700000));},cancel(){cancelled=true;}})),onProgress:n=>{received=n}}),e=>e.message==='资源读取停滞，请重试');
 assert.equal(received,2700000);assert(cancelled);ok('old loader exact screenshot message after stream stalls at 2.7 MB (30ms test clock)');
 report.success=true;
}finally{fs.mkdirSync(new URL('../evidence/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../evidence/loader-tests.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
