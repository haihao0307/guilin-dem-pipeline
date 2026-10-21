'use strict';
/* R07 read-only structure and reversible surface attribution on immutable R06.
 * Shared native state/GPU/transport functions are copied from the reviewed R06
 * verifier. No product geometry, pose, material parameters or archive is changed. */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const VERSION='LIP-CORNER-R06',BASE_SOURCE='a8bba75322c12df151ecbcebc416087b5248aa5f',BASE_BUILD='11ed0391f798b5323f4eb4aefec4307fc0b9aee0';
const BASE_HASH='231cc60f696e1bfbe7831e5afb5bfb845f7358391dacd25bc3efa00c7a21710b';
const INNER_SOURCE='9d855c6051e76a20f052c95f0dda95103d946ef7',INHERITED_SOURCE='01cfde47476b7be6764e9c6a79d925462511539b';
const ROOT='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/';
const BASE_RAW=ROOT+BASE_BUILD+'/kaopu-unified-human-workbench/lip-motion-r05/preview.html';
const BASE_URL='https://htmlpreview.github.io/?'+BASE_RAW;
const SOURCE='1e1e216c2005f4c318da190e1b3b160cc4bd4a6d',BUILD='1237284ea60f9c198b2b63543f098a7551a9af2f';
const PUBLIC_URL='https://htmlpreview.github.io/?'+ROOT+BUILD+'/kaopu-unified-human-workbench/lip-corner-r06/preview.html';
assert(!process.env.MODE||process.env.MODE==='public','This suite verifies the immutable public R06 candidate');
assert(/^[a-f0-9]{40}$/.test(SOURCE||''),'SOURCE_SHA required');assert(/^[a-f0-9]{40}$/.test(BUILD||''),'BUILD_SHA required');
const RAW=ROOT+BUILD+'/kaopu-unified-human-workbench/lip-corner-r06/preview.html';
assert.equal(PUBLIC_URL,'https://htmlpreview.github.io/?'+RAW,'Public URL must name the exact immutable R06 build');
const taskScope=path.resolve(__dirname,'..');
const scope=path.resolve(__dirname,'../../lip-corner-r06'),previewPath=process.env.CANDIDATE_PATH||path.join(scope,'preview.html');
const manifestPath=process.env.BUILD_MANIFEST_PATH||path.join(scope,'BUILD_MANIFEST.json');
const out=path.resolve(process.env.QA_OUT||path.join(taskScope,'evidence','diagnosis-02'));
const width=640,height=512,budgetMS=Number(process.env.QA_BUDGET_MS||900000);
assert(Number.isFinite(budgetMS)&&budgetMS>=120000&&budgetMS<=960000,'Invalid bounded deadline');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.mkdirSync(out,{recursive:true});
const q={schema:'kaopu/lip-edge-diagnosis-qa@1',version:'LIP-EDGE-R07-DIAGNOSIS-02',baselineVersion:VERSION,diagnosticCommit:process.env.GITHUB_SHA||null,mode:'public',sourceSHA:SOURCE,buildSHA:BUILD,publicURL:PUBLIC_URL,
  verifierSHA256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),budgetMS,
  framebuffer:{width,height,pixelRatio:1},browserViewport:{width:1280,height:900},
  tests:[],frames:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],transportObservations:[],transportObservationDrains:[],
  completed:false,publicHttpsPassed:false,browserPassed:false,shareAllowed:false,
  visualAcceptance:false,productionReady:false,productionRepair:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
  limitations:[
    'Fixed accepted R06 native person. This diagnosis is not an R07 product or an anatomical thickness measurement.',
    'Read actual original indexed geometry and semantic arrays. Native and drawn surfaces are labelled separately; no prefix correspondence is presumed.',
    'Temporary no-bump/albedo shader windows freeze an already evaluated surface. No pose/update or R06 compatibility report is called while temporary hooks are attached.',
    'The complete native state, evaluated geometry, inputs, material parameters, uniform objects/values, camera/light, solver call counts and original compiled shader/pixels must restore exactly.',
    'Each material window saves baseline, no-bump, albedo, restored-original frames. Neutral/pucker are original baseline observations only.',
    'No volume, physiological validity, continuous animation, cross-person or device performance acceptance follows from this diagnostic.'
  ]};
