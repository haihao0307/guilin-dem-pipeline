#!/usr/bin/env node
'use strict';
/**
 * Real-browser CI verification of our generated R07-host observation page.
 * Follows human-integrated-r07/verify.cjs: Playwright Chromium + SwiftShader.
 * This is a new isolated CI browser, never the user's connected browser.
 *
 * Default: startup -> real GPU/three actors -> panorama and hand-view evidence.
 * NPC_QA_PHASE=contact explicitly runs the three real UI pick/place tasks.
 * NPC_QA_PHASE=suite explicitly runs the workbench's six-test observation suite.
 * PREVIEW_URL selects a fixed deployed URL. Otherwise serve only PREVIEW_FILE
 * (default: this directory's preview.html) on an ephemeral loopback port.
 */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const VERSION = 'NPC-LIFE-OBSERVATION-R01';
const PHASE = process.env.NPC_QA_PHASE || 'startup';
assert(['startup','contact','suite'].includes(PHASE), 'NPC_QA_PHASE must be startup, contact, or suite');
const here = __dirname;
const input = path.resolve(process.env.PREVIEW_FILE || path.join(here,'preview.html'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const timeout = (name,fallback) => {
  const value = Number(process.env[name] || fallback);
  assert(Number.isFinite(value) && value > 0, 'Invalid timeout ' + name);
  return value;
};
const BOOT_MS = timeout('NPC_BOOT_TIMEOUT_MS',600000);
const TASK_MS = timeout('NPC_TASK_TIMEOUT_MS',180000);
const SUITE_MS = timeout('NPC_SUITE_TIMEOUT_MS',900000);
const run = process.env.GITHUB_RUN_ID ? process.env.GITHUB_RUN_ID + '-' + (process.env.GITHUB_RUN_ATTEMPT || '1') : new Date().toISOString().replace(/[:.]/g,'-');
const out = path.resolve(process.env.NPC_QA_OUT || process.env.QA_OUT || path.join(here,'qa','browser-' + PHASE + '-' + run));
fs.mkdirSync(out,{recursive:true});
const put = (name,value) => fs.writeFileSync(path.join(out,name),typeof value==='string' ? value : JSON.stringify(value,null,2)+'\n');
let sourceHead = process.env.SOURCE_HEAD || process.env.GITHUB_SHA || null;
if (!sourceHead) {try {sourceHead=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:here,encoding:'utf8'}).trim();} catch {}}
let build = null;
const buildPath = path.join(path.dirname(input),path.basename(input)==='standalone.html'?'BUILD.standalone.json':'BUILD.json');
if (fs.existsSync(buildPath)) build=JSON.parse(fs.readFileSync(buildPath,'utf8'));
const expectedSHA = process.env.NPC_EXPECT_SHA256 || build?.previewSHA256 || null;
const report = {
  schema:'kaopu/npc-browser-verification@1',version:VERSION,phase:PHASE,
  startedAt:new Date().toISOString(),sourceHead,build,expectedPreviewSHA256:expectedSHA,
  environment:{purpose:'repository candidate CI',runner:process.env.GITHUB_ACTIONS==='true'?'GitHub Actions':'isolated development test',
    headless:true,requestedRenderer:'SwiftShader',softwareRenderer:true,physicalPhone:false,userDevice:false,
    viewport:{width:1200,height:900},playwright:require('playwright/package.json').version},
  tests:[],pageErrors:[],consoleErrors:[],consoleWarnings:[],failedRequests:[],httpErrors:[],requests:[],screenshots:[],
  startupPassed:false,contactTestsRun:false,fullSuiteRun:false,completed:false,
  visualAcceptance:false,productionReady:false,publicURLVerified:false
};
let server,browser,context,page,cdp,heartbeat,heartbeatBusy=false,collecting=true;
const clip = value => String(value).slice(0,24000);

