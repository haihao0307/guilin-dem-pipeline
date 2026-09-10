import {chromium} from 'playwright';

const target=process.env.R35_URL||'http://127.0.0.1:8765/site/dist/r3-5/';
const failures=[];const notes=[];
function assert(cond,message){if(!cond)failures.push(message);}
async function allowGithack(context){if(target.includes('raw.githack.com'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});await allowGithack(context);
const page=await context.newPage();const runtimeErrors=[];
page.on('pageerror',e=>runtimeErrors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console: ${m.text()}`);});
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
assert((await page.title()).includes('R3.5'),'title is not R3.5');
assert((await page.getAttribute('html','data-wenzhou-r35-boot'))==='true','R3.5 bootstrap marker missing');
const manifest=await page.evaluate(async()=>{const r=await fetch(new URL('./data/osm/osm-context.json',location.href));if(!r.ok)throw Error(`manifest ${r.status}`);return r.json();});
assert(manifest.sourceIdentity==='external_mapped_observation'&&manifest.canonicalTruth===false&&manifest.surveyGradeGeometry===false&&manifest.individualPhysicalTruth===false&&manifest.productionReady===false,'manifest evidence identity changed');
assert(manifest.sourceCandidateCounts.roadLineStringHighway===177578,'source road candidate count changed');
assert(manifest.sourceCandidateCounts.buildingMultiPolygonUniqueIdentity===68359,'source building candidate count changed');
async function selectPatch(id){
  await page.selectOption('#location',id);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,{timeout:120000});
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch===expected&&c?.dataset.osmKind==='external-mapped-observation';},id,{timeout:120000});
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.landcoverLoaded==='true'&&c?.dataset.landcoverPatch===expected;},id,{timeout:120000});
}
async function state(){return page.evaluate(()=>{const c=document.querySelector('#terrain');return{
  kind:c?.dataset.osmKind,patch:c?.dataset.osmPatch,roadsVisible:c?.dataset.osmRoadsVisible,buildingsVisible:c?.dataset.osmBuildingsVisible,
  roadParts:Number(c?.dataset.osmRoadParts),roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),roadRejected:Number(c?.dataset.osmRoadSegmentsRejectedNoSurface),
  buildingRings:Number(c?.dataset.osmBuildingRings),buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn),buildingRejected:Number(c?.dataset.osmBuildingSegmentsRejectedNoSurface),
  roadWidthClaim:c?.dataset.osmRoadWidthClaim,buildingHeightClaim:c?.dataset.osmBuildingHeightClaim,surfaceAnchor:c?.dataset.osmSurfaceAnchor,
  sourceSha:c?.dataset.osmSourceReleaseSha256,quantStep:Number(c?.dataset.osmQuantizationMaxStepM),
  landcoverKind:c?.dataset.landcoverKind,landcoverVisible:c?.dataset.landcoverVisible,soilKind:c?.dataset.surfaceEvidenceKind,soilPatch:c?.dataset.surfacePatch,seaKind:c?.dataset.seaSurfaceKind
};});}
await selectPatch('query-01');
let s=await state();
assert(s.roadParts>0&&s.roadSegments>0,`query-01 roads missing ${JSON.stringify(s)}`);
assert(s.buildingRings>0&&s.buildingSegments>0,`query-01 buildings missing ${JSON.stringify(s)}`);
assert(s.roadWidthClaim==='none-screen-style-only',`road width claim changed ${JSON.stringify(s)}`);
assert(s.buildingHeightClaim==='unknown-not-generated',`building height claim changed ${JSON.stringify(s)}`);
assert(s.surfaceAnchor==='current-display-triangles',`surface anchor changed ${JSON.stringify(s)}`);
assert(s.sourceSha==='f3ae1c9051b25fc1d23c8df1dd951a9138d6b188b1e46bff56a352c324a90101','source release SHA changed');
assert(s.quantStep>0&&s.quantStep<1,'query-01 quantization should remain sub-meter');
assert(s.landcoverKind==='worldcover-2021-context'&&s.landcoverVisible==='false','R3.4 landcover regression');
assert(s.soilKind==='soil-model-appearance-demo'&&s.soilPatch==='query-01','R3.3 soil regression');
assert(s.seaKind==='demonstration','R3.2 sea regression');
assert((await page.isChecked('#show-osm-roads'))===true&&s.roadsVisible==='true','roads should default on');
assert((await page.isChecked('#show-osm-buildings'))===true&&s.buildingsVisible==='true','buildings should default on in query view');
const bothPixels=await page.locator('#terrain').screenshot();
await page.uncheck('#show-osm-roads');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmRoadsVisible==='false');await page.waitForTimeout(100);
const noRoadPixels=await page.locator('#terrain').screenshot();const roadPixelToggleVerified=!bothPixels.equals(noRoadPixels);assert(roadPixelToggleVerified,'road toggle did not change rendered WebGL pixels');
await page.check('#show-osm-roads');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmRoadsVisible==='true');
await page.uncheck('#show-osm-buildings');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmBuildingsVisible==='false');await page.waitForTimeout(100);
const noBuildingPixels=await page.locator('#terrain').screenshot();const buildingPixelToggleVerified=!bothPixels.equals(noBuildingPixels);assert(buildingPixelToggleVerified,'building toggle did not change rendered WebGL pixels');
await page.check('#show-osm-buildings');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmBuildingsVisible==='true');
// R3.5 evidence must survive an inherited display exaggeration rebuild without changing its semantic claims.
await page.selectOption('#exaggeration','3');
await page.waitForFunction(()=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch==='query-01'&&c?.dataset.osmLoaded==='true'&&c?.dataset.osmPatch==='query-01';},null,{timeout:120000});
s=await state();assert(s.surfaceAnchor==='current-display-triangles'&&s.buildingHeightClaim==='unknown-not-generated','R3.5 claim changed after 3x rebuild');
await page.selectOption('#exaggeration','1');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmLoaded==='true'&&document.querySelector('#terrain')?.dataset.osmPatch==='query-01',null,{timeout:120000});
// Camera/display-surface relation must remain inherited and unchanged.
await page.click('#eye-view');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='true');
await page.waitForFunction(()=>Number.isFinite(Number(document.querySelector('#terrain')?.dataset.eyeHeightM)));
const h0=Number(await page.getAttribute('#terrain','data-eye-height-m'));await page.locator('#terrain').focus();await page.keyboard.press('w');await page.waitForTimeout(140);const h1=Number(await page.getAttribute('#terrain','data-eye-height-m'));
assert(Math.abs(h0-1.6)<=.002&&Math.abs(h1-1.6)<=.002,`eye regression h0=${h0} h1=${h1}`);await page.keyboard.press('r');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='false');
notes.push({patch:'query-01',state:await state(),h0,h1});
for(const id of ['river-oujiang','mountains','overview']){
  await selectPatch(id);s=await state();assert(s.roadParts>0&&s.roadSegments>0,`${id} roads missing ${JSON.stringify(s)}`);assert(s.seaKind==='demonstration',`${id} sea missing`);
  if(id==='overview'){assert(s.buildingRings===0&&s.buildingSegments===0&&s.buildingsVisible==='false',`overview must omit buildings ${JSON.stringify(s)}`);assert(s.quantStep>3&&s.quantStep<4,`overview quantization policy ${JSON.stringify(s)}`);}else{assert(s.quantStep<1,`${id} quantization should remain sub-meter ${JSON.stringify(s)}`);}
  notes.push({patch:id,state:s});
}
assert(runtimeErrors.length===0,`runtime errors: ${runtimeErrors.join(' | ')}`);
const mobileContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await allowGithack(mobileContext);
const mobile=await mobileContext.newPage();const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text());});
await mobile.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});await mobile.selectOption('#location','query-01');
await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.osmLoaded==='true'&&document.querySelector('#terrain')?.dataset.osmPatch==='query-01',null,{timeout:120000});
const mobileLayout=await mobile.evaluate(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect();const eye=rect('#eye-view'),controls=rect('.camera-controls'),roadToggle=rect('label:has(#show-osm-roads)'),buildingToggle=rect('label:has(#show-osm-buildings)'),card=rect('#osm-card'),focus=rect('.focus-panel'),c=document.querySelector('#terrain');return{innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,eyeInside:!!eye&&eye.left>=0&&eye.right<=innerWidth,controlsInside:!!controls&&controls.left>=0&&controls.right<=innerWidth,roadToggleInside:!!roadToggle&&roadToggle.left>=0&&roadToggle.right<=innerWidth,buildingToggleInside:!!buildingToggle&&buildingToggle.left>=0&&buildingToggle.right<=innerWidth,cardInside:!!card&&card.left>=0&&card.right<=innerWidth,focusAboveControls:!!focus&&!!controls&&focus.bottom<=controls.top-4,osmKind:c?.dataset.osmKind,roadSegments:Number(c?.dataset.osmRoadSegmentsDrawn),buildingSegments:Number(c?.dataset.osmBuildingSegmentsDrawn),roadWidthClaim:c?.dataset.osmRoadWidthClaim,buildingHeightClaim:c?.dataset.osmBuildingHeightClaim,landcoverKind:c?.dataset.landcoverKind,soilKind:c?.dataset.surfaceEvidenceKind,seaKind:c?.dataset.seaSurfaceKind};});
assert(mobileLayout.scrollWidth<=mobileLayout.innerWidth,`mobile horizontal overflow ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.eyeInside&&mobileLayout.controlsInside&&mobileLayout.roadToggleInside&&mobileLayout.buildingToggleInside&&mobileLayout.cardInside,`mobile controls/card outside ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.focusAboveControls,`mobile focus panel overlaps camera controls ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.osmKind==='external-mapped-observation'&&mobileLayout.roadSegments>0&&mobileLayout.buildingSegments>0,'mobile OSM evidence missing');
assert(mobileLayout.roadWidthClaim==='none-screen-style-only'&&mobileLayout.buildingHeightClaim==='unknown-not-generated','mobile OSM semantic claims changed');
assert(mobileLayout.landcoverKind==='worldcover-2021-context'&&mobileLayout.soilKind==='soil-model-appearance-demo'&&mobileLayout.seaKind==='demonstration','mobile inherited layers missing');
assert(mobileErrors.length===0,`mobile runtime errors: ${mobileErrors.join(' | ')}`);
console.log(JSON.stringify({passed:failures.length===0,target,roadPixelToggleVerified,buildingPixelToggleVerified,notes,mobileLayout,runtimeErrors,mobileErrors,failures},null,2));
await mobileContext.close();await context.close();await browser.close();if(failures.length)process.exit(1);
