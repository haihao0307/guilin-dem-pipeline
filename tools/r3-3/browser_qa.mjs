import {chromium} from 'playwright';

const target=process.env.R33_URL||'http://127.0.0.1:8765/r3-3/';
const failures=[];
const notes=[];
function assert(cond,message){if(!cond)failures.push(message);}
async function allowGithack(context){if(target.includes('raw.githack.com'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
await allowGithack(context);
const page=await context.newPage();
const runtimeErrors=[];
page.on('pageerror',e=>runtimeErrors.push(`pageerror: ${e.message}`));
page.on('console',m=>{if(m.type()==='error')runtimeErrors.push(`console: ${m.text()}`);});
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
assert((await page.title()).includes('R3.3'),'page title is not R3.3');
assert((await page.getAttribute('html','data-wenzhou-r33-boot'))==='true','R3.3 bootstrap marker missing');

const evidence=await page.evaluate(async()=>{
  const r=await fetch(new URL('../../../inputs/knowledge-r2-2/OBJECT_EVIDENCE_R2_2.json',location.href));
  if(!r.ok)throw new Error(`evidence ${r.status}`);
  return r.json();
});
assert(evidence.objects?.length===12,`unexpected evidence count ${evidence.objects?.length}`);

async function selectPatch(id){
  await page.selectOption('#location',id);
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.ready==='true'&&c?.dataset.patch===expected;},id,{timeout:120000});
}
async function waitSurface(id){
  await page.waitForFunction(expected=>{const c=document.querySelector('#terrain');return c?.dataset.surfaceEvidenceKind==='soil-model-appearance-demo'&&c?.dataset.surfacePatch===expected;},id,{timeout:30000});
}
async function checkEye(id){
  if((await page.getAttribute('#eye-view','aria-pressed'))==='true')await page.click('#eye-view');
  await page.click('#eye-view');
  await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='true');
  await page.waitForFunction(()=>Number.isFinite(Number(document.querySelector('#terrain')?.dataset.eyeHeightM)));
  const h0=Number(await page.getAttribute('#terrain','data-eye-height-m'));
  await page.locator('#terrain').focus();
  await page.keyboard.press('w');
  await page.waitForTimeout(120);
  const h1=Number(await page.getAttribute('#terrain','data-eye-height-m'));
  assert(Math.abs(h0-1.6)<=.002,`${id}: inherited eye h0=${h0}`);
  assert(Math.abs(h1-1.6)<=.002,`${id}: inherited eye h1=${h1}`);
  await page.keyboard.press('r');
  await page.waitForFunction(()=>document.querySelector('#eye-view')?.getAttribute('aria-pressed')==='false');
  return{h0,h1};
}

