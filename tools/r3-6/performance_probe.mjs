import {chromium} from 'playwright';

const target=process.env.R35_URL||'http://127.0.0.1:8765/site/dist/r3-5/';
const browser=await chromium.launch({headless:true});

function ms(){return performance.now();}
async function waitReady(page,id){
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,{timeout:120000});
}
async function waitOsm(page,id){
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch===expected;},id,{timeout:120000});
}
async function selectTimed(page,id){
  const t0=ms();
  await page.selectOption('#location',id);
  await waitReady(page,id);
  const terrainReadyMs=ms()-t0;
  await waitOsm(page,id);
  const osmReadyMs=ms()-t0;
  const state=await page.evaluate(()=>{const c=document.querySelector('#terrain');return{
    patch:c?.dataset.patch,osmPatch:c?.dataset.osmPatch,
    roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),
    buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn),
    quantStepM:Number(c?.dataset.osmQuantizationMaxStepM),
    roadRejected:Number(c?.dataset.osmRoadSegmentsRejectedNoSurface),
    buildingRejected:Number(c?.dataset.osmBuildingSegmentsRejectedNoSurface),
  };});
  return{terrainReadyMs,osmReadyMs,state};
}
async function cdpMetrics(page){
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const raw=await cdp.send('Performance.getMetrics');
  const map=Object.fromEntries(raw.metrics.map(x=>[x.name,x.value]));
  const dom=await cdp.send('Memory.getDOMCounters');
  await cdp.detach();
  const keep=['JSHeapUsedSize','JSHeapTotalSize','Nodes','LayoutCount','RecalcStyleCount','ScriptDuration','TaskDuration'];
  const out={};for(const k of keep)if(k in map)out[k]=map[k];
  return{...out,documents:dom.documents,nodes:dom.nodes,jsEventListeners:dom.jsEventListeners};
}
async function rafProbe(page,frames=120){
  return page.evaluate(n=>new Promise(resolve=>{
    const times=[];let last=performance.now();let count=0;
    function tick(now){times.push(now-last);last=now;count++;if(count>=n){
      const sorted=[...times].sort((a,b)=>a-b);const pct=p=>sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))];
      resolve({frames:n,meanMs:times.reduce((a,b)=>a+b,0)/times.length,p50Ms:pct(.5),p95Ms:pct(.95),p99Ms:pct(.99),maxMs:Math.max(...times),over33ms:times.filter(x=>x>33.4).length,over50ms:times.filter(x=>x>50).length});
    }else requestAnimationFrame(tick);}
    requestAnimationFrame(tick);
  }),frames);
}

const mobileLike=await browser.newContext({
  viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
});
const page=await mobileLike.newPage();
const runtimeErrors=[];page.on('pageerror',e=>runtimeErrors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console: ${m.text()}`);});
const nav0=ms();await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});const initialTerrainReadyMs=ms()-nav0;
const query01=await selectTimed(page,'query-01');const queryMetrics=await cdpMetrics(page);const queryRaf=await rafProbe(page,90);
const overview=await selectTimed(page,'overview');const overviewMetrics=await cdpMetrics(page);const overviewRaf=await rafProbe(page,120);
const overviewPixels=await page.locator('#terrain').screenshot();
const overviewState=await page.evaluate(()=>{const c=document.querySelector('#terrain');return{roadsVisible:c?.dataset.osmRoadsVisible,buildingsVisible:c?.dataset.osmBuildingsVisible,sourceSha:c?.dataset.osmSourceReleaseSha256,correctedReportSha:c?.dataset.osmCorrectedReportSha256,semantic:{roadWidth:c?.dataset.osmRoadWidthClaim,buildingHeight:c?.dataset.osmBuildingHeightClaim,anchor:c?.dataset.osmSurfaceAnchor,syntheticClosure:c?.dataset.osmBuildingSyntheticPatchClosure}};});

// Cancellation baseline: add deterministic latency only to OSM binary payloads.
const stressContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
let started=0,finished=0,failed=0;const startedUrls=[],failedUrls=[];
stressContext.on('request',req=>{if(req.url().includes('/site/dist/r3-5/data/osm/')&&req.url().endsWith('.u16le')){started++;startedUrls.push(req.url());}});
stressContext.on('requestfinished',req=>{if(req.url().includes('/site/dist/r3-5/data/osm/')&&req.url().endsWith('.u16le'))finished++;});
stressContext.on('requestfailed',req=>{if(req.url().includes('/site/dist/r3-5/data/osm/')&&req.url().endsWith('.u16le')){failed++;failedUrls.push({url:req.url(),error:req.failure()?.errorText});}});
await stressContext.route('**/site/dist/r3-5/data/osm/*.u16le',async route=>{await new Promise(r=>setTimeout(r,350));await route.continue();});
const stress=await stressContext.newPage();await stress.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await stress.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
for(const id of ['query-01','query-02','query-03']){
  await stress.selectOption('#location',id);await waitReady(stress,id);
}
await waitOsm(stress,'query-03');await stress.waitForTimeout(1200);
const finalStressState=await stress.evaluate(()=>{const c=document.querySelector('#terrain');return{patch:c?.dataset.patch,osmPatch:c?.dataset.osmPatch,osmLoaded:c?.dataset.osmLoaded,osmError:c?.dataset.osmError||null};});

const report={
  schema:'wenzhou-r3.6-osm-performance-baseline/r1',
  target,
  engine:'Playwright Chromium; mobile viewport/device emulation only, NOT real iPhone Safari/GPU evidence',
  context:{viewport:[390,844],deviceScaleFactor:3,isMobile:true,hasTouch:true},
  initialTerrainReadyMs,
  query01:{...query01,cdp:queryMetrics,raf:queryRaf},
  overview:{...overview,cdp:overviewMetrics,raf:overviewRaf,pngBytes:overviewPixels.length,state:overviewState},
  staleRequestStress:{artificialOsmPayloadDelayMs:350,sequence:['query-01','query-02','query-03'],started,finished,failed,startedUrls:[...new Set(startedUrls)],failedUrls,finalState:finalStressState},
  runtimeErrors,
  interpretation:{
    realIphoneVerified:false,
    timingUse:'relative CI baseline for comparing R3.6 implementation on the same runner class; not a real-device production SLA',
    staleRequestGoal:'R3.6 should abort superseded OSM payload fetches instead of merely ignoring their completed results.'
  }
};
console.log(JSON.stringify(report,null,2));
await stressContext.close();await mobileLike.close();await browser.close();
if(runtimeErrors.length)process.exit(1);
