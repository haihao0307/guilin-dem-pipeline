'use strict';
/* R06 attribution only: five actual native R05 frames, one fixed pucker pose.
 * Three corner-local component counterfactuals retain R05 and all downstream
 * native stages. Pixel responses are evidence for review, not a product fix. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {PNG}=require('pngjs');
const VERSION='LIP-CORNER-R06-ATTRIBUTION-01',R05_VERSION='LIP-MOTION-R05';
const SOURCE='a8bba75322c12df151ecbcebc416087b5248aa5f',BUILD='11ed0391f798b5323f4eb4aefec4307fc0b9aee0';
const PREVIEW_HASH='231cc60f696e1bfbe7831e5afb5bfb845f7358391dacd25bc3efa00c7a21710b';
const BASE_SOURCE='9d855c6051e76a20f052c95f0dda95103d946ef7',BASE_BUILD='f70e40b301ea964956d9915ab820e4efe1105549';
const BASE_HASH='16e30c857d0f460b661845d557043a367638076dad920bd1966b34a59bedaae8',INHERITED_SOURCE='01cfde47476b7be6764e9c6a79d925462511539b';
const ROOT='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/';
const RAW=ROOT+BUILD+'/kaopu-unified-human-workbench/lip-motion-r05/preview.html';
const PUBLIC_URL=process.env.PUBLIC_URL||'https://htmlpreview.github.io/?'+RAW;
assert(!process.env.MODE||process.env.MODE==='public','This diagnostic runs only against the immutable public R05');
assert.equal(PUBLIC_URL,'https://htmlpreview.github.io/?'+RAW,'Public URL must name the fixed reviewed R05 build');
const scope=path.resolve(__dirname,'..'),helperPath=path.join(__dirname,'CornerAttribution.js');
const out=path.resolve(process.env.QA_OUT||path.join(scope,'evidence','diagnosis-01'));
const width=640,height=512,budgetMS=Number(process.env.QA_BUDGET_MS||600000);
assert(Number.isFinite(budgetMS)&&budgetMS>=120000&&budgetMS<=720000,'Invalid bounded diagnostic deadline');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.mkdirSync(out,{recursive:true});
const q={schema:'kaopu/lip-corner-attribution-qa@1',version:VERSION,mode:'public',diagnosticCommit:process.env.GITHUB_SHA||null,
  sourceSHA:SOURCE,buildSHA:BUILD,publicURL:PUBLIC_URL,previewSHA256:PREVIEW_HASH,
  verifierSHA256:sha(fs.readFileSync(__filename)),startedAt:new Date().toISOString(),budgetMS,
  framebuffer:{width,height,pixelRatio:1},browserViewport:{width:1280,height:900},
  tests:[],frames:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],
  completed:false,publicHttpsPassed:false,browserPassed:false,shareAllowed:false,
  visualAcceptance:false,productionReady:false,productionRepair:false,physicalPhone:false,generatedImageUsed:false,staticImageSubstitute:false,
  limitations:[
    'One fixed R05 person, pucker=.82, jawOpen=.06, seal=.24, oblique view. No broad ancestor or cross-person certification.',
    'Three separate position counterfactuals are limited to the existing native active skin with a fixed native-u corner mask. Declared controls remain unchanged.',
    'R05 remains enabled, and original local, closure, envelope, normal, strain and micro stages execute. Their downstream geometry may respond to the selected component change.',
    'Only position, normal, l19State and l19Detail may change. Person inputs, calibration, before-local base, canonical geometry, topology, material, actual shader, camera and lighting remain protected.',
    'The boundary scan uses every original indexed triangle, including edges omitted by skin-only top.neighbors. Projection is reported unavailable if the actual draw-prefix mapping cannot be proven.',
    'Five actual native readbacks: pristine R05, three counterfactuals and exact restoration. No UI/archive modification or aesthetic promotion.'
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
  const response=await context.request.get(RAW,{timeout:60000});assert.equal(response.status(),200);const bytes=await response.body();
  assert.equal(sha(bytes),PREVIEW_HASH,'Immutable public R05 bytes changed');
  const text=bytes.toString('utf8'),marker='window.__LIP_MOTION_SOURCE__=';
  assert.equal(text.split(marker).length,2,'Expected one fixed R05 source declaration');
  const start=text.indexOf(marker)+marker.length,end=text.indexOf(';\n',start);assert(end>start,'R05 source declaration boundary absent');
  const source=JSON.parse(text.slice(start,end));
  assert.equal(source.version,R05_VERSION);assert.equal(source.sourceCommit,SOURCE);assert.equal(source.baselineSource,BASE_SOURCE);assert.equal(source.baselineBuild,BASE_BUILD);assert.equal(source.baselineSHA256,BASE_HASH);
  assert.deepEqual(Object.keys(source.modules).sort(),['src/MotionContinuity.js','src/MotionLip.js'].sort());
  const anchors={
    localContraction:'Q=1-.23*a.pucker-.12*a.funnel+.18*G',
    transverseCompensation:'H=N*(oe-1)-N*.33*a.press',
    forwardPucker:'ee=((.0036*a.pucker+.0025*a.funnel)*Tt(C.u,.85)-8e-4*G*ce)*u',
    beforeClosure:'b=i.pairs.map(D=>{let C=_(D.upper)-_(D.lower)',
    displayedFrame:'let l=h=>[h[0],h[2],-h[1]];return{x:l(r),up:l(a),front:l(c),center:l(s)'
  };
  for(const[name,needle]of Object.entries(anchors))assert.equal(text.split(needle).length,2,'Reviewed native source anchor is not unique: '+name);
  const helper=fs.readFileSync(helperPath);q.r05Source=source;
  q.byteProvenance={url:RAW,status:response.status(),bytes:bytes.length,sha256:sha(bytes),nativeSourceAnchors:anchors};
  q.helper={file:'verification/CornerAttribution.js',sha256:sha(helper),bytes:helper.length};checkpoint();return{...q.byteProvenance,helper:q.helper};
}
async function load(url,label,isR05=true){
  const c=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1,acceptDownloads:true});
  const p=await c.newPage();p.setDefaultTimeout(30000);const evaluate=p.evaluate.bind(p);p.evaluate=(...args)=>bounded(label+' browser evaluate',()=>evaluate(...args));
  p.on('pageerror',e=>{q.pageErrors.push({label,error:String(e)});checkpoint();});
  p.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text())){q.consoleErrors.push({label,error:m.text()});checkpoint();}});
  p.on('requestfailed',r=>{if(!/favicon/i.test(r.url())){q.failedRequests.push({label,url:r.url(),error:r.failure()?.errorText});checkpoint();}});
  p.on('response',r=>{if(r.status()>=400&&!/favicon/i.test(r.url())){q.resourceErrors.push({label,url:r.url(),status:r.status()});checkpoint();}});
  const s=Date.now(),r=await p.goto(url,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(r.status(),200);
  await p.waitForFunction(()=>window.__HEAD_PROC__?.ready||window.__HEAD_PROC__?.errors?.length,null,{timeout:300000});
  await p.waitForFunction(()=>window.innerLip?.ready||window.__LIP_INNER__?.errors?.length,null,{timeout:180000});
  if(isR05)await p.waitForFunction(()=>window.motionLip?.ready||window.__LIP_MOTION__?.errors?.length,null,{timeout:300000});
  const startup=await p.evaluate(isR05=>{
    const v=__IDENTITY_QA__.viewer();window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();v.orbit.autoRotate=false;v.orbit.enableDamping=false;
    return{title:document.title,finalFrame:v.startupFinalFrame,headReady:__HEAD_PROC__.ready,
      baseSource:document.documentElement.dataset.lipSource,baseVersion:lipRealism.version,
      innerSource:document.documentElement.dataset.lipInnerSource,innerVersion:innerLip.version,innerReport:innerLip.report(),
      source:isR05?document.documentElement.dataset.lipMotionSource:null,version:isR05?motionLip.version:null,
      report:isR05?motionLip.report():innerLip.report(),errors:{head:__HEAD_PROC__.errors,base:__LIP_REALISM__.errors,inner:__LIP_INNER__.errors,motion:window.__LIP_MOTION__?.errors||[],solver:window.__LIP_MOTION_SOLVER__?.report?.().errors||[],native:window.__LIP_P3__?.errors||[]}};
  },isR05);
  assert(startup.headReady&&startup.finalFrame);assert.equal(startup.baseSource,INHERITED_SOURCE);assert.equal(startup.baseVersion,'LIP-REALISM-R02');
  assert.equal(startup.innerSource,BASE_SOURCE);assert.equal(startup.innerVersion,'LIP-INNER-R04');assert.equal(startup.innerReport.source.sourceCommit,BASE_SOURCE);assert.equal(startup.innerReport.baseComparison,'r02');assert.equal(startup.innerReport.comparison,'r04');assert.equal(startup.innerReport.diagnostic,0);
  if(isR05){assert.equal(startup.source,SOURCE);assert.equal(startup.version,R05_VERSION);assert.equal(startup.report.source.sourceCommit,SOURCE);assert.equal(startup.report.schema,'kaopu/lip-motion@1');assert.equal(startup.report.comparison,'r05');assert(startup.report.ready);assert.deepEqual(startup.report.source.modules,q.r05Source.modules);}
  for(const[k,v]of Object.entries(startup.errors))assert.equal(v?.length||0,0,label+' '+k);
  await stage(label+' drain original startup GPU queue',()=>p.evaluate(()=>{const gl=__IDENTITY_QA__.viewer().renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));if(gl.getError()||gl.isContextLost())throw Error('Original startup GPU queue failed');}));
  await p.evaluate(installFrameHarness);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await p.evaluate(({width,height})=>__R06_VERIFY__.size(width,height),{width,height});
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
  // Track both existing owners even between suppressed diagnostic updates.
  // Actual drawGeometry.materialSlots still comes from the rendered mesh below.
  const initialMaterials=[v.skin.material,headProceduralSkin.material()].map(mat=>({mat,compile:mat.onBeforeCompile,key:mat.customProgramCacheKey}));
  const initialUniformMaps={native:v.renderer.properties.get(v.skin.material).uniforms,skin:v.renderer.properties.get(headProceduralSkin.material()).uniforms};
  const hash=async a=>a?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(a.buffer,a.byteOffset,a.byteLength))),x=>x.toString(16).padStart(2,'0')).join(''):null;
  function withoutRender(label,fn){const d=Object.getOwnPropertyDescriptor(v,'render'),old=v.render,frame=v.renderer.info.render.frame;let suppressed=0;
    try{Object.defineProperty(v,'render',{configurable:true,writable:true,value(){suppressed++;}});return fn();}
    finally{if(d)Object.defineProperty(v,'render',d);else delete v.render;interventions.push({label,suppressedCalls:suppressed,frameBefore:frame,frameAfter:v.renderer.info.render.frame,functionRestored:v.render===old});if(v.render!==old||v.renderer.info.render.frame!==frame)throw Error('Temporary render suppression was not contained');}}
  function size(w,h){return withoutRender('controlled framebuffer',()=>{v.renderer.setPixelRatio(1);v.renderer.setSize(w,h,false);v.camera.aspect=w/h;v.camera.updateProjectionMatrix();});}
  function desired(name,progress=1){const p={...baselinePose};for(const k of Object.keys(p))if(k!=='schema')p[k]=0;
    if(!Number.isFinite(progress)||progress<0||progress>1)throw Error('Unknown action progress');
    if(name==='jaw')p.jawOpen=.36;else if(name==='speak')Object.assign(p,{jawOpen:.36,upperRaise:.2,lowerDepress:.12});else if(name==='pucker')Object.assign(p,{jawOpen:.06,pucker:.82,seal:.24});else if(name!=='neutral')throw Error('Unknown fixed pose');
    for(const k of Object.keys(p))if(k!=='schema')p[k]*=progress;return p;}
  function poseView(name,view,progress=1){return withoutRender('pose/view '+name+'/'+view+'/'+progress,()=>{
    window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();
    if(window.motionLip){motionLip.pose(name,progress);motionLip.view(view);}else{if(progress!==1)throw Error('Independent R04 only uses original full poses');innerLip.pose(name);innerLip.view(view);}
    const p=lipWorkbench.pose();for(const[k,x]of Object.entries(desired(name,progress)))if(p[k]!==x)throw Error('Actual native pose differs: '+k);return p;});}
  function compare(mode){return withoutRender('variant '+mode,()=>{if(!window.motionLip)throw Error('No R05 controls');return motionLip.compare(mode);});}
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
    const mats=Array.isArray(v.mesh.material)?v.mesh.material:[v.mesh.material];
    return{geometry:{attributes,index:await hash(g.index.array),vertices:g.attributes.position.count,canonicalPositions:await hash(m.positions),canonicalFaces:await hash(m.faces)},
      drawGeometry:{attributes:drawAttributes,index:await hash(draw.index.array),vertices:draw.attributes.position.count,groups:draw.groups.map(group=>({...group})),
        materialSlots:mats.map((mat,index)=>({index,type:mat.type,name:mat.name,native:mat===v.skin.material,procedural:mat===headProceduralSkin.material()}))},
      materials:await materials(),modelState:structuredClone(m.state),pose:lipWorkbench.pose(),ownerBeforeJaw:ls.performance.ownerBeforeJaw,dna:lipWorkbench.dna(),nativeLip:lipWorkbench.settings(),
      head:headProceduralSkin.settings(),body:bodyProceduralSkin.settings(),baseLip:lipRealism.settings(),baseComparison:lipRealism.report().comparison,
      innerLip:{comparison:innerLip.report().comparison,diagnostic:innerLip.report().diagnostic},
      calibration:{reference:await hash(c.reference),horizontal:await hash(c.referenceHorizontal),lastKey:c.lastKey,count:c.topology.count},
      nativeEvaluation:{beforeLocalBase:await hash(c.base)},
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
  window.__R06_VERIFY__={size,poseView,compare,state,align,nativeUniforms,shaders,report,
    diagnosticUpdate:mode=>withoutRender('corner diagnostic '+mode,()=>{__R06_CORNER_DIAG__.setMode(mode);v.update();}),
    restoreDiagnostic:()=>withoutRender('restore original R05 evaluator',()=>{const restored=__R06_CORNER_DIAG__.restore();v.update();return{restored,after:__R06_CORNER_DIAG__.report()};}),
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
async function state(){return page.evaluate(()=>__R06_VERIFY__.state());}
async function closePage(p,label){if(!p||p.isClosed())return;const r=await bounded(label+' GPU drain',()=>p.evaluate(()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench?.stop?.();const renderer=window.__IDENTITY_QA__?.viewer?.()?.renderer;if(!renderer)return{available:false};const gl=renderer.getContext(),before=gl.getError(),lost=gl.isContextLost(),frame=renderer.info.render.frame;gl.finish();if(gl.drawingBufferWidth&&gl.drawingBufferHeight)gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));return{available:true,before,after:gl.getError(),lostBefore:lost,lostAfter:gl.isContextLost(),frameBefore:frame,frameAfter:renderer.info.render.frame};}),90000);
  if(r.available){assert.equal(r.before,0);assert.equal(r.after,0);assert.equal(r.lostBefore,false);assert.equal(r.lostAfter,false);assert.equal(r.frameBefore,r.frameAfter);}
  await bounded(label+' close page',()=>p.close({runBeforeUnload:false}),15000);assert(p.isClosed());q.closedPages||=[];q.closedPages.push({label,gpu:r,closed:true});checkpoint();}
async function cleanup(){const start=Date.now(),errors=[];for(const c of browser?.contexts()||[])for(const p of c.pages())try{await closePage(p,'final cleanup');}catch(e){errors.push(String(e));}
  try{if(browser)await bounded('close final browser',()=>browser.close(),15000);}catch(e){errors.push(String(e));}
  q.cleanup={completed:errors.length===0,browserDisconnected:!browser||!browser.isConnected(),errors,elapsedMS:Date.now()-start};checkpoint();assert(q.cleanup.completed&&q.cleanup.browserDisconnected,'Bounded browser cleanup failed');}
// Only these four evaluated attribute arrays may respond to the native solver.
// Keep canonical arrays, topology, semantic inputs, all material authoring,
// original function identity, camera and every light field in the exact gate.
function protectedState(s){const x=structuredClone(s);for(const name of['geometry','drawGeometry'])for(const key of['position','normal','l19State','l19Detail'])delete x[name].attributes[key];return x;}
function assertNativeState(s){
  assert(s.functionsOriginal,'Original native viewer functions changed');
  assert(s.materials.length&&s.materials.every(x=>x.sameOriginalObject&&x.sameOriginalCompileHook&&x.sameOriginalCacheKey),'Original material object or shader hook changed');
  assert.equal(s.innerLip.comparison,'r04');assert.equal(s.innerLip.diagnostic,0);assert.equal(s.baseComparison,'r02');assert.equal(s.baseLip.diagnostic,0);
}
async function shaderRecord(label,save=false){
  const data=await page.evaluate(()=>__R06_VERIFY__.shaders());assert(data.linked);assert(data.expanded.length>=2&&data.expanded.every(x=>x.compiled&&x.source),'Actual expanded compiled GLSL absent');
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
function checkSolver(report,mode){
  assert.equal(report.comparison,mode);assert.equal(report.implementation,report.solver.version);assert(report.ready);assert.equal(report.innerComparison,'r04');
  const s=report.solver;assert(s.installed&&s.valid);assert.equal(s.enabled,mode==='r05');assert.equal(s.errors.length,0);
  if(mode==='r05'){assert(s.last?.completed&&s.last?.hooksRestored,'Native motion stage or temporary-hook restoration incomplete');assert.equal(s.last.localBoundaryCalls,1);assert.equal(s.last.closureBoundaryCalls,1);assert(Number.isFinite(s.last.maxLocalCorrectionMM)&&Number.isFinite(s.last.maxClosureCorrectionMM));}
}
function checkDiagnostic(report,mode){
  assert.equal(report.mode,mode);assert.equal(report.errors.length,0,'Diagnostic reported an error');
  const last=report.lastExecution;assert(last&&last.mode===mode,'No actual execution for selected component');
  assert(last.completed&&last.innerHooksRestored,'Diagnostic stage or temporary-hook restoration incomplete');
  assert(last.beforeLocalExact&&last.entryNativeBeforeLocalExact,'Native before-local input differs from the pristine pucker base');
  assert(last.centerDirectDeltaZero,'Diagnostic directly changed the protected centre');assert.equal(last.pairMapCalls,1);
  assert(last.directChangedVertices>0,'Selected native component made no direct position intervention');
  assert(Number.isFinite(last.maxDirectCorrectionMM)&&last.maxDirectCorrectionMM>0);
}
let helperInstalled=false,restorationCompleted=false;
async function attributionChecks(){
  const primary=await load(PUBLIC_URL,'fixed R05');page=primary.page;
  let baseline,baselineState,baselineReport,baselineShader;
  await test('pristine actual R05 pucker and observational helper installation',async()=>{
    await page.evaluate(()=>{__R06_VERIFY__.compare('r05');__R06_VERIFY__.poseView('pucker','oblique',1);});
    baseline=await capture('pucker-oblique-r05-baseline');baselineState=await state();assertNativeState(baselineState);
    baselineReport=await page.evaluate(()=>motionLip.report());checkSolver(baselineReport,'r05');
    assert.equal(baselineState.pose.pucker,.82);assert.equal(baselineState.pose.jawOpen,.06);assert.equal(baselineState.pose.seal,.24);
    for(const[key,value]of Object.entries(baselineState.pose))if(!['schema','pucker','jawOpen','seal'].includes(key))assert.equal(value,0,'Unexpected local action: '+key);
    assert(baselineState.nativeEvaluation.beforeLocalBase,'Original native before-local buffer absent');
    baselineShader=await shaderRecord('r05-original',true);q.baseline={frameSHA256:baseline.sha256,state:baselineState,report:baselineReport,shader:baselineShader};
    const frameBefore=await page.evaluate(()=>__R06_VERIFY__.renderedFrame());
    await page.addScriptTag({content:fs.readFileSync(helperPath,'utf8')});helperInstalled=true;
    const helper=await page.evaluate(()=>__R06_CORNER_DIAG__.report());assert.equal(helper.mode,'baseline');assert.equal(helper.errors.length,0);assert(helper.originalApplyDescriptorRestored,'Baseline helper changed the R05 evaluator owner');
    assert.deepEqual(await state(),baselineState,'Installing baseline helper changed the native person or draw state');
    assert.equal(await page.evaluate(()=>__R06_VERIFY__.renderedFrame()),frameBefore,'Helper installation submitted a native frame');
    const observed=await page.evaluate(()=>{const v=__IDENTITY_QA__.viewer(),m=__IDENTITY_QA__.model(),g=m.lipStructure.mother.surfaces.get(v.currentLip.geometry).topology.geometry;return{boundary:__R06_CORNER_DIAG__.boundaryEdges(),nativeIndexCount:g.index.count,nativeVertices:g.attributes.position.count};});
    const boundary=observed.boundary;
    assert.equal(boundary.schema,'kaopu/r06-native-active-boundary@1');assert.equal(boundary.available,true);
    assert.equal(boundary.source,'top.geometry.index (all original native triangles)');assert(Number.isInteger(boundary.indexCount)&&boundary.indexCount>0&&boundary.indexCount%3===0);
    assert.equal(boundary.indexCount,observed.nativeIndexCount,'Boundary scan used a different index domain');assert.equal(boundary.scannedTriangles,boundary.indexCount/3);assert(Number.isInteger(boundary.crossActiveEdges)&&boundary.crossActiveEdges>=0);
    assert(Number.isInteger(boundary.skinCrossActiveEdges)&&boundary.skinCrossActiveEdges>=0);assert(Number.isInteger(boundary.candidateEdges)&&boundary.candidateEdges>=0);
    assert(Array.isArray(boundary.edges));assert.equal(boundary.returnedEdges,boundary.edges.length);
    json('corner-boundary-edges.json',boundary);const boundaryBytes=fs.readFileSync(path.join(out,'corner-boundary-edges.json'));
    q.boundaryEdges={file:'corner-boundary-edges.json',sha256:sha(boundaryBytes),bytes:boundaryBytes.length,schema:boundary.schema,source:boundary.source,
      indexCount:boundary.indexCount,nativeVertices:observed.nativeVertices,scannedTriangles:boundary.scannedTriangles,crossActiveEdges:boundary.crossActiveEdges,skinCrossActiveEdges:boundary.skinCrossActiveEdges,candidateEdges:boundary.candidateEdges,returnedEdges:boundary.returnedEdges,
      scope:'Read-only original-index boundary evidence; magnitudes and projected endpoints do not establish the visible cause by themselves.'};
    assert.deepEqual(await state(),baselineState,'Boundary observation changed native person or draw state');
    assert.equal(await page.evaluate(()=>__R06_VERIFY__.renderedFrame()),frameBefore,'Boundary observation submitted a native frame');
    q.installedDiagnostic=helper;checkpoint();return{pristineNativeFrame:true,helperInstallationStateAndRenderExact:true,boundaryEvidence:q.boundaryEdges};
  });
  q.geometryMutationScope={allowedAttributeLeaves:['geometry.attributes.position','geometry.attributes.normal','geometry.attributes.l19State','geometry.attributes.l19Detail','drawGeometry.attributes.position','drawGeometry.attributes.normal','drawGeometry.attributes.l19State','drawGeometry.attributes.l19Detail'],
    beforeLocalBase:false,canonicalPositions:false,canonicalFaces:false,indices:false,groups:false,semanticInputArrays:false,material:false,shader:false,camera:false,lighting:false};
  q.counterfactuals=[];
  for(const mode of['no-x','no-front','no-compensation'])await test('single native corner component '+mode,async()=>{
    await page.evaluate(mode=>__R06_VERIFY__.diagnosticUpdate(mode),mode);
    const alignment=await page.evaluate(reference=>__R06_VERIFY__.align(reference),baselineState);
    const frame=await capture('pucker-oblique-corner-'+mode),actual=await state();assertNativeState(actual);
    assert.deepEqual(protectedState(actual),protectedState(baselineState),'Corner counterfactual changed protected native state');
    const report=await page.evaluate(()=>__R06_CORNER_DIAG__.report());checkDiagnostic(report,mode);
    const r05=await page.evaluate(()=>motionLip.report());checkSolver(r05,'r05');assert.deepEqual(r05.solver.calibration,baselineReport.solver.calibration,'R05 ownership calibration changed');
    assert.deepEqual(r05.pose,baselineReport.pose,'Counterfactual changed declared native action');
    const shader=await shaderRecord('corner-'+mode);assert.deepEqual(shaderFingerprint(shader),shaderFingerprint(baselineShader),'Counterfactual changed original material GLSL or native uniform ownership');
    const delta=difference(baseline,frame),entry={mode,frameSHA256:frame.sha256,state:actual,diagnostic:report,r05,alignment,shader,difference:delta,
      declaredPoseExact:true,protectedStateExact:true,originalMaterialShaderUniformsExact:true,r05OwnershipCalibrationExact:true};
    q.counterfactuals.push(entry);checkpoint();return{mode,...delta,directChangedVertices:report.lastExecution.directChangedVertices,maxDirectCorrectionMM:report.lastExecution.maxDirectCorrectionMM,
      centreDirectDeltaZero:true,beforeLocalBaseExact:true,allOtherNativeInputsExact:true,r05StillEnabled:true};
  });
  await test('exact original R05 evaluator state shader and pixels restored',async()=>{
    const result=await page.evaluate(()=>__R06_VERIFY__.restoreDiagnostic());
    assert(result.restored.originalApplyDescriptorRestored&&result.after.originalApplyDescriptorRestored,'Original R05 solver.apply descriptor was not restored');
    assert.equal(result.after.mode,'baseline');assert.equal(result.after.errors.length,0);
    const alignment=await page.evaluate(reference=>__R06_VERIFY__.align(reference),baselineState);
    const restored=await capture('pucker-oblique-r05-exact-restored'),actual=await state();assertNativeState(actual);
    assert.deepEqual(actual,baselineState,'Full native state differs after restoration');assert.equal(restored.sha256,baseline.sha256,'Actual pixels differ after restoring the original R05 evaluator');
    const r05=await page.evaluate(()=>motionLip.report());checkSolver(r05,'r05');assert.deepEqual(r05.solver.calibration,baselineReport.solver.calibration);assert.deepEqual(r05.pose,baselineReport.pose);
    const shader=await shaderRecord('r05-restored');assert.deepEqual(shaderFingerprint(shader),shaderFingerprint(baselineShader),'Restored actual original material/shader/uniforms differ');
    q.restoration={...result,alignment,frameSHA256:restored.sha256,nativeStateExact:true,nativePixelsExact:true,originalActualShaderExact:true,r05,shader};restorationCompleted=true;
    q.interventions=await page.evaluate(()=>__R06_VERIFY__.report());assert(q.interventions.functionsOriginal);
    checkpoint();return{originalR05EvaluatorDescriptorExact:true,nativeStateExact:true,nativePixelsExact:true,originalActualShaderExact:true};
  });
  assert.equal(q.frames.length,5);assert.equal(q.frames.filter(x=>x.saved).length,5);assert.equal(q.counterfactuals.length,3);
  q.runtimeErrors=await page.evaluate(()=>({motion:window.__LIP_MOTION__?.errors||[],solver:__LIP_MOTION_SOLVER__.report().errors,diagnostic:__R06_CORNER_DIAG__.report().errors}));
  for(const[name,errors]of Object.entries(q.runtimeErrors))assert.equal(errors.length,0,'Final runtime '+name+' errors');
}
(async()=>{
  fatalTimer=setTimeout(()=>terminated('Bounded corner attribution deadline exceeded',124),budgetMS);
  try{
    const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
    browser=await chromium.launch(options);context=await browser.newContext({viewport:q.browserViewport,deviceScaleFactor:1});
    await test('immutable public R05 bytes and reviewed native component anchors',provenance);await context.close();
    await attributionChecks();
    for(const key of['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key);
    q.completed=true;q.publicHttpsPassed=true;q.browserPassed=true;
  }catch(error){q.completed=false;q.failure=String(error);q.stack=error.stack;process.exitCode=1;console.error(error);checkpoint();}
  finally{
    if(helperInstalled&&!restorationCompleted&&page&&!page.isClosed()){
      try{q.failureContainment=await page.evaluate(()=>__R06_VERIFY__.restoreDiagnostic());}
      catch(error){q.restorationError=String(error);q.completed=false;process.exitCode=1;}
    }
    if(page&&!page.isClosed())try{q.finalReports=await page.evaluate(()=>({r05:window.motionLip?.report?.()||null,diagnostic:window.__R06_CORNER_DIAG__?.report?.()||null,harness:window.__R06_VERIFY__?.report?.()||null}));}catch(error){q.reportError=String(error);q.completed=false;process.exitCode=1;}
    q.verificationFinishedAt=new Date().toISOString();checkpoint();
    try{await cleanup();}catch(error){q.cleanupError=String(error);q.completed=false;process.exitCode=1;}
    clearTimeout(fatalTimer);q.finishedAt=new Date().toISOString();q.shareAllowed=false;q.visualAcceptance=false;q.productionReady=false;q.productionRepair=false;json('qa.json',q);
    console.log(JSON.stringify({completed:q.completed,tests:q.tests.map(x=>({name:x.name,passed:x.passed})),savedFrames:q.frames.filter(x=>x.saved).length,readbacks:q.frames.length,failure:q.failure||q.restorationError||q.cleanupError||null,output:out}));
    if(q.cleanupError)process.exit(1);
  }
})();
