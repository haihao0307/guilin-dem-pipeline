/**
 * Independent instances of the complete, pinned P01 / R07 native person.
 * The original F13 NativeMotion constructor supplies the complete 104-bone
 * binding, captured walk/run/jump, joint-conditioned weights and pose cache.
 * THREE is injected from that same bundle. Nothing here substitutes geometry.
 */
export const ACTOR_SOURCE = Object.freeze({
  repository: 'haihao0307/guilin-dem-pipeline',
  commit: '64cd31324f1a7c4762c21531fe5559b14face2fe',
  runtimeSHA256: 'cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790',
  identity: 'original F13 P01 full R07 person',
  rig: 'anny', bones: 104, controlVertices: 25417, controlTriangles: 50624,
});

const frozenPrograms = new Map();
const materialsOf = mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material];
const identityRow = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function captureMaterial(THREE, source, compile, renderer) {
  const libraryName = source.isMeshPhysicalMaterial ? 'physical'
    : source.isMeshStandardMaterial ? 'standard'
    : source.isMeshPhongMaterial ? 'phong'
    : source.isMeshLambertMaterial ? 'lambert'
    : source.isMeshBasicMaterial ? 'basic' : null;
  if (!libraryName) {
    if (!source.isShaderMaterial) throw Error('Unsupported original native material: ' + source.type);
    return {source, directShader: true, compile};
  }
  const template = THREE.ShaderLib[libraryName];
  if (!template || !THREE.UniformsUtils) throw Error('Expose original THREE.ShaderLib and UniformsUtils');
  const uniforms = THREE.UniformsUtils.clone(template.uniforms), initial = {...uniforms};
  const shader = {uniforms, vertexShader: template.vertexShader,
    fragmentShader: template.fragmentShader, defines: {...source.defines}};
  compile.call(source, shader, renderer);
  if (/uniform\s+sampler2D\s+mr(?:Ranges|Cache0)/.test(shader.vertexShader)) {
    throw Error('Original animation wrapper was not removed before freezing the source material');
  }
  const custom = {};
  for (const [key, uniform] of Object.entries(shader.uniforms)) {
    if (!(key in initial) || initial[key] !== uniform) custom[key] = uniform;
  }
  if (Object.keys(custom).some(key => /^mr(?:Ranges|Entries|Bones|Cache\d|Active)$/.test(key))) {
    throw Error('Source capture unexpectedly contains donor native pose uniforms');
  }
  const exactSource = JSON.stringify([shader.vertexShader, shader.fragmentShader]);
  if (!frozenPrograms.has(exactSource)) frozenPrograms.set(exactSource, 'crowd-native-source-' + (frozenPrograms.size + 1));
  return {source, shader, custom, programKey: frozenPrograms.get(exactSource)};
}

function instantiateMaterial(THREE, capture, id) {
  const Material = THREE[capture.source.type];
  if (typeof Material !== 'function') throw Error('Expose the common THREE.' + capture.source.type);
  // The historical page contains separately bundled Three namespaces. New
  // runtime objects must use the caller's common module, even when a read-only
  // donor Material was created by an earlier bundle in that original page.
  const material = new Material().copy(capture.source);
  material.name = (capture.source.name || capture.source.type) + '/crowd-' + id;
  if (capture.directShader) {
    material.uniforms = {...capture.source.uniforms};
    material.onBeforeCompile = function (shader, renderer) { capture.compile.call(this, shader, renderer); };
    material.customProgramCacheKey = capture.source.customProgramCacheKey;
  } else {
    // The original faceDiffusion renderer changes uFPass and cineRig changes
    // uC* light/view uniforms through these exact wrapper objects each pass.
    // All actors here share the same fixed P01 identity, so the original
    // pre-native appearance/shape uniforms remain source-owned and live.
    // NativeBinding installs a DIFFERENT actor-owned U after this hook.
    const custom = capture.custom;
    material.defines = {...capture.source.defines, ...capture.shader.defines};
    material.onBeforeCompile = shader => {
      shader.vertexShader = capture.shader.vertexShader;
      shader.fragmentShader = capture.shader.fragmentShader;
      Object.assign(shader.uniforms, custom);
    };
    material.customProgramCacheKey = () => capture.programKey;
  }
  material.needsUpdate = true;
  return material;
}

