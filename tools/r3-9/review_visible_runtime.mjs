import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const target=process.env.R38_URL;if(!target)throw Error('R38_URL required');
const out=process.env.QA_OUTPUT||'/tmp/wenzhou-visible';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={schema:'wenzhou-visible-review/v2',revision:2,target,passed:false,views:[],errors:[],failures:[],requests:[]};
const check=(v,s)=>{if(!v)report.failures.push(s);},poll={timeout:120000};
async function context(options={}){
 const c=await browser.newContext({viewport:{width:1280,height:800},reducedMotion:'reduce',...options});
 if(target.includes('githack'))await c.setExtraHTTPHeaders({Cookie:'__Http-phish=1'});
 await c.addInitScript(()=>Object.defineProperty(document,'modelContext',{configurable:true,value:{registerTool(tool){window.__reviewViewTool=tool;}}}));
 return c;
}
const c=await context(),page=await c.newPage();
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>report.requests.push(r.url()));
const state=p=>p.locator('#terrain').evaluate(el=>({...el.dataset}));
async function panel(p){if(await p.locator('#panel-toggle').getAttribute('aria-expanded')==='false')await p.click('#panel-toggle');}
async function ready(p,id){await p.waitForFunction(id=>{const s=document.querySelector('#terrain')?.dataset;return s?.ready==='true'&&(!id||s.patch===id)&&s.soilContextLoaded==='true'&&s.soilContextPatch===s.patch;},id,poll);}
async function view(id){await panel(page);await page.selectOption('#location',id);await ready(page,id);await page.waitForTimeout(200);const s=await state(page);await page.screenshot({path:out+'/'+id+'.png'});report.views.push({id,state:s});}
async function waitSoil(prop,depth){await page.waitForFunction(([p,d])=>{const s=document.querySelector('#terrain').dataset;return s.soilContextLoaded==='true'&&s.soilContextProperty===p&&s.soilContextDepth===d;},[prop,depth],poll);}
async function failureRecovery(kind){
 const cc=await context(),p=await cc.newPage(),requests=[];p.on('request',r=>requests.push(r.url()));let injected=false;
 const pattern=kind==='index'?'**/data/soil-pairs/soil-pairs.json':'**/data/soil-pairs/*.s2gz';
 await p.route(pattern,async route=>{
   if(injected)return route.continue();injected=true;
   if(kind==='index')return route.fulfill({status:503,contentType:'text/plain',body:'Injected verification failure'});
   const response=await route.fetch(),body=await response.body();body[body.length-1]^=1;await route.fulfill({response,body});
 });
 try{
   await p.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await p.locator('#soil-retry').waitFor({state:'visible',timeout:120000});
   const error=(await state(p)).soilContextError;check(!!error,kind+': failure not visible');
   if(kind==='corrupt')check(error.includes('SHA-256'),kind+': wrong failure reason');
   await p.unroute(pattern);await p.click('#soil-retry');await ready(p,null);
   check(!requests.some(u=>new URL(u).pathname.endsWith('.i16le')),kind+': fell back to old large payload');
   return{kind,injected,error,recoveredWithoutReload:true,legacyRequests:0};
 }finally{await cc.close();}
}
try{
 const start=Date.now();await page.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await ready(page,null);
 report.firstReadyMs=Date.now()-start;report.initial=await state(page);check((await page.title()).includes('R3.9.1'),'new runtime title missing');
 report.locations=await page.locator('#location').evaluate(e=>[...e.options].map(o=>({value:o.value,label:o.text})));
 await page.click('#panel-toggle');check(await page.locator('.focus-panel').isHidden(),'desktop hide settings');await page.screenshot({path:out+'/initial-desktop.png'});await panel(page);
 await view('mountains');
 const rivers=report.locations.filter(x=>x.value.startsWith('river-')).slice(0,3);check(rivers.length===3,'three river views missing');for(const r of rivers)await view(r.value);
 await view('query-01');const originalCamera=(await state(page)).camera;
 await page.click('#eye-view');await page.waitForFunction(()=>document.querySelector('#eye-view').getAttribute('aria-pressed')==='true',null,poll);
 check(await page.locator('.focus-panel').isHidden(),'eye mode did not free the map');check(await page.locator('#eye-card').isVisible(),'eye status lost when panel closed');
 const before=await state(page);await page.locator('#terrain').focus();await page.keyboard.press('w');await page.waitForTimeout(150);const after=await state(page);
 const a=before.camera.split(',').map(Number),b=after.camera.split(',').map(Number),stepM=Math.hypot(b[0]-a[0],b[2]-a[2])*1000;
 report.eye={heightBefore:Number(before.eyeHeightM),heightAfter:Number(after.eyeHeightM),horizontalStepM:stepM};
 check(Math.abs(Number(before.eyeHeightM)-1.6)<.002&&Math.abs(Number(after.eyeHeightM)-1.6)<.002,'eye height drift');check(Math.abs(stepM-2)<.003,'W key not a 2m horizontal step');
 await page.screenshot({path:out+'/human-eye.png'});await page.waitForFunction(()=>!!window.__reviewViewTool,null,poll);
 report.blocking=await page.evaluate(async()=>{let s;for(let i=0;i<80;i++){s=await window.__reviewViewTool.execute({moveM:100});if(s.lastMoveBlocked){const stop=s.camera.join(',');const again=await window.__reviewViewTool.execute({moveM:100});return{blocked:true,completedM:s.lastMoveCompletedM,requestedM:s.lastMoveRequestedM,staysStopped:again.camera.join(',')===stop,eyeHeightM:again.eyeHeightAboveDisplaySurfaceM};}}return{blocked:false};});
 check(report.blocking.blocked&&report.blocking.staysStopped,'path edge did not block repeated movement');check(Math.abs(report.blocking.eyeHeightM-1.6)<.002,'height changed at blocker');
 await page.click('#reset');await page.waitForTimeout(150);check(await page.locator('#eye-view').getAttribute('aria-pressed')==='false','reset did not exit eye');check((await state(page)).camera===originalCamera,'reset did not recover camera');
 await panel(page);await page.selectOption('#soil-property','soc');await page.selectOption('#soil-depth','100-200cm');await waitSoil('soc','100-200cm');
 // Cold A -> B -> A, with enough time for the earlier request to start.
 for(const prop of ['phh2o','sand','phh2o']){await page.selectOption('#soil-property',prop);await page.waitForTimeout(20);}
 await waitSoil('phh2o','100-200cm');report.rapidSwitch=await state(page);
 const manifest=await page.evaluate(()=>fetch('./data/soil/soil-context.json').then(r=>r.json()));
 check(report.rapidSwitch.soilContextMedianSha256===manifest.layers.find(r=>r.property==='phh2o'&&r.depth==='100-200cm'&&r.statistic==='Q0.5').sha256,'rapid switch returned stale source');
 const envs=[];
 for(const [mode,setting] of [['wrb-official'],['wrb-derived'],['wrb-difference'],['wrb-probability','11'],['water','occurrence'],['water','recurrence'],['water','transitions'],['water','change'],['water','seasonality'],['water','extent']]){
   await page.selectOption('#evidence-mode',mode);
   if(setting){const id=mode==='water'?'#water-product':'#wrb-class';if(mode==='wrb-probability')await page.waitForFunction(()=>document.querySelector('#wrb-class').options.length===30,null,poll);await page.selectOption(id,setting);}
   const expected=await page.evaluate(async([mode,setting])=>{
     const m=await fetch('./data/'+(mode==='water'?'water/water-context.json':'wrb/wrb-context.json')).then(r=>r.json());
     if(mode==='water')return m.layers.find(r=>r.product===setting).sha256;
     if(mode==='wrb-probability')return m.probabilityLayers.find(r=>String(r.code)===setting).sha256;
     return m.outputs[{'wrb-official':'officialMostProbable','wrb-derived':'postAlignmentArgmax','wrb-difference':'classificationDisagreement'}[mode]].sha256;
   },[mode,setting]);
   await page.waitForFunction(h=>{const s=document.querySelector('#terrain').dataset;return s.environmentLoaded==='true'&&s.environmentSha256===h;},expected,poll);
   const s=await state(page);check(s.environmentPayloadTransport==='gzip','environment bypassed compressed transport');envs.push({mode,setting,sha256:s.environmentSha256});
 }
 report.environmentSelections=envs;
 await page.evaluate(()=>{const e=document.querySelector('#evidence-mode');for(const v of ['wrb-derived','water','wrb-official']){e.value=v;e.dispatchEvent(new Event('change'));}});
 await page.waitForFunction(()=>{const s=document.querySelector('#terrain').dataset;return s.environmentLoaded==='true'&&s.environmentMode==='wrb-official';},null,poll);
 report.cache=await page.evaluate(()=>({soil:window.wenzhouTransportDiagnostics.soil(),environment:window.wenzhouTransportDiagnostics.environment()}));
 check(report.cache.soil.cacheEntries<=2&&report.cache.environment.cacheEntries<=4,'transport cache exceeded bound');
 await page.selectOption('#evidence-mode','soil');await waitSoil('phh2o','100-200cm');await page.selectOption('#soil-property','clay');await page.selectOption('#soil-depth','0-5cm');await waitSoil('clay','0-5cm');
 const on=await page.locator('#terrain').screenshot();await page.uncheck('#show-soil-context');await page.waitForTimeout(100);const off=await page.locator('#terrain').screenshot();check(!on.equals(off),'overlay does not visibly toggle');await page.check('#show-soil-context');
 const mobile=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),mp=await mobile.newPage();mp.on('pageerror',e=>report.errors.push('mobile:'+e.message));
 await mp.goto(target,{waitUntil:'domcontentloaded',timeout:120000});await ready(mp,null);
 check(await mp.locator('.focus-panel').isHidden(),'mobile settings not initially folded');await mp.screenshot({path:out+'/mobile-390x844.png'});
 await panel(mp);await mp.screenshot({path:out+'/mobile-settings-open.png'});
 report.mobile=await mp.evaluate(()=>{const f=document.querySelector('.focus-panel').getBoundingClientRect(),c=document.querySelector('.camera-controls').getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,panelWidth:f.width,panelBottom:f.bottom,controlsTop:c.top};});
 check(report.mobile.scrollWidth===390&&report.mobile.panelWidth>300&&report.mobile.panelBottom<report.mobile.controlsTop,'mobile panel overflow or blocked camera controls');
 await mp.selectOption('#location','mountains');await ready(mp,'mountains');check(await mp.locator('.focus-panel').isHidden(),'mobile location change not folded');await mp.screenshot({path:out+'/mobile-mountains.png'});
 await mp.click('#eye-view');await mp.waitForFunction(()=>document.querySelector('#eye-view').getAttribute('aria-pressed')==='true',null,poll);check(await mp.locator('#eye-card').isVisible(),'mobile eye HUD missing');
 await mp.screenshot({path:out+'/mobile-eye.png'});await mp.click('#reset');await panel(mp);check(await mp.locator('.focus-panel').isVisible(),'settings cannot be reopened');await mobile.close();
 report.failureRecovery=[await failureRecovery('index'),await failureRecovery('corrupt')];
 check(!report.errors.length,'unexpected page errors');
 report.network={soilPaired:report.requests.filter(u=>u.endsWith('.s2gz')).length,wsp1:report.requests.filter(u=>u.endsWith('.wsp1')).length,legacySoil:report.requests.filter(u=>u.endsWith('.i16le')).length,legacyEnvironment:report.requests.filter(u=>/\/r3-8\/data\/(wrb|water)\/.*\.(u8|u16le)$/.test(new URL(u).pathname)).length};
 check(report.network.wsp1===0&&report.network.legacySoil===0&&report.network.legacyEnvironment===0,'unused or legacy large payloads requested');report.passed=!report.failures.length;
}catch(e){report.failures.push(String(e.stack));try{await page.screenshot({path:out+'/failure.png'});}catch{}}
finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,target,firstReadyMs:report.firstReadyMs,views:report.views.map(x=>x.id),eye:report.eye,blocking:report.blocking,network:report.network,mobile:report.mobile,cache:report.cache,failureRecovery:report.failureRecovery,errors:report.errors,failures:report.failures},null,2));await browser.close();}
if(!report.passed)process.exitCode=1;
