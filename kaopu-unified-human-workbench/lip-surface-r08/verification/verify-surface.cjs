'use strict';
/* Fixed-public R08 surface audit. Actual native GPU images and active uniforms;
 * complete native/draw attributes remain byte-exact across material variants.
 * Technical completion never promotes the candidate to visual acceptance. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),vm=require('node:vm');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const VERSION='LIP-SURFACE-R08',IMPLEMENTATION='native-lip-surface@1';
const BASE_SOURCE='1e1e216c2005f4c318da190e1b3b160cc4bd4a6d',BASE_BUILD='1237284ea60f9c198b2b63543f098a7551a9af2f';
const BASE_HASH='a6f50aa8e1f7898da5e40b73fb7ab8476db7ca4a14505a6ffad2e8aca1f63cac';
const MOTION_SOURCE='a8bba75322c12df151ecbcebc416087b5248aa5f',INNER_SOURCE='9d855c6051e76a20f052c95f0dda95103d946ef7',INHERITED_SOURCE='01cfde47476b7be6764e9c6a79d925462511539b';
const ROOT='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/';
const BASE_RAW=ROOT+BASE_BUILD+'/kaopu-unified-human-workbench/lip-corner-r06/preview.html',BASE_URL='https://htmlpreview.github.io/?'+BASE_RAW;
const PUBLIC_URL=process.env.PUBLIC_URL||process.env.CANDIDATE_URL,SOURCE=process.env.SOURCE_SHA,BUILD=process.env.BUILD_SHA;
assert(!process.env.MODE||process.env.MODE==='public','This suite requires the immutable public build');
assert(/^[a-f0-9]{40}$/.test(SOURCE||''),'SOURCE_SHA required');assert(/^[a-f0-9]{40}$/.test(BUILD||''),'BUILD_SHA required');
const RAW=ROOT+BUILD+'/kaopu-unified-human-workbench/lip-surface-r08/preview.html';
assert.equal(PUBLIC_URL,'https://htmlpreview.github.io/?'+RAW,'Public URL must name the exact immutable R08 build');
const scope=path.resolve(__dirname,'..'),previewPath=process.env.CANDIDATE_PATH||path.join(scope,'preview.html');
const manifestPath=process.env.BUILD_MANIFEST_PATH||path.join(scope,'BUILD_MANIFEST.json');
const out=path.resolve(process.env.QA_OUT||path.join(scope,'evidence','public'));
const width=640,height=512,budgetMS=Number(process.env.QA_BUDGET_MS||900000);
assert(Number.isFinite(budgetMS)&&budgetMS>=120000&&budgetMS<=960000,'Invalid bounded deadline');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const materialSource=fs.readFileSync(path.join(scope,'src/SurfaceMaterial.js'),'utf8'),isolated={window:{}};
vm.runInNewContext(materialSource,isolated,{timeout:1000,filename:'reviewed-SurfaceMaterial.js'});
const materialTransform=isolated.window.__LIP_SURFACE_MATERIAL__;
assert.equal(typeof materialTransform?.transform,'function','Material must export its pure strict transform');
assert.equal(typeof materialTransform?.patches,'function','Material must export reviewed literal patches');
fs.mkdirSync(out,{recursive:true});
const q={schema:'kaopu/lip-surface-public-qa@1',version:VERSION,mode:'public',sourceSHA:SOURCE,buildSHA:BUILD,publicURL:PUBLIC_URL,
 verifierSHA256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),budgetMS,
 numericEncoding:{schema:'kaopu/qa-nonfinite@1',tagKey:'__qaNonFiniteNumber',values:['Infinity','-Infinity','NaN'],scope:'New verification JSON only; native archives remain unchanged.',inMemoryComparison:'Actual JavaScript numbers remain untouched for strict comparisons.'},
 framebuffer:{width,height,pixelRatio:1},browserViewport:{width:1280,height:900},tests:[],frames:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],transportObservations:[],transportObservationDrains:[],
 completed:false,publicHttpsPassed:false,browserPassed:false,shareAllowed:false,visualAcceptance:false,productionReady:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
 limitations:[
  'One frozen native person, seven complete pose/view pairs. No population or clinical claim.',
  'All native and actual draw attribute arrays, indices, canonical geometry, original material object/properties, all person settings, calibration, camera and lighting must remain exact across surface variants.',
  'The stable procedural material wrapper has one mode-dependent cache-key VALUE. Across independent R06 only its two function-source hashes are excluded; the off cache-key value remains exact.',
  'Actual expanded GPU fragment changes must equal the reviewed finite literal patch sequence applied independently to the off program; vertex source and every active GPU uniform value remain exact.',
  'Two single-factor comparisons freeze the already rendered neutral person and restore its original complete native state, solver reports/calls, actual GPU shader and pixels.',
  'The fresh archive restores the actual half-progress jaw person. Camera and lighting are explicitly aligned; no claim that the archive owns them.',
  'Pixel response and successful rendering do not establish realistic texture. Native originals require direct visual comparison with sourced human photographs.',
  'Native GPU timings include the current software-rendered CI environment; no physical-phone performance claim.'
 ]};

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


async function provenance(){
 const preview=fs.readFileSync(previewPath),manifest=JSON.parse(fs.readFileSync(manifestPath));
 assert.equal(manifest.version,VERSION);assert.equal(manifest.sourceCommit,SOURCE);assert.equal(manifest.baselineSource,BASE_SOURCE);assert.equal(manifest.baselineBuild,BASE_BUILD);assert.equal(manifest.baselineSHA256,BASE_HASH);
 assert.equal(manifest.baselineRestorationExact,true);assert.equal(sha(preview),manifest.previewSHA256);
 const modules=['src/SurfaceMaterial.js','src/SurfaceLip.js'].map(name=>({name,text:fs.readFileSync(path.join(scope,name),'utf8')}));
 assert.deepEqual(Object.keys(manifest.modules).sort(),modules.map(m=>m.name).sort(),'Unexpected reviewed module set');
 for(const m of modules)assert.equal(sha(m.text),manifest.modules[m.name],m.name+' reviewed module hash');
 const responses=await Promise.all([context.request.get(BASE_RAW,{timeout:60000}),context.request.get(RAW,{timeout:60000})]);
 const [baseline,publicResponse]=responses;assert.equal(baseline.status(),200);assert.equal(publicResponse.status(),200);
 const [baselineBytes,publicBytes]=await Promise.all(responses.map(r=>r.body()));
 assert.equal(sha(baselineBytes),BASE_HASH);assert.equal(sha(publicBytes),manifest.previewSHA256);assert(preview.equals(publicBytes),'Local and fixed public bytes differ');
 const metadata={version:VERSION,sourceCommit:SOURCE,baselineSource:BASE_SOURCE,baselineBuild:BASE_BUILD,baselineSHA256:BASE_HASH,modules:manifest.modules};
 const suffix='\n<!-- LIP-SURFACE-R08 APPEND-ONLY NATIVE APPEARANCE -->\n<script>window.__LIP_SURFACE_SOURCE__='+JSON.stringify(metadata)+';\n'+modules.map(m=>m.text).join('\n')+'\n</script>\n';
 const text=publicBytes.toString('utf8');assert.equal(text.split(suffix).length,2,'Expected exactly one reviewed R08 append block');
 assert.equal(text.replace(suffix,''),baselineBytes.toString('utf8'),'Removing the reviewed append must recover immutable R06 exactly');
 const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>sha(m[1]));
 const inherited=scripts(baselineBytes.toString('utf8'));assert.deepEqual(manifest.originalScriptHashes,inherited);assert.deepEqual(scripts(text).slice(0,inherited.length),inherited);
 const patches={};for(const mode of['r06','edge','colour','r08']){patches[mode]=JSON.parse(JSON.stringify(materialTransform.patches(mode)));assert(Array.isArray(patches[mode]));for(const p of patches[mode])assert(typeof p.id==='string'&&typeof p.from==='string'&&p.from&&typeof p.to==='string'&&p.to&&p.to!==p.from);}
 assert.deepEqual(patches.r06,[]);assert.deepEqual(patches.edge.map(p=>p.id),['edge-width','edge-pigment-transition']);assert.deepEqual(patches.colour.map(p=>p.id),['tissue-colour']);assert.equal(patches.r08.length,patches.edge.length+patches.colour.length,'Combined mode must compose the two reviewed factors only');
 assert.deepEqual(patches.r08,[...patches.edge,...patches.colour],'Combined mode changed the reviewed factor order');
 assert.equal(new Set(patches.r08.map(p=>p.id)).size,patches.r08.length,'Patch IDs must be unique');
 q.previewSHA256=manifest.previewSHA256;q.previewBytes=preview.length;q.manifest=manifest;q.reviewedPatches=patches;
 q.byteProvenance={baseline:{url:BASE_RAW,status:baseline.status(),bytes:baselineBytes.length,sha256:sha(baselineBytes)},public:{url:RAW,status:publicResponse.status(),bytes:publicBytes.length,sha256:sha(publicBytes)},manifestSHA256:sha(fs.readFileSync(manifestPath)),materialSourceSHA256:sha(materialSource),reviewedAppendRemovedR06Exact:true,inheritedScriptHashesExact:true,isolatedTransformFromHashBoundSource:true};
 checkpoint();return q.byteProvenance;
}

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
  async function state(){const g=v.geometry,draw=v.mesh.geometry,c=ls.mother.surfaces.get(v.currentLip.geometry),attributes={},drawAttributes={};
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
    const mats=Array.isArray(v.mesh.material)?v.mesh.material:[v.mesh.material],motion=motionLip.report(),corner=cornerLip.report();
    return{geometry:{attributes,index:await hash(g.index.array),vertices:g.attributes.position.count,canonicalPositions:await hash(m.positions),canonicalFaces:await hash(m.faces)},
      drawGeometry:{attributes:drawAttributes,index:await hash(draw.index.array),vertices:draw.attributes.position.count,groups:draw.groups.map(group=>({...group})),
        materialSlots:mats.map((mat,index)=>({index,type:mat.type,name:mat.name,native:mat===v.skin.material,procedural:mat===headProceduralSkin.material()}))},
      materials:await materials(),modelState:structuredClone(m.state),pose:lipWorkbench.pose(),ownerBeforeJaw:ls.performance.ownerBeforeJaw,dna:lipWorkbench.dna(),nativeLip:lipWorkbench.settings(),
      head:headProceduralSkin.settings(),body:bodyProceduralSkin.settings(),baseLip:lipRealism.settings(),baseComparison:lipRealism.report().comparison,
      innerLip:{comparison:innerLip.report().comparison,diagnostic:innerLip.report().diagnostic},
      motionLip:{version:motion.version,sourceCommit:motion.source.sourceCommit,comparison:motion.comparison,implementation:motion.implementation,installed:motion.solver.installed,enabled:motion.solver.enabled,valid:motion.solver.valid,calibration:motion.solver.calibration},
      cornerLip:{version:corner.version,sourceCommit:corner.source.sourceCommit,comparison:corner.comparison,implementation:corner.implementation,installed:corner.solver.installed,enabled:corner.solver.enabled,valid:corner.solver.valid,binding:corner.solver.binding},
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

// Draw cache may name the prior frame during suppressed native setup. Complete
// post-render states include every draw attribute. These exclusions are exact.
function preFrameState(s){const x=structuredClone(s);delete x.drawGeometry;return x;}
function commonPerson(s){const x=preFrameState(s);delete x.camera;delete x.lighting;return x;}
function variantState(s){const x=structuredClone(s);assert.equal(x.materials[1].procedural,true);delete x.materials[1].cacheKeyValueSHA256;return x;}
function independentState(s){const x=structuredClone(s);assert.equal(x.materials[1].procedural,true);delete x.materials[1].compileHookSHA256;delete x.materials[1].cacheKeyFunctionSHA256;return x;}
function checkSurface(report,mode){
 assert.equal(report.comparison,mode);assert.equal(report.implementation,IMPLEMENTATION);assert(report.ready);
 assert.equal(report.innerComparison,'r04');assert.equal(report.motionComparison,'r05');assert.equal(report.cornerComparison,'r06');
 const s=report.material;assert.equal(s.version,IMPLEMENTATION);assert(s.installed&&s.valid&&s.materialSameObject&&s.hooksStable);assert.equal(s.mode,mode);assert.equal(s.errors.length,0);assert.equal(s.newUniforms,0);assert.equal(s.geometryChanged,false);assert.equal(s.originalAuthoringValuesChanged,false);
 for(const key of['cornerSolver','motionSolver']){const solver=report[key];assert(solver.installed&&solver.enabled&&solver.valid,key+' disabled');assert.equal(solver.errors.length,0);assert(solver.last?.completed&&solver.last?.hooksRestored,key+' native evaluation did not complete');}
}
async function controlState(){return page.evaluate(()=>{
 const r=surfaceLip.report(),corner=cornerLip.report(),motion=motionLip.report(),compact=s=>({version:s.version,installed:s.installed,enabled:s.enabled,valid:s.valid,calls:s.calls,errors:s.errors});
 return{comparison:r.comparison,implementation:r.implementation,poseName:r.poseName,progress:r.progress,pose:r.pose,innerComparison:r.innerComparison,material:{mode:r.material.mode,installed:r.material.installed,valid:r.material.valid,errors:r.material.errors,hooksStable:r.material.hooksStable,materialSameObject:r.material.materialSameObject},
 corner:{comparison:corner.comparison,implementation:corner.implementation,solver:compact(corner.solver)},motion:{comparison:motion.comparison,implementation:motion.implementation,poseName:motion.poseName,progress:motion.progress,solver:compact(motion.solver)},
 ui:{progress:Number(document.querySelector('#ls-progress').value),label:document.querySelector('#ls-progress-label').textContent,disabled:document.querySelector('#ls-progress').disabled,selectedPose:[...document.querySelectorAll('#ls-controls [data-ls-pose][aria-pressed="true"]')].map(x=>x.dataset.lsPose)}};
});}
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
async function singleFactorWindow(pair){
 await page.evaluate(()=>__LS_VERIFY__.compare('r08'));
 await page.evaluate(reference=>__LS_VERIFY__.align(reference),pair.onState);
 const before=await state(),solvers=()=>page.evaluate(()=>({corner:__LIP_CORNER_SOLVER__.report(),motion:__LIP_MOTION_SOLVER__.report()})),beforeSolvers=await solvers();
 assert.deepEqual(before,pair.onState,'Single-factor setup changed the actual neutral reference');
 const variants=[];
 try{
  for(const mode of['edge','colour']){
   // Stable product hook stays installed. Only the declared material mode is
   // selected; no surface controller report, pose, update or setter is invoked.
   await page.evaluate(mode=>__LIP_SURFACE_MATERIAL__.setMode(mode),mode);
   const frame=await capture('neutral-macro-'+mode+'-only'),actual=await state(),raw=await page.evaluate(()=>__LS_VERIFY__.shaders()),shader=await shaderRecord('neutral-macro-'+mode+'-only',true);
   assert.deepEqual(variantState(actual),variantState(before),'Single factor changed frozen native inputs');assert.deepEqual(await solvers(),beforeSolvers,'Single factor changed original solver reports/calls');
   const proof=proveSurfaceShader(pair.offRaw,raw,mode),delta=difference(pair.off,frame);
   assert(delta.changedPixels>0,'Single factor has no actual frame response');
   variants.push({mode,frame:frame.name,sha256:frame.sha256,pngSHA256:frame.pngSHA256,differenceFromR06:delta,proof,shader});
  }
 }finally{await page.evaluate(()=>__LIP_SURFACE_MATERIAL__.setMode('r08'));}
 const restored=await capture('neutral-macro-r08-factors-restored'),after=await state(),raw=await page.evaluate(()=>__LS_VERIFY__.shaders()),shader=await shaderRecord('neutral-macro-r08-factors-restored',true);
 assert.deepEqual(after,before,'Single-factor window failed to restore complete native state');assert.deepEqual(await solvers(),beforeSolvers,'Single-factor window changed original solver state');assert.equal(restored.sha256,pair.on.sha256,'Single-factor window failed to restore native pixels');assert.deepEqual(shaderFingerprint(shader),shaderFingerprint(pair.onShader),'Single-factor window failed to restore actual shader/uniforms');proveSurfaceShader(pair.offRaw,raw,'r08');
 checkSurface(await page.evaluate(()=>surfaceLip.report()),'r08');
 q.factorComparisons={referenceFrame:pair.on.name,referenceSHA256:pair.on.sha256,offFrame:pair.off.name,variants,restoredFrame:restored.name,restoredSHA256:restored.sha256,nativeStateExact:true,solverReportsAndCallsExact:true,pixelsRestoredExact:true,actualShaderRestoredExact:true};checkpoint();return q.factorComparisons;
}
async function openControl(selector){const locator=page.locator(selector);assert.equal(await locator.count(),1,'Expected one real control '+selector);await locator.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});return locator;}
async function actualDownload(selector,file){const promise=page.waitForEvent('download',{timeout:30000});await page.locator(selector).click();const download=await promise;await download.saveAs(path.join(out,file));const bytes=fs.readFileSync(path.join(out,file));return{archive:JSON.parse(bytes),file,suggestedFilename:download.suggestedFilename(),sha256:sha(bytes),bytes:bytes.length};}

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

async function publicChecks(){
 const primary=await load(PUBLIC_URL,'R08 public',true,true);page=primary.page;
 const pairs={},matrix=[['neutral','macro'],['neutral','oblique'],['neutral','front'],['jaw','macro'],['jaw','oblique'],['speak','macro'],['pucker','oblique']];
 q.geometryMutationScope={allowedAttributeLeaves:[],canonicalPositions:false,canonicalFaces:false,indices:false,groups:false,allNativeAttributes:false,allDrawAttributes:false,nativeBeforeLocalInput:false,finalContactPositions:false,materialProperties:false,materialObjects:false,hookFunctionIdentities:false,originalAuthoringSettings:false,camera:false,lighting:false,
 allowedShaderChange:'Only the hash-bound three literal fragment replacements; original vertex and all active uniforms remain exact',allowedStateDifference:'material[1].cacheKeyValueSHA256 only between different modes'};
 let programSources;
 for(const[pose,view]of matrix){
  await test('matched native '+pose+'/'+view+' R08 and immutable-material R06',async()=>{
   const tag=pose+'-'+view,key=pose+'/'+view;
   await page.evaluate(({pose,view})=>{__LS_VERIFY__.compare('r08');__LS_VERIFY__.poseView(pose,view);},{pose,view});
   const on=await capture(tag+'-r08'),onState=await state(),onReport=await page.evaluate(()=>surfaceLip.report()),onRaw=await page.evaluate(()=>__LS_VERIFY__.shaders()),onShader=await shaderRecord(tag+'-r08',true);
   assertNativeState(onState);checkSurface(onReport,'r08');
   const sources=shaderSources(onRaw);if(programSources)assert.deepEqual(sources,programSources,'Pose or view changed the surface program source');else programSources=sources;
   await page.evaluate(()=>__LS_VERIFY__.compare('r06'));
   const off=await capture(tag+'-r06'),offState=await state(),offReport=await page.evaluate(()=>surfaceLip.report()),offRaw=await page.evaluate(()=>__LS_VERIFY__.shaders()),offShader=await shaderRecord(tag+'-r06',true);
   assertNativeState(offState);checkSurface(offReport,'r06');
   assert.deepEqual(variantState(offState),variantState(onState),'Material variant changed complete native/draw geometry, settings, material owners/properties, calibration, camera or lighting');
   const proof=proveSurfaceShader(offRaw,onRaw,'r08'),delta=difference(off,on);assert(delta.changedPixels>0,'Declared material edit did not change the actual native image');
   pairs[key]={on,off,onState,offState,onReport,offReport,onRaw,offRaw,onShader,offShader};q.comparisons||=[];
   q.comparisons.push({pose,view,progress:1,onSHA256:on.sha256,offSHA256:off.sha256,onState,offState,onReport,offReport,difference:delta,shaderProof:proof,completeNativeAndDrawStateExact:true,onlyStateExclusion:'material[1].cacheKeyValueSHA256'});
   q.shaders||={};q.shaders[tag]={r08:onShader,r06:offShader};checkpoint();return{completeNativeAndDrawStateExact:true,...proof,...delta};
  });
  if(pose==='neutral'&&view==='macro')await test('two frozen neutral single-factor modes restore exact native state and pixels',()=>singleFactorWindow(pairs['neutral/macro']));
 }
 await test('independently loaded immutable R06 equals R08-off in neutral and pucker',async()=>{
  const baseline=await load(BASE_URL,'independent R06',false);page=baseline.page;q.independentR06=[];
  for(const[pose,view]of[['neutral','macro'],['pucker','oblique']]){
   const pair=pairs[pose+'/'+view];await page.evaluate(({pose,view})=>__LS_VERIFY__.poseView(pose,view),{pose,view});
   const before=await state();assertNativeState(before);assert.deepEqual(independentState(commonPerson(before)),independentState(commonPerson(pair.offState)),'Independent R06 native person/calibration/material differs before explicit alignment');
   const alignment=await page.evaluate(reference=>__LS_VERIFY__.align(reference),pair.offState),frame=await capture('independent-r06-'+pose+'-'+view),actual=await state();assertNativeState(actual);
   assert.deepEqual(independentState(actual),independentState(pair.offState),'Independent R06 differs after exact camera/light alignment');assert.equal(frame.sha256,pair.off.sha256,'Independent R06 pixels differ from exact same-state R08-off');
   const shader=await shaderRecord('independent-r06-'+pose,true);assert.deepEqual(shaderFingerprint(shader),shaderFingerprint(pair.offShader),'Independent R06 actual shader/templates/active uniforms differ from R08-off');
   assert.equal(actual.materials[1].cacheKeyValueSHA256,pair.offState.materials[1].cacheKeyValueSHA256,'R08-off did not recover original R06 cache-key value');
   q.independentR06.push({pose,view,alignment,state:actual,frameSHA256:frame.sha256,exactOffPixels:true,shader,exactActualOriginalShader:true,exactOriginalCacheKeyValue:true,excludedStateFields:['materials[1].compileHookSHA256','materials[1].cacheKeyFunctionSHA256'],excludedReason:'The two R08 stable wrapper function source strings are additional product code; all original material values, actual off source, cache-key value, live inputs and pixels remain checked.'});checkpoint();
  }
  await closePage(page,'independent R06 complete');await baseline.context.close();page=primary.page;return{independentActualFrames:2,completeStateExactExceptTwoDeclaredWrapperFunctionHashes:true,pixelsExact:true,actualOriginalShaderAndAllActiveUniformsExact:true};
 });
 let savedArchive,savedPair;
 await test('real historical R02 button remains saveable and explicit R08 restores the same half-jaw person',async()=>{
  const selector='#li-controls [data-li-compare="r02"]';await openControl(selector);await openControl('#ls-controls [data-ls-action="save"]');
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.evaluate(({width,height})=>{__LS_VERIFY__.size(width,height);__LS_VERIFY__.compare('r08');__LS_VERIFY__.poseView('jaw','oblique',.5);},{width,height});
  const on=await capture('jaw-oblique-progress-50-r08-archive-reference'),onState=await state(),onReport=await page.evaluate(()=>surfaceLip.report()),onRaw=await page.evaluate(()=>__LS_VERIFY__.shaders()),onShader=await shaderRecord('jaw-oblique-progress-50-r08',true),beforeControl=await controlState();
  assertNativeState(onState);checkSurface(onReport,'r08');assert.equal(beforeControl.progress,.5);assert.equal(beforeControl.ui.progress,50);
  savedPair={on,onState,onReport,onRaw,onShader};
  await page.locator(selector).click();await page.evaluate(()=>new Promise(resolve=>queueMicrotask(resolve)));
  const historical=await page.evaluate(()=>({surface:surfaceLip.report(),corner:cornerLip.report(),motion:motionLip.report(),inner:innerLip.report(),base:lipRealism.report()}));
  assert.equal(historical.inner.comparison,'r02');assert.equal(historical.surface.comparison,'inherited');assert.equal(historical.surface.material.mode,'r06');assert.equal(historical.corner.comparison,'inherited');assert.equal(historical.corner.solver.enabled,false);assert.equal(historical.motion.solver.enabled,false);assert.equal(historical.motion.comparison,'r04','Historical lexical motion state was not reset');
  const historicalNative=await state(),historicalControl=await controlState(),download=await actualDownload('#ls-controls [data-ls-action="save"]','archive-historical-r02.json');
  assert.equal(download.archive.lipSurface?.comparison,'inherited');assert.equal(download.archive.lipMotion?.comparison,'r04');assert.equal(download.archive.innerLip?.comparison,'r02');assert.equal(download.archive.lipCorner?.comparison,'inherited');
  assert.deepEqual(await state(),historicalNative,'Historical save changed native state');assert.deepEqual(await controlState(),historicalControl,'Historical save changed controls/solver state');
  await page.evaluate(()=>__LS_VERIFY__.compare('r08'));const alignment=await page.evaluate(reference=>__LS_VERIFY__.align(reference),onState),restored=await state(),restoredControl=await controlState(),report=await page.evaluate(()=>surfaceLip.report());
  assertNativeState(restored);checkSurface(report,'r08');assert.deepEqual(preFrameState(restored),preFrameState(onState),'Returning to R08 after historical selection changed the held native person');
  for(const k of['comparison','poseName','progress','pose','ui','innerComparison'])assert.deepEqual(restoredControl[k],beforeControl[k],'Historical restore control differs '+k);
  const {archive,...downloadReceipt}=download;
  q.inheritedControlRegression={selector,actualDOMClick:true,microtaskAwaited:true,historical,historicalNative,actualDOMDownload:{...downloadReceipt,lipSurface:archive.lipSurface,lipCorner:archive.lipCorner,lipMotion:archive.lipMotion,innerLip:archive.innerLip},historicalArchiveRetainsCorrectComparisons:true,saveDidNotMutateState:true,restoredControl,restoredReport:report,alignment,preFramePersonExact:true,excludedFromPreFrame:['drawGeometry']};checkpoint();
  return{actualHistoricalDOMClick:true,actualHistoricalDOMDownload:true,inheritedArchiveSaveable:true,materialAndAncestorsDisabled:true,heldHalfJawPersonRestored:true};
 });
 await test('three real DOM saves retain the complete half-progress jaw person and R08 comparison',async()=>{
  const selectors=[['top','#ls-controls [data-ls-action="save"]'],['head','#ps-controls [data-ps-action="save"]'],['body','#ps-controls [data-fb-action="save"]']];
  for(const[,selector]of selectors)await openControl(selector);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.evaluate(({width,height})=>{__LS_VERIFY__.size(width,height);__LS_VERIFY__.compare('r08');__LS_VERIFY__.poseView('jaw','oblique',.5);},{width,height});
  await page.evaluate(reference=>__LS_VERIFY__.align(reference),savedPair.onState);
  const before=await state(),beforeControl=await controlState();assertNativeState(before);assert.equal(beforeControl.poseName,'jaw');assert.equal(beforeControl.progress,.5);assert.equal(beforeControl.ui.progress,50);assert.equal(beforeControl.ui.disabled,false);
  assert.deepEqual(preFrameState(before),preFrameState(savedPair.onState),'Save setup changed the held person or camera/light');
  q.savePreFrameState=before;q.savePreFrameControl=beforeControl;q.savePreFrameScope={excluded:['drawGeometry'],cameraAndLightingIncluded:true,reference:'Actual R08 jaw/oblique progress .5 native frame; fresh post-render comparison includes every draw attribute.'};q.downloads=[];
  for(const[label,selector]of selectors){
   const download=await actualDownload(selector,'archive-'+label+'.json'),archive=download.archive;assert.equal(download.suggestedFilename,label==='top'?'lip-surface-r08-person.json':'lip-corner-r06-person.json');
   assert.equal(archive.lipSurface?.schema,'kaopu/lip-surface@1');assert.equal(archive.lipSurface.version,VERSION);assert.equal(archive.lipSurface.implementation,IMPLEMENTATION);assert.equal(archive.lipSurface.comparison,'r08');assert.equal(Object.prototype.hasOwnProperty.call(archive,'lipEdge'),false,'Rejected R07 geometry must not enter R08 archives');
   assert.equal(archive.lipCorner?.schema,'kaopu/lip-corner@1');assert.equal(archive.lipCorner.version,'LIP-CORNER-R06');assert.equal(archive.lipCorner.comparison,'r06');
   assert.equal(archive.lipMotion?.schema,'kaopu/lip-motion@1');assert.equal(archive.lipMotion.version,'LIP-MOTION-R05');assert.equal(archive.lipMotion.comparison,'r05');assert.equal(archive.lipMotion.controlPose,'jaw');assert.equal(archive.lipMotion.progress,.5);
   assert.equal(archive.innerLip?.schema,'kaopu/lip-inner@1');assert.equal(archive.innerLip.version,'LIP-INNER-R04');assert.equal(archive.innerLip.comparison,'r04');assert.equal(archive.innerLip.diagnostic,0);
   assert(archive.lipRealism?.calibration?.reference&&archive.lipRealism?.calibration?.referenceHorizontal,'Downloaded archive lost actual native calibration');assert.deepEqual(archive.proceduralHeadSurface?.settings,before.head);assert.deepEqual(archive.proceduralBodySurface?.settings,before.body);
   if(savedArchive)assert.deepEqual(archive,savedArchive,'Actual DOM save routes produced different full-person archives');else savedArchive=archive;
   const {archive:_,...receipt}=download;q.downloads.push({label,selector,...receipt,lipSurface:archive.lipSurface,lipCorner:archive.lipCorner,lipMotion:archive.lipMotion,innerLip:archive.innerLip});
   assert.deepEqual(await state(),before,'Actual save changed native state');assert.deepEqual(await controlState(),beforeControl,'Actual save changed controls or solver calls');checkpoint();
  }
  q.archiveReferenceState=savedPair.onState;return{actualDOMDownloads:3,fullPersonExact:true,controlPose:'jaw',progress:.5,allAncestorArchivesAndCalibrationRetained:true};
 });
 await test('invalid surface archives reject before native, control or render mutation',async()=>{
  q.malformed=[];
  for(const kind of['unknown-schema','null','foreign-r07-geometry']){
   const bad=structuredClone(savedArchive);if(kind==='unknown-schema')bad.lipSurface.schema='kaopu/lip-surface@999';else if(kind==='null')bad.lipSurface=null;else bad.lipEdge={schema:'kaopu/lip-edge@1',version:'LIP-EDGE-R07',implementation:'native-lower-return-fairing@2',comparison:'r07'};
   const before=await state(),controlBefore=await controlState(),frameBefore=await page.evaluate(()=>__LS_VERIFY__.renderedFrame());
   const result=await page.evaluate(async bad=>{try{await surfaceLip.restore(bad);return{rejected:false};}catch(e){return{rejected:true,error:String(e)};}},bad);
   assert(result.rejected,'Malformed/foreign archive accepted');assert.deepEqual(await state(),before,'Malformed archive changed complete native state');assert.deepEqual(await controlState(),controlBefore,'Malformed archive changed controls or solver state');assert.equal(await page.evaluate(()=>__LS_VERIFY__.renderedFrame()),frameBefore,'Malformed archive submitted a native render');
   q.malformed.push({kind,...result,stateUnchanged:true,controlAndSolverUnchanged:true,nativeRenderCounterUnchanged:true});
  }
  return{rejectedBeforeStateControlAndRenderMutation:3};
 });
 q.primaryInterventions=await page.evaluate(()=>__LS_VERIFY__.report());assert(q.primaryInterventions.functionsOriginal);await closePage(page,'primary public checks complete');await primary.context.close();
 await test('fresh public context restores a downloaded half-jaw archive with exact state, shader, pixels and UI',async()=>{
  const fresh=await load(PUBLIC_URL,'fresh R08 archive context',true);page=fresh.page;
  await page.evaluate(archive=>__LS_VERIFY__.restore(archive),savedArchive);await page.evaluate(({width,height})=>__LS_VERIFY__.size(width,height),{width,height});
  const before=await state();assertNativeState(before);assert.deepEqual(commonPerson(before),commonPerson(savedPair.onState),'Fresh archive lost native person/calibration/settings/material state');
  q.freshPreFrameScope={nativePersonGeometryMaterialAndCalibrationExact:true,drawGeometry:'Deferred until actual render; complete post-render state must match.'};q.freshAlignment=await page.evaluate(reference=>__LS_VERIFY__.align(reference),savedPair.onState);
  const frame=await capture('fresh-r08-downloaded-archive-readback',false),actual=await state();assertNativeState(actual);assert.deepEqual(actual,savedPair.onState,'Fresh actual native state differs');assert.equal(frame.sha256,savedPair.on.sha256,'Fresh actual native pixels differ');
  const report=await page.evaluate(()=>surfaceLip.report()),control=await controlState();checkSurface(report,'r08');assert.equal(report.poseName,'jaw');assert.equal(report.progress,.5);assert.equal(control.ui.progress,50);assert.equal(control.ui.label,'50%');assert.equal(control.ui.disabled,false);assert.deepEqual(control.ui.selectedPose,['jaw']);assert.deepEqual(control.pose,savedPair.onState.pose);
  const shader=await shaderRecord('fresh-r08',true);assert.deepEqual(shaderFingerprint(shader),shaderFingerprint(savedPair.onShader),'Fresh archive changed actual GPU shader or uniforms');
  q.freshRestore={download:q.downloads[0].file,sourceSHA:report.source.sourceCommit,stateExact:true,frameExact:true,frameSHA256:frame.sha256,control,material:report.material,cornerSolver:report.cornerSolver,motionSolver:report.motionSolver,shader,archiveOwnsCameraAndLighting:false,comparisonCameraAndLightingExplicitlyAligned:true};q.freshInterventions=await page.evaluate(()=>__LS_VERIFY__.report());assert(q.freshInterventions.functionsOriginal);return q.freshRestore;
 });
 assert.equal(q.frames.filter(x=>x.saved).length,20);assert.equal(q.frames.length,21);assert.equal(q.tests.length,14);assert(q.workbenchUI?.actualBrowserScreenshot);
 assert.equal(q.factorComparisons.variants.length,2);for(const key of['nativeStateExact','solverReportsAndCallsExact','pixelsRestoredExact','actualShaderRestoredExact'])assert.equal(q.factorComparisons[key],true);
 assert.equal(q.independentR06.length,2);assert.equal(q.downloads.length,3);assert.equal(q.malformed.length,3);
}

(async()=>{
  fatalTimer=setTimeout(()=>terminated('Bounded public verification deadline exceeded',124),budgetMS);
  try{
    const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(options);context=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1});
    await test('fixed public bytes reviewed source modules and exact R06 ancestor',provenance);await context.close();
    await publicChecks();
    await drainTransportObservations(null,'before strict verification error gate');
    for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key);
    q.completed=true;q.publicHttpsPassed=true;q.browserPassed=true;q.shareAllowed=true;
  }catch(e){q.completed=false;q.shareAllowed=false;q.failure=String(e);q.stack=e.stack;process.exitCode=1;console.error(e);}
  finally{
    q.verificationFinishedAt=new Date().toISOString();json('qa.json',q);checkpoint();
    try{await cleanup();}catch(e){q.cleanupError=String(e);q.completed=false;q.publicHttpsPassed=false;q.browserPassed=false;q.shareAllowed=false;process.exitCode=1;}
    // Teardown can emit a late failure too. It is recorded and still fails the
    // same four zero-error gates; ERR_ABORTED is never exempted or filtered.
    try{for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key+' after cleanup');}
    catch(e){q.finalErrorGateFailure=String(e);q.failure||=String(e);q.completed=false;q.publicHttpsPassed=false;q.browserPassed=false;q.shareAllowed=false;process.exitCode=1;}
    clearTimeout(fatalTimer);q.finishedAt=new Date().toISOString();json('qa.json',q);
    json('PUBLICATION_PROOF.json',{schema:'kaopu/lip-surface-publication@1',version:VERSION,sourceSHA:SOURCE,buildSHA:BUILD,previewSHA256:q.previewSHA256,publicURL:PUBLIC_URL,
      verifierSHA256:q.verifierSHA256,checkedAt:q.finishedAt,publicHttpsPassed:q.completed&&q.publicHttpsPassed,browserPassed:q.completed&&q.browserPassed,shareAllowed:q.completed&&q.shareAllowed,
      actualSavedImages:q.frames.filter(x=>x.saved).length,actualReadbacks:q.frames.length,naturalUIScreenshot:q.workbenchUI||null,visualAcceptance:false,productionReady:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
      failure:q.failure||q.cleanupError||null,evidence:'qa.json'});
    console.log(JSON.stringify({completed:q.completed,tests:q.tests.length,savedFrames:q.frames.filter(x=>x.saved).length,readbacks:q.frames.length,shareAllowed:q.shareAllowed,failure:q.failure||q.cleanupError||null,output:out}));
    if(q.cleanupError)process.exit(1);
  }
})();
