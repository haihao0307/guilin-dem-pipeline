/**
 * Independent garment contact, in metres. Original implementation for this study.
 *
 * Mathematical references (no source implementation is copied):
 *   Macklin et al., XPBD (2016): https://mmacklin.com/xpbd.pdf
 *   Macklin et al., Small Steps (2019): https://mmacklin.com/smallsteps.pdf
 *   Brochu et al., exact CCD (2012), for the boundary of this discrete method:
 *   https://www.cs.ubc.ca/~rbridson/docs/brochu-siggraph2012-ccd.pdf
 *
 * This is DISCRETE vertex/triangle contact, not CCD, edge/edge contact, self
 * collision, or a deep-intersection untangler. A bounded neighbourhood is
 * searched. Previously known surface side is preserved at triangle interiors;
 * free triangle boundaries use an unsigned closest-feature distance.
 *
 * Garments retain their own positions, topology, previous state and mass. Only
 * `positions` is mutated. thickness means TOTAL physical cloth thickness; the
 * minimum middle-surface distance is half the sum, plus contactMargin. The
 * host must derive/update velocities from the corrected positions as needed.
 * `friction` is bounded tangential displacement damping, NOT calibrated fabric
 * friction. It is applied with the same reciprocal-mass distribution as contact.
 */

const EPS = 1e-12;
const INTERIOR_EPS = 1e-8;

function positive(value, fallback, name, allowZero = false) {
  const result = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(result) || (allowZero ? result < 0 : result <= 0)) {
    throw new RangeError(`${name} must be ${allowZero ? 'nonnegative' : 'positive'} and finite`);
  }
  return result;
}

function emptyResult() {
  return {
    contactCount: 0,
    correctionCount: 0,
    candidateCount: 0,
    immovableContactCount: 0,
    maxDetectedPenetration: 0,
    maxCorrectedPenetration: 0,
    residualMaxPenetration: 0,
    residualCount: 0,
    residualCandidateCount: 0,
    residualScope: 'bounded discrete cross-garment vertex-triangle queries plus contacts encountered this solve',
    continuousCollision: false,
    edgeEdgeCollision: false,
    selfCollision: false,
    frictionModel: 'bounded tangential relative-displacement damping',
    sampleContactPoints: [],
  };
}

// Closest point on a triangle using its vertex, edge and face Voronoi regions.
// Output: [qx, qy, qz, b0, b1, b2, squared distance].
function closestPoint(px, py, pz, positions, indices, offset, out) {
  const ia = indices[offset] * 3;
  const ib = indices[offset + 1] * 3;
  const ic = indices[offset + 2] * 3;
  const ax = positions[ia], ay = positions[ia + 1], az = positions[ia + 2];
  const abx = positions[ib] - ax, aby = positions[ib + 1] - ay, abz = positions[ib + 2] - az;
  const acx = positions[ic] - ax, acy = positions[ic + 1] - ay, acz = positions[ic + 2] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  let b0, b1, b2;
  if (d1 <= 0 && d2 <= 0) {
    b0 = 1; b1 = 0; b2 = 0;
  } else {
    const bpx = px - positions[ib], bpy = py - positions[ib + 1], bpz = pz - positions[ib + 2];
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) {
      b0 = 0; b1 = 1; b2 = 0;
    } else {
      const vc = d1 * d4 - d3 * d2;
      if (vc <= 0 && d1 >= 0 && d3 <= 0) {
        b1 = d1 / (d1 - d3); b0 = 1 - b1; b2 = 0;
      } else {
        const cpx = px - positions[ic], cpy = py - positions[ic + 1], cpz = pz - positions[ic + 2];
        const d5 = abx * cpx + aby * cpy + abz * cpz;
        const d6 = acx * cpx + acy * cpy + acz * cpz;
        if (d6 >= 0 && d5 <= d6) {
          b0 = 0; b1 = 0; b2 = 1;
        } else {
          const vb = d5 * d2 - d1 * d6;
          if (vb <= 0 && d2 >= 0 && d6 <= 0) {
            b2 = d2 / (d2 - d6); b0 = 1 - b2; b1 = 0;
          } else {
            const va = d3 * d6 - d5 * d4;
            if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
              b2 = (d4 - d3) / ((d4 - d3) + (d5 - d6)); b0 = 0; b1 = 1 - b2;
            } else {
              const denominator = va + vb + vc;
              if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-30) return false;
              b1 = vb / denominator; b2 = vc / denominator; b0 = 1 - b1 - b2;
            }
          }
        }
      }
    }
  }
  const qx = ax + b1 * abx + b2 * acx;
  const qy = ay + b1 * aby + b2 * acy;
  const qz = az + b1 * abz + b2 * acz;
  out[0] = qx; out[1] = qy; out[2] = qz;
  out[3] = b0; out[4] = b1; out[5] = b2;
  out[6] = (px - qx) ** 2 + (py - qy) ** 2 + (pz - qz) ** 2;
  return Number.isFinite(out[6]);
}

