import { assertRigid, createMotionFacade, placeSolver, resetCollisionHistory } from './placement.mjs';

export const SOURCE_LOCK = Object.freeze({
  repository: 'haihao0307/guilin-dem-pipeline',
  sourceCommit: '64cd31324f1a7c4762c21531fe5559b14face2fe',
  runtimeSHA256: 'cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790',
  source: 'F13-photo-fiber-motion',
  status: 'older published dense-hair candidate; not acceptance of the newer structure line',
  strands: 114171, pointsPerStrand: 49, guides: 43, nodesPerGuide: 25,
  hairTrianglesPerPass: 10960416, pathTextureBytes: 89522176,
});

const rendererCaches = new WeakMap();
const cloneValue = value => {
  if (value == null || typeof value !== 'object' || value.isTexture) return value;
  if (typeof value.clone === 'function') return value.clone();
  if (ArrayBuffer.isView(value)) return value.slice();
  if (Array.isArray(value)) return value.map(cloneValue);
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cloneValue(v)]));
};

function cloneUniforms(uniforms) {
  return Object.fromEntries(Object.entries(uniforms).map(([key, uniform]) => [key,
    { ...uniform, value: cloneValue(uniform.value) }]));
}

function acquireCache(viewer, HairPassCache) {
  let record = rendererCaches.get(viewer.renderer);
  if (!record) {
    const existing = viewer.hairPassCache;
    if (!existing && !HairPassCache) throw new Error('A native HairPassCache constructor is required');
    const cache = existing || new HairPassCache(viewer);
    if (cache.disposed || cache.v.scene !== viewer.scene || cache.v.renderer !== viewer.renderer) {
      throw new Error('HairPassCache must belong to the one shared scene/renderer');
    }
    viewer.hairPassCache = cache;
    record = { cache, viewer, owned: !existing, users: 0, hiddenTemplates: new Map() };
    rendererCaches.set(viewer.renderer, record);
  }
  if (record.viewer.scene !== viewer.scene) throw new Error('One renderer cannot own two native hair-pass scenes');
  record.users++;
  return record;
}

function hideTemplate(record, template) {
  let state = record.hiddenTemplates.get(template);
  if (state) { state.users++; return; }
  state = { users: 1, visible: template.mesh.visible, attached: record.cache.hairs.has(template) };
  record.hiddenTemplates.set(template, state);
  template.mesh.visible = false;
  record.cache.detach(template);
}

function restoreTemplate(record, template) {
  const state = record.hiddenTemplates.get(template);
  if (!state || --state.users) return;
  record.hiddenTemplates.delete(template);
  template.mesh.visible = state.visible;
  if (state.attached) record.cache.attach(template);
}

function makeFibers(THREE, template, viewer, id) {
  const fibers = Object.create(Object.getPrototypeOf(template));
  for (const key of ['api', 'source', 'parts', 'count', 'samples', 'partRanges',
    'pathRootError', 'pathTexture', 'restTexture']) fibers[key] = template[key];
  fibers.viewer = viewer;
  fibers.deformations = new Float32Array(43 * 25 * 4);
  fibers.deformationTexture = new THREE.DataTexture(fibers.deformations, 43, 25, THREE.RGBAFormat, THREE.FloatType);
  fibers.deformationTexture.minFilter = fibers.deformationTexture.magFilter = THREE.NearestFilter;
  fibers.deformationTexture.needsUpdate = true;
  fibers.u = cloneUniforms(template.u);
  fibers.u.pathMap.value = template.pathTexture;
  fibers.u.restVertices.value = template.restTexture;
  fibers.u.poseMap.value = template.restTexture;
  fibers.u.deformationMap.value = fibers.deformationTexture;
  fibers.u.activePose.value = 0;
  fibers.u.physicsOn.value = 0;
  fibers.u.nativeDepth.value = null;
  fibers.u.useNativeDepth.value = 0;
  fibers.u.nativeMeshWorld.value = viewer.mesh.matrixWorld;
  const source = template.material;
  fibers.material = new THREE.ShaderMaterial({
    uniforms: fibers.u, vertexShader: source.vertexShader, fragmentShader: source.fragmentShader,
    defines: { ...source.defines }, extensions: { ...source.extensions }, glslVersion: source.glslVersion,
    lights: source.lights, fog: source.fog,
  });
  for (const key of ['side', 'shadowSide', 'transparent', 'opacity', 'depthTest', 'depthWrite',
    'depthFunc', 'colorWrite', 'blending', 'blendSrc', 'blendDst', 'blendEquation',
    'blendSrcAlpha', 'blendDstAlpha', 'blendEquationAlpha', 'premultipliedAlpha',
    'dithering', 'toneMapped', 'forceSinglePass', 'alphaTest', 'alphaToCoverage',
    'polygonOffset', 'polygonOffsetFactor', 'polygonOffsetUnits']) {
    fibers.material[key] = source[key];
  }
  fibers.mesh = new THREE.Mesh(template.mesh.geometry, fibers.material);
  fibers.mesh.name = 'F13-complete-hair-' + id;
  fibers.mesh.frustumCulled = false;
  fibers.mesh.receiveShadow = template.mesh.receiveShadow;
  fibers.mesh.castShadow = template.mesh.castShadow;
  fibers.mesh.renderOrder = template.mesh.renderOrder;
  fibers.mesh.userData.platformAppearance = true;
  fibers.mesh.userData.crowdActorId = id;
  fibers.viewport = new THREE.Vector4();
  fibers.mesh.onBeforeRender = () => fibers.uniforms();
  return fibers;
}

