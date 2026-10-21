/* Bounded, one-page diagnostic of an immutable R08 candidate.
 * It never builds or publishes product code, changes person parameters, or
 * accepts visual quality. Beauty uses the original viewer; raw float planes
 * deliberately use the original scene/camera without beauty postprocessing.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm'),zlib=require('node:zlib'),os=require('node:os');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const VERSION='LIP-SURFACE-R08',IMPLEMENTATION='native-lip-surface@1';
const BASE_SOURCE='1e1e216c2005f4c318da190e1b3b160cc4bd4a6d',BASE_BUILD='1237284ea60f9c198b2b63543f098a7551a9af2f';
const BASE_HASH='a6f50aa8e1f7898da5e40b73fb7ab8476db7ca4a14505a6ffad2e8aca1f63cac';
const MOTION_SOURCE='a8bba75322c12df151ecbcebc416087b5248aa5f',INNER_SOURCE='9d855c6051e76a20f052c95f0dda95103d946ef7',INHERITED_SOURCE='01cfde47476b7be6764e9c6a79d925462511539b';
const SOURCE='cd57623fc6a70fabc8481377aeaeccf372b56d3f',BUILD='8134500a3f5bf7a257ceef562061bb4c04416694';
const EXPECTED_PREVIEW='cbd30636b0dd46f0cc6175b8ec1370c2a37d0521075b005dfddb6e3e3fb6db62';
const ROOT='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/';
const RAW=ROOT+BUILD+'/kaopu-unified-human-workbench/lip-surface-r08/preview.html';
const PUBLIC_URL='https://htmlpreview.github.io/?'+RAW;
const RUNNER_SOURCE=process.env.RUNNER_SOURCE_SHA;
assert(/^[a-f0-9]{40}$/.test(RUNNER_SOURCE||''),'RUNNER_SOURCE_SHA must identify the reviewed diagnostic commit');
if(process.env.PUBLIC_URL)assert.equal(process.env.PUBLIC_URL,PUBLIC_URL,'Diagnostic must inspect the fixed candidate');
const scope=path.resolve(__dirname,'..'),out=path.resolve(process.env.QA_OUT||path.join(scope,'evidence','diagnosis-01'));
const width=640,height=512,budgetMS=Number(process.env.QA_BUDGET_MS||600000);
assert(Number.isFinite(budgetMS)&&budgetMS>=180000&&budgetMS<=600000,'Diagnostic deadline must be at most ten minutes');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const materialSource=fs.readFileSync(path.join(scope,'src/SurfaceMaterial.js'),'utf8'),isolated={window:{}};
vm.runInNewContext(materialSource,isolated,{timeout:1000,filename:'frozen-SurfaceMaterial.js'});
const materialTransform=isolated.window.__LIP_SURFACE_MATERIAL__;
const helperPath=path.join(__dirname,'SurfaceDetailProbe.js'),helperSource=fs.readFileSync(helperPath,'utf8');
const EXPECTED_HELPER='13a5939f6d5e6a5c1377dd3ad954f5be9e95b63d7d11c0e251b99fe4d1c653ba';
assert.equal(sha(helperSource),EXPECTED_HELPER,'Reviewed detail helper changed');
const detailProbe=require(helperPath);assert.equal(detailProbe.PLANES.length,6);
fs.mkdirSync(out,{recursive:true});
const q={schema:'kaopu/lip-surface-diagnostic@1',version:VERSION,diagnosticCommit:RUNNER_SOURCE,runnerSourceSHA:RUNNER_SOURCE,sourceSHA:SOURCE,buildSHA:BUILD,publicURL:PUBLIC_URL,
 verifierSHA256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),budgetMS,
 framebuffer:{width,height,pixelRatio:1},browserViewport:{width:1280,height:900},tests:[],frames:[],floatFrames:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],transportObservations:[],transportObservationDrains:[],
 completed:false,publicHttpsPassed:false,browserPassed:false,shareAllowed:false,visualAcceptance:false,productionReady:false,diagnosticOnly:true,productCodeWritten:false,physicalPhone:false,
 reusedHarness:{source:'verification/verify-surface.cjs',sha256:'a6f4dcfb53ea90d8333d02670db5260c7bcfbdfd905acf5dbf5329107e48de07',description:'Proven public startup, native framebuffer readback, full native-state hashing, GPU source capture, transport errors and cleanup. Diagnostic state adds an explicit no-solver-report path while hooks are temporary.'},
 helper:{file:'SurfaceDetailProbe-source.js',sourcePath:'verification/SurfaceDetailProbe.js',sourceCommit:RUNNER_SOURCE,sha256:EXPECTED_HELPER,bytes:Buffer.byteLength(helperSource)},
 numericEncoding:{schema:'kaopu/qa-nonfinite@1',tagKey:'__qaNonFiniteNumber',values:['Infinity','-Infinity','NaN'],scope:'New diagnostic JSON only'},
 limitations:[
  'One frozen native person, five ordinary beauty pose/view pairs. The rejected combined colour appearance is disabled before every measurement.',
  'Edge-only actual GPU changes must equal exactly its two literal patches. All native/draw geometry, settings, camera/light and original uniform objects remain exact.',
  'Six non-MSAA RGBA32F planes at each of neutral macro/front are direct original scene draws, without beauty diffusion/composition. They are framebuffer diagnostics, not beauty photographs.',
  'An uninstrumented control draw uses the same float target before diagnostic shader compilation; target-dependent shader prefixes are not confused with the ordinary screen program.',
  'Only the original opaque procedural head material receives a temporary fragment observer plus one diagnostic uniform. Original scene objects retain their ordinary occlusion and depth behaviour.',
  'Float data is stored losslessly as gzip with raw hashes, byte order, dimensions and channel metadata. Statistics come from raw float values, never PNGs.',
  'Footprint, program-groove width factors and actual total normal slopes are separate quantities. The isolated Gaussian peak-slope expression is not total material attenuation.',
  'Original hooks, original default-framebuffer program/uniforms, complete native state, solver reports/calls and original beauty pixels must restore exactly before completion.',
  'No visual acceptance, material tuning, person-generalisation or physical-phone claim is inferred from this diagnostic.'
 ]};
fs.writeFileSync(path.join(out,'SurfaceDetailProbe-source.js'),helperSource);

let browser,page,context,fatalTimer,seq=0;const active=[],transportPages=new Map(),pendingTransport=new Set();let transportSequence=0;
function qaNumberReplacer(key,value){return typeof value==='number'&&!Number.isFinite(value)?{__qaNonFiniteNumber:Number.isNaN(value)?'NaN':value===Infinity?'Infinity':'-Infinity'}:value;}
function json(name,value){const p=path.join(out,name),t=p+'.tmp';fs.writeFileSync(t,JSON.stringify(value,qaNumberReplacer,2)+'\n');fs.renameSync(t,p);}
function checkpoint(){q.updatedAt=new Date().toISOString();q.activeStages=active.map(x=>({...x}));json('qa.partial.json',q);}
function progress(name,event,detail={}){const r={sequence:++seq,name,event,at:new Date().toISOString(),...detail};q.lastProgress=r;fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(r,qaNumberReplacer)+'\n');checkpoint();console.log(event.toUpperCase()+' '+name);}
async function bounded(name,fn,ms=120000){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(name+' exceeded '+ms+' ms; pending work is not a pass')),ms);})]);}finally{clearTimeout(timer);}}
async function stage(name,fn){const item={name,startedAt:new Date().toISOString()},s=Date.now();active.push(item);progress(name,'start');try{const value=await fn();progress(name,'end',{elapsedMS:Date.now()-s});return value;}catch(e){progress(name,'failure',{elapsedMS:Date.now()-s,error:String(e)});throw e;}finally{active.splice(active.indexOf(item),1);checkpoint();}}
async function test(name,fn){return stage(name,async()=>{const s=Date.now();try{const result=await fn();q.tests.push({name,passed:true,elapsedMS:Date.now()-s,result});checkpoint();return result;}catch(e){q.tests.push({name,passed:false,elapsedMS:Date.now()-s,error:String(e)});checkpoint();throw e;}});}
function observedTime(){return{at:new Date().toISOString(),hostMonotonicNS:process.hrtime.bigint().toString()};}
// Native snapshot/report APIs only: no retry, prepare, compute, pause, cancel,
// update or render. A failed request remains a failure even when the native
// transport later recovers. The event and the later browser observation have
// separate clocks so a queued snapshot cannot masquerade as the failure time.
function observeTransport(p,trigger,event=null){
  const binding=transportPages.get(p),start=Date.now(),record={id:++transportSequence,label:binding?.label||'unknown page',trigger,event,
    requested:observedTime(),url:p.url(),readOnly:true,deadlineMS:10000,status:'pending'};
  q.transportObservations.push(record);
  if(!binding||binding.closing||p.isClosed()){
    record.status='unavailable';record.reason=!binding?'Page observation binding absent':binding.closing?'Page teardown already started':'Page already closed';record.finished=observedTime();record.elapsedMS=Date.now()-start;checkpoint();
    return{record,settled:Promise.resolve(record)};
  }
  let settled;
  settled=(async()=>{
    try{
      record.snapshot=await bounded(binding.label+' read-only transport snapshot',()=>binding.evaluate(()=>{
        const started=performance.now(),result={browserAt:new Date().toISOString(),timeOrigin:performance.timeOrigin,performanceNow:started,url:location.href,apis:{}};
        const read=(name,owner,key)=>{
          if(!owner||typeof owner[key]!=='function')return{source:name,available:false,reason:'Native API absent at observation'};
          try{return{source:name,available:true,value:Reflect.apply(owner[key],owner,[])};}catch(e){return{source:name,available:true,error:String(e)};}
        };
        result.apis.lipP3=read('__LIP_P3__.snapshot',window.__LIP_P3__,'snapshot');
        result.apis.transport=read('__LIP_P3__.transport.snapshot',window.__LIP_P3__?.transport,'snapshot');
        result.apis.stream=read('__R05_STREAM__.report',window.__R05_STREAM__,'report');
        result.elapsedMS=performance.now()-started;return result;
      }),record.deadlineMS);
      record.status='captured';
    }catch(e){record.status='unavailable';record.error=String(e);}
    finally{record.finished=observedTime();record.elapsedMS=Date.now()-start;pendingTransport.delete(settled);binding.pending.delete(settled);checkpoint();}
    return record;
  })();
  pendingTransport.add(settled);binding.pending.add(settled);
  // Event handlers do not await this task. Keep a rejection handler attached;
  // the drain inspects every settlement and records unexpected observer errors.
  settled.catch(e=>{q.transportObservationErrors||=[];q.transportObservationErrors.push({id:record.id,error:String(e)});});
  return{record,settled};
}
async function drainTransportObservations(p,label){
  const start=Date.now(),pending=p?transportPages.get(p)?.pending:pendingTransport,record={label,scope:p?'page':'all pages',started:observedTime(),rounds:0,settled:0};
  for(let round=0;pending?.size&&round<3;round++){
    const tasks=[...pending],results=await Promise.allSettled(tasks);record.rounds++;record.settled+=results.length;
    for(const result of results)if(result.status==='rejected')throw Error('Transport observation failed to settle safely: '+String(result.reason));
  }
  record.remaining=pending?.size||0;record.completed=record.remaining===0;record.elapsedMS=Date.now()-start;q.transportObservationDrains.push(record);checkpoint();
  assert(record.completed,label+' transport observations still pending');assert.equal(q.transportObservationErrors?.length||0,0,'Unexpected transport observation error');return record;
}
function terminated(reason,code){q.completed=false;q.shareAllowed=false;q.failure=reason;q.finishedAt=new Date().toISOString();progress('process','terminated',{reason});json('qa.json',q);process.exit(code);}
for(const[s,c]of[['SIGTERM',143],['SIGINT',130]])process.once(s,()=>terminated('Interrupted by '+s,c));



async function load(url,label,isR08,captureNaturalUI=false){
  const c=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1,acceptDownloads:true});
  const p=await c.newPage();p.setDefaultTimeout(30000);const evaluate=p.evaluate.bind(p);p.evaluate=(...args)=>bounded(label+' browser evaluate',()=>evaluate(...args));
  transportPages.set(p,{label,evaluate,pending:new Set(),closing:false});
  p.on('pageerror',e=>{q.pageErrors.push({label,error:String(e)});checkpoint();});
  p.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text())){q.consoleErrors.push({label,error:m.text()});checkpoint();}});
  p.on('requestfailed',r=>{if(!/favicon/i.test(r.url())){
    const failure={label,url:r.url(),error:r.failure()?.errorText,observed:observedTime(),index:q.failedRequests.length};q.failedRequests.push(failure);
    failure.transportObservationID=observeTransport(p,'requestfailed',{failedRequestIndex:failure.index,url:failure.url,error:failure.error,observed:failure.observed}).record.id;checkpoint();
  }});
  p.on('response',r=>{if(r.status()>=400&&!/favicon/i.test(r.url())){q.resourceErrors.push({label,url:r.url(),status:r.status()});checkpoint();}});
  const s=Date.now(),r=await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(r.status(),200);
  // Inspect raw initialization statuses before using any controller report or
  // native setup call. An initializer can fail before publishing its API.
  const startupLayers=[['head','__HEAD_PROC__','headProceduralSkin',300000],['base','__LIP_REALISM__','lipRealism',180000],
    ['inner','__LIP_INNER__','innerLip',180000],['motion','__LIP_MOTION__','motionLip',300000],
    ['corner','__LIP_CORNER__','cornerLip',300000],['surface','__LIP_SURFACE__','surfaceLip',300000]];
  const startupStatus=()=>p.evaluate(layers=>{
    const result={at:new Date().toISOString(),readOnly:true,controllerReportsExplicitlyCalled:false,nativeUpdatesCalled:0,nativeRendersCalled:0,layers:{}};
    for(const[name,statusKey,apiKey]of layers){
      const status=window[statusKey],api=window[apiKey],entry={statusKey,apiKey,statusPresent:!!status,apiPresent:!!api,
        statusReady:status?.ready===true,statusVersion:status?.version??null,apiVersion:api?.version??null,
        errors:Array.isArray(status?.errors)?status.errors.map(String):status?.errors==null?[]:[String(status.errors)],
        apiErrors:Array.isArray(api?.errors)?api.errors.map(String):api?.errors==null?[]:[String(api.errors)],
        apiReady:false,reportAvailable:typeof api?.report==='function'};
      // Capture a failing readiness getter as evidence; never let it mask the
      // original status errors or skip collecting the remaining layers.
      try{entry.apiReady=api?.ready===true;}catch(error){entry.readyReadError=String(error);}
      result.layers[name]=entry;
    }
    const native=window.__LIP_P3__;result.native={present:!!native,errors:Array.isArray(native?.errors)?native.errors.map(String):native?.errors==null?[]:[String(native.errors)]};
    return result;
  },startupLayers);
  for(const[layer,statusKey,apiKey,timeout]of startupLayers.filter(x=>x[0]!=='base'&&(isR08||x[0]!=='surface'))){
    let waitError=null;
    try{
      await p.waitForFunction(({layers,layer,statusKey,apiKey})=>{
        if(layers.some(([,key])=>window[key]?.errors?.length)||window.__LIP_P3__?.errors?.length)return true;
        try{return layer==='head'?window[statusKey]?.ready===true:window[apiKey]?.ready===true;}catch{return true;}
      },{layers:startupLayers,layer,statusKey,apiKey},{timeout});
    }catch(error){waitError=String(error);}
    const observation={label,url,layer,elapsedMS:Date.now()-s,waitError,...await startupStatus()},issues=[];
    for(const[name,entry]of Object.entries(observation.layers)){
      for(const error of entry.errors)issues.push(name+' initialization: '+error);
      for(const error of entry.apiErrors)issues.push(name+' API: '+error);
      if(entry.readyReadError)issues.push(name+' ready getter: '+entry.readyReadError);
    }
    for(const error of observation.native.errors)issues.push('native initialization: '+error);
    if(waitError)issues.push('startup wait: '+waitError);
    const target=observation.layers[layer];
    if(!target.apiPresent||!(layer==='head'?target.statusReady:target.apiReady))issues.push(layer+' target API is not ready ('+apiKey+')');
    if(layer==='inner'&&(!observation.layers.base.apiPresent||!observation.layers.base.apiReady))issues.push('base target API is not ready (lipRealism)');
    observation.issues=issues;q.startupStatusObservations||=[];q.startupStatusObservations.push(observation);
    if(issues.length){q.startupFailures||=[];q.startupFailures.push(observation);}
    checkpoint();
    assert.equal(issues.length,0,label+' startup '+layer+' failed: '+issues.join(' | '));
  }
  const startup=await p.evaluate(isR08=>{
    const v=__IDENTITY_QA__.viewer();window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();v.orbit.autoRotate=false;v.orbit.enableDamping=false;
    return{title:document.title,finalFrame:v.startupFinalFrame,headReady:__HEAD_PROC__.ready,
      baseSource:document.documentElement.dataset.lipSource,baseVersion:lipRealism.version,
      innerSource:document.documentElement.dataset.lipInnerSource,innerVersion:innerLip.version,innerReport:innerLip.report(),
      motionSource:document.documentElement.dataset.lipMotionSource,motionVersion:motionLip.version,motionReport:motionLip.report(),
      cornerSource:document.documentElement.dataset.lipCornerSource,cornerVersion:cornerLip.version,cornerReport:cornerLip.report(),
      source:isR08?document.documentElement.dataset.lipSurfaceSource:null,version:isR08?surfaceLip.version:null,
      report:isR08?surfaceLip.report():cornerLip.report(),errors:{head:__HEAD_PROC__.errors,base:__LIP_REALISM__.errors,inner:__LIP_INNER__.errors,
        motion:window.__LIP_MOTION__?.errors||[],motionSolver:window.__LIP_MOTION_SOLVER__?.report?.().errors||[],
        corner:window.__LIP_CORNER__?.errors||[],cornerSolver:window.__LIP_CORNER_SOLVER__?.report?.().errors||[],
        surface:window.__LIP_SURFACE__?.errors||[],surfaceMaterial:window.__LIP_SURFACE_MATERIAL__?.report?.().errors||[],native:window.__LIP_P3__?.errors||[]}};
  },isR08);
  const startupTransport=observeTransport(p,'startup ready before GPU drain');await startupTransport.settled;startup.transportObservationID=startupTransport.record.id;
  assert(startup.headReady&&startup.finalFrame);assert.equal(startup.baseSource,INHERITED_SOURCE);assert.equal(startup.baseVersion,'LIP-REALISM-R02');
  assert.equal(startup.innerSource,INNER_SOURCE);assert.equal(startup.innerVersion,'LIP-INNER-R04');assert.equal(startup.innerReport.source.sourceCommit,INNER_SOURCE);assert.equal(startup.innerReport.baseComparison,'r02');assert.equal(startup.innerReport.comparison,'r04');assert.equal(startup.innerReport.diagnostic,0);
  assert.equal(startup.motionSource,MOTION_SOURCE);assert.equal(startup.motionVersion,'LIP-MOTION-R05');assert.equal(startup.motionReport.source.sourceCommit,MOTION_SOURCE);assert.equal(startup.motionReport.schema,'kaopu/lip-motion@1');assert.equal(startup.motionReport.comparison,'r05');assert(startup.motionReport.ready);assert(startup.motionReport.solver.installed&&startup.motionReport.solver.enabled&&startup.motionReport.solver.valid);
  assert.equal(startup.cornerSource,BASE_SOURCE);assert.equal(startup.cornerVersion,'LIP-CORNER-R06');assert.equal(startup.cornerReport.source.sourceCommit,BASE_SOURCE);assert.equal(startup.cornerReport.schema,'kaopu/lip-corner@1');assert.equal(startup.cornerReport.comparison,'r06');assert(startup.cornerReport.ready);assert(startup.cornerReport.solver.installed&&startup.cornerReport.solver.enabled&&startup.cornerReport.solver.valid);assert.equal(startup.cornerReport.implementation,'native-corner-pucker-vector@3');
  if(isR08){assert.equal(startup.source,SOURCE);assert.equal(startup.version,VERSION);assert.equal(startup.report.source.sourceCommit,SOURCE);assert.equal(startup.report.schema,'kaopu/lip-surface@1');assert.equal(startup.report.comparison,'r08');assert(startup.report.ready);assert.deepEqual(startup.report.source.modules,q.manifest.modules);}
  for(const[k,v]of Object.entries(startup.errors))assert.equal(v?.length||0,0,label+' '+k);
  await stage(label+' drain original startup GPU queue',()=>p.evaluate(()=>{const gl=__IDENTITY_QA__.viewer().renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));if(gl.getError()||gl.isContextLost())throw Error('Original startup GPU queue failed');}));
  if(captureNaturalUI){
    const file='workbench-r08-ui.png';await stage('natural public R08 workbench UI screenshot',()=>p.screenshot({path:path.join(out,file),fullPage:false,timeout:60000}));
    const bytes=fs.readFileSync(path.join(out,file)),png=PNG.sync.read(bytes);assert.equal(png.width,1280);assert.equal(png.height,900);
    q.workbenchUI={file,title:await p.title(),url:p.url(),width:png.width,height:png.height,screenshotSHA256:sha(bytes),actualBrowserScreenshot:true,capturedBeforeFixedFramebufferHarness:true};checkpoint();
  }
  await p.evaluate(installFrameHarness);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await p.evaluate(({width,height})=>__LS_VERIFY__.size(width,height),{width,height});
  q.startups||=[];q.startups.push({label,url,elapsedMS:Date.now()-s,...startup});checkpoint();return{page:p,context:c};
}



/* Existing native API/data only. No shader, triangle, attribute, calibration or
 * prototype is rewritten by this harness. Camera/light alignment is explicit.
 */
