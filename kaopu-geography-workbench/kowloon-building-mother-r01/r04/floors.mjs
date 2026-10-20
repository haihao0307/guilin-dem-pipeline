/**
 * Original bounded slab-stack design layer on an observed-derived footprint.
 * Interior levels, thickness, materials and the reserved void are authored
 * assumptions, NOT surveyed floors, a service-core survey or structural design.
 * No foundations, room layout, stairs, lifts or code-compliance are inferred.
 * r04 adds independently hosted authored apertures without changing r03.
 */
import {validateScore} from '../../hk-three-buildings-r01/geometry/reconstruct.mjs';

export const FLOOR_SCHEMA = 'kaopu.assumed-floor-slab-stack/0.1';
const EPS = 1e-8;
const MAX_SLABS = 256;
const MAX_ADDITIONAL_OPENINGS = 32;
const clone = value => structuredClone(value);
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw Error(`${name} must be finite`);
  return value;
};
const samePoint = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < EPS;
const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const signedArea = ring => ring.reduce((sum, a, i) => {
  const b = ring[(i + 1) % ring.length];
  return sum + a[0] * b[1] - a[1] * b[0];
}, 0) / 2;
const onSegment = (p, a, b) => Math.abs(cross(a, b, p)) < EPS
  && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS
  && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;

function intersects(a, b, c, d) {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return ((abC > EPS && abD < -EPS || abC < -EPS && abD > EPS)
    && (cdA > EPS && cdB < -EPS || cdA < -EPS && cdB > EPS))
    || onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b);
}

// 1 = strict interior, 0 = boundary, -1 = exterior.
function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    if (onSegment(p, a, b)) return 0;
    if ((a[1] > p[1]) !== (b[1] > p[1])
      && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? 1 : -1;
}

function ringsIntersect(a, b) {
  return a.some((p, i) => b.some((q, j) => intersects(p, a[(i + 1) % a.length], q, b[(j + 1) % b.length])));
}

function validRing(input, name) {
  if (!Array.isArray(input) || input.some(p => !Array.isArray(p) || p.length !== 2 || p.some(v => !Number.isFinite(v)))) {
    throw Error(`${name} must contain finite east/north coordinate pairs`);
  }
  const ring = clone(input);
  if (ring.length > 3 && samePoint(ring[0], ring.at(-1))) ring.pop();
  if (ring.length < 3 || Math.abs(signedArea(ring)) < EPS) throw Error(`${name} is degenerate`);
  for (let i = 0; i < ring.length; i++) {
    if (samePoint(ring[i], ring[(i + 1) % ring.length])) throw Error(`${name} has a zero-length edge`);
    for (let j = i + 1; j < ring.length; j++) {
      if (j === i + 1 || i === 0 && j === ring.length - 1) continue;
      if (intersects(ring[i], ring[(i + 1) % ring.length], ring[j], ring[(j + 1) % ring.length])) {
        throw Error(`${name} must be a simple boundary`);
      }
    }
  }
  return ring;
}

export function defaultFloorConfig() {
  return {
    enabled: false,
    visible: true,
    floorToFloor: 3.2,
    slabThickness: 0.2,
    firstSlabOffset: 3.2,
    roofClearance: 0.05,
    // A reserved opening, not a modeled or measured elevator/stairwell.
    serviceCoreVoid: {enabled: true, centerEast: 0, centerNorth: 0, width: 2, depth: 2},
    floorStates: {},
    additionalOpenings: [],
  };
}

