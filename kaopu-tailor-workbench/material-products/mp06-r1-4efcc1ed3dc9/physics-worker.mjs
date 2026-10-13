// pack/parent/cloth-physics.mjs
var GRAVITY = 9.81;
var clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function dihedral(p, i0, i1, i2, i3, out = new Float64Array(13)) {
  const a = 3 * i0, b = 3 * i1, c = 3 * i2, d = 3 * i3, ex = p[b] - p[a], ey = p[b + 1] - p[a + 1], ez = p[b + 2] - p[a + 2], ux = p[c] - p[a], uy = p[c + 1] - p[a + 1], uz = p[c + 2] - p[a + 2], vx = p[d] - p[a], vy = p[d + 1] - p[a + 1], vz = p[d + 2] - p[a + 2];
  const nx = ey * uz - ez * uy, ny = ez * ux - ex * uz, nz = ex * uy - ey * ux, mx = vy * ez - vz * ey, my = vz * ex - vx * ez, mz = vx * ey - vy * ex;
  const e2 = ex * ex + ey * ey + ez * ez, n2 = nx * nx + ny * ny + nz * nz, m2 = mx * mx + my * my + mz * mz;
  if (Math.min(e2, n2, m2) < 1e-18) {
    out.fill(0);
    return out;
  }
  const len = Math.sqrt(e2), u = (ux * ex + uy * ey + uz * ez) / e2, v = (vx * ex + vy * ey + vz * ez) / e2;
  out[0] = Math.atan2((ex * (ny * mz - nz * my) + ey * (nz * mx - nx * mz) + ez * (nx * my - ny * mx)) / len, nx * mx + ny * my + nz * mz);
  out[7] = -len * nx / n2;
  out[8] = -len * ny / n2;
  out[9] = -len * nz / n2;
  out[10] = -len * mx / m2;
  out[11] = -len * my / m2;
  out[12] = -len * mz / m2;
  for (let k = 0; k < 3; k++) {
    out[4 + k] = -u * out[7 + k] - v * out[10 + k];
    out[1 + k] = -out[4 + k] - out[7 + k] - out[10 + k];
  }
  return out;
}
var ClothSolver = class {
  constructor(packet, positions, { family = "knit", doubleLayer = true, role = "top", sdf = null, clearanceMM = 3.5, bend = 1, softness = 1, damping = 7, gravity = 1 } = {}) {
    this.packet = packet;
    this.original = new Float64Array(positions);
    this.sdf = sdf;
    this.family = family;
    this.role = role;
    this.settings = { clearanceMM, bend, softness, damping, gravity };
    this.time = 0;
    this.steps = 0;
    this.contacts = 0;
    this.safetyTrips = 0;
    const n = positions.length / 3, parent = Int32Array.from({ length: n }, (_, i) => i), offsets = /* @__PURE__ */ new Map();
    let off = 0;
    const root = (i) => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    for (const pan of packet.spec.panels) {
      offsets.set(pan.id, off);
      off += pan.uvMm.length;
    }
    const active = new Set(packet.record.activeSeams);
    this.seamPairs = [];
    for (const s of packet.spec.seams) {
      if (!active.has(s.id)) continue;
      const a = offsets.get(s.a.panelId), b = offsets.get(s.b.panelId);
      for (const [i, j] of s.stitchVertexPairs || []) {
        const ia = a + i, ib = b + j;
        parent[root(ib)] = root(ia);
        this.seamPairs.push([ia, ib]);
      }
    }
    const group = /* @__PURE__ */ new Map();
    this.map = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const r = root(i);
      if (!group.has(r)) group.set(r, group.size);
      this.map[i] = group.get(r);
    }
    this.count = group.size;
    this.p = new Float64Array(this.count * 3);
    this.v = new Float64Array(this.p.length);
    this.old = new Float64Array(this.p.length);
    this.mass = new Float64Array(this.count);
    const counts = new Uint32Array(this.count);
    for (let i = 0; i < n; i++) {
      const g = this.map[i];
      counts[g]++;
      for (let k = 0; k < 3; k++) this.p[g * 3 + k] += positions[i * 3 + k];
    }
    for (let i = 0; i < this.count; i++) for (let k = 0; k < 3; k++) this.p[i * 3 + k] /= counts[i];
    this.faces = [];
    this.edges = [];
    this.bends = [];
    const bendEdges = /* @__PURE__ */ new Map(), surfaceEdges = /* @__PURE__ */ new Map();
    let density = family === "knit" ? 0.32 : family === "leather" ? 0.65 : 0.39;
    if (family === "knit" && doubleLayer) density *= 1.7;
    this.density = density;
    off = 0;
    for (const pan of packet.spec.panels) {
      const seen = /* @__PURE__ */ new Set();
      for (const tri of pan.triangles) {
        const q = tri.map((i) => this.map[off + i]);
        if (new Set(q).size < 3) continue;
        this.faces.push(...q);
        const uv = tri.map((i) => pan.uvMm[i]), area = Math.abs((uv[1][0] - uv[0][0]) * (uv[2][1] - uv[0][1]) - (uv[2][0] - uv[0][0]) * (uv[1][1] - uv[0][1])) * 5e-7;
        for (const i of q) this.mass[i] += area * density / 3;
        for (let j = 0; j < 3; j++) {
          const aa = tri[j], bb = tri[(j + 1) % 3], a = q[j], b = q[(j + 1) % 3], c = q[(j + 2) % 3], key = a < b ? a + "," + b : b + "," + a;
          if (!surfaceEdges.has(key)) surfaceEdges.set(key, [a, b]);
          if (!seen.has(key)) {
            seen.add(key);
            const u = pan.uvMm[aa], v = pan.uvMm[bb];
            this.edges.push({ a, b, rest: Math.hypot(u[0] - v[0], u[1] - v[1]) * 1e-3, lambda: 0 });
          }
          const prior = bendEdges.get(key);
          if (prior) {
            if (prior.c !== c) this.bends.push({ a: prior.a, b: prior.b, c: prior.c, d: c, lambda: 0, rest: 0 });
          } else bendEdges.set(key, { a, b, c });
        }
      }
      off += pan.uvMm.length;
    }
    this.surfaceEdges = [...surfaceEdges.values()];
    this.faces = new Int32Array(this.faces);
    this.w = new Float64Array(this.count);
    for (let i = 0; i < this.count; i++) this.w[i] = 1 / Math.max(1e-7, this.mass[i]);
    this.pins = [];
    if (role === "bottom") {
      let ymax = -Infinity;
      for (let i = 1; i < this.p.length; i += 3) ymax = Math.max(ymax, this.p[i]);
      for (let i = 0; i < this.count; i++) if (this.p[3 * i + 1] > ymax - 35e-4) {
        this.w[i] = 0;
        this.pins.push(i);
      }
    }
    this.initial = this.p.slice();
    this.scratch = new Float64Array(13);
    this.contactSample = new Float64Array(4);
    this.output = new Float32Array(positions.length);
    this.normals = new Float32Array(positions.length);
    this.groupNormals = new Float64Array(this.p.length);
    this.expand();
  }
  set(options) {
    Object.assign(this.settings, options);
  }
  distance(c, h) {
    const p = this.p, a = c.a * 3, b = c.b * 3, dx = p[a] - p[b], dy = p[a + 1] - p[b + 1], dz = p[a + 2] - p[b + 2], l = Math.hypot(dx, dy, dz);
    if (l < 1e-12) return;
    const comp = (this.family === "knit" ? 35e-5 : this.family === "leather" ? 3e-5 : 6e-5) * this.settings.softness, alpha = comp / (h * h), w = this.w[c.a] + this.w[c.b], dl = (-(l - c.rest) - alpha * c.lambda) / (w + alpha);
    c.lambda += dl;
    const f = dl / l;
    for (let k = 0; k < 3; k++) {
      const d = k === 0 ? dx : k === 1 ? dy : dz;
      p[a + k] += this.w[c.a] * d * f;
      p[b + k] -= this.w[c.b] * d * f;
    }
  }
  strainGuard() {
    const p = this.p, lo = this.family === "knit" ? 0.82 : 0.9, hi = this.family === "knit" ? 1.18 : 1.12;
    for (const e of this.edges) {
      const a = e.a * 3, b = e.b * 3, dx = p[a] - p[b], dy = p[a + 1] - p[b + 1], dz = p[a + 2] - p[b + 2], l = Math.hypot(dx, dy, dz), target = clamp(l, e.rest * lo, e.rest * hi), w = this.w[e.a] + this.w[e.b];
      if (l < 1e-12 || !w || l === target) continue;
      const f = (target - l) / (l * w);
      for (let k = 0; k < 3; k++) {
        const d = k === 0 ? dx : k === 1 ? dy : dz;
        p[a + k] += this.w[e.a] * d * f;
        p[b + k] -= this.w[e.b] * d * f;
      }
    }
  }
  bending(c, h) {
    const q = dihedral(this.p, c.a, c.b, c.c, c.d, this.scratch), ids = [c.a, c.b, c.c, c.d], alpha = (this.family === "leather" ? 2800 : this.family === "denim" ? 6e3 : 12e3) / (Math.max(0.05, this.settings.bend) * h * h);
    let den = alpha;
    for (let j = 0; j < 4; j++) for (let k = 0; k < 3; k++) den += this.w[ids[j]] * q[1 + j * 3 + k] ** 2;
    if (den < 1e-10) return;
    const C = Math.atan2(Math.sin(q[0] - c.rest), Math.cos(q[0] - c.rest)), dl = (-C - alpha * c.lambda) / den;
    c.lambda += dl;
    for (let j = 0; j < 4; j++) for (let k = 0; k < 3; k++) this.p[ids[j] * 3 + k] += this.w[ids[j]] * q[1 + j * 3 + k] * dl;
  }
  contact(ids, weights, margin) {
    if (!this.sdf) return;
    const p = this.p;
    let x = 0, y = 0, z = 0, den = 0;
    for (let j = 0; j < ids.length; j++) {
      const i = ids[j], t = weights[j];
      x += p[3 * i] * t;
      y += p[3 * i + 1] * t;
      z += p[3 * i + 2] * t;
      den += this.w[i] * t * t;
    }
    if (den === 0) return;
    const q = this.sdf.sample(x, y, z, this.contactSample);
    if (q[0] >= margin) return;
    const g2 = q[1] ** 2 + q[2] ** 2 + q[3] ** 2;
    if (g2 < 0.01) return;
    const dl = Math.min(8e-3, margin - q[0]) / g2 / den;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[j] * 3, f = this.w[ids[j]] * weights[j] * dl;
      for (let k = 0; k < 3; k++) p[a + k] += f * q[1 + k];
    }
    this.contacts++;
  }
  projectContacts(dense = false) {
    const margin = this.settings.clearanceMM * 1e-3;
    for (let i = 0; i < this.count; i++) this.contact([i], [1], margin);
    if (dense) {
      for (const edge of this.surfaceEdges) this.contact(edge, [0.5, 0.5], margin + 6e-4);
      for (let f = 0; f < this.faces.length; f += 3) this.contact(this.faces.subarray(f, f + 3), [1 / 3, 1 / 3, 1 / 3], margin + 8e-4);
    }
  }
  step(dt = 1 / 30) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.101) throw Error("CLOTH_DT_RANGE");
    const sub = Math.max(1, Math.ceil(dt * 240)), h = dt / sub;
    if (h === 0) return;
    const p = this.p, v = this.v, w = this.w, s = this.settings;
    this.contacts = 0;
    for (let ss = 0; ss < sub; ss++) {
      this.old.set(p);
      const damp = Math.exp(-s.damping * h);
      for (let i = 0; i < this.count; i++) {
        const j = i * 3;
        if (!w[i]) continue;
        for (let k = 0; k < 3; k++) p[j + k] += v[j + k] * damp * h;
        p[j + 1] -= GRAVITY * s.gravity * h * h;
      }
      for (const e of this.edges) e.lambda = 0;
      for (const b of this.bends) b.lambda = 0;
      for (let it = 0; it < 10; it++) {
        for (const e of this.edges) this.distance(e, h);
        if (it % 2 === 0) for (const b of this.bends) this.bending(b, h);
        this.strainGuard();
        this.projectContacts(it === 9);
      }
      for (let guard = 0; guard < 10; guard++) {
        this.strainGuard();
        this.projectContacts(guard === 9);
      }
      this.projectContacts(false);
      for (let i = 0; i < p.length; i++) {
        if (!Number.isFinite(p[i]) || Math.abs(p[i] - this.initial[i]) > 0.45) {
          this.p.set(this.old);
          this.v.fill(0);
          this.safetyTrips++;
          throw Error("\u7269\u7406\u8D85\u51FA\u672C\u8F6E\u5B89\u5168\u8303\u56F4\uFF0C\u5DF2\u6682\u505C\u5E76\u4FDD\u7559\u4E0A\u4E00\u5E27");
        }
        v[i] = (p[i] - this.old[i]) / h;
      }
      for (let i = 0; i < this.count; i++) {
        if (!w[i] || !this.sdf) continue;
        const j = i * 3, q = this.sdf.sample(p[j], p[j + 1], p[j + 2], this.contactSample);
        if (q[0] < s.clearanceMM * 1e-3 + 12e-4) {
          const l = Math.hypot(q[1], q[2], q[3]);
          if (l > 0.1) {
            const nx = q[1] / l, ny = q[2] / l, nz = q[3] / l, vn = v[j] * nx + v[j + 1] * ny + v[j + 2] * nz, f = Math.exp(-32 * h);
            v[j] = (v[j] - vn * nx) * f + Math.max(0, vn) * nx;
            v[j + 1] = (v[j + 1] - vn * ny) * f + Math.max(0, vn) * ny;
            v[j + 2] = (v[j + 2] - vn * nz) * f + Math.max(0, vn) * nz;
          }
        }
      }
      this.time += h;
      this.steps++;
    }
    this.expand();
  }
  expand() {
    const N = this.groupNormals;
    N.fill(0);
    const p = this.p, F = this.faces;
    for (let f = 0; f < F.length; f += 3) {
      const a = F[f] * 3, b = F[f + 1] * 3, c = F[f + 2] * 3, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2], x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      for (const j of [a, b, c]) {
        N[j] += x;
        N[j + 1] += y;
        N[j + 2] += z;
      }
    }
    for (let i = 0; i < this.count; i++) {
      const j = 3 * i, l = Math.hypot(N[j], N[j + 1], N[j + 2]) || 1;
      N[j] /= l;
      N[j + 1] /= l;
      N[j + 2] /= l;
    }
    for (let i = 0; i < this.map.length; i++) {
      const g = this.map[i] * 3;
      for (let k = 0; k < 3; k++) {
        this.output[3 * i + k] = p[g + k];
        this.normals[3 * i + k] = N[g + k];
      }
    }
    return this.output;
  }
  reset() {
    this.p.set(this.initial);
    this.v.fill(0);
    this.time = 0;
    this.steps = 0;
    this.safetyTrips = 0;
    this.expand();
  }
  tug() {
    let ymin = Infinity;
    for (let i = 1; i < this.p.length; i += 3) ymin = Math.min(ymin, this.p[i]);
    for (let i = 0; i < this.count; i++) if (this.w[i] && this.p[3 * i + 1] < ymin + 0.1) {
      this.v[3 * i + 1] += 0.32;
      this.v[3 * i + 2] += 0.2;
    }
  }
  audit() {
    let min = Infinity, maxMove = 0, minRatio = Infinity, maxRatio = 0;
    const p = this.p, q = this.contactSample;
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      if (this.sdf) min = Math.min(min, this.sdf.sample(p[j], p[j + 1], p[j + 2], q)[0]);
      maxMove = Math.max(maxMove, Math.hypot(p[j] - this.initial[j], p[j + 1] - this.initial[j + 1], p[j + 2] - this.initial[j + 2]));
    }
    for (const e of this.edges) {
      const a = e.a * 3, b = e.b * 3, r = Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]) / e.rest;
      minRatio = Math.min(minRatio, r);
      maxRatio = Math.max(maxRatio, r);
    }
    return { type: "XPBD-distance-and-dihedral", gravityMS2: GRAVITY * this.settings.gravity, seconds: this.time, substeps: this.steps, particles: this.count, originalVertices: this.map.length, sewnPairs: this.seamPairs.length, seamGapMM: 0, waistAnchors: this.pins.length, shoulderAnchors: 0, distanceConstraints: this.edges.length, dihedralConstraints: this.bends.length, minBodyVertexDistanceMM: min * 1e3, maxMoveMM: maxMove * 1e3, minEdgeStretch: minRatio, maxEdgeStretch: maxRatio, contactCorrections: this.contacts, safetyTrips: this.safetyTrips, densityKgM2: this.density, materialCalibrated: false, continuousCollision: false, restMetric: "original flat paper", kinematicShapeAttraction: false, strainGuard: "engineering extension/compression limits; not measured fabric calibration" };
  }
};

