import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{createStationWGSL}from'../../../kowloon-station-r04/receiver.mjs';
import{STATION_SCORE}from'../../../kowloon-station-r04/station-score.mjs';
import{createTerminalHallSampler,terminalHallMemberSample}from'../../../kowloon-station-r04/native-terminal-hall.mjs';
import{createStationBinding}from'../../station-binding.mjs';import{hostConstructionWGSL}from'../../host-construction.mjs';
import{lowerHallHierarchy,readHallBlocks,walkOrderedHall,boxF32,instrumentReferenceHall}from'./hall-hierarchy.mjs';
const datums=JSON.parse(fs.readFileSync(new URL('../../qa/host-datums.json',import.meta.url))),construction=createStationBinding({score:STATION_SCORE,...datums}).construction,source=createStationWGSL({construction,hostWGSL:hostConstructionWGSL(construction.host)}),result=lowerHallHierarchy(source,{counters:true});
const hall=createTerminalHallSampler({...STATION_SCORE.hall,deck:construction.host.boardingIsland.topLocalYM},{compact:true,proxyBounds:true}),blocks=result.original.blocks;
test('all physical blocks remain exact and original ordered; no mothers or other functions changed',()=>{assert.equal(blocks.length,hall.groups.length);for(const b of blocks)assert.equal(result.source.split(b.text).length,2);const o=result.original;assert(result.source.endsWith(source.slice(o.end+1)));assert(result.source.includes(source.slice(0,o.start)));assert.equal(result.metrics.representedMembers,hall.groups.reduce((s,g)=>s+g.count,0));});
test('node bounds contain the float32 original descendant bounds with positive padding',()=>{function check(n){for(let i=n.lo;i<n.hi;i++)for(let k=0;k<3;k++){assert(n.min[k]<blocks[i].min[k]);assert(n.max[k]>blocks[i].max[k]);}if(n.left){assert.equal(n.left.lo,n.lo);assert.equal(n.right.hi,n.hi);assert.equal(n.left.hi,n.right.lo);check(n.left);check(n.right);}}check(result.tree);});
let randomSeed=836291;function random(){randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;}
test('float32 node gate never removes an original near branch or a potentially winning far box in bounded coordinates',()=>{const nodes=[];function list(n){nodes.push(n);if(n.left){list(n.left);list(n.right);}}list(result.tree);let pruned=0;
 for(let j=0;j<18000;j++){const p=[0,1,2].map(()=>Math.fround((random()*2-1)*2047.9)),node=nodes[j%nodes.length],best=Math.fround(random()*4000-10),bound=boxF32(p,node.center,node.half);if(bound<=Math.fround(Math.fround(Math.max(.06,best))+.005))continue;pruned++;for(let i=node.lo;i<node.hi;i++){const d=boxF32(p,blocks[i].center,blocks[i].half);assert(d>.06);assert(d>=best);}}
 assert(pruned>1000);
});
test('same original physical winner metadata for boundaries, doors, roof, nearby text, bridge and exterior points',()=>{
 const points=JSON.parse(fs.readFileSync(new URL('../../generated/geometry-group-manifest.json',import.meta.url))).probe.points.slice();
 for(const m of hall.parts.filter(m=>!m.binding.deferred)){for(const offset of[-.061,-.03,0,.03,.061])points.push(m.center.map((x,k)=>Math.fround(x+(k===m.member%3?m.extent[k]+offset:0))));}
 for(let i=0;i<500;i++)points.push([(random()*2-1)*160,(random()*2-1)*65,(random()*2-1)*200]);points.push([2048,4,1],[50000,-3000,3]);
 let referenceBlocks=0,visited=0,skipped=0,near=0;
 for(const p of points)for(const [skipRoof,skipFloor]of[[false,false],[true,false],[false,true]]){
  const run=hierarchy=>{let best={d:1e5,baseD:1e5,id:0,member:-1};const visit=(b,current)=>{const g=hall.groups[b.index],m=hall.parts[g.first];if(skipFloor&&m.isFloor||skipRoof&&m.surface.role==='roof-metal')return current;const d=boxF32(p,b.center,b.half);if(d>.06){if(d<best.d)best={d,baseD:d,id:0,member:-1,extent:b.half};return best.d;}near++;
   // Exhaust all members in this original analytic group to stress the near
   // branch; both paths use identical physical callback and strict tie rule.
   for(const member of g.members){const m=hall.parts[member],h=terminalHallMemberSample(m,p,hall.plan);h.d=Math.fround(h.d+Math.sin(member*4.7+p[0]*.3)*.03001);if(h.d<best.d)best=h;}
   return best.d;
  };if(hierarchy){const trace=walkOrderedHall(result.tree,blocks,p,visit);visited+=trace.visited;skipped+=trace.skipped;}else for(const b of blocks){referenceBlocks++;visit(b,best.d);}return best;};assert.deepEqual(run(true),run(false));
 }
 assert(near>1000);assert(skipped>0);console.log(JSON.stringify({scope:'CPU path-selection equivalence, synthetic bounded physical displacement, not GPU material acceptance',points:points.length,queries:points.length*3,referenceBlocks,visited,skipped,visitedFraction:visited/referenceBlocks}));
});
test('missing proxy contract, malformed bound or reordered opaque syntax fails closed',()=>{assert.throws(()=>readHallBlocks(source.replace('if(bound>.06)','if(bound>.07)')),/far-bound/);assert.throws(()=>lowerHallHierarchy(source,{leafSize:0}),/leaf/);const r=instrumentReferenceHall(source);for(const b of blocks)assert.equal(r.split(b.text).length,2);});
