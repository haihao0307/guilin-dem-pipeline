import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.R38_URL;
if(!target)throw Error('R38_URL required');
const out=process.env.QA_OUTPUT||'/tmp/wenzhou-visible';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={schema:'wenzhou-visible-review/v1',revision:1,target,passed:false,views:[],errors:[],failures:[],requests:[]};
const check=(v,s)=>{if(!v)report.failures.push(s);};
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
if(target.includes('githack'))await context.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push(e.message));
page.on('request',r=>report.requests.push(r.url()));
const poll={timeout:120000};
const state=p=>p.locator('#terrain').evaluate(c=>({...c.dataset}));
async function ready(p,id){await p.waitForFunction(id=>{const s=document.querySelector('#terrain')?.dataset;return s?.ready==='true'&&(!id||s.patch===id)&&s.soilContextLoaded==='true'&&s.soilContextPatch===s.patch;},id,poll);}
async function view(id){await page.selectOption('#location',id);await ready(page,id);await page.waitForTimeout(300);const s=await state(page);await page.screenshot({path:out+'/'+id+'.png'});report.views.push({id,state:s});}
try{
  const start=Date.now();await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await ready(page,null);
  report.firstReadyMs=Date.now()-start;report.initial=await state(page);
  report.locations=await page.locator('#location').evaluate(e=>[...e.options].map(o=>({value:o.value,label:o.text})));
  await page.screenshot({path:out+'/initial-desktop.png'});
  await view('mountains');
  const rivers=report.locations.filter(x=>x.value.startsWith('river-')).slice(0,3);check(rivers.length===3,'three river views missing');
  for(const r of rivers)await view(r.value);
  await view('query-01');await page.click('#eye-view');
  await page.waitForFunction(()=>document.querySelector('#eye-view').getAttribute('aria-pressed')==='true',null,poll);
  const before=await state(page);await page.locator('#terrain').focus();await page.keyboard.press('w');await page.waitForTimeout(150);const after=await state(page);
  report.eye={before,after};check(Math.abs(Number(before.eyeHeightM)-1.6)<.002&&Math.abs(Number(after.eyeHeightM)-1.6)<.002,'eye height drift');
  await page.screenshot({path:out+'/human-eye.png'});await page.keyboard.press('r');
  check(await page.locator('#eye-view').getAttribute('aria-pressed')==='false','reset did not leave eye mode');
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  if(target.includes('githack'))await mobile.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
  const mp=await mobile.newPage();mp.on('pageerror',e=>report.errors.push('mobile:'+e.message));
  await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await ready(mp,null);
  await mp.screenshot({path:out+'/mobile-390x844.png'});
  report.mobile=await mp.evaluate(()=>{const f=document.querySelector('.focus-panel').getBoundingClientRect(),c=document.querySelector('.camera-controls').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,focus:{x:f.x,y:f.y,width:f.width,height:f.height,bottom:f.bottom},controls:{x:c.x,y:c.y,width:c.width,height:c.height},state:{...document.querySelector('#terrain').dataset}};});
  check(report.mobile.scrollWidth===390,'mobile horizontal overflow');await mobile.close();
  check(!report.errors.length,'page errors');report.passed=!report.failures.length;
}catch(e){report.failures.push(String(e.stack));try{await page.screenshot({path:out+'/failure.png'});}catch{}}
finally{
  report.network={soilPaired:report.requests.filter(u=>u.endsWith('.s2gz')).length,wsp1:report.requests.filter(u=>u.endsWith('.wsp1')).length,legacySoil:report.requests.filter(u=>u.endsWith('.i16le')).length};
  await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,target,firstReadyMs:report.firstReadyMs,views:report.views.map(x=>x.id),network:report.network,mobile:report.mobile?.focus,errors:report.errors,failures:report.failures},null,2));await browser.close();
}
if(!report.passed)process.exitCode=1;
