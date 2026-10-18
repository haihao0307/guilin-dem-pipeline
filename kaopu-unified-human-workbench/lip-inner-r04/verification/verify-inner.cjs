'use strict';
/* Public, bounded R04 verification. Twelve saved native GPU images, one fresh
 * restore readback; no image replacement, shader emulation or ancestor re-test.
 */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const VERSION='LIP-INNER-R04',BASE_SOURCE='01cfde47476b7be6764e9c6a79d925462511539b',BASE_BUILD='ba0c4eb337e03997878aecaf477d8ec3fe8b7231';
const BASE_HASH='ccc7af8e97969667bf63ab8bbc61e845d95e7b5e7f70adb167a662a63c0cb571';
const ROOT='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/';
const BASE_RAW=ROOT+BASE_BUILD+'/kaopu-unified-human-workbench/lip-realism-r02/preview.html';
const BASE_URL='https://htmlpreview.github.io/?'+BASE_RAW;
const PUBLIC_URL=process.env.PUBLIC_URL||process.env.CANDIDATE_URL;
const SOURCE=process.env.SOURCE_SHA,BUILD=process.env.BUILD_SHA;
assert(!process.env.MODE||process.env.MODE==='public','This suite verifies the fixed public R04 build');
assert(/^[a-f0-9]{40}$/.test(SOURCE||''),'SOURCE_SHA required');assert(/^[a-f0-9]{40}$/.test(BUILD||''),'BUILD_SHA required');
const RAW=ROOT+BUILD+'/kaopu-unified-human-workbench/lip-inner-r04/preview.html';
assert.equal(PUBLIC_URL,'https://htmlpreview.github.io/?'+RAW,'Public URL must name the exact immutable R04 build');
const scope=path.resolve(__dirname,'..'),previewPath=process.env.CANDIDATE_PATH||path.join(scope,'preview.html');
const manifestPath=process.env.BUILD_MANIFEST_PATH||path.join(scope,'BUILD_MANIFEST.json');
const out=path.resolve(process.env.QA_OUT||path.join(scope,'evidence','public'));
const width=640,height=512,budgetMS=Number(process.env.QA_BUDGET_MS||900000);
assert(Number.isFinite(budgetMS)&&budgetMS>=120000&&budgetMS<=1440000,'Invalid bounded deadline');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.mkdirSync(out,{recursive:true});
const q={schema:'kaopu/lip-inner-public-qa@1',version:VERSION,mode:'public',sourceSHA:SOURCE,buildSHA:BUILD,publicURL:PUBLIC_URL,
  verifierSHA256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),budgetMS,
  framebuffer:{width,height,pixelRatio:1},browserViewport:{width:1280,height:900},
  tests:[],frames:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],
  completed:false,publicHttpsPassed:false,browserPassed:false,shareAllowed:false,
  visualAcceptance:false,productionReady:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
  limitations:[
    'One frozen native person, four deterministic native poses and the two requested views; no broad ancestor certification.',
    'The diagnostic colour identifies native oral skin; it is not a physiological pigment or quality score.',
    'Same-page comparison and independently loaded R02 match actual camera/light state before pixel comparison.',
    'Fresh archive restoration checks the person/calibration/inner-lip state; comparison camera and lighting are explicitly aligned and are not claimed to be stored by the person archive.',
    'Twelve saved images plus one fresh-context native readback; no real-phone performance claim.'
  ]};
let browser,page,context,fatalTimer,seq=0;const active=[];
function json(name,value){const p=path.join(out,name),t=p+'.tmp';fs.writeFileSync(t,JSON.stringify(value,null,2)+'\n');fs.renameSync(t,p);}
function checkpoint(){q.updatedAt=new Date().toISOString();q.activeStages=active.map(x=>({...x}));json('qa.partial.json',q);}
function progress(name,event,detail={}){const r={sequence:++seq,name,event,at:new Date().toISOString(),...detail};q.lastProgress=r;fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(r)+'\n');checkpoint();console.log(event.toUpperCase()+' '+name);}
async function bounded(name,fn,ms=120000){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(name+' exceeded '+ms+' ms; pending work is not a pass')),ms);})]);}finally{clearTimeout(timer);}}
async function stage(name,fn){const item={name,startedAt:new Date().toISOString()},s=Date.now();active.push(item);progress(name,'start');try{const value=await fn();progress(name,'end',{elapsedMS:Date.now()-s});return value;}catch(e){progress(name,'failure',{elapsedMS:Date.now()-s,error:String(e)});throw e;}finally{active.splice(active.indexOf(item),1);checkpoint();}}
async function test(name,fn){return stage(name,async()=>{const s=Date.now();try{const result=await fn();q.tests.push({name,passed:true,elapsedMS:Date.now()-s,result});checkpoint();return result;}catch(e){q.tests.push({name,passed:false,elapsedMS:Date.now()-s,error:String(e)});checkpoint();throw e;}});}
function terminated(reason,code){q.completed=false;q.shareAllowed=false;q.failure=reason;q.finishedAt=new Date().toISOString();progress('process','terminated',{reason});json('qa.json',q);process.exit(code);}
for(const[s,c]of[['SIGTERM',143],['SIGINT',130]])process.once(s,()=>terminated('Interrupted by '+s,c));

