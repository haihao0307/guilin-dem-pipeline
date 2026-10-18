'use strict';
// R03 bounded fine-relief verification. Real production HTML and real Chromium only.
// Reuses the successful R01/R01.1 native calibration, geometry, CPU readPixels,
// and bounded cleanup methods. No synthetic canvas, replacement renderer,
// patched production state, or reused previous-round PASS is permitted.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const VERSION='LIP-REALISM-R03',ORIGINAL_VERSION='LIP-REALISM-R01.1';
const REPOSITORY='haihao0307/guilin-dem-pipeline';
const ORIGINAL_COMMIT='36e5e11a13ba299915dc07e1800c72973f0f7e44';
const ORIGINAL_HASH='29d2e2bcf30cacd10af822de9acfd26dcf1908a212291df0398f1e9cc3b09e5a';
const SOURCE_COMMIT=process.env.SOURCE_SHA,BUILD_COMMIT=process.env.LIP_BUILD_SHA;
const EXPECTED_HASH=process.env.LIP_EXPECTED_PREVIEW_SHA256;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=(process.env.GITHUB_RUN_ID||('local-'+Date.now()))+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
const out=process.env.LIP_QA_OUT||path.join(__dirname,'qa','detail-r03',run);
fs.mkdirSync(out,{recursive:true});
const originalRaw='https://raw.githubusercontent.com/'+REPOSITORY+'/'+ORIGINAL_COMMIT+'/kaopu-unified-human-workbench/lip-realism-r01-1/preview.html';
const candidateRaw='https://raw.githubusercontent.com/'+REPOSITORY+'/'+BUILD_COMMIT+'/kaopu-unified-human-workbench/lip-realism-r03/preview.html';
const target=(raw,version,hash)=>({raw,url:'https://htmlpreview.github.io/?'+raw,version,hash});
const originalTarget=target(originalRaw,ORIGINAL_VERSION,ORIGINAL_HASH),candidateTarget=target(candidateRaw,VERSION,EXPECTED_HASH);
const q={
 schema:'kaopu/lip-detail-qa@1',version:VERSION,startedAt:new Date().toISOString(),
 sourceCommit:SOURCE_COMMIT||null,buildCommit:BUILD_COMMIT||null,verificationCommit:process.env.LIP_VERIFICATION_SHA||null,
 runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,
 original:{commit:ORIGINAL_COMMIT,previewSHA256:ORIGINAL_HASH,role:'BASELINE_ONLY'},
 candidate:{publicURL:candidateTarget.url,rawURL:candidateRaw,previewSHA256:EXPECTED_HASH||null},
 tests:[],errors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],contexts:[],downloads:[],screenshots:[],
 completed:false,shareAllowed:false,publicHttpsPassed:false,browserPassed:false,interactive3D:false,
 sourceModified:true,staticImageSubstitute:false,visualAcceptance:false,userVisualAccepted:false,productionReady:false,
 softwareRenderer:true,physicalPhone:false,canvasComparison:{width:900,height:720,devicePixelRatio:1,pixelTolerance:0},
 limitations:[
  'Bounded fine-relief change only. Colour, roughness, wetness and geometry retain R01.1; user visual acceptance is separate.',
  'Full-frame byte equality is a same-machine Chromium SwiftShader check, not a physical GPU or physical phone certificate.',
  'Camera and neutral inspection lighting are explicitly reapplied comparison conditions; these are not claimed to be archived.',
  'portraitBank.selected() is a UI selection cache; persisted identity is verified from archived native identity and geometry.',
  'The frozen host retains its remote asset loader. Offline self-containment is not claimed.',
  'Legacy R01/R01.1 v1 archives map explicitly to fine-relief revision 1; R02 colour archives are not reinterpreted as R01.1.'
 ]
};
let browser,allGatesPassed=false,sequence=0;const live=new Set(),active=[];
function save(name,data){const f=path.join(out,name),tmp=f+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n');fs.renameSync(tmp,f);}
function checkpoint(){q.updatedAt=new Date().toISOString();q.activeStages=active.map(x=>({...x}));save('qa.partial.json',q);}
function progress(name,event,extra={}){const r={sequence:++sequence,at:new Date().toISOString(),name,event,...extra};fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(r)+'\n');q.lastProgress=r;checkpoint();console.log('STAGE '+event+' '+name+(extra.elapsedMS===undefined?'':' '+extra.elapsedMS+' ms'));}
async function bounded(name,fn,ms=180000){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(name+' exceeded '+ms+' ms; pending browser work is not completed')),ms);})]);}finally{clearTimeout(timer);}}
async function stage(name,fn){const item={name,startedAt:new Date().toISOString()},start=Date.now();active.push(item);progress(name,'start');try{const r=await fn();progress(name,'end',{elapsedMS:Date.now()-start});return r;}catch(e){progress(name,'failure',{error:String(e),elapsedMS:Date.now()-start});throw e;}finally{active.splice(active.indexOf(item),1);checkpoint();}}
async function test(name,fn){return stage(name,async()=>{const start=Date.now();try{const result=await fn();assert.notEqual(result,false);q.tests.push({name,passed:true,elapsedMS:Date.now()-start,result});checkpoint();return result;}catch(e){q.tests.push({name,passed:false,elapsedMS:Date.now()-start,error:String(e)});checkpoint();throw e;}});}
for(const[signal,code]of[['SIGTERM',143],['SIGINT',130]])process.once(signal,()=>{q.completed=false;q.shareAllowed=false;q.failure='Interrupted by '+signal;q.finishedAt=new Date().toISOString();q.termination={signal,exitCode:code};save('qa.json',q);process.exit(code);});
const evaluate=(p,fn,arg,ms=180000)=>bounded('evaluate '+p.__qaLabel,()=>p.evaluate(fn,arg),ms);

