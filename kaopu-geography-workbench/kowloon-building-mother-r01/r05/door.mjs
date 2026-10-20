/**
 * Original r05 hosted door experiment. This is an editable PROPOSED partition,
 * not an observed wall or evidence of the actual building's interior or use.
 * Metre dimensions are author defaults, never hotel/Hong Kong standard claims.
 * External collisions are sampled angular mesh tests, NOT continuous safety,
 * fire, egress, accessibility, construction or regulatory certification.
 * Reuses the single Three runtime supplied by the caller; imports no runtime.
 */
export const DOOR_SCHEMA = 'kaopu.proposed-hosted-landing-door/0.1';
const EPS = 1e-8;
const clone = value => structuredClone(value);
export const DOOR_ROLE_PRESETS = Object.freeze({
  entry: Object.freeze({role: 'entry', label: 'Proposed entry role; actual building use unknown'}),
  service: Object.freeze({role: 'service', label: 'Proposed service role; actual building use unknown'}),
  room: Object.freeze({role: 'room', label: 'Proposed room role; actual building use unknown'}),
});
export function defaultDoorConfig() {
  return {enabled: false, visible: true, floorId: 'floor-002', role: 'entry',
    width: 0.9, height: 2.1, wallWidth: null, wallHeight: 2.5, wallThickness: 0.12,
    leafThickness: 0.045, frameWidth: 0.05, frameDepth: 0.02,
    clearance: 0.004, handleHeight: 1, angleDeg: 0, swing: 'left',
    runOffset: 0, lateralOffset: 0};
}
function normalize(config) {
  if (config == null) config = {};
  if (typeof config !== 'object' || Array.isArray(config)) throw Error('Door config must be an object');
  const defaults = defaultDoorConfig();
  for (const key of Object.keys(config)) if (!(key in defaults)) throw Error(`Unknown door parameter: ${key}`);
  const c = {...defaults, ...clone(config)};
  for (const k of ['enabled', 'visible']) if (typeof c[k] !== 'boolean') throw Error(`door.${k} must be boolean`);
  if (typeof c.floorId !== 'string') throw Error('door.floorId must be an exact floor ID');
  if (!Object.hasOwn(DOOR_ROLE_PRESETS, c.role)) throw Error('door.role must be entry, service or room (annotation only)');
  if (!['left', 'right'].includes(c.swing)) throw Error('door.swing must be left or right');
  for (const k of Object.keys(defaults).filter(k => typeof defaults[k] === 'number')) {
    if (!Number.isFinite(c[k])) throw Error(`door.${k} must be finite`);
  }
  if (c.wallWidth !== null && (!Number.isFinite(c.wallWidth) || c.wallWidth <= 0)) throw Error('door.wallWidth must be null (stair span) or positive');
  const ranges = {width: [0.45, 2], height: [1.5, 3], wallHeight: [1.6, 4], wallThickness: [0.05, 0.4],
    leafThickness: [0.015, 0.12], frameWidth: [0.015, 0.15], frameDepth: [0.005, 0.1],
    clearance: [0.001, 0.02], handleHeight: [0.4, 1.5], angleDeg: [0, 100]};
  for (const [k, [lo, hi]] of Object.entries(ranges)) {
    if (c[k] < lo || c[k] > hi) throw Error(`door.${k} must be ${lo}–${hi} (authored trial bounds, not a code rule)`);
  }
  if (c.wallHeight <= c.height + c.frameWidth) throw Error('Proposed partition must retain a solid lintel above the frame');
  if (c.handleHeight >= c.height - 0.2) throw Error('Handle must remain inside the leaf height');
  return c;
}
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function inRing(p, ring) {
  let yes = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (Math.abs(cross(a, b, p)) < EPS && p[0] >= Math.min(a[0], b[0]) - EPS
      && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS
      && p[1] <= Math.max(a[1], b[1]) + EPS) return 0;
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes ? 1 : -1;
}
function segmentMeets(a, b, c, d) {
  const ab1 = cross(a, b, c), ab2 = cross(a, b, d), cd1 = cross(c, d, a), cd2 = cross(c, d, b);
  if (ab1 * ab2 < -EPS && cd1 * cd2 < -EPS) return true;
  return [c, d].some(p => Math.abs(cross(a, b, p)) < EPS && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS
    && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS)
    || [a, b].some(p => Math.abs(cross(c, d, p)) < EPS && p[0] >= Math.min(c[0], d[0]) - EPS && p[0] <= Math.max(c[0], d[0]) + EPS
      && p[1] >= Math.min(c[1], d[1]) - EPS && p[1] <= Math.max(c[1], d[1]) + EPS);
}
const ringsMeet = (a, b) => a.some((p, i) => b.some((q, j) => segmentMeets(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
function assertSupported(loop, floorState, slabId, description) {
  const source = floorState.footprint.sourceLoops;
  const holes = [...source.slice(1), ...(floorState.openings ?? []).filter(o => o.hostSlabId === slabId).map(o => o.footprintLoop ?? o.polygon2D)];
  if (loop.some(p => inRing(p, source[0]) !== 1) || ringsMeet(loop, source[0])
    || holes.some(h => loop.some(p => inRing(p, h) >= 0) || h.some(p => inRing(p, loop) >= 0) || ringsMeet(loop, h))) {
    throw Error(`${description} is not wholly supported by the actual retained host slab`);
  }
}
function positiveRingOverlap(a, b) {
  if (a.some(p => inRing(p, b) === 1) || b.some(p => inRing(p, a) === 1)) return true;
  if (a.some((p, i) => b.some((q, j) => {
    const p2 = a[(i + 1) % a.length], q2 = b[(j + 1) % b.length];
    return cross(p, p2, q) * cross(p, p2, q2) < -EPS && cross(q, q2, p) * cross(q, q2, p2) < -EPS;
  }))) return true;
  const center = ring => [0, 1].map(i => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
  return inRing(center(a), b) === 1 && inRing(center(a), a) === 1
    || inRing(center(b), a) === 1 && inRing(center(b), b) === 1;
}
function slabOverlapsFootprint(slab, loop) {
  if (!positiveRingOverlap(loop, slab.loops[0])) return false;
  return !slab.loops.slice(1).some(hole => loop.every(p => inRing(p, hole) >= 0)
    && !loop.some((p, i) => hole.some((q, j) => {
      const p2 = loop[(i + 1) % loop.length], q2 = hole[(j + 1) % hole.length];
      return cross(p, p2, q) * cross(p, p2, q2) < -EPS && cross(q, q2, p) * cross(q, q2, p2) < -EPS;
    })));
}
/** Pure proposal: no scene mutation. Caller commits only a fully validated proposal. */
export function deriveDoorProposal(floorState, stairPlan, config = {}) {
  if (!floorState?.schema?.startsWith('kaopu.assumed-floor-slab-stack/') || !Array.isArray(floorState.floors)) throw Error('Validated floor state required');
  if (!stairPlan?.schema?.startsWith('kaopu.hosted-dogleg-stair-proposal/') || !stairPlan.basis) throw Error('Validated hosted stair plan required');
  const c = normalize(config), floor = floorState.floors.find(f => f.floorId === c.floorId);
  if (!floor) throw Error('Door parent floor must exist');
  const landing = stairPlan.floorLandings.find(l => l.floorId === c.floorId && l.hostSlabId === floor.slabId);
  if (!landing || Math.abs(landing.elevationM - floor.fflM) > EPS) throw Error('Door must use the exact retained stair landing at parent FFL');
  const slab = floorState.slabs.find(s => s.slabId === floor.slabId);
  if (!slab || Math.abs(slab.top - floor.fflM) > EPS) throw Error('Door FFL must agree with the actual host slab top');
  const wallWidth = c.wallWidth ?? stairPlan.dimensions.width;
  if (!(wallWidth <= 8 && wallWidth > c.width + 2 * c.frameWidth)) throw Error('Partition width must retain solid jambs beyond the opening/frame');
  const [oe, on] = stairPlan.basis.originEastNorth, [ue, un] = stairPlan.basis.runEastNorth;
  const [ve, vn] = stairPlan.basis.lateralEastNorth;
  if (![oe, on, ue, un, ve, vn].every(Number.isFinite)
    || Math.abs(Math.hypot(ue, un) - 1) > EPS || Math.abs(Math.hypot(ve, vn) - 1) > EPS
    || Math.abs(ue * ve + un * vn) > EPS || Math.abs(ue * vn - un * ve - 1) > EPS) {
    throw Error('Stair basis must be finite, orthonormal and right-handed');
  }
  const origin = [oe + ue * c.runOffset + ve * c.lateralOffset, floor.fflM, -(on + un * c.runOffset + vn * c.lateralOffset)];
  const basis = {originEastUpSouth: origin, x: [-ve, 0, vn], y: [0, 1, 0], z: [-ue, 0, un],
    handedness: 'right', openingDirection: 'away_from_stair_run_onto_adjacent_slab'};
  const point = (x, z) => [origin[0] + basis.x[0] * x + basis.z[0] * z, -origin[2] - basis.x[2] * x - basis.z[2] * z];
  const wallLoop = [[-wallWidth / 2, -c.wallThickness / 2], [wallWidth / 2, -c.wallThickness / 2],
    [wallWidth / 2, c.wallThickness / 2], [-wallWidth / 2, c.wallThickness / 2]].map(([x, z]) => point(x, z));
  assertSupported(wallLoop, floorState, floor.slabId, 'Proposed partition footprint');
  const thresholdLoop = [[-c.width / 2, -c.wallThickness / 2], [c.width / 2, -c.wallThickness / 2],
    [c.width / 2, c.wallThickness / 2], [-c.width / 2, c.wallThickness / 2]].map(([x, z]) => point(x, z));
  assertSupported(thresholdLoop, floorState, floor.slabId, 'Door threshold');
  // A conservative full swing envelope must also be above existing slab, not a
  // false landing pasted over an opening. Actual meshes are ray-tested in QA.
  const hingeX = (c.swing === 'left' ? -1 : 1) * (c.width / 2 - c.clearance);
  const pivotZ = c.wallThickness / 2 + c.leafThickness / 2 + c.clearance;
  const leafWidth = c.width - 2 * c.clearance, leafHeight = c.height - 2 * c.clearance;
  const reach = leafWidth + c.leafThickness / 2 + 0.08;
  const swingLoop = [[hingeX - reach, pivotZ - 0.09], [hingeX + reach, pivotZ - 0.09],
    [hingeX + reach, pivotZ + reach], [hingeX - reach, pivotZ + reach]].map(([x, z]) => point(x, z));
  assertSupported(swingLoop, floorState, floor.slabId, 'Conservative outward swing footprint');
  const effectiveEnabled = !!(c.enabled && floorState.enabled && floor.effectiveEnabled);
  const effectiveVisible = !!(effectiveEnabled && c.visible && floorState.visible && floor.visible);
  const overheadSlabs = floorState.slabs.filter(s => s.effectiveEnabled && s.top > floor.fflM + EPS && slabOverlapsFootprint(s, wallLoop))
    .map(s => ({slabId: s.slabId, soffitM: s.bottom, hostClearanceM: s.bottom - floor.fflM - c.wallHeight}));
  const penetratingSlab = overheadSlabs.find(s => s.hostClearanceM < -EPS);
  if (effectiveEnabled && penetratingSlab) throw Error(`Proposed fixed partition penetrates actual ${penetratingSlab.slabId} soffit by ${(-penetratingSlab.hostClearanceM).toFixed(3)} m`);
  return {schema: DOOR_SCHEMA, doorId: `door:${c.floorId}:proposed-landing`, config: c,
    enabled: c.enabled, visible: c.visible, effectiveEnabled, effectiveVisible,
    parentFloorId: c.floorId, hostSlabId: floor.slabId, stairId: stairPlan.stairId,
    basis, evidence: 'authored_editable_proposed_partition_and_door_not_observed', actualBuildingUse: 'unknown',
    interiorEvidence: 'unknown', materialEvidence: 'authored_PBR_not_measured', roleAnnotation: clone(DOOR_ROLE_PRESETS[c.role]),
    dimensionsAre: 'manually_editable_author_defaults_not_hotel_or_Hong_Kong_standards',
    host: {hostId: `partition:${c.floorId}:proposed-landing`, type: 'PROPOSED_PARTITION', observed: false, editable: true,
      width: wallWidth, height: c.wallHeight, thickness: c.wallThickness, bottomFFLM: floor.fflM, footprintLoop: wallLoop},
    opening: {openingId: `door:${c.floorId}:opening`, width: c.width, height: c.height, bottomFFLM: floor.fflM,
      localBounds: {min: [-c.width / 2, 0, -c.wallThickness / 2], max: [c.width / 2, c.height, c.wallThickness / 2]},
      geometry: 'genuine_unfilled_aperture_in_three_closed_partition_pieces'},
    threshold: {elevationM: floor.fflM, hostSlabId: floor.slabId, footprintLoop: thresholdLoop,
      geometry: 'retained_actual_slab_no_duplicate_threshold_or_step'},
    frame: {width: c.width + 2 * c.frameWidth, height: c.height + c.frameWidth, fixed: true},
    leaf: {width: leafWidth, height: leafHeight, thickness: c.leafThickness, bottomGapM: c.clearance,
      pivotLocal: [hingeX, 0, pivotZ], signedAngleDeg: (c.swing === 'left' ? -1 : 1) * c.angleDeg},
    landingConnection: {landingDepth: stairPlan.config.landingDepth, laneCenterLateralM: (stairPlan.config.flightWidth + stairPlan.config.centerGap) / 2},
    support: {analyticHostSlabContainment: true, hostSlabLoops: clone(slab.loops), conservativeSwingFootprint: swingLoop, actualMeshRayTested: false,
      overheadSlabs, fixedHostOverheadClear: !penetratingSlab, fixedHostExternalMeshTested: false},
    safety: {buildingComplianceVerified: false, fireResistanceVerified: false, egressCertified: false,
      structuralSupportVerified: false, exactContinuousSweepCertified: false, realLocationVerified: false},
    warning: 'Proposed partition and manual dimensions only. Actual interior/use unknown. Angular sampling is not continuous collision, egress or code certification.'};
}
function requireRuntime(THREE) {
  if (!THREE?.Group || !THREE?.Box3?.prototype?.intersectsTriangle) throw Error('One passed Three.js runtime with Box3 triangle testing is required');
}
function requireProposal(p) {
  if (p?.schema !== DOOR_SCHEMA) throw Error('Validated door proposal required');
  normalize(p.config);
}
const signedAngle = (c, a) => (c.swing === 'left' ? -1 : 1) * a * Math.PI / 180;
/** Parent may pass its shared PBR materials as {materials:{host,frame,leaf,metal}}. */
export function buildDoor(THREE, proposal, options = {}) {
  requireRuntime(THREE); requireProposal(proposal);
  const p = clone(proposal), c = p.config, group = new THREE.Group(); group.name = p.doorId;
  group.visible = p.effectiveVisible;
  const b = p.basis, matrix = new THREE.Matrix4().makeBasis(new THREE.Vector3(...b.x), new THREE.Vector3(...b.y), new THREE.Vector3(...b.z));
  group.position.set(...b.originEastUpSouth); group.quaternion.setFromRotationMatrix(matrix);
  const defaults = {host: {color: '#b4a58d', roughness: 0.95}, frame: {color: '#61594e', roughness: 0.65},
    leaf: {color: '#907657', roughness: 0.72}, metal: {color: '#b9bfc2', roughness: 0.28, metalness: 0.75}};
  const materials = Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, options.materials?.[key] ?? new THREE.MeshStandardMaterial(value)]));
  const host = new THREE.Group(); host.name = p.host.hostId; host.userData = {role: 'PROPOSED_PARTITION', observed: false}; group.add(host);
  const frame = new THREE.Group(); frame.name = `${p.doorId}:fixed-frame`; frame.userData = {role: 'fixed-door-frame'}; group.add(frame);
  const pivot = new THREE.Group(); pivot.name = `${p.doorId}:leaf-pivot`; pivot.position.set(...p.leaf.pivotLocal); group.add(pivot);
  function box(parent, name, dims, pos, material, role, moving = false) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dims), material); mesh.name = `${p.doorId}:${name}`; mesh.position.set(...pos);
    mesh.userData = {role, closedSolid: true, movingCollisionBox: moving, dimensions: [...dims]}; parent.add(mesh); return mesh;
  }
  const jambWidth = (p.host.width - c.width) / 2;
  for (const side of [-1, 1]) box(host, `host-jamb-${side}`, [jambWidth, c.wallHeight, c.wallThickness],
    [side * (c.width / 2 + jambWidth / 2), c.wallHeight / 2, 0], materials.host, 'proposed-partition-solid');
  box(host, 'host-lintel', [c.width, c.wallHeight - c.height, c.wallThickness],
    [0, (c.wallHeight + c.height) / 2, 0], materials.host, 'proposed-partition-solid');
  // Fixed frame stays entirely outside the aperture. There is no floor bar,
  // invented threshold or opacity-based wall opening.
  // Proud casing: its back face contacts the wall front; it is not a
  // coincident front face buried inside the partition (which z-fights).
  const frameZ = c.wallThickness / 2 + c.frameDepth / 2;
  for (const side of [-1, 1]) box(frame, `frame-jamb-${side}`, [c.frameWidth, c.height, c.frameDepth],
    [side * (c.width / 2 + c.frameWidth / 2), c.height / 2, frameZ], materials.frame, 'fixed-frame-solid');
  box(frame, 'frame-header', [p.frame.width, c.frameWidth, c.frameDepth],
    [0, c.height + c.frameWidth / 2, frameZ], materials.frame, 'fixed-frame-solid');
  const side = c.swing === 'left' ? 1 : -1;
  box(pivot, 'leaf', [p.leaf.width, p.leaf.height, p.leaf.thickness],
    [side * p.leaf.width / 2, c.clearance + p.leaf.height / 2, 0], materials.leaf, 'moving-door-leaf', true);
  const handleX = side * (p.leaf.width - 0.09), leverX = handleX - side * 0.05;
  for (const face of [-1, 1]) {
    box(pivot, `handle-neck-${face}`, [0.025, 0.025, 0.035],
      [handleX, c.handleHeight, face * (c.leafThickness / 2 + 0.0175)], materials.metal, 'moving-door-handle', true);
    box(pivot, `handle-lever-${face}`, [0.125, 0.025, 0.025],
      [leverX, c.handleHeight, face * (c.leafThickness / 2 + 0.035)], materials.metal, 'moving-door-handle', true);
  }
  for (const fraction of [0.14, 0.5, 0.86]) {
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.075, 12), materials.metal);
    hinge.name = `${p.doorId}:fixed-hinge-${fraction}`; hinge.position.set(p.leaf.pivotLocal[0], c.height * fraction, p.leaf.pivotLocal[2]);
    hinge.userData = {role: 'visible-fixed-hinge-barrel'}; frame.add(hinge);
    box(frame, `fixed-hinge-plate-${fraction}`, [c.frameWidth + 0.02, 0.055, 0.008],
      [p.leaf.pivotLocal[0] - side * c.frameWidth / 2, c.height * fraction, c.wallThickness / 2 + c.frameDepth + 0.004], materials.metal, 'visible-fixed-hinge-plate');
    box(pivot, `moving-hinge-plate-${fraction}`, [0.045, 0.055, 0.008],
      [side * 0.024, c.height * fraction, -c.leafThickness / 2 - 0.004], materials.metal, 'moving-hinge-plate', true);
  }
  pivot.rotation.y = signedAngle(c, c.angleDeg);
  group.userData = {schema: DOOR_SCHEMA, state: p, pivotName: pivot.name,
    hostName: host.name, frameName: frame.name, currentAngleDeg: c.angleDeg, sweep: null};
  group.updateMatrixWorld(true);
  return group;
}
function doorParts(group) {
  if (group?.userData?.schema !== DOOR_SCHEMA) throw Error('Expected built authored door group');
  const pivot = group.getObjectByName(group.userData.pivotName), moving = [];
  if (!pivot) throw Error('Door leaf pivot is missing');
  pivot.traverse(o => {if (o.isMesh && o.userData.movingCollisionBox) moving.push(o);});
  return {pivot, moving};
}
function obstacleMeshes(objects, door) {
  if (!Array.isArray(objects)) throw Error('External obstacles must be an array of actual Three meshes or groups');
  const meshes = [], ids = new Set();
  for (const root of objects) {
    if (!root?.traverse) throw Error('Each obstacle must be an actual Three mesh or group');
    for (let n = root; n; n = n.parent) if (n === door) throw Error('Door components are not external obstacles');
    root.updateWorldMatrix(true, true);
    root.traverse(mesh => {
      if (!mesh.isMesh || !mesh.geometry || ids.has(mesh.uuid)) return;
      for (let n = mesh; n; n = n.parent) if (n === door) return;
      if (mesh.userData?.effectiveEnabled === false || mesh.userData?.state?.effectiveEnabled === false) return;
      // Display-hidden objects remain obstacles: visibility is not membership.
      for (let n = mesh; n; n = n.parent) if (n.userData?.effectiveEnabled === false || n.userData?.state?.effectiveEnabled === false) return;
      ids.add(mesh.uuid); meshes.push(mesh);
    });
  }
  return meshes;
}
/**
 * Sample all requested angles (max 1 degree spacing) against actual obstacle
 * mesh triangles, transformed into each moving part's local box. Box erosion
 * by epsilon ignores contact-only faces. Does not certify between samples.
 * Restores the exact pose even on error and does not commit collisions.
 */
