import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeFrames} from './web/codec.mjs';
const root=process.argv[2],sha=b=>createHash('sha256').update(b).digest('hex');
if(!root)throw Error('Pass the exported case directory');
const m=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
assert.equal(m.terminal.outcome.kind,'finished');
async function read(e){const b=await fs.readFile(path.join(root,e.file));assert.equal(b.length,e.bytes);assert.equal(sha(b),e.sha256);const r=gunzipSync(b);assert.equal(r.length,e.decodedBytes);assert.equal(sha(r),e.decodedSha256);return r;}
const stats=JSON.parse(await read(m.statistics));await read(m.topology);
let frames=0;
for(const c of m.chunks){
  const raw=await read(c),a=decodeFrames(raw,m.vertexCount,c.frameCount);
  assert.equal(sha(new Uint8Array(a.buffer)),c.sourceSha256);
  for(let j=0;j<c.frameCount;j++){
    const f=c.firstFrame+j;assert.equal(f,frames++);
    const view=new Uint8Array(a.buffer,j*m.vertexCount*12,m.vertexCount*12);
    assert.equal(sha(view),stats.frames[f].sha256);
  }
}
assert.equal(frames,m.frames);assert.equal(frames,m.terminal.frame+1);
assert.throws(()=>decodeFrames(new Uint8Array(3),1,1),/wrong size/);
console.log(JSON.stringify({case:m.case,frames,allOriginalFrameHashes:true,topologyAndStatistics:true,floatPrecision:'bit exact'}));
