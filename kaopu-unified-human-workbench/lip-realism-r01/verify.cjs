'use strict';
// Independent renderer QA. Never rebuild or edit the frozen R07 directory.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const VERSION='LIP-REALISM-R01';
const BASE_COMMIT='5543f756ca3af1428323696324303fa70b8de850';
const BASE_HASH='d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a';
const MODE=process.env.LIP_QA_MODE||'candidate';
assert(['baseline','candidate','public'].includes(MODE),'Unknown LIP_QA_MODE');
const run=(process.env.GITHUB_RUN_ID||('local-'+Date.now()))+'-'+(process.env.GITHUB_RUN_ATTEMPT||'1');
const out=process.env.LIP_QA_OUT||path.join(__dirname,'evidence',run,MODE);
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const q={
 schema:'kaopu/lip-realism-qa@1',version:VERSION,mode:MODE,startedAt:new Date().toISOString(),
 sourceCommit:process.env.SOURCE_SHA||null,
 baseline:{commit:BASE_COMMIT,previewSHA256:BASE_HASH,role:'BASELINE_ONLY'},
 tests:[],errors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],screenshots:[],
 softwareRenderer:true,physicalPhone:false,userVisualAccepted:false,visualAcceptance:false,productionReady:false,
 publicHttpsPassed:false,interactive3D:false,staticImageSubstitute:false,sourceModified:MODE!=='baseline',shareAllowed:false,
 canvasComparison:{width:900,height:720,devicePixelRatio:1,fixedFramebuffer:true},
 limitations:[
  'Real Chromium WebGL with SwiftShader; not a physical GPU or phone performance certificate.',
  'Machine checks do not establish anatomical truth or user visual acceptance.',
  'Framebuffer A/B uses equal 900x720 buffers; native public viewport is captured separately.',
  'Frozen host retains its existing remote asset loader; offline self-containment is not claimed.'
 ]};