async function drain(p,label,timeoutMS=60000){return stage('GPU drain '+label,async()=>{
 const r=await evaluate(p,()=>{window.lifelikeIdle?.pause?.();const v=window.__IDENTITY_QA__?.viewer?.();if(!v?.renderer)return{rendererAbsent:true};const gl=v.renderer.getContext(),pixel=new Uint8Array(4),start=performance.now(),errorBefore=gl.getError();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return{method:'synchronous CPU readPixels; no new render',elapsedMS:performance.now()-start,errorBefore,error:gl.getError(),contextLost:gl.isContextLost(),frame:v.renderer.info.render.frame,drawCalls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles,rgba:Array.from(pixel)};},null,timeoutMS);
 if(!r.rendererAbsent){assert.equal(r.errorBefore,0,label+' error before drain');assert.equal(r.error,0,label+' error during drain');assert.equal(r.contextLost,false,label+' context lost');}return r;
});}
async function load(t,label){return stage('cold load '+label,async()=>{
 const context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1,acceptDownloads:true});
 const record={label,createdAt:new Date().toISOString(),storageStateSupplied:false,closed:false};const item={context,page:null,record};live.add(item);q.contexts.push(record);
 assert.deepEqual(await context.storageState(),{cookies:[],origins:[]},'New context unexpectedly contains prior storage');
 const response=await context.request.get(t.raw,{timeout:90000});assert.equal(response.status(),200,'Pinned public HTML HTTP status');const bytes=await response.body();
 assert.equal(sha(bytes),t.hash,'Pinned public production bytes changed');assert(bytes.includes(Buffer.from(t.version)),'Expected version absent from public HTML');
 record.publicReadback={url:t.raw,httpStatus:response.status(),bytes:bytes.length,sha256:sha(bytes)};
 const p=await context.newPage();item.page=p;p.__qaLabel=label;p.setDefaultTimeout(45000);const start=Date.now();
 p.on('pageerror',e=>q.errors.push({page:label,error:String(e)}));
 p.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text()))q.consoleErrors.push({page:label,error:m.text()});});
 p.on('requestfailed',r=>{if(!/favicon/i.test(r.url()))q.failedRequests.push({page:label,url:r.url(),error:r.failure()?.errorText});});
 p.on('response',r=>{if(r.status()>=400&&!/favicon/i.test(r.url()))q.resourceErrors.push({page:label,url:r.url(),status:r.status()});});
 const nav=await p.goto(t.url,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(nav.status(),200,'Public wrapper HTTP status');
 await p.waitForFunction(()=>window.__HEAD_PROC__?.ready||window.__HEAD_PROC__?.errors?.length,null,{timeout:300000});
 await p.waitForFunction(()=>window.__R05_PRESET_READY__===true&&window.lipRealism?.ready===true,null,{timeout:180000});
 const host=await evaluate(p,()=>({ready:__HEAD_PROC__.ready,errors:__HEAD_PROC__.errors,lipLoaderErrors:window.__LIP_P3__?.errors,lipErrors:window.__LIP_REALISM__?.errors,finalFrame:__IDENTITY_QA__.viewer().startupFinalFrame,version:lipRealism.version,source:window.__LIP_REALISM_SOURCE__,initialPortrait:portraitBank.selected()}));
 assert(host.ready&&host.finalFrame,'Native final frame missing');for(const k of['errors','lipLoaderErrors','lipErrors'])assert.equal(host[k]?.length||0,0,'Host error: '+JSON.stringify(host));assert.equal(host.version,t.version);
 if(t===candidateTarget){assert.equal(host.source.sourceCommit,SOURCE_COMMIT,'Public runtime source metadata does not match the frozen source');assert.equal(host.source.moduleSHA256,q.source.candidateModuleSHA256,'Public runtime module metadata differs from reviewed source');assert.equal(host.source.hostSHA256,'d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a','Public runtime uses another host');}
 await evaluate(p,()=>{window.lifelikeIdle?.pause?.();const v=__IDENTITY_QA__.viewer();v.orbit.autoRotate=false;v.orbit.enableDamping=false;});
 record.url=p.url();record.host=host;record.readyMS=Date.now()-start;record.startupDrain=await drain(p,label+' startup',180000);
 assert(record.startupDrain.frame>0&&record.startupDrain.drawCalls>0&&record.startupDrain.triangles>0,'Startup did not draw the native scene');record.readyAndDrainedMS=Date.now()-start;checkpoint();return item;
});}
async function closeContext(item){
 if(item.record.closed)return;
 const errors=[];if(item.page&&!item.page.isClosed()){
  try{item.record.finalDrain=await drain(item.page,item.record.label+' close');}catch(e){errors.push({step:'drain',error:String(e)});}
  try{await stage('close page '+item.record.label,()=>bounded('close page',()=>item.page.close({runBeforeUnload:false}),60000));assert(item.page.isClosed());item.record.pageClosed=true;}catch(e){errors.push({step:'page.close',error:String(e)});}
 }
 try{await stage('close context '+item.record.label,()=>bounded('close context',()=>item.context.close(),60000));assert(!browser.contexts().includes(item.context));item.record.closed=true;item.record.closedAt=new Date().toISOString();live.delete(item);}catch(e){errors.push({step:'context.close',error:String(e)});}
 if(errors.length){item.record.cleanupErrors=errors;q.cleanupError=q.cleanupError||JSON.stringify(errors);throw Error('Context cleanup failed: '+JSON.stringify(errors));}checkpoint();
}
async function controlledView(p){return evaluate(p,()=>{
 window.lifelikeIdle?.pause?.();const v=__IDENTITY_QA__.viewer();v.orbit.autoRotate=false;v.orbit.enableDamping=false;v.renderer.setPixelRatio(1);v.renderer.setSize(900,720,false);v.camera.aspect=900/720;
 lipWorkbench.view('macro');v.camera.aspect=900/720;v.camera.updateProjectionMatrix();v.orbit.update();headProceduralSkin.inspection.set('neutral');
 return{kind:'native macro',controlled:true,archived:false,width:900,height:720,light:'neutral',position:v.camera.position.toArray(),target:v.orbit.target.toArray(),zoom:v.camera.zoom,fov:v.camera.fov,aspect:v.camera.aspect};
});}
async function frame(p,name){
 // The frozen host does not preserve its default drawing buffer. A render in
 // an earlier browser task can already have been composited and cleared even
 // when renderer.info still reports its draw. Use the successful R01.1 method:
 // complete native viewer.render -> finish -> CPU readPixels in ONE callback.
 // Do not bypass the inherited material/diffusion wrappers or alter context
 // attributes to keep an old frame alive.
 const d=await evaluate(p,()=>{
  const v=__IDENTITY_QA__.viewer(),r=v.renderer,gl=r.getContext(),errorBefore=gl.getError(),frameBefore=r.info.render.frame,viewerRendersBefore=v.renders,contextAttributes=gl.getContextAttributes(),started=performance.now();
  const renderResult=v.render(),renderReturnedThenable=!!renderResult&&typeof renderResult.then==='function';
  gl.finish();const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,a=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);const readbackMS=performance.now()-started;
  let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));
  return{width,height,bytes:btoa(s),errorBefore,error:gl.getError(),contextLost:gl.isContextLost(),contextAttributes,frameBefore,frameAfter:r.info.render.frame,viewerRendersBefore,viewerRendersAfter:v.renders,renderReturnedThenable,sameCallbackRenderAndRead:true,readbackMS,calls:r.info.render.calls,triangles:r.info.render.triangles,defaultFramebuffer:r.getRenderTarget()===null&&gl.getParameter(gl.FRAMEBUFFER_BINDING)===null};
 });
 const bytes=Buffer.from(d.bytes,'base64');let nonUniformPixels=0;for(let i=4;i<bytes.length;i+=4)if(bytes[i]!==bytes[0]||bytes[i+1]!==bytes[1]||bytes[i+2]!==bytes[2])nonUniformPixels++;
 // Record the actual return values before any gate can throw. This is raw
 // readback evidence, not a PASS; PNGs and comparison gates remain unchanged.
 const {bytes:encodedBytes,...audit}=d;q.frameReadbacks??=[];q.frameReadbacks.push({page:p.__qaLabel,name:name||null,method:'same-callback full native viewer.render -> gl.finish -> CPU RGBA readPixels',...audit,byteLength:bytes.length,framebufferSHA256:sha(bytes),nonUniformPixels,firstRGBA:[...bytes.subarray(0,4)]});checkpoint();
 assert.equal(d.errorBefore,0,'GPU error before framebuffer read');assert.equal(d.error,0,'Framebuffer WebGL error');assert.equal(d.contextLost,false);assert.equal(d.renderReturnedThenable,false,'Native viewer.render is asynchronous; same-callback frame cannot be certified');assert.equal(d.width,900);assert.equal(d.height,720);assert(d.defaultFramebuffer,'Readback did not use the final native framebuffer');assert(d.frameAfter>d.frameBefore,'Native viewer.render did not advance the renderer in this callback');assert(d.frameAfter>(p.__qaLastFrameRead??-1),'No new production render since previous full-frame read');assert(d.calls>0&&d.triangles>0,'Native scene draw missing');assert.equal(bytes.length,900*720*4);p.__qaLastFrameRead=d.frameAfter;
 assert(nonUniformPixels>d.width*d.height*.01,'Blank framebuffer');const f={width:d.width,height:d.height,bytes,hash:sha(bytes),nonUniformPixels};
 if(name){const png=new PNG({width:d.width,height:d.height});for(let y=0;y<d.height;y++)bytes.copy(png.data,y*d.width*4,(d.height-1-y)*d.width*4,(d.height-y)*d.width*4);const b=PNG.sync.write(png);fs.writeFileSync(path.join(out,name+'.png'),b);q.screenshots.push({name,kind:'actual-WebGL-framebuffer',width:f.width,height:f.height,bytes:b.length,sha256:sha(b),framebufferSHA256:f.hash});}return f;
}
const small=f=>({width:f.width,height:f.height,sha256:f.hash,nonUniformPixels:f.nonUniformPixels});
async function fingerprint(p){return evaluate(p,async()=>{
 const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),g=v.geometry;
 const hash=async a=>a?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join(''):null;
 const attributes={};for(const k of['position','normal','csRest','fRest','skinIndex','skinWeight','l19State','l19Detail'])attributes[k]=await hash(g.attributes[k]?.array);
 return{attributes,index:await hash(g.index?.array),canonicalPositions:await hash(m.positions),canonicalFaces:await hash(m.faces),vertices:g.attributes.position.count,triangles:g.index.count/3};
});}
async function calibration(p){return evaluate(p,async()=>{
 const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),g=v.currentLip?.geometry,item=m.lipStructure.mother.surfaces.get(g);
 if(!g||!item||item.topology.geometry!==g)throw Error('Current native lip calibration instance absent');const count=g.attributes.position.count;if(item.topology.count!==count)throw Error('Calibration topology count mismatch');
 if(new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]!==4)throw Error('Byte-exact QA requires a little-endian Chromium host');
 const field=async a=>{if(a===null)return null;if(!(a instanceof Float32Array)||a.length!==count)throw Error('Invalid native reference field');for(const x of a)if(!Number.isFinite(x)||x<0)throw Error('Invalid native reference length');const digest=await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength));return{sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),byteLength:a.byteLength,length:a.length};};
 return{schema:'kaopu/lip-calibration@1',byteOrder:'float32-le',count,lastKey:item.lastKey,reference:await field(item.reference),referenceHorizontal:await field(item.referenceHorizontal)};
});}
function serializedCalibration(saved){
 const c=saved?.lipRealism?.calibration;assert(c&&typeof c==='object','Full archive lacks native calibration');assert.equal(c.schema,'kaopu/lip-calibration@1');assert.equal(c.byteOrder,'float32-le');assert(Number.isSafeInteger(c.count)&&c.count>0);assert.equal(typeof c.lastKey,'string');
 const field=value=>{if(value===null)return null;assert.equal(typeof value,'string');const b=Buffer.from(value,'base64');assert.equal(b.toString('base64'),value);assert.equal(b.length,c.count*4);for(let i=0;i<b.length;i+=4){const x=b.readFloatLE(i);assert(Number.isFinite(x)&&x>=0);}return{sha256:sha(b),byteLength:b.length,length:b.length/4};};
 return{schema:c.schema,byteOrder:c.byteOrder,count:c.count,lastKey:c.lastKey,reference:field(c.reference),referenceHorizontal:field(c.referenceHorizontal)};
}
function parameters(archive,{ignoreLipVersion=false}={}){const a=structuredClone(archive);if(a.lipRealism){delete a.lipRealism.calibration;if(ignoreLipVersion)delete a.lipRealism.version;}return a;}
async function archive(p){return evaluate(p,()=>fullCommonWorkbench.archive());}
async function comparisonState(p){return evaluate(p,()=>{
 const v=__IDENTITY_QA__.viewer();v.scene.updateMatrixWorld(true);const lights=[];v.scene.traverse(o=>{if(!o.isLight)return;let visible=true;for(let x=o;x;x=x.parent)visible=visible&&x.visible;lights.push({type:o.type,name:o.name,color:o.color.toArray(),ground:o.groundColor?.toArray(),intensity:o.intensity,matrix:o.matrixWorld.toArray(),visible,target:o.target?.matrixWorld.toArray()});});
 return{camera:{position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),target:v.orbit.target.toArray(),projection:v.camera.projectionMatrix.toArray()},lights,exposure:v.renderer.toneMappingExposure,toneMapping:v.renderer.toneMapping,outputColorSpace:v.renderer.outputColorSpace};
});}
async function snapshot(p){return{geometry:await fingerprint(p),calibration:await calibration(p),parameters:parameters(await archive(p)),comparisonConditions:await comparisonState(p)};}
async function shaders(p){const s=await evaluate(p,()=>({lip:lipRealism.fragment(),head:headProceduralSkin.fragment(),body:bodyProceduralSkin.fragment()}));const result={};for(const[k,v]of Object.entries(s)){assert.equal(typeof v,'string');assert(v.length>1000,'Missing live '+k+' shader');result[k]={sha256:sha(v),bytes:Buffer.byteLength(v)};}return result;}
async function gpu(p){return evaluate(p,()=>{const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext();const programs=v.renderer.info.programs.map(p=>({linked:!!gl.getProgramParameter(p.program,gl.LINK_STATUS),log:gl.getProgramInfoLog(p.program)}));return{programs,error:gl.getError(),contextLost:gl.isContextLost(),lipReady:lipRealism.ready,vertices:v.geometry.attributes.position.count,triangles:v.geometry.index.count/3};});}
async function assertGPU(p){const g=await gpu(p);assert(g.programs.length&&g.programs.every(p=>p.linked),'Unlinked live GPU program');assert.equal(g.error,0);assert.equal(g.contextLost,false);assert(g.lipReady);return g;}
async function openLegacyPanel(p){if(!await p.locator('#lr-existing').evaluate(e=>e.open))await p.locator('#lr-existing > summary').click();}
async function download(p,name,action){return stage('real download '+name,async()=>{
 const event=p.waitForEvent('download',{timeout:60000});await action();const d=await event;const file=path.join(out,name+'.json');await bounded('save download '+name,()=>d.saveAs(file),60000);assert.equal(await d.failure(),null,'Download failed');const bytes=fs.readFileSync(file),parsed=JSON.parse(bytes.toString('utf8'));
 const record={name,file:path.basename(file),suggestedFilename:d.suggestedFilename(),bytes:bytes.length,sha256:sha(bytes),hasLipRealism:!!parsed.lipRealism,hasCalibration:!!parsed.lipRealism?.calibration};q.downloads.push(record);checkpoint();return{file,bytes,parsed,record};
});}
async function loadFile(p,file,selector){return stage('native file input '+p.__qaLabel+' '+selector,async()=>{
 const input=p.locator(selector);assert.equal(await input.count(),1,'Native file input absent');await input.setInputFiles(file);
 await p.waitForFunction(selector=>{const e=document.querySelector(selector);return e&&e.value===''&&e.files.length===0;},selector,{timeout:300000});
 assert.equal(await evaluate(p,()=>lipRealism.ready),true);const status=await p.locator('#lr-status').textContent();assert(/^(本版细纹 R03|上一版 R01\.1 对照|R07 原版嘴唇对照)/.test(status||''),'Native file input did not report successful restored settings: '+status);return{selector,method:'Playwright setInputFiles on existing production input and awaited original async onchange completion; full state checked by caller',file:path.basename(file),sha256:sha(fs.readFileSync(file)),status};
});}
async function rejectBeforeMutation(p,bad,name){return stage(name,async()=>{
 const before=await snapshot(p),a=await frame(p);const rejection=await evaluate(p,async saved=>{try{await fullCommonWorkbench.restore(saved);return{rejected:false};}catch(e){return{rejected:true,error:String(e)};}},bad,300000);
 const after=await snapshot(p),b=await frame(p);assert(rejection.rejected,'Mismatched native calibration accepted');assert.deepEqual(after,before,'Rejected archive mutated persistent state, geometry or comparison conditions');assert(a.bytes.equals(b.bytes),'Rejected archive changed actual framebuffer bytes');const result={rejection,before,after,pixelsBefore:small(a),pixelsAfter:small(b),unchanged:true};save(name+'.json',result);return{rejection,unchanged:true,frame:small(b)};
});}
async function checkAliases(p,saved){return stage('all full-person API aliases share the route',async()=>{
 const result=await evaluate(p,()=>{const controller=__IDENTITY_QA__.controller(),aliases={fullCommonWorkbench,headProceduralSkin,bodyProceduralSkin,lipRealism};return{controller:{ownsImplementation:true,archive:controller.archive()},...Object.fromEntries(Object.entries(aliases).map(([name,a])=>[name,{archiveIsSharedDelegate:a.archive===lipRealism.archive,restoreIsSharedDelegate:a.restore===lipRealism.restore,archive:a.archive()}]))};});
 for(const[name,r]of Object.entries(result)){if(name!=='controller')assert(r.archiveIsSharedDelegate&&r.restoreIsSharedDelegate,'Stale archive API alias: '+name);assert.deepEqual(r.archive,saved,'API alias archives a different person: '+name);delete r.archive;}save('api-aliases.json',result);return result;
});}
async function mobile(p){return stage('390x844 production controls and native viewport',async()=>{
 await p.setViewportSize({width:390,height:844});await evaluate(p,()=>lipRealism.view('front'));await drain(p,'mobile viewport');
 const r=await evaluate(p,()=>({viewport:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth,ready:lipRealism.ready,controls:document.querySelectorAll('#lr-controls input[type=range]').length,saveButton:!!document.querySelector('[data-lr-action="save"]'),fileInputs:['#lr-file','#ps-file'].map(s=>!!document.querySelector(s)),canvas:{width:__IDENTITY_QA__.viewer().renderer.domElement.clientWidth,height:__IDENTITY_QA__.viewer().renderer.domElement.clientHeight}}));
 assert(r.ready&&r.controls>0&&r.saveButton&&r.fileInputs.every(Boolean)&&r.canvas.width>100&&r.canvas.height>100);assert(r.scrollWidth<=392,'Mobile horizontal overflow');
 const cdp=await p.context().newCDPSession(p);try{const data=await bounded('mobile screenshot',()=>cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),60000);const b=Buffer.from(data.data,'base64');fs.writeFileSync(path.join(out,'mobile-390x844.png'),b);q.screenshots.push({name:'mobile-390x844',kind:'native-browser-viewport',bytes:b.length,sha256:sha(b)});}finally{await bounded('detach mobile screenshot',()=>cdp.detach(),5000);}return{...r,physicalPhone:false};
});}


