/**
 * Independent, read-only triangle/body half-thickness audit.
 *
 * The static body is copied once and kept in a separate triangle AABB tree.
 * Every cloth triangle searches the entire body within its half thickness.
 * AABB Euclidean distances are lower bounds, never approximate visibility or
 * nearest-vertex exclusions. Six VF and nine finite EE candidates plus actual
 * triangle intersections cover the minimum distance of each triangle pair.
 * No production contact distance, candidate grid or body cache is imported.
 *
 * This is an isotropic envelope of discrete triangles. It is not a signed
 * global inside/outside, continuous-time, self-collision or yarn certificate.
 */
import {makeMesh, trianglePair} from './mesh-intersections.mjs';

const clamp = x => Math.max(0, Math.min(1, x));

export function pointTriangleDistance(point, triangle) {
  const [a, b, c] = triangle;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const wx = point[0] - a[0], wy = point[1] - a[1], wz = point[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const denominator = nx * nx + ny * ny + nz * nz;
  if (denominator > 0) {
    const s = ((wy * vz - wz * vy) * nx + (wz * vx - wx * vz) * ny + (wx * vy - wy * vx) * nz) / denominator;
    const t = ((uy * wz - uz * wy) * nx + (uz * wx - ux * wz) * ny + (ux * wy - uy * wx) * nz) / denominator;
    if (s >= 0 && t >= 0 && s + t <= 1) {
      const q = [a[0] + s * ux + t * vx, a[1] + s * uy + t * vy, a[2] + s * uz + t * vz];
      return {distanceSquared: (point[0] - q[0]) ** 2 + (point[1] - q[1]) ** 2 + (point[2] - q[2]) ** 2,
        point: q, bary: [1 - s - t, s, t]};
    }
  }
  let distanceSquared = Infinity, winner, weights;
  for (let edge = 0; edge < 3; edge++) {
    const x = triangle[edge], y = triangle[(edge + 1) % 3];
    const dx = y[0] - x[0], dy = y[1] - x[1], dz = y[2] - x[2], lengthSquared = dx * dx + dy * dy + dz * dz;
    const t = lengthSquared > 0 ? clamp(((point[0] - x[0]) * dx + (point[1] - x[1]) * dy + (point[2] - x[2]) * dz) / lengthSquared) : 0;
    const qx = x[0] + t * dx, qy = x[1] + t * dy, qz = x[2] + t * dz;
    const squared = (point[0] - qx) ** 2 + (point[1] - qy) ** 2 + (point[2] - qz) ** 2;
    if (squared < distanceSquared) {
      distanceSquared = squared; winner = [qx, qy, qz]; weights = [0, 0, 0];
      weights[edge] = 1 - t; weights[(edge + 1) % 3] = t;
    }
  }
  return {distanceSquared, point: winner, bary: weights};
}

export function finiteSegmentDistance(a, b, c, d) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = d[0] - c[0], vy = d[1] - c[1], vz = d[2] - c[2];
  const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
  const uu = ux * ux + uy * uy + uz * uz, vv = vx * vx + vy * vy + vz * vz;
  let distanceSquared = Infinity, bestS = 0, bestT = 0;
  const candidate = (s, t) => {
    const x = -wx + s * ux - t * vx, y = -wy + s * uy - t * vy, z = -wz + s * uz - t * vz;
    const squared = x * x + y * y + z * z;
    if (squared < distanceSquared) {distanceSquared = squared; bestS = s; bestT = t;}
  };
  // All four segment-domain boundaries, including zero-length segments.
  candidate(0, vv > 0 ? clamp((-wx * vx - wy * vy - wz * vz) / vv) : 0);
  candidate(1, vv > 0 ? clamp(((ux - wx) * vx + (uy - wy) * vy + (uz - wz) * vz) / vv) : 0);
  candidate(uu > 0 ? clamp((wx * ux + wy * uy + wz * uz) / uu) : 0, 0);
  candidate(uu > 0 ? clamp(((wx + vx) * ux + (wy + vy) * uy + (wz + vz) * uz) / uu) : 0, 1);
  // Cross products avoid the cancellation of uu*vv-(u.v)^2 near parallel.
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const denominator = nx * nx + ny * ny + nz * nz;
  if (denominator > 0) {
    const s = ((wy * vz - wz * vy) * nx + (wz * vx - wx * vz) * ny + (wx * vy - wy * vx) * nz) / denominator;
    const t = ((wy * uz - wz * uy) * nx + (wz * ux - wx * uz) * ny + (wx * uy - wy * ux) * nz) / denominator;
    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) candidate(s, t);
  }
  return {distanceSquared, s: bestS, t: bestT,
    pointA: [a[0] + bestS * ux, a[1] + bestS * uy, a[2] + bestS * uz],
    pointB: [c[0] + bestT * vx, c[1] + bestT * vy, c[2] + bestT * vz]};
}

