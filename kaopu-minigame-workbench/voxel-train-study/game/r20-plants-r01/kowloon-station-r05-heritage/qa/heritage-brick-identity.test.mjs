// CPU/source contracts only; the production helper is executed by the GPU probe.
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';import {fixtures} from './heritage-state-emit.mjs';
import layoutModule from './heritage-review-layout.cjs';
const matter=fs.readFileSync(new URL('../station-matter.mjs',import.meta.url),'utf8');
const sample=name=>fixtures.find(f=>f.name===name).brickIdentity;
test('one production brick sample feeds both physical geometry and material',()=>{
 assert.equal((matter.match(/let sample=stationBrickSample\(h,p\)/g)||[]).length,2);
 assert.match(matter,/if\(stationHeritageMember\(h\)\)\{\s*let row=floor\(bp.y\/\.073\)/);
 assert.match(matter,/let phase=\(face\+shift\)\/\.25/);
 assert.match(matter,/StationBrickSample\(q,19\.\+row\*13\.\+floor\(phase\)\)/);
 assert.match(matter,/StationBrickSample\(brickQ\(bp,h.id,h.d\),19\.\+floor\(bp.y\/\.073\)\*13\.\+floor\(\(bp.x\+bp.z\)\/\.25\)\)/);
});
test('observed old within-brick discontinuity now has one authored identity',()=>{
 for(const name of ['heritage-brick-internal-left','heritage-brick-internal-right','heritage-brick-depth-back','heritage-brick-depth-front']){
  const b=sample(name);assert.equal(b.row,235);assert.equal(b.column,91);assert.equal(b.seed,3165);
 }
 assert.equal(sample('heritage-brick-cell-left').seed,3165);
 assert.equal(sample('heritage-brick-cell-right').seed,3166);
});
test('identity fixtures cover negative rows, both axes, local lantern depth and unchanged old branches',()=>{
 assert.equal(sample('heritage-brick-negative-row-0').row,-2);assert.equal(sample('heritage-brick-negative-row-1').row,-1);
 for(const names of [['heritage-brick-axis12-depth-0','heritage-brick-axis12-depth-1'],['heritage-lantern-local-depth-0','heritage-lantern-local-depth-1']])assert.equal(sample(names[0]).seed,sample(names[1]).seed);
 assert.equal(fixtures.filter(f=>f.name.startsWith('control-site-brick')).length,2);
 assert.equal(fixtures.length,31);assert.equal(fixtures.filter(f=>f.requirePhysicalDisplacement).length,11);
});
test('four full window tiles partition the native 224x360 frame without changing its lens',()=>{
 const boxes=[0,1,2,3].map(tileIndex=>layoutModule.layout('towerWindow',{scale:1,tileIndex}));
 for(const b of boxes){assert.deepEqual([b.width,b.height,b.crop.w,b.crop.h],[640,426,116,184]);assert.equal(b.tile.halo,2);}
 for(let y=20;y<380;y++)for(let x=200;x<424;x++)assert.equal(boxes.filter(b=>x>=b.tile.core.x&&x<b.tile.core.x+112&&y>=b.tile.core.y&&y<b.tile.core.y+180).length,1);
});