async function provenance(){
  const preview=fs.readFileSync(previewPath),manifest=JSON.parse(fs.readFileSync(manifestPath));
  assert.equal(manifest.version,VERSION);assert.equal(manifest.sourceCommit,SOURCE);assert.equal(manifest.baselineSource,BASE_SOURCE);assert.equal(manifest.baselineBuild,BASE_BUILD);assert.equal(manifest.baselineSHA256,BASE_HASH);
  assert.equal(manifest.baselineRestorationExact,true);assert.equal(sha(preview),manifest.previewSHA256);
  for(const name of['MucosaSurface.js','InnerLip.js'])assert.equal(sha(fs.readFileSync(path.join(scope,name))),manifest.modules[name],name+' module hash');
  const baseline=await context.request.get(BASE_RAW,{timeout:60000}),publicResponse=await context.request.get(RAW,{timeout:60000});
  const baselineBytes=await baseline.body(),publicBytes=await publicResponse.body();
  assert.equal(baseline.status(),200);assert.equal(publicResponse.status(),200);assert.equal(sha(baselineBytes),BASE_HASH);assert.equal(sha(publicBytes),manifest.previewSHA256);
  q.previewSHA256=manifest.previewSHA256;q.previewBytes=preview.length;q.manifest=manifest;
  q.byteProvenance={baseline:{url:BASE_RAW,status:baseline.status(),bytes:baselineBytes.length,sha256:sha(baselineBytes)},public:{url:RAW,status:publicResponse.status(),bytes:publicBytes.length,sha256:sha(publicBytes)},manifestSHA256:sha(fs.readFileSync(manifestPath))};checkpoint();
  return q.byteProvenance;
}
async function load(url,label,isR04){
  const c=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1,acceptDownloads:true});
  const p=await c.newPage();p.setDefaultTimeout(30000);const evaluate=p.evaluate.bind(p);p.evaluate=(...args)=>bounded(label+' browser evaluate',()=>evaluate(...args));
  p.on('pageerror',e=>{q.pageErrors.push({label,error:String(e)});checkpoint();});
  p.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text())){q.consoleErrors.push({label,error:m.text()});checkpoint();}});
  p.on('requestfailed',r=>{if(!/favicon/i.test(r.url())){q.failedRequests.push({label,url:r.url(),error:r.failure()?.errorText});checkpoint();}});
  p.on('response',r=>{if(r.status()>=400&&!/favicon/i.test(r.url())){q.resourceErrors.push({label,url:r.url(),status:r.status()});checkpoint();}});
  const s=Date.now(),r=await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(r.status(),200);
  await p.waitForFunction(()=>window.__HEAD_PROC__?.ready||window.__HEAD_PROC__?.errors?.length,null,{timeout:300000});
  await p.waitForFunction(isR04?()=>window.innerLip?.ready||window.__LIP_INNER__?.errors?.length:()=>window.lipRealism?.ready||window.__LIP_REALISM__?.errors?.length,null,{timeout:180000});
  const startup=await p.evaluate(isR04=>{
    const v=__IDENTITY_QA__.viewer();window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();v.orbit.autoRotate=false;v.orbit.enableDamping=false;
    return{title:document.title,finalFrame:v.startupFinalFrame,headReady:__HEAD_PROC__.ready,
      baseSource:document.documentElement.dataset.lipSource,baseVersion:lipRealism.version,
      source:isR04?document.documentElement.dataset.lipInnerSource:null,version:isR04?innerLip.version:null,
      report:isR04?innerLip.report():lipRealism.report(),errors:{head:__HEAD_PROC__.errors,base:__LIP_REALISM__.errors,inner:window.__LIP_INNER__?.errors||[],native:window.__LIP_P3__?.errors||[]}};
  },isR04);
  assert(startup.headReady&&startup.finalFrame);assert.equal(startup.baseSource,BASE_SOURCE);assert.equal(startup.baseVersion,'LIP-REALISM-R02');
  if(isR04){assert.equal(startup.source,SOURCE);assert.equal(startup.version,VERSION);assert.equal(startup.report.source.sourceCommit,SOURCE);assert.equal(startup.report.schema,'kaopu/lip-inner@1');assert.equal(startup.report.baseComparison,'r02');}
  for(const[k,v]of Object.entries(startup.errors))assert.equal(v?.length||0,0,label+' '+k);
  await stage(label+' drain original startup GPU queue',()=>p.evaluate(()=>{const gl=__IDENTITY_QA__.viewer().renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));if(gl.getError()||gl.isContextLost())throw Error('Original startup GPU queue failed');}));
  await p.evaluate(installFrameHarness);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await p.evaluate(({width,height})=>__LI_VERIFY__.size(width,height),{width,height});
  q.startups||=[];q.startups.push({label,url,elapsedMS:Date.now()-s,...startup});checkpoint();return{page:p,context:c};
}