function normalizeConfig(config) {
  if (config == null) config = {};
  if (typeof config !== 'object' || Array.isArray(config)) throw Error('Floor config must be an object');
  const defaults = defaultFloorConfig(), c = {...defaults, ...clone(config)};
  if (config.serviceCoreVoid != null && (typeof config.serviceCoreVoid !== 'object' || Array.isArray(config.serviceCoreVoid))) {
    throw Error('serviceCoreVoid must be an object');
  }
  c.serviceCoreVoid = {...defaults.serviceCoreVoid, ...config.serviceCoreVoid};
  for (const key of ['enabled', 'visible']) if (typeof c[key] !== 'boolean') throw Error(`${key} must be boolean`);
  for (const key of ['floorToFloor', 'slabThickness', 'firstSlabOffset', 'roofClearance']) finite(c[key], key);
  if (c.floorToFloor < 0.5 || c.floorToFloor > 20) throw Error('floorToFloor must be 0.5–20 m');
  if (c.slabThickness < 0.04 || c.slabThickness > 1 || c.slabThickness >= c.floorToFloor) {
    throw Error('slabThickness must be 0.04–1 m and less than floorToFloor');
  }
  if (c.firstSlabOffset <= 0 || c.firstSlabOffset > 1000) throw Error('firstSlabOffset must be above the measured base and at most 1000 m');
  if (c.roofClearance < 0 || c.roofClearance > 5) throw Error('roofClearance must be 0–5 m');
  const v = c.serviceCoreVoid;
  if (typeof v.enabled !== 'boolean') throw Error('serviceCoreVoid.enabled must be boolean');
  for (const key of ['centerEast', 'centerNorth', 'width', 'depth']) finite(v[key], `serviceCoreVoid.${key}`);
  if (v.width <= 0 || v.depth <= 0 || v.width > 100 || v.depth > 100) throw Error('serviceCoreVoid dimensions must be positive and at most 100 m');
  if (!c.floorStates || typeof c.floorStates !== 'object' || Array.isArray(c.floorStates)) throw Error('floorStates must be an object');
  for (const [id, state] of Object.entries(c.floorStates)) {
    if (!/^slab-\d{3}$/.test(id) || !state || typeof state !== 'object' || Array.isArray(state)) throw Error('Invalid floorStates entry');
    for (const [key, value] of Object.entries(state)) {
      if (!['visible', 'enabled'].includes(key) || typeof value !== 'boolean') throw Error('Floor state supports only boolean visible and enabled');
    }
  }
  if (!Array.isArray(c.additionalOpenings) || c.additionalOpenings.length > MAX_ADDITIONAL_OPENINGS) {
    throw Error('additionalOpenings must be an array with at most 32 entries');
  }
  const ids = new Set();
  c.additionalOpenings = c.additionalOpenings.map((opening, index) => {
    if (!opening || typeof opening !== 'object' || Array.isArray(opening)) throw Error(`Invalid additionalOpenings[${index}]`);
    const {openingId, hostSlabId, purpose, polygon2D} = opening;
    if (typeof openingId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/.test(openingId)) {
      throw Error('Each additional opening needs a stable openingId of at most 128 identifier characters');
    }
    if (ids.has(openingId)) throw Error(`Duplicate openingId: ${openingId}`);
    ids.add(openingId);
    if (typeof hostSlabId !== 'string' || !/^slab-\d{3}$/.test(hostSlabId)) throw Error('Each additional opening needs an exact hostSlabId');
    if (purpose !== 'stair') throw Error('r04 additional opening purpose must be stair');
    if (!Array.isArray(polygon2D) || polygon2D.length > 128) throw Error('Additional opening polygon2D must have at most 128 vertices');
    // Additional metadata may be carried by the caller but cannot override
    // the derived host, boundary, evidence or assembly-membership records.
    return {...opening, openingId, hostSlabId, purpose,
      polygon2D: validRing(polygon2D, `Additional opening ${openingId}`)};
  });
  return c;
}

