// tailor-tops-20261006/web/src/core.mjs
var SCHEMA = "kaopu-sewing-graph@1";
var clone = (x) => JSON.parse(JSON.stringify(x));
var freeze = (o) => {
  if (o && typeof o === "object") {
    Object.values(o).forEach(freeze);
    Object.freeze(o);
  }
  return o;
};
var distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
var finite = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
var fail = (code, detail) => {
  throw new Error(`${code}: ${detail}`);
};
var len = (p, ids) => ids.slice(1).reduce((s, id, k) => s + distance(p.uvMm[id], p.uvMm[ids[k]]), 0);
var cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
var on = (a, b, p) => Math.abs(cross(a, b, p)) < 1e-7 && p[0] >= Math.min(a[0], b[0]) - 1e-7 && p[0] <= Math.max(a[0], b[0]) + 1e-7 && p[1] >= Math.min(a[1], b[1]) - 1e-7 && p[1] <= Math.max(a[1], b[1]) + 1e-7;
var intersect = (a, b, c, d) => cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0 || on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b);
function directedEdge(spec, end) {
  const p = spec.panels.find((p2) => p2.id === end.panelId);
  if (!p) fail("MISSING_PANEL", end.panelId);
  const ids = p.edges[end.edge];
  if (!ids) fail("MISSING_EDGE", `${p.id}.${end.edge}`);
  return { panel: p, ids: end.reverse ? [...ids].reverse() : [...ids] };
}
function validate(spec) {
  if (!spec || spec.schema !== SCHEMA) fail("SCHEMA", `expected ${SCHEMA}`);
  if (spec.units !== "mm") fail("UNITS", "explicit millimetres required");
  if (!Number.isInteger(spec.revision) || spec.revision < 1) fail("REVISION", "positive integer required");
  if (!Array.isArray(spec.panels) || !spec.panels.length || spec.panels.length > 32) fail("PANELS", "1\u201332 panels required");
  for (const key of ["panels", "materials", "seams", "stages"]) {
    if (!Array.isArray(spec[key])) fail("SCHEMA", `${key} array required`);
    const ids = spec[key].map((p) => p.id);
    if (ids.some((x) => typeof x !== "string" || !x) || new Set(ids).size !== ids.length) fail("DUPLICATE_ID", key);
  }
  if (spec.acceptance?.productionReady !== false || spec.acceptance?.fitValidated !== false) fail("ACCEPTANCE", "learning input cannot pre-accept garment");
  let vertexCount = 0, triangleCount = 0;
  for (const m of spec.materials) if (![m.densityKgM2, m.stretchCompliance, m.bendCompliance].every(Number.isFinite) || !(m.densityKgM2 > 0 && m.densityKgM2 < 10 && m.stretchCompliance >= 0 && m.bendCompliance >= 0) || m.calibrated !== false) fail("MATERIAL", "uncalibrated finite positive demo material required");
  for (const p of spec.panels) {
    if (!p.source?.version || !p.source?.kind) fail("SOURCE", p.id);
    if (!spec.materials.some((m) => m.id === p.materialId)) fail("MATERIAL_REFERENCE", p.id);
    if (!Array.isArray(p.uvMm) || p.uvMm.length < 3 || p.uvMm.length > 3e3 || p.uvMm.some((x) => !finite(x) || x.some((v) => Math.abs(v) > 2e3))) fail("MATERIAL_COORDINATES", p.id);
    const indices = (ids) => Array.isArray(ids) && ids.length >= 2 && ids.every((i) => Number.isInteger(i) && i >= 0 && i < p.uvMm.length);
    if (!Array.isArray(p.triangles) || !p.triangles.length || p.triangles.length > 6e3) fail("TRIANGLES", p.id);
    for (const tri of p.triangles) if (!indices(tri) || tri.length !== 3 || new Set(tri).size !== 3 || cross(...tri.map((i) => p.uvMm[i])) <= 1e-7) fail("TRIANGLE_AREA", p.id);
    const usedVertices = new Set(p.triangles.flat()), meshEdges = /* @__PURE__ */ new Map(), triIds = /* @__PURE__ */ new Set();
    for (const tri of p.triangles) {
      const key = [...tri].sort((a, b2) => a - b2).join(":");
      if (triIds.has(key)) fail("DUPLICATE_TRIANGLE", p.id);
      triIds.add(key);
      for (let i = 0; i < 3; i++) {
        const key2 = [tri[i], tri[(i + 1) % 3]].sort((a, b2) => a - b2).join(":");
        meshEdges.set(key2, (meshEdges.get(key2) || 0) + 1);
      }
    }
    if (usedVertices.size !== p.uvMm.length) fail("UNUSED_MATERIAL_POINT", p.id);
    if ([...meshEdges.values()].some((n) => n > 2)) fail("NONMANIFOLD_MATERIAL", p.id);
    if (!indices(p.boundary) || new Set(p.boundary).size !== p.boundary.length) fail("BOUNDARY", p.id);
    const b = p.boundary.map((i) => p.uvMm[i]);
    for (let i = 0; i < b.length; i++) for (let j = i + 2; j < b.length; j++) {
      if (i === 0 && j === b.length - 1) continue;
      if (intersect(b[i], b[(i + 1) % b.length], b[j], b[(j + 1) % b.length])) fail("BOUNDARY_INTERSECTION", p.id);
    }
    const cutEdges = new Set(p.boundary.map((a, i) => [a, p.boundary[(i + 1) % p.boundary.length]].sort((a2, b2) => a2 - b2).join(":")));
    for (const [key, count] of meshEdges) if (count === 1 !== cutEdges.has(key)) fail("CUT_MESH_BOUNDARY", p.id);
    for (const key of cutEdges) if (meshEdges.get(key) !== 1) fail("CUT_MESH_BOUNDARY", p.id);
    if (!p.edges || Object.values(p.edges).some((ids) => !indices(ids))) fail("EDGES", p.id);
    for (const ids of Object.values(p.edges)) for (let i = 1; i < ids.length; i++) if (!meshEdges.has([ids[i - 1], ids[i]].sort((a, b2) => a - b2).join(":"))) fail("SEAM_NOT_ON_MATERIAL", p.id);
    if (!p.placement || !Array.isArray(p.placement.translationMm) || p.placement.translationMm.length !== 3 || !p.placement.translationMm.every(Number.isFinite) || !Number.isFinite(p.placement.rotationYDeg)) fail("PLACEMENT", p.id);
    if (!Array.isArray(p.temporaryPins) || p.temporaryPins.some((i) => !Number.isInteger(i) || i < 0 || i >= p.uvMm.length)) fail("PINS", p.id);
    if (p.allowanceState !== "meshed_flat_unfolded" || !Number.isFinite(p.seamAllowanceMm) || p.seamAllowanceMm < 0) fail("ALLOWANCE", p.id);
    vertexCount += p.uvMm.length;
    triangleCount += p.triangles.length;
  }
  const stages2 = new Map(spec.stages.map((s) => [s.id, s])), visited = /* @__PURE__ */ new Set(), visiting = /* @__PURE__ */ new Set(), owners = [];
  function visit(id) {
    if (!stages2.has(id)) fail("STAGE_REFERENCE", id);
    if (visiting.has(id)) fail("STAGE_CYCLE", id);
    if (visited.has(id)) return;
    visiting.add(id);
    const s = stages2.get(id);
    if (!Array.isArray(s.requires) || !Array.isArray(s.seams)) fail("STAGE_SCHEMA", id);
    s.requires.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  }
  for (const s of spec.stages) {
    visit(s.id);
    for (const id of s.seams) {
      const seam = spec.seams.find((x) => x.id === id);
      if (!seam || seam.stageId !== s.id) fail("SEAM_STAGE", id);
      owners.push(id);
    }
  }
  if (owners.length !== spec.seams.length || new Set(owners).size !== owners.length) fail("SEAM_OWNERSHIP", "each seam belongs to one stage");
  const used = /* @__PURE__ */ new Set(), seamReports = [];
  for (const s of spec.seams) {
    for (const endpoint of [s.a, s.b]) {
      if (typeof endpoint?.reverse !== "boolean") fail("DIRECTION", "explicit edge direction required");
      const k = `${endpoint.panelId}:${endpoint.edge}`;
      if (used.has(k)) fail("EDGE_REUSE", k);
      used.add(k);
    }
    const a = directedEdge(spec, s.a), b = directedEdge(spec, s.b), la = len(a.panel, a.ids), lb = len(b.panel, b.ids);
    if (la <= 0 || lb <= 0 || !Number.isFinite(s.easeMm) || Math.abs(lb - la - s.easeMm) > 0.1) fail("EASE_LENGTH", `${s.id}: B\u2212A must match declared ease, not rescale rest geometry`);
    if (Math.abs(s.easeMm) / la > 0.15) fail("EASE_LIMIT", "demo supports up to 15% declared ease");
    if (!Array.isArray(s.notches) || s.notches.length < 2) fail("NOTCHES", "two or more anchors required");
    if (a.ids.length !== b.ids.length) fail("SAMPLING", "R1 solver requires equal seam sample count; resampling is not implemented");
    for (const id of s.notches) {
      const na = a.panel.edgeNotches?.[s.a.edge]?.find((n) => n.id === id), nb = b.panel.edgeNotches?.[s.b.edge]?.find((n) => n.id === id);
      if (!na || !nb) fail("NOTCH_REFERENCE", `${s.id}.${id}`);
      if (![na.t, nb.t].every((t) => Number.isFinite(t) && t >= 0 && t <= 1)) fail("NOTCH_RANGE", s.id);
      const ta = s.a.reverse ? 1 - na.t : na.t, tb = s.b.reverse ? 1 - nb.t : nb.t;
      if (Math.abs(ta - tb) > 1e-6) fail("NOTCH_DIRECTION", `${s.id}.${id}: oriented notches mismatch`);
    }
    seamReports.push({ id: s.id, lengthAMm: la, lengthBMm: lb, easeMm: lb - la, pairCount: a.ids.length });
  }
  return { valid: true, vertexCount, triangleCount, panelCount: spec.panels.length, seams: seamReports, productionReady: false };
}
function fingerprint(spec) {
  let hash = 2166136261;
  for (const ch of JSON.stringify(spec)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function cut(spec) {
  validate(spec);
  return freeze({ schema: "kaopu-cut-snapshot@1", signature: fingerprint(spec), revision: spec.revision, spec: clone(spec), productionReady: false });
}
var ClothLab = class {
  constructor(snapshot2) {
    if (snapshot2?.schema !== "kaopu-cut-snapshot@1" || snapshot2.signature !== fingerprint(snapshot2.spec)) fail("SNAPSHOT", "valid immutable cut snapshot required");
    validate(snapshot2.spec);
    this.snapshot = freeze(clone(snapshot2));
    this.spec = this.snapshot.spec;
    this.positions = [];
    this.previous = [];
    this.velocity = [];
    this.invMass = [];
    this.baseInvMass = [];
    this.offsets = /* @__PURE__ */ new Map();
    this.constraints = [];
    this.seamConstraints = [];
    this.triangles = [];
    this.pins = /* @__PURE__ */ new Map();
    this.completed = /* @__PURE__ */ new Set(["cut"]);
    this.active = /* @__PURE__ */ new Set();
    this.elapsed = 0;
    this.seamElapsed = 0;
    this.seamDetached = false;
    this.gravity = true;
    this.obstacle = false;
    this.pull = false;
    this.sphere = { center: [0, -0.025, -0.02], radius: 0.052 };
    this.floorY = -0.3;
    this.pullDirections = [];
    for (const p of this.spec.panels) {
      const start = this.positions.length;
      this.offsets.set(p.id, start);
      const theta = p.placement.rotationYDeg * Math.PI / 180, m = specMaterial(this.spec, p), mass = new Array(p.uvMm.length).fill(0), panelIndex = this.spec.panels.indexOf(p);
      for (const tri of p.triangles) {
        const area = cross(...tri.map((i) => p.uvMm[i])) / 2e6;
        tri.forEach((i) => mass[i] += area * m.densityKgM2 / 3);
        this.triangles.push({ ids: tri.map((i) => start + i), uv: tri.map((i) => p.uvMm[i]), panelId: p.id });
      }
      for (let i = 0; i < p.uvMm.length; i++) {
        const [u, v] = p.uvMm[i], t = p.placement.translationMm;
        const point = [(u * Math.cos(theta) + t[0]) / 1e3, (t[1] - v) / 1e3, (u * Math.sin(theta) + t[2]) / 1e3];
        this.positions.push(point);
        this.previous.push([...point]);
        this.velocity.push([0, 0, 0]);
        this.invMass.push(1 / mass[i]);
        this.baseInvMass.push(1 / mass[i]);
        this.pullDirections.push(panelIndex === 0 ? -1 : panelIndex === this.spec.panels.length - 1 ? 1 : 0);
      }
      for (const i of p.temporaryPins) {
        this.pins.set(start + i, [...this.positions[start + i]]);
        this.invMass[start + i] = 0;
      }
      const edges = /* @__PURE__ */ new Map();
      for (const tri of p.triangles) for (let i = 0; i < 3; i++) {
        const a = tri[i], b = tri[(i + 1) % 3], key = [a, b].sort((a2, b2) => a2 - b2).join(":");
        if (!edges.has(key)) edges.set(key, { a, b, opposite: [] });
        edges.get(key).opposite.push(tri[(i + 2) % 3]);
      }
      for (const e of edges.values()) {
        this.constraints.push({ a: start + e.a, b: start + e.b, rest: distance(p.uvMm[e.a], p.uvMm[e.b]) / 1e3, compliance: m.stretchCompliance, lambda: 0, type: "stretch" });
        if (e.opposite.length === 2) {
          const [a, b] = e.opposite;
          this.constraints.push({ a: start + a, b: start + b, rest: distance(p.uvMm[a], p.uvMm[b]) / 1e3, compliance: m.bendCompliance, lambda: 0, type: "bend-distance-proxy" });
        }
      }
    }
  }
  assertCurrent(spec) {
    if (fingerprint(spec) !== this.snapshot.signature) fail("STALE_CUT", "pattern/material/placement changed: cut and sew again");
  }
  activate(stageId, current = this.spec) {
    this.assertCurrent(current);
    const stage = this.spec.stages.find((s) => s.id === stageId);
    if (!stage) fail("STAGE_REFERENCE", stageId);
    if (stage.requires.some((id) => !this.completed.has(id))) fail("STAGE_DEPENDENCY", stageId);
    if (this.completed.has(stageId)) return;
    for (const id of stage.seams) {
      const seam = this.spec.seams.find((s) => s.id === id), a = directedEdge(this.spec, seam.a), b = directedEdge(this.spec, seam.b);
      for (let i = 0; i < a.ids.length; i++) {
        const ia = this.offsets.get(a.panel.id) + a.ids[i], ib = this.offsets.get(b.panel.id) + b.ids[i];
        this.seamConstraints.push({ a: ia, b: ib, rest: 8e-4, startRest: distance(this.positions[ia], this.positions[ib]), activatedAt: this.elapsed, compliance: 1e-8, lambda: 0, type: "seam", seamId: id });
      }
      this.active.add(id);
    }
    this.seamElapsed = 0;
    this.completed.add(stageId);
  }
  releasePins() {
    this.pins.clear();
    this.invMass = [...this.baseInvMass];
  }
  detach() {
    this.seamConstraints = [];
    this.active.clear();
    this.completed = /* @__PURE__ */ new Set(["cut"]);
    this.seamDetached = true;
  }
  step(dt = 1 / 60) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.05) fail("TIMESTEP", "positive timestep up to 0.05 seconds required");
    const sub3 = 3, h = dt / sub3;
    for (let substep = 0; substep < sub3; substep++) {
      this.elapsed += h;
      this.seamElapsed += h;
      for (let i = 0; i < this.positions.length; i++) {
        this.previous[i] = [...this.positions[i]];
        if (!this.invMass[i]) continue;
        const v = this.velocity[i], p = this.positions[i];
        v[1] -= (this.gravity ? 9.81 : 0) * h;
        if (this.pull) v[0] += this.pullDirections[i] * 2.2 * h;
        for (let k = 0; k < 3; k++) p[k] += v[k] * h;
      }
      const constraints = [...this.constraints, ...this.seamConstraints];
      constraints.forEach((c) => c.lambda = 0);
      for (let iter = 0; iter < 12; iter++) {
        for (const c of constraints) {
          const a = this.positions[c.a], b = this.positions[c.b], w1 = this.invMass[c.a], w2 = this.invMass[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], d = Math.hypot(dx, dy, dz);
          if (d < 1e-12 || w1 + w2 === 0) continue;
          const alpha = c.compliance / (h * h), target = c.type === "seam" ? c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / 1.2) : c.rest;
          const dl = (-(d - target) - alpha * c.lambda) / (w1 + w2 + alpha);
          c.lambda += dl;
          const f = dl / d;
          for (let k = 0; k < 3; k++) {
            const n = [dx, dy, dz][k];
            a[k] += w1 * f * n;
            b[k] -= w2 * f * n;
          }
        }
        for (let i = 0; i < this.positions.length; i++) {
          if (!this.invMass[i]) continue;
          const p = this.positions[i];
          p[1] = Math.max(this.floorY, p[1]);
          if (this.obstacle) {
            const c = this.sphere.center, d = distance(p, c), r = this.sphere.radius + 1e-3;
            if (d < r) {
              const n = d > 1e-10 ? p.map((x, k) => (x - c[k]) / d) : [0, 0, 1];
              for (let k = 0; k < 3; k++) p[k] = c[k] + n[k] * r;
            }
          }
        }
      }
      const decay = Math.exp(-3 * h);
      for (let i = 0; i < this.positions.length; i++) for (let k = 0; k < 3; k++) this.velocity[i][k] = (this.positions[i][k] - this.previous[i][k]) / h * decay;
    }
  }
  metrics() {
    let maxStrain = 0, minRatio = 1, finite2 = true, maxSpeed = 0, penetration = 0;
    for (const t of this.triangles) {
      const [u0, u1, u2] = t.uv, du = u1[0] - u0[0], dv = u1[1] - u0[1], eu = u2[0] - u0[0], ev = u2[1] - u0[1], det = du * ev - dv * eu;
      const [p0, p1, p2] = t.ids.map((i) => this.positions[i]), f1 = [], f2 = [];
      for (let k = 0; k < 3; k++) {
        const a = (p1[k] - p0[k]) * 1e3, b = (p2[k] - p0[k]) * 1e3;
        f1.push((a * ev - b * dv) / det);
        f2.push((-a * eu + b * du) / det);
      }
      const aa = f1.reduce((s2, x) => s2 + x * x, 0), bb = f2.reduce((s2, x) => s2 + x * x, 0), ab = f1.reduce((s2, x, k) => s2 + x * f2[k], 0), disc = Math.sqrt((aa - bb) ** 2 + 4 * ab * ab);
      const large = Math.sqrt(Math.max(0, (aa + bb + disc) / 2)), small = Math.sqrt(Math.max(0, (aa + bb - disc) / 2));
      maxStrain = Math.max(maxStrain, large - 1, 1 - small);
      minRatio = Math.min(minRatio, small);
    }
    for (let i = 0; i < this.positions.length; i++) {
      finite2 &&= this.positions[i].every(Number.isFinite);
      maxSpeed = Math.max(maxSpeed, Math.hypot(...this.velocity[i]));
      if (this.obstacle) penetration = Math.max(penetration, (this.sphere.radius + 1e-3 - distance(this.positions[i], this.sphere.center)) * 1e3);
    }
    const s = this.spec.seams.flatMap((seam) => {
      const a = directedEdge(this.spec, seam.a), b = directedEdge(this.spec, seam.b);
      return a.ids.map((id, i) => distance(this.positions[this.offsets.get(a.panel.id) + id], this.positions[this.offsets.get(b.panel.id) + b.ids[i]]) * 1e3);
    });
    return { finite: finite2, maxPrincipalStrain: maxStrain, minStretchRatio: minRatio, maxSeamGapMm: Math.max(0, ...s), meanSeamGapMm: s.reduce((a, b) => a + b, 0) / Math.max(1, s.length), maxSpeedMmS: maxSpeed * 1e3, maxVertexSpherePenetrationMm: Math.max(0, penetration), pins: this.pins.size, activeStitches: this.seamConstraints.length, vertexCount: this.positions.length, triangleCount: this.triangles.length, restSignature: this.snapshot.signature, elapsed: this.elapsed, bodyContact: "not_implemented", selfCollision: "not_implemented", productionReady: false };
  }
  export() {
    return { schema: "kaopu-cloth-experiment@1", snapshot: this.snapshot, positionsMm: this.positions.map((p) => p.map((x) => x * 1e3)), activeSeams: [...this.active], temporaryPins: [...this.pins.keys()], metrics: this.metrics(), solver: { type: "distance-XPBD", version: "r1", bending: "uncalibrated-distance-proxy", contacts: "vertex-sphere-and-floor-only", continuousCollision: false, selfCollision: false }, productionReady: false };
  }
};
function specMaterial(spec, p) {
  return spec.materials.find((m) => m.id === p.materialId);
}