let browser,page,context,fatalTimer,seq=0;const active=[],transportPages=new Map(),pendingTransport=new Set();let transportSequence=0;
function json(name,value){const p=path.join(out,name),t=p+'.tmp';fs.writeFileSync(t,JSON.stringify(value,null,2)+'\n');fs.renameSync(t,p);}
function checkpoint(){q.updatedAt=new Date().toISOString();q.activeStages=active.map(x=>({...x}));json('qa.partial.json',q);}
function progress(name,event,detail={}){const r={sequence:++seq,name,event,at:new Date().toISOString(),...detail};q.lastProgress=r;fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(r)+'\n');checkpoint();console.log(event.toUpperCase()+' '+name);}
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
  const modules=['src/CornerContinuity.js','src/CornerLip.js'].map(name=>({name,text:fs.readFileSync(path.join(scope,name),'utf8')}));
  assert.deepEqual(Object.keys(manifest.modules).sort(),modules.map(m=>m.name).sort(),'Unexpected reviewed source module set');
  for(const m of modules)assert.equal(sha(m.text),manifest.modules[m.name],m.name+' reviewed module hash');
  const responses=await Promise.all([context.request.get(BASE_RAW,{timeout:60000}),context.request.get(RAW,{timeout:60000})]);
  const [baseline,publicResponse]=responses;assert.equal(baseline.status(),200);assert.equal(publicResponse.status(),200);
  const [baselineBytes,publicBytes]=await Promise.all(responses.map(r=>r.body()));
  assert.equal(sha(baselineBytes),BASE_HASH);assert.equal(sha(publicBytes),manifest.previewSHA256);assert(preview.equals(publicBytes),'Local and fixed public candidate bytes differ');
  const metadata={version:VERSION,sourceCommit:SOURCE,baselineSource:BASE_SOURCE,baselineBuild:BASE_BUILD,baselineSHA256:BASE_HASH,modules:manifest.modules};
  const suffix='\n<!-- LIP-CORNER-R06 APPEND-ONLY NATIVE CONTINUITY -->\n<script>window.__LIP_CORNER_SOURCE__='+JSON.stringify(metadata)+';\n'+modules.map(m=>m.text).join('\n')+'\n</script>\n';
  const text=publicBytes.toString('utf8');assert.equal(text.split(suffix).length,2,'Expected exactly one reviewed R06 append block');
  assert.equal(text.replace(suffix,''),baselineBytes.toString('utf8'),'Removing the exact reviewed R06 append does not recover immutable R05');
  const scripts=s=>Array.from(s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g),m=>sha(m[1]));
  const inherited=scripts(baselineBytes.toString('utf8'));assert.deepEqual(manifest.originalScriptHashes,inherited);assert.deepEqual(scripts(text).slice(0,inherited.length),inherited);
  q.previewSHA256=manifest.previewSHA256;q.previewBytes=preview.length;q.manifest=manifest;
  q.byteProvenance={baseline:{url:BASE_RAW,status:baseline.status(),bytes:baselineBytes.length,sha256:sha(baselineBytes)},public:{url:RAW,status:publicResponse.status(),bytes:publicBytes.length,sha256:sha(publicBytes)},manifestSHA256:sha(fs.readFileSync(manifestPath)),reviewedAppendRemovedR05Exact:true,inheritedScriptHashesExact:true};checkpoint();
  return q.byteProvenance;
}
async function load(url,label,isR06,captureNaturalUI=false){
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
  await p.waitForFunction(()=>window.__HEAD_PROC__?.ready||window.__HEAD_PROC__?.errors?.length,null,{timeout:300000});
  await p.waitForFunction(()=>window.innerLip?.ready||window.__LIP_INNER__?.errors?.length,null,{timeout:180000});
  await p.waitForFunction(()=>window.motionLip?.ready||window.__LIP_MOTION__?.errors?.length,null,{timeout:300000});
  if(isR06)await p.waitForFunction(()=>window.cornerLip?.ready||window.__LIP_CORNER__?.errors?.length,null,{timeout:300000});
  const startup=await p.evaluate(isR06=>{
    const v=__IDENTITY_QA__.viewer();window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();v.orbit.autoRotate=false;v.orbit.enableDamping=false;
    return{title:document.title,finalFrame:v.startupFinalFrame,headReady:__HEAD_PROC__.ready,
      baseSource:document.documentElement.dataset.lipSource,baseVersion:lipRealism.version,
      innerSource:document.documentElement.dataset.lipInnerSource,innerVersion:innerLip.version,innerReport:innerLip.report(),
      motionSource:document.documentElement.dataset.lipMotionSource,motionVersion:motionLip.version,motionReport:motionLip.report(),
      source:isR06?document.documentElement.dataset.lipCornerSource:null,version:isR06?cornerLip.version:null,
      report:isR06?cornerLip.report():motionLip.report(),errors:{head:__HEAD_PROC__.errors,base:__LIP_REALISM__.errors,inner:__LIP_INNER__.errors,motion:window.__LIP_MOTION__?.errors||[],motionSolver:window.__LIP_MOTION_SOLVER__?.report?.().errors||[],corner:window.__LIP_CORNER__?.errors||[],cornerSolver:window.__LIP_CORNER_SOLVER__?.report?.().errors||[],native:window.__LIP_P3__?.errors||[]}};
  },isR06);
  const startupTransport=observeTransport(p,'startup ready before GPU drain');await startupTransport.settled;startup.transportObservationID=startupTransport.record.id;
  assert(startup.headReady&&startup.finalFrame);assert.equal(startup.baseSource,INHERITED_SOURCE);assert.equal(startup.baseVersion,'LIP-REALISM-R02');
  assert.equal(startup.innerSource,INNER_SOURCE);assert.equal(startup.innerVersion,'LIP-INNER-R04');assert.equal(startup.innerReport.source.sourceCommit,INNER_SOURCE);assert.equal(startup.innerReport.baseComparison,'r02');assert.equal(startup.innerReport.comparison,'r04');assert.equal(startup.innerReport.diagnostic,0);
  assert.equal(startup.motionSource,BASE_SOURCE);assert.equal(startup.motionVersion,'LIP-MOTION-R05');assert.equal(startup.motionReport.source.sourceCommit,BASE_SOURCE);assert.equal(startup.motionReport.schema,'kaopu/lip-motion@1');assert.equal(startup.motionReport.comparison,'r05');assert(startup.motionReport.ready);assert(startup.motionReport.solver.installed&&startup.motionReport.solver.enabled&&startup.motionReport.solver.valid);
  if(isR06){assert.equal(startup.source,SOURCE);assert.equal(startup.version,VERSION);assert.equal(startup.report.source.sourceCommit,SOURCE);assert.equal(startup.report.schema,'kaopu/lip-corner@1');assert.equal(startup.report.comparison,'r06');assert(startup.report.ready);assert.deepEqual(startup.report.source.modules,q.manifest.modules);}
  for(const[k,v]of Object.entries(startup.errors))assert.equal(v?.length||0,0,label+' '+k);
  await stage(label+' drain original startup GPU queue',()=>p.evaluate(()=>{const gl=__IDENTITY_QA__.viewer().renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));if(gl.getError()||gl.isContextLost())throw Error('Original startup GPU queue failed');}));
  if(captureNaturalUI){
    const file='workbench-r06-ui.png';await stage('natural public R06 workbench UI screenshot',()=>p.screenshot({path:path.join(out,file),fullPage:false,timeout:60000}));
    const bytes=fs.readFileSync(path.join(out,file)),png=PNG.sync.read(bytes);assert.equal(png.width,1280);assert.equal(png.height,900);
    q.workbenchUI={file,title:await p.title(),url:p.url(),width:png.width,height:png.height,screenshotSHA256:sha(bytes),actualBrowserScreenshot:true,capturedBeforeFixedFramebufferHarness:true};checkpoint();
  }
  await p.evaluate(installFrameHarness);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await p.evaluate(({width,height})=>__LC_VERIFY__.size(width,height),{width,height});
  q.startups||=[];q.startups.push({label,url,elapsedMS:Date.now()-s,...startup});checkpoint();return{page:p,context:c};
}

