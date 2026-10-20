/**
 * Independent, read-only triangle intersection audit for solver snapshots.
 *
 * This does not import the contact solver, its grid, or its cached neighbours.
 * A separate triangle AABB tree supplies candidates. All three edges of each
 * triangle are checked against the other triangle, in both directions.
 * Coplanar positive-area overlap is checked by projected polygon clipping.
 * This is discrete geometry validation, not clearance, CCD, or yarn contact.
 */
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const length = a => Math.hypot(...a);
const interpolate = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const orient2 = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const project2 = (point, axis) => point.filter((_, i) => i !== axis);
const signedDistance = (point, triangle) => dot(sub(point, triangle.points[0]), triangle.normal);

function boxOverlap(a, b, epsilon) {
  return a[0] <= b[3] + epsilon && b[0] <= a[3] + epsilon
    && a[1] <= b[4] + epsilon && b[1] <= a[4] + epsilon
    && a[2] <= b[5] + epsilon && b[2] <= a[5] + epsilon;
}

function unionBox(triangles, start, end) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = start; i < end; i++) for (let d = 0; d < 3; d++) {
    box[d] = Math.min(box[d], triangles[i].box[d]);
    box[d + 3] = Math.max(box[d + 3], triangles[i].box[d + 3]);
  }
  return box;
}

export function makeMesh(mesh, epsilon, leafSize) {
  if (!mesh || typeof mesh.id !== 'string' || !mesh.id) throw new TypeError('Each mesh needs its own string id');
  const p = mesh.positions, indices = mesh.indices ?? mesh.triangles;
  if (!p || !indices || p.length % 3 || indices.length % 3) throw new TypeError(mesh.id + ': invalid position or triangle array');
  for (const coordinate of p) if (!Number.isFinite(coordinate)) throw new TypeError(mesh.id + ': nonfinite geometry');
  for (const index of indices) if (!Number.isInteger(index) || index < 0 || index * 3 >= p.length) {
    throw new RangeError(mesh.id + ': invalid triangle index');
  }
  const triangles = [], degenerate = [];
  for (let i = 0; i < indices.length; i += 3) {
    const ids = [indices[i], indices[i + 1], indices[i + 2]];
    const points = ids.map(id => [p[id * 3], p[id * 3 + 1], p[id * 3 + 2]]);
    const n = cross(sub(points[1], points[0]), sub(points[2], points[0]));
    const area2 = length(n);
    if (area2 <= epsilon * epsilon) {degenerate.push(i / 3); continue;}
    const normal = n.map(v => v / area2);
    const axis = Math.abs(normal[0]) >= Math.abs(normal[1]) && Math.abs(normal[0]) >= Math.abs(normal[2]) ? 0
      : Math.abs(normal[1]) >= Math.abs(normal[2]) ? 1 : 2;
    const projected = points.map(point => project2(point, axis));
    triangles.push({index: i / 3, ids, points, normal, axis, projected,
      winding: Math.sign(orient2(...projected)),
      box: [0, 1, 2].map(d => Math.min(...points.map(point => point[d])))
        .concat([0, 1, 2].map(d => Math.max(...points.map(point => point[d])))),
      center: [0, 1, 2].map(d => points.reduce((sum, point) => sum + point[d], 0) / 3)});
  }
  function tree(start, end) {
    const box = unionBox(triangles, start, end);
    if (end - start <= leafSize) return {box, start, end};
    const span = [0, 1, 2].map(d => box[d + 3] - box[d]);
    const axis = span[0] >= span[1] && span[0] >= span[2] ? 0 : span[1] >= span[2] ? 1 : 2;
    const sorted = triangles.slice(start, end).sort((a, b) => a.center[axis] - b.center[axis] || a.index - b.index);
    for (let i = 0; i < sorted.length; i++) triangles[start + i] = sorted[i];
    const middle = start + Math.floor((end - start) / 2);
    return {box, start, end, left: tree(start, middle), right: tree(middle, end)};
  }
  return {id: mesh.id, positions: p, indices, triangles, degenerate,
    triangleCount: indices.length / 3, root: triangles.length ? tree(0, triangles.length) : null};
}

function insideProjected(point, triangle, epsilon) {
  const p = project2(point, triangle.axis), vertices = triangle.projected;
  for (let i = 0; i < 3; i++) {
    const a = vertices[i], b = vertices[(i + 1) % 3];
    const tolerance = epsilon * Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (triangle.winding * orient2(a, b, p) < -tolerance) return false;
  }
  return true;
}

// When an edge lies in the target triangle's plane, clip its parameter range
// against all three triangle half-planes. This catches an overlap even when
// both segment endpoints lie outside the triangle.
function coplanarSegment(a, b, triangle, epsilon) {
  const A = project2(a, triangle.axis), B = project2(b, triangle.axis);
  let enter = 0, exit = 1;
  for (let i = 0; i < 3; i++) {
    const p = triangle.projected[i], q = triangle.projected[(i + 1) % 3];
    const c0 = triangle.winding * orient2(p, q, A), c1 = triangle.winding * orient2(p, q, B);
    const tolerance = epsilon * Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (c0 < -tolerance && c1 < -tolerance) return null;
    if (c0 >= -tolerance && c1 >= -tolerance) continue;
    const t = c0 / (c0 - c1);
    if (c0 < -tolerance) enter = Math.max(enter, t); else exit = Math.min(exit, t);
    if (enter > exit) return null;
  }
  return {kind: 'touch', point: interpolate(a, b, Math.max(0, Math.min(1, (enter + exit) / 2))), t: (enter + exit) / 2};
}