// tailor-short-sleeve-20261006/web/src/paper-program.mjs
var PROGRAM = "kaopu-short-sleeve-template-grading@1";
var edgeLength = (p, key) => {
  const ids = p.edges[key];
  return ids.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[ids[j]][k])), 0);
};
function gradePaper(base2, { bodyLengthDeltaMm = 0, sleeveLengthDeltaMm = 0 } = {}) {
  if (!Number.isFinite(bodyLengthDeltaMm) || bodyLengthDeltaMm < -50 || bodyLengthDeltaMm > 80 || !Number.isFinite(sleeveLengthDeltaMm) || sleeveLengthDeltaMm < -30 || sleeveLengthDeltaMm > 50) throw Error("\u672C\u4F8B\u652F\u6301\u8863\u957F \u221250\u2026+80 mm\u3001\u8896\u957F \u221230\u2026+50 mm");
  const spec = clone(base2), records = [];
  for (const p of spec.panels) {
    const old = base2.panels.find((x) => x.id === p.id), role = p.source.role;
    if (role.startsWith("torso")) {
      const side = spec.seams.find((s) => s.stageId === "sides" && (s.a.panelId === p.id || s.b.panelId === p.id)), e = side.a.panelId === p.id ? side.a : side.b, datum = Math.min(...old.edges[e.edge].map((i) => old.uvMm[i][1]));
      p.uvMm = bodyLengthDeltaMm ? old.uvMm.map(([x, y]) => [x, y + bodyLengthDeltaMm * Math.max(0, Math.min(1, (y - datum) / -datum))]) : old.uvMm.map((q) => [...q]);
      records.push({ panelId: p.id, datumYmm: datum, bodyLengthDeltaMm, operation: "grade every original material point below underarm datum; curved edges held fixed" });
    } else if (role.startsWith("sleeve")) {
      const caps = spec.seams.filter((s) => s.stageId === "armholes" && (s.a.panelId === p.id || s.b.panelId === p.id)), ids = caps.flatMap((s) => {
        const e = s.a.panelId === p.id ? s.a : s.b;
        return old.edges[e.edge];
      }), datum = Math.min(...ids.map((i) => Math.abs(old.uvMm[i][0]))), direction = p.source.side === "L" ? 1 : -1;
      p.uvMm = sleeveLengthDeltaMm ? old.uvMm.map(([x, y]) => [x + direction * sleeveLengthDeltaMm * Math.max(0, Math.min(1, (datum - Math.abs(x)) / datum)), y]) : old.uvMm.map((q) => [...q]);
      records.push({ panelId: p.id, capNearestAbsoluteXmm: datum, sleeveLengthDeltaMm, operation: "extend distal straight sleeve material strip; complete source sleeve cap held fixed" });
    } else throw Error("Unknown material role");
    for (const key of Object.keys(p.analyticCurvesMm || {})) for (const id of p.edges[key]) if (Math.hypot(...p.uvMm[id].map((x, k) => x - old.uvMm[id][k])) > 1e-8) throw Error("Grading unexpectedly moved a protected analytic curve");
  }
  const panels = Object.fromEntries(spec.panels.map((p) => [p.id, p]));
  for (const s of spec.seams) s.easeMm = edgeLength(panels[s.b.panelId], s.b.edge) - edgeLength(panels[s.a.panelId], s.a.edge);
  let minimum = 180, area = 0;
  for (const p of spec.panels) for (const t of p.triangles) {
    const q = t.map((i) => p.uvMm[i]), D = (q[1][0] - q[0][0]) * (q[2][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[2][0] - q[0][0]);
    if (D <= 1e-8) throw Error("\u4E8C\u7EF4\u653E\u7801\u4F7F\u6750\u6599\u4E09\u89D2\u5F62\u7FFB\u8F6C");
    area += D / 2;
    for (let i = 0; i < 3; i++) {
      const a = q[(i + 1) % 3].map((x, k) => x - q[i][k]), b = q[(i + 2) % 3].map((x, k) => x - q[i][k]);
      minimum = Math.min(minimum, Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180 / Math.PI);
    }
  }
  if (minimum < 15) throw Error("\u653E\u7801\u540E\u7F51\u683C\u8D28\u91CF\u8D85\u51FA\u672C\u4F8B\u9650\u5236");
  spec.id = `kaopu-short-sleeve-${bodyLengthDeltaMm}-${sleeveLengthDeltaMm}`;
  spec.revision = 1;
  spec.source.onlineProgram = { id: PROGRAM, controls: { bodyLengthDeltaMm, sleeveLengthDeltaMm }, sourcePaperFingerprint: fingerprint(base2), operationRecords: records, meaning: "bounded 2D material grading with fixed template connectivity; fresh solve from flat material, not new Delaunay or 3D scaling" };
  spec.source.meshing = { ...spec.source.meshing, onlineRemeshing: false, connectivityRetained: true, minimumGradedTriangleAngleDeg: minimum, gradedMaterialAreaMm2: area };
  validate(spec);
  return spec;
}
function paperSummary(s) {
  let hem = 0;
  for (const p of s.panels.filter((p2) => p2.source.role.startsWith("torso"))) {
    const ymax = Math.max(...p.uvMm.map((q) => q[1])), h = Object.entries(p.edges).find(([, ids]) => ids.every((i) => Math.abs(p.uvMm[i][1] - ymax) < 1e-7));
    if (!h) throw Error("Missing material hem");
    hem += edgeLength(p, h[0]);
  }
  return { program: s.source.onlineProgram, panels: s.panels.length, seams: s.seams.length, hemCircumferenceMm: hem, particleCount: s.panels.reduce((n, p) => n + p.uvMm.length, 0), triangleCount: s.panels.reduce((n, p) => n + p.triangles.length, 0), netMaterialAreaMm2: s.source.meshing.gradedMaterialAreaMm2, minimumTriangleAngleDeg: s.source.meshing.minimumGradedTriangleAngleDeg, connectivityRetained: true };
}

// tailor-tops-20261006/web/src/stitch-groups.mjs
var StitchGroups = class {
  constructor(lab2) {
    this.lab = lab2;
    this.parent = lab2.positions.map((_, i) => i);
    this.representatives = [...this.parent];
    this.groupCount = this.parent.length;
    this.equalities = 0;
  }
  find(i) {
    return this.parent[i] === i ? i : this.parent[i] = this.find(this.parent[i]);
  }
  synchronize() {
    const l = this.lab;
    let changed = false;
    for (const c of l.seamConstraints) {
      if (c.eliminated || l.elapsed - c.activatedAt < c.rampDuration) continue;
      const a = this.find(c.a), b = this.find(c.b);
      if (a === b) {
        c.eliminated = true;
        continue;
      }
      const pa = l.positions[a], pb = l.positions[b], gap = Math.hypot(...pa.map((x, k) => x - pb[k]));
      if (gap > 2e-3) continue;
      this.parent[Math.max(a, b)] = Math.min(a, b);
      c.eliminated = true;
      this.equalities++;
      changed = true;
    }
    if (changed) this.rebuild();
    return changed;
  }
  rebuild() {
    const l = this.lab, groups = /* @__PURE__ */ new Map();
    for (let i = 0; i < this.parent.length; i++) {
      const r = this.find(i);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r).push(i);
    }
    this.representatives = [...groups.keys()];
    this.groupCount = groups.size;
    this.groups = groups;
    for (const [root, ids] of groups) {
      let mass = 0;
      const p = [0, 0, 0], v = [0, 0, 0], pins = ids.filter((i) => l.pins.has(i));
      for (const i of ids) {
        const m = 1 / l.baseInvMass[i];
        mass += m;
        for (let k = 0; k < 3; k++) {
          p[k] += l.positions[i][k] * m;
          v[k] += l.velocity[i][k] * m;
        }
      }
      for (let k = 0; k < 3; k++) {
        p[k] = pins.length ? pins.reduce((sum, i) => sum + l.positions[i][k], 0) / pins.length : p[k] / mass;
        v[k] /= mass;
      }
      for (const i of ids) {
        l.positions[i] = p;
        l.velocity[i] = v;
        l.invMass[i] = pins.length ? 0 : 1 / mass;
      }
    }
  }
  report() {
    return { mode: "ideal-zero-width-stitch equality elimination", materialParticles: this.parent.length, solverGroups: this.groupCount, mergedEqualities: this.equalities, restMetricChanged: false, materialIdsPreserved: true, totalMaterialMassKg: this.lab.baseInvMass.reduce((s, w) => s + 1 / w, 0), fixedSolverGroups: this.representatives.filter((i) => this.lab.invMass[i] === 0).length };
  }
};