function triangleDistance(a, b, epsilonM) {
  const intersection = trianglePair(a, b, epsilonM);
  if (intersection) {
    const point = intersection.point || intersection.points[0];
    return {distanceSquared: 0, kind: 'middle-surface-intersection', intersectionKind: intersection.kind, pointA: point, pointB: point};
  }
  let best = {distanceSquared: Infinity};
  for (let i = 0; i < 3; i++) {
    const ab = pointTriangleDistance(a.points[i], b.points), ba = pointTriangleDistance(b.points[i], a.points);
    if (ab.distanceSquared < best.distanceSquared) best = {distanceSquared: ab.distanceSquared,
      kind: 'cloth-vertex/body-face', vertexA: a.ids[i], baryB: ab.bary, pointA: a.points[i], pointB: ab.point};
    if (ba.distanceSquared < best.distanceSquared) best = {distanceSquared: ba.distanceSquared,
      kind: 'body-vertex/cloth-face', vertexB: b.ids[i], baryA: ba.bary, pointA: ba.point, pointB: b.points[i]};
  }
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const ee = finiteSegmentDistance(a.points[i], a.points[(i + 1) % 3], b.points[j], b.points[(j + 1) % 3]);
    if (ee.distanceSquared < best.distanceSquared) best = {...ee, kind: 'cloth-edge/body-edge',
      edgeA: [a.ids[i], a.ids[(i + 1) % 3]], edgeB: [b.ids[j], b.ids[(j + 1) % 3]]};
  }
  return best;
}

function boxDistanceSquared(a, b) {
  let result = 0;
  for (let d = 0; d < 3; d++) {const gap = Math.max(a[d] - b[d + 3], b[d] - a[d + 3], 0); result += gap * gap;}
  return result;
}

/** Copy the exact body values once; subsequent input mutation cannot make its
 * BVH stale. Recreate this auditor if the intentionally static body changes. */