function installFrameHarness(){
  const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),ls=m.lipStructure;
  const initialFunctions={render:v.render,rendererRender:v.renderer.render,update:v.update,motherUpdate:ls.mother.update};
  const baselinePose=lipWorkbench.pose(),interventions=[],controls=window.surfaceLip||window.cornerLip;
  if(!controls?.ready)throw Error('Ready R08 or fixed R06 controls unavailable');
  // Native update temporarily resets mesh.material to the native material;
  // the existing renderer wrapper installs its draw slots only on actual draw.
  // Track both existing owners here, including during fresh-restore setup.
  // Actual drawGeometry.materialSlots still comes from the rendered mesh below.
  const initialMaterials=[v.skin.material,headProceduralSkin.material()].map(mat=>({mat,compile:mat.onBeforeCompile,key:mat.customProgramCacheKey}));
  const initialUniformMaps={native:v.renderer.properties.get(v.skin.material).uniforms,skin:v.renderer.properties.get(headProceduralSkin.material()).uniforms};
  const hash=async a=>a?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join(''):null;
  function withoutRender(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render,frame=v.renderer.info.render.frame;let suppressed=0;
    try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){suppressed++;}});return fn();}
    finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;interventions.push({label,suppressedCalls:suppressed,frameBefore:frame,frameAfter:v.renderer.info.render.frame,functionRestored:v.render===old});if(v.render!==old||v.renderer.info.render.frame!==frame)throw Error('Temporary render suppression was not contained');}}
  async function withoutRenderAsync(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render,frame=v.renderer.info.render.frame;let suppressed=0;
    try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){suppressed++;}});return await fn();}
    finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;interventions.push({label,suppressedCalls:suppressed,frameBefore:frame,frameAfter:v.renderer.info.render.frame,functionRestored:v.render===old});if(v.render!==old||v.renderer.info.render.frame!==frame)throw Error('Async restoration render suppression was not contained');}}
  function size(w,h){return withoutRender('controlled framebuffer',()=>{v.renderer.setPixelRatio(1);v.renderer.setSize(w,h,false);v.camera.aspect=w/h;v.camera.updateProjectionMatrix();});}
  function desired(name,progress=1){const p={...baselinePose};for(const k of Object.keys(p))if(k!=='schema')p[k]=0;
    if(!Number.isFinite(progress)||progress<0||progress>1)throw Error('Unknown action progress');
    if(name==='jaw')p.jawOpen=.36;else if(name==='speak')Object.assign(p,{jawOpen:.36,upperRaise:.2,lowerDepress:.12});else if(name==='pucker')Object.assign(p,{jawOpen:.06,pucker:.82,seal:.24});else if(name!=='neutral')throw Error('Unknown fixed pose');
    for(const k of Object.keys(p))if(k!=='schema')p[k]*=progress;return p;}
  function poseView(name,view,progress=1){return withoutRender('pose/view '+name+'/'+view+'/'+progress,()=>{
    window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();
    controls.pose(name,progress);controls.view(view);
    const p=lipWorkbench.pose();for(const[k,x]of Object.entries(desired(name,progress)))if(p[k]!==x)throw Error('Actual native pose differs: '+k);return p;});}
  function compare(mode){return withoutRender('variant '+mode,()=>controls.compare(mode));}
  const arrayValue=x=>x?.toArray?x.toArray():ArrayBuffer.isView(x)?Array.from(x):Array.isArray(x)?x.map(arrayValue):x;
  function nativeUniforms(){const native=v.skin.material,skin=headProceduralSkin.material(),np=v.renderer.properties.get(native),sp=v.renderer.properties.get(skin);
    const names=['csTone','csLipColor','csLipMix','csRoughness','csOil','uLEnabled','uLPigment','uLUpperShade','uLWet','uLRough','uL19Mel','uL19Blood','uL19Rough','uL19Wet','uL19Oxygen'];
    if(!np.uniforms||!sp.uniforms)throw Error('Actual rendered native/procedural uniform maps unavailable');
    return names.map(name=>({name,nativePresent:!!np.uniforms[name],skinPresent:!!sp.uniforms[name],sameObject:np.uniforms[name]===sp.uniforms[name],sameNativeObjectSinceHarness:np.uniforms[name]===initialUniformMaps.native?.[name],sameSkinObjectSinceHarness:sp.uniforms[name]===initialUniformMaps.skin?.[name],value:arrayValue(sp.uniforms[name]?.value)}));}
  function lights(){v.scene.updateMatrixWorld(true);const result=[];v.scene.traverse(o=>{if(!o.isLight)return;
    const r={type:o.type,name:o.name,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),matrix:o.matrixWorld.toArray(),color:o.color.toArray(),intensity:o.intensity,visible:o.visible};
    if(o.groundColor)r.ground=o.groundColor.toArray();if(o.target)r.target={position:o.target.position.toArray(),quaternion:o.target.quaternion.toArray(),scale:o.target.scale.toArray(),matrix:o.target.matrixWorld.toArray()};result.push(r);});return result;}
  const hashText=text=>hash(new TextEncoder().encode(text));
  async function materials(){const mats=[v.skin.material,headProceduralSkin.material()],result=[];
    for(let index=0;index<mats.length;index++){
      const mat=mats[index],original=initialMaterials[index],values={};
      for(const key of['color','roughness','metalness','ior','specularIntensity','specularColor','clearcoat','clearcoatRoughness','transmission','thickness','opacity','side','transparent','wireframe','depthTest','depthWrite','alphaTest','vertexColors','flatShading','normalScale','bumpScale','displacementScale','displacementBias','emissive','emissiveIntensity','envMapIntensity','attenuationColor','attenuationDistance'])values[key]=arrayValue(mat[key]);
      result.push({index,type:mat.type,name:mat.name,native:mat===v.skin.material,procedural:mat===headProceduralSkin.material(),sameOriginalObject:mat===original?.mat,sameOriginalCompileHook:mat.onBeforeCompile===original?.compile,sameOriginalCacheKey:mat.customProgramCacheKey===original?.key,
        compileHookSHA256:await hashText(mat.onBeforeCompile.toString()),cacheKeyFunctionSHA256:await hashText(mat.customProgramCacheKey.toString()),cacheKeyValueSHA256:await hashText(String(mat.customProgramCacheKey())),values});
    }return result;
  }
  async function state(skipSolverReports=false){const g=v.geometry,draw=v.mesh.geometry,c=ls.mother.surfaces.get(v.currentLip.geometry),attributes={},drawAttributes={};
    for(const name of [...new Set([...Object.keys(g.attributes),...Object.keys(draw.attributes)])].sort()){
      const a=g.attributes[name],b=draw.attributes[name];
      if(a?.isInterleavedBufferAttribute||b?.isInterleavedBufferAttribute)throw Error('Unreviewed interleaved geometry attribute: '+name);
      attributes[name]=a?{itemSize:a.itemSize,count:a.count,normalized:a.normalized,type:a.array.constructor.name,sha256:await hash(a.array)}:null;
      drawAttributes[name]=b?{itemSize:b.itemSize,count:b.count,normalized:b.normalized,type:b.array.constructor.name,sha256:b.array===a?.array?attributes[name].sha256:await hash(b.array)}:null;
    }
    // Read the original 49 upper/lower contact pairs from the final evaluated
    // native position buffer after normal and microgeometry stages. The IDs
    // remain protected; final positions are evidence, not an assumed invariant.
    const top=c.topology,nativePosition=top.geometry.attributes.position;
    if(top.geometry!==v.currentLip.geometry||top.pairs.length!==49||nativePosition.itemSize!==3||nativePosition.count!==top.count||nativePosition.isInterleavedBufferAttribute)throw Error('Original native contact-pair domain unavailable');
    const pairIDs=new Uint32Array(top.pairs.length*2),pairPositions=new nativePosition.array.constructor(top.pairs.length*6);
    for(let k=0;k<top.pairs.length;k++)for(let side=0;side<2;side++){
      const id=top.pairs[k][side===0?'upper':'lower'];if(!Number.isInteger(id)||id<0||id>=nativePosition.count)throw Error('Original native contact vertex invalid');
      pairIDs[k*2+side]=id;pairPositions.set(nativePosition.array.subarray(id*3,id*3+3),(k*2+side)*3);
    }
    if(!pairPositions.every(Number.isFinite))throw Error('Final native contact positions are not finite');
    // Select original vertex IDs independently of the R08 solver's own masks
    // and reports. Preserve native ID order and hash FINAL evaluated positions.
    if(!top.samples||top.samples.length!==nativePosition.count)throw Error('Original native sample domain unavailable');
    const nativeProtectedPositions={source:'Original topology.samples and final topology.geometry position; independent of R08 masks/reports'};
    for(const [name,predicate]of[['body',s=>s.v>=-.015],['nonSkin',s=>s.type>=.5]]){
      const ids=[];for(let id=0;id<nativePosition.count;id++){const s=top.samples[id];if(s&&predicate(s))ids.push(id);}
      if(!ids.length)throw Error('Empty original protected vertex domain: '+name);
      const idArray=new Uint32Array(ids),positions=new nativePosition.array.constructor(ids.length*3);
      for(let k=0;k<ids.length;k++)positions.set(nativePosition.array.subarray(ids[k]*3,ids[k]*3+3),k*3);
      if(!positions.every(Number.isFinite))throw Error('Nonfinite final protected positions: '+name);
      nativeProtectedPositions[name]={selection:name==='body'?'sample.v >= -.015':'sample.type >= .5',count:ids.length,vertexIDsSHA256:await hash(idArray),finalPositionSHA256:await hash(positions)};
    }
    const mats=Array.isArray(v.mesh.material)?v.mesh.material:[v.mesh.material],motion=skipSolverReports?null:motionLip.report(),corner=skipSolverReports?null:cornerLip.report();
    return{geometry:{attributes,index:await hash(g.index.array),vertices:g.attributes.position.count,canonicalPositions:await hash(m.positions),canonicalFaces:await hash(m.faces)},
      drawGeometry:{attributes:drawAttributes,index:await hash(draw.index.array),vertices:draw.attributes.position.count,groups:draw.groups.map(group=>({...group})),
        materialSlots:mats.map((mat,index)=>({index,type:mat.type,name:mat.name,native:mat===v.skin.material,procedural:mat===headProceduralSkin.material()}))},
      materials:await materials(),modelState:structuredClone(m.state),pose:lipWorkbench.pose(),ownerBeforeJaw:ls.performance.ownerBeforeJaw,dna:lipWorkbench.dna(),nativeLip:lipWorkbench.settings(),
      head:headProceduralSkin.settings(),body:bodyProceduralSkin.settings(),baseLip:lipRealism.settings(),baseComparison:lipRealism.report().comparison,
      innerLip:{comparison:innerLip.report().comparison,diagnostic:innerLip.report().diagnostic},
      motionLip:skipSolverReports?null:{version:motion.version,sourceCommit:motion.source.sourceCommit,comparison:motion.comparison,implementation:motion.implementation,installed:motion.solver.installed,enabled:motion.solver.enabled,valid:motion.solver.valid,calibration:motion.solver.calibration},
      cornerLip:skipSolverReports?null:{version:corner.version,sourceCommit:corner.source.sourceCommit,comparison:corner.comparison,implementation:corner.implementation,installed:corner.solver.installed,enabled:corner.solver.enabled,valid:corner.solver.valid,binding:corner.solver.binding},
      calibration:{reference:await hash(c.reference),horizontal:await hash(c.referenceHorizontal),lastKey:c.lastKey,count:c.topology.count},
      nativeEvaluation:{beforeLocalBase:await hash(c.base)},
      nativeProtectedPositions,
      nativeContactSamples:{source:'Original topology.pairs upper/lower IDs in final native topology.geometry.attributes.position',pairs:top.pairs.length,samples:pairIDs.length,pairVertexIDsSHA256:await hash(pairIDs),finalPositionSHA256:await hash(pairPositions),finalPositions:Array.from(pairPositions)},
      camera:{position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),target:v.orbit.target.toArray(),aspect:v.camera.aspect,fov:v.camera.fov,zoom:v.camera.zoom,near:v.camera.near,far:v.camera.far,projection:v.camera.projectionMatrix.toArray()},
      lighting:{lights:lights(),center:v.cineRig.center.toArray(),exposure:v.renderer.toneMappingExposure,toneMapping:v.renderer.toneMapping,outputColorSpace:v.renderer.outputColorSpace},
      functionsOriginal:v.render===initialFunctions.render&&v.renderer.render===initialFunctions.rendererRender&&v.update===initialFunctions.update&&ls.mother.update===initialFunctions.motherUpdate};}
  function align(reference){return withoutRender('explicit comparison camera and lighting alignment',()=>{
    const c=reference.camera;v.camera.position.fromArray(c.position);v.camera.quaternion.fromArray(c.quaternion);v.orbit.target.fromArray(c.target);
    for(const k of['aspect','fov','zoom','near','far'])v.camera[k]=c[k];v.camera.updateProjectionMatrix();v.orbit.update();
    // OrbitControls may change a last bit while resolving its internal state.
    // Reapply the exact held pose to the SAME native objects after that update.
    // No camera field is omitted and all subsequent state gates remain strict.
    const orbitResolvedCamera={position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),target:v.orbit.target.toArray()};
    v.camera.position.fromArray(c.position);v.camera.quaternion.fromArray(c.quaternion);v.orbit.target.fromArray(c.target);v.camera.updateMatrixWorld(true);
    const exactCamera={position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),target:v.orbit.target.toArray()};
    for(const key of['position','quaternion','target'])if(exactCamera[key].length!==c[key].length||exactCamera[key].some((value,index)=>!Object.is(value,c[key][index])))throw Error('Exact comparison camera restoration failed: '+key);
    interventions.push({label:'exact reference camera after native orbit update',orbitResolvedCamera,exactCamera,cameraPoseExact:true,cameraToleranceUsed:false});
    const actual=[];v.scene.traverse(o=>{if(o.isLight)actual.push(o);});const saved=reference.lighting.lights;
    if(actual.length!==saved.length)throw Error('Comparison native light count differs');
    v.cineRig.center.fromArray(reference.lighting.center);
    for(let i=0;i<actual.length;i++){const o=actual[i],s=saved[i];if(o.type!==s.type||o.name!==s.name)throw Error('Comparison native light ordering differs');
      o.position.fromArray(s.position);o.quaternion.fromArray(s.quaternion);o.scale.fromArray(s.scale);o.color.fromArray(s.color);o.intensity=s.intensity;o.visible=s.visible;
      if(s.ground){if(!o.groundColor)throw Error('Missing native ground light');o.groundColor.fromArray(s.ground);}
      if(s.target){if(!o.target)throw Error('Missing native light target');o.target.position.fromArray(s.target.position);o.target.quaternion.fromArray(s.target.quaternion);o.target.scale.fromArray(s.target.scale);o.target.updateMatrixWorld(true);}}
    v.renderer.toneMappingExposure=reference.lighting.exposure;v.scene.updateMatrixWorld(true);
    return{fields:['camera','existing native light/target transforms and colour/intensity','existing cineRig.center','exposure'],geometryModified:false,headBodySettingsModified:false};});}
  function shaders(){const mat=headProceduralSkin.material(),props=v.renderer.properties.get(mat),program=props.currentProgram||(props.programs&&[...props.programs.values()].at(-1));
    const gl=v.renderer.getContext();if(!program?.program)throw Error('Actual linked R04 GPU program absent');
    const attached=gl.getAttachedShaders(program.program)||[];
    return{programId:program.id,linked:gl.getProgramParameter(program.program,gl.LINK_STATUS),programLog:gl.getProgramInfoLog(program.program),
      templates:window.innerLip?innerLip.shaderEvidence():{originalR02Fragment:lipRealism.fragment()},
      surfaceTemplates:window.__LIP_SURFACE_MATERIAL__?.shaderEvidence?.()||null,
      activeUniforms:Array.from({length:gl.getProgramParameter(program.program,gl.ACTIVE_UNIFORMS)},(_,i)=>{const info=gl.getActiveUniform(program.program,i),location=gl.getUniformLocation(program.program,info.name);return{name:info.name,type:info.type,size:info.size,value:arrayValue(gl.getUniform(program.program,location))};}).sort((a,b)=>a.name.localeCompare(b.name)),
      expanded:attached.map(shader=>({type:gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.VERTEX_SHADER?'vertex':'fragment',compiled:gl.getShaderParameter(shader,gl.COMPILE_STATUS),log:gl.getShaderInfoLog(shader),source:gl.getShaderSource(shader)})),
      nativeUniforms:nativeUniforms(),source:'Actual WebGLProgram getAttachedShaders/getShaderSource; templates remain separately labelled onBeforeCompile templates with #include.'};}
  function report(){return{interventions:structuredClone(interventions),functionsOriginal:v.render===initialFunctions.render&&v.renderer.render===initialFunctions.rendererRender&&v.update===initialFunctions.update&&ls.mother.update===initialFunctions.motherUpdate};}
  window.__LS_VERIFY__={size,poseView,compare,state,align,nativeUniforms,shaders,report,
    restore:a=>withoutRenderAsync('fresh full-person archive restore',()=>controls.restore(a)),
    renderedFrame:()=>v.renderer.info.render.frame};
  return{ready:true};
}