// pack/parent/material-physics.mjs
var ClothSolver2 = class extends ClothSolver {
  constructor(packet, positions, options = {}) {
    super(packet, positions, { clearanceMM: 4, ...options });
    this.p.fill(0);
    const counts = new Uint32Array(this.count);
    for (let i = 0; i < this.map.length; i++) {
      const g = this.map[i];
      counts[g]++;
      for (let k = 0; k < 3; k++) this.p[g * 3 + k] += positions[i * 3 + k];
    }
    for (let i = 0; i < this.count; i++) {
      for (let k = 0; k < 3; k++) this.p[i * 3 + k] /= counts[i];
      this.w[i] = 1 / Math.max(1e-7, this.mass[i]);
    }
    for (let i = 0; i < 8; i++) this.projectContacts(true);
    this.pins = [];
    if (this.role === "bottom") {
      let ymax = -Infinity;
      for (let i = 1; i < this.p.length; i += 3) ymax = Math.max(ymax, this.p[i]);
      for (let i = 0; i < this.count; i++) if (this.p[3 * i + 1] > ymax - 35e-4) {
        this.w[i] = 0;
        this.pins.push(i);
      }
    }
    this.initial = this.p.slice();
    this.v.fill(0);
    this.expand();
  }
  set(options) {
    for (const [key, value] of Object.entries(options)) if (!Number.isFinite(value)) throw Error("PHYSICS_PARAMETER_NOT_FINITE");
    Object.assign(this.settings, options);
  }
  step(dt = 1 / 30) {
    if (!Number.isFinite(dt) || dt < 0 || dt > 0.101) throw Error("CLOTH_DT_RANGE");
    const sub = Math.max(1, Math.ceil(dt * 240)), h = dt / sub;
    if (h === 0) return;
    const p = this.p, v = this.v, w = this.w, s = this.settings;
    this.contacts = 0;
    for (let ss = 0; ss < sub; ss++) {
      this.old.set(p);
      const damp = Math.exp(-s.damping * h);
      for (let i = 0; i < this.count; i++) {
        const j = i * 3;
        if (!w[i]) continue;
        for (let k = 0; k < 3; k++) p[j + k] += v[j + k] * damp * h;
        p[j + 1] -= GRAVITY * s.gravity * h * h;
      }
      for (const e of this.edges) e.lambda = 0;
      for (const b of this.bends) b.lambda = 0;
      for (let it = 0; it < 16; it++) {
        for (const e of this.edges) this.distance(e, h);
        if (it % 2 === 0) for (const b of this.bends) this.bending(b, h);
        this.strainGuard();
        this.projectContacts(it === 15);
      }
      for (let guard = 0; guard < 12; guard++) {
        this.strainGuard();
        this.projectContacts(guard === 11);
      }
      this.projectContacts(false);
      for (let i = 0; i < p.length; i++) {
        if (!Number.isFinite(p[i]) || Math.abs(p[i] - this.initial[i]) > 0.45) {
          this.p.set(this.old);
          this.v.fill(0);
          this.safetyTrips++;
          throw Error("\u7269\u7406\u8D85\u51FA\u5B89\u5168\u8303\u56F4\uFF0C\u5DF2\u6682\u505C\u5E76\u4FDD\u7559\u4E0A\u4E00\u5E27");
        }
        v[i] = (p[i] - this.old[i]) / h;
      }
      for (let i = 0; i < this.count; i++) {
        if (!w[i] || !this.sdf) continue;
        const j = i * 3, q = this.sdf.sample(p[j], p[j + 1], p[j + 2], this.contactSample);
        if (q[0] < s.clearanceMM * 1e-3 + 12e-4) {
          const l = Math.hypot(q[1], q[2], q[3]);
          if (l > 0.1) {
            const nx = q[1] / l, ny = q[2] / l, nz = q[3] / l, vn = v[j] * nx + v[j + 1] * ny + v[j + 2] * nz, f = Math.exp(-32 * h);
            v[j] = (v[j] - vn * nx) * f + Math.max(0, vn) * nx;
            v[j + 1] = (v[j + 1] - vn * ny) * f + Math.max(0, vn) * ny;
            v[j + 2] = (v[j + 2] - vn * nz) * f + Math.max(0, vn) * nz;
          }
        }
      }
      this.time += h;
      this.steps++;
    }
    this.expand();
  }
  audit(dense = false) {
    let min = Infinity, minInterior = Infinity, maxMove = 0, minRatio = Infinity, maxRatio = 0;
    const p = this.p, q = this.contactSample;
    for (let i = 0; i < this.count; i++) {
      const j = i * 3;
      if (this.sdf) min = Math.min(min, this.sdf.sample(p[j], p[j + 1], p[j + 2], q)[0]);
      maxMove = Math.max(maxMove, Math.hypot(p[j] - this.initial[j], p[j + 1] - this.initial[j + 1], p[j + 2] - this.initial[j + 2]));
    }
    for (const e of this.edges) {
      const a = e.a * 3, b = e.b * 3, r = Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]) / e.rest;
      minRatio = Math.min(minRatio, r);
      maxRatio = Math.max(maxRatio, r);
      if (dense && this.sdf) minInterior = Math.min(minInterior, this.sdf.sample((p[a] + p[b]) * 0.5, (p[a + 1] + p[b + 1]) * 0.5, (p[a + 2] + p[b + 2]) * 0.5, q)[0]);
    }
    if (dense && this.sdf) for (let f = 0; f < this.faces.length; f += 3) {
      const a = this.faces[f] * 3, b = this.faces[f + 1] * 3, c = this.faces[f + 2] * 3;
      minInterior = Math.min(minInterior, this.sdf.sample((p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3, q)[0]);
    }
    let seamGap = 0;
    for (const [a, b] of this.seamPairs) seamGap = Math.max(seamGap, Math.hypot(...[0, 1, 2].map((k) => this.output[a * 3 + k] - this.output[b * 3 + k])));
    return { type: "XPBD-distance-and-dihedral", gravityMS2: GRAVITY * this.settings.gravity, seconds: this.time, substeps: this.steps, particles: this.count, originalVertices: this.map.length, sewnPairs: this.seamPairs.length, seamGapMM: seamGap * 1e3, waistAnchors: this.pins.length, shoulderAnchors: 0, distanceConstraints: this.edges.length, dihedralConstraints: this.bends.length, minBodyVertexDistanceMM: min * 1e3, minBodyInteriorSampleMM: minInterior * 1e3, maxMoveMM: maxMove * 1e3, minEdgeStretch: minRatio, maxEdgeStretch: maxRatio, contactCorrections: this.contacts, safetyTrips: this.safetyTrips, densityKgM2: this.density, materialCalibrated: false, continuousCollision: false, restMetric: "original flat paper", kinematicShapeAttraction: false, strainGuard: "engineering limits, not fabric calibration" };
  }
};

