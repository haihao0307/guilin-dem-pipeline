// Same-renderer execution only: no host scene, camera/clock configuration, rAF,
// ray advancement, normal reconstruction, material replacement, or publication.
import {threeFragment, DISPATCH_VERTEX} from '../../glsl-interface.mjs';
import {GEOMETRY_GROUP_NAMES} from '../../geometry-groups.mjs';
import {createShedRayCertificate} from '../../experiments/shed-domain-r01/ray-certificate.mjs';
const TERMINAL_COMPACT_SOURCE='fa540676720626a10de4d1329b3b17aa240ede0e2e51414afc9bf164583801c2';
const SHED_CERTIFIED_SOURCE='588042e14707b2dcab1e890c18fca2afdd20104eaecb7a5d3b25baa71c6a8d36';

/** Fetch generated runtime fragments and create a synchronous 4-MRT query runner.
 *
 * query({width,height,traceTexture,fullHitTexture,offset=[0,0,0],phase=0,skip=0,rects})
 * returns {textures:[a,b,c,e],a,b,c,e,width,height,rects}.
 *
 * All returned textures are transient and valid only until the next query/dispose.
 * Neither input may be a current OR formerly allocated internal write texture.
 * Copy the full query's A into an independently owned target before auto skip.
 * The caller configures the shared u/frame once and must not mutate them mid-query.
 * Rectangles use bottom-left integer pixels, like the existing receiver. Results
 * outside the returned rectangles are unspecified; no hidden full-screen clear,
 * copy, readback, finish, or scene render is added. Empty rects mean no valid pixels.
 * Synchronous dispatch does not claim GPU completion or numerical/visual validation.
 */