// F13's binding wraps the primary skin material. If the retained person uses
// additional original material groups, feed those exact groups the same native
// pose too. Neither groups nor source shader code are removed.
function bindAdditionalMaterial(material, native) {
  const prior = material.onBeforeCompile.bind(material);
  const key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    prior(shader, renderer);
    Object.assign(shader.uniforms, native.U);
    for (const anchor of ['#include <beginnormal_vertex>', '#include <defaultnormal_vertex>', '#include <project_vertex>']) {
      if (!shader.vertexShader.includes(anchor)) throw Error('Original material shader anchor drift: ' + anchor);
    }
    shader.vertexShader = native.vertexHeader + shader.vertexShader;
    shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', 'if(mrActive>.5)mrEvaluate();\n#include <beginnormal_vertex>')
      .replace('#include <defaultnormal_vertex>', 'if(mrActive>.5)objectNormal=mrToWorld(mrR*mrToNative(objectNormal));\n#include <defaultnormal_vertex>')
      .replace('#include <project_vertex>', 'if(mrActive>.5)transformed=mrToWorld(mrP+mrR*mrToNative(transformed-position));\n#include <project_vertex>');
  };
  material.customProgramCacheKey = () => key() + '/motion-r01-full-lineage/r07-native-pose-cache';
  material.needsUpdate = true;
}

function makePacket(model, native, order) {
  const retained = model.lastBodyDriver.packet;
  const rig = {...native.rig, source: 'anny',
    weights: retained.weights, restPositionsPerInfluence: retained.restPositionsPerInfluence,
    // This is the rest-shape fitting packet. The public per-tick final matrices
    // are a different actor-owned buffer and are never used as rest geometry.
    skinMatrices: native.names.map(identityRow), posedMatrices: native.rig.restMatrices};
  return {rig, positions: model.positions, faces: model.faces,
    bodyCount: model.bodyCount, vertexCount: model.vertexCount,
    boneOrder: [...order], headSkinIndices: model.canonical.headSkinIndices,
    headSkinWeights: model.canonical.headSkinWeights,
    bindingRange: native.range, bindingPacked: native.packed,
    sourceRevision: ACTOR_SOURCE.commit,
    matrixConvention: 'row-major, native Z-up metres; actor placement is outside these matrices'};
}

