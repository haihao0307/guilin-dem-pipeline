/** Original bounded three-level authored circulation. Not a survey, code check,
 * navigable escape route, ground connection, structural design or lift design.
 * r04 remains the sole source of floor/cut and closed stair mesh geometry. */
import {validateFloorConfig, buildFloors} from '../r04/floors.mjs';
import {defaultStairConfig, deriveStairProposal, buildStairs} from '../r04/stairs.mjs';

export const CIRCULATION_SCHEMA = 'kaopu.three-floor-circulation-proposal/0.1';
const EPS = 1e-7, RAY_EPS = 1e-4, copy = value => structuredClone(value);
const PAIRS = [['floor-001', 'floor-002'], ['floor-002', 'floor-003']];
const IDS = ['stair-001-002', 'stair-002-003'];
const OWNED_OPENINGS = IDS.map(id => `${id}:upper-slab-opening`);
const center = loop => [0, 1].map(i => loop.reduce((sum, p) => sum + p[i], 0) / loop.length);
const inheritedVisible = o => {for (let p = o; p; p = p.parent) if (!p.visible) return false; return true;};

export function defaultCirculationConfig() {
  const {enabled, visible, lowerFloorId, upperFloorId, ...stair} = defaultStairConfig();
  return {enabled: false, visible: true, stair, pairStates: {}};
}
function normalize(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Circulation config must be an object');
  const d = defaultCirculationConfig();
  for (const key of Object.keys(input)) if (!(key in d)) throw Error(`Unknown circulation parameter: ${key}`);
  const c = {...d, ...copy(input)};
  for (const key of ['enabled', 'visible']) if (typeof c[key] !== 'boolean') throw Error(`circulation.${key} must be boolean`);
  for (const key of ['stair', 'pairStates']) if (!c[key] || typeof c[key] !== 'object' || Array.isArray(c[key])) throw Error(`${key} must be an object`);
  for (const key of Object.keys(c.stair)) if (!(key in d.stair)) throw Error(`Unknown shared stair parameter: ${key}`);
  c.stair = {...d.stair, ...c.stair};
  for (const [id, state] of Object.entries(c.pairStates)) {
    if (!IDS.includes(id) || !state || typeof state !== 'object' || Array.isArray(state)) throw Error('pairStates must name only the two bounded stair IDs');
    for (const [key, value] of Object.entries(state)) if (!['enabled', 'visible'].includes(key) || typeof value !== 'boolean') throw Error('Pair state supports only boolean enabled/visible');
  }
  return c;
}
// r04 treats every touching unrelated opening as forbidden. The single known
// predecessor cut shares only the retained landing's arrival/departure face.
// Keep all physical slab loops and all other holes; adapt this metadata check
// only for the fixed next pair, after both generated cuts have been validated.
const r04PairFloorState = (state, index) => index === 1 ? {...state, openings: state.openings.filter(o =>
  !(o.openingId === OWNED_OPENINGS[0] && o.hostSlabId === 'slab-002'))} : state;
const pairConfig = (c, index) => ({...c.stair, lowerFloorId: PAIRS[index][0], upperFloorId: PAIRS[index][1],
  enabled: c.enabled && (c.pairStates[IDS[index]]?.enabled ?? true),
  visible: c.visible && (c.pairStates[IDS[index]]?.visible ?? true)});
