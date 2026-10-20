// Static wearer sizing of the complete, immutable R14 canvas model. Distances
// below are measured in the original millimetre coordinate system. This is a
// sampled geometric fit, not footwear forces, comfort, or a collision solver.
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const radians = d => d * Math.PI / 180;

export function nativeFootSamples(THREE, model, foot, native = null, footSkin = null) {
  const inverse = footSkin?.clone().invert(), v = new THREE.Vector3();
  const mirror = foot.side === 'R' ? -1 : 1;
  return foot.vertices.map(id => {
    if (native) {
      const p = native.sampleVertex(id);
      v.set(p[0], p[2], -p[1]); if (inverse) v.applyMatrix4(inverse);
    } else v.set(model.positions[id * 3], model.positions[id * 3 + 2], -model.positions[id * 3 + 1]);
    const y = (v.y - foot.bounds.yMin) * 1000; v.sub(foot.ankle);
    const x = v.dot(foot.right) * 1000 * mirror, z = v.dot(foot.forward) * 1000;
    return {id, x, y, z, forefoot: z >= (foot.bounds.zMin + foot.lengthM * .5) * 1000,
      toes: z >= (foot.bounds.zMin + foot.lengthM * .72) * 1000};
  });
}

// Contract the design last in x/y, and sample the adjacent longitudinal
// stations as well. The separate triangle test below checks the actual inner
// mesh; the analytical contraction is only a conservative fitting target.
function section(last, x, z) {
  const s = z / last.L + .5, inset = .8 * last.params.thickness / 1.35 + .75;
  if (s <= .006 || s >= .994) return null;
  let ceiling = Infinity, opening = true;
  for (const q of [s - inset / last.L, s, s + inset / last.L]) {
    const center = last.center(q), width = last.width(q) * (1 + (x < center ? .028 : -.016) * smooth(.28, .65, q));
    const ratio = (Math.abs(x - center) + inset) / width;
    if (ratio >= 1) return null;
    // The tongue begins at .308 in the native canvas builder. Only the
    // actual rear collar, with an inset from that seam, can admit the ankle.
    opening &&= q < .30 && Math.abs(x - center) + inset < width * Math.sin(last.collarAngle(q));
    ceiling = Math.min(ceiling, last.soleTop(q) + last.height(q) * (1 - ratio * ratio) ** .36 - inset);
  }
  return {s, ceiling: opening ? Infinity : ceiling, floor: last.soleTop(s) + 1.3};
}

function evaluateCandidate(last, samples, candidate) {
  const {angleDegrees, sx, sz, cx, cz} = candidate;
  if (sx < 1 || sx > 2.2 || sz < 1 || sz > 1.65 || Math.abs(angleDegrees) > 18) return null;
  const c = Math.cos(radians(angleDegrees)), s = Math.sin(radians(angleDegrees)), rows = [];
  for (const p of samples) {
    const x = (c * p.x - s * p.z - cx) / sx, z = (s * p.x + c * p.z - cz) / sz;
    const q = section(last, x, z); if (!q) return null;
    rows.push({y: p.y, ...q});
  }
  // cy may never put a source foot vertex below the curved original insole.
  // Both inequalities are in rendered millimetres, including the Y scale.
  const interval = sy => {
    let low = -Infinity, high = Infinity;
    for (const p of rows) {
      high = Math.min(high, p.y - sy * p.floor - .2);
      if (Number.isFinite(p.ceiling)) low = Math.max(low, p.y - sy * p.ceiling + 1.0);
    }
    return {low, high, pass: low <= high};
  };
  let lo = 1, hi = 2.8;
  if (!interval(hi).pass) return null;
  if (!interval(lo).pass) for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) * .5; if (interval(mid).pass) hi = mid; else lo = mid;
  } else hi = 1;
  const sy = hi + .004, cy = interval(sy).high;
  const cost = Math.log(sx) + Math.log(sy) + Math.log(sz) + .0007 * angleDegrees ** 2;
  return {...candidate, sy, cy, cost};
}