function measuredEnvelope(score) {
  validateScore(score);
  for (const axis of ['scaleEast', 'scaleNorth', 'scaleHeight']) {
    if ((score.edits?.[axis] ?? 1) !== 1) throw Error('Floor trial requires metre-scale source axes; non-unit scale is unsupported');
  }
  const operations = score.reconstruction.operations;
  const roofs = operations.filter(op => op.kind === 'roofPlane');
  if (roofs.length !== 1) throw Error('Floor trial requires one horizontal roof and common-height wall strips');
  const roof = roofs[0];
  if (Math.abs(roof.heightPlane[0]) + Math.abs(roof.heightPlane[1]) > EPS) throw Error('Floor trial requires a horizontal roof');
  if (roof.loops.flat().length > 2000) throw Error('Footprint vertex budget exceeded');
  const loops = roof.loops.map((ring, i) => validRing(ring, `Footprint loop ${i}`));
  for (let i = 1; i < loops.length; i++) {
    if (loops[i].some(p => pointInRing(p, loops[0]) !== 1) || ringsIntersect(loops[i], loops[0])) {
      throw Error('Source footprint holes must be wholly interior');
    }
    for (let j = 1; j < i; j++) {
      if (ringsIntersect(loops[i], loops[j]) || pointInRing(loops[i][0], loops[j]) >= 0 || pointInRing(loops[j][0], loops[i]) >= 0) {
        throw Error('Source footprint holes must not overlap or nest');
      }
    }
  }
  const walls = operations.filter(op => op !== roof).map(op => {
    // Interoperate with the independently authored hosted-window cut without
    // interpreting arbitrary profiles as complete measured vertical walls.
    if (op.kind === 'wallStrip') return op;
    if (op.kind === 'wallProfile'
      && op.authoredHostedOpening?.schema === 'kaopu.hosted-casement-prototype/0.1'
      && op.authoredHostedOpening.sourceWallStrip?.kind === 'wallStrip'
      && op.authoredHostedOpening.sourceWallStrip.id === op.id) return op.authoredHostedOpening.sourceWallStrip;
    throw Error('Floor trial supports only the bounded common-wall-top tower');
  });
  if (!walls.length) throw Error('Measured wall base is required');
  const base = walls[0].bottom, roofTop = roof.heightPlane[2];
  if (walls.some(w => Math.abs(w.bottom - base) > EPS || Math.abs(w.top - roofTop) > EPS)) {
    throw Error('Measured walls must share the roof top and a common base');
  }
  const edges = loops.flatMap(ring => ring.map((a, i) => [a, ring[(i + 1) % ring.length]]));
  if (walls.length !== edges.length) throw Error('Measured walls must match every exact footprint edge');
  const unmatched = walls.slice();
  for (const [a, b] of edges) {
    const index = unmatched.findIndex(w => samePoint(a, w.edge[0]) && samePoint(b, w.edge[1])
      || samePoint(a, w.edge[1]) && samePoint(b, w.edge[0]));
    if (index < 0) throw Error('Measured walls must match every exact footprint edge');
    unmatched.splice(index, 1);
  }
  return {roofPatchId: roof.id, wallPatchIds: walls.map(w => w.id), base, roofTop, loops};
}