export function sampleDoorSweep(THREE, group, obstacles = [], options = {}) {
  requireRuntime(THREE);
  const {pivot, moving} = doorParts(group), c = group.userData.state.config;
  const defaults = {fromAngleDeg: 0, toAngleDeg: 100, stepDeg: 1, epsilon: 1e-5};
  for (const key of Object.keys(options)) if (!(key in defaults)) throw Error(`Unknown sweep option: ${key}`);
  const o = {...defaults, ...options};
  for (const [k, v] of Object.entries(o)) if (!Number.isFinite(v)) throw Error(`Sweep ${k} must be finite`);
  for (const k of ['fromAngleDeg', 'toAngleDeg']) if (o[k] < 0 || o[k] > 100) throw Error('Sweep angle must be 0–100 degrees');
  if (o.stepDeg <= 0 || o.stepDeg > 1) throw Error('Angular sampling step must be positive and at most 1 degree');
  if (o.stepDeg < 0.05) throw Error('Angular sampling below 0.05 degree exceeds this bounded trial budget');
  if (o.epsilon < 0 || o.epsilon > 0.001) throw Error('Sweep contact epsilon must be 0–0.001 m');
  const external = obstacleMeshes(obstacles, group), self = [];
  group.traverse(mesh => {if (mesh.isMesh && ['proposed-partition-solid', 'fixed-frame-solid'].includes(mesh.userData.role)) self.push(mesh);});
  group.updateWorldMatrix(true, true);
  const meshes = [...external, ...self], selfIds = new Set(self.map(m => m.uuid));
  const cached = new Map(meshes.map(mesh => {
    mesh.geometry.computeBoundingBox();
    return [mesh.uuid, {localBox: mesh.geometry.boundingBox.clone(), worldBox: mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)}];
  }));
  const collisions = [], count = Math.ceil(Math.abs(o.toAngleDeg - o.fromAngleDeg) / o.stepDeg);
  const angles = Array.from({length: count + 1}, (_, i) => count ? o.fromAngleDeg + (o.toAngleDeg - o.fromAngleDeg) * i / count : o.fromAngleDeg);
  const oldRotation = pivot.rotation.clone(), oldMatrixAutoUpdate = pivot.matrixAutoUpdate;
  const triangle = new THREE.Triangle(), inverse = new THREE.Matrix4(), transform = new THREE.Matrix4();
  let triangleTests = 0;
  try {
    pivot.matrixAutoUpdate = true;
    for (const angleDeg of angles) {
      pivot.rotation.y = signedAngle(c, angleDeg); group.updateWorldMatrix(true, true);
      for (const part of moving) {
        const box = new THREE.Box3(); part.geometry.computeBoundingBox(); box.copy(part.geometry.boundingBox).expandByScalar(-o.epsilon);
        inverse.copy(part.matrixWorld).invert();
        const partWorldBox = box.clone().applyMatrix4(part.matrixWorld);
        for (const obstacle of meshes) {
          if (selfIds.has(obstacle.uuid) && part.userData.role === 'moving-hinge-plate') continue;
          const bounds = cached.get(obstacle.uuid);
          if (!partWorldBox.intersectsBox(bounds.worldBox)) continue;
          const geometry = obstacle.geometry, position = geometry.getAttribute('position'), index = geometry.index;
          if (!position) throw Error(`Obstacle ${obstacle.name || obstacle.uuid} has no triangle positions`);
          transform.multiplyMatrices(inverse, obstacle.matrixWorld);
          const obstacleBox = bounds.localBox.clone().applyMatrix4(transform);
          if (!box.intersectsBox(obstacleBox)) continue;
          const n = index ? index.count : position.count;
          let hit = false;
          for (let i = 0; i + 2 < n; i += 3) {
            const vertices = [triangle.a, triangle.b, triangle.c];
            for (let j = 0; j < 3; j++) vertices[j].fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(transform);
            triangleTests++;
            if (box.intersectsTriangle(triangle)) {hit = true; break;}
          }
          // A closed obstacle can entirely enclose this part without a surface
          // crossing its box. Exact containment is checked by odd mesh ray hits.
          if (!hit && (obstacle.userData?.closedSolid || obstacle.geometry.userData?.closedSolid || obstacle.geometry.userData?.solidVolumeCubicMetres > 0 || obstacle.geometry.type === 'BoxGeometry')) {
            const localCenter = box.getCenter(new THREE.Vector3());
            if (obstacleBox.containsPoint(localCenter)) {
              const ray = new THREE.Ray(localCenter, new THREE.Vector3(0.912817, 0.203117, 0.354971).normalize()), hits = [];
              for (let i = 0; i + 2 < n; i += 3) {
                const vertices = [triangle.a, triangle.b, triangle.c];
                for (let j = 0; j < 3; j++) vertices[j].fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(transform);
                const point = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, new THREE.Vector3());
                if (point && point.distanceTo(localCenter) > o.epsilon && !hits.some(d => Math.abs(d - point.distanceTo(localCenter)) < o.epsilon)) hits.push(point.distanceTo(localCenter));
              }
              hit = hits.length % 2 === 1;
            }
          }
          if (hit) collisions.push({angleDeg, movingId: part.name, obstacleId: obstacle.name || obstacle.uuid});
        }
      }
    }
  } finally {
    pivot.rotation.copy(oldRotation); pivot.matrixAutoUpdate = oldMatrixAutoUpdate; pivot.updateMatrix(); group.updateWorldMatrix(true, true);
  }
  return {clear: collisions.length === 0, collisions, sampleCount: angles.length,
    fromAngleDeg: o.fromAngleDeg, toAngleDeg: o.toAngleDeg, maximumStepDeg: count ? Math.abs(o.toAngleDeg - o.fromAngleDeg) / count : 0,
    contactEpsilonM: o.epsilon, obstacleMeshCount: meshes.length, externalObstacleMeshCount: external.length, selfObstacleMeshCount: self.length, triangleTests,
    sampling: 'angular_samples_not_continuous_certification', exactContinuousSweepCertified: false};
}
/** Exact triangle/box tests for bounded original rectangular solids/volumes.
 * Complete closed obstacle containment is checked as well as surface crossing. */
