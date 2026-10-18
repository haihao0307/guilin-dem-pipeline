'use strict';
// Bounded archive-route regression. Real production HTML and real Chromium only.
// The readPixels, native calibration, and geometry hash methods below are taken
// from lip-realism-r01/verify.cjs; the original nine-group suite is not replayed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const VERSION='LIP-REALISM-R01.1',ORIGINAL_VERSION='LIP-REALISM-R01';
const REPOSITORY='haihao0307/guilin-dem-pipeline';
const ORIGINAL_COMMIT='0db4b3c0e5e6e86663be6466fa7ab4b486bd5420';
const ORIGINAL_HASH='4d11c5a8c7b9a0573e37e68ce93eaa9a1657c6b49da6c386a6aa6488ff45f231';
const SOURCE_COMMIT=process.env.SOURCE_SHA,BUILD_COMMIT=process.env.LIP_BUILD_SHA;
const EXPECTED_HASH=process.env.LIP_EXPECTED_PREVIEW_SHA256;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=(process.env.GITHUB_RUN_ID||('local-'+Date.now()))+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
const out=process.env.LIP_QA_OUT||path.join(__dirname,'qa','fresh-context',run);
fs.mkdirSync(out,{recursive:true});
const originalRaw='https://raw.githubusercontent.com/'+REPOSITORY+'/'+ORIGINAL_COMMIT+'/kaopu-unified-human-workbench/lip-realism-r01/preview.html';
const candidateRaw='https://raw.githubusercontent.com/'+REPOSITORY+'/'+BUILD_COMMIT+'/kaopu-unified-human-workbench/lip-realism-r01-1/preview.html';
const target=(raw,version,hash)=>({raw,url:'https://htmlpreview.github.io/?'+raw,version,hash});
const originalTarget=target(originalRaw,ORIGINAL_VERSION,ORIGINAL_HASH),candidateTarget=target(candidateRaw,VERSION,EXPECTED_HASH);
const q={
 schema:'kaopu/lip-archive-fresh-context-qa@1',version:VERSION,startedAt:new Date().toISOString(),
 sourceCommit:SOURCE_COMMIT||null,buildCommit:BUILD_COMMIT||null,verificationCommit:process.env.LIP_VERIFICATION_SHA||null,
 runId:process.env.GITHUB_RUN_ID||null,runAttempt:process.env.GITHUB_RUN_ATTEMPT||null,
 original:{commit:ORIGINAL_COMMIT,previewSHA256:ORIGINAL_HASH,role:'BASELINE_ONLY'},
 candidate:{publicURL:candidateTarget.url,rawURL:candidateRaw,previewSHA256:EXPECTED_HASH||null},
 tests:[],errors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],contexts:[],downloads:[],screenshots:[],
 completed:false,shareAllowed:false,publicHttpsPassed:false,browserPassed:false,interactive3D:false,
 sourceModified:true,staticImageSubstitute:false,visualAcceptance:false,userVisualAccepted:false,productionReady:false,
 softwareRenderer:true,physicalPhone:false,canvasComparison:{width:900,height:720,devicePixelRatio:1,pixelTolerance:0},
 limitations:[
  'Archive routing and fresh BrowserContext recovery only; no new lip anatomy, shader, or performance result is claimed.',
  'Full-frame byte equality is a same-machine Chromium SwiftShader check, not a physical GPU or physical phone certificate.',
  'Camera and neutral inspection lighting are explicitly reapplied comparison conditions; these are not claimed to be archived.',
  'portraitBank.selected() is a UI selection cache; persisted identity is verified from archived native identity and geometry.',
  'The frozen host retains its remote asset loader. Offline self-containment is not claimed.',
  'Legacy archives without calibration are accepted for compatibility; no exact calibration, geometry or pixel recovery is claimed for them.'
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
 if(t===candidateTarget)assert.equal(host.source.sourceCommit,SOURCE_COMMIT,'Public runtime source metadata does not match the frozen source');
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
 lipWorkbench.view('macro');headProceduralSkin.inspection.set('neutral');v.camera.aspect=900/720;v.camera.updateProjectionMatrix();v.orbit.update();v.render();
 return{kind:'native macro',controlled:true,archived:false,width:900,height:720,light:'neutral',position:v.camera.position.toArray(),target:v.orbit.target.toArray(),zoom:v.camera.zoom,fov:v.camera.fov,aspect:v.camera.aspect};
});}
async function frame(p,name){
 const d=await evaluate(p,()=>{const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext();v.render();gl.finish();const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,a=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return{width,height,bytes:btoa(s),error:gl.getError(),contextLost:gl.isContextLost()};});
 assert.equal(d.error,0,'Framebuffer WebGL error');assert.equal(d.contextLost,false);assert.equal(d.width,900);assert.equal(d.height,720);
 const bytes=Buffer.from(d.bytes,'base64');assert.equal(bytes.length,900*720*4);let nonUniformPixels=0;for(let i=4;i<bytes.length;i+=4)if(bytes[i]!==bytes[0]||bytes[i+1]!==bytes[1]||bytes[i+2]!==bytes[2])nonUniformPixels++;
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
 assert.equal(await evaluate(p,()=>lipRealism.ready),true);const status=await p.locator('#lr-status').textContent();assert(/^(本版嘴唇|R07 原版嘴唇对照)/.test(status||''),'Native file input did not report successful restored settings: '+status);return{selector,method:'Playwright setInputFiles on existing production input and awaited original async onchange completion',file:path.basename(file),sha256:sha(fs.readFileSync(file)),status};
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

(async()=>{try{
 progress('process','start');assert(/^[0-9a-f]{40}$/.test(SOURCE_COMMIT||''),'Frozen source SHA required');assert(/^[0-9a-f]{40}$/.test(BUILD_COMMIT||''),'Fixed candidate build SHA required');assert(/^[0-9a-f]{64}$/.test(EXPECTED_HASH||''),'Expected candidate HTML SHA256 required');
 assert.equal(sha(fs.readFileSync(path.join(__dirname,'preview.html'))),EXPECTED_HASH,'Local built HTML differs from the pinned public QA target');
 browser=await stage('launch real Chromium SwiftShader',()=>chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}));q.browserVersion=browser.version();q.playwrightVersion=require('playwright/package.json').version;
 const old=await load(originalTarget,'original-r01');await controlledView(old.page);const oldDefault={snapshot:await snapshot(old.page),frame:await frame(old.page,'original-default'),shaders:await shaders(old.page)};
 await test('original R01 legacy save buttons reproduce the missing-lip archive bug',async()=>{
  await evaluate(old.page,()=>lipRealism.set({redness:.67,pigment:.61,upperDifference:.43,seed:2917}));await openLegacyPanel(old.page);
  const head=await download(old.page,'original-head-save',()=>old.page.locator('#ps-controls [data-ps-action="save"]').click());
  const body=await download(old.page,'original-body-save',()=>old.page.locator('#fb-controls [data-fb-action="save"]').click());
  assert.equal(head.parsed.lipRealism,undefined,'Baseline no longer reproduces the audited legacy head-save bug');assert.equal(body.parsed.lipRealism,undefined,'Baseline no longer reproduces the audited legacy body-save bug');
  const latest=await archive(old.page);assert(latest.lipRealism?.calibration,'Original latest route itself must contain lip data');assert.equal(latest.lipRealism.settings.redness,.67);return{head:head.record,body:body.record,latestRouteContainsLipData:true};
 });await assertGPU(old.page);await closeContext(old);
 const producer=await load(candidateTarget,'producer');await controlledView(producer.page);
 await test('archive-only repair preserves default shader, geometry, calibration and full pixels',async()=>{
  const now=await snapshot(producer.page),f=await frame(producer.page,'candidate-default'),s=await shaders(producer.page);
  assert.deepEqual(s,oldDefault.shaders,'Repair changed live shader source');assert.deepEqual(now.geometry,oldDefault.snapshot.geometry,'Repair changed default native geometry');assert.deepEqual(now.calibration,oldDefault.snapshot.calibration,'Repair changed default calibration');assert.deepEqual(now.comparisonConditions,oldDefault.snapshot.comparisonConditions,'Default comparison camera or lighting differs');
  assert.deepEqual(parameters(await archive(producer.page),{ignoreLipVersion:true}),parameters({...oldDefault.snapshot.parameters},{ignoreLipVersion:true}),'Repair changed original defaults or persistent parameters');assert(f.bytes.equals(oldDefault.frame.bytes),'Repair changed default framebuffer bytes');
  const result={original:{...oldDefault.snapshot,frame:small(oldDefault.frame)},candidate:{...now,frame:small(f)},shaders:s,pixelTolerance:0,exact:true};save('original-vs-repair.json',result);return{shaders:s,geometryExact:true,calibrationExact:true,pixelsExact:true,frame:small(f)};
 });
 await stage('produce a real non-default P02 person',()=>evaluate(producer.page,async()=>{if(portraitBank.selected()==='P02')throw Error('Producer unexpectedly starts on P02');await portraitBank.apply('P02');window.lifelikeIdle?.pause?.();},null,300000));
 await controlledView(producer.page);const beforeControl=await frame(producer.page);const identity=await evaluate(producer.page,()=>({selected:portraitBank.selected(),nativeIdentity:fullCommonWorkbench.archive().state.gnm.identity}));assert.equal(identity.selected,'P02');
 await evaluate(producer.page,()=>lipRealism.set({redness:.66,pigment:.61,upperDifference:.43,seed:2917}));await producer.page.locator('input[data-lr="redness"]').press('ArrowRight');
 const custom=await evaluate(producer.page,()=>lipRealism.settings());assert.equal(custom.redness,.67,'Real native range keyboard event failed');assert.equal(custom.pigment,.61);await controlledView(producer.page);
 const savedFrame=await frame(producer.page,'producer-saved'),savedSnapshot=await snapshot(producer.page),savedArchive=await archive(producer.page);assert(!beforeControl.bytes.equals(savedFrame.bytes),'Chosen lip controls have no real visible effect');
 assert.notDeepEqual(savedArchive.state.gnm.identity,oldDefault.snapshot.parameters.state.gnm.identity,'P02 did not change native identity');
 const primary=await download(producer.page,'saved-person',()=>producer.page.locator('[data-lr-action="save"]').click());assert.deepEqual(primary.parsed,savedArchive,'UI save differs from complete native archive');assert.deepEqual(serializedCalibration(primary.parsed),savedSnapshot.calibration,'Saved calibration bytes differ from native instance');assert(savedSnapshot.calibration.reference&&savedSnapshot.calibration.referenceHorizontal);
 await test('all repaired UI and API saves retain the complete non-default person',async()=>{
  const aliases=await checkAliases(producer.page,savedArchive);await openLegacyPanel(producer.page);
  const head=await download(producer.page,'repaired-head-save',()=>producer.page.locator('#ps-controls [data-ps-action="save"]').click());
  const body=await download(producer.page,'repaired-body-save',()=>producer.page.locator('#fb-controls [data-fb-action="save"]').click());
  const api=await download(producer.page,'repaired-body-api-save',()=>evaluate(producer.page,()=>bodyProceduralSkin.save()));
  for(const d of[head,body,api]){assert.deepEqual(d.parsed,savedArchive,'A save entry omitted or changed persistent fields');assert(d.bytes.equals(primary.bytes),'Save entries produced different JSON bytes');assert.deepEqual(serializedCalibration(d.parsed),savedSnapshot.calibration);}
  save('producer.json',{identity,archive:primary.record,snapshot:savedSnapshot,frame:small(savedFrame),visibleControlChange:true,aliases});return{primary:primary.record,head:head.record,body:body.record,api:api.record,visibleControlChange:true,aliases};
 });await assertGPU(producer.page);await closeContext(producer);
 assert(producer.record.closed&&producer.page.isClosed(),'Producer must be fully closed before consumer creation');
 const diskBytes=fs.readFileSync(primary.file);assert(diskBytes.equals(primary.bytes),'Saved archive changed on disk');const diskArchive=JSON.parse(diskBytes.toString('utf8'));
 q.diskTransfer={file:path.basename(primary.file),sha256:sha(diskBytes),bytes:diskBytes.length,producerClosedAt:producer.record.closedAt,transport:'saved JSON bytes on disk; no page objects or browser storage passed to readers'};checkpoint();
 for(const[index,selector]of['#ps-file','#lr-file'].entries()){
  const reader=await load(candidateTarget,'reader-'+(index+1));assert(new Date(reader.record.createdAt)>=new Date(producer.record.closedAt));await controlledView(reader.page);
  const initial=await archive(reader.page);assert.notDeepEqual(initial.state.gnm.identity,diskArchive.state.gnm.identity,'Fresh reader already has saved identity before file load');
  if(index===0)await test('mismatched identity is rejected before a different fresh person can mutate',async()=>{const bad=structuredClone(diskArchive);bad.lipRealism.calibration.lastKey='wrong';return rejectBeforeMutation(reader.page,bad,'identity-mismatch-no-mutation');});
  await test('fresh reader '+(index+1)+' restores exact disk archive through '+selector,async()=>{
   const input=await loadFile(reader.page,primary.file,selector);assert.deepEqual(await calibration(reader.page),savedSnapshot.calibration,'Calibration differs immediately after file restoration');
   await stage('normal native geometry update after reader '+(index+1)+' restore',()=>evaluate(reader.page,()=>__IDENTITY_QA__.viewer().update()));
   await controlledView(reader.page);const restored=await snapshot(reader.page),f=await frame(reader.page,'reader-'+(index+1)+'-restored');
   assert.deepEqual(restored.calibration,savedSnapshot.calibration,'Fresh context changed native calibration Float32 bytes');assert.deepEqual(restored.geometry,savedSnapshot.geometry,'Fresh context changed canonical/rest/index/display geometry');assert.deepEqual(restored.parameters,savedSnapshot.parameters,'Fresh context changed persistent parameters');assert.deepEqual(restored.comparisonConditions,savedSnapshot.comparisonConditions,'Controlled camera or lighting differs');assert(f.bytes.equals(savedFrame.bytes),'Fresh context did not reproduce exact full framebuffer bytes');
   assert.deepEqual(await archive(reader.page),diskArchive,'Full re-archive differs after fresh recovery');const result={input,contextCreatedAt:reader.record.createdAt,producerClosedBeforeCreation:true,normalNativeGeometryUpdatePerformed:true,snapshot:restored,frame:small(f),exactCalibration:true,exactGeometry:true,exactParameters:true,exactPixels:true,pixelTolerance:0};save('reader-'+(index+1)+'.json',result);return{input,normalNativeGeometryUpdatePerformed:true,exactCalibration:true,exactGeometry:true,exactParameters:true,exactPixels:true,frame:small(f)};
  });
  if(index===1){
   await test('legacy archive without calibration stays compatible without an exact-pixels claim',async()=>{
    const legacy=structuredClone(diskArchive);delete legacy.lipRealism.calibration;const file=path.join(out,'legacy-person.json');fs.writeFileSync(file,JSON.stringify(legacy,null,2));
    await evaluate(reader.page,()=>lipRealism.set({redness:.23}));const before=parameters(await archive(reader.page));assert.equal(before.lipRealism.settings.redness,.23);assert.notDeepEqual(before,savedSnapshot.parameters,'Legacy no-op must not pass against an already matching person');
    const input=await loadFile(reader.page,file,'#ps-file');await controlledView(reader.page);const restored=await snapshot(reader.page),f=await frame(reader.page,'legacy-compatible');assert.deepEqual(restored.parameters,savedSnapshot.parameters,'Legacy path failed to restore persisted parameters');await assertGPU(reader.page);
    const result={input,accepted:true,beforePerturbedRedness:before.lipRealism.settings.redness,restoredRedness:restored.parameters.lipRealism.settings.redness,parametersExact:true,calibration:restored.calibration,geometry:restored.geometry,frame:small(f),exactGeometryOrCalibrationOrPixelComparisonPerformed:false};save('legacy-compatibility.json',result);return result;
   });
   await test('mobile browser viewport remains usable',()=>mobile(reader.page));
  }
  await assertGPU(reader.page);await closeContext(reader);
 }
 await test('every page has zero runtime, shader and resource errors',async()=>{for(const k of['errors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[k].length,0,JSON.stringify(q[k]));assert.equal(q.contexts.length,4);assert(q.contexts.every(c=>c.closed));return{contexts:q.contexts.length,closed:true,errors:0};});
 allGatesPassed=true;q.publicHttpsPassed=true;q.browserPassed=true;q.interactive3D=true;
}catch(e){q.failure=String(e);q.completed=false;q.shareAllowed=false;process.exitCode=1;console.error(String(e));checkpoint();
}finally{
 const cleanupErrors=[];for(const item of Array.from(live)){try{await closeContext(item);}catch(e){cleanupErrors.push(String(e));}}
 if(browser){try{await stage('close Chromium',()=>bounded('browser.close',()=>browser.close(),60000));assert(!browser.isConnected());}catch(e){cleanupErrors.push(String(e));}}
 if(cleanupErrors.length){q.cleanupError=q.cleanupError||cleanupErrors.join('\n');process.exitCode=1;}
 q.cleanup={completed:cleanupErrors.length===0&&!q.cleanupError&&live.size===0,browserClosed:!browser||!browser.isConnected(),errors:cleanupErrors};
 q.completed=allGatesPassed&&q.cleanup.completed&&q.cleanup.browserClosed;q.shareAllowed=q.completed&&q.publicHttpsPassed&&q.browserPassed;q.finishedAt=new Date().toISOString();
 if(!q.completed)process.exitCode=1;progress('process','end',{completed:q.completed});save('qa.json',q);console.log(JSON.stringify({version:VERSION,completed:q.completed,passed:q.tests.filter(t=>t.passed).length,tests:q.tests.length,output:out,failure:q.failure||q.cleanupError||null}));
 if(q.cleanupError)process.exit(1);
}})();