function disposePhysics(photo) {
  if (!photo) return;
  photo.collisions?.surface?.dispose();
  for (const key of ['bodyTexture', 'radiusTexture', 'nativeTexture']) photo.binding?.[key]?.dispose();
}

/**
 * Dependency injection deliberately reuses the classes in the hash-verified
 * F13 runtime. This module imports no second Three build or alternate solver.
 * The body factory must prepare each actor before create(actor).
 */
export function createHairFactory({ THREE, template, PhotoDynamics, renderViewer,
  HairPassCache, hideSource = true } = {}) {
  if (!THREE || !template || !renderViewer || typeof PhotoDynamics !== 'function') {
    throw new Error('Hair factory needs THREE, native fibers, PhotoDynamics and the shared viewer');
  }
  if (template.count !== SOURCE_LOCK.strands || template.samples?.length !== 43
      || template.mesh.geometry.instanceCount !== SOURCE_LOCK.strands
      || template.pathTexture.image.data.byteLength !== SOURCE_LOCK.pathTextureBytes) {
    throw new Error('Expected the complete pinned F13 population; no reduced-density substitution');
  }
  const record = acquireCache(renderViewer, HairPassCache), actors = new Set();
  let disposed = false;
  if (hideSource) hideTemplate(record, template);

  function create(actor, options = {}) {
    if (disposed) throw new Error('Hair factory is disposed');
    const { viewer, motion, model } = actor;
    if (!viewer?.mesh || !model || !motion?.native || !motion.skinCache) {
      throw new Error('Body actor must already have its own prepared native motion and pose cache');
    }
    if (viewer.renderer !== renderViewer.renderer || viewer.scene !== renderViewer.scene) {
      throw new Error('All hair actors must use the shared renderer and scene');
    }
    const id = String(actor.id ?? actors.size);
    viewer.mesh.updateWorldMatrix(true, false);
    const initialPlacement = viewer.mesh.matrixWorld.clone();
    assertRigid(initialPlacement);
    const fibers = makeFibers(THREE, template, viewer, id);
    const bridge = createMotionFacade(THREE, motion);
    // This mesh is never added to a scene or rendered. It supplies the native
    // neutral vertex accessor and an independently controlled matrixWorld.
    const solverMesh = new THREE.Mesh(viewer.geometry, viewer.mesh.material);
    solverMesh.morphTargetInfluences = viewer.mesh.morphTargetInfluences || [];
    solverMesh.morphTargetDictionary = viewer.mesh.morphTargetDictionary || {};
    solverMesh.matrixAutoUpdate = false;
    solverMesh.matrix.identity(); solverMesh.matrixWorld.identity();
    const solverViewer = Object.create(viewer);
    solverViewer.mesh = solverMesh;
    solverViewer.geometry = viewer.geometry;
    solverViewer.hairNativeMotion = bridge.facade;
    let photo;
    try {
      photo = new PhotoDynamics(fibers, bridge.facade, solverViewer, model);
      // Even an actor in its native "still" pose can move through the world.
      // The original collider update only applies bone transport when active;
      // activate that transport locally while retaining identity native bones.
      const nativeColliderUpdate = photo.collisions.update;
      if (typeof nativeColliderUpdate === 'function') {
        photo.collisions.update = function (...args) {
          return bridge.withBoneTransport(() => nativeColliderUpdate.apply(this, args));
        };
      }
      placeSolver(photo, initialPlacement);
      solverMesh.matrixWorld.copy(initialPlacement);
      bridge.sync(initialPlacement, true); bridge.enable();
      photo.binding.updateFrame();
      photo.dynamics.active = true;
      photo.enabled = options.physics !== false;
      photo.wind = !!options.wind;
      fibers.u.physicsOn.value = photo.enabled ? 1 : 0;
      fibers.u.headCenter.value.fromArray(photo.binding.center).applyMatrix4(photo.binding.frame);
      renderViewer.scene.add(fibers.mesh);
      record.cache.attach(fibers);
    } catch (error) {
      disposePhysics(photo); fibers.deformationTexture.dispose(); fibers.material.dispose();
      throw error;
    }
    let dead = false, updates = 0, lastTick = null;
    const instance = {
      id, fibers, dynamics: photo,
      update(dt = 1 / 60, tickId = null) {
        if (dead) throw new Error('Hair actor is disposed');
        if (!Number.isFinite(dt) || dt < 0 || dt > .1) throw new Error('Hair dt must be finite and within 0..0.1 seconds');
        if (tickId !== null && tickId === lastTick) throw new Error('Hair already consumed this actor tick');
        viewer.mesh.updateWorldMatrix(true, false);
        solverMesh.matrixWorld.copy(viewer.mesh.matrixWorld);
        bridge.sync(solverMesh.matrixWorld);
        let changed = false;
        if (photo.enabled && dt > 0) {
          // Native PhotoDynamics retains the original 43-guide solver; its
          // advance hook is a no-op because body.advance already owns time.
          photo.dynamics.active = true;
          changed = photo.update(dt);
        } else {
          photo.binding.updateFrame();
          fibers.u.physicsOn.value = photo.enabled ? 1 : 0;
          fibers.u.headCenter.value.fromArray(photo.binding.center).applyMatrix4(photo.binding.frame);
        }
        updates++; lastTick = tickId;
        return changed;
      },
      setPhysics(enabled) {
        const next = !!enabled;
        if (next && !photo.enabled) instance.reset();
        photo.enabled = next; fibers.u.physicsOn.value = next ? 1 : 0;
      },
      setWind(enabled) { photo.wind = !!enabled; photo.dynamics.active = true; },
      setColor(name) { fibers.color(name); },
      reset() {
        viewer.mesh.updateWorldMatrix(true, false);
        solverMesh.matrixWorld.copy(viewer.mesh.matrixWorld);
        bridge.sync(solverMesh.matrixWorld); bridge.resetKinematics();
        photo.reset(); resetCollisionHistory(photo); photo.dynamics.active = true; lastTick = null;
      },
      report({ diagnostics = false } = {}) {
        const report = {
          id, source: SOURCE_LOCK.source, strands: fibers.count, guides: 43, nodes: 1075,
          hairTrianglesPerPass: SOURCE_LOCK.hairTrianglesPerPass,
          physics: photo.enabled, wind: photo.wind, updates, lastTick,
          solverSteps: photo.dynamics.steps, solverSeconds: photo.dynamics.time,
          motionVersion: motion.version, motionSeconds: motion.time,
          peakDeformationMM: photo.peak * 1000,
          deformationBytes: fibers.deformations.byteLength,
          geometryShared: fibers.mesh.geometry === template.mesh.geometry,
          pathTextureShared: fibers.pathTexture === template.pathTexture,
          materialPrivate: fibers.material !== template.material,
          deformationPrivate: fibers.deformationTexture !== template.deformationTexture,
          poseTextureUUID: motion.skinCache.target.textures[0].uuid,
          crossCharacterCollision: false, fullPerStrandSimulation: false,
          placement: Array.from(viewer.mesh.matrixWorld.elements),
        };
        if (diagnostics) report.diagnostics = photo.report();
        return report;
      },
      dispose() {
        if (dead) return; dead = true;
        record.cache.detach(fibers); fibers.mesh.removeFromParent();
        fibers.material.dispose(); fibers.deformationTexture.dispose(); disposePhysics(photo);
        actors.delete(instance);
      },
    };
    actors.add(instance);
    return instance;
  }

  return {
    source: SOURCE_LOCK, create,
    report: () => ({ source: SOURCE_LOCK, actors: [...actors].map(a => a.report()),
      sharedPathTextureBytes: template.pathTexture.image.data.byteLength,
      hairPassCachesForRenderer: 1, nativeHairPassStats: { ...record.cache.stats } }),
    dispose() {
      if (disposed) return; disposed = true;
      for (const actor of [...actors]) actor.dispose();
      if (hideSource) restoreTemplate(record, template);
      if (--record.users === 0) {
        if (record.owned && record.cache.hairs.size === 0) {
          record.cache.dispose();
          if (renderViewer.hairPassCache === record.cache) renderViewer.hairPassCache = null;
        }
        rendererCaches.delete(renderViewer.renderer);
      }
    },
  };
}

export const create = (factory, actor, options) => factory.create(actor, options);
export const update = (instance, dt, tickId) => instance.update(dt, tickId);
export const dispose = instance => instance.dispose();