function auditBoxesAgainstMeshes(THREE, parts, meshes, epsilon) {
  const collisions = [], cached = new Map(meshes.map(mesh => {
    mesh.geometry.computeBoundingBox();
    return [mesh.uuid, {local: mesh.geometry.boundingBox.clone(), world: mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)}];
  }));
  const triangle = new THREE.Triangle(), inverse = new THREE.Matrix4(), transform = new THREE.Matrix4();
  let triangleTests = 0;
  for (const part of parts) {
    const box = part.box.clone().expandByScalar(-epsilon);
    const worldBox = box.clone().applyMatrix4(part.matrixWorld); inverse.copy(part.matrixWorld).invert();
    for (const obstacle of meshes) {
      const bounds = cached.get(obstacle.uuid); if (!worldBox.intersectsBox(bounds.world)) continue;
      transform.multiplyMatrices(inverse, obstacle.matrixWorld);
      const localBounds = bounds.local.clone().applyMatrix4(transform); if (!box.intersectsBox(localBounds)) continue;
      const geometry = obstacle.geometry, position = geometry.getAttribute('position'), index = geometry.index;
      if (!position) throw Error(`Obstacle ${obstacle.name || obstacle.uuid} has no triangle positions`);
      const n = index ? index.count : position.count; let hit = false;
      const loadTriangle = i => {
        for (const [j, vertex] of [triangle.a, triangle.b, triangle.c].entries()) {
          vertex.fromBufferAttribute(position, index ? index.getX(i + j) : i + j).applyMatrix4(transform);
        }
      };
      for (let i = 0; i + 2 < n; i += 3) {
        loadTriangle(i); triangleTests++;
        if (box.intersectsTriangle(triangle)) {hit = true; break;}
      }
      if (!hit && (obstacle.userData?.closedSolid || geometry.userData?.closedSolid || geometry.userData?.solidVolumeCubicMetres > 0 || geometry.type === 'BoxGeometry')) {
        const center = box.getCenter(new THREE.Vector3());
        if (localBounds.containsPoint(center)) {
          const ray = new THREE.Ray(center, new THREE.Vector3(0.912817, 0.203117, 0.354971).normalize()), hits = [];
          for (let i = 0; i + 2 < n; i += 3) {
            loadTriangle(i); const point = ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, new THREE.Vector3());
            if (point && point.distanceTo(center) > epsilon && !hits.some(d => Math.abs(d - point.distanceTo(center)) <= Math.max(EPS, epsilon))) hits.push(point.distanceTo(center));
          }
          hit = hits.length % 2 === 1;
        }
      }
      if (hit) collisions.push({volumeId: part.name, obstacleId: obstacle.name || obstacle.uuid});
    }
  }
  return {collisions, triangleTests};
}
/** Fixed partition/frame vs external physical geometry; intended face contact is
 * ignored by box erosion, not by making the host or floor transparent. */
