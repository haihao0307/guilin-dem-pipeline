#!/usr/bin/env node
'use strict';
/**
 * Independent, real CI Chromium verification of the living courtyard.
 * It operates visible UI controls and reads the displayed diagnostics JSON.
 * It never sets needs, tasks, body transforms, success flags or receipts through
 * an injected app API. The only app API it calls is the real GPU-frame waiter.
 *
 * NPC_QA_PHASE=startup : exact-source boot, complete native people/materials,
 *                       all/near/person A/person B/390 x 844 screenshots.
 * NPC_QA_PHASE=suite   : startup + actual autonomous food chain, seated B,
 *                       real UI interruption/shop closure/rain observations.
 * NPC_QA_PHASE=public  : exact fixed PREVIEW_URL + startup + autonomous chain.
 * NPC_QA_PHASE=offline : actual file:// navigation with networking disabled,
 *                       startup + autonomous chain + zero sidecar resources.
 *
 * Default document: dist/index.html. BUILD.json is in this project root.
 * All dist resources are served from the same origin, including native packets.
 * A hard 15-minute driver limit includes bounded failure capture and cleanup.
 * Screenshots are evidence for human review; visualAcceptance remains false.
 */
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

const VERSION='NPC-LIVING-COURTYARD-R01';
const CANONICAL_SHA='d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const PHASE=process.env.NPC_QA_PHASE||'startup';
assert(['startup','suite','public','offline'].includes(PHASE),'NPC_QA_PHASE must be startup, suite, public or offline');
const here=__dirname,input=path.resolve(process.env.PREVIEW_FILE||path.join(here,'dist/index.html'));
const staticRoot=path.resolve(process.env.NPC_STATIC_ROOT||path.dirname(input));
const run=process.env.GITHUB_RUN_ID?process.env.GITHUB_RUN_ID+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1'):new Date().toISOString().replace(/[:.]/g,'-');
const out=path.resolve(process.env.NPC_QA_OUT||process.env.QA_OUT||path.join(here,'qa','browser-'+PHASE+'-'+run));
fs.mkdirSync(out,{recursive:true});
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const clip=(s,n=16000)=>String(s).slice(0,n);
const duration=(name,fallback)=>{const value=Number(process.env[name]||fallback);assert(Number.isFinite(value)&&value>0,'Invalid '+name);return value;};
const TOTAL_MS=Math.min(900000,duration('NPC_TOTAL_TIMEOUT_MS',900000));
const BOOT_MS=duration('NPC_BOOT_TIMEOUT_MS',420000);
const BOOT_READ_MS=Math.min(120000,BOOT_MS);
const FRAME_MS=duration('NPC_FRAME_TIMEOUT_MS',150000);
const CAPTURE_MS=duration('NPC_CAPTURE_TIMEOUT_MS',60000);
const CHAIN_MS=duration('NPC_CHAIN_TIMEOUT_MS',300000);
const PROBE_MS=duration('NPC_PROBE_TIMEOUT_MS',60000);
const FAILURE_MS=45000,CLOSE_MS=10000,started=Date.now();
const activeDeadline=started+TOTAL_MS-FAILURE_MS-CLOSE_MS-5000;
const put=(name,value)=>{const target=path.join(out,name),tmp=target+'.tmp';fs.writeFileSync(tmp,typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');fs.renameSync(tmp,target);};
let sourceHead=process.env.SOURCE_HEAD||process.env.GITHUB_SHA||null;
if(!sourceHead){try{sourceHead=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:here,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{}}
let browser,context,page,cdp,server,checkpointTimer,watchdog,operationId=0,failureMode=false,closing=false,lastDOM=null;
const report={schema:'kaopu/living-courtyard-browser-verification@1',version:VERSION,phase:PHASE,sourceHead,
  startedAt:new Date(started).toISOString(),status:'RUNNING',stage:'created',completed:false,
  sourceGate:{passed:false},startupPassed:false,autonomousChainPassed:false,fullSuiteRun:false,fullSuitePassed:false,
  publicURLVerified:false,offlineVerified:false,visualAcceptance:false,productionReady:false,
  offline:{requested:PHASE==='offline',networkDisabledBeforeNavigation:false,serviceWorkersBlocked:false,blockedRequests:[]},
  environment:{runner:process.env.GITHUB_ACTIONS==='true'?'GitHub Actions isolated Chromium':'isolated development Chromium',
    userDevice:false,physicalPhone:false,headless:true,softwareRenderer:true,requestedRenderer:'SwiftShader',
    viewport:{width:1360,height:900},playwright:require('playwright/package.json').version},
  deadlines:{totalMS:TOTAL_MS,bootMS:BOOT_MS,bootReadMS:BOOT_READ_MS,frameMS:FRAME_MS,captureMS:CAPTURE_MS,chainMS:CHAIN_MS,
    probeMS:PROBE_MS,failureMS:FAILURE_MS,closeMS:CLOSE_MS},
  tests:[],screenshots:[],observations:[],pageErrors:[],consoleErrors:[],consoleWarnings:[],failedRequests:[],httpErrors:[],requests:[],
  operations:[],activeOperations:{},progress:[],failureDiagnostics:[],evidenceWriteErrors:[]};

function checkpoint(reason) {
  report.lastCheckpoint={reason,at:new Date().toISOString(),stage:report.stage,elapsedMS:Date.now()-started};
  for(const [name,value]of Object.entries({'qa.json':report,'checkpoint.json':{...report.lastCheckpoint,status:report.status,
    sourceGate:report.sourceGate,startupPassed:report.startupPassed,autonomousChainPassed:report.autonomousChainPassed,
    fullSuitePassed:report.fullSuitePassed,screenshots:report.screenshots.length,lastObservation:report.observations.at(-1),
    failure:report.failure,activeOperations:report.activeOperations},'errors.json':{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors,
    consoleWarnings:report.consoleWarnings,failedRequests:report.failedRequests,httpErrors:report.httpErrors,failure:report.failure},
    'network.json':{requests:report.requests,failedRequests:report.failedRequests,httpErrors:report.httpErrors}})) {
    try{put(name,value);}catch(error){report.evidenceWriteErrors.push({file:name,message:clip(error.message,2000)});}
  }
}
function log(message,detail) {
  const row={at:new Date().toISOString(),stage:report.stage,message,...(detail===undefined?{}:{detail})};
  report.progress.push(row);try{fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(row)+'\n');}catch{}
  checkpoint(message);console.log('[courtyard-qa] '+message+(detail===undefined?'':' '+JSON.stringify(detail)));
}
function stage(name){report.stage=name;log('stage '+name);}
async function bounded(label,fn,budget=PROBE_MS) {
  const available=failureMode||closing?budget:Math.min(budget,activeDeadline-Date.now());
  if(available<=0)throw Error('Overall active verification deadline exhausted before '+label);
  const id=String(++operationId),start=Date.now(),operation={id,label,budgetMS:available,startedAt:new Date(start).toISOString()};
  report.activeOperations[id]=operation;checkpoint('operation start '+label);let timer,outcome='passed',errorText;
  try{return await Promise.race([Promise.resolve().then(fn),new Promise((resolve,reject)=>{timer=setTimeout(()=>{
    const error=Error('Driver deadline exceeded after '+available+' ms: '+label);error.code='DRIVER_TIMEOUT';reject(error);
  },available);})]);}
  catch(error){outcome=error.code==='DRIVER_TIMEOUT'?'timeout':'failed';errorText=clip(error.stack||error);throw error;}
  finally{clearTimeout(timer);delete report.activeOperations[id];report.operations.push({...operation,elapsedMS:Date.now()-start,outcome,error:errorText});checkpoint('operation '+outcome+' '+label);}
}
const evaluate=(label,fn,arg,budget=PROBE_MS)=>bounded(label,()=>page.evaluate(fn,arg),budget);
const click=selector=>bounded('UI click '+selector,()=>page.locator(selector).click({timeout:15000}));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function check(name,fn) {
  stage(name);const start=Date.now();
  try{const result=await fn();assert.notEqual(result,false);report.tests.push({name,passed:true,elapsedMS:Date.now()-start,result});log('PASS '+name);return result;}
  catch(error){report.tests.push({name,passed:false,elapsedMS:Date.now()-start,error:clip(error.stack||error)});log('FAIL '+name,{message:clip(error.message)});throw error;}
}

function requestRecord(request) {
  const url=request.url();
  // The actual PNG bytes are independently checked from the rendered material.
  // Keep inline payloads out of every repeating request-log checkpoint.
  return{url:url.startsWith('data:')?url.slice(0,url.indexOf(',')+1)+'[inline payload omitted]':url,
    ...(url.startsWith('data:')?{inlineURLSHA256:sha(url),inlineURLCharacters:url.length}:{}),
    type:request.resourceType(),method:request.method()};
}

function assertResourceScope() {
  const origin=new URL(report.url).origin;
  const unexpected=report.requests.filter(request=>{
    const url=new URL(request.url);
    if(['data:','blob:'].includes(url.protocol))return false;
    if(PHASE==='offline')return request.url!==report.url||request.type!=='document';
    return !['http:','https:'].includes(url.protocol)||url.origin!==origin;
  });
  assert.equal(unexpected.length,0,'All runtime resources are embedded or belong to the exact delivered origin: '+JSON.stringify(unexpected));
  if(PHASE==='offline'){
    assert.equal(report.offline.networkDisabledBeforeNavigation,true);
    assert.equal(report.offline.serviceWorkersBlocked,true);
    assert.equal(report.offline.blockedRequests.length,0,'No attempted external requests in offline file operation');
  }
  return{unexpectedResources:unexpected,requestCount:report.requests.length,
    externalNetworkRequests:report.requests.filter(r=>/^https?:/.test(r.url)).length,
    sidecarFileRequests:report.requests.filter(r=>r.url.startsWith('file:')&&r.url!==report.url).length};
}

async function ensureDataPanel() {
  const open=await bounded('read observation panel toggle',()=>page.locator('#data-toggle').getAttribute('aria-expanded'));
  if(open!=='true')await click('#data-toggle');
  const expanded=await bounded('read diagnostics details disclosure',()=>page.locator('#data-panel details').getAttribute('open'));
  if(expanded===null)await click('#data-panel details summary');
  const separation=await evaluate('read actual observation panel and playback separation',()=>{
    const panel=document.querySelector('#data-panel').getBoundingClientRect(),controls=document.querySelector('.playback').getBoundingClientRect();
    return{panelBottom:panel.bottom,controlsTop:controls.top,gap:controls.top-panel.bottom};
  });
  assert(separation.gap>=8,'Observation panel leaves the real playback controls unobstructed');
}
async function hideDataPanel() {
  if(await bounded('read observation panel visibility',()=>page.locator('#data-toggle').getAttribute('aria-expanded'))==='true')await click('#data-close');
}
async function pause(value) {
  const label=await bounded('read pause control',()=>page.locator('#pause').getAttribute('aria-label'));
  const isPaused=/继续/.test(label||'');if(isPaused!==value)await click('#pause');
}
async function readState(label,{save=false,budget=PROBE_MS}={}) {
  const text=await bounded('read displayed diagnostics '+label,()=>page.locator('#life-diagnostics').textContent({timeout:budget}),budget);
  assert(text&&text.trim().startsWith('{'),'Visible diagnostics JSON is present: '+label);
  const state=JSON.parse(text);lastDOM=state;
  if(save)put(label+'.json',{source:'visible #life-diagnostics DOM text after opening the UI observation panel',capturedAt:new Date().toISOString(),state});
  return state;
}
function assertHealthy(state) {
  assertResourceScope();
  assert.equal(state.ready,true,'Page reports native ready');
  assert.equal(state.errors?.length,0,'No application errors: '+JSON.stringify(state.errors));
  assert.equal(state.assets?.missing?.length,0,'No missing native runtime assets');
  assert.equal(state.assets?.failed?.length,0,'No native chunk delivery or integrity failures');
  if(state.assets?.mode==='same-origin-native-packets'){
    assert.equal(state.assets.completed.length,state.assets.served.length,'Every native HTTP body was fully read and SHA256-verified before delivery');
    assert(state.assets.completed.every(c=>c.networkBodyFullyRead&&c.bytes>0&&/^[a-f0-9]{64}$/.test(c.sha256)));
  }
  assert.equal(state.simulation?.invariants?.ok,true,'World ownership/currency invariants hold');
  assert.equal(report.pageErrors.length,0,'No browser page errors');
  assert.equal(report.consoleErrors.length,0,'No browser console errors');
  assert.equal(report.failedRequests.length,0,'No failed native or application requests');
  assert.equal(report.httpErrors.length,0,'No failed HTTP resources');
  for(const [id,m]of Object.entries(state.motions||{})) {
    assert.equal(m.finite,true,'Finite native pose '+id);
    assert(Number.isFinite(m.boneLengthErrorM)&&m.boneLengthErrorM<=1e-5,'Preserved native bone lengths '+id);
  }
}
function observe(state,label='poll') {
  const row={label,at:new Date().toISOString(),time:state.time,paused:state.paused,speed:state.speed,
    actors:state.simulation.actors.map(a=>({id:a.id,x:a.x,z:a.z,pose:a.pose,money:a.money,inventory:a.inventory,counters:a.counters,
      task:a.task&&{token:a.task.token,kind:a.task.kind,phase:a.task.phase,progress:a.task.progress,targetId:a.task.targetId},reason:a.reason})),
    actions:state.items?.actions?.map(a=>({actorId:a.actorId,token:a.token,kind:a.kind,stage:a.stage,progress:a.progress,grasped:a.grasped,failure:a.failure})),
    shop:state.simulation.shop,raining:state.simulation.raining,auditCount:state.audit?.interactions?.length,
    nativeAssetMissing:state.assets?.missing?.length,errors:state.errors};
  report.observations.push(row);if(report.observations.length>1200)report.observations.shift();
  fs.appendFileSync(path.join(out,'observations.jsonl'),JSON.stringify(row)+'\n');
  if(state.audit?.interactions)put('latest-interactions.json',state.audit.interactions);
  checkpoint('observation '+label);return row;
}
async function waitState(label,predicate,{timeout=45000,poll=350,onState=null}={}) {
  const until=Math.min(Date.now()+timeout,activeDeadline);let state;
  while(Date.now()<until) {
    state=await readState(label);assertHealthy(state);if(onState)await onState(state);
    if(predicate(state)){observe(state,label);return state;}
    await delay(Math.min(poll,Math.max(0,until-Date.now())));
  }
  if(state)put('timeout-'+label.replace(/[^a-zA-Z0-9_-]/g,'-')+'.json',state);
  throw Error('Timed out observing real UI state: '+label);
}

async function readBoot(budget=PROBE_MS) {
  return evaluate('read boot DOM',()=>({npcReady:document.documentElement.dataset.npcReady||null,
    progress:document.querySelector('#load-progress')?.textContent||null,
    status:document.querySelector('#run-state')?.textContent||null,
    loaderHidden:document.querySelector('#life-loader')?.hidden,
    runtimeReady:!!window.__LIVING_COURTYARD__?.ready,headReady:!!window.__HEAD_PROC__?.ready,
    headGPUVerified:!!window.__HEAD_PROC__?.gpuVerified,headErrors:window.__HEAD_PROC__?.errors||[],
    errors:window.__NPC_VERIFY_EVENTS__||[],startup:window.__NPC_STARTUP__||null,title:document.title}),undefined,budget);
}
async function saveDOM(label,budget=PROBE_MS) {
  const dom=await evaluate('save DOM '+label,()=>{const body=document.body.cloneNode(true);let omitted=0;
    for(const script of body.querySelectorAll('script')){script.replaceWith(document.createComment('Exact script source is bound by BUILD.json; omitted from DOM evidence.'));omitted++;}
    return {html:body.outerHTML,text:document.body.innerText,title:document.title,url:location.href,omittedScripts:omitted};
  },undefined,budget);put(label+'.html',dom.html);put(label+'.txt',dom.text);return{title:dom.title,url:dom.url,omittedScripts:dom.omittedScripts};
}

async function screenshot(name) {
  await hideDataPanel();
  if(page.viewportSize().width>800)await bounded('show journal heading before screenshot '+name,
    ()=>page.locator('#life-app .brand').scrollIntoViewIfNeeded({timeout:15000}));
  const frame=await evaluate('wait for completed native GPU frame '+name,async()=>{
    const app=window.__LIVING_COURTYARD__,viewer=window.__IDENTITY_QA__?.viewer?.();
    if(!app?.awaitFrame||!viewer?.renderer)throw Error('Actual native frame waiter is unavailable');
    const before=performance.now(),completed=await app.awaitFrame({fresh:true}),canvas=viewer.renderer.domElement;
    if(!completed.startupDrain?.completed||completed.inFlight!==0||completed.submitted!==completed.completed||completed.maxInFlight>1)
      throw Error('Screenshot does not have a completed, bounded native GPU frame');
    return{completed,waitMS:performance.now()-before,canvas:{width:canvas.width,height:canvas.height,rect:canvas.getBoundingClientRect().toJSON()},
      renderFrame:viewer.renderer.info.render.frame,triangles:viewer.renderer.info.render.triangles};
  },undefined,FRAME_MS);
  const shot=await bounded('capture real screenshot '+name,()=>cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),CAPTURE_MS);
  const bytes=Buffer.from(shot.data,'base64'),file=name+'.png';fs.writeFileSync(path.join(out,file),bytes);
  assert(bytes.length>15000,'Actual rendered screenshot must contain nontrivial image data');
  const record={file,sha256:sha(bytes),bytes:bytes.length,at:new Date().toISOString(),url:page.url(),frame,
    source:'actual isolated Chromium compositor screenshot',visualAcceptance:false};
  report.screenshots.push(record);put(name+'-frame.json',record);checkpoint('screenshot '+file);
  await ensureDataPanel();await readState(name+'-state',{save:true});return record;
}

async function nativeRenderEvidence() {
  const evidence=await evaluate('read actual scene meshes and linked native materials',()=>{
    const viewer=window.__IDENTITY_QA__?.viewer?.(),renderer=viewer?.renderer,gl=renderer?.getContext();
    if(!viewer||!renderer||!gl)throw Error('Actual native viewer missing');
    const meshes=[],faceTextureImages=[],imageIDs=new Map();
    const textureEvidence=texture=>{
      if(!texture?.isTexture)return null;
      const image=texture.image,src=image?.currentSrc||image?.src||null;let imageIndex=null;
      if(src){
        if(!imageIDs.has(src)){imageIDs.set(src,faceTextureImages.length);faceTextureImages.push({src,
          complete:image.complete,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight});}
        imageIndex=imageIDs.get(src);
      }
      const gpuTexture=renderer.properties.get(texture).__webglTexture;
      return{uuid:texture.uuid,imageIndex,colorSpace:texture.colorSpace,flipY:texture.flipY,
        wrapS:texture.wrapS,wrapT:texture.wrapT,generateMipmaps:texture.generateMipmaps,
        minFilter:texture.minFilter,magFilter:texture.magFilter,
        gpuTextureAllocated:!!gpuTexture&&gl.isTexture(gpuTexture)};
    };
    viewer.scene.traverse(mesh=>{
      if(!mesh.isMesh||!/^NPC-[AB]-R07-complete-native-person$/.test(mesh.name))return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      meshes.push({name:mesh.name,uuid:mesh.uuid,visible:mesh.visible,parentVisible:mesh.parent?.visible,
        positionCount:mesh.geometry.attributes.position.count,triangles:mesh.geometry.index?.count/3,
        groups:mesh.geometry.groups,attributes:Object.keys(mesh.geometry.attributes),
        rootPosition:mesh.parent?.position.toArray(),rootQuaternion:mesh.parent?.quaternion.toArray(),
        materials:materials.map(m=>{const properties=renderer.properties.get(m),p=properties.currentProgram;return{name:m.name,uuid:m.uuid,type:m.type,
          programID:p?.id??null,linked:!!p?.program&&gl.getProgramParameter(p.program,gl.LINK_STATUS),
          faceTextures:Object.fromEntries(['uFAtlas','uFChroma'].map(name=>[name,textureEvidence(properties.uniforms?.[name]?.value)])),
          log:p?.program?gl.getProgramInfoLog(p.program):'missing GPU program'};})});
    });
    const lights=[];viewer.scene.traverse(light=>{if(!light.isLight)return;let effectiveVisible=true;
      for(let node=light;node;node=node.parent)if(!node.visible)effectiveVisible=false;
      lights.push({name:light.name,type:light.type,intensity:light.intensity,color:light.color?.getHexString(),
        visible:light.visible,effectiveVisible,parent:light.parent?.name,position:light.position.toArray()});});
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    return{sameThreeRuntime:viewer.mesh?.constructor===window.__NPC_THREE__?.Mesh,
      meshes,faceTextureImages,nativeTextureConstants:{NoColorSpace:window.__NPC_THREE__.NoColorSpace,
        ClampToEdgeWrapping:window.__NPC_THREE__.ClampToEdgeWrapping,LinearMipmapLinearFilter:window.__NPC_THREE__.LinearMipmapLinearFilter,
        LinearFilter:window.__NPC_THREE__.LinearFilter},
      contextLost:gl.isContextLost(),renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),
      vendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):gl.getParameter(gl.VENDOR),
      version:gl.getParameter(gl.VERSION),programs:(renderer.info.programs||[]).map(p=>({id:p.id,name:p.name,
        linked:!!p.program&&gl.getProgramParameter(p.program,gl.LINK_STATUS),log:p.program?gl.getProgramInfoLog(p.program):null})),
      render:{...renderer.info.render},memory:{...renderer.info.memory},events:window.__NPC_VERIFY_EVENTS__||[],
      finalRaster:{pixelRatio:renderer.getPixelRatio(),expectedPixelRatio:Math.min(devicePixelRatio||1,1.25),
        width:renderer.domElement.width,height:renderer.domElement.height,css:renderer.domElement.getBoundingClientRect().toJSON()},
      sceneLighting:{lights,
        overrideMaterial:viewer.scene.overrideMaterial?.type||null,toneMapping:renderer.toneMapping,
        exposure:renderer.toneMappingExposure,camera:viewer.camera.position.toArray(),aspect:viewer.camera.aspect}};
  },undefined,FRAME_MS);
  const lock=report.build.nativeFaceTextures;
  assert.equal(lock?.mode,'embedded-original-png-data-uri','Original face PNGs are explicitly bound by this build');
  assert.equal(lock.files.length,2);assert.equal(evidence.faceTextureImages.length,2,'Rendered material references resolve to the two original PNGs');
  for(const image of evidence.faceTextureImages){
    const src=image.src;delete image.src;
    assert(src.startsWith('data:image/png;base64,'),'The actual loaded material image is embedded PNG data');
    const bytes=Buffer.from(src.slice('data:image/png;base64,'.length),'base64');
    image.embedded=true;image.bytes=bytes.length;image.sha256=sha(bytes);
    const expected=lock.files.find(file=>file.sha256===image.sha256);
    assert(expected,'The actual decoded source bytes match a locked original PNG');
    assert.equal(image.bytes,expected.bytes);assert.equal(image.complete,true);
    assert.equal(image.naturalWidth,expected.width);assert.equal(image.naturalHeight,expected.height);
    image.originalName=expected.name;
  }
  for(const mesh of evidence.meshes){
    assert(mesh.materials.some(material=>material.linked&&material.faceTextures.uFAtlas&&material.faceTextures.uFChroma),
      'Each rendered native person retains a linked material with both original face images');
    for(const material of mesh.materials)for(const [uniform,texture]of Object.entries(material.faceTextures)){
      if(!texture)continue;
      const image=evidence.faceTextureImages[texture.imageIndex],expected=uniform==='uFAtlas'?'detail.png':'chroma.png';
      assert(image&&image.originalName===expected,'The rendered material uniform references its correct original image: '+uniform);
      assert.equal(texture.colorSpace,evidence.nativeTextureConstants.NoColorSpace);assert.equal(texture.flipY,false);
      assert.equal(texture.wrapS,evidence.nativeTextureConstants.ClampToEdgeWrapping);assert.equal(texture.wrapT,evidence.nativeTextureConstants.ClampToEdgeWrapping);
      assert.equal(texture.generateMipmaps,true);assert.equal(texture.minFilter,evidence.nativeTextureConstants.LinearMipmapLinearFilter);
      assert.equal(texture.magFilter,evidence.nativeTextureConstants.LinearFilter);
    }
  }
  evidence.embeddedFaceTextureReferencesVerified=true;
  return evidence;
}

