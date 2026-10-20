/* R06 candidate 02: redistribute only the native pucker x increment on
 * verified peripheral exterior skin, including originally active vertices.
 * Lip rail body, native vermilion/rim, contact samples and center are fixed.
 * Four millimetres is a graph smoothing length, not a hard support cutoff or
 * measured physiology. No original shape, material, semantic or topology edit.
 */
(function () {
  'use strict';
  if (window.__LIP_CORNER_SOLVER__) throw Error('Corner motion module already exists');
  const VERSION = 'native-corner-x-followthrough@2', LENGTH = .004;
  const MAX_ITERATIONS = 512, RESIDUAL_MM = .0001, RELATIVE_RESIDUAL = 1e-6;
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
  function exteriorSurface(c, id) {
    const s = c.samples[id], y = c.rest[id * 3 + 1];
    return s.type < .5 && s.inner <= .005 && s.v >= 0 && s.front > .25 && s.depth < .006 && Math.abs(s.u) < 1.7 && y > s.bot - .01 && y < s.top + .014;
  }
  function buildBand(c) {
    const baseCore = new Uint8Array(c.count), core = new Uint8Array(c.count), surface = new Uint8Array(c.count);
    const gain = new Float64Array(c.count), graph = new Map(), contacts = new Set();
    let railBodyVertices = 0, rimVertices = 0;
    for (const id of c.top.lips) baseCore[id] = 1;
    for (const pair of c.top.pairs) { contacts.add(pair.upper); contacts.add(pair.lower); baseCore[pair.upper] = baseCore[pair.lower] = 1; }
    for (let id = 0; id < c.count; id++) {
      const s = c.samples[id];
      // v describes the lip body only inside the outer rail endpoints.
      // In particular u=1.21,v=.78 is not made lip core by this test.
      if (s.roi && Math.abs(s.u) <= 1 && s.v >= 0 && s.v <= 1.05) { baseCore[id] = 1; railBodyVertices++; }
      if (s.rim) { baseCore[id] = 1; rimVertices++; }
      surface[id] = exteriorSurface(c, id) ? 1 : 0;
    }
    core.set(baseCore);
    for (let i = 0; i < c.index.length; i += 3) {
      const ids = [c.index[i], c.index[i + 1], c.index[i + 2]];
      for (const a of ids) if (baseCore[a]) for (const b of ids) core[b] = 1;
    }
    c.coreIds = []; c.contactIds = [...contacts].sort((a, b) => a - b);
    for (let id = 0; id < c.count; id++) {
      if (core[id]) c.coreIds.push(id);
      if (!core[id]) gain[id] = exteriorGain(c, id);
    }
    let degenerateEdgeVisits = 0;
    function link(a, b) {
      if (!(gain[a] || gain[b]) || !surface[a] || !surface[b] || Math.sign(c.samples[a].u) !== Math.sign(c.samples[b].u)) return;
      const d = Math.hypot(c.rest[a * 3] - c.rest[b * 3], c.rest[a * 3 + 1] - c.rest[b * 3 + 1], c.rest[a * 3 + 2] - c.rest[b * 3 + 2]);
      if (!(d > 1e-10)) { degenerateEdgeVisits++; return; }
      const weight = 1 / (d * d); if (!Number.isFinite(weight) || !(weight > 0)) throw Error('Invalid indexed rest edge weight');
      if (gain[a]) { if (!graph.has(a)) graph.set(a, new Map()); graph.get(a).set(b, weight); }
      if (gain[b]) { if (!graph.has(b)) graph.set(b, new Map()); graph.get(b).set(a, weight); }
    }
    for (let i = 0; i < c.index.length; i += 3) { const a = c.index[i], b = c.index[i + 1], d = c.index[i + 2]; link(a, b); link(b, d); link(d, a); }
    c.freeIds = [...graph.keys()].sort((a, b) => a - b);
    const freeIndex = new Int32Array(c.count); freeIndex.fill(-1);
    c.freeIds.forEach((id, i) => { freeIndex[id] = i; });
    const rows = [], relevant = new Set(), fixed = new Set();
    let links = 0, minimumWeight = Infinity, maximumWeight = 0;
    for (const id of c.freeIds) {
      if (core[id] || Math.abs(c.samples[id].u) <= .64) throw Error('Protected native vertex entered free exterior field');
      const adjacent = [...graph.get(id)].sort((a, b) => a[0] - b[0]);
      const mass = adjacent.length / (LENGTH * LENGTH * gain[id]); let diagonal = mass;
      const neighbors = adjacent.map(([other, weight]) => {
        diagonal += weight; relevant.add(other); if (freeIndex[other] < 0) fixed.add(other);
        minimumWeight = Math.min(minimumWeight, weight); maximumWeight = Math.max(maximumWeight, weight); links++;
        return { id: other, free: freeIndex[other], weight };
      });
      if (!(mass > 0) || !Number.isFinite(diagonal)) throw Error('Invalid positive graph mass or diagonal');
      relevant.add(id); rows.push({ id, mass, diagonal, neighbors });
    }
    // Each free/free edge has identical positive weight in both rows. The
    // positive mass makes the Dirichlet graph matrix strictly positive definite.
    for (let i = 0; i < rows.length; i++) for (const edge of rows[i].neighbors) if (edge.free >= 0) {
      if (graph.get(edge.id)?.get(rows[i].id) !== edge.weight) throw Error('Asymmetric native rest graph');
    }
    const component = new Int32Array(rows.length); component.fill(-1); let components = 0;
    for (let i = 0; i < rows.length; i++) if (component[i] < 0) {
      const queue = [i]; component[i] = components;
      for (let q = 0; q < queue.length; q++) for (const edge of rows[queue[q]].neighbors) if (edge.free >= 0 && component[edge.free] < 0) { component[edge.free] = components; queue.push(edge.free); }
      components++;
    }
    c.rows = rows; c.relevantIds = [...relevant].sort((a, b) => a - b); c.component = component; c.components = components;
    const baseCoreCount = baseCore.reduce((sum, x) => sum + x, 0);
    c.binding = {
      method: 'Screened positive rest-graph smoothing of only the original pucker x increment, with fixed core and exterior boundary values',
      smoothingLengthRestMM: LENGTH * 1000, smoothingLengthIsMeasuredPhysiology: false, hardFourMillimetreSupportCutoff: false, inputPoseUsedForBinding: false,
      nativeVertices: c.count, originalActiveVertices: c.activeIds.length, centerVertices: c.centerIds.length,
      nativeVermilionVertices: c.top.lips.length, nativeRimVertices: rimVertices, railBodyVertices, protectedBaseCoreVertices: baseCoreCount,
      protectedCoreAndOneRingVertices: c.coreIds.length, protectedOneRingAddedVertices: c.coreIds.length - baseCoreCount,
      contactPairSlots: c.top.pairs.length, contactVertexSlots: c.top.pairs.length * 2, uniqueContactVertices: c.contactIds.length,
      scannedTriangles: c.index.length / 3, fullIndexPasses: 2, usedTopologyNeighbors: false, freeExteriorVertices: rows.length,
      freeOriginallyActiveVertices: rows.filter(r => c.active[r.id]).length, freeOriginallyInactiveVertices: rows.filter(r => !c.active[r.id]).length,
      fixedBoundaryVertices: fixed.size, positiveDirectedLinks: links, connectedFreeComponents: components, degenerateEdgeVisits,
      minimumPositiveWeight: Number.isFinite(minimumWeight) ? minimumWeight : null, maximumPositiveWeight: maximumWeight,
      nativeRestFingerprint: fingerprint(c.rest), nativeIndexFingerprint: fingerprint(c.index), originalActiveFingerprint: fingerprint(c.active),
      protectedCoreFingerprint: fingerprint(core), freeVertexFingerprint: fingerprint(new Uint32Array(c.freeIds)), ownershipFingerprint: c.ownership,
      coreRule: 'Union of native top.lips, all samples.rim, original pairs, and native roi with abs(u)<=1 and 0<=v<=1.05; plus exactly one full-index neighbour ring. Negative-v and oral points are ineligible for edits.',
      exteriorRule: 'Same-side native type<.5, inner<=.005, v>=0, front>.25, depth<6mm; native exterior vertical region; free points exclude core and abs(u)<=.64',
      fades: 'Coefficient g: u .64-.84 and 1.5-1.6; front .25-.75; depth 3.5-6mm; 1mm outer vertical fades. Domain is not cut 4mm from the lip core.',
      equation: '(degree_i/(ell^2*g_i)+sum_j 1/length_ij^2)*d_i - sum_free_j d_j/length_ij^2 = degree_i*native_i/(ell^2*g_i)+sum_fixed_j native_j/length_ij^2',
      solver: { method: 'Diagonal-preconditioned conjugate gradients on the symmetric positive-definite correction system; actual residual recomputed', maximumIterations: MAX_ITERATIONS, maximumNormalizedResidualMM: RESIDUAL_MM, maximumRelativeResidual: RELATIVE_RESIDUAL },
      sourceValues: 'Current before-local native pucker x contribution; zero for originally inactive vertices; no posed displacement stored at install',
      examples: [32639, 32640, 47099, 47150, 12828, 18024].filter(id => id < c.count).map(id => ({ id, u: c.samples[id].u, v: c.samples[id].v, front: c.samples[id].front, depthMM: c.samples[id].depth * 1000, originalActive: !!c.active[id], protectedCore: !!core[id], freeExterior: freeIndex[id] >= 0, gain: gain[id] }))
    };
  }
  function redistribute(c, native, rec) {
    const rows = c.rows, count = rows.length, correction = new Float64Array(count), rhs = new Float64Array(count);
    const residual = new Float64Array(count), direction = new Float64Array(count), work = new Float64Array(count), z = new Float64Array(count);
    const min = new Float64Array(c.components).fill(Infinity), max = new Float64Array(c.components).fill(-Infinity);
    for (let i = 0; i < count; i++) {
      const row = rows[i], value = native[row.id], component = c.component[i];
      if (!Number.isFinite(value)) throw Error('Non-finite native source increment');
      min[component] = Math.min(min[component], value); max[component] = Math.max(max[component], value);
      for (const edge of row.neighbors) {
        const other = native[edge.id]; if (!Number.isFinite(other)) throw Error('Non-finite native boundary increment');
        rhs[i] += edge.weight * (other - value); min[component] = Math.min(min[component], other); max[component] = Math.max(max[component], other);
      }
    }
    function multiply(input, output) {
      for (let i = 0; i < count; i++) {
        let value = rows[i].diagonal * input[i];
        for (const edge of rows[i].neighbors) if (edge.free >= 0) value -= edge.weight * input[edge.free];
        output[i] = value;
      }
    }
    const inner = (a, b) => { let value = 0; for (let i = 0; i < count; i++) value += a[i] * b[i]; return value; };
    const rhsNorm = Math.sqrt(inner(rhs, rhs));
    function actualResidual() {
      multiply(correction, work); let maxMM = 0, norm2 = 0;
      for (let i = 0; i < count; i++) { residual[i] = rhs[i] - work[i]; maxMM = Math.max(maxMM, Math.abs(residual[i]) / rows[i].diagonal * 1000); norm2 += residual[i] * residual[i]; }
      return { maxResidualMM: maxMM, relativeResidual: rhsNorm > 0 ? Math.sqrt(norm2) / rhsNorm : Math.sqrt(norm2) };
    }
    let measure = actualResidual(), iterations = 0;
    const converged = () => Number.isFinite(measure.maxResidualMM) && Number.isFinite(measure.relativeResidual) && measure.maxResidualMM <= RESIDUAL_MM && measure.relativeResidual <= RELATIVE_RESIDUAL;
    for (let i = 0; i < count; i++) direction[i] = z[i] = residual[i] / rows[i].diagonal;
    let rz = inner(residual, z);
    while (!converged() && iterations < MAX_ITERATIONS) {
      multiply(direction, work); const denominator = inner(direction, work);
      if (!(denominator > 0) || !(rz > 0) || !Number.isFinite(denominator) || !Number.isFinite(rz)) throw Error('Positive graph solver lost finite definiteness');
      const alpha = rz / denominator;
      for (let i = 0; i < count; i++) { correction[i] += alpha * direction[i]; residual[i] -= alpha * work[i]; }
      iterations++;
      // Recompute the true residual every iteration; reported convergence never
      // relies only on the conjugate-gradient recurrence.
      measure = actualResidual();
      if (converged()) break;
      for (let i = 0; i < count; i++) z[i] = residual[i] / rows[i].diagonal;
      const next = inner(residual, z), beta = next / rz;
      for (let i = 0; i < count; i++) direction[i] = z[i] + beta * direction[i];
      rz = next;
    }
    let boundClampedVertices = 0, maximumPreClampBoundViolationMM = 0;
    for (let i = 0; i < count; i++) {
      const value = native[rows[i].id] + correction[i], component = c.component[i];
      if (!Number.isFinite(value)) throw Error('Non-finite solved exterior increment');
      const bounded = clamp(value, min[component], max[component]), violationMM = Math.abs(value - bounded) * 1000;
      maximumPreClampBoundViolationMM = Math.max(maximumPreClampBoundViolationMM, violationMM);
      // Only numerical roundoff may be bounded. A material maximum-principle
      // failure is an error, not a hidden artistic clamp.
      if (violationMM > RESIDUAL_MM) throw Error('Exterior increment exceeds the positive source bounds');
      if (value !== bounded) { correction[i] = bounded - native[rows[i].id]; boundClampedVertices++; }
    }
    measure = actualResidual();
    rec.linearSolve = { converged: converged(), iterations, ...measure, maximumIterations: MAX_ITERATIONS, maximumNormalizedResidualMM: RESIDUAL_MM,
      maximumRelativeResidual: RELATIVE_RESIDUAL, finite: true, positiveWeights: true, noOvershoot: true, boundClampedVertices, maximumPreClampBoundViolationMM,
      residualDefinition: 'max abs(A*correction-rhs)/diagonal in mm; relative Euclidean residual also required; both recomputed after bounds check' };
    if (!rec.linearSolve.converged) throw Error('Exterior graph solve did not reach the declared residual tolerances');
    return correction;
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
    if (!c.freeIds.length) { invalidate(c, 'No eligible exterior increment field exists for this native surface'); return report(); }
    c.wrapper = function (...args) {
      if (!c.enabled) return Reflect.apply(c.originalApply, this, args);
      if (this !== c.solver || c.running) throw Error('Unexpected corner solver call');
      const reason = invalidation(c, true); if (reason) { invalidate(c, reason); return Reflect.apply(c.originalApply, this, args); }
      const amount = c.structure.performance.settings.pucker;
      if (!Number.isFinite(amount) || amount < 0 || amount > 1) throw Error('Invalid native pucker input');
      const rec = { call: ++c.calls, completed: false, hooksRestored: false, pairMapCalls: 0, puckerInput: amount, puckerZeroBypass: amount === 0,
        coreDirectDeltaZero: true, contactDirectDeltaZero: true, centerDirectDeltaZero: true, directChangedVertices: 0, changedOriginallyActiveVertices: 0, maxDirectCorrectionMM: 0,
        coreVerticesCompared: 0, contactVerticesCompared: 0, centerVerticesCompared: 0, beforeLocalBaseMatchesEntry: null, linearSolve: null, allOriginalStagesExecuted: true };
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
          const coreBefore = selectedPositions(array, c.coreIds), contactBefore = selectedPositions(array, c.contactIds), centerBefore = selectedPositions(array, c.centerIds);
          rec.coreVerticesCompared = c.coreIds.length; rec.contactVerticesCompared = c.contactIds.length; rec.centerVerticesCompared = c.centerIds.length;
          const native = new Float64Array(c.count);
          for (const id of c.relevantIds) if (c.active[id]) native[id] = -.23 * amount * dot(sub(point(solver.base, id), f.center), f.x) * c.samples[id].weight;
          const correction = redistribute(c, native, rec);
          const examples = [];
          for (let i = 0; i < c.rows.length; i++) {
            const id = c.rows[i].id, delta = correction[i];
            if (!Number.isFinite(delta)) throw Error('Non-finite exterior increment correction');
            if (Math.abs(delta) < 1e-12) continue;
            const before = point(array, id);
            for (let k = 0; k < 3; k++) if (f.x[k] !== 0) array[id * 3 + k] += f.x[k] * delta;
            const actual = Math.hypot(...sub(point(array, id), before)) * 1000;
            if (actual > 0) { rec.directChangedVertices++; if (c.active[id]) rec.changedOriginallyActiveVertices++; rec.maxDirectCorrectionMM = Math.max(rec.maxDirectCorrectionMM, actual); }
            if ([32639, 32640, 47099, 47150, 12828, 18024].includes(id)) examples.push({ id, originalActive: !!c.active[id], nativePuckerXMM: native[id] * 1000, redistributedPuckerXMM: (native[id] + delta) * 1000, correctionXMM: delta * 1000, actualDistanceMM: actual });
          }
          rec.examples = examples;
          rec.coreDirectDeltaZero = selectedExact(array, c.coreIds, coreBefore); rec.contactDirectDeltaZero = selectedExact(array, c.contactIds, contactBefore); rec.centerDirectDeltaZero = selectedExact(array, c.centerIds, centerBefore);
          if (!rec.coreDirectDeltaZero || !rec.contactDirectDeltaZero || !rec.centerDirectDeltaZero) throw Error('A protected lip core, contact sample or central vertex changed directly');
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
      component: 'Only the native pucker mouth-frame x increment is redistributed on eligible exterior skin; every other native motion term remains unchanged', originalActiveVerticesProtected: false,
      protectedDomains: 'Native rail body, vermilion, rim, original contact samples and one-ring collar; center abs(native u)<=.64; oral and negative-v excluded', centerRule: 'abs(native u)<=.64',
      puckerZero: 'Direct original R05 evaluation without nested R06 hooks or position writes', poseUsedForInstall: false,
      canonicalPositionsChanged: false, topologyChanged: false, semanticFieldsChangedByModule: false, materialChanged: false, dnaWritten: false, newMeshes: 0,
      fullBiomechanics: false, visualAcceptance: false, productionReady: false,
      limitations: ['Four millimetres is an engineering smoothing length, not a physical tissue measurement or a hard support cutoff.',
        'The rail-body/core mask is a conservative construction from native fields, not measured tissue anatomy; downstream final contact equality still requires actual verification.',
        'The original closure, pressure, contact scope, forward/up motion and unverified volume compensation remain unchanged.',
        'Unsupported historical or custom material states disable this candidate without changing those states or their labels.'] });
  }
  window.__LIP_CORNER_SOLVER__ = Object.freeze({ version: VERSION, install, setEnabled, report, uninstall });
})();
