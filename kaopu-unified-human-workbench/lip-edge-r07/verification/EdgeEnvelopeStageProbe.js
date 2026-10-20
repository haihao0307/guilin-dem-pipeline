/* Read-only Ql dental projection-loop observer. Diagnostic only.
 * Install once. arm() BEFORE existing compare/pose/update calls; disarm() in
 * the caller's finally AFTER those synchronous calls return. No update/render.
 * R05 applies closure before delegating to our iterator factory. Natural
 * done:true is after the whole dental loop, before its first normal rebuild.
 * The top.lips property remains ours until R05/R06 unwind; disarm restores it.
 */
(function () {
  'use strict';
  const VERSION = 'native-envelope-stage-observer@1', GLOBAL = '__R07_ENVELOPE_STAGE__';
  const LIMIT = 32, MAX_ITERATIONS_PER_ARM = 128;
  let c = null;
  const own = (o, k) => Object.getOwnPropertyDescriptor(o, k);
  const sameDescriptor = (a, b) => a === undefined ? b === undefined : b !== undefined &&
    ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]);
  const point = (a, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
  const sub = (a, b) => a.map((x, k) => x - b[k]);
  const dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function unit(a) { const n = Math.hypot(...a); if (!(n > 1e-10)) throw Error('Degenerate native frame'); return a.map(x => x / n); }
  function error(message) { if (c.errors.length < 16) c.errors.push(String(message)); }
  function frame() {
    const lm = i => c.model.faceSurface.fields.landmark(c.model.positions, i), left = lm(48), right = lm(54);
    const x = unit(sub(right, left)), vertical = sub(lm(27), lm(8));
    const up = unit(vertical.map((x0, k) => x0 - x[k] * dot(vertical, x)));
    const center = lm(62).map((x0, k) => (x0 + lm(66)[k]) * .5);
    let front = unit(cross(x, up)); if (dot(front, sub(lm(30), center)) < 0) front = front.map(x0 => -x0);
    const convert = a => [a[0], a[2], -a[1]];
    return { source: 'Original ao(model) landmark frame, canonical [x,y,z] converted to native geometry [x,z,-y]',
      x: convert(x), up: convert(up), front: convert(front), center: convert(center),
      units: 'Native position units; source convention metres, differences multiplied by 1000 for mm' };
  }
  function buffer() {
    const p = c.top.geometry.attributes.position;
    if (c.viewer.currentLip !== c.lip || c.solver.topology !== c.top || c.top.geometry !== c.lip.geometry ||
        c.structure.mother.surfaces.get(c.lip.geometry) !== c.solver || p.itemSize !== 3 ||
        p.count !== c.top.count || p.isInterleavedBufferAttribute || p.array.length !== c.top.count * 3 ||
        c.top.lips !== c.lips || c.top.samples !== c.samples || c.top.geometry.index.array !== c.index ||
        c.top.geometry.attributes.csType.array !== c.types) throw Error('Native observation domain changed');
    return p.array;
  }
  function solvers() {
    const r = window.__LIP_CORNER_SOLVER__.report(), m = window.__LIP_MOTION_SOLVER__.report();
    const small = s => ({ version: s.version, installed: s.installed, enabled: s.enabled, valid: s.valid,
      calls: s.calls, errors: [...s.errors], lastCompleted: s.last?.completed ?? null, lastHooksRestored: s.last?.hooksRestored ?? null });
    return { r05: small(m), r06: small(r) };
  }
  function identities() {
    return { solverApplyExact: c.solver.apply === c.apply && sameDescriptor(own(c.solver, 'apply'), c.applyDescriptor),
      motherUpdateExact: c.structure.mother.update === c.motherUpdate,
      nativeUpdateExact: c.viewer.update === c.update, nativeRenderExact: c.viewer.render === c.render,
      r05APIExact: window.__LIP_MOTION_SOLVER__ === c.r05, r06APIExact: window.__LIP_CORNER_SOLVER__ === c.r06 };
  }
  function validSolvers(s) { return s.r05.version === 'native-return-motion-ownership@1' && s.r06.version === 'native-corner-pucker-vector@3' &&
    [s.r05, s.r06].every(x => x.installed && x.enabled && x.valid && x.errors.length === 0); }
  function buildEdges() {
    const edges = new Set(), relevant = [], index = c.index, n = c.top.count;
    for (let t = 0; t < index.length; t += 3) for (const [a0, b0] of [[index[t], index[t + 1]], [index[t + 1], index[t + 2]], [index[t + 2], index[t]]]) {
      if (!Number.isInteger(a0) || !Number.isInteger(b0) || a0 < 0 || b0 < 0 || a0 >= n || b0 >= n) throw Error('Invalid native triangle index');
      const a = Math.min(a0, b0), b = Math.max(a0, b0), va = c.samples[a]?.v, vb = c.samples[b]?.v;
      if (!Number.isFinite(va) || !Number.isFinite(vb) || (va < .05) === (vb < .05)) continue;
      const key = a * n + b; if (edges.has(key)) continue; edges.add(key);
      if (c.lipSet.has(a) || c.lipSet.has(b)) relevant.push([a, b]);
    }
    c.edges = relevant; c.edgeInventory = { source: 'Every edge of original topology.geometry.index, deduplicated by actual endpoint IDs; not top.neighbors',
      triangles: index.length / 3, allV005CrossingEdges: edges.size, crossingEdgesTouchingNativeLips: relevant.length,
      reportingScope: 'Cross-v=.05 edges with at least one endpoint in original top.lips; both endpoint types/semantics retained. Ranked by measured forward-delta difference.' };
  }
  function sampleVertex(raw, id) {
    const s = c.samples[id], before = point(raw.before, id), after = point(raw.after, id), d = sub(after, before);
    return { id, csType: c.types[id], u: s.u, v: s.v, inner: s.inner, red: s.red, upper: !!s.upper,
      inNativeLips: c.lipSet.has(id), dentalLoopEligible: c.lipSet.has(id) && s.v >= .05 && s.v <= 1.05,
      before, after, displacementMM: d.map(x => x * 1000), forwardDeltaMM: dot(d, raw.frame.front) * 1000 };
  }
  function summarize(raw) {
    const a = raw.before, b = raw.after, f = raw.frame.front, dx = raw.frame.x, up = raw.frame.up;
    const deltas = new Float64Array(c.top.count), changed = [];
    let maxLength = 0, minForward = Infinity, maxForward = -Infinity, sumForward = 0, maxSide = 0, changedOutsideEligible = 0;
    for (let id = 0; id < c.top.count; id++) {
      const d = [b[id * 3] - a[id * 3], b[id * 3 + 1] - a[id * 3 + 1], b[id * 3 + 2] - a[id * 3 + 2]];
      if (!d.every(Number.isFinite)) throw Error('Nonfinite observed stage position');
      const length = Math.hypot(...d), fd = dot(d, f) * 1000; deltas[id] = fd;
      if (length === 0) continue;
      changed.push({ id, magnitudeMM: length * 1000 }); maxLength = Math.max(maxLength, length * 1000);
      minForward = Math.min(minForward, fd); maxForward = Math.max(maxForward, fd); sumForward += fd;
      maxSide = Math.max(maxSide, Math.hypot(dot(d, dx), dot(d, up)) * 1000);
      const s = c.samples[id]; if (!(c.lipSet.has(id) && s.v >= .05 && s.v <= 1.05)) changedOutsideEligible++;
    }
    changed.sort((a0, b0) => b0.magnitudeMM - a0.magnitudeMM || a0.id - b0.id);
    const ranked = c.edges.map(([a0, b0]) => ({ a: a0, b: b0, jumpMM: Math.abs(deltas[a0] - deltas[b0]) }));
    ranked.sort((a0, b0) => b0.jumpMM - a0.jumpMM || a0.a - b0.a || a0.b - b0.b);
    function edgeDetail(e) {
      const midpoint = point(a, e.a).map((x0, k) => (x0 + a[e.b * 3 + k]) * .5);
      return { a: sampleVertex(raw, e.a), b: sampleVertex(raw, e.b), absoluteForwardDeltaDifferenceMM: e.jumpMM,
        beforeEdgeLengthMM: Math.hypot(...sub(point(a, e.a), point(a, e.b))) * 1000,
        afterEdgeLengthMM: Math.hypot(...sub(point(b, e.a), point(b, e.b))) * 1000,
        midpointBeforeNative: midpoint, midpointNativeU: (c.samples[e.a].u + c.samples[e.b].u) * .5,
        midpointCurrentFrameUp: dot(sub(midpoint, raw.frame.center), raw.frame.up) };
    }
    function region(lower) {
      const selected = ranked.filter(e => {
        if (Math.abs((c.samples[e.a].u + c.samples[e.b].u) * .5) >= .7) return false;
        const midpoint = point(a, e.a).map((x0, k) => (x0 + a[e.b * 3 + k]) * .5);
        const y = dot(sub(midpoint, raw.frame.center), raw.frame.up);
        return lower ? y < 0 : y >= 0;
      });
      return { classification: 'Pre-projection edge midpoint in the current native mouth frame; abs(mean native u)<.7 and ' +
          (lower ? 'signed up<0' : 'signed up>=0') + '. This is a pose-space half-space, not physiological ownership.',
        edgeCount: selected.length, nonzeroForwardDeltaDifferenceEdges: selected.filter(e => e.jumpMM > 0).length,
        maximumForwardDeltaDifferenceMM: selected[0]?.jumpMM || 0, maximumReportedEdges: 16,
        edges: selected.slice(0, 16).map(edgeDetail), omittedEdges: Math.max(0, selected.length - 16) };
    }
    return { call: raw.call, arm: raw.arm, complete: true, pose: raw.pose, coordinateFrame: raw.frame,
      beforeStage: 'R05 closure correction completed; Kd constructed; dental projection loop has not processed its first vertex',
      afterStage: 'Natural iterator exhaustion after dental projection loop; before its first computeVertexNormals and subsequent microgeometry',
      normalStatus: 'Normal buffer is intentionally not sampled as a new normal solution at these boundaries',
      counts: { nativeVertices: c.top.count, nativeLipVertices: c.lips.length, iteratedIDs: raw.yields, nextCalls: raw.nextCalls,
        orderExact: raw.orderExact, changedVertices: changed.length, changedOutsideDentalLoopEligibility: changedOutsideEligible },
      displacement: { maximumLengthMM: maxLength, minimumChangedForwardMM: changed.length ? minForward : 0,
        maximumChangedForwardMM: changed.length ? maxForward : 0, meanChangedForwardMM: changed.length ? sumForward / changed.length : 0,
        maximumOrthogonalMagnitudeMM: maxSide, maximumV005AdjacentForwardDeltaDifferenceMM: ranked[0]?.jumpMM || 0 },
      changedVertexExamples: changed.slice(0, LIMIT).map(x => sampleVertex(raw, x.id)),
      v005CrossingEdges: ranked.slice(0, LIMIT).map(edgeDetail),
      v005CentralRegions: { lowerCurrentFrame: region(true), upperCurrentFrame: region(false) },
      bounds: { maximumVertexExamples: LIMIT, maximumEdgeExamples: LIMIT, allRelevantCrossingEdgesMeasured: ranked.length,
        changedVerticesOmitted: Math.max(0, changed.length - LIMIT), crossingEdgesOmitted: Math.max(0, ranked.length - LIMIT) },
      interpretation: 'Measured position response of this native loop only. A neighboring displacement difference is not tissue thickness, contact correctness, self-intersection or a visual-quality score.' };
  }
  function observeFactory(...args) {
    const raw = { call: ++c.totalIterations, arm: c.armNumber, yields: 0, nextCalls: 0, orderExact: true, complete: false, failed: false };
    c.active = raw; c.armIterations++;
    try {
      if (this !== c.lips || c.armIterations > MAX_ITERATIONS_PER_ARM) throw Error('Unexpected or excessive native lip iteration');
      raw.frame = frame(); raw.pose = { ...window.lipWorkbench.pose() }; raw.array = buffer(); raw.before = raw.array.slice();
    } catch (e) { raw.failed = true; error(e); }
    let iterator;
    try { iterator = Reflect.apply(c.iterator, this, args); }
    catch (e) { raw.failed = true; error('Native iterator factory threw: ' + String(e)); throw e; }
    const methods = new Map();
    return new Proxy(iterator, { get(target, key) {
      const original = Reflect.get(target, key, target);
      if (!['next', 'return', 'throw'].includes(key) || typeof original !== 'function') return original;
      const old = methods.get(key); if (old?.original === original) return old.forward;
      const forward = function (...methodArgs) {
        let result;
        try { result = Reflect.apply(original, target, methodArgs); }
        catch (e) { raw.failed = true; error('Native iterator ' + key + ' threw: ' + String(e)); throw e; }
        // Never throw an observation error through R05/R06 native stages.
        try {
          if (key !== 'next') { raw.failed = true; error('Iterator closed through ' + key + '; not natural dental-loop completion'); }
          else {
            raw.nextCalls++;
            if (result.done === true && !raw.complete) {
              raw.complete = true;
              if (raw.yields !== c.lips.length || !raw.orderExact) throw Error('Native lip iteration order/count changed');
              if (!raw.failed) {
                if (buffer() !== raw.array) throw Error('Position array changed within dental loop');
                raw.after = raw.array.slice(); c.completedIterations++; c.lastRaw = raw;
              }
            } else if (result.done !== true) { if (result.value !== c.lips[raw.yields]) raw.orderExact = false; raw.yields++; }
          }
        } catch (e) { raw.failed = true; error(e); }
        return result;
      };
      methods.set(key, { original, forward }); return forward;
    } });
  }
  function install(viewer, model) {
    if (c && !c.restored) throw Error('Restore the prior stage observer first');
    const structure = model?.lipStructure, lip = viewer?.currentLip, solver = structure?.mother?.surfaces?.get(lip?.geometry), top = solver?.topology;
    if (!top || top.geometry !== lip.geometry || !Array.isArray(top.lips) || !top.geometry.index || top.geometry.index.array.length % 3) throw Error('Original indexed native lip domain unavailable');
    c = { viewer, model, structure, lip, solver, top, lips: top.lips, samples: top.samples,
      index: top.geometry.index.array, types: top.geometry.attributes.csType.array, lipSet: new Set(top.lips),
      apply: solver.apply, applyDescriptor: own(solver, 'apply'), motherUpdate: structure.mother.update,
      update: viewer.update, render: viewer.render, r05: window.__LIP_MOTION_SOLVER__, r06: window.__LIP_CORNER_SOLVER__,
      iterator: top.lips[Symbol.iterator], iteratorDescriptor: own(top.lips, Symbol.iterator),
      totalIterations: 0, completedIterations: 0, armNumber: 0, armIterations: 0, armed: false, restored: false,
      errors: [], active: null, lastRaw: null, lastCompleted: null, lastArm: null };
    if (typeof c.iterator !== 'function' || (c.iteratorDescriptor && !c.iteratorDescriptor.configurable)) throw Error('Native iterator cannot be reversibly observed');
    buffer(); if (!validSolvers(solvers())) throw Error('Enabled original R05/R06 evaluators are required');
    buildEdges(); return report();
  }
  function arm() {
    if (!c || c.restored || c.armed) throw Error('Install an unarmed stage observer first');
    buffer(); if (Object.values(identities()).some(x => !x) || c.lips[Symbol.iterator] !== c.iterator || !sameDescriptor(own(c.lips, Symbol.iterator), c.iteratorDescriptor)) throw Error('Native owner changed before arm');
    c.beforeSolvers = solvers(); if (!validSolvers(c.beforeSolvers)) throw Error('Native evaluators are no longer enabled/valid');
    c.armNumber++; c.armIterations = 0; c.armCompletedStart = c.completedIterations; c.active = null;
    Object.defineProperty(c.lips, Symbol.iterator, { value: observeFactory, configurable: true, writable: true,
      enumerable: c.iteratorDescriptor?.enumerable || false }); c.armed = true; return report();
  }
  function disarm() {
    if (!c) throw Error('Stage observer is not installed');
    if (!c.armed) return report();
    if (c.lips[Symbol.iterator] !== observeFactory) throw Error('R05/R06 did not unwind to this observer; refusing another owner');
    if (c.iteratorDescriptor) Object.defineProperty(c.lips, Symbol.iterator, c.iteratorDescriptor);
    else if (!Reflect.deleteProperty(c.lips, Symbol.iterator)) throw Error('Cannot restore inherited native iterator');
    c.armed = false;
    const exact = c.lips[Symbol.iterator] === c.iterator && sameDescriptor(own(c.lips, Symbol.iterator), c.iteratorDescriptor);
    const after = solvers(), ids = identities(), completed = c.completedIterations - c.armCompletedStart;
    c.lastArm = { arm: c.armNumber, observedIterations: c.armIterations, completedIterations: completed,
      allIterationsCompleted: completed === c.armIterations && c.armIterations > 0, descriptorRestored: exact, ...ids,
      r05CallsDelta: after.r05.calls - c.beforeSolvers.r05.calls, r06CallsDelta: after.r06.calls - c.beforeSolvers.r06.calls,
      solverStatuses: after, solversStillEnabledValid: validSolvers(after),
      r05LastCompleteAndHooksRestored: after.r05.lastCompleted === true && after.r05.lastHooksRestored === true,
      r06LastCompleteAndHooksRestored: after.r06.lastCompleted === true && after.r06.lastHooksRestored === true };
    c.lastArm.solverCallsMatchObservedIterations = c.lastArm.r05CallsDelta === c.armIterations && c.lastArm.r06CallsDelta === c.armIterations;
    if (!exact || Object.values(ids).some(x => !x) || !c.lastArm.solversStillEnabledValid || !c.lastArm.allIterationsCompleted ||
        !c.lastArm.solverCallsMatchObservedIterations || !c.lastArm.r05LastCompleteAndHooksRestored || !c.lastArm.r06LastCompleteAndHooksRestored) error('Stage observer restoration/execution contract failed');
    if (c.lastRaw?.arm === c.armNumber) { try { c.lastCompleted = summarize(c.lastRaw); } catch (e) { error(e); } }
    return report();
  }
  function report() {
    if (!c) return { version: VERSION, installed: false, armed: false, restored: false };
    return structuredClone({ schema: 'kaopu/lip-edge-envelope-stage-probe@1', version: VERSION, installed: !c.restored,
      armed: c.armed, restored: c.restored, totalIterations: c.totalIterations, completedIterations: c.completedIterations,
      incompleteIterations: c.totalIterations - c.completedIterations, lastCompleted: c.lastCompleted, lastArm: c.lastArm,
      edgeInventory: c.edgeInventory, errors: c.errors, maximumIterationsPerArm: MAX_ITERATIONS_PER_ARM,
      reportInvokesNativeSolverReport: false, geometryWritten: false, updateOrRenderRequested: false,
      wrapperIdentityScope: 'Exact retained outer R06 solver.apply function/descriptor and public R05/R06 API identities; inner R05 closure function is private. Its actual calls and last completed/hooksRestored reports are checked after unwind.',
      limitations: ['Stages after iterator exhaustion (normal rebuild, microgeometry, final normals) are not included in this delta.',
        'Positions and edges use native topology IDs; no native-to-draw prefix mapping is assumed.',
        'No thickness, collision correctness, anatomy, causal visual diagnosis or acceptance follows from these measurements.'] });
  }
  function restore() {
    if (!c) return report(); if (c.armed) disarm();
    const exact = c.lips[Symbol.iterator] === c.iterator && sameDescriptor(own(c.lips, Symbol.iterator), c.iteratorDescriptor);
    if (!exact || Object.values(identities()).some(x => !x)) throw Error('Exact original stage observer ownership was not restored');
    c.restored = true; c.lastRaw = null; c.active = null; return report();
  }
  Object.defineProperty(window, GLOBAL, { value: Object.freeze({ version: VERSION, install, arm, disarm, report, restore }), configurable: true });
})();
