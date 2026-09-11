import {chromium} from 'playwright';

const target=process.env.R37_URL||'http://127.0.0.1:8765/site/dist/r3-7/';
const failures=[];const notes=[];
const assert=(cond,msg)=>{if(!cond)failures.push(msg);};
const poll={timeout:180000,polling:200};
async function allowGithack(context){if(target.includes('raw.githack.com'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});await allowGithack(context);
const soilRequests=[];
context.on('request',req=>{if(req.url().includes('/site/dist/r3-7/data/soil/')&&req.url().endsWith('.i16le'))soilRequests.push(req.url());});
const page=await context.newPage();const runtimeErrors=[];
page.on('pageerror',e=>runtimeErrors.push(`pageerror:${e.message}`));page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console:${m.text()}`);});
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,poll);
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextLoaded==='true',null,poll);
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmLoaded==='true',null,poll);
assert((await page.title()).includes('R3.7'),'title is not R3.7');
assert((await page.getAttribute('html','data-wenzhou-r37-boot'))==='true','R3.7 bootstrap marker missing');

async function state(){return page.evaluate(()=>{const c=document.querySelector('#terrain');return{
  patch:c?.dataset.patch,ready:c?.dataset.ready,
  soilKind:c?.dataset.soilContextKind,soilLoaded:c?.dataset.soilContextLoaded,soilVisible:c?.dataset.soilContextVisible,soilPatch:c?.dataset.soilContextPatch,soilProperty:c?.dataset.soilContextProperty,soilLabel:c?.dataset.soilContextPropertyLabel,soilResolution:Number(c?.dataset.soilContextResolutionM),soilDepth:c?.dataset.soilContextDepth,soilMedianSha:c?.dataset.soilContextMedianSha256,soilUncertaintySha:c?.dataset.soilContextUncertaintySha256,soilUncertaintyVisible:c?.dataset.soilContextUncertaintyVisible,soilCanonical:c?.dataset.soilContextCanonicalTruth,soilField:c?.dataset.soilContextFieldObservation,soilHeight:c?.dataset.soilContextHeightClaim,soilRelease:c?.dataset.soilContextSourceReleaseTag,soilError:c?.dataset.soilContextError||null,
  legacySurface:c?.dataset.surfaceEvidenceKind||null,
  osmRuntime:c?.dataset.osmRuntime,roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn),roadRejected:Number(c?.dataset.osmRoadSegmentsRejectedNoSurface),buildingRejected:Number(c?.dataset.osmBuildingSegmentsRejectedNoSurface),
  landcoverKind:c?.dataset.landcoverKind,landcoverLoaded:c?.dataset.landcoverLoaded,seaKind:c?.dataset.seaSurfaceKind
};});}
function checkSoil(s,label,prop){
  assert(s.soilKind==='soilgrids-250m-model-context',`${label} soil kind wrong ${JSON.stringify(s)}`);
  assert(s.soilLoaded==='true'&&s.soilPatch===s.patch,`${label} soil not bound to current patch ${JSON.stringify(s)}`);
  assert(s.soilProperty===prop,`${label} property ${s.soilProperty} != ${prop}`);
  assert(s.soilResolution===250&&s.soilDepth==='0-5cm',`${label} soil scale/depth wrong ${JSON.stringify(s)}`);
  assert(s.soilCanonical==='false'&&s.soilField==='false'&&s.soilHeight==='none',`${label} truth boundary wrong ${JSON.stringify(s)}`);
  assert(s.soilRelease==='wenzhou-r3.7-soilgrids-evidence-20260911',`${label} permanent release identity wrong`);
  assert(!s.soilError,`${label} soil error ${s.soilError}`);
  assert(s.legacySurface===null,`${label} legacy R3.3 query-only surface still active: ${s.legacySurface}`);
}
async function waitPatch(id){
  await page.selectOption('#location',id);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,poll);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.soilContextLoaded==='true'&&c?.dataset.soilContextPatch===expected;},id,poll);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch===expected;},id,poll);
}
async function waitProperty(prop){
  await page.selectOption('#soil-property',prop);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.soilContextLoaded==='true'&&c?.dataset.soilContextProperty===expected;},prop,poll);
}

let s=await state();checkSoil(s,'initial','clay');
assert(s.patch==='overview','initial patch is not overview');
assert(s.osmRuntime==='indexed-r36'&&s.roadSegments===508201&&s.buildingSegments===0,'R3.6 overview OSM regression');
assert(s.landcoverKind==='worldcover-2021-context'&&s.landcoverLoaded==='true','WorldCover inheritance missing');
assert(s.seaKind==='demonstration','R3.2 sea inheritance missing');
const initialUnique=[...new Set(soilRequests)];
assert(initialUnique.length===2,`initial R3.7 should load only selected median+uncertainty, got ${initialUnique.length}: ${initialUnique.join(',')}`);
assert(initialUnique.some(u=>u.includes('clay-0-5cm-q05.i16le'))&&initialUnique.some(u=>u.includes('clay-0-5cm-uncertainty.i16le')),`initial R3.7 loaded wrong soil files: ${initialUnique.join(',')}`);

const soilOnPixels=await page.locator('#terrain').screenshot();
await page.uncheck('#show-soil-context');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextVisible==='false',null,poll);await page.waitForTimeout(100);const soilOffPixels=await page.locator('#terrain').screenshot();
const soilPixelToggleVerified=!soilOnPixels.equals(soilOffPixels);assert(soilPixelToggleVerified,'soil overlay toggle did not change WebGL pixels');
await page.check('#show-soil-context');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextVisible==='true',null,poll);await page.waitForTimeout(100);
const uncertaintyOn=await page.locator('#terrain').screenshot();
await page.uncheck('#show-soil-uncertainty');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextUncertaintyVisible==='false',null,poll);await page.waitForTimeout(100);const uncertaintyOff=await page.locator('#terrain').screenshot();
const uncertaintyPixelToggleVerified=!uncertaintyOn.equals(uncertaintyOff);assert(uncertaintyPixelToggleVerified,'soil uncertainty toggle did not change WebGL pixels');
await page.check('#show-soil-uncertainty');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.soilContextUncertaintyVisible==='true',null,poll);

const properties=['clay','sand','silt','soc','phh2o','bdod','cfvo','wv0033'];const propertyStates={};
for(const prop of properties){await waitProperty(prop);s=await state();checkSoil(s,`property:${prop}`,prop);assert(s.soilMedianSha&&s.soilUncertaintySha,`${prop} missing payload SHA markers`);propertyStates[prop]={label:s.soilLabel,medianSha:s.soilMedianSha,uncertaintySha:s.soilUncertaintySha};}
await waitProperty('clay');
await waitPatch('query-01');s=await state();checkSoil(s,'query-01','clay');
assert(s.osmRuntime==='indexed-r36'&&s.roadSegments===11007&&s.roadRejected===109&&s.buildingSegments===906&&s.buildingRejected===4,`query-01 inherited OSM changed ${JSON.stringify(s)}`);

const independent=await page.evaluate(async()=>{
  const [m,terrain]=await Promise.all([fetch('./data/soil/soil-context.json').then(r=>r.json()),fetch('../r3-1/data/terrain.json').then(r=>r.json())]);
  const median=m.layers.find(x=>x.property==='clay'&&x.statistic==='Q0.5');
  const unc=m.layers.find(x=>x.property==='clay'&&x.statistic==='uncertainty');
  const q=terrain.queries.find(x=>x.patch==='query-01');
  const [e,n]=q.position.coordinates,gt=median.geotransform;
  const col=Math.floor((e-gt[0])/gt[1]),row=Math.floor((n-gt[3])/gt[5]);
  const [mb,ub]=await Promise.all([fetch('./data/soil/'+median.path).then(r=>r.arrayBuffer()),fetch('./data/soil/'+unc.path).then(r=>r.arrayBuffer())]);
  const ma=new Int16Array(mb),ua=new Int16Array(ub),i=row*median.columns+col;
  const raw=ma[i],uraw=ua[i];
  return{row,col,raw,uncertaintyRaw:uraw,value:raw===median.noData?null:raw/median.conversionFactor,unit:median.conventionalUnit,valueText:document.querySelector('#soil-context-value')?.textContent||'',uncText:document.querySelector('#soil-context-uncertainty')?.textContent||''};
});
assert(independent.row>=0&&independent.col>=0&&Number.isFinite(independent.value),`query-01 independent clay sample invalid ${JSON.stringify(independent)}`);
if(Number.isFinite(independent.value)){
  const digits=Math.abs(independent.value)>=100?0:Math.abs(independent.value)>=10?1:2;
  assert(independent.valueText.includes(independent.value.toFixed(digits)),`query-01 UI clay value disagrees with independent binary sample ${JSON.stringify(independent)}`);
}
assert(independent.uncText.includes(String(independent.uncertaintyRaw)),`query-01 uncertainty UI disagrees with independent binary sample ${JSON.stringify(independent)}`);

await page.click('#eye-view');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='true',null,poll);await page.waitForFunction(()=>Number.isFinite(Number(document.querySelector('#terrain')?.dataset.eyeHeightM)),null,poll);
const h0=Number(await page.getAttribute('#terrain','data-eye-height-m'));await page.locator('#terrain').focus();await page.keyboard.press('w');await page.waitForTimeout(160);const h1=Number(await page.getAttribute('#terrain','data-eye-height-m'));
assert(Math.abs(h0-1.6)<=.002&&Math.abs(h1-1.6)<=.002,`R3.7 eye regression h0=${h0} h1=${h1}`);await page.keyboard.press('r');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='false',null,poll);

await waitPatch('river-oujiang');s=await state();checkSoil(s,'river-oujiang','clay');assert(s.roadSegments===32807&&s.roadRejected===404&&s.buildingSegments===2184&&s.buildingRejected===8,'river-oujiang OSM regression');
await waitPatch('mountains');s=await state();checkSoil(s,'mountains','clay');assert(s.roadSegments===1865&&s.roadRejected===27&&s.buildingSegments===0,'mountains OSM regression');
await waitPatch('overview');s=await state();checkSoil(s,'overview','clay');assert(s.roadSegments===508201&&s.roadRejected===1411&&s.buildingSegments===0,'overview OSM regression');
assert(runtimeErrors.length===0,`desktop runtime errors: ${runtimeErrors.join(' | ')}`);
notes.push({initialSoilRequests:initialUnique,properties:propertyStates,independentQuery01:independent,eye:{h0,h1}});

const mobileContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await allowGithack(mobileContext);const mobile=await mobileContext.newPage();const mobileErrors=[];
mobile.on('pageerror',e=>mobileErrors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text());});
await mobile.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,poll);await mobile.selectOption('#location','query-01');await mobile.waitForFunction(()=>{const c=document.querySelector('#terrain');return c?.dataset.patch==='query-01'&&c?.dataset.soilContextLoaded==='true'&&c?.dataset.soilContextPatch==='query-01'&&c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch==='query-01';},null,poll);
const mobileLayout=await mobile.evaluate(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect();const focus=rect('.focus-panel'),controls=rect('.camera-controls'),soilSelect=rect('#soil-property'),soilToggle=rect('label:has(#show-soil-context)'),eye=rect('#eye-view'),c=document.querySelector('#terrain');return{innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,focusAboveControls:!!focus&&!!controls&&focus.bottom<=controls.top-4,controlsInside:!!controls&&controls.left>=0&&controls.right<=innerWidth,soilSelectHorizontal:!!soilSelect&&soilSelect.left>=0&&soilSelect.right<=innerWidth,soilToggleHorizontal:!!soilToggle&&soilToggle.left>=0&&soilToggle.right<=innerWidth,eyeInside:!!eye&&eye.left>=0&&eye.right<=innerWidth,soilProperty:c?.dataset.soilContextProperty,soilLoaded:c?.dataset.soilContextLoaded,roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn)};});
assert(mobileLayout.scrollWidth<=mobileLayout.innerWidth,`mobile horizontal overflow ${JSON.stringify(mobileLayout)}`);assert(mobileLayout.focusAboveControls&&mobileLayout.controlsInside&&mobileLayout.soilSelectHorizontal&&mobileLayout.soilToggleHorizontal&&mobileLayout.eyeInside,`mobile layout collision ${JSON.stringify(mobileLayout)}`);assert(mobileLayout.soilLoaded==='true'&&mobileLayout.soilProperty==='clay','mobile soil context missing');assert(mobileLayout.roadSegments===11007&&mobileLayout.buildingSegments===906,'mobile R3.6 OSM regression');assert(mobileErrors.length===0,`mobile runtime errors: ${mobileErrors.join(' | ')}`);

console.log(JSON.stringify({passed:failures.length===0,target,soilPixelToggleVerified,uncertaintyPixelToggleVerified,notes,mobileLayout,runtimeErrors,mobileErrors,failures},null,2));
await mobileContext.close();await context.close();await browser.close();if(failures.length)process.exit(1);
