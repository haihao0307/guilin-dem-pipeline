import { MeshContact } from './upstream/mesh-contact.mjs';

/**
 * Bounded, one-time dressing of the ALREADY SEWN physical garment surfaces.
 * This is an initialization procedure, not a force used by LayerWorld.step.
 * The ordered placement moves the newly outer garment only; subsequent live
 * garment contact remains reciprocal-mass vertex/triangle contact.
 *
 * Original implementation. The metric relaxation calls the retained XPBD
 * paper-distance, dihedral and strain kernels. This local procedure is not
 * continuous collision detection or a general intersection untangler.
 */
export function initializeLayers(world, {
  iterations = 24,
  extraClearance = .0015,
  searchRadius = .045,
  maxCorrection = .003,
} = {}) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 128) throw new RangeError('Invalid initialization iterations');
  for (const value of [extraClearance, searchRadius, maxCorrection]) if (!Number.isFinite(value) || value < 0) throw new RangeError('Invalid initialization length');
  if (!(searchRadius > 0 && maxCorrection > 0)) throw new RangeError('Initialization radius and correction must be positive');
  const began = performance.now();
  const rank = a => a.source.layerOrder ?? (a.id === 'pants' || a.s.role === 'bottom' ? 0 : a.id === 'outer' ? 2 : 1);
  const rows = world.rows.filter(a => a.enabled).slice().sort((a, b) => rank(a) - rank(b));
  const surfaceInput = () => rows.map(a => ({ id: a.id, positions: a.s.p, previous: a.s.p,
    triangles: a.s.faces, inverseMass: a.s.w, thickness: a.thickness }));
  const before = world.contacts.measure(surfaceInput());
  const beforeAudit = world.audit();
  const beforeMetrics = { contactCount: before.contactCount, residualMaxPenetration: before.residualMaxPenetration, maxEdgeStretch: beforeAudit.maxEdgeStretch };
  if (before.contactCount === 0) return {
    method: 'No ordered projection needed: bounded vertex-triangle initialization query found no thickness violations',
    order: rows.map(a => a.id), iterations: 0, applied: false, before: beforeMetrics, after: { ...beforeMetrics },
    directionalPlacementOnlyDuringInitialization: true, persistentLayerOffset: false,
    residualScope: before.residualScope, initializationMS: performance.now() - began,
    continuousCollision: false, arbitraryLayeringCertified: false, visualAccepted: false,
  };
  const meshes = rows.map(a => new MeshContact(a.s.p, a.s.faces));
  const saved = rows.map(a => a.s.p.slice());
  const e = world.e, h = 1 / 240;
  let projectionCorrections = 0, maxAppliedCorrectionM = 0;
  for (const a of rows) {
    e.reset_lambda(a.edges.ptr, a.s.edges.length, 4, 3);
    e.reset_lambda(a.bends.ptr, a.s.bends.length, 6, 4);
  }
  for (let iteration = 0; iteration < iterations; iteration++) {
    for (const a of rows) {
      const s = a.s;
      e.distance_batch(a.p.ptr, a.w.ptr, a.edges.ptr, s.edges.length,
        (s.family === 'knit' ? .00035 : s.family === 'leather' ? .00003 : .00006) * s.settings.softness / (h * h));
      if (iteration % 2 === 0) e.bend_batch(a.p.ptr, a.w.ptr, a.bends.ptr, s.bends.length,
        (s.family === 'leather' ? 2800 : s.family === 'denim' ? 6000 : 12000) / (Math.max(.05, s.settings.bend) * h * h));
      e.strain_batch(a.p.ptr, a.w.ptr, a.edges.ptr, s.edges.length,
        s.family === 'knit' ? .82 : .90, s.family === 'knit' ? 1.18 : 1.12);
      world.projectBody(a, iteration === iterations - 1, iteration === 0 || iteration === iterations - 1);
    }
    for (let lower = 0; lower < rows.length; lower++) {
      const obstacle = rows[lower], mesh = meshes[lower];
      mesh.refit();
      for (let upper = lower + 1; upper < rows.length; upper++) {
        const garment = rows[upper], p = garment.s.p;
        const gap = (garment.thickness + obstacle.thickness) * .5 + world.contacts.contactMargin + extraClearance;
        for (let vertex = 0; vertex < garment.s.count; vertex++) {
          if (garment.s.w[vertex] === 0) continue;
          const k = vertex * 3, face = mesh.nearest(p[k], p[k + 1], p[k + 2], searchRadius);
          if (face < 0) continue;
          const q = mesh.best;
          let nx = 0, ny = 0, nz = 0;
          for (let j = 0; j < 3; j++) {
            const v = mesh.faces[face + j] * 3, b = q[4 + j];
            nx += b * mesh.normals[v]; ny += b * mesh.normals[v + 1]; nz += b * mesh.normals[v + 2];
          }
          const normalLength = Math.hypot(nx, ny, nz);
          if (!(normalLength > 1e-10)) continue;
          nx /= normalLength; ny /= normalLength; nz /= normalLength;
          const signed = (p[k] - q[1]) * nx + (p[k + 1] - q[2]) * ny + (p[k + 2] - q[3]) * nz;
          if (signed >= gap) continue;
          const correction = Math.min(maxCorrection, gap - signed);
          p[k] += correction * nx; p[k + 1] += correction * ny; p[k + 2] += correction * nz;
          projectionCorrections++;
          maxAppliedCorrectionM = Math.max(maxAppliedCorrectionM, correction);
        }
      }
    }
  }
  // Body projection can compete with the final ordered placement. Audit the
  // resulting state after this projection; do not reuse pre-projection metrics.
  for (const a of rows) { world.projectBody(a, false, true); a.s.expand(); }
  let maxDisplacementM = 0;
  rows.forEach((a, index) => {
    for (let i = 0; i < a.s.count; i++) {
      const k = i * 3;
      const displacement = Math.hypot(a.s.p[k] - saved[index][k], a.s.p[k + 1] - saved[index][k + 1], a.s.p[k + 2] - saved[index][k + 2]);
      if (!Number.isFinite(displacement)) throw new Error('Layer initialization produced nonfinite coordinates');
      maxDisplacementM = Math.max(maxDisplacementM, displacement);
    }
  });
  const after = world.contacts.measure(surfaceInput()), afterAudit = world.audit();
  const improved = after.contactCount < before.contactCount && after.residualMaxPenetration < before.residualMaxPenetration;
  const report = {
    method: 'One-time local outer-side triangle projection after seam welding, interleaved with original paper and static native-body constraints',
    order: rows.map(a => a.id), iterations, extraClearanceM: extraClearance, searchRadiusM: searchRadius,
    directionalPlacementOnlyDuringInitialization: true, persistentLayerOffset: false,
    projectionCorrections, maxAppliedCorrectionM, maxDisplacementM,
    applied: improved, before: beforeMetrics,
    after: { contactCount: after.contactCount, residualMaxPenetration: after.residualMaxPenetration, maxEdgeStretch: afterAudit.maxEdgeStretch },
    residualScope: after.residualScope, initializationMS: performance.now() - began,
    continuousCollision: false, arbitraryLayeringCertified: false, visualAccepted: false,
  };
  if (!improved) {
    // A local dressing procedure need not succeed on arbitrary intersections.
    // Preserve the actual input if both measured contact metrics do not improve.
    rows.forEach((a, index) => { a.s.p.set(saved[index]); a.s.expand(); a.cache.view.fill(-1); });
    report.attemptedAfter = report.after;
    report.after = { ...beforeMetrics };
    report.reason = 'Ordered local initialization did not improve both measured contact count and maximum thickness violation; original sewn state restored';
  }
  return report;
}