async function check(name,fn) {
  const started=Date.now();
  try {const result=await fn();assert.notEqual(result,false);report.tests.push({name,passed:true,elapsedMS:Date.now()-started,result});console.log('[qa] PASS '+name);return result;}
  catch(error) {report.tests.push({name,passed:false,elapsedMS:Date.now()-started,error:clip(error.stack||error)});throw error;}
}

async function bootState() {
  return page.evaluate(() => ({
    ready:!!window.__NPC_OBSERVATION__?.ready,
    state:document.documentElement.dataset.npcReady || null,
    progress:document.querySelector('#npc-progress')?.textContent || null,
    status:document.querySelector('#npc-status')?.textContent || null,
    headReady:!!window.__HEAD_PROC__?.ready,
    gpuVerified:!!window.__HEAD_PROC__?.gpuVerified,
    headErrors:window.__HEAD_PROC__?.errors || [],
    nativeReady:!!window.__LIP_P3__?.ready,
    startupFinalFrame:!!window.__IDENTITY_QA__?.viewer?.()?.startupFinalFrame,
    appErrors:window.__NPC_OBSERVATION__?.errors || [],
    browserFatal:window.__NPC_BROWSER_FATAL__ || []
  }));
}

async function pause(value) {
  const button=page.locator('#npc-pause');
  const current=/继续/.test(await button.textContent());
  if(current!==value) await button.click();
}

async function evidence(label,{nativeRigs=false}={}) {
  const captured=await page.evaluate(({nativeRigs}) => {
    const safe=fn=>{try{return fn();}catch(error){return{readError:String(error)};}};
    const qa=window.__IDENTITY_QA__,v=qa?.viewer?.(),model=qa?.model?.(),app=window.__NPC_OBSERVATION__;
    const actors=safe(()=>app?.actorDiagnostics?.() ?? app?.diagnostics?.()?.actors ?? null);
    const actorMeshes=[];
    v?.scene?.traverse(mesh=>{
      if(!mesh.isMesh || !/^NPC-[ABC]-R07-complete-native-person$/.test(mesh.name))return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      actorMeshes.push({name:mesh.name,uuid:mesh.uuid,visible:mesh.visible,parentVisible:mesh.parent?.visible,
        positionCount:mesh.geometry.attributes.position.count,triangles:mesh.geometry.index?.count/3,
        groups:mesh.geometry.groups,attributes:Object.keys(mesh.geometry.attributes),
        materials:materials.map(material=>({name:material.name,uuid:material.uuid,type:material.type,
          programID:v.renderer.properties.get(material).currentProgram?.id ?? null})),
        rootPosition:mesh.parent?.position.toArray(),rootQuaternion:mesh.parent?.quaternion.toArray()});
    });
    const result={
      version:app?.version,ready:app?.ready,build:window.__NPC_BUILD__ || window.__NPC_LIFE_BUILD__,
      snapshot:safe(()=>app?.snapshot?.()),performance:safe(()=>app?.performance?.()),
      verification:safe(()=>app?.verification?.()),actorDiagnostics:actors,actorMeshes,
      native:{stream:safe(()=>model?.r05Stream?.report?.() || window.__R05_STREAM__?.report?.()),
        state:nativeRigs?safe(()=>qa?.controller?.()?.state()):undefined,
        hostRig:nativeRigs?safe(()=>model?.lastBodyDriver?.rig):undefined,
        headStatus:window.__HEAD_PROC__,headSkin:safe(()=>window.headProceduralSkin?.report?.()),
        bodySkin:safe(()=>window.bodyProceduralSkin?.report?.()),
        headSource:window.__HEAD_PROC_SOURCE__,bodySource:window.__FULLBODY_SOURCE__,
        nativeVertexCount:model?.vertexCount,nativeBodyCount:model?.bodyCount,
        canonicalTopologySHA256:model?.canonical?.topologySha256},
      sameThreeRuntime:!!v?.mesh && v.mesh.constructor===window.__NPC_THREE__?.Mesh,
      embeddedAssets:window.__NPC_ASSETS__ || null,
      events:window.__NPC_BROWSER_EVENTS__ || [],
      errors:app?.errors || [],
      dom:{title:document.title,npcReady:document.documentElement.dataset.npcReady,
        npcQa:document.documentElement.dataset.npcQa,bodyText:document.body.innerText,
        canvasCount:document.querySelectorAll('canvas').length,
        canvas:v?.renderer?.domElement ? {width:v.renderer.domElement.width,height:v.renderer.domElement.height,
          rect:v.renderer.domElement.getBoundingClientRect().toJSON()} : null}
    };
    return JSON.parse(JSON.stringify(result,(key,value)=>{
      if(ArrayBuffer.isView(value))return Array.from(value);
      if(value instanceof Map)return [...value.entries()];
      if(value instanceof Set)return [...value];
      return value;
    }));
  },{nativeRigs});
  put(label+'.json',captured);
  if(nativeRigs) {
    put('BODY.json',{actors:captured.actorDiagnostics,meshes:captured.actorMeshes,snapshot:captured.snapshot});
    put('native-rigs.json',{sourceHead,version:VERSION,actors:captured.actorDiagnostics?.map?.(a=>({id:a.id,identity:a.identity,measurements:a.measurements,rig:a.rig || a.nativeRig || a.bindingRig})),hostRig:captured.native.hostRig});
    put('r05-stream.json',captured.native.stream || {});
    put('native-current-state.json',captured.native.state || {});
  }
  return captured;
}

