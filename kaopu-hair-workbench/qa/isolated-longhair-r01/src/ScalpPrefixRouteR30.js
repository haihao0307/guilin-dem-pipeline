import * as T from '/native/kaopu-unified-human-workbench/full/source/registration-vendor/three.module.js';

/** Optional static fallback, NOT connected to PackedGroomR30.
 * Builds an edge graph from an explicit allowlist of FINAL displayed scalp
 * triangles. There is no all-body fallback and no unconstrained smoothing.
 * A route in this graph is continuous on the allowed triangle union. Its
 * 20-segment lifted approximation is NOT guaranteed collision-free or natural.
 * The caller must retain full rendered-polyline/radius QA after applying it.
 * Rebuild this static graph if displayed body geometry changes. If applying to
 * already-attached textures, the caller must mark uploads dirty and update bounds.
 */
export function createScalpPrefixRouteR30({positions, normals, triangleIndices, allowedTriangleIds,
  edgeAllowed = null, connectionAllowed = null} = {}) {
  const started = performance.now();
  if (!positions || !normals || positions.length % 3 || normals.length !== positions.length || !triangleIndices || triangleIndices.length % 3)
    throw new Error('Final displayed xyz positions, normals and triangle indices are required');
  if (!allowedTriangleIds || allowedTriangleIds.length === 0) throw new Error('An explicit nonempty scalp triangle allowlist is required');
  if (edgeAllowed !== null && typeof edgeAllowed !== 'function') throw new Error('edgeAllowed must be a function or null');
  if (connectionAllowed !== null && typeof connectionAllowed !== 'function') throw new Error('connectionAllowed must be a function or null');
  // Callbacks are optional fail-closed boolean filters. edgeAllowed describes
  // an UNDIRECTED edge and is evaluated once per unique final-vertex pair.
  // connectionAllowed receives actual on-triangle endpoints and the containing
  // face IDs, including the otherwise-short-circuited same-face direct path.
  const filterStats = {edgeCallbackEnabled: !!edgeAllowed, connectionCallbackEnabled: !!connectionAllowed,
    checkedEdges: 0, acceptedEdges: 0, rejectedEdges: 0,
    checkedConnections: 0, acceptedConnections: 0, rejectedConnections: 0,
    checkedSameFaceConnections: 0, rejectedSameFaceConnections: 0,
    anchorsRejectedForNoAllowedConnection: 0};
  const edgeDecisions = new Map();
  const vertexCount = positions.length / 3;
  const graph = new Map(), records = new Map(), vertices = new Map(), vertexNormals = new Map();
  function vector(value, name) {
    const out = value?.isVector3 ? value.clone() : new T.Vector3(...value);
    if (!out.toArray().every(Number.isFinite)) throw new Error(`${name} must contain finite coordinates`);
    return out;
  }
  function vertex(id) {
    if (!vertices.has(id)) {
      if (!Number.isInteger(id) || id < 0 || id >= vertexCount) throw new Error('Allowed triangle has an invalid final vertex ID');
      const p = new T.Vector3().fromArray(positions, id * 3), n = new T.Vector3().fromArray(normals, id * 3);
      if (!p.toArray().every(Number.isFinite) || !n.toArray().every(Number.isFinite) || n.lengthSq() < 1e-18)
        throw new Error('Allowed scalp geometry has a nonfinite position or degenerate native normal');
      vertices.set(id, p); vertexNormals.set(id, n.normalize()); graph.set(id, new Map());
    }
    return vertices.get(id);
  }
  for (const id of allowedTriangleIds) {
    if (!Number.isInteger(id) || id < 0 || id >= triangleIndices.length / 3) throw new Error('Invalid allowed final triangle ID');
    if (records.has(id)) continue;
    const ids = Array.from(triangleIndices.slice(id * 3, id * 3 + 3));
    const tri = new T.Triangle(...ids.map(vertex));
    if (tri.getArea() <= 1e-18) throw new Error(`Allowed triangle ${id} is degenerate`);
    records.set(id, {id, ids, tri});
    for (let edge = 0; edge < 3; edge++) {
      const a = ids[edge], b = ids[(edge + 1) % 3], length = vertex(a).distanceTo(vertex(b));
      const key = `${Math.min(a, b)},${Math.max(a, b)}`;
      if (!edgeDecisions.has(key)) {
        const allowed = !edgeAllowed || edgeAllowed({aId: a, bId: b, triangleId: id,
          triangleVertexIds: [...ids], a: vertex(a).toArray(), b: vertex(b).toArray()}) === true;
        edgeDecisions.set(key, allowed); filterStats.checkedEdges++;
        if (allowed) filterStats.acceptedEdges++; else filterStats.rejectedEdges++;
      }
      if (length > 0 && edgeDecisions.get(key)) { graph.get(a).set(b, length); graph.get(b).set(a, length); }
    }
  }
  let searches = 0, visitedVertices = 0;
  const changedStrands = new Set();
  const buildMs = performance.now() - started;

  function permitsConnection(record, from, to, {kind, role, toVertexId = null}) {
    filterStats.checkedConnections++;
    if (kind === 'same-face') filterStats.checkedSameFaceConnections++;
    const allowed = !connectionAllowed || connectionAllowed({kind, role,
      triangleId: record.id, triangleVertexIds: [...record.ids],
      from: from.toArray(), to: to.toArray(), toVertexId}) === true;
    if (allowed) filterStats.acceptedConnections++;
    else { filterStats.rejectedConnections++; if (kind === 'same-face') filterStats.rejectedSameFaceConnections++; }
    return allowed;
  }

  function anchor(point, triangleId, maxDistanceM, role) {
    const candidates = triangleId === undefined || triangleId === null ? records.values() : [records.get(triangleId)];
    if (triangleId !== undefined && triangleId !== null && !records.has(triangleId))
      throw new Error('Explicit endpoint support is outside the legal scalp triangle allowlist');
    let best = null, bestSquared = Infinity;
    const closest = new T.Vector3();
    for (const record of candidates) {
      record.tri.closestPointToPoint(point, closest);
      const squared = point.distanceToSquared(closest);
      if (squared < bestSquared && squared <= maxDistanceM * maxDistanceM) {
        const support = closest.clone();
        const connectionVertexIds = record.ids.filter(id => permitsConnection(record, support, vertex(id), {kind: 'anchor-to-vertex', role, toVertexId: id}));
        if (!connectionVertexIds.length) { filterStats.anchorsRejectedForNoAllowedConnection++; continue; }
        bestSquared = squared; best = {record, point: support, connectionVertexIds};
      }
    }
    if (!best || Math.sqrt(bestSquared) > maxDistanceM) throw new Error('Endpoint has no allowed scalp support and allowed vertex connection within the explicit anchor-distance bound');
    const bary = best.record.tri.getBarycoord(best.point, new T.Vector3()), normal = new T.Vector3();
    best.record.ids.forEach((id, index) => normal.addScaledVector(vertexNormals.get(id), bary.getComponent(index)));
    if (normal.lengthSq() < 1e-18) throw new Error('Endpoint support has a degenerate interpolated normal');
    return {...best, normal: normal.normalize(), distanceM: Math.sqrt(bestSquared)};
  }

  function shortestVertexPath(start, end) {
    searches++;
    const distances = new Map(), previous = new Map(), heap = [];
    const push = (id, distance) => {
      const entry = [id, distance]; heap.push(entry); let index = heap.length - 1;
      while (index > 0) { const parent = (index - 1) >> 1; if (heap[parent][1] <= distance) break; heap[index] = heap[parent]; index = parent; }
      heap[index] = entry;
    };
    const pop = () => {
      const first = heap[0], last = heap.pop();
      if (heap.length) { let index = 0; while (index * 2 + 1 < heap.length) { let child = index * 2 + 1; if (child + 1 < heap.length && heap[child + 1][1] < heap[child][1]) child++; if (heap[child][1] >= last[1]) break; heap[index] = heap[child]; index = child; } heap[index] = last; }
      return first;
    };
    for (const id of start.connectionVertexIds) {
      const distance = start.point.distanceTo(vertex(id)); distances.set(id, distance); previous.set(id, null); push(id, distance);
    }
    const endIds = new Set(end.connectionVertexIds); let bestEnd = null, bestDistance = Infinity;
    while (heap.length) {
      const [id, distance] = pop();
      if (distance !== distances.get(id)) continue;
      if (distance >= bestDistance) break;
      visitedVertices++;
      if (endIds.has(id)) {
        const fullDistance = distance + vertex(id).distanceTo(end.point);
        if (fullDistance < bestDistance) { bestDistance = fullDistance; bestEnd = id; }
      }
      for (const [neighbor, length] of graph.get(id)) {
        const next = distance + length;
        if (next < (distances.get(neighbor) ?? Infinity)) { distances.set(neighbor, next); previous.set(neighbor, id); push(neighbor, next); }
      }
    }
    if (bestEnd === null) throw new Error('Root and release are disconnected inside the legal scalp subgraph; no body/face detour is permitted');
    const ids = []; for (let id = bestEnd; id !== null; id = previous.get(id)) ids.push(id);
    return ids.reverse();
  }

  /** Candidate only. Interior j=1..19 samples get a nominal 4 mm normal lift;
   * root j=0 and release j=20 keep the supplied coordinates exactly.
   * Arc-length sampling refers to the legal SURFACE-edge path before lifting.
   * The resulting rendered chords can cut corners and still require full QA.
   */
  function routePrefix({root, release, rootTriangleId, releaseTriangleId, normalGapM = 0.004,
    maxAnchorDistanceM = 0.008, maxRouteLengthM = 0.4} = {}) {
    const routeStarted = performance.now(), rootPoint = vector(root, 'root'), releasePoint = vector(release, 'release');
    for (const [name, value] of Object.entries({normalGapM, maxAnchorDistanceM, maxRouteLengthM}))
      if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be finite and positive`);
    const start = anchor(rootPoint, rootTriangleId, maxAnchorDistanceM, 'root');
    const end = anchor(releasePoint, releaseTriangleId, maxAnchorDistanceM, 'release');
    const sameFaceDirectAllowed = start.record.id === end.record.id && permitsConnection(start.record, start.point, end.point, {kind: 'same-face', role: 'root-to-release'});
    const ids = sameFaceDirectAllowed ? [] : shortestVertexPath(start, end);
    const surface = [{point: start.point, normal: start.normal, vertexId: null}];
    for (const id of ids) if (surface.at(-1).point.distanceToSquared(vertex(id)) > 1e-20)
      surface.push({point: vertex(id), normal: vertexNormals.get(id), vertexId: id});
    if (surface.at(-1).point.distanceToSquared(end.point) > 1e-20)
      surface.push({point: end.point, normal: end.normal, vertexId: null});
    const cumulative = [0];
    for (let i = 1; i < surface.length; i++) cumulative.push(cumulative.at(-1) + surface[i - 1].point.distanceTo(surface[i].point));
    const surfaceRouteLengthM = cumulative.at(-1);
    if (!(surfaceRouteLengthM > 1e-10) || surfaceRouteLengthM > maxRouteLengthM)
      throw new Error('Allowed scalp route is degenerate or exceeds the explicit route-length bound');
    const points = [], outputNormals = [], supports = []; let edge = 1;
    for (let j = 0; j <= 20; j++) {
      const distance = surfaceRouteLengthM * j / 20;
      while (edge < cumulative.length - 1 && cumulative[edge] < distance) edge++;
      const length = cumulative[edge] - cumulative[edge - 1];
      const t = Math.max(0, Math.min(1, (distance - cumulative[edge - 1]) / length));
      const normal = surface[edge - 1].normal.clone().lerp(surface[edge].normal, t);
      if (normal.lengthSq() < 1e-18) throw new Error('Route crosses a degenerate normal interpolation');
      normal.normalize();
      const support = surface[edge - 1].point.clone().lerp(surface[edge].point, t);
      const point = j === 0 ? rootPoint.clone() : j === 20 ? releasePoint.clone() : support.clone().addScaledVector(normal, normalGapM);
      points.push(point.toArray()); outputNormals.push(normal.toArray()); supports.push(support.toArray());
    }
    let renderedLengthM = 0, maxRenderedSegmentM = 0;
    for (let j = 1; j <= 20; j++) { const length = vector(points[j], 'sample').distanceTo(vector(points[j - 1], 'sample')); renderedLengthM += length; maxRenderedSegmentM = Math.max(maxRenderedSegmentM, length); }
    return {points, normals: outputNormals, surfaceSupports: supports, graphVertexIds: ids,
      report: {kind: 'restricted-scalp-edge prefix fallback candidate', surfaceSegments: 20,
        rootTriangleId: start.record.id, releaseTriangleId: end.record.id,
        rootAnchorDistanceM: start.distanceM, releaseAnchorDistanceM: end.distanceM,
        surfaceRouteLengthM, renderedLengthM, maxRenderedSegmentM,
        nominalNormalGapM: normalGapM, fixedPointIndices: [0, 20], graphVertexCount: ids.length,
        sampling: '20 equal surface-edge arc-length intervals, then interpolated-unit-normal interior lift',
        legalSurfacePath: true, collisionVerified: false, naturalGroomClaimed: false,
        filteredBoundaryRouting: !!edgeAllowed || !!connectionAllowed,
        sameFaceDirectUsed: sameFaceDirectAllowed,
        rootAllowedConnectionVertexIds: [...start.connectionVertexIds],
        releaseAllowedConnectionVertexIds: [...end.connectionVertexIds],
        elapsedMs: performance.now() - routeStarted,
        limitations: ['edge-shortest path is not an authored natural groom', 'normal-offset polyline and resampled chords require complete collision QA', 'no full-radius clearance guarantee', 'scalp legality depends on the explicit caller allowlist and optional sampled filters', 'vertex graph can conservatively reject narrow valid within-face routes'],
      }};
  }

  /** Explicit per-strand application only. Never loops over or selects roots.
   * Writes xyz/normal xyz for j=1..19. Keeps endpoints 0/20, all radius/random
   * alpha channels, all other strands, and free points 21..64 bit-identical.
   */
  function applyToPacked({pointData, normalData, strandIndex, rootTriangleId, releaseTriangleId, ...options} = {}) {
    if (!(pointData instanceof Float32Array) || !Number.isInteger(strandIndex) || strandIndex < 0 || (strandIndex + 1) * 65 * 4 > pointData.length)
      throw new Error('Pass one explicit strand in the 65-point RGBA32F packed layout');
    if (normalData && (!(normalData instanceof Float32Array) || (strandIndex + 1) * 21 * 4 > normalData.length))
      throw new Error('Invalid 21-point RGBA32F normal layout');
    const root = Array.from(pointData.subarray(strandIndex * 65 * 4, strandIndex * 65 * 4 + 3));
    const end = (strandIndex * 65 + 20) * 4;
    const release = Array.from(pointData.subarray(end, end + 3));
    const result = routePrefix({...options, root, release, rootTriangleId, releaseTriangleId});
    let changedPointCount = 0;
    for (let j = 1; j < 20; j++) {
      const p = (strandIndex * 65 + j) * 4, n = (strandIndex * 21 + j) * 4;
      let changed = false;
      for (let k = 0; k < 3; k++) {
        const value = Math.fround(result.points[j][k]);
        if (value !== pointData[p + k]) changed = true;
        pointData[p + k] = value;
        if (normalData) normalData[n + k] = result.normals[j][k];
      }
      if (changed) changedPointCount++;
    }
    if (changedPointCount) changedStrands.add(strandIndex);
    return {...result, report: {...result.report, strandIndex, changedPointCount,
      rootCoordinatesChanged: 0, releaseCoordinatesChanged: 0, freePointsChanged: 0,
      normalDataUpdated: !!normalData}};
  }
  return {routePrefix, applyToPacked, report: () => ({kind: 'explicit legal scalp subgraph only',
    allowedTriangleCount: records.size, allowedVertexCount: graph.size, searches, visitedVertices,
    changedRootCount: changedStrands.size, changedStrandIndices: [...changedStrands],
    rootCoordinatesChanged: 0, wholeBodyFallback: false, automaticallyApplied: false, buildMs,
    filters: {...filterStats},
  })};
}