function localRanges(loop, plan) {
  const {originEastNorth:o, runEastNorth:u, lateralEastNorth:v} = plan.basis;
  const points = loop.map(p => {const d = [p[0] - o[0], p[1] - o[1]]; return [d[0] * u[0] + d[1] * u[1], d[0] * v[0] + d[1] * v[1]];});
  return [0, 1].map(i => [Math.min(...points.map(p => p[i])), Math.max(...points.map(p => p[i]))]);
}
function analyticAudit(pairs) {
  if (!pairs.length) return {valid: true, actualMeshesChecked: false, minimumClearanceM: null, requiredM: null, records: [], certified: false};
  let minimum = Math.min(...pairs.map(p => p.headroom.minimumClearanceM));
  const records = pairs.flatMap(p => p.headroom.records.map(r => ({...r, stairId: p.stairId, source: 'actual_cut_slab_plane_full_patch'})));
  // The bounded stacks share exactly one basis and footprint. Project the full
  // walking patch into it; evaluate the sloping underside at the extreme of
  // the overlap, rather than treating a stair as an empty opening or center ray.
  for (let i = 0; i < pairs.length; i++) for (let j = i + 1; j < pairs.length; j++) {
    const lower = pairs[i], upper = pairs[j];
    for (const patch of lower.walkingPatches) {
      const [s, t] = localRanges(patch.footprintLoop, upper);
      for (const f of upper.flights) {
        const ends = [f.sStart, f.sStart + f.direction * upper.dimensions.runLength].sort((a, b) => a - b);
        const lo = Math.max(s[0], ends[0]), hi = Math.min(s[1], ends[1]);
        if (hi - lo < EPS || Math.min(t[1], f.lateral[1]) - Math.max(t[0], f.lateral[0]) < EPS) continue;
        const q = Math.min((lo - f.sStart) * f.direction, (hi - f.sStart) * f.direction);
        const soffit = f.startFFL + Math.max(0, q * upper.dimensions.actualRiser / upper.config.treadDepth - upper.config.plateThickness);
        const clearanceM = soffit - patch.elevationM;
        minimum = Math.min(minimum, clearanceM);
        records.push({patchId: patch.id, stairId: lower.stairId, overheadId: f.flightId, clearanceM,
          source: 'closed_stair_sloping_underside_full_patch_limit'});
      }
      const [ms, mt] = localRanges(upper.midLanding.footprintLoop, upper);
      if (Math.min(s[1], ms[1]) - Math.max(s[0], ms[0]) > EPS && Math.min(t[1], mt[1]) - Math.max(t[0], mt[0]) > EPS) {
        const clearanceM = upper.midLanding.bottomElevationM - patch.elevationM;
        minimum = Math.min(minimum, clearanceM);
        records.push({patchId: patch.id, stairId: lower.stairId, overheadId: upper.midLanding.landingId, clearanceM,
          source: 'closed_mid_landing_underside_full_patch'});
      }
    }
  }
  const requiredM = Math.max(...pairs.map(p => p.config.minHeadroom));
  if (minimum < requiredM - EPS) throw Error(`Stacked stair geometric headroom ${minimum.toFixed(3)} m is below authored minimum ${requiredM.toFixed(3)} m`);
  return {valid: true, basis: 'full_walking_patch_vs_cut_slabs_and_both_closed_stair_profiles',
    actualMeshesChecked: false, minimumClearanceM: minimum, requiredM, records,
    certified: false, interStackCollisionCheck: 'performed_on_actual_meshes_at_build'};
}
function graphFor(pairs, floorState) {
  const a = pairs[0], b = pairs[1], first = a.floorLandings[1], second = b.floorLandings[0];
  if (first.floorId !== 'floor-002' || second.floorId !== first.floorId || first.hostSlabId !== second.hostSlabId
    || Math.abs(first.elevationM - second.elevationM) > EPS
    || first.footprintLoop.length !== second.footprintLoop.length
    || first.footprintLoop.some((p, i) => Math.hypot(p[0] - second.footprintLoop[i][0], p[1] - second.footprintLoop[i][1]) > EPS)) {
    throw Error('Two stair groups must join the same retained floor-002 slab region at the same FFL');
  }
  const nodes = pairs.flatMap(p => [
    {nodeId: `${p.stairId}:departure`, floorId: p.lowerFloorId, hostSlabId: p.lowerSlabId, lane: 'left',
      positionLocalEastUpSouth: copy(p.walkPath[0].positionLocalEastUpSouth), effectiveEnabled: p.effectiveEnabled},
    {nodeId: `${p.stairId}:arrival`, floorId: p.upperFloorId, hostSlabId: p.upperSlabId, lane: 'right',
      positionLocalEastUpSouth: copy(p.walkPath.at(-1).positionLocalEastUpSouth), effectiveEnabled: p.effectiveEnabled},
  ]);
  const path = [copy(a.walkPath.at(-1)), copy(b.walkPath[0])];
  const shared = {landingId: 'shared-landing:floor-002', floorId: first.floorId, hostSlabId: first.hostSlabId,
    elevationM: first.elevationM, footprintLoop: copy(first.footprintLoop),
    geometry: 'one_retained_physical_host_slab_region_no_duplicate_mesh', duplicatedMeshCount: 0,
    arrivalNodeId: nodes[1].nodeId, departureNodeId: nodes[2].nodeId,
    walkPath: path, effectiveEnabled: a.effectiveEnabled && b.effectiveEnabled,
    effectiveVisible: a.effectiveVisible && b.effectiveVisible && floorState.slabs.find(s => s.slabId === first.hostSlabId).effectiveVisible};
  const edges = pairs.map(p => ({edgeId: `${p.stairId}:rise`, kind: 'authored_stair_group',
    from: `${p.stairId}:departure`, to: `${p.stairId}:arrival`, stairId: p.stairId,
    effectiveEnabled: p.effectiveEnabled, walkPath: copy(p.walkPath)}));
  edges.splice(1, 0, {edgeId: 'shared-landing:floor-002:transfer', kind: 'retained_slab_transfer',
    from: shared.arrivalNodeId, to: shared.departureNodeId, hostSlabId: shared.hostSlabId,
    effectiveEnabled: shared.effectiveEnabled, walkPath: copy(path)});
  return {sharedLandings: [shared], graph: {schema: 'kaopu.authored-circulation-dependency-graph/0.1', nodes, edges,
    floorIds: ['floor-001', 'floor-002', 'floor-003'], connected: edges.every(e => e.effectiveEnabled),
    navigationConnectionEnabled: false, circulationComplete: false, groundConnectionAdded: false}};
}

