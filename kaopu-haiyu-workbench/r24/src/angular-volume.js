/*
 * Haiyu source04/05: source-driven angular volume learning candidate.
 * Original XY/q/d/c and all 20,000 descending source points remain untouched.
 * Added quadrature Z, robust local q/Z closure and Z-only arches are explicit
 * hypotheses, not recovered anatomy or a unique 3D solution.
 * Browser: window.HaiyuAngularVolume. Node: require('./angular-volume.js').
 * Packet API matches phase-volume.js; radial rings additionally expose c, q,
 * localPoints=[q,z]. sectionPolygon(volume,c) is in the radial q/Z plane and
 * intersects the actual Cartesian Float32 shell, including mesh diagonals.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.HaiyuAngularVolume = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TAU = Math.PI * 2, N = 20000;
  const sin = Math.sin, cos = Math.cos, sqrt = Math.sqrt;
  const clocks = {4: [0], 5: [0]};
  const defaults = Object.freeze({
    longitudinalSections: 64, angularSamples: 48, supportQuantile: 0.95,
    sliceBandwidth: 1.75, fitSampleLimit: 256, minimumThicknessRatio: 0.30,
    axisSmoothingPasses: 3, radialSmoothingPasses: 2,
    spineFraction: 0.20, spineSides: 16, depth: 1, archedThicknessRatio: 0.65
  });
  function sourceId(value) {
    const id = Number(String(value).replace(/^source/, ''));
    if (id !== 4 && id !== 5) throw new RangeError('Only original sources 04 and 05 are implemented.');
    return id;
  }
  function frameTime(value, frame) {
    const id = sourceId(value);
    if (!Number.isInteger(frame) || frame < 1 || frame > 100000) throw new RangeError('frame must be an integer from 1 to 100000');
    const times = clocks[id], step = Math.PI / 30;
    // Repeated addition matches the original draw loop, including rounding.
    while (times.length <= frame) times.push(times[times.length - 1] + step);
    return times[frame];
  }
  function sourcePoint(value, i, time) {
    return pointForSource(sourceId(value), i, time);
  }
  function pointForSource(id, i, time) {
    const u = i / 598, A = 5 + sin(u), k = A * cos(i / 7), e = u / 5 - 11;
    const d = sqrt(k * k + e * e) / .6 - 6;
    // Preserve the exact source operation order, including the 200px translation.
    const branch = 3 * sin(e) + e * sin(e * 2) + sin(d * 4);
    const q = 99 + d * sin(time - d) + u / 23 * k * branch;
    const c = d / 4 - time / 8 + (id === 5 ? cos(time + e) / 9 : 0);
    const z = d * cos(time - d) + (u / 23 * branch) * A * sin(i / 7);
    return {x: q * sin(c) + 200, y: q * cos(c) + 200, z, q, d, c, k, e, u};
  }
  function radialPoint(q, c, z) { return [q * sin(c), -q * cos(c), z]; }
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
  function convexXZ(points) {
    const sorted = points.map(p => [p[0], p[2]]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const lower = [], upper = [];
    for (const p of sorted) { while (lower.length > 1 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
    for (let j = sorted.length - 1; j >= 0; j--) { const p = sorted[j]; while (upper.length > 1 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
    lower.pop(); upper.pop(); return lower.concat(upper);
  }
  function verticalBounds(hull, x) {
    let low = Infinity, high = -Infinity;
    for (let k = 0; k < hull.length; k++) {
      const a = hull[k], b = hull[(k + 1) % hull.length];
      if (x < Math.min(a[0], b[0]) - 1e-8 || x > Math.max(a[0], b[0]) + 1e-8) continue;
      if (Math.abs(a[0] - b[0]) < 1e-10) { low = Math.min(low, a[1], b[1]); high = Math.max(high, a[1], b[1]); }
      else { const t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0]))), z = a[1] * (1 - t) + b[1] * t; low = Math.min(low, z); high = Math.max(high, z); }
    }
    return [low, high];
  }
  function polygonClearance(poly, point) {
    const x = point[0], z = point[1]; let inside = false, distance = Infinity;
    for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
      const a = poly[k], b = poly[j], dx = b[0] - a[0], dz = b[1] - a[1], sq = dx * dx + dz * dz;
      const t = sq ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / sq)) : 0;
      distance = Math.min(distance, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside ? distance : -distance;
  }
  function archSections(rings, options) {
    const bodies = rings.slice(1, -1), hulls = bodies.map(r => convexXZ(r.localPoints.map(p => [p[0], 0, p[1]])));
    const ranges = hulls.map(h => [Math.min(...h.map(p => p[0])), Math.max(...h.map(p => p[0]))]);
    const heights = smoothScalars(ranges.map(r => (r[1] - r[0]) / 2 * options.archedThicknessRatio), 2, false);
    for (let j = 0; j < bodies.length; j++) {
      const ring = bodies[j], hull = hulls[j], [left, right] = ranges[j], mid = (left + right) / 2, half = (right - left) / 2, m = ring.points.length;
      ring.preArchLocalPoints = ring.localPoints.map(p => p.slice()); ring.preArchQRange = [left, right]; ring.archHeight = heights[j]; ring.preArchPoints = ring.points.map(p => p.slice());
      ring.localPoints = Array.from({length: m}, (_, k) => {
        const theta = TAU * k / m, u = cos(theta), q = mid + half * u;
        const bounds = verticalBounds(hull, q), arch = heights[j] * sqrt(Math.max(0, 1 - u * u));
        return [q, sin(theta) >= 0 ? bounds[1] + arch : bounds[0] - arch];
      });
      ring.points = ring.localPoints.map(p => radialPoint(p[0], ring.c, p[1]));
      ring.radii = ring.localPoints.map(p => Math.hypot(p[0] - ring.q, p[1] - ring.center[2]));
      ring.clearanceBound = polygonClearance(ring.localPoints, [ring.q, ring.center[2]]);
      if (!(ring.clearanceBound > 0)) throw new Error('Source median axis escaped arched section ' + j);
      ring.transverseClearance = ring.clearanceBound;
    }
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function pointSegmentSq(p, a, b) {
    const ab = sub(b, a), ap = sub(p, a), len = dot3(ab, ab), t = len ? clamp01(dot3(ap, ab) / len) : 0;
    return (ap[0] - t * ab[0]) ** 2 + (ap[1] - t * ab[1]) ** 2 + (ap[2] - t * ab[2]) ** 2;
  }
  function inTriangle(p, a, b, c) {
    const u = sub(b, a), v = sub(c, a), w = sub(p, a), uu = dot3(u, u), uv = dot3(u, v), vv = dot3(v, v), wu = dot3(w, u), wv = dot3(w, v), den = uu * vv - uv * uv;
    if (Math.abs(den) < 1e-15) return false;
    const s = (vv * wu - uv * wv) / den, t = (uu * wv - uv * wu) / den;
    return s >= -1e-10 && t >= -1e-10 && s + t <= 1 + 1e-10;
  }
  function pointTriangleSq(p, a, b, c) {
    const normal = cross3(sub(b, a), sub(c, a)), nn = dot3(normal, normal), delta = dot3(sub(p, a), normal);
    if (nn > 1e-15) {
      const projection = p.map((v, i) => v - normal[i] * delta / nn);
      if (inTriangle(projection, a, b, c)) return delta * delta / nn;
    }
    return Math.min(pointSegmentSq(p, a, b), pointSegmentSq(p, b, c), pointSegmentSq(p, c, a));
  }
  function segmentSegmentSq(p, q, a, b) {
    const u = sub(q, p), v = sub(b, a), w = sub(p, a), aa = dot3(u, u), bb = dot3(u, v), cc = dot3(v, v), dd = dot3(u, w), ee = dot3(v, w), den = aa * cc - bb * bb;
    if (aa < 1e-15) return pointSegmentSq(p, a, b);
    if (cc < 1e-15) return pointSegmentSq(a, p, q);
    let s = den > 1e-15 ? clamp01((bb * ee - cc * dd) / den) : 0;
    let t = (bb * s + ee) / cc;
    if (t < 0) { t = 0; s = clamp01(-dd / aa); }
    else if (t > 1) { t = 1; s = clamp01((bb - dd) / aa); }
    return w.reduce((sum, value, i) => sum + (value + s * u[i] - t * v[i]) ** 2, 0);
  }
  function segmentTriangleSq(p, q, a, b, c) {
    const normal = cross3(sub(b, a), sub(c, a)), direction = sub(q, p), den = dot3(normal, direction);
    if (Math.abs(den) > 1e-12) {
      const t = dot3(normal, sub(a, p)) / den;
      if (t >= 0 && t <= 1 && inTriangle(p.map((v, i) => v + t * direction[i]), a, b, c)) return 0;
    }
    return Math.min(pointTriangleSq(p, a, b, c), pointTriangleSq(q, a, b, c), segmentSegmentSq(p, q, a, b), segmentSegmentSq(p, q, b, c), segmentSegmentSq(p, q, c, a));
  }
  function boundAxisAgainstMesh(rings, shell, exact) {
    const p = shell.positions, ix = shell.indices, segmentClearance = [], buckets = Array.from({length: rings.length - 1}, () => []);
    const m = rings[1].points.length;
    for (let k = 0; k < ix.length; k += 3) {
      const a = Array.from(p.subarray(ix[k] * 3, ix[k] * 3 + 3)), b = Array.from(p.subarray(ix[k + 1] * 3, ix[k + 1] * 3 + 3)), c = Array.from(p.subarray(ix[k + 2] * 3, ix[k + 2] * 3 + 3));
      const normal = cross3(sub(b, a), sub(c, a));
      const face = {a, b, c, normal, normalSq: dot3(normal, normal), low: [0, 1, 2].map(i => Math.min(a[i], b[i], c[i])), high: [0, 1, 2].map(i => Math.max(a[i], b[i], c[i]))};
      const triangle = k / 3, slab = triangle < m ? 0 : Math.min(rings.length - 2, 1 + Math.floor((triangle - m) / (2 * m)));
      buckets[slab].push(face);
    }
    const boxes = buckets.map(bucket => {
      const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
      for (const face of bucket) for (let i = 0; i < 3; i++) { low[i] = Math.min(low[i], face.low[i]); high[i] = Math.max(high[i], face.high[i]); }
      return {low, high};
    });
    for (let j = 1; j < rings.length - 2; j++) {
      const a = rings[j].center, b = rings[j + 1].center;
      let best = Math.min(rings[j].transverseClearance, rings[j + 1].transverseClearance) ** 2;
      const low = [0, 1, 2].map(i => Math.min(a[i], b[i])), high = [0, 1, 2].map(i => Math.max(a[i], b[i]));
      for (let slab = 0; slab < buckets.length; slab++) {
        const box = boxes[slab]; let slabBound = 0;
        for (let i = 0; i < 3; i++) { const gap = Math.max(0, box.low[i] - high[i], low[i] - box.high[i]); slabBound += gap * gap; }
        if (slabBound >= best) continue;
        for (const face of buckets[slab]) {
          let lowerBound = 0;
          for (let i = 0; i < 3; i++) { const gap = Math.max(0, face.low[i] - high[i], low[i] - face.high[i]); lowerBound += gap * gap; }
          if (lowerBound >= best) continue;
          const nn = face.normal;
          const da = nn[0] * (a[0] - face.a[0]) + nn[1] * (a[1] - face.a[1]) + nn[2] * (a[2] - face.a[2]);
          const db = nn[0] * (b[0] - face.a[0]) + nn[1] * (b[1] - face.a[1]) + nn[2] * (b[2] - face.a[2]);
          if (da * db > 0 && face.normalSq > 1e-15) lowerBound = Math.max(lowerBound, Math.min(da * da, db * db) / face.normalSq);
          if (lowerBound >= best) continue;
          // Plane and box distances are independently valid lower bounds. Their
          // maximum stays a lower bound; minima across faces bound the wall.
          // Exact geometry is retained for a zero bound and for offline audits.
          best = Math.min(best, exact || lowerBound < 1e-10 ? segmentTriangleSq(a, b, face.a, face.b, face.c) : lowerBound);
      }
      }
      if (!(best > 1e-10)) throw new Error('Learned axis intersects actual shell near section ' + j);
      segmentClearance[j] = sqrt(best) * (exact ? 1 : .999);
    }
    for (let j = 1; j < rings.length - 1; j++) {
      rings[j].axisMeshClearance = Math.min(segmentClearance[j - 1] || Infinity, segmentClearance[j] || Infinity);
      rings[j].clearanceBound = Math.min(rings[j].transverseClearance, rings[j].axisMeshClearance);
    }
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
      for (let k = 0; k < m; k++) p.push(...radialPoint(ring.q + radius * cos(TAU * k / m), ring.c, ring.center[2] + radius * sin(TAU * k / m)));
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
    return Object.assign(meshPacket(p, ix), {centers, angles: new Float64Array(rings.slice(2, -2).map(r => r.c)), radii: new Float64Array(radii), color: '#ff779e', firstShellRing: 2, ringIndices: new Uint32Array(rings.slice(2, -2).map((_, j) => j + 2))});
  }
  function optionsFor(given) {
    const o = Object.assign({}, defaults, given || {});
    for (const [key, lo, hi] of [['longitudinalSections', 12, 128], ['angularSamples', 16, 96], ['fitSampleLimit', 64, 1024], ['spineSides', 8, 32], ['axisSmoothingPasses', 0, 8], ['radialSmoothingPasses', 0, 8]]) {
      if (!Number.isInteger(o[key]) || o[key] < lo || o[key] > hi) throw new RangeError(key + ' outside bounded range ' + lo + '..' + hi);
    }
    for (const [key, lo, hi] of [['supportQuantile', 0.75, 0.99], ['sliceBandwidth', 0.75, 4], ['minimumThicknessRatio', 0.01, 0.35], ['spineFraction', 0.01, 0.45], ['depth', 0.05, 4], ['archedThicknessRatio', 0.3, 1]]) {
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
    sorted.sort((a, b) => c[a] - c[b]);
    const first = sorted[0], last = sorted[N - 1], low = c[first], high = c[last];
    const n = options.longitudinalSections, m = options.angularSamples, step = (high - low) / (n + 1);
    const angleCos = [], angleSin = [];
    for (let k = 0; k < m; k++) { angleCos.push(cos(TAU * k / m)); angleSin.push(sin(TAU * k / m)); }
    const samples = [], rawX = [], rawZ = [], ys = [];
    let left = 0, right = 0;
    for (let j = 0; j < n; j++) {
      const y = low + step * (j + 1), half = step * options.sliceBandwidth;
      while (left < N && c[sorted[left]] < y - half) left++;
      if (right < left) right = left;
      while (right < N && c[sorted[right]] <= y + half) right++;
      const count = right - left, take = Math.min(count, options.fitSampleLimit), ids = [], xs = [], zs = [];
      for (let k = 0; k < take; k++) {
        const id = sorted[left + Math.min(count - 1, Math.floor((k + 0.5) * count / take))];
        ids.push(id); xs.push(q[id]); zs.push(positions[3 * id + 2]);
      }
      if (!take) throw new Error('Empty source slice; increase sliceBandwidth.');
      samples.push({ids, population: count}); rawX.push(quantile(xs, 0.5)); rawZ.push(quantile(zs, 0.5)); ys.push(y);
    }
    const axisX = smoothScalars(rawX, options.axisSmoothingPasses, false), axisZ = smoothScalars(rawZ, options.axisSmoothingPasses, false);
    const radial = [], floors = [], sampleAreas = [];
    for (let j = 0; j < n; j++) {
      const ids = samples[j].ids, dx = [], dz = [], lengths = [];
      for (const id of ids) { const x = q[id] - axisX[j], z = positions[3 * id + 2] - axisZ[j]; dx.push(x); dz.push(z); lengths.push(Math.hypot(x, z)); }
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
    const endpoint = id => {
      const center = radialPoint(q[id], c[id], positions[id * 3 + 2]);
      return {c: c[id], q: q[id], y: center[1], center, points: Array.from({length: m}, () => center.slice()), localPoints: Array.from({length: m}, () => [q[id], center[2]]), radii: Array(m).fill(0), clearanceBound: 0, sourcePopulation: 1, fitSampleCount: 1, thicknessFloor: 0};
    };
    const rings = [endpoint(first)];
    for (let j = 0; j < n; j++) {
      const center = radialPoint(axisX[j], ys[j], axisZ[j]), radii = radial[j];
      const localPoints = radii.map((r, k) => [axisX[j] + r * angleCos[k], center[2] + r * angleSin[k]]);
      rings.push({c: ys[j], q: axisX[j], y: center[1], center, localPoints, points: localPoints.map(p => radialPoint(p[0], ys[j], p[1])), radii,
        clearanceBound: Math.min(...radii) * cos(Math.PI / m), sourcePopulation: samples[j].population, fitSampleCount: samples[j].ids.length, thicknessFloor: floors[j]});
    }
    rings.push(endpoint(last));
    for (const ring of rings) { ring.coordinate = ring.c; ring.localCenter = [ring.q, ring.center[2]]; }
    archSections(rings, options);
    const shell = buildShell(rings, m);
    boundAxisAgainstMesh(rings, shell);
    const spine = buildSpine(rings, options);
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
      stats: {cloudCount: N, learningCoordinate: 'unwrapped source angle c', originalLiftParameterDimensions: 2, shellVertexCount: shell.positions.length / 3,
        shellTriangleCount: shell.indices.length / 3, fittedSections: n, angularSamples: m, cRange: [low, high], unwrappedCSpan: high - low, sourceQRange: [Math.min(...q), Math.max(...q)], minimumShellQ: Math.min(...rings.flatMap(r => r.localPoints.map(p => p[0]))),
        minimumThicknessRatio: options.minimumThicknessRatio, thicknessFloorRange: [Math.min(...floors), Math.max(...floors)],
        minimumRingClearanceBound: Math.min(...rings.slice(1, -1).map(r => r.clearanceBound)), spineRadiusRange: [Math.min(...spine.radii), Math.max(...spine.radii)],
        spineClearanceLowerBound: Math.min(...spine.radii) * (1 / options.spineFraction - 1), axisLength, axisChord, axisLengthRatio: axisLength / axisChord,
        unsmoothedSectionAreaRange: [Math.min(...sampleAreas), Math.max(...sampleAreas)], shellCoverage: 'robust core plus explicitly inferred Z arches; not guaranteed to enclose all original points', supportQuantile: options.supportQuantile,
        archedThicknessRatio: options.archedThicknessRatio, chestArchHeightRange: [Math.min(...rings.slice(1, -1).map(r => r.archHeight)), Math.max(...rings.slice(1, -1).map(r => r.archHeight))],
        shellXYInvariantAcrossChestArc: true, minimumAxisMeshClearance: Math.min(...rings.slice(1, -1).map(r => r.axisMeshClearance)),
        axisClearanceMethod: 'Conservative triangle-plane/AABB lower bounds; exact segment-triangle fallback for zero bounds; exact audit available in validate(...,true).'},
      assumptions: [
        'The original 20,000-point cloud is retained exactly, in original descending-i order; source XY/q/d/c are untouched.',
        'Quadrature depth z=d*cos(t-d)+B*A*sin(i/7), A=5+sin(i/598), B=(i/598)/23*(3sin(e)+e*sin(2e)+sin(4d)), is an explicit phase-completion hypothesis, not recovered anatomy or a unique 3D answer.',
        'Unwrapped source angle c is the learning coordinate. Positive q and c-span below 2PI prevent polar wrapping.',
        'Local q/Z centers are smoothed medians; no source branch is identified as a species or an organ.',
        options.supportQuantile + ' directional supports form a robust core; all outlying branches remain visible in the separate full source cloud.',
        'Fitting uses at most ' + options.fitSampleLimit + ' deterministic equal-rank samples per angular slice.',
        'Missing support is floored at ' + options.minimumThicknessRatio + ' times each local 90th-percentile source radius, as disclosed inferred thickness.',
        'Z-only arches preserve the fitted q bounds and all mesh XY coordinates. Height is ' + options.archedThicknessRatio + ' times the smoothed local q half-width with sqrt(1-u²) profile.',
        'The solid uses strictly increasing unwrapped-c sections and source extrema as closed caps. All Cartesian shell triangles have positive radial support.',
        'The colored finite tube stays within ' + options.spineFraction + ' of conservative axis-segment-to-actual-shell-triangle distances. It has closed caps and stops short of the shell ends.',
        'Containment intersects actual Float32 Cartesian mesh triangles with radial planes, including triangulation diagonals; it never assumes radial interpolation is Cartesian interpolation.'
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
        for (const p of ring.localPoints) p[1] *= depth;
        ring.localCenter[1] *= depth;
        if (ring.preArchLocalPoints) for (const p of ring.preArchLocalPoints) p[1] *= depth;
        if (ring.preArchPoints) for (const p of ring.preArchPoints) p[2] *= depth;
        if (ring.archHeight) ring.archHeight *= depth;
        if (ring.axisMeshClearance) ring.axisMeshClearance *= minorScale;
        if (ring.transverseClearance) ring.transverseClearance *= minorScale;
        ring.radii = ring.localPoints.map(p => Math.hypot(p[0] - ring.q, p[1] - ring.center[2]));
        ring.clearanceBound *= minorScale;
      }
      for (const p of axis) p[2] *= depth;
      for (const p of spine.centers) p[2] *= depth;
    }
    const minimumQ = result.stats.minimumShellQ;
    result.stats.minimumTriangleRadiusBound = minimumQ * cos(step / 2);
    result.stats.maximumSectionAngleStep = step;
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
    result.stats.spineEuclideanClearanceLowerBound = result.stats.spineClearanceLowerBound;
    result.stats.minimumAxisMeshClearance *= minorScale;
    result.stats.chestArchHeightBeforeDepthRange = result.stats.chestArchHeightRange.slice();
    result.stats.chestArchHeightRange = result.stats.chestArchHeightRange.map(h => h * depth);
    result.stats.spineDepthRadiusRange = result.stats.spineRadiusRange.map(r => r * depth);
    result.stats.thicknessFloorBeforeDepthRange = result.stats.thicknessFloorRange.slice();
    result.stats.thicknessFloorZRange = result.stats.thicknessFloorRange.map(r => r * depth);
    result.assumptions.push('Depth scale ' + depth + ' is applied uniformly to every Z coordinate after fitting. Zero depth is disallowed because it would collapse the solid. Reported measured clearance is within the actual radial-plane section; the separate conservative Euclidean bound applies to every tube face.');
    // Rendered Float32 vertices can move by a few ulps. Reserve a whole-packet
    // rounding allowance before advertising the Euclidean tube-wall margin.
    const roundingAllowance = Math.max(...Array.from(shell.positions, Math.abs), ...Array.from(spine.positions, Math.abs)) * 2 ** -22;
    result.stats.float32RoundingAllowance = roundingAllowance;
    result.stats.minimumTriangleRadiusBound = Math.max(0, result.stats.minimumTriangleRadiusBound - roundingAllowance);
    result.stats.spineEuclideanClearanceLowerBound = Math.max(0, result.stats.spineEuclideanClearanceLowerBound - roundingAllowance);
    return result;
  }
  function unwrapAngle(angle, low) { return angle + TAU * Math.ceil((low - angle - 1e-8) / TAU); }
  function sectionPolygon(volume, angle) {
    const rings = volume.rings, n = rings.length, m = volume.options.angularSamples;
    if (angle < rings[0].c - 1e-7 || angle > rings[n - 1].c + 1e-7) return null;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rings[mid].c <= angle) lo = mid; else hi = mid; }
    const p = volume.shell.positions, ix = volume.shell.indices, nx = cos(angle), ny = sin(angle), rx = sin(angle), ry = -cos(angle);
    const nodes = new Map(), edges = new Map();
    function node(id, other, distance, otherDistance) {
      const atVertex = Math.abs(distance) < 1e-10;
      const key = atVertex ? 'v' + id : 'e' + Math.min(id, other) + ':' + Math.max(id, other);
      if (!nodes.has(key)) {
        const t = atVertex ? 0 : distance / (distance - otherDistance), a = 3 * id, b = 3 * other;
        const x = p[a] + t * (p[b] - p[a]), y = p[a + 1] + t * (p[b + 1] - p[a + 1]), z = p[a + 2] + t * (p[b + 2] - p[a + 2]);
        nodes.set(key, {point: [x * rx + y * ry, z], adjacent: []});
      }
      return key;
    }
    // Float32 roundoff makes a nominal ring slightly nonplanar. Include both
    // adjacent slabs as well as the containing slab, rather than substituting
    // idealized double-precision ring contours for the rendered triangles.
    for (let slab = Math.max(0, lo - 1); slab <= Math.min(n - 2, lo + 1); slab++) {
      const start = slab === 0 ? 0 : m + (slab - 1) * 2 * m;
      const count = slab === 0 || slab === n - 2 ? m : 2 * m;
      for (let f = start; f < start + count; f++) {
        const ids = [ix[3 * f], ix[3 * f + 1], ix[3 * f + 2]], ds = ids.map(id => nx * p[3 * id] + ny * p[3 * id + 1]), hits = [];
        for (let k = 0; k < 3; k++) {
          const j = (k + 1) % 3;
          if (Math.abs(ds[k]) < 1e-10) hits.push(node(ids[k], ids[j], ds[k], ds[j]));
          else if (Math.abs(ds[j]) >= 1e-10 && ds[k] * ds[j] < 0) hits.push(node(ids[k], ids[j], ds[k], ds[j]));
        }
        const unique = [...new Set(hits)];
        if (unique.length !== 2 || unique.some(key => nodes.get(key).point[0] <= 0)) continue;
        const key = unique.slice().sort().join('/');
        if (!edges.has(key)) {
          edges.set(key, unique); nodes.get(unique[0]).adjacent.push(unique[1]); nodes.get(unique[1]).adjacent.push(unique[0]);
        }
      }
    }
    if (!edges.size) return null;
    const start = edges.values().next().value[0], polygon = [];
    let current = start, previous = null;
    for (let step = 0; step <= edges.size; step++) {
      const node = nodes.get(current); polygon.push(node.point);
      const next = node.adjacent.find(key => key !== previous);
      if (next === start) return polygon.length >= 3 ? polygon : null;
      if (!next) return null;
      previous = current; current = next;
    }
    return null;
  }
  function clearance(volume, point) {
    const q = Math.hypot(point[0], point[1]);
    if (!(q > 0)) return -Infinity;
    const angle = unwrapAngle(Math.atan2(point[0], -point[1]), volume.rings[0].c), poly = sectionPolygon(volume, angle);
    if (!poly) return -Infinity;
    return polygonClearance(poly, [q, point[2]]);
  }
  function contains(volume, point, margin) { return clearance(volume, point) >= (margin || 0); }
  function validate(volume, thorough) {
    const errors = [], finite = a => Array.from(a).every(Number.isFinite);
    for (const name of ['cloud', 'shell', 'spine', 'sections']) if (!finite(volume[name].positions)) errors.push(name + ' has nonfinite vertices');
    if (volume.cloud.positions.length !== N * 3) errors.push('source point count changed');
    for (let j = 1; j < volume.rings.length; j++) if (!(volume.rings[j].c > volume.rings[j - 1].c)) errors.push('longitudinal fold');
    if (!(volume.stats.minimumShellQ > 0 && volume.stats.unwrappedCSpan < TAU)) errors.push('polar coordinate fold');
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
      for (let k = 0; k < volume.options.spineSides; k++) free = Math.min(free, clearance(volume, radialPoint(Math.hypot(center[0], center[1]) + rx * cos(TAU * k / volume.options.spineSides), volume.spine.angles[j], center[2] + rz * sin(TAU * k / volume.options.spineSides))));
      minimumMeasuredSpineClearance = Math.min(minimumMeasuredSpineClearance, free);
      if (!(free > 0)) errors.push('spine ring not strictly internal at ' + j);
    }
    if (thorough) {
      const auditRings = volume.rings.map(r => ({center: r.center, c: r.c, y: r.y, points: r.points, transverseClearance: r.transverseClearance}));
      boundAxisAgainstMesh(auditRings, volume.shell, true);
      for (let j = 1; j < auditRings.length - 1; j++) if (volume.rings[j].axisMeshClearance > auditRings[j].axisMeshClearance + 1e-4) { errors.push('conservative wall bound exceeds exact mesh clearance at ' + j); break; }
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
    for (const source of [4, 5]) for (const frame of [1, 120, 240, 480]) {
      const volume = evaluate(source, frame), result = validate(volume, true);
      cases.push({source, frame, ...result});
    }
    return {ok: cases.every(c => c.ok), cases};
  }
  return Object.freeze({version: 'r24-angular-volume-1', defaults, sourcePoint, frameTime, evaluate, sectionPolygon, clearance, contains, validate, selfTest});
});