/* Existing native API/data only. No shader, triangle, attribute, calibration or
 * prototype is rewritten by this harness. Camera/light alignment is explicit.
 */
function installFrameHarness(){
  const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),ls=m.lipStructure;
  const initialFunctions={render:v.render,rendererRender:v.renderer.render,update:v.update,motherUpdate:ls.mother.update};
  const baselinePose=lipWorkbench.pose(),interventions=[];
  const hash=async a=>a?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join(''):null;
  function withoutRender(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render,frame=v.renderer.info.render.frame;let suppressed=0;
    try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){suppressed++;}});return fn();}
    finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;interventions.push({label,suppressedCalls:suppressed,frameBefore:frame,frameAfter:v.renderer.info.render.frame,functionRestored:v.render===old});if(v.render!==old||v.renderer.info.render.frame!==frame)throw Error('Temporary render suppression was not contained');}}
  async function withoutRenderAsync(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render,frame=v.renderer.info.render.frame;let suppressed=0;
    try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){suppressed++;}});return await fn();}
    finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;interventions.push({label,suppressedCalls:suppressed,frameBefore:frame,frameAfter:v.renderer.info.render.frame,functionRestored:v.render===old});if(v.render!==old||v.renderer.info.render.frame!==frame)throw Error('Async restoration render suppression was not contained');}}
  function size(w,h){return withoutRender('controlled framebuffer',()=>{v.renderer.setPixelRatio(1);v.renderer.setSize(w,h,false);v.camera.aspect=w/h;v.camera.updateProjectionMatrix();});}
  function desired(name){const p={...baselinePose};for(const k of Object.keys(p))if(k!=='schema')p[k]=0;
    if(name==='jaw')p.jawOpen=.36;else if(name==='speak')Object.assign(p,{jawOpen:.36,upperRaise:.2,lowerDepress:.12});else if(name==='pucker')Object.assign(p,{jawOpen:.06,pucker:.82,seal:.24});else if(name!=='neutral')throw Error('Unknown fixed pose');return p;}
  function poseView(name,view){return withoutRender('pose/view '+name+'/'+view,()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();if(window.innerLip){innerLip.pose(name);innerLip.view(view);}else{lipWorkbench.setPose(desired(name));lipRealism.view(view);}const p=lipWorkbench.pose();for(const[k,x]of Object.entries(desired(name)))if(p[k]!==x)throw Error('Actual native pose differs: '+k);return p;});}
  function compare(mode){return withoutRender('variant '+mode,()=>{if(!window.innerLip)throw Error('No R04 controls');return innerLip.compare(mode);});}
  function inspect(value){return withoutRender('diagnostic '+value,()=>innerLip.inspect(value));}
  const arrayValue=x=>x?.toArray?x.toArray():ArrayBuffer.isView(x)?Array.from(x):Array.isArray(x)?x.map(arrayValue):x;
  function nativeUniforms(){const native=v.skin.material,skin=headProceduralSkin.material(),np=v.renderer.properties.get(native),sp=v.renderer.properties.get(skin);
    const names=['csTone','csLipColor','csLipMix','csRoughness','csOil','uLEnabled','uLPigment','uLUpperShade','uLWet','uLRough','uL19Mel','uL19Blood','uL19Rough','uL19Wet','uL19Oxygen'];
    if(!np.uniforms||!sp.uniforms)throw Error('Actual rendered native/procedural uniform maps unavailable');
    return names.map(name=>({name,nativePresent:!!np.uniforms[name],skinPresent:!!sp.uniforms[name],sameObject:np.uniforms[name]===sp.uniforms[name],value:arrayValue(sp.uniforms[name]?.value)}));}
  function lights(){v.scene.updateMatrixWorld(true);const result=[];v.scene.traverse(o=>{if(!o.isLight)return;
    const r={type:o.type,name:o.name,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray(),matrix:o.matrixWorld.toArray(),color:o.color.toArray(),intensity:o.intensity,visible:o.visible};
    if(o.groundColor)r.ground=o.groundColor.toArray();if(o.target)r.target={position:o.target.position.toArray(),quaternion:o.target.quaternion.toArray(),scale:o.target.scale.toArray(),matrix:o.target.matrixWorld.toArray()};result.push(r);});return result;}
  async function state(){const g=v.geometry,draw=v.mesh.geometry,c=ls.mother.surfaces.get(v.currentLip.geometry),attributes={},drawAttributes={};
    for(const name of['position','normal','csRest','fRest','csType','csRegion','l19Oral','l19State','l19Detail','skinIndex','skinWeight']){
      attributes[name]=await hash(g.attributes[name]?.array);drawAttributes[name]=draw.attributes[name]?.array===g.attributes[name]?.array?attributes[name]:await hash(draw.attributes[name]?.array);
    }
    const mats=Array.isArray(v.mesh.material)?v.mesh.material:[v.mesh.material];
    return{geometry:{attributes,index:await hash(g.index.array),vertices:g.attributes.position.count,canonicalPositions:await hash(m.positions),canonicalFaces:await hash(m.faces)},
      drawGeometry:{attributes:drawAttributes,index:await hash(draw.index.array),vertices:draw.attributes.position.count,groups:draw.groups.map(group=>({...group})),
        materialSlots:mats.map((mat,index)=>({index,type:mat.type,name:mat.name,native:mat===v.skin.material,procedural:mat===headProceduralSkin.material()}))},
      modelState:structuredClone(m.state),pose:lipWorkbench.pose(),ownerBeforeJaw:ls.performance.ownerBeforeJaw,dna:lipWorkbench.dna(),nativeLip:lipWorkbench.settings(),
      head:headProceduralSkin.settings(),body:bodyProceduralSkin.settings(),baseLip:lipRealism.settings(),baseComparison:lipRealism.report().comparison,
      calibration:{reference:await hash(c.reference),horizontal:await hash(c.referenceHorizontal),lastKey:c.lastKey,count:c.topology.count},
      camera:{position:v.camera.position.toArray(),quaternion:v.camera.quaternion.toArray(),target:v.orbit.target.toArray(),aspect:v.camera.aspect,fov:v.camera.fov,zoom:v.camera.zoom,near:v.camera.near,far:v.camera.far,projection:v.camera.projectionMatrix.toArray()},
      lighting:{lights:lights(),center:v.cineRig.center.toArray(),exposure:v.renderer.toneMappingExposure,toneMapping:v.renderer.toneMapping,outputColorSpace:v.renderer.outputColorSpace},
      functionsOriginal:v.render===initialFunctions.render&&v.renderer.render===initialFunctions.rendererRender&&v.update===initialFunctions.update&&ls.mother.update===initialFunctions.motherUpdate};}
  function align(reference){return withoutRender('explicit comparison camera and lighting alignment',()=>{
    const c=reference.camera;v.camera.position.fromArray(c.position);v.camera.quaternion.fromArray(c.quaternion);v.orbit.target.fromArray(c.target);
    for(const k of['aspect','fov','zoom','near','far'])v.camera[k]=c[k];v.camera.updateProjectionMatrix();v.orbit.update();
    const actual=[];v.scene.traverse(o=>{if(o.isLight)actual.push(o);});const saved=reference.lighting.lights;
    if(actual.length!==saved.length)throw Error('Comparison native light count differs');
    v.cineRig.center.fromArray(reference.lighting.center);
    for(let i=0;i<actual.length;i++){const o=actual[i],s=saved[i];if(o.type!==s.type||o.name!==s.name)throw Error('Comparison native light ordering differs');
      o.position.fromArray(s.position);o.quaternion.fromArray(s.quaternion);o.scale.fromArray(s.scale);o.color.fromArray(s.color);o.intensity=s.intensity;o.visible=s.visible;
      if(s.ground){if(!o.groundColor)throw Error('Missing native ground light');o.groundColor.fromArray(s.ground);}
      if(s.target){if(!o.target)throw Error('Missing native light target');o.target.position.fromArray(s.target.position);o.target.quaternion.fromArray(s.target.quaternion);o.target.scale.fromArray(s.target.scale);o.target.updateMatrixWorld(true);}}
    v.renderer.toneMappingExposure=reference.lighting.exposure;v.scene.updateMatrixWorld(true);
    return{fields:['camera','existing native light/target transforms and colour/intensity','existing cineRig.center','exposure'],geometryModified:false,headBodySettingsModified:false};});}
  function materialAttribution(){const g=v.mesh.geometry,a=g.attributes,mats=Array.isArray(v.mesh.material)?v.mesh.material:[v.mesh.material];
    for(const key of['position','csType','csRegion','l19Oral','l19State'])if(!a[key]||a[key].count!==a.position.count)throw Error('Missing actual oral material semantic '+key);
    const index=g.index.array,groups=[];let oralVertices=0,oralMax=0,teethGumsTongue=0,rawStateMaxDelta=0;
    for(let id=0;id<a.position.count;id++){const type=a.csType.getX(id),oral=a.l19State.getX(id);if(type<.5&&oral>0){oralVertices++;oralMax=Math.max(oralMax,oral);}if(type>.5&&type<3.5)teethGumsTongue++;rawStateMaxDelta=Math.max(rawStateMaxDelta,Math.abs(oral-(type<.5?Math.max(0,Math.min(1,a.l19Oral.getX(id))):0)));}
    for(const g0 of g.groups){const r={...g0,triangles:0,oralSkinAny:0,oralSkinAll:0,teethGumsTongue:0};for(let i=g0.start;i<g0.start+g0.count;i+=3){const ids=[index[i],index[i+1],index[i+2]];r.triangles++;const oral=ids.map(id=>a.csType.getX(id)<.5&&a.l19State.getX(id)>0);if(oral.some(Boolean))r.oralSkinAny++;if(oral.every(Boolean))r.oralSkinAll++;if(ids.every(id=>a.csType.getX(id)>.5&&a.csType.getX(id)<3.5))r.teethGumsTongue++;}groups.push(r);}
    return{vertices:a.position.count,triangles:index.length/3,oralVertices,oralMax,teethGumsTongue,rawStateMaxDelta,groups,canonicalOralSkinIDs:m.headTransfer.d.oral_skin_ids.length,
      materialSlots:mats.map((mat,index)=>({index,type:mat.type,name:mat.name,native:mat===v.skin.material,procedural:mat===headProceduralSkin.material()}))};}
  function shaders(){const mat=headProceduralSkin.material(),props=v.renderer.properties.get(mat),program=props.currentProgram||(props.programs&&[...props.programs.values()].at(-1));
    const gl=v.renderer.getContext();if(!program?.program)throw Error('Actual linked R04 GPU program absent');
    const attached=gl.getAttachedShaders(program.program)||[];
    return{programId:program.id,linked:gl.getProgramParameter(program.program,gl.LINK_STATUS),programLog:gl.getProgramInfoLog(program.program),
      templates:window.innerLip?innerLip.shaderEvidence():{originalR02Fragment:lipRealism.fragment()},
      expanded:attached.map(shader=>({type:gl.getShaderParameter(shader,gl.SHADER_TYPE)===gl.VERTEX_SHADER?'vertex':'fragment',compiled:gl.getShaderParameter(shader,gl.COMPILE_STATUS),log:gl.getShaderInfoLog(shader),source:gl.getShaderSource(shader)})),
      nativeUniforms:nativeUniforms(),source:'Actual WebGLProgram getAttachedShaders/getShaderSource; templates remain separately labelled onBeforeCompile templates with #include.'};}
  function report(){return{interventions:structuredClone(interventions),functionsOriginal:v.render===initialFunctions.render&&v.renderer.render===initialFunctions.rendererRender&&v.update===initialFunctions.update&&ls.mother.update===initialFunctions.motherUpdate};}
  window.__LI_VERIFY__={size,poseView,compare,inspect,state,align,nativeUniforms,materialAttribution,shaders,report,
    restore:a=>withoutRenderAsync('fresh full-person archive restore',()=>innerLip.restore(a)),
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
async function state(){return page.evaluate(()=>__LI_VERIFY__.state());}
async function closePage(p,label){if(!p||p.isClosed())return;const r=await bounded(label+' GPU drain',()=>p.evaluate(()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench?.stop?.();const renderer=window.__IDENTITY_QA__?.viewer?.()?.renderer;if(!renderer)return{available:false};const gl=renderer.getContext(),before=gl.getError(),lost=gl.isContextLost(),frame=renderer.info.render.frame;gl.finish();if(gl.drawingBufferWidth&&gl.drawingBufferHeight)gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));return{available:true,before,after:gl.getError(),lostBefore:lost,lostAfter:gl.isContextLost(),frameBefore:frame,frameAfter:renderer.info.render.frame};}),90000);
  if(r.available){assert.equal(r.before,0);assert.equal(r.after,0);assert.equal(r.lostBefore,false);assert.equal(r.lostAfter,false);assert.equal(r.frameBefore,r.frameAfter);}
  await bounded(label+' close page',()=>p.close({runBeforeUnload:false}),15000);assert(p.isClosed());q.closedPages||=[];q.closedPages.push({label,gpu:r,closed:true});checkpoint();}
