'use strict';
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'..'),OUT=process.env.BUREAU_QA_OUT||path.resolve('bureau-r03f-public-preview-results'),PORT=8793,PUBLIC_URL=process.env.BUREAU_PUBLIC_URL||null;fs.mkdirSync(OUT,{recursive:true});
const receipt={revision:'architecture-study-r03-on-demand-qa',sha:process.env.GITHUB_SHA||null,started:new Date().toISOString(),target:PUBLIC_URL||'local repository HTTP server',status:'running',backend:'Chromium WebGL; runtime identification below',errors:[],requests:[],tests:[],views:[],performance:[],performancePolicy:{sampleMs:2500,minFramesExclusive:5,scope:'2.5 s of actively requested, GPU-completed frames; software-renderer regression only, not user-device FPS or GPU time'}};
const save=()=>fs.writeFileSync(path.join(OUT,'receipt.json'),JSON.stringify(receipt,null,2));const check=(name,pass,detail)=>{receipt.tests.push({name,pass:!!pass,detail});save();};
const server=http.createServer((req,res)=>{try{let f=path.resolve(ROOT,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(f!==ROOT&&!f.startsWith(ROOT+path.sep)){res.writeHead(403).end();return;}if(fs.statSync(f).isDirectory())f=path.join(f,'index.html');res.setHeader('Content-Type',f.endsWith('.js')||f.endsWith('.mjs')?'text/javascript':f.endsWith('.html')?'text/html':f.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(f));}catch{res.writeHead(404).end();}});
// All waits use timer polling, not a count of future idle rAF callbacks.
const TIMEOUT=120000;
(async()=>{let browser;try{
 if(!PUBLIC_URL)await new Promise(r=>server.listen(PORT,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 page.on('pageerror',e=>{receipt.errors.push(String(e));save();});
 page.on('console',m=>{if(m.type()==='error'){receipt.errors.push(m.text());save();}});
 page.on('response',r=>{if(r.status()>=400){receipt.requests.push({url:r.url(),status:r.status()});save();}});
 const navigationStarted=Date.now();
 await page.goto(PUBLIC_URL||'http://127.0.0.1:'+PORT+'/',{timeout:60000,waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__bureauArchitecture?.ready,undefined,{polling:50,timeout:TIMEOUT});
 receipt.startup=await page.evaluate(()=>{const a=window.__bureauArchitecture;return{firstRenderSubmitMs:a.firstRenderSubmitMs,firstGpuCompleteMs:a.firstGpuCompleteMs,frames:a.frames,completedFrames:a.completedFrames,submittedFrames:a.submittedFrames,state:a.renderState?.(),renderer:a.rendererInfo()};});
 receipt.startup.navigationToReadyMs=Date.now()-navigationStarted;
 check('startup',receipt.startup.completedFrames>=1&&receipt.startup.frames===receipt.startup.completedFrames,receipt.startup);
 check('revision scheduling API',await page.evaluate(()=>typeof window.__bureauArchitecture.requestRender==='function'&&typeof window.__bureauArchitecture.renderState==='function'));
 const settle=async(minRevision=null)=>{
  // Re-read requestedRevision each poll: damping, resize, or another UI event may
  // supersede the original request. A capture requires the latest revision idle.
  await page.waitForFunction(minRevision=>{const a=window.__bureauArchitecture,s=a?.renderState?.();if(!s)return false;if(s.contextLost||a.contextLost)throw Error('WebGL context lost while awaiting frame');return s.completedRevision>=s.requestedRevision&&(minRevision===null||s.completedRevision>=minRevision)&&!s.pending&&!s.dirty&&!s.scheduled;},minRevision,{polling:50,timeout:TIMEOUT});
  return page.evaluate(()=>{const a=window.__bureauArchitecture;return{state:a.renderState(),completedFrames:a.completedFrames,submittedFrames:a.submittedFrames};});
 };
 const cameraSample=()=>page.evaluate(()=>{const a=window.__bureauArchitecture;return{camera:a.camera(),completedFrames:a.completedFrames,submittedFrames:a.submittedFrames,state:a.renderState()};});
 const distance=c=>Math.hypot(...c.eye.map((v,i)=>v-c.target[i]));
 const moved=(a,b)=>Math.hypot(...a.eye.map((v,i)=>v-b.eye[i]))>1e-6||Math.hypot(...a.target.map((v,i)=>v-b.target[i]))>1e-6;
 const measure=async view=>{
  await settle();
  const sample=await page.evaluate(async({sampleMs,timeout})=>{
   const a=window.__bureauArchitecture,start=performance.now(),deadline=start+sampleMs,first=a.completedFrames,firstSubmitted=a.submittedFrames;
   const requests=[],observations=[];let completedInside=0,previous=first;
   while(performance.now()<deadline){
    const requestedAt=performance.now(),revision=a.requestRender();
    const request={revision,requestedAtMs:requestedAt-start};requests.push(request);
    // Exactly one requested frame is awaited before the next request. A frame
    // landing after the fixed window is recorded, never credited to its FPS.
    for(;;){
     const now=performance.now(),s=a.renderState();
     if(s.contextLost||a.contextLost)throw Error('Context lost during performance sample');
     if(now-start>timeout)throw Error('GPU completion timeout in performance sample');
     if(a.completedFrames!==previous){const delta=a.completedFrames-previous;observations.push({atMs:now-start,frames:delta,completedFrames:a.completedFrames});if(now<=deadline)completedInside+=delta;previous=a.completedFrames;}
     if(s.completedRevision>=revision&&!s.pending&&!s.dirty&&!s.scheduled){request.completedAtMs=now-start;request.completedFrames=a.completedFrames;break;}
     await new Promise(resolve=>setTimeout(resolve,10));
    }
   }
   const end=performance.now(),s=a.renderState();
   return{frames:completedInside,elapsedMs:sampleMs,effectiveFps:completedInside*1000/sampleMs,completionObservation:'timer-observed completion, conservatively counted only at or before fixed deadline',totalCompletedUntilSettled:a.completedFrames-first,landingFramesAfterWindow:a.completedFrames-first-completedInside,settledElapsedMs:end-start,landingWaitMs:Math.max(0,end-deadline),submittedFrames:a.submittedFrames-firstSubmitted,requestedFrames:requests.length,requests,observations,finalState:s,renderer:a.rendererInfo(),gpuTimeMs:null};
  },{sampleMs:2500,timeout:TIMEOUT});
  receipt.performance.push({view,...sample,pass:sample.frames>5});save();
 };
 const screenshots=new Set(['whole','hall','counter','warehouse','office','section']);
 for(const view of['whole','front','hall','counter','cloister','court','office','warehouse','steam','back','section','plan']){
  const viewStarted=Date.now();await page.locator('[data-view="'+view+'"]').click();const completion=await settle();
  const info=await page.evaluate(()=>{const a=window.__bureauArchitecture;return{view:a.view,camera:a.camera(),render:a.rendererInfo()};});
  info.completion={...completion,viewToSettledMs:Date.now()-viewStarted};
  check('view '+view,info.view===view&&info.camera.eye.every(Number.isFinite)&&info.camera.target.every(Number.isFinite));receipt.views.push(info);
  if(screenshots.has(view)){
   await page.locator('#toggle-panel').click();const captureState=await settle(),captureStarted=Date.now();
   const bytes=await page.screenshot({path:path.join(OUT,view+'.png'),timeout:60000});
   info.screenshot={name:view+'.png',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),captureMs:Date.now()-captureStarted,navigationToCaptureCompletedMs:Date.now()-navigationStarted,completedState:captureState};
   if(!receipt.firstScreenshot)receipt.firstScreenshot={view,...info.screenshot};
   await page.locator('#toggle-panel').click();await settle();
  }
  if(['whole','hall','warehouse'].includes(view))await measure(view);save();
 }
 // Real pointer remains down until a changed camera has a completed render.
 await page.locator('[data-view="whole"]').click();await settle();const before=await cameraSample();
 await page.mouse.move(1050,600);await page.mouse.down();let held;
 try{await page.mouse.move(1160,650,{steps:7});await settle();held=await cameraSample();}finally{await page.mouse.up();}
 await settle();check('orbit drag while held',moved(before.camera,held.camera)&&held.completedFrames>before.completedFrames,{before,whilePointerDown:held});
 const preZoom=await cameraSample();await page.mouse.wheel(0,-500);await settle();const zoomIn=await cameraSample();
 check('wheel zoom in',distance(zoomIn.camera)<distance(preZoom.camera)-1e-6&&zoomIn.completedFrames>preZoom.completedFrames,{before:preZoom,after:zoomIn});
 await page.mouse.wheel(0,500);await settle();const zoomOut=await cameraSample();
 check('wheel zoom out',distance(zoomOut.camera)>distance(zoomIn.camera)+1e-6&&zoomOut.completedFrames>zoomIn.completedFrames,{before:zoomIn,after:zoomOut});
 await page.locator('[data-view="hall"]').click();await settle();const walkBefore=await cameraSample();
 await page.keyboard.down('w');try{await page.waitForTimeout(500);}finally{await page.keyboard.up('w');}await settle();const walkAfter=await cameraSample();
 check('WASD moves',moved(walkBefore.camera,walkAfter.camera)&&walkAfter.camera.eye[2]>walkBefore.camera.eye[2]&&walkAfter.completedFrames>walkBefore.completedFrames,{before:walkBefore,after:walkAfter});
 for(const id of['roofs','vaults','floors']){
  await page.locator('#'+id).uncheck();await settle();const layer={roofs:'roofs',vaults:'vaults',floors:'upper-floors'}[id];
  check('hide '+id,await page.evaluate(layer=>{const objects=window.__bureauArchitecture.root.children.filter(o=>o.userData.layer===layer);return objects.length>0&&objects.every(o=>!o.visible);},layer));
  await page.locator('#'+id).check();await settle();
  check('show '+id,await page.evaluate(layer=>{const objects=window.__bureauArchitecture.root.children.filter(o=>o.userData.layer===layer);return objects.length>0&&objects.every(o=>o.visible);},layer));
 }
 // Range inputs cannot be filled by Playwright. Exercise their native keyboard/input path.
 await page.locator('#cut').focus();await page.locator('#cut').press('Home');for(let i=0;i<40;i++)await page.locator('#cut').press('ArrowRight');
 await settle();check('section cut',await page.evaluate(()=>window.__bureauArchitecture.rendererInfo().cutHeight===5));
 await page.setViewportSize({width:390,height:844});await page.locator('[data-view="counter"]').click();await settle();
 check('mobile view controls',await page.evaluate(()=>window.__bureauArchitecture.view==='counter'&&document.querySelector('#panel').getBoundingClientRect().width<=innerWidth));
 // Static frames are supposed to stop. This is a scheduling check, not a zero-FPS failure.
 const idleBefore=await cameraSample();await page.waitForTimeout(350);const idleAfter=await cameraSample();
 check('idle does not submit frames',idleAfter.completedFrames===idleBefore.completedFrames&&idleAfter.submittedFrames===idleBefore.submittedFrames&&!idleAfter.state.pending&&!idleAfter.state.dirty&&!idleAfter.state.scheduled,{before:idleBefore,after:idleAfter});
 const requested=await page.evaluate(()=>window.__bureauArchitecture.requestRender());const explicit=await settle(requested);
 check('explicit render revision completes',explicit.state.completedRevision>=requested&&explicit.completedFrames>idleAfter.completedFrames,{requested,...explicit});
 check('six requested screenshots',receipt.views.filter(v=>v.screenshot).length===6);
 check('no browser errors',receipt.errors.length===0,receipt.errors);check('no missing files',receipt.requests.length===0,receipt.requests);
 check('context retained',await page.evaluate(()=>!window.__bureauArchitecture.contextLost&&!window.__bureauArchitecture.renderState().contextLost));
 receipt.functionalPass=receipt.tests.every(t=>t.pass);receipt.performancePass=receipt.performance.length===3&&receipt.performance.every(t=>t.pass);
 receipt.status=receipt.functionalPass?(receipt.performancePass?'passed':'functional-passed-performance-failed'):'failed';
 if(!receipt.functionalPass||!receipt.performancePass)process.exitCode=1;
}catch(e){receipt.status='blocked';receipt.errors.push(String(e));receipt.functionalPass=false;receipt.performancePass=receipt.performance.length===3&&receipt.performance.every(t=>t.pass);process.exitCode=1;}
finally{receipt.finished=new Date().toISOString();save();await browser?.close();if(server.listening)server.close();console.log(JSON.stringify(receipt,null,2));}})();
