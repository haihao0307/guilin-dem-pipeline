'use strict';
/* R05 bounded attribution of the fixed R04 native scene. Diagnostic interventions
 * are not a production patch or an aesthetic pass. Original failures are retained. */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto'), assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const VERSION='LIP-INNER-R04',BASE_SOURCE='01cfde47476b7be6764e9c6a79d925462511539b',BASE_BUILD='ba0c4eb337e03997878aecaf477d8ec3fe8b7231';
const BASE_HASH='ccc7af8e97969667bf63ab8bbc61e845d95e7b5e7f70adb167a662a63c0cb571';
const ROOT='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/';
const BASE_RAW=ROOT+BASE_BUILD+'/kaopu-unified-human-workbench/lip-realism-r02/preview.html';
const BASE_URL='https://htmlpreview.github.io/?'+BASE_RAW;
const PUBLIC_URL="https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/f70e40b301ea964956d9915ab820e4efe1105549/kaopu-unified-human-workbench/lip-inner-r04/preview.html";
const SOURCE='9d855c6051e76a20f052c95f0dda95103d946ef7',BUILD='f70e40b301ea964956d9915ab820e4efe1105549';
assert(!process.env.MODE||process.env.MODE==='diagnose','This suite verifies the fixed public R04 build');
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
const q={schema:'kaopu/lip-motion-attribution-qa@1',version:VERSION,mode:'diagnose',diagnosticCommit:process.env.GITHUB_SHA||null,sourceSHA:SOURCE,buildSHA:BUILD,publicURL:PUBLIC_URL,
  verifierSHA256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),budgetMS,
  framebuffer:{width,height,pixelRatio:1},browserViewport:{width:1280,height:900},
  tests:[],frames:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],
  completed:false,publicHttpsPassed:false,browserPassed:false,shareAllowed:false,
  visualAcceptance:false,productionReady:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
  limitations:[
    'One fixed native R04 person. Diagnostic ablations do not count as production improvements.',
    'No-bump and albedo retain actual geometry; no-local and no-closure intentionally change evaluated geometry while declared pose remains fixed.',
    'CPU projected visible-triangle samples do not model edge MSAA or shader displacement; eligibility is checked and uncertainty retained.',
    'Pixel differences establish a response, not an aesthetic pass. Independent visual review is required.',
    'Camera/light alignment uses the existing native objects. No physical-mobile or general anatomy claim.'
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
 const r=await context.request.get(RAW,{timeout:60000}),bytes=await r.body();assert.equal(r.status(),200);
 assert.equal(sha(bytes),'16e30c857d0f460b661845d557043a367638076dad920bd1966b34a59bedaae8');
 q.byteProvenance={url:RAW,httpStatus:r.status(),bytes:bytes.length,sha256:sha(bytes)};
 q.helpers={};for(const name of ['MotionAttribution.js','SurfaceAttribution.js']){const x=fs.readFileSync(path.join(__dirname,name));q.helpers[name]={bytes:x.length,sha256:sha(x)};}
 checkpoint();return q.byteProvenance;
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
    // OrbitControls resolves its internal state with a floating-point round trip.
    // Diagnosis-01 changed only target.x's last bit here. Reapply the exact saved
    // pose to the SAME objects after that update; all downstream equality gates
    // remain strict and no camera field is omitted or compared with a tolerance.
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
function preFrameState(s){const x=structuredClone(s);delete x.drawGeometry;return x;}
function commonPerson(s){const x=preFrameState(s);delete x.camera;delete x.lighting;return x;}

function invariantInputs(s){const x=structuredClone(s);for(const g of [x.geometry,x.drawGeometry])for(const name of ['position','normal','l19State','l19Detail'])delete g.attributes[name];return x;}
function surfaceInvariant(s){const x=structuredClone(s);if(x.baseLip)delete x.baseLip.diagnostic;return x;}
async function shaderMode(mode){return page.evaluate(mode=>{const v=__IDENTITY_QA__.viewer(),d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render;try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){}});return __R05_SURFACE_DIAG__.setMode(mode);}finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;if(v.render!==old)throw Error('Render suppression restore failed');}},mode);}
async function geometryMode(mode,pose,view,ref){const before=await page.evaluate(()=>__R05_MOTION_DIAG__.report().lastExecution?.sequence||0);await page.evaluate(mode=>__R05_MOTION_DIAG__.setMode(mode),mode);await page.evaluate(([pose,view])=>__LI_VERIFY__.poseView(pose,view),[pose,view]);await page.evaluate(ref=>__LI_VERIFY__.align(ref),ref);return before;}
const sampleSets={
 speak:[{label:'upper band left',x:229,y:230},{label:'upper band middle',x:318,y:221},{label:'upper band right',x:423,y:241},{label:'lower band left',x:215,y:304},{label:'lower band middle',x:327,y:321},{label:'lower band right',x:454,y:298},{label:'upper lip body',x:309,y:180},{label:'lower lip body',x:318,y:356},{label:'left corner',x:137,y:277},{label:'right corner',x:503,y:275}],
 pucker:[{label:'inner band left',x:260,y:285},{label:'inner band middle',x:327,y:289},{label:'inner band right',x:418,y:296},{label:'tooth sliver',x:334,y:281},{label:'upper lip body',x:338,y:249},{label:'lower lip body',x:338,y:339},{label:'left corner',x:218,y:294},{label:'right corner',x:493,y:301}]
};
async function actualAttribution(){
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'MotionAttribution.js'),'utf8')});
 const references={};
 await test('original R04 reference frames before any diagnostic shader',async()=>{
  for(const [pose,view] of [['speak','macro'],['pucker','oblique']]){
   await page.evaluate(([pose,view])=>__LI_VERIFY__.poseView(pose,view),[pose,view]);
   const baseline=await capture(pose+'-'+view+'-r04'),ref=await state();references[pose]={baseline,ref};
   q[pose]={baselineState:ref,experiments:[],originalShaderReference:true};
   const samples=await page.evaluate(({points,width,height})=>__R05_MOTION_DIAG__.visibleSamples(points,width,height),{points:sampleSets[pose],width,height});
   json(pose+'-visible-triangles.json',samples);q[pose].visibleTriangles={file:pose+'-visible-triangles.json',sha256:sha(fs.readFileSync(path.join(out,pose+'-visible-triangles.json'))),available:samples.available,reason:samples.reason||null,hitCount:samples.points?.filter(p=>p.available).length||0,fragmentOwnershipCertain:false};checkpoint();
  }
  return{source:SOURCE,build:BUILD,frames:2,shaderModified:false};
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(__dirname,'SurfaceAttribution.js'),'utf8')});
 q.installation=await page.evaluate(()=>({motion:__R05_MOTION_DIAG__.report(),surface:__R05_SURFACE_DIAG__.report()}));checkpoint();
 let lastBaseline,lastState;
 for(const [pose,view] of [['speak','macro'],['pucker','oblique']]){
  await test('actual material and geometry attribution '+pose+'/'+view,async()=>{
   const {baseline,ref}=references[pose];await shaderMode('baseline');await geometryMode('baseline',pose,view,ref);
   for(const mode of ['no-bump','albedo']){
    await shaderMode(mode);const frame=await capture(pose+'-'+view+'-'+mode),after=await state();
    assert.deepEqual(surfaceInvariant(after),surfaceInvariant(ref),'Material-only attribution changed unrelated state');
    await page.waitForFunction(()=>__R05_SURFACE_DIAG__.report().pendingHashes===0,null,{timeout:15000});
    const surface=await page.evaluate(()=>{const report=__R05_SURFACE_DIAG__.report(),v=__IDENTITY_QA__.viewer(),mat=headProceduralSkin.material(),props=v.renderer.properties.get(mat),p=props.currentProgram||(props.programs&&[...props.programs.values()].at(-1)),gl=v.renderer.getContext();const loc=gl.getUniformLocation(p.program,'r05SurfaceMode');return{report,actual:__LI_VERIFY__.shaders(),gpuMode:loc?gl.getUniform(p.program,loc):null};});
    assert(surface.report.shaderCompiles>0&&surface.report.hashEvidenceComplete);assert.equal(surface.report.errors.length,0);assert(surface.report.allCapturedNativeUniformObjectsStillIdentical);assert(surface.actual.linked);
    assert(surface.actual.expanded.every(x=>x.compiled));assert(surface.actual.expanded.some(x=>x.type==='fragment'&&x.source.includes('r05SurfaceMode')));assert.equal(surface.gpuMode,mode==='no-bump'?1:2);
    const expandedFile=pose+'-'+mode+'-actual-fragment.glsl',fragment=surface.actual.expanded.find(x=>x.type==='fragment').source;fs.writeFileSync(path.join(out,expandedFile),fragment);delete surface.actual.expanded;
    q[pose].experiments.push({mode,frame:frame.name,difference:difference(baseline,frame),state:after,surface,expandedFile,expandedSHA256:sha(fragment)});checkpoint();
   }
   await shaderMode('baseline');
   for(const mode of pose==='speak'?['no-local']:['no-local','no-closure']){
    const previousSequence=await geometryMode(mode,pose,view,ref);const frame=await capture(pose+'-'+view+'-'+mode),after=await state();
    assert.deepEqual(invariantInputs(after),invariantInputs(ref),'Geometry attribution changed declared native inputs/camera/light/calibration');
    assert.equal(after.geometry.canonicalPositions,ref.geometry.canonicalPositions);assert.equal(after.geometry.canonicalFaces,ref.geometry.canonicalFaces);
    assert.deepEqual(after.baseLip,ref.baseLip,'Geometry attribution changed surface controls');
    const motion=await page.evaluate(()=>__R05_MOTION_DIAG__.report()),execution=motion.lastExecution;assert(execution?.completed&&execution.mode===mode&&execution.sequence>previousSequence);assert.equal(execution.pairMapCalls,1);assert.equal(execution.lipsIteratorCalls,1);assert.equal(execution.positionRestores,1);assert(execution.innerHooksRestored&&execution.declaredPoseUnchanged);assert.equal(motion.errors.length,0);
    q[pose].experiments.push({mode,frame:frame.name,difference:difference(baseline,frame),state:after,motion});checkpoint();
   }
   await geometryMode('baseline',pose,view,ref);const recovered=await capture(pose+'-'+view+'-restored'),recoveredState=await state();
   assert.deepEqual(recoveredState,ref,'Actual baseline state did not restore exactly');assert.equal(recovered.sha256,baseline.sha256,'Actual baseline framebuffer did not restore exactly');
   q[pose].restoration={stateExact:true,pixelsExact:true,frame:recovered.name};checkpoint();lastBaseline=baseline;lastState=ref;
   return q[pose].restoration;
  });
 }
 await test('restore original diagnostic descriptors and actual native frame',async()=>{
  q.restoration=await page.evaluate(()=>{const v=__IDENTITY_QA__.viewer(),d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render;let suppressed=0;try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){suppressed++;}});const result={motion:__R05_MOTION_DIAG__.restore(),surface:__R05_SURFACE_DIAG__.restore()};return{...result,suppressedRenderCalls:suppressed};}finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;if(v.render!==old)throw Error('Original render restoration failed');}});checkpoint();
  assert(q.restoration.motion.originalApplyDescriptorRestored);assert.equal(q.restoration.motion.errors.length,0);assert(q.restoration.surface.restored&&q.restoration.surface.hashEvidenceComplete);assert.equal(q.restoration.surface.errors.length,0);
  await page.evaluate(ref=>__LI_VERIFY__.align(ref),lastState);
  const native=await capture('pucker-oblique-original-shader-restored'),after=await state();
  assert.deepEqual(after,lastState);assert.equal(native.sha256,lastBaseline.sha256);
  q.restoration.nativeStateExact=true;q.restoration.nativePixelsExact=true;return q.restoration;
 });
}
(async()=>{
 fatalTimer=setTimeout(()=>terminated('Whole diagnostic budget exhausted',124),budgetMS);
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext();await test('immutable public R04 provenance',provenance);await context.close();
  ({page,context}=await load(PUBLIC_URL,'fixed R04',true));await actualAttribution();
  for(const key of ['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key);
  q.completed=true;
 }catch(error){q.completed=false;q.failure=String(error?.stack||error);console.error(q.failure);checkpoint();}
 finally{
  try{if(page&&!page.isClosed())q.finalReports=await page.evaluate(()=>({motion:window.__R05_MOTION_DIAG__?.report?.()||null,surface:window.__R05_SURFACE_DIAG__?.report?.()||null,harness:window.__LI_VERIFY__?.report?.()||null}));}catch(error){q.reportError=String(error);}
  try{await cleanup();}catch(error){q.completed=false;q.cleanupError=String(error);}
  clearTimeout(fatalTimer);q.finishedAt=new Date().toISOString();q.shareAllowed=false;q.visualAcceptance=false;q.productionReady=false;json('qa.json',q);console.log(JSON.stringify({completed:q.completed,tests:q.tests.map(x=>({name:x.name,passed:x.passed})),frames:q.frames.length,failure:q.failure||null}));process.exitCode=q.completed?0:1;
 }
})();
