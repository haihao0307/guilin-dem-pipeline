/* R05 diagnostic only. Load after the fixed R04 native workbench is ready.
 * This file does not implement a production lip repair or replace any mesh.
 */
(function () {
  'use strict';
  if (window.__R05_MOTION_DIAG__) throw Error('R05 motion diagnostic is already installed');

  const VERSION = 'LIP-MOTION-R05-ATTRIBUTION-01';
  const qa = window.__IDENTITY_QA__;
  const viewer = qa?.viewer?.(), model = qa?.model?.();
  const structure = model?.lipStructure, lip = viewer?.currentLip;
  const solver = structure?.mother?.surfaces?.get(lip?.geometry), top = solver?.topology;
  if (!viewer || !model || !lip || !solver || !top || top.geometry !== lip.geometry)
    throw Error('Fixed native lip solver and topology are unavailable');
  if (window.innerLip?.version !== 'LIP-INNER-R04')
    throw Error('This diagnostic requires the existing R04 workbench');

  const own = (object, key) => Object.getOwnPropertyDescriptor(object, key);
  const clone = value => structuredClone(value);
  const sameDescriptor = (a, b) => a === undefined ? b === undefined : b !== undefined &&
    ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(key => a[key] === b[key]);
  function restoreDescriptor(object, key, descriptor) {
    if (descriptor) Object.defineProperty(object, key, descriptor);
    else if (!Reflect.deleteProperty(object, key)) throw Error('Cannot restore inherited ' + String(key));
  }
  function replaceOwn(object, key, value) {
    const descriptor = own(object, key);
    if (descriptor?.configurable === false) throw Error('Non-configurable native member: ' + String(key));
    Object.defineProperty(object, key, {
      configurable: true, writable: true, enumerable: descriptor?.enumerable || false, value
    });
  }
  const originalApply = solver.apply, originalApplyDescriptor = own(solver, 'apply');
  if (typeof originalApply !== 'function') throw Error('Native solver.apply is not callable');
  const events = [], errors = [];
  let mode = 'baseline', running = false, outerInstalled = false, sequence = 0;
  let lastExecution = null, needsNativeRebuild = false, lastRestore = null;

  function boundContext() {
    if (qa.viewer() !== viewer || qa.model() !== model || viewer.currentLip !== lip ||
        model.lipStructure !== structure || top.geometry !== lip.geometry ||
        structure.mother.surfaces.get(lip.geometry) !== solver || solver.topology !== top)
      throw Error('Native person/solver identity changed; re-install on the intended person');
    const a = top.geometry.attributes.position;
    if (!a || a.isInterleavedBufferAttribute || a.itemSize !== 3 ||
        a.count !== top.count || a.array.length !== top.count * 3)
      throw Error('Original lip position buffer/count changed');
    if (model.positions && (a.array === model.positions || a.array.buffer === model.positions.buffer))
      throw Error('Refusing to modify a canonical position buffer');
    return a;
  }
  function declaredPose() {
    return clone(window.lipWorkbench?.pose?.() || structure.performance.settings);
  }
  function positionDifference(before, after) {
    if (before.length !== after.length) throw Error('Diagnostic position length changed');
    let changedVertices = 0, maximumMM = 0, sumSquared = 0;
    for (let i = 0; i < before.length; i += 3) {
      const x = after[i] - before[i], y = after[i + 1] - before[i + 1], z = after[i + 2] - before[i + 2];
      if (![x, y, z].every(Number.isFinite)) throw Error('Non-finite native position');
      const squared = x * x + y * y + z * z;
      if (squared > 0) changedVertices++;
      maximumMM = Math.max(maximumMM, Math.sqrt(squared) * 1000); sumSquared += squared;
    }
    return { changedVertices, maximumMM, rmsMM: Math.sqrt(sumSquared / (before.length / 3)) * 1000 };
  }
  function remember(record) {
    events.push(record); if (events.length > 40) events.shift();
  }
  function outerIsOriginal() {
    return solver.apply === originalApply && sameDescriptor(own(solver, 'apply'), originalApplyDescriptor);
  }
  function detachOuter() {
    if (outerInstalled) {
      if (solver.apply !== instrumentedApply) throw Error('Another owner changed solver.apply while the diagnostic was active');
      restoreDescriptor(solver, 'apply', originalApplyDescriptor); outerInstalled = false;
    }
    if (!outerIsOriginal()) throw Error('Original solver.apply descriptor was not restored');
  }

  function instrumentedApply(...args) {
    if (this !== solver || running) throw Error('Unexpected or recursive native solver call');
    const position = boundContext(), array = position.array;
    const beforeLocal = array.slice();
    const pairs = top.pairs, lips = top.lips;
    const pairMap = pairs.map, iterator = lips[Symbol.iterator];
    const mapDescriptor = own(pairs, 'map'), iteratorDescriptor = own(lips, Symbol.iterator);
    if (typeof pairMap !== 'function' || typeof iterator !== 'function') throw Error('Native stage boundaries are not callable');
    const record = {
      sequence: ++sequence, mode, startedAt: new Date().toISOString(),
      poseBefore: declaredPose(), geometryUUID: top.geometry.uuid || null, vertices: top.count,
      pairMapCalls: 0, lipsIteratorCalls: 0, positionRestores: 0,
      innerHooksRestored: false, completed: false,
      positionOnlyIntervention: true, canonicalOrDNAWrittenByDiagnostic: false,
      closurePressureFieldPreserved: true,
      interpretation: 'Stage counterfactual: declared controls are retained, evaluated displayed motion is deliberately changed.'
    };
    let afterLocal = null, result, failure = null;
    running = true;
    try {
      replaceOwn(pairs, 'map', function (...mapArgs) {
        record.pairMapCalls++;
        if (record.pairMapCalls !== 1 || this !== pairs || boundContext().array !== array)
          throw Error('Unexpected after-local boundary');
        afterLocal = array.slice();
        record.nativeLocalDelta = positionDifference(beforeLocal, afterLocal);
        if (record.mode === 'no-local') {
          array.set(beforeLocal); position.needsUpdate = true; record.positionRestores++;
          record.removedPositionDelta = record.nativeLocalDelta;
        }
        return Reflect.apply(pairMap, this, mapArgs);
      });
      replaceOwn(lips, Symbol.iterator, function (...iteratorArgs) {
        record.lipsIteratorCalls++;
        if (record.lipsIteratorCalls !== 1 || this !== lips || !afterLocal || boundContext().array !== array)
          throw Error('Unexpected after-closure boundary');
        const closureStart = record.mode === 'no-local' ? beforeLocal : afterLocal;
        record.nativeClosureDelta = positionDifference(closureStart, array);
        if (record.mode === 'no-closure') {
          record.removedPositionDelta = positionDifference(afterLocal, array);
          array.set(afterLocal); position.needsUpdate = true; record.positionRestores++;
        }
        return Reflect.apply(iterator, this, iteratorArgs);
      });
      result = Reflect.apply(originalApply, this, args);
      if (result && typeof result.then === 'function') throw Error('Native solver became asynchronous');
      if (record.pairMapCalls !== 1 || record.lipsIteratorCalls !== 1 || record.positionRestores !== 1)
        throw Error('Unrecognized native stage counts');
      record.poseAfter = declaredPose();
      record.declaredPoseUnchanged = JSON.stringify(record.poseBefore) === JSON.stringify(record.poseAfter);
      if (!record.declaredPoseUnchanged) throw Error('Declared native pose changed during the diagnostic call');
      record.completed = true; needsNativeRebuild = true;
    } catch (error) {
      failure = error; record.error = String(error); needsNativeRebuild = true;
      // No failed/partially evaluated geometry is a candidate. This restores
      // the captured display input; a subsequent native update is still needed.
      if (position.array === array && array.length === beforeLocal.length) {
        array.set(beforeLocal); position.needsUpdate = true; record.failedPositionInputRestored = true;
      }
    } finally {
      const restorationErrors = [];
      for (const [object, key, descriptor, original] of [
        [pairs, 'map', mapDescriptor, pairMap], [lips, Symbol.iterator, iteratorDescriptor, iterator]
      ]) {
        try {
          restoreDescriptor(object, key, descriptor);
          if (object[key] !== original || !sameDescriptor(own(object, key), descriptor))
            throw Error('Descriptor mismatch for ' + String(key));
        } catch (error) { restorationErrors.push(String(error)); }
      }
      record.innerHooksRestored = restorationErrors.length === 0;
      if (restorationErrors.length) {
        record.restorationErrors = restorationErrors;
        failure = new Error([failure ? String(failure) : '', ...restorationErrors].filter(Boolean).join('; '));
      }
      running = false; record.finishedAt = new Date().toISOString();
      lastExecution = record; remember(record);
      if (failure) {
        mode = 'baseline'; record.completed = false;
        try { detachOuter(); record.outerHookRestoredAfterFailure = true; }
        catch (error) { record.outerRestoreError = String(error); }
        errors.push(String(failure));
      }
    }
    if (failure) throw failure;
    return result;
  }

  function setMode(next) {
    if (!['baseline', 'no-local', 'no-closure'].includes(next)) throw Error('Unknown R05 diagnostic mode: ' + next);
    if (running) throw Error('Cannot switch modes inside solver.apply');
    boundContext();
    if (next === 'baseline') {
      detachOuter(); mode = 'baseline';
    } else {
      if (!outerInstalled) {
        if (!outerIsOriginal()) throw Error('Native solver.apply owner changed before installation');
        replaceOwn(solver, 'apply', instrumentedApply); outerInstalled = true;
      } else if (solver.apply !== instrumentedApply) throw Error('Diagnostic solver wrapper was replaced');
      mode = next;
    }
    // Mode selection never changes pose/DNA or submits a frame. The caller
    // must perform the normal native pose/view update and then capture a frame.
    return report();
  }

  function restore() {
    if (running) throw Error('Cannot restore inside solver.apply');
    boundContext(); detachOuter(); mode = 'baseline';
    const requested = needsNativeRebuild;
    lastRestore = { requestedAt: new Date().toISOString(), nativeUpdateRequested: requested, completed: false };
    if (requested) {
      if (typeof viewer.update !== 'function') throw Error('Normal native viewer.update is unavailable');
      const before = declaredPose();
      viewer.update(); // Re-evaluate the current declared pose with original code.
      lastRestore.declaredPoseUnchanged = JSON.stringify(before) === JSON.stringify(declaredPose());
      if (!lastRestore.declaredPoseUnchanged) throw Error('Normal restoration changed the declared pose');
      needsNativeRebuild = false;
    }
    lastRestore.originalApplyDescriptorRestored = outerIsOriginal();
    lastRestore.completed = true;
    return report();
  }

  function report() {
    return clone({
      version: VERSION, diagnosticOnly: true, ready: true, mode, running,
      outerHookInstalled: outerInstalled, originalApplyDescriptorRestored: outerIsOriginal(),
      needsNativeRebuild, modeSelectionSubmitsRender: false,
      restoreUsesOriginalNativeViewerUpdate: true,
      nativeGeometryUUID: top.geometry.uuid || null, nativeTopologyCount: top.count,
      source: window.__LIP_INNER__?.source || null,
      lastExecution, lastRestore, executions: events, errors,
      productionRepair: false, visualAcceptance: false,
      limitations: [
        'Ablations change evaluated geometry while preserving declared pose controls; they are not finished lip improvements.',
        'no-closure removes only closure position updates; the original closure pressure/strain fields remain for downstream execution.',
        'setMode does not rebuild geometry. Call the normal native update before capturing any selected mode.',
        'restore rebuilds the current pose through the original native viewer.update; actual baseline pixel equality remains a caller verification.',
        'visibleSamples is CPU frontmost-triangle attribution for the actual v.mesh, not a GPU fragment-ID buffer.'
      ]
    });
  }

  // ---- Read-only attribution on the actual rendered mesh -----------------
  const sameView = (a, b) => a === b || !!a && !!b && a.constructor === b.constructor &&
    a.buffer === b.buffer && a.byteOffset === b.byteOffset && a.byteLength === b.byteLength;
  function attribute(geometry, name, size, count) {
    const a = geometry.attributes[name];
    if (!a || a.isInterleavedBufferAttribute || a.normalized || a.itemSize !== size ||
        a.count !== count || !a.array || a.array.length !== size * count)
      throw Error('Unsupported or mismatched draw attribute ' + name);
    return a;
  }
  function matrixValues(matrix, label) {
    const a = matrix?.elements;
    if (!a || a.length !== 16 || !Array.from(a).every(Number.isFinite)) throw Error('Invalid ' + label);
    return Array.from(a);
  }
  function multiply(a, b) {
    const out = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return out;
  }
  function determinant3(m) {
    return m[0] * (m[5] * m[10] - m[9] * m[6]) -
      m[4] * (m[1] * m[10] - m[9] * m[2]) + m[8] * (m[1] * m[6] - m[5] * m[2]);
  }
  function clipCode(x, y, z, w) {
    return (x < -w ? 1 : 0) | (x > w ? 2 : 0) | (y < -w ? 4 : 0) |
      (y > w ? 8 : 0) | (z < -w ? 16 : 0) | (z > w ? 32 : 0);
  }
  const planes = [[1, 0, 0, 1], [-1, 0, 0, 1], [0, 1, 0, 1], [0, -1, 0, 1], [0, 0, 1, 1], [0, 0, -1, 1]];
  function clipTriangle(vertices) {
    let polygon = vertices;
    for (const plane of planes) {
      const next = [];
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j], b = polygon[(j + 1) % polygon.length];
        const da = plane.reduce((sum, x, k) => sum + x * a.c[k], 0);
        const db = plane.reduce((sum, x, k) => sum + x * b.c[k], 0);
        if (da >= 0) next.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const t = da / (da - db);
          next.push({ c: a.c.map((x, k) => x + (b.c[k] - x) * t), b: a.b.map((x, k) => x + (b.b[k] - x) * t) });
        }
      }
      polygon = next; if (polygon.length < 3) return [];
    }
    return polygon;
  }
  function materialDescription(material, index) {
    return {
      index, uuid: material.uuid || null, name: material.name || '', type: material.type || null,
      native: material === viewer.skin?.material,
      procedural: material === window.headProceduralSkin?.material?.(),
      side: material.side ?? 0, visible: material.visible !== false,
      transparent: !!material.transparent, opacity: material.opacity ?? 1,
      alphaTest: material.alphaTest || 0, alphaHash: !!material.alphaHash,
      depthTest: material.depthTest !== false, depthWrite: material.depthWrite !== false,
      depthFunc: material.depthFunc ?? 3, polygonOffset: !!material.polygonOffset,
      wireframe: !!material.wireframe, transmission: material.transmission || 0,
      clippingPlanes: material.clippingPlanes?.length || 0,
      displacementMap: !!material.displacementMap
    };
  }
  function materialCaveats(m) {
    const a = [];
    if (m.transparent || m.opacity < 1 || m.transmission > 0) a.push('transparent/transmissive material: frontmost geometry is not sole pixel colour');
    if (m.alphaTest > 0 || m.alphaHash) a.push('alpha rejection is not evaluated');
    if (!m.depthTest || !m.depthWrite || m.depthFunc !== 3) a.push('non-default depth behavior is not reproduced');
    if (m.polygonOffset) a.push('polygon depth offset is not reproduced');
    if (m.wireframe) a.push('wireframe coverage is not reproduced');
    if (m.clippingPlanes) a.push('custom material clipping is not reproduced');
    if (m.displacementMap) a.push('GPU displacement is not evaluated');
    return a;
  }

  function visibleSamples(points, width, height) {
    const result = {
      schema: 'kaopu/r05-visible-native-triangle-attribution@1', version: VERSION,
      mode, available: false, points: [],
      scope: 'Frontmost depth-tested triangle of the current actual viewer.mesh drawGeometry only.',
      coordinateConvention: 'Input x,y are zero-based framebuffer pixel indices, top-left origin; sample position is x+.5,y+.5.',
      limitations: [
        'Other scene objects, shader discard/vertex displacement, custom clipping and transparency are not evaluated.',
        'A pixel centre hit does not describe all MSAA sub-samples; coverage within 1 pixel of any triangle edge is marked uncertain.',
        'CPU triangle interpolation is a geometric attribution, not proof that a particular shader caused the visible defect.',
        'Render the selected mode normally immediately before calling; this function does not render or update scene matrices.'
      ]
    };
    try {
      if (running) throw Error('Cannot inspect geometry inside the solver call');
      boundContext();
      if (!Array.isArray(points) || points.length > 256) throw Error('Use an array of at most 256 sample pixels');
      if (![width, height].every(x => Number.isInteger(x) && x > 0)) throw Error('Framebuffer width and height must be positive integers');
      const parsed = points.map((p, i) => {
        const x = Array.isArray(p) ? p[0] : p?.x, y = Array.isArray(p) ? p[1] : p?.y;
        if (![x, y].every(Number.isFinite)) throw Error('Invalid sample pixel ' + i);
        return { index: i, label: Array.isArray(p) ? null : p.label ?? null, x, y, px: x + .5, py: y + .5 };
      });
      const gl = viewer.renderer.getContext();
      if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height)
        throw Error('Requested dimensions differ from the actual drawing buffer');
      if (viewer.renderer.getRenderTarget?.()) throw Error('An offscreen render target is active');
      const viewport = Array.from(gl.getParameter(gl.VIEWPORT));
      if (viewport.length !== 4 || viewport[2] <= 0 || viewport[3] <= 0) throw Error('Actual viewport is unavailable');
      const scissorEnabled = !!gl.isEnabled(gl.SCISSOR_TEST);
      const scissor = scissorEnabled ? Array.from(gl.getParameter(gl.SCISSOR_BOX)) : [0, 0, width, height];
      const mesh = viewer.mesh, draw = mesh?.geometry, display = viewer.geometry;
      if (!mesh || !draw || !display || mesh.isSkinnedMesh || mesh.isInstancedMesh ||
          mesh.morphTargetInfluences?.some(x => x !== 0)) throw Error('Unsupported actual mesh or GPU deformation');
      for (let object = mesh; object; object = object.parent) if (object.visible === false)
        throw Error('The actual viewer mesh is not visible');
      if (mesh.layers && viewer.camera.layers && (mesh.layers.mask & viewer.camera.layers.mask) === 0)
        throw Error('The actual viewer mesh is outside the camera layers');
      const count = draw.attributes.position?.count;
      if (!Number.isInteger(count) || count <= 0 || display.attributes.position?.count !== count)
        throw Error('Actual draw and displayed vertex counts differ');
      const pos = attribute(draw, 'position', 3, count);
      const displayedPos = attribute(display, 'position', 3, count);
      if (!sameView(pos.array, displayedPos.array)) throw Error('Actual draw geometry does not share the current displayed position buffer');
      const attrs = Object.fromEntries([['fRest', 3], ['csType', 1], ['l19Oral', 1], ['l19State', 4]].map(([name, size]) => [name, attribute(draw, name, size, count)]));
      const topologyBinding = { available: true, drawCount: count, topologyCount: top.count,
        sameGeometry: draw === top.geometry, method: 'Exact same-ID fRest/csType/l19Oral verification across the original topology prefix', verifiedVertices: 0 };
      if (count < top.count || top.samples.length !== top.count) {
        topologyBinding.available = false; topologyBinding.reason = 'Actual geometry cannot contain the original topology domain';
      } else {
        for (const [name, size] of [['fRest', 3], ['csType', 1], ['l19Oral', 1]]) {
          const native = attribute(top.geometry, name, size, top.count), actual = attrs[name];
          for (let j = 0; j < top.count * size; j++) if (native.array[j] !== actual.array[j]) {
            topologyBinding.available = false; topologyBinding.reason = 'Same-ID native semantic differs';
            topologyBinding.firstMismatch = { attribute: name, scalarOffset: j, vertex: Math.floor(j / size) }; break;
          }
          if (!topologyBinding.available) break;
        }
        if (topologyBinding.available) topologyBinding.verifiedVertices = top.count;
      }
      const nativeIndex = draw.index;
      if (!nativeIndex || nativeIndex.isInterleavedBufferAttribute || nativeIndex.itemSize !== 1 ||
          !nativeIndex.array || nativeIndex.count !== nativeIndex.array.length) throw Error('Actual indexed triangle buffer is unavailable');
      const indices = nativeIndex.array;
      const world = matrixValues(mesh.matrixWorld, 'mesh matrixWorld');
      const view = matrixValues(viewer.camera.matrixWorldInverse, 'camera matrixWorldInverse');
      const projection = matrixValues(viewer.camera.projectionMatrix, 'camera projectionMatrix');
      const transform = multiply(projection, multiply(view, world)), determinant = determinant3(world);
      if (Math.abs(determinant) < 1e-20) throw Error('Singular mesh transform');
      const windingSign = determinant < 0 ? -1 : 1;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (!materials.length || materials.some(x => !x)) throw Error('Actual material slots are unavailable');
      const slots = materials.map(materialDescription);
      const groups = Array.isArray(mesh.material) ? draw.groups.map(g => ({ ...g })) : [{ start: 0, count: indices.length, materialIndex: 0 }];
      if (!groups.length) throw Error('Array material has no actual draw groups; capture after a normal native render');
      const drawStart = draw.drawRange?.start || 0, drawCount = draw.drawRange?.count ?? Infinity;
      if (!Number.isInteger(drawStart) || drawStart < 0 || !(drawCount === Infinity || Number.isInteger(drawCount) && drawCount >= 0))
        throw Error('Unsupported draw range');
      const clip = new Float64Array(count * 4), projected = new Float64Array(count * 3), codes = new Uint8Array(count);
      function screen(c) {
        const inv = 1 / c[3];
        return [viewport[0] + (c[0] * inv + 1) * .5 * viewport[2],
          height - viewport[1] - (c[1] * inv + 1) * .5 * viewport[3], c[2] * inv];
      }
      for (let id = 0; id < count; id++) {
        const x = pos.array[id * 3], y = pos.array[id * 3 + 1], z = pos.array[id * 3 + 2], c = [];
        for (let r = 0; r < 4; r++) c[r] = transform[r] * x + transform[4 + r] * y + transform[8 + r] * z + transform[12 + r];
        if (!c.every(Number.isFinite)) throw Error('Non-finite actual projected vertex ' + id);
        clip.set(c, id * 4); codes[id] = clipCode(...c);
        projected.set(Math.abs(c[3]) > 1e-20 ? screen(c) : [NaN, NaN, NaN], id * 3);
      }
      const candidates = parsed.map(p => {
        const bottomY = height - p.py;
        const inside = p.px >= 0 && p.py >= 0 && p.px < width && p.py < height &&
          p.px >= viewport[0] && p.px < viewport[0] + viewport[2] &&
          bottomY >= viewport[1] && bottomY < viewport[1] + viewport[3] &&
          p.px >= scissor[0] && p.px < scissor[0] + scissor[2] && bottomY >= scissor[1] && bottomY < scissor[1] + scissor[3];
        return { ...p, inside, best: null, hits: 0, nearestDepthTie: false, relevantMaterialCaveats: new Set() };
      });
      const active = candidates.filter(p => p.inside);
      const bx0 = Math.min(...active.map(p => p.px)), bx1 = Math.max(...active.map(p => p.px));
      const by0 = Math.min(...active.map(p => p.py)), by1 = Math.max(...active.map(p => p.py));
      const statistics = { actualDrawTriangles: 0, projectedCandidateTriangles: 0, clippedTriangles: 0, culledTriangles: 0, degenerateTriangles: 0 };
      function testFan(a, b, c, ids, indexOffset, slot, clipped) {
        if ([a, b, c].some(x => x.c[3] <= 1e-20)) return;
        const pa = screen(a.c), pb = screen(b.c), pc = screen(c.c);
        const minX = Math.min(pa[0], pb[0], pc[0]), maxX = Math.max(pa[0], pb[0], pc[0]);
        const minY = Math.min(pa[1], pb[1], pc[1]), maxY = Math.max(pa[1], pb[1], pc[1]);
        if (maxX < bx0 || minX > bx1 || maxY < by0 || minY > by1) return;
        const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
        if (Math.abs(area) < 1e-12) { statistics.degenerateTriangles++; return; }
        const frontFacing = -area * windingSign > 0;
        if ((slot.side === 0 && !frontFacing) || (slot.side === 1 && frontFacing)) { statistics.culledTriangles++; return; }
        const edgeLengths = [Math.hypot(pb[0] - pc[0], pb[1] - pc[1]), Math.hypot(pc[0] - pa[0], pc[1] - pa[1]), Math.hypot(pa[0] - pb[0], pa[1] - pb[1])];
        for (const p of active) {
          if (p.px < minX || p.px > maxX || p.py < minY || p.py > maxY) continue;
          const ba = ((pb[0] - p.px) * (pc[1] - p.py) - (pb[1] - p.py) * (pc[0] - p.px)) / area;
          const bb = ((pc[0] - p.px) * (pa[1] - p.py) - (pc[1] - p.py) * (pa[0] - p.px)) / area;
          const bc = 1 - ba - bb;
          if (Math.min(ba, bb, bc) < -1e-10) continue;
          const depth = ba * pa[2] + bb * pb[2] + bc * pc[2];
          if (depth < -1 - 1e-8 || depth > 1 + 1e-8) continue;
          p.hits++;
          const caveats = materialCaveats(slot);
          // Geometry behind the current best hit cannot change its attribution
          // under the default opaque depth model. Caveats on either close/front
          // surface are retained when choosing a better hit below.
          if (!p.best || depth <= p.best.ndcDepth + 1e-7) for (const item of caveats) p.relevantMaterialCaveats.add(item);
          if (p.best && Math.abs(depth - p.best.ndcDepth) <= 1e-7 && p.best.indexOffset !== indexOffset) p.nearestDepthTie = true;
          if (p.best && depth >= p.best.ndcDepth) continue;
          const inv = [ba / a.c[3], bb / b.c[3], bc / c.c[3]], denominator = inv[0] + inv[1] + inv[2];
          if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-20) continue;
          const weights = [0, 1, 2].map(k => (inv[0] * a.b[k] + inv[1] * b.b[k] + inv[2] * c.b[k]) / denominator);
          const edgeDistance = Math.min(...[ba, bb, bc].map((v, k) => Math.abs(v * area) / Math.max(edgeLengths[k], 1e-20)));
          p.best = { ids: [...ids], indexOffset, triangle: indexOffset / 3, materialIndex: slot.index,
            ndcDepth: depth, depth01: (depth + 1) * .5, barycentricPerspective: weights,
            clipped, frontFacing, minimumEdgeDistancePixels: edgeDistance, msaaEdgeUncertain: edgeDistance <= 1 };
        }
      }
      if (active.length) for (const group of groups) {
        if (![group.start, group.count, group.materialIndex].every(Number.isInteger) || group.start < 0 || group.count < 0 || !slots[group.materialIndex])
          throw Error('Invalid actual material group');
        const slot = slots[group.materialIndex]; if (!slot.visible) continue;
        const start = Math.max(group.start, drawStart), end = Math.min(group.start + group.count, drawStart + drawCount, indices.length);
        if (start % 3 || (end - start) % 3) throw Error('Non-triangle-aligned actual draw group/range');
        for (let offset = start; offset < end; offset += 3) {
          statistics.actualDrawTriangles++;
          const ids = [indices[offset], indices[offset + 1], indices[offset + 2]];
          if (ids.some(id => !Number.isInteger(id) || id < 0 || id >= count)) throw Error('Actual triangle index is outside its position buffer');
          if (codes[ids[0]] & codes[ids[1]] & codes[ids[2]]) continue;
          const allPositive = ids.every(id => clip[id * 4 + 3] > 1e-20);
          if (allPositive) {
            const xs = ids.map(id => projected[id * 3]), ys = ids.map(id => projected[id * 3 + 1]);
            if (Math.max(...xs) < bx0 || Math.min(...xs) > bx1 || Math.max(...ys) < by0 || Math.min(...ys) > by1) continue;
          }
          statistics.projectedCandidateTriangles++;
          const vertices = ids.map((id, j) => ({ c: Array.from(clip.subarray(id * 4, id * 4 + 4)), b: [0, 1, 2].map(k => k === j ? 1 : 0) }));
          const clipped = !!(codes[ids[0]] | codes[ids[1]] | codes[ids[2]]);
          const polygon = clipped ? clipTriangle(vertices) : vertices;
          if (clipped) statistics.clippedTriangles++;
          for (let j = 1; j + 1 < polygon.length; j++) testFan(polygon[0], polygon[j], polygon[j + 1], ids, offset, slot, clipped);
        }
      }
      function values(a, id) { return Array.from(a.array.subarray(id * a.itemSize, (id + 1) * a.itemSize)); }
      function sampleFor(id) {
        if (!topologyBinding.available) return { available: false, reason: topologyBinding.reason };
        if (id >= top.count) return { available: false, reason: 'Draw vertex was appended after original lip topology; no native sample guessed' };
        const s = top.samples[id];
        if (!s || !['u', 'v', 'weight', 'inner'].every(k => Number.isFinite(s[k])) || typeof s.upper !== 'boolean')
          return { available: false, reason: 'Original native sample is incomplete' };
        return { available: true, u: s.u, v: s.v, upper: s.upper, weight: s.weight, inner: s.inner,
          type: s.type, depth: s.depth, front: s.front, red: s.red, rim: !!s.rim };
      }
      for (const p of candidates) {
        const entry = { input: { index: p.index, label: p.label, x: p.x, y: p.y }, sampleCentre: [p.px, p.py], available: !!p.best };
        if (!p.inside) entry.reason = 'Outside actual framebuffer/viewport/scissor';
        else if (!p.best) entry.reason = 'No actual viewer.mesh triangle covers this pixel centre';
        else {
          const hit = p.best, slot = slots[hit.materialIndex], weights = hit.barycentricPerspective;
          entry.hit = { ...hit, material: slot, coveredGeometryHits: p.hits, depthTieUncertain: p.nearestDepthTie,
            materialCaveats: [...p.relevantMaterialCaveats],
            vertices: hit.ids.map(id => ({ id, localPosition: values(pos, id), clip: Array.from(clip.subarray(id * 4, id * 4 + 4)),
              projection: Array.from(projected.subarray(id * 3, id * 3 + 3)).map(x => Number.isFinite(x) ? x : null),
              csType: attrs.csType.array[id], l19Oral: attrs.l19Oral.array[id], l19State: values(attrs.l19State, id),
              nativeSample: sampleFor(id) })),
            interpolated: Object.fromEntries(['csType', 'l19Oral', 'l19State'].map(name => {
              const a = attrs[name], value = Array.from({ length: a.itemSize }, (_, k) => hit.ids.reduce((sum, id, j) => sum + weights[j] * a.array[id * a.itemSize + k], 0));
              return [name, a.itemSize === 1 ? value[0] : value];
            }))
          };
          entry.hit.fragmentOwnershipCertain = false;
          entry.hit.cpuGeometryAttributionReliable = !hit.msaaEdgeUncertain && !p.nearestDepthTie && p.relevantMaterialCaveats.size === 0;
        }
        result.points.push(entry);
      }
      result.available = true;
      result.framebuffer = { width, height, viewport, scissorEnabled, scissor };
      result.draw = { meshUUID: mesh.uuid || null, geometryUUID: draw.uuid || null, displayGeometryUUID: display.uuid || null,
        sharesDisplayedPositions: true, vertices: count, indexCount: indices.length, groups, drawRange: { start: drawStart, count: Number.isFinite(drawCount) ? drawCount : 'Infinity' }, materialSlots: slots };
      result.topologyBinding = topologyBinding; result.statistics = statistics;
      result.camera = { projection, view, meshWorld: world };
      return result;
    } catch (error) {
      result.reason = String(error); result.available = false; return result;
    }
  }

  boundContext();
  window.__R05_MOTION_DIAG__ = Object.freeze({ version: VERSION, setMode, report, restore, visibleSamples });
})();
