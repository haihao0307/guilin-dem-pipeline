/**
 * Non-destructive, source-curve length and density controls for the teacher groom.
 *
 * This editor does not synthesize a hairstyle or move a single ribbon vertex.
 * It selects complete, consecutive segments from each already-bound R8 curve.
 * Every drawn triangle is therefore an exact source triangle: shortening cannot
 * create a new chord through skin. Existing R8 contacts and radius limitations
 * remain; this is not a new global collision certificate.
 *
 * API:
 *   const editor = createTeacherGroomEditor(mesh, binding);
 *   editor.apply({style: 'original', length: 1, density: 1});
 *   // After binding.update() AND the application's refreshBoundGeometry():
 *   editor.updateSource(); // captures the new full source, reapplies controls
 *   editor.reset();        // exact current-pose source geometry and full index
 *   editor.diagnostics();
 *
 * Width/color remain in the existing renderer. No shader, material, head,
 * original guide, root binding, part island, or source random value is edited.
 * Length is relative to the selected trim preset; complete source segments
 * produce intentionally quantized cut positions, rather than unsafe resampling.
 */

export const TEACHER_GROOM_STYLES = Object.freeze({
  original: Object.freeze({label: '原老师长发', arcFraction: 1}),
  'chin-trim': Object.freeze({label: '原曲线中短裁切', arcFraction: .76}),
  'cropped-trim': Object.freeze({label: '原曲线短裁切', arcFraction: .56}),
});