// pack/parent/mesh-contact.mjs
function closestTriangle(p, faces, f, x, y, z, out = new Float64Array(7)) {
  const ia = faces[f] * 3, ib = faces[f + 1] * 3, ic = faces[f + 2] * 3;
  const ax = p[ia], ay = p[ia + 1], az = p[ia + 2], ux = p[ib] - ax, uy = p[ib + 1] - ay, uz = p[ib + 2] - az, vx = p[ic] - ax, vy = p[ic + 1] - ay, vz = p[ic + 2] - az, wx = x - ax, wy = y - ay, wz = z - az;
  const uu = ux * ux + uy * uy + uz * uz, vv = vx * vx + vy * vy + vz * vz, uv = ux * vx + uy * vy + uz * vz, wu = wx * ux + wy * uy + wz * uz, wv = wx * vx + wy * vy + wz * vz, den = uu * vv - uv * uv;
  let b = den > 1e-24 ? (wu * vv - wv * uv) / den : 0, c = den > 1e-24 ? (wv * uu - wu * uv) / den : 0;
  if (b < 0 || c < 0 || b + c > 1 || den <= 1e-24) {
    let best = Infinity, B = 0, C = 0;
    for (let k = 0; k < 3; k++) {
      let sx = 0, sy = 0, sz = 0, ex = ux, ey = uy, ez = uz;
      if (k === 1) {
        sx = ux;
        sy = uy;
        sz = uz;
        ex = vx - ux;
        ey = vy - uy;
        ez = vz - uz;
      } else if (k === 2) {
        sx = vx;
        sy = vy;
        sz = vz;
        ex = -vx;
        ey = -vy;
        ez = -vz;
      }
      const t = Math.max(0, Math.min(1, ((wx - sx) * ex + (wy - sy) * ey + (wz - sz) * ez) / Math.max(1e-24, ex * ex + ey * ey + ez * ez))), dx = sx + t * ex - wx, dy = sy + t * ey - wy, dz = sz + t * ez - wz, d = dx * dx + dy * dy + dz * dz;
      if (d < best) {
        best = d;
        B = k === 0 ? t : k === 1 ? 1 - t : 0;
        C = k === 0 ? 0 : k === 1 ? t : 1 - t;
      }
    }
    b = B;
    c = C;
  }
  const px = ax + ux * b + vx * c, py = ay + uy * b + vy * c, pz = az + uz * b + vz * c;
  out[0] = (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2;
  out[1] = px;
  out[2] = py;
  out[3] = pz;
  out[4] = 1 - b - c;
  out[5] = b;
  out[6] = c;
  return out;
}
function vertexNormals(p, faces, out = new Float32Array(p.length)) {
  out.fill(0);
  for (let f = 0; f < faces.length; f += 3) {
    const a = faces[f] * 3, b = faces[f + 1] * 3, c = faces[f + 2] * 3, ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2], nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      out[i] += nx;
      out[i + 1] += ny;
      out[i + 2] += nz;
    }
  }
  for (let i = 0; i < out.length; i += 3) {
    const h = Math.hypot(out[i], out[i + 1], out[i + 2]) || 1;
    out[i] /= h;
    out[i + 1] /= h;
    out[i + 2] /= h;
  }
  return out;
}
var MeshContact = class {
  constructor(positions, faces) {
    this.p = positions;
    this.faces = Int32Array.from(faces);
    this.normals = new Float32Array(positions.length);
    this.nodes = [];
    this.tri = Int32Array.from({ length: faces.length / 3 }, (_, i) => i * 3);
    this.tmp = new Float64Array(7);
    this.best = new Float64Array(7);
    this.stack = new Int32Array(128);
    this.build(0, this.tri.length);
    this.refit();
    this.queries = 0;
  }
  build(lo, hi) {
    const id = this.nodes.length, n = { lo, hi, left: -1, right: -1, box: new Float64Array(6) };
    this.nodes.push(n);
    if (hi - lo > 8) {
      const p = this.p, f = this.faces;
      const ranges = [0, 1, 2].map((axis2) => {
        let a = Infinity, b = -Infinity;
        for (let i = lo; i < hi; i++) {
          const k = this.tri[i], v = (p[f[k] * 3 + axis2] + p[f[k + 1] * 3 + axis2] + p[f[k + 2] * 3 + axis2]) / 3;
          a = Math.min(a, v);
          b = Math.max(b, v);
        }
        return b - a;
      });
      const axis = ranges.indexOf(Math.max(...ranges));
      const sorted = Array.from(this.tri.subarray(lo, hi)).sort((a, b) => p[f[a] * 3 + axis] + p[f[a + 1] * 3 + axis] + p[f[a + 2] * 3 + axis] - (p[f[b] * 3 + axis] + p[f[b + 1] * 3 + axis] + p[f[b + 2] * 3 + axis]));
      this.tri.set(sorted, lo);
      const mid = lo + hi >> 1;
      n.left = this.build(lo, mid);
      n.right = this.build(mid, hi);
    }
    return id;
  }
  refit(positions = this.p) {
    this.p = positions;
    const p = this.p, faces = this.faces;
    vertexNormals(p, faces, this.normals);
    for (let j = this.nodes.length - 1; j >= 0; j--) {
      const n = this.nodes[j], b = n.box;
      b[0] = b[1] = b[2] = Infinity;
      b[3] = b[4] = b[5] = -Infinity;
      if (n.left >= 0) {
        const a = this.nodes[n.left].box, c = this.nodes[n.right].box;
        for (let k = 0; k < 3; k++) {
          b[k] = Math.min(a[k], c[k]);
          b[k + 3] = Math.max(a[k + 3], c[k + 3]);
        }
      } else for (let i = n.lo; i < n.hi; i++) {
        const f = this.tri[i];
        for (let q = 0; q < 3; q++) {
          const v = faces[f + q] * 3;
          for (let k = 0; k < 3; k++) {
            b[k] = Math.min(b[k], p[v + k]);
            b[k + 3] = Math.max(b[k + 3], p[v + k]);
          }
        }
      }
    }
  }
  nearest(x, y, z, maxDistance = Infinity, seed = -1) {
    let best = maxDistance * maxDistance, winner = -1, head = 1;
    const stack = this.stack;
    stack[0] = 0;
    this.queries++;
    if (seed >= 0) {
      closestTriangle(this.p, this.faces, seed, x, y, z, this.tmp);
      best = Math.min(best, this.tmp[0]);
      winner = seed;
      this.best.set(this.tmp);
    }
    while (head) {
      const n = this.nodes[stack[--head]], b = n.box, dx = Math.max(b[0] - x, 0, x - b[3]), dy = Math.max(b[1] - y, 0, y - b[4]), dz = Math.max(b[2] - z, 0, z - b[5]);
      if (dx * dx + dy * dy + dz * dz > best) continue;
      if (n.left < 0) {
        for (let k = n.lo; k < n.hi; k++) {
          const f = this.tri[k], q = closestTriangle(this.p, this.faces, f, x, y, z, this.tmp);
          if (q[0] < best) {
            best = q[0];
            winner = f;
            this.best.set(q);
          }
        }
      } else {
        const a = this.nodes[n.left].box, c = this.nodes[n.right].box, da = (a[0] + a[3] - 2 * x) ** 2 + (a[1] + a[4] - 2 * y) ** 2 + (a[2] + a[5] - 2 * z) ** 2, dc = (c[0] + c[3] - 2 * x) ** 2 + (c[1] + c[4] - 2 * y) ** 2 + (c[2] + c[5] - 2 * z) ** 2;
        if (da < dc) {
          stack[head++] = n.right;
          stack[head++] = n.left;
        } else {
          stack[head++] = n.left;
          stack[head++] = n.right;
        }
      }
    }
    return winner;
  }
  sample(x, y, z, out = new Float64Array(4), seed = -1) {
    const f = this.nearest(x, y, z, Infinity, seed);
    if (f < 0) {
      out[0] = Infinity;
      out[1] = out[2] = out[3] = 0;
      return out;
    }
    return this.evaluate(f, x, y, z, out);
  }
  evaluate(f, x, y, z, out = new Float64Array(4)) {
    const q = closestTriangle(this.p, this.faces, f, x, y, z, this.tmp), n = this.normals, faces = this.faces;
    let nx = 0, ny = 0, nz = 0;
    for (let j = 0; j < 3; j++) {
      const k = faces[f + j] * 3, w = q[4 + j];
      nx += n[k] * w;
      ny += n[k + 1] * w;
      nz += n[k + 2] * w;
    }
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    const dx = x - q[1], dy = y - q[2], dz = z - q[3], dot = dx * nx + dy * ny + dz * nz;
    out[0] = Math.sqrt(q[0]) * (dot < 0 ? -1 : 1);
    if (q[0] > 1e-16) {
      const s = (dot < 0 ? -1 : 1) / Math.sqrt(q[0]);
      out[1] = dx * s;
      out[2] = dy * s;
      out[3] = dz * s;
    } else {
      out[1] = nx;
      out[2] = ny;
      out[3] = nz;
    }
    return out;
  }
};
function outwardPacket(packet, positions, sdf) {
  let off = 0;
  const signs = [];
  const panels = packet.spec.panels.map((panel) => {
    let vote = 0;
    const q = new Float64Array(4);
    for (const [a0, b0, c0] of panel.triangles) {
      const a = (off + a0) * 3, b = (off + b0) * 3, c = (off + c0) * 3, ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2], vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      sdf.sample((positions[a] + positions[b] + positions[c]) / 3, (positions[a + 1] + positions[b + 1] + positions[c + 1]) / 3, (positions[a + 2] + positions[b + 2] + positions[c + 2]) / 3, q);
      vote += (uy * vz - uz * vy) * q[1] + (uz * vx - ux * vz) * q[2] + (ux * vy - uy * vx) * q[3];
    }
    const sign = vote < 0 ? -1 : 1;
    signs.push({ id: panel.id, sign, vote });
    off += panel.uvMm.length;
    return { ...panel, triangles: sign < 0 ? panel.triangles.map(([a, b, c]) => [a, c, b]) : panel.triangles };
  });
  return { packet: { ...packet, spec: { ...packet.spec, panels } }, signs };
}

