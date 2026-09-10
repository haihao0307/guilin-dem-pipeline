import {chromium} from 'playwright';

const target=process.env.R36_URL||'http://127.0.0.1:8765/site/dist/r3-6/';
const browser=await chromium.launch({headless:true});
function ms(){return performance.now();}
async function waitReady(page,id){await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,{timeout:120000});}
async function waitOsm(page,id){await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch===expected;},id,{timeout:120000});}
async function state(page){return page.evaluate(()=>{const c=document.querySelector('#terrain');return{
  patch:c?.dataset.patch,osmPatch:c?.dataset.osmPatch,roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn),
  roadRejected:Number(c?.dataset.osmRoadSegmentsRejectedNoSurface),buildingRejected:Number(c?.dataset.osmBuildingSegmentsRejectedNoSurface),
  sourceSha:c?.dataset.osmSourceReleaseSha256,correctedReportSha:c?.dataset.osmCorrectedReportSha256,
  roadWidth:c?.dataset.osmRoadWidthClaim,buildingHeight:c?.dataset.osmBuildingHeightClaim,anchor:c?.dataset.osmSurfaceAnchor,syntheticClosure:c?.dataset.osmBuildingSyntheticPatchClosure,
  runtime:c?.dataset.osmRuntime,indexed:c?.dataset.osmIndexed,abortController:c?.dataset.osmAbortController,
  abortCount:Number(c?.dataset.osmAbortCount||0),fetchAbortCount:Number(c?.dataset.osmFetchAbortCount||0),cacheHits:Number(c?.dataset.osmCacheHits||0),cacheMisses:Number(c?.dataset.osmCacheMisses||0),
  buildMs:Number(c?.dataset.osmBuildMs||0),maxChunkMs:Number(c?.dataset.osmMaxChunkMs||0),yieldCount:Number(c?.dataset.osmYieldCount||0),
  roadSourceVertices:Number(c?.dataset.osmRoadSourceVertices||0),roadGpuVertices:Number(c?.dataset.osmRoadGpuVertices||0),roadGpuIndexCount:Number(c?.dataset.osmRoadGpuIndexCount||0),roadSampleCalls:Number(c?.dataset.osmRoadSampleCalls||0),
  buildingSourceVertices:Number(c?.dataset.osmBuildingSourceVertices||0),buildingGpuVertices:Number(c?.dataset.osmBuildingGpuVertices||0),buildingGpuIndexCount:Number(c?.dataset.osmBuildingGpuIndexCount||0),buildingSampleCalls:Number(c?.dataset.osmBuildingSampleCalls||0)
};});}
async function selectTimed(page,id){const t0=ms();await page.selectOption('#location',id);await waitReady(page,id);const terrainReadyMs=ms()-t0;await waitOsm(page,id);return{terrainReadyMs,osmReadyMs:ms()-t0,state:await state(page)};}
async function cdpMetrics(page){const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');const raw=await cdp.send('Performance.getMetrics');const map=Object.fromEntries(raw.metrics.map(x=>[x.name,x.value]));const dom=await cdp.send('Memory.getDOMCounters');await cdp.detach();const keep=['JSHeapUsedSize','JSHeapTotalSize','Nodes','LayoutCount','RecalcStyleCount','ScriptDuration','TaskDuration'];const out={};for(const k of keep)if(k in map)out[k]=map[k];return{...out,documents:dom.documents,nodes:dom.nodes,jsEventListeners:dom.jsEventListeners};}
async function rafProbe(page,frames=120){return page.evaluate(n=>new Promise(resolve=>{const times=[];let last=performance.now(),count=0;function tick(now){times.push(now-last);last=now;if(++count>=n){const sorted=[...times].sort((a,b)=>a-b),pct=p=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];resolve({frames:n,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),maxMs:Math.max(...times),over33ms:times.filter(x=>x>33.4).length,over50ms:times.filter(x=>x>50).length});}else requestAnimationFrame(tick);}requestAnimationFrame(tick);}),frames);}

const mobileLike=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'});
const page=await mobileLike.newPage();const runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console: ${m.text()}`);});
const nav0=ms();await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});const initialTerrainReadyMs=ms()-nav0;
const query01=await selectTimed(page,'query-01'),queryMetrics=await cdpMetrics(page),queryRaf=await rafProbe(page,90);
const overview=await selectTimed(page,'overview'),overviewMetrics=await cdpMetrics(page),overviewRaf=await rafProbe(page,120),overviewPixels=await page.locator('#terrain').screenshot();

const stressContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
let started=0,finished=0,failed=0;const startedUrls=[],failedUrls=[];
const isPayload=url=>url.includes('/site/dist/r3-5/data/osm/')&&url.endsWith('.u16le');
stressContext.on('request',req=>{if(isPayload(req.url())){started++;startedUrls.push(req.url());}});stressContext.on('requestfinished',req=>{if(isPayload(req.url()))finished++;});stressContext.on('requestfailed',req=>{if(isPayload(req.url())){failed++;failedUrls.push({url:req.url(),error:req.failure()?.errorText});}});
await stressContext.route('**/site/dist/r3-5/data/osm/*.u16le',async route=>{await new Promise(r=>setTimeout(r,350));try{await route.continue();}catch{}});
const stress=await stressContext.newPage();await stress.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await stress.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
for(const id of ['query-01','query-02','query-03']){await stress.selectOption('#location',id);await waitReady(stress,id);}await waitOsm(stress,'query-03');await stress.waitForTimeout(1200);const finalStressState=await state(stress);

const report={schema:'wenzhou-r3.6-osm-performance-compare/r1',target,engine:'Playwright Chromium mobile emulation only; NOT real iPhone Safari/GPU evidence',context:{viewport:[390,844],deviceScaleFactor:3,isMobile:true,hasTouch:true},initialTerrainReadyMs,query01:{...query01,cdp:queryMetrics,raf:queryRaf},overview:{...overview,cdp:overviewMetrics,raf:overviewRaf,pngBytes:overviewPixels.length},staleRequestStress:{artificialOsmPayloadDelayMs:350,sequence:['query-01','query-02','query-03'],started,finished,failed,startedUrls:[...new Set(startedUrls)],failedUrls,finalState:finalStressState},runtimeErrors,baseline:{queryOsmReadyMs:12703.345597,queryHeapUsed:48863980,queryRafP50Ms:183.2,overviewOsmReadyMs:4763.942265,overviewHeapUsed:213818212,overviewRafP50Ms:683.3,staleStarted:7,staleFinished:7,staleFailed:0},interpretation:{realIphoneVerified:false,timingUse:'relative CI comparison only; not a production SLA'}};
console.log(JSON.stringify(report,null,2));await stressContext.close();await mobileLike.close();await browser.close();if(runtimeErrors.length)process.exit(1);