async function responsiveEvidence() {
  await pause(true);await hideDataPanel();await bounded('resize actual browser viewport to 390 x 844',()=>page.setViewportSize({width:390,height:844}));
  await click('[data-camera="all"]');await screenshot('06-phone-390x844');
  await overviewEvidence('phone-overview-framing');
  await hideDataPanel();
  const layout=await evaluate('read actual responsive layout',()=>{const rect=s=>document.querySelector(s)?.getBoundingClientRect().toJSON();
    return{width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,
      app:rect('#life-app'),view:rect('#life-view'),canvas:rect('#life-view canvas'),controls:rect('.world-controls'),
      buttons:[...document.querySelectorAll('#life-app button')].map(b=>({id:b.id,camera:b.dataset.camera,disabled:b.disabled,
        width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))};});
  put('phone-layout.json',layout);
  assert.equal(layout.width,390);assert.equal(layout.height,844);assert(layout.documentWidth<=392,'No horizontal document overflow on 390 px viewport');
  assert(layout.canvas?.width>200&&layout.canvas.width<=392,'Actual 3D canvas fits phone viewport');
  for(const selector of ['#pause','#add-bottle','#data-toggle']) {
    const control=page.locator(selector);await bounded('scroll mobile UI '+selector,()=>control.scrollIntoViewIfNeeded());
    const b=await bounded('measure mobile UI '+selector,()=>control.boundingBox());
    assert(b&&b.x>=-1&&b.x+b.width<=391&&b.y>=-1&&b.y+b.height<=845,'Mobile control is reachable by normal scrolling: '+selector);
    assert.equal(await bounded('check mobile control enabled '+selector,()=>control.isEnabled()),true);
  }
  await saveDOM('phone-dom');report.phoneViewport={tested:true,physicalPhone:false,layout};
  await bounded('restore desktop viewport',()=>page.setViewportSize(report.environment.viewport));
  await click('[data-camera="all"]');await ensureDataPanel();return report.phoneViewport;
}

async function overviewEvidence(name){
  const frame=await evaluate('read actual full-courtyard projection '+name,()=>{
    const T=window.__NPC_THREE__,viewer=window.__IDENTITY_QA__.viewer(),group=viewer.scene.getObjectByName('KAOPU-original-living-courtyard');
    if(!group)throw Error('The actual original courtyard is missing');
    const box=new T.Box3().setFromObject(group),corners=[];
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      corners.push(new T.Vector3(x,y,z).project(viewer.camera).toArray());}
    return{bounds:{min:box.min.toArray(),max:box.max.toArray()},corners,aspect:viewer.camera.aspect,
      camera:viewer.camera.position.toArray(),target:viewer.orbit.target.toArray()};
  });
  put(name+'.json',frame);
  assert(frame.corners.every(p=>p.every(Number.isFinite)&&Math.abs(p[0])<=.90&&Math.abs(p[1])<=.77&&p[2]>-1&&p[2]<1),
    'Full overview retains the actual courtyard bounds with visible margin: '+name);
  return frame;
}