const SCENARIOS=['P01-closed','P01-open','P02-closed','P02-open'];
const REQUIRED_TESTS=['protected production source', 'original defaults retained', 'ancient host archive compatibility',
 ...SCENARIOS.map(x=>'same person '+x), 'schema migrations reject before mutation',
 'R07 original and mode round trips', 'synchronized macro performance',
 'fine-relief zero and real slider', 'all v2 complete-person saves',
 'fresh reader exact disk restore', 'mobile viewport controls', 'zero runtime and resource errors'];
q.requiredTests=REQUIRED_TESTS;q.scenarios=[];
q.canvasComparison.channels='RGBA';q.canvasComparison.roi='Independent frozen native lip-rail conservative rectangle, fixed 8-pixel padding; not a per-pixel anatomical segmentation';

function between(s,a,b){assert.equal(s.split(a).length,2,'Unique source anchor: '+a);const start=s.indexOf(a),end=s.indexOf(b,start+a.length);assert(end>start,'Source end anchor: '+b);return s.slice(start,end);}
function protectedSource(){
 const directory=path.dirname(__dirname),baseline=fs.readFileSync(path.join(directory,'lip-realism-r01-1','LipSurface.js'),'utf8'),candidate=fs.readFileSync(path.join(__dirname,'LipSurface.js'),'utf8');
 assert.equal(sha(baseline),'4f680a4ab00b40de66b42aef8adcb64e50f3fd3df202d3c6039d412d6a7f31b3','Frozen R01.1 module changed');
 const anchor=JSON.parse(fs.readFileSync(path.join(__dirname,'TASK_ANCHOR.json')));assert.equal(anchor.taskId,'LIP-DETAIL-R03-20261018');assert.equal(anchor.branch,'feature/lip-detail-r03-20261018');assert.equal(anchor.acceptedBaseline.buildCommit,ORIGINAL_COMMIT);assert.equal(anchor.acceptedBaseline.previewSHA256,ORIGINAL_HASH);
 const originalFolds=between(baseline,'float lrFolds(', '\nvoid lrEvaluate('),preservedFolds=between(candidate,'float lrFolds(', '\n// R03 changes only');
 assert.equal(preservedFolds,originalFolds,'R01.1 fine-relief function changed');
 const oldEvaluate=between(baseline,'void lrEvaluate(', '\n`;\n}'),newEvaluate=between(candidate,'void lrEvaluate(', '\n`;\n}');
 const oldHeight=' lrHeight=lrFolds(mm,lrDepth,lrUpper,footprint)*lrFoldStrength/strain;';
 const newHeight=' if(lrSurfaceRevision>1.5){\n  float spanMM=max(1.,mix(ib-bottom,top-it,lrUpper)*1000.);\n  lrHeight=lrFoldsR03(mm,lrDepth,lrUpper,footprint,spanMM)*lrFoldStrength/strain;\n }else{\n'+oldHeight+'\n }';
 assert.equal(newEvaluate.split(newHeight).length,2,'Reviewed height-only selector changed');
 assert.equal(newEvaluate.replace(newHeight,oldHeight),oldEvaluate,'Albedo, roughness, scope, wetness or inherited height attenuation changed');
 const blocks=[['material integration','function addSurface(','function boot('],['coarse geometry',' const mother=model.lipStructure.mother,',' const names='],['view',' function view(kind){',' const priorArchive='],['native calibration',' const calibrationSchema=',' function archive(){'],['archive delegates',' controller.archive=archive;',' function save(){']];
 const protectedHashes={};for(const[name,a,b]of blocks){const x=between(baseline,a,b),y=between(candidate,a,b);assert.equal(y,x,'Protected '+name+' source changed');protectedHashes[name]=sha(x);}
 const setLine=s=>s.split('\n').find(l=>l.startsWith(' function set(part)'));assert.equal(setLine(candidate),setLine(baseline),'Mode changes changed native geometry-update routing');assert(candidate.includes('COARSE_RELIEF_SCALE=.35;'),'Original coarse-relief scale changed');
 for(const forbidden of ['lrTissueAlbedo','lrOuterBlend','lrRevision'])assert(!candidate.includes(forbidden),'R03 imported an active colour-composition shader symbol: '+forbidden);
 return{baselineModuleSHA256:sha(baseline),candidateModuleSHA256:sha(candidate),verificationScriptSHA256:sha(fs.readFileSync(__filename)),builderSHA256:sha(fs.readFileSync(path.join(__dirname,'build.cjs'))),taskAnchorSHA256:sha(fs.readFileSync(path.join(__dirname,'TASK_ANCHOR.json'))),oldFoldsSHA256:sha(originalFolds),protectedHashes,heightSelectionOnly:true};
}
function migratedV1(a){const b=structuredClone(a);assert.equal(b.lipRealism.schema,'kaopu/lip-realism@1');b.lipRealism.schema='kaopu/lip-realism@2';b.lipRealism.version=VERSION;b.lipRealism.settings.surfaceRevision=1;return b;}
function withoutLip(a){const b=structuredClone(a);delete b.lipRealism;return b;}
function withoutRevision(s){const b={...s};delete b.surfaceRevision;return b;}
function assertOnlySettings(a,b,changes,label){const expected=structuredClone(a);Object.assign(expected.lipRealism.settings,changes);assert.deepEqual(b,expected,label);}
async function selectMode(p,mode){
 const button=p.locator('[data-lr-mode="'+mode+'"]');assert.equal(await button.count(),1,'Actual mode button missing: '+mode);await button.click();
 const s=await evaluate(p,()=>lipRealism.settings());assert.equal(s.enabled,mode!=='original');if(mode!=='original')assert.equal(s.surfaceRevision,mode==='new'?3:1);assert.equal(await button.getAttribute('aria-pressed'),'true');return s;
}
async function selectDiagnostic(p,value){await p.locator('#lr-diagnostic').selectOption(String(value));assert.equal((await evaluate(p,()=>lipRealism.settings())).diagnostic,value);}
async function nativePose(p,jawOpen){return evaluate(p,jawOpen=>{lipWorkbench.stop();window.lifelikeIdle?.pause?.();const before=lipWorkbench.pose();lipWorkbench.setPose({...before,jawOpen});return lipWorkbench.pose();},jawOpen,300000);}
async function roi(p){return evaluate(p,()=>{
 const v=__IDENTITY_QA__.viewer(),rails=__IDENTITY_QA__.model().lipStructure.rails,g=v.geometry,R=g.attributes.fRest,T=g.attributes.csType,P=g.attributes.position,V3=v.camera.position.constructor,a=new V3();
 v.scene.updateMatrixWorld(true);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,count=0;
 for(let i=0;i<R.count;i++){if(!rails.sample([R.getX(i),R.getY(i),R.getZ(i)],T.getX(i)).roi)continue;a.set(P.getX(i),P.getY(i),P.getZ(i)).applyMatrix4(v.mesh.matrixWorld).project(v.camera);if(a.z< -1||a.z>1)continue;const x=(a.x*.5+.5)*900,y=(a.y*.5+.5)*720;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);count++;}
 if(!count)throw Error('Native mouth landmarks produced no ROI');return{x0:Math.max(0,Math.floor(x0)-8),x1:Math.min(900,Math.ceil(x1)+8),y0:Math.max(0,Math.floor(y0)-8),y1:Math.min(720,Math.ceil(y1)+8),vertexCount:count,source:'independent frozen native LipRails ROI projected from the same person before revision switch',paddingPixels:8,yOrigin:'bottom'};
});}
function difference(a,b,r){
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);let changedInside=0,changedOutside=0,outsideMax=0,insideMax=0;const outsideExamples=[];
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){const i=(y*a.width+x)*4;let d=0;for(let c=0;c<4;c++)d=Math.max(d,Math.abs(a.bytes[i+c]-b.bytes[i+c]));if(x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1){insideMax=Math.max(insideMax,d);if(d)changedInside++;}else{outsideMax=Math.max(outsideMax,d);if(d){changedOutside++;if(outsideExamples.length<64)outsideExamples.push({x,yBottom:y,beforeRGBA:[...a.bytes.subarray(i,i+4)],afterRGBA:[...b.bytes.subarray(i,i+4)],maxDelta:d});}}}
 return{changedInside,changedOutside,insideMax,outsideMax,outsideExamples,threshold:'exact RGBA equality outside the independent native lip-rail rectangle'};
}
function assertLocalChange(a,b,r,name){const d=difference(a,b,r);assert(d.changedInside>10,name+' has no visible local effect');assert.equal(d.changedOutside,0,name+' changed pixels outside the frozen ROI: '+JSON.stringify(d));return d;}
async function scenario(base,p,id,poseName){let retained;const summary=await test('same person '+id+'-'+poseName,async()=>{
 const key=id+'-'+poseName,jaw=poseName==='closed'?0:.12;
 const pose=await nativePose(base,jaw);assert.equal(pose.jawOpen,jaw,'Baseline native jaw pose not applied');await controlledView(base);
 const oldArchive=await archive(base),oldSnapshot=await snapshot(base),oldFrame=await frame(base,key+'-frozen-r01-1-beauty');
 assert.equal(oldArchive.lipRealism.schema,'kaopu/lip-realism@1');assert.equal(oldArchive.lipRealism.version,ORIGINAL_VERSION);assert.equal(oldArchive.lipRealism.settings.enabled,true);assert.equal(oldArchive.lipRealism.settings.diagnostic,0);
 const file=await download(base,key+'-baseline-v1',()=>base.locator('[data-lr-action="save"]').click());assert.deepEqual(file.parsed,oldArchive);assert.deepEqual(serializedCalibration(file.parsed),oldSnapshot.calibration);
 // A matching already-loaded state must never make a failed file handler PASS.
 await selectMode(p,'new');const before=await archive(p);assert.equal(before.lipRealism.settings.surfaceRevision,3);
 const input=await loadFile(p,file.file,'#ps-file');const expected=migratedV1(file.parsed);assert.deepEqual(await archive(p),expected,'Legacy file migration changed or omitted fields');
 await controlledView(p);const previous=await snapshot(p),previousFrame=await frame(p,key+'-candidate-r01-1-beauty');
 assert.deepEqual(previous.geometry,oldSnapshot.geometry,'R01.1 mode changed canonical/rest/displayed geometry');assert.deepEqual(previous.calibration,oldSnapshot.calibration,'R01.1 mode changed archived native calibration');assert.deepEqual(previous.comparisonConditions,oldSnapshot.comparisonConditions,'Frozen baseline camera/light differs');assert(previousFrame.bytes.equals(oldFrame.bytes),'In-page R01.1 does not match the fixed public R01.1 full RGBA bytes');
 const frozenROI=await roi(p);await selectMode(p,'new');const currentFrame=await frame(p,key+'-r03-beauty'),current=await snapshot(p),currentArchive=await archive(p);
 assert.deepEqual(current.geometry,previous.geometry,'Normal-only revision changed displayed geometry');assert.deepEqual(current.calibration,previous.calibration,'Normal-only revision changed calibration');assert.deepEqual(current.comparisonConditions,previous.comparisonConditions,'Mode switch moved the camera/light');assertOnlySettings(expected,currentArchive,{surfaceRevision:3},'Mode switch changed fields beyond its revision');
 const beautyDelta=assertLocalChange(previousFrame,currentFrame,frozenROI,key+' beauty');
 const evidence={id:key,portrait:id,pose,input,baselineDownload:file.record,baseline:oldSnapshot,previous,current,roi:frozenROI,frames:{frozen:small(oldFrame),previous:small(previousFrame),current:small(currentFrame)},beautyDelta,channels:{},completed:false};save(key+'.json',evidence);progress(key+' actual beauty images','saved',{files:[key+'-frozen-r01-1-beauty.png',key+'-candidate-r01-1-beauty.png',key+'-r03-beauty.png']});
 // All four scenarios check final shader normal, complete albedo and complete
 // roughness output. Only the two channel pairs that must be equal are equal;
 // do not mistake a working normal diagnostic for an albedo preservation test.
 for(const[d,name]of[[4,'normal'],[2,'albedo'],[3,'roughness']]){
  await selectDiagnostic(p,d);await selectMode(p,'previous');const a=await frame(p,key+'-r01-1-'+name);
  await selectMode(p,'new');const b=await frame(p,key+'-r03-'+name);
  const delta=d===4?assertLocalChange(a,b,frozenROI,key+' normal'):difference(a,b,frozenROI);
  if(d!==4)assert(a.bytes.equals(b.bytes),key+' '+name+' changed in a fine-relief-only revision');
  evidence.channels[name]={previous:small(a),current:small(b),delta,exact:d!==4};
 }
 await selectDiagnostic(p,0);await selectMode(p,'previous');const oldAgain=await frame(p);assert(oldAgain.bytes.equals(previousFrame.bytes),'R01.1 real button round trip drifted');
 await selectMode(p,'new');const newAgain=await frame(p);assert(newAgain.bytes.equals(currentFrame.bytes),'R03 real button round trip drifted');
 const after=await snapshot(p);assert.deepEqual(after,current,'Diagnostic/mode round trip mutated persisted state, geometry or comparison conditions');await assertGPU(p);
 evidence.completed=true;evidence.modeRoundTripPixelsExact=true;evidence.gpuProgramsLinked=true;save(key+'.json',evidence);q.scenarios.push({id:key,completed:true,geometryExact:true,calibrationExact:true,oldModePublicPixelsExact:true,albedoExact:true,roughnessExact:true,normalChangedInside: evidence.channels.normal.delta.changedInside,changedOutside:beautyDelta.changedOutside});checkpoint();
 retained={oldFrame,currentFrame,oldArchive,archive:currentArchive,snapshot:current};
 return{evidenceFile:key+'.json',...q.scenarios.at(-1),pose,frames:{frozen:small(oldFrame),current:small(currentFrame)}};
});return{summary,...retained};}