let pixelToggleVerified=false;
for(let i=1;i<=12;i++){
  const id=`query-${String(i).padStart(2,'0')}`;
  await selectPatch(id);
  await waitSurface(id);
  const record=evidence.objects.find(o=>o.id===`WZ-R1-COLOCATION-${String(i).padStart(2,'0')}`);
  const props=record?.measurements?.soil?.properties;
  const expected={clay:props?.clay?.values?.mean,sand:props?.sand?.values?.mean,silt:props?.silt?.values?.mean,soc:props?.soc?.values?.mean};
  const actual=await page.evaluate(()=>{const c=document.querySelector('#terrain');return{kind:c?.dataset.surfaceEvidenceKind,visible:c?.dataset.surfaceVisible,patch:c?.dataset.surfacePatch,clay:Number(c?.dataset.surfaceClayPct),sand:Number(c?.dataset.surfaceSandPct),silt:Number(c?.dataset.surfaceSiltPct),soc:Number(c?.dataset.surfaceSocGkg),radius:Number(c?.dataset.surfaceRadiusM),lift:Number(c?.dataset.surfaceVisualLiftM),heightClaim:c?.dataset.surfaceHeightClaim,seaKind:c?.dataset.seaSurfaceKind};});
  assert(actual.kind==='soil-model-appearance-demo',`${id}: wrong surface kind ${JSON.stringify(actual)}`);
  assert(actual.visible==='true',`${id}: surface not visible`);
  assert(actual.patch===id,`${id}: surface patch mismatch ${actual.patch}`);
  for(const k of['clay','sand','silt','soc'])assert(Math.abs(actual[k]-expected[k])<1e-9,`${id}: ${k} ${actual[k]} != ${expected[k]}`);
  assert(actual.radius===48,`${id}: radius ${actual.radius}`);
  assert(Math.abs(actual.lift-.02)<1e-9,`${id}: lift ${actual.lift}`);
  assert(actual.heightClaim==='none',`${id}: surface created height claim ${actual.heightClaim}`);
  assert(actual.seaKind==='demonstration',`${id}: inherited sea missing`);
  if(i===1){
    const on=await page.locator('#terrain').screenshot();
    await page.uncheck('#show-surface');
    await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.surfaceVisible==='false');
    await page.waitForTimeout(80);
    const off=await page.locator('#terrain').screenshot();
    pixelToggleVerified=!on.equals(off);
    assert(pixelToggleVerified,'surface toggle changed state but not rendered pixels');
    await page.check('#show-surface');
    await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.surfaceVisible==='true');
  }
  let eye=null;
  if([1,6,12].includes(i))eye=await checkEye(id);
  notes.push({id,expected,actual,eye});
}

await selectPatch('overview');
await page.waitForFunction(()=>document.querySelector('#terrain')?.dataset.surfaceEvidenceKind==='none');
assert(await page.isHidden('#surface-card'),'surface card did not hide outside evidence query patches');
assert(runtimeErrors.length===0,`runtime errors: ${runtimeErrors.join(' | ')}`);

const mobileContext=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
await allowGithack(mobileContext);
const mobile=await mobileContext.newPage();
const mobileErrors=[];
mobile.on('pageerror',e=>mobileErrors.push(e.message));
mobile.on('console',m=>{if(m.type()==='error')mobileErrors.push(m.text());});
await mobile.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.ready==='true',null,{timeout:120000});
await mobile.selectOption('#location','query-01');
await mobile.waitForFunction(()=>document.querySelector('#terrain')?.dataset.surfaceEvidenceKind==='soil-model-appearance-demo',null,{timeout:120000});
const mobileLayout=await mobile.evaluate(()=>{
  const eye=document.querySelector('#eye-view')?.getBoundingClientRect();
  const controls=document.querySelector('.camera-controls')?.getBoundingClientRect();
  const surface=document.querySelector('#show-surface')?.getBoundingClientRect();
  const card=document.querySelector('#surface-card')?.getBoundingClientRect();
  return{innerWidth,scrollWidth:document.documentElement.scrollWidth,eyeInside:!!eye&&eye.left>=0&&eye.right<=innerWidth,controlsInside:!!controls&&controls.left>=0&&controls.right<=innerWidth,surfaceControlInside:!!surface&&surface.left>=0&&surface.right<=innerWidth,cardInside:!!card&&card.left>=0&&card.right<=innerWidth,surfaceKind:document.querySelector('#terrain')?.dataset.surfaceEvidenceKind};
});
assert(mobileLayout.scrollWidth<=mobileLayout.innerWidth,`mobile overflow ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.eyeInside&&mobileLayout.controlsInside&&mobileLayout.surfaceControlInside&&mobileLayout.cardInside,`mobile R3.3 controls outside ${JSON.stringify(mobileLayout)}`);
assert(mobileLayout.surfaceKind==='soil-model-appearance-demo',`mobile surface missing ${JSON.stringify(mobileLayout)}`);
assert(mobileErrors.length===0,`mobile runtime errors: ${mobileErrors.join(' | ')}`);

console.log(JSON.stringify({passed:failures.length===0,target,queriesChecked:12,pixelToggleVerified,notes,mobileLayout,runtimeErrors,mobileErrors,failures},null,2));
await mobileContext.close();
await context.close();
await browser.close();
if(failures.length)process.exit(1);