/** raw = {viewer, model, motion, fibers, dynamics} from the verified F13 page. */
export async function createNativeActorFactory({THREE, raw, renderer = raw?.viewer?.renderer,
  scene = raw?.viewer?.scene, NativeMotion = raw?.motion?.constructor, onProgress = () => {}} = {}) {
  if (!THREE || !raw?.viewer?.mesh || !raw?.model || !raw?.motion?.constructor) {
    throw Error('The complete pinned F13 raw viewer/model/motion and its THREE are required');
  }
  const source = raw.viewer, model = raw.model;
  if (renderer !== source.renderer || scene !== source.scene) throw Error('Use the original common renderer and scene');
  if (!source.mesh.isMesh || typeof NativeMotion !== 'function') throw Error('Original native mesh and motion constructor required');
  const sourceMeshConstructorMatches = source.mesh instanceof THREE.Mesh;
  if (model.vertexCount !== ACTOR_SOURCE.controlVertices || model.faces.length !== ACTOR_SOURCE.controlTriangles * 3) {
    throw Error('Expected the complete original P01 control topology');
  }
  await raw.motion.prepare();
  if (raw.motion.native.names.length !== 104) throw Error('Expected the native 104-bone rig');
  source.mesh.updateWorldMatrix(true, false);
  const baseMatrix = source.mesh.matrixWorld.clone(), geometry = source.geometry;
  const sourceMaterials = materialsOf(source.mesh), primaryIndex = sourceMaterials.indexOf(source.skin.material);
  if (primaryIndex < 0) throw Error('Original primary skin material is absent from the visible mesh');
  const captures = sourceMaterials.map(material => captureMaterial(THREE, material,
    material === source.skin.material ? raw.motion.savedMaterial.compile : material.onBeforeCompile, renderer));
  const sourceAttachments = (raw.motion.attachments || []).map(item => ({...item,
    capture: materialsOf(item.object).map(material => captureMaterial(THREE, material, material.onBeforeCompile, renderer))}));
  const actors = new Map();
  let disposed = false;

  async function create({id = String(actors.size + 1), position = [0, 0, 0], rotationY = 0,
    mode = 'walk', phaseSeconds = 0} = {}) {
    id = String(id);
    if (disposed || actors.has(id)) throw Error('Factory disposed or duplicate actor id: ' + id);
    if (!['idle', 'still', 'walk', 'run', 'jump'].includes(mode)) throw Error('Unsupported native motion: ' + mode);
    const worldRoot = new THREE.Group();
    worldRoot.name = 'complete-native-actor-' + id;
    worldRoot.position.fromArray(position); worldRoot.rotation.y = rotationY;
    const materials = captures.map(c => instantiateMaterial(THREE, c, id));
    const mesh = new THREE.Mesh(geometry, Array.isArray(source.mesh.material) ? materials : materials[0]);
    mesh.name = 'P01-full-R07-' + id;
    mesh.matrixAutoUpdate = false; mesh.matrix.copy(baseMatrix);
    mesh.castShadow = source.mesh.castShadow; mesh.receiveShadow = source.mesh.receiveShadow;
    mesh.frustumCulled = false; mesh.renderOrder = source.mesh.renderOrder;
    mesh.userData = {...source.mesh.userData, crowdActorId: id, fullNativePerson: true};
    // Preserve all original custom morph/shape attributes and geometry groups.
    if (source.mesh.morphTargetInfluences) mesh.morphTargetInfluences = [...source.mesh.morphTargetInfluences];
    if (source.mesh.morphTargetDictionary) mesh.morphTargetDictionary = {...source.mesh.morphTargetDictionary};
    mesh.customDepthMaterial = raw.motion.savedDepth || null;
    worldRoot.add(mesh);
    const appearanceMaterials = [], attachments = sourceAttachments.map(item => {
      const mats = item.capture.map(c => instantiateMaterial(THREE, c, id)); appearanceMaterials.push(...mats);
      const object = new THREE.Mesh(item.object.geometry, Array.isArray(item.object.material) ? mats : mats[0]);
      object.name = item.object.name + '/crowd-' + id;
      object.userData = {...item.object.userData, crowdActorId: id};
      object.matrixAutoUpdate = false; object.matrix.copy(item.matrix);
      object.castShadow = item.object.castShadow; object.receiveShadow = item.object.receiveShadow;
      object.renderOrder = item.object.renderOrder; object.frustumCulled = false;
      object.onBeforeRender = item.before; object.onBeforeShadow = item.shadow;
      worldRoot.add(object); return object;
    });
    scene.add(worldRoot); worldRoot.updateWorldMatrix(true, true);
    const viewer = Object.assign(Object.create(Object.getPrototypeOf(source)), source, {
      mesh, geometry, renderer, scene: {children: attachments},
      skin: Object.assign(Object.create(Object.getPrototypeOf(source.skin)), source.skin, {material: materials[primaryIndex]}),
    });
    // A non-rendered original-frame facade is available for CPU rest queries.
    const localMesh = new THREE.Mesh(geometry, mesh.material);
    localMesh.matrixAutoUpdate = false; localMesh.matrix.copy(baseMatrix); localMesh.updateMatrixWorld(true);
    const localViewer = Object.assign(Object.create(Object.getPrototypeOf(viewer)), viewer, {mesh: localMesh, scene});
    const motion = new NativeMotion(model, viewer, message => onProgress({id, message}));
    try { await motion.prepare(); } catch (error) {
      worldRoot.removeFromParent(); for (const m of [...materials, ...appearanceMaterials]) m.dispose(); throw error;
    } finally { viewer.scene = scene; }
    for (let i = 0; i < materials.length; i++) if (i !== primaryIndex) bindAdditionalMaterial(materials[i], motion.native);
    const finalData = new Float32Array(104 * 16);
    const finalSkinMatrices = Array.from({length: 104}, (_, i) => finalData.subarray(i * 16, i * 16 + 16));
    const actorPacket = makePacket(model, motion.native, motion.sampler.order);
    let actorDisposed = false, lastTick = -1;
    const actor = {id, worldRoot, mesh, geometry, viewer, localMesh, localViewer, model, motion,
      actorPacket, finalSkinMatrices, finalSkinMatrixData: finalData,
      frameSequence: -1, timeSeconds: 0, sourceRevision: ACTOR_SOURCE.commit,
      baseMeshMatrix: baseMatrix.clone(), attachments,
      async setMotion(next, {phaseSeconds: phase = 0} = {}) {
        if (actorDisposed) throw Error('Actor is disposed');
        if (!Number.isFinite(phase) || phase < 0) throw Error('Invalid native motion phase');
        if (next === 'idle' || next === 'still') {
          motion.stop(); motion.clip = null;
          motion.native.animate(motion.sampler.apply(motion.sampler.pack(motion.native.rig.restMatrices)));
          motion.active = true; motion.playing = false; motion.native.activate(true);
          motion.time = 0; motion.boneWorld.clear(); motion.version++;
        } else {
          await motion.select(next); if (phase) motion.apply(phase);
        }
        if (attachments.length) motion.updateAttachments();
        finalData.set(motion.native.boneData); worldRoot.updateWorldMatrix(true, true);
        return motion.report();
      },
      advance(dt, tickId) {
        if (actorDisposed) throw Error('Actor is disposed');
        if (!Number.isFinite(dt) || dt <= 0 || dt > .1) throw Error('Use a positive stable simulation step, at most 0.1 s');
        if (!Number.isSafeInteger(tickId) || tickId < lastTick) throw Error('Monotonic integer tickId required');
        if (tickId === lastTick) return false;
        motion.advance(dt); // sole motion owner: exactly once for this tick
        if (attachments.length) motion.updateAttachments();
        finalData.set(motion.native.boneData);
        actor.timeSeconds += dt; actor.frameSequence = tickId; lastTick = tickId;
        worldRoot.updateWorldMatrix(true, true);
        actor.shoes?.update(tickId);
        return true;
      },
      publishPose(tickId) {
        // Preparing/changing an action can publish an already selected pose
        // after clothing accepts it, without advancing captured motion again.
        if (actorDisposed || !Number.isSafeInteger(tickId) || tickId <= lastTick) {
          throw Error('A new monotonic pose-publication tick is required');
        }
        finalData.set(motion.native.boneData);
        actor.frameSequence = tickId; lastTick = tickId;
        worldRoot.updateWorldMatrix(true, true); actor.shoes?.update(tickId);
        return true;
      },
      prepareRender() { if (!actorDisposed) motion.prepareRender(); },
      report() { return {id, source: ACTOR_SOURCE, geometryShared: mesh.geometry === geometry,
        sameRendererScene: viewer.renderer === renderer && viewer.scene === scene,
        runtimeMeshUsesCommonTHREE: mesh instanceof THREE.Mesh,
        runtimeMaterialsUseCommonTHREE: materials.every(m => m.constructor === THREE[m.type]),
        historicalSourceMeshConstructorMatches: sourceMeshConstructorMatches,
        motionConstructorInjected: NativeMotion !== raw.motion.constructor,
        appearanceUniformOwnership: 'shared original pre-native P01 optical/shape wrappers; independent actor native.U',
        sharedOriginalUniforms: captures.map(c => Object.keys(c.custom || c.source.uniforms || {})),
        displayVertices: geometry.attributes.position.count, triangles: geometry.index.count / 3,
        materialCount: materials.length, groups: geometry.groups.map(g => ({...g})),
        frameSequence: actor.frameSequence, timeSeconds: actor.timeSeconds,
        motion: motion.report(), shoes: actor.shoes?.report() ?? null}; },
      dispose() {
        if (actorDisposed) return;
        actor.shoes?.dispose(); motion.dispose(); worldRoot.removeFromParent();
        for (const material of [...materials, ...appearanceMaterials]) material.dispose();
        // Donor/shared full geometry, static textures and native data remain owned by the factory source.
        actors.delete(id); actorDisposed = true;
      },
    };
    actors.set(id, actor);
    try { await actor.setMotion(mode, {phaseSeconds}); } catch (error) { actor.dispose(); throw error; }
    return actor;
  }

  const sourceObjects = [source.mesh, ...sourceAttachments.map(item => item.object)];
  return {create, actors, source: ACTOR_SOURCE, baseMatrix, sourceObjects,
    // Explicitly scoped: body plus the original NativeMotion-owned brow/lash
    // attachments. Hair templates are owned/hidden by createHairFactory.
    // Preserve .visible: original faceDiffusion uses the donor mesh as its
    // optical-control handle even after it no longer belongs to the scene.
    detachSource() { for (const object of sourceObjects) object.removeFromParent(); },
    report: () => ({source: ACTOR_SOURCE, count: actors.size, actors: [...actors.values()].map(a => a.report())}),
    dispose() { for (const actor of [...actors.values()]) actor.dispose(); disposed = true; }};
}
