import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {triangleLand} from '../coast/coverage.mjs';import {makeCoastClosure} from '../coast/closure.mjs';import {makeSetup} from '../../hong-kong-main-city-r02/airport.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..'),hostPath=fs.existsSync(path.join(root,'hong-kong-map-sea-r03/publish-final/index.html'))?'hong-kong-map-sea-r03/publish-final/index.html':'hong-kong-map-sea-r03/index.html',host=fs.readFileSync(path.join(root,hostPath),'utf8');
function objectAfter(key){let start=host.indexOf(key)+key.length,end=start,depth=0,string=false,escape=false;assert(start>=key.length);for(;end<host.length;end++){const ch=host[end];if(string){if(escape)escape=false;else if(ch==='\\')escape=true;else if(ch==='"')string=false;}else if(ch==='"')string=true;else if(ch==='{')depth++;else if(ch==='}'&&!--depth){end++;break;}}return JSON.parse(host.slice(start,end));}
const HK=objectAfter('window.HK_MAP_DATA='),decode=(s,T)=>{const b=gunzipSync(Buffer.from(s,'base64'));return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));},heights=decode(HK.heights,Float32Array),mask=decode(HK.mask,Uint8Array);
const airport=JSON.parse(fs.readFileSync(path.join(root,'hong-kong-main-city-r02/airport-1970.json')));makeSetup(airport).prepareTerrain({HK,hkHeights:heights,hkMask:mask});
const hash=b=>createHash('sha256').update(Buffer.from(b.buffer,b.byteOffset,b.byteLength)).digest('hex'),before=[hash(heights),hash(mask)];
let cases=0,oldGapSamples=0,newUncoveredSamples=0,newWaterOnLand=0,nonfiniteNonOcean=0,mixedTriangles=0,landTriangles=0;
for(let pattern=0;pattern<16;pattern++){
 const m=Uint8Array.from([0,1,2,3],k=>(pattern>>k)&1);
 for(let a=0;a<16;a++)for(let b=0;b<16;b++){
  const u=(a+.37)/16,v=(b+.41)/16,ids=u+v<=1?[0,2,1]:[1,2,3],geometryCovered=ids.every(k=>m[k]===1),sea=!triangleLand(m,2,2,0,0,u,v);
  assert.equal(sea,!geometryCovered);newUncoveredSamples+=!sea&&!geometryCovered;newWaterOnLand+=sea&&geometryCovered;cases++;
  const nearest=m[(v>=.5?2:0)+(u>=.5?1:0)]!==0;if(nearest&&!geometryCovered)oldGapSamples++;
 }
}
const w=HK.width,h=HK.height,positions=new Float32Array(w*h*7),indices=[];
for(let i=0;i<mask.length;i++)if(mask[i]!==0&&!Number.isFinite(heights[i]))nonfiniteNonOcean++;
assert.equal(nonfiniteNonOcean,0,'triangle mask must match finite-height terrain predicate');
for(let r=0;r<h;r++)for(let c=0;c<w;c++){const j=r*w+c;positions.set([HK.x0-834000+c*HK.step,heights[j]||0,827000-HK.y0+r*HK.step,0,1,0,mask[j]],j*7);if(r<h-1&&c<w-1)for(const ids of[[j,j+w,j+1],[j+1,j+w,j+w+1]]){if(ids.every(i=>mask[i]!==0)){indices.push(...ids);landTriangles++;}else if(ids.some(i=>mask[i]!==0))mixedTriangles++;}}
const closure=makeCoastClosure(positions,indices,HK,mask),after=[hash(heights),hash(mask)];assert.deepEqual(before,after);
assert(closure.stats.segments>0);for(let k=0;k<closure.segments.length;k++){const s=closure.segments[k],p=closure.positions.subarray(k*28,k*28+28);assert.deepEqual([...p.subarray(0,3)],s.a);assert.deepEqual([...p.subarray(7,10)],s.b);assert.equal(p[15],-2);assert.equal(p[22],-2);}
// Internal detail rectangles are not coast: only an adjacent omitted ocean triangle qualifies.
const dry=new Float32Array([0,4,0,0,1,0,1, 1,4,0,0,1,0,1, 0,4,1,0,1,0,1, 1,4,1,0,1,0,1]);assert.equal(makeCoastClosure(dry,[0,2,1],{width:2,height:2},new Uint8Array([1,1,1,1])).stats.segments,0);
const report={passed:true,patternSamples:cases,oldNearestMaskGapSamples:oldGapSamples,newUncoveredSamples,newWaterOnLand,realGrid:[w,h],realLandTriangles:landTriangles,realMixedTriangles:mixedTriangles,nonfiniteNonOcean,closure:closure.stats,sourceHashesBefore:before,sourceHashesAfter:after,oldDatumAndSourceValuesRetained:true,scope:'CPU geometry/coverage partition, not GPU visual acceptance; source 30m staircase resolution remains'};
fs.writeFileSync(path.join(here,'COAST-CPU-QA.json'),JSON.stringify(report,null,2)+'\n');console.log(report);