/** Pure, serializable design state. Invalid configuration fails even if hidden. */
export function validateFloorConfig(score, config = {}) {
  const c = normalizeConfig(config), envelope = measuredEnvelope(score);
  const sourceLoops = envelope.loops, loops = clone(sourceLoops), v = c.serviceCoreVoid;
  let voidLoop = null;
  if (v.enabled) {
    voidLoop = [
      [v.centerEast - v.width / 2, v.centerNorth - v.depth / 2],
      [v.centerEast + v.width / 2, v.centerNorth - v.depth / 2],
      [v.centerEast + v.width / 2, v.centerNorth + v.depth / 2],
      [v.centerEast - v.width / 2, v.centerNorth + v.depth / 2],
    ];
    // Corner checks alone are insufficient for concave footprints. Test all
    // segment crossings and existing holes, including enclosed holes.
    if (voidLoop.some(p => pointInRing(p, loops[0]) !== 1) || ringsIntersect(voidLoop, loops[0])
      || loops.slice(1).some(hole => ringsIntersect(voidLoop, hole)
        || voidLoop.some(p => pointInRing(p, hole) >= 0) || pointInRing(hole[0], voidLoop) >= 0)) {
      throw Error('serviceCoreVoid must be wholly inside the exact footprint and disjoint from source holes');
    }
    loops.push(voidLoop);
  }
  const ceiling = envelope.roofTop - c.roofClearance;
  const firstBottom = envelope.base + c.firstSlabOffset;
  const footprintArea = Math.abs(signedArea(sourceLoops[0])) - sourceLoops.slice(1).reduce((sum, h) => sum + Math.abs(signedArea(h)), 0);
  const area = footprintArea - (voidLoop ? v.width * v.depth : 0);
  const slabs = [], openings = [], serviceCoreVolumeId = 'reserved-core-volume-001';
  for (let index = 0; ; index++) {
    const bottom = firstBottom + index * c.floorToFloor;
    if (bottom >= ceiling - EPS) break;
    if (index >= MAX_SLABS) throw Error('Floor stack exceeds the 256-slab trial budget');
    const top = Math.min(bottom + c.slabThickness, ceiling);
    const slabId = `slab-${String(index + 1).padStart(3, '0')}`, state = c.floorStates[slabId] ?? {};
    const enabled = state.enabled ?? true, visible = state.visible ?? true;
    slabs.push({
      id: slabId, slabId, floorId: `floor-${String(index + 1).padStart(3, '0')}`, designOrdinal: index + 1,
      bottom, top, elevation: top, bottomElevationM: bottom, topElevationM: top, thickness: top - bottom,
      nominalThickness: c.slabThickness, roofClipped: top < bottom + c.slabThickness - EPS,
      visible, enabled, effectiveEnabled: c.enabled && enabled, effectiveVisible: c.enabled && c.visible && enabled && visible,
      // Every slab owns its own complete loops. The common footprint is not
      // mutated when one upper slab receives a stair aperture.
      loops: clone(loops), slabAreaSquareMetres: area,
      openingIds: loops.slice(1).map((loop, holeIndex) => {
        const openingId = `${slabId}:opening-${String(holeIndex + 1).padStart(3, '0')}`;
        const authoredCore = voidLoop !== null && holeIndex + 1 === loops.length - 1;
        openings.push({openingId, hostSlabId: slabId, loopIndex: holeIndex + 1, footprintLoop: clone(loop),
          bottomElevationM: bottom, topElevationM: top,
          reservedVolumeId: authoredCore ? serviceCoreVolumeId : null,
          evidence: authoredCore ? 'authored_reserved_core_opening' : 'source_footprint_hole_propagated_to_authored_slab',
          liftStopInferred: false});
        return openingId;
      }),
      evidence: 'assumed_design_not_measured_floor', editableProposal: true, interiorEvidence: 'unknown',
    });
  }
  const openingIds = new Set(openings.map(opening => opening.openingId));
  for (const opening of c.additionalOpenings) {
    const slab = slabs.find(s => s.slabId === opening.hostSlabId);
    if (!slab) throw Error(`Additional opening ${opening.openingId} has missing host slab ${opening.hostSlabId}`);
    if (openingIds.has(opening.openingId)) throw Error(`Duplicate openingId: ${opening.openingId}`);
    openingIds.add(opening.openingId);
    const polygon = opening.polygon2D, hostLoops = slab.loops;
    if (polygon.some(p => pointInRing(p, hostLoops[0]) !== 1) || ringsIntersect(polygon, hostLoops[0])
      || hostLoops.slice(1).some(hole => ringsIntersect(polygon, hole)
        || polygon.some(p => pointInRing(p, hole) >= 0) || pointInRing(hole[0], polygon) >= 0)) {
      throw Error(`Additional opening ${opening.openingId} must be wholly inside its host footprint and disjoint from all existing openings`);
    }
    const loopIndex = hostLoops.length;
    hostLoops.push(clone(polygon));
    slab.slabAreaSquareMetres -= Math.abs(signedArea(polygon));
    slab.openingIds.push(opening.openingId);
    openings.push({
      openingId: opening.openingId, hostSlabId: slab.slabId, purpose: opening.purpose,
      loopIndex, footprintLoop: clone(polygon), polygon2D: clone(polygon),
      bottomElevationM: slab.bottom, topElevationM: slab.top,
      reservedVolumeId: null, evidence: 'authored_single_host_stair_aperture_not_measured',
      editableProposal: true, interiorEvidence: 'unknown', liftStopInferred: false,
      effectiveEnabled: slab.effectiveEnabled, effectiveVisible: slab.effectiveVisible,
    });
  }
  for (let i = 0; i < slabs.length; i++) {
    const slab = slabs[i], next = slabs[i + 1];
    slab.clearHeight = Math.max(0, (next?.bottom ?? envelope.roofTop) - slab.top);
    slab.upperBoundary = next?.slabId ?? envelope.roofPatchId;
    slab.clearHeightBasis = 'nominal_design_stack_before_visibility_or_assembly_exclusions';
  }
  return {
    valid: true, schema: FLOOR_SCHEMA, objectId: score.objectId, enabled: c.enabled, visible: c.visible, config: c,
    evidence: 'authored_slab_stack_on_observed_derived_footprint', editableProposal: true, interiorEvidence: 'unknown',
    measuredFloorCount: null, originalFloorCount: 'unknown', measuredInteriorLevels: false,
    authoredPolicy: {
      floorSpacingMeasured: false, serviceCoreMeasured: false, materialMeasured: false,
      structuralSupportVerified: false, buildingComplianceVerified: false,
      foundationsAdded: false, liftsAdded: false, stairsAdded: false, roomLayoutAdded: false,
    },
    coordinates: 'local metres: footprint east/north; mesh east/up/south; no assembly placement baked in',
    envelope: {roofPatchId: envelope.roofPatchId, wallPatchIds: envelope.wallPatchIds,
      base: envelope.base, roofTop: envelope.roofTop, slabCeiling: ceiling},
    footprint: {sourceLoops: clone(sourceLoops), loops, sourceHoleCount: sourceLoops.length - 1,
      designHoleCount: voidLoop ? 1 : 0, sourceAreaSquareMetres: footprintArea, slabAreaSquareMetres: area,
      areaBasis: 'common_footprint_before_single_host_additional_openings; see slabs[].slabAreaSquareMetres'},
    serviceCoreVoid: {enabled: v.enabled, loop: clone(voidLoop), evidence: 'authored_reserved_opening_not_service_equipment'},
    serviceCoreVolume: {enabled: v.enabled, volumeId: serviceCoreVolumeId, footprintLoop: clone(voidLoop),
      bottomElevationM: envelope.base, topElevationM: envelope.roofTop,
      role: 'cross_level_reserved_volume_separate_from_single_host_slab_openings',
      visualGeometryAdded: false, actualServiceCoreMeasured: false, liftStopsInferred: false},
    floorCount: slabs.length, slabCount: slabs.length, slabs,
    floors: slabs.map(s => ({floorId: s.floorId, slabId: s.slabId,
      label: `Assumed design level ${String(s.designOrdinal).padStart(2, '0')}`, labelDisplayOnly: true,
      elevation: s.elevation, fflM: s.top, sslM: s.top, finishLayerModeled: false,
      levelConvention: 'FFL_equals_SSL_only_in_this_simplified_unfinished_design',
      clearHeight: s.clearHeight, upperBoundary: s.upperBoundary, clearHeightBasis: s.clearHeightBasis,
      visible: s.visible, enabled: s.enabled, effectiveEnabled: s.effectiveEnabled, effectiveVisible: s.effectiveVisible,
      evidence: s.evidence, enclosureModeled: false, editableProposal: true, interiorEvidence: 'unknown'})),
    openings,
    additionalOpeningCount: c.additionalOpenings.length,
    additionalOpeningIds: c.additionalOpenings.map(opening => opening.openingId),
    includedSlabIds: slabs.filter(s => s.effectiveEnabled).map(s => s.slabId),
    visibleSlabIds: slabs.filter(s => s.effectiveVisible).map(s => s.slabId),
    excludedSlabIds: slabs.filter(s => !s.effectiveEnabled).map(s => s.slabId),
    unusedFloorStateIds: Object.keys(c.floorStates).filter(id => !slabs.some(s => s.slabId === id)),
  };
}