async function cleanup(){const start=Date.now(),errors=[];for(const c of browser?.contexts()||[])for(const p of c.pages())try{await closePage(p,'final cleanup');}catch(e){errors.push(String(e));}
  try{if(browser)await bounded('close final browser',()=>browser.close(),15000);}catch(e){errors.push(String(e));}
  q.cleanup={completed:errors.length===0,browserDisconnected:!browser||!browser.isConnected(),errors,elapsedMS:Date.now()-start};checkpoint();assert(q.cleanup.completed&&q.cleanup.browserDisconnected,'Bounded browser cleanup failed');}
// During suppressed pose/restore setup, mesh.geometry may still name the prior
// frame's cached draw object. The post-render complete state gate includes it.
function commonPerson(s){const x=structuredClone(s);delete x.camera;delete x.lighting;delete x.drawGeometry;return x;}
async function saveShaders(label){const data=await page.evaluate(()=>__LI_VERIFY__.shaders());assert(data.linked);assert(data.expanded.length>=2&&data.expanded.every(x=>x.compiled&&x.source),'Actual expanded compiled GLSL absent');
  assert(data.nativeUniforms.length===15&&data.nativeUniforms.every(x=>x.nativePresent&&x.skinPresent&&x.sameObject),'Native uniform object ownership lost');
  const record={programId:data.programId,linked:data.linked,programLog:data.programLog,source:data.source,nativeUniforms:data.nativeUniforms,templates:{},expanded:[]};
  for(const[name,source]of Object.entries(data.templates)){if(typeof source==='string'){const file=label+'-'+name+'-template.glsl';fs.writeFileSync(path.join(out,file),source);record.templates[name]={file,sha256:sha(source),bytes:Buffer.byteLength(source),kind:'onBeforeCompile template; includes may remain'};}else record.templates[name]=source;}
  for(const shader of data.expanded){const file=label+'-'+shader.type+'-expanded.glsl';fs.writeFileSync(path.join(out,file),shader.source);record.expanded.push({file,type:shader.type,compiled:shader.compiled,log:shader.log,sha256:sha(shader.source),bytes:Buffer.byteLength(shader.source)});}
  return record;
}

