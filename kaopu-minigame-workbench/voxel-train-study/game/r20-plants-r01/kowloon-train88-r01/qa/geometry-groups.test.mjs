import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';
import{createStationWGSL}from'../../kowloon-station-r04/receiver.mjs';
import{STATION_SCORE}from'../../kowloon-station-r04/station-score.mjs';
import{createStationBinding}from'../station-binding.mjs';import{hostConstructionWGSL}from'../host-construction.mjs';
import{stationGeometryPartition,stationGeometryGroupSource,mergePhysicalGroupSamples}from'../geometry-groups.mjs';import{extraction}from'../shader-closure.mjs';
const datums=JSON.parse(fs.readFileSync(new URL('./host-datums.json',import.meta.url))),construction=createStationBinding({score:STATION_SCORE,...datums}).construction;
const source=createStationWGSL({construction,hostWGSL:hostConstructionWGSL(construction.host)}),partition=stationGeometryPartition(source);
const comments=s=>s.replace(/\/\/[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
function calls(s){s=comments(s);const out=[];for(const m of s.matchAll(/\brecord(?:Candidate|Part|Timber|Coated)\(/g)){let at=m.index+m[0].length,depth=1;for(;depth;at++){if(s[at]==='(')depth++;if(s[at]===')')depth--;}out.push(s.slice(m.index,at).replace(/\s+/g,''));}return out;}
test('partition copies every original recorded construction operation once, preserving active order',()=>{
 assert.equal(partition.outer.join(''),partition.construction);assert.equal(partition.groups.length,12);
 const special='recordPart(p,shedBox,0u,p,0.)',old=calls(partition.construction),next=partition.groups.flatMap(calls);
 assert.equal(old.filter(x=>x===special).length,1);assert.equal(next.filter(x=>x===special).length,1);
 assert.deepEqual(next.filter(x=>x!==special),old.filter(x=>x!==special));
 // The moved outer bound is the sole operation when shedBox>=2. All shed
 // ingredient groups have exactly the same original <2 guard and then do none.
 for(const text of partition.groups.slice(3,9))assert.match(text,/if\(shedBox<2\.\)\{/);
 assert.equal(partition.groups.slice(3,9).filter(s=>s.includes('else{recordPart(p,shedBox')).length,1);
});
test('every group retains original candidate reset, raw overflow and physical resolver',()=>{
 for(let i=0;i<12;i++){const s=stationGeometryGroupSource(source,i);assert(s.includes(partition.reset));assert(s.includes('if(stationRawCandidateCount>=STATION_CANDIDATE_CAPACITY)'));assert(s.includes('candidate.d=stationCandidatePhysicalDistance(candidate,p,st)'));assert(s.includes('return resolveCandidates(p);'));}
});
test('hall and platform typography use the exact original word functions without a shared six-template closure',()=>{
 const hall=extraction(stationGeometryGroupSource(source,1)).closure(['stationField']),platform=extraction(stationGeometryGroupSource(source,4)).closure(['stationField']);
 assert.match(hall,/fn stationLetteringWord5\(/);assert.doesNotMatch(hall,/fn stationLetteringWord[0-4]\(/);
 assert.doesNotMatch(platform,/fn stationLetteringWord5\(/);for(let i=0;i<5;i++)assert(platform.includes('fn stationLetteringWord'+i+'('));
});
const f=Math.fround,native=new Set([1,2,3,4,12,13,15,17]);
function physical(parts){let upper=10000;const kept=[];for(const h of parts){const margin=native.has(h.id)?f(.03001):0;upper=Math.min(upper,f(h.d+margin));if(f(h.d-margin)<=upper)kept.push(h);}let win={d:10000,id:0,source:-1};for(const h of kept){const mat=native.has(h.id);if(f(h.d-(mat?f(.03001):0))>upper)continue;let d=h.d;if(mat&&f(d-f(.03))<win.d)d=Math.abs(d)<f(.045)?h.actual:f(Math.sign(d)*Math.max(f(Math.abs(d)-f(.03)),0));if(d<win.d)win={...h,d};}return win;}
test('physical group winners preserve full identity and original strict ties after f32 pruning',()=>{
 let seed=872301;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};let count=0;
 for(let k=0;k<12000;k++){const parts=Array.from({length:1+Math.floor(rand()*96)},(_,i)=>{const d=f(k%3?rand()*.16-.08:rand()*200-100);return{d,id:[0,1,2,3,4,7,8,9,12,13,15,17][Math.floor(rand()*12)],actual:f(d+(rand()*2-1)*.021),source:i,q:[i,2,3],seed:i+71,baseD:d,extent:[2,3,4],sourceSeed:i+300};});if(k%4===0&&parts.length<96)parts.push({...parts[0],source:parts.length});const groups=[];for(let i=0;i<parts.length;){const size=Math.min(parts.length-i,1+Math.floor(rand()*12)),group=parts.slice(i,i+size);groups.push({hit:physical(group),rawCount:group.length,overflow:false});i+=size;}const merged=mergePhysicalGroupSamples(groups);assert.deepEqual(merged.hit,physical(parts));assert.equal(merged.rawCount,parts.length);assert.equal(merged.overflow,false);count+=parts.length;}
 assert(count>500000);
});
test('global raw count and any local overflow keep the old explicit id999 failure',()=>{
 const groups=Array.from({length:12},()=>({hit:{d:1,id:2},rawCount:9,overflow:false}));assert.equal(mergePhysicalGroupSamples(groups).hit.id,999);groups.forEach(g=>g.rawCount=1);groups[5].overflow=true;assert.equal(mergePhysicalGroupSamples(groups).hit.id,999);
});

test('all constants referenced by the independent probe entry are retained in each emitted group',()=>{for(let i=0;i<12;i++){const s=comments(fs.readFileSync(new URL('../generated/group-'+i+'.wgsl',import.meta.url),'utf8'));for(const name of new Set(s.match(/\b[A-Z][A-Z0-9_]{2,}\b/g)||[]))assert(s.includes('const '+name+':')||s.includes('const '+name+'='),'Missing entry constant '+name+' in group '+i);}});
