/**
 * Original bounded two-floor dogleg proposal, not surveyed interior geometry.
 * The retained host slabs provide the floor landings; a closed plate-profile
 * flight on either side of a closed mid-landing provides the actual steps.
 * Neither numerical contact nor geometric clearance certifies structure,
 * accessibility, escape, guards, real location, or Hong Kong compliance.
 */
export const STAIR_SCHEMA = 'kaopu.hosted-dogleg-stair-proposal/0.1';
const EPS = 1e-8;
const copy = value => structuredClone(value);
const area = ring => ring.reduce((sum, p, i) => {
  const q = ring[(i + 1) % ring.length]; return sum + p[0] * q[1] - q[0] * p[1];
}, 0) / 2;
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
const on = (p, a, b) => Math.abs(cross(a, b, p)) <= EPS
  && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS
  && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
function inside(p, ring) {
  let yes = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (on(p, a, b)) return 0;
    if ((a[1] > p[1]) !== (b[1] > p[1])
      && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes ? 1 : -1;
}
function segmentsMeet(a, b, c, d, strict = false) {
  const p = cross(a, b, c), q = cross(a, b, d), r = cross(c, d, a), s = cross(c, d, b);
  const proper = (p > EPS && q < -EPS || p < -EPS && q > EPS)
    && (r > EPS && s < -EPS || r < -EPS && s > EPS);
  return proper || !strict && (on(a, c, d) || on(b, c, d) || on(c, a, b) || on(d, a, b));
}
const ringsMeet = (a, b, strict = false) => a.some((p, i) => b.some((q, j) =>
  segmentsMeet(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length], strict)));
const ringsOverlap = (a, b) => ringsMeet(a, b) || inside(a[0], b) >= 0 || inside(b[0], a) >= 0;
const contained = (a, b, strict = true) => a.every(p => inside(p, b) >= (strict ? 1 : 0))
  && !ringsMeet(a, b, !strict);
function pointSegmentDistance(p, a, b) {
  const d = [b[0] - a[0], b[1] - a[1]], length2 = d[0] ** 2 + d[1] ** 2;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / length2));
  return Math.hypot(p[0] - a[0] - t * d[0], p[1] - a[1] - t * d[1]);
}
function ringDistance(a, b) {
  if (ringsOverlap(a, b)) return 0;
  return Math.min(...a.flatMap((p, i) => b.flatMap((q, j) => [
    pointSegmentDistance(p, q, b[(j + 1) % b.length]),
    pointSegmentDistance(q, p, a[(i + 1) % a.length]),
  ])));
}
function boundaryDistance(a, b) {
  return Math.min(...a.flatMap((p, i) => b.flatMap((q, j) => [
    pointSegmentDistance(p, q, b[(j + 1) % b.length]),
    pointSegmentDistance(q, p, a[(i + 1) % a.length]),
  ])));
}
const sameRing = (a, b) => a?.length === b?.length && a.every((p, i) =>
  Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < EPS);
const openingLoop = o => o.footprintLoop ?? o.polygon2D;

export function defaultStairConfig() {
  return {enabled: false, visible: true, lowerFloorId: 'floor-001', upperFloorId: 'floor-002',
    originEast: 3, originNorth: -8, runEast: 3.25, runNorth: -8.4375,
    flightWidth: 1.2, centerGap: 0.2, treadDepth: 0.28, landingDepth: 1.2,
    targetRiser: 0.16, plateThickness: 0.2, landingThickness: 0.2, minHeadroom: 2};
}
function normalize(config) {
  if (config == null) config = {};
  if (typeof config !== 'object' || Array.isArray(config)) throw Error('Stair config must be an object');
  const defaults = defaultStairConfig();
  for (const key of Object.keys(config)) if (!(key in defaults)) throw Error(`Unknown stair parameter: ${key}`);
  const c = {...defaults, ...copy(config)};
  for (const key of ['enabled', 'visible']) if (typeof c[key] !== 'boolean') throw Error(`stairs.${key} must be boolean`);
  for (const key of ['lowerFloorId', 'upperFloorId']) if (typeof c[key] !== 'string') throw Error(`stairs.${key} must be a floor ID`);
  for (const key of Object.keys(defaults).filter(k => typeof defaults[k] === 'number')) {
    if (!Number.isFinite(c[key])) throw Error(`stairs.${key} must be finite`);
  }
  const ranges = {flightWidth: [0.6, 2.5], centerGap: [0.05, 1], treadDepth: [0.2, 0.4],
    landingDepth: [0.6, 3.5], targetRiser: [0.1, 0.22], plateThickness: [0.05, 0.4],
    landingThickness: [0.04, 0.5], minHeadroom: [0.5, 3]};
  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (c[key] < min || c[key] > max) throw Error(`stairs.${key} must be ${min}–${max} m (authored trial bounds, not a code rule)`);
  }
  if (c.landingDepth < c.flightWidth) throw Error('Authored landing depth must be at least flight width');
  if (Math.hypot(c.runEast, c.runNorth) < EPS) throw Error('Stair run direction must be nonzero');
  return c;
}