async function publicChecks(){
  const primary=await load(PUBLIC_URL,'R04 public',true);page=primary.page;
  const pairs={},matrix=[['neutral','macro'],['jaw','macro'],['jaw','oblique'],['speak','macro'],['pucker','oblique']];
  for(const[pose,view]of matrix)await test('matched native '+pose+'/'+view+' R04 and R02',async()=>{
    await page.evaluate(({pose,view})=>{__LI_VERIFY__.poseView(pose,view);__LI_VERIFY__.inspect(0);__LI_VERIFY__.compare('r04');},{pose,view});
    const on=await capture(pose+'-'+view+'-r04'),onState=await state();
    await page.evaluate(()=>__LI_VERIFY__.compare('r02'));
    const off=await capture(pose+'-'+view+'-r02'),offState=await state();assert.deepEqual(offState,onState,'R04 comparison changed protected native state');
    assert.equal(await page.evaluate(()=>innerLip.report().comparison),'r02');
    const delta=difference(off,on);pairs[pose+'/'+view]={on,off,state:onState};q.comparisons||=[];q.comparisons.push({pose,view,onSHA256:on.sha256,offSHA256:off.sha256,state:onState,difference:delta});
    return{sameGeometryCameraLightingDNAAndCalibration:true,...delta};
  });
  await test('actual oral semantic diagnostic and material ownership',async()=>{
    await page.evaluate(()=>{__LI_VERIFY__.poseView('jaw','oblique');__LI_VERIFY__.compare('r04');__LI_VERIFY__.inspect(1);});
    const mask=await capture('jaw-oblique-semantic'),s=await state();
    assert.deepEqual(s,pairs['jaw/oblique'].state,'Diagnostic changed protected native state');
    const attribution=await page.evaluate(()=>__LI_VERIFY__.materialAttribution());q.materialAttribution=attribution;json('material-attribution.json',attribution);
    assert(attribution.oralVertices>0&&attribution.oralMax>0&&attribution.canonicalOralSkinIDs>0);assert.equal(attribution.rawStateMaxDelta,0);
    const native=attribution.materialSlots.find(x=>x.native),skin=attribution.materialSlots.find(x=>x.procedural);assert(native&&skin&&native.index!==skin.index);
    assert(attribution.groups.some(g=>g.materialIndex===skin.index&&g.oralSkinAny>0));assert(attribution.groups.some(g=>g.materialIndex===native.index&&g.teethGumsTongue>0));
    let purple=0;for(let i=0;i<mask.pixels.length;i+=4)if(mask.pixels[i+2]>mask.pixels[i]&&mask.pixels[i]>mask.pixels[i+1])purple++;
    assert(purple>0,'Semantic diagnostic did not render any purple oral-skin response');
    q.semantic={purpleRankPixels:purple,rule:'B>R>G; observed colour ordering only, not pixel-perfect semantic segmentation',maskSHA256:mask.sha256};
    await page.evaluate(()=>__LI_VERIFY__.inspect(0));
    return{nativeOralVertices:attribution.oralVertices,purpleRankPixels:purple};
  });
  await test('actual shader templates expanded GLSL and live native uniforms',async()=>{
    q.shaders={r04:await saveShaders('r04')};
    const identities=q.shaders.r04.templates.nativeUniformIdentity;assert(Array.isArray(identities)&&identities.length===15&&identities.every(x=>x.present&&x.sameObject));
    assert(q.shaders.r04.templates.originalR02Fragment&&q.shaders.r04.templates.finalFragment);
    return{linked:true,expandedShaders:q.shaders.r04.expanded.length,nativeUniformObjects:15};
  });
  await test('independently loaded fixed public R02 equals R04-off at jaw macro',async()=>{
    const baseline=await load(BASE_URL,'independent R02',false);page=baseline.page;
    await page.evaluate(()=>__LI_VERIFY__.poseView('jaw','macro'));
    const before=await state();assert.deepEqual(commonPerson(before),commonPerson(pairs['jaw/macro'].state),'Separate R02 person/geometry/DNA/calibration differs before view/light alignment');
    q.baselinePreFrameScope={nativePersonGeometryAndCalibrationExact:true,drawGeometry:'Deferred until the actual render replaces the previous frame cache; complete post-frame equality is required.'};
    q.baselineAlignment=await page.evaluate(reference=>__LI_VERIFY__.align(reference),pairs['jaw/macro'].state);
    const frame=await capture('independent-r02-jaw-macro'),actual=await state();assert.deepEqual(actual,pairs['jaw/macro'].state,'Independent actual R02 state differs after camera/light alignment');
    assert.equal(frame.sha256,pairs['jaw/macro'].off.sha256,'Same-state independent R02 pixels differ from R04-off');
    q.shaders.r02=await saveShaders('independent-r02');
    assert.equal(q.shaders.r02.templates.originalR02Fragment.sha256,q.shaders.r04.templates.originalR02Fragment.sha256,'Inherited actual R02 fragment template changed');
    q.independentR02={state:actual,frameSHA256:frame.sha256,exactOffPixels:true,exactOriginalR02Template:true};
    await closePage(page,'independent R02 complete');await baseline.context.close();page=primary.page;
    return{stateExact:true,pixelsExact:true,templateExact:true};
  });
  let savedArchive;
  await test('three actual top head and body DOM saves retain R04 and native calibration',async()=>{
    const selectors=[['top','#li-controls [data-li-action="save"]'],['head','#ps-controls [data-ps-action="save"]'],['body','#ps-controls [data-fb-action="save"]']];
    for(const[,selector]of selectors){const locator=page.locator(selector);assert.equal(await locator.count(),1,'Expected one real save button '+selector);await locator.evaluate(el=>{for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;});}
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await page.evaluate(({width,height})=>{__LI_VERIFY__.size(width,height);__LI_VERIFY__.poseView('jaw','macro');__LI_VERIFY__.inspect(0);__LI_VERIFY__.compare('r04');},{width,height});
    await page.evaluate(reference=>__LI_VERIFY__.align(reference),pairs['jaw/macro'].state);
    const before=await state();assert.deepEqual(before,pairs['jaw/macro'].state,'Save setup changed the held person');
    q.downloads=[];
    for(const[label,selector]of selectors){
      const promise=page.waitForEvent('download',{timeout:30000});await page.locator(selector).click();const download=await promise;
      const file='archive-'+label+'.json';await download.saveAs(path.join(out,file));const bytes=fs.readFileSync(path.join(out,file)),archive=JSON.parse(bytes);
      assert.equal(archive.innerLip?.schema,'kaopu/lip-inner@1');assert.equal(archive.innerLip.version,VERSION);assert.equal(archive.innerLip.comparison,'r04');assert.equal(archive.innerLip.diagnostic,0);
      assert(archive.lipRealism?.calibration?.reference&&archive.lipRealism?.calibration?.referenceHorizontal,'Actual save lost original calibration');
      assert.deepEqual(archive.proceduralHeadSurface?.settings,before.head,'Actual save lost head surface settings');
      assert.deepEqual(archive.proceduralBodySurface?.settings,before.body,'Actual save lost body surface settings');
      if(savedArchive)assert.deepEqual(archive,savedArchive,'Actual save routes differ in the full person archive');
      else savedArchive=archive;
      q.downloads.push({label,selector,file,suggestedFilename:download.suggestedFilename(),sha256:sha(bytes),bytes:bytes.length,innerLip:archive.innerLip});
      assert.deepEqual(await state(),before,'Actual save altered person state');checkpoint();
    }
    q.archiveReferenceState=before;
    return{actualDOMDownloads:3,innerLipSchema:'kaopu/lip-inner@1',calibrationRetained:true};
  });
  await test('unknown and null R04 archive declarations reject before native mutation',async()=>{
    q.malformed=[];
    for(const kind of['unknown-schema','null']){
      const bad=structuredClone(savedArchive);if(kind==='unknown-schema')bad.innerLip.schema='kaopu/lip-inner@999';else bad.innerLip=null;
      const before=await state(),frameBefore=await page.evaluate(()=>__LI_VERIFY__.renderedFrame());
      const result=await page.evaluate(async bad=>{try{await innerLip.restore(bad);return{rejected:false};}catch(e){return{rejected:true,error:String(e)};}},bad);
      assert(result.rejected,'Malformed R04 archive was accepted');assert.deepEqual(await state(),before,'Malformed R04 archive changed the native person');
      assert.equal(await page.evaluate(()=>__LI_VERIFY__.renderedFrame()),frameBefore,'Malformed archive submitted a native render');
      q.malformed.push({kind,...result,stateUnchanged:true,nativeRenderCounterUnchanged:true});
    }
    return{rejectedBeforeStateAndRenderMutation:2};
  });
  q.primaryInterventions=await page.evaluate(()=>__LI_VERIFY__.report());assert(q.primaryInterventions.functionsOriginal);
  await closePage(page,'primary public checks complete');await primary.context.close();
  await test('fresh browser context restores an actual downloaded full-person archive',async()=>{
    const fresh=await load(PUBLIC_URL,'fresh R04 archive context',true);page=fresh.page;
    await page.evaluate(archive=>__LI_VERIFY__.restore(archive),savedArchive);
    await page.evaluate(({width,height})=>__LI_VERIFY__.size(width,height),{width,height});
    const before=await state();assert.deepEqual(commonPerson(before),commonPerson(q.archiveReferenceState),'Fresh restore lost person, calibration, settings or native geometry');
    q.freshPreFrameScope={nativePersonGeometryAndCalibrationExact:true,drawGeometry:'Deferred until the actual render replaces the previous frame cache; complete post-frame equality is required.'};
    q.freshAlignment=await page.evaluate(reference=>__LI_VERIFY__.align(reference),q.archiveReferenceState);
    const frame=await capture('fresh-r04-downloaded-archive-readback',false),actual=await state();
    assert.deepEqual(actual,q.archiveReferenceState,'Fresh restored actual camera/light/person state differs');
    assert.equal(frame.sha256,pairs['jaw/macro'].on.sha256,'Fresh archive actual frame differs from the saved R04 person');
    const report=await page.evaluate(()=>innerLip.report());assert.equal(report.comparison,'r04');assert.equal(report.diagnostic,0);
    q.freshRestore={download:q.downloads[0].file,sourceSHA:report.source.sourceCommit,stateExact:true,frameExact:true,frameSHA256:frame.sha256,
      archiveOwnsCameraAndLighting:false,comparisonCameraAndLightingExplicitlyAligned:true};
    q.freshInterventions=await page.evaluate(()=>__LI_VERIFY__.report());assert(q.freshInterventions.functionsOriginal);
    return q.freshRestore;
  });
  const requiredResponse=q.comparisons.find(x=>x.pose==='jaw'&&x.view==='oblique');assert(requiredResponse.difference.changedPixels>0,'No visible material response at the known open-mouth oblique view');
  assert.equal(q.frames.filter(x=>x.saved).length,12);assert.equal(q.frames.length,13);
}

