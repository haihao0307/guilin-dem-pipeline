import assert from 'node:assert/strict';
import {browBandProfile as band} from './BrowBandProfile.mjs';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const candidate={headWidthFloor:.60,headCoverageFloor:.36,tailWidthReduction:.84,tailCoverageReduction:.60};
for(let i=0;i<=1000;i++){const u=i/1000,a=band(u),b=band(u,candidate);assert(Math.abs(a.width-(.82+.18*smooth(0,.18,u))*(1-.72*smooth(.55,1,u)))<1e-14);assert(Math.abs(a.coverage-(.7+.3*smooth(0,.22,u))*(1-.35*smooth(.65,1,u)))<1e-14);assert(b.width>0&&b.coverage>0&&b.width<=a.width+1e-14&&b.coverage<=a.coverage+1e-14);}
for(const u of [.22,.35,.5,.55])assert.deepEqual(band(u,candidate),band(u));
assert(band(0,candidate).coverage<band(0).coverage);assert(band(1,candidate).width<band(1).width);
for(const u of [NaN,Infinity,-.1,1.1])assert.throws(()=>band(u));
for(const [k,v] of Object.entries(candidate)){assert.throws(()=>band(.5,{[k]:NaN}));assert.throws(()=>band(.5,{[k]:Infinity}));assert.throws(()=>band(.5,{[k]:-1}));}
console.log('Brow band: exact legacy parity, finite bounded candidate, middle retained, head/tail taper and invalid-input checks passed');
const {browRetentionRatio:retention}=await import('./BrowBandProfile.mjs');
for(let i=0;i<=100;i++)for(let j=0;j<=100;j++){const u=i/100,d=.005*j/100,v=retention(u,d,.0048,candidate);assert(v>=0&&v<=1);if(d<.0048*band(u).width)assert.equal(retention(u,d,.0048),1);if(u>=.22&&u<=.55&&d<.0048)assert.equal(v,1);}
assert(retention(0,0,.0048,candidate)<1);assert(retention(1,.0012,.0048,candidate)===0);
assert.throws(()=>retention(.5,-1,.0048,candidate));assert.throws(()=>retention(.5,0,NaN,candidate));
console.log('Fixed-root retention: no new roots/refill, identical middle, bounded edge/head/tail thinning passed');
