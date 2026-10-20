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
  relaxationIterations = 24,
  interiorSamples = true,
  extraClearance = .0015,
  searchRadius = .045,
  maxCorrection = .003,
} = {}) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 128) throw new RangeError('Invalid initialization iterations');
  if (!Number.isInteger(relaxationIterations) || relaxationIterations < 0 || relaxationIterations > 128) throw new RangeError('Invalid initialization relaxation iterations');
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
  const projectSample=(garment,mesh,ids,bary,gap)=>{
    const p=garment.s.p,w=garment.s.w;let x=0,y=0,z=0,effective=0;
    for(let j=0;j<ids.length;j++){const k=ids[j]*3;x+=bary[j]*p[k];y+=bary[j]*p[k+1];z+=bary[j]*p[k+2];effective+=bary[j]*bary[j]*w[ids[j]];}
    if(!(effective>0))return;
    const face=mesh.nearest(x,y,z,searchRadius);if(face<0)return;const q=mesh.best;let nx=0,ny=0,nz=0;
    for(let j=0;j<3;j++){const v=mesh.faces[face+j]*3,b=q[4+j];nx+=b*mesh.normals[v];ny+=b*mesh.normals[v+1];nz+=b*mesh.normals[v+2];}
    const length=Math.hypot(nx,ny,nz);if(!(length>1e-10))return;nx/=length;ny/=length;nz/=length;
    const signed=(x-q[1])*nx+(y-q[2])*ny+(z-q[3])*nz;if(signed>=gap)return;
    const correction=Math.min(maxCorrection,gap-signed),lambda=correction/effective;
    for(let j=0;j<ids.length;j++){const k=ids[j]*3,scale=w[ids[j]]*bary[j]*lambda;p[k]+=scale*nx;p[k+1]+=scale*ny;p[k+2]+=scale*nz;}
    projectionCorrections++;maxAppliedCorrectionM=Math.max(maxAppliedCorrectionM,correction);
  };
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
        for(let vertex=0;vertex<garment.s.count;vertex++)projectSample(garment,mesh,[vertex],[1],gap);
        if(interiorSamples&&(iteration%2===1||iteration===iterations-1)) {
          for(const edge of garment.s.edges)projectSample(garment,mesh,[edge.a,edge.b],[.5,.5],gap);
          const faces=garment.s.faces;for(let f=0;f<faces.length;f+=3)projectSample(garment,mesh,[faces[f],faces[f+1],faces[f+2]],[1/3,1/3,1/3],gap);
        }
      }
    }
  }
  // The ordered placement alone can stretch short paper edges substantially.
  // Relax that metric error before creating simulation velocities: this phase
  // uses the same reciprocal mass response as dynamics, with no layer order.
  const orderedMeasurement=world.contacts.measure(surfaceInput()),orderedAudit=world.audit();
  const orderedPlacementAfter={contactCount:orderedMeasurement.contactCount,residualMaxPenetration:orderedMeasurement.residualMaxPenetration,maxEdgeStretch:orderedAudit.maxEdgeStretch};
  const relaxationPrevious=rows.map(a=>a.s.p.slice());
  world.contacts.reset();
  for(let iteration=0;iteration<relaxationIterations;iteration++) {
    rows.forEach((a,i)=>relaxationPrevious[i].set(a.s.p));
    for(const a of rows){const s=a.s;e.strain_batch(a.p.ptr,a.w.ptr,a.edges.ptr,s.edges.length,s.family==='knit'?.82:.90,s.family==='knit'?1.18:1.12);world.projectBody(a,false,iteration===0);}
    world.contacts.solve(rows.map((a,i)=>({id:a.id,positions:a.s.p,previous:relaxationPrevious[i],triangles:a.s.faces,inverseMass:a.s.w,thickness:a.thickness})),{passes:1,friction:0,measureResidual:false});
  }
  // Body projection can compete with cloth contact. Audit the resulting state
  // after this projection; never reuse pre-projection residual measurements.
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
    method: 'One-time ordered dressing after seam welding, then reciprocal cloth/paper/body metric relaxation before velocity initialization',
    order: rows.map(a => a.id), iterations, relaxationIterations,interiorSamples,orderedPlacementAfter,extraClearanceM: extraClearance, searchRadiusM: searchRadius,
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