export function auditDoorHostGeometry(THREE, group, obstacles = [], options = {}) {
  requireRuntime(THREE); doorParts(group);
  for (const key of Object.keys(options)) if (key !== 'epsilon') throw Error(`Unknown fixed-host audit option: ${key}`);
  const epsilon = options.epsilon ?? 1e-5;
  if (!Number.isFinite(epsilon) || epsilon < 0 || epsilon > 0.001) throw Error('Fixed-host contact epsilon must be 0–0.001 m');
  const meshes = obstacleMeshes(obstacles, group), fixed = [];
  group.updateWorldMatrix(true, true);
  group.traverse(mesh => {
    if (mesh.isMesh && ['proposed-partition-solid', 'fixed-frame-solid'].includes(mesh.userData.role)) {
      mesh.geometry.computeBoundingBox(); fixed.push({name: mesh.name, box: mesh.geometry.boundingBox, matrixWorld: mesh.matrixWorld});
    }
  });
  const result = auditBoxesAgainstMeshes(THREE, fixed, meshes, epsilon);
  return {clear: result.collisions.length === 0, collisions: result.collisions.map(c => ({fixedId: c.volumeId, obstacleId: c.obstacleId})),
    fixedMeshCount: fixed.length, externalObstacleMeshCount: meshes.length, triangleTests: result.triangleTests,
    contactEpsilonM: epsilon, basis: 'actual_external_mesh_triangles_against_fixed_partition_frame_local_boxes',
    buildingComplianceVerified: false, structuralSupportVerified: false};
}
/**
 * A bounded, authored rectangular-body corridor proof at the CURRENT door pose.
 * Each path segment is swept by a square floor footprint; union of the resulting
 * boxes includes the corner turn. No point-only body clearance approximation.
 * Both branches turn on the retained slab before the center-gap guard and end
 * at arrival/departure lane centres. This is NOT a walk controller, full stair
 * route, human-factors model, accessibility rule, or navigation/egress approval.
 */
