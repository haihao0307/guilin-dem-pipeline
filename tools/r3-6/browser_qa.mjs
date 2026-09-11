import {chromium} from 'playwright';

const target=process.env.R36_URL||'http://127.0.0.1:8765/site/dist/r3-6/';
const failures=[];const notes=[];
function assert(cond,message){if(!cond)failures.push(message);}
async function allowGithack(context){if(target.includes('raw.githack.com'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});await allowGithack(context);
const page=await context.newPage();const runtimeErrors=[];
page.on('pageerror',e=>runtimeErrors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console: ${m.text()}`);});
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
assert((await page.title()).includes('R3.6'),'title is not R3.6');
assert((await page.getAttribute('html','data-wenzhou-r36-boot'))==='true','R3.6 bootstrap marker missing');
async function selectPatch(id){
  await page.selectOption('#location',id);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,{timeout:120000});
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch===expected&&c?.dataset.osmRuntime==='indexed-r36';},id,{timeout:120000});
}
async function state(){return page.evaluate(()=>{const c=document.querySelector('#terrain');return{
  patch:c?.dataset.patch,kind:c?.dataset.osmKind,runtime:c?.dataset.osmRuntime,indexed:c?.dataset.osmIndexed,abortController:c?.dataset.osmAbortController,
  roadsVisible:c?.dataset.osmRoadsVisible,buildingsVisible:c?.dataset.osmBuildingsVisible,
  roadParts:Number(c?.dataset.osmRoadParts),roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),roadRejected:Number(c?.dataset.osmRoadSegmentsRejectedNoSurface),
  buildingParts:Number(c?.dataset.osmBuildingBoundaryParts),buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn),buildingRejected:Number(c?.dataset.osmBuildingSegmentsRejectedNoSurface),
  syntheticClosure:c?.dataset.osmBuildingSyntheticPatchClosure,roadWidth:c?.dataset.osmRoadWidthClaim,buildingHeight:c?.dataset.osmBuildingHeightClaim,anchor:c?.dataset.osmSurfaceAnchor,
  sourceSha:c?.dataset.osmSourceReleaseSha256,auditSha:c?.dataset.osmCorrectedReportSha256,
  buildMs:Number(c?.dataset.osmBuildMs),maxChunkMs:Number(c?.dataset.osmMaxChunkMs),yieldCount:Number(c?.dataset.osmYieldCount),
  abortCount:Number(c?.dataset.osmAbortCount),fetchAbortCount:Number(c?.dataset.osmFetchAbortCount),cacheHits:Number(c?.dataset.osmCacheHits),cacheMisses:Number(c?.dataset.osmCacheMisses),
  roadSourceVertices:Number(c?.dataset.osmRoadSourceVertices),roadGpuVertices:Number(c?.dataset.osmRoadGpuVertices),roadGpuIndexCount:Number(c?.dataset.osmRoadGpuIndexCount),roadSampleCalls:Number(c?.dataset.osmRoadSampleCalls),roadIndexType:c?.dataset.osmRoadIndexType,
  buildingSourceVertices:Number(c?.dataset.osmBuildingSourceVertices),buildingGpuVertices:Number(c?.dataset.osmBuildingGpuVertices),buildingGpuIndexCount:Number(c?.dataset.osmBuildingGpuIndexCount),buildingSampleCalls:Number(c?.dataset.osmBuildingSampleCalls),buildingIndexType:c?.dataset.osmBuildingIndexType,
  landcoverKind:c?.dataset.landcoverKind,soilKind:c?.dataset.surfaceEvidenceKind,soilPatch:c?.dataset.surfacePatch,seaKind:c?.dataset.seaSurfaceKind
};});}
function checkSemantic(s,label){
  assert(s.kind==='external-mapped-observation',`${label} OSM identity changed ${JSON.stringify(s)}`);
  assert(s.runtime==='indexed-r36'&&s.indexed==='true'&&s.abortController==='true',`${label} optimized runtime markers missing ${JSON.stringify(s)}`);
  assert(s.syntheticClosure==='false',`${label} synthetic closure changed`);
  assert(s.roadWidth==='none-screen-style-only',`${label} road width claim changed`);
  assert(s.buildingHeight==='unknown-not-generated',`${label} building height claim changed`);
  assert(s.anchor==='current-display-triangles',`${label} display anchor changed`);
  assert(s.sourceSha==='f3ae1c9051b25fc1d23c8df1dd951a9138d6b188b1e46bff56a352c324a90101',`${label} source SHA changed`);
  assert(s.auditSha==='d9a2d7986f74cfd4309174151dbc36920e188080f4c1daf21ae865efa3dd4364',`${label} audit SHA changed`);
  assert(s.roadSourceVertices===s.roadGpuVertices&&s.roadSampleCalls===s.roadSourceVertices,`${label} road vertices should be sampled/uploaded once ${JSON.stringify(s)}`);
  assert(s.roadGpuIndexCount===s.roadSegments*2,`${label} road index count mismatch ${JSON.stringify(s)}`);
  if(s.buildingSourceVertices>0){
    assert(s.buildingSourceVertices===s.buildingGpuVertices&&s.buildingSampleCalls===s.buildingSourceVertices,`${label} building vertices should be sampled/uploaded once ${JSON.stringify(s)}`);
    assert(s.buildingGpuIndexCount===s.buildingSegments*2,`${label} building index count mismatch ${JSON.stringify(s)}`);
  }
}

await selectPatch('query-01');let s=await state();checkSemantic(s,'query-01');
assert(s.roadParts===446&&s.roadSegments===11007&&s.roadRejected===109,`query-01 road geometry changed ${JSON.stringify(s)}`);
assert(s.buildingParts===189&&s.buildingSegments===906&&s.buildingRejected===4,`query-01 building geometry changed ${JSON.stringify(s)}`);
assert(s.landcoverKind==='worldcover-2021-context'&&s.soilKind==='soil-model-appearance-demo'&&s.soilPatch==='query-01'&&s.seaKind==='demonstration','inherited R3.2-R3.4 layers missing at query-01');
assert(s.maxChunkMs>0&&s.yieldCount>0&&Number.isFinite(s.buildMs),'R3.6 runtime instrumentation missing');
const bothPixels=await page.locator('#terrain').screenshot();
await page.uncheck('#show-osm-roads');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmRoadsVisible==='false');await page.waitForTimeout(100);const noRoadPixels=await page.locator('#terrain').screenshot();const roadPixelToggleVerified=!bothPixels.equals(noRoadPixels);assert(roadPixelToggleVerified,'R3.6 road toggle did not change WebGL pixels');
await page.check('#show-osm-roads');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmRoadsVisible==='true');
await page.uncheck('#show-osm-buildings');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmBuildingsVisible==='false');await page.waitForTimeout(100);const noBuildingPixels=await page.locator('#terrain').screenshot();const buildingPixelToggleVerified=!bothPixels.equals(noBuildingPixels);assert(buildingPixelToggleVerified,'R3.6 building toggle did not change WebGL pixels');
await page.check('#show-osm-buildings');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmBuildingsVisible==='true');

// Same patch rebuild should reuse already SHA-verified payload bytes through the tiny cache.
const cacheBefore=s.cacheHits;
await page.selectOption('#exaggeration','3');
await page.waitForFunction(()=>{const c=document.querySelector('#terrain');return c?.dataset.patch==='query-01'&&c?.dataset.osmLoaded==='true'&&c?.dataset.osmRuntime==='indexed-r36';},null,{timeout:120000});
s=await state();checkSemantic(s,'query-01@3x');assert(s.roadSegments===11007&&s.buildingSegments===906,'3x rebuild changed OSM segment set');assert(s.cacheHits>cacheBefore,'same-patch rebuild did not hit R3.6 verified payload cache');
await page.selectOption('#exaggeration','1');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmLoaded==='true'&&document.querySelector('#terrain')?.dataset.patch==='query-01',null,{timeout:120000});

await page.click('#eye-view');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='true');await page.waitForFunction(()=>Number.isFinite(Number(document.querySelector('#terrain')?.dataset.eyeHeightM)));
const h0=Number(await page.getAttribute('#terrain','data-eye-height-m'));await page.locator('#terrain').focus();await page.keyboard.press('w');await page.waitForTimeout(140);const h1=Number(await page.getAttribute('#terrain','data-eye-height-m'));assert(Math.abs(h0-1.6)<=.002&&Math.abs(h1-1.6)<=.002,`R3.6 eye regression h0=${h0} h1=${h1}`);await page.keyboard.press('r');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='false');notes.push({patch:'query-01',state:await state(),h0,h1});

for(const [id,expected] of [
  ['river-oujiang',{roads:32807,roadRejected:404,buildings:2184,buildingRejected:8}],
  ['mountains',{roads:1865,roadRejected:27,buildings:0,buildingRejected:0}],
  ['overview',{roads:508201,roadRejected:1411,buildings:0,buildingRejected:0}],
]){
  await selectPatch(id);s=await state();checkSemantic(s,id);
  assert(s.roadSegments===expected.roads&&s.roadRejected===expected.roadRejected,`${id} road segment set changed ${JSON.stringify(s)}`);
  assert(s.buildingSegments===expected.buildings&&s.buildingRejected===expected.buildingRejected,`${id} building segment set changed ${JSON.stringify(s)}`);
  if(id==='overview')assert(s.roadSourceVertices<s.roadGpuIndexCount,`overview indexed representation did not reduce repeated endpoint vertices ${JSON.stringify(s)}`);
  notes.push({patch:id,state:s});
}
assert(runtimeErrors.length===0,`runtime errors: ${runtimeErrors.join(' | ')}`);

const mobileContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await allowGithack(mobileContext);const mobile=await mobileContext.newPage();const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text());});
await mobile.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});await mobile.selectOption('#location','query-01');await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmLoaded==='true'&&document.querySelector('#terrain')?.dataset.osmRuntime==='indexed-r36'&&document.querySelector('#terrain')?.dataset.osmPatch==='query-01',null,{timeout:120000});
const mobileLayout=await mobile.evaluate(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect();const eye=rect('#eye-view'),controls=rect('.camera-controls'),roadToggle=rect('label:has(#show-osm-roads)'),buildingToggle=rect('label:has(#show-osm-buildings)'),card=rect('#osm-card'),focus=rect('.focus-panel'),c=document.querySelector('#terrain');return{innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,eyeInside:!!eye&&eye.left>=0&&eye.right<=innerWidth,controlsInside:!!controls&&controls.left>=0&&controls.right<=innerWidth,roadToggleInside:!!roadToggle&&roadToggle.left>=0&&roadToggle.right<=innerWidth,buildingToggleInside:!!buildingToggle&&buildingToggle.right<=innerWidth,cardInside:!!card&&card.left>=0&&card.right<=innerWidth,focusAboveControls:!!focus&&!!controls&&focus.bottom<=controls.top-4,runtime:c?.dataset.osmRuntime,roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn),roadWidth:c?.dataset.osmRoadWidthClaim,buildingHeight:c?.dataset.osmBuildingHeightClaim};});
assert(mobileLayout.scrollWidth<=mobileLayout.innerWidth,`mobile horizontal overflow ${JSON.stringify(mobileLayout)}`);assert(mobileLayout.eyeInside&&mobileLayout.controlsInside&&mobileLayout.roadToggleInside&&mobileLayout.buildingToggleInside&&mobileLayout.cardInside,`mobile controls/card outside ${JSON.stringify(mobileLayout)}`);assert(mobileLayout.focusAboveControls,`mobile panel overlaps camera controls ${JSON.stringify(mobileLayout)}`);assert(mobileLayout.runtime==='indexed-r36'&&mobileLayout.roadSegments===11007&&mobileLayout.buildingSegments===906,'mobile R3.6 evidence missing or changed');assert(mobileErrors.length===0,`mobile runtime errors: ${mobileErrors.join(' | ')}`);

// Deterministic cancellation stress. Superseded R3.6 payload fetches must abort.
const stressContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await allowGithack(stressContext);let started=0,finished=0,failed=0;const failedUrls=[];
stressContext.on('request',req=>{if(req.url().includes('/site/dist/r3-5/data/osm/')&&req.url().endsWith('.u16le'))started++;});stressContext.on('requestfinished',req=>{if(req.url().includes('/site/dist/r3-5/data/osm/')&&req.url().endsWith('.u16le'))finished++;});stressContext.on('requestfailed',req=>{if(req.url().includes('/site/dist/r3-5/data/osm/')&&req.url().endsWith('.u16le')){failed++;failedUrls.push({url:req.url(),error:req.failure()?.errorText});}});
await stressContext.route('**/site/dist/r3-5/data/osm/*.u16le',async route=>{await new Promise(r=>setTimeout(r,500));try{await route.continue();}catch{}});
const stress=await stressContext.newPage();await stress.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await stress.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
for(const id of ['query-01','query-02','query-03']){await stress.selectOption('#location',id);await stress.waitForFunction(expected=>document.querySelector('#terrain')?.dataset.patch===expected&&document.querySelector('#terrain')?.dataset.ready==='true',id,{timeout:120000});}
await stress.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmLoaded==='true'&&document.querySelector('#terrain')?.dataset.osmPatch==='query-03',null,{timeout:120000});await stress.waitForTimeout(900);
const cancellation=await stress.evaluate(()=>{const c=document.querySelector('#terrain');return{patch:c?.dataset.patch,osmPatch:c?.dataset.osmPatch,abortCount:Number(c?.dataset.osmAbortCount),fetchAbortCount:Number(c?.dataset.osmFetchAbortCount),runtime:c?.dataset.osmRuntime,error:c?.dataset.osmError||null};});
assert(cancellation.patch==='query-03'&&cancellation.osmPatch==='query-03'&&cancellation.runtime==='indexed-r36','cancellation stress final state wrong');assert(cancellation.abortCount>=2,`superseded build controllers were not aborted ${JSON.stringify(cancellation)}`);assert(cancellation.fetchAbortCount>0||failed>0,`superseded payload fetches did not abort; started=${started} finished=${finished} failed=${failed} state=${JSON.stringify(cancellation)}`);

console.log(JSON.stringify({passed:failures.length===0,target,roadPixelToggleVerified,buildingPixelToggleVerified,notes,mobileLayout,cancellationStress:{started,finished,failed,failedUrls,finalState:cancellation},runtimeErrors,mobileErrors,failures},null,2));
await stressContext.close();await mobileContext.close();await context.close();await browser.close();if(failures.length)process.exit(1);