/** Pure planning. Pass openingRecords to r04 floors additionalOpenings. */
export function deriveStairProposal(floorState, config = {}) {
  if (!floorState?.schema?.startsWith('kaopu.assumed-floor-slab-stack/')
    || !Array.isArray(floorState.floors) || !Array.isArray(floorState.slabs)) throw Error('Validated authored floor state required');
  const c = normalize(config), lower = floorState.floors.find(f => f.floorId === c.lowerFloorId);
  const upper = floorState.floors.find(f => f.floorId === c.upperFloorId);
  if (!lower || !upper) throw Error('Both staircase endpoint floor IDs must exist');
  const ordered = [...floorState.floors].sort((a, b) => a.fflM - b.fflM);
  if (ordered.indexOf(upper) !== ordered.indexOf(lower) + 1) throw Error('Bounded staircase requires adjacent ascending design floor IDs');
  const lowerSlab = floorState.slabs.find(s => s.slabId === lower.slabId);
  const upperSlab = floorState.slabs.find(s => s.slabId === upper.slabId);
  if (!lowerSlab || !upperSlab) throw Error('Both staircase host slabs must exist');
  const delta = upper.fflM - lower.fflM;
  if (!(delta > 0 && Number.isFinite(delta))) throw Error('Stair FFL delta must be positive');
  const risersPerFlight = Math.ceil(delta / (2 * c.targetRiser) - EPS);
  if (risersPerFlight < 2 || risersPerFlight > 32) throw Error('Stair flight requires 2–32 risers in this bounded trial');
  const actualRiser = delta / (2 * risersPerFlight), treadCountPerFlight = risersPerFlight - 1;
  if (c.landingThickness + EPS < actualRiser || upperSlab.thickness + EPS < actualRiser) {
    throw Error('Landing and upper slab must be at least one actual riser thick to close the final riser face');
  }
  const runLength = treadCountPerFlight * c.treadDepth, width = 2 * c.flightWidth + c.centerGap;
  const totalLength = 2 * c.landingDepth + runLength, midFFL = lower.fflM + delta / 2;
  const d = Math.hypot(c.runEast, c.runNorth), u = [c.runEast / d, c.runNorth / d], v = [-u[1], u[0]];
  const point = (s, t) => [c.originEast + u[0] * s + v[0] * t, c.originNorth + u[1] * s + v[1] * t];
  const rect = (a, b, lo = -width / 2, hi = width / 2) => [point(a, lo), point(b, lo), point(b, hi), point(a, hi)];
  const footprint = rect(0, totalLength), opening = rect(c.landingDepth, totalLength);
  const sourceLoops = floorState.footprint.sourceLoops, serviceLoop = floorState.serviceCoreVoid?.loop;
  if (!contained(footprint, sourceLoops[0])
    || sourceLoops.slice(1).some(h => ringsOverlap(footprint, h))
    || serviceLoop && ringsOverlap(footprint, serviceLoop)) {
    throw Error('Complete stair and floor-landing envelope must be strictly inside the exact footprint, disjoint from every source hole and service reserve');
  }
  const stairId = `stair-${lower.floorId.replace('floor-', '')}-${upper.floorId.replace('floor-', '')}`;
  const openingId = `${stairId}:upper-slab-opening`;
  const proposedOpening = {openingId, hostSlabId: upper.slabId, purpose: 'stair', polygon2D: opening};
  // Every slab that may support a retained landing must be checked. Additional
  // unrelated host openings may not erase the promised arrival/departure zone.
  const floorLandingLoop = rect(0, c.landingDepth);
  const relevantOpenings = floorState.openings ?? [];
  for (const host of [lowerSlab, upperSlab]) {
    for (const o of relevantOpenings.filter(o => o.hostSlabId === host.slabId && o.openingId !== openingId)) {
      if (ringsOverlap(floorLandingLoop, openingLoop(o))) throw Error('A host opening removes or touches a retained stair floor landing');
    }
  }
  for (const o of relevantOpenings.filter(o => o.hostSlabId === upper.slabId && o.openingId !== openingId)) {
    if (ringsOverlap(opening, openingLoop(o))) throw Error('Proposed stair opening overlaps another upper-host opening');
  }
  const left = [-width / 2, -c.centerGap / 2], right = [c.centerGap / 2, width / 2];
  const flights = [
    {flightId: `${stairId}:flight-001`, sStart: c.landingDepth, direction: 1, lateral: left, startFFL: lower.fflM, endFFL: midFFL},
    {flightId: `${stairId}:flight-002`, sStart: c.landingDepth + runLength, direction: -1, lateral: right, startFFL: midFFL, endFFL: upper.fflM},
  ];
  const walkingPatches = [];
  for (const f of flights) {
    // Closed folded top plus clipped sloping underside. Clipping the underside
    // at departure FFL avoids an accidental overlap with the intact first slab.
    f.profile = [[0, 0]];
    f.treads = [];
    for (let k = 1; k <= treadCountPerFlight; k++) {
      const a = (k - 1) * c.treadDepth, b = k * c.treadDepth, h = k * actualRiser;
      f.profile.push([a, h], [b, h]);
      const sa = f.sStart + f.direction * a, sb = f.sStart + f.direction * b;
      const loop = rect(Math.min(sa, sb), Math.max(sa, sb), ...f.lateral);
      f.treads.push({index: k, elevationM: f.startFFL + h, footprintLoop: loop});
      walkingPatches.push({id: `${f.flightId}:tread-${k}`, elevationM: f.startFFL + h, footprintLoop: loop});
    }
    const undersideAtEnd = Math.max(0, treadCountPerFlight * actualRiser - c.plateThickness);
    f.profile.push([runLength, undersideAtEnd]);
    const breakAt = c.plateThickness * c.treadDepth / actualRiser;
    if (breakAt > EPS && breakAt < runLength - EPS) f.profile.push([breakAt, 0]);
    f.riserCount = risersPerFlight;
    f.flightMeshRiserCount = treadCountPerFlight;
    f.finalRiserProvidedBy = f.direction === 1 ? `${stairId}:mid-landing` : upper.slabId;
    f.treadCount = treadCountPerFlight;
    f.expectedVolumeM3 = Math.abs(area(f.profile)) * c.flightWidth;
  }
  const midLanding = {landingId: `${stairId}:mid-landing`, footprintLoop: rect(c.landingDepth + runLength, totalLength),
    bottomElevationM: midFFL - c.landingThickness, topElevationM: midFFL, thickness: c.landingThickness,
    geometry: 'closed_authored_plate', structuralSupportVerified: false};
  const floorLandings = [lower, upper].map(f => ({landingId: `${stairId}:landing:${f.floorId}`,
    floorId: f.floorId, hostSlabId: f.slabId, footprintLoop: copy(floorLandingLoop), elevationM: f.fflM,
    geometry: 'retained_physical_host_slab_region_no_duplicate_mesh'}));
  walkingPatches.push({id: midLanding.landingId, elevationM: midFFL, footprintLoop: midLanding.footprintLoop},
    ...floorLandings.map(l => ({id: l.landingId, elevationM: l.elevationM, footprintLoop: l.footprintLoop})));
  const combinedOpenings = relevantOpenings.filter(o => o.openingId !== openingId).concat({
    ...proposedOpening, footprintLoop: opening,
  });
  let minimumClearanceM = Infinity;
  const clearanceRecords = walkingPatches.map(patch => {
    let clearance = floorState.envelope.roofTop - patch.elevationM, overheadId = floorState.envelope.roofPatchId;
    for (const slab of floorState.slabs) {
      if (slab.top <= patch.elevationM + EPS) continue;
      const holes = combinedOpenings.filter(o => o.hostSlabId === slab.slabId).map(openingLoop);
      // Conservative whole-patch clearance, not only a center-point ray. A
      // patch counts as open only when one complete cut contains it.
      if (holes.some(h => contained(patch.footprintLoop, h, false))) continue;
      const gap = slab.bottom - patch.elevationM;
      if (gap < clearance) {clearance = gap; overheadId = slab.slabId;}
    }
    minimumClearanceM = Math.min(minimumClearanceM, clearance);
    return {patchId: patch.id, clearanceM: clearance, overheadId};
  });
  if (minimumClearanceM < c.minHeadroom - EPS) throw Error(`Stair geometric headroom ${minimumClearanceM.toFixed(3)} m is below authored minimum ${c.minHeadroom.toFixed(3)} m`);
  const walkPath = [], add = (s, t, h, role) => {
    const p = point(s, t); walkPath.push({positionLocalEastUpSouth: [p[0], h, -p[1]], role});
  };
  const leftCenter = (left[0] + left[1]) / 2, rightCenter = (right[0] + right[1]) / 2;
  add(c.landingDepth / 2, leftCenter, lower.fflM, 'lower-floor-landing');
  for (let fi = 0; fi < flights.length; fi++) {
    const f = flights[fi], t = fi ? rightCenter : leftCenter;
    add(f.sStart, t, f.startFFL, 'flight-start');
    for (let k = 1; k <= risersPerFlight; k++) {
      const s = f.sStart + f.direction * (k - 1) * c.treadDepth;
      add(s, t, f.startFFL + k * actualRiser, 'riser-top');
      if (k < risersPerFlight) add(s + f.direction * c.treadDepth, t, f.startFFL + k * actualRiser, 'tread-end');
    }
    if (!fi) {
      add(c.landingDepth + runLength + c.landingDepth / 2, leftCenter, midFFL, 'mid-landing');
      add(c.landingDepth + runLength + c.landingDepth / 2, rightCenter, midFFL, 'mid-landing-turn');
    }
  }
  add(c.landingDepth / 2, rightCenter, upper.fflM, 'upper-floor-landing');
  const effectiveEnabled = c.enabled && floorState.enabled && lower.effectiveEnabled && upper.effectiveEnabled;
  const actualOpening = relevantOpenings.find(o => o.openingId === openingId);
  const openingApplied = !!actualOpening && actualOpening.hostSlabId === upper.slabId && sameRing(openingLoop(actualOpening), opening);
  return {schema: STAIR_SCHEMA, stairId, config: c, enabled: c.enabled, visible: c.visible,
    effectiveEnabled: !!effectiveEnabled,
    effectiveVisible: !!(effectiveEnabled && c.visible && floorState.visible),
    evidence: 'authored_two_floor_stair_design_not_measured', interiorEvidence: 'unknown', editableProposal: true,
    realLocationVerified: false, structuralSupportVerified: false, buildingComplianceVerified: false,
    groundConnectionAdded: false, elevatorAdded: false, guardsModeled: false, doorsModeled: false,
    circulationComplete: false, evacuationPermitted: false, navigationConnectionEnabled: false,
    lowerFloorId: lower.floorId, upperFloorId: upper.floorId, lowerSlabId: lower.slabId, upperSlabId: upper.slabId,
    lowerFFLM: lower.fflM, upperFFLM: upper.fflM, midFFLM: midFFL, floorDeltaM: delta,
    basis: {originEastNorth: [c.originEast, c.originNorth], runEastNorth: u, lateralEastNorth: v,
      coordinates: 'local metres east/north; mesh east/up/south; placement inherited once'},
    dimensions: {width, totalLength, runLength, actualRiser, risersPerFlight, totalRisers: 2 * risersPerFlight,
      treadCountPerFlight, totalTreads: 2 * treadCountPerFlight, flightWidth: c.flightWidth,
      treadDepth: c.treadDepth, landingDepth: c.landingDepth},
    footprintLoop: footprint, footprintBoundaryClearanceM: boundaryDistance(footprint, sourceLoops[0]),
    serviceReserveClearanceM: serviceLoop ? ringDistance(footprint, serviceLoop) : null,
    proposedOpeningRecords: [proposedOpening], openingRecords: c.enabled ? [proposedOpening] : [],
    openingApplied, openingAreaSquareMetres: width * (runLength + c.landingDepth),
    flights, midLanding, floorLandings, walkingPatches, walkPath,
    headroom: {minimumClearanceM, requiredM: c.minHeadroom, records: clearanceRecords,
      basis: 'conservative_full_walking_patch_vs_authored_slab_and_roof_planes_not_legal_clearance_certification'},
    warning: 'Two-floor geometric stair proposal only. No actual interior, structural support, guarded route, ground access, lift, accessible route or escape compliance is established.'};
}