// pack/parent/native-motion.mjs
var I = () => new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function mul(a, b, out = new Float64Array(16)) {
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) out[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
  return out;
}
function rotvec(v) {
  const x = v[0] * Math.PI / 180, y = v[1] * Math.PI / 180, z = v[2] * Math.PI / 180, t = Math.hypot(x, y, z), R = I();
  if (t < 1e-12) return R;
  const a = x / t, b = y / t, c = z / t, s = Math.sin(t), co = Math.cos(t), k = 1 - co;
  R[0] = co + a * a * k;
  R[1] = a * b * k - c * s;
  R[2] = a * c * k + b * s;
  R[4] = b * a * k + c * s;
  R[5] = co + b * b * k;
  R[6] = b * c * k - a * s;
  R[8] = c * a * k - b * s;
  R[9] = c * b * k + a * s;
  R[10] = co + c * c * k;
  return R;
}
function apply(m, x, y, z, out, k) {
  out[k] = m[0] * x + m[1] * y + m[2] * z + m[3];
  out[k + 1] = m[4] * x + m[5] * y + m[6] * z + m[7];
  out[k + 2] = m[8] * x + m[9] * y + m[10] * z + m[11];
}
function motionPose(id, time, amplitude = 1) {
  const t = Math.max(0, time), ramp = Math.min(1, t / 1.2), q = Math.sin(t * Math.PI * 2 / 5) * ramp, a = amplitude, pose = {};
  if (id === "raise") {
    const lift = (1 - Math.cos(t * Math.PI * 2 / 6)) * 0.5 * a;
    pose["upperarm01.L"] = [0, -28 * lift, 0];
    pose["upperarm01.R"] = [0, 28 * lift, 0];
    pose["lowerarm01.L"] = [0, 0, -12 * lift];
    pose["lowerarm01.R"] = [0, 0, 12 * lift];
  }
  if (id === "twist") {
    pose.spine03 = [0, 0, 9 * q * a];
    pose.spine02 = [0, 0, 5 * q * a];
    pose["upperarm01.L"] = [0, 0, -4 * q * a];
    pose["upperarm01.R"] = [0, 0, -4 * q * a];
  }
  if (id === "step") {
    const u = Math.sin(t * Math.PI * 2 / 3) * ramp * a;
    pose["upperleg01.L"] = [-10 * u, 0, 0];
    pose["upperleg01.R"] = [10 * u, 0, 0];
    pose["lowerleg01.L"] = [13 * Math.max(0, u), 0, 0];
    pose["lowerleg01.R"] = [13 * Math.max(0, -u), 0, 0];
    pose["upperarm01.L"] = [5 * u, 0, 0];
    pose["upperarm01.R"] = [-5 * u, 0, 0];
  }
  return pose;
}
var NativeMotion = class {
  constructor({ rig, positions, bodyCount, headSkinIndices, headSkinWeights, boneOrder }) {
    if (rig.source !== "anny") throw Error("MP04 only supports this frozen native Anny owner");
    this.rig = rig;
    this.base = Float64Array.from(positions);
    this.bodyCount = bodyCount;
    this.headIndices = headSkinIndices;
    this.headWeights = headSkinWeights;
    this.order = boneOrder || rig.names.map((_, i) => i);
    this.weights = rig.weights;
    this.influence = Float64Array.from(rig.restPositionsPerInfluence);
    this.skin = rig.names.map(I);
    this.world = rig.names.map(I);
    this.positions = new Float32Array(positions.length);
    this.native = new Float64Array(positions.length);
    this.correction = new Float64Array(bodyCount * 3);
    this.anchors = new Float32Array(rig.names.length * 3);
    const w = this.weights, one = new Float64Array(3), initial = new Float64Array(bodyCount * 3);
    for (let i = 0; i < bodyCount; i++) for (let k = w.ptr[i]; k < w.ptr[i + 1]; k++) {
      const j = w.joints[k], n = k * 3;
      apply(rig.skinMatrices[j], this.influence[n], this.influence[n + 1], this.influence[n + 2], one, 0);
      this.influence.set(one, n);
      for (let d = 0; d < 3; d++) initial[i * 3 + d] += w.values[k] * one[d];
    }
    for (let i = 0; i < this.correction.length; i++) this.correction[i] = this.base[i] - initial[i];
    this.evaluate({});
  }
  evaluate(pose = {}) {
    const r = this.rig;
    for (const j of this.order) {
      const delta = pose[r.names[j]], rest = r.restMatrices[j], R = delta ? rotvec(delta) : I();
      if (delta) {
        const x = rest[3], y = rest[7], z = rest[11];
        R[3] = x - R[0] * x - R[1] * y - R[2] * z;
        R[7] = y - R[4] * x - R[5] * y - R[6] * z;
        R[11] = z - R[8] * x - R[9] * y - R[10] * z;
      }
      if (r.parents[j] >= 0) mul(this.skin[r.parents[j]], R, this.skin[j]);
      else this.skin[j].set(R);
      mul(this.skin[j], rest, this.world[j]);
      const m = this.world[j];
      this.anchors[j * 3] = m[3];
      this.anchors[j * 3 + 1] = m[11];
      this.anchors[j * 3 + 2] = -m[7];
    }
    const out = this.native, w = this.weights, inf = this.influence;
    out.fill(0);
    for (let i = 0; i < this.bodyCount; i++) {
      const a = i * 3, dx = this.correction[a], dy = this.correction[a + 1], dz = this.correction[a + 2];
      for (let k = w.ptr[i]; k < w.ptr[i + 1]; k++) {
        const m = this.skin[w.joints[k]], b = k * 3, x = inf[b] + dx, y = inf[b + 1] + dy, z = inf[b + 2] + dz, weight = w.values[k];
        out[a] += weight * (m[0] * x + m[1] * y + m[2] * z + m[3]);
        out[a + 1] += weight * (m[4] * x + m[5] * y + m[6] * z + m[7]);
        out[a + 2] += weight * (m[8] * x + m[9] * y + m[10] * z + m[11]);
      }
    }
    for (let i = this.bodyCount; i < out.length / 3; i++) {
      const a = i * 3, h = i - this.bodyCount, x = this.base[a], y = this.base[a + 1], z = this.base[a + 2], ids = this.headIndices[h], weights = this.headWeights[h];
      for (let k = 0; k < ids.length; k++) {
        const m = this.skin[ids[k]], weight = weights[k];
        out[a] += weight * (m[0] * x + m[1] * y + m[2] * z + m[3]);
        out[a + 1] += weight * (m[4] * x + m[5] * y + m[6] * z + m[7]);
        out[a + 2] += weight * (m[8] * x + m[9] * y + m[10] * z + m[11]);
      }
    }
    for (let i = 0; i < out.length; i += 3) {
      this.positions[i] = out[i];
      this.positions[i + 1] = out[i + 2];
      this.positions[i + 2] = -out[i + 1];
    }
    this.pose = pose;
    return this.positions;
  }
  at(id, time) {
    return this.evaluate(motionPose(id, time));
  }
  point(index, p, out = new Float64Array(3)) {
    const m = this.skin[index], x = p[0], y = -p[2], z = p[1];
    out[0] = m[0] * x + m[1] * y + m[2] * z + m[3];
    out[1] = m[8] * x + m[9] * y + m[10] * z + m[11];
    out[2] = -(m[4] * x + m[5] * y + m[6] * z + m[7]);
    return out;
  }
  audit() {
    let maxBoneError = 0;
    for (let j = 0; j < this.rig.names.length; j++) {
      const parent = this.rig.parents[j];
      if (parent < 0) continue;
      const a = this.world[j], b = this.world[parent], c = this.rig.restMatrices[j], d = this.rig.restMatrices[parent];
      maxBoneError = Math.max(maxBoneError, Math.abs(Math.hypot(a[3] - b[3], a[7] - b[7], a[11] - b[11]) - Math.hypot(c[3] - d[3], c[7] - d[7], c[11] - d[11])));
    }
    return { source: "original Anny local-ref FK", bones: this.rig.names.length, weights: "unpruned original joint-conditioned influences", maxBoneLengthErrorMM: maxBoneError * 1e3, topologyChanged: false, pose: this.pose };
  }
};

