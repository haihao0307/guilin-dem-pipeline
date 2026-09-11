import {chromium} from 'playwright';
const target=process.env.R36_URL||'http://127.0.0.1:8765/site/dist/r3-6/';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce'});
const page=await context.newPage();
const events=[];
page.on('pageerror',e=>events.push({type:'pageerror',message:e.message}));
page.on('console',m=>{if(['error','warning'].includes(m.type()))events.push({type:`console-${m.type()}`,message:m.text()});});
page.on('requestfailed',r=>events.push({type:'requestfailed',url:r.url(),failure:r.failure()?.errorText||''}));
page.on('response',r=>{if(r.status()>=400)events.push({type:'response',status:r.status(),url:r.url()});});
await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});
await page.waitForTimeout(20000);
const snapshot=await page.evaluate(()=>{
 const c=document.querySelector('#terrain');
 const h=document.documentElement;
 return {
  title:document.title,
  href:location.href,
  loadingText:document.querySelector('#loading-text')?.textContent||null,
  loadingHidden:document.querySelector('#loading')?.hidden??null,
  retryHidden:document.querySelector('#retry')?.hidden??null,
  selected:document.querySelector('#location')?.value||null,
  canvasDataset:c?{...c.dataset}:null,
  boot:{r36:h.dataset.wenzhouR36Boot||null,r34:h.dataset.wenzhouR34Boot||null,r33:h.dataset.wenzhouR33Boot||null},
  webgl:!!(c?.getContext('webgl2')||c?.getContext('webgl')),
  bodyText:document.body?.innerText?.slice(0,1200)||''
 };
});
console.log(JSON.stringify({schema:'wenzhou-r3.6-startup-diagnostic/r1',target,snapshot,events},null,2));
await browser.close();