async function capture(name,save=true){return stage('native GPU frame '+name,async()=>{
  const r=await page.evaluate(({width,height})=>{
    const v=__IDENTITY_QA__.viewer(),renderer=v.renderer,gl=renderer.getContext();
    if(gl.drawingBufferWidth!==width||gl.drawingBufferHeight!==height||v.camera.aspect!==width/height)throw Error('Framebuffer/camera drift; capture will not silently repair it');
    const old=renderer.render,d=Object.getOwnPropertyDescriptor(renderer,'render'),passes=[],errorBefore=gl.getError(),s=performance.now();
    Object.defineProperty(renderer,'render',{configurable:true,writable:true,value:function(scene,camera,...args){const frame=this.info.render.frame,result=Reflect.apply(old,this,[scene,camera,...args]);passes.push({nativeScene:scene===v.scene,nativeCamera:camera===v.camera,frameDelta:this.info.render.frame-frame,drawCalls:this.info.render.calls,triangles:this.info.render.triangles});return result;}});
    try{v.render();}finally{if(d)Object.defineProperty(renderer,'render',d);else delete renderer.render;}
    gl.finish();const bytes=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
    let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return{bytes:btoa(binary),errorBefore,error:gl.getError(),lost:gl.isContextLost(),defaultFramebuffer:gl.getParameter(gl.FRAMEBUFFER_BINDING)===null,
      elapsedMS:performance.now()-s,passes,restored:renderer.render===old,programs:renderer.info.programs.map(p=>({id:p.id,linked:!!gl.getProgramParameter(p.program,gl.LINK_STATUS),log:gl.getProgramInfoLog(p.program)}))};
  },{width,height});
  assert.equal(r.errorBefore,0);assert.equal(r.error,0);assert.equal(r.lost,false);assert.equal(r.defaultFramebuffer,true);assert(r.restored);
  assert(r.passes.some(x=>x.nativeScene&&x.nativeCamera&&x.frameDelta>0&&x.drawCalls>0&&x.triangles>0),'No real native draw');assert(r.programs.length&&r.programs.every(x=>x.linked),'Unlinked GPU program');
  const pixels=Buffer.from(r.bytes,'base64');let nonUniform=0;for(let i=4;i<pixels.length;i+=4)if(pixels[i]!==pixels[0]||pixels[i+1]!==pixels[1]||pixels[i+2]!==pixels[2])nonUniform++;
  assert(nonUniform>width*height*.01,'Blank native frame');const record={name,saved:save,width,height,sha256:sha(pixels),nonUniformPixels:nonUniform,gpu:{...r,bytes:undefined}};
  if(save){const png=new PNG({width,height});for(let y=0;y<height;y++)pixels.copy(png.data,y*width*4,(height-1-y)*width*4,(height-y)*width*4);const bytes=PNG.sync.write(png);record.pngSHA256=sha(bytes);fs.writeFileSync(path.join(out,name+'.png'),bytes);}
  q.frames.push(record);checkpoint();return{...record,pixels};
});}
function difference(a,b){let changed=0,max=0,total=0;for(let i=0;i<a.pixels.length;i+=4){const d=Math.max(...[0,1,2].map(k=>Math.abs(a.pixels[i+k]-b.pixels[i+k])));if(d)changed++;max=Math.max(max,d);total+=d;}return{changedPixels:changed,maximumChannelDN:max,meanMaxChannelDN:total/(width*height),interpretation:'A measured response, not an aesthetic score.'};}
async function state(){return page.evaluate(()=>__LS_VERIFY__.state());}

