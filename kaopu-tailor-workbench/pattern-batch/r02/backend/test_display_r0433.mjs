import assert from 'node:assert/strict';
import fs from 'node:fs';
import zlib from 'node:zlib';
import{BoundedCache}from'./display-r0433.mjs';
import{smoothSewnNormals}from'./sewn-normals-r0433.mjs';
const cache=new BoundedCache(2);cache.set('a',1).set('b',2);assert.equal(cache.get('a'),1);cache.set('c',3);assert.equal(cache.has('b'),false);assert.equal(cache.size,2);
const make=()=>({attributes:{position:{count:2,array:new Float32Array([0,0,0,0,0,0])},normal:{array:new Float32Array([1,0,0,.8660254,.5,0])}}});
const spec={panels:[{id:'a',uvMm:[[0,0]]},{id:'b',uvMm:[[0,0]]}],seams:[{id:'s',a:{panelId:'a'},b:{panelId:'b'},stitchVertexPairs:[[0,0]]}]};
let g=make(),before=Array.from(g.attributes.position.array);let r=smoothSewnNormals(g,spec,['s']);assert.equal(r.smoothedVertices,2);assert.deepEqual(Array.from(g.attributes.position.array),before);assert.deepEqual(Array.from(g.attributes.normal.array.slice(0,3)),Array.from(g.attributes.normal.array.slice(3)));
g=make();g.attributes.position.array[3]=.000002;r=smoothSewnNormals(g,spec,['s']);assert.equal(r.smoothedVertices,0);assert.equal(r.rejectedGap,1);
g=make();g.attributes.normal.array.set([-1,0,0],3);r=smoothSewnNormals(g,spec,['s']);assert.equal(r.smoothedVertices,0);assert.equal(r.rejectedFold,1);
g=make();r=smoothSewnNormals(g,spec,[]);assert.equal(r.smoothedVertices,0);
const root=new URL('.',import.meta.url),idx=JSON.parse(fs.readFileSync(new URL('assets/results/index.json',root)));
for(const[id,e]of Object.entries(idx.rows)){
 const packet=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('assets/results/'+e.file,root))));
 assert.equal(packet.binding.presetId,id);assert(packet.record.positionsMm.length>0);
 assert(packet.record.positionsMm.every(p=>p.length===3&&p.every(Number.isFinite)));
}
console.log('DISPLAY_UNIT_PASS: LRU access ordering; coincident seam lighting; gap/hard-fold/inactive seam rejection; unchanged positions; 60 finite native packets');
