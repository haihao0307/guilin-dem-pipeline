import {prepareSharedNativeShoe} from './SharedNativeShoes.mjs';
import {nativeFootSamples, fitNativeCanvasFoot, createCanvasInnerSurface, checkNativeShoeSections} from './NativeShoeFit.mjs';

export const SHOE_SOURCE = Object.freeze({
  repository: 'haihao0307/Humanoid-Rig-Lab-Next',
  commit: '4306b375404a40b7b9842f29cfa5e53fcde70278',
  path: 'shoe-workshop/r14/src',
  scanSHA256: '72a9b6f1075edb2f6b929bf4ad3b02cb603f80f71af3b809594df5fea0095055',
  verifiedSharedAdapterSHA256: '0df1f2f0375aab318779f26fa325a32e0056fed4c574c8bd7b49c70cfeab1ba8',
});

const SIDES = ['L', 'R'];
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const rowPosition = (THREE, matrix) => new THREE.Vector3(matrix[3], matrix[11], -matrix[7]);

/** Real native control vertices and the full CSR select each anatomical foot.
 * Native toe joints determine the foot's neutral forward axis. No synthetic
 * skeleton, guessed +/- foot offset or replaced shoe geometry is introduced.
 */
export function measureNativeFeet(THREE, model, native) {
  const rig = native.rig, names = native.names;
  if (names.length !== 104 || !native.range || !native.packed) throw Error('Complete native binding required for footwear');
  const up = new THREE.Vector3(0, 1, 0), results = {};
  for (const side of SIDES) {
    const footName = 'foot.' + side, footIndex = names.indexOf(footName);
    const toeNames = [1, 3, 5].map(n => 'toe' + n + '-1.' + side);
    const toeIndices = toeNames.map(name => names.indexOf(name));
    if (footIndex < 0 || toeIndices.some(i => i < 0)) throw Error('Original anatomical foot/toe bones missing');
    const ankle = rowPosition(THREE, rig.restMatrices[footIndex]);
    const toeRest = toeIndices.map(i => rowPosition(THREE, rig.restMatrices[i]));
    const forward = toeRest.reduce((v, p) => v.add(p), new THREE.Vector3()).multiplyScalar(1 / toeRest.length).sub(ankle);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) throw Error('Degenerate native toe axis');
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const descendants = new Set([footIndex]);
    for (let pass = 0; pass < names.length; pass++) {
      const count = descendants.size;
      for (let j = 0; j < names.length; j++) if (descendants.has(rig.parents[j])) descendants.add(j);
      if (count === descendants.size) break;
    }
    const bounds = {xMin: Infinity, xMax: -Infinity, zMin: Infinity, zMax: -Infinity,
      yMin: Infinity, yMax: -Infinity};
    const position = new THREE.Vector3(), ids = [];
    for (let i = 0; i < model.bodyCount; i++) {
      let weight = 0;
      for (let k = 0; k < native.range[i * 2 + 1]; k++) {
        const offset = (native.range[i * 2] + k) * 8;
        if (descendants.has(native.packed[offset + 3])) weight += native.packed[offset + 4];
      }
      if (weight <= .5) continue;
      position.set(model.positions[i * 3], model.positions[i * 3 + 2], -model.positions[i * 3 + 1]);
      const y = position.y; position.sub(ankle);
      const x = position.dot(right), z = position.dot(forward);
      bounds.xMin = Math.min(bounds.xMin, x); bounds.xMax = Math.max(bounds.xMax, x);
      bounds.zMin = Math.min(bounds.zMin, z); bounds.zMax = Math.max(bounds.zMax, z);
      bounds.yMin = Math.min(bounds.yMin, y); bounds.yMax = Math.max(bounds.yMax, y);
      ids.push(i);
    }
    if (ids.length < 20) throw Error('Insufficient original native foot surface: ' + side);
    results[side] = {side, footName, footIndex, toeNames, toeIndices, toeRest,
      ankle, forward, right, up: up.clone(), bounds, vertices: ids,
      lengthM: bounds.zMax - bounds.zMin, widthM: bounds.xMax - bounds.xMin};
  }
  return results;
}

