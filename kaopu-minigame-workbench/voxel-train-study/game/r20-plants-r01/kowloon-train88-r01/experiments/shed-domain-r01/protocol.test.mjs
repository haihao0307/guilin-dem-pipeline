import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{compactMerge,fullMerge}from'../compact-trace-r01/merge.mjs';
const empty=[10000,0,10000,0];
test('empty five groups are identity only for canonical strict-min prefixes including invalid winners and sticky overflow',()=>{
 const rows=[[1,2,1,171],[0,15,0,4],[-.1,17,-.1,3],[NaN,3,1,1],[Infinity,3,1,1],[10000,3,1,1],[1,3,NaN,5],[2,4,1,1],[-Infinity,4,1,1]];
 let count=0;for(const a of rows)for(const b of rows)for(const raw of[0,1,95,96,97])for(const overflow of[false,true]){
  let c=compactMerge(compactMerge([10000,0,0,0],a,raw,overflow),b,0,false),f=fullMerge(fullMerge({a:empty,raw:0,overflow:false},a,raw,overflow),b,0,false);const originalC=c.slice(),originalF=structuredClone(f);
  for(let i=0;i<5;i++){c=compactMerge(c,empty,0,false);f=fullMerge(f,empty,0,false);}assert.deepEqual(c,originalC);assert.deepEqual(f,originalF);count++;
 }assert.equal(count,810);
 assert.notDeepEqual(compactMerge([Infinity,2,0,2],empty,0,false),[Infinity,2,0,2]);
});
test('one prefix carry leaves all omitted pixels correct in BOTH buffers while eligible pixels retain strict canonical merge order',()=>{
 for(const eligible of[[],[0],[1,3],[0,1,2,3]]){const prefix=Array.from({length:4},(_,i)=>[i+.25,2,i,i===3?2:0]);const full=prefix.map(x=>x.slice()),buffers=[prefix.map(x=>x.slice()),prefix.map(x=>x.slice())];let last=1;
  for(let group=4;group<=8;group++){const next=group%2;for(let p=0;p<4;p++){const local=eligible.includes(p)?[p+.1-(group-4)*.01,group,1,171]:empty;full[p]=compactMerge(full[p],local,eligible.includes(p)?1:0,false);if(eligible.includes(p))buffers[next][p]=compactMerge(buffers[last][p],local,1,false);}last=next;}
  assert.deepEqual(buffers[last],full);for(let p=0;p<4;p++)if(!eligible.includes(p)){assert.deepEqual(buffers[0][p],prefix[p]);assert.deepEqual(buffers[1][p],prefix[p]);}
 }
});
test('spatial guard source is the original empty branch, group3 alone keeps the far proxy',()=>{
 for(let i=3;i<=8;i++){const s=fs.readFileSync(new URL(`../../generated/group-${i}.wgsl`,import.meta.url),'utf8'),start=s.indexOf('fn stationDomain('),body=s.slice(start);assert.match(body,/stationCandidates.count=0u;stationCandidateOverflow=false;stationRawCandidateCount=0u;stationCandidateUpper=10000\./);assert.match(body,/let shedBox=box\(p-vec3<f32>\(0,7,SHED_CENTER\),vec3<f32>\(34,8,SHED_HALF\+2.2\)\);\s*if\(shedBox<2\.\)/);assert.match(s,/const SHED_HALF:f32=67.5;/);assert.match(s,/const SHED_CENTER:f32=-77.5;/);if(i===3)assert.match(body,/else\{recordPart\(p,shedBox,0u,p,0\.\);\}/);else assert.doesNotMatch(body,/else\{recordPart\(p,shedBox/);}
});
test('bounded probe preserves time, original footprint, final full metadata and valid-region ping-pong comparisons',()=>{
 const f=JSON.parse(fs.readFileSync(new URL('./fixture.json',import.meta.url)));assert.equal(Math.fround(f.clock),Math.fround(380.1999999999998));assert.equal(f.age,.58);for(const v of f.views){assert.deepEqual([v.width,v.height],[640,426]);assert.equal(v.buffers.trace.length,1296);}
 const p=fs.readFileSync(new URL('./probe.mjs',import.meta.url),'utf8');assert.match(p,/phase:1,rects:v.rects/);assert.match(p,/seed\/baseD\/q\/extent\/sourceSeed/);assert.match(p,/Snapshot coverage differs/);assert.match(p,/ordinal===0&&\[0,15,63,111\]/);assert.doesNotMatch(p,/requestAnimationFrame/);
});
