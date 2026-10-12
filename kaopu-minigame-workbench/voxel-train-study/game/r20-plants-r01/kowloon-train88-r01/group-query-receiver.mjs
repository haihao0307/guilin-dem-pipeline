// Same-renderer execution only: no host scene, camera/clock configuration, rAF,
// ray advancement, normal reconstruction, material replacement, or publication.
import {threeFragment, DISPATCH_VERTEX} from './glsl-interface.mjs';
import {GEOMETRY_GROUP_NAMES} from './geometry-groups.mjs';
import {createShedRayCertificate} from './experiments/shed-domain-r01/ray-certificate.mjs';
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
export async function createGroupQueryReceiver({renderer, THREE, u, frame, diagnosticProgress = null, compactTrace = false, testShedDomain = false} = {}) {
  if (!renderer || !THREE || !u || !frame) throw Error('Group queries require the existing renderer, THREE, u, and frame');
  if(diagnosticProgress!==null&&typeof diagnosticProgress!=='function')throw Error('Diagnostic progress must be a callback');
  if(typeof compactTrace!=='boolean')throw Error('compactTrace must be explicit boolean');
  if(typeof testShedDomain!=='boolean'||(testShedDomain&&!compactTrace))throw Error('Shed domain is an explicit compact-trace diagnostic only');
  const attachmentCount=compactTrace?1:4;
  const gl = renderer.getContext();
  if (!renderer.capabilities.isWebGL2 || !gl.getExtension('EXT_color_buffer_float')) throw Error('Group queries require WebGL2 floating-point render attachments');
  if (gl.getParameter(gl.MAX_DRAW_BUFFERS) < attachmentCount || gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) < attachmentCount) throw Error('Group queries require four RGBA32F MRT attachments');
  const maximumSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  async function fetchFile(relative, json = false) {
    const response = await fetch(new URL(relative, import.meta.url));
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
  const control = {offsetAndPhase: new THREE.Vector4(), options: new THREE.Vector4()};
  const materials = [];
  const samplers = [];
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
  } catch (error) {for (const material of materials) material.dispose(); throw error;}
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
  const proof = {status: 'ready-unvalidated', queries: 0, groups: manifest.groups.length, currentQueryAttachments: attachmentCount*2, compactTrace, testShedDomain, shedDomain:{queries:0,qualifiedQueries:0,totalPixels:0,eligiblePixels:0,excludedPixels:0,avoidedGroupPixelCalls:0,carryPixels:0}, controlBytes: 32, sourceSHA256: manifest.sourceSHA256, executionOutputs:runtimeManifest.outputs, limitations: ['GPU compilation/execution and host integration require separate validation.', 'Output textures expire at the next query; only requested rectangles are valid.', compactTrace?'Trace query writes only distance/id/rawCount/validity; final metadata and normal require original full query.':'Full query writes all original four-MRT HitField channels.']};
  function allocate(width, height) {
    const target = new THREE.WebGLRenderTarget(width, height, {count: attachmentCount, type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false, stencilBuffer: false, samples: 0});
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
        renderStage(materials[index], output, groupRects);
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
    setDiagnosticShedDomain(enabled){if(!testShedDomain||typeof enabled!=='boolean')throw Error('Shed toggle requires explicit diagnostic construction');shedDomainEnabled=enabled;},
    diagnosticBuffers(){if(!testShedDomain||!targets||querying)throw Error('No completed diagnostic query buffers');return targets.slice();},
    dispose() {
      if (querying) throw Error('Cannot dispose an active group query');
      if (disposed) return;
      disposed = true; if (targets) for (const target of targets) target.dispose();
      for (const material of materials) material.dispose(); carry?.dispose(); geometry.dispose(); dispatch.removeFromParent(); proof.status = 'disposed';
    },
  };
}