function contactProof(evidence,kind) {
  assert.equal(evidence?.clockOnlyCompletion,false,'Receipt requires object measurements, not elapsed time: '+kind);
  assert.equal(evidence.nativePalmRequired,true);assert.equal(evidence.physicalTransportRequired,true);
  if(kind!=='recycle') {
    const c=evidence.contact;
    assert(c&&Number.isFinite(c.surfaceErrorM)&&c.surfaceErrorM<=.012,'Measured source palm contact within 12 mm: '+kind);
    assert(c.signedSurfaceDistanceM>=-.004,'Source palm not deeply inside the object: '+kind);
    assert(c.finiteForceLimitN===16,'The assisted grasp has an explicit finite 16 N limit');
    assert(Number.isFinite(evidence.actualConstraintErrorM)&&evidence.actualConstraintErrorM<=.035,'Actual dynamic object reaches completion: '+kind);
  }
  if(kind==='collect'){assert(evidence.liftM>=.24);assert(evidence.atActualBagM<=.02);}
  if(kind==='buy'){assert(evidence.transportDistanceM>=.16);assert(evidence.atActualBagM<=.02);}
  if(kind==='eat') {
    assert(evidence.breadToMouthSurfaceM>=-.004&&evidence.breadToMouthSurfaceM<=.025,'Actual loaf reaches original mouth surface within 25 mm');
    assert(evidence.verifiedMouthSamples>=3);assert(Array.isArray(evidence.actualMouthSurface));
  }
  if(kind==='recycle') {
    assert.equal(evidence.everyBottlePhysicallyOnCounter,true);
    assert(evidence.bottleIds.length>0&&evidence.bottleIds.length===evidence.deliveries.length,'Every credited bottle has its own measured delivery');
    for(const d of evidence.deliveries){assert.equal(d.actualCounterContact,true);assert(Math.abs(d.bottomY-d.counterTopY)<.018);assert(d.speedMps<.14);}
  }
}

