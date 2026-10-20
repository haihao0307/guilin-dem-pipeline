'use strict';
/* Public, bounded R06 candidate verification. Twenty saved native GPU images,
 * one fresh archive readback and one natural UI screenshot. Reuses the R05
 * native proof path; no numerical response is promoted to visual acceptance. */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const VERSION='LIP-CORNER-R06',BASE_SOURCE='a8bba75322c12df151ecbcebc416087b5248aa5f',BASE_BUILD='11ed0391f798b5323f4eb4aefec4307fc0b9aee0';
const BASE_HASH='231cc60f696e1bfbe7831e5afb5bfb845f7358391dacd25bc3efa00c7a21710b';
const INNER_SOURCE='9d855c6051e76a20f052c95f0dda95103d946ef7',INHERITED_SOURCE='01cfde47476b7be6764e9c6a79d925462511539b';
const ROOT='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/';
const BASE_RAW=ROOT+BASE_BUILD+'/kaopu-unified-human-workbench/lip-motion-r05/preview.html';
const BASE_URL='https://htmlpreview.github.io/?'+BASE_RAW;
const PUBLIC_URL=process.env.PUBLIC_URL||process.env.CANDIDATE_URL;
const SOURCE=process.env.SOURCE_SHA,BUILD=process.env.BUILD_SHA;
assert(!process.env.MODE||process.env.MODE==='public','This suite verifies the immutable public R06 candidate');
assert(/^[a-f0-9]{40}$/.test(SOURCE||''),'SOURCE_SHA required');assert(/^[a-f0-9]{40}$/.test(BUILD||''),'BUILD_SHA required');
const RAW=ROOT+BUILD+'/kaopu-unified-human-workbench/lip-corner-r06/preview.html';
assert.equal(PUBLIC_URL,'https://htmlpreview.github.io/?'+RAW,'Public URL must name the exact immutable R06 build');
const scope=path.resolve(__dirname,'..'),previewPath=process.env.CANDIDATE_PATH||path.join(scope,'preview.html');
const manifestPath=process.env.BUILD_MANIFEST_PATH||path.join(scope,'BUILD_MANIFEST.json');
const out=path.resolve(process.env.QA_OUT||path.join(scope,'evidence','public'));
const width=640,height=512,budgetMS=Number(process.env.QA_BUDGET_MS||900000);
assert(Number.isFinite(budgetMS)&&budgetMS>=120000&&budgetMS<=960000,'Invalid bounded deadline');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.mkdirSync(out,{recursive:true});
const q={schema:'kaopu/lip-corner-public-qa@1',version:VERSION,mode:'public',sourceSHA:SOURCE,buildSHA:BUILD,publicURL:PUBLIC_URL,
  verifierSHA256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),budgetMS,
  framebuffer:{width,height,pixelRatio:1},browserViewport:{width:1280,height:900},
  tests:[],frames:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],transportObservations:[],transportObservationDrains:[],
  completed:false,publicHttpsPassed:false,browserPassed:false,shareAllowed:false,
  visualAcceptance:false,productionReady:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
  limitations:[
    'One frozen native person; six full pose/view pairs plus three intermediate pucker pairs. This is not general anatomy certification.',
    'Only evaluated position, normal, l19State and l19Detail may respond to R06 during pucker. All captured non-pucker pairs require the complete native state and actual pixels to remain exact.',
    'Canonical geometry, topology, person inputs, inherited R05 ownership calibration, material, actual shader, camera and lighting remain protected.',
    'Independently loaded immutable R05 must match R06-off at speaking and pucker after explicit camera/light alignment.',
    'Fresh archive checks restore the actual half-progress pucker person, both lipCorner and lipMotion layers, and controls. Camera and lighting are explicitly aligned, not claimed to be owned by the archive.',
    'Pixel response and solver completion do not establish aesthetic quality or measured physiological correctness. The actual frames need visual review.',
    'Twenty saved native images, one fresh native readback and one original 1280x900 browser UI screenshot; no physical-phone performance claim.'
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
async function controlState(){return page.evaluate(()=>{
  const r=cornerLip.report(),motion=motionLip.report(),compact=s=>({version:s.version,installed:s.installed,enabled:s.enabled,valid:s.valid,calls:s.calls,errors:s.errors});
  return{comparison:r.comparison,implementation:r.implementation,poseName:r.poseName,progress:r.progress,pose:r.pose,innerComparison:r.innerComparison,
    solver:compact(r.solver),motion:{comparison:motion.comparison,implementation:motion.implementation,poseName:motion.poseName,progress:motion.progress,solver:compact(motion.solver)},
    ui:{progress:Number(document.querySelector('#lc-progress').value),label:document.querySelector('#lc-progress-label').textContent,disabled:document.querySelector('#lc-progress').disabled,selectedPose:[...document.querySelectorAll('#lc-controls [data-lc-pose][aria-pressed="true"]')].map(x=>x.dataset.lcPose)}};
});}
function checkSolver(report,mode){
  assert.equal(report.comparison,mode);assert.equal(report.implementation,report.solver.version);assert(report.ready);assert.equal(report.innerComparison,'r04');assert.equal(report.motionComparison,'r05');
  const s=report.solver;assert(s.installed&&s.valid);assert.equal(s.enabled,mode==='r06');assert.equal(s.errors.length,0);
  assert.equal(s.version,'native-corner-x-followthrough@2');
  const solveLimits={maximumIterations:512,maximumNormalizedResidualMM:1e-4,maximumRelativeResidual:1e-6};
  for(const[key,value]of Object.entries(solveLimits))assert.equal(s.binding.solver[key],value,'Reviewed graph solver limit changed: '+key);
  if(mode==='r06'){
    const last=s.last;assert(last?.completed&&last?.hooksRestored,'R06 native phase or temporary-hook restoration incomplete');
    assert(Number.isFinite(report.pose.pucker)&&report.pose.pucker>=0,'Actual pucker input unavailable');
    assert.equal(last.puckerInput,report.pose.pucker,'R06 stage report does not belong to the actual current pucker input');
    assert(Number.isInteger(last.directChangedVertices)&&last.directChangedVertices>=0);assert(Number.isFinite(last.maxDirectCorrectionMM)&&last.maxDirectCorrectionMM>=0);
    if(report.pose.pucker===0){
      assert.equal(last.puckerZeroBypass,true);assert.equal(last.pairMapCalls,0);assert.equal(last.directChangedVertices,0);assert.equal(last.maxDirectCorrectionMM,0);
      assert.equal(last.coreVerticesCompared,0);assert.equal(last.contactVerticesCompared,0);assert.equal(last.centerVerticesCompared,0);assert.equal(last.changedOriginallyActiveVertices,0);assert.equal(last.linearSolve,null);
    }else{
      assert.equal(last.puckerZeroBypass,false);assert.equal(last.pairMapCalls,1);assert.equal(last.coreDirectDeltaZero,true);assert.equal(last.contactDirectDeltaZero,true);assert.equal(last.centerDirectDeltaZero,true);
      assert.equal(last.beforeLocalBaseMatchesEntry,true,'R06 used a different native before-local buffer');
      for(const[field,bound]of[['coreVerticesCompared','protectedCoreAndOneRingVertices'],['contactVerticesCompared','uniqueContactVertices'],['centerVerticesCompared','centerVertices']]){
        assert(Number.isInteger(last[field])&&last[field]>0,'No actual protected-domain vertices were checked: '+field);assert.equal(last[field],s.binding[bound],'Protected-domain comparison omitted bound vertices: '+field);
      }
      assert(last.directChangedVertices>0&&last.maxDirectCorrectionMM>0,'The selected pucker correction made no evaluated geometric intervention');
      assert(Number.isInteger(last.changedOriginallyActiveVertices)&&last.changedOriginallyActiveVertices>0&&last.changedOriginallyActiveVertices<=last.directChangedVertices,'No original active exterior vertices actually responded');
      const solve=last.linearSolve;assert(solve?.converged&&solve.finite&&solve.positiveWeights&&solve.noOvershoot,'Exterior graph solver did not meet its numerical conditions');
      for(const[key,value]of Object.entries(solveLimits))assert.equal(solve[key],value,'Actual graph solve changed the reviewed limit: '+key);
      assert(Number.isInteger(solve.iterations)&&solve.iterations>=0&&solve.iterations<=solveLimits.maximumIterations,'Invalid graph solve iteration count');
      assert(Number.isFinite(solve.maxResidualMM)&&solve.maxResidualMM>=0&&solve.maxResidualMM<=solveLimits.maximumNormalizedResidualMM,'Actual normalized graph residual exceeds the reviewed limit');
      assert(Number.isFinite(solve.relativeResidual)&&solve.relativeResidual>=0&&solve.relativeResidual<=solveLimits.maximumRelativeResidual,'Actual relative graph residual exceeds the reviewed limit');
    }
  }
  // The inherited R05 stage must still complete in both R06 comparison modes.
  // Direct-delta measurements above describe the intervention stage only;
  // complete non-pucker state/pixel equality is independently required below.
  const motion=report.motionSolver;assert(motion.installed&&motion.enabled&&motion.valid);assert.equal(motion.errors.length,0);
  assert(motion.last?.completed&&motion.last?.hooksRestored,'Inherited R05 native stage or temporary-hook restoration incomplete');assert.equal(motion.last.localBoundaryCalls,1);assert.equal(motion.last.closureBoundaryCalls,1);
  assert(Number.isFinite(motion.last.maxLocalCorrectionMM)&&Number.isFinite(motion.last.maxClosureCorrectionMM));
}
async function publicChecks(){
  const primary=await load(PUBLIC_URL,'R06 public',true,true);page=primary.page;
  const pairs={},matrix=[['neutral','macro',1],['jaw','macro',1],['jaw','oblique',1],['speak','macro',1],['pucker','oblique',1],['pucker','macro',1],...[.25,.5,.75].map(progress=>['pucker','oblique',progress])];
  q.geometryMutationScope={allowedAttributeLeaves:['geometry.attributes.position','geometry.attributes.normal','geometry.attributes.l19State','geometry.attributes.l19Detail','drawGeometry.attributes.position','drawGeometry.attributes.normal','drawGeometry.attributes.l19State','drawGeometry.attributes.l19Detail'],canonicalPositions:false,canonicalFaces:false,indices:false,groups:false,semanticInputArrays:false,material:false,shader:false,camera:false,lighting:false};
  let referenceShader;
  for(const[pose,view,amount]of matrix)await test('matched native '+pose+'/'+view+'/'+amount+' R06 and R05',async()=>{
    const key=pose+'/'+view+'/'+amount,tag=pose+'-'+view+(amount===1?'':'-progress-'+Math.round(amount*100));
    await page.evaluate(({pose,view,amount})=>{__LC_VERIFY__.compare('r06');__LC_VERIFY__.poseView(pose,view,amount);},{pose,view,amount});
    const on=await capture(tag+'-r06'),onState=await state(),onReport=await page.evaluate(()=>cornerLip.report());assertNativeState(onState);checkSolver(onReport,'r06');
    const onShader=await shaderRecord(tag+'-r06',pose==='speak'&&amount===1),onFingerprint=shaderFingerprint(onShader);
    if(referenceShader)assert.deepEqual(onFingerprint,referenceShader,'R06 pose changed the original material/shader/native uniform state');else referenceShader=onFingerprint;
    await page.evaluate(()=>__LC_VERIFY__.compare('r05'));
    const off=await capture(tag+'-r05'),offState=await state(),offReport=await page.evaluate(()=>cornerLip.report());assertNativeState(offState);checkSolver(offReport,'r05');
    assert.deepEqual(protectedState(offState),protectedState(onState),'R06 switch changed protected native person/topology/material/camera/light state');
    const offShader=await shaderRecord(tag+'-r05',pose==='speak'&&amount===1);assert.deepEqual(shaderFingerprint(offShader),onFingerprint,'R06 switch changed actual original compiled GLSL or native uniforms');
    const delta=difference(off,on);
    if(pose!=='pucker'){assert.deepEqual(offState,onState,'R06 changed complete evaluated native state outside pucker');assert.equal(off.sha256,on.sha256,'R06 changed actual pixels outside pucker');}
    pairs[key]={on,off,onState,offState,onReport,offReport};q.comparisons||=[];
    q.comparisons.push({pose,view,progress:amount,onSHA256:on.sha256,offSHA256:off.sha256,onState,offState,onReport,offReport,difference:delta,actualShaderFingerprintsExact:true});
    q.shaders||={};q.shaders[tag]={r06:onShader,r05:offShader};checkpoint();
    return{protectedNativeInputsTopologyMaterialCameraLightingExact:true,actualShaderAndUniformsExact:true,nonPuckerCompleteStateAndPixelsExact:pose!=='pucker'?true:null,...delta};
  });
  await test('independently loaded immutable R05 equals R06-off in speak and pucker',async()=>{
    const baseline=await load(BASE_URL,'independent R05',false);page=baseline.page;q.independentR05=[];
    for(const[pose,view]of[['speak','macro'],['pucker','oblique']]){
      const pair=pairs[pose+'/'+view+'/1'];await page.evaluate(({pose,view})=>__LC_VERIFY__.poseView(pose,view),{pose,view});
      const before=await state();assertNativeState(before);assert.deepEqual(commonPerson(before),commonPerson(pair.offState),'Independent R05 person/geometry/DNA/calibration/material differs before view/light alignment');
      const alignment=await page.evaluate(reference=>__LC_VERIFY__.align(reference),pair.offState);
      const frame=await capture('independent-r05-'+pose+'-'+view),actual=await state();assertNativeState(actual);
      assert.deepEqual(actual,pair.offState,'Independent actual R05 state differs after exact camera/light alignment');assert.equal(frame.sha256,pair.off.sha256,'Independent R05 pixels differ from same-state R06-off');
      const shader=await shaderRecord('independent-r05-'+pose,pose==='speak');assert.deepEqual(shaderFingerprint(shader),referenceShader,'Inherited R05 actual shader/uniforms differ');
      q.independentR05.push({pose,view,alignment,state:actual,frameSHA256:frame.sha256,exactOffPixels:true,shader,exactActualOriginalShader:true,
        preFrameScope:'Draw cache deferred until actual render; camera/light alignment explicit. Complete post-frame state and pixels must match.'});checkpoint();
    }
    await closePage(page,'independent R05 complete');await baseline.context.close();page=primary.page;
    return{independentActualFrames:2,personStateExact:true,pixelsExact:true,originalActualShaderExact:true};
  });
  let savedArchive;const savedPair=pairs['pucker/oblique/0.5'];
  await test('real inherited R02 button disables R06 and explicit R06 restore recovers the held person',async()=>{
    const selector='#li-controls [data-li-compare="r02"]',button=page.locator(selector);
    assert.equal(await button.count(),1,'Expected one actual inherited R02 comparison button');
    await button.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(({width,height})=>{__LC_VERIFY__.size(width,height);__LC_VERIFY__.compare('r06');__LC_VERIFY__.poseView('pucker','oblique',.5);},{width,height});
    await page.evaluate(reference=>__LC_VERIFY__.align(reference),savedPair.onState);
    const before=await state(),beforeControl=await controlState();assertNativeState(before);
    assert.deepEqual(preFrameState(before),preFrameState(savedPair.onState),'Historical-control regression setup changed the held R06 person');
    // A real click exercises the inherited event handlers and the R06 sync
    // microtask. It is intentionally not substituted by a direct API call.
    await button.click();
    await page.evaluate(()=>new Promise(resolve=>queueMicrotask(resolve)));
    const historical=await page.evaluate(()=>({corner:cornerLip.report(),motion:motionLip.report(),inner:innerLip.report(),base:lipRealism.report()}));
    assert.equal(historical.inner.comparison,'r02','Actual inherited button did not select R02');
    assert.equal(historical.corner.comparison,'inherited','R06 controls still claim the repair is active in inherited mode');
    assert.equal(historical.corner.solver.enabled,false,'R06 correction remained enabled outside the matched R05 person');
    const historicalNative=await state();
    assert.deepEqual(historicalNative.geometry,savedPair.offState.geometry,'Historical switch disabled the R06 label but retained its evaluated displacement');
    assert.deepEqual(historicalNative.nativeEvaluation,savedPair.offState.nativeEvaluation,'Historical switch changed the native before-local input');
    await page.evaluate(()=>__LC_VERIFY__.compare('r06'));
    // The historical controls may update their original camera/light state.
    // Reuse the exact held view; no native geometry or authored input is fixed
    // by this alignment, and draw caches wait for a later actual native frame.
    const alignment=await page.evaluate(reference=>__LC_VERIFY__.align(reference),before);
    const restored=await state(),restoredControl=await controlState(),report=await page.evaluate(()=>cornerLip.report());
    assertNativeState(restored);checkSolver(report,'r06');
    assert.deepEqual(preFrameState(restored),preFrameState(before),'Restoring R06 after the real R02 button changed the held native person');
    assert.equal(restoredControl.comparison,'r06');assert.equal(restoredControl.motion.comparison,'r05');assert.equal(restoredControl.innerComparison,'r04');
    assert.equal(restoredControl.poseName,beforeControl.poseName);assert.equal(restoredControl.progress,beforeControl.progress);assert.deepEqual(restoredControl.pose,beforeControl.pose);assert.deepEqual(restoredControl.ui,beforeControl.ui);
    q.inheritedControlRegression={selector,actualDOMClick:true,microtaskAwaited:true,historical,historicalNativeGeometry:historicalNative.geometry,historicalNativeEvaluation:historicalNative.nativeEvaluation,historicalGeometryEqualsR06Off:true,restoredControl,restoredReport:report,alignment,preFramePersonExact:true,
      excludedFromPreFrame:['drawGeometry'],additionalSavedImages:0,additionalReadbacks:0};
    return{actualDOMClick:true,cornerDisabledInInheritedMode:true,historicalGeometryEqualsR06Off:true,restoredR05AndR04:true,preFramePersonExact:true,additionalSavedImages:0,additionalReadbacks:0};
  });
  await test('three real DOM saves retain the full half-progress pucker person',async()=>{
    const selectors=[['top','#lc-controls [data-lc-action="save"]'],['head','#ps-controls [data-ps-action="save"]'],['body','#ps-controls [data-fb-action="save"]']];
    for(const[,selector]of selectors){const locator=page.locator(selector);assert.equal(await locator.count(),1,'Expected one real save button '+selector);await locator.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(({width,height})=>{__LC_VERIFY__.size(width,height);__LC_VERIFY__.compare('r06');__LC_VERIFY__.poseView('pucker','oblique',.5);},{width,height});
    await page.evaluate(reference=>__LC_VERIFY__.align(reference),savedPair.onState);
    const before=await state(),beforeControl=await controlState();assertNativeState(before);
    assert.equal(beforeControl.poseName,'pucker');assert.equal(beforeControl.progress,.5);assert.equal(beforeControl.ui.progress,50);assert.equal(beforeControl.ui.disabled,false);
    q.savePreFrameState=before;q.savePreFrameControl=beforeControl;
    q.savePreFrameScope={excluded:['drawGeometry'],cameraAndLightingIncluded:true,reference:'Previously rendered R06 pucker/oblique progress 0.5. Draw cache is fully compared after the fresh actual frame.'};checkpoint();
    assert.deepEqual(preFrameState(before),preFrameState(savedPair.onState),'Save setup changed the held native person, material, camera or lighting');q.downloads=[];
    for(const[label,selector]of selectors){
      const promise=page.waitForEvent('download',{timeout:30000});await page.locator(selector).click();const download=await promise;
      const file='archive-'+label+'.json';await download.saveAs(path.join(out,file));const bytes=fs.readFileSync(path.join(out,file)),archive=JSON.parse(bytes);
      assert.equal(archive.lipCorner?.schema,'kaopu/lip-corner@1');assert.equal(archive.lipCorner.version,VERSION);assert.equal(archive.lipCorner.implementation,savedPair.onReport.implementation);assert.equal(archive.lipCorner.comparison,'r06');
      assert.equal(archive.lipMotion?.schema,'kaopu/lip-motion@1');assert.equal(archive.lipMotion.version,'LIP-MOTION-R05');assert.equal(archive.lipMotion.implementation,savedPair.onReport.motionSolver.version);assert.equal(archive.lipMotion.comparison,'r05');assert.equal(archive.lipMotion.controlPose,'pucker');assert.equal(archive.lipMotion.progress,.5);
      assert.equal(archive.innerLip?.schema,'kaopu/lip-inner@1');assert.equal(archive.innerLip.version,'LIP-INNER-R04');assert.equal(archive.innerLip.comparison,'r04');assert.equal(archive.innerLip.diagnostic,0);
      assert(archive.lipRealism?.calibration?.reference&&archive.lipRealism?.calibration?.referenceHorizontal,'Actual save lost original calibration');
      assert.deepEqual(archive.proceduralHeadSurface?.settings,before.head,'Actual save lost head surface settings');assert.deepEqual(archive.proceduralBodySurface?.settings,before.body,'Actual save lost body surface settings');
      if(savedArchive)assert.deepEqual(archive,savedArchive,'Actual save routes differ in the complete native person archive');else savedArchive=archive;
      q.downloads.push({label,selector,file,suggestedFilename:download.suggestedFilename(),sha256:sha(bytes),bytes:bytes.length,lipCorner:archive.lipCorner,lipMotion:archive.lipMotion,innerLip:archive.innerLip});
      assert.deepEqual(await state(),before,'Actual save altered native person state');assert.deepEqual(await controlState(),beforeControl,'Actual save altered R06 controls or solver state');checkpoint();
    }
    q.archiveReferenceState=savedPair.onState;
    return{actualDOMDownloads:3,lipCornerSchema:'kaopu/lip-corner@1',lipMotionRetained:true,lipMotionSchema:'kaopu/lip-motion@1',innerLipRetained:true,calibrationRetained:true,controlPose:'pucker',progress:.5};
  });
  await test('unknown and null R06 archives reject before native or control mutation',async()=>{
    q.malformed=[];
    for(const kind of['unknown-schema','null']){
      const bad=structuredClone(savedArchive);if(kind==='unknown-schema')bad.lipCorner.schema='kaopu/lip-corner@999';else bad.lipCorner=null;
      const before=await state(),controlBefore=await controlState(),frameBefore=await page.evaluate(()=>__LC_VERIFY__.renderedFrame());
      // Deliberately call the real restore without suppression: a malformed
      // archive must be rejected before submitting any native frame.
      const result=await page.evaluate(async bad=>{try{await cornerLip.restore(bad);return{rejected:false};}catch(e){return{rejected:true,error:String(e)};}},bad);
      assert(result.rejected,'Malformed R06 archive was accepted');assert.deepEqual(await state(),before,'Malformed R06 archive changed the native person');assert.deepEqual(await controlState(),controlBefore,'Malformed archive changed controls or solver state');
      assert.equal(await page.evaluate(()=>__LC_VERIFY__.renderedFrame()),frameBefore,'Malformed archive submitted a native render');
      q.malformed.push({kind,...result,stateUnchanged:true,controlAndSolverUnchanged:true,nativeRenderCounterUnchanged:true});
    }
    return{rejectedBeforeStateControlAndRenderMutation:2};
  });
  q.primaryInterventions=await page.evaluate(()=>__LC_VERIFY__.report());assert(q.primaryInterventions.functionsOriginal);
  await closePage(page,'primary public checks complete');await primary.context.close();
  await test('fresh context restores an actual downloaded half-progress pucker archive',async()=>{
    const fresh=await load(PUBLIC_URL,'fresh R06 archive context',true);page=fresh.page;
    await page.evaluate(archive=>__LC_VERIFY__.restore(archive),savedArchive);
    await page.evaluate(({width,height})=>__LC_VERIFY__.size(width,height),{width,height});
    const before=await state();assertNativeState(before);assert.deepEqual(commonPerson(before),commonPerson(q.archiveReferenceState),'Fresh restore lost native person/calibration/settings/material/evaluated geometry');
    q.freshPreFrameScope={nativePersonGeometryMaterialAndCalibrationExact:true,drawGeometry:'Deferred until actual render; complete post-frame equality is required.'};
    q.freshAlignment=await page.evaluate(reference=>__LC_VERIFY__.align(reference),q.archiveReferenceState);
    const frame=await capture('fresh-r06-downloaded-archive-readback',false),actual=await state();assertNativeState(actual);
    assert.deepEqual(actual,q.archiveReferenceState,'Fresh restored actual native person/camera/light/material state differs');assert.equal(frame.sha256,savedPair.on.sha256,'Fresh archive actual pixels differ from the saved R06 person');
    const report=await page.evaluate(()=>cornerLip.report()),control=await controlState();checkSolver(report,'r06');
    assert.equal(report.poseName,'pucker');assert.equal(report.progress,.5);assert.equal(control.ui.progress,50);assert.equal(control.ui.label,'50%');assert.equal(control.ui.disabled,false);assert.deepEqual(control.ui.selectedPose,['pucker']);assert.deepEqual(control.pose,savedPair.onState.pose);
    const shader=await shaderRecord('fresh-r06');assert.deepEqual(shaderFingerprint(shader),referenceShader,'Fresh restore changed original actual material/shader/uniforms');
    q.freshRestore={download:q.downloads[0].file,sourceSHA:report.source.sourceCommit,stateExact:true,frameExact:true,frameSHA256:frame.sha256,control,solver:report.solver,motionSolver:report.motionSolver,shader,
      archiveOwnsCameraAndLighting:false,comparisonCameraAndLightingExplicitlyAligned:true};
    q.freshInterventions=await page.evaluate(()=>__LC_VERIFY__.report());assert(q.freshInterventions.functionsOriginal);return q.freshRestore;
  });
  assert.equal(q.frames.filter(x=>x.saved).length,20);assert.equal(q.frames.length,21);assert(q.workbenchUI?.actualBrowserScreenshot);
}

(async()=>{
  fatalTimer=setTimeout(()=>terminated('Bounded public verification deadline exceeded',124),budgetMS);
  try{
    const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(options);context=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1});
    await test('fixed public bytes reviewed source modules and exact R05 ancestor',provenance);await context.close();
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
    json('PUBLICATION_PROOF.json',{schema:'kaopu/lip-corner-publication@1',version:VERSION,sourceSHA:SOURCE,buildSHA:BUILD,previewSHA256:q.previewSHA256,publicURL:PUBLIC_URL,
      verifierSHA256:q.verifierSHA256,checkedAt:q.finishedAt,publicHttpsPassed:q.completed&&q.publicHttpsPassed,browserPassed:q.completed&&q.browserPassed,shareAllowed:q.completed&&q.shareAllowed,
      actualSavedImages:q.frames.filter(x=>x.saved).length,actualReadbacks:q.frames.length,naturalUIScreenshot:q.workbenchUI||null,visualAcceptance:false,productionReady:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
      failure:q.failure||q.cleanupError||null,evidence:'qa.json'});
    console.log(JSON.stringify({completed:q.completed,tests:q.tests.length,savedFrames:q.frames.filter(x=>x.saved).length,readbacks:q.frames.length,shareAllowed:q.shareAllowed,failure:q.failure||q.cleanupError||null,output:out}));
    if(q.cleanupError)process.exit(1);
  }
})();