export function fitNativeCanvasFoot(last, samples, inner) {
  if (last.style.id !== 'canvas' || last.params.bend !== 0) throw Error('Wearer section fitting currently requires the original unbent R14 canvas shoe');
  if (!inner?.sample) throw Error('Actual original canvas inner triangles are required while selecting the wearer fit');
  let best = null, tested = 0, actualChecks = 0, actualRejected = 0, bestRejected = null;
  const consider = candidate => {
    tested++; const fit = evaluateCandidate(last, samples, candidate);
    if (!fit || (best && fit.cost >= best.cost)) return;
    // A continuous design last alone cannot certify the actual perforated
    // native panels. Test their unmodified inner triangles before accepting
    // any size or placement, rather than failing only after choosing it.
    actualChecks++;
    const checked = checkNativeShoeSections(last, inner, samples, fit);
    if (!checked.all.passed || !checked.forefoot.passed || !checked.toes.passed) {
      actualRejected++;
      if (!bestRejected || fit.cost < bestRejected.fit.cost) bestRejected = {fit, checked};
      return;
    }
    best = fit;
  };
  for (const angleDegrees of [-12, -6, 0, 6, 12]) {
    const c = Math.cos(radians(angleDegrees)), s = Math.sin(radians(angleDegrees));
    let xmin = Infinity, xmax = -Infinity, zmin = Infinity, zmax = -Infinity;
    for (const p of samples) {
      const x = c * p.x - s * p.z, z = s * p.x + c * p.z;
      xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
    }
    const baseX = (xmin + xmax) * .5, baseZ = (zmin + zmax) * .5;
    for (const sx of [1.2, 1.4, 1.6, 1.8]) for (const sz of [1, 1.1, 1.2]) {
      for (const dx of [-4, 4]) for (const dz of [-6, 6]) consider({angleDegrees, sx, sz, cx: baseX + dx, cz: baseZ + dz});
    }
  }
  if (!best) {
    const error = Error('Original canvas has no passing actual inner-triangle fit within the supported static sizing range');
    error.shoeFit = {tested, actualChecks, actualRejected, bestRejected}; throw error;
  }
  for (const scale of [1, .5, .25]) {
    const steps = {angleDegrees: 3 * scale, sx: .05 * scale, sz: .025 * scale, cx: 2 * scale, cz: 2 * scale};
    for (let round = 0; round < 10; round++) {
      const before = best;
      for (const [key, step] of Object.entries(steps)) for (const sign of [-1, 1]) consider({...best, [key]: best[key] + sign * step});
      if (before === best) break;
    }
  }
  return {...best, testedCandidates: tested, actualInnerChecks: actualChecks, actualInnerRejected: actualRejected, sourceSamples: samples.length,
    method: 'whole original shoe: native recipe, static three-axis size and anatomical placement; original last/insole proposal followed by mandatory actual inner-triangle acceptance',
    geometryBuffersModified: false, actionFramesCached: false};
}

export function shoeCoordinates(p, fit) {
  const c = Math.cos(radians(fit.angleDegrees)), s = Math.sin(radians(fit.angleDegrees));
  return [(c * p.x - s * p.z - fit.cx) / fit.sx, (p.y - fit.cy) / fit.sy,
    (s * p.x + c * p.z - fit.cz) / fit.sz];
}

/** A small XZ index of actual INNER canvas triangles. It includes both
 * quarters, facings, the native tongue and vamp; no upper is rebuilt, clipped,
 * or deleted. The index is immutable and shared with the native recipe.
 */