/* Existing native API/data only. No shader, triangle, attribute, calibration or
 * prototype is rewritten by this harness. Camera/light alignment is explicit.
 */
function installFrameHarness(){
  const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),ls=m.lipStructure;
  const initialFunctions={render:v.render,rendererRender:v.renderer.render,update:v.update,motherUpdate:ls.mother.update};
  const baselinePose=lipWorkbench.pose(),interventions=[];
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
    if(window.cornerLip){cornerLip.pose(name,progress);cornerLip.view(view);}else{motionLip.pose(name,progress);motionLip.view(view);}
    const p=lipWorkbench.pose();for(const[k,x]of Object.entries(desired(name,progress)))if(p[k]!==x)throw Error('Actual native pose differs: '+k);return p;});}
  function compare(mode){return withoutRender('variant '+mode,()=>{if(!window.cornerLip)throw Error('No R06 controls');return cornerLip.compare(mode);});}
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
    for(const name of['position','normal','csRest','fRest','csType','csRegion','l19Oral','l19State','l19Detail','skinIndex','skinWeight']){
      attributes[name]=await hash(g.attributes[name]?.array);drawAttributes[name]=draw.attributes[name]?.array===g.attributes[name]?.array?attributes[name]:await hash(draw.attributes[name]?.array);
    }
    // Read the original 49 upper/lower contact pairs from the final evaluated
    // native position buffer. This is after the normal and microgeometry
    // stages; a direct-delta report at pairs.map cannot replace this gate.
    const top=c.topology,nativePosition=top.geometry.attributes.position;
    if(top.geometry!==v.currentLip.geometry||top.pairs.length!==49||nativePosition.itemSize!==3||nativePosition.count!==top.count||nativePosition.isInterleavedBufferAttribute)throw Error('Original native contact-pair domain unavailable');
    const pairIDs=new Uint32Array(top.pairs.length*2),pairPositions=new nativePosition.array.constructor(top.pairs.length*6);
    for(let k=0;k<top.pairs.length;k++)for(let side=0;side<2;side++){
      const id=top.pairs[k][side===0?'upper':'lower'];if(!Number.isInteger(id)||id<0||id>=nativePosition.count)throw Error('Original native contact vertex invalid');
      pairIDs[k*2+side]=id;pairPositions.set(nativePosition.array.subarray(id*3,id*3+3),(k*2+side)*3);
    }
    if(!pairPositions.every(Number.isFinite))throw Error('Final native contact positions are not finite');
    const mats=Array.isArray(v.mesh.material)?v.mesh.material:[v.mesh.material],motion=motionLip.report();
    return{geometry:{attributes,index:await hash(g.index.array),vertices:g.attributes.position.count,canonicalPositions:await hash(m.positions),canonicalFaces:await hash(m.faces)},
      drawGeometry:{attributes:drawAttributes,index:await hash(draw.index.array),vertices:draw.attributes.position.count,groups:draw.groups.map(group=>({...group})),
        materialSlots:mats.map((mat,index)=>({index,type:mat.type,name:mat.name,native:mat===v.skin.material,procedural:mat===headProceduralSkin.material()}))},
      materials:await materials(),modelState:structuredClone(m.state),pose:lipWorkbench.pose(),ownerBeforeJaw:ls.performance.ownerBeforeJaw,dna:lipWorkbench.dna(),nativeLip:lipWorkbench.settings(),
      head:headProceduralSkin.settings(),body:bodyProceduralSkin.settings(),baseLip:lipRealism.settings(),baseComparison:lipRealism.report().comparison,
      innerLip:{comparison:innerLip.report().comparison,diagnostic:innerLip.report().diagnostic},
      motionLip:{version:motion.version,comparison:motion.comparison,implementation:motion.implementation,installed:motion.solver.installed,enabled:motion.solver.enabled,valid:motion.solver.valid,calibration:motion.solver.calibration},
      calibration:{reference:await hash(c.reference),horizontal:await hash(c.referenceHorizontal),lastKey:c.lastKey,count:c.topology.count},
      nativeEvaluation:{beforeLocalBase:await hash(c.base)},
      nativeContactSamples:{source:'Original topology.pairs upper/lower IDs in final native topology.geometry.attributes.position',pairs:top.pairs.length,samples:pairIDs.length,pairVertexIDsSHA256:await hash(pairIDs),finalPositionSHA256:await hash(pairPositions)},
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
      expanded:attached.map(shader=>({type:gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.VERTEX_SHADER?'vertex':'fragment',compiled:gl.getShaderParameter(shader,gl.COMPILE_STATUS),log:gl.getShaderInfoLog(shader),source:gl.getShaderSource(shader)})),
      nativeUniforms:nativeUniforms(),source:'Actual WebGLProgram getAttachedShaders/getShaderSource; templates remain separately labelled onBeforeCompile templates with #include.'};}
  function report(){return{interventions:structuredClone(interventions),functionsOriginal:v.render===initialFunctions.render&&v.renderer.render===initialFunctions.rendererRender&&v.update===initialFunctions.update&&ls.mother.update===initialFunctions.motherUpdate};}
  window.__LC_VERIFY__={size,poseView,compare,state,align,nativeUniforms,shaders,report,
    restore:a=>withoutRenderAsync('fresh full-person archive restore',()=>cornerLip.restore(a)),
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
async function state(){return page.evaluate(()=>__LC_VERIFY__.state());}
async function closePage(p,label){if(!p)return;await drainTransportObservations(p,label+' before GPU drain');if(p.isClosed())return;const r=await bounded(label+' GPU drain',()=>p.evaluate(()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench?.stop?.();const renderer=window.__IDENTITY_QA__?.viewer?.()?.renderer;if(!renderer)return{available:false};const gl=renderer.getContext(),before=gl.getError(),lost=gl.isContextLost(),frame=renderer.info.render.frame;gl.finish();if(gl.drawingBufferWidth&&gl.drawingBufferHeight)gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));return{available:true,before,after:gl.getError(),lostBefore:lost,lostAfter:gl.isContextLost(),frameBefore:frame,frameAfter:renderer.info.render.frame};}),90000);
  if(r.available){assert.equal(r.before,0);assert.equal(r.after,0);assert.equal(r.lostBefore,false);assert.equal(r.lostAfter,false);assert.equal(r.frameBefore,r.frameAfter);}
  await drainTransportObservations(p,label+' before page close');const binding=transportPages.get(p);if(binding)binding.closing=true;
  await bounded(label+' close page',()=>p.close({runBeforeUnload:false}),15000);assert(p.isClosed());await drainTransportObservations(p,label+' after page close');q.closedPages||=[];q.closedPages.push({label,gpu:r,closed:true});checkpoint();}
