/* R06 diagnostic counterfactuals on the frozen R05 evaluator.
 * These are not production repairs. The declared pose is never changed.
 * Each mode removes one native pucker contribution only in the corner field.
 */
(function () {
  'use strict';
  if (window.__R06_CORNER_DIAG__) throw Error('R06 corner diagnostic already installed');
  const VERSION = 'LIP-CORNER-R06-ATTRIBUTION-01';
  const MODES = ['baseline', 'no-x', 'no-front', 'no-compensation'];
  const v = window.__IDENTITY_QA__?.viewer?.(), model = window.__IDENTITY_QA__?.model?.();
  const r05 = window.__LIP_MOTION_SOLVER__, structure = model?.lipStructure, lip = v?.currentLip;
  const solver = structure?.mother?.surfaces?.get(lip?.geometry), top = solver?.topology;
  if (!v || !model || !solver || !top || window.motionLip?.version !== 'LIP-MOTION-R05')
    throw Error('Fixed R05 workbench is required');
  const own = (o, k) => Object.getOwnPropertyDescriptor(o, k);
  const equalDescriptor = (a, b) => a === undefined ? b === undefined : b !== undefined &&
    ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const gauss = (x, w) => Math.exp(-((x / w) ** 2));
  const at = (a, id) => [a[id * 3], a[id * 3 + 1], a[id * 3 + 2]];
  const sub = (a, b) => a.map((x, k) => x - b[k]);
  const dot = (a, b) => a.reduce((sum, x, k) => sum + x * b[k], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function unit(a) { const n = Math.hypot(...a); if (!(n > 1e-10)) throw Error('Degenerate native mouth frame'); return a.map(x => x / n); }
  function sameBytes(a, b) {
    if (!a?.buffer || !b?.buffer || a.byteLength !== b.byteLength) return false;
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return false;
    return true;
  }
  function fingerprint(a) {
    const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let h = 2166136261;
    for (const x of bytes) h = Math.imul(h ^ x, 16777619);
    return (h >>> 0).toString(16).padStart(8, '0') + ':' + bytes.length;
  }
  function put(o, k, value) {
    const d = own(o, k); if (d?.configurable === false) throw Error('Native descriptor is not configurable');
    Object.defineProperty(o, k, { configurable: true, writable: true, enumerable: d?.enumerable || false, value });
  }
  function undo(o, k, d) {
    if (d) Object.defineProperty(o, k, d);
    else if (!Reflect.deleteProperty(o, k)) throw Error('Native descriptor could not be restored');
  }
  function frame() {
    const lm = id => model.faceSurface.fields.landmark(model.positions, id), left = lm(48), right = lm(54);
    const x = unit(sub(right, left)), vertical = sub(lm(27), lm(8));
    const up = unit(vertical.map((q, k) => q - x[k] * dot(vertical, x)));
    const centre = lm(62).map((q, k) => (q + lm(66)[k]) * .5);
    let front = unit(cross(x, up)); if (dot(front, sub(lm(30), centre)) < 0) front = front.map(q => -q);
    const convert = a => [a[0], a[2], -a[1]], scale = structure.anatomy.scale(Math.hypot(...sub(right, left)));
    if (!(scale > 0) || !Number.isFinite(scale)) throw Error('Invalid native anatomical scale');
    return { x: convert(x), up: convert(up), front: convert(front), center: convert(centre), scale };
  }
  const state = { mode: 'baseline', installed: false, wrapperAttached: false, restored: false, running: false, calls: 0, errors: [], lastExecution: null };
  function checkPose() {
    const p = window.lipWorkbench?.pose?.();
    const expected = { pucker: .82, seal: .24, jawOpen: .06 };
    if (!p || Object.entries(p).some(([k, x]) => k !== 'schema' && (!Number.isFinite(x) || Math.abs(x - (expected[k] || 0)) > 1e-10)) ||
        Object.entries(expected).some(([k, x]) => !Number.isFinite(p[k]) || Math.abs(p[k] - x) > 1e-10))
      throw Error('Corner diagnosis requires completed native pucker=.82, seal=.24, jawOpen=.06; all other local actions zero');
  }
  function bound() {
    if (v.currentLip !== lip || model.lipStructure !== structure || solver.topology !== top ||
        top.geometry !== lip.geometry || structure.mother.surfaces.get(lip.geometry) !== solver)
      throw Error('Native person/topology changed during corner diagnosis');
    const p = top.geometry.attributes.position;
    if (p.itemSize !== 3 || p.count !== top.count || p.array.length !== top.count * 3 || p.isInterleavedBufferAttribute)
      throw Error('Native display position domain changed');
    if (p.array === model.positions || p.array.buffer === model.positions?.buffer)
      throw Error('Refusing to write canonical positions');
    const s = r05?.report?.();
    if (!s?.enabled || !s.valid || s.version !== 'native-return-motion-ownership@1')
      throw Error('The frozen R05 ownership correction must remain enabled and valid');
    if (initialOwnership && s.calibration?.ownershipFingerprint !== initialOwnership)
      throw Error('R05 ownership reference changed during diagnosis');
    checkPose(); return p.array;
  }
  let initialOwnership = null;
  const initialArray = bound();
  if (!solver.base || solver.base.length !== initialArray.length) throw Error('Completed R05 before-local reference is missing');
  const baselineBeforeLocal = solver.base.slice(), baselineEvaluated = initialArray.slice(), referenceFrame = frame();
  initialOwnership = r05.report().calibration.ownershipFingerprint;
  const active = new Uint8Array(top.count); for (const id of top.active) active[id] = 1;
  const center = [], corners = [];
  for (let id = 0; id < top.count; id++) {
    const s = top.samples[id];
    if (Math.abs(s.u) <= .64) center.push(id);
    if (active[id] && s.skin && s.type < .5 && Math.abs(s.u) > .64) corners.push(id);
  }
  const priorApply = solver.apply, priorApplyDescriptor = own(solver, 'apply');
  function terms(id, base, f, useActive = true) {
    const s = top.samples[id], p = sub(at(base, id), f.center), a = structure.performance.settings;
    const mix = smooth(-.16, .16, s.u), stretch = a.stretchLeft * (1 - mix) + a.stretchRight * mix;
    const q = 1 - .23 * a.pucker - .12 * a.funnel + .18 * stretch, without = q + .23 * a.pucker;
    const compensation = z => Math.min(1.18, 1 / Math.sqrt(Math.max(.65, z)));
    const weight = useActive ? (active[id] ? s.weight : 0) : s.weight;
    return { x: -.23 * a.pucker * dot(p, f.x) * weight,
      front: .0036 * a.pucker * gauss(s.u, .85) * f.scale * weight,
      compensation: dot(p, f.up) * (compensation(q) - compensation(without)) * weight };
  }
  function wrapper(...args) {
    if (!state.installed || this !== solver || state.running) throw Error('Unexpected corner diagnostic solver call');
    const array = bound(), entry = array.slice(), f = frame(), pairs = top.pairs, oldMap = pairs.map;
    const mapDescriptor = own(pairs, 'map'), lipDescriptor = own(top.lips, Symbol.iterator), lipIterator = top.lips[Symbol.iterator];
    const rec = { call: ++state.calls, mode: state.mode, completed: false, innerHooksRestored: false,
      beforeLocalExact: false, entryNativeBeforeLocalExact: false, centerDirectDeltaZero: false,
      pairMapCalls: 0, directChangedVertices: 0, maxDirectCorrectionMM: 0, centerVerticesCompared: center.length };
    let answer, failure = null; state.running = true;
    try {
      put(pairs, 'map', function (...mapArgs) {
        if (this !== pairs || ++rec.pairMapCalls !== 1) throw Error('Native local boundary changed');
        rec.beforeLocalExact = sameBytes(solver.base, baselineBeforeLocal);
        rec.entryNativeBeforeLocalExact = sameBytes(entry, solver.base);
        if (!rec.beforeLocalExact || !rec.entryNativeBeforeLocalExact) throw Error('Before-local geometry differs from fixed R05 baseline');
        const centreBefore = new Float32Array(center.length * 3);
        for (let i = 0; i < center.length; i++) centreBefore.set(at(array, center[i]), i * 3);
        if (state.mode !== 'baseline') {
          const key = state.mode === 'no-x' ? 'x' : state.mode === 'no-front' ? 'front' : 'compensation';
          const axis = key === 'x' ? f.x : key === 'front' ? f.front : f.up;
          for (const id of corners) {
            const s = top.samples[id], gain = smooth(.64, .84, Math.abs(s.u));
            const amount = -gain * terms(id, solver.base, f)[key];
            if (!Number.isFinite(amount)) throw Error('Non-finite corner intervention');
            if (Math.abs(amount) < 1e-14) continue;
            const before = at(array, id);
            for (let k = 0; k < 3; k++) array[id * 3 + k] += axis[k] * amount;
            const distance = Math.hypot(...sub(at(array, id), before));
            if (distance > 0) { rec.directChangedVertices++; rec.maxDirectCorrectionMM = Math.max(rec.maxDirectCorrectionMM, distance * 1000); }
          }
        }
        rec.centerDirectDeltaZero = center.every((id, i) => [0, 1, 2].every(k => Object.is(array[id * 3 + k], centreBefore[i * 3 + k])));
        if (!rec.centerDirectDeltaZero) throw Error('Central mouth received a direct diagnostic correction');
        return Reflect.apply(oldMap, this, mapArgs);
      });
      // R05 temporarily wraps this map. It performs its local ownership
      // correction first, then calls this diagnostic before native closure.
      answer = Reflect.apply(priorApply, this, args);
      if (rec.pairMapCalls !== 1 || (answer && typeof answer.then === 'function')) throw Error('Native phase count or synchrony changed');
      rec.completed = true;
    } catch (error) { failure = error; rec.error = String(error); state.errors.push(String(error)); }
    finally {
      try {
        undo(pairs, 'map', mapDescriptor);
        if (pairs.map !== oldMap || !equalDescriptor(own(pairs, 'map'), mapDescriptor) ||
            top.lips[Symbol.iterator] !== lipIterator || !equalDescriptor(own(top.lips, Symbol.iterator), lipDescriptor))
          throw Error('Native inner descriptors were not restored');
        rec.innerHooksRestored = true;
      } catch (error) { state.errors.push(String(error)); failure = failure || error; }
      state.running = false; state.lastExecution = rec;
    }
    if (failure) throw failure;
    return answer;
  }
  function setMode(mode) {
    if (!MODES.includes(mode)) throw Error('Unknown corner diagnostic mode: ' + mode);
    if (!state.installed || state.running) throw Error('Corner diagnostic is not switchable');
    bound();
    if (mode === 'baseline') detach();
    else if (!state.wrapperAttached) {
      if (solver.apply !== priorApply || !equalDescriptor(own(solver, 'apply'), priorApplyDescriptor))
        throw Error('Another owner changed the R05 solver before diagnostic attachment');
      put(solver, 'apply', wrapper); state.wrapperAttached = true;
    }
    state.mode = mode; return report();
  }
  function report() {
    return structuredClone({ version: VERSION, mode: state.mode, modes: MODES, installed: state.installed,
      wrapperAttached: state.wrapperAttached, restored: state.restored, errors: state.errors, lastExecution: state.lastExecution,
      originalApplyDescriptorRestored: solver.apply === priorApply && equalDescriptor(own(solver, 'apply'), priorApplyDescriptor),
      nativeUpdateRequired: state.restored, scope: 'Diagnostic counterfactual; one native pucker term removed locally, not a production repair',
      cornerGain: 'smooth(.64,.84,abs(nativeSample.u)); original active skin only',
      centerDirectlyProtected: 'All abs(nativeSample.u)<=.64, regardless of material type',
      baselineBeforeLocalFingerprint: fingerprint(baselineBeforeLocal), baselineOwnershipFingerprint: initialOwnership,
      nativeVertices: top.count, cornerCandidateVertices: corners.length, centerVertices: center.length,
      declaredPoseChanged: false, canonicalPositionsChanged: false, materialChanged: false,
      r05KeptEnabled: true, calls: state.calls,
      limitations: ['Central direct correction is zero, but original closure and later normals/strain may respond indirectly.',
        'Stage removals may reduce corner action; their images are causal diagnostics and cannot be presented as finished repair.',
        'Projected boundary edges are geometric candidates, not frontmost pixel or physiological evidence.'] });
  }
  function detach() {
    if (state.wrapperAttached) {
      if (solver.apply !== wrapper) throw Error('Another owner replaced the diagnostic apply wrapper');
      undo(solver, 'apply', priorApplyDescriptor); state.wrapperAttached = false;
    }
    if (solver.apply !== priorApply || !equalDescriptor(own(solver, 'apply'), priorApplyDescriptor))
      throw Error('R05 apply descriptor restoration failed');
  }
  function restore() {
    if (state.running) throw Error('Cannot restore inside native evaluation');
    if (!state.restored) {
      detach();
      state.installed = false; state.restored = true; state.mode = 'baseline';
    }
    return report();
  }
  function projectionBinding() {
    const actual = v.mesh?.geometry, native = top.geometry, count = top.count;
    const info = { available: false, nativeVertices: count, drawVertices: actual?.attributes?.position?.count ?? null,
      sameGeometry: actual === native, width: v.renderer.domElement.width, height: v.renderer.domElement.height };
    if (!actual?.attributes?.position || actual.attributes.position.count < count) return { info: { ...info, reason: 'Actual draw geometry cannot contain the native prefix' } };
    for (const name of ['position', 'fRest', 'csType']) {
      const a = actual.attributes[name], b = native.attributes[name];
      if (!a || !b || a.itemSize !== b.itemSize || a.isInterleavedBufferAttribute || b.isInterleavedBufferAttribute ||
          !sameBytes(a.array.subarray(0, b.array.length), b.array))
        return { info: { ...info, reason: 'Actual draw/native prefix mismatch: ' + name } };
    }
    const mul = (m, p) => [0, 1, 2, 3].map(r => m[r] * p[0] + m[r + 4] * p[1] + m[r + 8] * p[2] + m[r + 12] * p[3]);
    const world = Array.from(v.mesh.matrixWorld.elements), view = Array.from(v.camera.matrixWorldInverse.elements), projection = Array.from(v.camera.projectionMatrix.elements);
    const project = p => {
      const clip = mul(projection, mul(view, mul(world, [...p, 1]))), w = clip[3];
      if (!(w > 0) || !clip.every(Number.isFinite)) return null;
      const ndc = clip.slice(0, 3).map(x => x / w);
      return { pixel: [(ndc[0] * .5 + .5) * info.width, (1 - (ndc[1] * .5 + .5)) * info.height], ndcDepth: ndc[2],
        insideViewport: Math.abs(ndc[0]) <= 1 && Math.abs(ndc[1]) <= 1 && Math.abs(ndc[2]) <= 1 };
    };
    return { info: { ...info, available: true, binding: 'Actual draw prefix positions/rest/type equal native arrays; no visibility test' }, project };
  }
  function boundaryEdges() {
    if (state.running) throw Error('Cannot scan inside native evaluation');
    bound();
    const index = top.geometry.index?.array, rest = top.geometry.attributes.fRest?.array;
    if (!index || index.length % 3 || !rest) throw Error('Native indexed triangles/rest domain unavailable');
    const binding = projectionBinding(), seen = new Set(), result = []; let crossActiveEdges = 0, skinCrossActiveEdges = 0;
    const rois = { left: [150, 240, 255, 380], right: [455, 240, 600, 380] };
    function endpoint(id) {
      const s = top.samples[id], before = at(baselineBeforeLocal, id), final = at(baselineEvaluated, id);
      return { id, active: !!active[id], skin: s.skin, roi: s.roi, type: s.type,
        u: s.u, v: s.v, upper: s.upper, front: s.front, inner: s.inner, weight: s.weight, red: s.red, depth: s.depth,
        nativeRestPosition: at(rest, id), beforeLocalDisplayPosition: before, baselineEvaluatedDisplayPosition: final,
        beforeLocalProjection: binding.project?.(before) || null, baselineEvaluatedProjection: binding.project?.(final) || null,
        nativePuckerTermsMM: Object.fromEntries(Object.entries(terms(id, baselineBeforeLocal, referenceFrame)).map(([k, x]) => [k, x * 1000])),
        analyticOuterWeightBeforeROIGate: (1 - smooth(.98, 1.33, Math.abs(s.u))) * gauss(Math.max(0, s.v - .8), 1.1) * s.front };
    }
    for (let offset = 0; offset < index.length; offset += 3) {
      const ids = [index[offset], index[offset + 1], index[offset + 2]];
      for (let j = 0; j < 3; j++) {
        let a = ids[j], b = ids[(j + 1) % 3]; if (active[a] === active[b]) continue;
        if (a > b) [a, b] = [b, a]; const key = a + ':' + b; if (seen.has(key)) continue; seen.add(key); crossActiveEdges++;
        const sa = top.samples[a], sb = top.samples[b]; if (!(sa.type < .5 && sb.type < .5)) continue; skinCrossActiveEdges++;
        if (Math.max(Math.abs(sa.u), Math.abs(sb.u)) < .64 || Math.min(Math.abs(sa.u), Math.abs(sb.u)) > 1.6) continue;
        const ea = endpoint(a), eb = endpoint(b), ta = ea.nativePuckerTermsMM, tb = eb.nativePuckerTermsMM;
        const jump = Object.fromEntries(['x', 'front', 'compensation'].map(k => [k, Math.abs(ta[k] - tb[k])]));
        const inROIs = Object.entries(rois).filter(([, rect]) => [ea, eb].some(e => {
          const p = e.baselineEvaluatedProjection?.pixel; return p && p[0] >= rect[0] && p[0] <= rect[2] && p[1] >= rect[1] && p[1] <= rect[3];
        })).map(([name]) => name);
        result.push({ ids: [a, b], firstNativeTriangle: offset / 3, endpoints: [ea, eb],
          beforeLocalEdgeLengthMM: Math.hypot(...sub(ea.beforeLocalDisplayPosition, eb.beforeLocalDisplayPosition)) * 1000,
          baselineEvaluatedEdgeLengthMM: Math.hypot(...sub(ea.baselineEvaluatedDisplayPosition, eb.baselineEvaluatedDisplayPosition)) * 1000,
          nativePuckerTermJumpMM: jump, combinedTermJumpMM: Math.hypot(jump.x, jump.front, jump.compensation), projectedEndpointInROIs: inROIs });
      }
    }
    result.sort((a, b) => b.combinedTermJumpMM - a.combinedTermJumpMM);
    const selected = result.slice(0, 256), selectedKeys = new Set(selected.map(e => e.ids.join(':')));
    for (const e of result.filter(e => e.projectedEndpointInROIs.length).slice(0, 128)) if (!selectedKeys.has(e.ids.join(':'))) selected.push(e);
    return { schema: 'kaopu/r06-native-active-boundary@1', version: VERSION, available: true,
      source: 'top.geometry.index (all original native triangles)', indexCount: index.length, scannedTriangles: index.length / 3,
      crossActiveEdges, skinCrossActiveEdges, candidateEdges: result.length, returnedEdges: selected.length,
      selection: 'Top 256 combined pucker term jumps, plus up to 128 largest edges with endpoints projecting inside the requested corner ROIs',
      candidateRule: 'Across active membership; both native types<.5; max abs(u)>=.64 and min abs(u)<=1.6',
      usedTopologyNeighbors: false, projection: binding.info, cornerROIsXYXYInclusive: rois,
      projectionScope: 'Frozen baseline evaluated and before-local endpoints projected in the current camera; no depth/occlusion or fragment-ownership claim',
      baselineBeforeLocalFingerprint: fingerprint(baselineBeforeLocal), baselineEvaluatedFingerprint: fingerprint(baselineEvaluated),
      analyticSourceBoundaryWeight: 1 - smooth(.98, 1.33, 1.25), edges: selected,
      limitations: ['A large term jump is a candidate cause, not visible proof of a crease.',
        'Native rest coordinates are sampled fRest values, not a fabricated canonical vertex correspondence.',
        'The source hard ROI can be bypassed by nonzero inner ownership; every endpoint records that distinction.'] };
  }
  // Baseline installation is observational. Attach the outer wrapper only
  // when an intervention is selected; returning to baseline detaches it.
  state.installed = true;
  window.__R06_CORNER_DIAG__ = Object.freeze({ version: VERSION, setMode, report, restore, boundaryEdges });
})();