// tailor-tops-20261006/web/src/self-contact.mjs
var dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
var sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
var cross2 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function closest(p, a, b, c, out) {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  let u = 0, v = 0, w = 0;
  if (d1 <= 0 && d2 <= 0) u = 1;
  else {
    const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) v = 1;
    else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        v = d1 / (d1 - d3);
        u = 1 - v;
      } else {
        const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
        if (d6 >= 0 && d5 <= d6) w = 1;
        else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            w = d2 / (d2 - d6);
            u = 1 - w;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              w = (d4 - d3) / (d4 - d3 + (d5 - d6));
              v = 1 - w;
            } else {
              const den = 1 / (va + vb + vc);
              v = vb * den;
              w = vc * den;
              u = 1 - v - w;
            }
          }
        }
      }
    }
  }
  out[0] = a[0] * u + b[0] * v + c[0] * w;
  out[1] = a[1] * u + b[1] * v + c[1] * w;
  out[2] = a[2] * u + b[2] * v + c[2] * w;
  out[3] = u;
  out[4] = v;
  out[5] = w;
  return out;
}
var SelfContact = class {
  constructor(lab2, { thicknessMm = 0.6, cellSizeMm = 25 } = {}) {
    this.lab = lab2;
    this.h = thicknessMm / 1e3;
    this.cell = cellSizeMm / 1e3;
    this.neighbours = Array.from({ length: lab2.positions.length }, (_, i) => /* @__PURE__ */ new Set([i]));
    for (const [a, b] of lab2.meshEdges) {
      this.neighbours[a].add(b);
      this.neighbours[b].add(a);
    }
    this.hash = /* @__PURE__ */ new Map();
    this.q = new Float64Array(6);
    this.corrections = 0;
    this.skippedLargeTriangles = 0;
    this.groupNeighbours = null;
    this.lastGroupCount = -1;
  }
  key(x, y, z) {
    return x + 128 + 512 * (y + 128) + 262144 * (z + 128);
  }
  rebuild() {
    const l = this.lab;
    if (l.stitchEqualityElimination && this.lastGroupCount !== l.stitchGroups.groupCount) {
      this.groupNeighbours = /* @__PURE__ */ new Map();
      for (let i = 0; i < this.neighbours.length; i++) {
        const r = l.stitchGroups.find(i);
        if (!this.groupNeighbours.has(r)) this.groupNeighbours.set(r, /* @__PURE__ */ new Set());
        for (const j of this.neighbours[i]) this.groupNeighbours.get(r).add(l.stitchGroups.find(j));
      }
      this.lastGroupCount = l.stitchGroups.groupCount;
    }
    this.hash.clear();
    const ps = this.lab.positions, s = this.cell, pad = this.h * 3 + (this.lab.lastMaxSubstepDisplacement || 0) * 3;
    for (let t = 0; t < this.lab.triangles.length; t++) {
      const ids = this.lab.triangles[t].ids, a = ps[ids[0]], b = ps[ids[1]], c = ps[ids[2]];
      const x0 = Math.floor((Math.min(a[0], b[0], c[0]) - pad) / s), x1 = Math.floor((Math.max(a[0], b[0], c[0]) + pad) / s), y0 = Math.floor((Math.min(a[1], b[1], c[1]) - pad) / s), y1 = Math.floor((Math.max(a[1], b[1], c[1]) + pad) / s), z0 = Math.floor((Math.min(a[2], b[2], c[2]) - pad) / s), z1 = Math.floor((Math.max(a[2], b[2], c[2]) + pad) / s);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 3e3) {
        this.skippedLargeTriangles++;
        continue;
      }
      for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const key = this.key(x, y, z);
        let list = this.hash.get(key);
        if (!list) {
          list = [];
          this.hash.set(key, list);
        }
        list.push(t);
      }
    }
  }
  project() {
    const l = this.lab, ps = l.positions, im = l.invMass, h = this.h, q = this.q, s = this.cell;
    let total = 0;
    for (let i = 0; i < ps.length; i++) {
      if (l.stitchEqualityElimination && l.stitchGroups.find(i) !== i) continue;
      const p = ps[i], list = this.hash.get(this.key(Math.floor(p[0] / s), Math.floor(p[1] / s), Math.floor(p[2] / s)));
      if (!list) continue;
      const near = l.stitchEqualityElimination ? this.groupNeighbours.get(l.stitchGroups.find(i)) : this.neighbours[i];
      for (const t of list) {
        const ids = l.triangles[t].ids, topological = l.stitchEqualityElimination ? ids.map((j) => l.stitchGroups.find(j)) : ids;
        if (near.has(topological[0]) || near.has(topological[1]) || near.has(topological[2])) continue;
        const a = ps[ids[0]], b = ps[ids[1]], c = ps[ids[2]];
        closest(p, a, b, c, q);
        let dx = p[0] - q[0], dy = p[1] - q[1], dz = p[2] - q[2], len2 = Math.hypot(dx, dy, dz), n;
        const fn = cross2(sub(b, a), sub(c, a)), fnLen = Math.hypot(...fn);
        if (fnLen < 1e-15) continue;
        const N = fn.map((v) => v / fnLen), currentSigned = dot(sub(p, a), N), old = l._old, prevP = [old[i * 3], old[i * 3 + 1], old[i * 3 + 2]], oldA = [old[ids[0] * 3], old[ids[0] * 3 + 1], old[ids[0] * 3 + 2]], oldB = [old[ids[1] * 3], old[ids[1] * 3 + 1], old[ids[1] * 3 + 2]], oldC = [old[ids[2] * 3], old[ids[2] * 3 + 1], old[ids[2] * 3 + 2]], pn = cross2(sub(oldB, oldA), sub(oldC, oldA)), pnLen = Math.hypot(...pn), previousSigned = pnLen ? dot(sub(prevP, oldA), pn) / pnLen : currentSigned, projectedDistance = Math.hypot(dx - currentSigned * N[0], dy - currentSigned * N[1], dz - currentSigned * N[2]);
        const crossed = previousSigned * currentSigned < 0 && projectedDistance < h && pnLen > 1e-15 && dot(pn, N) > 0;
        if (len2 >= h && !crossed) continue;
        let penetration;
        if (crossed) {
          const side = previousSigned >= 0 ? 1 : -1;
          n = N.map((v) => v * side);
          penetration = h - side * currentSigned;
        } else if (len2 > 1e-9) {
          n = [dx / len2, dy / len2, dz / len2];
          penetration = h - len2;
        } else {
          n = N;
          if (previousSigned < 0) n = n.map((v) => -v);
          penetration = h;
        }
        let den = im[i];
        for (let k = 0; k < 3; k++) den += im[ids[k]] * q[k + 3] * q[k + 3];
        if (den < 1e-12) continue;
        const dl = penetration / den, fp = im[i] * dl;
        for (let k = 0; k < 3; k++) p[k] += n[k] * fp;
        for (let k = 0; k < 3; k++) {
          const v = ps[ids[k]], f = im[ids[k]] * q[k + 3] * dl;
          v[0] -= n[0] * f;
          v[1] -= n[1] * f;
          v[2] -= n[2] * f;
        }
        total++;
      }
    }
    this.corrections += total;
    return total;
  }
};

