import {chromium} from 'playwright';
const target=process.env.R36_URL||'http://127.0.0.1:8765/site/dist/r3-6/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
const page=await context.newPage();
const events=[];const t0=Date.now();
const keep=u=>u.includes('/site/dist/r3-5/data/osm/')||u.includes('/site/dist/r3-5/data/osm-context.json')||u.includes('/site/dist/r3-1/data/terrain.json');
page.on('request',r=>{if(keep(r.url()))events.push({t:Date.now()-t0,type:'request',url:r.url()});});
page.on('requestfinished',r=>{if(keep(r.url()))events.push({t:Date.now()-t0,type:'finished',url:r.url()});});
page.on('requestfailed',r=>{if(keep(r.url()))events.push({t:Date.now()-t0,type:'failed',url:r.url(),failure:r.failure()?.errorText});});
page.on('pageerror',e=>events.push({t:Date.now()-t0,type:'pageerror',message:e.message}));
page.on('console',m=>{if(m.type()==='error')events.push({t:Date.now()-t0,type:'console-error',message:m.text()});});
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
await page.selectOption('#location','query-01');
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.patch==='query-01'&&document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
const samples=[];
for(let i=0;i<20;i++){
  const s=await page.evaluate(()=>{const c=document.querySelector('#terrain');return{t:performance.now(),patch:c?.dataset.patch,ready:c?.dataset.ready,osmPatch:c?.dataset.osmPatch,osmLoading:c?.dataset.osmLoading,osmLoaded:c?.dataset.osmLoaded,osmKind:c?.dataset.osmKind,osmError:c?.dataset.osmError,abortCount:c?.dataset.osmAbortCount,fetchAbortCount:c?.dataset.osmFetchAbortCount,cacheHits:c?.dataset.osmCacheHits,cacheMisses:c?.dataset.osmCacheMisses,buildMs:c?.dataset.osmBuildMs,maxChunkMs:c?.dataset.osmMaxChunkMs,yieldCount:c?.dataset.osmYieldCount,roadSegments:c?.dataset.osmRoadSegmentsDrawn,roadSourceVertices:c?.dataset.osmRoadSourceVertices,roadSampleCalls:c?.dataset.osmRoadSampleCalls,buildingSegments:c?.dataset.osmBuildingSegmentsDrawn,landcover:c?.dataset.landcoverKind,soil:c?.dataset.surfaceEvidenceKind,sea:c?.dataset.seaSurfaceKind};});
  samples.push(s);if(s.osmLoaded==='true'||s.osmError)break;await page.waitForTimeout(1000);
}
console.log(JSON.stringify({schema:'wenzhou-r3.6-query01-diagnostic/r1',target,samples,events},null,2));
await context.close();await browser.close();