async function cleanup(){const start=Date.now(),errors=[];for(const c of browser?.contexts()||[])for(const p of c.pages())try{await closePage(p,'final cleanup');}catch(e){errors.push(String(e));}
  for(const binding of transportPages.values())binding.closing=true;
  try{if(browser)await bounded('close final browser',()=>browser.close(),15000);}catch(e){errors.push(String(e));}
  try{await drainTransportObservations(null,'final browser closed');}catch(e){errors.push(String(e));}
  q.cleanup={completed:errors.length===0,browserDisconnected:!browser||!browser.isConnected(),errors,elapsedMS:Date.now()-start};checkpoint();assert(q.cleanup.completed&&q.cleanup.browserDisconnected,'Bounded browser cleanup failed');}
// During suppressed pose/restore setup, mesh.geometry may still name the prior
// frame's cached draw object. The post-render complete state gate includes it.
function preFrameState(s){const x=structuredClone(s);delete x.drawGeometry;return x;}
function commonPerson(s){const x=preFrameState(s);delete x.camera;delete x.lighting;return x;}
// Only these four evaluated attribute arrays may respond to the native solver.
// Keep canonical arrays, topology, semantic inputs, all material authoring,
// original function identity, camera and every light field in the exact gate.
function protectedState(s){const x=structuredClone(s);for(const name of['geometry','drawGeometry'])for(const key of['position','normal','l19State','l19Detail'])delete x[name].attributes[key];return x;}
function assertNativeState(s){
  assert(s.functionsOriginal,'Original native viewer functions changed');
  assert(s.materials.length&&s.materials.every(x=>x.sameOriginalObject&&x.sameOriginalCompileHook&&x.sameOriginalCacheKey),'Original material object or shader hook changed');
  assert.equal(s.innerLip.comparison,'r04');assert.equal(s.innerLip.diagnostic,0);assert.equal(s.baseComparison,'r02');assert.equal(s.baseLip.diagnostic,0);
  assert.equal(s.motionLip.version,'LIP-MOTION-R05');assert.equal(s.motionLip.comparison,'r05');assert(s.motionLip.installed&&s.motionLip.enabled&&s.motionLip.valid,'Inherited R05 correction was disabled or invalidated');
  assert(/^[a-f0-9]{64}$/.test(s.nativeEvaluation.beforeLocalBase),'Actual native before-local input buffer unavailable');
  assert.equal(s.nativeContactSamples.pairs,49);assert.equal(s.nativeContactSamples.samples,98);assert(/^[a-f0-9]{64}$/.test(s.nativeContactSamples.pairVertexIDsSHA256)&&/^[a-f0-9]{64}$/.test(s.nativeContactSamples.finalPositionSHA256),'Actual final native contact-pair samples unavailable');
}
async function shaderRecord(label,save=false){
  const data=await page.evaluate(()=>__LC_VERIFY__.shaders());assert(data.linked);assert(data.expanded.length>=2&&data.expanded.every(x=>x.compiled&&x.source),'Actual expanded compiled GLSL absent');
  assert(data.nativeUniforms.length===15&&data.nativeUniforms.every(x=>x.nativePresent&&x.skinPresent&&x.sameObject&&x.sameNativeObjectSinceHarness&&x.sameSkinObjectSinceHarness),'Original native uniform object ownership lost');
  assert(Array.isArray(data.templates.nativeUniformIdentity)&&data.templates.nativeUniformIdentity.length===15&&data.templates.nativeUniformIdentity.every(x=>x.present&&x.sameObject));
  assert(typeof data.templates.originalR02Fragment==='string'&&typeof data.templates.finalFragment==='string');
  const record={programId:data.programId,linked:data.linked,programLog:data.programLog,source:data.source,nativeUniforms:data.nativeUniforms,templates:{},expanded:[]};
  for(const[name,source]of Object.entries(data.templates)){
    if(typeof source==='string'){const file=label+'-'+name+'-template.glsl';if(save)fs.writeFileSync(path.join(out,file),source);record.templates[name]={...(save?{file}:{}),sha256:sha(source),bytes:Buffer.byteLength(source),kind:'Actual onBeforeCompile template; includes may remain'};}
    else record.templates[name]=source;
  }
  for(const shader of data.expanded){const file=label+'-'+shader.type+'-expanded.glsl';if(save)fs.writeFileSync(path.join(out,file),shader.source);record.expanded.push({...(save?{file}:{}),type:shader.type,compiled:shader.compiled,log:shader.log,sha256:sha(shader.source),bytes:Buffer.byteLength(shader.source)});}
  record.expanded.sort((a,b)=>a.type.localeCompare(b.type));
  return record;
}
function shaderFingerprint(record){return{templates:Object.fromEntries(Object.entries(record.templates).map(([name,value])=>[name,value?.sha256||value])),expanded:record.expanded.map(x=>({type:x.type,sha256:x.sha256,compiled:x.compiled})),nativeUniforms:record.nativeUniforms};}