async function autonomousChain({controls=false}={}) {
  report.fullSuiteRun=controls;await ensureDataPanel();await click('[data-person="A"]');await click('#reset');
  await ensureDataPanel();const initialSpeed=controls?'1×':'2×';
  if((await bounded('read speed control',()=>page.locator('#speed').textContent())).trim()!==initialSpeed)await click('#speed');
  await pause(false);
  const until=Math.min(Date.now()+CHAIN_MS,activeDeadline),receipts=new Map();let seat=null,interrupted=null,shopClosed=null,lastTime=-1;
  while(Date.now()<until) {
    const s=await readState('autonomous-chain');assertHealthy(s);
    if(s.time-lastTime>.4){observe(s,'autonomous-chain');lastTime=s.time;}
    const a=s.simulation.actors.find(a=>a.id==='A'),b=s.simulation.actors.find(a=>a.id==='B'),bm=s.motions.B;
    if(!seat&&b?.pose==='seated'&&bm?.mode==='sitting'&&bm.poseValid&&bm.seatErrorM<=.012&&bm.footErrorM<=.015) {
      seat={time:s.time,actor:b,motion:bm};put('B-real-seat.json',seat);log('B is actually seated',{seatErrorM:bm.seatErrorM,footErrorM:bm.footErrorM});
    }
    for(const r of s.audit?.interactions||[]) {
      const kind=r.kind||r.evidence?.kind;
      if(r.id==='A'&&['collect','recycle','buy','eat'].includes(kind)&&r.success===true&&r.ack?.accepted&&r.ack?.committed&&!receipts.has(kind)) {
        contactProof(r.evidence,kind);receipts.set(kind,r);put('A-'+kind+'-receipt.json',r);log('A actual '+kind+' committed',{time:r.time,token:r.token});
      }
    }
    if(controls&&!interrupted&&a.task?.kind==='collect') {
      const itemAction=s.items.actions.find(r=>r.actorId==='A'&&r.token===a.task.token);
      if(itemAction?.grasped&&!itemAction.finished) {
        const observedToken=a.task.token;
        await pause(true);const before=await readState('interrupt-before',{save:true});
        const actor=before.simulation.actors.find(x=>x.id==='A'),active=before.items.actions.find(x=>x.actorId==='A');
        if(actor.task?.kind==='collect'&&actor.task.token===observedToken&&active?.token===observedToken&&active.grasped&&!active.finished) {
          const token=actor.task.token,id=actor.task.targetId;await click('#interrupt');await pause(false);
          const after=await waitState('physical-interruption',state=>{
            const item=state.items.items.find(i=>i.id===id);return !state.items.actions.some(r=>r.token===token)&&item&&item.heldBy===null;
          },{timeout:25000,poll:250});
          const actorAfter=after.simulation.actors.find(x=>x.id==='A'),item=after.items.items.find(x=>x.id===id),logical=after.simulation.bottles.find(x=>x.id===id);
          assert.equal(actorAfter.money,actor.money);assert.deepEqual(actorAfter.inventory,actor.inventory);
          assert.equal(logical.state,'ground');assert.equal(logical.owner,null);assert.equal(item.dynamic,true);
          assert(Math.hypot(item.position[0]-logical.x,item.position[2]-logical.z)<.001,'Released real bottle position stays synchronized with navigation');
          interrupted={token,bottleId:id,before:actor,after:actorAfter,physical:item,logical};put('physical-interruption.json',interrupted);
          log('Real UI interruption released held bottle without a transaction');
          if((await bounded('read speed after physical interruption',()=>page.locator('#speed').textContent())).trim()!=='2×')await click('#speed');
        } else await pause(false);
      }
    }
    if(controls&&!shopClosed&&a.task?.kind==='buy'&&s.simulation.shop.open&&!receipts.has('buy')) {
      await pause(true);const before=await readState('shop-before',{save:true}),beforeA=before.simulation.actors.find(x=>x.id==='A');
      if(beforeA.task?.kind==='buy') {
        await click('#shop-toggle');const after=await waitState('shop-closed',state=>!state.simulation.shop.open,{timeout:15000});
        const afterA=after.simulation.actors.find(x=>x.id==='A');
        assert.notEqual(afterA.task?.kind,'buy');assert.equal(afterA.money,beforeA.money);assert.equal(afterA.inventory.bread,beforeA.inventory.bread);
        assert.equal(after.simulation.shop.stock,before.simulation.shop.stock);assert.equal(after.simulation.resources.bakery,null);
        shopClosed={before:beforeA,after:afterA,stock:after.simulation.shop.stock,moneyUnchanged:true,inventoryUnchanged:true};put('shop-closure.json',shopClosed);
        await click('#shop-toggle');await waitState('shop-reopened',state=>state.simulation.shop.open,{timeout:15000});log('Closed shop rejected a real pending purchase');
      }
      await pause(false);
    }
    if(receipts.size===4&&seat) {
      const sequence=['collect','recycle','buy','eat'].map(k=>receipts.get(k));
      assert(sequence.every((r,i)=>i===0||r.time>sequence[i-1].time),'Actual acquisition, exchange, purchase and eating are causally ordered');
      assert.equal(new Set(sequence.map(r=>r.token)).size,4,'Four unique transactional phase tokens');
      assert(sequence[1].evidence.bottleIds.includes(sequence[0].evidence.itemId),'The acquired physical bottle is part of the credited recycling transaction');
      assert(a.counters.collected>=1&&a.counters.recycled>=1&&a.counters.bought>=1&&a.counters.eaten>=1);
      report.autonomousChain={scope:'Actual native body execution and Cannon receipts observed through UI DOM',receipts:sequence,seat,
        controls:{physicalInterruption:interrupted,closedShop:shopClosed},endTime:s.time};
      put('autonomous-chain.json',report.autonomousChain);await pause(true);await screenshot('07-food-chain-complete');
      if(controls){assert(interrupted,'Suite requires a real held-item interruption; it was not observed');assert(shopClosed,'Suite requires a pending purchase rejected by shop closure');}
      report.autonomousChainPassed=true;return report.autonomousChain;
    }
    await delay(300);
  }
  await readState('autonomous-chain-timeout',{save:true});
  throw Error('The real autonomous food chain did not finish within its deadline; completed stages: '+[...receipts.keys()].join(', '));
}

