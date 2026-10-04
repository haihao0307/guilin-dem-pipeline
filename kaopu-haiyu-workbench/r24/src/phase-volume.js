/*
 * Haiyu 06/07: auditable source-conditioned volumetric study, revision 1.
 * This is an inferred mathematical closure, not recovered biological anatomy.
 *
 * Source cloud: exact original x/y expressions, and z=q*cos(d-t). At fixed d,
 * this lift has rank ONE in q; varying d makes a ruled sheet, not a solid.
 * The separate shell fits local XZ distributions in monotonically increasing
 * world-Y slices. Quantile directional supports give asymmetric convex local
 * envelopes. A disclosed width-relative support floor closes thin directions.
 * No original point is moved, filtered, duplicated, or replaced by the shell.
 *
 * Shell rings all share angular directions. Between rings, every triangle
 * remains in its angular wedge about the interpolated center. Consequently a
 * disk of radius min(adjacent radial samples)*cos(pi/angularSamples) remains
 * inside each transverse section. The finite spine tube uses only 20% of this
 * conservative clearance, and avoids shell tips. Strict monotone Y prevents
 * nonadjacent slices from folding through one another.
 *
 * Browser: window.HaiyuPhaseVolume. Node: require('./phase-volume.js').
 * evaluate(6|7|'06'|'07', positiveIntegerFrame, options) returns typed geometry
 * packets, plus rings [{y,center:[x,y,z],points:[[x,y,z],...],radii:[...]}].
 * Positions use (originalX-200, 200-originalY, quadratureZ). Cloud is Float64;
 * render mesh positions/normals are Float32; triangle/line indices are Uint32.
 * contains()/clearance() inspect the actual triangulated shell, not an ellipse.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HaiyuPhaseVolume = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2, N = 20000;
  const sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt;
  const clocks = {6: [0], 7: [0]};
  const defaults = Object.freeze({
    longitudinalSections: 64, angularSamples: 48, supportQuantile: 0.95,
    sliceBandwidth: 1.75, fitSampleLimit: 256, minimumThicknessRatio: 0.12,
    axisSmoothingPasses: 3, radialSmoothingPasses: 2,
    spineFraction: 0.20, spineSides: 16, depth: 1
  });
  function sourceId(value) {
    const id = Number(String(value).replace(/^source/, ''));
    if (id !== 6 && id !== 7) throw new RangeError('Only original sources 06 and 07 are implemented.');
    return id;
  }
  function frameTime(value, frame) {
    const id = sourceId(value);
    if (!Number.isInteger(frame) || frame < 1 || frame > 100000) throw new RangeError('frame must be an integer from 1 to 100000');
    const times = clocks[id], step = Math.PI / (id === 6 ? 120 : 480);
    // Repeated addition matches the original draw loop, including rounding.
    while (times.length <= frame) times.push(times[times.length - 1] + step);
    return times[frame];
  }
  function sourcePoint(value, i, time) {
    return pointForSource(sourceId(value), i, time);
  }
  function pointForSource(id, i, time) {
    const u = i / 885;
    const k = ((id === 6 ? 6 : 5) + 3 * sin(u + 4)) * cos(i / 7);
    const e = u / 5 - (id === 6 ? 13 : 9);
    // p5.mag's sqrt expression is intentionally retained for exact XY parity.
    const d = sqrt(k * k + e * e) - (id === 6 ? 6.6 : 2.8) + (id === 7 ? sin(time * 3 - k * k / 8) : 0);
    const q = 3 * sin(k * 2) + k * u / 25 * (9 + 2 * sin(e * 6 - d * 5 + time * (id === 6 ? 2 : 6)));
    const c = d - time;
    return {x: q + 30 * cos(c) + 200, y: q * sin(c) + d * 39, z: q * cos(c), q, d, c, k, e, u};
  }
  function pick(a, k) {
    let left = 0, right = a.length - 1;
    while (left < right) {
      const pivot = a[(left + right) >> 1];
      let i = left, j = right;
      while (i <= j) {
        while (a[i] < pivot) i++;
        while (a[j] > pivot) j--;
        if (i <= j) { const t = a[i]; a[i++] = a[j]; a[j--] = t; }
      }
      if (k <= j) right = j;
      else if (k >= i) left = i;
      else break;
    }
    return a[k];
  }
  function quantile(values, p) {
    if (!values.length) return 0;
    return pick(values, Math.max(0, Math.min(values.length - 1, Math.round((values.length - 1) * p))));
  }
  function smoothScalars(values, passes, fixedEnds) {
    let v = values.slice();
    for (let pass = 0; pass < passes; pass++) {
      const next = v.slice();
      for (let i = 1; i < v.length - 1; i++) next[i] = (v[i - 1] + 2 * v[i] + v[i + 1]) / 4;
      if (!fixedEnds && v.length > 1) { next[0] = (3 * v[0] + v[1]) / 4; next[v.length - 1] = (3 * v[v.length - 1] + v[v.length - 2]) / 4; }
      v = next;
    }
    return v;
  }
  function meshPacket(positions, indices) {
    const p = new Float32Array(positions), ix = new Uint32Array(indices), normals = new Float32Array(p.length);
    for (let i = 0; i < ix.length; i += 3) {
      const a = ix[i] * 3, b = ix[i + 1] * 3, c = ix[i + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const j of [a, b, c]) { normals[j] += nx; normals[j + 1] += ny; normals[j + 2] += nz; }
    }
    for (let i = 0; i < normals.length; i += 3) {
      const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
      normals[i] /= l; normals[i + 1] /= l; normals[i + 2] /= l;
    }
    return {positions: p, indices: ix, normals};
  }
  function buildShell(rings, m) {
    const p = [], ix = [];
    p.push(...rings[0].center);
    for (let j = 1; j < rings.length - 1; j++) for (const point of rings[j].points) p.push(...point);
    const end = p.length / 3; p.push(...rings[rings.length - 1].center);
    for (let k = 0; k < m; k++) ix.push(0, 1 + k, 1 + (k + 1) % m);
    for (let j = 1; j < rings.length - 2; j++) for (let k = 0; k < m; k++) {
      const a = 1 + (j - 1) * m + k, b = 1 + (j - 1) * m + (k + 1) % m;
      const c = a + m, d = b + m;
      ix.push(a, c, b, b, c, d);
    }
    for (let k = 0; k < m; k++) ix.push(end - m + k, end, end - m + (k + 1) % m);
    return meshPacket(p, ix);
  }
  function buildSpine(rings, options) {
    const p = [], ix = [], centers = [], radii = [], m = options.spineSides;
    // Leave two full sections between the finite tube and either shell tip.
    for (let j = 2; j < rings.length - 2; j++) {
      const ring = rings[j], local = Math.min(rings[j - 1].clearanceBound, ring.clearanceBound, rings[j + 1].clearanceBound);
      const radius = options.spineFraction * local;
      centers.push(ring.center.slice()); radii.push(radius);
      for (let k = 0; k < m; k++) p.push(ring.center[0] + radius * cos(TAU * k / m), ring.y, ring.center[2] + radius * sin(TAU * k / m));
    }
    const count = centers.length;
    for (let j = 0; j < count - 1; j++) for (let k = 0; k < m; k++) {
      const a = j * m + k, b = j * m + (k + 1) % m, c = a + m, d = b + m;
      ix.push(a, c, b, b, c, d);
    }
    const start = p.length / 3; p.push(...centers[0]);
    const end = p.length / 3; p.push(...centers[count - 1]);
    for (let k = 0; k < m; k++) {
      ix.push(start, k, (k + 1) % m);
      ix.push((count - 1) * m + k, end, (count - 1) * m + (k + 1) % m);
    }
    return Object.assign(meshPacket(p, ix), {centers, radii: new Float64Array(radii), color: '#ff779e', firstShellRing: 2});
  }
  function optionsFor(given) {
    const o = Object.assign({}, defaults, given || {});
    for (const [key, lo, hi] of [['longitudinalSections', 12, 128], ['angularSamples', 16, 96], ['fitSampleLimit', 64, 1024], ['spineSides', 8, 32], ['axisSmoothingPasses', 0, 8], ['radialSmoothingPasses', 0, 8]]) {
      if (!Number.isInteger(o[key]) || o[key] < lo || o[key] > hi) throw new RangeError(key + ' outside bounded range ' + lo + '..' + hi);
    }
    for (const [key, lo, hi] of [['supportQuantile', 0.75, 0.99], ['sliceBandwidth', 0.75, 4], ['minimumThicknessRatio', 0.01, 0.35], ['spineFraction', 0.01, 0.45], ['depth', 0.05, 4]]) {
      if (!Number.isFinite(o[key]) || o[key] < lo || o[key] > hi) throw new RangeError(key + ' outside bounded range ' + lo + '..' + hi);
    }
    return o;
  }
  function evaluate(value, frame, given) {
    const source = sourceId(value), time = frameTime(source, frame), options = optionsFor(given);
    const positions = new Float64Array(N * 3), sourceIndices = new Uint32Array(N);
    const q = new Float64Array(N), d = new Float64Array(N), c = new Float64Array(N);
    const originalXY = new Float64Array(N * 2);
    const sorted = new Array(N);
    for (let j = 0; j < N; j++) {
      const i = N - 1 - j, a = pointForSource(source, i, time);
      sourceIndices[j] = i; sorted[j] = j;
      positions[3 * j] = a.x - 200; positions[3 * j + 1] = 200 - a.y; positions[3 * j + 2] = a.z;
      originalXY[2 * j] = a.x; originalXY[2 * j + 1] = a.y;
      q[j] = a.q; d[j] = a.d; c[j] = a.c;
    }
    sorted.sort((a, b) => positions[3 * a + 1] - positions[3 * b + 1]);
    const first = sorted[0], last = sorted[N - 1], low = positions[3 * first + 1], high = positions[3 * last + 1];
    const n = options.longitudinalSections, m = options.angularSamples, step = (high - low) / (n + 1);
    const angleCos = [], angleSin = [];
    for (let k = 0; k < m; k++) { angleCos.push(cos(TAU * k / m)); angleSin.push(sin(TAU * k / m)); }
    const samples = [], rawX = [], rawZ = [], ys = [];
    let left = 0, right = 0;
    for (let j = 0; j < n; j++) {
      const y = low + step * (j + 1), half = step * options.sliceBandwidth;
      while (left < N && positions[3 * sorted[left] + 1] < y - half) left++;
      if (right < left) right = left;
      while (right < N && positions[3 * sorted[right] + 1] <= y + half) right++;
      const count = right - left, take = Math.min(count, options.fitSampleLimit), ids = [], xs = [], zs = [];
      for (let k = 0; k < take; k++) {
        const id = sorted[left + Math.min(count - 1, Math.floor((k + 0.5) * count / take))];
        ids.push(id); xs.push(positions[3 * id]); zs.push(positions[3 * id + 2]);
      }
      if (!take) throw new Error('Empty source slice; increase sliceBandwidth.');
      samples.push({ids, population: count}); rawX.push(quantile(xs, 0.5)); rawZ.push(quantile(zs, 0.5)); ys.push(y);
    }
    const axisX = smoothScalars(rawX, options.axisSmoothingPasses, false), axisZ = smoothScalars(rawZ, options.axisSmoothingPasses, false);
    const radial = [], floors = [], sampleAreas = [];
    for (let j = 0; j < n; j++) {
      const ids = samples[j].ids, dx = [], dz = [], lengths = [];
      for (const id of ids) { const x = positions[3 * id] - axisX[j], z = positions[3 * id + 2] - axisZ[j]; dx.push(x); dz.push(z); lengths.push(Math.hypot(x, z)); }
      const robustRadius = quantile(lengths, 0.9), floor = Math.max(1e-5, options.minimumThicknessRatio * robustRadius);
      floors.push(floor);
      const supports = [], projection = new Float64Array(ids.length);
      for (let k = 0; k < m; k++) {
        for (let a = 0; a < ids.length; a++) projection[a] = dx[a] * angleCos[k] + dz[a] * angleSin[k];
        supports.push(Math.max(floor, quantile(projection, options.supportQuantile)));
      }
      const r = [];
      for (let k = 0; k < m; k++) {
        let radius = Infinity;
        for (let a = 0; a < m; a++) {
          const dot = angleCos[k] * angleCos[a] + angleSin[k] * angleSin[a];
          if (dot > 1e-9) radius = Math.min(radius, supports[a] / dot);
        }
        r.push(radius);
      }
      // Angular averaging only rounds measured corners, with no invented waves.
      const rounded = r.map((v, k) => (r[(k + m - 1) % m] + 2 * v + r[(k + 1) % m]) / 4);
      radial.push(rounded);
      let area = 0; for (let k = 0; k < m; k++) area += rounded[k] * rounded[(k + 1) % m] * sin(TAU / m) / 2;
      sampleAreas.push(area);
    }
    for (let k = 0; k < m; k++) {
      const v = smoothScalars(radial.map(r => r[k]), options.radialSmoothingPasses, false);
      for (let j = 0; j < n; j++) radial[j][k] = Math.max(floors[j], v[j]);
    }
    const endpoint = id => { const center = Array.from(positions.slice(id * 3, id * 3 + 3)); return {y: center[1], center, points: Array.from({length: m}, () => center.slice()), radii: Array(m).fill(0), clearanceBound: 0, sourcePopulation: 1, fitSampleCount: 1, thicknessFloor: 0}; };
    const rings = [endpoint(first)];
    for (let j = 0; j < n; j++) {
      const center = [axisX[j], ys[j], axisZ[j]], radii = radial[j];
      rings.push({y: ys[j], center, points: radii.map((r, k) => [center[0] + r * angleCos[k], ys[j], center[2] + r * angleSin[k]]), radii,
        clearanceBound: Math.min(...radii) * cos(Math.PI / m), sourcePopulation: samples[j].population, fitSampleCount: samples[j].ids.length, thicknessFloor: floors[j]});
    }
    rings.push(endpoint(last));
    const shell = buildShell(rings, m), spine = buildSpine(rings, options);
    const sectionPositions = [], sectionIndices = [];
    for (let j = 1; j < rings.length - 1; j++) for (let k = 0; k < m; k++) {
      const index = sectionPositions.length / 3; sectionPositions.push(...rings[j].points[k]);
      sectionIndices.push(index, (j - 1) * m + (k + 1) % m);
    }
    const axis = rings.slice(1, -1).map(r => r.center.slice());
    let axisLength = 0;
    for (let j = 1; j < axis.length; j++) axisLength += Math.hypot(...axis[j].map((v, k) => v - axis[j - 1][k]));
    const axisChord = Math.hypot(...axis[axis.length - 1].map((v, k) => v - axis[0][k]));
    const result = {
      source, frame, time, options, cloud: {positions, originalXY, sourceIndices, parameters: {q, d, c}}, shell, spine,
      sections: {positions: new Float32Array(sectionPositions), indices: new Uint32Array(sectionIndices)}, rings, axis,
      stats: {cloudCount: N, fixedDSectionRank: 1, originalLiftParameterDimensions: 2, shellVertexCount: shell.positions.length / 3,
        shellTriangleCount: shell.indices.length / 3, fittedSections: n, angularSamples: m, yRange: [low, high],
        minimumThicknessRatio: options.minimumThicknessRatio, thicknessFloorRange: [Math.min(...floors), Math.max(...floors)],
        minimumRingClearanceBound: Math.min(...rings.slice(1, -1).map(r => r.clearanceBound)), spineRadiusRange: [Math.min(...spine.radii), Math.max(...spine.radii)],
        spineClearanceLowerBound: Math.min(...spine.radii) * (1 / options.spineFraction - 1), axisLength, axisChord, axisLengthRatio: axisLength / axisChord,
        unsmoothedSectionAreaRange: [Math.min(...sampleAreas), Math.max(...sampleAreas)], shellCoverage: 'robust core only; not guaranteed to enclose all original points', supportQuantile: options.supportQuantile},
      assumptions: [
        'The original 20,000-point cloud is retained exactly, in original descending-i order; its XY projection is untouched.',
        'Quadrature depth z=q*cos(c) is an inferred phase lift. Fixed-d points lie on a line; the lift alone is a sheet.',
        'World-Y slices are a chosen nonfolding learning coordinate, not a recovered anatomical axis.',
        'Local centers are smoothed coordinate medians; no source branch is identified as a species or an organ.',
        options.supportQuantile + ' directional quantiles form a robust convex core before mild angular/longitudinal smoothing; outlying branches remain in the full cloud.',
        'Fitting uses at most ' + options.fitSampleLimit + ' deterministic equal-rank samples per slice, from the full Y-sorted source field.',
        'Missing support is floored at ' + options.minimumThicknessRatio + ' times each slice\'s 90th-percentile source radius; this is explicit inferred thickness.',
        'The solid is star-shaped in each monotone-Y section; extreme actual source points cap the two ends.',
        'The colored spine is a finite tube around the learned internal axis, restricted to ' + options.spineFraction + ' of a conservative local clearance bound.'
      ]
    };
    // One invertible affine transform is applied to every packet. It cannot
    // change XY relations, turn an interior point into an exterior point, or
    // introduce self-intersections. depth=0 is intentionally disallowed.
    const depth = options.depth, minorScale = Math.min(1, depth);
    spine.radiiX = new Float64Array(spine.radii);
    spine.radiiZ = new Float64Array(Array.from(spine.radii, r => r * depth));
    if (depth !== 1) {
      const scalePositions = p => { for (let i = 2; i < p.length; i += 3) p[i] *= depth; };
      scalePositions(positions); scalePositions(result.sections.positions);
      for (const name of ['shell', 'spine']) {
        scalePositions(result[name].positions);
        const updated = meshPacket(result[name].positions, result[name].indices);
        result[name].normals = updated.normals;
      }
      for (const ring of rings) {
        ring.center[2] *= depth;
        for (const p of ring.points) p[2] *= depth;
        ring.radii = ring.points.map(p => Math.hypot(p[0] - ring.center[0], p[2] - ring.center[2]));
        ring.clearanceBound *= minorScale;
      }
      for (const p of axis) p[2] *= depth;
      for (const p of spine.centers) p[2] *= depth;
    }
    result.stats.depthScale = depth;
    result.stats.depthIsInvertible = depth > 0;
    result.stats.xyProjectionPreserved = true;
    result.stats.axisLengthBeforeDepth = result.stats.axisLength;
    result.stats.axisChordBeforeDepth = result.stats.axisChord;
    result.stats.axisLength = axis.slice(1).reduce((sum, p, j) => sum + Math.hypot(...p.map((v, k) => v - axis[j][k])), 0);
    result.stats.axisChord = Math.hypot(...axis[axis.length - 1].map((v, k) => v - axis[0][k]));
    result.stats.axisLengthRatio = result.stats.axisLength / result.stats.axisChord;
    result.stats.minimumRingClearanceBound *= minorScale;
    result.stats.spineClearanceLowerBound *= minorScale;
    result.stats.spineTransverseClearanceLowerBound = result.stats.spineClearanceLowerBound;
    result.stats.spineDepthRadiusRange = result.stats.spineRadiusRange.map(r => r * depth);
    result.stats.thicknessFloorBeforeDepthRange = result.stats.thicknessFloorRange.slice();
    result.stats.thicknessFloorZRange = result.stats.thicknessFloorRange.map(r => r * depth);
    result.assumptions.push('Depth scale ' + depth + ' is applied uniformly to every Z coordinate after fitting. Zero depth is disallowed because it would collapse the solid. Reported clearance is transverse to world Y.');
    return result;
  }
  function sectionPolygon(volume, y) {
    const rings = volume.rings;
    if (y < rings[0].y || y > rings[rings.length - 1].y) return null;
    let lo = 0, hi = rings.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rings[mid].y <= y) lo = mid; else hi = mid; }
    const a = rings[lo], b = rings[hi], t = (y - a.y) / (b.y - a.y), m = a.points.length, poly = [];
    for (let k = 0; k < m; k++) {
      const p = a.points[k], q = b.points[k], r = a.points[(k + 1) % m];
      poly.push([p[0] * (1 - t) + q[0] * t, p[2] * (1 - t) + q[2] * t]);
      // Actual mesh diagonal b(lower,next)→c(upper,current), not a bilinear shortcut.
      poly.push([r[0] * (1 - t) + q[0] * t, r[2] * (1 - t) + q[2] * t]);
    }
    return poly;
  }
  function clearance(volume, point) {
    const poly = sectionPolygon(volume, point[1]);
    if (!poly) return -Infinity;
    const x = point[0], z = point[2]; let inside = false, distance = Infinity;
    for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
      const a = poly[k], b = poly[j], dx = b[0] - a[0], dz = b[1] - a[1], sq = dx * dx + dz * dz;
      const t = sq ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / sq)) : 0;
      distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside ? distance : -distance;
  }
  function contains(volume, point, margin) { return clearance(volume, point) >= (margin || 0); }
  function validate(volume, thorough) {
    const errors = [], finite = a => Array.from(a).every(Number.isFinite);
    for (const name of ['cloud', 'shell', 'spine', 'sections']) if (!finite(volume[name].positions)) errors.push(name + ' has nonfinite vertices');
    if (volume.cloud.positions.length !== N * 3) errors.push('source point count changed');
    for (let j = 1; j < volume.rings.length; j++) if (!(volume.rings[j].y > volume.rings[j - 1].y)) errors.push('longitudinal fold');
    for (const name of ['shell', 'spine']) {
      const mesh = volume[name], edges = new Map();
      for (let k = 0; k < mesh.indices.length; k += 3) for (let e = 0; e < 3; e++) {
        const a = mesh.indices[k + e], b = mesh.indices[k + (e + 1) % 3], key = Math.min(a, b) + ':' + Math.max(a, b);
        if (a >= mesh.positions.length / 3 || b >= mesh.positions.length / 3) errors.push(name + ' index outside vertex array');
        const old = edges.get(key) || [0, 0]; old[0]++; old[1] += a < b ? 1 : -1; edges.set(key, old);
      }
      for (const [key, counts] of edges) if (counts[0] !== 2 || counts[1] !== 0) { errors.push(name + ' is not an oriented closed manifold at ' + key); break; }
    }
    let minimumMeasuredSpineClearance = Infinity;
    for (let j = 0; j < volume.spine.centers.length; j++) {
      const center = volume.spine.centers[j], rx = volume.spine.radiiX[j], rz = volume.spine.radiiZ[j];
      let free = Infinity;
      for (let k = 0; k < volume.options.spineSides; k++) free = Math.min(free, clearance(volume, [center[0] + rx * cos(TAU * k / volume.options.spineSides), center[1], center[2] + rz * sin(TAU * k / volume.options.spineSides)]));
      minimumMeasuredSpineClearance = Math.min(minimumMeasuredSpineClearance, free);
      if (!(free > 0)) errors.push('spine ring not strictly internal at ' + j);
    }
    if (thorough) {
      const mesh = volume.spine;
      for (let k = 0; k < mesh.positions.length; k += 3) if (!contains(volume, [mesh.positions[k], mesh.positions[k + 1], mesh.positions[k + 2]])) { errors.push('spine vertex outside shell'); break; }
      for (let k = 0; k < mesh.indices.length; k += 3) {
        const a = mesh.indices[k] * 3, b = mesh.indices[k + 1] * 3, c = mesh.indices[k + 2] * 3;
        const centroid = [0, 1, 2].map(i => (mesh.positions[a + i] + mesh.positions[b + i] + mesh.positions[c + i]) / 3);
        if (!contains(volume, centroid)) { errors.push('spine triangle interior outside shell'); break; }
      }
      for (let j = 0; j < N; j++) {
        const a = sourcePoint(volume.source, volume.cloud.sourceIndices[j], volume.time);
        if (a.x !== volume.cloud.originalXY[j * 2] || a.y !== volume.cloud.originalXY[j * 2 + 1] || a.x - 200 !== volume.cloud.positions[j * 3] || 200 - a.y !== volume.cloud.positions[j * 3 + 1]) { errors.push('source XY changed'); break; }
      }
    }
    return {ok: errors.length === 0, errors, minimumMeasuredSpineClearance, shellClosed: !errors.some(e => e.startsWith('shell ')), spineClosed: !errors.some(e => e.startsWith('spine is'))};
  }
  function selfTest() {
    const cases = [];
    for (const source of [6, 7]) for (const frame of [1, 120, 240, 480]) {
      const volume = evaluate(source, frame), result = validate(volume, true);
      cases.push({source, frame, ...result});
    }
    return {ok: cases.every(c => c.ok), cases};
  }
  return Object.freeze({version: 'r24-volume-1', defaults, sourcePoint, frameTime, evaluate, sectionPolygon, clearance, contains, validate, selfTest});
});
