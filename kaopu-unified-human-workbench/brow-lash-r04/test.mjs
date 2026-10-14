import assert from 'node:assert/strict';
import {closureWeight,lashEnvelope,domainWidth,normalizeLength,polylineLength,BROW_REGIONS} from './Profiles.mjs';
const checks=[],test=(name,f)=>{f();checks.push({name,passed:true});};
test('control100 equals native65 with no values above the endpoint',()=>{for(let i=0;i<=1000;i++){const w=closureWeight(i/1000);assert(w>=0&&w<=.65);if(i)assert(w>=closureWeight((i-1)/1000));}assert.equal(closureWeight(1),.65);assert.equal(closureWeight(0),0);});
test('invalid closure input is rejected, never extrapolated',()=>{for(const x of[NaN,Infinity,-.1,1.001,'1',null])assert.throws(()=>closureWeight(x));});
test('center-long lashes have smooth and shorter inner and outer ends',()=>{assert(lashEnvelope(.5)>lashEnvelope(.15)*1.8);assert(lashEnvelope(.5)>lashEnvelope(.85)*1.8);for(let i=0;i<=100;i++)assert(Math.abs(lashEnvelope(i/100)-lashEnvelope(1-i/100))<1e-12);});
test('arc length budget survives fan and curl changes without moving roots',()=>{for(const length of[.002,.004,.0074]){const p=[[1,2,3],[1.001,2.003,3.004],[1.003,2.005,3.01]],n=normalizeLength(p,length);assert.deepEqual(n[0],p[0]);assert(Math.abs(polylineLength(n)-length)<1e-12);}});
test('root domain has finite support, body wider than tail, and contiguous regions',()=>{assert.equal(domainWidth(0),0);assert.equal(domainWidth(1),0);assert(domainWidth(.35)>domainWidth(.85)*2);for(let i=0;i<=1000;i++)assert(Number.isFinite(domainWidth(i/1000))&&domainWidth(i/1000)>=0);assert.equal(BROW_REGIONS[0].a,0);assert.equal(BROW_REGIONS[2].b,1);for(let i=1;i<3;i++)assert.equal(BROW_REGIONS[i-1].b,BROW_REGIONS[i].a);});
console.log(JSON.stringify({version:'BROW-LASH-R04',checks},null,2));
