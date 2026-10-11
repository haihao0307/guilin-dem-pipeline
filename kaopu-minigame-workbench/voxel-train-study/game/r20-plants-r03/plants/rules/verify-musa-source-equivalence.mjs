/** Local source audit only. Never downloads/ships the unrelated full wood archive. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as sliced from './native78-musa-author.mjs';
const supplied=process.argv[2];if(!supplied)throw Error('Usage: node verify-musa-source-equivalence.mjs ORIGINAL_FULL_NATIVE78_AUTHOR');
const fullPath=resolve(supplied),fullBytes=await readFile(fullPath),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(fullBytes.length,19002149);assert.equal(sha(fullBytes),'2bd293466ba67522e5536d0d73444c144694229a31d3e850e87f7cb47e4e7aa4','The original full-author baseline must be the measured canonical build');
const original=await import(pathToFileURL(fullPath)),options={stage:'establishing',habitatForm:'sheltered',seed:761014},profile=original.profile78('musa-balbisiana',options),a=original.generateTropical78(profile,{compactBlades76:true}),b=sliced.generateTropical78(sliced.profile78('musa-balbisiana',options),{compactBlades76:true}),fullAsset=await original.fixedAsset76(a),slicedAsset=await sliced.fixedAsset76(b);
assert.deepEqual(a.geometry,b.geometry);assert.deepEqual(a.surfaces,b.surfaces);assert.equal(fullAsset.geometryHash,slicedAsset.geometryHash);assert.equal(fullAsset.contentHash,slicedAsset.contentHash);
const arrays=Object.entries(a.geometry).filter(([,v])=>ArrayBuffer.isView(v)).map(([name,v])=>({name,bytes:v.byteLength,sha256:sha(new Uint8Array(v.buffer,v.byteOffset,v.byteLength))})),resources=a.surfaces.resources.map(r=>({id:r.id,width:r.width,height:r.height,colorSpace:r.colorSpace,bytes:r.bytes.byteLength,sha256:sha(r.bytes),source:r.source}));
console.log(JSON.stringify({pass:true,node:process.version,originalFullBundle:{bytes:fullBytes.length,sha256:sha(fullBytes)},geometryHash:fullAsset.geometryHash,contentHash:fullAsset.contentHash,allGeometryArraysEqual:true,allSurfaceResourcesAndBindingsEqual:true,arrays,resources},null,2));