async function weatherAndSpawn() {
  await ensureDataPanel();await pause(true);await click('[data-person="B"]');
  // These are actual keyboard operations on the two visible range controls.
  // They ensure this test starts from a seated B; no task or success is injected.
  await bounded('UI keyboard: B hunger minimum',()=>page.locator('#need-hunger').press('Home'));
  await bounded('UI keyboard: B fatigue maximum',()=>page.locator('#need-fatigue').press('End'));
  const prepared=await waitState('B-weather-needs-set',s=>{
    const b=s.simulation.actors.find(a=>a.id==='B');return b.needs.hunger<.02&&b.needs.fatigue>.98;
  },{timeout:15000});
  const preparedB=prepared.simulation.actors.find(a=>a.id==='B');
  if(preparedB.pose!=='seated')await click('#interrupt');
  await pause(false);
  await waitState('B-seated-before-weather',s=>{
    const b=s.simulation.actors.find(a=>a.id==='B'),m=s.motions.B;
    return b.pose==='seated'&&b.task?.kind==='rest'&&b.task.phase==='rest'&&m?.mode==='sitting'&&m.poseValid&&
      m.seatErrorM<=.012&&m.footErrorM<=.015&&m.boneLengthErrorM<=1e-5;
  },{timeout:90000,poll:400,onState:s=>observe(s,'prepare-B-weather')});
  await pause(true);const before=await readState('weather-before',{save:true}),seatedB=before.simulation.actors.find(a=>a.id==='B');
  assert.equal(seatedB.pose,'seated');assert.equal(seatedB.task.phase,'rest');
  const seatId=seatedB.task.targetId;assert.equal(before.simulation.resources[seatId],'B','Actually occupied seat remains reserved before rain');
  await click('#add-bottle');const spawned=await waitState('bottle-spawned',s=>s.simulation.bottles.length>before.simulation.bottles.length,{timeout:15000});
  const newBottle=spawned.simulation.bottles.at(-1);assert(spawned.items.items.some(i=>i.id===newBottle.id)||spawned.paused,'Spawn is in real logical world');
  await click('#rain-toggle');
  const rainy=await waitState('rain-started',s=>s.simulation.raining,{timeout:15000});
  const departing=rainy.simulation.actors.find(a=>a.id==='B');
  assert.equal(departing.task?.kind,'rest');assert.equal(departing.task?.phase,'depart');
  assert.equal(rainy.simulation.resources[seatId],'B','Rain cannot release the seat before native standing is confirmed');
  const departToken=departing.task.token;put('B-rain-depart-pending.json',{seated:seatedB,seatedMotion:before.motions.B,
    pending:departing,seatId,seatOwner:rainy.simulation.resources[seatId],rainAt:rainy.time});
  await pause(false);
  const stood=await waitState('B-native-stand-after-rain',s=>s.audit.interactions.some(r=>r.id==='B'&&r.kind==='rest'&&
    r.phase==='depart'&&r.ack?.accepted&&r.ack?.committed&&r.ack?.reason==='stood-up'&&r.time>=rainy.time),{
    timeout:45000,poll:300,onState:s=>observe(s,'B-standing-for-rain')});
  const standActor=stood.simulation.actors.find(a=>a.id==='B'),standReceipt=standActor.lastInteraction;
  assert.equal(standReceipt?.token,departToken,'The actual standing receipt belongs to this rain-triggered depart phase');
  assert.equal(standReceipt.kind,'rest');assert.equal(standReceipt.success,true);
  const standMotion=standReceipt.evidence;
  assert.equal(standMotion.executor,'native-104-bone-seat');assert.equal(standMotion.mode,'stand');
  assert.equal(standMotion.finite,true);assert.equal(standMotion.completed,true);assert.equal(standMotion.poseValid,true);
  assert(standMotion.footErrorM<=.015&&standMotion.boneLengthErrorM<=1e-5,'Actual native feet and immutable bones remain valid on standing');
  assert.equal(stood.simulation.resources[seatId],null,'Seat is released only after native standing succeeded');
  put('B-native-standing-receipt.json',standReceipt);
  const shelter=await waitState('B-rain-shelter-arrival',s=>{
    const b=s.simulation.actors.find(a=>a.id==='B');return b.task?.kind==='shelter'&&b.task.phase==='rest';
  },{timeout:90000,poll:500,onState:s=>observe(s,'weather')});
  const shelterEvent=[...shelter.simulation.events].reverse().find(e=>e.type==='sheltered'&&e.actorId==='B');
  assert(shelterEvent&&shelterEvent.time>standReceipt.time,'B reaches shelter strictly after its measured standing receipt');
  assert(shelter.items.items.some(i=>i.id===newBottle.id),'UI-spawned bottle has an actual 3D physics object');
  await pause(true);await screenshot('08-rain-response');
  await click('#rain-toggle');const dry=await waitState('rain-stopped',s=>!s.simulation.raining,{timeout:15000});
  const result={spawnedBottle:newBottle,preparedUsingUI:{selected:'B',hunger:'Home key',fatigue:'End key'},
    seatedBeforeRain:{actor:seatedB,motion:before.motions.B,seatId},rainAt:rainy.time,departToken,
    nativeStandingReceipt:standReceipt,shelterEvent,shelteredB:shelter.simulation.actors.find(a=>a.id==='B'),
    stoppedAt:dry.time,scope:'real UI rain; actual seated B retains seat through measured native standing, then autonomously reaches shelter'};
  put('weather-response.json',result);return result;
}