// pack/parent/native/knit-r11.mjs
function knitEnvelope({ pitch = 6e-3, depth = 1, kind = 0, radius = 7e-4, scale = 1, variation = 0.06, pattern = 1 } = {}) {
  const d = pitch * 0.159154943091895 * depth, R = radius * scale, maxR = R * (1 + variation), top = d, bottom = pattern ? -d - 2.8 * R : -d;
  return { offset: -(top + bottom) / 2, thickness: top - bottom + 2 * maxR, top: top + maxR, bottom: bottom - maxR };
}

// pack/parent/material-settings.mjs
function layerLayout(info) {
  const s = info.settings;
  if (info.family === "knit") {
    const e = knitEnvelope({ pitch: s.gauge * 1e-3, depth: s.depth, radius: s.diameter * 5e-4, variation: 0.06, pattern: 0 });
    const thickness = e.thickness * 1e3, half = thickness * 0.5;
    return { half, inner: 0.35 + half, outer: 0.35 + half, thickness: 0.35 + thickness, layers: 1, target: "former double-layer envelope", nativeEnvelope: e };
  }
  const t = info.family === "leather" ? s.thickness : info.geometry.thickness;
  return { inner: 0.2, outer: 0.2 + t, thickness: t + 0.2, layers: 1 };
}