async function closePage(p,label){if(!p)return;await drainTransportObservations(p,label+' before GPU drain');if(p.isClosed())return;const r=await bounded(label+' GPU drain',()=>p.evaluate(()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench?.stop?.();const renderer=window.__IDENTITY_QA__?.viewer?.()?.renderer;if(!renderer)return{available:false};const gl=renderer.getContext(),before=gl.getError(),lost=gl.isContextLost(),frame=renderer.info.render.frame;gl.finish();if(gl.drawingBufferWidth&&gl.drawingBufferHeight)gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));return{available:true,before,after:gl.getError(),lostBefore:lost,lostAfter:gl.isContextLost(),frameBefore:frame,frameAfter:renderer.info.render.frame};}),90000);
  if(r.available){assert.equal(r.before,0);assert.equal(r.after,0);assert.equal(r.lostBefore,false);assert.equal(r.lostAfter,false);assert.equal(r.frameBefore,r.frameAfter);}
  await drainTransportObservations(p,label+' before page close');const binding=transportPages.get(p);if(binding)binding.closing=true;
  await bounded(label+' close page',()=>p.close({runBeforeUnload:false}),15000);assert(p.isClosed());await drainTransportObservations(p,label+' after page close');q.closedPages||=[];q.closedPages.push({label,gpu:r,closed:true});checkpoint();}
