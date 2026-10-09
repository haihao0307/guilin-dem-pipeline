import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createAssetReader} from './load-model.mjs';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'boxing-asset-reader-'));
const bytes=Buffer.from('pinned test fixture, not a model asset'),hash=createHash('sha256').update(bytes).digest('hex');
try{
 const base=path.join(root,'workbench','full');await fs.mkdir(base,{recursive:true});await fs.mkdir(path.join(root,'sibling','assets'),{recursive:true});await fs.writeFile(path.join(root,'sibling','assets','test.bin'),bytes);
 const logical='source/test.bin',metadata={assetHashes:{[logical]:hash},assetURLs:{[logical]:'../../sibling/assets/test.bin'}};
 const sibling=createAssetReader({base,metadata,allowNetwork:false});assert.deepEqual(await sibling.get(logical),bytes);assert(sibling.reads[0].source.endsWith('sibling/assets/test.bin'));
 const remoteLogical='source/kaopu-face-workbench/assets/gnm_head_web.bin',url='https://raw.githubusercontent.com/xrblocks/assets-gnm/134feb02b11fa642a43ff5e7e880246255a74e86/gnm_head_web.bin',remoteMetadata={assetHashes:{[remoteLogical]:hash},assetURLs:{[remoteLogical]:url}};
 let calls=0;const remote=createAssetReader({base,metadata:remoteMetadata,fetchImpl:async requested=>{assert.equal(String(requested),url);calls++;return new Response(bytes);}});assert.deepEqual(await remote.get(remoteLogical),bytes);assert.deepEqual(await remote.get(remoteLogical),bytes);assert.equal(calls,1);
 await assert.rejects(()=>createAssetReader({base,metadata:remoteMetadata,allowNetwork:false}).get(remoteLogical),/Offline mode/);
 await assert.rejects(()=>createAssetReader({base,metadata:{assetHashes:{[logical]:'0'.repeat(64)},assetURLs:metadata.assetURLs}}).get(logical),/SHA-256 mismatch/);
 await assert.rejects(()=>createAssetReader({base,metadata:{assetHashes:{[remoteLogical]:hash},assetURLs:{[remoteLogical]:'https://example.invalid/unpinned.bin'}}}).get(remoteLogical),/unpinned external/);
 console.log('PASS: sibling lookup, pinned upstream in-memory branch, SHA-256 rejection, offline blocker and read cache. Upstream HTTP was stubbed; no weights were fetched or published.');
}finally{await fs.rm(root,{recursive:true,force:true});}