function segmentTriangle(a, b, triangle, epsilon) {
  const d0 = signedDistance(a, triangle), d1 = signedDistance(b, triangle);
  if ((d0 > epsilon && d1 > epsilon) || (d0 < -epsilon && d1 < -epsilon)) return null;
  if (Math.abs(d0) <= epsilon && Math.abs(d1) <= epsilon) return coplanarSegment(a, b, triangle, epsilon);
  const t = d0 / (d0 - d1);
  const toleranceT = epsilon / Math.max(epsilon, length(sub(b, a)));
  if (t < -toleranceT || t > 1 + toleranceT) return null;
  const point = interpolate(a, b, Math.max(0, Math.min(1, t)));
  if (!insideProjected(point, triangle, epsilon)) return null;
  const crossing = (d0 > epsilon && d1 < -epsilon) || (d0 < -epsilon && d1 > epsilon);
  return {kind: crossing ? 'crossing' : 'touch', point, t};
}

function coplanarOverlap(a, b, epsilon) {
  const projectedB = b.points.map(point => project2(point, a.axis));
  let polygon = a.projected.map(point => point.slice());
  const winding = Math.sign(orient2(...projectedB));
  for (let i = 0; i < 3 && polygon.length; i++) {
    const A = projectedB[i], B = projectedB[(i + 1) % 3];
    const tolerance = epsilon * Math.hypot(B[0] - A[0], B[1] - A[1]);
    const clipped = [];
    for (let j = 0; j < polygon.length; j++) {
      const P = polygon[j], Q = polygon[(j + 1) % polygon.length];
      const cp = winding * orient2(A, B, P), cq = winding * orient2(A, B, Q);
      const pin = cp >= -tolerance, qin = cq >= -tolerance;
      if (pin) clipped.push(P);
      if (pin !== qin) {
        const t = Math.max(0, Math.min(1, cp / (cp - cq)));
        clipped.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]);
      }
    }
    polygon = clipped;
  }
  if (!polygon.length) return null;
  let twiceArea = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length];
    twiceArea += p[0] * q[1] - q[0] * p[1];
  }
  const worldArea = Math.abs(twiceArea) / (2 * Math.abs(a.normal[a.axis]));
  const projectedCenter = [0, 1].map(d => polygon.reduce((sum, point) => sum + point[d], 0) / polygon.length);
  const point = [], remaining = [0, 1, 2].filter(d => d !== a.axis);
  remaining.forEach((d, i) => {point[d] = projectedCenter[i];});
  point[a.axis] = (dot(a.normal, a.points[0]) - remaining.reduce((sum, d) => sum + a.normal[d] * point[d], 0)) / a.normal[a.axis];
  return {kind: worldArea > epsilon * epsilon ? 'coplanar-overlap' : 'touch', areaM2: worldArea, point};
}

export function trianglePair(a, b, epsilon) {
  const da = a.points.map(point => signedDistance(point, b));
  const db = b.points.map(point => signedDistance(point, a));
  const minA = Math.min(...da), maxA = Math.max(...da), minB = Math.min(...db), maxB = Math.max(...db);
  if (minA > epsilon || maxA < -epsilon || minB > epsilon || maxB < -epsilon) return null;
  if (da.every(d => Math.abs(d) <= epsilon) && db.every(d => Math.abs(d) <= epsilon)) {
    const overlap = coplanarOverlap(a, b, epsilon);
    return overlap ? {...overlap, witnesses: [], points: [overlap.point]} : null;
  }
  const witnesses = [];
  for (const [source, target, direction] of [[a, b, 'a-to-b'], [b, a, 'b-to-a']]) {
    for (let i = 0; i < 3; i++) {
      const hit = segmentTriangle(source.points[i], source.points[(i + 1) % 3], target, epsilon);
      if (hit) witnesses.push({...hit, direction, edge: [source.ids[i], source.ids[(i + 1) % 3]]});
    }
  }
  if (!witnesses.length) return null;
  const points = [];
  for (const {point} of witnesses) if (!points.some(previous => length(sub(previous, point)) <= epsilon)) points.push(point);
  const proper = minA < -epsilon && maxA > epsilon && minB < -epsilon && maxB > epsilon
    && witnesses.some(hit => hit.kind === 'crossing') && points.length > 1;
  // A transverse intersection can align exactly with a mesh's shared edge.
  // Neither adjacent triangle then strictly straddles the other plane. Keep
  // that nonzero-length intersection curve as a failure candidate; do not
  // discard it as an isolated endpoint touch.
  return {kind: proper ? 'crossing' : points.length > 1 ? 'boundary-curve' : 'touch', points, witnesses};
}

