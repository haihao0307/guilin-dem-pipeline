/** Real-browser acceptance runner. Never installs or publishes anything.
 * CORAL_ENGINE=chromium|webkit CORAL_URL=http://... CORAL_OUT=/... node tests/browser-smoke.mjs
 * Uses createRequire so an official temporary Playwright install via NODE_PATH works.
 * Missing dependency / launch failure is NOT RUN (77); behavioral failures exit 1.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const engine=process.env.CORAL_ENGINE||'chromium';
const url=process.env.CORAL_URL||process.argv[2]||'http://127.0.0.1:8765';
const out=path.resolve(process.env.CORAL_OUT||path.join(path.dirname(fileURLToPath(import.meta.url)),'browser-evidence',engine));
const mother='https://haihao0307.github.io/guilin-dem-pipeline/coral-mother-core-seed-r01/';
const timeout=90000,results=[];await fs.mkdir(out,{recursive:true});
let browser,context,page,traceStarted=false,phase='dependency',viewport=null,engineVersion=null;
let pageErrors=[],consoleErrors=[],networkFailures=[],currentObservations=null;
const saveJSON=(name,value)=>fs.writeFile(path.join(out,name),JSON.stringify(value,null,2));
const bounded=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error(`${label} exceeded ${ms}ms`)),ms);t.unref?.();})]);
const progressTimer=setInterval(()=>{const state={phase,viewport,at:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA??null};saveJSON('progress.json',state).catch(()=>{});console.log('QA_PROGRESS',JSON.stringify(state));},30000);progressTimer.unref();
async function failure(error,status='failed'){
 const details={status,sourceCommit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,engine,engineVersion,url,at:new Date().toISOString(),phase,viewport,error:{name:error?.name??'Error',message:String(error?.message??error),stack:error?.stack??null},pageErrors,consoleErrors,networkFailures,partialObservation:currentObservations,completed:results};
 if(page&&!page.isClosed()){
  try{details.currentURL=page.url();details.audit=await bounded(page.evaluate(()=>window.__coralAudit?.state??null),4000,'failure audit');}catch(e){details.auditError=String(e);}
  try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true,timeout:10000});details.screenshot='failure.png';}catch(e){details.screenshotUnavailable=String(e);}
 }else details.screenshotUnavailable='No browser page was created.';
 if(context&&traceStarted){try{await bounded(context.tracing.stop({path:path.join(out,'failure-trace.zip')}),15000,'failure trace');details.trace='failure-trace.zip';traceStarted=false;}catch(e){details.traceUnavailable=String(e);}}else details.traceUnavailable='No browser tracing session was created.';
 await saveJSON('failure.json',details);console.error(`${status.toUpperCase()} ${engine}: ${details.error.message}`);
}
try{
 if(!['chromium','webkit'].includes(engine))throw new Error(`Unsupported CORAL_ENGINE=${engine}`);
 let playwright;
 try{playwright=require('playwright');engineVersion=require('playwright/package.json').version;}catch(error){await failure(error,'not run');process.exitCode=77;}
 if(playwright){
  phase='browser launch';try{browser=await playwright[engine].launch({headless:true});}catch(error){await failure(error,'not run');process.exitCode=77;}
 }
 if(browser){
  for(viewport of [{width:1440,height:1000},{width:390,height:844}]){
   const tag=`${engine}-${viewport.width}`,observations={engine,viewport,emulation:viewport.width<500?'mobile viewport and touch emulation, not a physical phone':'desktop browser viewport',steps:[],screenshots:[],performance:null};
   currentObservations=observations;
   context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:viewport.width<500,hasTouch:viewport.width<500,acceptDownloads:true});
   await context.tracing.start({screenshots:true,snapshots:true,sources:true});traceStarted=true;
   page=await context.newPage();page.setDefaultTimeout(timeout);pageErrors=[];consoleErrors=[];networkFailures=[];
   page.on('pageerror',error=>pageErrors.push({phase,url:page.url(),message:error.message}));
   page.on('console',message=>{if(message.type()==='error')consoleErrors.push({phase,text:message.text(),location:message.location()});});
   page.on('requestfailed',request=>{if(!request.url().endsWith('/favicon.ico'))networkFailures.push({phase,url:request.url(),error:request.failure()?.errorText});});
   // A missing optional favicon is not application behavior. Do not mask module/API failures.
   await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
   async function ready(){await page.waitForFunction(()=>window.__coralAudit?.state.faces>0&&!window.__coralAudit.state.geometryBusy&&!window.__coralAudit.state.queued,null,{timeout});}
   async function capture(name,{screenshot=false}={}){
    const value=await bounded(page.evaluate(()=>{const pixels=window.__coralAudit.pixelDigest();return {state:window.__coralAudit.state,pixels};}),60000,`${name} framebuffer readback`);
    assert.equal(value.pixels.glErrorBefore,0,`${name}: preexisting GL error`);assert.equal(value.pixels.glError,0,`${name}: readPixels GL error`);
    assert.ok(value.pixels.nonBackgroundPixels>200,`${name}: actual WebGL framebuffer is blank`);
    assert.ok(value.pixels.rendererTriangles>=value.state.faces,`${name}: renderer did not draw the reported mesh`);assert.ok(value.pixels.rendererCalls>=1,`${name}: no actual render call`);
    assert.ok(value.state.geometryFingerprint?.positions,`${name}: missing actual buffer fingerprint`);
    observations.steps.push({name,...value});if(screenshot){const filename=`${tag}-${name}.png`;await page.screenshot({path:path.join(out,filename)});observations.screenshots.push(filename);}return value;
   }
   async function stage(t,name=`stage-${String(t).replace('.','_')}`,screenshot=false){
    phase=`${tag} ${name}`;const before=await page.evaluate(()=>window.__coralAudit.state.generationId);
    await page.locator('#time').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},String(t));
    await page.waitForFunction(({t,before})=>{const s=window.__coralAudit.state;return s.generationId>before&&Math.abs(s.displayedTime-t)<1e-7&&!s.geometryBusy&&!s.queued;},{t,before},{timeout});
    return capture(name,{screenshot});
   }
   async function panel(id,open=true){if(await page.locator(`#${id}`).evaluate(el=>el.open)!==open)await page.locator(`#${id} > summary`).click();}
   async function parameter(id,value){
    phase=`${tag} parameter ${id}`;const before=await page.evaluate(()=>window.__coralAudit.state);
    if(id==='seed'){await page.locator('#seed').fill(String(value));await page.locator('#seed').press('Tab');}
    else await page.locator(`#${id}`).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},String(value));
    await page.waitForFunction(({id,value,generation})=>{const s=window.__coralAudit.state;return s.generationId>generation&&s.displayedParameters?.[id]===value&&!s.geometryBusy&&!s.queued;},{id,value,generation:before.generationId},{timeout});
    const after=await capture(`parameter-${id}`,{screenshot:true});assert.notEqual(after.state.geometryFingerprint.positions,before.geometryFingerprint.positions,`${id} must change actual geometry`);return after;
   }
   async function download(button,filename){const pending=page.waitForEvent('download');await page.locator(button).click();const file=await pending;const dest=path.join(out,`${tag}-${filename}`);await file.saveAs(dest);assert.equal(await file.failure(),null);return dest;}
   async function rafPerformance(){
    return bounded(page.evaluate(async()=>{const intervals=[];let previous=null;await new Promise(resolve=>{function step(t){if(previous!==null)intervals.push(t-previous);previous=t;if(intervals.length<60)requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});const sorted=[...intervals].sort((a,b)=>a-b);return {samples:intervals.length,intervalsMs:intervals,medianMs:sorted[30],p95Ms:sorted[57],maxMs:sorted.at(-1),meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,over50ms:intervals.filter(x=>x>50).length,generationMs:window.__coralAudit.state.generationMs,note:'60 RAF intervals in this browser environment; no physical-device or real-time FPS guarantee'};}),120000,'60 RAF measurement');
   }
   phase=`${tag} initial load`;await page.goto(url,{waitUntil:'domcontentloaded',timeout});await ready();
   const readonly=await page.evaluate(()=>{const descriptor=Object.getOwnPropertyDescriptor(window,'__coralAudit');return {writable:descriptor.writable,configurable:descriptor.configurable,frozen:Object.isFrozen(window.__coralAudit),keys:Object.keys(window.__coralAudit)};});assert.equal(readonly.writable,false);assert.equal(readonly.configurable,false);assert.equal(readonly.frozen,true);assert.deepEqual(readonly.keys,['state','pixelDigest']);
   const initial=await capture('mature-initial',{screenshot:true});assert.equal(initial.state.displayedTime,1);assert.equal(initial.state.union,false);assert.ok(initial.state.faces>650000);assert.deepEqual(initial.state.displayedParameters,{seed:'17',density:1,fold:1});
   const baseline=new Map();for(const t of [0,.18,.35,.52,.72,1])baseline.set(t,await stage(t,`stage-${Math.round(t*100).toString().padStart(3,'0')}`,true));
   assert.equal(baseline.get(0).state.parts,8);assert.equal(baseline.get(.18).state.parts,15);assert.ok(baseline.get(.52).state.faces>baseline.get(.18).state.faces);
   const rewind=await stage(.52,'rewind-to-052');assert.deepEqual(rewind.state.geometryFingerprint,baseline.get(.52).state.geometryFingerprint);assert.equal(rewind.pixels.hash,baseline.get(.52).pixels.hash,'same stage/view must reproduce actual raster');
   phase=`${tag} rapid drag`;const preRapid=await page.evaluate(()=>window.__coralAudit.state.generationId);
   await page.locator('#time').evaluate(el=>{for(const t of [.2,.82,.11,.96,.34,.72]){el.value=String(t);el.dispatchEvent(new Event('input',{bubbles:true}));}});
   await page.waitForFunction(generation=>{const s=window.__coralAudit.state;return s.generationId>generation&&s.displayedTime===.72&&!s.geometryBusy&&!s.queued;},preRapid,{timeout});
   const rapid=await capture('rapid-drag-final-072');assert.deepEqual(rapid.state.geometryFingerprint,baseline.get(.72).state.geometryFingerprint);
   await stage(.18,'before-play');phase=`${tag} play pause`;const prePlay=await page.evaluate(()=>window.__coralAudit.state.generationId);await page.locator('#play').click();
   await page.waitForFunction(generation=>{const s=window.__coralAudit.state;return s.playing&&s.generationId>generation&&s.displayedTime>.205;},prePlay,{timeout});
   await page.locator('#play').click();const paused=await page.evaluate(()=>window.__coralAudit.state);assert.equal(paused.playing,false);
   await page.waitForFunction(()=>{const s=window.__coralAudit.state;return !s.geometryBusy&&!s.queued;},null,{timeout});const pauseRendered=await capture('paused-actual-stage');
   await page.waitForTimeout(450);const pauseAfter=await page.evaluate(()=>window.__coralAudit.state);assert.equal(pauseAfter.requestedTime,paused.requestedTime);assert.equal(pauseAfter.displayedTime,pauseRendered.state.displayedTime);assert.ok(pauseAfter.displayedTime>.18);
   await stage(1,'mature-before-views');
   for(const view of ['front','side','top','perspective']){phase=`${tag} view ${view}`;await page.locator(`[data-view=${view}]`).click();assert.equal(await page.locator(`[data-view=${view}]`).getAttribute('aria-pressed'),'true');await page.waitForTimeout(150);const observed=await capture(`view-${view}`,{screenshot:true});assert.equal(observed.state.camera.type,view==='perspective'?'PerspectiveCamera':'OrthographicCamera');}
   phase=`${tag} mouse orbit zoom`;const beforeOrbit=await capture('before-orbit');
   const cx=viewport.width*.67,cy=viewport.height*.48;await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-60,cy+40,{steps:12});await page.mouse.up();await page.waitForTimeout(350);const orbited=await capture('after-orbit',{screenshot:true});assert.notDeepEqual(orbited.state.camera.position,beforeOrbit.state.camera.position);assert.notEqual(orbited.pixels.hash,beforeOrbit.pixels.hash);
   await page.mouse.wheel(0,-180);await page.waitForTimeout(350);const zoomed=await capture('after-zoom',{screenshot:true});assert.notDeepEqual(zoomed.state.camera.position,orbited.state.camera.position);assert.notEqual(zoomed.pixels.hash,orbited.pixels.hash);
   await page.locator('[data-view=perspective]').click();await panel('parameters');
   const preSeed=await capture('before-parameters');const seed=await parameter('seed','23');assert.notEqual(seed.pixels.hash,preSeed.pixels.hash);
   const density=await parameter('density',.7);assert.notEqual(density.pixels.hash,seed.pixels.hash);assert.ok(density.state.faces<seed.state.faces);
   const fold=await parameter('fold',.5);assert.notEqual(fold.pixels.hash,density.pixels.hash);
   phase=`${tag} reset`;const preReset=fold.state.generationId;await page.locator('#reset').click();await page.waitForFunction(before=>{const s=window.__coralAudit.state,p=s.displayedParameters;return s.generationId>before&&s.displayedTime===1&&p?.seed==='17'&&p.density===1&&p.fold===1&&!s.geometryBusy&&!s.queued;},preReset,{timeout});
   const reset=await capture('reset-default',{screenshot:true});assert.deepEqual(reset.state.geometryFingerprint,initial.state.geometryFingerprint);assert.equal(reset.state.camera.type,'PerspectiveCamera');await panel('parameters',false);
   phase=`${tag} performance`;observations.performance=await rafPerformance();assert.equal(observations.performance.samples,60);
   await stage(.52,'exports-stage-052');await panel('inspect');phase=`${tag} lineage and exports`;
   await page.locator('#part').selectOption('stem-0');assert.match(await page.locator('#record').innerText(),/父枝到达/);assert.match(await page.locator('#record').innerText(),/出生时间/);assert.equal((await page.evaluate(()=>window.__coralAudit.state)).selected,'stem-0');
   const single=await download('#part-obj','single.obj');const singleText=await fs.readFile(single,'utf8');assert.equal(singleText.split('\n').filter(line=>line.startsWith('o ')).length,1);assert.match(singleText,/o stem-0/);assert.match(singleText,/NOT a watertight unified union/);
   const json=await download('#json','lineage.json'),parsed=JSON.parse(await fs.readFile(json,'utf8'));assert.equal(parsed.stage.union,false);assert.equal(parsed.stage.time,.52);assert.equal(parsed.recipe.model,'guided-tissue-accretion-js-r4.1');assert.ok(parsed.stage.lineage.some(r=>r.parent?.endsWith('/crown')));
   const current=await download('#obj','current-stage.obj'),text=await fs.readFile(current,'utf8'),currentState=await page.evaluate(()=>window.__coralAudit.state);assert.equal(text.split('\n').filter(line=>line.startsWith('o ')).length,currentState.parts);assert.equal(text.split('\n').filter(line=>line.startsWith('v ')).length,currentState.vertices);assert.equal(text.split('\n').filter(line=>line.startsWith('f ')).length,currentState.faces);assert.match(text,/# t=0.52;/);
   await page.locator('#part').selectOption('');await panel('inspect',false);await stage(1,'before-return-navigation');
   phase=`${tag} overflow`;const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,controls:['header','#timeline','#views','#tools'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})}));assert.ok(layout.scrollWidth<=layout.width+1);assert.ok(layout.scrollHeight<=layout.height+1);for(const r of layout.controls){assert.ok(r.x>=-1&&r.y>=-1&&r.right<=layout.width+1&&r.bottom<=layout.height+1,`${r.selector} overflows`);}observations.layout=layout;
   phase=`${tag} mother navigation`;assert.equal(await page.locator('#return').getAttribute('href'),mother);const motherTarget=new URL(mother);await Promise.all([page.waitForURL(u=>u.origin===motherTarget.origin&&u.pathname===motherTarget.pathname,{waitUntil:'domcontentloaded',timeout}),page.locator('#return').click()]);const arrived=new URL(page.url());assert.equal(arrived.origin,motherTarget.origin);assert.equal(arrived.pathname,motherTarget.pathname);assert.match(await page.title(),/Coral Mother/i);await page.waitForTimeout(1000);observations.motherURL=page.url();
   phase=`${tag} browser back`;await page.goBack({waitUntil:'domcontentloaded',timeout});assert.equal(new URL(page.url()).pathname,new URL(url).pathname);await ready();const back=await capture('returned-from-mother',{screenshot:true});assert.ok(back.state.faces>650000);
   assert.deepEqual(pageErrors,[],'uncaught browser page errors');assert.deepEqual(consoleErrors,[],'browser console errors');assert.deepEqual(networkFailures,[],'failed network requests');
   observations.pageErrors=pageErrors;observations.consoleErrors=consoleErrors;observations.networkFailures=networkFailures;observations.result='Automated checks passed; screenshots and morphology still require independent visual review. Mobile is emulation only.';
   await context.tracing.stop({path:path.join(out,`${tag}-trace.zip`)});traceStarted=false;results.push(observations);await saveJSON(`${tag}-results.json`,observations);await context.close();context=null;page=null;
  }
  phase='complete';await saveJSON('results.json',{status:'automated checks passed',sourceCommit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,engine,engineVersion,url,at:new Date().toISOString(),results});console.log(`${engine}: ${results.length} viewport suites passed. Pixel/readback evidence, screenshots, downloads, traces and RAF observations saved in ${out}. Visual morphology and physical mobile acceptance remain separate.`);
 }
}catch(error){await failure(error);process.exitCode=1;}finally{clearInterval(progressTimer);if(browser)await bounded(browser.close(),20000,'browser close').catch(error=>console.error(error.message));}