async function startServer() {
  assert(fs.existsSync(input),'Built document exists: '+input);
  const mime={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.js':'text/javascript; charset=utf-8',
    '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.gz':'application/gzip','.bin':'application/octet-stream',
    '.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
  server=http.createServer((request,response)=>{
    try{
      const url=new URL(request.url,'http://127.0.0.1'),route=decodeURIComponent(url.pathname);
      if(route==='/favicon.ico'){response.writeHead(204);response.end();return;}
      const file=route==='/'||route==='/index.html'?input:path.resolve(staticRoot,'.'+route);
      if(file!==input&&file!==staticRoot&&!file.startsWith(staticRoot+path.sep)){response.writeHead(403);response.end('Outside candidate root');return;}
      if(!fs.existsSync(file)||!fs.statSync(file).isFile()){response.writeHead(404,{'Content-Type':'text/plain'});response.end('Candidate resource not found: '+route);return;}
      const stat=fs.statSync(file);response.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store'});
      if(request.method==='HEAD')response.end();else fs.createReadStream(file).pipe(response);
    }catch(error){response.writeHead(500,{'Content-Type':'text/plain'});response.end('Candidate server error: '+error.message);}
  });
  await bounded('start same-origin candidate HTTP server',()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}),10000);
  return 'http://127.0.0.1:'+server.address().port+'/';
}