(async()=>{
  fatalTimer=setTimeout(()=>terminated('Bounded public verification deadline exceeded',124),budgetMS);
  try{
    const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(options);context=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1});
    await test('fixed public bytes source modules and R02 ancestor',provenance);await context.close();
    await publicChecks();
    for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key);
    q.completed=true;q.publicHttpsPassed=true;q.browserPassed=true;q.shareAllowed=true;
  }catch(e){q.completed=false;q.shareAllowed=false;q.failure=String(e);q.stack=e.stack;process.exitCode=1;console.error(e);}
  finally{
    q.verificationFinishedAt=new Date().toISOString();json('qa.json',q);checkpoint();
    try{await cleanup();}catch(e){q.cleanupError=String(e);q.completed=false;q.shareAllowed=false;process.exitCode=1;}
    clearTimeout(fatalTimer);q.finishedAt=new Date().toISOString();json('qa.json',q);
    json('PUBLICATION_PROOF.json',{schema:'kaopu/lip-inner-publication@1',version:VERSION,sourceSHA:SOURCE,buildSHA:BUILD,previewSHA256:q.previewSHA256,publicURL:PUBLIC_URL,
      verifierSHA256:q.verifierSHA256,checkedAt:q.finishedAt,publicHttpsPassed:q.completed&&q.publicHttpsPassed,browserPassed:q.completed&&q.browserPassed,shareAllowed:q.completed&&q.shareAllowed,
      actualSavedImages:q.frames.filter(x=>x.saved).length,actualReadbacks:q.frames.length,visualAcceptance:false,productionReady:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
      failure:q.failure||q.cleanupError||null,evidence:'qa.json'});
    console.log(JSON.stringify({completed:q.completed,tests:q.tests.length,savedFrames:q.frames.filter(x=>x.saved).length,readbacks:q.frames.length,shareAllowed:q.shareAllowed,failure:q.failure||q.cleanupError||null,output:out}));
    if(q.cleanupError)process.exit(1);
  }
})();