function prismGeometry(THREE, polygon, t0, t1, map, triangulationScale = [1, 1]) {
  const ring = copy(polygon); if (area(ring) < 0) ring.reverse();
  // Triangulate step profiles in integer tread/riser coordinates. Direct
  // decimal metre coordinates can turn exactly collinear diagonal corners
  // into microscopic false ears and zero-area Float32 cap triangles.
  const faces = THREE.ShapeUtils.triangulateShape(ring.map(p => new THREE.Vector2(
    Math.round(p[0] * triangulationScale[0] * 1e6), Math.round(p[1] * triangulationScale[1] * 1e6))), []);
  const tris = [];
  for (const face of faces) {
    let [a, b, c] = face.map(i => ring[i]); if (cross(a, b, c) < 0) [b, c] = [c, b];
    tris.push([map(a, t0), map(c, t0), map(b, t0)], [map(a, t1), map(b, t1), map(c, t1)]);
  }
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length], a0 = map(a, t0), b0 = map(b, t0), a1 = map(a, t1), b1 = map(b, t1);
    tris.push([a0, b0, b1], [a0, b1, a1]);
  });
  const determinant = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1])
    - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  let volume = tris.reduce((s, t) => s + determinant(...t) / 6, 0);
  if (volume < 0) {for (const t of tris) [t[1], t[2]] = [t[2], t[1]]; volume = -volume;}
  if (!(volume > EPS)) throw Error('Closed staircase prism has no positive volume');
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = {closedSolid: true, solidVolumeCubicMetres: volume};
  return geometry;
}

