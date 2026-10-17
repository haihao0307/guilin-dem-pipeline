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
let browser,context,page,server;const pages=new Set(),activeStages=[];let progressSequence=0;
function save(name,value){const target=path.join(out,name),temporary=target+'.tmp';fs.writeFileSync(temporary,JSON.stringify(value,null,2)+'\n');fs.renameSync(temporary,target);}
function checkpoint(){q.updatedAt=new Date().toISOString();q.activeStages=activeStages.map(x=>({...x}));save('qa.partial.json',q);}
function progress(name,event,extra={}){
 const record={sequence:++progressSequence,at:new Date().toISOString(),name,event,...extra};
 fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(record)+'\n');q.lastProgress=record;checkpoint();console.log('STAGE '+event+' '+name+(extra.elapsedMS===undefined?'':' '+extra.elapsedMS+' ms'));
}
async function stage(name,fn){
 const current={name,startedAt:new Date().toISOString()},started=Date.now();activeStages.push(current);progress(name,'start');
 try{const result=await fn();progress(name,'end',{elapsedMS:Date.now()-started});return result;}
 catch(e){progress(name,'failure',{elapsedMS:Date.now()-started,error:String(e)});throw e;}
 finally{activeStages.splice(activeStages.indexOf(current),1);checkpoint();}
}
async function bounded(name,fn,timeoutMS){
 let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(name+' exceeded '+timeoutMS+' ms; pending browser work is not treated as completed')),timeoutMS);})]);}finally{clearTimeout(timer);}
}
async function test(name,fn){return stage(name,async()=>{const started=Date.now();try{const result=await fn();assert.notEqual(result,false);q.tests.push({name,passed:true,elapsedMS:Date.now()-started,result});checkpoint();console.log('PASS '+name);return result;}catch(e){q.tests.push({name,passed:false,elapsedMS:Date.now()-started,error:String(e)});checkpoint();throw e;}});}
for(const[signal,code]of[['SIGTERM',143],['SIGINT',130]])process.once(signal,()=>{
 q.completed=false;q.shareAllowed=false;q.failure='QA interrupted by '+signal;q.finishedAt=new Date().toISOString();q.termination={signal,exitCode:code};
 progress('process',signal);save('qa.json',q);process.exit(code);
});
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
 const evaluate=p.evaluate.bind(p);p.__lipQARawEvaluate=evaluate;p.evaluate=(...args)=>bounded(label+' page.evaluate',()=>evaluate(...args),180000);
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
async function screenshot(p,name,timeoutMS=120000){
 const b=await bounded('screenshot '+name,async()=>{
  await p.evaluate(()=>__IDENTITY_QA__.viewer().render());const cdp=await context.newCDPSession(p);
  try{const a=await cdp.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});return Buffer.from(a.data,'base64');}
  finally{await bounded('detach screenshot session',()=>cdp.detach(),5000).catch(()=>{});}
 },timeoutMS);
 fs.writeFileSync(path.join(out,name+'.png'),b);q.screenshots.push({name,kind:'native-browser-viewport',bytes:b.length,sha256:sha(b)});checkpoint();
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
async function calibration(p){return p.evaluate(async()=>{
 const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),g=v.currentLip?.geometry,item=m.lipStructure.mother.surfaces.get(g);
 if(!g||!item||item.topology.geometry!==g)throw Error('Current native lip calibration instance is absent');
 const count=g.attributes.position.count;if(item.topology.count!==count)throw Error('Native calibration topology count mismatch');
 if(new Uint8Array(new Uint32Array([0x01020304]).buffer)[0]!==4)throw Error('This byte-exact QA requires the declared little-endian Chromium host');
 const field=async a=>{
  if(a===null)return null;
  if(!(a instanceof Float32Array)||a.length!==count)throw Error('Native calibration must match the native lip geometry vertex count');
  for(const x of a)if(!Number.isFinite(x)||x<0)throw Error('Native calibration contains an invalid reference length');
  const bytes=new Uint8Array(a.buffer,a.byteOffset,a.byteLength),digest=await crypto.subtle.digest('SHA-256',bytes);
  return{sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),byteLength:a.byteLength,length:a.length};
 };
 return{schema:'kaopu/lip-calibration@1',byteOrder:'float32-le',count,lastKey:item.lastKey,reference:await field(item.reference),referenceHorizontal:await field(item.referenceHorizontal)};
});}
function serializedCalibration(saved){
 const c=saved?.lipRealism?.calibration;assert(c&&typeof c==='object','Full lip archive lacks native calibration');
 assert.equal(c.schema,'kaopu/lip-calibration@1');assert.equal(c.byteOrder,'float32-le');assert(Number.isSafeInteger(c.count)&&c.count>0,'Archived native calibration count is invalid');
 assert.equal(typeof c.lastKey,'string','Archived native calibration identity key is absent');
 const field=value=>{
  if(value===null)return null;assert.equal(typeof value,'string','Archived calibration must contain base64 Float32 bytes or null');
  const b=Buffer.from(value,'base64');assert.equal(b.toString('base64'),value,'Archived calibration is not canonical base64');assert.equal(b.length,c.count*4,'Archived calibration byte length differs from its native count');
  for(let i=0;i<b.length;i+=4){const x=b.readFloatLE(i);assert(Number.isFinite(x)&&x>=0,'Archived calibration contains an invalid reference length');}
  return{sha256:sha(b),byteLength:b.length,length:b.length/4};
 };
 return{schema:c.schema,byteOrder:c.byteOrder,count:c.count,lastKey:c.lastKey,reference:field(c.reference),referenceHorizontal:field(c.referenceHorizontal)};
}
async function restoreArchive(p,saved,name){return stage(name,()=>bounded(name,()=>p.__lipQARawEvaluate(async archive=>{await fullCommonWorkbench.restore(archive);},saved),300000));}
async function captureReliefBase(p){
 const hashes=await fingerprint(p),domain=await p.evaluate(()=>{
  const g=__IDENTITY_QA__.viewer().geometry,a=g.attributes,red=new Float32Array(a.position.count);
  if(!a.l19State||a.l19State.count!==red.length)throw Error('Native l19State lip domain absent');
  let redVertices=0;for(let i=0;i<red.length;i++){red[i]=a.l19State.getZ(i);if(red[i]>0)redVertices++;}
  window.__LIP_QA_RELIEF_BASE__={position:a.position.array.slice(),normal:a.normal.array.slice(),index:g.index.array.slice(),red};
  return{source:'native l19State.z (LipRegionTopology q.red), captured before toggle',redVertices};
 });
 return{hashes,domain};
}
async function checkReliefBounds(p,before,name){
 const after=await fingerprint(p),invariants={};
 for(const key of['index','canonicalPositions','canonicalFaces','vertices','triangles'])invariants[key]=before.hashes[key]===after[key];
 for(const key of['csRest','fRest','skinIndex','skinWeight'])invariants[key]=before.hashes.attributes[key]===after.attributes[key];
 const delta=await p.evaluate(()=>{
  const b=window.__LIP_QA_RELIEF_BASE__,g=__IDENTITY_QA__.viewer().geometry,a=g.attributes,P=a.position.array,N=a.normal.array;
  if(!b||P.length!==b.position.length||N.length!==b.normal.length||a.l19State.count!==b.red.length)return{compatibleBuffers:false};
  const changed=new Uint8Array(b.red.length),allowedNormals=new Uint8Array(b.red.length),badPositions=[],badNormals=[];
  let changedPositionVertices=0,changedNormalVertices=0,positionOutsideRed=0,normalOutsideOneRing=0,maxDisplacementMicrons=0,redMaskChanges=0,nonFiniteValues=0;
  for(let i=0;i<b.red.length;i++){
   const j=i*3;if(a.l19State.getZ(i)!==b.red[i])redMaskChanges++;
   if(![P[j],P[j+1],P[j+2],N[j],N[j+1],N[j+2]].every(Number.isFinite))nonFiniteValues++;
   if(P[j]!==b.position[j]||P[j+1]!==b.position[j+1]||P[j+2]!==b.position[j+2]){
    changed[i]=1;changedPositionVertices++;const microns=Math.hypot(P[j]-b.position[j],P[j+1]-b.position[j+1],P[j+2]-b.position[j+2])*1e6;maxDisplacementMicrons=Math.max(maxDisplacementMicrons,microns);
    if(!(b.red[i]>0)){positionOutsideRed++;if(badPositions.length<32)badPositions.push({vertex:i,microns,red:b.red[i]});}
   }
  }
  allowedNormals.set(changed);for(let k=0;k<b.index.length;k+=3){const x=b.index[k],y=b.index[k+1],z=b.index[k+2];if(changed[x]||changed[y]||changed[z])allowedNormals[x]=allowedNormals[y]=allowedNormals[z]=1;}
  for(let i=0;i<b.red.length;i++){
   const j=i*3;if(N[j]!==b.normal[j]||N[j+1]!==b.normal[j+1]||N[j+2]!==b.normal[j+2]){
    changedNormalVertices++;if(!allowedNormals[i]){normalOutsideOneRing++;if(badNormals.length<32)badNormals.push({vertex:i,red:b.red[i]});}
   }
  }
  return{compatibleBuffers:true,changedPositionVertices,changedNormalVertices,positionOutsideRed,normalOutsideOneRing,maxDisplacementMicrons,redMaskChanges,nonFiniteValues,badPositions,badNormals};
 });
 const result={domain:before.domain,invariants,delta,maxAllowedDisplacementMicrons:100,normalDomain:'changed position vertices plus vertices sharing one indexed triangle',before:before.hashes,after};
 save('geometry-'+name+'.json',result);
 assert(Object.values(invariants).every(Boolean),'Lip relief changed protected geometry or binding: '+JSON.stringify(invariants));
 assert(delta.compatibleBuffers,'Display geometry buffer layout changed');assert.equal(delta.nonFiniteValues,0,'Nonfinite display geometry');assert.equal(delta.redMaskChanges,0,'Native red domain changed');
 assert.equal(delta.positionOutsideRed,0,'Display positions changed outside the native lip-red domain');assert.equal(delta.normalOutsideOneRing,0,'Normals changed outside the topology one-ring of moved lip vertices');
 assert(delta.maxDisplacementMicrons<=100,'Display lip relief delta exceeds 100 micrometres');return result;
}
async function state(p){return p.evaluate(()=>{
 const v=__IDENTITY_QA__.viewer();v.scene.updateMatrixWorld(true);const lights=[];
 v.scene.traverse(o=>{if(!o.isLight)return;let visible=true;for(let x=o;x;x=x.parent)visible=visible&&x.visible;lights.push({type:o.type,name:o.name,color:o.color.toArray(),ground:o.groundColor?.toArray(),intensity:o.intensity,matrix:o.matrixWorld.toArray(),visible,target:o.target?.matrixWorld.toArray()});});
 return{camera:{position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),target:v.orbit.target.toArray(),projection:v.camera.projectionMatrix.toArray()},lights,exposure:v.renderer.toneMappingExposure,toneMapping:v.renderer.toneMapping,outputColorSpace:v.renderer.outputColorSpace,skin:headProceduralSkin.settings(),body:bodyProceduralSkin.settings(),nativeLipDNA:lipWorkbench.dna(),nativeLipShape:lipWorkbench.settings(),nativeLipPose:lipWorkbench.pose()};
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
 const outsideExamples=[],outsideBounds={x0:Infinity,x1:-Infinity,y0:Infinity,y1:-Infinity};
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
  const i=(y*a.width+x)*4,d=Math.max(Math.abs(a.bytes[i]-b.bytes[i]),Math.abs(a.bytes[i+1]-b.bytes[i+1]),Math.abs(a.bytes[i+2]-b.bytes[i+2]));
  if(!r||(x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1)){insideMax=Math.max(insideMax,d);if(d)changedInside++;}else{
   outsideMax=Math.max(outsideMax,d);if(d){
    changedOutside++;outsideBounds.x0=Math.min(outsideBounds.x0,x);outsideBounds.x1=Math.max(outsideBounds.x1,x);outsideBounds.y0=Math.min(outsideBounds.y0,y);outsideBounds.y1=Math.max(outsideBounds.y1,y);
    if(outsideExamples.length<128)outsideExamples.push({x,yBottom:y,yTop:a.height-1-y,beforeRGB:[...a.bytes.subarray(i,i+3)],afterRGB:[...b.bytes.subarray(i,i+3)],maxDelta:d});
   }
  }
 }
 return{changedInside,changedOutside,outsideMax,insideMax,outsideBounds:changedOutside?outsideBounds:null,outsideExamples,examplesTruncated:changedOutside>outsideExamples.length,threshold:'exact RGB equality outside independent native mouth ROI'};
}
async function programs(p){return p.evaluate(()=>{
 const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext();v.render();gl.finish();const ext=gl.getExtension('WEBGL_debug_renderer_info');
 return{linked:v.renderer.info.programs.map(x=>({id:x.id,linked:!!gl.getProgramParameter(x.program,gl.LINK_STATUS),log:gl.getProgramInfoLog(x.program)})),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),vendor:gl.getParameter(gl.VENDOR),error:gl.getError(),drawCalls:v.renderer.info.render.calls,triangles:v.renderer.info.render.triangles};
});}
async function candidateChecks(base,p){
 q.initialReport=await p.evaluate(()=>lipRealism.report());q.initialCalibration=await calibration(p);checkpoint();const settings=await p.evaluate(()=>lipRealism.settings());
 assert.equal(settings.enabled,true,'New treatment must be enabled at startup');const original=await fingerprint(base),enabledOriginal=await fingerprint(p);
 await test('fixed R07 and disabled candidate preserve geometry and exact pixels',async()=>{
  const result=[];
  for(const kind of['front','macro']){
   progress('frozen R07 comparison '+kind,'start');
   await p.evaluate(()=>lipRealism.set({enabled:false,diagnostic:0}));await view(base,kind);await view(p,kind);
   assert.deepEqual(await fingerprint(p),original,'Disabled geometry differs from frozen R07 '+kind);
   assert.deepEqual(await state(p),await state(base),'A/B camera skin or lights differ');
   const a=await frame(base,'baseline-'+kind),b=await frame(p,'candidate-disabled-'+kind);
   assert.equal(a.hash,b.hash,'Disabled module does not recover exact R07 '+kind);result.push({kind,baseline:small(a),disabled:small(b)});progress('frozen R07 comparison '+kind,'end');
  }return result;
 });
 await test('lip pixels change with exact outside-mouth identity and reversible toggle',async()=>{
  const result=[];for(const kind of['front','macro','oblique']){
   progress('lip toggle '+kind,'start');
   await p.evaluate(()=>lipRealism.set({enabled:false,diagnostic:0}));await view(p,kind);
   const protectedState=await state(p),geometry=await captureReliefBase(p),a=await frame(p,'before-'+kind),r=await roi(p);
   await p.evaluate(s=>lipRealism.set({...s,enabled:true,diagnostic:0}),settings);
   const b=await frame(p,'candidate-'+kind),delta=difference(a,b,r);
   save('domain-'+kind+'.json',{kind,roi:r,delta,before:small(a),after:small(b)});
   const geometryCheck=await checkReliefBounds(p,geometry,kind);assert(geometryCheck.delta.changedPositionVertices>0,'Enabled lip treatment did not change native relief');
   assert(delta.changedInside>10,'No visible lip delta in '+kind);
   assert.equal(delta.changedOutside,0,'Lip changes escaped mouth ROI in '+kind+': '+JSON.stringify(delta));
   assert.deepEqual(await state(p),protectedState,'Lip controls changed camera lighting or body skin');
   await p.evaluate(()=>lipRealism.set({enabled:false}));assert.equal((await frame(p)).hash,a.hash,'Disabled return is not exact');
   assert.deepEqual(await fingerprint(p),geometry.hashes,'Disabled toggle did not restore exact geometry');
   result.push({kind,roi:r,delta,geometryCheck,before:small(a),after:small(b)});progress('lip toggle '+kind,'end');
  }return result;
 });
 await p.evaluate(s=>lipRealism.set(s),settings);await view(p,'macro');
 await test('mask colour roughness and normal diagnostics reach the framebuffer',async()=>{
  const beauty=await frame(p),geometry=await fingerprint(p),result=[];
  for(const[d,name]of[[1,'mask'],[2,'colour'],[3,'roughness'],[4,'normals']]){
   progress('diagnostic '+name,'start');
   await p.evaluate(diagnostic=>lipRealism.set({diagnostic}),d);result.push({diagnostic:d,name,...small(await frame(p,'diagnostic-'+name))});assert.deepEqual(await fingerprint(p),geometry,'Diagnostic changed display geometry');
   progress('diagnostic '+name,'end');
  }
  assert.equal(new Set(result.map(x=>x.sha256)).size,4,'Diagnostics produced identical images');
  await p.evaluate(()=>lipRealism.set({diagnostic:0}));assert.equal((await frame(p)).hash,beauty.hash);return result;
 });
 await test('lip controls affect real pixels while geometry and original skin stay fixed',async()=>{
  const result=[],protectedState=await state(p),geometry=await fingerprint(p);
  for(const key of['redness','pigment','upperDifference','variation','edgeSoftness','wetness','roughness','foldStrength','seed']){
   progress('control '+key,'start');
   const diagnostic=['wetness','roughness'].includes(key)?3:key==='foldStrength'?4:2,low=key==='seed'?137:key==='roughness'?.34:.15,high=key==='seed'?947:key==='roughness'?.72:.85;
   await p.evaluate(({settings,key,low,diagnostic})=>lipRealism.set({...settings,enabled:true,diagnostic,[key]:low}),{settings,key,low,diagnostic});
   assert.equal(await p.evaluate(k=>lipRealism.settings()[k],key),low,key+' low value not applied');
   const a=await frame(p);assert.deepEqual(await fingerprint(p),geometry,key+' low value changed geometry');await p.evaluate(({key,high})=>lipRealism.set({[key]:high}),{key,high});const b=await frame(p);assert.deepEqual(await fingerprint(p),geometry,key+' high value changed geometry');
   const finalObserved=await p.evaluate(k=>lipRealism.settings()[k],key);assert.equal(finalObserved,high,key+' high value not applied');
   assert.notEqual(a.hash,b.hash,key+' has no framebuffer effect');
   result.push({key,requested:[low,high],finalObserved,diagnostic,changed:true});progress('control '+key,'end');
  }
  await p.evaluate(s=>lipRealism.set(s),settings);assert.deepEqual(await state(p),protectedState);assert.deepEqual(await fingerprint(p),geometry);return result;
 });
 await test('native slider keyboard input changes settings and actual lip pixels',async()=>{
  await p.evaluate(s=>lipRealism.set({...s,enabled:true,diagnostic:0}),settings);await view(p,'macro');
  const protectedState=await state(p),geometry=await fingerprint(p),slider=p.locator('#lr-controls input[data-lr="redness"]');
  assert.equal(await slider.count(),1,'One visible lip redness range input is required');assert(await slider.isVisible(),'Lip slider is hidden');
  await slider.evaluate(el=>{el.__lipQAEvents=[];el.addEventListener('input',e=>el.__lipQAEvents.push({trusted:e.isTrusted,value:Number(el.value)}));});
  try{
   await slider.press('Home');const low=Number(await slider.inputValue());
   assert.equal(low,0,'Native Home key did not reach the slider minimum');assert.equal(await p.evaluate(()=>lipRealism.settings().redness),low);
   const a=await frame(p,'ui-slider-redness-low');
   await slider.press('End');const high=Number(await slider.inputValue());
   assert.equal(high,1,'Native End key did not reach the slider maximum');assert.equal(await p.evaluate(()=>lipRealism.settings().redness),high);
   const b=await frame(p,'ui-slider-redness-high'),r=await roi(p),delta=difference(a,b,r),events=await slider.evaluate(el=>el.__lipQAEvents);
   save('ui-slider-delta.json',{roi:r,delta,events,before:small(a),after:small(b)});
   assert(events.length>=2&&events.every(e=>e.trusted),'Expected browser-generated input events');
   assert(delta.changedInside>10&&delta.changedOutside===0,'Native slider did not change only the mouth pixels');
   assert.deepEqual(await state(p),protectedState,'UI slider changed camera, lighting, or original skin');assert.deepEqual(await fingerprint(p),geometry,'UI slider changed native geometry');
   return{method:'Playwright keyboard Home / End on the visible native range input',low,high,events,roi:r,delta,before:small(a),after:small(b)};
  }finally{await p.evaluate(s=>lipRealism.set(s),settings);}
 });
 await test('native jaw-open and pucker poses retain surface binding and restore the full person',async()=>{
  await view(p,'macro');await p.evaluate(()=>lipWorkbench.stop());
  const saved=await p.evaluate(()=>fullCommonWorkbench.archive()),savedPose=await p.evaluate(()=>lipWorkbench.pose()),geometryBefore=await fingerprint(p),imageBefore=await frame(p),result=[];
  try{
   for(const action of['speak','pucker']){
    progress('native pose '+action,'start');
    await p.evaluate(s=>lipRealism.set(s),settings);
    const pose=await p.evaluate(action=>lipWorkbench.perform(action),action);
    assert(pose.jawOpen>0,'Native '+action+' did not open the registered jaw');
    if(action==='pucker')assert(pose.pucker>.5,'Native pucker pose was not applied');
    assert.notEqual((await fingerprint(p)).attributes.position,geometryBefore.attributes.position,'Native '+action+' did not move actual vertices at the same enabled setting');
    await p.evaluate(s=>lipRealism.set({...s,enabled:false,diagnostic:0}),settings);await view(p,'macro');
    const geometry=await captureReliefBase(p),protectedState=await state(p),disabled=await frame(p,'pose-'+action+'-disabled'),r=await roi(p);
    await p.evaluate(()=>lipRealism.set({enabled:true}));const enabled=await frame(p,'pose-'+action+'-lips'),delta=difference(disabled,enabled,r);
    save('pose-'+action+'-delta.json',{action,pose,geometry,roi:r,delta,before:small(disabled),after:small(enabled)});
    const geometryCheck=await checkReliefBounds(p,geometry,'pose-'+action);
    assert(delta.changedInside>10&&delta.changedOutside===0,'Lip treatment lost its domain in native '+action);
    assert.deepEqual(await state(p),protectedState,'Lip toggle changed original state in '+action);
    const gpu=await programs(p);assert(gpu.linked.length&&gpu.linked.every(x=>x.linked),'Unlinked program in native '+action);assert.equal(gpu.error,0,'GPU error in native '+action);
    await p.evaluate(()=>lipRealism.set({enabled:false}));assert.equal((await frame(p)).hash,disabled.hash,'Disabled pose does not return exactly');
    assert.deepEqual(await fingerprint(p),geometry.hashes,'Disabled toggle did not restore exact '+action+' geometry');
    result.push({action,pose,geometryCheck,roi:r,delta,gpu,before:small(disabled),after:small(enabled)});progress('native pose '+action,'end');
   }
  }finally{await p.evaluate(async saved=>{lipWorkbench.stop();await fullCommonWorkbench.restore(saved);},saved);}
  await view(p,'macro');assert.deepEqual(await p.evaluate(()=>lipWorkbench.pose()),savedPose,'Archive did not restore native pose');
  assert.deepEqual(await p.evaluate(()=>lipRealism.settings()),settings,'Archive did not restore lip surface settings');
  assert.deepEqual(await fingerprint(p),geometryBefore,'Archive did not restore original geometry');assert.equal((await frame(p)).hash,imageBefore.hash,'Archive did not restore the same rendered person');
  return{poses:result,restoredNativePose:true,restoredGeometry:true,restoredPixels:true};
 });
 await test('existing portrait and skin-tone combinations retain the lip module',async()=>{
  const saved=await p.evaluate(()=>fullCommonWorkbench.archive()),savedGeometry=await fingerprint(p),savedCalibration=await calibration(p),savedFrame=await frame(p,'portrait-archive-saved'),savedState=await state(p),savedROI=await roi(p);
  save('portrait-saved-archive.json',saved);
  const archiveCalibration=serializedCalibration(saved),before={geometry:savedGeometry,calibration:savedCalibration,archiveCalibration,frame:small(savedFrame),state:savedState,roi:savedROI};
  save('portrait-archive-before.json',before);assert.deepEqual(archiveCalibration,savedCalibration,'Archive Float32 calibration bytes differ from the independent native instance');
  assert(savedCalibration.reference&&savedCalibration.referenceHorizontal,'Neutral portrait lacks native reference calibration');
  assert.deepEqual(savedGeometry,enabledOriginal,'Geometry drifted before the portrait archive was saved');
  const choices=await p.evaluate(()=>portraitBank.presets().filter(x=>x.id!==portraitBank.selected()).slice(0,2).map(x=>({id:x.id,name:x.name})));
  assert.equal(choices.length,2,'Two native portraits required');const result=[];let legacyResult;
  try{for(let i=0;i<choices.length;i++){
   const choice=choices[i],tone=i===0?.35:.85;
   await stage('apply native portrait '+choice.id,()=>p.evaluate(async({id,tone,settings})=>{await portraitBank.apply(id);headProceduralSkin.set({tone});lipRealism.set({...settings,enabled:false,diagnostic:0});},{id:choice.id,tone,settings}));
   await view(p,'macro');const geometry=await captureReliefBase(p),protectedState=await state(p),disabled=await frame(p,'preset-'+(i+1)+'-disabled'),r=await roi(p);
   await p.evaluate(()=>lipRealism.set({enabled:true}));const enabled=await frame(p,'preset-'+(i+1)+'-lips'),delta=difference(disabled,enabled,r);
   save('preset-'+(i+1)+'-delta.json',{...choice,tone,geometry,roi:r,delta,before:small(disabled),after:small(enabled)});
   const geometryCheck=await checkReliefBounds(p,geometry,'preset-'+(i+1));
   assert(delta.changedInside>10&&delta.changedOutside===0,'Preset lip treatment or domain failed');
   assert.deepEqual(await state(p),protectedState,'Portrait lip toggle changed native settings');
   await p.evaluate(()=>lipRealism.set({enabled:false}));assert.deepEqual(await fingerprint(p),geometry.hashes,'Portrait disabled geometry not restored');assert.equal((await frame(p)).hash,disabled.hash,'Portrait disabled pixels not restored');
   result.push({...choice,tone,geometryCheck,roi:r,delta,calibration:await calibration(p),report:await p.evaluate(()=>lipRealism.report())});save('portrait-preset-results.json',result);
  }
  await stage('reject mismatched calibration before changing the current portrait',async()=>{
   const bad=structuredClone(saved);bad.lipRealism.calibration.lastKey='wrong';
   const beforeBad={geometry:await fingerprint(p),calibration:await calibration(p),state:await state(p),settings:await p.evaluate(()=>lipRealism.settings())};
   const rejection=await p.evaluate(async archive=>{try{await fullCommonWorkbench.restore(archive);return{rejected:false};}catch(e){return{rejected:true,error:String(e)};}},bad);
   const afterBad={geometry:await fingerprint(p),calibration:await calibration(p),state:await state(p),settings:await p.evaluate(()=>lipRealism.settings())};
   save('portrait-archive-invalid-key.json',{method:'Archive of the saved original person with only calibration.lastKey changed to wrong, attempted while a different native portrait is active',rejection,before:beforeBad,after:afterBad});
   assert(rejection.rejected,'Mismatched calibration identity was accepted');assert.deepEqual(afterBad,beforeBad,'Rejected calibration archive changed the active portrait or native calibration');
  });
  const legacy=structuredClone(saved);delete legacy.lipRealism.calibration;
  await restoreArchive(p,legacy,'restore legacy archive without calibration');await view(p,'macro');
  const legacyGeometry=await fingerprint(p),legacyCalibration=await calibration(p),legacyFrame=await frame(p,'portrait-archive-legacy'),legacyState=await state(p);
  legacyResult={method:'Same saved person with only lipRealism.calibration removed; no requirement that the legacy path must differ',geometry:legacyGeometry,calibration:legacyCalibration,frame:small(legacyFrame),state:legacyState,geometryExact:JSON.stringify(legacyGeometry)===JSON.stringify(savedGeometry),calibrationExact:JSON.stringify(legacyCalibration)===JSON.stringify(savedCalibration),pixelsExact:legacyFrame.hash===savedFrame.hash,delta:difference(savedFrame,legacyFrame,savedROI)};
  save('portrait-archive-legacy.json',legacyResult);
  }finally{await restoreArchive(p,saved,'restore full archive with native calibration');}
  await view(p,'macro');const restoredGeometry=await fingerprint(p),restoredCalibration=await calibration(p),restoredFrame=await frame(p,'portrait-archive-restored'),restoredState=await state(p);
  const restored={geometry:restoredGeometry,calibration:restoredCalibration,frame:small(restoredFrame),state:restoredState,delta:difference(savedFrame,restoredFrame,savedROI)};
  save('portrait-archive-roundtrip.json',{before,legacy:legacyResult,restored});
  assert.deepEqual(restoredCalibration,savedCalibration,'Full archive did not restore exact native calibration bytes and identity key');
  assert.deepEqual(restoredGeometry,savedGeometry,'Full archive did not restore geometry at its save point');
  assert.equal(restoredFrame.hash,savedFrame.hash,'Full archive did not restore exact framebuffer pixels');
  assert.deepEqual(restoredState,savedState,'Full archive did not restore native settings, camera and lighting');
  assert.deepEqual(await p.evaluate(()=>lipRealism.settings()),settings,'Full archive did not restore lip treatment settings');
  assert.deepEqual(restoredGeometry,enabledOriginal,'Portrait archive did not restore original enabled geometry');
  return{presets:result,archive:{before,legacy:legacyResult,restored},restoredCalibration:true,restoredGeometry:true,restoredPixels:true};
 });
 await test('same-machine frame-time comparison stays within bounded regression budget',async()=>{
  await p.evaluate(s=>lipRealism.set({...s,enabled:true,diagnostic:0}),settings);
  const result=[],stats=a=>{const b=a.slice().sort((x,y)=>x-y),n=b.length;return{count:n,medianMS:(b[Math.floor((n-1)/2)]+b[Math.ceil((n-1)/2)])/2,p95MS:b[Math.ceil(n*.95)-1],minMS:b[0],maxMS:b.at(-1)};};
  for(const kind of['macro','bust']){
   progress('performance '+kind,'start');
   await view(base,kind);await view(p,kind);assert.deepEqual(await state(p),await state(base),'Performance A/B camera, lights, or skin differ in '+kind);
   const samples={baseline:[],candidate:[]};
   for(const [label,target]of[['baseline',base],['candidate',p],['candidate',p],['baseline',base]]){
    const values=await stage('performance block '+kind+' '+label,()=>target.evaluate(()=>{
     const v=__IDENTITY_QA__.viewer(),gl=v.renderer.getContext(),values=[];
     for(let i=0;i<2;i++){v.render();gl.finish();}
     for(let i=0;i<6;i++){const t=performance.now();v.render();gl.finish();values.push(performance.now()-t);}
     return values;
    }));samples[label].push(...values);
   }
   const r={view:kind,method:'interleaved fixed-R07 / candidate / candidate / fixed-R07; render plus gl.finish; SwiftShader; not hardware or interactive FPS',baseline:stats(samples.baseline),candidate:stats(samples.candidate),samples};
   r.medianRatio=r.candidate.medianMS/Math.max(.01,r.baseline.medianMS);r.limit={medianRatio:1.35,absoluteAllowanceMS:.5};
   r.passed=r.candidate.medianMS<=r.baseline.medianMS*1.35+.5;result.push(r);save('performance.json',result);progress('performance '+kind,'end');
  }
  assert(result.every(r=>r.passed),'Lip shader exceeds 35% + 0.5 ms synchronous frame-time budget: '+JSON.stringify(result.map(({view,medianRatio,passed})=>({view,medianRatio,passed}))));return result;
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
  const saved=await p.evaluate(()=>lipRealism.settings());await view(p,'macro');
  const geometry=await captureReliefBase(p),protectedState=await state(p),r=await roi(p),a=await frame(p,'public-lips');
  await p.evaluate(()=>lipRealism.set({enabled:false}));const b=await frame(p,'public-baseline-toggle'),delta=difference(a,b,r);
  save('public-toggle-delta.json',{roi:r,delta,before:small(a),after:small(b)});const geometryCheck=await checkReliefBounds(p,geometry,'public-toggle');
  assert(delta.changedInside>10&&delta.changedOutside===0,'Public lip toggle changed pixels outside the native mouth ROI');assert.deepEqual(await state(p),protectedState,'Public toggle changed native settings');
  await p.evaluate(s=>lipRealism.set(s),saved);assert.equal((await frame(p)).hash,a.hash);assert.deepEqual(await fingerprint(p),geometry.hashes,'Public toggle did not restore exact display geometry');
  return{before:small(a),disabled:small(b),roi:r,delta,geometryCheck,report:await p.evaluate(()=>lipRealism.report())};
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
 progress('process','start',{mode:MODE});
 browser=await stage('launch Chromium SwiftShader',()=>chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}));
 context=await browser.newContext({viewport:{width:1440,height:960},deviceScaleFactor:1});
 if(MODE==='public'){
  assert(/^https:\/\//.test(process.env.LIP_PUBLIC_URL||''),'Public QA needs HTTPS URL');
  page=await stage('load fixed public candidate',()=>load(process.env.LIP_PUBLIC_URL,'publicCandidate',true));await publicChecks(page);
 }else{
  const origin=await stage('start isolated QA server',serve),base=await stage('load frozen R07 baseline',()=>load(origin+'/baseline.html','fixedBaseline',false));page=base;
  if(MODE==='baseline')await test('frozen R07 renders baseline front and lip macro',async()=>{
   const geometry=await fingerprint(base),views=[];
   for(const kind of['front','macro']){const camera=await view(base,kind),f=await frame(base,'BASELINE-R07-'+kind);views.push({camera,...small(f)});}
   return{geometry,views,originalSkin:await state(base),role:'BASELINE_ONLY',noNewLipArtifact:true};
  });
  else{page=await stage('load local candidate',()=>load(origin+'/candidate.html','localCandidate',true));await stage('capture initial native candidate viewport',()=>screenshot(page,'candidate-native-desktop'));await candidateChecks(base,page);}
 }
 await test('all actual GPU programs link with zero shader and browser errors',async()=>{
  const result=[];for(const p of pages){const gpu=await programs(p);assert(gpu.linked.length&&gpu.linked.every(x=>x.linked),'Unlinked GPU program');assert.equal(gpu.error,0);result.push(gpu);}
  for(const k of['errors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[k].length,0,JSON.stringify(q[k]));return result;
 });
 q.interactive3D=true;q.completed=true;q.shareAllowed=MODE==='public';
}catch(e){
 q.completed=false;q.failure=String(e);q.shareAllowed=false;process.exitCode=1;console.error(String(e));
 checkpoint();save('qa.json',q);
 if(page){
  try{await stage('capture failure viewport with 30 second limit',()=>screenshot(page,'failure',30000));}catch(e){q.failureCaptureError=String(e);checkpoint();save('qa.json',q);}
  try{save('failure-state.json',await bounded('failure state readback',()=>page.evaluate(()=>({head:window.__HEAD_PROC__,lip:window.lipRealism?.report?.(),loader:window.__LIP_P3__,loadStatus:document.querySelector('#load-status')?.textContent})),10000));}catch(e){q.failureStateError=String(e);checkpoint();save('qa.json',q);}
 }
}finally{
 q.finishedAt=new Date().toISOString();save('qa.json',q);
 let cleanupFailed=false;
 try{if(browser)await bounded('close Chromium',()=>browser.close(),10000);}catch(e){cleanupFailed=true;q.cleanupError=String(e);}
 try{if(server)await bounded('close QA server',()=>new Promise(r=>server.close(r)),5000);}catch(e){cleanupFailed=true;q.serverCloseError=String(e);}
 if(cleanupFailed){q.completed=false;q.shareAllowed=false;process.exitCode=1;}
 progress('process','end',{completed:q.completed});save('qa.json',q);
 console.log(JSON.stringify({version:VERSION,mode:MODE,completed:q.completed,tests:q.tests.length,passed:q.tests.filter(x=>x.passed).length,output:out,failure:q.failure||null}));
 if(cleanupFailed)process.exit(1);
}})();

