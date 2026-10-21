'use strict';
// CI reproduction of local candidate transactions. Does not publish or claim public validation.
// All remote resources use direct browser HTTPS with normal TLS verification;
// only the exact immutable R08 preview URL is fulfilled from hash-locked local bytes.
// The complete native-state harness and readPixels encoder below derive from
// the hash-locked R08 public verifier, with only its draw call routed through
// a bounded synchronous fragment transaction. Product controllers stay intact.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),{PNG}=require('pngjs');
const width=640,height=512;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const recipePath=path.resolve(process.argv[2]||'');
assert(process.argv[2],'Usage: node native-session.cjs RECIPES.json [OUTPUT_DIRECTORY]');
const rawRecipe=fs.readFileSync(recipePath),recipe=JSON.parse(rawRecipe);
assert.equal(recipe.schema,'kaopu/lip-r09-native-experiments@1');
assert(Array.isArray(recipe.cases)&&recipe.cases.length>=1&&recipe.cases.length<=2,'One or two bounded candidates required');
const seen=new Set();for(const c of recipe.cases){assert(/^[a-z0-9][a-z0-9-]{0,70}$/.test(c.id)&&!seen.has(c.id),'Unique safe case ID required');seen.add(c.id);assert(Array.isArray(c.patches)&&c.patches.length>=1&&c.patches.length<=8);for(const p of c.patches)assert(typeof p.id==='string'&&p.id&&typeof p.from==='string'&&p.from&&typeof p.to==='string'&&p.to&&p.to!==p.from,'Literal nonempty patch required');c.sha256=sha(JSON.stringify(c.patches));}
const matrix=recipe.matrix||[{pose:'neutral',view:'macro',progress:1}];
assert(matrix.length>=1&&matrix.length<=7,'Bounded static matrix required');
assert(process.env.BASELINE_PREVIEW_PATH,'Set BASELINE_PREVIEW_PATH to the immutable R08 preview.html in the CI checkout');
const previewPath=path.resolve(process.env.BASELINE_PREVIEW_PATH);
const preview=fs.readFileSync(previewPath),expectedPreview='dcb126c2cca5671ccd541e938705816afb190af791c88c322504db1dd6d12222';
assert.equal(sha(preview),expectedPreview,'Immutable R08 preview bytes differ');
const revive=(key,value)=>value&&typeof value==='object'&&Object.keys(value).length===1&&value.__qaNonFiniteNumber?(value.__qaNonFiniteNumber==='Infinity'?Infinity:value.__qaNonFiniteNumber==='-Infinity'?-Infinity:NaN):value;
assert(process.env.BASELINE_QA_PATH,'Set BASELINE_QA_PATH to the immutable R08 candidate-02 qa.json in the CI checkout');
const publicQAPath=path.resolve(process.env.BASELINE_QA_PATH),publicQABytes=fs.readFileSync(publicQAPath);
assert.equal(sha(publicQABytes),'43b40dad41380ebacb8e4865558850e62410c1ab8b5ef5ec7734a28a6dfb874d');
const publicQA=JSON.parse(publicQABytes,revive);
for(const c of matrix){assert(publicQA.comparisons.some(x=>x.pose===c.pose&&x.view===c.view&&x.progress===(c.progress??1)),'Each pose/view must have a frozen original public reference');}
const RAW='https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/dcded3a1b471d32ce191296939b6266e6d41e62a/kaopu-unified-human-workbench/lip-surface-r08/preview.html';
const URL='https://htmlpreview.github.io/?'+RAW;
const out=path.resolve(process.argv[3]||path.join(__dirname,'runs',new Date().toISOString().replace(/[:.]/g,'-')));
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'recipes.json'),rawRecipe);
const q={schema:'kaopu/lip-r09-native-local-experiment@1',startedAt:new Date().toISOString(),mode:'local-candidate-transactions',baseline:{sourceCommit:'70457c86c20e724235705ff45fd919ac822dba8e',buildCommit:'dcded3a1b471d32ce191296939b6266e6d41e62a',previewSHA256:expectedPreview,publicQASHA256:sha(publicQABytes),route:RAW,routeCount:0},runnerSHA256:sha(fs.readFileSync(__filename)),recipeSHA256:sha(rawRecipe),sourceVerifierSHA256:'cf3dd4372f682a71721a1fcaf798c311d2673cb01f47101ebd6bf023bba682ce',frames:[],transactions:[],pageErrors:[],consoleErrors:[],failedRequests:[],resourceErrors:[],completed:false,visualAcceptance:false,productionReady:false,publicHttpsPassed:false,shareAllowed:false,temporalStabilityTested:false,limitations:['Local routed exact baseline; this is not public publication QA.','Remote dependencies use direct browser HTTPS with normal TLS verification. The preview is locally routed, so this run does not establish public candidate publication or share permission.','Only static native frames; no continuous-motion claim.','Pixel difference measures a response, never aesthetics.','Transient compile/key wrappers exist only during the synchronous original draw; restored before native/controller snapshots.']};
let browser,page,context,rawEvaluate,aborted=false,rendererReady=false,sessionInitialized=false;
function replacer(key,value){return typeof value==='number'&&!Number.isFinite(value)?{__qaNonFiniteNumber:Number.isNaN(value)?'NaN':value===Infinity?'Infinity':'-Infinity'}:value;}
function json(name,value){const p=path.join(out,name);fs.writeFileSync(p+'.tmp',JSON.stringify(value,replacer,2)+'\n');fs.renameSync(p+'.tmp',p);}
function checkpoint(){q.updatedAt=new Date().toISOString();json('qa.partial.json',q);}
function progress(name,event,extra={}){const r={at:new Date().toISOString(),name,event,...extra};fs.appendFileSync(path.join(out,'progress.jsonl'),JSON.stringify(r)+'\n');console.log(JSON.stringify(r));checkpoint();}
async function bounded(name,fn,ms=120000){if(aborted)throw Error('Experiment already aborted');let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(name+' exceeded '+ms+' ms')),ms);})]);}finally{clearTimeout(timer);}}
async function stage(name,fn){const start=Date.now();progress(name,'start');try{const r=await fn();progress(name,'end',{elapsedMS:Date.now()-start});return r;}catch(e){progress(name,'failure',{error:String(e),elapsedMS:Date.now()-start});throw e;}}
function errorText(e){return String(e);}
function applyPatches(text,patches,reverse=false){let result=text;for(const p of(reverse?[...patches].reverse():patches)){const from=reverse?p.to:p.from,to=reverse?p.from:p.to;assert.equal(result.split(from).length,2,'Nonunique literal '+p.id+(reverse?' reverse':''));result=result.replace(from,()=>to);}return result;}
function sources(raw){return Object.fromEntries(raw.expanded.map(x=>[x.type,x.source]));}
function shaderRecord(name,raw){assert(raw.linked&&raw.expanded.every(x=>x.compiled));const record={nativeUniforms:raw.nativeUniforms,activeUniforms:raw.activeUniforms,templates:raw.templates,surfaceTemplates:raw.surfaceTemplates,expanded:[]};for(const s of raw.expanded){const file=name+'-'+s.type+'.glsl';fs.writeFileSync(path.join(out,file),s.source);record.expanded.push({file,type:s.type,sha256:sha(s.source),compiled:s.compiled,bytes:Buffer.byteLength(s.source)});}return record;}
function proveShader(base,actual,patches){const a=sources(base),b=sources(actual);assert.equal(b.vertex,a.vertex,'Actual vertex shader changed');assert.equal(b.fragment,applyPatches(a.fragment,patches),'Actual fragment changed outside declared literals');assert.equal(applyPatches(b.fragment,patches,true),a.fragment,'Actual GPU reverse failed');assert.deepEqual(actual.activeUniforms,base.activeUniforms,'Active GPU uniforms changed');assert.deepEqual(actual.nativeUniforms,base.nativeUniforms,'Native uniform object/value identity changed');assert.deepEqual(actual.templates,base.templates,'Inherited R04 templates changed');return{actualVertexExact:true,actualFragmentOnlyDeclaredPatches:true,reverseActualGPUPatchesExact:true,allActiveUniformsExact:true,nativeUniformIdentityAndValuesExact:true,inheritedTemplatesExact:true};}
function installTransactions(){
 const v=__IDENTITY_QA__.viewer(),mat=headProceduralSkin.material(),compileDescriptor=Object.getOwnPropertyDescriptor(mat,'onBeforeCompile'),keyDescriptor=Object.getOwnPropertyDescriptor(mat,'customProgramCacheKey'),baseCompile=mat.onBeforeCompile,baseKey=mat.customProgramCacheKey;
 let active=null,last=null;
 const same=()=>mat.onBeforeCompile===baseCompile&&mat.customProgramCacheKey===baseKey;
 function set(r){if(!same())throw Error('Original material hook owner changed');active=r;return{active:r?.id||null};}
 function draw(){
  if(!same())throw Error('Original material hook owner changed before transaction');
  const recipe=active,records=[],oldRender=v.render,versionBefore=mat.version;
  try{
   if(recipe){
    Object.defineProperty(mat,'onBeforeCompile',{...compileDescriptor,value:function(shader,...args){
     if(this!==mat)throw Error('Unexpected material owner');Reflect.apply(baseCompile,this,[shader,...args]);
     const originalVertex=shader.vertexShader,originalFragment=shader.fragmentShader,entries=Object.entries(shader.uniforms);
     let next=originalFragment;
     for(const p of recipe.patches){if(next.split(p.from).length!==2)throw Error('Nonunique template anchor '+p.id);next=next.replace(p.from,()=>p.to);}
     shader.fragmentShader=next;
     if(shader.vertexShader!==originalVertex||Object.keys(shader.uniforms).length!==entries.length||entries.some(([k,x])=>shader.uniforms[k]!==x))throw Error('Experimental patch changed inherited shader inputs');
     records.push({originalVertex,finalVertex:shader.vertexShader,originalFragment,finalFragment:next,allUniformObjectsPreserved:true});
    }});
    Object.defineProperty(mat,'customProgramCacheKey',{...keyDescriptor,value:function(){return Reflect.apply(baseKey,mat,[])+'/r09-local/'+recipe.id+'/'+recipe.sha256;}});
   }
   mat.needsUpdate=true;v.render();
  }finally{
   if(compileDescriptor)Object.defineProperty(mat,'onBeforeCompile',compileDescriptor);else delete mat.onBeforeCompile;
   if(keyDescriptor)Object.defineProperty(mat,'customProgramCacheKey',keyDescriptor);else delete mat.customProgramCacheKey;
   mat.needsUpdate=true;
   last={caseId:recipe?.id||null,records,compileExecuted:records.length>0,cachedProgramPermitted:true,hooksRestored:same(),nativeRenderFunctionRestored:v.render===oldRender,materialVersionBefore:versionBefore,materialVersionAfter:mat.version};
   if(!same()||v.render!==oldRender)throw Error('Synchronous shader transaction failed to restore ownership');
  }
 }
 window.__R09_EXP__={set,draw,report:()=>last,stable:same};return{ready:true};
}

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
    try{window.__R09_EXP__.draw();}finally{if(d)Object.defineProperty(renderer,'render',d);else delete renderer.render;}
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

