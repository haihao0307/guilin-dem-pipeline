#!/usr/bin/env node
'use strict';
/**
 * Real-browser CI verification of our generated R07-host observation page.
 * Follows human-integrated-r07/verify.cjs: Playwright Chromium + SwiftShader.
 * This is a new isolated CI browser, never the user's connected browser.
 *
 * Default: one complete suite, including the original native startup gates.
 * NPC_QA_PHASE=startup is an explicit diagnostic run, not a second prerequisite.
 * NPC_QA_PHASE=contact runs the three real UI pick/place tasks.
 * NPC_QA_PHASE=suite retains the six R01 cases and checks the R02 window skill.
 * NPC_QA_PHASE=public verifies the deployed exact SHA, three complete people,
 * one A pick/place task, actual window open/close and the 390 x 844 viewport.
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

const VERSION = 'NPC-LIFE-OBSERVATION-R02';
const PHASE = process.env.NPC_QA_PHASE || 'suite';
assert(['startup','contact','suite','public'].includes(PHASE), 'NPC_QA_PHASE must be startup, contact, suite, or public');
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
const WINDOW_GROUP_MS = timeout('NPC_WINDOW_GROUP_TIMEOUT_MS',720000);
// Driver-side deadlines also work when the renderer no longer services JS/CDP.
// These guard evidence collection; they do not relax any native readiness gate.
const PROBE_MS = timeout('NPC_PROBE_TIMEOUT_MS',60000);
// The measured full-quality SwiftShader baseline needed ~184 s to drain a GPU
// readback and ~208 s around a later screenshot. Keep bounded headroom while
// recording the new single-frame scheduler's actual completion time.
const GPU_MS = timeout('NPC_GPU_TIMEOUT_MS',240000);
const FRAME_MS = timeout('NPC_FRAME_TIMEOUT_MS',240000);
const CAPTURE_MS = timeout('NPC_CAPTURE_TIMEOUT_MS',120000);
const FAILURE_TOTAL_MS = 90000, FAILURE_STEP_MS = 20000, CLOSE_MS = 15000;
const run = process.env.GITHUB_RUN_ID ? process.env.GITHUB_RUN_ID + '-' + (process.env.GITHUB_RUN_ATTEMPT || '1') : new Date().toISOString().replace(/[:.]/g,'-');
const out = path.resolve(process.env.NPC_QA_OUT || process.env.QA_OUT || path.join(here,'qa','browser-' + PHASE + '-' + run));
fs.mkdirSync(out,{recursive:true});
const put = (name,value) => {
  const file=path.join(out,name),temporary=file+'.tmp';
  fs.writeFileSync(temporary,typeof value==='string' ? value : JSON.stringify(value,null,2)+'\n');
  fs.renameSync(temporary,file);
};
let sourceHead = process.env.SOURCE_HEAD || process.env.GITHUB_SHA || null;
if (!sourceHead) {try {sourceHead=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:here,encoding:'utf8'}).trim();} catch {}}
let build = null;
const buildPath = path.join(path.dirname(input),path.basename(input)==='standalone.html'?'BUILD.standalone.json':'BUILD.json');
if (fs.existsSync(buildPath)) build=JSON.parse(fs.readFileSync(buildPath,'utf8'));
const expectedSHA = process.env.NPC_EXPECT_SHA256 || build?.previewSHA256 || null;
const report = {
  schema:'kaopu/npc-browser-verification@1',version:VERSION,phase:PHASE,
  verifierSourceSHA256:sha(fs.readFileSync(__filename)),
  geometryContract:'R02-other-solids-and-window-precontact@3',
  previousVerifierSourceSHA256:'21c2224912aab1d515b04df3d37a33afc71f7ef9c158a7fe2738ed650e7c9111',
  initialR02VerifierSourceSHA256:'706e97eadb868481245ade071aa51a4a4830c6f4c0c98aa477fcc214111a7b2b',
  startedAt:new Date().toISOString(),sourceHead,build,expectedPreviewSHA256:expectedSHA,
  environment:{purpose:'repository candidate CI',runner:process.env.GITHUB_ACTIONS==='true'?'GitHub Actions':'isolated development test',
    headless:true,requestedRenderer:'SwiftShader',softwareRenderer:true,physicalPhone:false,userDevice:false,
    viewport:{width:1200,height:900},playwright:require('playwright/package.json').version},
  tests:[],pageErrors:[],consoleErrors:[],consoleWarnings:[],failedRequests:[],httpErrors:[],requests:[],screenshots:[],
  currentStage:'created',activeOperations:{},driverOperations:[],progressLog:[],evidenceWriteErrors:[],
  deadlines:{bootMS:BOOT_MS,taskMS:TASK_MS,suiteMS:SUITE_MS,windowGroupMS:WINDOW_GROUP_MS,probeMS:PROBE_MS,gpuMS:GPU_MS,frameMS:FRAME_MS,captureMS:CAPTURE_MS,
    failureTotalMS:FAILURE_TOTAL_MS,failureStepMS:FAILURE_STEP_MS,browserCloseMS:CLOSE_MS},
  startupPassed:false,contactTestsRun:false,fullSuiteRun:false,windowTestsRun:false,completed:false,
  visualAcceptance:false,productionReady:false,publicURLVerified:false
};
let server,browser,context,page,cdp,heartbeat,checkpointTimer,heartbeatBusy=false,collecting=true,operationSequence=0;
const clip = value => String(value).slice(0,24000);

// Persist driver-owned facts without waiting on the browser. Atomic replacement
// leaves a readable previous checkpoint even if the CI step is interrupted.
function checkpoint(reason) {
  report.lastCheckpoint={at:new Date().toISOString(),reason,stage:report.currentStage};
  const records={
    'network.json':{requests:report.requests,failedRequests:report.failedRequests,httpErrors:report.httpErrors},
    'errors.json':{pageErrors:report.pageErrors,consoleErrors:report.consoleErrors,consoleWarnings:report.consoleWarnings,failure:report.failure},
    'qa.json':report,
    'checkpoint.json':{...report.lastCheckpoint,sourceHead,phase:PHASE,status:report.status || 'RUNNING',
      completed:report.completed,startupPassed:report.startupPassed,activeOperations:report.activeOperations,
      lastBootState:report.lastBootState,testCount:report.tests.length,requestCount:report.requests.length,
      pageErrorCount:report.pageErrors.length,consoleErrorCount:report.consoleErrors.length,
      screenshotCount:report.screenshots.length,failure:report.failure}
  };
  for(const [name,value] of Object.entries(records)) {
    try {put(name,value);}
    catch(error) {
      const issue={at:new Date().toISOString(),file:name,error:clip(error.message)};
      report.evidenceWriteErrors.push(issue);
      try {fs.writeSync(2,'[qa] checkpoint write failed '+JSON.stringify(issue)+'\n');}catch{}
    }
  }
}

function log(message,details) {
  const entry={at:new Date().toISOString(),stage:report.currentStage,message,...(details===undefined?{}:{details})};
  report.progressLog.push(entry);
  try {fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(entry)+'\n');}
  catch(error) {report.evidenceWriteErrors.push({at:entry.at,file:'progress.jsonl',error:clip(error.message)});}
  checkpoint(message);
  console.log('[qa] '+message+(details===undefined?'':' '+JSON.stringify(details)));
}

function stage(name) {report.currentStage=name;log('stage '+name);}

async function bounded(label,fn,budgetMS=PROBE_MS) {
  assert(Number.isFinite(budgetMS) && budgetMS>0,'A positive driver deadline is required: '+label);
  const id=String(++operationSequence),started=Date.now();
  const operation={id,label,startedAt:new Date(started).toISOString(),budgetMS};
  report.activeOperations[id]=operation;checkpoint('operation started: '+label);
  let timer,outcome='completed',failure;
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise((resolve,reject)=>{timer=setTimeout(()=>{
        const error=new Error('Driver deadline exceeded after '+budgetMS+' ms: '+label);
        error.code='NPC_DRIVER_TIMEOUT';reject(error);
      },budgetMS);})
    ]);
  } catch(error) {outcome=error.code==='NPC_DRIVER_TIMEOUT'?'timeout':'error';failure=clip(error.message);throw error;}
  finally {
    clearTimeout(timer);delete report.activeOperations[id];
    report.driverOperations.push({...operation,elapsedMS:Date.now()-started,outcome,...(failure?{error:failure}:{})});
    checkpoint('operation '+outcome+': '+label);
  }
}

const evaluate=(label,fn,arg,budgetMS=PROBE_MS)=>bounded(label,()=>page.evaluate(fn,arg),budgetMS);
const sendCDP=(label,method,args,budgetMS=PROBE_MS)=>bounded(label,()=>cdp.send(method,args),budgetMS);
const waitFor=(label,fn,arg,options)=>bounded(label,()=>page.waitForFunction(fn,arg,options),options.timeout+5000);

async function check(name,fn) {
  const started=Date.now();stage(name);
  try {const result=await fn();assert.notEqual(result,false);report.tests.push({name,passed:true,elapsedMS:Date.now()-started,result});log('PASS '+name);return result;}
  catch(error) {report.tests.push({name,passed:false,elapsedMS:Date.now()-started,error:clip(error.stack||error)});log('FAIL '+name,{error:clip(error.message)});throw error;}
}

async function bootState(budgetMS=PROBE_MS) {
  return evaluate('read native boot state',() => ({
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
  }),undefined,budgetMS);
}

async function pause(value) {
  const button=page.locator('#npc-pause');
  const current=/继续/.test(await button.textContent());
  if(current!==value) await button.click();
}

async function evidence(label,{nativeRigs=false,budgetMS=PROBE_MS}={}) {
  const captured=await evaluate('collect evidence: '+label,({nativeRigs}) => {
    const safe=fn=>{try{return fn();}catch(error){return{readError:String(error)};}};
    const qa=window.__IDENTITY_QA__,v=qa?.viewer?.(),model=qa?.model?.(),app=window.__NPC_OBSERVATION__;
    let actors=safe(()=>app?.actorDiagnostics?.() ?? app?.diagnostics?.()?.actors ?? null);
    // All original weights and matrices are retained in the initial/failure
    // raw-rig files. Later contacts need current geometry, not another 13 MB
    // serialization of the same immutable rig on every inspection.
    if(!nativeRigs && Array.isArray(actors))actors=actors.map(actor=>{
      const {rig,nativeRig,bindingRig,...current}=actor;
      return {...current,nativeRigEvidence:'native-rigs.json'};
    });
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
      windowRender:safe(()=>app?.windowRenderDiagnostics?.()),
      renderScheduler:safe(()=>app?.renderStatus?.()),nativeRigsIncluded:nativeRigs,
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
  },{nativeRigs},budgetMS);
  put(label+'.json',captured);
  if(nativeRigs) {
    put('BODY.json',{actors:captured.actorDiagnostics,meshes:captured.actorMeshes,snapshot:captured.snapshot});
    put('native-rigs.json',{sourceHead,version:VERSION,actors:captured.actorDiagnostics?.map?.(a=>({id:a.id,identity:a.identity,measurements:a.measurements,rig:a.rig || a.nativeRig || a.bindingRig})),hostRig:captured.native.hostRig});
    put('r05-stream.json',captured.native.stream || {});
    put('native-current-state.json',captured.native.state || {});
  }
  log('evidence saved '+label);return captured;
}

async function gpuEvidence() {
  const gpu=await evaluate('complete one native GPU frame and read its PBO',async()=>{
    const app=window.__NPC_OBSERVATION__,viewer=window.__IDENTITY_QA__.viewer(),renderer=viewer.renderer,gl=renderer.getContext();
    if(typeof app?.awaitFrame!=='function' || typeof app?.onRender!=='function' || typeof app?.renderStatus!=='function')
      throw Error('The actual native render scheduler does not expose awaitFrame/onRender/renderStatus');
    if(typeof gl.fenceSync!=='function' || typeof gl.getBufferSubData!=='function')
      throw Error('Real WebGL2 fence and pixel-pack-buffer completion are required');
    const began=performance.now(),schedulerBefore=app.renderStatus();
    const buffer=gl.createBuffer();if(!buffer)throw Error('Could not allocate the full-resolution GPU evidence readback buffer');
    let unsubscribe,captured=null,captureError=null;
    try {
      // Run immediately after the real host render, before the scheduler fence.
      // Read pixels into a PBO in that same JS turn: the default framebuffer is
      // not assumed to survive a later RAF. No extra render is issued here.
      unsubscribe=app.onRender(({serial})=>{
        unsubscribe?.();
        const started=performance.now(),previous=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
        try {
          const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
          if(width<=0 || height<=0)throw Error('The real native drawing buffer has no pixels');
          gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);
          gl.bufferData(gl.PIXEL_PACK_BUFFER,width*height*4,gl.STREAM_READ);
          gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,0);
          captured={width,height,renderFrame:renderer.info.render.frame,submittedSerial:serial,
            queuedAtMS:performance.now()-began,readCommandMS:performance.now()-started};
        } catch(error) {captureError=String(error.stack||error);}
        finally {gl.bindBuffer(gl.PIXEL_PACK_BUFFER,previous);}
      });
      const completedFrame=await app.awaitFrame({fresh:true}),completedAtMS=performance.now()-began;
      if(captureError)throw Error('Actual GPU readback command failed: '+captureError);
      if(!captured)throw Error('No real host render was observed for the requested fresh frame');
      const schedulerAfter=app.renderStatus();
      if(schedulerAfter.startupDrain?.completed!==true)throw Error('Earlier native startup GPU commands have not drained');
      if(!Number.isFinite(schedulerAfter.maxInFlight) || schedulerAfter.maxInFlight>1)
        throw Error('The native renderer queued more than one GPU frame');
      if(schedulerAfter.inFlight!==0 || schedulerAfter.submitted!==schedulerAfter.completed || schedulerAfter.completed!==captured.submittedSerial)
        throw Error('The measured framebuffer does not have its matching completed scheduler fence');
      const pixels=new Uint8Array(captured.width*captured.height*4),copyStarted=performance.now();
      const previous=gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
      try {gl.bindBuffer(gl.PIXEL_PACK_BUFFER,buffer);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,pixels);}
      finally {gl.bindBuffer(gl.PIXEL_PACK_BUFFER,previous);}
      const cpuCopyMS=performance.now()-copyStarted,readbackGLError=gl.getError();
      if(readbackGLError!==gl.NO_ERROR)throw Error('Actual GPU readback GL error '+readbackGLError);
      const debug=gl.getExtension('WEBGL_debug_renderer_info'),programStarted=performance.now();
      const programs=(renderer.info.programs || []).map(program=>({
        id:program.id,name:program.name,linked:!!program.program && gl.getProgramParameter(program.program,gl.LINK_STATUS),
        log:program.program?gl.getProgramInfoLog(program.program):'missing native WebGL program',usedTimes:program.usedTimes
      }));
      const programStatusMS=performance.now()-programStarted;
      let lo=255,hi=0,sum=0,sum2=0,count=0;
      for(let i=0;i<pixels.length;i+=16){const lum=(pixels[i]+pixels[i+1]+pixels[i+2])/3;lo=Math.min(lo,lum);hi=Math.max(hi,lum);sum+=lum;sum2+=lum*lum;count++;}
      const digest=await crypto.subtle.digest('SHA-256',pixels);
      return {available:!!gl,contextLost:gl.isContextLost(),vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),
        unmaskedVendor:debug?gl.getParameter(debug.UNMASKED_VENDOR_WEBGL):null,
        unmaskedRenderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null,
        version:gl.getParameter(gl.VERSION),shadingLanguage:gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        limits:{fragmentTextureUnits:gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),vertexTextureUnits:gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),combinedTextureUnits:gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)},
        programs,memory:renderer.info.memory,render:renderer.info.render,pixelRatio:renderer.getPixelRatio(),
        readback:{method:'full-resolution WebGL2 PBO; read command in actual host onRender before scheduler fence',
          verifierDirectRenders:0,completedFrame,readbackGLError,schedulerBefore,schedulerAfter,
          timing:{queuedAtMS:captured.queuedAtMS,readCommandMS:captured.readCommandMS,completedAtMS,
            waitAfterReadCommandMS:completedAtMS-captured.queuedAtMS,cpuCopyMS,programStatusMS,totalMS:performance.now()-began}},
        framebuffer:{width:captured.width,height:captured.height,renderFrame:captured.renderFrame,submittedSerial:captured.submittedSerial,lo,hi,
          variance:count?sum2/count-(sum/count)**2:0,
          sha256:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}};
    } finally {unsubscribe?.();gl.deleteBuffer(buffer);}
  },undefined,GPU_MS);
  put('gpu.json',gpu);
  return gpu;
}

async function screenshot(name) {
  const frame=await evaluate('await completed native screenshot frame: '+name,async()=>{
    const app=window.__NPC_OBSERVATION__,viewer=window.__IDENTITY_QA__?.viewer?.();
    if(typeof app?.awaitFrame!=='function' || typeof app?.renderStatus!=='function')throw Error('Real native frame completion is unavailable');
    const began=performance.now(),before=app.renderStatus(),completedFrame=await app.awaitFrame({fresh:true});
    const after=app.renderStatus();
    if(!Number.isFinite(after.maxInFlight) || after.maxInFlight>1)throw Error('More than one native GPU frame was in flight');
    if(after.inFlight!==0 || after.submitted!==after.completed)throw Error('Screenshot requested before its real native GPU frame completed');
    return {before,after,completedFrame,waitMS:performance.now()-began,renderFrame:viewer.renderer.info.render.frame,
      canvas:{width:viewer.renderer.domElement.width,height:viewer.renderer.domElement.height}};
  },undefined,FRAME_MS);
  const captureStarted=Date.now();
  const shot=await sendCDP('capture screenshot: '+name,'Page.captureScreenshot',{format:'png',captureBeyondViewport:false},CAPTURE_MS);
  const captureMS=Date.now()-captureStarted;
  const bytes=Buffer.from(shot.data,'base64'),file=name+'.png';
  fs.writeFileSync(path.join(out,file),bytes);
  const record={file,sha256:sha(bytes),bytes:bytes.length,url:page.url(),capturedAt:new Date().toISOString(),
    verifierDirectRenders:0,frame,captureMS};
  // Save the image's completed-frame proof before attempting further browser reads.
  report.screenshots.push(record);put(name+'-frame.json',record);checkpoint('screenshot pixels saved: '+name);
  record.afterCapture=await evaluate('read scheduler after screenshot: '+name,()=>({
    scheduler:window.__NPC_OBSERVATION__.renderStatus(),renderFrame:window.__IDENTITY_QA__.viewer().renderer.info.render.frame
  }));
  record.submittedDuringCapture=record.afterCapture.scheduler.submitted-frame.after.submitted;
  put(name+'-frame.json',record);
  log('screenshot '+file+' ('+bytes.length+' bytes)');
}

async function saveDOM(name='body-dom',budgetMS=PROBE_MS) {
  const dom=await evaluate('save DOM: '+name,()=>{
    const body=document.body.cloneNode(true);let scripts=0;
    for(const el of body.querySelectorAll('script')){scripts++;el.replaceWith(document.createComment('Inline script omitted from DOM evidence; complete source is SHA-bound in BUILD.json.'));}
    return {html:body.outerHTML,text:document.body.innerText,omittedScripts:scripts,title:document.title,url:location.href};
  },undefined,budgetMS);
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

const CONTACT_STAGES=['close','lift','transfer','lower','lower-end','verify'];
// Bottle recovery uses short intermediate stage names. Window recovery has
// separate '*-transition' names and a terminal 'rest' stage below.
const BOTTLE_RECOVERY_STAGES=[
  'withdraw-start','withdraw','withdraw-end',
  'rest-start','rest','rest-end'
];
const OTHER_SOLID_PENETRATION_M=.003;

// An operated cylinder keeps its existing 5 mm assisted-contact tolerance.
// Every other physical box/cylinder uses the existing 3 mm solid tolerance.
// Require the expected cylinder and its real descriptor so that omitting a
// neighbouring cylinder cannot silently produce a zero aggregate penetration.
function otherSolidViolations(geometry,{operatedObjectId,requiredCylinderId,poseMetadata=false}) {
  const violations=[];
  const requireValue=(pass,reason)=>{if(!pass)violations.push(reason);};
  requireValue(Number.isInteger(geometry?.solidSampleCount) && geometry.solidSampleCount>0,
    'Actual native hand/forearm samples against other solids are missing');
  const handCount=geometry?.solidParts?.hand?.sampleCount;
  const forearmCount=geometry?.solidParts?.forearm?.sampleCount;
  requireValue(Number.isInteger(handCount) && handCount>0 &&
    Number.isInteger(forearmCount) && forearmCount>0,
    'Other-solid diagnostics require both hand and forearm surface vertices');
  requireValue(handCount+forearmCount===geometry?.solidSampleCount,
    'Other-solid sample count must include the complete declared hand and forearm');
  requireValue(Number.isFinite(geometry?.solidMaxPenetrationM) &&
    geometry.solidMaxPenetrationM<=OTHER_SOLID_PENETRATION_M,
    'Native hand/forearm penetrates another physical solid by more than 3 mm');
  if(poseMetadata)requireValue(geometry?.operatedObjectId===operatedObjectId,
    'The driven pose must identify its operated object without reclassifying its contact tolerance');

  const byCylinder=geometry?.solidByCylinder;
  const required=byCylinder?.[requiredCylinderId];
  requireValue(Number.isInteger(required?.sampleCount) && required.sampleCount>0,
    'Expected non-operated cylinder lacks actual surface samples: '+requiredCylinderId);
  requireValue(!Object.hasOwn(byCylinder || {},operatedObjectId),
    'The operated cylinder must not be silently tightened to the other-solid 3 mm tolerance');
  for(const [kind,reports] of [['box',geometry?.solidByBox],['cylinder',byCylinder]]) {
    requireValue(reports && typeof reports==='object' && !Array.isArray(reports),
      'Per-object other-solid '+kind+' reports are missing');
    for(const [id,measured] of Object.entries(reports || {})) {
      requireValue(Number.isInteger(measured?.sampleCount) && measured.sampleCount>0,
        'Other '+kind+' has no native surface samples: '+id);
      requireValue(measured?.sampleCount===geometry?.solidSampleCount,
        'Other '+kind+' must sample the same complete hand and forearm surface: '+id);
      requireValue(Number.isFinite(measured?.maxPenetrationM) &&
        measured.maxPenetrationM<=OTHER_SOLID_PENETRATION_M,
        'Native hand/forearm penetrates other '+kind+' by more than 3 mm: '+id);
    }
  }

  const cylinders=geometry?.solidCylinders;
  requireValue(Array.isArray(cylinders) && cylinders.some(shape=>shape?.id===requiredCylinderId),
    'The expected other cylinder must retain its actual pose and dimensions: '+requiredCylinderId);
  for(const shape of Array.isArray(cylinders)?cylinders:[]) {
    if(!shape || typeof shape!=='object') {
      requireValue(false,'An actual other-cylinder descriptor is missing');
      continue;
    }
    requireValue(shape.id!==operatedObjectId,
      'The operated cylinder is incorrectly included among other solid descriptors');
    requireValue(Array.isArray(shape.position) && shape.position.length===3 && shape.position.every(Number.isFinite),
      'Other-cylinder position is not a finite world-space point: '+shape.id);
    requireValue(Array.isArray(shape.quaternion) && shape.quaternion.length===4 &&
      shape.quaternion.every(Number.isFinite) && Math.abs(Math.hypot(...shape.quaternion)-1)<1e-4,
      'Other-cylinder orientation is not a normalized world-space quaternion: '+shape.id);
    requireValue(Number.isFinite(shape.radius) && shape.radius>0 &&
      Number.isFinite(shape.height) && shape.height>0,
      'Other-cylinder finite dimensions are missing: '+shape.id);
    requireValue(Number.isInteger(byCylinder?.[shape.id]?.sampleCount) && byCylinder[shape.id].sampleCount>0,
      'A declared other cylinder was not sampled: '+shape.id);
    const measuredShape=byCylinder?.[shape.id]?.geometry;
    requireValue(measuredShape?.kind==='finite-local-Y-cylinder',
      'Other-cylinder report must identify the finite cylinder including its caps: '+shape.id);
    requireValue(Array.isArray(measuredShape?.position) &&
      measuredShape.position.length===3 && measuredShape.position.every((value,index)=>
        Number.isFinite(value) && Math.abs(value-shape.position?.[index])<1e-10),
      'Other-cylinder measurement and source world position disagree: '+shape.id);
    const sourceQ=shape.quaternion,measuredQ=measuredShape?.quaternion;
    const validQ=Array.isArray(sourceQ) && sourceQ.length===4 && sourceQ.every(Number.isFinite) &&
      Array.isArray(measuredQ) && measuredQ.length===4 && measuredQ.every(Number.isFinite) &&
      Math.hypot(...sourceQ)>0 && Math.abs(Math.hypot(...measuredQ)-1)<1e-10;
    const quaternionDot=validQ?sourceQ.reduce((sum,value,index)=>sum+value*measuredQ[index],0)/Math.hypot(...sourceQ):null;
    requireValue(validQ && Math.abs(Math.abs(quaternionDot)-1)<1e-10,
      'Other-cylinder measurement and source orientation disagree: '+shape.id);
    requireValue(measuredShape?.radius===shape.radius && measuredShape?.height===shape.height,
      'Other-cylinder measurement and source finite dimensions disagree: '+shape.id);
  }
  return violations;
}

async function auditCursor(label) {
  return evaluate('read phase geometry cursor: '+label,()=>{
    const poses=window.__NPC_OBSERVATION__.snapshot().audit.poses;
    return poses.length?poses[poses.length-1].time:-1;
  });
}

function checkAuditGeometry(snapshot,label,{
  afterTime=-1,id=null,requiredActors=[],requireRecovery=false,expectedTaskCounts=null
}={}) {
  const samples=snapshot.audit?.poses;
  assert(Array.isArray(samples),'Actual driven-pose audit is exported: '+label);
  // Include every recorded phase, including approach and recovery. The old
  // contact-only filter hid collisions with a neighbouring window handle.
  const rows=samples.filter(sample=>(!Number.isFinite(sample.time) || sample.time>afterTime) &&
    (!id || sample.id===id));
  const violations=[];
  if(!rows.length)violations.push({id,reason:'no actual contact-phase samples were exported'});
  const requireValue=(pass,sample,reason)=>{if(!pass)violations.push({id:sample.id,stage:sample.stage,time:sample.time,reason});};
  for(const sample of rows) {
    requireValue(Number.isFinite(sample.taskStartedTime),sample,'the actual task identity is missing from the driven pose');
    requireValue(Number.isFinite(sample.time) && sample.time>=sample.taskStartedTime,
      sample,'the driven pose precedes its actual task or has no finite time');
    requireValue(Number.isFinite(sample.boneLengthErrorM) && sample.boneLengthErrorM<=1e-8,sample,'native bone drift exceeds 1e-8 m or is unavailable');
    requireValue(Number.isFinite(sample.footSurfaceErrorM) && sample.footSurfaceErrorM<=.00002,sample,'native foot surface drift exceeds 0.02 mm or is unavailable');
    for(const side of ['L','R'])requireValue(Number.isFinite(sample.footWorldYM?.[side]) && Math.abs(sample.footWorldYM[side])<=.003,sample,'actual '+side+' foot is outside floor tolerance of 3 mm');
    requireValue(typeof sample.supportEnabled==='boolean',sample,'actual support state is unavailable');
    requireValue(Number.isInteger(sample.handTableSampleCount) && sample.handTableSampleCount>=0,sample,'projected hand vertex count is unavailable');
    if(sample.supportEnabled && sample.handTableSampleCount>0)requireValue(Number.isFinite(sample.handTableClearanceM) && sample.handTableClearanceM>=-.003,sample,'actual hand vertices penetrate the existing tabletop by more than 3 mm');
    if(CONTACT_STAGES.includes(sample.stage))requireValue(Number.isFinite(sample.bottleMaxPenetrationM) && sample.bottleMaxPenetrationM<=.005,sample,'actual hand vertices penetrate the finite bottle cylinder by more than 5 mm');
    for(const reason of otherSolidViolations(sample,{
      operatedObjectId:'bottle-01',requiredCylinderId:'window-handle-01',poseMetadata:true
    }))requireValue(false,sample,reason);
    if(sample.stage==='rest-end')requireValue(Number.isFinite(sample.restPoseErrorRad) && sample.restPoseErrorRad<=1e-4,
      sample,'completed native bottle recovery did not reach the original rest pose');
  }
  for(const actorId of requiredActors)for(const required of CONTACT_STAGES) {
    if(!rows.some(sample=>sample.id===actorId && sample.stage===required))violations.push({id:actorId,stage:required,reason:'required actual driven-pose sample is missing'});
  }
  const recovery=[],taskCounts={};
  if(requireRecovery) {
    const tasks=new Map();
    for(const sample of rows) {
      const key=sample.id+':'+sample.taskStartedTime;
      if(!tasks.has(key))tasks.set(key,[]);
      tasks.get(key).push(sample);
    }
    for(const taskRows of tasks.values()) {
      const first=taskRows[0];
      taskCounts[first.id]=(taskCounts[first.id]||0)+1;
      for(let index=1;index<taskRows.length;index++) {
        if(taskRows[index].time<taskRows[index-1].time)violations.push({
          id:first.id,taskStartedTime:first.taskStartedTime,
          reason:'actual bottle task samples are not in chronological order'
        });
      }
      for(const stage of BOTTLE_RECOVERY_STAGES) {
        if(!taskRows.some(sample=>sample.stage===stage))
          violations.push({id:first.id,taskStartedTime:first.taskStartedTime,stage,reason:'required actual bottle exit sample is missing'});
      }
      const summary={id:first.id,taskStartedTime:first.taskStartedTime};
      for(const [name,stages] of [
        ['withdrawal',['withdraw-start','withdraw','withdraw-end']],
        ['rest',['rest-start','rest','rest-end']]
      ]) {
        const selected=taskRows.filter(sample=>stages.includes(sample.stage));
        const transitionCount=selected.filter(sample=>sample.stage===stages[1]).length;
        let maxSampleGapSeconds=0;
        for(let index=1;index<selected.length;index++)maxSampleGapSeconds=Math.max(maxSampleGapSeconds,
          selected[index].time-selected[index-1].time);
        if(transitionCount<4 || maxSampleGapSeconds>.15)violations.push({
          id:first.id,taskStartedTime:first.taskStartedTime,stage:name,
          reason:'actual bottle exit lacks intermediate surface samples at at most 0.15 second gaps',
          transitionCount,maxSampleGapSeconds
        });
        summary[name]={transitionCount,maxSampleGapSeconds};
      }
      recovery.push(summary);
    }
    for(const [actorId,expected] of Object.entries(expectedTaskCounts || {})) {
      if(taskCounts[actorId]!==expected)violations.push({
        id:actorId,reason:'an entire expected bottle task is missing from the phase audit or duplicated',
        expectedTaskCount:expected,actualTaskCount:taskCounts[actorId]||0
      });
    }
  }
  const result={label,afterTime,accepted:violations.length===0,scope:'Measured rendered hand vertices at actual driven phases; no continuous triangle collision or finger force claim',
    thresholds:{boneLengthErrorM:1e-8,footSurfaceErrorM:.00002,footWorldAbsoluteYM:.003,existingTablePenetrationM:.003,bottlePenetrationM:.005,otherSolidPenetrationM:OTHER_SOLID_PENETRATION_M},
    tableGate:'Only supportEnabled and hand vertices inside the tabletop XZ projection',
    bottleGate:'Actual finite-cylinder SDF in close, lift, transfer, lower, lower-end and verify samples',
    otherSolidGate:'Actual full native hand and forearm against physical boxes and non-operated finite cylinders in every recorded phase and exit; window-handle-01 must be sampled',
    requiredActors,requiredStages:CONTACT_STAGES,requireRecovery,expectedTaskCounts,taskCounts,recovery,rows,violations};
  // Preserve every measurement, including all violations, before asserting.
  put('phase-geometry-'+label+'.json',result);
  assert(rows.length>0,'At least one actual contact-phase sample is required: '+label);
  assert.equal(violations.length,0,'Actual phase geometry failed: '+JSON.stringify(violations));
  return {sampleCount:rows.length,accepted:true,requiredActors,taskCounts,recovery};
}

const WINDOW_TARGET_DEG={open:-35,close:0};
const WINDOW_TOLERANCES={
  angleErrorDeg:2,
  angularSpeedRadS:.05,
  quaternionAngleErrorDeg:.05,
  handContactErrorM:.025,
  handlePenetrationM:.005,
  solidPenetrationM:.003,
  restPoseErrorRad:1e-4
};

function checkWindowObject(windowSnapshot,label,{heldBy=null,operation=null}={}) {
  const object=windowSnapshot?.object;
  assert.equal(object?.id,'window-01','Actual window rigid body is exported: '+label);
  assert.equal(object.hingeConstraintCount,1,'The permanent hinge exists: '+label);
  assert(Number.isInteger(object.gripConstraintCount) && object.gripConstraintCount>=0 && object.gripConstraintCount<=1,
    'There is at most one temporary window hand constraint: '+label);
  assert(Number.isFinite(object.angleDeg),'Actual rigid-body window angle is finite: '+label);
  assert(Number.isFinite(object.angularVelocityRadS),'Actual angular speed is finite: '+label);
  assert(Array.isArray(object.position) && object.position.length===3 && object.position.every(Number.isFinite),
    'Actual window position is finite: '+label);
  const q=object.quaternion;
  assert(Array.isArray(q) && q.length===4 && q.every(Number.isFinite),
    'Actual window quaternion is exported: '+label);
  assert(Math.abs(Math.hypot(...q)-1)<1e-4,'Window quaternion is normalized: '+label);
  const [x,y,z,w]=q;
  const quaternionAngleDeg=Math.atan2(2*(w*y-x*z),1-2*(y*y+z*z))*180/Math.PI;
  assert(Math.abs(quaternionAngleDeg-object.angleDeg)<=WINDOW_TOLERANCES.quaternionAngleErrorDeg,
    'Reported angle agrees with the live rigid-body quaternion: '+label);
  assert.equal(object.maxGripForcePerAxisN,24,'The locked hand force limit is 24 N per axis: '+label);
  assert(Array.isArray(object.forcePerAxisN) && object.forcePerAxisN.length===3 &&
    object.forcePerAxisN.every(value=>Number.isFinite(value) && Math.abs(value)<=24.00001),
    'Actual solver forces are finite and remain within the hand-force bound: '+label);
  if(heldBy!==null) {
    assert.equal(object.heldBy,heldBy,'The selected native person actually holds the window: '+label);
    assert.equal(object.reservedBy,heldBy,'The holder owns the same window resource: '+label);
    assert.equal(object.gripConstraintCount,1,'The actual temporary hand constraint exists: '+label);
  }
  if(operation!==null) {
    assert(Object.hasOwn(WINDOW_TARGET_DEG,operation),'Known window operation: '+operation);
    const target=WINDOW_TARGET_DEG[operation];
    assert.equal(object.targetAngleDeg,target,'The target is the requested physical angle: '+label);
    assert(Math.abs(object.angleDeg-target)<WINDOW_TOLERANCES.angleErrorDeg,
      'The actual leaf reached the target angle: '+label);
    assert(Math.abs(object.angularVelocityRadS)<WINDOW_TOLERANCES.angularSpeedRadS,
      'The released leaf has sufficiently low actual angular speed: '+label);
    assert.equal(object.settled,true,'The actual leaf is settled: '+label);
    assert.equal(object[operation==='open'?'goalOpen':'goalClosed'],true,
      'The requested physical window goal is satisfied: '+label);
    assert.equal(object.heldBy,null,'Success releases temporary hand ownership: '+label);
    assert.equal(object.reservedBy,null,'Success releases the window reservation: '+label);
    assert.equal(object.gripConstraintCount,0,'Success has no temporary hand constraint: '+label);
  }
  return {object,quaternionAngleDeg,tolerances:WINDOW_TOLERANCES};
}

function checkWindowRest(actors,label,requiredIds=['A','B','C']) {
  const feet=checkFeetAndBones(actors,label);
  const rest=requiredIds.map(id=>{
    const actor=actors.find(item=>item.id===id);
    const error=actor?.diagnostics?.restPoseErrorRad;
    assert(Number.isFinite(error) && error<=WINDOW_TOLERANCES.restPoseErrorRad,
      'Native local rotations returned to rest: '+id+' / '+label+' / '+error);
    return {id,restPoseErrorRad:error};
  });
  return {feet,rest};
}

function distance3(a,b) {
  assert(Array.isArray(a) && a.length===3 && a.every(Number.isFinite),'First actual 3D point is finite');
  assert(Array.isArray(b) && b.length===3 && b.every(Number.isFinite),'Second actual 3D point is finite');
  return Math.hypot(...a.map((value,index)=>value-b[index]));
}

function checkWindowRender(captured,label) {
  const rendered=captured.windowRender;
  const object=captured.snapshot?.window?.object;
  assert(rendered && !rendered.readError,'Live window render diagnostics exist: '+label);
  assert.equal(rendered.visible,true,'The actual window meshes are visible: '+label);
  const leafErrorM=distance3(rendered.leafWorldPosition,object.position);
  const handleErrorM=distance3(rendered.handleWorldPosition,object.handleCentre);
  assert(leafErrorM<=1e-5,'Visible window leaf follows the actual rigid body: '+label);
  assert(handleErrorM<=1e-5,'Visible handle follows its actual rigid-body transform: '+label);
  const q=rendered.leafWorldQuaternion;
  assert(Array.isArray(q) && q.length===4 && q.every(Number.isFinite),
    'Visible window leaf quaternion is finite: '+label);
  const dot=Math.abs(q.reduce((sum,value,index)=>sum+value*object.quaternion[index],0));
  const quaternionErrorRad=2*Math.acos(Math.min(1,dot));
  assert(quaternionErrorRad<=1e-4,'Visible window orientation matches the actual rigid body: '+label);
  return {leafErrorM,handleErrorM,quaternionErrorRad,rendered};
}

function checkActorResourceExclusion(snapshot,label) {
  const active=agent=>!!agent &&
    (!['idle','done','failed','cancelled'].includes(agent.phase) || !!agent.recovery);
  const states=['A','B','C'].map(id=>{
    const table=snapshot.agents.find(agent=>agent.id===id);
    const windowAgent=snapshot.window.agents.find(agent=>agent.id===id);
    const tableActive=active(table),windowActive=active(windowAgent);
    assert(!(tableActive && windowActive),
      'One native person cannot execute table and window tasks simultaneously: '+id+' / '+label);
    return {id,tableActive,windowActive};
  });
  return states;
}

function checkWindowContact(captured,id,label) {
  const windowSnapshot=captured.snapshot.window;
  const actual=checkWindowObject(windowSnapshot,label,{heldBy:id});
  const actor=captured.actorDiagnostics.find(item=>item.id===id);
  const hand=actor?.windowDiagnostics;
  const agent=windowSnapshot.agents.find(item=>item.id===id);
  const violations=[];
  const requireValue=(pass,reason)=>{if(!pass)violations.push(reason);};
  requireValue(hand?.objectId==='window-handle-01','Native hand diagnostics target the actual window handle');
  const palmErrorM=distance3(actor?.diagnostics?.palm,actual.object.handleAnchor);
  requireValue(palmErrorM<WINDOW_TOLERANCES.handContactErrorM,
    'Rendered palm is more than 25 mm from the live handle anchor');
  requireValue(Number.isFinite(agent?.contactErrorM) &&
    Math.abs(agent.contactErrorM-palmErrorM)<1e-4,
    'Reported contact error must agree with the actual native surface point');
  requireValue(Number.isInteger(hand?.bottleSampleCount) && hand.bottleSampleCount>0,
    'The complete native weighted hand surface is sampled against the handle');
  requireValue(Number.isFinite(hand?.bottleMaxPenetrationM) &&
    hand.bottleMaxPenetrationM<=WINDOW_TOLERANCES.handlePenetrationM,
    'Actual hand surface penetrates the finite handle cylinder by more than 5 mm');
  for(const reason of otherSolidViolations(hand,{
    operatedObjectId:'window-handle-01',requiredCylinderId:'bottle-01'
  }))requireValue(false,reason);
  const result={
    label,id,accepted:violations.length===0,
    scope:'Actual native hand and forearm vertices at the captured physical interaction; no continuous triangle or finger-friction guarantee',
    object:actual.object,palmErrorM,reportedContactErrorM:agent?.contactErrorM,
    hand,tolerances:WINDOW_TOLERANCES,violations
  };
  put('window-geometry-'+label+'.json',result);
  assert.equal(violations.length,0,'Actual window-contact geometry failed: '+JSON.stringify(violations));
  return {...result,feet:checkFeetAndBones(captured.actorDiagnostics,label),
    render:checkWindowRender(captured,label),resourceExclusion:checkActorResourceExclusion(captured.snapshot,label)};
}

function checkRestErrors(errors,label) {
  for(const id of ['A','B','C']) {
    assert(Number.isFinite(errors?.[id]) && errors[id]<=WINDOW_TOLERANCES.restPoseErrorRad,
      'The completed case measured native rest rotations for '+id+' / '+label);
  }
  return errors;
}

const WINDOW_APPROACH_STAGES=['approach-start','approach-transition','approach-end'];

function auditWindowPoses(windowSnapshot,token,label,{fullSwing=false}={}) {
  const rows=windowSnapshot.audit?.poses?.filter(pose=>pose.taskToken===token);
  assert(Array.isArray(rows) && rows.length>0,'Actual driven window poses are exported: '+label);
  const violations=[];
  const requireValue=(pass,pose,reason)=>{
    if(!pass)violations.push({id:pose.id,stage:pose.stage,time:pose.time,angleDeg:pose.angleDeg,reason});
  };
  for(const pose of rows) {
    requireValue(pose.nativeGeometryMeasured===true && pose.finite===true,pose,'Complete native geometry and pose are finite');
    requireValue(Number.isFinite(pose.boneLengthErrorM) && pose.boneLengthErrorM<=1e-8,pose,'Native bone length drift');
    requireValue(Number.isFinite(pose.footSurfaceErrorM) && pose.footSurfaceErrorM<=.00002,pose,'Native foot surface drift');
    for(const side of ['L','R']) {
      requireValue(Number.isFinite(pose.footWorldYM?.[side]) && Math.abs(pose.footWorldYM[side])<=.003,
        pose,'Actual '+side+' foot leaves the shared floor tolerance');
    }
    requireValue(pose.hingeConstraintCount===1,pose,'Permanent hinge is absent');
    requireValue(Number.isInteger(pose.gripConstraintCount) && pose.gripConstraintCount>=0 && pose.gripConstraintCount<=1,
      pose,'Temporary grip count is invalid');
    for(const reason of otherSolidViolations(pose,{
      operatedObjectId:'window-handle-01',requiredCylinderId:'bottle-01',poseMetadata:true
    }))requireValue(false,pose,reason);
    if(pose.heldBy===pose.id) {
      requireValue(pose.reachClamped===false,pose,'Actual native window reach was clamped');
      requireValue(Number.isFinite(pose.contactErrorM) &&
        pose.contactErrorM<WINDOW_TOLERANCES.handContactErrorM,
        pose,'Actual palm/handle separation exceeds 25 mm');
    }
    if(pose.heldBy===pose.id || WINDOW_APPROACH_STAGES.includes(pose.stage)) {
      requireValue(Number.isFinite(pose.maxHandlePenetrationM) &&
        pose.maxHandlePenetrationM<=WINDOW_TOLERANCES.handlePenetrationM,
        pose,'Actual hand penetrates the finite handle cylinder by more than 5 mm');
    }
    if(pose.stage==='rest') {
      requireValue(Number.isFinite(pose.restPoseErrorRad) &&
        pose.restPoseErrorRad<=WINDOW_TOLERANCES.restPoseErrorRad,
        pose,'Actual native local rotations did not return to rest');
    }
  }
  for(const stage of ['contact','release','withdraw-start','withdraw-end','rest-start','rest']) {
    if(!rows.some(pose=>pose.stage===stage))violations.push({stage,reason:'Required actual driven phase is absent'});
  }
  // These callers audit tasks that reached real handle contact, including
  // mid-swing cancellation. A cancellation before contact has no invented end.
  const approach=rows.filter(pose=>WINDOW_APPROACH_STAGES.includes(pose.stage));
  for(const stage of WINDOW_APPROACH_STAGES) {
    if(!approach.some(pose=>pose.stage===stage))violations.push({
      stage,reason:'Actual window approach before contact lacks a required surface sample'
    });
  }
  const approachStart=approach.find(pose=>pose.stage==='approach-start');
  const approachEnd=approach.find(pose=>pose.stage==='approach-end');
  const approachTransitionCount=approach.filter(pose=>pose.stage==='approach-transition').length;
  let maxApproachSampleGapSeconds=0,maxApproachIKHandErrorM=null;
  for(let index=0;index<approach.length;index++) {
    const pose=approach[index],motion=pose.approach;
    requireValue(pose.phase==='approach' && pose.gripConstraintCount===0 && pose.heldBy!==pose.id,
      pose,'Approach evidence must precede actual handle attachment');
    requireValue(Number.isFinite(pose.time) && Number.isFinite(motion?.elapsed) && motion.elapsed>=0,
      pose,'Actual approach time is missing');
    if(pose.stage==='approach-start') {
      requireValue(motion?.elapsed===0,pose,'Approach start must preserve the actual initial pose at zero elapsed time');
    }
    // A segment may interpolate native local joint rotations without issuing
    // an IK target. Preserve its raw metadata; do not invent a requested palm
    // or constrain the producer to an unaccepted candidate's segment names.
    if(Array.isArray(motion?.requestedPalm) && motion.requestedPalm.length===3 &&
      motion.requestedPalm.every(Number.isFinite) && Number.isFinite(pose.handErrorM))
      maxApproachIKHandErrorM=Math.max(maxApproachIKHandErrorM??0,pose.handErrorM);
    if(approachStart && Number.isFinite(motion?.elapsed))requireValue(
      Math.abs(pose.time-approachStart.time-motion.elapsed)<1e-6,
      pose,'Approach elapsed time disagrees with the same task world-time interval');
    if(index>0) {
      const gap=pose.time-approach[index-1].time;
      requireValue(Number.isFinite(gap) && gap>=0,pose,'Approach samples are not chronologically ordered');
      maxApproachSampleGapSeconds=Math.max(maxApproachSampleGapSeconds,gap);
    }
  }
  if(approachTransitionCount<4 || maxApproachSampleGapSeconds>.15)violations.push({
    reason:'Actual window approach lacks intermediate surface samples at at most 0.15 second gaps',
    approachTransitionCount,maxApproachSampleGapSeconds
  });
  if(approachStart && approachEnd) {
    requireValue(rows.indexOf(approachStart)<rows.indexOf(approachEnd) &&
      rows.indexOf(approachEnd)<rows.findIndex(pose=>pose.stage==='contact'),approachEnd,
      'Actual approach start, end and handle contact are not in causal order');
  }
  const approachDurationSeconds=approachStart && approachEnd?approachEnd.time-approachStart.time:null;
  const approachSegments=[...new Set(approach.map(pose=>pose.approach?.segment).filter(value=>typeof value==='string'))];
  const recovery=rows.filter(pose=>['rest-start','rest-transition','rest'].includes(pose.stage));
  const recoveryTransitionCount=recovery.filter(pose=>pose.stage==='rest-transition').length;
  if(recoveryTransitionCount<4)violations.push({reason:'Native rest recovery lacks intermediate surface samples'});
  let maxRecoverySampleGapSeconds=0;
  for(let index=1;index<recovery.length;index++) {
    maxRecoverySampleGapSeconds=Math.max(maxRecoverySampleGapSeconds,recovery[index].time-recovery[index-1].time);
  }
  if(maxRecoverySampleGapSeconds>.15)violations.push({
    reason:'Native rest recovery surface sample gap exceeds 0.15 seconds',maxRecoverySampleGapSeconds
  });
  const withdrawal=rows.filter(pose=>['withdraw-start','withdraw-transition','withdraw-end'].includes(pose.stage));
  const withdrawalTransitionCount=withdrawal.filter(pose=>pose.stage==='withdraw-transition').length;
  if(withdrawalTransitionCount<4)violations.push({reason:'Native hand withdrawal lacks intermediate surface samples'});
  let maxWithdrawalSampleGapSeconds=0;
  for(let index=1;index<withdrawal.length;index++) {
    maxWithdrawalSampleGapSeconds=Math.max(maxWithdrawalSampleGapSeconds,withdrawal[index].time-withdrawal[index-1].time);
  }
  if(maxWithdrawalSampleGapSeconds>.15)violations.push({
    reason:'Native hand withdrawal surface sample gap exceeds 0.15 seconds',maxWithdrawalSampleGapSeconds
  });
  const arc=rows.filter(pose=>['contact','swing','release'].includes(pose.stage));
  const swingCount=arc.filter(pose=>pose.stage==='swing').length;
  let maxSampleAngleGapDeg=0;
  for(let index=1;index<arc.length;index++) {
    maxSampleAngleGapDeg=Math.max(maxSampleAngleGapDeg,Math.abs(arc[index].angleDeg-arc[index-1].angleDeg));
  }
  if(fullSwing) {
    if(swingCount<5)violations.push({reason:'The actual full swing lacks intermediate native geometry samples'});
    if(arc.length<2 || Math.abs(arc.at(-1).angleDeg-arc[0].angleDeg)<30)
      violations.push({reason:'Sampled contact motion did not traverse the actual full window range'});
    if(maxSampleAngleGapDeg>6)violations.push({reason:'Actual full-swing geometry sample gap exceeds 6 degrees',maxSampleAngleGapDeg});
  }
  const result={
    label,taskToken:token,accepted:violations.length===0,fullSwing,
    scope:'Actual native hand/forearm against physical boxes and non-operated cylinders during approach, contact, approximately every 5 degrees, release, and approximately every 0.1 seconds of approach, withdrawal and native rest recovery; operated-handle hand SDF uses the unchanged 5 mm gate during approach and holding; no continuous triangle-collision guarantee',
    thresholds:WINDOW_TOLERANCES,rows,swingCount,maxSampleAngleGapDeg,
    approachTransitionCount,maxApproachSampleGapSeconds,approachDurationSeconds,approachSegments,maxApproachIKHandErrorM,
    withdrawalTransitionCount,maxWithdrawalSampleGapSeconds,
    recoveryTransitionCount,maxRecoverySampleGapSeconds,violations
  };
  const file='window-poses-'+token.replace(/[^a-zA-Z0-9_-]/g,'-')+'.json';
  put(file,result);
  assert.equal(violations.length,0,'Actual along-path window geometry failed: '+JSON.stringify(violations));
  return {file,taskToken:token,accepted:true,sampleCount:rows.length,swingCount,maxSampleAngleGapDeg,
    approachTransitionCount,maxApproachSampleGapSeconds,approachDurationSeconds,approachSegments,maxApproachIKHandErrorM,
    withdrawalTransitionCount,maxWithdrawalSampleGapSeconds,
    recoveryTransitionCount,maxRecoverySampleGapSeconds};
}

function checkWindowReceipt(windowSnapshot,id,operation,label,{alreadyAtTarget=false}={}) {
  checkWindowObject(windowSnapshot,label,{operation});
  const agent=windowSnapshot.agents.find(item=>item.id===id);
  const result=agent?.result;
  assert.equal(agent?.phase,'done','The requested window task completed: '+label);
  assert.equal(agent.recovery,null,'Window task withdrawal and native rest recovery completed: '+label);
  assert.equal(result?.result,alreadyAtTarget?'already-at-target':'completed',label);
  assert.equal(result.operation,operation,'Receipt names the requested operation: '+label);
  assert.equal(result.targetAngleDeg,WINDOW_TARGET_DEG[operation],label);
  assert(Math.abs(result.actualAngleDeg-result.targetAngleDeg)<WINDOW_TOLERANCES.angleErrorDeg,label);
  assert(Math.abs(result.angularVelocityRadS)<WINDOW_TOLERANCES.angularSpeedRadS,label);
  assert(Number.isFinite(result.settleSeconds) && result.settleSeconds>=.6,
    'Success includes at least 0.6 seconds of actual released stability: '+label);
  assert.equal(result.gripConstraintCount,0,label);
  assert.equal(result.hingeConstraintCount,1,label);
  assert.equal(result.released,true,label);
  assert(typeof result.taskToken==='string' && result.taskToken.startsWith(id+':window:'),
    'Receipt carries the actual actor/task token: '+label);
  assert(Number.isInteger(result.windowRevision),'Receipt carries its actual world revision: '+label);
  const token=result.taskToken;
  const events=windowSnapshot.events;
  assert(Array.isArray(events),'Versioned window events are available: '+label);
  const requested=events.find(event=>event.type==='window-requested' && event.token===token);
  const completed=events.find(event=>event.type==='window-task-result' && event.taskToken===token);
  assert(requested && completed,'The same real task has request and result events: '+label);
  assert(requested.windowEventSeq<completed.windowEventSeq,'Request precedes its result: '+label);
  assert.equal(requested.operation,operation,label);
  const contacts=windowSnapshot.audit.contacts.filter(contact=>contact.taskToken===token);
  if(alreadyAtTarget) {
    assert.equal(contacts.length,0,'Already-open work does not invent a second grip: '+label);
  }else {
    assert.equal(contacts.length,1,'Exactly one actual handle attachment for this task: '+label);
    const contact=contacts[0];
    assert.equal(contact.id,id,label);
    assert.equal(contact.operation,operation,label);
    assert.equal(contact.nativeGeometryMeasured,true,'The complete native surface was measured: '+label);
    assert.equal(contact.reachClamped,false,'The native handle reach is feasible: '+label);
    assert.equal(contact.graspAdmissible,true,'The actual native grasp calibration is admissible: '+label);
    assert(distance3(contact.palm,contact.handleAnchor)<=.012,
      'Actual native surface contact passed the 12 mm attachment gate: '+label);
    assert(contact.boneLengthErrorM<=1e-8 && Number.isFinite(contact.boneLengthErrorM),label);
    assert(contact.footSurfaceErrorM<=.00002 && Number.isFinite(contact.footSurfaceErrorM),label);
    assert(Number.isFinite(contact.maxHandlePenetrationM) &&
      contact.maxHandlePenetrationM<=WINDOW_TOLERANCES.handlePenetrationM,label);
    assert(Number.isFinite(result.maxContactErrorM) &&
      result.maxContactErrorM<WINDOW_TOLERANCES.handContactErrorM,
      'The physical grip stayed within the measured contact bound: '+label);
    const released=events.find(event=>event.type==='window-released' && event.taskToken===token);
    const restored=events.find(event=>event.type==='window-restored' && event.taskToken===token);
    assert(released && restored,'The same task actually released and recovered native rest: '+label);
    assert.equal(released.gripConstraintCount,0,label);
    assert.equal(released.hingeConstraintCount,1,label);
    assert(released.windowEventSeq<completed.windowEventSeq &&
      completed.windowEventSeq<restored.windowEventSeq,
      'Release, verified result and native rest recovery occur in order: '+label);
    assert.equal(restored.nativeRecoveryImplemented,true,label);
    assert(Number.isFinite(restored.restPoseErrorRad) &&
      restored.restPoseErrorRad<=WINDOW_TOLERANCES.restPoseErrorRad,label);
    const expected=['waiting','approach','close-grip','swing','verify'];
    let previous=-1;
    for(const phase of expected) {
      const index=result.phases.indexOf(phase);
      assert(index>previous,'Actual phase order includes '+phase+' / '+label);
      previous=index;
    }
  }
  assert(windowSnapshot.audit.physicsSteps>0,'Actual physics steps were performed: '+label);
  assert(windowSnapshot.audit.maxOwners<=1 && windowSnapshot.audit.maxGripConstraints<=1,
    'A single resource owner and temporary grip were observed: '+label);
  assert(Number.isFinite(windowSnapshot.audit.maxGripForcePerAxisN) &&
    windowSnapshot.audit.maxGripForcePerAxisN<=24.00001,
    'Observed solver force respects the finite-force bound: '+label);
  const poseGeometry=alreadyAtTarget?null:auditWindowPoses(windowSnapshot,token,label,{fullSwing:true});
  return {id,operation,result,requestSequence:requested.windowEventSeq,
    resultSequence:completed.windowEventSeq,contactCount:contacts.length,poseGeometry};
}

function checkWindowCancellation(before,immediate,final,id,label) {
  checkWindowObject(before,label+' before cancel',{heldBy:id});
  checkWindowObject(immediate,label+' immediately after cancel');
  checkWindowObject(final,label+' after native recovery');
  assert(before.object.angleDeg< -5 && before.object.angleDeg> -30,
    'Cancellation occurred during actual partial opening: '+label);
  assert.equal(immediate.object.gripConstraintCount,0,label);
  assert.equal(immediate.object.heldBy,null,label);
  assert.equal(immediate.object.reservedBy,null,label);
  assert(distance3(before.object.position,immediate.object.position)<1e-10,
    'Cancel does not teleport the physical window: '+label);
  assert(before.object.quaternion.every((value,index)=>
    Math.abs(value-immediate.object.quaternion[index])<1e-10),
    'Cancel preserves the instantaneous actual leaf orientation: '+label);
  const active=before.agents.find(item=>item.id===id);
  const cancelled=immediate.agents.find(item=>item.id===id);
  const recovered=final.agents.find(item=>item.id===id);
  const token=active.task?.token;
  assert.equal(cancelled.result?.taskToken,token,label);
  assert.equal(cancelled.result.result,'cancelled',label);
  assert.equal(cancelled.phase,'cancelled',label);
  assert(cancelled.recovery,'Cancellation starts observable withdrawal: '+label);
  assert.equal(recovered.phase,'cancelled',label);
  assert.equal(recovered.result?.result,'cancelled',label);
  assert.equal(recovered.result.taskToken,token,label);
  assert.equal(recovered.recovery,null,'Native withdrawal and rest recovery finish: '+label);
  assert.equal(final.object.gripConstraintCount,0,label);
  assert.equal(final.object.heldBy,null,label);
  assert.equal(final.object.reservedBy,null,label);
  assert(!final.audit.tasks.some(task=>task.taskToken===token && task.result==='completed'),
    'An invalidated task cannot later publish success: '+label);
  const event=final.events.find(item=>item.type==='window-cancelled' && item.taskToken===token);
  const withdrawn=final.events.find(item=>item.type==='window-hand-withdrawn' && item.taskToken===token);
  const restored=final.events.find(item=>item.type==='window-restored' && item.taskToken===token);
  assert(event && withdrawn && restored,'Cancel, actual withdrawal and native rest events share the task token: '+label);
  assert(event.windowEventSeq<withdrawn.windowEventSeq && withdrawn.windowEventSeq<restored.windowEventSeq,label);
  assert(withdrawn.withdrawSeconds>=.9-1e-8 && withdrawn.thisActorHasGrip===false,label);
  assert(withdrawn.clearanceM>.06,'Actual hand withdraws from the released handle: '+label);
  assert.equal(restored.nativeRecoveryImplemented,true,label);
  assert(Number.isFinite(restored.restPoseErrorRad) &&
    restored.restPoseErrorRad<=WINDOW_TOLERANCES.restPoseErrorRad,label);
  const poseGeometry=auditWindowPoses(final,token,label);
  return {id,taskToken:token,cancelAngleDeg:before.object.angleDeg,
    finalAngleDeg:final.object.angleDeg,withdrawn,restored,
    poseGeometry,
    scope:'Cancel preserves the instantaneous rigid-body pose; the released leaf may subsequently move under physics'};
}

function auditBuiltinWindows(tests) {
  const cases=tests.filter(test=>test.kind?.startsWith('window-'));
  assert.equal(cases.length,6,'Exactly six locked window cases are exported');
  assert.deepEqual(cases.map(test=>test.kind),[
    'window-cycle','window-cycle','window-cycle','window-block','window-cancel','window-contention'
  ]);
  assert.deepEqual(cases.slice(0,3).map(test=>test.detail.actor),['A','B','C']);
  const results=[];
  for(const test of cases) {
    const detail=test.detail;
    const label=test.name;
    const windowSnapshot=detail.window;
    const restErrors=checkRestErrors(detail.restErrors,label);
    let measured;
    if(test.kind==='window-cycle') {
      const id=detail.actor;
      const opened=checkWindowReceipt(detail.opened,id,'open',label+' open');
      const closed=checkWindowReceipt(detail.closed,id,'close',label+' close');
      checkRestErrors(detail.openRestErrors,label+' open');
      assert.notEqual(opened.result.taskToken,closed.result.taskToken,label);
      assert(opened.resultSequence<closed.requestSequence,'Close is a new task after actual opening: '+label);
      assert(Math.abs(detail.opened.object.angleDeg-detail.closed.object.angleDeg)>30,
        'The same physical leaf traversed the open and closed goals: '+label);
      measured={opened,closed};
    }else if(test.kind==='window-block') {
      checkWindowObject(windowSnapshot,label);
      const agent=windowSnapshot.agents.find(item=>item.id===detail.actor);
      assert.equal(agent.result?.result,'blocked',label);
      assert.equal(agent.recovery,null,label);
      assert.equal(windowSnapshot.object.blocked,true,label);
      assert.equal(windowSnapshot.object.goalOpen,false,label);
      assert(Math.abs(windowSnapshot.object.angleDeg-WINDOW_TARGET_DEG.open)>WINDOW_TOLERANCES.angleErrorDeg,label);
      assert.equal(windowSnapshot.object.gripConstraintCount,0,label);
      assert.equal(windowSnapshot.object.heldBy,null,label);
      assert.equal(windowSnapshot.object.reservedBy,null,label);
      const obstruction=windowSnapshot.audit.obstructions.find(item=>item.taskToken===agent.result.taskToken);
      assert(obstruction && obstruction.contactCount>0 && obstruction.forceN>0,
        'Real leaf/blocker collision equations and force caused obstruction: '+label);
      assert(obstruction.stuckSeconds>.65 && obstruction.contactSeconds>.65,label);
      assert.equal(obstruction.blockerId,'window-blocker',label);
      assert(Number.isInteger(obstruction.bodyId),'The blocker is an actual physics body: '+label);
      assert(!windowSnapshot.audit.tasks.some(task=>task.taskToken===agent.result.taskToken && task.result==='completed'),label);
      const poseGeometry=auditWindowPoses(windowSnapshot,agent.result.taskToken,label);
      measured={result:agent.result,obstruction,poseGeometry};
    }else if(test.kind==='window-cancel') {
      measured=checkWindowCancellation(detail.cancel.before,detail.cancel.after,windowSnapshot,detail.actor,label);
    }else {
      const a=checkWindowReceipt(windowSnapshot,'A','open',label+' A');
      const b=checkWindowReceipt(windowSnapshot,'B','open',label+' B',{alreadyAtTarget:true});
      const reservedB=windowSnapshot.events.find(event=>event.type==='window-reserved' && event.taskToken===b.result.taskToken);
      assert(reservedB && reservedB.windowEventSeq>a.resultSequence,
        'B only acquires the shared window after A publishes the released result: '+label);
      assert(b.requestSequence<a.resultSequence,'B actually waited for the occupied resource: '+label);
      measured={a,b,reservationSequenceB:reservedB.windowEventSeq};
    }
    results.push({name:label,kind:test.kind,actor:detail.actor,measured,restErrors});
  }
  const result={accepted:true,independentStateChecks:true,builtInFlagUsedAsProof:false,cases:results};
  put('window-built-in-audit.json',result);
  report.windowBuiltInAudit=result;
  return result;
}

async function mobileViewport() {
  await check('390 x 844 responsive viewport and reachable controls',async()=>{
    await pause(true);await page.setViewportSize({width:390,height:844});
    await page.click('[data-camera="all"]');
    await waitFor('mobile real canvas resize',()=>{
      const c=window.__IDENTITY_QA__?.viewer?.()?.renderer?.domElement,r=c?.getBoundingClientRect();
      return r && r.width>200 && r.width<=392 && r.height>200 && c.width>100 && c.height>100;
    },{},{timeout:30000,polling:100});
    await screenshot('mobile-390x844-panorama');
    const layout=await evaluate('read mobile layout',()=>{
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
    await page.click('[data-camera="window"]');
    await screenshot('mobile-390x844-window');
    await page.click('[data-camera="all"]');
    const controlReachability=[];
    for(const selector of ['#npc-plan','#npc-window-open','#npc-window-close','#npc-window-block','#npc-window-contend']) {
      const button=page.locator(selector);
      await button.scrollIntoViewIfNeeded();
      const box=await button.boundingBox();
      const enabled=await button.isEnabled();
      controlReachability.push({selector,box,enabled});
      assert(box && box.x>=-1 && box.x+box.width<=391 && box.y>=0 && box.y+box.height<=845,
        'Required control remains reachable in the 390 px scrolling panel: '+selector);
      assert.equal(enabled,true,'Required control is enabled after completed tasks: '+selector);
    }
    put('mobile-controls.json',controlReachability);
    await screenshot('mobile-390x844-controls');
    await evidence('mobile-final');await saveDOM('mobile-dom');
    report.mobileViewport={tested:true,physicalPhone:false,width:390,height:844,layout,controlReachability};
    return report.mobileViewport;
  });
}

async function contactTests({firstOnly=false}={}) {
  report.contactTestsRun=true;
  report.contactActorsTested=[];
  for(let i=0;i<(firstOnly?1:3);i++) {
    const id=['A','B','C'][i];
    await check(id+' real native pick/place UI',async()=>{
      await pause(true);await page.click('[data-person="'+i+'"]');
      await page.click('[data-camera="contact"]');const geometryStart=await auditCursor(id);
      await page.click('#npc-pick');await pause(false);
      await waitFor('wait for actual grip: '+id,id=>{
        const s=window.__NPC_OBSERVATION__.snapshot(),a=s.agents.find(a=>a.id===id);
        return s.object.heldBy===id || ['done','failed','cancelled'].includes(a?.phase) || window.__NPC_OBSERVATION__.errors.length;
      },id,{timeout:TASK_MS,polling:100});
      await pause(true);
      const grip=await evidence('contact-'+id);
      await screenshot('contact-'+id);
      const agent=grip.snapshot.agents.find(a=>a.id===id);
      checkActorResourceExclusion(grip.snapshot,'bottle contact '+id);
      const feet=checkFeetAndBones(grip.actorDiagnostics,'contact-'+id);
      const hand=grip.actorDiagnostics.find(actor=>actor.id===id)?.diagnostics;
      const otherViolations=otherSolidViolations(hand,{
        operatedObjectId:'bottle-01',requiredCylinderId:'window-handle-01'
      });
      const otherSolids={
        operatedObjectId:'bottle-01',requiredCylinderId:'window-handle-01',
        maximumAllowedPenetrationM:OTHER_SOLID_PENETRATION_M,
        accepted:otherViolations.length===0,violations:otherViolations,
        solidMaxPenetrationM:hand?.solidMaxPenetrationM,
        solidSampleCount:hand?.solidSampleCount,solidParts:hand?.solidParts,
        solidByBox:hand?.solidByBox,solidByCylinder:hand?.solidByCylinder,
        solidCylinders:hand?.solidCylinders,solidDeepest:hand?.solidDeepest,
        solidDiagnosticScope:hand?.solidDiagnosticScope
      };
      put('other-solids-contact-'+id+'.json',otherSolids);
      const bottleGeometry={measured:true,accepted:Number.isFinite(hand?.bottleMaxPenetrationM) && hand.bottleMaxPenetrationM<=.005,
        maximumAllowedPenetrationM:.005,definition:hand?.geometricDiagnosticScope,
        maxPenetrationM:hand?.bottleMaxPenetrationM,minimumSignedDistanceM:hand?.bottleMinimumSignedDistanceM,
        penetratingVertexCount:hand?.bottlePenetratingVertexCount,sampleCount:hand?.bottleSampleCount,
        fingerSignedDistanceM:hand?.fingerBottleSignedDistanceM,deepestPointWorld:hand?.bottleDeepestPointWorld};
      put('bottle-geometry-'+id+'.json',bottleGeometry);
      assert.equal(grip.errors.length,0,'No runtime exception');
      assert.equal(grip.snapshot.object.heldBy,id,'The real shared object is held by the selected actor');
      assert.equal(grip.snapshot.object.constraintCount,1,'One actual physical grip constraint');
      assert(Number.isFinite(agent.contactErrorM) && agent.contactErrorM<.025,'Rendered hand contact error below 25 mm');
      assert(Number.isInteger(hand?.handTableSampleCount) && hand.handTableSampleCount>=0,'Actual table-projected hand vertices are measured');
      // Only the holding actor's hand vertices whose XZ projection lies inside
      // the real tabletop are gated. Low idle hands beside a table are valid.
      if(grip.snapshot.object.supportEnabled && hand.handTableSampleCount>0)assert(Number.isFinite(hand.handTableClearanceM) && hand.handTableClearanceM>=-.003,
        'Held hand penetrates the actual tabletop by more than 3 mm: '+id+' / '+hand.handTableClearanceM);
      assert(hand.bottleSampleCount>0 && Number.isFinite(hand.bottleMaxPenetrationM),'Actual finite-cylinder hand geometry was measured');
      assert(hand.bottleMaxPenetrationM<=.005,'Actual rendered hand penetrates the bottle by more than 5 mm: '+id+' / '+hand.bottleMaxPenetrationM);
      assert.equal(otherViolations.length,0,'Actual held-hand other-solid geometry failed: '+JSON.stringify(otherViolations));
      const contactGeometry=checkAuditGeometry(grip.snapshot,'contact-'+id,{afterTime:geometryStart,id});
      await pause(false);
      await waitFor('wait for actual placement and native recovery: '+id,id=>{
        const app=window.__NPC_OBSERVATION__,a=app.snapshot().agents.find(a=>a.id===id);
        return (['done','failed','cancelled'].includes(a?.phase) && !a?.recovery) || app.errors.length;
      },id,{timeout:TASK_MS,polling:100});
      await pause(true);
      const final=await evidence('placed-'+id);
      const result=final.snapshot.agents.find(a=>a.id===id).result;
      const finalFeet=checkFeetAndBones(final.actorDiagnostics,'placed-'+id);
      const phaseGeometry=checkAuditGeometry(final.snapshot,'placed-'+id,{
        afterTime:geometryStart,id,requiredActors:[id],requireRecovery:true,expectedTaskCounts:{[id]:1}
      });
      assert.equal(result?.result,'completed','World result must confirm placement');
      assert.equal(final.snapshot.object.heldBy,null);assert.equal(final.snapshot.object.constraintCount,0);
      assert(final.snapshot.object.insideTarget && final.snapshot.object.supported && final.snapshot.object.settled,'Object actually released and stable on support');
      return {contactErrorM:agent.contactErrorM,result,object:final.snapshot.object,feet,finalFeet,
        handDiagnostics:hand,bottleGeometry,otherSolids,contactGeometry,phaseGeometry};
    });
    report.contactActorsTested.push(id);checkpoint('contact actor completed: '+id);
  }
}

async function fullSuite() {
  report.fullSuiteRun=true;
  await check('built-in R02 suite with all six original R01 cases',async()=>{
    const geometryStart=await auditCursor('R02 built-in suite');
    await page.click('#npc-run-qa');
    await waitFor('wait for the complete R02 suite',()=>window.__NPC_OBSERVATION__.verification()?.completed || window.__NPC_OBSERVATION__.errors.length,{},{timeout:SUITE_MS,polling:250});
    await pause(true);
    const result=await evidence('suite-final');put('suite.json',result.verification || {});
    checkFeetAndBones(result.actorDiagnostics,'suite-final');
    report.suitePhaseGeometry=checkAuditGeometry(result.snapshot,'suite-final',{
      afterTime:geometryStart,requiredActors:['A','B','C'],requireRecovery:true,
      // Six unchanged bottle cases: three individual tasks, A contention,
      // A cancellation then B completion, and A support-removal failure.
      expectedTaskCounts:{A:4,B:2,C:1}
    });
    await page.click('[data-camera="all"]');await screenshot('suite-final');
    assert.equal(result.errors.length,0);assert.equal(result.verification?.completed,true);
    assert(result.verification.tests.length>=12,'R02 retains six old cases and includes six window cases');
    assert.deepEqual(result.verification.tests.slice(0,6).map(test=>test.name),[
      'A 原生体型拿放',
      'B 原生体型拿放',
      'C 原生体型拿放',
      '双人同时申请与等待',
      '持有途中中断与重新申请',
      '移走支撑后不得报告放置成功'
    ],'All six original case names and their order are preserved');
    report.windowBuiltInAudit=auditBuiltinWindows(result.verification.tests);
    assert.equal(result.verification.passed,true);
    assert(result.verification.tests.every(test=>test.pass===true),'Every built-in case must report its measured pass result');
    return result.verification;
  });
}

async function windowInteractionUI({includeCancel=true}={}) {
  report.windowTestsRun=true;
  const began=Date.now();
  const deadline=began+WINDOW_GROUP_MS;
  const budget=()=>{
    const remaining=deadline-Date.now();
    assert(remaining>0,'The bounded R02 window UI group exceeded its deadline');
    return Math.min(TASK_MS,remaining);
  };
  report.windowUI={actualUI:true,complete:false,operations:[],cancelChecked:false};
  await check('A actual native window open and close buttons',async()=>{
    await pause(true);
    await page.click('[data-person="0"]');
    let opened=null;
    for(const operation of ['open','close']) {
      const label='A-window-'+operation;
      if(operation==='close') {
        const before=await evaluate('read physically open window before Close',
          ()=>window.__NPC_OBSERVATION__.snapshot().window);
        checkWindowObject(before,label+' starting state',{operation:'open'});
        assert.equal(before.agents.find(item=>item.id==='A').result.taskToken,
          opened.result.taskToken,'No station reset replaced the completed opening');
      }
      await page.click('#npc-window-'+operation);
      await page.click('[data-camera="window"]');
      await pause(false);
      await waitFor('wait for actual native handle grip: '+label,()=>{
        const app=window.__NPC_OBSERVATION__;
        const state=app.snapshot().window;
        const actor=state.agents.find(item=>item.id==='A');
        return app.errors.length || state.object.heldBy==='A' ||
          ['done','failed','cancelled'].includes(actor?.phase);
      },undefined,{timeout:budget(),polling:100});
      await pause(true);
      const contact=await evidence(label+'-contact');
      assert.equal(contact.errors.length,0,label);
      assert.equal(contact.snapshot.interactionMode,'window',label);
      const geometry=checkWindowContact(contact,'A',label);
      await screenshot(label+'-contact');
      await pause(false);
      await waitFor('wait for actual released window goal and native recovery: '+label,()=>{
        const app=window.__NPC_OBSERVATION__;
        const actor=app.snapshot().window.agents.find(item=>item.id==='A');
        return app.errors.length ||
          (['done','failed','cancelled'].includes(actor?.phase) && actor.recovery===null);
      },undefined,{timeout:budget(),polling:100});
      await pause(true);
      const final=await evidence(label+'-final');
      assert.equal(final.errors.length,0,label);
      const receipt=checkWindowReceipt(final.snapshot.window,'A',operation,label);
      const rest=checkWindowRest(final.actorDiagnostics,label);
      const rendered=checkWindowRender(final,label);
      if(operation==='open') {
        opened=receipt;
        await screenshot(label+'-released');
      }else {
        assert.notEqual(receipt.result.taskToken,opened.result.taskToken,
          'Close was an independent task on the already-open physical leaf');
        assert(receipt.requestSequence>opened.resultSequence,
          'The actual close request followed completed opening');
      }
      const result={operation,geometry,receipt,rest,rendered};
      report.windowUI.operations.push(result);
      put('window-ui-'+operation+'.json',result);
      checkpoint('actual window UI operation completed: '+operation);
    }
    return {actualUI:true,operations:report.windowUI.operations};
  });

  if(includeCancel) {
    await check('actual UI cancel preserves hinge and restores native rest',async()=>{
      await page.click('#npc-window-open');
      await pause(false);
      await waitFor('wait for actual partially open window before cancellation',()=>{
        const app=window.__NPC_OBSERVATION__;
        const state=app.snapshot().window;
        const actor=state.agents.find(item=>item.id==='A');
        return app.errors.length ||
          (state.object.heldBy==='A' && state.object.angleDeg< -8 && state.object.angleDeg> -28) ||
          ['done','failed','cancelled'].includes(actor?.phase);
      },undefined,{timeout:budget(),polling:100});
      await pause(true);
      const before=await evidence('window-ui-cancel-before');
      checkWindowContact(before,'A','window-ui-cancel-before');
      await screenshot('window-ui-cancel-before');
      await page.click('#npc-cancel');
      const immediate=await evidence('window-ui-cancel-immediate');
      assert.equal(immediate.snapshot.window.object.gripConstraintCount,0,
        'The actual cancel button removes the temporary hand constraint immediately');
      assert.equal(immediate.snapshot.window.object.hingeConstraintCount,1,
        'The actual cancel button retains the permanent hinge');
      await pause(false);
      await waitFor('wait for actual open-hand withdrawal and native rest',()=>{
        const app=window.__NPC_OBSERVATION__;
        const actor=app.snapshot().window.agents.find(item=>item.id==='A');
        return app.errors.length || (actor?.phase==='cancelled' && actor.recovery===null);
      },undefined,{timeout:budget(),polling:100});
      await pause(true);
      const final=await evidence('window-ui-cancel-recovered');
      assert.equal(final.errors.length,0);
      const cancellation=checkWindowCancellation(before.snapshot.window,immediate.snapshot.window,
        final.snapshot.window,'A','actual UI window cancel');
      const rest=checkWindowRest(final.actorDiagnostics,'window-ui-cancel-recovered');
      const rendered=checkWindowRender(final,'window-ui-cancel-recovered');
      await screenshot('window-ui-cancel-recovered');
      report.windowUI.cancelChecked=true;
      report.windowUI.cancellation={cancellation,rest,rendered};
      put('window-ui-cancellation.json',report.windowUI.cancellation);
      return report.windowUI.cancellation;
    });
  }
  report.windowUI.complete=true;
  report.windowUI.elapsedMS=Date.now()-began;
  assert(report.windowUI.elapsedMS<=WINDOW_GROUP_MS,'Window UI group remains within its explicit time budget');
  put('window-ui-verification.json',report.windowUI);
  checkpoint('actual window UI verification complete');
}

async function windowExportUI() {
  await check('actual JSON export preserves physical window task data',async()=>{
    await pause(true);
    const details=page.locator('#npc-app details');
    if(await details.getAttribute('open')===null)await details.locator('summary').click();
    await page.locator('#npc-export').scrollIntoViewIfNeeded();
    const current=await evaluate('read actual paused window data before UI export',
      ()=>JSON.parse(JSON.stringify(window.__NPC_OBSERVATION__.snapshot())));
    const [download]=await bounded('capture window-state UI download',()=>Promise.all([
      page.waitForEvent('download',{timeout:30000}),page.click('#npc-export')
    ]),35000);
    const file='window-ui-export.json';
    await bounded('save window-state UI download',()=>download.saveAs(path.join(out,file)));
    assert.equal(await bounded('check window-state download completed',()=>download.failure()),null);
    assert.equal(download.suggestedFilename(),'npc-life-observation-r02-data.json');
    const bytes=fs.readFileSync(path.join(out,file));
    const exported=JSON.parse(bytes.toString('utf8'));
    assert.equal(exported.version,VERSION);
    assert.equal(exported.time,current.time);
    assert(current.window.audit.tasks.length>=2,'The export contains actual open and close task receipts');
    assert.deepEqual(exported.window,current.window,'Export contains the actual current window, contacts, receipts and events');
    assert.deepEqual(exported.object,current.object);
    assert.deepEqual(exported.events,current.events);
    assert.deepEqual(exported.agents,current.agents);
    assert.equal(exported.errors.length,0);
    const result={actualUI:true,file,bytes:bytes.length,sha256:sha(bytes),
      suggestedFilename:download.suggestedFilename(),authoritativeWorldMatched:true,
      taskCount:exported.window.audit.tasks.length,windowSequence:exported.window.sequence,
      windowRevision:exported.window.revision};
    await details.locator('summary').click();
    report.windowExport=result;
    put('window-export-verification.json',result);
    return result;
  });
}

async function identityInteraction() {
  await check('identity-task UI, independent review invalidation and actual JSON export',async()=>{
    await pause(true);await page.click('#npc-reset');
    const geometryStart=await auditCursor('identity plan');
    await page.click('#npc-plan');await pause(false);
    await waitFor('A sorts, B observes ownership and C confirms the result',()=>{
      const app=window.__NPC_OBSERVATION__,s=app.snapshot();
      const a=s.agents.find(actor=>actor.id==='A'),b=s.agents.find(actor=>actor.id==='B');
      return app.errors.length || (a?.result?.result==='completed' && !a.recovery &&
        b?.result?.result==='already-sorted' && !b.recovery && s.review.checked);
    },{},{timeout:TASK_MS,polling:100});
    await pause(true);
    const plan=await evidence('identity-plan');
    assert.equal(plan.errors.length,0);
    assert.equal(plan.snapshot.agents.find(a=>a.id==='A').result.result,'completed');
    assert.equal(plan.snapshot.agents.find(a=>a.id==='B').result.result,'already-sorted');
    assert.equal(plan.snapshot.review.checked,true);
    assert(plan.snapshot.events.some(event=>event.type==='review-confirmed' && event.actor==='C'),'C actually confirmed the shared world result');
    const feet=checkFeetAndBones(plan.actorDiagnostics,'identity-plan');
    const geometry=checkAuditGeometry(plan.snapshot,'identity-plan',{
      afterTime:geometryStart,requiredActors:['A'],requireRecovery:true,expectedTaskCounts:{A:1}
    });
    await page.click('[data-camera="all"]');await screenshot('identity-plan');
    const targetRevisionBefore=plan.snapshot.targetRevision;
    await page.click('#npc-target');await pause(false);
    await waitFor('C invalidates its previous result after the target changes',()=>{
      const app=window.__NPC_OBSERVATION__,s=app.snapshot();
      return app.errors.length || (!s.review.checked && s.events.some(event=>event.type==='review-invalidated' && event.actor==='C'));
    },{},{timeout:TASK_MS,polling:100});
    await pause(true);
    const changed=await evidence('identity-review-invalidated');
    assert.equal(changed.errors.length,0);assert.equal(changed.snapshot.review.checked,false);
    assert.equal(changed.snapshot.targetRevision,targetRevisionBefore+1);
    assert.notDeepEqual(changed.snapshot.target,plan.snapshot.target);
    assert(changed.snapshot.events.some(event=>event.type==='review-invalidated' && event.actor==='C'));
    assert.equal(changed.snapshot.object.insideTarget,false,'The old placement is no longer inside the moved target');
    const exportDetails=page.locator('#npc-app details');
    if(await exportDetails.getAttribute('open')===null)await exportDetails.locator('summary').click();
    await page.locator('#npc-export').scrollIntoViewIfNeeded();
    const current=await evaluate('read paused authoritative world for export',()=>window.__NPC_OBSERVATION__.snapshot());
    const [download]=await bounded('capture actual UI JSON download',()=>Promise.all([
      page.waitForEvent('download',{timeout:30000}),page.click('#npc-export')
    ]),35000);
    const file='identity-ui-export.json';
    await bounded('save actual UI JSON download',()=>download.saveAs(path.join(out,file)));
    assert.equal(await bounded('check UI download completed',()=>download.failure()),null);
    assert.equal(download.suggestedFilename(),'npc-life-observation-r02-data.json');
    const bytes=fs.readFileSync(path.join(out,file)),exported=JSON.parse(bytes.toString('utf8'));
    assert.equal(exported.version,VERSION);assert.equal(exported.time,current.time);
    assert.deepEqual(exported.object,current.object);assert.deepEqual(exported.target,current.target);
    assert.equal(exported.targetRevision,current.targetRevision);assert.deepEqual(exported.events,current.events);
    assert.deepEqual(exported.review,current.review);assert.deepEqual(exported.agents,current.agents);
    assert(current.window,'R02 authoritative snapshot includes the physical window');
    assert.deepEqual(exported.window,current.window);
    assert.equal(exported.errors.length,0);
    const result={actualUI:true,plan:{aResult:'completed',bResult:'already-sorted',cReviewChecked:true},
      invalidated:{cReviewChecked:false,targetRevisionBefore,targetRevisionAfter:current.targetRevision},
      geometry,feet,export:{file,suggestedFilename:download.suggestedFilename(),bytes:bytes.length,sha256:sha(bytes),
        authoritativeWorldMatched:true,eventCount:current.events.length,targetRevision:current.targetRevision}};
    await exportDetails.locator('summary').click();
    put('identity-ui-verification.json',result);report.identityUI=result;return result;
  });
}

async function main() {
  log(VERSION+' / '+PHASE+' / evidence '+out);
  checkpointTimer=setInterval(()=>checkpoint('periodic driver checkpoint'),5000);
  checkpointTimer.unref();
  stage('configure candidate');
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
    await bounded('start candidate HTTP server',()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);}),10000);
    report.url='http://127.0.0.1:'+server.address().port+'/';report.deliveryMode='local-candidate-http';
  }
  if(PHASE==='public')assert.equal(report.deliveryMode,'deployed-url','The public phase requires PREVIEW_URL for the actual deployed candidate');
  stage('launch isolated CI Chromium');
  browser=await bounded('launch Chromium',()=>chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}));
  report.environment.chromium=browser.version();
  context=await bounded('create CI browser context',()=>browser.newContext({viewport:report.environment.viewport,deviceScaleFactor:1,acceptDownloads:true}));
  await bounded('install read-only error capture',()=>context.addInitScript(()=>{
    window.__NPC_BROWSER_EVENTS__=[];
    window.__NPC_BROWSER_FATAL__=[];
    window.addEventListener('error',event=>{if(event.message)window.__NPC_BROWSER_FATAL__.push({type:'error',message:event.message,file:event.filename,line:event.lineno,column:event.colno,at:performance.now()});});
    window.addEventListener('unhandledrejection',event=>window.__NPC_BROWSER_FATAL__.push({type:'unhandledrejection',message:String(event.reason?.stack||event.reason),at:performance.now()}));
    document.addEventListener('webglcontextlost',event=>window.__NPC_BROWSER_EVENTS__.push({type:'webglcontextlost',at:performance.now(),target:event.target?.id||null}),true);
    document.addEventListener('webglcontextrestored',event=>window.__NPC_BROWSER_EVENTS__.push({type:'webglcontextrestored',at:performance.now(),target:event.target?.id||null}),true);
  }));
  page=await bounded('create candidate page',()=>context.newPage());page.setDefaultTimeout(30000);
  cdp=await bounded('open screenshot CDP session',()=>context.newCDPSession(page));
  page.on('pageerror',error=>{
    if(collecting){const value={at:new Date().toISOString(),error:clip(error.stack||error)};report.pageErrors.push(value);log('page error',value);}
  });
  page.on('console',message=>{
    if(!collecting)return;
    const value={at:new Date().toISOString(),text:clip(message.text()),location:message.location()};
    if(message.type()==='error'){report.consoleErrors.push(value);log('console error',value);}
    if(message.type()==='warning' && report.consoleWarnings.length<300)report.consoleWarnings.push(value);
  });
  page.on('request',request=>{if(collecting)report.requests.push({url:request.url(),type:request.resourceType(),method:request.method()});});
  page.on('requestfailed',request=>{if(collecting){const value={url:request.url(),type:request.resourceType(),failure:request.failure()};report.failedRequests.push(value);log('request failed',value);}});
  page.on('response',response=>{if(collecting && response.status()>=400){const value={url:response.url(),status:response.status()};report.httpErrors.push(value);log('HTTP error',value);}});
  const start=Date.now();
  heartbeat=setInterval(async()=>{
    if(heartbeatBusy || !page || page.isClosed())return;heartbeatBusy=true;
    try {const state=await bootState(15000);report.lastBootState=state;log('progress',state);}
    catch(error){log('progress unavailable',{error:clip(error.message)});}
    finally{heartbeatBusy=false;}
  },30000);
  await check('candidate response and freshness',async()=>{
    const response=await bounded('navigate to exact candidate',()=>page.goto(report.url,{waitUntil:'domcontentloaded',timeout:120000}),125000);
    report.finalURL=page.url();report.navigationStatus=response?.status() || null;
    if(report.deliveryMode!=='file-protocol')assert.equal(response?.status(),200,'Candidate HTML must respond HTTP 200');
    if(response)report.observedPreviewSHA256=sha(await bounded('read actual navigation HTML bytes',()=>response.body()));
    else if(report.deliveryMode==='file-protocol')report.observedPreviewSHA256=sha(fs.readFileSync(input));
    assert(expectedSHA,'Expected preview SHA is required for current-source verification');
    assert.equal(report.observedPreviewSHA256,expectedSHA,'Browser loaded the exact current build');
    return {url:report.finalURL,status:report.navigationStatus,sha256:report.observedPreviewSHA256};
  });
  await check('complete original R07 and all three actors ready',async()=>{
    assert.equal(report.pageErrors.length,0,'Page failed before native startup: '+JSON.stringify(report.pageErrors));
    await waitFor('wait for original R07 and all native actors',()=>!!window.__NPC_OBSERVATION__?.ready || document.documentElement.dataset.npcReady==='failed' || !!window.__HEAD_PROC__?.errors?.length || !!window.__NPC_BROWSER_FATAL__?.length,{},{timeout:BOOT_MS,polling:250});
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
    assert.equal(initial.renderScheduler?.startupDrain?.completed,true,'Ready requires earlier native startup GPU commands to have drained');
    assert(Number.isInteger(initial.renderScheduler?.completed) && initial.renderScheduler.completed>=1,'Ready requires at least one completed native scene frame');
    assert.equal(initial.actorMeshes.filter(mesh=>mesh.visible===true && mesh.parentVisible===true).length,3,'Ready requires all three complete native people to be visible');
    const initialMaterials=initial.actorMeshes.flatMap(mesh=>mesh.materials);
    assert.equal(initialMaterials.length,6,'The three native people must retain all six material instances');
    assert(initialMaterials.every(material=>Number.isInteger(material.programID)),'Ready requires all six native materials to have an actual GPU program');
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
    report.initialWindow=checkWindowObject(initial.snapshot.window,'initial');
    report.initialWindowRender=checkWindowRender(initial,'initial');
    checkActorResourceExclusion(initial.snapshot,'initial');
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
  report.startupPassed=true;log('startup evidence complete');
  if(PHASE==='contact' || PHASE==='suite' || PHASE==='public')await contactTests({firstOnly:PHASE==='public'});
  if(PHASE==='suite') {
    await fullSuite();
    await identityInteraction();
    await windowInteractionUI();
    await windowExportUI();
  }
  if(PHASE==='public')await windowInteractionUI({includeCancel:false});
  if(PHASE==='suite' || PHASE==='public')await mobileViewport();
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
  report.publicURLChecksPassed=report.deliveryMode==='deployed-url';
  report.fullProgrammaticAcceptance=PHASE==='suite' && report.windowBuiltInAudit?.accepted===true &&
    report.windowUI?.complete===true && report.windowUI.cancelChecked===true &&
    report.windowExport?.authoritativeWorldMatched===true;
  log('verification complete');
}

main().catch(async error=>{
  clearInterval(heartbeat);
  report.completed=false;report.status='FAILED';report.failure=clip(error.stack||error);process.exitCode=1;
  report.failedStage=report.currentStage;stage('failure evidence');
  // Save the original failure and all driver events before any browser await.
  // An unresponsive renderer may prevent every optional diagnostic below.
  log('FAILED '+report.failure);
  const failureStarted=Date.now(),failureDeadline=failureStarted+FAILURE_TOTAL_MS;
  report.failureDiagnostics=[];checkpoint('failure diagnostics started');
  const diagnose=async(label,fn)=>{
    const budgetMS=Math.min(FAILURE_STEP_MS,failureDeadline-Date.now());
    if(budgetMS<=0){report.failureDiagnostics.push({label,status:'skipped',reason:'total failure diagnostic budget exhausted'});checkpoint('failure diagnostic skipped');return;}
    try {await fn(budgetMS);report.failureDiagnostics.push({label,status:'saved'});}
    catch(diagnosticError){report.failureDiagnostics.push({label,status:'unavailable',error:clip(diagnosticError.message)});}
    checkpoint('failure diagnostic finished: '+label);
  };
  if(page && !page.isClosed()) {
    await diagnose('boot state',async budgetMS=>{report.failureState=await bootState(budgetMS);});
    await diagnose('native geometry and state',budgetMS=>evidence('failure',{nativeRigs:true,budgetMS}));
    await diagnose('DOM',budgetMS=>saveDOM('failure-dom',budgetMS));
    if(cdp)await diagnose('screenshot',async budgetMS=>{
      const result=await sendCDP('failure screenshot','Page.captureScreenshot',{format:'png',captureBeyondViewport:false},budgetMS);
      const bytes=Buffer.from(result.data,'base64');fs.writeFileSync(path.join(out,'failure.png'),bytes);
      report.screenshots.push({file:'failure.png',sha256:sha(bytes),bytes:bytes.length});
    });
  }
  report.failureDiagnosticsElapsedMS=Date.now()-failureStarted;checkpoint('failure diagnostics complete');
}).finally(async()=>{
  clearInterval(heartbeat);collecting=false;
  report.verificationFinishedAt=new Date().toISOString();stage('bounded CI cleanup');
  report.cleanup={startedAt:new Date().toISOString(),completed:false,errors:[]};checkpoint('before browser close');
  if(browser) {
    try {await bounded('close isolated CI browser',()=>browser.close(),CLOSE_MS);}
    catch(error){report.cleanup.errors.push({operation:'browser.close',error:clip(error.message)});}
  }
  if(server) {
    try {server.closeAllConnections?.();await bounded('close candidate HTTP server',()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve())),5000);}
    catch(error){report.cleanup.errors.push({operation:'server.close',error:clip(error.message)});}
  }
  report.cleanup.completed=report.cleanup.errors.length===0;
  report.publicURLVerified=!!(report.completed && report.cleanup.completed && report.publicURLChecksPassed);
  if(!report.cleanup.completed) {
    report.completed=false;report.fullProgrammaticAcceptance=false;report.publicURLVerified=false;report.status='FAILED_CLEANUP';process.exitCode=1;
    // The only remaining handles can belong to this isolated test process.
    // Exit after durable evidence rather than strand the artifact-upload step.
    report.cleanup.forcedVerifierExit=true;
  }
  report.finishedAt=new Date().toISOString();stage('finished');
  clearInterval(checkpointTimer);checkpoint('final evidence');
  fs.writeSync(1,JSON.stringify({status:report.status,phase:PHASE,completed:report.completed,startupPassed:report.startupPassed,fullSuiteRun:report.fullSuiteRun,sourceHead,output:out,residentPackets:report.residentPackets,failure:report.failure,cleanup:report.cleanup},null,2)+'\n');
  if(!report.cleanup.completed)process.exit(process.exitCode || 1);
});