async function cleanup(){const start=Date.now(),errors=[];for(const c of browser?.contexts()||[])for(const p of c.pages())try{await closePage(p,'final cleanup');}catch(e){errors.push(String(e));}
  for(const binding of transportPages.values())binding.closing=true;
  try{if(browser)await bounded('close final browser',()=>browser.close(),15000);}catch(e){errors.push(String(e));}
  try{await drainTransportObservations(null,'final browser closed');}catch(e){errors.push(String(e));}
  q.cleanup={completed:errors.length===0,browserDisconnected:!browser||!browser.isConnected(),errors,elapsedMS:Date.now()-start};checkpoint();assert(q.cleanup.completed&&q.cleanup.browserDisconnected,'Bounded browser cleanup failed');}


function variantState(s){const x=structuredClone(s);assert.equal(x.materials[1].procedural,true);delete x.materials[1].cacheKeyValueSHA256;return x;}

function shaderSources(raw){return Object.fromEntries(raw.expanded.map(x=>[x.type,x.source]));}
function proveSurfaceShader(original,actual,mode){
 const a=shaderSources(original),b=shaderSources(actual),patches=JSON.parse(JSON.stringify(materialTransform.patches(mode)));
 assert.deepEqual(Object.keys(b).sort(),Object.keys(a).sort());assert.equal(b.vertex,a.vertex,'Surface mode changed actual expanded GPU vertex shader');
 let expected=a.fragment;
 for(const patch of patches){assert.equal(expected.split(patch.from).length,2,'Actual off shader lacks unique reviewed anchor '+patch.id);assert.equal(expected.includes(patch.to),false,'Patch already present '+patch.id);expected=expected.replace(patch.from,()=>patch.to);}
 assert.equal(expected,materialTransform.transform(a.fragment,mode),'Independent literal replay disagrees with pure transform');assert.equal(b.fragment,expected,'Actual expanded fragment differs beyond the declared literal patches');
 let reversed=b.fragment;for(const patch of patches.slice().reverse()){assert.equal(reversed.split(patch.to).length,2,'Actual GPU patch is not uniquely reversible '+patch.id);reversed=reversed.replace(patch.to,()=>patch.from);}assert.equal(reversed,a.fragment,'Reverse actual GPU patches did not recover original source');
 assert.deepEqual(actual.nativeUniforms,original.nativeUniforms,'Surface mode changed the 15 original live native uniforms');
 assert.deepEqual(actual.activeUniforms,original.activeUniforms,'Surface mode changed active GPU uniform names/types/values');
 assert.deepEqual(actual.templates,original.templates,'Inherited R04/R02 onBeforeCompile templates changed');
 const ev=actual.surfaceTemplates;if(mode!=='r06'){
  assert(ev?.compiledForCurrentMode,'No actual wrapper compilation evidence for current surface mode');assert.equal(ev.mode,mode);assert.equal(ev.originalVertex,ev.finalVertex);assert.deepEqual(ev.replacements,patches);
  assert.equal(ev.finalFragment,materialTransform.transform(ev.originalFragment,mode));assert.equal(ev.originalFragment,actual.templates.finalFragment,'Wrapper did not delegate to the exact original R04 template');
 }
 return{mode,patchIDs:patches.map(p=>p.id),actualExpandedVertexExact:true,actualExpandedFragmentOnlyDeclaredPatches:true,reverseActualGPUPatchesExact:true,originalNativeUniformObjectsAndValuesExact:true,allActiveGPUUniformsExact:true,inheritedTemplatesExact:true,wrapperCompiledForCurrentMode:ev?.compiledForCurrentMode===true};
}

function assertNativeState(s){
  assert(s.functionsOriginal,'Original native viewer functions changed');
  assert(s.materials.length&&s.materials.every(x=>x.sameOriginalObject&&x.sameOriginalCompileHook&&x.sameOriginalCacheKey),'Original material object or shader hook changed');
  assert.equal(s.innerLip.comparison,'r04');assert.equal(s.innerLip.diagnostic,0);assert.equal(s.baseComparison,'r02');assert.equal(s.baseLip.diagnostic,0);
  assert.equal(s.cornerLip.version,'LIP-CORNER-R06');assert.equal(s.cornerLip.sourceCommit,BASE_SOURCE);assert.equal(s.cornerLip.comparison,'r06');assert.equal(s.cornerLip.implementation,'native-corner-pucker-vector@3');assert(s.cornerLip.installed&&s.cornerLip.enabled&&s.cornerLip.valid,'Inherited R06 correction was disabled or invalidated');
  assert.equal(s.motionLip.sourceCommit,MOTION_SOURCE);assert.equal(s.motionLip.version,'LIP-MOTION-R05');assert.equal(s.motionLip.comparison,'r05');assert(s.motionLip.installed&&s.motionLip.enabled&&s.motionLip.valid,'Inherited R05 correction was disabled or invalidated');
  assert(/^[a-f0-9]{64}$/.test(s.nativeEvaluation.beforeLocalBase),'Actual native before-local input buffer unavailable');
  for(const name of['body','nonSkin']){const domain=s.nativeProtectedPositions[name];assert(Number.isInteger(domain.count)&&domain.count>0);assert(/^[a-f0-9]{64}$/.test(domain.vertexIDsSHA256)&&/^[a-f0-9]{64}$/.test(domain.finalPositionSHA256),'Independent final protected position evidence absent: '+name);}
  assert.equal(s.nativeContactSamples.pairs,49);assert.equal(s.nativeContactSamples.samples,98);assert.equal(s.nativeContactSamples.finalPositions.length,294);assert(s.nativeContactSamples.finalPositions.every(Number.isFinite));assert(/^[a-f0-9]{64}$/.test(s.nativeContactSamples.pairVertexIDsSHA256)&&/^[a-f0-9]{64}$/.test(s.nativeContactSamples.finalPositionSHA256),'Actual final native contact-pair samples unavailable');
}

async function shaderRecord(label,save=false){
  const data=await page.evaluate(()=>__LS_VERIFY__.shaders());assert(data.linked);assert(data.expanded.length>=2&&data.expanded.every(x=>x.compiled&&x.source),'Actual expanded compiled GLSL absent');
  assert(data.nativeUniforms.length===15&&data.nativeUniforms.every(x=>x.nativePresent&&x.skinPresent&&x.sameObject&&x.sameNativeObjectSinceHarness&&x.sameSkinObjectSinceHarness),'Original native uniform object ownership lost');
  assert(Array.isArray(data.templates.nativeUniformIdentity)&&data.templates.nativeUniformIdentity.length===15&&data.templates.nativeUniformIdentity.every(x=>x.present&&x.sameObject));
  assert(typeof data.templates.originalR02Fragment==='string'&&typeof data.templates.finalFragment==='string');
  const record={programId:data.programId,linked:data.linked,programLog:data.programLog,source:data.source,nativeUniforms:data.nativeUniforms,activeUniforms:data.activeUniforms,templates:{},surfaceTemplates:{},expanded:[]};
  for(const[name,source]of Object.entries(data.templates)){
    if(typeof source==='string'){const file=label+'-'+name+'-template.glsl';if(save)fs.writeFileSync(path.join(out,file),source);record.templates[name]={...(save?{file}:{}),sha256:sha(source),bytes:Buffer.byteLength(source),kind:'Actual onBeforeCompile template; includes may remain'};}
    else record.templates[name]=source;
  }
  if(data.surfaceTemplates){for(const[name,source]of Object.entries(data.surfaceTemplates)){
    if(typeof source==='string'&&['originalVertex','finalVertex','originalFragment','finalFragment'].includes(name)){const file=label+'-surface-'+name+'-template.glsl';if(save)fs.writeFileSync(path.join(out,file),source);record.surfaceTemplates[name]={...(save?{file}:{}),sha256:sha(source),bytes:Buffer.byteLength(source),kind:'Material wrapper onBeforeCompile source'};}
    else record.surfaceTemplates[name]=source;
  }}
  for(const shader of data.expanded){const file=label+'-'+shader.type+'-expanded.glsl';if(save)fs.writeFileSync(path.join(out,file),shader.source);record.expanded.push({...(save?{file}:{}),type:shader.type,compiled:shader.compiled,log:shader.log,sha256:sha(shader.source),bytes:Buffer.byteLength(shader.source)});}
  record.expanded.sort((a,b)=>a.type.localeCompare(b.type));
  return record;
}
function shaderFingerprint(record){return{templates:Object.fromEntries(Object.entries(record.templates).map(([name,value])=>[name,value?.sha256||value])),expanded:record.expanded.map(x=>({type:x.type,sha256:x.sha256,compiled:x.compiled})),nativeUniforms:record.nativeUniforms,activeUniforms:record.activeUniforms};}