// tailor-tops-20261006/web/src/solver.mjs
var BodySDF = class {
  constructor(meta, array) {
    this.meta = meta;
    this.a = array;
  }
  sample(x, y, z, out) {
    const m = this.meta, d = m.dimensions, ox = m.originMm, step = m.spacingMm, fx = (x * 1e3 - ox[0]) / step, fy = (y * 1e3 - ox[1]) / step, fz = (z * 1e3 - ox[2]) / step;
    if (fx < 0 || fy < 0 || fz < 0 || fx >= d[0] - 1 || fy >= d[1] - 1 || fz >= d[2] - 1) {
      out[0] = 1e3;
      out[1] = out[2] = out[3] = 0;
      out[4] = 0;
      return out;
    }
    const i = Math.floor(fx), j = Math.floor(fy), k = Math.floor(fz), u = fx - i, v = fy - j, w = fz - k, nx = d[0], ny = d[1], o = (k * ny + j) * nx + i, a = this.a;
    const p = a[o], q = a[o + 1], r = a[o + nx], s = a[o + nx + 1], t = a[o + nx * ny], b = a[o + nx * ny + 1], c = a[o + nx * ny + nx], e = a[o + nx * ny + nx + 1];
    const lo = (p * (1 - u) + q * u) * (1 - v) + (r * (1 - u) + s * u) * v, hi = (t * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + e * u) * v;
    out[0] = (lo * (1 - w) + hi * w) * m.quantizationMm * 1e-3;
    const dx = ((q - p) * (1 - v) + (s - r) * v) * (1 - w) + ((b - t) * (1 - v) + (e - c) * v) * w, dy = ((r - p) * (1 - u) + (s - q) * u) * (1 - w) + ((c - t) * (1 - u) + (e - b) * u) * w, dz = hi - lo, n = Math.hypot(dx, dy, dz);
    out[1] = n ? dx / n : 0;
    out[2] = n ? dy / n : 1;
    out[3] = n ? dz / n : 0;
    out[4] = 1;
    return out;
  }
};
var GarmentLab = class extends ClothLab {
  constructor(spec, sdf2, { substeps = 18, iterations = 3, sewingDuration = 4, clearanceMm = 3.5 } = {}) {
    super(cut(spec));
    this.sdf = sdf2;
    this.substeps = substeps;
    this.iterations = iterations;
    this.sewingDuration = sewingDuration;
    this.clearance = clearanceMm * 1e-3;
    this.gravityScale = 0;
    this.collisions = true;
    this.bodyContacts = 0;
    this._q = new Float64Array(5);
    this._old = new Float64Array(this.positions.length * 3);
    this.support = [];
    this.orientationGuides = true;
    this.guideSigns = new Int8Array(this.positions.length);
    for (const p of this.spec.panels) {
      if (p.placement.rigidBasis) {
        const o = this.offsets.get(p.id), b = p.placement.rigidBasis, t = p.placement.translationMm;
        for (let j = 0; j < p.uvMm.length; j++) {
          const [u, v] = p.uvMm[j];
          this.positions[o + j] = [(b[0] * u + b[1] * v + t[0]) / 1e3, (b[3] * u + b[4] * v + t[1]) / 1e3, (b[6] * u + b[7] * v + t[2]) / 1e3];
          this.previous[o + j] = [...this.positions[o + j]];
        }
      }
      if (p.meshType === "unstructured") {
        const off = this.offsets.get(p.id);
        for (const i of p.temporaryGuideMaterialIds) this.guideSigns[off + i] = p.source.bodySide === "front" || p.id.includes("F") ? 1 : -1;
      } else if (p.id !== "G") {
        const off = this.offsets.get(p.id), isFront = p.id.includes("F"), cols = p.meshGrid?.columns ?? 13, rows = p.uvMm.length / cols, j0 = p.meshGrid?.guideRows[0] ?? 1, j1 = p.meshGrid?.guideRows[1] ?? rows - 2, i0 = p.meshGrid?.guideColumns[0] ?? 2, i1 = p.meshGrid?.guideColumns[1] ?? cols - 3;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.guideSigns[off + j * cols + i] = isFront ? 1 : -1;
      }
      for (const index of p.temporaryPins) {
        if (p.temporaryPinTargetsMm?.[index]) {
          const id2 = this.offsets.get(p.id) + index;
          this.support.push({ id: id2, start: [...this.positions[id2]], target: p.temporaryPinTargetsMm[index].map((x) => x / 1e3) });
          continue;
        }
        const id = this.offsets.get(p.id) + index, sign = p.id.endsWith("R") ? -1 : 1, start = [...this.positions[id]], waist = this.spec.source.measurementSnapshot.lowerWaist || this.spec.source.measurementSnapshot.waist;
        const isCenter = this.spec.source.waistFixtures && index === p.edges.waist[0], back = p.id.startsWith("B"), target = isCenter ? [sign * 4e-4, (this.spec.source.measurementSnapshot.waist.heightMm - this.spec.source.options.waistbandHeightMm) / 1e3, (back ? waist.backZ - 3.8 : waist.frontZ + 3.8) / 1e3] : [sign * (Math.abs(waist.sideRightXZ[0]) + 3.8) / 1e3, (this.spec.source.measurementSnapshot.waist.heightMm - this.spec.source.options.waistbandHeightMm) / 1e3, (waist.sideRightXZ[1] + (back ? -0.4 : 0.4)) / 1e3];
        this.support.push({ id, start, target });
      }
    }
    this.strainTriangles = this.triangles.map((t) => {
      const [a, b, c] = t.uv.map((x) => x.map((y) => y / 1e3)), du = b[0] - a[0], dv = b[1] - a[1], eu = c[0] - a[0], ev = c[1] - a[1], det = du * ev - dv * eu;
      return { ids: t.ids, c: [(dv - ev) / det, ev / det, -dv / det], d: [(eu - du) / det, -eu / det, du / det] };
    });
    this.meshEdges = [];
    const seen = /* @__PURE__ */ new Set();
    for (const t of this.triangles) for (let i = 0; i < 3; i++) {
      const a = t.ids[i], b = t.ids[(i + 1) % 3], key = a < b ? a + ":" + b : b + ":" + a;
      if (!seen.has(key)) {
        seen.add(key);
        this.meshEdges.push([a, b]);
      }
    }
    this.selfContacts = new SelfContact(this);
    this.selfCollisionEnabled = true;
    this.stitchGroups = new StitchGroups(this);
    this.stitchEqualityElimination = false;
    this.strainGuard = true;
    this.frameCount = 0;
    this.actions = [];
  }
  activate(stageId, current = this.spec) {
    const existed = this.completed.has(stageId);
    super.activate(stageId, current);
    if (!existed) this.actions.push({ kind: "sew-stage", stageId, atFrame: this.frameCount });
    for (const c of this.seamConstraints) if (c.rampDuration === void 0) c.rampDuration = this.sewingDuration;
  }
  detach() {
    super.detach();
    this.actions.push({ kind: "detach", atFrame: this.frameCount });
    this.positions = this.positions.map((p) => [...p]);
    this.velocity = this.velocity.map((p) => [...p]);
    this.invMass = this.baseInvMass.map((w, i) => this.pins.has(i) ? 0 : w);
    this.stitchGroups = new StitchGroups(this);
  }
  setGravity(scale) {
    this.gravityScale = scale;
    this.actions.push({ kind: "gravity", scale, atFrame: this.frameCount });
  }
  releasePins() {
    super.releasePins();
    this.actions.push({ kind: "release-supports", atFrame: this.frameCount });
    this.support = [];
    this.orientationGuides = false;
    if (this.stitchEqualityElimination) this.stitchGroups.rebuild();
  }
  contact(ids, weights, margin = this.clearance) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < ids.length; k++) {
      const p = this.positions[ids[k]], w = weights[k];
      x += p[0] * w;
      y += p[1] * w;
      z += p[2] * w;
    }
    const q = this.sdf.sample(x, y, z, this._q);
    if (!q[4] || q[0] >= margin) return;
    let sum = 0;
    for (let k = 0; k < ids.length; k++) sum += this.invMass[ids[k]] * weights[k] * weights[k];
    if (sum < 1e-12) return;
    const lambda = (margin - q[0]) / sum;
    for (let k = 0; k < ids.length; k++) {
      const p = this.positions[ids[k]], f = this.invMass[ids[k]] * weights[k] * lambda;
      p[0] += q[1] * f;
      p[1] += q[2] * f;
      p[2] += q[3] * f;
    }
    this.bodyContacts++;
  }
  strainLimit() {
    const ps = this.positions, im = this.invMass;
    for (const t of this.strainTriangles) {
      const [a, b, c] = t.ids, A = ps[a], B = ps[b], C = ps[c], u = t.c, w = t.d;
      let ux = A[0] * u[0] + B[0] * u[1] + C[0] * u[2], uy = A[1] * u[0] + B[1] * u[1] + C[1] * u[2], uz = A[2] * u[0] + B[2] * u[1] + C[2] * u[2], vx = A[0] * w[0] + B[0] * w[1] + C[0] * w[2], vy = A[1] * w[0] + B[1] * w[1] + C[1] * w[2], vz = A[2] * w[0] + B[2] * w[1] + C[2] * w[2];
      const aa = ux * ux + uy * uy + uz * uz, bb = vx * vx + vy * vy + vz * vz, ab = ux * vx + uy * vy + uz * vz, angle = 0.5 * Math.atan2(2 * ab, aa - bb), co = Math.cos(angle), si = Math.sin(angle);
      for (let mode = 0; mode < 2; mode++) {
        ux = A[0] * u[0] + B[0] * u[1] + C[0] * u[2];
        uy = A[1] * u[0] + B[1] * u[1] + C[1] * u[2];
        uz = A[2] * u[0] + B[2] * u[1] + C[2] * u[2];
        vx = A[0] * w[0] + B[0] * w[1] + C[0] * w[2];
        vy = A[1] * w[0] + B[1] * w[1] + C[1] * w[2];
        vz = A[2] * w[0] + B[2] * w[1] + C[2] * w[2];
        const qx = mode ? -si : co, qy = mode ? co : si, nx = ux * qx + vx * qy, ny = uy * qx + vy * qy, nz = uz * qx + vz * qy, len2 = Math.hypot(nx, ny, nz), target = Math.max(0.985, Math.min(1.015, len2));
        if (Math.abs(len2 - target) < 1e-6 || len2 < 1e-9) continue;
        const ca = u[0] * qx + w[0] * qy, cb = u[1] * qx + w[1] * qy, cc = u[2] * qx + w[2] * qy, den = im[a] * ca * ca + im[b] * cb * cb + im[c] * cc * cc;
        if (den < 1e-12) continue;
        const factor = -(len2 - target) / (den * len2), fa = im[a] * ca * factor, fb = im[b] * cb * factor, fc = im[c] * cc * factor;
        A[0] += fa * nx;
        A[1] += fa * ny;
        A[2] += fa * nz;
        B[0] += fb * nx;
        B[1] += fb * ny;
        B[2] += fb * nz;
        C[0] += fc * nx;
        C[1] += fc * ny;
        C[2] += fc * nz;
      }
    }
  }
  step(dt = 1 / 60) {
    this.frameCount++;
    const n = this.positions.length, h = dt / this.substeps, ps = this.positions, vs = this.velocity, im = this.invMass, q = this._q, old = this._old, all = [...this.constraints, ...this.seamConstraints];
    this.bodyContacts = 0;
    for (let sub3 = 0; sub3 < this.substeps; sub3++) {
      this.elapsed += h;
      this.seamElapsed += h;
      if (this.stitchEqualityElimination) this.stitchGroups.synchronize();
      for (const hold of this.support) {
        const p = ps[hold.id], t = Math.min(1, this.elapsed / 4), s = t * t * (3 - 2 * t);
        for (let k = 0; k < 3; k++) p[k] = hold.start[k] + (hold.target[k] - hold.start[k]) * s;
      }
      for (let i = 0; i < n; i++) {
        const p = ps[i], o = i * 3;
        old[o] = p[0];
        old[o + 1] = p[1];
        old[o + 2] = p[2];
      }
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.stitchGroups.find(i) !== i) continue;
        const p = ps[i], v = vs[i];
        if (!im[i]) continue;
        v[1] -= 9.81 * this.gravityScale * h;
        p[0] += v[0] * h;
        p[1] += v[1] * h;
        p[2] += v[2] * h;
      }
      for (const c of all) c.lambda = 0;
      for (let iter = 0; iter < this.iterations; iter++) {
        for (const c of all) {
          if (c.eliminated) continue;
          const a = ps[c.a], b = ps[c.b], w1 = im[c.a], w2 = im[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], len2 = Math.hypot(dx, dy, dz);
          if (len2 < 1e-12 || w1 + w2 === 0) continue;
          const alpha = c.compliance / (h * h), target = c.type === "seam" ? c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / c.rampDuration) : c.rest, dl = (-(len2 - target) - alpha * c.lambda) / (w1 + w2 + alpha), f = dl / len2;
          c.lambda += dl;
          a[0] += w1 * f * dx;
          a[1] += w1 * f * dy;
          a[2] += w1 * f * dz;
          b[0] -= w2 * f * dx;
          b[1] -= w2 * f * dy;
          b[2] -= w2 * f * dz;
        }
        if (this.strainGuard) this.strainLimit();
        if (this.orientationGuides) for (let i = 0; i < n; i++) {
          const sign = this.guideSigns[i];
          if (!sign || !im[i]) continue;
          const p = ps[i], y = p[1] * 1e3, m = this.spec.source.measurementSnapshot, split = y >= m.hip.heightMm ? m.hip.sideRightXZ[1] + (m.waist.sideRightXZ[1] - m.hip.sideRightXZ[1]) * Math.min(1, (y - m.hip.heightMm) / (m.waist.heightMm - m.hip.heightMm)) : 25, limit = (split + sign * 12) / 1e3;
          if (sign > 0 && p[2] < limit) p[2] = limit;
          if (sign < 0 && p[2] > limit) p[2] = limit;
        }
        if (this.collisions) for (let i = 0; i < n; i++) {
          if (!im[i]) continue;
          const p = ps[i];
          this.sdf.sample(p[0], p[1], p[2], q);
          if (q[4] && q[0] < this.clearance) {
            const d = this.clearance - q[0];
            p[0] += q[1] * d;
            p[1] += q[2] * d;
            p[2] += q[3] * d;
            this.bodyContacts++;
          }
        }
      }
      for (const c of this.seamConstraints) {
        if (c.eliminated) continue;
        const a = ps[c.a], b = ps[c.b], w1 = im[c.a], w2 = im[c.b], dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2], len2 = Math.hypot(dx, dy, dz);
        if (len2 < 1e-12 || w1 + w2 === 0) continue;
        const target = c.rest + (c.startRest - c.rest) * Math.max(0, 1 - (this.elapsed - c.activatedAt) / c.rampDuration), alpha = c.compliance / (h * h), dl = (-(len2 - target) - alpha * c.lambda) / (w1 + w2 + alpha), f = dl / len2;
        c.lambda += dl;
        a[0] += w1 * f * dx;
        a[1] += w1 * f * dy;
        a[2] += w1 * f * dz;
        b[0] -= w2 * f * dx;
        b[1] -= w2 * f * dy;
        b[2] -= w2 * f * dz;
      }
      if (this.collisions && sub3 % 3 === 2) {
        for (const e of this.meshEdges) this.contact(e, [0.5, 0.5], 15e-4);
        for (const t of this.triangles) this.contact(t.ids, [1 / 3, 1 / 3, 1 / 3], 15e-4);
      }
      if (this.selfCollisionEnabled && sub3 % 3 === 2) {
        let maxDelta = 0;
        for (let i = 0; i < n; i++) {
          const p = ps[i], o = i * 3;
          maxDelta = Math.max(maxDelta, Math.hypot(p[0] - old[o], p[1] - old[o + 1], p[2] - old[o + 2]));
        }
        this.lastMaxSubstepDisplacement = maxDelta;
        this.selfContacts.rebuild();
        this.selfContacts.project();
      }
      const damping = Math.exp(-20 * h);
      for (let i = 0; i < n; i++) {
        if (this.stitchEqualityElimination && this.stitchGroups.find(i) !== i) continue;
        const p = ps[i], v = vs[i], o = i * 3;
        v[0] = (p[0] - old[o]) / h * damping;
        v[1] = (p[1] - old[o + 1]) / h * damping;
        v[2] = (p[2] - old[o + 2]) / h * damping;
        if (p[1] < 0) {
          p[1] = 0;
          v[1] = 0;
        }
      }
    }
  }
  metrics() {
    const m = super.metrics();
    let minBody = Infinity, bad = 0, domain = 0, minY = Infinity, maxY = -Infinity;
    const q = new Float64Array(5);
    for (const p of this.positions) {
      this.sdf.sample(...p, q);
      if (q[4]) {
        minBody = Math.min(minBody, q[0] * 1e3);
        if (q[0] < -5e-4) bad++;
      } else domain++;
      minY = Math.min(minY, p[1] * 1e3);
      maxY = Math.max(maxY, p[1] * 1e3);
    }
    const seams = this.spec.seams.map((s) => {
      const a = directedEdge(this.spec, s.a), b = directedEdge(this.spec, s.b), o1 = this.offsets.get(a.panel.id), o2 = this.offsets.get(b.panel.id);
      const distances = a.ids.map((v, i) => Math.hypot(...this.positions[o1 + v].map((x, k) => x - this.positions[o2 + b.ids[i]][k])) * 1e3);
      return { id: s.id, active: this.active.has(s.id), maxGapMm: Math.max(...distances) };
    });
    return { ...m, bodySignedDistanceMinMm: minBody, bodyInsideVertexCount: bad, outsideCollisionDomain: domain, minYmm: minY, maxYmm: maxY, seams, activeMaxGapMm: Math.max(0, ...seams.filter((s) => s.active).map((s) => s.maxGapMm)), temporarySupportCount: this.support.length, stitchEqualityElimination: this.stitchEqualityElimination ? this.stitchGroups.report() : false, gravityScale: this.gravityScale, temporaryOrientationGuides: this.orientationGuides, bodyContact: "grid-SDF from exact Anny triangle nearest distance; exact audit required", selfCollision: this.selfCollisionEnabled ? "discrete vertex-face, exact audit still required" : "disabled", selfContactCorrections: this.selfContacts.corrections, skippedSelfContactTriangles: this.selfContacts.skippedLargeTriangles };
  }
  export() {
    const m = this.metrics();
    return { ...super.export(), schema: "kaopu-garment-physical-trial@1", frameCount: this.frameCount, actions: this.actions, materialToSolverGroup: this.stitchEqualityElimination ? this.positions.map((_, i) => this.stitchGroups.find(i)) : this.positions.map((_, i) => i), metrics: m, solver: { ...super.export().solver, version: "garment-small-step-r1", contacts: "triangle-body-SDF vertex/edge/face samples and ground", strainGuard: this.strainGuard ? { kind: "per-iteration principal stretch clamp", min: 0.985, max: 1.015, acceptanceThreshold: false } : false, velocityDampingRate: 20, substeps: this.substeps, iterations: this.iterations, sewingDuration: this.sewingDuration, clearanceMm: this.clearance * 1e3, gravityScale: this.gravityScale, temporaryOrientationGuides: this.orientationGuides, bodyContact: "sampled triangle-mesh SDF + edge midpoint and face centroid projections", selfCollision: this.selfCollisionEnabled, stitchEqualities: this.stitchEqualityElimination ? this.stitchGroups.report() : false }, sourceBody: this.spec.source.measurementSnapshot.bodyId };
  }
};