let browser,context,page,server;const pages=new Set();
async function test(name,fn){try{const result=await fn();assert.notEqual(result,false);q.tests.push({name,passed:true,result});console.log('PASS '+name);return result;}catch(e){q.tests.push({name,passed:false,error:String(e)});throw e;}}
function save(name,value){fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n');}
function small(f){return{width:f.width,height:f.height,sha256:f.hash,nonUniformPixels:f.nonUniformPixels};}
async function serve(){
 const baseline=fs.readFileSync(path.resolve(__dirname,'../human-integrated-r07/preview.html'));
 assert.equal(sha(baseline),BASE_HASH,'Frozen R07 preview drift; do not rebuild old directory');
 const routes=new Map([['/baseline.html',baseline]]);
 if(MODE==='candidate'){
  const candidate=fs.readFileSync(path.join(__dirname,'preview.html'));
  assert(candidate.includes(Buffer.from(VERSION)),'Candidate version marker absent');
  assert.notEqual(sha(candidate),BASE_HASH,'A copied baseline is not a candidate');
  q.previewSHA256=sha(candidate);routes.set('/candidate.html',candidate);
 }
 server=http.createServer((req,res)=>{
  const key=new URL(req.url,'http://localhost').pathname;
  if(key==='/favicon.ico'){res.writeHead(204);res.end();return;}
  const body=routes.get(key);if(!body){res.writeHead(404);res.end('QA route not found');return;}
  res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(body);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));return'http://127.0.0.1:'+server.address().port;
}
async function load(url,label,candidate){
 const p=await context.newPage();pages.add(p);p.setDefaultTimeout(45000);
 p.on('pageerror',e=>q.errors.push({page:label,error:String(e)}));
 p.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text()))q.consoleErrors.push({page:label,error:m.text()});});
 p.on('requestfailed',r=>{if(!/favicon/i.test(r.url()))q.failedRequests.push({page:label,url:r.url(),error:r.failure()?.errorText});});
 p.on('response',r=>{if(r.status()>=400&&!/favicon/i.test(r.url()))q.resourceErrors.push({page:label,url:r.url(),status:r.status()});});
 const start=Date.now(),response=await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});
 assert.equal(response.status(),200,label+' document HTTP status');
 await p.waitForFunction(()=>window.__HEAD_PROC__?.ready||window.__HEAD_PROC__?.errors?.length,null,{timeout:300000});
 const host=await p.evaluate(()=>({ready:window.__HEAD_PROC__?.ready,errors:window.__HEAD_PROC__?.errors,lipErrors:window.__LIP_P3__?.errors,finalFrame:window.__IDENTITY_QA__?.viewer?.()?.startupFinalFrame}));
 assert(host.ready&&host.finalFrame,label+' native final frame missing: '+JSON.stringify(host));
 assert.equal(host.errors?.length||0,0,label+' host shader/startup errors');assert.equal(host.lipErrors?.length||0,0,label+' lip loader errors');
 await p.waitForFunction(()=>window.__R05_PRESET_READY__===true,null,{timeout:180000});
 if(candidate){await p.waitForFunction(()=>window.lipRealism?.ready===true,null,{timeout:180000});assert.equal(await p.evaluate(()=>lipRealism.version),VERSION);}
 await p.evaluate(()=>{window.lifelikeIdle?.pause?.();const v=__IDENTITY_QA__.viewer();v.orbit.autoRotate=false;v.orbit.enableDamping=false;v.render();});
 q[label]={url,httpStatus:response.status(),readyMS:Date.now()-start,host};return p;
}
async function screenshot(p,name){
 await p.evaluate(()=>__IDENTITY_QA__.viewer().render());
 const cdp=await context.newCDPSession(p);
 try{const a=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}),b=Buffer.from(a.data,'base64');fs.writeFileSync(path.join(out,name+'.png'),b);q.screenshots.push({name,kind:'native-browser-viewport',bytes:b.length,sha256:sha(b)});}finally{await cdp.detach();}
}
async function view(p,kind){return p.evaluate(kind=>{
 const v=__IDENTITY_QA__.viewer();v.renderer.setPixelRatio(1);v.renderer.setSize(900,720,false);v.camera.aspect=900/720;
 if(kind==='macro')lipWorkbench.view('macro');else if(kind==='bust')bodyProceduralSkin.focus('bust');else headMorphology.view(kind);
 v.camera.aspect=900/720;v.camera.updateProjectionMatrix();v.orbit.update();v.render();
 return{kind,position:v.camera.position.toArray(),target:v.orbit.target.toArray(),zoom:v.camera.zoom,fov:v.camera.fov,aspect:v.camera.aspect};
},kind);}
async function frame(p,name){
 const d=await p.evaluate(()=>{
  const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext();v.render();gl.finish();
  const width=gl.drawingBufferWidth,height=gl.drawingBufferHeight,a=new Uint8Array(width*height*4);
  gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,a);
  let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));
  return{width,height,bytes:btoa(s),error:gl.getError()};
 });
 assert.equal(d.error,0,'Framebuffer readback WebGL error');assert.equal(d.width,900,'Controlled framebuffer width drift');assert.equal(d.height,720,'Controlled framebuffer height drift');
 const bytes=Buffer.from(d.bytes,'base64');let nonUniformPixels=0;
 for(let i=4;i<bytes.length;i+=4)if(bytes[i]!==bytes[0]||bytes[i+1]!==bytes[1]||bytes[i+2]!==bytes[2])nonUniformPixels++;
 assert(nonUniformPixels>d.width*d.height*.01,'Blank or uniform framebuffer');
 const f={width:d.width,height:d.height,bytes,hash:sha(bytes),nonUniformPixels};
 if(name){
  const png=new PNG({width:d.width,height:d.height});
  for(let y=0;y<d.height;y++)bytes.copy(png.data,y*d.width*4,(d.height-1-y)*d.width*4,(d.height-y)*d.width*4);
  const b=PNG.sync.write(png);fs.writeFileSync(path.join(out,name+'.png'),b);
  q.screenshots.push({name,kind:'actual-WebGL-framebuffer',bytes:b.length,sha256:sha(b),framebufferSHA256:f.hash,width:f.width,height:f.height});
 }
 return f;
}
async function fingerprint(p){return p.evaluate(async()=>{
 const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),g=v.geometry;
 const hash=async a=>a?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join(''):null;
 const attributes={};for(const k of['position','normal','csRest','fRest','skinIndex','skinWeight'])attributes[k]=await hash(g.attributes[k]?.array);
 return{attributes,index:await hash(g.index?.array),canonicalPositions:await hash(m.positions),canonicalFaces:await hash(m.faces),vertices:g.attributes.position.count,triangles:g.index.count/3};
});}
async function state(p){return p.evaluate(()=>{
 const v=__IDENTITY_QA__.viewer();v.scene.updateMatrixWorld(true);const lights=[];
 v.scene.traverse(o=>{if(!o.isLight)return;let visible=true;for(let x=o;x;x=x.parent)visible=visible&&x.visible;lights.push({type:o.type,name:o.name,color:o.color.toArray(),ground:o.groundColor?.toArray(),intensity:o.intensity,matrix:o.matrixWorld.toArray(),visible,target:o.target?.matrixWorld.toArray()});});
 return{camera:{position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),target:v.orbit.target.toArray(),projection:v.camera.projectionMatrix.toArray()},lights,exposure:v.renderer.toneMappingExposure,toneMapping:v.renderer.toneMapping,outputColorSpace:v.renderer.outputColorSpace,skin:headProceduralSkin.settings(),body:bodyProceduralSkin.settings()};
});}
async function roi(p){return p.evaluate(()=>{
 const v=__IDENTITY_QA__.viewer(),rails=__IDENTITY_QA__.model().lipStructure.rails,g=v.geometry,R=g.attributes.fRest,T=g.attributes.csType,P=g.attributes.position,V3=v.camera.position.constructor,a=new V3();
 v.scene.updateMatrixWorld(true);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,count=0;
 for(let i=0;i<R.count;i++){
  if(!rails.sample([R.getX(i),R.getY(i),R.getZ(i)],T.getX(i)).roi)continue;
  a.set(P.getX(i),P.getY(i),P.getZ(i)).applyMatrix4(v.mesh.matrixWorld).project(v.camera);
  if(a.z< -1||a.z>1)continue;const x=(a.x*.5+.5)*900,y=(a.y*.5+.5)*720;
  x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);count++;
 }
 if(!count)throw Error('Native mouth landmarks produced no ROI');
 return{x0:Math.max(0,Math.floor(x0)-8),x1:Math.min(900,Math.ceil(x1)+8),y0:Math.max(0,Math.floor(y0)-8),y1:Math.min(720,Math.ceil(y1)+8),vertexCount:count,source:'independent frozen native LipRails ROI projected from existing geometry',paddingPixels:8,yOrigin:'bottom'};
});}
function difference(a,b,r){
 assert.equal(a.width,b.width);assert.equal(a.height,b.height);let changedInside=0,changedOutside=0,outsideMax=0,insideMax=0;
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
  const i=(y*a.width+x)*4,d=Math.max(Math.abs(a.bytes[i]-b.bytes[i]),Math.abs(a.bytes[i+1]-b.bytes[i+1]),Math.abs(a.bytes[i+2]-b.bytes[i+2]));
  if(!r||(x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1)){insideMax=Math.max(insideMax,d);if(d)changedInside++;}else{outsideMax=Math.max(outsideMax,d);if(d)changedOutside++;}
 }
 return{changedInside,changedOutside,outsideMax,insideMax,threshold:'exact RGB equality outside independent native mouth ROI'};
}
async function programs(p){return p.evaluate(()=>{
 const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext();v.render();gl.finish();const ext=gl.getExtension('WEBGL_debug_renderer_info');
 return{linked:v.renderer.info.programs.map(x=>({id:x.id,linked:!!gl.getProgramParameter(x.program,gl.LINK_STATUS),log:gl.getProgramInfoLog(x.program)})),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),error:gl.getError(),drawCalls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles};
});}
async function candidateChecks(base,p){
 q.initialReport=await p.evaluate(()=>lipRealism.report());const settings=await p.evaluate(()=>lipRealism.settings());
 assert.equal(settings.enabled,true,'New treatment must be enabled at startup');const original=await fingerprint(p);
 await test('fixed R07 and disabled candidate preserve geometry and exact pixels',async()=>{
  assert.deepEqual(original,await fingerprint(base),'Native geometry differs from frozen R07');const result=[];
  for(const kind of['front','macro']){
   await view(base,kind);await view(p,kind);await p.evaluate(()=>lipRealism.set({enabled:false,diagnostic:0}));
   assert.deepEqual(await state(p),await state(base),'A/B camera skin or lights differ');
   const a=await frame(base,'baseline-'+kind),b=await frame(p,'candidate-disabled-'+kind);
   assert.equal(a.hash,b.hash,'Disabled module does not recover exact R07 '+kind);result.push({kind,baseline:small(a),disabled:small(b)});
  }return result;
 });
 await test('lip pixels change with exact outside-mouth identity and reversible toggle',async()=>{
  const result=[];for(const kind of['front','macro','oblique']){
   await view(p,kind);await p.evaluate(()=>lipRealism.set({enabled:false,diagnostic:0}));
   const protectedState=await state(p),a=await frame(p,'before-'+kind),r=await roi(p);
   await p.evaluate(s=>lipRealism.set({...s,enabled:true,diagnostic:0}),settings);
   const b=await frame(p,'candidate-'+kind),delta=difference(a,b,r);
   assert(delta.changedInside>10,'No visible lip delta in '+kind);
   assert.equal(delta.changedOutside,0,'Lip changes escaped mouth ROI in '+kind+': '+JSON.stringify(delta));
   assert.deepEqual(await state(p),protectedState,'Lip controls changed camera lighting or body skin');
   assert.deepEqual(await fingerprint(p),original,'Surface controls changed geometry or binding');
   await p.evaluate(()=>lipRealism.set({enabled:false}));assert.equal((await frame(p)).hash,a.hash,'Disabled return is not exact');
   result.push({kind,roi:r,delta,before:small(a),after:small(b)});
  }return result;
 });
 await p.evaluate(s=>lipRealism.set(s),settings);await view(p,'macro');
 await test('mask colour roughness and normal diagnostics reach the framebuffer',async()=>{
  const beauty=await frame(p),result=[];
  for(const[d,name]of[[1,'mask'],[2,'colour'],[3,'roughness'],[4,'normals']]){
   await p.evaluate(diagnostic=>lipRealism.set({diagnostic}),d);result.push({diagnostic:d,name,...small(await frame(p,'diagnostic-'+name))});
  }
  assert.equal(new Set(result.map(x=>x.sha256)).size,4,'Diagnostics produced identical images');
  await p.evaluate(()=>lipRealism.set({diagnostic:0}));assert.equal((await frame(p)).hash,beauty.hash);return result;
 });
 await test('lip controls affect real pixels while geometry and original skin stay fixed',async()=>{
  const result=[],protectedState=await state(p);
  for(const key of['redness','pigment','upperDifference','variation','edgeSoftness','wetness','roughness','foldStrength','seed']){
   const diagnostic=['wetness','roughness'].includes(key)?3:key==='foldStrength'?4:2,low=key==='seed'?137:key==='roughness'?.34:.15,high=key==='seed'?947:key==='roughness'?.72:.85;
   await p.evaluate(({settings,key,low,diagnostic})=>lipRealism.set({...settings,enabled:true,diagnostic,[key]:low}),{settings,key,low,diagnostic});
   assert.equal(await p.evaluate(k=>lipRealism.settings()[k],key),low,key+' low value not applied');
   const a=await frame(p);await p.evaluate(({key,high})=>lipRealism.set({[key]:high}),{key,high});const b=await frame(p);
   const finalObserved=await p.evaluate(k=>lipRealism.settings()[k],key);assert.equal(finalObserved,high,key+' high value not applied');
   assert.notEqual(a.hash,b.hash,key+' has no framebuffer effect');
   result.push({key,requested:[low,high],finalObserved,diagnostic,changed:true});
  }
  await p.evaluate(s=>lipRealism.set(s),settings);assert.deepEqual(await state(p),protectedState);assert.deepEqual(await fingerprint(p),original);return result;
 });
 await test('existing portrait and skin-tone combinations retain the lip module',async()=>{
  const saved=await p.evaluate(()=>fullCommonWorkbench.archive());
  const choices=await p.evaluate(()=>portraitBank.presets().filter(x=>x.id!==portraitBank.selected()).slice(0,2).map(x=>({id:x.id,name:x.name})));
  assert.equal(choices.length,2,'Two native portraits required');const result=[];
  try{for(let i=0;i<choices.length;i++){
   const choice=choices[i],tone=i===0?.35:.85;
   await p.evaluate(async({id,tone,settings})=>{await portraitBank.apply(id);headProceduralSkin.set({tone});lipRealism.set({...settings,enabled:true,diagnostic:0});},{id:choice.id,tone,settings});
   await view(p,'macro');const geometry=await fingerprint(p),enabled=await frame(p,'preset-'+(i+1)+'-lips');
   await p.evaluate(()=>lipRealism.set({enabled:false}));const disabled=await frame(p),r=await roi(p),delta=difference(disabled,enabled,r);
   assert(delta.changedInside>10&&delta.changedOutside===0,'Preset lip treatment or domain failed');
   assert.deepEqual(await fingerprint(p),geometry);result.push({...choice,tone,geometry,roi:r,delta,report:await p.evaluate(()=>lipRealism.report())});
  }}finally{await p.evaluate(async({saved,settings})=>{await fullCommonWorkbench.restore(saved);lipRealism.set(settings);},{saved,settings});}
  await view(p,'macro');assert.deepEqual(await fingerprint(p),original,'Portrait archive did not restore original geometry');return result;
 });
 await test('same-machine frame-time comparison stays within bounded regression budget',async()=>{
  await p.evaluate(s=>lipRealism.set({...s,enabled:true,diagnostic:0}),settings);
  await view(base,'macro');await view(p,'macro');
  const samples={baseline:[],candidate:[]};
  for(const [label,target]of[['baseline',base],['candidate',p],['candidate',p],['baseline',base]]){
   const values=await target.evaluate(()=>{
    const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext(),values=[];
    for(let i=0;i<2;i++){v.render();gl.finish();}
    for(let i=0;i<6;i++){const t=performance.now();v.render();gl.finish();values.push(performance.now()-t);}
    return values;
   });samples[label].push(...values);
  }
  const stats=a=>{const b=a.slice().sort((x,y)=>x-y);return{count:b.length,medianMS:(b[5]+b[6])/2,p95MS:b[Math.ceil(b.length*.95)-1],minMS:b[0],maxMS:b.at(-1)};};
  const r={method:'interleaved fixed-R07 / candidate / candidate / fixed-R07; render plus gl.finish; SwiftShader; not hardware or interactive FPS',baseline:stats(samples.baseline),candidate:stats(samples.candidate),samples};
  r.medianRatio=r.candidate.medianMS/Math.max(.01,r.baseline.medianMS);r.limit={medianRatio:1.35,absoluteAllowanceMS:.5};
  assert(r.candidate.medianMS<=r.baseline.medianMS*1.35+.5,'Lip shader exceeds 35% + 0.5 ms synchronous frame-time budget');return r;
 });
 await p.evaluate(s=>lipRealism.set(s),settings);
 await test('view API changes the real camera and keeps current lighting intact',async()=>{
  const before=await state(p),result=[];for(const kind of['front','macro','oblique','bust']){
   await p.evaluate(kind=>lipRealism.view(kind),kind);const after=await state(p);
   assert.deepEqual(after.lights,before.lights,'View changed lights: '+kind);assert.equal(after.exposure,before.exposure);result.push({kind,camera:after.camera});
  }assert.equal(new Set(result.map(x=>JSON.stringify(x.camera))).size,4,'View API lacks four distinct cameras');return result;
 });
}
async function publicChecks(p){
 assert(process.env.LIP_PUBLIC_RAW_URL,'Public QA requires exact raw preview URL');
 const r=await context.request.get(process.env.LIP_PUBLIC_RAW_URL,{timeout:90000});assert.equal(r.status(),200);
 const bytes=await r.body();assert(bytes.includes(Buffer.from(VERSION)),'Public version absent');
 if(process.env.LIP_EXPECTED_PREVIEW_SHA256)assert.equal(sha(bytes),process.env.LIP_EXPECTED_PREVIEW_SHA256,'Public bytes differ from tested build');
 q.publicReadback={url:process.env.LIP_PUBLIC_RAW_URL,httpStatus:r.status(),bytes:bytes.length,sha256:sha(bytes)};q.previewSHA256=sha(bytes);
 await screenshot(p,'public-native-desktop');
 await test('fixed public candidate starts and a real lip control changes then restores pixels',async()=>{
  const saved=await p.evaluate(()=>lipRealism.settings()),geometry=await fingerprint(p);
  await view(p,'macro');const a=await frame(p,'public-lips');await p.evaluate(()=>lipRealism.set({enabled:false}));const b=await frame(p,'public-baseline-toggle');
  assert.notEqual(a.hash,b.hash);await p.evaluate(s=>lipRealism.set(s),saved);assert.equal((await frame(p)).hash,a.hash);assert.deepEqual(await fingerprint(p),geometry);
  return{before:small(a),disabled:small(b),report:await p.evaluate(()=>lipRealism.report())};
 });
 await p.setViewportSize({width:390,height:844});
 await test('390x844 browser viewport remains usable without claiming physical phone certification',async()=>{
  await p.evaluate(()=>lipRealism.view('front'));
  const r=await p.evaluate(()=>({viewport:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth,ready:lipRealism.ready,controls:document.querySelectorAll('input[type=range]').length,canvas:{width:__IDENTITY_QA__.viewer().renderer.domElement.clientWidth,height:__IDENTITY_QA__.viewer().renderer.domElement.clientHeight}}));
  assert(r.ready&&r.controls>0&&r.canvas.width>100&&r.canvas.height>100);assert(r.scrollWidth<=r.viewport[0]+2,'Mobile horizontal overflow');
  await screenshot(p,'public-mobile-viewport');return{...r,physicalPhone:false};
 });q.publicHttpsPassed=true;
}
(async()=>{try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
 if(MODE==='public'){
  assert(/^https:\/\//.test(process.env.LIP_PUBLIC_URL||''),'Public QA needs HTTPS URL');
  page=await load(process.env.LIP_PUBLIC_URL,'publicCandidate',true);await publicChecks(page);
 }else{
  const origin=await serve(),base=await load(origin+'/baseline.html','fixedBaseline',false);page=base;
  if(MODE==='baseline')await test('frozen R07 renders baseline front and lip macro',async()=>{
   const geometry=await fingerprint(base),views=[];
   for(const kind of['front','macro']){const camera=await view(base,kind),f=await frame(base,'BASELINE-R07-'+kind);views.push({camera,...small(f)});}
   return{geometry,views,originalSkin:await state(base),role:'BASELINE_ONLY',noNewLipArtifact:true};
  });
  else{page=await load(origin+'/candidate.html','localCandidate',true);await screenshot(page,'candidate-native-desktop');await candidateChecks(base,page);}
 }
 await test('all actual GPU programs link with zero shader and browser errors',async()=>{
  const result=[];for(const p of pages){const gpu=await programs(p);assert(gpu.linked.length&&gpu.linked.every(x=>x.linked),'Unlinked GPU program');assert.equal(gpu.error,0);result.push(gpu);}
  for(const k of['errors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[k].length,0,JSON.stringify(q[k]));return result;
 });
 q.interactive3D=true;q.completed=true;q.shareAllowed=MODE==='public';
}catch(e){
 q.completed=false;q.failure=String(e);q.shareAllowed=false;process.exitCode=1;console.error(String(e));
 try{if(page){await screenshot(page,'failure');save('failure-state.json',await page.evaluate(()=>({head:window.__HEAD_PROC__,lip:window.lipRealism?.report?.(),loader:window.__LIP_P3__,loadStatus:document.querySelector('#load-status')?.textContent})));}}catch(e){q.failureCaptureError=String(e);}
}finally{
 q.finishedAt=new Date().toISOString();save('qa.json',q);
 console.log(JSON.stringify({version:VERSION,mode:MODE,completed:q.completed,tests:q.tests.length,passed:q.tests.filter(x=>x.passed).length,output:out,failure:q.failure||null}));
 await browser?.close();if(server)await new Promise(r=>server.close(r));
}})();