async function gpuEvidence() {
  const gpu=await page.evaluate(async()=>{
    const viewer=window.__IDENTITY_QA__.viewer(),renderer=viewer.renderer,gl=renderer.getContext();
    viewer.render();
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const programs=(renderer.info.programs || []).map(program=>({
      id:program.id,name:program.name,linked:!!program.program && gl.getProgramParameter(program.program,gl.LINK_STATUS),
      log:program.program?gl.getProgramInfoLog(program.program):'missing native WebGL program',
      usedTimes:program.usedTimes
    }));
    const pixels=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
    gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let lo=255,hi=0,sum=0,sum2=0,count=0;
    for(let i=0;i<pixels.length;i+=16){const lum=(pixels[i]+pixels[i+1]+pixels[i+2])/3;lo=Math.min(lo,lum);hi=Math.max(hi,lum);sum+=lum;sum2+=lum*lum;count++;}
    const digest=await crypto.subtle.digest('SHA-256',pixels);
    return {available:!!gl,contextLost:gl.isContextLost(),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),
      unmaskedVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,
      unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
      version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      limits:{fragmentTextureUnits:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),vertexTextureUnits:gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),combinedTextureUnits:gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)},
      programs,memory:renderer.info.memory,render:renderer.info.render,pixelRatio:renderer.getPixelRatio(),
      framebuffer:{width:gl.drawingBufferWidth,height:gl.drawingBufferHeight,lo,hi,
        variance:count?sum2/count-(sum/count)**2:0,
        sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}};
  });
  put('gpu.json',gpu);
  return gpu;
}

async function screenshot(name) {
  await page.evaluate(async()=>{const v=window.__IDENTITY_QA__?.viewer?.();v?.render();await new Promise(resolve=>requestAnimationFrame(resolve));v?.render();});
  const shot=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const bytes=Buffer.from(shot.data,'base64'),file=name+'.png';
  fs.writeFileSync(path.join(out,file),bytes);
  report.screenshots.push({file,sha256:sha(bytes),bytes:bytes.length,url:page.url(),capturedAt:new Date().toISOString()});
  console.log('[qa] screenshot '+file+' ('+bytes.length+' bytes)');
}