async function snapshot(name){const s=await page.evaluate(()=>__LS_VERIFY__.state()),raw=await page.evaluate(()=>__LS_VERIFY__.shaders()),transaction=await page.evaluate(()=>__R09_EXP__.report());assert(s.functionsOriginal);assert(s.materials.every(x=>x.sameOriginalObject&&x.sameOriginalCompileHook&&x.sameOriginalCacheKey));assert(raw.nativeUniforms.length===15&&raw.nativeUniforms.every(x=>x.nativePresent&&x.skinPresent&&x.sameObject&&x.sameNativeObjectSinceHarness&&x.sameSkinObjectSinceHarness));assert(transaction.hooksRestored&&transaction.nativeRenderFunctionRestored);const record={state:s,shader:shaderRecord(name,raw),transaction};json(name+'.json',record);return{s,raw,transaction};}
async function execute(){
 q.transport={mode:'direct-browser-https-with-exact-local-preview-route',APITransport:false,ignoreHTTPSErrors:false,environmentProxyConfigured:false,trustStoreModified:false,publicHttpsPassed:false,shareAllowed:false};
 q.baseline.localPreviewPath=previewPath;q.baseline.localQAPath=publicQAPath;checkpoint();
 const options={headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']};if(process.env.CHROMIUM_EXECUTABLE)options.executablePath=process.env.CHROMIUM_EXECUTABLE;
 browser=await chromium.launch(options);q.browserVersion=browser.version();context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,acceptDownloads:false,ignoreHTTPSErrors:false,serviceWorkers:'block'});
 await context.route(RAW,async route=>{q.baseline.routeCount++;await route.fulfill({status:200,headers:{'content-type':'text/plain; charset=utf-8','access-control-allow-origin':'*'},body:preview});});
 page=await context.newPage();page.setDefaultTimeout(30000);rawEvaluate=page.evaluate.bind(page);page.evaluate=(...args)=>bounded('browser evaluation',()=>rawEvaluate(...args));
 page.on('pageerror',e=>{q.pageErrors.push(String(e));checkpoint();});page.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text())){q.consoleErrors.push(m.text());checkpoint();}});
 page.on('requestfailed',r=>{if(!/favicon/i.test(r.url())){q.failedRequests.push({url:r.url(),error:r.failure()?.errorText});checkpoint();}});page.on('response',r=>{if(r.status()>=400&&!/favicon/i.test(r.url())){q.resourceErrors.push({url:r.url(),status:r.status()});checkpoint();}});
 await stage('load exact local R08 at explicit routed source URL',async()=>{const r=await page.goto(URL,{waitUntil:'domcontentloaded',timeout:90000});assert.equal(r.status(),200);await page.waitForFunction(()=>{for(const k of ['__HEAD_PROC__','__LIP_REALISM__','__LIP_INNER__','__LIP_MOTION__','__LIP_CORNER__','__LIP_SURFACE__','__LIP_P3__'])if(window[k]?.errors?.length)return true;return window.surfaceLip?.ready===true;},{},{timeout:360000});const startup=await page.evaluate(()=>({source:document.documentElement.dataset.lipSurfaceSource,ready:surfaceLip.ready,report:surfaceLip.report(),rendererReady:typeof window.__IDENTITY_QA__?.viewer?.()?.renderer?.getContext==='function',finalFrame:__IDENTITY_QA__.viewer().startupFinalFrame,errors:Object.fromEntries(['__HEAD_PROC__','__LIP_REALISM__','__LIP_INNER__','__LIP_MOTION__','__LIP_CORNER__','__LIP_SURFACE__','__LIP_P3__'].map(k=>[k,window[k]?.errors||[]]))}));q.startup=startup;rendererReady=startup.rendererReady===true;q.lifecycle={rendererReady,sessionInitialized};assert(rendererReady&&startup.ready&&startup.finalFrame);assert.equal(startup.source,q.baseline.sourceCommit);assert.equal(startup.report.implementation,'native-lip-surface@2');assert.equal(startup.report.comparison,'r08');for(const e of Object.values(startup.errors))assert.equal(e.length,0);assert(q.baseline.routeCount>0,'Exact local source route was not used');});
 await stage('stop original idle and drain startup GPU',()=>page.evaluate(()=>{window.lifelikeIdle?.pause?.();window.lipWorkbench.stop?.();const v=__IDENTITY_QA__.viewer();v.orbit.autoRotate=false;v.orbit.enableDamping=false;const gl=v.renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));if(gl.getError()||gl.isContextLost())throw Error('Startup GPU drain failed');}));
 await page.screenshot({path:path.join(out,'baseline-workbench-ui.png'),timeout:60000});q.naturalUI={file:'baseline-workbench-ui.png',sha256:sha(fs.readFileSync(path.join(out,'baseline-workbench-ui.png'))),baselineOnly:true,actualBrowserScreenshot:true};
 await page.evaluate(installFrameHarness);await page.evaluate(installTransactions);sessionInitialized=true;q.lifecycle={rendererReady,sessionInitialized};
 q.gpuContext=await page.evaluate(()=>{const gl=__IDENTITY_QA__.viewer().renderer.getContext();return{attributes:gl.getContextAttributes(),samples:gl.getParameter(gl.SAMPLES),sampleBuffers:gl.getParameter(gl.SAMPLE_BUFFERS),alphaBits:gl.getParameter(gl.ALPHA_BITS)};});checkpoint();
 await page.evaluate(({width,height})=>__LS_VERIFY__.size(width,height),{width,height});
 for(const target of matrix){
  const progressValue=target.progress??1,label=target.pose+'-'+target.view,reference=publicQA.comparisons.find(x=>x.pose===target.pose&&x.view===target.view&&x.progress===progressValue);
  await stage('prepare '+label,()=>page.evaluate(({target,reference})=>{__R09_EXP__.set(null);__LS_VERIFY__.poseView(target.pose,target.view,target.progress??1);return __LS_VERIFY__.align(reference);},{target,reference:reference.onState}));
  const baseline=await capture(label+'-r08-baseline'),before=await snapshot(label+'-r08-baseline');
  assert.equal(baseline.sha256,reference.onSHA256,'Actual baseline pixels differ from frozen public R08 '+label);assert.deepEqual(before.s,reference.onState,'Actual baseline native state differs from frozen public R08 '+label);
  for(const c of recipe.cases){
   const startedAt=new Date().toISOString(),entry={id:c.id,pose:target.pose,view:target.view,progress:progressValue,startedAt,patchSHA256:c.sha256,completed:false};q.transactions.push(entry);checkpoint();
   await page.evaluate(c=>__R09_EXP__.set(c),c);
   try{
    const candidate=await capture(label+'-'+c.id),after=await snapshot(label+'-'+c.id);assert.deepEqual(after.s,before.s,'Candidate changed complete native/draw/material/control/camera/light state '+c.id);
    const proof=proveShader(before.raw,after.raw,c.patches);entry.proof={...proof,completeNativeStateExact:true};entry.difference=difference(baseline,candidate);entry.baselineFrame=baseline.name;entry.candidateFrame=candidate.name;entry.frameSHA256=candidate.sha256;entry.pngSHA256=candidate.pngSHA256;entry.transaction=after.transaction;entry.completed=true;
   }finally{
    await page.evaluate(()=>__R09_EXP__.set(null));const restored=await capture(label+'-'+c.id+'-restored',false),restoredState=await snapshot(label+'-'+c.id+'-restored');
    assert.deepEqual(restoredState.s,before.s,'Restoring candidate changed complete native state');proveShader(before.raw,restoredState.raw,[]);assert.equal(restored.sha256,baseline.sha256,'Restored native pixels differ');entry.restoration={completeNativeStateExact:true,actualShaderAndUniformsExact:true,pixelsExact:true,hooksExact:true,frameSHA256:restored.sha256};checkpoint();
   }
  }
 }
 for(const key of ['pageErrors','consoleErrors','failedRequests','resourceErrors'])assert.equal(q[key].length,0,key);assert.equal((await context.cookies()).length,0,'Browser acquired cookies');q.completed=true;
}
async function cleanupDeadline(name,fn){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(name+' deadline')),15000);})]);}finally{clearTimeout(timer);}}
async function cleanup(){
 const started=Date.now(),errors=[],gpuDrain={attempted:false,completed:false};
 if(!rendererReady){gpuDrain.skippedWithReason='Renderer initialization was not established; no native session GPU or hook drain is claimed.';}
 else{
  gpuDrain.attempted=true;
  try{
   assert(page&&!page.isClosed(),'Initialized renderer page closed before GPU drain');
   const drained=await cleanupDeadline('cleanup GPU',()=>rawEvaluate(expectedSession=>{
    if(expectedSession&&!window.__R09_EXP__)throw Error('Initialized transaction session is missing during cleanup');
    if(window.__R09_EXP__)__R09_EXP__.set(null);
    const v=window.__IDENTITY_QA__?.viewer?.();if(!v?.renderer)throw Error('Previously initialized renderer is missing during cleanup');
    window.lifelikeIdle?.pause?.();window.lipWorkbench?.stop?.();
    const gl=v.renderer.getContext();gl.finish();gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
    if(gl.getError()||gl.isContextLost())throw Error('Final GPU drain failed');
    return{hooksRestored:window.__R09_EXP__?.stable?.()??!expectedSession};
   },sessionInitialized));assert(drained.hooksRestored);Object.assign(gpuDrain,drained,{completed:true});
  }catch(e){gpuDrain.failure=String(e);errors.push(String(e));}
 }
 try{if(browser)await cleanupDeadline('browser close',()=>browser.close());}catch(e){errors.push(String(e));}
 const browserDisconnected=!browser||!browser.isConnected();q.lifecycle={rendererReady,sessionInitialized};
 q.cleanup={completed:errors.length===0&&browserDisconnected,rendererReady,sessionInitialized,gpuDrain,browserDisconnected,errors,elapsedMS:Date.now()-started};if(!q.cleanup.completed)q.completed=false;
}
(async()=>{let deadline;try{const budget=Number(process.env.QA_BUDGET_MS||900000);assert(budget>=120000&&budget<=1200000);await Promise.race([execute(),new Promise((_,reject)=>{deadline=setTimeout(()=>{aborted=true;reject(Error('Overall experiment deadline exceeded'));},budget);})]);}catch(e){q.failure=errorText(e);q.stack=errorText(e.stack);q.completed=false;process.exitCode=1;console.error(q.failure);}finally{clearTimeout(deadline);aborted=true;await cleanup();for(const key of ['pageErrors','consoleErrors','failedRequests','resourceErrors'])if(q[key].length)q.completed=false;if(!q.completed)process.exitCode=1;q.finishedAt=new Date().toISOString();json('qa.json',q);checkpoint();console.log(JSON.stringify({completed:q.completed,out,frames:q.frames.length,transactions:q.transactions.map(x=>({id:x.id,pose:x.pose,view:x.view,completed:x.completed,restored:!!x.restoration})),failure:q.failure||null,cleanup:q.cleanup}));}})();