function slabGeometry(THREE, state, slab) {
  const loops = clone(slab.loops);
  if (signedArea(loops[0]) < 0) loops[0].reverse();
  for (const hole of loops.slice(1)) if (signedArea(hole) > 0) hole.reverse();
  const flat = loops.flat();
  const faces = THREE.ShapeUtils.triangulateShape(
    loops[0].map(p => new THREE.Vector2(...p)),
    loops.slice(1).map(hole => hole.map(p => new THREE.Vector2(...p))));
  if (!faces.length) throw Error('Slab triangulation failed');
  const positions = [], normals = [], surfaces = [];
  const point = (p, height) => [p[0], height, -p[1]];
  const triangle = (a, b, c) => {
    const ab = b.map((v, i) => v - a[i]), ac = c.map((v, i) => v - a[i]);
    const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const length = Math.hypot(...normal);
    if (length <= EPS * EPS) throw Error('Degenerate slab triangle');
    for (const p of [a, b, c]) { positions.push(...p); normals.push(...normal.map(n => n / length)); }
  };
  const surface = (role, materialIndex, make, extra = {}) => {
    const start = positions.length / 3;
    make();
    surfaces.push({role, start, count: positions.length / 3 - start, materialIndex, ...extra});
  };
  const topFaces = faces.map(face => {
    const points = face.map(i => flat[i]);
    return cross(...points) >= 0 ? points : [points[0], points[2], points[1]];
  });
  surface('top', 0, () => topFaces.forEach(([a, b, c]) => triangle(point(a, slab.top), point(b, slab.top), point(c, slab.top))));
  surface('bottom', 1, () => topFaces.forEach(([a, b, c]) => triangle(point(c, slab.bottom), point(b, slab.bottom), point(a, slab.bottom))));
  loops.forEach((ring, index) => surface(index ? 'void-side' : 'outer-side', 2, () => {
    ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length];
      triangle(point(a, slab.bottom), point(b, slab.bottom), point(b, slab.top));
      triangle(point(a, slab.bottom), point(b, slab.top), point(a, slab.top));
    });
  }, {loopIndex: index, openingId: index ? slab.openingIds[index - 1] : null,
    boundaryEvidence: index >= state.footprint.sourceLoops.length ? 'authored_void' : 'observed_derived_boundary'}));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  for (const s of surfaces) geometry.addGroup(s.start, s.count, s.materialIndex);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.userData = {schema: FLOOR_SCHEMA, slabId: slab.slabId, surfaces,
    holeCount: loops.length - 1, loops: clone(slab.loops), openingIds: slab.openingIds.slice(),
    slabAreaSquareMetres: slab.slabAreaSquareMetres, solidVolumeCubicMetres: slab.slabAreaSquareMetres * slab.thickness};
  return geometry;
}