export function createCanvasInnerSurface(nativeModel) {
  const triangles = [], bins = new Map(), cell = 12;
  for (const part of nativeModel.parts) {
    if (part.role !== 'canvas' || !part.geometry.groups[1]) continue;
    const g = part.geometry, group = g.groups[1], p = g.attributes.position.array, index = g.index.array;
    for (let i = group.start; i < group.start + group.count; i += 3) {
      const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
      const x0 = p[a], y0 = p[a + 1], z0 = p[a + 2];
      const dx1 = p[b] - x0, dz1 = p[b + 2] - z0, dx2 = p[c] - x0, dz2 = p[c + 2] - z0;
      const det = dx1 * dz2 - dx2 * dz1; if (Math.abs(det) < 1e-9) continue;
      const triangle = {part: part.id, x0, y0, z0, dx1, dz1, dx2, dz2, dy1: p[b + 1] - y0, dy2: p[c + 1] - y0, inverseDet: 1 / det};
      const id = triangles.push(triangle) - 1;
      for (let x = Math.floor(Math.min(x0, p[b], p[c]) / cell); x <= Math.floor(Math.max(x0, p[b], p[c]) / cell); x++) {
        for (let z = Math.floor(Math.min(z0, p[b + 2], p[c + 2]) / cell); z <= Math.floor(Math.max(z0, p[b + 2], p[c + 2]) / cell); z++) {
          const key = x + ',' + z; if (!bins.has(key)) bins.set(key, []); bins.get(key).push(id);
        }
      }
    }
  }
  return {triangles: triangles.length, source: 'unchanged R14 canvas inner triangle groups',
    sample(x, z) {
      let y = Infinity, part = null;
      for (const id of bins.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)) || []) {
        const t = triangles[id], dx = x - t.x0, dz = z - t.z0;
        const u = (dx * t.dz2 - t.dx2 * dz) * t.inverseDet, v = (t.dx1 * dz - dx * t.dz1) * t.inverseDet;
        if (u < -1e-7 || v < -1e-7 || u + v > 1.0000001) continue;
        const height = t.y0 + u * t.dy1 + v * t.dy2;
        if (height < y) { y = height; part = t.part; }
      }
      return Number.isFinite(y) ? {y, part} : null;
    }};
}

export function checkNativeShoeSections(last, inner, samples, fit) {
  const make = () => ({samples: 0, aboveInnerUpper: 0, missingClosedUpper: 0, belowInsole: 0,
    minVerticalUpperClearanceMm: Infinity, minInsoleClearanceMm: Infinity, maxUpperProtrusionMm: 0, maxInsolePenetrationMm: 0});
  const all = make(), forefoot = make(), toes = make(), firstFailures = []; let openCollarSamples = 0;
  for (const p of samples) {
    const [x, y, z] = shoeCoordinates(p, fit), s = z / last.L + .5, roof = inner.sample(x, z);
    const floorClearance = (y - last.soleTop(s) - 1.3) * fit.sy;
    const upperClearance = roof ? (roof.y - y) * fit.sy : Infinity;
    const center = last.center(s), width = last.width(s) * (1 + (x < center ? .028 : -.016) * smooth(.28, .65, s));
    const open = !roof && s > last.style.collar[0] && s < .33 && Math.abs(x - center) < width * Math.sin(last.collarAngle(s));
    if (open) openCollarSamples++;
    if (firstFailures.length < 8 && ((!roof && !open) || (roof && upperClearance < -.05) || floorClearance < -.05)) {
      firstFailures.push({nativeVertex: p.id, shoeLocalMm: [x, y, z], station: s,
        nativeFootLocalMm: [p.x, p.y, p.z], forefoot: p.forefoot, toes: p.toes,
        innerPart: roof?.part ?? null, missingClosedUpper: !roof && !open,
        verticalUpperClearanceMm: roof ? upperClearance : null, insoleClearanceMm: floorClearance});
    }
    for (const row of [all, ...(p.forefoot ? [forefoot] : []), ...(p.toes ? [toes] : [])]) {
      row.samples++; if (!roof && !open) row.missingClosedUpper++;
      if (roof && upperClearance < -.05) row.aboveInnerUpper++;
      if (floorClearance < -.05) row.belowInsole++;
      row.minVerticalUpperClearanceMm = Math.min(row.minVerticalUpperClearanceMm, upperClearance);
      row.minInsoleClearanceMm = Math.min(row.minInsoleClearanceMm, floorClearance);
      row.maxUpperProtrusionMm = Math.max(row.maxUpperProtrusionMm, -upperClearance);
      row.maxInsolePenetrationMm = Math.max(row.maxInsolePenetrationMm, -floorClearance);
    }
  }
  for (const row of [all, forefoot, toes]) {
    if (!Number.isFinite(row.minVerticalUpperClearanceMm)) row.minVerticalUpperClearanceMm = null;
    row.passed = !row.aboveInnerUpper && !row.missingClosedUpper && !row.belowInsole;
  }
  return {scope: 'original full-CSR control vertices versus actual inner canvas triangles at the same XZ; curved insole from the original last; vertical section clearances, not complete surface collision certification',
    units: 'rendered millimetres after fitScale', innerTriangles: inner.triangles, openCollarSamples, all, forefoot, toes, firstFailures};
}