async function main() {
  checkpointTimer=setInterval(()=>checkpoint('periodic durable checkpoint'),5000);checkpointTimer.unref();
  watchdog=setTimeout(()=>{
    report.completed=false;report.status='FAILED_TOTAL_DEADLINE';report.failure='Hard 15-minute verifier limit exceeded';checkpoint('hard overall watchdog');
    try{fs.writeSync(2,report.failure+'\n');}catch{}process.exit(1);
  },TOTAL_MS);watchdog.unref();
  log(VERSION+' / '+PHASE+' / '+out);
  await check('source gate (separate from browser acceptance)',async()=>{
    const buildPath=path.resolve(process.env.NPC_BUILD_FILE||path.join(here,'BUILD.json'));
    assert(fs.existsSync(buildPath),'Project-root BUILD.json is required');const build=JSON.parse(fs.readFileSync(buildPath,'utf8'));report.build=build;
    assert.equal(build.version,VERSION);assert.equal(build.canonicalVersion,'HUMAN-INTEGRATED-R07');assert.equal(build.canonicalSHA256,CANONICAL_SHA);
    assert.equal(build.sameThreeRuntime,true);assert.equal(build.nativeGeometryRetained,true);assert.equal(build.finalInlineScriptSyntaxChecked,true);
    const sourceFiles=[];for(const [file,expected]of Object.entries(build.sourceSHA256||{})) {
      const p=path.resolve(here,file);assert(fs.existsSync(p),'Bound source file exists: '+file);const actual=sha(fs.readFileSync(p));
      sourceFiles.push({file,expectedSHA256:expected,actualSHA256:actual,matched:actual===expected});assert.equal(actual,expected,'No source drift since current build: '+file);
    }
    assert(sourceFiles.length>=8,'BUILD binds the actual source modules');
    assert.equal(sha(fs.readFileSync(path.join(here,'build.cjs'))),build.adapterSHA256,'Builder is the exact bound version');
    const expected=process.env.NPC_EXPECT_SHA256||build.previewSHA256;assert(expected,'An expected built-document SHA is required');
    report.expectedPreviewSHA256=expected;
    if(fs.existsSync(input)){report.localPreviewSHA256=sha(fs.readFileSync(input));assert.equal(report.localPreviewSHA256,expected);}
    report.sourceGate={passed:true,sourceHead,buildFile:buildPath,previewSHA256:expected,sourceFiles,browserAcceptance:false};
    put('source-gate.json',report.sourceGate);return report.sourceGate;
  });
  if(PHASE==='offline'){
    assert(!process.env.PREVIEW_URL,'Offline phase opens the exact built file, not a server URL');
    assert.equal(report.build.standalone,true);assert.equal(report.build.assetMode,'embedded-native-packets');
    assert(fs.existsSync(input),'The exact standalone file exists');
    report.url=pathToFileURL(input).href;report.deliveryMode='standalone-file-offline';
  }else{
    report.url=process.env.PREVIEW_URL||await startServer();const address=new URL(report.url);
    assert(['http:','https:'].includes(address.protocol),'Use actual HTTP(S) candidate URLs');
    report.deliveryMode=['127.0.0.1','localhost','[::1]'].includes(address.hostname)?'same-origin-local-candidate':'fixed-deployed-url';
  }
  if(PHASE==='public')assert.equal(report.deliveryMode,'fixed-deployed-url','Public phase requires the fixed PREVIEW_URL');
  stage('launch independent Chromium');
  assert.equal(report.environment.playwright,'1.58.2','CI pins Playwright 1.58.2');
  browser=await bounded('launch isolated SwiftShader Chromium',()=>chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),45000);
  report.environment.chromium=browser.version();
  context=await bounded('create isolated browser context',()=>browser.newContext({viewport:report.environment.viewport,deviceScaleFactor:1,serviceWorkers:'block'}));
  if(PHASE==='offline'){
    report.offline.serviceWorkersBlocked=true;
    await bounded('disable networking before standalone file navigation',()=>context.setOffline(true));
    report.offline.networkDisabledBeforeNavigation=true;
    await bounded('record and reject attempted offline network resources',()=>context.route(/^https?:\/\//,async route=>{
      report.offline.blockedRequests.push(requestRecord(route.request()));
      checkpoint('offline external dependency rejected');await route.abort('internetdisconnected');
    }));
  }
  await bounded('install read-only WebGL/fatal error listeners',()=>context.addInitScript(()=>{
    window.__NPC_VERIFY_EVENTS__=[];
    document.addEventListener('webglcontextlost',e=>window.__NPC_VERIFY_EVENTS__.push({type:'webglcontextlost',at:performance.now(),target:e.target?.id||null}),true);
    window.addEventListener('unhandledrejection',e=>window.__NPC_VERIFY_EVENTS__.push({type:'unhandledrejection',message:String(e.reason?.stack||e.reason),at:performance.now()}));
  }));
  page=await bounded('create verifier page',()=>context.newPage());page.setDefaultTimeout(15000);
  cdp=await bounded('create screenshot and document CDP session',()=>context.newCDPSession(page));
  // The self-contained HTML includes every selected native packet. Keep
  // its actual browser response in this session, and read it through this same
  // session; Playwright's separate default response cache can evict it.
  const documentResponses=[],completedTransfers=new Map();
  report.documentCapture={maxResourceBufferSize:128*1024*1024,maxTotalBufferSize:256*1024*1024,
    source:'actual navigation response, retained and read through the same CDP session'};
  cdp.on('Network.responseReceived',event=>{if(event.type==='Document')documentResponses.push(event);});
  cdp.on('Network.loadingFinished',event=>completedTransfers.set(event.requestId,event));
  await bounded('retain full native document response',()=>cdp.send('Network.enable',{
    maxResourceBufferSize:report.documentCapture.maxResourceBufferSize,maxTotalBufferSize:report.documentCapture.maxTotalBufferSize}));
  page.on('pageerror',e=>{report.pageErrors.push({at:new Date().toISOString(),message:clip(e.stack||e)});checkpoint('page error');});
  page.on('console',m=>{const row={at:new Date().toISOString(),text:clip(m.text()),location:m.location()};
    if(m.type()==='error'){report.consoleErrors.push(row);checkpoint('console error');}else if(m.type()==='warning'&&report.consoleWarnings.length<200)report.consoleWarnings.push(row);});
  context.on('request',r=>report.requests.push(requestRecord(r)));
  context.on('requestfailed',r=>{report.failedRequests.push({...requestRecord(r),failure:r.failure()});checkpoint('request failed');});
  context.on('response',r=>{if(r.status()>=400){report.httpErrors.push({...requestRecord(r.request()),status:r.status()});checkpoint('HTTP failure');}});
  await check('actual navigation loads the exact current HTML',async()=>{
    const response=await bounded('navigate exact candidate URL',()=>page.goto(report.url,{waitUntil:'domcontentloaded',timeout:120000}),125000);
    assert.equal(response?.status(),200);report.finalURL=page.url();assert.equal(report.finalURL,report.url,'The exact candidate URL is loaded');
    const tree=await bounded('identify actual main document frame',()=>cdp.send('Page.getFrameTree'));
    const documents=documentResponses.filter(event=>event.frameId===tree.frameTree.frame.id&&
      event.loaderId===tree.frameTree.frame.loaderId&&event.response.url===report.finalURL);
    assert.equal(documents.length,1,'One actual main-frame navigation response matches the candidate URL');
    const document=documents[0];assert.equal(document.response.status,200);
    await bounded('confirm the exact document transfer completed',async()=>{
      const until=Date.now()+10000;
      while(!completedTransfers.has(document.requestId)&&Date.now()<until)await delay(25);
      assert(completedTransfers.has(document.requestId),'The captured main document has its actual loadingFinished event');
    },15000);
    const body=await bounded('read retained actual browser document bytes',()=>cdp.send('Network.getResponseBody',{requestId:document.requestId}));
    const bytes=Buffer.from(body.body,body.base64Encoded?'base64':'utf8');
    assert.equal(bytes.length,report.build.previewBytes,'All actual document bytes are retained');
    report.observedPreviewSHA256=sha(bytes);
    report.documentCapture.navigation={requestId:document.requestId,frameId:document.frameId,loaderId:document.loaderId,url:document.response.url,
      status:document.response.status,mimeType:document.response.mimeType,bytes:bytes.length,base64Encoded:body.base64Encoded,
      loadingFinished:completedTransfers.get(document.requestId),sha256:report.observedPreviewSHA256};
    put('navigation-document.json',report.documentCapture);
    assert.equal(report.observedPreviewSHA256,report.expectedPreviewSHA256,'No stale candidate or wrong branch document');
    return{url:report.finalURL,status:response.status(),sha256:report.observedPreviewSHA256};
  });
  await check('native R07 boot and first completed scene frame',async()=>{
    const until=Math.min(Date.now()+BOOT_MS,activeDeadline);let lastLog=0,boot;
    while(Date.now()<until) {
      boot=await readBoot(Math.min(BOOT_READ_MS,Math.max(1,until-Date.now())));report.lastBootState=boot;
      if(boot.npcReady==='failed'||report.pageErrors.length||boot.errors.length)throw Error('Native startup failed: '+JSON.stringify(boot));
      if(boot.npcReady==='true'&&boot.runtimeReady)break;
      if(Date.now()-lastLog>15000){log('native boot progress',boot);lastLog=Date.now();}
      await delay(700);
    }
    assert.equal(boot?.npcReady,'true','Native startup reached its actual ready state within the deadline');
    assert.equal(boot.runtimeReady,true);assert.equal(boot.headErrors.length,0);assert.equal(boot.headGPUVerified,true);
    await pause(true);await ensureDataPanel();const s=await readState('initial',{save:true});assertHealthy(s);
    assert.equal(s.source.canonicalSHA256,CANONICAL_SHA);assert.equal(s.source.identities.length,2);
    assert.equal(new Set(s.source.identities.map(a=>a.identity.presetId)).size,2,'Two distinct original native character presets');
    for(const a of s.source.identities){const b=a.binding;assert.equal(b.nativeBones,104);assert.equal(b.weightsTruncated,false);assert.equal(b.r07MaterialGroups,2);assert.equal(b.originalAttributesRetained,true);assert(b.displayVertices>=b.nativeVertices);}
    assert.equal(s.render.startupDrain.completed,true);assert(s.render.completed>=1&&s.render.maxInFlight<=1);
    assert(s.assets.servedCount>0&&s.assets.missing.length===0);report.coldReadyMS=Date.now()-started;
    return{coldReadyMS:report.coldReadyMS,actors:s.source.identities,nativeAssets:s.assets,completedFrame:s.render.completed};
  });
  await check('both complete native meshes and real linked GPU materials',async()=>{
    const native=await nativeRenderEvidence();put('native-render.json',native);report.environment.observedRenderer=native.renderer;
    assert.equal(native.sameThreeRuntime,true);assert.equal(native.contextLost,false);assert.equal(native.meshes.length,2);
    assert(native.meshes.every(m=>m.visible&&m.parentVisible&&m.positionCount>10000&&m.triangles>10000));
    assert.equal(native.meshes.flatMap(m=>m.materials).length,4,'Both people retain both native material instances');
    assert(native.meshes.flatMap(m=>m.materials).every(m=>Number.isInteger(m.programID)&&m.linked),'All four original materials linked on the actual GPU');
    assert(native.programs.length>0&&native.programs.every(p=>p.linked));assert.equal(native.events.length,0);
    assert.equal(native.finalRaster.pixelRatio,native.finalRaster.expectedPixelRatio,'Final courtyard restores its full display raster after hidden startup');
    assert(Math.abs(native.finalRaster.width-native.finalRaster.css.width*native.finalRaster.pixelRatio)<=1);
    assert(Math.abs(native.finalRaster.height-native.finalRaster.css.height*native.finalRaster.pixelRatio)<=1);
    const environment=native.sceneLighting.lights.filter(light=>light.parent==='courtyard/environment-lighting');
    assert.equal(environment.length,3,'All three authored courtyard lights are present under their native-compatible Group');
    assert(environment.every(light=>light.effectiveVisible&&light.intensity>0),'The actual completed frame retains active courtyard illumination');
    return native;
  });
  await check('real first/all/near and both full-person screenshots',async()=>{
    await screenshot('01-first-frame');await hideDataPanel();await click('[data-camera="all"]');await screenshot('02-all');
    await overviewEvidence('desktop-overview-framing');
    const desktop=await evaluate('read actual desktop app layout',()=>{const app=document.querySelector('#life-app'),style=getComputedStyle(app);
      return{width:innerWidth,height:innerHeight,app:app.getBoundingClientRect().toJSON(),
        journal:document.querySelector('#life-app>.journal').getBoundingClientRect().toJSON(),
        view:document.querySelector('#life-view').getBoundingClientRect().toJSON(),padding:style.padding,gap:style.gap,
        brandBackground:getComputedStyle(document.querySelector('#life-app .brand')).backgroundColor,
        brand:document.querySelector('#life-app .brand').getBoundingClientRect().toJSON(),
        people:document.querySelector('#life-app .people').getBoundingClientRect().toJSON(),
        originalOverlays:[...document.querySelectorAll('#stage>.stage-hint,#stage>#model-caption')].map(el=>({class:el.className,display:getComputedStyle(el).display}))};});
    put('desktop-layout.json',desktop);assert(Math.abs(desktop.journal.width-310)<=1,'Journal retains its authored desktop width');
    assert(desktop.view.width>600,'The actual 3D courtyard has the main desktop viewing area');
    assert.equal(desktop.padding,'0px');assert.equal(desktop.gap,'0px');
    assert.equal(desktop.brandBackground,'rgba(0, 0, 0, 0)','Canonical host header styles do not leak into the app');
    assert(desktop.people.top>=desktop.brand.bottom+20,'Journal brand and people section do not overlap');
    assert(desktop.originalOverlays.every(el=>el.display==='none'),'Original workbench captions stay out of the courtyard UI');
    await hideDataPanel();await click('[data-camera="near"]');await screenshot('03-near');
    for(const id of ['A','B']){await hideDataPanel();await click('[data-person="'+id+'"]');await click('[data-camera="follow"]');await screenshot(id==='A'?'04-person-A':'05-person-B');}
    await saveDOM('desktop-dom');return{screenshots:report.screenshots.map(s=>s.file),visualAcceptance:false};
  });
  await check('390 x 844 responsive screenshot and accessible UI controls',responsiveEvidence);
  report.startupPassed=true;log('STARTUP PASSED — autonomous suite has not been inferred');
  if(['suite','public','offline'].includes(PHASE))await check('actual autonomous food chain and B seated',()=>autonomousChain({controls:PHASE==='suite'}));
  if(PHASE==='suite')await check('real UI weather and new-object response',weatherAndSpawn);
  await ensureDataPanel();const final=await readState('final',{save:true});
  await check('no missing native assets, runtime, HTTP or ownership errors',async()=>{assertHealthy(final);return{nativeAssetsMissing:0,applicationErrors:0,pageErrors:0,consoleErrors:0,httpErrors:0,failedRequests:0,invariants:final.simulation.invariants};});
  if(PHASE==='offline')await check('actual standalone file operates offline without sidecar resources',async()=>{
    assert.equal(new URL(report.finalURL).protocol,'file:');assert.equal(report.deliveryMode,'standalone-file-offline');
    assert.equal(final.assets.mode,'embedded');assert.equal(report.autonomousChainPassed,true);
    const scope=assertResourceScope();assert.equal(scope.externalNetworkRequests,0);assert.equal(scope.sidecarFileRequests,0);
    report.offline={...report.offline,...scope,actualFileURL:report.finalURL,actualDocumentSHA256:report.observedPreviewSHA256,
      nativeStartupPassed:true,autonomousPhysicalChainPassed:true,serverUsed:false,verified:true};
    report.offlineVerified=true;put('offline-proof.json',report.offline);return report.offline;
  });
  await saveDOM('final-dom');
  report.fullSuitePassed=PHASE==='suite';report.completed=true;report.status=PHASE.toUpperCase()+'_PASSED';
  report.publicURLVerified=PHASE==='public'&&report.autonomousChainPassed&&report.deliveryMode==='fixed-deployed-url';
  log('verification complete',{status:report.status,startupPassed:report.startupPassed,fullSuitePassed:report.fullSuitePassed,offlineVerified:report.offlineVerified,publicURLVerified:report.publicURLVerified});
}