export function auditMeshIntersections(input, {epsilon = 1e-7, sampleLimit = 32, leafSize = 8} = {}) {
  if (!(Number.isFinite(epsilon) && epsilon > 0)) throw new RangeError('epsilon must be a positive distance in metres');
  if (!Number.isInteger(sampleLimit) || sampleLimit < 0 || !Number.isInteger(leafSize) || leafSize < 1) throw new RangeError('Invalid audit bounds');
  const began = performance.now();
  const meshes = input.map(mesh => makeMesh(mesh, epsilon, leafSize));
  if (new Set(meshes.map(mesh => mesh.id)).size !== meshes.length) throw new Error('Independent mesh ids must be unique');
  const pairs = [], samples = [];
  let candidateTrianglePairs = 0, properCrossingTrianglePairs = 0, boundaryCurveTrianglePairs = 0,
    coplanarOverlapTrianglePairs = 0, touchingTrianglePairs = 0;
  function sample(value) {
    if (samples.length < sampleLimit) samples.push(value);
    else if (value.kind === 'crossing') {
      const index = samples.findIndex(row => row.kind === 'touch');
      if (index !== -1) samples[index] = value;
    }
  }
  for (let i = 0; i < meshes.length; i++) for (let j = i + 1; j < meshes.length; j++) {
    const a = meshes[i], b = meshes[j];
    const pair = {a: a.id, b: b.id, candidateTrianglePairs: 0,
      properCrossingTrianglePairs: 0, boundaryCurveTrianglePairs: 0, coplanarOverlapTrianglePairs: 0, touchingTrianglePairs: 0};
    if (a.root && b.root) for (const triangle of a.triangles) {
      const stack = [b.root];
      while (stack.length) {
        const node = stack.pop();
        if (!boxOverlap(triangle.box, node.box, epsilon)) continue;
        if (node.left) {stack.push(node.left, node.right); continue;}
        for (let k = node.start; k < node.end; k++) {
          const other = b.triangles[k];
          if (!boxOverlap(triangle.box, other.box, epsilon)) continue;
          pair.candidateTrianglePairs++;
          const result = trianglePair(triangle, other, epsilon);
          if (!result) continue;
          if (result.kind === 'crossing') pair.properCrossingTrianglePairs++;
          else if (result.kind === 'boundary-curve') pair.boundaryCurveTrianglePairs++;
          else if (result.kind === 'coplanar-overlap') pair.coplanarOverlapTrianglePairs++;
          else pair.touchingTrianglePairs++;
          sample({a: a.id, b: b.id, triangleA: triangle.index, triangleB: other.index,
            verticesA: triangle.ids, verticesB: other.ids, ...result});
        }
      }
    }
    candidateTrianglePairs += pair.candidateTrianglePairs;
    properCrossingTrianglePairs += pair.properCrossingTrianglePairs;
    boundaryCurveTrianglePairs += pair.boundaryCurveTrianglePairs;
    coplanarOverlapTrianglePairs += pair.coplanarOverlapTrianglePairs;
    touchingTrianglePairs += pair.touchingTrianglePairs;
    pairs.push(pair);
  }
  const degenerateTriangles = meshes.reduce((sum, mesh) => sum + mesh.degenerate.length, 0);
  return {schema: 'kaopu-independent-mesh-intersections@1', epsilonM: epsilon,
    hasReportedIntersections: properCrossingTrianglePairs + boundaryCurveTrianglePairs + coplanarOverlapTrianglePairs > 0,
    intersectingOrTouchingTrianglePairs: properCrossingTrianglePairs + boundaryCurveTrianglePairs + coplanarOverlapTrianglePairs + touchingTrianglePairs,
    properCrossingTrianglePairs, boundaryCurveTrianglePairs, coplanarOverlapTrianglePairs, touchingTrianglePairs,
    candidateTrianglePairs, degenerateTriangles, pairs, samples, sampleLimit,
    meshes: meshes.map(mesh => ({id: mesh.id, vertices: mesh.positions.length / 3,
      triangles: mesh.triangleCount, testedTriangles: mesh.triangles.length,
      degenerateTriangles: mesh.degenerate.length, degenerateTriangleSamples: mesh.degenerate.slice(0, sampleLimit)})),
    elapsedMS: performance.now() - began,
    scope: {independentOfContactSolver: true, checksBothEdgeDirections: true,
      countsAreTrianglePairsNotUniquePhysicalRegions: true,
      coplanarPositiveAreaOverlapIncluded: true, boundaryTouchesReportedSeparately: true,
      noncoplanarBoundaryCurvesIncluded: true,
      degenerateTrianglesExcluded: true, allNondegenerateInputTrianglePairsCovered: true,
      completeForInputTriangles: degenerateTriangles === 0,
      selfIntersectionsChecked: false, continuousCollisionChecked: false,
      thicknessClearanceChecked: false, individualYarnGeometryChecked: false,
      note: 'Discrete middle-surface geometry only. Near-coplanar means within epsilonM; zero crossings does not certify thickness clearance.'}};
}
