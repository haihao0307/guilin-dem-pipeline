import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {getBytes,unpack} from './transport.mjs';
const original=globalThis.fetch;try{
const bytes=Uint8Array.of(1,2,3,4,5);let count=0;const progress=[];globalThis.fetch=async()=>{count++;if(count===1)return new Response('temporary',{status:503});return new Response(new ReadableStream({start(c){c.enqueue(bytes.slice(0,2));c.enqueue(bytes.slice(2));c.close();}}),{headers:{'content-length':'5'}});};assert.deepEqual(await getBytes('http://example.test/asset',e=>progress.push(e),{timeoutMs:100}),bytes);assert.equal(count,2);assert(progress.some(p=>p.loaded===5&&p.attempt===2));
globalThis.fetch=async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));await assert.rejects(getBytes('http://example.test/hang',()=>{},{timeoutMs:5}),/after 2 attempts/);
assert.deepEqual(await unpack(gzipSync(bytes)),bytes);assert.deepEqual(await unpack(bytes),bytes);await assert.rejects(unpack(Uint8Array.of(31,139,0,0)));
console.log('PASS transport progress, retry, bounded timeout, gzip and transparent-decode paths, malformed gzip rejection');
}finally{globalThis.fetch=original;}
