const assert=require('node:assert/strict'),fs=require('node:fs'),pw=require('playwright');
const engine=process.env.OVERVIEW_BROWSER||'chromium',base=new URL('../kaopu-tailor-workbench/',process.env.OVERVIEW_URL||'http://127.0.0.1:8765/kaopu-human-overview/').href,out=(process.env.OVERVIEW_QA_DIR||'combined')+'/tailor-lifecycle';
let browser,page,shortsRecipe;const report={passed:false,engine,base,bfcacheTest:'synthetic pagehide/pageshow; real navigation recorded separately'};
fs.mkdirSync(out,{recursive:true});
(async()=>{
 browser=await pw[engine].launch(engine==='webkit'?{headless:true}:{headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:2048,height:1040}}),events=[];
 await require('./overview-lifecycle-overrides.cjs').apply(context,report);
 await context.exposeBinding('reportTailorLife',(_,data)=>events.push(data));
 await context.addInitScript(()=>{
  const NativeWorker=Worker,NativeObserver=ResizeObserver,request=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window);
  const trace=window.__tailorLifeTrack={workers:0,maxWorkers:0,terminated:0,frames:new Set(),observers:new Set()};
  window.Worker=class extends NativeWorker{constructor(...args){super(...args);this.tracked=true;trace.workers++;trace.maxWorkers=Math.max(trace.maxWorkers,trace.workers);}terminate(){if(this.tracked){trace.workers--;trace.terminated++;this.tracked=false;}super.terminate();}};
  window.ResizeObserver=class extends NativeObserver{observe(...args){trace.observers.add(this);return super.observe(...args);}disconnect(){trace.observers.delete(this);return super.disconnect();}};
  window.requestAnimationFrame=callback=>{let id=request(time=>{trace.frames.delete(id);callback(time);});trace.frames.add(id);return id;};
  window.cancelAnimationFrame=id=>{trace.frames.delete(id);cancel(id);};
  addEventListener('tailor-lifecycle',event=>window.reportTailorLife({url:location.href,...event.detail,workers:trace.workers,raf:trace.frames.size,observers:trace.observers.size}));
 });
 page=await context.newPage();const errors=[],cases=[];report.errors=errors;report.cases=cases;report.events=events;page.on('pageerror',e=>errors.push(e.message));
 const ready=async id=>page.waitForFunction(id=>{const s=window.__TAILOR_UNIFIED_QA__?.getState();return s?.active&&s.ready&&s.caseId===id&&['historical','draft','cut'].includes(s.phase)},id,{timeout:180000});
 for(const id of ['shorts','sleeveless','shortsleeve']){
  await page.goto(base+'?case='+id,{waitUntil:'networkidle'});await ready(id);
  const input=page.locator('[data-param]').first();await input.focus();await input.press('ArrowRight');const key=await input.getAttribute('data-param'),value=Number(await input.inputValue());
  await page.locator('#cut').click();await page.waitForFunction(()=>__TAILOR_UNIFIED_QA__.getState().phase==='cut');
  const fingerprint=await page.evaluate(()=>__TAILOR_UNIFIED_QA__.getState().specFingerprint);
  if(id==='shorts'){const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);shortsRecipe=fs.readFileSync(await download.path());assert(JSON.parse(shortsRecipe).controls);}
  await page.locator('#run').click();await page.waitForTimeout(300);
  const released=await page.evaluate(async()=>{
   const canvas=document.querySelector('#scene'),gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
   dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));
   await new Promise(resolve=>setTimeout(resolve,150));
   return {state:__TAILOR_UNIFIED_QA__.getState(),workers:__tailorLifeTrack.workers,raf:__tailorLifeTrack.frames.size,observers:__tailorLifeTrack.observers.size,contextLost:gl.isContextLost(),positions:__TAILOR_UNIFIED_QA__.getPositions().length,record:__TAILOR_UNIFIED_QA__.getRecord(),canvasReplaced:canvas!==document.querySelector('#scene')};
  });
  assert.equal(released.state.active,false);assert.equal(released.state.phase,'inactive');assert.equal(released.workers,0);assert.equal(released.raf,0);assert.equal(released.observers,0);assert.equal(released.state.rendererCount,0);assert.equal(released.state.bodyCached,false);assert.equal(released.positions,0);assert.equal(released.record,undefined);assert(released.contextLost);assert(released.canvasReplaced);assert(released.state.lastRelease.geometryCount>0);assert(released.state.lastRelease.rendererDisposed);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await ready(id);
  const restored=await page.evaluate(()=>__TAILOR_UNIFIED_QA__.getState());assert.equal(restored.controls[key],value);assert.equal(restored.specFingerprint,fingerprint);assert.equal(restored.phase,'cut');assert.equal(restored.contextsCreated,2);assert.equal(restored.contextsReleased,1);assert.equal(restored.activeWorkerCount,1);assert.equal(restored.rendererCount,1);
  await page.locator('#run').click();await page.waitForTimeout(300);await page.locator('#pause').click();await page.waitForFunction(()=>__TAILOR_UNIFIED_QA__.getState().phase==='paused');assert((await page.evaluate(()=>__TAILOR_UNIFIED_QA__.getState().metrics.elapsed))>0);
  await page.screenshot({path:out+'/'+id+'-restored.png'});const releaseCount=events.filter(x=>x.kind==='released').length;
  await page.locator('[data-wb-back]').click();await page.waitForURL('**/kaopu-human-overview/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(150);const real=events.filter(x=>x.kind==='released').slice(releaseCount);assert.equal(real.length,1);assert.equal(real[0].workers,0);assert.equal(real[0].raf,0);assert.equal(real[0].observers,0);assert.equal(real[0].rendererCount,0);
  await page.goBack({waitUntil:'networkidle'});await ready(id);assert.equal(await page.locator('canvas').count(),1);assert.equal((await page.evaluate(()=>__TAILOR_UNIFIED_QA__.getState())).activeWorkerCount,1);
  cases.push({id,edited:{[key]:value},fingerprint,released,restored,realPagehide:real[0]});
 }
 // Leave while the next case is still fetching. Its old async response must never rebuild resources.
 await page.goto(base+'?case=swatch',{waitUntil:'networkidle'});await ready('swatch');
 await page.route('**/garments-r04/assets/teacher-paper-base.json',async route=>{await new Promise(r=>setTimeout(r,350));await route.continue().catch(()=>{});});
 await page.evaluate(()=>{void __TAILOR_UNIFIED_QA__.selectCase('sleeveless');dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));});await page.waitForTimeout(700);
 assert.equal((await page.evaluate(()=>__TAILOR_UNIFIED_QA__.getState())).rendererCount,0);assert.equal(await page.evaluate(()=>__tailorLifeTrack.workers),0);
 await page.unroute('**/garments-r04/assets/teacher-paper-base.json');await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await ready('sleeveless');
 assert.equal((await page.evaluate(()=>__TAILOR_UNIFIED_QA__.getState())).rendererCount,1);assert.equal(await page.evaluate(()=>__tailorLifeTrack.maxWorkers),1);
 // A file import that began in an earlier page epoch must not adopt the restored epoch.
 await page.goto(base+'?case=swatch',{waitUntil:'networkidle'});await ready('swatch');
 await page.route('**/garments-r03/assets/teacher-paper-base.json',async route=>{await new Promise(r=>setTimeout(r,350));await route.continue().catch(()=>{});});
 assert(shortsRecipe);await page.locator('#load').setInputFiles({name:'synthetic-shorts-recipe.json',mimeType:'application/json',buffer:shortsRecipe});
 await page.waitForFunction(()=>{const s=__TAILOR_UNIFIED_QA__.getState();return s.caseId==='shorts'&&s.phase==='loading'});
 await page.evaluate(()=>{dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});
 await ready('shorts');await page.waitForTimeout(700);const importEpochState=await page.evaluate(()=>__TAILOR_UNIFIED_QA__.getState());assert(Object.values(importEpochState.controls).every(v=>v===0),'The old recipe must not replace restored default controls');assert.equal(importEpochState.activeWorkerCount,1);assert.equal(importEpochState.rendererCount,1);await page.unroute('**/garments-r03/assets/teacher-paper-base.json');
 assert.deepEqual(errors,[]);Object.assign(report,{passed:true,engine,base,cases,events,pendingAssetReturnPassed:true,oldImportEpochBlocked:true,importEpochState,errors});fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log('TAILOR_LIFECYCLE_RESULT '+JSON.stringify({passed:true,engine,cases:cases.map(x=>x.id),realReleases:events.filter(x=>x.kind==='released').length,pendingAssetReturnPassed:true,errors}));await browser.close();
})().catch(async e=>{report.failure=e.stack||String(e);fs.writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.error(e);try{await page?.screenshot({path:out+'/failure.png',timeout:5000})}catch{}await Promise.race([browser?.close(),new Promise(r=>setTimeout(r,5000))]);process.exit(1)});
