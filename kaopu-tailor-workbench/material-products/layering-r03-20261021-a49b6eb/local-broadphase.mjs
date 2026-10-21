/**
 * Live swept bounds for the existing ordered garment-contact traversal.
 *
 * These boxes include every current and previous endpoint of a finite feature.
 * They are exclusion proofs only: no visibility, low speed, heuristic activity
 * score or sleeping state is allowed to remove a constraint. After a reciprocal
 * correction, refit the moved vertices and every incident triangle and edge
 * before inspecting the next candidate. Candidate lists and their order remain
 * owned by the retained conservative skin broadphase.
 */
export class LiveFeatureBounds {
  constructor(garment) {
    this.garment = garment;
    const { count, triangles, topology } = garment;
    this.points = new Float64Array(count * 6);
    this.faces = new Float64Array(triangles.length * 2);
    this.edges = new Float64Array(topology.edgeVertices.length * 3);
    this.faceMarks = new Uint32Array(triangles.length / 3);
    this.edgeMarks = new Uint32Array(topology.edgeVertices.length / 2);
    this.epoch = 0;
    this.stats = null;
    if (!topology.vertexEdges) {
      const adjacent = Array.from({ length: count }, () => []), e = topology.edgeVertices;
      for (let i = 0; i < e.length; i += 2) {
        adjacent[e[i]].push(i / 2);
        if (e[i] !== e[i + 1]) adjacent[e[i + 1]].push(i / 2);
      }
      topology.vertexEdges = adjacent;
    }
    for (let i = 0; i < count; i++) this._point(i);
    for (let f = 0; f < triangles.length; f += 3) this._face(f);
    for (let e = 0; e < topology.edgeVertices.length / 2; e++) this._edge(e);
  }

  _point(vertex) {
    const { positions: p, previous: q } = this.garment, k = vertex * 3, o = vertex * 6, b = this.points;
    for (let d = 0; d < 3; d++) { b[o + d] = Math.min(p[k + d], q[k + d]); b[o + d + 3] = Math.max(p[k + d], q[k + d]); }
  }

  _face(face) {
    const g = this.garment, t = g.triangles, p = g.positions, q = g.previous;
    const a = t[face] * 3, b = t[face + 1] * 3, c = t[face + 2] * 3, o = face * 2, box = this.faces;
    for (let d = 0; d < 3; d++) {
      box[o + d] = Math.min(p[a + d], p[b + d], p[c + d], q[a + d], q[b + d], q[c + d]);
      box[o + d + 3] = Math.max(p[a + d], p[b + d], p[c + d], q[a + d], q[b + d], q[c + d]);
    }
    if (this.stats) this.stats.localBoundsRefitFaces++;
  }

  _edge(edge) {
    const g = this.garment, e = g.topology.edgeVertices, p = g.positions, q = g.previous;
    const a = e[edge * 2] * 3, b = e[edge * 2 + 1] * 3, o = edge * 6, box = this.edges;
    for (let d = 0; d < 3; d++) {
      box[o + d] = Math.min(p[a + d], p[b + d], q[a + d], q[b + d]);
      box[o + d + 3] = Math.max(p[a + d], p[b + d], q[a + d], q[b + d]);
    }
    if (this.stats) this.stats.localBoundsRefitEdges++;
  }

  _nextEpoch() {
    this.epoch++;
    if (this.epoch === 4294967295) { this.faceMarks.fill(0); this.edgeMarks.fill(0); this.epoch = 1; }
  }

  _refit(vertex) {
    this._point(vertex);
    if (this.stats) this.stats.localBoundsRefitVertices++;
    for (const face of this.garment.topology.vertexFaces[vertex]) if (this.faceMarks[face / 3] !== this.epoch) {
      this.faceMarks[face / 3] = this.epoch; this._face(face);
    }
    for (const edge of this.garment.topology.vertexEdges[vertex]) if (this.edgeMarks[edge] !== this.epoch) {
      this.edgeMarks[edge] = this.epoch; this._edge(edge);
    }
  }

  refitVertex(vertex) { this._nextEpoch(); this._refit(vertex); }

  refitIndices(indices, offset, count) {
    this._nextEpoch();
    for (let i = 0; i < count; i++) this._refit(indices[offset + i]);
  }
}

// Use the identical source-side expansion and strict comparisons as R02.
// This preserves equality at a floating-point/tolerance boundary.
function separated(source, sourceOffset, target, targetOffset, radius) {
  const r = radius + 1e-8;
  for (let d = 0; d < 3; d++) {
    if (target[targetOffset + d] > source[sourceOffset + d + 3] + r) return true;
    if (target[targetOffset + d + 3] < source[sourceOffset + d] - r) return true;
  }
  return false;
}

export function separatedLiveVertexFace(a, vertex, b, face, radius) {
  return separated(a.points, vertex * 6, b.faces, face * 2, radius);
}

export function separatedLiveEdges(a, edgeA, b, edgeB, radius) {
  return separated(a.edges, edgeA * 6, b.edges, edgeB * 6, radius);
}