function synchronizedRender({includePrograms=false}={}){
 const v=__IDENTITY_QA__.viewer(),r=v.renderer,gl=r.getContext(),previous=r.render,passes=[],pixel=new Uint8Array(4);
 const before={frame:r.info.render.frame,renders:v.renders,error:gl.getError()},width=gl.drawingBufferWidth,height=gl.drawingBufferHeight;
 r.render=function(...args){
  const start={frame:r.info.render.frame,calls:r.info.render.calls,triangles:r.info.render.triangles},target=r.getRenderTarget();
  const value=previous.apply(this,args),info=r.info.render;
  passes.push({scene:args[0]===v.scene?'native-person':'postprocess',nativeCamera:args[1]===v.camera,defaultTarget:target===null,frameDelta:info.frame-start.frame,drawCalls:r.info.autoReset?info.calls:info.calls-start.calls,triangles:r.info.autoReset?info.triangles:info.triangles-start.triangles});return value;
 };
 try{
  const started=performance.now();v.render();gl.finish();
  gl.readPixels(Math.floor(width/2),Math.floor(height/2),1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
  const elapsedMS=performance.now()-started;
  const result={elapsedMS,width,height,readback:{kind:'synchronous CPU Uint8Array readPixels in the same callback as the full viewer render',x:Math.floor(width/2),y:Math.floor(height/2),width:1,height:1,rgba:Array.from(pixel)},rendererSubmissions:passes.length,rendererFrameDelta:r.info.render.frame-before.frame,viewerRendersDelta:Number.isFinite(v.renders)&&Number.isFinite(before.renders)?v.renders-before.renders:null,passes,defaultFramebuffer:r.getRenderTarget()===null&&gl.getParameter(gl.FRAMEBUFFER_BINDING)===null,errorBefore:before.error,error:gl.getError(),contextLost:gl.isContextLost(),startupFinalFrame:v.startupFinalFrame};
  if(includePrograms){
   const ext=gl.getExtension('WEBGL_debug_renderer_info');
   result.gpu={linked:r.info.programs.map(x=>({id:x.id,linked:!!gl.getProgramParameter(x.program,gl.LINK_STATUS),log:gl.getProgramInfoLog(x.program)})),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),error:gl.getError(),drawCalls:r.info.render.calls,triangles:r.info.render.triangles};
  }return result;
 }finally{r.render=previous;}
}
function assertRenderAudit(a,controlled){
 assert(Number.isFinite(a.elapsedMS)&&a.elapsedMS>0,'Completed viewer frame lacks a finite positive duration');
 assert.equal(a.errorBefore,0,'GPU errors existed before the audited render');assert.equal(a.error,0,'Audited render/readback produced a GPU error');
 assert.equal(a.contextLost,false,'WebGL context was lost');assert.equal(a.startupFinalFrame,true,'Startup gate is still scheduling frames');assert.equal(a.defaultFramebuffer,true,'Readback did not use the final default framebuffer');
 assert(a.rendererSubmissions>0&&a.rendererFrameDelta>0,'Viewer render did not submit a new renderer frame');
 assert(a.passes.every(x=>x.frameDelta>0),'A renderer submission did not advance the actual renderer frame counter');
 assert(a.passes.some(x=>x.scene==='native-person'&&x.nativeCamera&&x.drawCalls>0&&x.triangles>0),'No native person scene was drawn by the full viewer chain');
 assert.equal(a.readback.rgba.length,4,'CPU readback is absent');
 if(controlled){assert.equal(a.width,900,'Performance framebuffer width differs');assert.equal(a.height,720,'Performance framebuffer height differs');}
}

