import assert from 'node:assert/strict';import {gzipSync} from 'node:zlib';import {sha256} from '../src/exact-decoder.mjs';import {loadResidualParts} from './storage.mjs';
const raw=Uint8Array.from({length:1000},(_,i)=>i%256),gzip=new Uint8Array(gzipSync(raw)),parts=[gzip.slice(0,50),gzip.slice(50)];let offset=0;const specs=[];for(let i=0;i<parts.length;i++){specs.push({path:String(i),offset,bytes:parts[i].length,sha256:await sha256(parts[i])});offset+=parts[i].length;}
const manifest={version:1,residual:{encoding:'gzip',bytes:gzip.length,sha256:await sha256(gzip),rawBytes:raw.length,rawSHA256:await sha256(raw),parts:specs}};const get=async path=>parts[Number(path)];assert.deepEqual(await loadResidualParts(manifest,get),raw);
const order=structuredClone(manifest);order.residual.parts.reverse();await assert.rejects(loadResidualParts(order,get),/offset/);
const corrupt=parts.map(x=>x.slice());corrupt[1][5]^=1;await assert.rejects(loadResidualParts(manifest,async path=>corrupt[Number(path)]),/part integrity/);
const rawHash=structuredClone(manifest);rawHash.residual.rawSHA256='0'.repeat(64);await assert.rejects(loadResidualParts(rawHash,get),/raw integrity/);
console.log('PASS ordered transport parts + compressed/raw SHA, order/corruption/raw-lock rejection');