async function saveDOM(name='body-dom') {
  const dom=await page.evaluate(()=>{
    const body=document.body.cloneNode(true);let scripts=0;
    for(const el of body.querySelectorAll('script')){scripts++;el.replaceWith(document.createComment('Inline script omitted from DOM evidence; complete source is SHA-bound in BUILD.json.'));}
    return {html:body.outerHTML,text:document.body.innerText,omittedScripts:scripts,title:document.title,url:location.href};
  });
  put(name+'.html',dom.html);put(name+'.txt',dom.text);return{title:dom.title,url:dom.url,omittedScripts:dom.omittedScripts};
}

function checkFeetAndBones(actors,stage) {
  assert.equal(actors?.length,3,'Three real actor diagnostics at '+stage);
  return actors.map(actor=>{
    const d=actor.diagnostics,feet=d?.footWorldYM;
    assert.equal(d?.finite,true,'Finite native pose '+actor.id+' / '+stage);
    assert(Number.isFinite(d.footSurfaceErrorM) && d.footSurfaceErrorM<=.00002,
      'Native foot surface drift exceeds 0.02 mm: '+actor.id+' / '+stage+' / '+d.footSurfaceErrorM);
    assert(Number.isFinite(d.boneLengthErrorM) && d.boneLengthErrorM<=1e-8,
      'Native bone length drift: '+actor.id+' / '+stage+' / '+d.boneLengthErrorM);
    assert(feet && Object.keys(feet).length===2,'Both actual foot surfaces exported: '+actor.id);
    for(const side of ['L','R'])assert(Number.isFinite(feet[side]) && Math.abs(feet[side])<=.003,
      'Foot is not on the shared floor within 3 mm: '+actor.id+' '+side+' / '+stage+' / '+feet[side]);
    return {id:actor.id,feet,footSurfaceErrorM:d.footSurfaceErrorM,boneLengthErrorM:d.boneLengthErrorM};
  });
}

async function mobileViewport() {
  await check('390 x 844 responsive viewport and reachable controls',async()=>{
    await pause(true);await page.setViewportSize({width:390,height:844});
    await page.click('[data-camera="all"]');
    await page.waitForFunction(()=>{
      const c=window.__IDENTITY_QA__?.viewer?.()?.renderer?.domElement,r=c?.getBoundingClientRect();
      return r && r.width>200 && r.width<=392 && r.height>200 && c.width>100 && c.height>100;
    },{},{timeout:30000,polling:100});
    await screenshot('mobile-390x844-panorama');
    const layout=await page.evaluate(()=>{
      const rect=selector=>document.querySelector(selector)?.getBoundingClientRect().toJSON();
      const panel=document.querySelector('#npc-app aside');
      return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,
        app:rect('#npc-app'),canvas:rect('#npc-view canvas'),panel:rect('#npc-app aside'),
        panelClientWidth:panel.clientWidth,panelScrollWidth:panel.scrollWidth,
        primaryControls:[...document.querySelectorAll('#npc-app button')].map(button=>({id:button.id,camera:button.dataset.camera,disabled:button.disabled}))};
    });
    put('mobile-layout.json',layout);
    assert.equal(layout.width,390);assert.equal(layout.height,844);
    assert(layout.documentWidth<=392,'No document horizontal overflow');
    assert(layout.app.width<=392 && layout.canvas.width<=392,'App and real canvas fit viewport');
    assert(layout.panelScrollWidth<=layout.panelClientWidth+2,'Control panel has no horizontal overflow');
    const primary=page.locator('#npc-plan');await primary.scrollIntoViewIfNeeded();
    const box=await primary.boundingBox();
    assert(box && box.x>=-1 && box.x+box.width<=391 && box.y>=0 && box.y+box.height<=845,'Identity-task control remains reachable in scrolling panel');
    assert.equal(await primary.isEnabled(),true);
    await screenshot('mobile-390x844-controls');
    await evidence('mobile-final');await saveDOM('mobile-dom');
    report.mobileViewport={tested:true,physicalPhone:false,width:390,height:844,layout};
    return report.mobileViewport;
  });
}