export function auditDoorPassage(THREE, group, obstacles = [], options = {}) {
  requireRuntime(THREE); doorParts(group); group.updateWorldMatrix(true, true);
  const defaults = {width: 0.7, height: 1.9, approachDepth: 1, epsilon: 1e-5};
  for (const key of Object.keys(options)) if (!(key in defaults)) throw Error(`Unknown passage option: ${key}`);
  const o = {...defaults, ...options};
  for (const [key, value] of Object.entries(o)) if (!Number.isFinite(value)) throw Error(`Passage ${key} must be finite`);
  if (o.width < 0.3 || o.width > 1.5 || o.height < 0.5 || o.height > 2.5 || o.approachDepth < 0.3 || o.approachDepth > 2
    || o.epsilon < 0 || o.epsilon > 0.001) throw Error('Passage dimensions exceed authored bounded experiment limits, not code rules');
  const p = group.userData.state, c = p.config, connection = p.landingConnection;
  if (!connection || !p.support.hostSlabLoops) throw Error('Derived landing connection and actual host slab loops required');
  const landingZ = c.runOffset - connection.landingDepth / 2, half = o.width / 2;
  const start = [0, 0, o.approachDepth], turn = [0, 0, landingZ];
  const paths = ['departure', 'arrival'].map(lane => {
    const x = c.lateralOffset + (lane === 'departure' ? 1 : -1) * connection.laneCenterLateralM;
    const nodesDoorLocal = [start, turn, [x, 0, landingZ]];
    return {lane, nodesDoorLocal,
      nodesStairRunLateral: nodesDoorLocal.map(q => [c.runOffset - q[2], c.lateralOffset - q[0]]),
      nodesWorld: nodesDoorLocal.map(q => new THREE.Vector3(...q).applyMatrix4(group.matrixWorld).toArray()),
      endpointParentFloorId: p.parentFloorId};
  });
  const boxes = [{name: 'door-passage:approach-through-frame', box: new THREE.Box3(
    new THREE.Vector3(-half, 0, Math.min(start[2], turn[2]) - half),
    new THREE.Vector3(half, o.height, Math.max(start[2], turn[2]) + half)), matrixWorld: group.matrixWorld}];
  for (const path of paths) {
    const endX = path.nodesDoorLocal[2][0];
    boxes.push({name: `door-passage:turn-to-${path.lane}`, box: new THREE.Box3(
      new THREE.Vector3(Math.min(0, endX) - half, 0, landingZ - half),
      new THREE.Vector3(Math.max(0, endX) + half, o.height, landingZ + half)), matrixWorld: group.matrixWorld});
  }
  const external = obstacleMeshes(obstacles, group), self = [];
  group.traverse(mesh => {if (mesh.isMesh) self.push(mesh);});
  const result = auditBoxesAgainstMeshes(THREE, boxes, [...external, ...self], o.epsilon);
  const hostMeshes = external.filter(m => m.name === p.hostSlabId || m.userData.slabId === p.hostSlabId);
  const supportErrors = [], supportLoops = [], up = new THREE.Vector3(0, 1, 0).transformDirection(group.matrixWorld);
  let supportRayCount = 0;
  const basisPoint = (x, z) => [p.basis.originEastUpSouth[0] + p.basis.x[0] * x + p.basis.z[0] * z,
    -p.basis.originEastUpSouth[2] - p.basis.x[2] * x - p.basis.z[2] * z];
  const loops = p.support.hostSlabLoops, supportState = {footprint: {sourceLoops: [loops[0]]},
    openings: loops.slice(1).map(loop => ({hostSlabId: p.hostSlabId, footprintLoop: loop}))};
  for (const volume of boxes) {
    const b = volume.box, loop = [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]].map(([x, z]) => basisPoint(x, z));
    supportLoops.push({volumeId: volume.name, footprintLoop: loop});
    try {assertSupported(loop, supportState, p.hostSlabId, volume.name);} catch (e) {supportErrors.push(e.message);}
    const nx = Math.max(1, Math.ceil((b.max.x - b.min.x) / 0.15)), nz = Math.max(1, Math.ceil((b.max.z - b.min.z) / 0.15));
    for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
      const point = new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * ix / nx, 0, b.min.z + (b.max.z - b.min.z) * iz / nz).applyMatrix4(group.matrixWorld);
      const ray = new THREE.Raycaster(point.clone().addScaledVector(up, 0.01), up.clone().negate(), 0, 0.02);
      const hit = ray.intersectObjects(hostMeshes, false)[0]; supportRayCount++;
      if (!hit || hit.point.distanceTo(point) > 2e-5) supportErrors.push(`Actual ${p.hostSlabId} support ray failed for ${volume.name} sample ${ix},${iz}`);
    }
  }
  const geometryClear = result.collisions.length === 0, supported = supportErrors.length === 0;
  return {schema: 'kaopu.bounded-door-to-landing-passage-audit/0.1',
    clear: geometryClear && supported && p.effectiveEnabled, geometryClear, supported, effectiveEnabled: p.effectiveEnabled,
    doorMatrixWorld: Array.from(group.matrixWorld.elements),
    parentFloorId: p.parentFloorId, hostSlabId: p.hostSlabId, thresholdFFLM: p.threshold.elevationM,
    doorAngleDeg: group.userData.currentAngleDeg, swing: c.swing, widthM: o.width, heightM: o.height,
    squareFootprintM: [o.width, o.width], paths, volumes: boxes.map(v => ({volumeId: v.name, minDoorLocal: v.box.min.toArray(), maxDoorLocal: v.box.max.toArray()})),
    collisions: result.collisions, triangleTests: result.triangleTests, externalObstacleMeshCount: external.length, doorComponentMeshCount: self.length,
    supportRayCount, supportErrors, supportLoops, contactEpsilonM: o.epsilon,
    basis: 'full_swept_rectangular_prisms_against_actual_mesh_triangles_plus_full_slab_footprint_containment_and_support_rays',
    navigationConnectionEnabled: false, egressCertified: false, buildingComplianceVerified: false,
    warning: 'Bounded authored body-volume check to the two landing lane centres only. Not an accessible route, continuous stair navigation, or safety certification.'};
}
/** Transactional pose edit. Rejected angle/collision leaves pose and state intact. */
export function setDoorAngle(THREE, group, angleDeg, obstacles = [], options = {}) {
  const {pivot} = doorParts(group);
  if (!Number.isFinite(angleDeg) || angleDeg < 0 || angleDeg > 100) throw Error('Door angle must be 0–100 degrees');
  const result = sampleDoorSweep(THREE, group, obstacles, {...options, fromAngleDeg: group.userData.currentAngleDeg, toAngleDeg: angleDeg});
  if (!result.clear) return {committed: false, ...result};
  pivot.rotation.y = signedAngle(group.userData.state.config, angleDeg);
  group.userData.currentAngleDeg = angleDeg; group.userData.state.config.angleDeg = angleDeg;
  group.userData.state.leaf.signedAngleDeg = (group.userData.state.config.swing === 'left' ? -1 : 1) * angleDeg;
  group.userData.sweep = clone(result); group.updateWorldMatrix(true, true);
  return {committed: true, ...result};
}
export function inspectDoor(proposal, group = null) {
  requireProposal(proposal); const state = clone(group?.userData?.state ?? proposal);
  if (group) {
    const {pivot, moving} = doorParts(group); group.updateWorldMatrix(true, true);
    const visible = o => {for (let n = o; n; n = n.parent) if (!n.visible) return false; return true;};
    const meshes = []; group.traverse(m => {if (m.isMesh) meshes.push({id: m.name, role: m.userData.role,
      dimensions: m.userData.dimensions, matrixWorld: Array.from(m.matrixWorld.elements), effectiveVisible: visible(m)});});
    state.scene = {effectiveVisible: visible(group), currentAngleDeg: group.userData.currentAngleDeg,
      pivotMatrixWorld: Array.from(pivot.matrixWorld.elements), matrixWorld: Array.from(group.matrixWorld.elements),
      movingPartCount: moving.length, meshes, sweep: clone(group.userData.sweep)};
  }
  return state;
}