/** Foot motion stays rigid; toe matrices are tracked and the anatomical toe
 * axis is used for rest fitting. R14's bend parameter is a geometric design
 * operation, so it is deliberately not presented as a force/pressure solver.
 */
export function createFootShoeBinding({THREE, actor, nativeModel, shared, measurements,
  fitting, innerSurface, autoGroundLift = true} = {}) {
  if (!actor?.motion?.native || !actor.worldRoot || !actor.baseMeshMatrix) throw Error('Prepared original body actor required');
  const feet = measurements || measureNativeFeet(THREE, actor.model, actor.motion.native);
  const items = [], toePoint = new THREE.Vector3();
  let disposed = false, lastTick = null;
  const modelBounds = new THREE.Box3();
  for (const part of nativeModel.parts) modelBounds.union(part.geometry.boundingBox);
  const inner = innerSurface || createCanvasInnerSurface(nativeModel);
  for (const side of SIDES) {
    const foot = feet[side], samples = nativeFootSamples(THREE, actor.model, foot);
    const fit = fitting?.[side] || fitNativeCanvasFoot(nativeModel.last, samples, inner);
    const restSections = checkNativeShoeSections(nativeModel.last, inner, samples, fit);
    if (!restSections.all.passed || !restSections.forefoot.passed || !restSections.toes.passed) {
      const error = Error('Original canvas foot failed the fitted inner-triangle section check');
      error.shoeFit = {side, fit, restSections}; throw error;
    }
    const shoe = shared.create({name: 'R14-' + nativeModel.style.id + '-' + actor.id + '-' + side, mirror: side === 'R'});
    const frame = new THREE.Group(); frame.name = 'native-' + foot.footName + '-shoe-' + actor.id;
    frame.matrixAutoUpdate = false; frame.add(shoe); actor.worldRoot.add(frame);
    const mirror = side === 'R' ? -1 : 1, angle = mirror * fit.angleDegrees * Math.PI / 180;
    const right = foot.right.clone().multiplyScalar(Math.cos(angle)).addScaledVector(foot.forward, -Math.sin(angle));
    const forward = foot.forward.clone().multiplyScalar(Math.cos(angle)).addScaledVector(foot.right, Math.sin(angle));
    const origin = foot.ankle.clone().addScaledVector(forward, fit.cz * .001).addScaledVector(right, mirror * fit.cx * .001);
    origin.y = foot.bounds.yMin + fit.cy * .001;
    // Keep unit conversion/mirror on the shared shoe child. The explicit
    // static frame scale changes the complete original shoe, including sole
    // thickness. No vertex, normal, UV, index, material or foot is changed.
    const restFit = new THREE.Matrix4().makeBasis(right, foot.up, forward).setPosition(origin)
      .multiply(new THREE.Matrix4().makeScale(fit.sx, fit.sy, fit.sz));
    const restActor = actor.baseMeshMatrix.clone().multiply(restFit);
    const localScale = new THREE.Matrix4().makeScale(side === 'R' ? -.001 : .001, .001, .001);
    const restBounds = modelBounds.clone().applyMatrix4(restActor.clone().multiply(localScale));
    items.push({side, foot, shoe, frame, restFit, restBounds, fit, restSections,
      toeWorld: foot.toeRest.map(() => new THREE.Vector3()), footWorld: new THREE.Vector3()});
  }
  const requiredSoleLiftM = Math.max(0, -Math.min(...items.map(item => item.restBounds.min.y)));
  if (autoGroundLift) actor.worldRoot.position.y += requiredSoleLiftM;

  function update(tickId = actor.frameSequence) {
    if (disposed) return false;
    // Placement is also allowed to change without a new skeletal tick.
    actor.worldRoot.updateWorldMatrix(true, false);
    actor.mesh.updateWorldMatrix(true, false);
    for (const item of items) {
      item.frame.matrix.copy(actor.baseMeshMatrix)
        .multiply(actor.motion.skinMatrix(item.foot.footName)).multiply(item.restFit);
      item.frame.matrixWorldNeedsUpdate = true; item.frame.updateWorldMatrix(true, true);
      item.footWorld.copy(item.foot.ankle).applyMatrix4(actor.motion.skinMatrix(item.foot.footName))
        .applyMatrix4(actor.mesh.matrixWorld);
      for (let i = 0; i < item.foot.toeNames.length; i++) {
        toePoint.copy(item.foot.toeRest[i]).applyMatrix4(actor.motion.skinMatrix(item.foot.toeNames[i]))
          .applyMatrix4(actor.mesh.matrixWorld);
        item.toeWorld[i].copy(toePoint);
      }
    }
    lastTick = tickId; return true;
  }

  const binding = {items, requiredSoleLiftM, update,
    report() { return {source: SHOE_SOURCE, style: nativeModel.style.id,
      binding: 'native foot skin matrices; original toe-axis and full-CSR foot-surface rest calibration',
      sourceUnits: 'millimetres', renderedUnits: 'metres', unitScale: .001,
      mirroredRightOnly: true, geometryShared: true, geometryChangedByBinding: false,
      materialShared: true, independentTransforms: true, frameSequence: lastTick,
      requiredSoleLiftM, autoGroundLift,
      originalDesignParameters: {...nativeModel.last.params},
      forceSolved: false, independentFootwearPhysics: false, wearerFitValidated: false,
      fitScope: 'actual wearer control vertices; static whole-shoe size and placement; exact inner canvas triangle section samples, not a complete collision/comfort certification',
      toeFlexion: 'tracked anatomical toe joints; rigid shoe, no runtime geometric flex solver',
      feet: items.map(({side, foot, footWorld, toeWorld, fit, restSections}) => ({side, footBone: foot.footName,
        toeBones: foot.toeNames, sourceFootVertices: foot.vertices.length,
        measuredFootLengthM: foot.lengthM, measuredFootWidthM: foot.widthM,
        fitScale: [fit.sx, fit.sy, fit.sz], fitYawDegrees: (side === 'R' ? -1 : 1) * fit.angleDegrees,
        fitPlacementMm: {canonicalX: fit.cx, yAboveSourceFootFloor: fit.cy, forward: fit.cz},
        renderedShoeBoundsM: modelBounds.getSize(new THREE.Vector3()).multiply(new THREE.Vector3(fit.sx, fit.sy, fit.sz)).multiplyScalar(.001).toArray(),
        renderedLastLengthM: nativeModel.last.L * fit.sz * .001,
        renderedMidsoleTopAboveDesignZeroM: nativeModel.last.soleTop(.5) * fit.sy * .001,
        renderedInsoleTopAboveDesignZeroM: (nativeModel.last.soleTop(.5) + 1.3) * fit.sy * .001,
        sampledRestSections: restSections,
        sampledCurrentPoseSections: checkNativeShoeSections(nativeModel.last, inner,
          nativeFootSamples(THREE, actor.model, foot, actor.motion.native, actor.motion.skinMatrix(foot.footName)), fit),
        footWorld: footWorld.toArray(), toeWorld: toeWorld.map(p => p.toArray())}))}; },
    dispose() {
      if (disposed) return;
      for (const item of items) { shared.release(item.shoe); item.frame.removeFromParent(); }
      if (autoGroundLift) actor.worldRoot.position.y -= requiredSoleLiftM;
      if (actor.shoes === binding) actor.shoes = null;
      disposed = true;
    },
  };
  actor.worldRoot.updateWorldMatrix(true, true); update(); actor.shoes = binding;
  return binding;
}

