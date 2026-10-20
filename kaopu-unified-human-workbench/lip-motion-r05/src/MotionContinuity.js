/* Native inner-return motion ownership. No new mesh, material, pose or DNA.
 * The deterministic native jaw=.36 before-local surface supplies the carrier
 * of the connected inner lip; only the difference in opposing motion ownership
 * is added after the original local and closure stages have run in full.
 */
(function () {
  'use strict';
  if (window.__LIP_MOTION_SOLVER__) throw Error('Lip motion ownership module already exists');
  const VERSION = 'native-return-motion-ownership@1';
  const own = (o, k) => Object.getOwnPropertyDescriptor(o, k);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const gauss = (x, width) => Math.exp(-((x / width) ** 2));
  const sameDescriptor = (a, b) => a === undefined ? b === undefined : b !== undefined &&
    ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]);
  function put(o, k, f) {
    const d = own(o, k); if (d?.configurable === false) throw Error('Native member cannot be wrapped: ' + String(k));
    Object.defineProperty(o, k, { configurable: true, writable: true, enumerable: d?.enumerable || false, value: f });
  }
  function undo(o, k, d) { if (d) Object.defineProperty(o, k, d); else if (!Reflect.deleteProperty(o, k)) throw Error('Native member could not be restored'); }
  function fingerprint(a) {
    if (!a?.buffer) return null;
    const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let h = 2166136261;
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619);
    return (h >>> 0).toString(16).padStart(8, '0') + ':' + bytes.length;
  }
  const point = (a, id) => [a[id * 3], a[id * 3 + 1], a[id * 3 + 2]];
  const subtract = (a, b) => a.map((x, k) => x - b[k]);
  const dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
  function unit(a) { const length = Math.hypot(...a); if (!(length > 1e-10)) throw Error('Degenerate native mouth frame'); return a.map(x => x / length); }
  function distanceToLine(p, line) {
    let best = Infinity;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], d = subtract(line[i + 1], a), length2 = dot(d, d);
      const t = length2 > 1e-20 ? clamp(dot(subtract(p, a), d) / length2) : 0;
      const r = p.map((x, k) => x - a[k] - t * d[k]); best = Math.min(best, dot(r, r));
    }
    return Math.sqrt(best);
  }
  let context = null;
  function currentSourceKey(c) {
    const m = c.model, s = c.structure;
    return JSON.stringify({ identity: m.state.gnm.identity, phenotypes: m.state.anny.phenotypes,
      localChanges: m.state.anny.localChanges, identityShape: m.identityLab?.settings?.shape,
      nativeShape: ['structure', 'upperVolume', 'lowerVolume', 'cupid', 'tubercle', 'corners'].map(k => [k, s.settings[k]]),
      tissueDepth: s.anatomy.settings.tissueDepth, solverIdentityKey: c.solver.lastKey,
      reference: fingerprint(c.solver.reference), horizontalReference: fingerprint(c.solver.referenceHorizontal) });
  }
  function knownInvalidation(c) {
    if (c.viewer.currentLip !== c.lip || c.model.lipStructure !== c.structure ||
        c.structure.mother.surfaces.get(c.lip.geometry) !== c.solver ||
        c.solver.topology !== c.top || c.top.geometry !== c.lip.geometry)
      return 'Native person/topology changed; a new jaw=.36 carrier reference is required';
    if (c.sourceKey && currentSourceKey(c) !== c.sourceKey)
      return 'Native identity, lip shape or calibration changed; a new jaw=.36 carrier reference is required';
    return null;
  }
  function invalidate(c, reason) {
    c.enabled = false; c.valid = false; c.invalidationReason = reason;
    // A supported native edit is not a solver error. The original evaluator
    // remains available immediately; only this optional correction is disabled.
  }
  function bound(c, checkKey = true) {
    if (c.viewer.currentLip !== c.lip || c.model.lipStructure !== c.structure ||
        c.structure.mother.surfaces.get(c.lip.geometry) !== c.solver || c.solver.topology !== c.top ||
        c.top.geometry !== c.lip.geometry) throw Error('Lip topology changed; rebuild ownership from native jaw=.36');
    const p = c.top.geometry.attributes.position;
    if (p.itemSize !== 3 || p.count !== c.top.count || p.array.length !== c.top.count * 3 || p.isInterleavedBufferAttribute)
      throw Error('Native lip display position domain changed');
    if (p.array === c.model.positions || p.array.buffer === c.model.positions?.buffer)
      throw Error('Refusing to alter canonical positions');
    if (checkKey && currentSourceKey(c) !== c.sourceKey) {
      c.valid = false; throw Error('Person/shape/native calibration changed; rebuild ownership from native jaw=.36 before enabling R05');
    }
    return p;
  }
  function frame(c) {
    const landmark = id => c.model.faceSurface.fields.landmark(c.model.positions, id);
    const left = landmark(48), right = landmark(54), x = unit(subtract(right, left));
    const vertical = subtract(landmark(27), landmark(8));
    const up = unit(vertical.map((v, k) => v - x[k] * dot(vertical, x)));
    const scale = c.structure.anatomy.scale(Math.hypot(...subtract(right, left)));
    if (!Number.isFinite(scale) || scale <= 0) throw Error('Invalid native anatomical scale');
    // ao(model) converts the canonical landmark frame into the displayed
    // geometry coordinates using l(h)=[h[0],h[2],-h[1]]. The intervention
    // writes that displayed position buffer, so using canonical up is wrong.
    return { up: [up[0], up[2], -up[1]], scale };
  }
  function install(viewer, model) {
    if (context) uninstall();
    const structure = model?.lipStructure, lip = viewer?.currentLip;
    const solver = structure?.mother?.surfaces?.get(lip?.geometry), top = solver?.topology;
    if (!solver || !top || top.geometry !== lip.geometry) throw Error('Original native lip solver is unavailable');
    const pose = window.lipWorkbench?.pose?.();
    if (!pose || Math.abs(pose.jawOpen - .36) > 1e-9 || Object.entries(pose).some(([k, v]) => k !== 'schema' && k !== 'jawOpen' && v !== 0))
      throw Error('Install R05 after the deterministic native jaw=.36 pose with all local actions zero');
    const c = { viewer, model, structure, lip, solver, top, enabled: false, valid: true, running: false,
      originalApply: solver.apply, descriptor: own(solver, 'apply'), calls: 0, last: null, errors: [] };
    bound(c, false);
    if (!solver.base || solver.base.length !== top.count * 3 || !solver.reference || !solver.referenceHorizontal)
      throw Error('The completed native jaw reference or neutral calibration is missing');
    const base = solver.base.slice();
    if (!base.every(Number.isFinite) || top.pairs.length !== 49) throw Error('Unexpected native reference or contact rail samples');
    const upper = top.pairs.map(p => point(base, p.upper)), lower = top.pairs.map(p => point(base, p.lower));
    const gaps = upper.map((p, i) => Math.hypot(...subtract(p, lower[i]))).sort((a, b) => a - b);
    if (!(gaps[Math.floor(gaps.length / 2)] > .004)) throw Error('Native jaw reference does not separate the two tissue carriers');
    c.ids = []; c.deltaOwnership = new Float32Array(top.count); c.ownership = new Float32Array(top.count);
    const evidence = []; let upperToLower = 0, lowerToUpper = 0, fullCarrierReassignment = 0;
    for (let id = 0; id < top.count; id++) {
      const s = top.samples[id], original = s.upper ? 1 : 0; c.ownership[id] = original;
      // A return can have oral=0 along its visible inner edge. Its native
      // negative-v section and skin type provide the boundary identity there.
      // The actual red lip bodies (v>=-.015) are exactly protected.
      if (!s.skin || s.type >= .5 || s.v >= -.015 || Math.abs(s.u) >= 1.10 || !(s.weight > .001)) continue;
      const support = (1 - smooth(-.24, -.015, s.v)) * (1 - smooth(.72, 1, s.red)) *
        (1 - smooth(.86, 1.10, Math.abs(s.u))) * (1 - smooth(.006, .014, Math.max(0, s.depth))) * Math.max(s.front, s.inner);
      if (!(support > 1e-6)) continue;
      const p = point(base, id), du = distanceToLine(p, upper), dl = distanceToLine(p, lower);
      // Fixed smooth carrier field from a known native opening, not a test
      // camera or the user's current expression. Confident lobes retain full
      // amplitude; only the connected transition interpolates the two owners.
      const carrier = smooth(-.55, .55, (dl - du) / Math.max(1e-9, dl + du));
      const value = original + support * (carrier - original), delta = value - original;
      if (Math.abs(delta) < 1e-7) continue;
      c.ids.push(id); c.deltaOwnership[id] = delta; c.ownership[id] = value;
      if (delta > .5) lowerToUpper++; if (delta < -.5) upperToLower++;
      if (Math.abs(delta) > .999) fullCarrierReassignment++;
      if (evidence.length < 12) evidence.push({ id, u: s.u, v: s.v, inner: s.inner, red: s.red,
        originalUpper: original, newUpper: value, support, distanceUpperMM: du * 1000, distanceLowerMM: dl * 1000 });
    }
    if (!c.ids.length) throw Error('No native return ownership correction was established');
    c.sourceKey = currentSourceKey(c);
    c.calibration = { method: 'Fixed native jaw=.36 before-local surface and distances to the original upper/lower contact polylines',
      jawOpen: .36, localActionsZero: true, nativeVertices: top.count, contactPairs: 49,
      medianReferenceGapMM: gaps[Math.floor(gaps.length / 2)] * 1000,
      beforeLocalFingerprint: fingerprint(base), ownershipFingerprint: fingerprint(c.ownership),
      semanticRestFingerprint: fingerprint(top.geometry.attributes.fRest.array),
      changedOwnershipVertices: c.ids.length, lowerToUpper, upperToLower, fullCarrierReassignment,
      protectedBodyRule: 'All v>=-.015 or csType>=.5 remain exactly outside the correction', examples: evidence,
      measuredPhysiology: false, fieldReproducibleFromNativeReference: true };
    c.wrapper = function (...args) {
      if (!c.enabled) return Reflect.apply(c.originalApply, this, args);
      if (this !== c.solver || c.running) throw Error('Unexpected native lip solver call');
      const invalidation = knownInvalidation(c);
      if (invalidation) { invalidate(c, invalidation); return Reflect.apply(c.originalApply, this, args); }
      const position = bound(c), array = position.array, f = frame(c), actions = c.structure.performance.settings;
      const pairs = c.top.pairs, lips = c.top.lips, map = pairs.map, iterator = lips[Symbol.iterator];
      const md = own(pairs, 'map'), ld = own(lips, Symbol.iterator);
      const rec = { call: ++c.calls, localBoundaryCalls: 0, closureBoundaryCalls: 0, localChangedVertices: 0,
        closureChangedVertices: 0, maxLocalCorrectionMM: 0, maxClosureCorrectionMM: 0,
        hooksRestored: false, completed: false, allOriginalMotionStagesExecuted: true, materialChanged: false };
      let closure = null, failure = null, answer; c.running = true;
      function add(id, amount, field) {
        if (!Number.isFinite(amount)) throw Error('Non-finite return correction');
        if (Math.abs(amount) < 1e-12) return;
        for (let k = 0; k < 3; k++) array[id * 3 + k] += f.up[k] * amount;
        rec[field + 'ChangedVertices']++; rec['max' + field[0].toUpperCase() + field.slice(1) + 'CorrectionMM'] = Math.max(rec['max' + field[0].toUpperCase() + field.slice(1) + 'CorrectionMM'], Math.abs(amount) * 1000);
      }
      try {
        put(pairs, 'map', function (...mapArgs) {
          if (this !== pairs || ++rec.localBoundaryCalls !== 1) throw Error('Native local stage boundary changed');
          for (const id of c.ids) {
            const s = top.samples[id];
            const upperMinusLower = (.0018 * actions.upperRaise + .0024 * actions.lowerDepress) * gauss(s.u, .9) +
              .0034 * actions.funnel * gauss(s.u, .85) * gauss(s.v, .8) -
              .0025 * (actions.rollOut - actions.rollIn) * gauss(s.v - .2, .75);
            add(id, c.deltaOwnership[id] * upperMinusLower * f.scale * s.weight, 'local');
          }
          // The original closure samples are evaluated AFTER the repaired
          // local direction, preserving their actual gap/adhesion calculation.
          const result = Reflect.apply(map, this, mapArgs);
          if (!Array.isArray(result) || result.length !== 49 || result.some(p => !Number.isFinite(p.delta) || !Number.isFinite(p.closure)))
            throw Error('Native closure samples changed');
          closure = result; return result;
        });
        put(lips, Symbol.iterator, function (...iteratorArgs) {
          if (this !== lips || ++rec.closureBoundaryCalls !== 1 || !closure) throw Error('Native closure stage boundary changed');
          for (const id of c.ids) {
            const s = top.samples[id], x = clamp((s.u + .94) / 1.88) * (closure.length - 1);
            const i = Math.floor(x), j = Math.min(closure.length - 1, i + 1), t = x - i;
            const delta = closure[i].delta + (closure[j].delta - closure[i].delta) * t;
            const support = gauss(Math.max(0, s.v), .92) * (1 - smooth(.94, 1.14, Math.abs(s.u))) * Math.max(s.front, s.inner * .7);
            add(id, 2 * c.deltaOwnership[id] * delta * support, 'closure');
          }
          return Reflect.apply(iterator, this, iteratorArgs);
        });
        answer = Reflect.apply(c.originalApply, this, args);
        if (rec.localBoundaryCalls !== 1 || rec.closureBoundaryCalls !== 1) throw Error('Native phase execution count changed');
        if (answer && typeof answer.then === 'function') throw Error('Native solver became asynchronous');
        rec.completed = true;
      } catch (error) { failure = error; rec.error = String(error); c.errors.push(String(error)); }
      finally {
        const failures = [];
        for (const [o, k, d, original] of [[pairs, 'map', md, map], [lips, Symbol.iterator, ld, iterator]]) {
          try { undo(o, k, d); if (o[k] !== original || !sameDescriptor(own(o, k), d)) throw Error('Native descriptor mismatch'); }
          catch (error) { failures.push(String(error)); }
        }
        rec.hooksRestored = failures.length === 0; c.running = false; c.last = rec;
        if (failures.length) failure = new Error([failure ? String(failure) : '', ...failures].filter(Boolean).join('; '));
      }
      if (failure) { c.valid = false; c.enabled = false; throw failure; }
      return answer;
    };
    put(solver, 'apply', c.wrapper); context = c; return report();
  }
  function setEnabled(value) {
    if (typeof value !== 'boolean') throw Error('Motion enable must be boolean');
    if (!context) throw Error('Install native motion ownership first');
    if (context.running) throw Error('Cannot switch inside native solver');
    if (value) bound(context); context.enabled = value; return report();
  }
  function uninstall() {
    if (!context) return { version: VERSION, installed: false, enabled: false };
    const c = context; if (c.running) throw Error('Cannot uninstall inside native solver');
    if (c.solver.apply !== c.wrapper) throw Error('Another owner changed the native solver wrapper');
    undo(c.solver, 'apply', c.descriptor);
    if (c.solver.apply !== c.originalApply || !sameDescriptor(own(c.solver, 'apply'), c.descriptor)) throw Error('Original solver descriptor was not restored');
    context = null; return { version: VERSION, installed: false, enabled: false, originalApplyRestored: true, nativeUpdateRequired: true };
  }
  function report() {
    const c = context;
    if (c && !c.running) { const reason = knownInvalidation(c); if (reason) invalidate(c, reason); }
    return structuredClone({ version: VERSION, installed: !!c, enabled: !!c?.enabled, disabled: !c?.enabled, valid: !!c?.valid,
      invalidationReason: c?.invalidationReason || null,
      calibration: c?.calibration || null, last: c?.last || null, calls: c?.calls || 0, errors: c?.errors || [],
      originalLocalActionRetained: true, originalClosureDeltaAndAdhesionRetained: true,
      correction: 'Add only the change in upper/lower tissue ownership to opposing local direction terms and closure sign',
      storedUpperMaterialSemanticChanged: false, canonicalPositionsChanged: false, dnaWritten: false, materialChanged: false,
      newMeshes: 0, fullBiomechanics: false, visualAcceptance: false,
      invalidation: 'Supported identity/shape/calibration/topology edits disable this correction and continue original evaluation; enabling it again requires deterministic jaw=.36 reinstall',
      limitations: ['Reference carrier ownership is a geometric construction, not measured tissue anatomy.',
        'The existing gap interpolation, collision scope, strain model and original pressure fields are retained.',
        'Actual candidate images, dynamic midpoint continuity, archives and cross-person use still require independent verification.'] });
  }
  window.__LIP_MOTION_SOLVER__ = Object.freeze({ version: VERSION, install, setEnabled, report, uninstall });
})();