async function contactTests() {
  report.contactTestsRun=true;
  for(let i=0;i<3;i++) {
    const id=['A','B','C'][i];
    await check(id+' real native pick/place UI',async()=>{
      await pause(true);await page.click('[data-person="'+i+'"]');
      await page.click('[data-camera="contact"]');await page.click('#npc-pick');await pause(false);
      await page.waitForFunction(id=>{
        const s=window.__NPC_OBSERVATION__.snapshot(),a=s.agents.find(a=>a.id===id);
        return s.object.heldBy===id || ['done','failed','cancelled'].includes(a?.phase) || window.__NPC_OBSERVATION__.errors.length;
      },id,{timeout:TASK_MS,polling:100});
      await pause(true);
      const grip=await evidence('contact-'+id);
      await screenshot('contact-'+id);
      const agent=grip.snapshot.agents.find(a=>a.id===id);
      const feet=checkFeetAndBones(grip.actorDiagnostics,'contact-'+id);
      const hand=grip.actorDiagnostics.find(actor=>actor.id===id)?.diagnostics;
      assert.equal(grip.errors.length,0,'No runtime exception');
      assert.equal(grip.snapshot.object.heldBy,id,'The real shared object is held by the selected actor');
      assert.equal(grip.snapshot.object.constraintCount,1,'One actual physical grip constraint');
      assert(Number.isFinite(agent.contactErrorM) && agent.contactErrorM<.025,'Rendered hand contact error below 25 mm');
      assert(Number.isInteger(hand?.handTableSampleCount) && hand.handTableSampleCount>=0,'Actual table-projected hand vertices are measured');
      // Only the holding actor's hand vertices whose XZ projection lies inside
      // the real tabletop are gated. Low idle hands beside a table are valid.
      if(hand.handTableSampleCount>0)assert(Number.isFinite(hand.handTableClearanceM) && hand.handTableClearanceM>=-.003,
        'Held hand penetrates the actual tabletop by more than 3 mm: '+id+' / '+hand.handTableClearanceM);
      assert(hand.bottleSampleCount>0 && Number.isFinite(hand.bottleMaxPenetrationM),'Actual finite-cylinder hand geometry was measured');
      const bottleGeometry={measured:true,accepted:null,definition:hand.geometricDiagnosticScope,
        maxPenetrationM:hand.bottleMaxPenetrationM,minimumSignedDistanceM:hand.bottleMinimumSignedDistanceM,
        penetratingVertexCount:hand.bottlePenetratingVertexCount,sampleCount:hand.bottleSampleCount,
        fingerSignedDistanceM:hand.fingerBottleSignedDistanceM,deepestPointWorld:hand.bottleDeepestPointWorld};
      put('bottle-geometry-'+id+'.json',bottleGeometry);
      await pause(false);
      await page.waitForFunction(id=>{
        const app=window.__NPC_OBSERVATION__,a=app.snapshot().agents.find(a=>a.id===id);
        return ['done','failed','cancelled'].includes(a?.phase) || app.errors.length;
      },id,{timeout:TASK_MS,polling:100});
      await pause(true);
      const final=await evidence('placed-'+id);
      const result=final.snapshot.agents.find(a=>a.id===id).result;
      const finalFeet=checkFeetAndBones(final.actorDiagnostics,'placed-'+id);
      assert.equal(result?.result,'completed','World result must confirm placement');
      assert.equal(final.snapshot.object.heldBy,null);assert.equal(final.snapshot.object.constraintCount,0);
      assert(final.snapshot.object.insideTarget && final.snapshot.object.supported && final.snapshot.object.settled,'Object actually released and stable on support');
      return {contactErrorM:agent.contactErrorM,result,object:final.snapshot.object,feet,finalFeet,
        handDiagnostics:hand,bottleGeometry};
    });
  }
}