/** Derive both apertures together. Disabled invalid stair fits never prevent
 * valid floor-only editing; enabling is strict and fails before any scene edit. */
export function deriveCirculationProposal(score, floorConfig = {}, config = {}) {
  const c = normalize(config), clean = copy(floorConfig);
  if (clean.additionalOpenings !== undefined && !Array.isArray(clean.additionalOpenings)) throw Error('additionalOpenings must be an array');
  clean.additionalOpenings = (clean.additionalOpenings ?? []).filter(o => !OWNED_OPENINGS.includes(o.openingId));
  const base = validateFloorConfig(score, clean);
  const common = {schema: CIRCULATION_SCHEMA, config: c, enabled: c.enabled, visible: c.visible,
    sourceScore: copy(score), evidence: 'authored_three_floor_design_not_measured', interiorEvidence: 'unknown',
    editableProposal: true, realLocationVerified: false, structuralSupportVerified: false, buildingComplianceVerified: false,
    groundConnectionAdded: false, elevatorAdded: false, circulationComplete: false, evacuationPermitted: false,
    navigationConnectionEnabled: false, propagatedBeyondFloor003: false,
    warning: 'Bounded authored three-floor geometry only. No measured interior, structural support, code compliance, complete escape route, ground access or lift is established.'};
  try {
    const preliminary = PAIRS.map((_, i) => deriveStairProposal(base, pairConfig(c, i)));
    const configWithOpenings = {...clean, additionalOpenings: [...clean.additionalOpenings, ...preliminary.flatMap(p => p.openingRecords)]};
    const floorState = validateFloorConfig(score, configWithOpenings);
    const pairs = PAIRS.map((_, i) => deriveStairProposal(r04PairFloorState(floorState, i), pairConfig(c, i)));
    const graphData = graphFor(pairs, floorState), geometryAudit = analyticAudit(c.enabled ? pairs.filter(p => p.enabled) : pairs);
    return {...common, floorState, configWithOpenings, pairs, ...graphData, geometryAudit,
      effectiveEnabled: pairs.some(p => p.effectiveEnabled), effectiveVisible: pairs.some(p => p.effectiveVisible),
      validation: {valid: true, activationReady: true, errors: []},
      openingRecords: pairs.flatMap(p => p.openingRecords), proposedOpeningRecords: pairs.flatMap(p => p.proposedOpeningRecords)};
  } catch (error) {
    if (c.enabled) throw error;
    return {...common, floorState: base, configWithOpenings: clean, pairs: [], sharedLandings: [],
      effectiveEnabled: false, effectiveVisible: false, openingRecords: [], proposedOpeningRecords: [],
      validation: {valid: false, activationReady: false, errors: [error.message]},
      graph: {nodes: [], edges: [], floorIds: [], connected: false, navigationConnectionEnabled: false, circulationComplete: false},
      geometryAudit: {valid: false, actualMeshesChecked: false, certified: false, errors: [error.message]}};
  }
}