// tailor-tops-20261006/web/src/diagnostics.mjs
var dist = (q, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dy * t);
};
var pathDist = (q, p, ids) => Math.min(...ids.slice(1).map((id, i) => dist(q, p.uvMm[ids[i]], p.uvMm[id])));
function regionalStrain(spec, positionsMm) {
  const groups = Object.fromEntries(["ordinary_interior", "ordinary_seam_band", "free_edge_band", "planned_ease_band", "dart_band"].map((k) => [k, []])), perTriangle = [], all = [];
  let offset = 0;
  for (const p of spec.panels) {
    const paths = { dart: [], ease: [], ordinary: [] }, used = /* @__PURE__ */ new Set();
    for (const s of spec.seams) {
      for (const e of [s.a, s.b]) if (e.panelId === p.id) {
        const ids = p.edges[e.edge], len2 = ids.slice(1).reduce((n, id, j) => n + Math.hypot(...p.uvMm[id].map((x, k) => x - p.uvMm[ids[j]][k])), 0), kind = s.a.panelId === s.b.panelId ? "dart" : Math.abs(s.easeMm) / len2 >= 0.02 ? "ease" : "ordinary";
        paths[kind].push(ids);
        used.add(e.edge);
      }
    }
    const free = Object.entries(p.edges).filter(([key]) => !used.has(key)).map(([, ids]) => ids);
    for (let ti = 0; ti < p.triangles.length; ti++) {
      const ids = p.triangles[ti], [a, b, c] = ids.map((i) => p.uvMm[i]), [A, B, C] = ids.map((i) => positionsMm[offset + i]), du = b[0] - a[0], dv = b[1] - a[1], eu = c[0] - a[0], ev = c[1] - a[1], det = du * ev - dv * eu, u = [0, 1, 2].map((k) => ((B[k] - A[k]) * ev - (C[k] - A[k]) * dv) / det), v = [0, 1, 2].map((k) => (-(B[k] - A[k]) * eu + (C[k] - A[k]) * du) / det), aa = u.reduce((n, x) => n + x * x, 0), bb = v.reduce((n, x) => n + x * x, 0), ab = u.reduce((n, x, k) => n + x * v[k], 0), dis = Math.hypot(aa - bb, 2 * ab), strain = Math.max(Math.abs(Math.sqrt(Math.max(0, (aa + bb + dis) / 2)) - 1), Math.abs(Math.sqrt(Math.max(0, (aa + bb - dis) / 2)) - 1)), centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3], near = (kind) => paths[kind].some((ids2) => pathDist(centroid, p, ids2) <= 16), region = near("dart") ? "dart_band" : near("ease") ? "planned_ease_band" : near("ordinary") ? "ordinary_seam_band" : free.some((ids2) => pathDist(centroid, p, ids2) <= 16) ? "free_edge_band" : "ordinary_interior";
      const row = { area: Math.abs(det) / 2, strain, panelId: p.id, triangle: ti, uvCentroidMm: centroid };
      groups[region].push(row);
      all.push(row);
      perTriangle.push(strain);
    }
    offset += p.uvMm.length;
  }
  const summarize = (rows) => {
    if (!rows.length) return null;
    const sorted = [...rows].sort((a, b) => a.strain - b.strain), area = rows.reduce((n2, r) => n2 + r.area, 0);
    let n = 0, p95 = 0;
    for (const r of sorted) {
      n += r.area;
      if (n >= area * 0.95) {
        p95 = r.strain;
        break;
      }
    }
    return { triangleCount: rows.length, areaMm2: area, maximumPercent: sorted.at(-1).strain * 100, p95AreaWeightedPercent: p95 * 100, areaOver5Percent: rows.filter((r) => r.strain > 0.05).reduce((n2, r) => n2 + r.area, 0) / area * 100, worst: sorted.slice(-8).reverse() };
  };
  return { metric: "original 2D UV principal stretch/compression; area weighted", thresholdMeaning: "5% diagnostic threshold, not official acceptance requirement", regionWidthMm: 16, allowanceModeled: false, all: summarize(all), ordinaryMaterial: summarize([...groups.ordinary_interior, ...groups.ordinary_seam_band, ...groups.free_edge_band]), regions: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, summarize(v)])), perTriangle };
}
function topology(spec) {
  const offsets = /* @__PURE__ */ new Map();
  let n = 0;
  for (const p of spec.panels) {
    offsets.set(p.id, n);
    n += p.uvMm.length;
  }
  const parent = Array.from({ length: n }, (_, i) => i), find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
  for (const s of spec.seams) {
    const get = (e) => {
      const p = spec.panels.find((p2) => p2.id === e.panelId), ids = p.edges[e.edge].map((i) => i + offsets.get(p.id));
      return e.reverse ? ids.reverse() : ids;
    }, a = get(s.a), b = get(s.b);
    a.forEach((id, i) => parent[find(id)] = find(b[i]));
  }
  const edges = /* @__PURE__ */ new Map(), tris = [];
  for (const p of spec.panels) for (const t of p.triangles) {
    const ids = t.map((i) => find(offsets.get(p.id) + i));
    tris.push(ids);
    for (let i = 0; i < 3; i++) {
      const key = [ids[i], ids[(i + 1) % 3]].sort((a, b) => a - b).join(":");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  const boundary = [...edges].filter(([, n2]) => n2 === 1), adj = /* @__PURE__ */ new Map();
  for (const [k] of boundary) {
    const [a, b] = k.split(":").map(Number);
    for (const [x, y] of [[a, b], [b, a]]) {
      if (!adj.has(x)) adj.set(x, []);
      adj.get(x).push(y);
    }
  }
  let loops = 0;
  const seen = /* @__PURE__ */ new Set();
  for (const start of adj.keys()) if (!seen.has(start)) {
    loops++;
    const todo = [start];
    while (todo.length) {
      const x = todo.pop();
      if (seen.has(x)) continue;
      seen.add(x);
      todo.push(...adj.get(x));
    }
  }
  return { quotientOnly: true, boundaryLoops: loops, eulerCharacteristic: new Set(parent.map((_, i) => find(i))).size - edges.size + tris.length, nonManifoldEdges: [...edges.values()].filter((x) => x > 2).length, degenerateTriangles: tris.filter((x) => new Set(x).size < 3).length };
}

// tailor-tops-20261006/web/src/intersection-audit.mjs
var sub2 = (a, b) => a.map((v, k) => v - b[k]);
var dot2 = (a, b) => a.reduce((n, v, k) => n + v * b[k], 0);
var cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function segmentTriangle(a, b, x, y, z) {
  const d = sub2(b, a), e1 = sub2(y, x), e2 = sub2(z, x), p = cross3(d, e2), det = dot2(e1, p);
  if (Math.abs(det) < 1e-10) return false;
  const inv = 1 / det, t = sub2(a, x), u = dot2(t, p) * inv;
  if (u < -1e-8 || u > 1 + 1e-8) return false;
  const q = cross3(t, e1), v = dot2(d, q) * inv;
  if (v < -1e-8 || u + v > 1 + 1e-8) return false;
  const at = dot2(e2, q) * inv;
  return at > 1e-7 && at < 1 - 1e-7;
}
function intersects(a, b) {
  for (let i = 0; i < 3; i++) if (segmentTriangle(a[i], a[(i + 1) % 3], ...b) || segmentTriangle(b[i], b[(i + 1) % 3], ...a)) return true;
  return false;
}
var overlaps = (a, b) => !a.lo.some((x, k) => x > b.hi[k] || a.hi[k] < b.lo[k]);
var bounds = (points) => ({ lo: [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))), hi: [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k]))) });
function mesh(positions, faces) {
  const triangles = faces.map((ids, id) => {
    const points = ids.map((i) => positions[i]);
    return { id, ids, points, ...bounds(points) };
  });
  function build(rows) {
    const lo = [0, 1, 2].map((k) => Math.min(...rows.map((r) => r.lo[k]))), hi = [0, 1, 2].map((k) => Math.max(...rows.map((r) => r.hi[k])));
    if (rows.length <= 8) return { lo, hi, rows };
    const axis = [0, 1, 2].sort((a, b) => hi[b] - lo[b] - (hi[a] - lo[a]))[0];
    rows.sort((a, b) => a.lo[axis] + a.hi[axis] - b.lo[axis] - b.hi[axis]);
    const mid = rows.length >> 1;
    return { lo, hi, left: build(rows.slice(0, mid)), right: build(rows.slice(mid)) };
  }
  return { triangles, root: build([...triangles]) };
}
function candidates(node, box, out) {
  if (!overlaps(node, box)) return;
  if (node.rows) {
    for (const row of node.rows) if (overlaps(row, box)) out.push(row);
  } else {
    candidates(node.left, box, out);
    candidates(node.right, box, out);
  }
}
function prepareBodyAudit(body) {
  return mesh(body.positionsMm, body.triangles);
}
function strictIntersectionAudit(spec, positionsMm, groups, bodyMesh) {
  let offset = 0;
  const faces = spec.panels.flatMap((p) => {
    const f = p.triangles.map((t) => t.map((i) => i + offset));
    offset += p.uvMm.length;
    return f;
  }), cloth = mesh(positionsMm, faces), bodyFaces = [], selfPairs = [];
  for (const t of cloth.triangles) {
    const rows = [];
    candidates(bodyMesh.root, t, rows);
    if (rows.some((b) => intersects(t.points, b.points))) bodyFaces.push(t.id);
  }
  for (const t of cloth.triangles) {
    const rows = [];
    candidates(cloth.root, t, rows);
    for (const b of rows) {
      if (b.id <= t.id || t.ids.some((i) => b.ids.some((j) => groups[i] === groups[j]))) continue;
      if (intersects(t.points, b.points)) selfPairs.push([t.id, b.id]);
    }
  }
  return { bodyIntersectingFaceCount: bodyFaces.length, bodyIntersectingFaces: bodyFaces, selfStrictTriangleIntersectionCount: selfPairs.length, selfPairs, coplanarOverlapChecked: false, continuousCollisionChecked: false, stitchedAdjacencyMapUsed: true, method: "independent BVH + segment/triangle intersection on final geometry" };
}