export function createBodyEnvelopeAudit(body, {epsilonM = 1e-9, leafSize = 8} = {}) {
  if (!(Number.isFinite(epsilonM) && epsilonM > 0) || !Number.isInteger(leafSize) || leafSize < 1) throw new RangeError('Invalid audit bounds');
  const rawFaces = body?.faces ?? body?.indices ?? body?.triangles;
  if (!body?.positions || body.positions.length < 9 || !rawFaces || rawFaces.length < 3) throw new TypeError('Nonempty actual body positions and faces required');
  // Preserve invalid indices until makeMesh validates them, instead of silently
  // truncating a fractional or negative value through an integer conversion.
  const bodyMesh = makeMesh({id: '__actual_native_body__', positions: Float64Array.from(body.positions), indices: Array.from(rawFaces)}, epsilonM, leafSize);
  const bodyInfo = Object.freeze({vertices: bodyMesh.positions.length / 3, triangles: bodyMesh.triangleCount,
    testedTriangles: bodyMesh.triangles.length, degenerateTriangles: bodyMesh.degenerate.length});
  return Object.freeze({
    body: Object.freeze({...bodyInfo}),
    measure(surfaces, {sampleLimit = 16} = {}) {
      if (!Array.isArray(surfaces) || !Number.isInteger(sampleLimit) || sampleLimit < 0) throw new RangeError('Invalid audit surfaces or sample limit');
      const started = performance.now(), garments = [], samples = [], ids = new Set();
      let maxHalfThicknessOverlapMM = 0, violatingClothTriangles = 0, candidateTrianglePairs = 0;
      let degenerateTriangles = bodyInfo.degenerateTriangles;
      for (const surface of surfaces) {
        if (ids.has(surface.id)) throw new Error('Duplicate garment id'); ids.add(surface.id);
        const half = surface.thickness * .5;
        if (!(Number.isFinite(half) && half > 0)) throw new RangeError('Positive physical total thickness required');
        // Only a flat iteration of cloth triangles is needed: no cloth BVH is
        // rebuilt or sorted, while each face retains its original index.
        const cloth = makeMesh({...surface, indices: surface.triangles ?? surface.indices ?? surface.faces}, epsilonM, Number.MAX_SAFE_INTEGER);
        let pairs = 0, violating = 0, maximum = 0, minWithin = Infinity;
        const featureCounts = {};
        for (const a of cloth.triangles) {
          let closest = null, bodyTriangle = null, best = (half + epsilonM) ** 2;
          const stack = bodyMesh.root ? [bodyMesh.root] : [];
          while (stack.length) {
            const node = stack.pop(); if (boxDistanceSquared(a.box, node.box) > best) continue;
            if (node.left) {
              const dl = boxDistanceSquared(a.box, node.left.box), dr = boxDistanceSquared(a.box, node.right.box);
              if (dl < dr) {if (dr <= best) stack.push(node.right); if (dl <= best) stack.push(node.left);}
              else {if (dl <= best) stack.push(node.left); if (dr <= best) stack.push(node.right);}
              continue;
            }
            for (let i = node.start; i < node.end; i++) {
              const b = bodyMesh.triangles[i]; if (boxDistanceSquared(a.box, b.box) > best) continue;
              pairs++; const candidate = triangleDistance(a, b, epsilonM);
              if (candidate.distanceSquared < best) {best = candidate.distanceSquared; closest = candidate; bodyTriangle = b;}
            }
          }
          if (!closest) continue;
          const distance = Math.sqrt(best), overlap = half - distance;
          minWithin = Math.min(minWithin, distance);
          if (!(overlap > epsilonM)) continue;
          violating++; maximum = Math.max(maximum, overlap);
          featureCounts[closest.kind] = (featureCounts[closest.kind] || 0) + 1;
          if (sampleLimit) {
            const {distanceSquared, ...witness} = closest;
            const sample = {garment: surface.id, clothTriangle: a.index, bodyTriangle: bodyTriangle.index,
              clothVertexIDs: a.ids, bodyVertexIDs: bodyTriangle.ids, halfThicknessMM: half * 1000,
              distanceMM: distance * 1000, halfThicknessOverlapMM: overlap * 1000, ...witness};
            if (samples.length < sampleLimit) samples.push(sample);
            else {let least = 0; for (let j = 1; j < samples.length; j++) if (samples[j].halfThicknessOverlapMM < samples[least].halfThicknessOverlapMM) least = j;
              if (sample.halfThicknessOverlapMM > samples[least].halfThicknessOverlapMM) samples[least] = sample;}
          }
        }
        garments.push({id: surface.id, vertices: cloth.positions.length / 3, triangles: cloth.triangleCount,
          testedTriangles: cloth.triangles.length, degenerateTriangles: cloth.degenerate.length,
          halfThicknessMM: half * 1000, candidateTrianglePairs: pairs, violatingClothTriangles: violating,
          minimumDistanceWithinEnvelopeMM: Number.isFinite(minWithin) ? minWithin * 1000 : null,
          maxHalfThicknessOverlapMM: maximum * 1000, closestFeatureCounts: featureCounts});
        degenerateTriangles += cloth.degenerate.length; violatingClothTriangles += violating;
        maxHalfThicknessOverlapMM = Math.max(maxHalfThicknessOverlapMM, maximum * 1000); candidateTrianglePairs += pairs;
      }
      samples.sort((a, b) => b.halfThicknessOverlapMM - a.halfThicknessOverlapMM);
      return {schema: 'kaopu-independent-body-envelope@1', epsilonM, body: bodyInfo, garments,
        hasHalfThicknessOverlap: violatingClothTriangles > 0, maxHalfThicknessOverlapMM, violatingClothTriangles,
        candidateTrianglePairs, degenerateTriangles, samples, sampleLimit, elapsedMS: performance.now() - started,
        scope: {independentOfContactSolver: true, staticBodyCopiedOnce: true,
          allNondegenerateClothTrianglesAgainstFullBody: true, nearestTriangleDistanceWithinHalfThickness: true,
          bothVertexFaceDirectionsAndNineFiniteEdgePairs: true, triangleIntersectionsIncluded: true,
          completeForInputTriangles: degenerateTriangles === 0, isotropicEnvelope: true,
          signedInsideCertificate: false, continuousTimeChecked: false, selfCollisionChecked: false,
          individualYarnGeometryChecked: false, minimumOutsideSearchRadiusCertified: false,
          countsAreClothTrianglesNotTrianglePairs: true}};
    },
  });
}

export function auditBodyEnvelope(surfaces, body, options = {}) {
  return createBodyEnvelopeAudit(body, options).measure(surfaces, options);
}