async function fullSuite() {
  report.fullSuiteRun=true;
  await check('built-in six-test observation suite',async()=>{
    await page.click('#npc-run-qa');
    await page.waitForFunction(()=>window.__NPC_OBSERVATION__.verification()?.completed || window.__NPC_OBSERVATION__.errors.length,{},{timeout:SUITE_MS,polling:250});
    await pause(true);
    const result=await evidence('suite-final');put('suite.json',result.verification || {});
    checkFeetAndBones(result.actorDiagnostics,'suite-final');
    await page.click('[data-camera="all"]');await screenshot('suite-final');
    assert.equal(result.errors.length,0);assert.equal(result.verification?.completed,true);
    assert.equal(result.verification.tests.length,6);assert.equal(result.verification.passed,true);
    assert(result.verification.tests.every(test=>test.pass===true),'All six tests must report their measured pass result');
    return result.verification;
  });
}

async function main() {
  console.log('[qa] '+VERSION+' / '+PHASE+' / evidence '+out);
  assert.equal(report.environment.playwright,'1.58.2','CI verifier pins Playwright 1.58.2');
  if(process.env.PREVIEW_URL) {
    report.url=process.env.PREVIEW_URL;const address=new URL(report.url);
    report.deliveryMode=address.protocol==='file:'?'file-protocol':(['localhost','127.0.0.1','[::1]','0.0.0.0'].includes(address.hostname)?'local-candidate-url':'deployed-url');
  }
  else if(process.env.NPC_QA_FILE_PROTOCOL==='1') {report.url=pathToFileURL(input).href;report.deliveryMode='file-protocol';}
  else {
    const bytes=fs.readFileSync(input);report.localPreviewSHA256=sha(bytes);
    server=http.createServer((request,response)=>{
      const route=new URL(request.url,'http://127.0.0.1').pathname;
      if(route==='/' || route==='/index.html') {response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store'});response.end(bytes);}
      else if(route==='/favicon.ico') {response.writeHead(204);response.end();}
      else {response.writeHead(404,{'Content-Type':'text/plain'});response.end('No candidate resource at this path');}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    report.url='http://127.0.0.1:'+server.address().port+'/';report.deliveryMode='local-candidate-http';
  }
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  report.environment.chromium=browser.version();
  context=await browser.newContext({viewport:report.environment.viewport,deviceScaleFactor:1});
  await context.addInitScript(()=>{
    window.__NPC_BROWSER_EVENTS__=[];
    window.__NPC_BROWSER_FATAL__=[];
    window.addEventListener('error',event=>{if(event.message)window.__NPC_BROWSER_FATAL__.push({type:'error',message:event.message,file:event.filename,line:event.lineno,column:event.colno,at:performance.now()});});
    window.addEventListener('unhandledrejection',event=>window.__NPC_BROWSER_FATAL__.push({type:'unhandledrejection',message:String(event.reason?.stack||event.reason),at:performance.now()}));
    document.addEventListener('webglcontextlost',event=>window.__NPC_BROWSER_EVENTS__.push({type:'webglcontextlost',at:performance.now(),target:event.target?.id||null}),true);
    document.addEventListener('webglcontextrestored',event=>window.__NPC_BROWSER_EVENTS__.push({type:'webglcontextrestored',at:performance.now(),target:event.target?.id||null}),true);
  });
  page=await context.newPage();page.setDefaultTimeout(30000);cdp=await context.newCDPSession(page);
  page.on('pageerror',error=>{if(collecting)report.pageErrors.push({at:new Date().toISOString(),error:clip(error.stack||error)});});
  page.on('console',message=>{
    if(!collecting)return;
    const value={at:new Date().toISOString(),text:clip(message.text()),location:message.location()};
    if(message.type()==='error')report.consoleErrors.push(value);
    if(message.type()==='warning' && report.consoleWarnings.length<300)report.consoleWarnings.push(value);
  });
  page.on('request',request=>{if(collecting)report.requests.push({url:request.url(),type:request.resourceType(),method:request.method()});});
  page.on('requestfailed',request=>{if(collecting)report.failedRequests.push({url:request.url(),type:request.resourceType(),failure:request.failure()});});
  page.on('response',response=>{if(collecting && response.status()>=400)report.httpErrors.push({url:response.url(),status:response.status()});});
  const start=Date.now();
  heartbeat=setInterval(async()=>{
    if(heartbeatBusy || !page || page.isClosed())return;heartbeatBusy=true;
    try {const state=await bootState();console.log('[qa] progress '+JSON.stringify(state));report.lastBootState=state;}catch(error){console.log('[qa] progress unavailable '+clip(error.message));}finally{heartbeatBusy=false;}
  },30000);
  await check('candidate response and freshness',async()=>{
    const response=await page.goto(report.url,{waitUntil:'domcontentloaded',timeout:120000});
    report.finalURL=page.url();report.navigationStatus=response?.status() || null;
    if(report.deliveryMode!=='file-protocol')assert.equal(response?.status(),200,'Candidate HTML must respond HTTP 200');
    if(response)report.observedPreviewSHA256=sha(await response.body());
    else if(report.deliveryMode==='file-protocol')report.observedPreviewSHA256=sha(fs.readFileSync(input));
    assert(expectedSHA,'Expected preview SHA is required for current-source verification');
    assert.equal(report.observedPreviewSHA256,expectedSHA,'Browser loaded the exact current build');
    return {url:report.finalURL,status:report.navigationStatus,sha256:report.observedPreviewSHA256};
  });
  await check('complete original R07 and all three actors ready',async()=>{
    assert.equal(report.pageErrors.length,0,'Page failed before native startup: '+JSON.stringify(report.pageErrors));
    await page.waitForFunction(()=>!!window.__NPC_OBSERVATION__?.ready || document.documentElement.dataset.npcReady==='failed' || !!window.__HEAD_PROC__?.errors?.length || !!window.__NPC_BROWSER_FATAL__?.length,{},{timeout:BOOT_MS,polling:250});
    report.coldReadyMS=Date.now()-start;report.lastBootState=await bootState();
    assert.equal(report.lastBootState.browserFatal.length,0,'Browser failed during native startup: '+JSON.stringify(report.lastBootState.browserFatal));
    assert.equal(report.lastBootState.state,'true',JSON.stringify(report.lastBootState));
    assert.equal(report.lastBootState.ready,true);assert.equal(report.lastBootState.gpuVerified,true);
    assert.equal(report.lastBootState.headErrors.length,0);assert.equal(report.lastBootState.appErrors.length,0);
    await pause(true);
    const initial=await evidence('initial',{nativeRigs:true});
    assert.equal(initial.version,VERSION);assert.equal(initial.build.canonicalVersion,'HUMAN-INTEGRATED-R07');
    assert.equal(initial.build.canonicalSHA256,'d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a');
    assert.equal(initial.sameThreeRuntime,true);assert.equal(initial.actorMeshes.length,3);
    assert.equal(initial.snapshot.agents.length,3);assert.equal(initial.actorDiagnostics?.length,3,'Read-only actorDiagnostics must export all native actors');
    assert.equal(new Set(initial.snapshot.agents.map(a=>a.identity.presetId)).size,3,'Three distinct native forms');
    for(const actor of initial.snapshot.agents) {
      assert.equal(actor.binding.nativeBones,104);assert.equal(actor.binding.weightsTruncated,false);
      assert.equal(actor.binding.r07MaterialGroups,2);assert.equal(actor.binding.originalAttributesRetained,true);
      assert(actor.binding.displayVertices>=actor.binding.nativeVertices);
    }
    for(const actor of initial.actorDiagnostics) {
      const rig=actor.rig || actor.nativeRig || actor.bindingRig;
      assert.equal(rig?.names?.length,104,'Raw 104-bone rig exported for '+actor.id);
      assert.equal(rig?.parents?.length,104);assert.equal(rig?.restMatrices?.length,104);
    }
    report.initialFeetAndBones=checkFeetAndBones(initial.actorDiagnostics,'initial');
    assert(initial.native.stream.residentPackets.includes('hot'));
    report.residentPackets=initial.native.stream.residentPackets;
    return {coldReadyMS:report.coldReadyMS,actors:initial.snapshot.agents.map(a=>({id:a.id,identity:a.identity,measurements:a.measurements,binding:a.binding})),residentPackets:report.residentPackets};
  });
  await page.click('[data-camera="all"]');
  await check('real linked WebGL programs and visible framebuffer',async()=>{
    const gpu=await gpuEvidence();report.gpu=gpu;
    assert(gpu.available && !gpu.contextLost);assert(gpu.programs.length>0);
    assert(gpu.programs.every(program=>program.linked),'Every actual material program must link');
    assert(gpu.framebuffer.width>100 && gpu.framebuffer.height>100);
    assert(gpu.framebuffer.hi-gpu.framebuffer.lo>30 && gpu.framebuffer.variance>1,'Rendered framebuffer must not be blank');
    report.environment.observedRenderer=gpu.unmaskedRenderer || gpu.renderer;
    return gpu;
  });
  await screenshot('01-panorama');
  await page.click('[data-camera="contact"]');await screenshot('02-hand-view');
  await evidence('hand-view');report.dom=await saveDOM();
  report.startupPassed=true;
  if(PHASE==='contact' || PHASE==='suite')await contactTests();
  if(PHASE==='suite'){await fullSuite();await mobileViewport();}
  const final=await evidence('final');
  await check('no page, resource, application or WebGL errors',async()=>{
    assert.equal(report.pageErrors.length,0);assert.equal(report.consoleErrors.length,0);
    assert.equal(report.failedRequests.length,0);assert.equal(report.httpErrors.length,0);
    assert.equal(final.errors.length,0);assert(!final.events.some(event=>event.type==='webglcontextlost'));
    if(report.deliveryMode==='file-protocol') {
      assert.equal(final.embeddedAssets?.mode,'embedded');assert.equal(final.embeddedAssets.missing.length,0);
      const network=report.requests.filter(request=>/^https?:/.test(request.url));assert.equal(network.length,0,'Standalone core performs no network requests');
    }
    return {pageErrors:0,consoleErrors:0,failedRequests:0,httpErrors:0,appErrors:0};
  });
  report.completed=true;report.status=PHASE.toUpperCase()+'_PASSED';
  report.publicURLVerified=report.deliveryMode==='deployed-url';
  report.fullProgrammaticAcceptance=PHASE==='suite';
}

main().catch(async error=>{
  report.completed=false;report.status='FAILED';report.failure=clip(error.stack||error);process.exitCode=1;
  console.error('[qa] FAILED '+report.failure);
  if(page && !page.isClosed()) {
    try {report.failureState=await bootState();}catch{}
    try {await evidence('failure',{nativeRigs:true});}catch(error){report.failureEvidenceError=clip(error.message);}
    try {await saveDOM('failure-dom');}catch{}
    try {const result=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});const bytes=Buffer.from(result.data,'base64');fs.writeFileSync(path.join(out,'failure.png'),bytes);report.screenshots.push({file:'failure.png',sha256:sha(bytes),bytes:bytes.length});}catch{}
  }
}).finally(async()=>{
  clearInterval(heartbeat);report.finishedAt=new Date().toISOString();
  put('network.json',{requests:report.requests,failedRequests:report.failedRequests,httpErrors:report.httpErrors});
  put('errors.json',{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors,consoleWarnings:report.consoleWarnings,failure:report.failure});
  put('qa.json',report);collecting=false;
  console.log(JSON.stringify({status:report.status,phase:PHASE,completed:report.completed,startupPassed:report.startupPassed,fullSuiteRun:report.fullSuiteRun,sourceHead,output:out,residentPackets:report.residentPackets,failure:report.failure},null,2));
  try {await browser?.close();}catch{}
  if(server)await new Promise(resolve=>server.close(resolve));
});