async function migrationRejections(p,legacy){return test('schema migrations reject before mutation',async()=>{
 const before=await snapshot(p),target=migratedV1(legacy);
 assert.notDeepEqual(before.parameters.state.gnm.identity,target.state.gnm.identity,'Rejection target must be another real archived person');
 const cases=await evaluate(p,async({legacy,v2})=>{
  const before=fullCommonWorkbench.archive(),text=JSON.stringify(before),v=__IDENTITY_QA__.viewer(),frame=v.renderer.info.render.frame;
  const cases=[['unknown-schema','v2','schema','kaopu/lip-realism@99'],['v2-missing-revision','v2','missingRevision'],['v2-invalid-revision','v2','revision',2],['v2-unknown-version','v2','version','LIP-REALISM-R99'],['v1-unknown-version','v1','version','LIP-REALISM-R99'],['v1-unexpected-revision','v1','revision',3],['v1-R02-version','v1','version','LIP-REALISM-R02'],['v1-colour-review','v1','colourReview',null],['identity-key-mismatch','v2','badCalibration']];
  const results=[];
  for(const[name,kind,field,value]of cases){
   const a=structuredClone(kind==='v1'?legacy:v2);
   if(field==='missingRevision')delete a.lipRealism.settings.surfaceRevision;
   else if(field==='revision')a.lipRealism.settings.surfaceRevision=value;
   else if(field==='badCalibration')a.lipRealism.calibration.lastKey='wrong';
   else a.lipRealism[field]=value;
   let error;try{await fullCommonWorkbench.restore(a);}catch(e){error=String(e);}
   if(!error)throw Error('Invalid archive accepted: '+name);
   if(JSON.stringify(fullCommonWorkbench.archive())!==text)throw Error('Rejected '+name+' changed native identity, settings or calibration');
   if(v.renderer.info.render.frame!==frame)throw Error('Rejected '+name+' reached a native render/mutation');
   results.push({name,rejected:true,error,completeArchiveUnchanged:true,renderFrameUnchanged:true});
  }
  return results;
 },{legacy,v2:target},300000);
 const after=await snapshot(p);assert.deepEqual(after,before,'Rejected migration changed actual geometry/calibration/parameters/conditions');
 save('migration-rejections.json',{before,after,cases,pixelRenderRequested:false,geometryAndNativeCalibrationExact:true});return{cases,geometryAndNativeCalibrationExact:true,evidenceFile:'migration-rejections.json'};
});}
async function r07RoundTrip(base,p,last){return test('R07 original and mode round trips',async()=>{
 const before=await snapshot(p);await base.locator('[data-lr-mode="original"]').click();const old=await frame(base,'P02-open-frozen-r07-original'),oldGeometry=await fingerprint(base);
 await selectMode(p,'original');const original=await frame(p,'P02-open-candidate-r07-original'),originalSnapshot=await snapshot(p);
 assert(original.bytes.equals(old.bytes),'R07 original button differs from frozen R01.1 disabled R07');assert.deepEqual(originalSnapshot.geometry,oldGeometry,'R07 original displayed geometry differs');
 assert.equal(originalSnapshot.geometry.canonicalPositions,before.geometry.canonicalPositions);assert.equal(originalSnapshot.geometry.canonicalFaces,before.geometry.canonicalFaces);assert.deepEqual(originalSnapshot.calibration,before.calibration);assert.deepEqual(originalSnapshot.comparisonConditions,before.comparisonConditions);
 assertOnlySettings(last.archive,await archive(p),{enabled:false},'R07 button changed unrelated archived settings');
 await selectMode(p,'new');const back=await frame(p);assert(back.bytes.equals(last.currentFrame.bytes),'R07 to R03 did not restore the exact original frame');assert.deepEqual(await snapshot(p),before,'R07 round trip changed the R03 person');
 await base.locator('[data-lr-mode="new"]').click();const baseBack=await frame(base);assert(baseBack.bytes.equals(last.oldFrame.bytes),'Frozen baseline R07 round trip drifted');
 return{r07Frames:{baseline:small(old),candidate:small(original)},r07PixelsExact:true,canonicalUnchanged:true,restoredR03GeometryAndPixelsExact:true};
});}
async function performanceChecks(base,p){return test('synchronized macro performance',async()=>{
 const protectedBase=await snapshot(base),protectedCandidate=await snapshot(p);
 assert.deepEqual(protectedBase.geometry,protectedCandidate.geometry);assert.deepEqual(protectedBase.calibration,protectedCandidate.calibration);assert.deepEqual(protectedBase.comparisonConditions,protectedCandidate.comparisonConditions);
 const expected=migratedV1(await archive(base));expected.lipRealism.settings.surfaceRevision=3;assert.deepEqual(await archive(p),expected,'Performance pages are not the exact same archived person/settings');
 const order=['baseline','candidate','candidate','baseline'],samples={baseline:[],candidate:[]},blocks=[],warmed=new Set();
 q.performanceMethod={entry:'Unmodified complete native viewer.render() including inherited skin/diffusion wrappers',completion:'same-callback gl.finish and synchronous CPU Uint8Array readPixels',view:'macro',width:900,height:720,order,measuredPerBlock:4,warmupPerPage:2,totalMeasured:16,totalWarmup:4,medianRatioLimit:1.20,pureGPUTimer:false,interactiveFPS:false};checkpoint();
 for(const[index,label]of order.entries()){
  const page=label==='baseline'?base:p,warmup=warmed.has(label)?0:2;warmed.add(label);const block={index,label,warmup:[],measured:[]};blocks.push(block);
  for(let n=0;n<warmup+4;n++){
   const phase=n<warmup?'warmup':'measured',audit=await stage('performance '+index+' '+label+' '+phase+' '+n,()=>evaluate(page,synchronizedRender,{},180000));assertRenderAudit(audit,true);
   block[phase].push(audit);if(phase==='measured')samples[label].push(audit.elapsedMS);save('performance-progress.json',{method:q.performanceMethod,blocks,samples});
  }
 }
 for(const label of ['baseline','candidate'])assert.equal(samples[label].length,8);
 const stats=a=>{const b=a.slice().sort((x,y)=>x-y);return{count:b.length,medianMS:(b[3]+b[4])/2,minMS:b[0],maxMS:b.at(-1),p95MS:b[Math.ceil(b.length*.95)-1]};};
 const result={method:q.performanceMethod,baseline:stats(samples.baseline),candidate:stats(samples.candidate),blocks,samples};result.medianRatio=result.candidate.medianMS/result.baseline.medianMS;result.passed=result.medianRatio<=1.20;
 const passShape=a=>a.passes.map(({scene,nativeCamera,defaultTarget,frameDelta,drawCalls,triangles})=>({scene,nativeCamera,defaultTarget,frameDelta,drawCalls,triangles}));const shape=passShape(blocks[0].measured[0]);for(const b of blocks)for(const a of b.measured)assert.deepEqual(passShape(a),shape,'Performance measured different native draw workload');
 assert.deepEqual(await snapshot(base),protectedBase,'Baseline changed during timing');assert.deepEqual(await snapshot(p),protectedCandidate,'Candidate changed during timing');save('performance.json',result);assert(result.passed,'R03 synchronized full-frame median exceeds the fixed 20% budget: '+JSON.stringify({baseline:result.baseline,candidate:result.candidate,medianRatio:result.medianRatio}));
 q.performance={evidenceFile:'performance.json',baseline:result.baseline,candidate:result.candidate,medianRatio:result.medianRatio,limit:1.20,passed:true};return q.performance;
});}
async function fineControl(p){let retained;const summary=await test('fine-relief zero and real slider',async()=>{
 const protectedBefore=await snapshot(p),saved=await archive(p),originalSettings=saved.lipRealism.settings;
 await evaluate(p,()=>lipRealism.set({surfaceRevision:1,diagnostic:4,foldStrength:0}));const zeroOld=await frame(p,'P02-open-zero-r01-1-normal');
 await selectMode(p,'new');const zeroNew=await frame(p,'P02-open-zero-r03-normal');assert(zeroNew.bytes.equals(zeroOld.bytes),'Fine-relief zero did not remove the R03/R01.1 normal difference');
 const slider=p.locator('input[data-lr="foldStrength"]');await slider.press('End');assert.equal((await evaluate(p,()=>lipRealism.settings())).foldStrength,1.2);const maximum=await frame(p,'P02-open-slider-maximum-normal');assert(!maximum.bytes.equals(zeroNew.bytes),'Actual fine-relief slider has no framebuffer effect');
 await slider.press('Home');const zeroAgain=await frame(p);assert.equal((await evaluate(p,()=>lipRealism.settings())).foldStrength,0);assert(zeroAgain.bytes.equals(zeroNew.bytes),'Actual slider return to zero did not restore exact pixels');
 await evaluate(p,()=>lipRealism.set({foldStrength:.66}));const beforeKeyboard=await frame(p);await slider.press('ArrowRight');const nonDefault=await frame(p,'P02-open-saved-nondefault-normal');assert.equal((await evaluate(p,()=>lipRealism.settings())).foldStrength,.67);assert(!nonDefault.bytes.equals(beforeKeyboard.bytes),'Real ArrowRight input did not reach actual normal output');
 const observed=await evaluate(p,()=>lipRealism.settings());assert.deepEqual({...observed,foldStrength:originalSettings.foldStrength,diagnostic:originalSettings.diagnostic},originalSettings,'Fine-relief control changed unrelated values including wetness/defaults');
 assert.deepEqual(await fingerprint(p),protectedBefore.geometry);assert.deepEqual(await calibration(p),protectedBefore.calibration);assert.deepEqual(await comparisonState(p),protectedBefore.comparisonConditions);
 await selectDiagnostic(p,0);const beauty=await frame(p,'P02-open-saved-nondefault-beauty'),now=await snapshot(p),savedArchive=await archive(p);assertOnlySettings(saved,savedArchive,{foldStrength:.67},'Saving nondefault fine relief changed other full-person fields');
 retained={frame:beauty,snapshot:now,archive:savedArchive};save('fine-control.json',{originalSettings,savedSettings:savedArchive.lipRealism.settings,zeroOld:small(zeroOld),zeroNew:small(zeroNew),maximum:small(maximum),savedNormal:small(nonDefault),savedBeauty:small(beauty),nativeGeometryExact:true,zeroExact:true,realKeyboardInput:true});return{evidenceFile:'fine-control.json',zeroPixelsExact:true,realSliderVisible:true,actualSavedFoldStrength:.67,geometryExact:true,protectedWetness:observed.wetness};
});return{summary,...retained};}
async function saveAll(p,saved){let primary;const summary=await test('all v2 complete-person saves',async()=>{
 assert.equal(saved.archive.lipRealism.schema,'kaopu/lip-realism@2');assert.equal(saved.archive.lipRealism.settings.surfaceRevision,3);assert.equal(saved.archive.lipRealism.settings.foldStrength,.67);
 primary=await download(p,'saved-person-v2',()=>p.locator('[data-lr-action="save"]').click());assert.deepEqual(primary.parsed,saved.archive);assert.deepEqual(serializedCalibration(primary.parsed),saved.snapshot.calibration);assert(saved.snapshot.calibration.reference&&saved.snapshot.calibration.referenceHorizontal);
 const aliases=await checkAliases(p,saved.archive);await openLegacyPanel(p);
 const head=await download(p,'legacy-head-save-v2',()=>p.locator('#ps-controls [data-ps-action="save"]').click()),body=await download(p,'legacy-body-save-v2',()=>p.locator('#fb-controls [data-fb-action="save"]').click()),api=await download(p,'body-api-save-v2',()=>evaluate(p,()=>bodyProceduralSkin.save()));
 for(const d of[head,body,api]){assert.deepEqual(d.parsed,saved.archive);assert(d.bytes.equals(primary.bytes),'Complete-person save entries produced different raw JSON bytes');assert.deepEqual(serializedCalibration(d.parsed),saved.snapshot.calibration);}
 save('saved-producer.json',{snapshot:saved.snapshot,frame:small(saved.frame),primary:primary.record,head:head.record,body:body.record,api:api.record,aliases});return{evidenceFile:'saved-producer.json',primary:primary.record,head:head.record,body:body.record,api:api.record,aliases,allBytesExact:true};
});return{summary,primary};}
async function mobileDetail(p){return test('mobile viewport controls',async()=>{
 await p.setViewportSize({width:390,height:844});await evaluate(p,()=>lipRealism.view('front'));await drain(p,'mobile front');const before=parameters(await archive(p));
 await selectMode(p,'previous');await selectMode(p,'new');const slider=p.locator('input[data-lr="foldStrength"]');await slider.press('ArrowLeft');assert.equal((await evaluate(p,()=>lipRealism.settings())).foldStrength,.66);await slider.press('ArrowRight');assert.deepEqual(parameters(await archive(p)),before,'Narrow viewport real controls changed persisted state on return');
 return mobile(p);
});}