async function provenance(){
 const urls=[ROOT+BUILD+'/kaopu-unified-human-workbench/lip-surface-r08/BUILD_MANIFEST.json',RAW,ROOT+BASE_BUILD+'/kaopu-unified-human-workbench/lip-corner-r06/preview.html'];
 const responses=await Promise.all(urls.map(url=>context.request.get(url,{timeout:60000})));
 for(const r of responses)assert.equal(r.status(),200,'Fixed public source unavailable');
 const [manifestBytes,preview,baseline]=await Promise.all(responses.map(r=>r.body())),manifest=JSON.parse(manifestBytes);
 assert.equal(manifest.version,VERSION);assert.equal(manifest.sourceCommit,SOURCE);assert.equal(manifest.previewSHA256,EXPECTED_PREVIEW);assert.equal(sha(preview),EXPECTED_PREVIEW);
 assert.equal(manifest.baselineBuild,BASE_BUILD);assert.equal(manifest.baselineSource,BASE_SOURCE);assert.equal(manifest.baselineSHA256,BASE_HASH);assert.equal(sha(baseline),BASE_HASH);assert.equal(manifest.baselineRestorationExact,true);
 const modules=['src/SurfaceMaterial.js','src/SurfaceLip.js'].map(name=>({name,text:fs.readFileSync(path.join(scope,name),'utf8')}));
 assert.deepEqual(Object.keys(manifest.modules).sort(),modules.map(m=>m.name).sort());
 for(const m of modules)assert.equal(sha(m.text),manifest.modules[m.name],'Frozen product module differs: '+m.name);
 const metadata={version:VERSION,sourceCommit:SOURCE,baselineSource:BASE_SOURCE,baselineBuild:BASE_BUILD,baselineSHA256:BASE_HASH,modules:manifest.modules};
 const suffix='\n<!-- LIP-SURFACE-R08 APPEND-ONLY NATIVE APPEARANCE -->\n<script>window.__LIP_SURFACE_SOURCE__='+JSON.stringify(metadata)+';\n'+modules.map(m=>m.text).join('\n')+'\n</script>\n';
 assert.equal(preview.toString('utf8').split(suffix).length,2);assert.equal(preview.toString('utf8').replace(suffix,''),baseline.toString('utf8'));
 const edge=JSON.parse(JSON.stringify(materialTransform.patches('edge')));assert.deepEqual(edge.map(x=>x.id),['edge-width','edge-pigment-transition']);assert.equal(materialTransform.patches('r06').length,0);
 q.manifest=manifest;q.previewSHA256=sha(preview);q.previewBytes=preview.length;q.reviewedEdgePatches=edge;
 q.byteProvenance={fixedBuild:BUILD,fixedSource:SOURCE,previewSHA256:sha(preview),previewBytes:preview.length,manifestSHA256:sha(manifestBytes),baselineSHA256:sha(baseline),reviewedAppendRemovalExact:true,localModuleHashesMatchFixedPublicBuild:true,helperSHA256:sha(helperSource),diagnosticOnly:true};
 json('FIXED_BUILD_MANIFEST.json',manifest);checkpoint();return q.byteProvenance;
}

/* This temporary diagnostic window never calls native solver/controller report
 * methods while its shader hooks are attached. The ordinary renderer receives
 * the original scene/camera and a new target made by the host's own target class.
 * The instrumented material remains opaque and uses the same original depth
 * and occlusion behaviour. Only its fragment output and one diagnostic uniform
 * are new. No material/geometry object is substituted into the scene.
 */
function createFloatWindow({width,height,label}){
 const v=__IDENTITY_QA__.viewer(),renderer=v.renderer,gl=renderer.getContext(),mat=headProceduralSkin.material(),helper=window.__LIP_FINE_DETAIL_GPU_PROBE__;
 if(window.__R08_DETAIL_WINDOW__)throw Error('Previous diagnostic window was not released');
 if(!helper||!renderer.capabilities.isWebGL2||!gl.getExtension('EXT_color_buffer_float'))throw Error('Native WebGL2 float colour target unavailable');
 const originalTarget=v.cineRig?.shadowTarget;
 if(!originalTarget?.isWebGLRenderTarget||typeof originalTarget.constructor!=='function')throw Error('Original native target constructor unavailable');
 if(mat.transparent!==false||mat.depthTest!==true||mat.depthWrite!==true)throw Error('Float observer requires unchanged opaque head material with depth');
 if(renderer.getRenderTarget()!==null||gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null)throw Error('Expected original default framebuffer before diagnostic');
 if(gl.drawingBufferWidth!==width||gl.drawingBufferHeight!==height||v.camera.aspect!==width/height)throw Error('Diagnostic camera/framebuffer drift');
 for(const owner of [v.skin.material,mat]){const value=renderer.properties.get(owner).uniforms?.uFPass?.value;if(value!==undefined&&value!==0)throw Error('Ordinary beauty pipeline did not restore native uFPass=0');}
 const target=new originalTarget.constructor(width,height,{type:1015,format:1023,internalFormat:'RGBA32F',minFilter:1003,magFilter:1003,depthBuffer:true,stencilBuffer:false,samples:0,colorSpace:'',generateMipmaps:false});
 if(!target.isWebGLRenderTarget||target===originalTarget||target.texture===originalTarget.texture||target.depthTexture!==null||target.samples!==0||target.texture.type!==1015||target.texture.format!==1023||target.texture.internalFormat!=='RGBA32F'||target.texture.colorSpace!=='')throw Error('Independent native RGBA32F target contract failed');
 const own=(o,k)=>Object.getOwnPropertyDescriptor(o,k),sameDescriptor=(a,b)=>a===undefined?b===undefined:b!==undefined&&['value','get','set','writable','enumerable','configurable'].every(k=>a[k]===b[k]);
 const c={label,target,active:false,disposed:false,compile:mat.onBeforeCompile,key:mat.customProgramCacheKey,compileDescriptor:own(mat,'onBeforeCompile'),keyDescriptor:own(mat,'customProgramCacheKey'),uniform:{value:0},compiles:[],errors:[],rendererRender:renderer.render,renderBufferDirect:renderer.renderBufferDirect,viewerUpdate:v.update,motherUpdate:__IDENTITY_QA__.model().lipStructure.mother.update};
 function sameFunctions(){return renderer.render===c.rendererRender&&renderer.renderBufferDirect===c.renderBufferDirect&&v.update===c.viewerUpdate&&__IDENTITY_QA__.model().lipStructure.mother.update===c.motherUpdate;}
 function install(){
  if(c.active||c.disposed)throw Error('Float observer already installed or released');
  if(mat.onBeforeCompile!==c.compile||mat.customProgramCacheKey!==c.key)throw Error('Material owner changed before float observation');
  c.compileWrapper=function(shader,...args){
   if(this!==mat)throw Error('Float observer invoked for a different material');
   Reflect.apply(c.compile,this,[shader,...args]);
   const originalVertex=shader.vertexShader,entries=Object.entries(shader.uniforms),patched=helper.patch(shader.fragmentShader);
   if(Object.prototype.hasOwnProperty.call(shader.uniforms,helper.UNIFORM))throw Error('Diagnostic uniform already existed');
   shader.fragmentShader=patched.fragment;shader.uniforms[helper.UNIFORM]=c.uniform;
   if(shader.vertexShader!==originalVertex||Object.keys(shader.uniforms).length!==entries.length+1||entries.some(([name,value])=>shader.uniforms[name]!==value))throw Error('Diagnostic changed inherited shader inputs');
   c.compiles.push({originalVertex,finalVertex:shader.vertexShader,originalFragment:patched.originalFragment,finalFragment:shader.fragmentShader,replacements:patched.replacements,addedUniform:helper.UNIFORM,allInheritedUniformObjectsPreserved:true,sourceRoundTripExact:patched.sourceRoundTripExact});
  };
  // Each window owns a new diagnostic uniform object. A unique key forces its
  // onBeforeCompile to bind that object instead of reusing the previous window.
  c.keyWrapper=function(){return Reflect.apply(c.key,mat,[])+'/inherited-lip-fine-detail-float-observer@1/'+label;};
  Object.defineProperty(mat,'onBeforeCompile',{configurable:true,writable:true,enumerable:c.compileDescriptor?.enumerable||false,value:c.compileWrapper});
  Object.defineProperty(mat,'customProgramCacheKey',{configurable:true,writable:true,enumerable:c.keyDescriptor?.enumerable||false,value:c.keyWrapper});
  c.active=true;mat.needsUpdate=true;return{installed:true,diagnosticUniform:helper.UNIFORM};
 }
 function draw(plane=null){
  if(c.disposed||(!c.active&&plane!==null)||(c.active&&!Number.isInteger(plane))||(plane!==null&&(plane<0||plane>=helper.PLANES.length)))throw Error('Invalid float observation plane');
  if(!sameFunctions()||headProceduralSkin.material()!==mat)throw Error('Native function/material identity changed during float observation');
  if(c.active&&(mat.onBeforeCompile!==c.compileWrapper||mat.customProgramCacheKey!==c.keyWrapper))throw Error('Temporary observer lost its owned hooks');
  if(renderer.getRenderTarget()!==null)throw Error('Float pass must begin on default target');
  if(plane!==null)c.uniform.value=plane;
  const before={frame:renderer.info.render.frame,error:gl.getError(),target:renderer.getRenderTarget(),viewport:renderer.getViewport(target.viewport.clone()),scissor:renderer.getScissor(target.scissor.clone()),scissorTest:renderer.getScissorTest(),cube:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel()},calls=[],descriptor=own(renderer,'renderBufferDirect'),original=renderer.renderBufferDirect,start=performance.now();
  let result,raw;
  try{
   renderer.setRenderTarget(target);renderer.clear(true,true,true);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('RGBA32F framebuffer incomplete');
   const attachment={componentType:gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE),redBits:gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_RED_SIZE),greenBits:gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_GREEN_SIZE),blueBits:gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_BLUE_SIZE),alphaBits:gl.getFramebufferAttachmentParameter(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE),samples:gl.getParameter(gl.SAMPLES)};
   if(attachment.componentType!==gl.FLOAT||[attachment.redBits,attachment.greenBits,attachment.blueBits,attachment.alphaBits].some(x=>x!==32)||attachment.samples!==0)throw Error('Actual framebuffer is not non-MSAA RGBA32F');
   Object.defineProperty(renderer,'renderBufferDirect',{configurable:true,writable:true,enumerable:descriptor?.enumerable||false,value:function(...args){const r=Reflect.apply(original,this,args);if(args[3]===mat)calls.push({nativeCamera:args[0]===v.camera,headMaterial:true,blendEnabled:gl.isEnabled(gl.BLEND),depthTest:gl.isEnabled(gl.DEPTH_TEST),depthWrite:gl.getParameter(gl.DEPTH_WRITEMASK),floatFramebuffer:gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null});return r;}});
   // Bypass only beauty composition, not the native scene or head renderer.
   Reflect.apply(c.rendererRender,renderer,[v.scene,v.camera]);gl.finish();
   if(!calls.length||calls.some(x=>!x.nativeCamera||x.blendEnabled||!x.depthTest||!x.depthWrite||!x.floatFramebuffer))throw Error('Original opaque head was not drawn with native depth into the float target');
   const floats=new Float32Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,floats);raw=__LS_VERIFY__.shaders();
   if(plane!==null){const active=raw.activeUniforms.find(x=>x.name===helper.UNIFORM);if(!active||active.value!==plane)throw Error('Actual GPU diagnostic plane uniform differs');}
   const bytes=new Uint8Array(floats.buffer);let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
   const markerBytes=new Uint8Array(new Float32Array([1]).buffer);const endian=markerBytes[0]===0&&markerBytes[3]===63?'LE':markerBytes[0]===63?'BE':'unknown';
   result={plane,planeName:plane===null?'uninstrumented-float-control':helper.PLANES[plane].name,width,height,bytes:btoa(binary),byteOrder:endian,frameBefore:before.frame,frameAfter:renderer.info.render.frame,nativeDrawCalls:renderer.info.render.calls,nativeTriangles:renderer.info.render.triangles,headDraws:calls,attachment,errorBefore:before.error,errorAfter:gl.getError(),contextLost:gl.isContextLost(),elapsedMS:performance.now()-start,rawShader:raw,compiledEvidence:c.compiles.at(-1)||null,readbackMethod:'Original renderer.readRenderTargetPixels into Float32Array',directOriginalSceneAndCamera:true};
  }catch(error){c.errors.push(String(error));throw error;}
  finally{
   if(descriptor)Object.defineProperty(renderer,'renderBufferDirect',descriptor);else delete renderer.renderBufferDirect;
   renderer.setRenderTarget(before.target,before.cube,before.mip);renderer.setViewport(before.viewport);renderer.setScissor(before.scissor);renderer.setScissorTest(before.scissorTest);
  }
  if(!sameFunctions()||!sameDescriptor(own(renderer,'renderBufferDirect'),descriptor)||renderer.getRenderTarget()!==before.target||gl.getParameter(gl.FRAMEBUFFER_BINDING)!==null)throw Error('Float draw did not restore renderer functions/default target');
  result.rendererFunctionsRestored=true;result.defaultTargetRestored=true;return result;
 }
 function restore(){
  if(c.disposed)return c.restoration;
  const restored={};
  for(const[name,old,wrapper,descriptor]of[['onBeforeCompile',c.compile,c.compileWrapper,c.compileDescriptor],['customProgramCacheKey',c.key,c.keyWrapper,c.keyDescriptor]]){
   if(c.active&&mat[name]!==wrapper)throw Error('Refusing to overwrite a changed diagnostic hook owner: '+name);
   if(c.active){if(descriptor)Object.defineProperty(mat,name,descriptor);else delete mat[name];}
   restored[name]=mat[name]===old&&sameDescriptor(own(mat,name),descriptor);
  }
  mat.needsUpdate=true;c.active=false;
  if(renderer.getRenderTarget()!==null)throw Error('Diagnostic target remained active before release');
  target.dispose();c.disposed=true;
  c.restoration={originalCompileDescriptorExact:restored.onBeforeCompile,originalCacheDescriptorExact:restored.customProgramCacheKey,rendererFunctionsExact:sameFunctions(),defaultTargetRestored:renderer.getRenderTarget()===null,targetDisposed:true,otherOwnersOverwritten:false,compilations:c.compiles.length,errors:[...c.errors]};
  return c.restoration;
 }
 const api={install,draw,restore};Object.defineProperty(window,'__R08_DETAIL_WINDOW__',{configurable:true,value:api});
 return{label,sourceConstructor:'Original v.cineRig.shadowTarget.constructor',originalTargetUnmodified:true,independentTarget:true,type:target.texture.type,format:target.texture.format,internalFormat:target.texture.internalFormat,colorSpace:target.texture.colorSpace,samples:target.samples,depthBuffer:target.depthBuffer,stencilBuffer:target.stencilBuffer,materialTransparent:mat.transparent,materialDepthTest:mat.depthTest,materialDepthWrite:mat.depthWrite,planeNames:helper.PLANES.map(p=>p.name)};
}