/** Supply the exact R14 buildStyle and initialized StyleMaterials. The resource
 * cache key is the complete native recipe, not an actor id or a pose cache.
 */
export async function createNativeShoeFactory({THREE, renderer, buildStyle, StyleMaterials,
  nativeMaterials, scanData, styles, onProgress = () => {}} = {}) {
  if (!THREE || typeof buildStyle !== 'function') throw Error('Original THREE and original R14 buildStyle required');
  const ownsMaterials = !nativeMaterials;
  const materials = nativeMaterials || new StyleMaterials(renderer, scanData);
  if (ownsMaterials) { onProgress('加载原 R14 鞋材质'); await materials.init(); }
  const cache = new Map(), measurements = new WeakMap(), bindings = new Set();
  let disposed = false;
  return {
    bind(actor, {style = 'canvas', params = {}, autoGroundLift = true} = {}) {
      if (disposed || actor.shoes) throw Error('Disposed shoe factory or actor already has footwear');
      let feet = measurements.get(actor.model);
      if (!feet) { feet = measureNativeFeet(THREE, actor.model, actor.motion.native); measurements.set(actor.model, feet); }
      let definition = styles?.find(s => s.id === style);
      // The model exposes its own original dimensions when a separate STYLES
      // export is not passed. Probe geometry remains an actual R14 model.
      let probe = null;
      if (!definition) { probe = buildStyle(style, params); definition = probe.style; }
      const desired = {
        length: (Math.max(feet.L.lengthM, feet.R.lengthM) * 1000 + 12) / definition.length,
        width: (Math.max(feet.L.widthM, feet.R.widthM) * 1000 + 6) / definition.width,
      };
      const recipe = {length: clamp(desired.length, .9, 1.1), width: clamp(desired.width, .88, 1.15),
        instep: 8, thickness: 1.35, bend: 0, ...params};
      const key = JSON.stringify([style, ...Object.entries(recipe).sort(([a], [b]) => a.localeCompare(b))]);
      let resource = cache.get(key);
      if (!resource) {
        const model = buildStyle(style, recipe);
        resource = {model, shared: prepareSharedNativeShoe(model, materials), desired, recipe,
          inner: createCanvasInnerSurface(model), fits: new WeakMap()}; cache.set(key, resource);
      }
      if (probe) for (const part of probe.parts) part.geometry.dispose();
      let fitting = resource.fits.get(feet);
      if (!fitting) {
        onProgress('按原生脚部截面匹配完整 R14 鞋尺寸');
        fitting = Object.fromEntries(SIDES.map(side => [side,
          fitNativeCanvasFoot(resource.model.last, nativeFootSamples(THREE, actor.model, feet[side]), resource.inner)]));
        resource.fits.set(feet, fitting);
      }
      const binding = createFootShoeBinding({THREE, actor, nativeModel: resource.model,
        shared: resource.shared, measurements: feet, fitting, innerSurface: resource.inner, autoGroundLift});
      const originalReport = binding.report;
      binding.report = () => ({...originalReport(), nativeSizeRequest: desired,
        nativeSizeClamped: desired.length !== recipe.length || desired.width !== recipe.width});
      const originalDispose = binding.dispose;
      binding.dispose = () => { originalDispose(); bindings.delete(binding); };
      bindings.add(binding); return binding;
    },
    report() { return {source: SHOE_SOURCE, actors: bindings.size, uniqueNativeRecipes: cache.size,
      resources: [...cache.values()].map(r => ({style: r.model.style.id,
        params: r.recipe, activeShoes: r.shared.activeCount, trianglesPerShoe: r.model.report.triangles,
        geometryObjects: r.shared.resources.length})),
      scope: 'immutable geometry/material sharing; no draw-call reduction or footwear force solver claimed'}; },
    dispose() {
      for (const binding of [...bindings]) binding.dispose();
      for (const resource of cache.values()) resource.shared.disposeGeometry();
      if (ownsMaterials && typeof materials.dispose === 'function') materials.dispose();
      disposed = true;
    },
  };
}