// pack/parent/coupled-cloth.mjs
var CoupledCloth = class {
  constructor(rows, { sdf, actor, settings = {}, motion = "idle" } = {}) {
    this.sdf = sdf;
    this.actor = actor ? new NativeMotion(actor) : null;
    this.body = this.actor ? new MeshContact(this.actor.positions, actor.faces) : null;
    this.bodyActive = false;
    this.motion = motion;
    this.motionTime = 0;
    this.elapsed = 0;
    this.simulationMs = 0;
    this.pairContacts = 0;
    this.frameSequence = 0;
    this.safetyTrips = 0;
    this.actorPacket = actor;
    this.solvers = rows.map((r, i) => {
      const o = outwardPacket(r.packet, r.positions, sdf), s = new ClothSolver2(o.packet, r.positions, { sdf, family: r.info.family, doubleLayer: false, role: i ? "bottom" : "top", ...settings });
      s.bodyCache = new Int32Array(s.count).fill(-1);
      s.orientation = o.signs;
      s.originalPacket = r.packet;
      s.info = r.info;
      return s;
    });
    const [a, b] = this.solvers;
    this.bottomSurface = new MeshContact(b.p, b.faces);
    this.pairCache = new Int32Array(a.count).fill(-1);
    this.pairScratch = new Float64Array(7);
    this.contactGap = (layerLayout(b.info).thickness + 1e-3) * 1e-3 + 12e-4;
    this.saved = this.solvers.map((s) => s.p.slice());
  }
  init() {
    for (let k = 0; k < 8; k++) this.step(1 / 30, false);
    this.initial = this.solvers.map((s) => s.p.slice());
    this.initialTime = this.elapsed;
  }
  step() {
    throw Error("\u7ECF\u9A8C\u8BC1\u7684 WebAssembly \u7269\u7406\u6838\u672A\u8F7D\u5165");
  }
  setMotion(id) {
    if (!["idle", "raise", "twist", "step"].includes(id)) throw Error("\u672A\u77E5\u52A8\u4F5C");
    if (id === this.motion) return;
    this.motion = id;
    this.motionTime = 0;
    this.bodyActive = id !== "idle";
    if (!this.bodyActive && this.actor) {
      this.actor.evaluate({});
      this.body.refit();
    }
    for (const s of this.solvers) s.bodyCache.fill(-1);
    this.acceleration?.solvers.forEach((a) => a.cache.view.fill(-1));
  }
  rows() {
    return this.solvers.map((s) => ({ positions: s.output.slice(), normals: s.normals.slice(), orientation: s.orientation, indices: s.packet.spec.panels.flatMap((p, i) => {
      const off = s.packet.spec.panels.slice(0, i).reduce((n, p2) => n + p2.uvMm.length, 0);
      return p.triangles.flatMap((t) => t.map((v) => v + off));
    }), audit: { ...s.audit(false), ...this.bodyActive ? { minBodyVertexDistanceMM: null, minBodyInteriorSampleMM: null } : {}, pairedGarmentContacts: this.pairContacts, pairedGapMM: this.contactGap * 1e3, bodyContactSource: this.bodyActive ? "same-frame original animated body triangles" : "original static SDF", frameSequence: this.frameSequence } }));
  }
  set(settings) {
    for (const s of this.solvers) s.set(settings);
  }
  reset() {
    this.motion = "idle";
    this.motionTime = 0;
    this.bodyActive = false;
    this.actor?.evaluate({});
    this.body?.refit();
    for (let i = 0; i < this.solvers.length; i++) {
      const s = this.solvers[i];
      s.p.set(this.initial?.[i] || this.saved[i]);
      s.v.fill(0);
      s.time = 0;
      s.steps = 0;
      s.expand();
    }
    this.elapsed = 0;
    this.frameSequence++;
    this.acceleration?.solvers.forEach((a) => a.cache.view.fill(-1));
    this.acceleration?.pairCache.view.fill(-1);
    if (this.acceleration?.waist) {
      this.acceleration.waist.update();
      this.acceleration.waist.previous.set(this.acceleration.waist.target);
    }
    return this.rows();
  }
  tug() {
    for (const s of this.solvers) s.tug();
  }
  audit(dense = false) {
    if (this.bodyActive) this.body.refit(this.actor.positions);
    const body = this.bodyActive ? this.body : this.sdf;
    let minBody = Infinity, minPair = Infinity, pairSamples = 0;
    const q = new Float64Array(4), [a, b] = this.solvers;
    for (const s of this.solvers) {
      for (let i = 0; i < s.count; i++) minBody = Math.min(minBody, body.sample(s.p[i * 3], s.p[i * 3 + 1], s.p[i * 3 + 2], q)[0]);
      if (dense) for (let f = 0; f < s.faces.length; f += 3) {
        const p = s.p, x = s.faces[f] * 3, y = s.faces[f + 1] * 3, z = s.faces[f + 2] * 3;
        minBody = Math.min(minBody, body.sample((p[x] + p[y] + p[z]) / 3, (p[x + 1] + p[y + 1] + p[z + 1]) / 3, (p[x + 2] + p[y + 2] + p[z + 2]) / 3, q)[0]);
      }
    }
    this.bottomSurface.refit();
    for (let i = 0; i < a.count; i++) {
      const j = i * 3, f = this.bottomSurface.nearest(a.p[j], a.p[j + 1], a.p[j + 2], 0.025);
      if (f < 0) continue;
      this.bottomSurface.evaluate(f, a.p[j], a.p[j + 1], a.p[j + 2], q);
      if (this.bottomSurface.tmp[4] > 1e-3 && this.bottomSurface.tmp[5] > 1e-3 && this.bottomSurface.tmp[6] > 1e-3) {
        minPair = Math.min(minPair, q[0]);
        pairSamples++;
      }
    }
    if (dense) {
      for (const e of a.edges) {
        const p = a.p, pt = [0, 1, 2].map((k) => (p[e.a * 3 + k] + p[e.b * 3 + k]) * 0.5), face = this.bottomSurface.nearest(...pt, 0.025);
        if (face < 0) continue;
        this.bottomSurface.evaluate(face, ...pt, q);
        if (this.bottomSurface.tmp[4] > 1e-3 && this.bottomSurface.tmp[5] > 1e-3 && this.bottomSurface.tmp[6] > 1e-3) {
          minPair = Math.min(minPair, q[0]);
          pairSamples++;
        }
      }
      for (let f = 0; f < a.faces.length; f += 3) {
        const ids = [a.faces[f], a.faces[f + 1], a.faces[f + 2]], p = a.p, pt = [0, 1, 2].map((k) => ids.reduce((sum, i) => sum + p[i * 3 + k], 0) / 3), face = this.bottomSurface.nearest(...pt, 0.025);
        if (face < 0) continue;
        this.bottomSurface.evaluate(face, ...pt, q);
        if (this.bottomSurface.tmp[4] > 1e-3 && this.bottomSurface.tmp[5] > 1e-3 && this.bottomSurface.tmp[6] > 1e-3) {
          minPair = Math.min(minPair, q[0]);
          pairSamples++;
        }
      }
    }
    return { motion: this.motion, motionTime: this.motionTime, simulationSeconds: this.elapsed, frameSequence: this.frameSequence, solverMs: this.simulationMs, nativeRig: this.actor?.audit(), bodyMinimumSampleMM: minBody * 1e3, pairMinimumSampleMM: minPair * 1e3, pairSamples, pairTargetMM: this.contactGap * 1e3, pairedCorrections: this.pairContacts, continuousCollision: false, allSelfCollision: false, clothShapeSkinning: false, bodyFrameMatchesCloth: true };
  }
};

// pack/parent/waist-attachments.mjs
var basis = (p, F, f) => {
  const a = F[f] * 3, b = F[f + 1] * 3, c = F[f + 2] * 3, u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]], v = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...u) || 1, h = Math.hypot(...n) || 1;
  for (let k = 0; k < 3; k++) {
    u[k] /= l;
    n[k] /= h;
  }
  return [u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], n];
};
var WaistAttachments = class {
  constructor(world2) {
    this.world = world2;
    const s = world2.solvers[1], body = world2.body;
    this.rows = s.pins.map((id) => {
      const v = s.p.slice(id * 3, id * 3 + 3), f = body.nearest(...v), q = closestTriangle(body.p, body.faces, f, ...v), axes = basis(body.p, body.faces, f), offset = axes.map((axis) => axis.reduce((sum, x, k) => sum + x * (v[k] - q[1 + k]), 0));
      return { id, f, bary: Array.from(q.slice(4)), offset };
    });
    this.previous = new Float64Array(this.rows.length * 3);
    this.target = this.previous.slice();
    this.update();
    this.previous.set(this.target);
  }
  update() {
    const p = this.world.actor.positions, F = this.world.body.faces;
    for (let i = 0; i < this.rows.length; i++) {
      const r = this.rows[i], axes = basis(p, F, r.f);
      for (let k = 0; k < 3; k++) {
        let value = 0;
        for (let j = 0; j < 3; j++) value += p[F[r.f + j] * 3 + k] * r.bary[j] + axes[j][k] * r.offset[j];
        this.target[i * 3 + k] = value;
      }
    }
  }
  begin() {
    this.previous.set(this.target);
    this.update();
  }
  apply(fraction = 1) {
    const p = this.world.solvers[1].p;
    for (let i = 0; i < this.rows.length; i++) for (let k = 0; k < 3; k++) p[this.rows[i].id * 3 + k] = this.previous[i * 3 + k] * (1 - fraction) + this.target[i * 3 + k] * fraction;
  }
};