// tailor-short-sleeve-20261006/web/src/worker.mjs
var bodyAudit;
var sdf;
var base;
var lab;
var running = false;
var paused = false;
var stageIndex = 0;
var stageFrame = 0;
var epoch = 0;
var stages = [];
var totals = [];
var totalFrames = 0;
var emit = (type, data) => postMessage({ type, ...data });
function snapshot(extra = {}) {
  return { positionsMm: lab.positions.map((p) => p.map((x) => x * 1e3)), metrics: lab.metrics(), frame: lab.frameCount, stage: stages[stageIndex] || "complete", ...extra };
}
function tick(token) {
  if (token !== epoch || !running || paused) return;
  try {
    for (let chunk = 0; chunk < 4 && running; chunk++) {
      if (stageFrame === 0) {
        if (stageIndex === stages.length - 1) {
          lab.releasePins();
          lab.setGravity(1);
        } else lab.activate(stages[stageIndex]);
      }
      lab.step();
      stageFrame++;
      if (stageFrame >= totals[stageIndex]) {
        emit("stage", snapshot({ completedStage: stages[stageIndex] }));
        stageFrame = 0;
        stageIndex++;
        if (stageIndex >= stages.length) {
          running = false;
          emit("auditing", snapshot());
          const record = lab.export(), regions = regionalStrain(lab.spec, record.positionsMm), intersections = strictIntersectionAudit(lab.spec, record.positionsMm, record.materialToSolverGroup, bodyAudit);
          emit("done", { record, regions, intersections });
          return;
        }
      }
    }
    if (lab.frameCount % 12 === 0) emit("progress", snapshot({ progress: lab.frameCount / totalFrames }));
    setTimeout(() => tick(token), 0);
  } catch (error) {
    running = false;
    emit("error", { message: error.message, stack: error.stack });
  }
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "init") {
      base = data.base;
      stages = [...base.source.assemblyExperiment, "release"];
      totals = stages.map((_, i) => i === stages.length - 1 ? 480 : 360);
      totalFrames = totals.reduce((a, b) => a + b, 0);
      sdf = new BodySDF(data.sdfMeta, new Int16Array(data.sdfBuffer));
      bodyAudit = prepareBodyAudit(data.body);
      emit("ready", {});
    } else if (data.type === "cut") {
      epoch++;
      running = false;
      paused = false;
      const spec = gradePaper(base, data.controls);
      lab = new GarmentLab(spec, sdf, { substeps: 12, iterations: 6 });
      lab.orientationGuides = false;
      lab.selfCollisionEnabled = false;
      lab.stitchEqualityElimination = true;
      lab.strainGuard = true;
      stageIndex = 0;
      stageFrame = 0;
      emit("cut", { spec, summary: paperSummary(spec), topology: topology(spec), ...snapshot() });
    } else if (data.type === "run") {
      if (!lab) throw Error("\u5148\u751F\u6210\u7EB8\u6837\u5E76\u88C1\u7247");
      if (stageIndex >= stages.length) throw Error("\u672C\u8F6E\u5DF2\u5B8C\u6210\uFF1B\u91CD\u7B97\u9700\u8981\u91CD\u65B0\u88C1\u7247");
      running = true;
      paused = false;
      tick(++epoch);
    } else if (data.type === "pause") {
      epoch++;
      paused = true;
      emit("paused", lab ? snapshot() : { stage: "not-cut" });
    } else if (data.type === "export") {
      emit("export", { record: lab.export() });
    }
  } catch (error) {
    emit("error", { message: error.message, stack: error.stack });
  }
};