function normal(positions, indices, offset, out) {
  const a = indices[offset] * 3, b = indices[offset + 1] * 3, c = indices[offset + 2] * 3;
  const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
  const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);
  if (!(length > 1e-16) || !Number.isFinite(length)) return false;
  out[0] = nx / length; out[1] = ny / length; out[2] = nz / length;
  return true;
}

class TriangleHash {
  constructor(garment, expansion, cellSize, maxCells) {
    this.garment = garment;
    this.cellSize = cellSize;
    this.cells = new Map();
    this.large = [];
    this.bounds = new Float64Array(garment.triangles.length * 2);
    const p = garment.positions, t = garment.triangles;
    for (let f = 0; f < t.length; f += 3) {
      const a = t[f] * 3, b = t[f + 1] * 3, c = t[f + 2] * 3, row = f * 2;
      const lo = [0, 1, 2].map(k => Math.min(p[a + k], p[b + k], p[c + k]) - expansion);
      const hi = [0, 1, 2].map(k => Math.max(p[a + k], p[b + k], p[c + k]) + expansion);
      this.bounds.set([...lo, ...hi], row);
      const l = lo.map(x => Math.floor(x / cellSize));
      const h = hi.map(x => Math.floor(x / cellSize));
      const count = (h[0] - l[0] + 1) * (h[1] - l[1] + 1) * (h[2] - l[2] + 1);
      if (count > maxCells) {
        this.large.push(f);
        continue;
      }
      for (let x = l[0]; x <= h[0]; x++) for (let y = l[1]; y <= h[1]; y++) for (let z = l[2]; z <= h[2]; z++) {
        const key = `${x},${y},${z}`;
        let bucket = this.cells.get(key);
        if (!bucket) this.cells.set(key, bucket = []);
        bucket.push(f);
      }
    }
  }

  candidates(x, y, z) {
    const h = this.cellSize;
    const local = this.cells.get(`${Math.floor(x / h)},${Math.floor(y / h)},${Math.floor(z / h)}`) || [];
    return this.large.length ? local.concat(this.large) : local;
  }

  contains(offset, x, y, z) {
    const b = this.bounds, j = offset * 2;
    return x >= b[j] && y >= b[j + 1] && z >= b[j + 2] && x <= b[j + 3] && y <= b[j + 4] && z <= b[j + 5];
  }
}

/**
 * solve([{ id, positions, previous?, triangles, inverseMass?, thickness,
 *          enabled?: true }], { friction?: 0..1, passes?: 2 })
 *
 * Counts refer to vertex/triangle constraints, not unique physical contact
 * patches. Both directions are tested. maxCorrectedPenetration is the largest
 * applied relative normal correction, NOT a claim that all penetration ended.
 * Residual is independently recomputed after the final correction over the
 * bounded search domain; it is not a full triangle-intersection audit.
 */
export class LayerContact {
  constructor(options = {}) {
    this.cellSize = positive(options.cellSize, 0.04, 'cellSize');
    this.searchMargin = positive(options.searchMargin, 0.006, 'searchMargin', true);
    this.contactMargin = positive(options.contactMargin, 0.0005, 'contactMargin', true);
    this.maxCorrection = positive(options.maxCorrection, 0.01, 'maxCorrection');
    this.tolerance = positive(options.tolerance, 1e-7, 'tolerance', true);
    this.maxCellsPerTriangle = Math.floor(positive(options.maxCellsPerTriangle, 512, 'maxCellsPerTriangle'));
    this.sampleLimit = Math.floor(positive(options.sampleLimit, 12, 'sampleLimit', true));
    this._history = new Map();
    this._sides = new Map();
  }

  reset() {
    this._history.clear();
    this._sides.clear();
    return this;
  }