/** Individual closed volumetric meshes. Global disable retains hidden geometry. */
export function buildFloors(THREE, score, config = {}) {
  if (!THREE?.ShapeUtils?.triangulateShape) throw Error('Three.js ShapeUtils is required');
  const state = validateFloorConfig(score, config);
  const group = new THREE.Group(); group.name = 'assumed-floor-slab-stack';
  group.visible = state.enabled && state.visible;
  const materials = [
    new THREE.MeshStandardMaterial({color: '#b9b4a6', roughness: 0.9, metalness: 0}),
    new THREE.MeshStandardMaterial({color: '#94958d', roughness: 0.96, metalness: 0}),
    new THREE.MeshStandardMaterial({color: '#aaa79b', roughness: 0.92, metalness: 0}),
  ];
  for (const slab of state.slabs) {
    const mesh = new THREE.Mesh(slabGeometry(THREE, state, slab), materials);
    mesh.name = slab.slabId; mesh.visible = slab.visible && slab.enabled;
    mesh.userData = {...clone(slab), role: 'authored-floor-slab', schema: FLOOR_SCHEMA};
    group.add(mesh);
  }
  group.userData = {schema: FLOOR_SCHEMA, state, evidence: state.evidence,
    materialEvidence: 'generic_authored_concrete_visual_preset_not_measured'};
  group.updateMatrixWorld(true);
  return group;
}

/** Serializable design-space and optional actual scene-state inspection. */
export function inspectFloors(score, config = {}, group = null) {
  const state = validateFloorConfig(score, config);
  if (group) {
    if (group.userData?.schema !== FLOOR_SCHEMA) throw Error('Not an assumed-floor-slab-stack group');
    group.updateWorldMatrix(true, true);
    const inheritedVisible = object => {
      for (let current = object; current; current = current.parent) if (!current.visible) return false;
      return true;
    };
    state.scene = {
      visible: group.visible, effectiveVisible: inheritedVisible(group), matrixWorld: Array.from(group.matrixWorld.elements),
      slabs: group.children.map(mesh => ({slabId: mesh.userData.slabId, visible: mesh.visible,
        effectiveVisible: inheritedVisible(mesh), matrixWorld: Array.from(mesh.matrixWorld.elements),
        triangles: mesh.geometry.getAttribute('position').count / 3, surfaces: clone(mesh.geometry.userData.surfaces)})),
    };
  }
  return state;
}
