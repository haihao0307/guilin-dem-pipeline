/* R06 candidate: continue native pucker x displacement into the immediately
 * adjacent exterior skin. Original active vertices are immutable anchors.
 * Four millimetres is a bounded engineering support, not measured physiology.
 * No original shape smoothing, material edits, semantic edits or new geometry.
 */
(function () {
  'use strict';
  if (window.__LIP_CORNER_SOLVER__) throw Error('Corner motion module already exists');
  const VERSION = 'native-corner-x-followthrough@1', RADIUS = .004;
  const R05_SOURCE = 'a8bba75322c12df151ecbcebc416087b5248aa5f';
  const own = (o, k) => Object.getOwnPropertyDescriptor(o, k);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const point = (a, i) => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
  const sub = (a, b) => a.map((x, k) => x - b[k]);
  const dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
  function unit(a) { const n = Math.hypot(...a); if (!(n > 1e-10)) throw Error('Degenerate native mouth frame'); return a.map(x => x / n); }
  function sameDescriptor(a, b) { return a === undefined ? b === undefined : b !== undefined && ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'].every(k => a[k] === b[k]); }
  function put(o, k, value) {
    const d = own(o, k); if (d?.configurable === false) throw Error('Native descriptor is not configurable');
    Object.defineProperty(o, k, { configurable: true, writable: true, enumerable: d?.enumerable || false, value });
  }
  function undo(o, k, d) { if (d) Object.defineProperty(o, k, d); else if (!Reflect.deleteProperty(o, k)) throw Error('Native descriptor restoration failed'); }
  function fingerprint(a) {
    const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let h = 2166136261;
    for (const x of b) h = Math.imul(h ^ x, 16777619);
    return (h >>> 0).toString(16).padStart(8, '0') + ':' + b.length;
  }
  function sameBytes(a, b) {
    if (!a?.buffer || !b?.buffer || a.byteLength !== b.byteLength) return false;
    const x = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), y = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
    return true;
  }
  function selectedPositions(a, ids) {
    const out = new Float32Array(ids.length * 3);
    for (let i = 0; i < ids.length; i++) for (let k = 0; k < 3; k++) out[i * 3 + k] = a[ids[i] * 3 + k];
    return out;
  }
  function selectedExact(a, ids, saved) { return ids.every((id, i) => [0, 1, 2].every(k => Object.is(a[id * 3 + k], saved[i * 3 + k]))); }
  const MATCHED = {
    base: { enabled: true, redness: .4, pigment: .25, upperDifference: .18, variation: .65, edgeSoftness: .34, wetness: .35, roughness: .53, foldStrength: .55, seed: 731, diagnostic: 0 },
    head: { enabled: true, seed: 731, tone: .72, warmth: .46, blood: .48, variation: .9, pores: .88, poreRadius: .09, poreSpacing: .58, microrelief: .72, roughness: .51, oil: .26, scatter: .62, freckles: .2, lipColor: .54, lipWetness: .24, eyeThinness: .34, diagnostic: 0 },
    body: { enabled: true, regionalColor: .72, lidWarmth: .46, noseWarmth: .38, earBlood: .44, earTransmission: .58, bodyVariation: .64, bodyPores: .78, jointTone: .42, neckCreases: .34, beardShadow: .04, audit: 0 },
    lipMaterial: { enabled: true, borderSoftness: .48, furrows: .65, pigment: .68, wetness: .35, dryRoughness: .53, colorVariation: .65, upperShade: .45, dryness: .3, microRelief: .65, textureDensity: 1, patternSeed: 37 },
    optics: { upperMelanin: .26, lowerMelanin: .16, upperBlood: .48, lowerBlood: .54, oxygenation: .72, upperRoughness: .54, lowerRoughness: .49, upperWetness: .35, lowerWetness: .45, skinRefinement: .65 }
  };
  const matches = (actual, expected) => !!actual && Object.entries(expected).every(([k, x]) => Object.is(actual[k], x));
  function materialValues(m) {
    const result = {};
    for (const k of ['roughness', 'metalness', 'ior', 'specularIntensity', 'clearcoat', 'clearcoatRoughness', 'transmission', 'thickness', 'opacity', 'side', 'transparent', 'wireframe', 'depthTest', 'depthWrite', 'alphaTest', 'vertexColors', 'flatShading', 'bumpScale', 'displacementScale', 'displacementBias', 'emissiveIntensity', 'envMapIntensity']) result[k] = m[k];
    for (const k of ['color', 'emissive', 'specularColor', 'normalScale']) result[k] = m[k]?.toArray?.() || null;
    return JSON.stringify(result);
  }
  function compatibility(c, inEvaluation) {
    const motion = window.motionLip?.report?.(), inner = window.innerLip?.report?.(), base = window.lipRealism?.report?.();
    if (window.motionLip?.version !== 'LIP-MOTION-R05' || motion?.source?.sourceCommit !== R05_SOURCE || motion.comparison !== 'r05' ||
        motion.solver?.version !== 'native-return-motion-ownership@1' || !motion.solver.enabled || !motion.solver.valid)
      return 'Matched R05 motion ownership is not enabled and valid; R06 remains disabled';
    if (inner?.version !== 'LIP-INNER-R04' || inner.comparison !== 'r04' || inner.diagnostic !== 0 || inner.baseComparison !== 'r02' ||
        base?.version !== 'LIP-REALISM-R02' || base.comparison !== 'r02' || base.ablation?.spatialColour)
      return 'Historical version or diagnostic material selected; R06 remains disabled';
    if (!matches(window.lipRealism.settings(), MATCHED.base) || !matches(window.headProceduralSkin.settings(), MATCHED.head) ||
        !matches(window.bodyProceduralSkin.settings(), MATCHED.body) || !matches(c.structure.settings, MATCHED.lipMaterial) ||
        !matches(c.structure.anatomy.settings, MATCHED.optics))
      return 'Custom material authoring selected; R06 remains disabled without changing it';
    // R02 temporarily scales this value only while mother.update is running.
    const expectedMicro = inEvaluation ? base.coarseReliefScale : 1;
    if (c.structure.anatomy.settings.microGeometry !== expectedMicro)
      return 'Custom native microgeometry selected; R06 remains disabled without changing it';
    if (c.ownership && motion.solver.calibration?.ownershipFingerprint !== c.ownership)
      return 'R05 ownership calibration changed; rebuild the corner binding';
    if (c.materials && c.materials.some(s => s.material !== (s.native ? c.viewer.skin.material : window.headProceduralSkin.material()) ||
        s.material.onBeforeCompile !== s.compile || s.material.customProgramCacheKey !== s.cacheKey || materialValues(s.material) !== s.values))
      return 'Original material object, shader hook or properties changed; R06 remains disabled';
    return null;
  }
  function sourceKey(c) {
    const m = c.model;
    return JSON.stringify({ identity: m.state.gnm.identity, phenotypes: m.state.anny.phenotypes, localChanges: m.state.anny.localChanges,
      identityShape: m.identityLab?.settings?.shape, nativeShape: ['structure', 'upperVolume', 'lowerVolume', 'cupid', 'tubercle', 'corners'].map(k => c.structure.settings[k]),
      tissueDepth: c.structure.anatomy.settings.tissueDepth });
  }
  function invalidation(c, inEvaluation = false) {
    if (c.viewer.currentLip !== c.lip || c.model.lipStructure !== c.structure || c.solver.topology !== c.top ||
        c.structure.mother.surfaces.get(c.lip.geometry) !== c.solver || c.top.geometry !== c.lip.geometry)
      return 'Native person or geometry changed; rebuild the corner binding';
    const a = c.top.geometry.attributes;
    if (a.fRest.array !== c.rest || a.csType.array !== c.type || a.l19Oral.array !== c.oral || c.top.geometry.index.array !== c.index ||
        c.top.samples !== c.samples || c.top.active !== c.activeList || c.top.active.length !== c.activeIds.length || c.top.count !== c.count)
      return 'Native topology or semantic domain changed; rebuild the corner binding';
    if (c.sourceKey && sourceKey(c) !== c.sourceKey) return 'Native identity or lip shape changed; rebuild the corner binding';
    return compatibility(c, inEvaluation);
  }
  function invalidate(c, reason) { c.enabled = false; c.valid = false; c.invalidationReason = reason; }
  function bound(c) {
    const p = c.top.geometry.attributes.position;
    if (p.itemSize !== 3 || p.count !== c.count || p.array.length !== c.count * 3 || p.isInterleavedBufferAttribute)
      throw Error('Native position domain changed');
    if (p.array === c.model.positions || p.array.buffer === c.model.positions?.buffer) throw Error('Refusing canonical position writes');
    return p.array;
  }
  function frame(c) {
    const lm = i => c.model.faceSurface.fields.landmark(c.model.positions, i), a = lm(48), b = lm(54);
    const x = unit(sub(b, a)), center = lm(62).map((q, k) => (q + lm(66)[k]) * .5), convert = p => [p[0], p[2], -p[1]];
    return { x: convert(x), center: convert(center) };
  }
  // This mask describes exterior eligibility for a displacement recipient. It
  // never replaces csType, oral ownership, native weight, active or lip labels.
  function exteriorGain(c, id) {
    const s = c.samples[id], u = Math.abs(s.u), y = c.rest[id * 3 + 1];
    if (!(s.type < .5 && s.inner <= .005 && s.v >= 0 && s.front > .25 && s.depth < .006 && u > .64 && u < 1.6 && y > s.bot - .01 && y < s.top + .014)) return 0;
    return smooth(.64, .84, u) * (1 - smooth(1.5, 1.6, u)) * smooth(.25, .75, s.front) *
      (1 - smooth(.0035, .006, Math.max(0, s.depth))) * smooth(s.bot - .01, s.bot - .009, y) * (1 - smooth(s.top + .013, s.top + .014, y));
  }
  function heapPush(h, item) {
    let i = h.length; h.push(item);
    while (i) { const p = (i - 1) >> 1; if (h[p][1] <= item[1]) break; h[i] = h[p]; i = p; } h[i] = item;
  }
  function heapPop(h) {
    const first = h[0], last = h.pop(); if (!h.length) return first;
    let i = 0;
    while (true) { let k = i * 2 + 1; if (k >= h.length) break; if (k + 1 < h.length && h[k + 1][1] < h[k][1]) k++; if (h[k][1] >= last[1]) break; h[i] = h[k]; i = k; }
    h[i] = last; return first;
  }
  function buildBand(c) {
    const gain = new Float64Array(c.count), graph = new Map(), seeds = new Set();
    for (let id = 0; id < c.count; id++) gain[id] = exteriorGain(c, id);
    function link(a, b) {
      if (!gain[a] || !gain[b] || Math.sign(c.samples[a].u) !== Math.sign(c.samples[b].u) || (c.active[a] && c.active[b])) return;
      const d = Math.hypot(c.rest[a * 3] - c.rest[b * 3], c.rest[a * 3 + 1] - c.rest[b * 3 + 1], c.rest[a * 3 + 2] - c.rest[b * 3 + 2]);
      if (!(d > 1e-10 && d < RADIUS)) return;
      if (!graph.has(a)) graph.set(a, new Map()); if (!graph.has(b)) graph.set(b, new Map());
      graph.get(a).set(b, d); graph.get(b).set(a, d);
      if (c.active[a] && !c.active[b]) seeds.add(a); if (c.active[b] && !c.active[a]) seeds.add(b);
    }
    for (let i = 0; i < c.index.length; i += 3) { const a = c.index[i], b = c.index[i + 1], d = c.index[i + 2]; link(a, b); link(b, d); link(d, a); }
    c.seedIds = [...seeds].sort((a, b) => a - b);
    const recipients = new Map(); let links = 0;
    for (let si = 0; si < c.seedIds.length; si++) {
      const seed = c.seedIds[si], distances = new Map(), heap = [];
      for (const [id, d] of graph.get(seed) || []) if (!c.active[id]) { distances.set(id, d); heapPush(heap, [id, d]); }
      while (heap.length) {
        const [id, d] = heapPop(heap); if (d !== distances.get(id) || d >= RADIUS) continue;
        for (const [next, length] of graph.get(id) || []) {
          if (c.active[next]) continue; const nd = d + length;
          if (nd < RADIUS && nd < (distances.get(next) ?? Infinity)) { distances.set(next, nd); heapPush(heap, [next, nd]); }
        }
      }
      for (const [id, d] of distances) {
        const t = d / RADIUS, w = (1 - t) ** 4 * (4 * t + 1) / Math.max(d * d, 1e-12);
        if (!(w > 0)) continue;
        let r = recipients.get(id); if (!r) { r = { id, minDistance: d, sum: 0, influences: [] }; recipients.set(id, r); }
        r.minDistance = Math.min(r.minDistance, d); r.sum += w; r.influences.push([si, w]); links++;
      }
    }
    c.recipients = [...recipients.values()].sort((a, b) => a.id - b.id);
    for (const r of c.recipients) {
      if (c.active[r.id] || Math.abs(c.samples[r.id].u) <= .64) throw Error('Protected native vertex entered recipient band');
      r.gain = gain[r.id] * (1 - smooth(0, RADIUS, r.minDistance));
      for (const link of r.influences) link[1] /= r.sum;
    }
    c.binding = { method: 'Positive short-range interpolation of the original native x contribution, on the full original indexed rest graph',
      supportRestMM: RADIUS * 1000, supportIsMeasuredPhysiology: false, inputPoseUsedForBinding: false,
      nativeVertices: c.count, originalActiveVertices: c.activeIds.length, centerVertices: c.centerIds.length,
      scannedTriangles: c.index.length / 3, usedTopologyNeighbors: false, boundaryAnchors: c.seedIds.length, recipientVertices: c.recipients.length, interpolationLinks: links,
      nativeRestFingerprint: fingerprint(c.rest), nativeIndexFingerprint: fingerprint(c.index), originalActiveFingerprint: fingerprint(c.active), ownershipFingerprint: c.ownership,
      exteriorRule: 'Same-side native type<.5, inner<=.005, v>=0, front>.25, depth<6mm; native exterior vertical region; all original active vertices excluded',
      fades: 'front .25-.75; depth 3.5-6mm; short physical rest distance 0-4mm; outer lateral and exterior vertical guards',
      interpolation: 'Shortest indexed path through inactive eligible skin; positive compact kernel (1-t)^4*(4t+1)/distance^2, normalized across anchors; smooth nearest-distance fade to zero',
      sourceValues: 'Each current before-local native anchor x contribution; no stored posed displacement',
      examples: c.recipients.filter(r => [32640, 47150, 12828, 18024].includes(r.id)).map(r => ({ id: r.id, u: c.samples[r.id].u, v: c.samples[r.id].v, front: c.samples[r.id].front, depthMM: c.samples[r.id].depth * 1000, minRestDistanceMM: r.minDistance * 1000, gain: r.gain, anchors: r.influences.length })) };
  }
  let context = null;
  function install(viewer, model) {
    if (context) uninstall();
    const structure = model?.lipStructure, lip = viewer?.currentLip, solver = structure?.mother?.surfaces?.get(lip?.geometry), top = solver?.topology;
    if (!solver || !top || top.geometry !== lip.geometry || !top.geometry.index || !top.geometry.attributes.l19Oral) throw Error('Original indexed lip evaluator is unavailable');
    const c = { viewer, model, structure, lip, solver, top, count: top.count, samples: top.samples, activeList: top.active,
      rest: top.geometry.attributes.fRest.array, type: top.geometry.attributes.csType.array, oral: top.geometry.attributes.l19Oral.array, index: top.geometry.index.array,
      active: new Uint8Array(top.count), activeIds: [...top.active], centerIds: [], originalApply: solver.apply, descriptor: own(solver, 'apply'),
      enabled: false, valid: true, attached: false, running: false, calls: 0, errors: [], last: null, binding: null };
    for (const id of c.activeIds) c.active[id] = 1;
    for (let id = 0; id < c.count; id++) if (Math.abs(c.samples[id].u) <= .64) c.centerIds.push(id);
    bound(c); context = c;
    const reason = compatibility(c, false); if (reason) { invalidate(c, reason); return report(); }
    c.ownership = window.__LIP_MOTION_SOLVER__.report().calibration.ownershipFingerprint;
    c.sourceKey = sourceKey(c);
    c.materials = [viewer.skin.material, window.headProceduralSkin.material()].map((material, i) => ({ material, native: i === 0, compile: material.onBeforeCompile, cacheKey: material.customProgramCacheKey, values: materialValues(material) }));
    buildBand(c);
    if (!c.seedIds.length || !c.recipients.length) { invalidate(c, 'No eligible exterior follow-through band exists for this native surface'); return report(); }
    c.wrapper = function (...args) {
      if (!c.enabled) return Reflect.apply(c.originalApply, this, args);
      if (this !== c.solver || c.running) throw Error('Unexpected corner solver call');
      const reason = invalidation(c, true); if (reason) { invalidate(c, reason); return Reflect.apply(c.originalApply, this, args); }
      const amount = c.structure.performance.settings.pucker;
      if (!Number.isFinite(amount) || amount < 0 || amount > 1) throw Error('Invalid native pucker input');
      const rec = { call: ++c.calls, completed: false, hooksRestored: false, pairMapCalls: 0, puckerInput: amount, puckerZeroBypass: amount === 0,
        activeDirectDeltaZero: true, centerDirectDeltaZero: true, directChangedVertices: 0, maxDirectCorrectionMM: 0,
        activeVerticesCompared: 0, centerVerticesCompared: 0, beforeLocalBaseMatchesEntry: null, allOriginalStagesExecuted: true };
      if (amount === 0) {
        // No nested hooks, position reads/writes or pose substitution here.
        try { const answer = Reflect.apply(c.originalApply, this, args); rec.completed = true; rec.hooksRestored = true; c.last = rec; return answer; }
        catch (error) { rec.error = String(error); c.last = rec; c.errors.push(String(error)); invalidate(c, 'Unexpected native evaluation failure'); throw error; }
      }
      const array = bound(c), entry = array.slice(), f = frame(c), pairs = top.pairs, lips = top.lips;
      const map = pairs.map, md = own(pairs, 'map'), iterator = lips[Symbol.iterator], ld = own(lips, Symbol.iterator);
      let answer, failure = null; c.running = true;
      try {
        put(pairs, 'map', function (...mapArgs) {
          if (this !== pairs || ++rec.pairMapCalls !== 1) throw Error('Native local motion boundary changed');
          rec.beforeLocalBaseMatchesEntry = sameBytes(solver.base, entry); if (!rec.beforeLocalBaseMatchesEntry) throw Error('Current native before-local position buffer was not captured');
          const activeBefore = selectedPositions(array, c.activeIds), centerBefore = selectedPositions(array, c.centerIds);
          rec.activeVerticesCompared = c.activeIds.length; rec.centerVerticesCompared = c.centerIds.length;
          const anchors = new Float64Array(c.seedIds.length);
          for (let i = 0; i < c.seedIds.length; i++) {
            const id = c.seedIds[i]; anchors[i] = -.23 * amount * dot(sub(point(solver.base, id), f.center), f.x) * c.samples[id].weight;
          }
          const examples = [];
          for (const r of c.recipients) {
            let delta = 0; for (const [si, w] of r.influences) delta += anchors[si] * w;
            delta *= r.gain;
            if (!Number.isFinite(delta)) throw Error('Non-finite exterior follow-through');
            if (Math.abs(delta) < 1e-12) continue;
            const before = point(array, r.id);
            for (let k = 0; k < 3; k++) array[r.id * 3 + k] += f.x[k] * delta;
            const actual = Math.hypot(...sub(point(array, r.id), before)) * 1000;
            if (actual > 0) { rec.directChangedVertices++; rec.maxDirectCorrectionMM = Math.max(rec.maxDirectCorrectionMM, actual); }
            if ([32640, 47150, 12828, 18024].includes(r.id)) examples.push({ id: r.id, nativeXContributionAddedMM: delta * 1000, actualDistanceMM: actual });
          }
          rec.examples = examples;
          rec.activeDirectDeltaZero = selectedExact(array, c.activeIds, activeBefore); rec.centerDirectDeltaZero = selectedExact(array, c.centerIds, centerBefore);
          if (!rec.activeDirectDeltaZero || !rec.centerDirectDeltaZero) throw Error('A protected original active or central vertex changed directly');
          // R05 has performed its own local ownership correction before this
          // callback. Original closure and every later stage continue normally.
          return Reflect.apply(map, this, mapArgs);
        });
        answer = Reflect.apply(c.originalApply, this, args);
        if (rec.pairMapCalls !== 1 || (answer && typeof answer.then === 'function')) throw Error('Native phase count or synchrony changed');
        rec.completed = true;
      } catch (error) { failure = error; rec.error = String(error); c.errors.push(String(error)); }
      finally {
        try {
          undo(pairs, 'map', md);
          if (pairs.map !== map || !sameDescriptor(own(pairs, 'map'), md) || lips[Symbol.iterator] !== iterator || !sameDescriptor(own(lips, Symbol.iterator), ld)) throw Error('Inner native descriptors were not restored');
          rec.hooksRestored = true;
        } catch (error) { c.errors.push(String(error)); failure = failure || error; }
        c.running = false; c.last = rec;
      }
      if (failure) { invalidate(c, 'Unexpected native stage failure; inspect errors'); throw failure; }
      return answer;
    };
    put(solver, 'apply', c.wrapper); c.attached = true; return report();
  }
  function setEnabled(value) {
    if (typeof value !== 'boolean') throw Error('Corner enable must be boolean');
    if (!context) throw Error('Install the corner binding first');
    const c = context; if (c.running) throw Error('Cannot switch inside native evaluation');
    if (!value) { c.enabled = false; return report(); }
    const reason = invalidation(c, false); if (reason) invalidate(c, reason);
    if (c.valid && c.attached) c.enabled = true;
    return report();
  }
  function uninstall() {
    if (!context) return { version: VERSION, installed: false, enabled: false, originalApplyRestored: true, nativeUpdateRequired: false };
    const c = context; if (c.running) throw Error('Cannot uninstall inside native evaluation');
    if (c.attached) {
      if (c.solver.apply !== c.wrapper) throw Error('Another owner replaced the corner wrapper; detach before rebuilding R05');
      undo(c.solver, 'apply', c.descriptor);
      if (c.solver.apply !== c.originalApply || !sameDescriptor(own(c.solver, 'apply'), c.descriptor)) throw Error('Exact R05 descriptor restoration failed');
    }
    context = null;
    return { version: VERSION, installed: false, enabled: false, originalApplyRestored: true, nativeUpdateRequired: true };
  }
  function report() {
    const c = context;
    if (c?.valid && !c.running) { const reason = invalidation(c, false); if (reason) invalidate(c, reason); }
    return structuredClone({ version: VERSION, installed: !!c?.attached, enabled: !!c?.enabled, disabled: !c?.enabled, valid: !!c?.valid,
      invalidationReason: c?.invalidationReason || null, binding: c?.binding || null, last: c?.last || null, calls: c?.calls || 0, errors: c?.errors || [],
      component: 'Native mouth-frame x only; original pucker source motion is retained', originalActiveVerticesProtected: true, centerRule: 'abs(native u)<=.64',
      puckerZero: 'Direct original R05 evaluation without nested R06 hooks or position writes', poseUsedForInstall: false,
      canonicalPositionsChanged: false, topologyChanged: false, semanticFieldsChangedByModule: false, materialChanged: false, dnaWritten: false, newMeshes: 0,
      fullBiomechanics: false, visualAcceptance: false, productionReady: false,
      limitations: ['Four millimetres and the positive interpolation kernel are bounded engineering choices, not measured tissue mechanics.',
        'Direct anchor protection does not prevent original downstream normals and strain from responding to neighbouring geometry.',
        'The original local coordinate normalization, closure, pressure, contact scope and unverified volume compensation remain unchanged.',
        'Unsupported historical or custom material states disable this candidate without changing those states or their labels.'] });
  }
  window.__LIP_CORNER_SOLVER__ = Object.freeze({ version: VERSION, install, setEnabled, report, uninstall });
})();
