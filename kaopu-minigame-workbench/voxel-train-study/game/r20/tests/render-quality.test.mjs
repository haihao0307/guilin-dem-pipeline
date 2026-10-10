import assert from 'node:assert/strict';
import {qualityBounds,nextRenderRatio,normalizeQuality} from '../render-quality.mjs';
for(const width of [390,700,1920,2048,2560])for(const dpr of [.8,1,1.25,2,3]){
 const q=qualityBounds({mode:'clear',dpr,width,height:1000,maxBufferSize:16384});
 assert.equal(q.initial,dpr,'Clear keeps the actual device pixel ratio without a fixed canvas-width ceiling');
 for(const frameMs of [16,33,80,500,10000])assert.equal(nextRenderRatio({mode:'clear',ratio:q.initial,max:q.max,min:q.min,frameMs}),dpr,'Clear never silently trades away detail');
 const a=qualityBounds({mode:'auto',dpr,width,height:1000,maxBufferSize:16384});let ratio=a.initial;
 for(let i=0;i<50;i++)ratio=nextRenderRatio({mode:'auto',ratio,max:a.max,min:a.min,frameMs:100});
 assert.equal(ratio,Math.min(dpr,1));
 for(let i=0;i<100;i++)ratio=nextRenderRatio({mode:'auto',ratio,max:a.max,min:a.min,frameMs:16});
 assert(Math.abs(ratio-dpr)<1e-9);
 assert.equal(qualityBounds({mode:'smooth',dpr,width,height:1000}).initial,Math.min(dpr,.75));
}
const limited=qualityBounds({mode:'clear',dpr:3,width:4096,height:2160,maxBufferSize:8192});assert.equal(limited.initial,2);assert.equal(limited.hardwareLimited,true);
assert.equal(normalizeQuality('unknown'),'clear');assert.equal(qualityBounds({dpr:NaN}).initial,1);
console.log(JSON.stringify({status:'passed',nativeDesktopDpr:true,no1100WidthCeiling:true,noSilentClearModeDowngrade:true,optInAutoBounded:true,optInSmooth:true,hardwareLimitExplicit:true}));
