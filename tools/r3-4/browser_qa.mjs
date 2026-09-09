import {chromium} from 'playwright';

const target=process.env.R34_URL||'http://127.0.0.1:8765/site/dist/r3-4/';
const failures=[];const notes=[];
function assert(cond,message){if(!cond)failures.push(message);}
async function allowGithack(context){if(target.includes('raw.githack.com'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});}
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});await allowGithack(context);
const page=await context.newPage();const runtimeErrors=[];
page.on('pageerror',e=>runtimeErrors.push(`pageerror: ${e.message}`));page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console: ${m.text()}`);});
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
assert((await page.title()).includes('R3.4'),'title is not R3.4');
assert((await page.getAttribute('html','data-wenzhou-r34-boot'))==='true','R3.4 bootstrap marker missing');
const manifest=await page.evaluate(async()=>{const r=await fetch(new URL('./data/worldcover/worldcover-2021-context.json',location.href));if(!r.ok)throw Error(`manifest ${r.status}`);return r.json();});
const contract=await page.evaluate(async()=>{const r=await fetch(new URL('../r3-1/data/terrain.json',location.href));if(!r.ok)throw Error(`terrain ${r.status}`);return r.json();});
assert(manifest.sourceIdentity==='external_observation'&&manifest.canonicalTruth===false&&manifest.individualObjectTruth===false,'manifest evidence identity changed');
async function selectPatch(id){
  await page.selectOption('#location',id);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,{timeout:120000});
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.landcoverLoaded==='true'&&c?.dataset.landcoverPatch===expected&&c?.dataset.landcoverKind==='worldcover-2021-context';},id,{timeout:120000});
}
async function expectedQueryCode(id){
  const meta=manifest.patches.find(p=>p.id===id),q=contract.queries.find(q=>q.patch===id);if(!meta||!q)return null;
  const bytes=new Uint8Array(await(await page.request.get(new URL(meta.path,target).href)).body());
  const[e,n]=q.position.coordinates,gt=meta.geotransform;
  const c=Math.floor((e-gt[0])/gt[1]),r=Math.floor((n-gt[3])/gt[5]);
  if(c<0||c>=meta.columns||r<0||r>=meta.rows)return null;
  return bytes[r*meta.columns+c];
}
async function state(){return page.evaluate(()=>{const c=document.querySelector('#terrain');return{kind:c?.dataset.landcoverKind,visible:c?.dataset.landcoverVisible,patch:c?.dataset.landcoverPatch,resolution:Number(c?.dataset.landcoverResolutionM),representation:c?.dataset.landcoverRepresentation,exact:c?.dataset.landcoverExactNativeObservation,aggregation:c?.dataset.landcoverDisplayAggregation,queryCode:c?.dataset.landcoverQueryClassCode,heightClaim:c?.dataset.landcoverHeightClaim,lift:Number(c?.dataset.landcoverVisualLiftM),sourceSha:c?.dataset.landcoverSourceReleaseSha256,soilKind:c?.dataset.surfaceEvidenceKind,soilPatch:c?.dataset.surfacePatch,seaKind:c?.dataset.seaSurfaceKind};});}
await selectPatch('query-01');
let s=await state();const expectedCode=await expectedQueryCode('query-01');
assert(s.resolution===10&&s.representation==='native-10m-crop'&&s.exact==='true'&&s.aggregation==='false',`query-01 policy ${JSON.stringify(s)}`);
assert(Number(s.queryCode)===expectedCode,`query-01 projected class ${s.queryCode} != ${expectedCode}`);
assert(s.heightClaim==='none'&&Math.abs(s.lift-.035)<1e-9,`query-01 height boundary ${JSON.stringify(s)}`);
assert(s.sourceSha==='f558037e82ce38fac604291c6dc0327c931488c5167c7015e0dbdeae5a9ba0ad','source release SHA changed');
assert(s.soilKind==='soil-model-appearance-demo'&&s.soilPatch==='query-01','R3.3 soil layer regression');
assert(s.seaKind==='demonstration','R3.2 sea regression');
assert((await page.isChecked('#show-landcover'))===false&&s.visible==='false','landcover should default off');
const offPixels=await page.locator('#terrain').screenshot();
await page.check('#show-landcover');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.landcoverVisible==='true');await page.waitForTimeout(100);
const onPixels=await page.locator('#terrain').screenshot();const pixelToggleVerified=!offPixels.equals(onPixels);assert(pixelToggleVerified,'landcover toggle did not change rendered WebGL pixels');
await page.uncheck('#show-landcover');await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.landcoverVisible==='false');
// The new overlay must not change the inherited camera/display-surface contract.
await page.click('#eye-view');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='true');
await page.waitForFunction(()=>Number.isFinite(Number(document.querySelector('#terrain')?.dataset.eyeHeightM)));
const h0=Number(await page.getAttribute('#terrain','data-eye-height-m'));await page.locator('#terrain').focus();await page.keyboard.press('w');await page.waitForTimeout(140);const h1=Number(await page.getAttribute('#terrain','data-eye-height-m'));
assert(Math.abs(h0-1.6)<=.002&&Math.abs(h1-1.6)<=.002,`eye regression h0=${h0} h1=${h1}`);await page.keyboard.press('r');await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='false');
notes.push({patch:'query-01',state:s,expectedQueryCode:expectedCode,h0,h1});
for(const [id,res,representation] of [['river-oujiang',20,'20m-mode-display-context'],['mountains',40,'40m-mode-display-context'],['overview',80,'80m-mode-display-context']]){
  await selectPatch(id);s=await state();assert(s.resolution===res&&s.representation===representation&&s.exact==='false'&&s.aggregation==='true',`${id} aggregation policy ${JSON.stringify(s)}`);assert(s.seaKind==='demonstration',`${id} sea missing`);notes.push({patch:id,state:s});
}
assert(runtimeErrors.length===0,`runtime errors: ${runtimeErrors.join(' | ')}`);
const mobileContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await allowGithack(mobileContext);
const mobile=await mobileContext.newPage();const mobileErrors=[];mobile.on('pageerror',e=>mobileErrors.push(e.message));mobile.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text());});
await mobile.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});await mobile.selectOption('#location','query-01');
await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.landcoverLoaded==='true'&&document.querySelector('#terrain')?.dataset.landcoverPatch==='query-01',null,{timeout:120000});
const mobileLayout=await mobile.evaluate(()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect();const eye=rect('#eye-view'),controls=rect('.camera-controls'),toggle=rect('label:has(#show-landcover)'),card=rect('#landcover-card'),focus=rect('.focus-panel');return{innerWidth,innerHeight,scrollWidth:document.documentElement.scrollWidth,eyeInside:!!eye&&eye.left>=0&&eye.right<=innerWidth,controlsInside:!!controls&&controls.left>=0&&controls.right<=innerWidth,toggleInside:!!toggle&&toggle.left>=0&&toggle.right<=innerWidth,cardInside:!!card&&card.left>=0&&card.right<=innerWidth,focusAboveControls:!!focus&&!!controls&&focus.bottom<=controls.top-4,kind:document.querySelector('#terrain')?.dataset.landcoverKind,resolution:Number(document.querySelector('#terrain')?.dataset.landcoverResolutionM),soilKind:document.querySelector('#terrain')?.dataset.surfaceEvidenceKind,seaKind:document.querySelector('#terrain')?.dataset.seaSurfaceKind};});
assert(mobileLayout.scrollWidth<=mobileLayout.innerWidth,`mobile horizontal overflow ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.eyeInside&&mobileLayout.controlsInside&&mobileLayout.toggleInside&&mobileLayout.cardInside,`mobile controls/card outside ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.focusAboveControls,`mobile focus panel overlaps camera controls ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.kind==='worldcover-2021-context'&&mobileLayout.resolution===10,'mobile landcover missing');assert(mobileLayout.soilKind==='soil-model-appearance-demo'&&mobileLayout.seaKind==='demonstration','mobile inherited layers missing');assert(mobileErrors.length===0,`mobile runtime errors: ${mobileErrors.join(' | ')}`);
console.log(JSON.stringify({passed:failures.length===0,target,pixelToggleVerified,notes,mobileLayout,runtimeErrors,mobileErrors,failures},null,2));
await mobileContext.close();await context.close();await browser.close();if(failures.length)process.exit(1);