  _prepare(inputs) {
    const ids = new Set();
    const mutablePositions = [];
    return inputs.filter(g => g && g.enabled !== false).map(input => {
      if (input.id === undefined || input.id === null) throw new TypeError('Every garment needs a stable id');
      const id = String(input.id);
      if (ids.has(id)) throw new TypeError(`Duplicate garment id: ${id}`);
      ids.add(id);
      const p = input.positions, triangles = input.triangles;
      if (!p || p.length % 3 || !triangles || triangles.length % 3) throw new TypeError(`${id}: flat xyz positions and flat triangle indices required`);
      for (const other of mutablePositions) {
        const overlappingViews = p.buffer && p.buffer === other.buffer && p.byteOffset < other.byteOffset + other.byteLength && other.byteOffset < p.byteOffset + p.byteLength;
        if (p === other || overlappingViews) throw new TypeError(`${id}: independent garments cannot share mutable positions`);
      }
      mutablePositions.push(p);
      const count = p.length / 3;
      for (const value of p) if (!Number.isFinite(value)) throw new RangeError(`${id}: nonfinite position`);
      for (const index of triangles) if (!Number.isInteger(index) || index < 0 || index >= count) throw new RangeError(`${id}: triangle index outside positions`);
      const inverseMass = input.inverseMass;
      if (inverseMass) {
        if (inverseMass.length !== count) throw new RangeError(`${id}: inverseMass length mismatch`);
        for (const value of inverseMass) if (!Number.isFinite(value) || value < 0) throw new RangeError(`${id}: invalid inverse mass`);
      }
      const prior = this._history.get(id);
      const previous = input.previous || (prior?.triangles === triangles && prior.positions.length === p.length ? prior.positions : p);
      if (previous.length !== p.length) throw new RangeError(`${id}: previous length mismatch`);
      for (const value of previous) if (!Number.isFinite(value)) throw new RangeError(`${id}: nonfinite previous position`);
      return { id, positions: p, triangles, inverseMass, thickness: positive(input.thickness, 0.001, `${id}.thickness`, true), previous: Float64Array.from(previous), count };
    });
  }

  _contact(a, vertex, b, face, gap, radius, oldSides, newSides, scratch) {
    const index = vertex * 3, p = a.positions;
    const q = scratch.closest;
    if (!closestPoint(p[index], p[index + 1], p[index + 2], b.positions, b.triangles, face, q) || q[6] > radius * radius) return null;
    const n = scratch.normal;
    if (!normal(b.positions, b.triangles, face, n)) return null;
    const key = JSON.stringify([a.id, vertex, b.id, face / 3]);
    const prevNormal = scratch.previousNormal;
    let previousSideDistance = 0;
    if (normal(b.previous, b.triangles, face, prevNormal)) {
      for (let k = 0; k < 3; k++) {
        let point = 0;
        for (let j = 0; j < 3; j++) point += q[3 + j] * b.previous[b.triangles[face + j] * 3 + k];
        previousSideDistance += (a.previous[index + k] - point) * prevNormal[k];
      }
    }
    const delta = [p[index] - q[0], p[index + 1] - q[1], p[index + 2] - q[2]];
    const planeDistance = delta[0] * n[0] + delta[1] * n[1] + delta[2] * n[2];
    const side = Math.abs(previousSideDistance) > EPS ? Math.sign(previousSideDistance) : (newSides.get(key) || oldSides.get(key) || Math.sign(planeDistance) || 1);
    newSides.set(key, side);
    let distance;
    if (q[3] > INTERIOR_EPS && q[4] > INTERIOR_EPS && q[5] > INTERIOR_EPS) {
      distance = side * planeDistance;
      n[0] *= side; n[1] *= side; n[2] *= side;
    } else {
      distance = Math.sqrt(q[6]);
      if (distance > EPS) {
        n[0] = delta[0] / distance; n[1] = delta[1] / distance; n[2] = delta[2] / distance;
      } else {
        n[0] *= side; n[1] *= side; n[2] *= side;
      }
    }
    const penetration = gap - distance;
    if (!(penetration > this.tolerance)) return null;
    return { key, vertex, face, bary: [q[3], q[4], q[5]], normal: [n[0], n[1], n[2]], penetration, a, b };
  }