main().catch(async error=>{
  failureMode=true;report.failedStage=report.stage;report.failure=clip(error.stack||error);report.status='FAILED';report.completed=false;
  report.fullSuitePassed=false;report.offlineVerified=false;report.publicURLVerified=false;process.exitCode=1;stage('bounded failure evidence');checkpoint('original failure saved before any browser wait');
  if(lastDOM)put('last-successful-dom-state.json',lastDOM);
  const deadline=Math.min(Date.now()+FAILURE_MS,started+TOTAL_MS-CLOSE_MS-2000);
  const diagnose=async(label,fn)=>{const budget=Math.min(12000,deadline-Date.now());if(budget<=0){report.failureDiagnostics.push({label,status:'skipped',reason:'failure capture deadline'});return;}
    try{await fn(budget);report.failureDiagnostics.push({label,status:'saved'});}catch(e){report.failureDiagnostics.push({label,status:'unavailable',message:clip(e.message)});}checkpoint('failure diagnostic '+label);};
  if(page&&!page.isClosed()) {
    await diagnose('boot state',async budget=>put('failure-boot.json',await readBoot(budget)));
    await diagnose('displayed diagnostics',async budget=>put('failure-dom-state.json',await readState('failure',{budget})));
    await diagnose('DOM',budget=>saveDOM('failure-dom',budget));
    await diagnose('expose failed scene for visual review',async budget=>{
      if(await page.locator('#data-toggle').getAttribute('aria-expanded',{timeout:budget})==='true')
        await page.locator('#data-close').click({timeout:budget});
    });
    if(cdp)await diagnose('actual failure screenshot',async budget=>{
      const result=await bounded('capture failed real scene',()=>cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),budget);
      const bytes=Buffer.from(result.data,'base64');fs.writeFileSync(path.join(out,'failure.png'),bytes);report.screenshots.push({file:'failure.png',sha256:sha(bytes),bytes:bytes.length,completedFrameNotAsserted:true});
    });
  }
}).finally(async()=>{
  closing=true;stage('bounded cleanup');report.cleanup={completed:false,errors:[]};
  if(browser)try{await bounded('close independent browser',()=>browser.close(),CLOSE_MS);}catch(e){report.cleanup.errors.push(clip(e.message));}
  if(server)try{server.closeAllConnections?.();await bounded('close same-origin server',()=>new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve())),3000);}catch(e){report.cleanup.errors.push(clip(e.message));}
  report.cleanup.completed=report.cleanup.errors.length===0;
  if(!report.cleanup.completed){report.completed=false;report.fullSuitePassed=false;report.offlineVerified=false;report.publicURLVerified=false;report.status='FAILED_CLEANUP';process.exitCode=1;}
  report.finishedAt=new Date().toISOString();report.elapsedMS=Date.now()-started;clearInterval(checkpointTimer);checkpoint('final durable evidence');clearTimeout(watchdog);
  fs.writeSync(1,JSON.stringify({status:report.status,phase:PHASE,sourceGatePassed:report.sourceGate.passed,startupPassed:report.startupPassed,
    autonomousChainPassed:report.autonomousChainPassed,fullSuitePassed:report.fullSuitePassed,offlineVerified:report.offlineVerified,publicURLVerified:report.publicURLVerified,
    visualAcceptance:false,output:out,elapsedMS:report.elapsedMS,failure:report.failure},null,2)+'\n');
  if(!report.cleanup.completed)process.exit(1);
});