// pack/parent/wasm-cloth.mjs
async function loadClothKernel(bytes = null) {
  const imports = { env: { atan2: Math.atan2 } };
  const raw = bytes || await (await fetch(new URL("./cloth-kernel.wasm", import.meta.url))).arrayBuffer();
  return (await WebAssembly.instantiate(raw, imports)).instance;
}
var WasmCloth = class {
  constructor(world2, instance) {
    this.world = world2;
    this.e = instance.exports;
    this.memory = this.e.memory;
    this.poolBytes = 0;
    const allocate = (T, data) => {
      const a = typeof data === "number" ? new T(data) : T.from(data), ptr = this.e.alloc(a.byteLength);
      if (ptr + a.byteLength > this.memory.buffer.byteLength) throw Error("\u7269\u7406\u5185\u5B58\u9884\u7B97\u4E0D\u8DB3");
      const view = new T(this.memory.buffer, ptr, a.length);
      view.set(a);
      this.poolBytes += a.byteLength;
      return { ptr, view };
    };
    this.allocate = allocate;
    const sdf = world2.sdf;
    this.sdf = allocate(Int16Array, sdf.data);
    this.meta = allocate(Float64Array, [...sdf.n, ...sdf.o, sdf.h, sdf.q, sdf.shift]);
    this.solvers = world2.solvers.map((s) => {
      const a = { s };
      for (const k of ["p", "v", "old", "w"]) {
        a[k] = allocate(Float64Array, s[k]);
        s[k] = a[k].view;
      }
      a.faces = allocate(Int32Array, s.faces);
      a.edges = allocate(Float64Array, s.edges.flatMap((e) => [e.a, e.b, e.rest, 0]));
      a.bends = allocate(Float64Array, s.bends.flatMap((b) => [b.a, b.b, b.c, b.d, 0, b.rest]));
      a.cache = allocate(Int32Array, new Int32Array(s.count + s.edges.length + s.faces.length / 3).fill(-1));
      return a;
    });
    world2.bottomSurface.p = world2.solvers[1].p;
    this.bottom = this.mesh(world2.bottomSurface, this.solvers[1].p);
    this.body = world2.body ? this.mesh(world2.body) : null;
    this.pairCache = allocate(Int32Array, new Int32Array(world2.solvers[0].count).fill(-1));
    this.pairInteriorCache = allocate(Int32Array, new Int32Array(world2.solvers[0].edges.length + world2.solvers[0].faces.length / 3).fill(-1));
    this.actorPrevious = world2.actor?.positions.slice();
    this.actorTarget = world2.actor?.positions.slice();
    this.waist = world2.actor ? new WaistAttachments(world2) : null;
    world2.backend = "WASM / same metric constraints + actual triangle contacts";
    world2.wasmBytes = this.poolBytes;
  }
  mesh(mesh, shared = null) {
    const a = this.allocate, p = shared || a(Float64Array, mesh.p), normal = a(Float64Array, mesh.p.length), faces = a(Int32Array, mesh.faces), order = a(Int32Array, mesh.tri), nodes = a(Float64Array, mesh.nodes.flatMap((n) => [n.lo, n.hi, n.left, n.right, ...n.box]));
    const result = { p, normal, faces, order, nodes, count: mesh.p.length / 3, nFaces: mesh.faces.length / 3, nNodes: mesh.nodes.length };
    this.refit(result);
    return result;
  }
  refit(m) {
    this.e.refit(m.p.ptr, m.faces.ptr, m.nFaces, m.normal.ptr, m.nodes.ptr, m.nNodes, m.order.ptr, m.count);
  }
  project(a, refresh, dense) {
    const w = this.world, m = this.body, kind = w.bodyActive ? 1 : 0;
    return this.e.body_project(a.p.ptr, a.w.ptr, a.s.count, a.faces.ptr, a.s.faces.length / 3, a.edges.ptr, a.s.edges.length, kind, this.sdf.ptr, this.meta.ptr, m?.p.ptr || 0, m?.normal.ptr || 0, m?.faces.ptr || 0, m?.nodes.ptr || 0, m?.order.ptr || 0, a.cache.ptr, a.s.settings.clearanceMM * 1e-3, refresh ? 1 : 0, dense ? 1 : 0);
  }
  pair(refresh, oneWay) {
    const [a, b] = this.solvers, m = this.bottom;
    return this.e.pair_project(a.p.ptr, a.w.ptr, a.s.count, b.p.ptr, b.w.ptr, m.normal.ptr, m.faces.ptr, m.nodes.ptr, m.order.ptr, this.pairCache.ptr, this.world.contactGap, refresh ? 1 : 0, oneWay ? 1 : 0);
  }
  pairDense() {
    const [a, b] = this.solvers, m = this.bottom;
    return this.e.pair_surface(a.p.ptr, a.w.ptr, a.faces.ptr, a.s.faces.length / 3, a.edges.ptr, a.s.edges.length, b.p.ptr, b.w.ptr, m.normal.ptr, m.faces.ptr, m.nodes.ptr, m.order.ptr, this.pairInteriorCache.ptr, this.world.contactGap, 1, 1);
  }
  step(dt = 1 / 60, advanceMotion = true) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) throw Error("\u65E0\u6548\u6A21\u62DF\u6B65\u957F");
    const t0 = performance.now(), w = this.world, snapshot = this.solvers.map((a) => ({ p: a.s.p.slice(), v: a.s.v.slice(), time: a.s.time, steps: a.s.steps })), oldTime = w.motionTime, oldElapsed = w.elapsed, sub = Math.max(1, Math.ceil(dt * 240)), h = dt / sub, e = this.e;
    w.pairContacts = 0;
    if (w.actor && advanceMotion && w.motion !== "idle") {
      this.actorPrevious.set(w.actor.positions);
      w.motionTime += dt;
      w.actor.at(w.motion, w.motionTime);
      this.actorTarget.set(w.actor.positions);
      this.waist?.begin();
      w.bodyActive = true;
    }
    for (let ss = 0; ss < sub; ss++) {
      if (w.bodyActive) {
        const p = this.body.p.view, a = this.actorPrevious, b = this.actorTarget, f = (ss + 1) / sub;
        for (let i = 0; i < p.length; i++) p[i] = a[i] * (1 - f) + b[i] * f;
        this.refit(this.body);
        this.waist?.apply(f);
      }
      for (const a of this.solvers) {
        const s = a.s;
        e.predict(a.p.ptr, a.v.ptr, a.old.ptr, a.w.ptr, s.count, h, Math.exp(-s.settings.damping * h), 9.81 * s.settings.gravity);
        e.reset_lambda(a.edges.ptr, s.edges.length, 4, 3);
        e.reset_lambda(a.bends.ptr, s.bends.length, 6, 4);
      }
      this.refit(this.bottom);
      for (let it = 0; it < 16; it++) {
        for (const a of this.solvers) {
          const s = a.s, alpha = (s.family === "knit" ? 35e-5 : s.family === "leather" ? 3e-5 : 6e-5) * s.settings.softness / (h * h);
          e.distance_batch(a.p.ptr, a.w.ptr, a.edges.ptr, s.edges.length, alpha);
          if (it % 2 === 0) e.bend_batch(a.p.ptr, a.w.ptr, a.bends.ptr, s.bends.length, (s.family === "leather" ? 2800 : s.family === "denim" ? 6e3 : 12e3) / (Math.max(0.05, s.settings.bend) * h * h));
          e.strain_batch(a.p.ptr, a.w.ptr, a.edges.ptr, s.edges.length, s.family === "knit" ? 0.82 : 0.9, s.family === "knit" ? 1.18 : 1.12);
          s.contacts = this.project(a, it === 0 && ss === 0, it === 15);
        }
        if (it % 2 === 0) w.pairContacts += this.pair(it === 0 && ss === 0, false);
      }
      for (let it = 0; it < 12; it++) {
        for (const a of this.solvers) {
          const s = a.s;
          e.strain_batch(a.p.ptr, a.w.ptr, a.edges.ptr, s.edges.length, s.family === "knit" ? 0.82 : 0.9, s.family === "knit" ? 1.18 : 1.12);
          s.contacts += this.project(a, ss === sub - 1 && it === 11, it === 11);
        }
        this.refit(this.bottom);
        w.pairContacts += this.pair(it === 11, it >= 10);
        if (it >= 10) w.pairContacts += this.pairDense();
      }
      for (const a of this.solvers) this.project(a, false, false);
      this.refit(this.bottom);
      w.pairContacts += this.pair(true, true);
      for (let j = 0; j < 3; j++) {
        w.pairContacts += this.pairDense();
        w.pairContacts += this.pair(false, true);
      }
      for (const a of this.solvers) {
        if (!e.finish(a.p.ptr, a.v.ptr, a.old.ptr, a.w.ptr, a.s.count, h, 1)) {
          w.safetyTrips++;
          throw Error("\u7269\u7406\u5DF2\u6682\u505C\uFF1A\u65E0\u6548\u6570\u503C");
        }
        a.s.time += h;
        a.s.steps++;
      }
      w.elapsed += h;
    }
    for (const a of this.solvers) a.s.expand();
    if (this.solvers.some((a) => {
      const r = a.s.audit(false);
      return !Number.isFinite(r.maxEdgeStretch) || r.maxEdgeStretch > 1.45;
    })) {
      for (let i = 0; i < this.solvers.length; i++) {
        const a = this.solvers[i], r = snapshot[i];
        a.s.p.set(r.p);
        a.s.v.set(r.v);
        a.s.time = r.time;
        a.s.steps = r.steps;
        a.s.expand();
        a.cache.view.fill(-1);
      }
      w.motionTime = oldTime;
      w.elapsed = oldElapsed;
      w.actor?.at(w.motion, oldTime);
      w.body?.refit();
      this.pairCache.view.fill(-1);
      w.safetyTrips++;
      throw Error("\u7269\u7406\u5E94\u53D8\u8D85\u51FA\u5DE5\u7A0B\u5B89\u5168\u8303\u56F4\uFF0C\u5DF2\u4FDD\u7559\u4E0A\u4E00\u5E27");
    }
    w.frameSequence++;
    w.simulationMs = performance.now() - t0;
    return w.rows();
  }
};
function accelerateWorld(world2, instance) {
  const backend = new WasmCloth(world2, instance);
  world2.step = backend.step.bind(backend);
  world2.acceleration = backend;
  return world2;
}