  _visit(a, b, callback, oldSides, newSides) {
    const gap = (a.thickness + b.thickness) * 0.5 + this.contactMargin;
    const radius = gap + this.searchMargin;
    // Rebuilt for each directional sweep and pass. Expansion includes the
    // correction budget to reduce stale-AABB omissions during that sweep.
    const hash = new TriangleHash(b, radius + this.maxCorrection, this.cellSize, this.maxCellsPerTriangle);
    const scratch = { closest: new Float64Array(7), normal: new Float64Array(3), previousNormal: new Float64Array(3) };
    let candidates = 0;
    for (let i = 0; i < a.count; i++) {
      const j = i * 3, p = a.positions;
      for (const f of hash.candidates(p[j], p[j + 1], p[j + 2])) {
        if (!hash.contains(f, p[j], p[j + 1], p[j + 2])) continue;
        candidates++;
        const contact = this._contact(a, i, b, f, gap, radius, oldSides, newSides, scratch);
        if (contact) callback(contact);
      }
    }
    return candidates;
  }

  _correct(contact, friction) {
    const { a, b, vertex, face, bary, normal: n } = contact;
    const pointWeight = a.inverseMass ? a.inverseMass[vertex] : 1;
    const weights = bary.map((_, k) => b.inverseMass ? b.inverseMass[b.triangles[face + k]] : 1);
    const effectiveMass = pointWeight + bary.reduce((sum, value, k) => sum + value * value * weights[k], 0);
    if (!(effectiveMass > 0)) return 0;
    const correction = Math.min(contact.penetration, this.maxCorrection);
    const multiplier = correction / effectiveMass;
    const vi = vertex * 3;
    for (let k = 0; k < 3; k++) {
      a.positions[vi + k] += pointWeight * multiplier * n[k];
      for (let j = 0; j < 3; j++) b.positions[b.triangles[face + j] * 3 + k] -= weights[j] * bary[j] * multiplier * n[k];
    }
    if (friction > 0) {
      const relative = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        relative[k] = a.positions[vi + k] - a.previous[vi + k];
        for (let j = 0; j < 3; j++) {
          const bi = b.triangles[face + j] * 3 + k;
          relative[k] -= bary[j] * (b.positions[bi] - b.previous[bi]);
        }
      }
      const normalAmount = relative[0] * n[0] + relative[1] * n[1] + relative[2] * n[2];
      const tangent = relative.map((value, k) => value - normalAmount * n[k]);
      const length = Math.hypot(...tangent);
      if (length > EPS) {
        const scale = Math.min(friction, friction * correction / length) / effectiveMass;
        for (let k = 0; k < 3; k++) {
          a.positions[vi + k] -= pointWeight * scale * tangent[k];
          for (let j = 0; j < 3; j++) b.positions[b.triangles[face + j] * 3 + k] += weights[j] * bary[j] * scale * tangent[k];
        }
      }
    }
    return correction;
  }

  solve(inputs, { friction = 0, passes = 2, measureResidual = true } = {}) {
    if (!Array.isArray(inputs)) throw new TypeError('garments must be an array');
    if (!Number.isFinite(friction) || friction < 0 || friction > 1) throw new RangeError('friction must be between 0 and 1');
    if (!Number.isInteger(passes) || passes < 1 || passes > 32) throw new RangeError('passes must be an integer between 1 and 32');
    if (typeof measureResidual !== 'boolean') throw new TypeError('measureResidual must be boolean');
    const garments = this._prepare(inputs), result = emptyResult();
    const previousSides = this._sides, nextSides = new Map(), contacts = new Map(), fixed = new Set();
    for (let pass = 0; pass < passes; pass++) {
      for (let i = 0; i < garments.length; i++) for (let j = i + 1; j < garments.length; j++) {
        // Alternate visit order to reduce a persistent first-garment bias.
        const directions = pass % 2 ? [[garments[j], garments[i]], [garments[i], garments[j]]] : [[garments[i], garments[j]], [garments[j], garments[i]]];
        for (const [a, b] of directions) result.candidateCount += this._visit(a, b, contact => {
          const prior = contacts.get(contact.key);
          if (!prior || contact.penetration > prior.penetration) contacts.set(contact.key, contact);
          result.maxDetectedPenetration = Math.max(result.maxDetectedPenetration, contact.penetration);
          const corrected = this._correct(contact, friction);
          if (corrected > 0) {
            result.correctionCount++;
            result.maxCorrectedPenetration = Math.max(result.maxCorrectedPenetration, corrected);
          } else fixed.add(contact.key);
        }, previousSides, nextSides);
      }
    }
    result.contactCount = contacts.size;
    result.immovableContactCount = fixed.size;
    const residuals = new Map();
    if (measureResidual) for (let i = 0; i < garments.length; i++) for (let j = 0; j < garments.length; j++) if (i !== j) {
      result.residualCandidateCount += this._visit(garments[i], garments[j], contact => {
        residuals.set(contact.key, contact.penetration);
        result.residualMaxPenetration = Math.max(result.residualMaxPenetration, contact.penetration);
      }, previousSides, nextSides);
    }
    // Recheck every constraint we actually touched, even if another correction
    // moved it outside the final broadphase radius. Unseen distant intersections
    // remain outside this method's stated scope.
    const residualScratch = { closest: new Float64Array(7), normal: new Float64Array(3), previousNormal: new Float64Array(3) };
    if (measureResidual) for (const prior of contacts.values()) {
      const { a, b, vertex, face } = prior;
      const gap = (a.thickness + b.thickness) * 0.5 + this.contactMargin;
      const contact = this._contact(a, vertex, b, face, gap, Infinity, previousSides, nextSides, residualScratch);
      if (contact) {
        residuals.set(contact.key, contact.penetration);
        result.residualMaxPenetration = Math.max(result.residualMaxPenetration, contact.penetration);
      }
    }
    result.residualCount = measureResidual ? residuals.size : null;
    if (!measureResidual) {
      result.residualMaxPenetration = null;
      result.residualScope = 'not measured in this solve call; use measure() on the final state';
    }
    const q = new Float64Array(7);
    for (const contact of contacts.values()) {
      if (result.sampleContactPoints.length >= this.sampleLimit) break;
      const { a, b, vertex, face } = contact, j = vertex * 3;
      const pa = Array.from(a.positions.slice(j, j + 3));
      if (!closestPoint(...pa, b.positions, b.triangles, face, q)) continue;
      const pb = [q[0], q[1], q[2]];
      result.sampleContactPoints.push({
        garmentA: a.id, garmentB: b.id, vertexIndex: vertex, triangleIndex: face / 3,
        point: pa.map((value, k) => (value + pb[k]) * 0.5),
        pointA: pa, pointB: pb, normal: contact.normal.slice(),
        penetrationBefore: contact.penetration,
        residualPenetration: measureResidual ? (residuals.get(contact.key) || 0) : null,
      });
    }
    // Replace, rather than append, state: disabled/removed garments leave no
    // collision objects or retained history behind. Position history is copied;
    // only the immutable topology identity is retained to detect replacement.
    this._history = new Map(garments.map(g => [g.id, { positions: Float64Array.from(g.positions), triangles: g.triangles }]));
    this._sides = garments.length > 1 ? nextSides : new Map();
    return result;
  }

  /** A read-only final-state query, including after a different constraint
   * solver (for example body contact) has moved the garments. It does not
   * advance previous-position history, change side history, or correct cloth.
   */
  measure(inputs) {
    if (!Array.isArray(inputs)) throw new TypeError('garments must be an array');
    const garments = this._prepare(inputs), result = emptyResult(), sides = new Map();
    result.measurementOnly = true;
    result.residualScope = 'bounded discrete cross-garment vertex-triangle queries at the measured positions';
    const q = new Float64Array(7);
    for (let i = 0; i < garments.length; i++) for (let j = 0; j < garments.length; j++) if (i !== j) {
      result.residualCandidateCount += this._visit(garments[i], garments[j], contact => {
        result.residualCount++;
        result.residualMaxPenetration = Math.max(result.residualMaxPenetration, contact.penetration);
        if (result.sampleContactPoints.length >= this.sampleLimit) return;
        const { a, b, vertex, face } = contact;
        const pa = Array.from(a.positions.slice(vertex * 3, vertex * 3 + 3));
        if (!closestPoint(...pa, b.positions, b.triangles, face, q)) return;
        const pb = [q[0], q[1], q[2]];
        result.sampleContactPoints.push({
          garmentA: a.id, garmentB: b.id, vertexIndex: vertex, triangleIndex: face / 3,
          point: pa.map((value, k) => (value + pb[k]) * 0.5),
          pointA: pa, pointB: pb, normal: contact.normal.slice(),
          penetrationBefore: contact.penetration, residualPenetration: contact.penetration,
        });
      }, this._sides, sides);
    }
    result.contactCount = result.residualCount;
    result.maxDetectedPenetration = result.residualMaxPenetration;
    return result;
  }
}

export default LayerContact;