(async()=>{try{
 progress('process','start');assert(/^[0-9a-f]{40}$/.test(SOURCE_COMMIT||''),'Frozen source SHA required');assert(/^[0-9a-f]{40}$/.test(BUILD_COMMIT||''),'Fixed candidate build SHA required');assert(/^[0-9a-f]{64}$/.test(EXPECTED_HASH||''),'Expected candidate HTML SHA256 required');
 assert.equal(sha(fs.readFileSync(path.join(__dirname,'preview.html'))),EXPECTED_HASH,'Local production build differs from public QA target');
 q.source=await test('protected production source',()=>protectedSource());
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'BUILD_MANIFEST.json')));assert.equal(manifest.version,VERSION);assert.equal(manifest.sourceCommit,SOURCE_COMMIT);assert.equal(manifest.previewSHA256,EXPECTED_HASH);assert.equal(manifest.moduleSHA256,q.source.candidateModuleSHA256);assert(manifest.hostRestorationExact);q.manifest=manifest;
 browser=await stage('launch real Chromium SwiftShader',()=>chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}));q.browserVersion=browser.version();q.playwrightVersion=require('playwright/package.json').version;
 const baseline=await load(originalTarget,'fixed-r01-1-baseline'),producer=await load(candidateTarget,'r03-producer');
 await test('original defaults retained',async()=>{const a=await evaluate(baseline.page,()=>({defaults:lipRealism.defaults(),presets:lipRealism.presets()})),b=await evaluate(producer.page,()=>({defaults:lipRealism.defaults(),presets:lipRealism.presets(),settings:lipRealism.settings(),buttons:Array.from(document.querySelectorAll('[data-lr-mode]'),e=>({mode:e.dataset.lrMode,text:e.textContent,pressed:e.getAttribute('aria-pressed')}))}));assert.deepEqual(withoutRevision(b.defaults),a.defaults);assert.equal(b.defaults.surfaceRevision,3);assert.deepEqual(b.settings,b.defaults);assert.deepEqual(Object.keys(b.presets).sort(),Object.keys(a.presets).sort());for(const k of Object.keys(a.presets)){assert.deepEqual(withoutRevision(b.presets[k]),a.presets[k]);assert.equal(b.presets[k].surfaceRevision,3);}assert.deepEqual(b.buttons.map(x=>x.mode),['new','previous','original']);return{baseline:a,candidate:b,onlyNewDefaultField:'surfaceRevision:3'};});
 await test('ancient host archive compatibility',async()=>{
  const host=withoutLip(await archive(baseline.page)),file=path.join(out,'ancient-host-person.json');fs.writeFileSync(file,JSON.stringify(host,null,2));await evaluate(producer.page,()=>lipRealism.set({surfaceRevision:1,foldStrength:.21}));const input=await loadFile(producer.page,file,'#lr-file'),after=await archive(producer.page);assert.deepEqual(withoutLip(after),host);assert.deepEqual(after.lipRealism.settings,await evaluate(producer.page,()=>lipRealism.defaults()));assert.equal(after.lipRealism.settings.surfaceRevision,3);return{input,hostFieldsExact:true,defaultsRevision:3,noCalibrationOrPixelExactClaim:true};
 });
 let last,firstLegacy;const identities={};
 for(const id of['P01','P02']){
  await stage('native baseline portrait '+id,()=>evaluate(baseline.page,async id=>{if(portraitBank.selected()!==id)await portraitBank.apply(id);lipWorkbench.stop();window.lifelikeIdle?.pause?.();return portraitBank.selected();},id,300000));
  assert.equal(await evaluate(baseline.page,()=>portraitBank.selected()),id);identities[id]=(await archive(baseline.page)).state.gnm.identity;
  for(const pose of['closed','open']){last=await scenario(baseline.page,producer.page,id,pose);if(!firstLegacy)firstLegacy=last.oldArchive;}
 }
 assert.notDeepEqual(identities.P01,identities.P02,'Portraits did not produce two distinct real identities');q.identities=Object.fromEntries(Object.entries(identities).map(([id,value])=>[id,{nativeIdentitySHA256:sha(JSON.stringify(value))}]));
 await migrationRejections(producer.page,firstLegacy);
 await r07RoundTrip(baseline.page,producer.page,last);
 await performanceChecks(baseline.page,producer.page);await assertGPU(baseline.page);await closeContext(baseline);
 const saved=await fineControl(producer.page),allSaves=await saveAll(producer.page,saved);await assertGPU(producer.page);await closeContext(producer);
 assert(producer.record.closed&&producer.page.isClosed(),'Producer must close completely before the fresh reader is created');assert(baseline.record.closed,'Baseline also must be closed before the fresh reader');
 const bytes=fs.readFileSync(allSaves.primary.file);assert(bytes.equals(allSaves.primary.bytes),'Disk export bytes changed');const diskArchive=JSON.parse(bytes.toString('utf8'));
 q.diskTransfer={file:path.basename(allSaves.primary.file),sha256:sha(bytes),bytes:bytes.length,producerClosedAt:producer.record.closedAt,transport:'Saved JSON raw bytes on disk only; no browser storage, page object or in-memory state is injected into reader'};checkpoint();
 const reader=await load(candidateTarget,'r03-fresh-reader');assert(new Date(reader.record.createdAt)>=new Date(producer.record.closedAt));
 await test('fresh reader exact disk restore',async()=>{
  assert.notDeepEqual((await archive(reader.page)).state.gnm.identity,diskArchive.state.gnm.identity,'Fresh reader already contains the saved P02 before disk load');
  const input=await loadFile(reader.page,allSaves.primary.file,'#lr-file');assert.deepEqual(await calibration(reader.page),saved.snapshot.calibration,'Immediate native calibration restore differs');
  await stage('normal native update after cold restore',()=>evaluate(reader.page,()=>__IDENTITY_QA__.viewer().update()));await controlledView(reader.page);const restored=await snapshot(reader.page),f=await frame(reader.page,'fresh-reader-P02-open-restored');
  assert.deepEqual(restored,saved.snapshot,'Fresh reader failed complete parameters, canonical/rest/index/display geometry, calibration or controlled camera/light equality');assert(f.bytes.equals(saved.frame.bytes),'Fresh reader full RGBA pixels differ');assert.deepEqual(await archive(reader.page),diskArchive,'Fresh reader complete archive changed after normal native update');
  const r={input,producerClosedBeforeCreation:true,normalNativeGeometryUpdatePerformed:true,snapshot:restored,frame:small(f),exactParameters:true,exactGeometry:true,exactCalibration:true,exactPixels:true,pixelTolerance:0};save('fresh-reader.json',r);return{input,evidenceFile:'fresh-reader.json',producerClosedBeforeCreation:true,normalNativeGeometryUpdatePerformed:true,exactParameters:true,exactGeometry:true,exactCalibration:true,exactPixels:true,frame:small(f)};
 });
 await mobileDetail(reader.page);await assertGPU(reader.page);await closeContext(reader);
 await test('zero runtime and resource errors',async()=>{for(const k of['errors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[k].length,0,JSON.stringify(q[k]));assert.equal(q.contexts.length,3);assert(q.contexts.every(c=>c.closed));return{contexts:3,allClosed:true,errors:0};});
 assert.deepEqual(q.tests.map(x=>x.name).sort(),REQUIRED_TESTS.slice().sort(),'Required QA gate missing or duplicated');assert(q.tests.every(t=>t.passed));assert.deepEqual(q.scenarios.map(x=>x.id),SCENARIOS);
 allGatesPassed=true;q.publicHttpsPassed=true;q.browserPassed=true;q.interactive3D=true;
}catch(e){q.failure=String(e);q.completed=false;q.shareAllowed=false;process.exitCode=1;console.error(String(e));checkpoint();
}finally{
 const cleanupErrors=[];for(const item of Array.from(live)){try{await closeContext(item);}catch(e){cleanupErrors.push(String(e));}}
 if(browser){try{await stage('close Chromium',()=>bounded('browser.close',()=>browser.close(),60000));assert(!browser.isConnected());}catch(e){cleanupErrors.push(String(e));}}
 if(cleanupErrors.length){q.cleanupError=q.cleanupError||cleanupErrors.join('\n');process.exitCode=1;}
 q.cleanup={completed:cleanupErrors.length===0&&!q.cleanupError&&live.size===0,browserClosed:!browser||!browser.isConnected(),errors:cleanupErrors};
 q.completed=allGatesPassed&&q.cleanup.completed&&q.cleanup.browserClosed;q.shareAllowed=q.completed&&q.publicHttpsPassed&&q.browserPassed;q.finishedAt=new Date().toISOString();
 if(!q.completed)process.exitCode=1;progress('process','end',{completed:q.completed});save('qa.json',q);console.log(JSON.stringify({version:VERSION,completed:q.completed,passed:q.tests.filter(t=>t.passed).length,tests:q.tests.length,output:out,failure:q.failure||q.cleanupError||null}));if(q.cleanupError)process.exit(1);
}})();