function auditMeshes(THREE, derived, group, floors) {
  const requestedPairs = derived.pairs.filter(p => p.enabled);
  const stairGroups = group.children.filter(g => g.userData.state.enabled);
  const meshes = [...stairGroups.flatMap(g => g.children), ...floors.children];
  group.updateMatrixWorld(true); floors.updateMatrixWorld(true);
  const hit = (p, h, up = false, targets = meshes) => new THREE.Raycaster(new THREE.Vector3(p[0], h + RAY_EPS, -p[1]),
    new THREE.Vector3(0, up ? 1 : -1, 0)).intersectObjects(targets, false)[0];
  let supportRayCount = 0, headroomRayCount = 0, minimumRayClearanceM = Infinity;
  const support = (p, h, targets = meshes, expectedHost = null) => {
    const result = hit(p, h, false, targets); supportRayCount++;
    if (!result || Math.abs(result.point.y - h) > 2e-5 || expectedHost && result.object.name !== expectedHost) {
      throw Error(`Actual circulation support ray failed${expectedHost ? ` on ${expectedHost}` : ''}`);
    }
  };
  for (const p of requestedPairs) for (const patch of p.walkingPatches) {
    const mid = center(patch.footprintLoop), samples = [mid,
      ...patch.footprintLoop.map(q => [q[0] * 0.999 + mid[0] * 0.001, q[1] * 0.999 + mid[1] * 0.001])];
    for (const q of samples) {
      support(q, patch.elevationM);
      const overhead = hit(q, patch.elevationM, true); headroomRayCount++;
      // Source roof is not rebuilt here; analytic roof-plane clearance is still
      // included. Every default patch also has an actual higher slab/solid hit.
      if (!overhead) continue;
      const clearance = overhead.point.y - patch.elevationM;
      minimumRayClearanceM = Math.min(minimumRayClearanceM, clearance);
      if (clearance < p.config.minHeadroom - 2e-5) throw Error(`Actual mesh headroom ${clearance.toFixed(3)} m is below authored minimum`);
    }
  }
  let sharedSupportRayCount = 0;
  for (const shared of derived.sharedLandings.filter(() => requestedPairs.length === 2)) {
    const host = floors.children.filter(m => m.name === shared.hostSlabId), [a, b] = shared.walkPath.map(n => n.positionLocalEastUpSouth);
    for (let i = 0; i <= 32; i++) {
      const t = i / 32; support([a[0] * (1 - t) + b[0] * t, -(a[2] * (1 - t) + b[2] * t)], shared.elevationM, host, shared.hostSlabId);
      sharedSupportRayCount++;
    }
  }
  const interStackPairs = [], collisions = [];
  if (stairGroups.length === 2) for (const a of stairGroups[0].children) for (const b of stairGroups[1].children) {
    const ab = new THREE.Box3().setFromObject(a), bb = new THREE.Box3().setFromObject(b);
    const overlap = ['x', 'y', 'z'].map(axis => Math.min(ab.max[axis], bb.max[axis]) - Math.max(ab.min[axis], bb.min[axis]));
    // All bounded same-basis stack meshes are vertically separated. A positive
    // volume bounding-box overlap is rejected conservatively, not passed off as
    // an exact triangle collision proof. Shared zero-volume faces are allowed.
    const volumeOverlap = overlap.every(n => n > 2e-5);
    const record = {first: a.name, second: b.name, aabbOverlapMetres: overlap, volumeOverlap,
      verticalSeparationM: Math.max(bb.min.y - ab.max.y, ab.min.y - bb.max.y)};
    interStackPairs.push(record); if (volumeOverlap) collisions.push(record);
  }
  if (collisions.length) throw Error('Actual stacked stair solids overlap in volume; bounded assembly rejected');
  return {...copy(derived.geometryAudit), actualMeshesChecked: true,
    basis: 'full_patch_analytic_bound_plus_actual_buffer_geometry_support_headroom_rays_and_disjoint_solid_bounds',
    supportRayCount, sharedSupportRayCount, headroomRayCount,
    minimumRayClearanceM: Number.isFinite(minimumRayClearanceM) ? minimumRayClearanceM : null,
    interStackPairs, interStackCollisions: collisions, duplicateLandingSolids: 0,
    inspectionIgnoresDisplayVisibility: true, geometryMembershipCheckedSeparately: true};
}