export async function createGroupQueryReceiver({renderer, THREE, u, frame, diagnosticProgress = null, compactTrace = false, testShedDomain = false, passObserver = null, terminalProxy = false, diagnosticProxyObserver = null} = {}) {
  if (!renderer || !THREE || !u || !frame) throw Error('Group queries require the existing renderer, THREE, u, and frame');
  if(diagnosticProgress!==null&&typeof diagnosticProgress!=='function')throw Error('Diagnostic progress must be a callback');
  if(passObserver!==null&&typeof passObserver!=='function')throw Error('Profile observer must be a function');
  if(typeof compactTrace!=='boolean')throw Error('compactTrace must be explicit boolean');
  if(typeof testShedDomain!=='boolean'||(testShedDomain&&!compactTrace))throw Error('Shed domain is an explicit compact-trace diagnostic only');
  if(diagnosticProxyObserver!==null&&typeof diagnosticProxyObserver!=='function')throw Error('Terminal proxy observer must be a function');
  if(typeof terminalProxy!=='boolean'||(terminalProxy&&!compactTrace))throw Error('Terminal proxy is an explicit compact-trace diagnostic only');
  const attachmentCount=compactTrace?1:4;
  const gl = renderer.getContext();
  if (!renderer.capabilities.isWebGL2 || !gl.getExtension('EXT_color_buffer_float')) throw Error('Group queries require WebGL2 floating-point render attachments');
  if (gl.getParameter(gl.MAX_DRAW_BUFFERS) < attachmentCount || gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) < attachmentCount) throw Error('Group queries require four RGBA32F MRT attachments');
  const maximumSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  async function fetchFile(relative, json = false) {
    const response = await fetch(new URL('../../'+relative, import.meta.url));
    if (!response.ok) throw Error(`${relative}: HTTP ${response.status}`);
    return json ? response.json() : response.text();
  }
  const manifest = await fetchFile('./generated/geometry-group-manifest.json', true);
  if (manifest.groups?.length !== GEOMETRY_GROUP_NAMES.length || manifest.groups.some((group, index) => group.index !== index || group.name !== GEOMETRY_GROUP_NAMES[index] || group.outputs !== 4)) throw Error('Station runtime group manifest/order changed');
  if(testShedDomain&&manifest.sourceSHA256!==SHED_CERTIFIED_SOURCE)throw Error('Shed guard source identity changed; use original query path');
  const runtimeManifest=await fetchFile(compactTrace?'./experiments/compact-trace-r01/generated/manifest.json':'./generated/group-runtime-manifest.json',true);
  const runtimeKey=index=>(compactTrace?'runtime-':'group-runtime-')+index;
  const runtimeEntry=compactTrace?'stationCompactQuery':'stationGroupQuery';
  if(runtimeManifest.sourceSHA256!==manifest.sourceSHA256||manifest.groups.some(group=>runtimeManifest.outputs?.[runtimeKey(group.index)]?.entry!==runtimeEntry))throw Error('Runtime group source identity differs');
  const reflected = await Promise.all(manifest.groups.map(async group => threeFragment(await fetchFile(`${compactTrace?'./experiments/compact-trace-r01/generated/':'./generated/'}${runtimeKey(group.index)}.frag?source=${runtimeManifest.outputs[runtimeKey(group.index)].sha256}`))));
  // The original compact shader identity is locked even when initially toggled off.
  // Load the light shader once; switching modes never replaces the original material.
  let terminalReflected=null, terminalManifest=null;
  if(compactTrace){
    if(manifest.sourceSHA256!==SHED_CERTIFIED_SOURCE||runtimeManifest.outputs['runtime-0'].sha256!==TERMINAL_COMPACT_SOURCE)throw Error('Terminal proxy original compact source identity changed');
    terminalManifest=await fetchFile('./experiments/terminal-proxy-r01/generated/manifest.json',true);
    if(terminalManifest.sourceSHA256!==manifest.sourceSHA256||terminalManifest.proxySourceSHA256!==TERMINAL_COMPACT_SOURCE||terminalManifest.outputs?.proxy?.entry!=='stationTerminalProxy')throw Error('Terminal proxy source identity/entry changed');
    terminalReflected=threeFragment(await fetchFile(`./experiments/terminal-proxy-r01/generated/proxy.frag?source=${terminalManifest.outputs.proxy.sha256}`));
  }
  const control = {offsetAndPhase: new THREE.Vector4(), options: new THREE.Vector4()};
  const materials = [];
  const samplers = [];
  let terminalMaterial=null; const terminalSamplers=new Map();
  try {
    for (let index = 0; index < reflected.length; index++) {
      const shader = reflected[index], uniforms = {}, bindingNames = new Map();
      for (const uniform of shader.uniforms) {
        const value = uniform.type === 'Params' ? u : uniform.type === 'HostFrame' ? frame : uniform.type === 'GroupQueryControl' ? control : null;
        if (value === null) throw Error(`Unknown runtime uniform block ${uniform.type} in group ${index}`);
        uniforms[uniform.name] = {value};
      }
      for (const required of ['HostFrame', 'GroupQueryControl']) if (!shader.uniforms.some(uniform => uniform.type === required)) throw Error(`Runtime group ${index} is missing ${required}`);
      // A material-free group may legitimately optimize Params away.
      for (const name of shader.samplers) {
        const match = /group_(\d+)_binding_(\d+)_/.exec(name);
        if (!match || Number(match[1]) !== 1 || Number(match[2]) > 5 || bindingNames.has(Number(match[2]))) throw Error(`Unexpected runtime sampler ${name}`);
        bindingNames.set(Number(match[2]), name); uniforms[name] = {value: null};
      }
      for (const required of (index === 0 ? [0, 5] : compactTrace ? [0, 1, 5] : [0, 1, 2, 3, 4, 5])) if (!bindingNames.has(required)) throw Error(`Runtime group ${index} is missing texture binding ${required}`);
      const material = new THREE.RawShaderMaterial({glslVersion: THREE.GLSL3, vertexShader: DISPATCH_VERTEX, fragmentShader: shader.text, uniforms, depthTest: false, depthWrite: false, toneMapped: false, blending: THREE.NoBlending});
      material.name = `Station grouped query ${index}: ${manifest.groups[index].name}`;
      materials.push(material); samplers.push(bindingNames);
    }
    if(terminalReflected){
      const uniforms={};
      for(const uniform of terminalReflected.uniforms){
        const value=uniform.type==='Params'?u:uniform.type==='HostFrame'?frame:uniform.type==='GroupQueryControl'?control:null;
        if(value===null)throw Error(`Unknown terminal proxy uniform block ${uniform.type}`);
        uniforms[uniform.name]={value};
      }
      for(const required of ['HostFrame','GroupQueryControl'])if(!terminalReflected.uniforms.some(uniform=>uniform.type===required))throw Error(`Terminal proxy is missing ${required}`);
      for(const name of terminalReflected.samplers){
        const match=/group_(\d+)_binding_(\d+)_/.exec(name),binding=Number(match?.[2]);
        if(!match||Number(match[1])!==1||![0,5].includes(binding)||terminalSamplers.has(binding))throw Error(`Unexpected terminal proxy sampler ${name}`);
        terminalSamplers.set(binding,name);uniforms[name]={value:null};
      }
      for(const required of [0,5])if(!terminalSamplers.has(required))throw Error(`Terminal proxy is missing texture binding ${required}`);
      terminalMaterial=new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:DISPATCH_VERTEX,fragmentShader:terminalReflected.text,uniforms,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending});
      terminalMaterial.name='Station terminal proxy diagnostic classification';
    }
  } catch (error) {for (const material of materials) material.dispose(); terminalMaterial?.dispose(); throw error;}
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const stageScene = new THREE.Scene(), stageCamera = new THREE.Camera();
  const dispatch = new THREE.Mesh(geometry, materials[0]); dispatch.frustumCulled = false;
  stageScene.add(dispatch);
  const ownedTextures = new WeakSet();
  const carryUniforms={inputMap:{value:null}};
  const carry=testShedDomain?new THREE.RawShaderMaterial({glslVersion:THREE.GLSL3,vertexShader:DISPATCH_VERTEX,fragmentShader:'precision highp float;precision highp int;uniform sampler2D inputMap;out vec4 value;void main(){value=texelFetch(inputMap,ivec2(gl_FragCoord.xy),0);}',uniforms:carryUniforms,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NoBlending}):null;
  if(carry)carry.name='Exact group3 prefix carry before shed domain';
  let shedCertificate=null,shedFrameKey=null,shedDomainEnabled=testShedDomain;const shedPlanCache=new Map();
  function shedPlan(width,height,rects,offset,phase){
    if(!shedDomainEnabled||phase!==0||offset.some(x=>x!==0))return null;
    const snapshot={inverseProjection:Array.from(frame.inverseProjection.elements),cameraToLocal:Array.from(frame.cameraToLocal.elements),width,height,flipY:frame.viewport.z>.5,precision:gl.getShaderPrecisionFormat?.(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT)};
    const key=JSON.stringify([snapshot.inverseProjection.map(Math.fround),snapshot.cameraToLocal.map(Math.fround),width,height,snapshot.flipY,snapshot.precision?.precision,snapshot.precision?.rangeMin,snapshot.precision?.rangeMax]);
    if(key!==shedFrameKey){shedCertificate=createShedRayCertificate(snapshot);shedFrameKey=key;shedPlanCache.clear();}
    const rectKey=JSON.stringify(rects);if(shedPlanCache.has(rectKey))return shedPlanCache.get(rectKey);
    const plan=shedCertificate.partitionRects(rects??[{x:0,y:0,w:width,h:height}]);
    const result={...plan,qualified:shedCertificate.qualified,reason:shedCertificate.reason};shedPlanCache.set(rectKey,result);return result;
  }
  let targets = null, disposed = false, querying = false;
  let terminalTarget=null, terminalProxyEnabled=terminalProxy;
  const terminalProof={enabled:terminalProxy,queries:0,clear:0,classify:0,heavy:0,fallback:0,lastFallback:null,lastMode:'not-run',sourceSHA256:SHED_CERTIFIED_SOURCE,compactSourceSHA256:TERMINAL_COMPACT_SOURCE,claim:'Submission counts only; no claim of GPU early stencil rejection or fragment execution savings.'};
  const proof = {status: 'ready-unvalidated', queries: 0, groups: manifest.groups.length, currentQueryAttachments: attachmentCount*2, compactTrace, testShedDomain, shedDomain:{queries:0,qualifiedQueries:0,totalPixels:0,eligiblePixels:0,excludedPixels:0,avoidedGroupPixelCalls:0,carryPixels:0}, controlBytes: 32, sourceSHA256: manifest.sourceSHA256, executionOutputs:runtimeManifest.outputs, limitations: ['GPU compilation/execution and host integration require separate validation.', 'Output textures expire at the next query; only requested rectangles are valid.', compactTrace?'Trace query writes only distance/id/rawCount/validity; final metadata and normal require original full query.':'Full query writes all original four-MRT HitField channels.']};
  function allocate(width, height, stencil = false) {
    const target = new THREE.WebGLRenderTarget(width, height, {count: attachmentCount, type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: stencil, stencilBuffer: stencil, samples: 0});
    if (!Array.isArray(target.textures) || target.textures.length !== attachmentCount) {target.dispose(); throw Error('This Three build did not create four MRT textures');}
    for (const texture of target.textures) {
      texture.generateMipmaps = false;
      if (THREE.NoColorSpace !== undefined) texture.colorSpace = THREE.NoColorSpace;
      ownedTextures.add(texture);
    }
    return target;
  }
  function validateTexture(texture, label) {
    if (!texture?.isTexture) throw Error(`${label} must be an existing Three texture`);
    if (ownedTextures.has(texture)) throw Error(`${label} aliases an internal query write target; copy it into an independently owned target first`);
  }
  function rectangles(rects, width, height) {
    if (rects == null) return null;
    if (!Array.isArray(rects)) throw Error('rects must be an array of bottom-left pixel rectangles');
    return rects.map(rect => {
      if (!rect || !['x', 'y', 'w', 'h'].every(key => Number.isInteger(rect[key])) || rect.x < 0 || rect.y < 0 || rect.w <= 0 || rect.h <= 0 || rect.x + rect.w > width || rect.y + rect.h > height) throw Error('Invalid query pixel rectangle');
      return {x: rect.x, y: rect.y, w: rect.w, h: rect.h};
    });
  }
  function renderStage(material, target, rects) {
    dispatch.material = material;
    if (rects === null) {
      target.scissorTest = false; renderer.setRenderTarget(target); renderer.render(stageScene, stageCamera);
    } else {
      target.scissorTest = true;
      for (const rect of rects) {
        target.scissor.set(rect.x, rect.y, rect.w, rect.h);
        renderer.setRenderTarget(target); renderer.render(stageScene, stageCamera);
      }
      target.scissorTest = false;
    }
  }
  // State reads are GL state metadata only, never attachment data or GPU queries.
  // Three r170's stencil buffer API sets both faces. An asymmetric caller state
  // cannot be represented by that cache, so reject it BEFORE any mutation.
  function captureTerminalState() {
    const state=renderer.state, stencil=state?.buffers?.stencil, depth=state?.buffers?.depth;
    const required={stencil:['setTest','setMask','setFunc','setOp','setClear'],depth:['setTest','setMask','setFunc']};
    for(const [kind,methods] of Object.entries(required))for(const method of methods)if(typeof state?.buffers?.[kind]?.[method]!=='function')return {reason:`missing Three ${kind}.${method}`};
    for(const method of ['viewport','scissor','setScissorTest'])if(typeof state?.[method]!=='function')return {reason:`missing Three state.${method}`};
    for(const method of ['getViewport','getCurrentViewport','getScissor','getScissorTest','setViewport','setScissor','getPixelRatio','clear'])if(typeof renderer[method]!=='function')return {reason:`missing renderer.${method}`};
    for(const name of ['AlwaysStencilFunc','EqualStencilFunc','KeepStencilOp','ReplaceStencilOp','AlwaysDepth','NeverDepth'])if(THREE[name]===undefined)return {reason:`missing Three ${name}`};
    if(typeof gl.isEnabled!=='function'||typeof gl.checkFramebufferStatus!=='function'||gl.STENCIL_BITS===undefined||gl.FRAMEBUFFER===undefined||gl.FRAMEBUFFER_COMPLETE===undefined)return {reason:'missing GL state/framebuffer inspection'};
    const read=name=>{
      if(gl[name]===undefined)throw Error(`missing GL ${name}`);
      const value=gl.getParameter(gl[name]);
      if(value===null||value===undefined)throw Error(`unavailable GL ${name}`);
      return value;
    };
    try {
      const frontNames=['STENCIL_FUNC','STENCIL_REF','STENCIL_VALUE_MASK','STENCIL_WRITEMASK','STENCIL_FAIL','STENCIL_PASS_DEPTH_FAIL','STENCIL_PASS_DEPTH_PASS'];
      const front=frontNames.map(read), back=frontNames.map(name=>read(name.replace('STENCIL_','STENCIL_BACK_')));
      if(front.some((value,index)=>value!==back[index]))return {reason:'asymmetric front/back stencil state'};
      const depthPairs=[['NEVER','NeverDepth'],['ALWAYS','AlwaysDepth'],['LESS','LessDepth'],['LEQUAL','LessEqualDepth'],['EQUAL','EqualDepth'],['GEQUAL','GreaterEqualDepth'],['GREATER','GreaterDepth'],['NOTEQUAL','NotEqualDepth']];
      const realDepthFunc=read('DEPTH_FUNC');
      let depthName=depthPairs.find(([name])=>gl[name]===realDepthFunc)?.[1];
      if(depth.getReversed?.())return {reason:'reverse-depth diagnostic not supported'};
      if(THREE[depthName]===undefined)return {reason:'unrepresentable depth function'};
      const currentViewport=renderer.getCurrentViewport(new THREE.Vector4());
      const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4());
      const pixelRatio=renderer.getPixelRatio();
      if(!Number.isFinite(pixelRatio)||pixelRatio<=0)return {reason:'invalid renderer pixel ratio'};
      return {target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace?.()??0,mip:renderer.getActiveMipmapLevel?.()??0,stencil,depth,front,clear:read('STENCIL_CLEAR_VALUE'),stencilTest:gl.isEnabled(gl.STENCIL_TEST),depthTest:gl.isEnabled(gl.DEPTH_TEST),depthWrite:read('DEPTH_WRITEMASK'),depthFunc:THREE[depthName],viewport,scissor,currentViewport,pixelRatio,realViewport:Array.from(read('VIEWPORT')),realScissor:Array.from(read('SCISSOR_BOX')),realScissorTest:gl.isEnabled(gl.SCISSOR_TEST)};
    } catch(error) {return {reason:String(error)};}
  }
  function restoreTerminalState(saved) {
    const {stencil,depth,front}=saved;
    // Force each cache through a different value first. This also handles callers
    // whose actual GL state differed from Three's cached value before the query.
    stencil.setTest(!saved.stencilTest);stencil.setTest(saved.stencilTest);
    stencil.setMask(front[3]===0?0xffffffff:0);stencil.setMask(front[3]);
    stencil.setFunc(front[0]===gl.ALWAYS?gl.NEVER:gl.ALWAYS,0,0);
    stencil.setFunc(front[0],front[1],front[2]);
    stencil.setOp(front[4]===gl.KEEP?gl.REPLACE:gl.KEEP,gl.KEEP,gl.KEEP);
    stencil.setOp(front[4],front[5],front[6]);
    stencil.setClear(saved.clear===0?1:0);stencil.setClear(saved.clear);
    depth.setTest(!saved.depthTest);depth.setTest(saved.depthTest);
    depth.setMask(!saved.depthWrite);depth.setMask(saved.depthWrite);
    depth.setFunc(saved.depthFunc===THREE.AlwaysDepth?THREE.NeverDepth:THREE.AlwaysDepth);depth.setFunc(saved.depthFunc);
  }
  function restoreTerminalRaster(saved) {
    // setRenderTarget restores the target-owned viewport/scissor normally. If
    // the caller had an explicit viewport/scissor override, reapply its unchanged
    // logical value; then restore actual pixels through Three's state cache.
    const current=renderer.getCurrentViewport(new THREE.Vector4());
    if(['x','y','z','w'].some(key=>current[key]!==saved.currentViewport[key]))renderer.setViewport(saved.viewport);
    const scaledScissor=['x','y','z','w'].map(key=>Math.round(saved.scissor[key]*saved.pixelRatio));
    if(scaledScissor.every((value,index)=>value===saved.realScissor[index]))renderer.setScissor(saved.scissor);
    renderer.state.viewport(new THREE.Vector4(...saved.realViewport));
    renderer.state.scissor(new THREE.Vector4(...saved.realScissor));
    renderer.state.setScissorTest(saved.realScissorTest);
  }
  function terminalTargetSupport(target,saved) {
    // WebGL2 capability is necessary but not sufficient: verify this actual
    // RGBA32F target has a complete framebuffer and a stencil attachment.
    // This check is within the g0 timer, before any clear or material mutation.
    try {
      renderer.setRenderTarget(target);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)return 'terminal framebuffer incomplete';
      if(!(gl.getParameter(gl.STENCIL_BITS)>0))return 'terminal framebuffer has no stencil attachment';
      return null;
    } finally {
      renderer.setRenderTarget(saved.target,saved.face,saved.mip);restoreTerminalRaster(saved);
    }
  }
  const terminalMaterialKeys=['stencilWrite','stencilWriteMask','stencilFunc','stencilRef','stencilFuncMask','stencilFail','stencilZFail','stencilZPass','depthTest','depthWrite'];
  function renderTerminal(material,target,rects,saved,queryInfo) {
    const oldMaterial=dispatch.material;
    const snapshots=[terminalMaterial,material].map(value=>Object.fromEntries(terminalMaterialKeys.map(key=>[key,{own:Object.hasOwn(value,key),value:value[key]}])));
    const oldScissor=target.scissor.clone(),oldScissorTest=target.scissorTest;
    const drawRects=rects??[{x:0,y:0,w:target.width,h:target.height}];
    try {
      const common={stencilWrite:true,stencilFuncMask:0xff,stencilFail:THREE.KeepStencilOp,stencilZFail:THREE.KeepStencilOp,depthTest:false,depthWrite:false};
      Object.assign(terminalMaterial,common,{stencilWriteMask:0xff,stencilFunc:THREE.AlwaysStencilFunc,stencilRef:1,stencilZPass:THREE.ReplaceStencilOp});
      Object.assign(material,common,{stencilWriteMask:0,stencilFunc:THREE.EqualStencilFunc,stencilRef:0,stencilZPass:THREE.KeepStencilOp});
      // Clear every requested rectangle before either pass. Overlapping rectangles
      // stay safe: all clears happen before classification and heavy evaluation.
      saved.stencil.setMask(0);saved.stencil.setMask(0xff);
      saved.stencil.setClear(1);saved.stencil.setClear(0);
      saved.stencil.setTest(false);saved.stencil.setTest(true);
      saved.stencil.setFunc(gl.NEVER,0,0);
      saved.stencil.setOp(gl.REPLACE,gl.REPLACE,gl.REPLACE);
      saved.depth.setTest(true);saved.depth.setTest(false);
      saved.depth.setMask(true);saved.depth.setMask(false);
      target.scissorTest=true;
      for(const rect of drawRects){
        target.scissor.set(rect.x,rect.y,rect.w,rect.h);renderer.setRenderTarget(target);
        renderer.clear(false,false,true);terminalProof.clear++;
      }
      renderStage(terminalMaterial,target,rects);terminalProof.classify+=drawRects.length;
      if(drawRects.length&&diagnosticProxyObserver)diagnosticProxyObserver({stage:'heavy-begin',target,rects,...queryInfo});
      try {renderStage(material,target,rects);terminalProof.heavy+=drawRects.length;}
      finally {if(drawRects.length&&diagnosticProxyObserver)diagnosticProxyObserver({stage:'heavy-end',target,rects,...queryInfo});}
    } finally {
      for(const [index,value] of [terminalMaterial,material].entries())for(const key of terminalMaterialKeys){const prior=snapshots[index][key];if(prior.own)value[key]=prior.value;else delete value[key];}
      dispatch.material=oldMaterial;target.scissor.copy(oldScissor);target.scissorTest=oldScissorTest;
      try {renderer.setRenderTarget(saved.target,saved.face,saved.mip);restoreTerminalRaster(saved);}
      finally {restoreTerminalState(saved);}
    }
  }
  function query({width, height, traceTexture, fullHitTexture = null, offset = [0, 0, 0], phase = 0, skip = 0, rects = null} = {}) {
    if (disposed) throw Error('Group query receiver is disposed');
    if (querying) throw Error('Group queries must not be reentered');
    if (gl.isContextLost()) {proof.status = 'context-lost'; throw Error('Group query WebGL context is lost');}
    if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= maximumSize)) throw Error('Invalid group query dimensions');
    if (!Array.isArray(offset) || offset.length !== 3 || offset.some(value => !Number.isFinite(value)) || ![0, 1].includes(phase) || ![0, 1, 2, 3].includes(skip)) throw Error('Invalid query offset/phase/skip');
    if (frame.viewport?.x !== width || frame.viewport?.y !== height) throw Error('Caller must configure frame.viewport.xy to the query dimensions');
    validateTexture(traceTexture, 'traceTexture');
    if (fullHitTexture !== null) validateTexture(fullHitTexture, 'fullHitTexture');
    if (skip === 3 && fullHitTexture === null) throw Error('Automatic roof/floor skip requires an independent fullHitTexture');
    const validRects = rectangles(rects, width, height);
    const shed=shedPlan(width,height,validRects,offset,phase);
    if(shed){const q=proof.shedDomain;q.queries++;q.qualifiedQueries+=Number(shed.qualified);for(const k of ['totalPixels','eligiblePixels','excludedPixels'])q[k]+=shed[k];q.avoidedGroupPixelCalls+=5*shed.excludedPixels;if(shed.excludedPixels)q.carryPixels+=shed.totalPixels;proof.lastShedPlan={...shed,rects:shed.rects.map(r=>({...r}))};}
    if (!targets || targets[0].width !== width || targets[0].height !== height) {
      const next = [];
      try {next.push(allocate(width, height)); next.push(allocate(width, height));}
      catch (error) {for (const target of next) target.dispose(); throw error;}
      if (targets) for (const target of targets) target.dispose();
      targets = next;
      terminalTarget?.dispose();terminalTarget=null;
    }
    control.offsetAndPhase.set(offset[0], offset[1], offset[2], phase); control.options.set(skip, 0, 0, 0);
    const oldTarget = renderer.getRenderTarget(), oldFace = renderer.getActiveCubeFace?.() ?? 0, oldMip = renderer.getActiveMipmapLevel?.() ?? 0;
    const oldAutoClear = renderer.autoClear, oldShadowEnabled = renderer.shadowMap.enabled;
    querying = true; renderer.autoClear = false; renderer.shadowMap.enabled = false;
    proof.status = 'dispatching';
    try {
      let previous = null, output = null;
      for (let index = 0; index < materials.length; index++) {
        if (gl.isContextLost()) throw Error(`Context lost before runtime group ${index}`);
        output = targets[index % 2];
        // Outside the certified original shed guard, each of groups4..8 is the
        // canonical empty candidate. Copy the group3 prefix into BOTH ping-pong
        // buffers once; then every omitted pixel retains the identical prefix
        // while eligible pixels execute all five original physical queries.
        if(index===4&&shed?.excludedPixels){carryUniforms.inputMap.value=previous.textures[0];renderStage(carry,output,validRects);}
        const groupRects=index>=4&&index<=8&&shed?.excludedPixels?shed.rects:validRects;
        const textures = compactTrace?[traceTexture,previous?.textures[0]||traceTexture,traceTexture,traceTexture,traceTexture,fullHitTexture||traceTexture]:[traceTexture, ...(previous ? previous.textures : [traceTexture, traceTexture, traceTexture, traceTexture]), fullHitTexture || traceTexture];
        for (const [binding, name] of samplers[index]) materials[index].uniforms[name].value = textures[binding];
        const observed=diagnosticProgress&&proof.queries===0;const start=observed?performance.now():0;
        if(observed)diagnosticProgress({stage:'group-start',index,name:manifest.groups[index].name});
        if(passObserver)passObserver({stage:'begin',index,phase,skip,query:proof.queries,target:output,rects:groupRects});
        try{
          if(index===0&&terminalProxyEnabled){
            terminalProof.queries++;
            const saved=captureTerminalState();
            if(saved.reason){
              terminalProof.fallback++;terminalProof.lastFallback=saved.reason;terminalProof.lastMode='original-fallback';
              renderStage(materials[index],output,groupRects);
            }else{
              if(!terminalTarget)terminalTarget=allocate(width,height,true);
              const unsupported=terminalTargetSupport(terminalTarget,saved);
              if(unsupported){
                terminalProof.fallback++;terminalProof.lastFallback=unsupported;terminalProof.lastMode='original-fallback';
                renderStage(materials[index],output,groupRects);
              }else{
                output=terminalTarget;
                for(const [binding,name] of terminalSamplers)terminalMaterial.uniforms[name].value=textures[binding];
                terminalProof.lastMode='proxy';terminalProof.lastFallback=null;
                renderTerminal(materials[index],output,groupRects,saved,{phase,skip,query:proof.queries});
              }
            }
          }else{if(index===0)terminalProof.lastMode='original';renderStage(materials[index], output, groupRects);}
        }finally{if(passObserver)passObserver({stage:'end',index,phase,skip,query:proof.queries,target:output,rects:groupRects});}
        if(observed){diagnosticProgress({stage:'group-submitted',index,name:manifest.groups[index].name});if(gl.isContextLost())throw Error(`Context lost while executing runtime group ${index}`);diagnosticProgress({stage:'group-complete',index,name:manifest.groups[index].name,elapsedMs:performance.now()-start});}
        previous = output;
      }
      if (gl.isContextLost()) throw Error('Context lost during grouped query dispatch');
      const textures = output.textures.slice();
      proof.queries++; proof.status = 'dispatched-unvalidated'; proof.lastQuery = {width, height, phase, skip, offset: offset.slice(), rects: validRects};
      return {textures, a: textures[0], b: textures[1], c: textures[2], e: textures[3], width, height, rects: validRects};
    } catch (error) {proof.status = gl.isContextLost() ? 'context-lost' : 'failed'; proof.failure = String(error); throw error;}
    finally {
      try {renderer.setRenderTarget(oldTarget, oldFace, oldMip);}
      finally {renderer.autoClear = oldAutoClear; renderer.shadowMap.enabled = oldShadowEnabled; querying = false;}
    }
  }
  return {
    manifest, proof, query,
    get proxyProof(){return Object.freeze({...terminalProof});},
    setDiagnosticTerminalProxy(enabled){
      if(disposed||querying)throw Error('Cannot toggle an active or disposed group query');
      if(!compactTrace||typeof enabled!=='boolean')throw Error('Terminal toggle requires explicit compact-trace boolean');
      terminalProxyEnabled=enabled;terminalProof.enabled=enabled;
    },
    setDiagnosticProxyObserver(observer){
      if(disposed||querying)throw Error('Cannot change observer during an active or disposed query');
      if(observer!==null&&typeof observer!=='function')throw Error('Terminal proxy observer must be a function');
      diagnosticProxyObserver=observer;
    },
    diagnosticTerminalTarget(){if(querying||!terminalTarget||terminalProof.lastMode!=='proxy'||proof.status!=='dispatched-unvalidated')throw Error('No completed terminal proxy query');return terminalTarget;},
    setDiagnosticShedDomain(enabled){if(!testShedDomain||typeof enabled!=='boolean')throw Error('Shed toggle requires explicit diagnostic construction');shedDomainEnabled=enabled;},
    diagnosticBuffers(){if(!testShedDomain||!targets||querying)throw Error('No completed diagnostic query buffers');return targets.slice();},
    dispose() {
      if (querying) throw Error('Cannot dispose an active group query');
      if (disposed) return;
      disposed = true; if (targets) for (const target of targets) target.dispose();
      terminalTarget?.dispose();terminalMaterial?.dispose();
      for (const material of materials) material.dispose(); carry?.dispose(); geometry.dispose(); dispatch.removeFromParent(); proof.status = 'disposed';
    },
  };
}