/** Build only after the same enabled proposal's upper slab hole is applied. */
export function buildStairs(THREE, floorState, config = {}) {
  if (!THREE?.ShapeUtils?.triangulateShape) throw Error('Three.js ShapeUtils required');
  const state = deriveStairProposal(floorState, config);
  if (state.enabled && !state.openingApplied) throw Error('Actual matching upper-host stair opening must be applied before building staircase');
  const group = new THREE.Group(); group.name = state.stairId; group.visible = state.effectiveVisible;
  const material = new THREE.MeshStandardMaterial({color: '#c7beaa', roughness: 0.9, metalness: 0});
  const [oe, on] = state.basis.originEastNorth, [ue, un] = state.basis.runEastNorth, [ve, vn] = state.basis.lateralEastNorth;
  const point = (s, t, h) => [oe + ue * s + ve * t, h, -(on + un * s + vn * t)];
  for (const flight of state.flights) {
    const geometry = prismGeometry(THREE, flight.profile, ...flight.lateral,
      ([q, h], t) => point(flight.sStart + flight.direction * q, t, flight.startFFL + h),
      [1 / state.config.treadDepth, 1 / state.dimensions.actualRiser]);
    const mesh = new THREE.Mesh(geometry, material); mesh.name = flight.flightId;
    mesh.userData = {role: 'authored-solid-stair-flight', flightId: flight.flightId,
      expectedVolumeM3: flight.expectedVolumeM3, structuralSupportVerified: false};
    group.add(mesh);
  }
  const l = state.midLanding, w = state.dimensions.width;
  const profile = [[0, l.bottomElevationM], [state.config.landingDepth, l.bottomElevationM],
    [state.config.landingDepth, l.topElevationM], [0, l.topElevationM]];
  const geometry = prismGeometry(THREE, profile, -w / 2, w / 2,
    ([q, h], t) => point(state.config.landingDepth + state.dimensions.runLength + q, t, h));
  const mesh = new THREE.Mesh(geometry, material); mesh.name = l.landingId;
  mesh.userData = {role: 'authored-solid-stair-mid-landing', landingId: l.landingId, structuralSupportVerified: false};
  group.add(mesh);
  group.userData = {schema: STAIR_SCHEMA, state, evidence: state.evidence,
    floorLandings: copy(state.floorLandings), materialEvidence: 'generic_authored_concrete_not_measured'};
  group.updateMatrixWorld(true);
  return group;
}

export function inspectStairs(floorState, config = {}, group = null) {
  const state = deriveStairProposal(floorState, config);
  if (group) {
    if (group.userData?.schema !== STAIR_SCHEMA) throw Error('Not an authored staircase group');
    group.updateWorldMatrix(true, true);
    const inheritedVisible = object => {
      for (let current = object; current; current = current.parent) if (!current.visible) return false;
      return true;
    };
    state.scene = {effectiveVisible: inheritedVisible(group), matrixWorld: Array.from(group.matrixWorld.elements),
      solids: group.children.map(mesh => ({id: mesh.name, role: mesh.userData.role,
        effectiveVisible: inheritedVisible(mesh), triangles: mesh.geometry.getAttribute('position').count / 3,
        closedSolid: mesh.geometry.userData.closedSolid, solidVolumeCubicMetres: mesh.geometry.userData.solidVolumeCubicMetres,
        matrixWorld: Array.from(mesh.matrixWorld.elements)}))};
  }
  return state;
}