/** Returns only six original closed stair solids in two groups. Build the floors
 * once with configWithOpenings and put both under the existing assembly parent. */
export function buildCirculation(THREE, derived) {
  if (!THREE?.ShapeUtils?.triangulateShape || derived?.schema !== CIRCULATION_SCHEMA) throw Error('Three.js and a derived circulation proposal are required');
  if (derived.enabled && !derived.validation?.activationReady) throw Error('Circulation must pass strict enable-time validation');
  const group = new THREE.Group(); group.name = 'authored-three-floor-circulation'; group.visible = derived.effectiveVisible;
  for (const [i, p] of derived.pairs.entries()) group.add(buildStairs(THREE, r04PairFloorState(derived.floorState, i), p.config));
  let geometryAudit = copy(derived.geometryAudit);
  if (derived.enabled && derived.pairs.length) {
    const floors = buildFloors(THREE, derived.sourceScore, derived.configWithOpenings);
    try {geometryAudit = auditMeshes(THREE, derived, group, floors);}
    finally {floors.traverse(o => {o.geometry?.dispose();}); for (const m of floors.children[0]?.material ?? []) m.dispose();}
  }
  group.userData = {schema: CIRCULATION_SCHEMA, state: derived, geometryAudit,
    sharedLandings: copy(derived.sharedLandings), floorGeometryOwnedByParent: true,
    transforms: 'all_vertices_local_parent_placement_inherited_exactly_once'};
  group.updateMatrixWorld(true); return group;
}
export function inspectCirculation(derived, group = null) {
  if (derived?.schema !== CIRCULATION_SCHEMA) throw Error('Derived circulation proposal required');
  const {sourceScore, ...state} = copy(derived);
  if (group) {
    if (group.userData?.schema !== CIRCULATION_SCHEMA) throw Error('Not a bounded circulation group');
    group.updateWorldMatrix(true, true);
    state.geometryAudit = copy(group.userData.geometryAudit);
    state.scene = {effectiveVisible: inheritedVisible(group), effectiveEnabled: derived.effectiveEnabled,
      matrixWorld: Array.from(group.matrixWorld.elements), localPosition: group.position.toArray(),
      pairs: group.children.map(g => ({stairId: g.name, effectiveVisible: inheritedVisible(g),
        effectiveEnabled: g.userData.state.effectiveEnabled, matrixWorld: Array.from(g.matrixWorld.elements),
        solids: g.children.map(m => ({id: m.name, role: m.userData.role, closedSolid: m.geometry.userData.closedSolid,
          solidVolumeCubicMetres: m.geometry.userData.solidVolumeCubicMetres,
          matrixWorld: Array.from(m.matrixWorld.elements)}))}))};
  }
  return state;
}
