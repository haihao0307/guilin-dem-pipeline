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
const profile=process.env.CORAL_PROFILE||'all';
const url=process.env.CORAL_URL||process.argv[2]||'http://127.0.0.1:8765';
const out=path.resolve(process.env.CORAL_OUT||path.join(path.dirname(fileURLToPath(import.meta.url)),'browser-evidence',engine));
const mother='https://haihao0307.github.io/guilin-dem-pipeline/coral-mother-core-seed-r01/';
const timeout=90000,results=[];await fs.mkdir(out,{recursive:true});
let browserVersion=null;
let browser,context,page,traceStarted=false,phase='dependency',viewport=null,engineVersion=null;
let pageErrors=[],consoleErrors=[],networkFailures=[],currentObservations=null;
const saveJSON=(name,value)=>fs.writeFile(path.join(out,name),JSON.stringify(value,null,2));
const bounded=(promise,ms,label)=>Promise.race([promise,new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error(`${label} exceeded ${ms}ms`)),ms);t.unref?.();})]);
const progressTimer=setInterval(()=>{const state={phase,viewport,at:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA??null};saveJSON('progress.json',state).catch(()=>{});console.log('QA_PROGRESS',JSON.stringify(state));},30000);progressTimer.unref();
async function failure(error,status='failed'){
 const details={status,sourceCommit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,engine,profile,engineVersion,browserVersion,url,at:new Date().toISOString(),phase,viewport,error:{name:error?.name??'Error',message:String(error?.message??error),stack:error?.stack??null},pageErrors,consoleErrors,networkFailures,partialObservation:currentObservations,completed:results};
 if(page&&!page.isClosed()){
  try{details.currentURL=page.url();details.audit=await bounded(page.evaluate(()=>window.__coralAudit?.state??null),4000,'failure audit');}catch(e){details.auditError=String(e);}
  try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true,timeout:10000});details.screenshot='failure.png';}catch(e){details.screenshotUnavailable=String(e);}
 }else details.screenshotUnavailable='No browser page was created.';
 if(context&&traceStarted){try{await bounded(context.tracing.stop({path:path.join(out,'failure-trace.zip')}),15000,'failure trace');details.trace='failure-trace.zip';traceStarted=false;}catch(e){details.traceUnavailable=String(e);}}else details.traceUnavailable='No browser tracing session was created.';
 await saveJSON('failure.json',details);console.error(`${status.toUpperCase()} ${engine}: ${details.error.message}`);
}
try{
 if(!['chromium','webkit'].includes(engine))throw new Error(`Unsupported CORAL_ENGINE=${engine}`);
 if(!['all','desktop','mobile'].includes(profile))throw new Error(`Unsupported CORAL_PROFILE=${profile}`);
 let playwright;
 try{playwright=require('playwright');engineVersion=require('playwright/package.json').version;}catch(error){await failure(error,'not run');process.exitCode=77;}
 if(playwright){
  phase='browser launch';try{browser=await playwright[engine].launch({headless:true});}catch(error){await failure(error,'not run');process.exitCode=77;}
 }
 if(browser){
  browserVersion=browser.version();
  for(viewport of [{width:1440,height:1000},{width:390,height:844}].filter(v=>profile==='all'||(profile==='desktop'?v.width>500:v.width<500))){
   const tag=`${engine}-${viewport.width}`,observations={engine,profile,viewport,emulation:viewport.width<500?'mobile viewport and touch emulation, not a physical phone':'desktop browser viewport',steps:[],screenshots:[],performance:null};
   const expectedQuality=viewport.width<=640?'mobilePreview':'preview',expectedMature=viewport.width<=640?{vertices:143502,faces:285088,buffers:6865104}:{vertices:366734,faces:731552,buffers:17580240};
   currentObservations=observations;
   context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:viewport.width<500,hasTouch:viewport.width<500,acceptDownloads:true});
   await context.tracing.start({screenshots:true,snapshots:true,sources:true});traceStarted=true;
   page=await context.newPage();page.setDefaultTimeout(timeout);pageErrors=[];consoleErrors=[];networkFailures=[];
   page.on('pageerror',error=>pageErrors.push({phase,url:page.url(),message:error.message}));
   page.on('console',message=>{if(message.type()==='error')consoleErrors.push({phase,text:message.text(),location:message.location()});});
   page.on('requestfailed',request=>{if(!request.url().endsWith('/favicon.ico'))networkFailures.push({phase,url:request.url(),error:request.failure()?.errorText});});
   // A missing optional favicon is not application behavior. Do not mask module/API failures.
   await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
   async function ready(){await page.waitForFunction(()=>window.__coralAudit?.state.faces>0&&!window.__coralAudit.state.geometryBusy&&!window.__coralAudit.state.queued&&window.__coralAudit.state.lifecycle.phase==='running',null,{timeout});}
   async function capture(name,{screenshot=false}={}){
    const value=await bounded(page.evaluate(()=>{const pixels=window.__coralAudit.pixelDigest();return {state:window.__coralAudit.state,pixels};}),60000,`${name} framebuffer readback`);
    assert.equal(value.pixels.glErrorBefore,0,`${name}: preexisting GL error`);assert.equal(value.pixels.glError,0,`${name}: readPixels GL error`);
    assert.ok(value.pixels.nonBackgroundPixels>200,`${name}: actual WebGL framebuffer is blank`);
    assert.ok(value.pixels.rendererTriangles>=value.state.faces,`${name}: renderer did not draw the reported mesh`);assert.ok(value.pixels.rendererCalls>=1,`${name}: no actual render call`);
    assert.ok(value.state.geometryFingerprint?.positions,`${name}: missing actual buffer fingerprint`);
    assert.equal(value.pixels.mainDrawCalls,1,`${name}: primary geometry must be a single actual draw call`);assert.equal(value.pixels.mainTriangles,value.state.faces);
    assert.equal(value.state.buffers.position,value.state.vertices*12);assert.equal(value.state.buffers.normal,value.state.vertices*12);assert.equal(value.state.buffers.index,value.state.faces*12);assert.equal(value.state.buffers.total,value.state.vertices*24+value.state.faces*12);
    assert.ok(value.state.rendererMemory.geometries>=1&&value.state.rendererMemory.geometries<=2,`${name}: unexpected retained geometry count`);assert.equal(value.state.lifecycle.phase,'running');
    observations.steps.push({name,...value});if(screenshot){const filename=`${tag}-${name}.png`;await page.screenshot({path:path.join(out,filename)});observations.screenshots.push(filename);}return value;
   }
   function assertFrameBounds(observed,label){
    const r=observed.state.framing?.rect,b=observed.pixels.nonBackgroundBounds;
    assert.ok(r&&b,`${label}: missing actual frame bounds`);
    const sx=observed.pixels.width/viewport.width,sy=observed.pixels.height/viewport.height;
    assert.ok(b.minX>=r.left*sx-2&&b.maxX<=r.right*sx+2&&b.minY>=r.top*sy-2&&b.maxY<=r.bottom*sy+2,`${label}: rendered coral exceeds unobstructed frame: ${JSON.stringify({r,b})}`);
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
   async function rafPerformance(mode='idle'){
    return bounded(page.evaluate(async mode=>{const intervals=[],before=window.__coralAudit.state;let previous=null;await new Promise(resolve=>{function step(t){if(previous!==null)intervals.push(t-previous);previous=t;const draws=window.__coralAudit.state.timings.renderCount-before.timings.renderCount;if(intervals.length<60||(mode!=='idle'&&draws<60))requestAnimationFrame(step);else resolve();}requestAnimationFrame(step);});const after=window.__coralAudit.state,sorted=[...intervals].sort((a,b)=>a-b),deltas={};for(const key of ['renderCount','geometryInstallCount','geometryBytesInstalled','bufferUploadCalls','bufferUploadBytes','pixelDigestCount','renderSubmitMsTotal','readbackMsTotal','bufferUploadSubmitMsTotal'])deltas[key]=after.timings[key]-before.timings[key];return {mode,samples:intervals.length,intervalsMs:intervals,medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))],maxMs:sorted.at(-1),meanMs:intervals.reduce((a,b)=>a+b,0)/intervals.length,over50ms:intervals.filter(x=>x>50).length,generationMs:after.generationMs,buffers:after.buffers,mainDrawCalls:after.mainDrawCalls,rendererMemory:after.rendererMemory,renderQuality:after.displayedQuality,timingsBefore:before.timings,timingsAfter:after.timings,deltas,note:'Idle: exactly 60 RAF intervals. Controlled camera motion: at least 60 RAF intervals and 60 actual draws; any protocol/idle gaps remain in the measured window. No readPixels during either measurement. Submission times are CPU/main-thread wall times, not GPU elapsed time; not a physical-device guarantee.'};},mode),120000,`${mode}: 60 RAF measurement`);
   }
   phase=`${tag} initial load`;await page.goto(url,{waitUntil:'domcontentloaded',timeout});await ready();
   const readonly=await page.evaluate(()=>{const descriptor=Object.getOwnPropertyDescriptor(window,'__coralAudit');return {writable:descriptor.writable,configurable:descriptor.configurable,frozen:Object.isFrozen(window.__coralAudit),keys:Object.keys(window.__coralAudit)};});assert.equal(readonly.writable,false);assert.equal(readonly.configurable,false);assert.equal(readonly.frozen,true);assert.deepEqual(readonly.keys,['state','pixelDigest']);
   observations.environment=await page.evaluate(()=>{const c=document.getElementById('scene'),gl=c.getContext('webgl2')||c.getContext('webgl'),debug=gl.getExtension('WEBGL_debug_renderer_info');return {userAgent:navigator.userAgent,devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency,gpu:{vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),version:gl.getParameter(gl.VERSION),unmaskedVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null}};});
   const initial=await capture('mature-initial',{screenshot:true});assert.equal(initial.state.displayedTime,1);assert.equal(initial.state.union,false);assert.equal(initial.state.faces,expectedMature.faces);assert.equal(initial.state.vertices,expectedMature.vertices);assert.equal(initial.state.buffers.total,expectedMature.buffers);assert.equal(initial.state.displayedQuality,expectedQuality);assert.equal(initial.state.parts,479);assertFrameBounds(initial,'initial view');assert.deepEqual(initial.state.displayedParameters,{seed:'17',density:1,fold:1});
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
   for(const view of ['front','side','top','perspective']){phase=`${tag} view ${view}`;await page.locator(`[data-view=${view}]`).click();assert.equal(await page.locator(`[data-view=${view}]`).getAttribute('aria-pressed'),'true');await page.waitForTimeout(150);const observed=await capture(`view-${view}`,{screenshot:true});assert.equal(observed.state.camera.type,view==='perspective'?'PerspectiveCamera':'OrthographicCamera');assertFrameBounds(observed,`${view} view`);}
   phase=`${tag} mouse orbit zoom`;const beforeOrbit=await capture('before-orbit');
   const cx=viewport.width*.67,cy=viewport.height*.48;await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-60,cy+40,{steps:12});await page.mouse.up();await page.waitForTimeout(350);const orbited=await capture('after-orbit',{screenshot:true});assert.notDeepEqual(orbited.state.camera.position,beforeOrbit.state.camera.position);assert.notEqual(orbited.pixels.hash,beforeOrbit.pixels.hash);
   if(viewport.width<500){await page.locator('#zoom-in').tap();observations.mobileZoom='Real touchscreen tap on accessible + control in mobile browser emulation; physical-phone pinch is not tested.';}else await page.mouse.wheel(0,-180);
   await page.waitForTimeout(350);const zoomed=await capture('after-zoom',{screenshot:true});assert.notDeepEqual(zoomed.state.camera.position,orbited.state.camera.position);assert.notEqual(zoomed.pixels.hash,orbited.pixels.hash);
   if(viewport.width<500){await page.locator('#zoom-out').tap();await page.waitForTimeout(150);const zoomedOut=await capture('after-zoom-out-button');assert.notDeepEqual(zoomedOut.state.camera.position,zoomed.state.camera.position);assert.notEqual(zoomedOut.pixels.hash,zoomed.pixels.hash);}
   await page.locator('[data-view=perspective]').click();await panel('parameters');
   const preSeed=await capture('before-parameters');const seed=await parameter('seed','23');assert.notEqual(seed.pixels.hash,preSeed.pixels.hash);
   const density=await parameter('density',.7);assert.notEqual(density.pixels.hash,seed.pixels.hash);assert.ok(density.state.faces<seed.state.faces);
   const fold=await parameter('fold',.5);assert.notEqual(fold.pixels.hash,density.pixels.hash);
   phase=`${tag} simulated context loss`;
   const contextExtension=await bounded(page.evaluate(()=>{const canvas=document.getElementById('scene'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),extension=gl.getExtension('WEBGL_lose_context');if(!extension)return false;window.__coralQALoseContext=extension;extension.loseContext();return true;}),15000,'context loss extension');assert.equal(contextExtension,true,'Context-loss test not run: WEBGL_lose_context unavailable');
   await page.waitForFunction(()=>window.__coralAudit.state.lifecycle.contextLost&&window.__coralAudit.state.lifecycle.phase==='context-lost',null,{timeout:15000});
   const lost=await page.evaluate(()=>window.__coralAudit.state);assert.equal(lost.rafPending,false);assert.equal(lost.playing,false);assert.equal(lost.workerAlive,true);assert.equal(lost.lifecycle.contextLostCount,1);observations.contextLost=lost;
   await page.waitForTimeout(150);phase=`${tag} context restoration`;await bounded(page.evaluate(()=>{window.__coralQALoseContext.restoreContext();delete window.__coralQALoseContext;}),15000,'request context restoration');
   await page.waitForFunction(()=>{const s=window.__coralAudit.state;return s.lifecycle.contextRestoredCount===1&&s.lifecycle.phase==='running'&&!s.lifecycle.contextLost;},null,{timeout:30000});
   const restored=await capture('context-restored',{screenshot:true});assert.deepEqual(restored.state.displayedParameters,fold.state.displayedParameters);assert.deepEqual(restored.state.geometryFingerprint,fold.state.geometryFingerprint);assert.equal(restored.state.displayedTime,fold.state.displayedTime);assert.equal(restored.state.workerAlive,true);observations.contextRestoration='Actual WEBGL_lose_context loss/restoration; actual framebuffer nonblank and exact geometry/parameters preserved.';
   if(viewport.width<500){
    await panel('parameters',false);phase=`${tag} single touch picking`;
    const point=await bounded(page.evaluate(()=>{const audit=window.__coralAudit.pixelDigest(),canvas=document.getElementById('scene'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl'),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);for(let y=Math.floor(innerHeight*.35);y<innerHeight*.74;y+=4)for(let x=Math.floor(innerWidth*.38);x<innerWidth*.85;x+=4){if(document.elementFromPoint(x,y)!==canvas)continue;const ix=Math.floor(x*w/innerWidth),iy=h-1-Math.floor(y*h/innerHeight),i=(iy*w+ix)*4;if(Math.abs(pixels[i]-audit.background[0])+Math.abs(pixels[i+1]-audit.background[1])+Math.abs(pixels[i+2]-audit.background[2])>15)return {x,y};}return null;}),15000,'locate visible touch target');
    if(point){await page.touchscreen.tap(point.x,point.y);let picked=true;try{await page.waitForFunction(()=>window.__coralAudit.state.selected!=='',null,{timeout:3000});}catch{picked=false;}observations.singleTouchPick={status:picked?'verified':'not verified',point,selected:(await page.evaluate(()=>window.__coralAudit.state)).selected,note:'Optional single touch in mobile emulation; not a physical touch-device or pinch test'};if(picked)await page.locator('#part').selectOption('');await panel('inspect',false);}else observations.singleTouchPick={status:'not run',reason:'No unobscured foreground framebuffer pixel found'};
    await panel('parameters');
   }

   phase=`${tag} reset`;const preReset=fold.state.generationId;await page.locator('#reset').click();await page.waitForFunction(before=>{const s=window.__coralAudit.state,p=s.displayedParameters;return s.generationId>before&&s.displayedTime===1&&p?.seed==='17'&&p.density===1&&p.fold===1&&!s.geometryBusy&&!s.queued;},preReset,{timeout});
   const reset=await capture('reset-default',{screenshot:true});assert.deepEqual(reset.state.geometryFingerprint,initial.state.geometryFingerprint);assert.equal(reset.state.camera.type,'PerspectiveCamera');await panel('parameters',false);
   phase=`${tag} idle performance`;await page.waitForFunction(()=>!window.__coralAudit.state.renderDirty&&!window.__coralAudit.state.geometryBusy&&!window.__coralAudit.state.queued,null,{timeout});
   const idlePerformance=await rafPerformance('idle');assert.equal(idlePerformance.samples,60);for(const key of ['renderCount','geometryInstallCount','geometryBytesInstalled','bufferUploadCalls','bufferUploadBytes','pixelDigestCount'])assert.equal(idlePerformance.deltas[key],0,`idle must not increase ${key}`);
   phase=`${tag} continuous redraw performance`;const dragX=viewport.width*.66,dragY=viewport.height*.48;await page.mouse.move(dragX,dragY);await page.mouse.down();let samplingRedraw=true;const redrawMeasurement=rafPerformance('continuous camera drag').then(value=>{samplingRedraw=false;return {value};},error=>{samplingRedraw=false;return {error};});
   for(let i=1;samplingRedraw&&i<=240;i++){await page.mouse.move(dragX+Math.sin(i*.025)*22,dragY+Math.sin(i*.12)*2);await page.waitForTimeout(16);}await page.mouse.up();const redrawResult=await redrawMeasurement;if(redrawResult.error)throw redrawResult.error;const continuousRedraw=redrawResult.value;assert.ok(continuousRedraw.samples>=60);assert.ok(continuousRedraw.deltas.renderCount>=60,'measurement must observe at least 60 actual camera redraws');for(const key of ['geometryInstallCount','geometryBytesInstalled','bufferUploadCalls','bufferUploadBytes','pixelDigestCount'])assert.equal(continuousRedraw.deltas[key],0,`camera-only redraw must not increase ${key}`);
   observations.performance={idle:idlePerformance,continuousRedraw};await page.locator('[data-view=perspective]').click();
   await stage(.52,'exports-stage-052');await panel('inspect');phase=`${tag} lineage and exports`;
   await page.locator('#part').selectOption('stem-0');assert.match(await page.locator('#record').innerText(),/父枝到达/);assert.match(await page.locator('#record').innerText(),/出生时间/);assert.equal((await page.evaluate(()=>window.__coralAudit.state)).selected,'stem-0');
   const single=await download('#part-obj','single.obj');const singleText=await fs.readFile(single,'utf8');assert.equal(singleText.split('\n').filter(line=>line.startsWith('o ')).length,1);assert.match(singleText,/o stem-0/);assert.match(singleText,/NOT a watertight unified union/);
   const json=await download('#json','lineage.json'),parsed=JSON.parse(await fs.readFile(json,'utf8'));assert.equal(parsed.stage.union,false);assert.equal(parsed.stage.time,.52);assert.equal(parsed.recipe.model,'guided-tissue-accretion-js-r4.1');assert.ok(parsed.stage.lineage.some(r=>r.parent?.endsWith('/crown')));
   const current=await download('#obj','current-stage.obj'),text=await fs.readFile(current,'utf8'),currentState=await page.evaluate(()=>window.__coralAudit.state);assert.equal(text.split('\n').filter(line=>line.startsWith('o ')).length,currentState.parts);assert.equal(text.split('\n').filter(line=>line.startsWith('v ')).length,currentState.vertices);assert.equal(text.split('\n').filter(line=>line.startsWith('f ')).length,currentState.faces);assert.match(text,/# t=0.52;/);
   await page.locator('#part').selectOption('');await panel('inspect',false);const beforeNavigation=await stage(1,'before-return-navigation');
   phase=`${tag} overflow`;const layout=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,controls:['header','#timeline','#views','#tools'].map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom};})}));assert.ok(layout.scrollWidth<=layout.width+1);assert.ok(layout.scrollHeight<=layout.height+1);for(const r of layout.controls){assert.ok(r.x>=-1&&r.y>=-1&&r.right<=layout.width+1&&r.bottom<=layout.height+1,`${r.selector} overflows`);}observations.layout=layout;
   phase=`${tag} mother navigation`;assert.equal(await page.locator('#return').getAttribute('href'),mother);const motherTarget=new URL(mother);await Promise.all([page.waitForURL(u=>u.origin===motherTarget.origin&&u.pathname===motherTarget.pathname,{waitUntil:'domcontentloaded',timeout}),page.locator('#return').click()]);const arrived=new URL(page.url());assert.equal(arrived.origin,motherTarget.origin);assert.equal(arrived.pathname,motherTarget.pathname);assert.match(await page.title(),/Coral Mother/i);await page.waitForTimeout(1000);observations.motherURL=page.url();
   phase=`${tag} browser back`;await page.goBack({waitUntil:'domcontentloaded',timeout});assert.equal(new URL(page.url()).pathname,new URL(url).pathname);await ready();const back=await capture('returned-from-mother',{screenshot:true});assert.equal(back.state.faces,expectedMature.faces);assert.equal(back.state.displayedQuality,expectedQuality);assert.deepEqual(back.state.displayedParameters,beforeNavigation.state.displayedParameters);assert.deepEqual(back.state.geometryFingerprint,beforeNavigation.state.geometryFingerprint);
   const cleanup=back.state.lifecycle.previousCleanup;assert.ok(cleanup,'Previous pagehide cleanup receipt must survive return');assert.equal(cleanup.instanceId,beforeNavigation.state.lifecycle.instanceId);assert.notEqual(back.state.lifecycle.instanceId,cleanup.instanceId);assert.equal(cleanup.event,'pagehide');assert.deepEqual(cleanup.errors,[]);
   for(const action of ['rafCancelled','timersCleared','workerTerminated','controlsDisposed','geometryDisposed','materialsDisposed','rendererDisposed','gpuContextReleased'])assert.equal(cleanup[action],true,`pagehide ${action}`);
   assert.equal(cleanup.after.buffers.total,0);assert.equal(cleanup.after.workerAlive,false);assert.equal(cleanup.after.rafPending,false);assert.equal(cleanup.after.objectURLs,0);assert.equal(cleanup.after.rendererMemory.geometries,0);assert.equal(cleanup.after.rendererMemory.textures,0);assert.equal(cleanup.after.rendererMemory.programs,0);assert.equal(cleanup.gpuContextLost,true);
   if(cleanup.persisted)assert.equal(cleanup.bfcacheReloadRequested,true);observations.cleanup=cleanup;observations.bfcache=cleanup.persisted?'BFCache restore exercised; safely reloaded after resource disposal':'Browser used normal history reload; BFCache-specific branch was not exercised';
   assert.deepEqual(pageErrors,[],'uncaught browser page errors');assert.deepEqual(consoleErrors,[],'browser console errors');assert.deepEqual(networkFailures,[],'failed network requests');
   observations.pageErrors=pageErrors;observations.consoleErrors=consoleErrors;observations.networkFailures=networkFailures;observations.result='Automated checks passed; screenshots and morphology still require independent visual review. Mobile is emulation only.';
   await context.tracing.stop({path:path.join(out,`${tag}-trace.zip`)});traceStarted=false;results.push(observations);await saveJSON(`${tag}-results.json`,observations);await context.close();context=null;page=null;
  }
  phase='complete';await saveJSON('results.json',{status:'automated checks passed',sourceCommit:process.env.GITHUB_SHA??null,runId:process.env.GITHUB_RUN_ID??null,engine,profile,engineVersion,browserVersion,url,at:new Date().toISOString(),results});console.log(`${engine}: ${results.length} viewport suites passed. Pixel/readback evidence, screenshots, downloads, traces and RAF observations saved in ${out}. Visual morphology and physical mobile acceptance remain separate.`);
 }
}catch(error){await failure(error);process.exitCode=1;}finally{clearInterval(progressTimer);if(browser)await bounded(browser.close(),20000,'browser close').catch(error=>console.error(error.message));}