async function reportSolvers(){
  return page.evaluate(()=>{
    const r=cornerLip.report(),m=motionLip.report();
    const compact=s=>({version:s.version,installed:s.installed,enabled:s.enabled,valid:s.valid,calls:s.calls,errors:s.errors});
    return {corner:{comparison:r.comparison,implementation:r.implementation,solver:compact(r.solver)},motion:{comparison:m.comparison,implementation:m.implementation,solver:compact(m.solver)}};
  });
}
function checkOriginalSolvers(r){
  assert.equal(r.corner.comparison,'r06');assert.equal(r.corner.implementation,'native-corner-pucker-vector@3');
  assert.equal(r.motion.comparison,'r05');assert.equal(r.motion.implementation,'native-return-motion-ownership@1');
  for(const s of[r.corner.solver,r.motion.solver]){assert(s.installed&&s.enabled&&s.valid);assert.equal(s.errors.length,0);}
}
async function surfaceReport(){
  await page.waitForFunction(()=>__R07_EDGE_SURFACE__.report().pendingHashes===0,null,{timeout:30000});
  const r=await page.evaluate(()=>__R07_EDGE_SURFACE__.report());
  assert.equal(r.pendingHashes,0);assert.equal(r.errors.length,0);
  for(const name of ['geometryAndCanonicalBytesExact','semanticBytesExact','beforeLocalBaseExact','originalMaterialsRetained','materialParametersExact','nativeUniformObjectsAndValuesExact','nativeSettingsExact','cameraLightingExact','nativeFunctionsAndSolverHookExact'])assert.equal(r.invariants[name],true,'Frozen surface invariant: '+name);
  if(r.wrapperAttached){
    assert.equal(r.hashEvidenceComplete,true);assert(r.compileRecords.length>0,'No actual diagnostic compile recorded');
    for(const c of r.compileRecords){assert(c.existingUniformObjectsPreserved&&c.requiredNativeUniformsSameOriginal&&c.vertexShaderUntouchedByDiagnostic);assert.equal(c.requiredNativeUniformCount,15);assert.deepEqual(c.addedUniforms,['r07EdgeSurfaceMode']);}
  }
  return r;
}
async function actualDiagnosticUniform(){
  return page.evaluate(()=>{
    const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext(),mat=headProceduralSkin.material(),props=v.renderer.properties.get(mat);
    const p=props.currentProgram||(props.programs&&[...props.programs.values()].at(-1));
    if(!p?.program)throw Error('Actual diagnostic WebGL program missing');
    const location=gl.getUniformLocation(p.program,'r07EdgeSurfaceMode');
    if(location===null)throw Error('Actual diagnostic uniform absent from compiled program');
    return{programId:p.id,uniform:'r07EdgeSurfaceMode',value:gl.getUniform(p.program,location),source:'Actual rendered WebGLProgram getUniform'};
  });
}
async function probe(tag){
  const before=await state(),solvers=await reportSolvers();assertNativeState(before);checkOriginalSolvers(solvers);
  const result=await stage('read-only actual geometry sections '+tag,()=>page.evaluate(async()=>await __R07_EDGE_GEOMETRY__.sample()));
  assert.equal(result.version,'native-draw-edge-sections@1');
  assert(result.readOnly.unchanged&&result.readOnly.updates===0&&result.readOnly.renders===0&&result.readOnly.installedHooks===0);
  assert.equal(result.native.vertices,before.calibration.count);assert.equal(result.draw.vertices,before.drawGeometry.vertices);
  for(const domain of[result.native,result.draw]){
    assert(domain.nonempty&&domain.indexed&&domain.trianglesScanned>0&&domain.vertexSemantics.length>0);
    assert.deepEqual(domain.sections.map(x=>x.u),[-.45,0,.45]);
    assert(domain.sections.every(x=>x.totalSegments>0&&x.returnedSegments>0&&!x.truncated),'An actual section is empty or truncated');
    for(const name of ['position','normal','csType','l19Oral','l19State','l19Detail'])assert.equal(domain.attributes[name]?.count,domain.vertices,'Actual geometry attribute domain missing: '+name);
  }
  const after=await state(),afterSolvers=await reportSolvers();
  assert.deepEqual(after,before,'Read-only geometry sampling changed native state');
  assert.deepEqual(afterSolvers,solvers,'Read-only geometry sampling changed solver ownership/call counts');
  const file=tag+'-geometry.json';json(file,result);
  const record={tag,file,sha256:sha(fs.readFileSync(path.join(out,file))),bytes:fs.statSync(path.join(out,file)).size,nativeStateExact:true,solverCallsExact:true};
  q.geometryProbes||=[];q.geometryProbes.push(record);checkpoint();return record;
}
function acceptedStateFromJSON(stored,actual){
  // R06's JSON evidence predates a tagged non-finite-number encoding.
  // JSON.stringify(+Infinity) writes null. Decode ONLY these two documented
  // material attenuation distances, and require actual positive Infinity.
  // Do not stringify the entire actual state or normalize other null/NaN data.
  const decoded=structuredClone(stored),fields=[];
  assert.equal(decoded.materials.length,2);assert.equal(actual.materials.length,2);
  for(let i=0;i<2;i++){
    assert.equal(decoded.materials[i].values.attenuationDistance,null,'Unexpected serialized R06 attenuation-distance encoding');
    assert.equal(actual.materials[i].values.attenuationDistance,Infinity,'Actual native attenuation distance is not positive Infinity');
    decoded.materials[i].values.attenuationDistance=Infinity;
    fields.push('materials['+i+'].values.attenuationDistance');
  }
  q.acceptedReferenceEncoding={source:'Original R06 JSON evidence retained unchanged',decodedFields:fields,storedValue:null,requiredActualValue:'positive Infinity',allOtherFieldsComparedWithoutConversion:true};
  return decoded;
}
async function diagnosticChecks(){
  const primary=await load(PUBLIC_URL,'immutable R06 for edge diagnosis',true,false);page=primary.page;
  const accepted=JSON.parse(fs.readFileSync(path.join(scope,'evidence/candidate-03/qa.json')));
  q.helpers={};
  for(const name of ['EdgeGeometryProbe.js','EdgeSurfaceAttribution.js','EdgeEnvelopeStageProbe.js']){
    const content=fs.readFileSync(path.join(__dirname,name),'utf8');
    q.helpers[name]={sha256:sha(content),bytes:Buffer.byteLength(content)};
    await page.addScriptTag({content});
  }
  await page.evaluate(async()=>await __R07_EDGE_GEOMETRY__.install(__IDENTITY_QA__.viewer(),__IDENTITY_QA__.model()));
  await page.evaluate(()=>__R07_ENVELOPE_STAGE__.install(__IDENTITY_QA__.viewer(),__IDENTITY_QA__.model()));
  for(const[pose,view]of[['neutral','macro'],['jaw','macro'],['jaw','oblique'],['speak','macro'],['pucker','oblique']]){
    const tag=pose+'-'+view,materialWindow=['jaw','speak'].includes(pose);
    await test((materialWindow?'frozen reversible surface and geometry diagnosis ':'original read-only geometry observation ')+tag,async()=>{
      const phase=await page.evaluate(({pose,view})=>{
        __R07_ENVELOPE_STAGE__.arm();
        try{__LC_VERIFY__.compare('r06');__LC_VERIFY__.poseView(pose,view,1);}
        finally{__R07_ENVELOPE_STAGE__.disarm();}
        return __R07_ENVELOPE_STAGE__.report();
      },{pose,view});
      assert.equal(phase.armed,false);assert.equal(phase.errors.length,0);
      assert(phase.lastCompleted&&phase.lastArm.completedIterations>0,'No completed actual native dental loop observed');
      assert(phase.lastArm.descriptorRestored&&phase.lastArm.solverApplyExact,'Native dental-stage observer was not fully detached');
      assert(phase.lastArm.allIterationsCompleted&&phase.lastArm.solverCallsMatchObservedIterations&&phase.lastArm.solversStillEnabledValid);
      assert(phase.lastCompleted.complete&&phase.lastCompleted.counts.orderExact);
      assert.equal(phase.lastCompleted.counts.changedOutsideDentalLoopEligibility,0,'Observed stage delta escaped the native loop eligibility');
      const phaseFile=tag+'-envelope-stage.json';json(phaseFile,phase);
      q.envelopeObservations||=[];q.envelopeObservations.push({tag,file:phaseFile,sha256:sha(fs.readFileSync(path.join(out,phaseFile))),bytes:fs.statSync(path.join(out,phaseFile)).size});checkpoint();
      const reference=accepted.comparisons.find(x=>x.pose===pose&&x.view===view&&x.progress===1);
      assert(reference,'Accepted R06 original-frame reference missing');
      const alignment=await page.evaluate(reference=>__LC_VERIFY__.align(reference),reference.onState);
      const original=await capture(tag+'-original-r06'),originalState=await state(),originalSolvers=await reportSolvers();
      assertNativeState(originalState);checkOriginalSolvers(originalSolvers);
      assert.deepEqual(originalState,acceptedStateFromJSON(reference.onState,originalState),'Read-only diagnostics changed accepted R06 native state');
      assert.equal(original.sha256,reference.onSHA256,'Read-only diagnostics changed accepted R06 actual pixels');
      const originalShader=await shaderRecord(tag+'-original-r06',materialWindow),geometry=await probe(tag);
      q.baselineObservations||=[];q.baselineObservations.push({tag,state:originalState,solvers:originalSolvers,frameSHA256:original.sha256,shader:originalShader,geometry,acceptedR06StateAndPixelsExact:true,explicitReferenceViewAlignment:alignment});checkpoint();
      if(!materialWindow)return{nativeBaseline:true,readOnlyGeometryProbe:true,productionChange:false};
      const install=await page.evaluate(async()=>await __R07_EDGE_SURFACE__.install(__IDENTITY_QA__.viewer(),__IDENTITY_QA__.model()));
      assert.equal(install.mode,'original');assert.equal(install.wrapperAttached,false);
      const variants=[];let restore;
      try{
        for(const mode of ['no-bump','albedo']){
          // Only shader uniform selection and real render are allowed until
          // restore. In particular, no cornerLip.report/update/pose call.
          await page.evaluate(async mode=>await __R07_EDGE_SURFACE__.setMode(mode),mode);
          const frame=await capture(tag+'-'+mode),report=await surfaceReport(),shader=await shaderRecord(tag+'-'+mode,true);
          assert.equal(report.mode,mode);assert.equal(report.wrapperAttached,true);
          const actualUniform=await actualDiagnosticUniform();assert.equal(actualUniform.value,mode==='no-bump'?1:2,'Actual GPU diagnostic mode differs');
          assert.deepEqual(shader.nativeUniforms,originalShader.nativeUniforms,'Diagnostic changed original native uniform values/owners');
          assert.notEqual(frame.sha256,original.sha256,'Declared surface diagnostic produced no actual framebuffer response');
          if(variants.length)assert.notEqual(frame.sha256,variants[0].frameSHA256,'Albedo and no-bump actual frames unexpectedly identical');
          const reportFile=tag+'-'+mode+'-surface-report.json';json(reportFile,report);
          variants.push({mode,frameSHA256:frame.sha256,difference:difference(original,frame),shader,actualDiagnosticUniform:actualUniform,reportFile,reportSHA256:sha(fs.readFileSync(path.join(out,reportFile)))});
        }
      }finally{
        restore=await page.evaluate(async()=>await __R07_EDGE_SURFACE__.restore());
      }
      const final=await capture(tag+'-restored-r06'),finalState=await state(),finalSolvers=await reportSolvers(),finalShader=await shaderRecord(tag+'-restored-r06',true);
      assertNativeState(finalState);checkOriginalSolvers(finalSolvers);
      assert.deepEqual(finalState,originalState,'Complete native state did not restore');
      assert.deepEqual(finalSolvers,originalSolvers,'Native R05/R06 solver status or calls changed in frozen diagnostic window');
      assert.equal(final.sha256,original.sha256,'Actual original R06 pixels did not restore');
      assert.deepEqual(shaderFingerprint(finalShader),shaderFingerprint(originalShader),'Actual compiled original shader/uniforms did not restore');
      const restoredReport=await surfaceReport();
      const restoration=restoredReport.restoration||restore.restoration;
      for(const name of ['compileFunctionExact','cacheFunctionExact','compileOwnDescriptorExact','cacheOwnDescriptorExact','cacheValueExact','diagnosticsExact','allProtectedInputsExact','r05AndR06StillEnabledValid','r05CallsUnchanged','r06CallsUnchanged'])assert.equal(restoration[name],true,'Surface restoration invariant: '+name);
      q.surfaceComparisons||=[];q.surfaceComparisons.push({tag,originalSHA256:original.sha256,variants,restoredSHA256:final.sha256,restore:restoredReport,restoredShader:finalShader});
      q.restorations||=[];q.restorations.push({tag,nativeStateExact:true,nativePixelsExact:true,actualShaderExact:true,solverCallsExact:true,originalSolvers,finalSolvers});checkpoint();
      return{readOnlyGeometryProbe:true,frozenGeometryAndInputsExact:true,actualDiagnosticFrames:2,nativeStateExact:true,nativePixelsExact:true,actualShaderExact:true,solverCallsExact:true};
    });
  }
  q.geometryProbeRestore=await page.evaluate(async()=>await __R07_EDGE_GEOMETRY__.restore());
  q.envelopeProbeRestore=await page.evaluate(()=>__R07_ENVELOPE_STAGE__.restore());
  assert.equal(q.geometryProbeRestore.restored,true);assert.equal(q.envelopeProbeRestore.restored,true);
  assert.equal(q.frames.length,14);assert.equal(q.frames.filter(f=>f.saved).length,14);assert.equal(q.restorations.length,3);
}
(async()=>{
  fatalTimer=setTimeout(()=>terminated('Bounded R07 diagnosis deadline exceeded',124),budgetMS);
  try{
    const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(options);context=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1});
    await test('fixed accepted public R06 bytes reviewed modules and exact R05 ancestor',provenance);await context.close();
    await diagnosticChecks();
    await drainTransportObservations(null,'before strict diagnostic error gate');
    for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key);
    q.completed=true;q.publicHttpsPassed=true;q.browserPassed=true;q.shareAllowed=false;
  }catch(e){q.completed=false;q.shareAllowed=false;q.failure=String(e);q.stack=e.stack;process.exitCode=1;console.error(e);}
  finally{
    q.verificationFinishedAt=new Date().toISOString();json('qa.json',q);checkpoint();
    try{await cleanup();}catch(e){q.cleanupError=String(e);q.completed=false;q.publicHttpsPassed=false;q.browserPassed=false;q.shareAllowed=false;process.exitCode=1;}
    try{for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key+' after cleanup');}
    catch(e){q.finalErrorGateFailure=String(e);q.failure||=String(e);q.completed=false;q.publicHttpsPassed=false;q.browserPassed=false;q.shareAllowed=false;process.exitCode=1;}
    clearTimeout(fatalTimer);q.finishedAt=new Date().toISOString();json('qa.json',q);
    json('DIAGNOSIS_RECEIPT.json',{schema:'kaopu/lip-edge-diagnosis-receipt@1',version:q.version,diagnosticCommit:q.diagnosticCommit,baselineSource:SOURCE,baselineBuild:BUILD,previewSHA256:q.previewSHA256,publicURL:PUBLIC_URL,verifierSHA256:q.verifierSHA256,completed:q.completed,actualSavedImages:q.frames.filter(x=>x.saved).length,actualReadbacks:q.frames.length,productionRepair:false,visualAcceptance:false,productionReady:false,shareAllowed:false,failure:q.failure||q.cleanupError||null,evidence:'qa.json'});
    console.log(JSON.stringify({completed:q.completed,tests:q.tests.length,savedFrames:q.frames.filter(x=>x.saved).length,readbacks:q.frames.length,productionRepair:false,failure:q.failure||q.cleanupError||null,output:out}));
    if(q.cleanupError)process.exit(1);
  }
})();