const DEFAULTS = Object.freeze({style: 'original', length: 1, density: 1});
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const hashArrays = arrays => {
  let hash = 2166136261;
  for (const array of arrays) {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};
const densityKey = (index, seed) => {
  // Independent of strandRandom, strand radius, colors and the binding RNG.
  let value = (index ^ seed ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
};

/** Operates on the existing duplicated-vertex teacher ribbon geometry. */
export function createTeacherGroomEditor(mesh, binding) {
  const geometry = mesh?.geometry;
  if (!geometry?.getIndex?.() || !binding) throw new TypeError('Teacher editor requires an indexed teacher mesh and its binding');
  const count = binding.count, segments = binding.segments, per = segments + 1;
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(segments) || segments < 2)
    throw new RangeError('Teacher editor requires at least one strand and two source segments');
  const pointCount = count * per, protectedSegments = Math.min(2, segments);
  const originalIndex = geometry.getIndex();
  if (originalIndex.array.length !== count * segments * 6)
    throw new RangeError('Teacher editor requires the complete source draw index at construction');

  // Neither source index nor source arrays ever alias writable draw buffers.
  const sourceIndex = originalIndex.array.slice();
  const drawIndex = originalIndex.clone();
  const originalDrawRange = {...geometry.drawRange};
  for (let i = 0; i < count; i++) for (let j = 0; j < segments; j++) {
    const offset = (i * segments + j) * 6, a = (i * per + j) * 2;
    const expected = [a, a + 1, a + 2, a + 1, a + 3, a + 2];
    for (let k = 0; k < 6; k++) if (sourceIndex[offset + k] !== expected[k])
      throw new RangeError('Teacher editor requires contiguous original ribbon triangles');
  }
  geometry.setIndex(drawIndex);
  const rank = new Uint32Array(count);
  const seed = (binding.options?.seed ?? 724) >>> 0;
  const densityOrder = Array.from({length: count}, (_, i) => ({i, key: densityKey(i, seed)}));
  densityOrder.sort((a, b) => a.key - b.key || a.i - b.i);
  densityOrder.forEach(({i}, position) => { rank[i] = position; });

  let source = {}, sourceHashes = {}, sourceRevision = 0, options = {...DEFAULTS};
  let errors = [], activeCount = count, drawnSegments = count * segments;
  let effectiveFraction = 1, lastApplyMs = 0, lengthSummary = {};
  const arcLengths = new Float64Array(pointCount);
  const ends = new Uint16Array(count).fill(segments);
  let sourceRoots, rootHash, partingHash, bindingRootHash, partingArrays, rootArrays;

  function validateGeometry() {
    for (const [name, size] of [['position', 3], ['tangent', 3], ['scalpNormal', 3], ['strandSide', 1], ['along', 1], ['strandRandom', 1], ['strandRadius', 1]]) {
      const attribute = geometry.getAttribute(name);
      if (!attribute || attribute.itemSize !== size || attribute.count !== pointCount * 2)
        throw new RangeError('Unexpected teacher attribute layout: ' + name);
      for (const value of attribute.array) if (!Number.isFinite(value))
        throw new RangeError('Non-finite teacher source attribute: ' + name);
    }
  }

  function currentRoots() {
    const roots = new Float32Array(count * 6), positions = geometry.getAttribute('position').array;
    for (let i = 0; i < count; i++) roots.set(positions.subarray(i * per * 6, i * per * 6 + 6), i * 6);
    return roots;
  }

  function apply(patch = {}) {
    const started = performance.now();
    try {
      if (!patch || typeof patch !== 'object') throw new TypeError('Teacher editor options must be an object');
      const next = {...options};
      if (patch.style !== undefined) {
        if (!Object.hasOwn(TEACHER_GROOM_STYLES, patch.style)) throw new RangeError('Unknown source trim preset: ' + patch.style);
        next.style = patch.style;
      }
      for (const [name, low, high] of [['length', .45, 1], ['density', 0, 1]]) if (patch[name] !== undefined) {
        if (typeof patch[name] !== 'number' || !Number.isFinite(patch[name])) throw new RangeError(name + ' must be finite');
        next[name] = clamp(patch[name], low, high);
      }
      options = next;
      effectiveFraction = options.length * TEACHER_GROOM_STYLES[options.style].arcFraction;
      activeCount = Math.round(count * options.density);
      drawnSegments = 0;
      let cursor = 0, min = Infinity, max = 0, sum = 0, minRatio = Infinity, maxRatio = 0;
      for (let i = 0; i < count; i++) {
        const start = i * per, total = arcLengths[start + segments];
        const target = total * effectiveFraction;
        let end = segments;
        if (effectiveFraction < 1) {
          end = protectedSegments;
          while (end < segments && arcLengths[start + end + 1] <= target) end++;
        }
        ends[i] = end;
        if (rank[i] >= activeCount) continue;
        const drawLength = arcLengths[start + end], ratio = total > 0 ? drawLength / total : 1;
        min = Math.min(min, drawLength); max = Math.max(max, drawLength); sum += drawLength;
        minRatio = Math.min(minRatio, ratio); maxRatio = Math.max(maxRatio, ratio);
        const from = i * segments * 6, size = end * 6;
        drawIndex.array.set(sourceIndex.subarray(from, from + size), cursor);
        cursor += size; drawnSegments += end;
      }
      // Do not leave stale indices behind the draw range. Default reset is a
      // byte-exact full index copy, including its original drawRange contract.
      drawIndex.array.fill(0, cursor);
      const isDefault = options.style === 'original' && options.length === 1 && options.density === 1;
      geometry.setDrawRange(isDefault ? originalDrawRange.start : 0, isDefault ? originalDrawRange.count : cursor);
      drawIndex.needsUpdate = true;
      lengthSummary = {min: activeCount ? min : 0, max, mean: activeCount ? sum / activeCount : 0,
        minSourceRatio: activeCount ? minRatio : 0, maxSourceRatio: maxRatio};
      errors = [];
      lastApplyMs = performance.now() - started;
      return api;
    } catch (error) {
      errors = [error.message || String(error)];
      throw error;
    }
  }

  function updateSource() {
    validateGeometry();
    const next = {};
    for (const [name, attribute] of Object.entries(geometry.attributes)) next[name] = attribute.array.slice();
    source = next;
    sourceHashes = Object.fromEntries(Object.entries(source).map(([name, array]) => [name, hashArrays([array])]));
    sourceRoots = currentRoots(); rootHash = hashArrays([sourceRoots]);
    partingArrays = [binding.islands, binding.sourceGuideIds, binding.guideWeights].filter(Boolean);
    rootArrays = [binding.rootTriangles, binding.rootBarycentrics, binding.templateRoots].filter(Boolean);
    partingHash = hashArrays(partingArrays); bindingRootHash = hashArrays(rootArrays);
    const positions = source.position;
    for (let i = 0; i < count; i++) {
      const start = i * per; arcLengths[start] = 0;
      for (let j = 1; j < per; j++) {
        const a = (start + j - 1) * 6, b = a + 6;
        arcLengths[start + j] = arcLengths[start + j - 1] + Math.hypot(
          positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]);
      }
    }
    sourceRevision++;
    return apply();
  }

  function reset() {
    // Normally attribute copies are unnecessary because apply is index-only.
    // Restoring the captured source also makes reset resilient to caller edits.
    for (const [name, array] of Object.entries(source)) {
      geometry.getAttribute(name).array.set(array);
      geometry.getAttribute(name).needsUpdate = true;
    }
    return apply(DEFAULTS);
  }

  function diagnostics() {
    const currentHash = hashArrays([currentRoots()]);
    const attributesExact = Object.entries(source).every(([name, array]) => hashArrays([geometry.getAttribute(name).array]) === sourceHashes[name]);
    const partingPreserved = hashArrays(partingArrays) === partingHash;
    const rootBindingsPreserved = hashArrays(rootArrays) === bindingRootHash;
    return {
      schema: 'teacher-groom-editor-v1', method: 'complete-source-segment-prefix',
      sourceRevision, style: options.style, length: options.length, density: options.density,
      effectiveArcFraction: effectiveFraction, count, activeStrands: activeCount,
      sourceSegments: count * segments, drawnSegments, drawnTriangles: drawnSegments * 2,
      drawIndexCount: drawnSegments * 6,
      drawIndexHash: hashArrays([drawIndex.array.subarray(0, drawnSegments * 6)]),
      protectedRootSegments: protectedSegments, sourceHash: sourceHashes.position,
      sourceAttributeHashes: {...sourceHashes}, sourceIndexHash: hashArrays([sourceIndex]),
      sourceRootHash: rootHash, rootHash: currentHash, sourcePartingHash: partingHash,
      sourceBindingRootHash: bindingRootHash, rootsExact: currentHash === rootHash,
      attributesExact, rootBindingsPreserved, partingPreserved,
      sourceGuideIdsPreserved: partingPreserved, sourceVerticesMoved: 0,
      newSegmentsCreated: 0, addedTriangleCount: 0,
      lengthSummary: {...lengthSummary}, lastApplyMs, errors: [...errors],
      limitation: 'Source-curve cuts, not newly authored bob grooms; existing R8 collision/radius limits are unchanged. Cut tips keep original radii. Width changes are outside this index-only guarantee.',
    };
  }

  const api = {
    apply, updateSource, reset, diagnostics,
    get options() { return {...options}; },
    get activeStrands() { return activeCount; },
    get strandEndSegments() { return ends.slice(); },
    get activeStrandIds() { return Uint32Array.from(densityOrder.slice(0, activeCount), item => item.i); },
  };
  updateSource();
  return api;
}