// pack/new/SourceActor.mjs
var SourceActor = class {
  constructor(p) {
    Object.assign(this, { rig: p.rig, base: Float64Array.from(p.positions), range: Float32Array.from(p.range), packed: Float64Array.from(p.packed) });
    this.positions = new Float32Array(p.positions.length);
    this.native = new Float64Array(p.positions.length);
    this.skin = p.rig.names.map(() => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    this.world = p.rig.restMatrices.map((m) => Array.from(m));
    this.pending = null;
    this.evaluate();
  }
  evaluate() {
    for (let i = 0; i < this.native.length / 3; i++) {
      let x = 0, y = 0, z = 0;
      for (let n = 0; n < this.range[i * 2 + 1]; n++) {
        const k = (this.range[i * 2] + n) * 8, j = this.packed[k + 3], w = this.packed[k + 4], m = this.skin[j], a = this.packed[k], b = this.packed[k + 1], c = this.packed[k + 2];
        x += w * (m[0] * a + m[1] * b + m[2] * c + m[3]);
        y += w * (m[4] * a + m[5] * b + m[6] * c + m[7]);
        z += w * (m[8] * a + m[9] * b + m[10] * c + m[11]);
      }
      this.native.set([x, y, z], i * 3);
      this.positions.set([x, z, -y], i * 3);
    }
    return this.positions;
  }
  at() {
    if (this.pending) {
      this.skin = this.pending.skin;
      this.world = this.pending.world;
      this.pending = null;
    }
    return this.evaluate();
  }
  audit() {
    let max = 0;
    for (let j = 0; j < this.rig.names.length; j++) {
      const p = this.rig.parents[j];
      if (p < 0) continue;
      const a = this.world[j], b = this.world[p], c = this.rig.restMatrices[j], d = this.rig.restMatrices[p];
      max = Math.max(max, Math.abs(Math.hypot(a[3] - b[3], a[7] - b[7], a[11] - b[11]) - Math.hypot(c[3] - d[3], c[7] - d[7], c[11] - d[11])));
    }
    return { source: "pinned original source sampler; no authored oscillations", maxBoneLengthErrorMM: max * 1e3, bones: this.rig.names.length, weightsTruncated: false };
  }
};

// pack/new/SourcePhysics.mjs
function fitRows(rows, oldBody, actor, faces) {
  if (oldBody.length !== actor.native.length) throw Error("Body correspondence vertex count changed");
  const old = new Float32Array(oldBody.length);
  for (let i = 0; i < old.length; i += 3) {
    old[i] = oldBody[i];
    old[i + 1] = oldBody[i + 2];
    old[i + 2] = -oldBody[i + 1];
  }
  const mesh = new MeshContact(old, faces), q = new Float64Array(7);
  let max = 0;
  const fitted = rows.map((r) => {
    const p = Float32Array.from(r.positions);
    for (let i = 0; i < p.length; i += 3) {
      const f = mesh.nearest(p[i], p[i + 1], p[i + 2]);
      closestTriangle(old, mesh.faces, f, p[i], p[i + 1], p[i + 2], q);
      for (let k = 0; k < 3; k++) {
        let delta = 0;
        for (let v = 0; v < 3; v++) {
          const j = mesh.faces[f + v] * 3 + k;
          delta += (actor.positions[j] - old[j]) * q[4 + v];
        }
        max = Math.max(max, Math.abs(delta));
        p[i + k] += delta;
      }
    }
    return { ...r, positions: p };
  });
  return { rows: fitted, maxTransferredCoordinateM: max };
}
async function makeSourceWorld({ rows, oldBody, actor: packet, settings, wasm, initialFrame = null }) {
  const actor = new SourceActor(packet);
  if (initialFrame) {
    actor.pending = initialFrame;
    actor.at();
  }
  const surface = new MeshContact(actor.positions, packet.faces), fitted = initialFrame ? initialPoseRows(rows, oldBody, actor, packet.faces) : fitRows(rows, oldBody, actor, packet.faces);
  Object.assign(surface, { data: new Int16Array(8), n: [2, 2, 2], o: [0, 0, 0], h: 1, q: 1, shift: 0 });
  const world2 = new CoupledCloth(fitted.rows, { sdf: surface, settings });
  world2.actor = actor;
  world2.actorPacket = packet;
  world2.body = surface;
  world2.bodyActive = true;
  world2.motion = "source";
  for (const s of world2.solvers) {
    const prior = s.audit.bind(s);
    s.audit = (dense = false) => {
      if (dense) return prior(true);
      let lo = Infinity, hi = 0;
      for (const e of s.edges) {
        const a = e.a * 3, b = e.b * 3, r = Math.hypot(s.p[a] - s.p[b], s.p[a + 1] - s.p[b + 1], s.p[a + 2] - s.p[b + 2]) / e.rest;
        lo = Math.min(lo, r);
        hi = Math.max(hi, r);
      }
      return { type: "original XPBD distance/dihedral", particles: s.count, minEdgeStretch: lo, maxEdgeStretch: hi, seconds: s.time, sewnPairs: s.seamPairs.length, bodyDistanceNotSampled: true };
    };
  }
  accelerateWorld(world2, await loadClothKernel(wasm));
  world2.fit = fitted;
  world2.stepSource = (frame, dt = 1 / 30) => {
    const before = { skin: actor.skin.map((m) => m.slice()), world: actor.world.map((m) => m.slice()) };
    actor.pending = frame;
    try {
      world2.step(dt, true);
    } catch (e) {
      actor.pending = before;
      actor.at();
      surface.refit();
      world2.acceleration.actorPrevious.set(actor.positions);
      world2.acceleration.actorTarget.set(actor.positions);
      throw e;
    }
    surface.refit();
    return world2.rows();
  };
  world2.motionTime = 0;
  return world2;
}
function initialPoseRows(rows, neutral, actor, faces) {
  const old = new Float32Array(neutral.length);
  for (let i = 0; i < old.length; i += 3) old.set([neutral[i], neutral[i + 2], -neutral[i + 1]], i);
  const mesh = new MeshContact(old, faces), q = new Float64Array(7);
  let maximum = 0;
  const basis2 = (p, f) => {
    const a = faces[f] * 3, b = faces[f + 1] * 3, c = faces[f + 2] * 3, u = [0, 1, 2].map((k) => p[b + k] - p[a + k]), v = [0, 1, 2].map((k) => p[c + k] - p[a + k]), n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...u) || 1, h = Math.hypot(...n) || 1;
    for (let k = 0; k < 3; k++) {
      u[k] /= l;
      n[k] /= h;
    }
    return [u, [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]], n];
  };
  const out = rows.map((r) => {
    const p = Float32Array.from(r.positions);
    for (let i = 0; i < p.length; i += 3) {
      const f = mesh.nearest(p[i], p[i + 1], p[i + 2]);
      closestTriangle(old, mesh.faces, f, p[i], p[i + 1], p[i + 2], q);
      const A = basis2(old, f), B = basis2(actor.positions, f), local = A.map((axis) => axis.reduce((sum, x, k) => sum + x * (p[i + k] - q[1 + k]), 0));
      for (let k = 0; k < 3; k++) {
        let x = 0;
        for (let j = 0; j < 3; j++) x += actor.positions[faces[f + j] * 3 + k] * q[4 + j] + B[j][k] * local[j];
        maximum = Math.max(maximum, Math.abs(x - p[i + k]));
        p[i + k] = x;
      }
    }
    return { ...r, positions: p };
  });
  return { rows: out, maxTransferredCoordinateM: maximum, initializationOnly: true, ongoingClothSkinning: false };
}

// pack/new/physics-worker.mjs
var world = null;
self.onmessage = async ({ data: d }) => {
  try {
    if (d.command === "init") {
      world = await makeSourceWorld(d);
      self.postMessage({ id: d.id, rows: world.rows(), fit: { maxTransferredCoordinateM: world.fit.maxTransferredCoordinateM }, audit: { bodySource: "R05 actual body triangles", oldMotionCacheUsed: false } });
    } else if (d.command === "step") {
      if (!world) throw Error("No world");
      const rows = world.stepSource(d.frame, d.dt);
      self.postMessage({ id: d.id, rows, audit: { bodyAndClothTime: d.time, sourceAction: d.sourceAction, solverMS: world.simulationMs, safetyTrips: world.safetyTrips, sourceRig: world.actor.audit(), pairCorrections: world.pairContacts, continuousCollision: false, allSelfCollision: false } });
    } else if (d.command === "audit") {
      self.postMessage({ id: d.id, audit: world.audit(true) });
    } else throw Error("Unknown command");
  } catch (e) {
    self.postMessage({ id: d.id, error: e.message, stack: e.stack });
  }
};