function diagnosticState(s){
 const x=structuredClone(s);delete x.motionLip;delete x.cornerLip;
 for(const key of ['compileHookSHA256','cacheKeyFunctionSHA256','cacheKeyValueSHA256','sameOriginalCompileHook','sameOriginalCacheKey'])delete x.materials[1][key];
 return x;
}
function saveRawShader(label,raw){
 assert(raw.linked&&raw.expanded.length===2&&raw.expanded.every(s=>s.compiled&&s.source),'Actual diagnostic GPU shader unavailable');
 const result={label,programId:raw.programId,linked:raw.linked,programLog:raw.programLog,activeUniforms:raw.activeUniforms,nativeUniforms:raw.nativeUniforms,expanded:[]};
 for(const shader of raw.expanded){const file=label+'-'+shader.type+'-expanded.glsl';fs.writeFileSync(path.join(out,file),shader.source);result.expanded.push({file,type:shader.type,sha256:sha(shader.source),bytes:Buffer.byteLength(shader.source),compiled:shader.compiled,log:shader.log});}
 return result;
}
function proveFloatShader(control,actual,evidence,plane){
 const a=shaderSources(control),b=shaderSources(actual),patch=detailProbe.patch(a.fragment);
 assert.equal(b.vertex,a.vertex,'Diagnostic changed the actual float-control vertex shader');
 assert.equal(b.fragment,patch.fragment,'Actual float diagnostic source differs outside the exact observer patch');
 assert.deepEqual(actual.nativeUniforms,control.nativeUniforms,'Float observer changed original 15 uniform objects or values');
 assert(evidence?.allInheritedUniformObjectsPreserved&&evidence.sourceRoundTripExact);assert.equal(evidence.originalVertex,evidence.finalVertex);
 assert.equal(detailProbe.patch(evidence.originalFragment).fragment,evidence.finalFragment);
 const extra=actual.activeUniforms.find(x=>x.name===detailProbe.UNIFORM);assert(extra);assert.equal(extra.value,plane);
 const old=new Map(control.activeUniforms.map(x=>[x.name,x]));
 for(const u of actual.activeUniforms)if(u.name!==detailProbe.UNIFORM){assert(old.has(u.name),'Observer added an undeclared active uniform '+u.name);assert.deepEqual(u,old.get(u.name),'Observer changed a surviving original GPU uniform '+u.name);}
 return{actualVertexExact:true,actualFragmentExactObserverPatch:true,originalNativeUniformObjectsAndValuesExact:true,onlyAddedActiveUniform:detailProbe.UNIFORM,actualPlaneValue:extra.value,survivingOriginalActiveUniformsExact:true,optimizedOutOriginalUniforms:control.activeUniforms.filter(x=>!actual.activeUniforms.some(y=>y.name===x.name)).map(x=>x.name),originalTemplateVertexExact:true,templatePatchExact:true,explanation:'Compiler may remove original beauty-only uniforms after diagnostic final output; restored ordinary program is separately required exact.'};
}

async function floatWindow(pair){
 const tag='detail-neutral-'+pair.view;
 await page.evaluate(({view,reference})=>{__LS_VERIFY__.compare('r06');__LS_VERIFY__.poseView('neutral',view);__LS_VERIFY__.align(reference);},{view:pair.view,reference:pair.offState});
 const reference=await capture(tag+'-beauty-before',false),before=await state(),beforeRaw=await page.evaluate(()=>__LS_VERIFY__.shaders()),beforeShader=await shaderRecord(tag+'-beauty-before',true);
 assert.equal(reference.sha256,pair.off.sha256);assert.deepEqual(before,pair.offState);assertNativeState(before);
 const solvers=()=>page.evaluate(()=>({corner:__LIP_CORNER_SOLVER__.report(),motion:__LIP_MOTION_SOLVER__.report()})),beforeSolvers=await solvers();
 const windowRecord={tag,view:pair.view,referenceFrame:pair.off.name,referenceSHA256:reference.sha256,beforeState:before,beforeSolvers,planes:[],diagnosticOnly:true};
 q.detailWindows||=[];q.detailWindows.push(windowRecord);checkpoint();let failure=null,controlRaw,data={};
 try{
  windowRecord.target=await page.evaluate(createFloatWindow,{width,height,label:tag});checkpoint();
  const control=await stage(tag+' uninstrumented float control',()=>page.evaluate(()=>__R08_DETAIL_WINDOW__.draw(null)));
  for(const key of['errorBefore','errorAfter'])assert.equal(control[key],0,key);assert.equal(control.contextLost,false);assert.equal(control.attachment.samples,0);assert(control.rendererFunctionsRestored&&control.defaultTargetRestored);
  controlRaw=control.rawShader;windowRecord.floatControl={...control,bytes:undefined,rawShader:undefined,compiledEvidence:undefined,shader:saveRawShader(tag+'-float-control',controlRaw),rawBytes:Buffer.from(control.bytes,'base64').length,rawSHA256:sha(Buffer.from(control.bytes,'base64')),savedRaw:false,meaning:'Same float target without the observer; shader-prefix control only, not a beauty reference'};
  assert.deepEqual(await state(),before,'Uninstrumented float control changed native state');assert.deepEqual(await solvers(),beforeSolvers,'Uninstrumented float control changed solver reports/calls');
  await page.evaluate(()=>__R08_DETAIL_WINDOW__.install());
  for(let plane=0;plane<detailProbe.PLANES.length;plane++){
   const name=detailProbe.PLANES[plane].name,r=await stage(tag+' raw float '+name,()=>page.evaluate(plane=>__R08_DETAIL_WINDOW__.draw(plane),plane));
   assert.equal(r.errorBefore,0);assert.equal(r.errorAfter,0);assert.equal(r.contextLost,false);assert(r.rendererFunctionsRestored&&r.defaultTargetRestored);assert(r.frameAfter>r.frameBefore&&r.nativeDrawCalls>0&&r.nativeTriangles>0);assert.equal(r.byteOrder,os.endianness(),'Float readback byte order differs from diagnostic host');
   const raw=Buffer.from(r.bytes,'base64');assert.equal(raw.length,width*height*4*4);
   const typed=new Float32Array(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
   const compressed=zlib.gzipSync(raw,{level:6}),file=tag+'-'+name+'.rgba32f.gz';fs.writeFileSync(path.join(out,file),compressed);assert(zlib.gunzipSync(compressed).equals(raw),'Float evidence compression is not lossless');
   const proof=proveFloatShader(controlRaw,r.rawShader,r.compiledEvidence,plane),shader=saveRawShader(tag+'-'+name,r.rawShader);
   const current=await page.evaluate(()=>__LS_VERIFY__.state(true));assert.deepEqual(diagnosticState(current),diagnosticState(before),'Float observer changed native/draw arrays, original authoring, camera, lighting or material values');
   const receipt={name:tag+'-'+name,file,plane,channels:[...detailProbe.PLANES[plane].channels,'sentinel'],width,height,type:'Float32Array',byteOrder:r.byteOrder,rowOrder:'bottom-to-top; original WebGL readback order',rawBytes:raw.length,rawSHA256:sha(raw),gzipBytes:compressed.length,gzipSHA256:sha(compressed),compression:'gzip lossless, exact decompress verified',sentinel:detailProbe.SENTINEL,proof,shader,gpu:{...r,bytes:undefined,rawShader:undefined,compiledEvidence:undefined},completeNativeStateDuringTemporaryHooksExact:true,solverReportsIntentionallyNotCalled:true};
   data[name]=typed;windowRecord.planes.push(receipt);q.floatFrames.push(receipt);checkpoint();
  }
  windowRecord.statistics=detailProbe.summarize(data,width,height);json(tag+'-statistics.json',windowRecord.statistics);
 }catch(error){failure=error;windowRecord.failure=String(error);windowRecord.stack=error.stack;checkpoint();}
 finally{
  try{windowRecord.hookRestoration=await page.evaluate(()=>window.__R08_DETAIL_WINDOW__?__R08_DETAIL_WINDOW__.restore():{unavailable:true});checkpoint();}
  catch(error){windowRecord.restorationError=String(error);failure=failure?new AggregateError([failure,error],'Float diagnostic and hook restoration failed'):error;checkpoint();}
 }
 if(!windowRecord.hookRestoration?.unavailable){
  try{
   for(const key of['originalCompileDescriptorExact','originalCacheDescriptorExact','rendererFunctionsExact','defaultTargetRestored','targetDisposed'])assert.equal(windowRecord.hookRestoration[key],true,key);
   const restored=await capture(tag+'-beauty-restored',false),after=await state(),afterRaw=await page.evaluate(()=>__LS_VERIFY__.shaders()),afterShader=await shaderRecord(tag+'-beauty-restored',true);
   assert.deepEqual(after,before,'Diagnostic failed to restore complete native state');assert.deepEqual(await solvers(),beforeSolvers,'Diagnostic changed native solver reports/calls');assert.equal(restored.sha256,reference.sha256,'Diagnostic failed to restore original beauty pixels');assert.deepEqual(shaderFingerprint(afterShader),shaderFingerprint(beforeShader),'Diagnostic failed to restore original ordinary GPU source/uniforms');assert.equal(afterRaw.programId,beforeRaw.programId,'Diagnostic failed to recover the original ordinary WebGLProgram');
   const restoredReport=await page.evaluate(()=>surfaceLip.report());assert.equal(restoredReport.comparison,'r06');assert.equal(restoredReport.material.mode,'r06');assert(restoredReport.material.valid&&restoredReport.material.hooksStable);assert.equal(restoredReport.material.errors.length,0);
   windowRecord.restoration={frameSHA256:restored.sha256,ordinaryProgramId:afterRaw.programId,originalProgramExact:true,originalPixelsExact:true,originalActualShaderAndUniformsExact:true,completeNativeStateExact:true,solverReportsAndCallsExact:true,shader:afterShader};
   await page.evaluate(()=>{if(!Reflect.deleteProperty(window,'__R08_DETAIL_WINDOW__'))throw Error('Diagnostic window global could not be released');});checkpoint();
  }catch(error){windowRecord.finalRestorationError=String(error);failure=failure?new AggregateError([failure,error],'Float diagnostic restoration proof failed'):error;checkpoint();}
 }
 if(failure)throw failure;
 assert.equal(windowRecord.planes.length,6);assert(windowRecord.statistics.coverage.exteriorPixels>0);windowRecord.completed=true;checkpoint();return{view:pair.view,planes:6,rawFloatEvidence:true,originalPixelsAndProgramRestored:true,completeNativeStateRestored:true};
}

async function diagnosticChecks(){
 const primary=await load(PUBLIC_URL,'fixed R08 diagnostic',true,false);page=primary.page;
 await page.addScriptTag({content:helperSource});
 await page.evaluate(()=>__LS_VERIFY__.compare('r06'));
 const pairs={},matrix=[['neutral','macro'],['neutral','oblique'],['neutral','front'],['jaw','oblique'],['pucker','oblique']];
 for(const[pose,view]of matrix)await test('actual beauty '+pose+'/'+view+' R06 and edge only',async()=>{
  const tag=pose+'-'+view;
  await page.evaluate(({pose,view})=>{__LS_VERIFY__.compare('r06');__LS_VERIFY__.poseView(pose,view);},{pose,view});
  const off=await capture(tag+'-r06'),offState=await state(),offRaw=await page.evaluate(()=>__LS_VERIFY__.shaders()),offShader=await shaderRecord(tag+'-r06',true);
  assertNativeState(offState);const beforeSolvers=await page.evaluate(()=>({corner:__LIP_CORNER_SOLVER__.report(),motion:__LIP_MOTION_SOLVER__.report()}));
  let edge,edgeState,edgeRaw,edgeShader,proof;
  try{
   await page.evaluate(()=>__LIP_SURFACE_MATERIAL__.setMode('edge'));
   edge=await capture(tag+'-edge-only');edgeState=await state();edgeRaw=await page.evaluate(()=>__LS_VERIFY__.shaders());edgeShader=await shaderRecord(tag+'-edge-only',true);
   assertNativeState(edgeState);assert.deepEqual(variantState(edgeState),variantState(offState),'Edge-only changed native/draw geometry, settings, camera, lighting or original owners');
   assert.deepEqual(await page.evaluate(()=>({corner:__LIP_CORNER_SOLVER__.report(),motion:__LIP_MOTION_SOLVER__.report()})),beforeSolvers,'Edge mode changed native solver reports/calls');
   proof=proveSurfaceShader(offRaw,edgeRaw,'edge');assert.equal(proof.patchIDs.length,2);
  }finally{await page.evaluate(()=>__LIP_SURFACE_MATERIAL__.setMode('r06'));}
  const restored=await capture(tag+'-r06-restored',false),restoredState=await state(),restoredShader=await shaderRecord(tag+'-r06-restored',false);
  assert.deepEqual(restoredState,offState);assert.equal(restored.sha256,off.sha256);assert.deepEqual(shaderFingerprint(restoredShader),shaderFingerprint(offShader));
  const delta=difference(off,edge);pairs[tag]={pose,view,off,offState,offRaw,offShader};q.comparisons||=[];
  q.comparisons.push({pose,view,offFrame:off.name,edgeFrame:edge.name,offSHA256:off.sha256,edgeSHA256:edge.sha256,difference:delta,offState,edgeState,proof,offShader,edgeShader,completeNativeStateExactExceptModeCacheKey:true,originalPixelsRestoredExact:true,originalActualShaderRestoredExact:true,solverReportsAndCallsExact:true});checkpoint();
  return{pose,view,patchIDs:proof.patchIDs,...delta,originalPixelsRestoredExact:true};
 });
 for(const view of['macro','front'])await test('frozen R06 neutral '+view+' raw float detail and exact restoration',()=>floatWindow(pairs['neutral-'+view]));
 q.finalNativeState=await state();assertNativeState(q.finalNativeState);q.finalController=await page.evaluate(()=>surfaceLip.report());assert.equal(q.finalController.comparison,'r06');assert.equal(q.finalController.material.mode,'r06');assert.equal(q.finalController.material.errors.length,0);
 q.primaryInterventions=await page.evaluate(()=>__LS_VERIFY__.report());assert(q.primaryInterventions.functionsOriginal);
 assert.equal(q.frames.filter(x=>x.saved).length,10);assert.equal(q.floatFrames.length,12);assert.equal(q.detailWindows.length,2);assert(q.detailWindows.every(x=>x.completed&&x.restoration?.originalPixelsExact&&x.restoration?.originalProgramExact));assert.equal(q.startups.length,1);
}

(async()=>{
 fatalTimer=setTimeout(()=>terminated('Ten-minute diagnostic deadline exceeded',124),budgetMS);
 try{
  const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
  browser=await chromium.launch(options);context=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1});
  await test('fixed immutable build, source and diagnostic helper provenance',provenance);await context.close();
  await diagnosticChecks();await drainTransportObservations(null,'before strict diagnostic error gate');
  for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key);
  q.completed=true;q.publicHttpsPassed=true;q.browserPassed=true;
 }catch(error){q.completed=false;q.failure=String(error);q.stack=error.stack;process.exitCode=1;console.error(error);}
 finally{
  q.verificationFinishedAt=new Date().toISOString();json('qa.json',q);checkpoint();
  // Even a failed observer must attempt to release its own temporary hooks.
  if(page&&!page.isClosed())try{q.emergencyDiagnosticRelease=await page.evaluate(()=>window.__R08_DETAIL_WINDOW__?__R08_DETAIL_WINDOW__.restore():{notInstalled:true});}catch(error){q.emergencyReleaseError=String(error);q.completed=false;process.exitCode=1;}
  try{await cleanup();}catch(error){q.cleanupError=String(error);q.completed=false;q.publicHttpsPassed=false;q.browserPassed=false;process.exitCode=1;}
  try{for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key+' after cleanup');}
  catch(error){q.finalErrorGateFailure=String(error);q.failure||=String(error);q.completed=false;q.publicHttpsPassed=false;q.browserPassed=false;process.exitCode=1;}
  clearTimeout(fatalTimer);q.finishedAt=new Date().toISOString();q.elapsedMS=Date.now()-Date.parse(q.startedAt);q.shareAllowed=false;q.visualAcceptance=false;q.productionReady=false;json('qa.json',q);checkpoint();
  json('DIAGNOSTIC_RECEIPT.json',{schema:'kaopu/lip-surface-diagnostic-receipt@1',diagnosticCommit:RUNNER_SOURCE,sourceSHA:SOURCE,buildSHA:BUILD,previewSHA256:q.previewSHA256,publicURL:PUBLIC_URL,completed:q.completed,diagnosticOnly:true,productPublished:false,visualAcceptance:false,productionReady:false,savedBeautyFrames:q.frames.filter(x=>x.saved).length,beautyReadbacks:q.frames.length,rawFloatPlanes:q.floatFrames.length,detailWindows:q.detailWindows?.length||0,cleanup:q.cleanup,failure:q.failure||q.cleanupError||q.emergencyReleaseError||null,evidence:'qa.json'});
  console.log(JSON.stringify({completed:q.completed,tests:q.tests.length,savedBeautyFrames:q.frames.filter(x=>x.saved).length,rawFloatPlanes:q.floatFrames.length,elapsedMS:q.elapsedMS,failure:q.failure||q.cleanupError||null,output:out}));
 }
})();

