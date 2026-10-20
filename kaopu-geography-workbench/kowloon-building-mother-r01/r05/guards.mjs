/**
 * Original, bounded design-only guard / handrail trial in metres.
 * Posts meet real tread, landing and retained-slab tops. Contact is geometry,
 * not an anchor design, structural certification, or an approved escape route.
 * No baluster-gap, climbability, impact, load or legal standard is certified.
 */
export const GUARD_SCHEMA = 'kaopu.hosted-stair-guards-proposal/0.1';
const EPS = 1e-7;
const copy = x => structuredClone(x);
const keyPoint = p => p.map(v => Number(v).toFixed(6)).join(',');
const len = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const interpolate = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);

export function defaultGuardConfig() {
  return {enabled: true, visible: true, height: 1, postRadius: 0.025,
    topRailRadius: 0.025, edgeClearance: 0.01, maximumPostSpacing: 0.7,
    handrailsEnabled: true, handrailHeight: 0.85, handrailRadius: 0.018};
}
function normalize(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw Error('Guard config must be an object');
  const defaults = defaultGuardConfig();
  for (const k of Object.keys(config)) if (!(k in defaults)) throw Error(`Unknown guard parameter: ${k}`);
  const c = {...defaults, ...copy(config)};
  for (const k of ['enabled', 'visible', 'handrailsEnabled']) if (typeof c[k] !== 'boolean') throw Error(`guards.${k} must be boolean`);
  const bounds = {height: [0.6, 1.4], postRadius: [0.015, 0.05], topRailRadius: [0.015, 0.05],
    edgeClearance: [0.005, 0.06], maximumPostSpacing: [0.2, 1.2], handrailHeight: [0.45, 1.25], handrailRadius: [0.012, 0.04]};
  for (const [k, [min, max]] of Object.entries(bounds)) if (!Number.isFinite(c[k]) || c[k] < min || c[k] > max) {
    throw Error(`guards.${k} must be ${min}–${max} m (authored trial bounds, not a code rule)`);
  }
  if (c.handrailHeight + c.handrailRadius >= c.height - c.topRailRadius) throw Error('Separate handrail must fit below the guard top rail');
  return c;
}
function stairStates(derived) {
  // Canonical circulation shape is stairs; aliases keep pure planning useful
  // with explicitly constructed tests, without changing any legacy stair code.
  const source = derived?.stairs ?? derived?.stairStates ?? derived?.pairs;
  if (!Array.isArray(source) || source.length !== 2) throw Error('Bounded three-floor circulation with exactly two stair pairs is required');
  const stairs = source.map(p => p.state ?? p.stair ?? p.derived ?? p);
  if (stairs.some(s => !s?.schema?.startsWith('kaopu.hosted-dogleg-stair-proposal/') || !Array.isArray(s.flights))) {
    throw Error('Actual derived r04 solid stair states are required');
  }
  if (stairs[0].lowerFloorId !== 'floor-001' || stairs[0].upperFloorId !== 'floor-002'
    || stairs[1].lowerFloorId !== 'floor-002' || stairs[1].upperFloorId !== 'floor-003') {
    throw Error('Guard trial is bounded to floor-001 → floor-002 → floor-003');
  }
  return stairs;
}
function point(s, run, lateral, h) {
  const [o, u, v] = [s.basis.originEastNorth, s.basis.runEastNorth, s.basis.lateralEastNorth];
  return [o[0] + run * u[0] + lateral * v[0], h, -(o[1] + run * u[1] + lateral * v[1])];
}
function hostFloor(derived, floorId, fallback) {
  const state = derived.floorState ?? derived.floors ?? derived.floorDerived;
  const record = state?.floors?.find(f => f.floorId === floorId);
  return record ? record.effectiveEnabled !== false && state.enabled !== false : fallback;
}

/** Derive honest geometry/host records, never infer physical interior evidence. */
export function deriveGuardProposal(circulationDerived, config = {}) {
  const c = normalize(config), stairs = stairStates(circulationDerived), inset = Math.max(c.postRadius, c.topRailRadius, c.handrailRadius) + c.edgeClearance;
  const runs = [], posts = [], beams = [], postMap = new Map(), beamMap = new Map();
  const supportInterfaces = [], boundaryExclusions = [], clearWidths = [];
  const makeSupport = (s, run, lateral, height, hostId, kind, floorIds, flightId = null) => ({
    positionLocalEastUpSouth: point(s, run, lateral, height), runM: run, lateralM: lateral,
    elevationM: height, hostGeometryId: hostId, supportKind: kind, hostFloorIds: floorIds,
    hostedFlightId: flightId, contact: 'post_base_on_actual_top_face', structuralConnectionVerified: false,
    anchorageModeled: false,
  });
  function addRun(s, id, kind, supports, floorIds, enabled, visible, options = {}) {
    if (supports.length < 2) return;
    const run = {railRunId: id, stairId: s.stairId, kind, hostFloorIds: floorIds,
      hostedFlightId: options.flightId ?? null, effectiveEnabled: !!(c.enabled && enabled),
      effectiveVisible: !!(c.enabled && c.visible && enabled && visible),
      supportIds: [], topRailIds: [], handrailIds: [], hazardBoundary: options.boundary ?? kind};
    const upHeight = c.height - c.topRailRadius;
    for (const support of supports) {
      const base = support.positionLocalEastUpSouth, pk = keyPoint(base);
      let post = postMap.get(pk);
      if (!post) {
        post = {solidId: `guard-post-${posts.length + 1}`, role: 'guard-support-post', start: base,
          end: [base[0], base[1] + upHeight, base[2]], radius: c.postRadius,
          support, railRunIds: [], hostFloorIds: [], effectiveEnabled: false, effectiveVisible: false};
        postMap.set(pk, post); posts.push(post);
        supportInterfaces.push({supportId: post.solidId, ...copy(support)});
      }
      post.railRunIds.push(id); post.hostFloorIds = [...new Set([...post.hostFloorIds, ...floorIds])];
      post.effectiveEnabled ||= run.effectiveEnabled; post.effectiveVisible ||= run.effectiveVisible;
      run.supportIds.push(post.solidId);
    }
    const addBeam = (a, b, role, radius, height, target) => {
      const start = [a[0], a[1] + height, a[2]], end = [b[0], b[1] + height, b[2]];
      if (len(start, end) < EPS) return;
      const bk = `${role}:${[keyPoint(start), keyPoint(end)].sort().join('|')}`;
      let beam = beamMap.get(bk);
      if (!beam) {
        beam = {solidId: `guard-beam-${beams.length + 1}`, role, start, end, radius,
          railRunIds: [], hostFloorIds: [], effectiveEnabled: false, effectiveVisible: false,
          expectedJointContact: 'rail endpoints meet support posts; these assembly joints are intentional'};
        beamMap.set(bk, beam); beams.push(beam);
      }
      beam.railRunIds.push(id); beam.hostFloorIds = [...new Set([...beam.hostFloorIds, ...floorIds])];
      beam.effectiveEnabled ||= run.effectiveEnabled; beam.effectiveVisible ||= run.effectiveVisible;
      target.push(beam.solidId);
    };
    for (let i = 1; i < supports.length; i++) {
      const a = supports[i - 1].positionLocalEastUpSouth, b = supports[i].positionLocalEastUpSouth;
      addBeam(a, b, 'guard-toprail', c.topRailRadius, upHeight, run.topRailIds);
      if (c.handrailsEnabled && kind === 'flight-edge') addBeam(a, b, 'graspable-handrail-proposal', c.handrailRadius, c.handrailHeight, run.handrailIds);
    }
    runs.push(run);
  }
  function surfaceRun(s, id, kind, a, b, elevation, hostId, floorIds, enabled, visible, options = {}) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(length / c.maximumPostSpacing));
    const supports = Array.from({length: n + 1}, (_, i) => {
      const q = interpolate(a, b, i / n);
      return makeSupport(s, ...q, elevation, hostId, kind === 'landing-edge' ? 'mid-landing-top' : 'retained-slab-top', floorIds);
    });
    addRun(s, id, kind, supports, floorIds, enabled, visible, options);
  }
  for (const s of stairs) {
    if (2 * (inset + c.postRadius) >= s.config.flightWidth) throw Error('Guard offsets leave no physical flight passage width');
    const floorIds = [s.lowerFloorId, s.upperFloorId], L = s.config.landingDepth, R = s.dimensions.runLength;
    const H = s.dimensions.width / 2, back = s.dimensions.totalLength, midS = L + R;
    for (const f of s.flights) {
      const inner = [f.lateral[0] + inset, f.lateral[1] - inset];
      for (let side = 0; side < 2; side++) {
        const t = inner[side];
        const startS = f.sStart - f.direction * inset, endS = f.sStart + f.direction * (R + inset);
        const departureHost = f.direction === 1 ? s.lowerSlabId : s.midLanding.landingId;
        const arrivalHost = f.direction === 1 ? s.midLanding.landingId : s.upperSlabId;
        const supports = [makeSupport(s, startS, t, f.startFFL, departureHost,
          f.direction === 1 ? 'retained-slab-top' : 'mid-landing-top', floorIds, f.flightId)];
        for (const tread of f.treads) supports.push(makeSupport(s,
          f.sStart + f.direction * (tread.index - 0.5) * s.config.treadDepth,
          t, tread.elevationM, f.flightId, 'actual-tread-top', floorIds, f.flightId));
        supports.push(makeSupport(s, endS, t, f.endFFL, arrivalHost,
          f.direction === 1 ? 'mid-landing-top' : 'retained-slab-top', floorIds, f.flightId));
        addRun(s, `${f.flightId}:guard:${side ? 'right' : 'left'}`, 'flight-edge', supports,
          floorIds, s.effectiveEnabled, s.effectiveVisible, {flightId: f.flightId, boundary: 'actual tread side edge inset onto tread support'});
      }
      clearWidths.push({flightId: f.flightId, nominalWidthM: s.config.flightWidth,
        postCenterInsetM: inset, maximumIntrusionEachSideM: inset + Math.max(c.postRadius, c.topRailRadius, c.handrailRadius),
        actualClearWidthM: s.config.flightWidth - 2 * (inset + Math.max(c.postRadius, c.topRailRadius, c.handrailRadius)),
        basis: 'between actual guard solids after inward support offsets, not a certified egress width'});
    }
    for (const [label, a, b] of [
      ['left', [midS + inset, -H + inset], [back - inset, -H + inset]],
      ['back', [back - inset, -H + inset], [back - inset, H - inset]],
      ['right', [back - inset, H - inset], [midS + inset, H - inset]],
    ]) surfaceRun(s, `${s.midLanding.landingId}:guard:${label}`, 'landing-edge', a, b,
      s.midFFLM, s.midLanding.landingId, floorIds, s.effectiveEnabled, s.effectiveVisible,
      {boundary: 'actual mid-landing perimeter, no bar across front turning connection'});
    boundaryExclusions.push({stairId: s.stairId, kind: 'mid-landing-transfer', runRangeM: [midS + inset + c.postRadius, back - inset - c.postRadius],
      lateralRangeM: [-H + inset + c.postRadius, H - inset - c.postRadius], reason: 'inner flight rails stop at landing front; turning path is not cross-barred'});
  }
  for (const s of stairs) {
    const floorId = s.upperFloorId, enabled = s.effectiveEnabled && hostFloor(circulationDerived, floorId, s.effectiveEnabled);
    const visible = enabled && s.effectiveVisible && circulationDerived.effectiveVisible !== false;
    const L = s.config.landingDepth, H = s.dimensions.width / 2, B = s.dimensions.totalLength;
    const floorIds = [floorId], h = s.upperFFLM;
    for (const [label, a, b] of [
      ['left', [L - inset, -H - inset], [B + inset, -H - inset]],
      ['back', [B + inset, -H - inset], [B + inset, H + inset]],
      ['right', [B + inset, H + inset], [L - inset, H + inset]],
    ]) surfaceRun(s, `${floorId}:opening-guard:${label}`, 'floor-opening-edge', a, b,
      h, s.upperSlabId, floorIds, enabled, visible, {boundary: 'actual opening side/back offset outward onto retained slab, distinct from inset flight guards'});
    // The arrival mouth is always right. A departure mouth exists on the left
    // only on the shared floor. Guard the residual edge, never either mouth.
    const next = stairs.find(p => p.lowerFloorId === floorId && p.effectiveEnabled), gap = s.config.centerGap / 2;
    const a = next ? [L - inset, -gap - inset] : [L - inset, -H - inset];
    const b = [L - inset, gap + inset];
    surfaceRun(s, `${floorId}:opening-guard:residual-front`, 'floor-opening-edge', a, b,
      h, s.upperSlabId, floorIds, enabled, visible, {boundary: next ? 'center gap only between distinct departure and arrival mouths' : 'unused left opening edge and center gap; right arrival stays open'});
    boundaryExclusions.push({floorId, kind: 'retained-floor-transfer', runRangeM: [0, L - inset - c.postRadius],
      lateralRangeM: [-H, H], reason: 'no rail across shared floor connector or the proposed s=0 door aperture'});
    boundaryExclusions.push({floorId, kind: 'stair-mouths', mouths: [
      {role: 'arrival', lateralRangeM: s.flights[1].lateral},
      ...(next ? [{role: 'departure', lateralRangeM: next.flights[0].lateral}] : []),
    ], runM: L, reason: 'no guard bar crosses an actual stair mouth'});
  }
  return {schema: GUARD_SCHEMA, config: c, enabled: c.enabled, visible: c.visible,
    effectiveEnabled: runs.some(r => r.effectiveEnabled), effectiveVisible: runs.some(r => r.effectiveVisible),
    evidence: 'original_authored_guard_and_handrail_design_not_measured', interiorEvidence: 'unknown',
    structuralSupportVerified: false, buildingComplianceVerified: false, guardInfillCertified: false,
    guardBalusterGapCertified: false, climbabilityCertified: false, impactResistanceCertified: false,
    handrailGraspabilityCertified: false, evacuationPermitted: false, circulationComplete: false,
    units: 'metres', railRuns: runs, posts, beams, solids: [...posts, ...beams], supportInterfaces,
    clearWidths, boundaryExclusions, summary: {railRunCount: runs.length, postCount: posts.length, topRailCount: beams.filter(b => b.role === 'guard-toprail').length, handrailCount: beams.filter(b => b.role === 'graspable-handrail-proposal').length, supportContactCount: supportInterfaces.length, minimumActualPassageWidthM: Math.min(...clearWidths.map(w => w.actualClearWidthM))}, expectedJoints: 'Shared post/endpoints are deduplicated. Post/rail assembly contacts are intentional; walking-solid volume penetration is not.',
    warning: 'Design-only guard and separate handrail semantics. No surveyed position, anchor design, baluster-gap, climbability, impact, load, legal safety or complete evacuation claim.'};
}

function tubeGeometry(THREE, a, b, radius) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), axis = end.clone().sub(start), length = axis.length();
  if (!(length > EPS)) throw Error('Guard solid must have a nonzero axis');
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12, 1, false);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()));
  geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const volume = 12 * Math.sin(2 * Math.PI / 12) * radius * radius * length / 2;
  geometry.userData = {closedSolid: true, solidVolumeCubicMetres: volume, tubeAxis: [copy(a), copy(b)], radiusM: radius};
  return geometry;
}

/** Build original closed, capped tubes. Placement is inherited exactly once. */
export function buildGuards(THREE, derived) {
  if (derived?.schema !== GUARD_SCHEMA) throw Error('deriveGuardProposal output required');
  if (!THREE?.CylinderGeometry) throw Error('Three.js runtime required');
  const group = new THREE.Group(); group.name = 'r05-stair-guards'; group.visible = derived.effectiveVisible;
  const material = new THREE.MeshStandardMaterial({color: '#4f757f', metalness: 0.45, roughness: 0.45});
  const handrailMaterial = new THREE.MeshStandardMaterial({color: '#c88b57', metalness: 0.15, roughness: 0.55});
  for (const solid of derived.solids) {
    const mesh = new THREE.Mesh(tubeGeometry(THREE, solid.start, solid.end, solid.radius),
      solid.role === 'graspable-handrail-proposal' ? handrailMaterial : material);
    mesh.name = solid.solidId; mesh.visible = solid.effectiveVisible;
    mesh.userData = {role: solid.role, solidId: solid.solidId, railRunIds: copy(solid.railRunIds),
      hostFloorIds: copy(solid.hostFloorIds), effectiveEnabled: solid.effectiveEnabled,
      support: solid.support ? copy(solid.support) : null, geometryEvidence: 'original_closed_capped_tube', structuralSupportVerified: false};
    group.add(mesh);
  }
  group.userData = {schema: GUARD_SCHEMA, state: copy(derived)};
  group.updateMatrixWorld(true); return group;
}

export function inspectGuards(derived, group = null) {
  if (derived?.schema !== GUARD_SCHEMA) throw Error('Derived guards required');
  const state = copy(derived);
  if (group) {
    if (group.userData?.schema !== GUARD_SCHEMA) throw Error('Not an authored guard group');
    group.updateWorldMatrix(true, true);
    state.geometryAudit = group.userData.geometryAudit ? copy(group.userData.geometryAudit) : {actualMeshesChecked: false, valid: null};
    const visible = object => {for (let p = object; p; p = p.parent) if (!p.visible) return false; return true;};
    state.scene = {effectiveVisible: visible(group), solids: group.children.map(m => ({
      id: m.name, role: m.userData.role, effectiveVisible: visible(m),
      closedSolid: m.geometry.userData.closedSolid, solidVolumeCubicMetres: m.geometry.userData.solidVolumeCubicMetres,
      matrixWorld: Array.from(m.matrixWorld.elements), triangles: m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3,
    }))};
  }
  return state;
}

/**
 * Audit real triangles, not symbolic edge boxes. Clip every walking-solid face
 * into each convex capped guard tube, eroding the tube by contactToleranceM so
 * support-touching faces are permitted. Also check full containment with an
 * actual triangle ray. This is geometric collision QA, not structural design.
 */
export function auditGuardGeometry(THREE, derived, group, walkingRoots, {contactToleranceM = 1e-4, reject = true} = {}) {
  if (derived?.schema !== GUARD_SCHEMA || group?.userData?.schema !== GUARD_SCHEMA) throw Error('Derived and built guard geometry required');
  if (!Array.isArray(walkingRoots) || !walkingRoots.length) throw Error('Actual walking solid meshes are required');
  if (!Number.isFinite(contactToleranceM) || contactToleranceM < 1e-5 || contactToleranceM > 0.001) throw Error('Contact tolerance must be 0.00001–0.001 m');
  group.updateWorldMatrix(true, true);
  const walking = [], seen = new Set();
  for (const root of walkingRoots) {
    root.updateWorldMatrix(true, true);
    root.traverse(m => {
      if (!m.isMesh || !m.geometry || seen.has(m.uuid)) return;
      for (let p = m; p; p = p.parent) if (p.userData?.effectiveEnabled === false || p.userData?.state?.effectiveEnabled === false) return;
      seen.add(m.uuid); walking.push(m);
    });
  }
  const vertex = (mesh, i) => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld);
  const triangles = mesh => {
    const pos = mesh.geometry.attributes.position, idx = mesh.geometry.index, result = [];
    for (let i = 0; i < (idx ? idx.count : pos.count); i += 3) result.push([0, 1, 2].map(j => vertex(mesh, idx ? idx.getX(i + j) : i + j)));
    return result;
  };
  const walkingData = walking.map(mesh => ({mesh, triangles: triangles(mesh), bounds: new THREE.Box3().setFromObject(mesh)}));
  const supports = [], collisions = [], boundaryCache = new Map();
  const up = new THREE.Vector3(0, 1, 0).transformDirection(group.matrixWorld);
  const groupInverse = group.matrixWorld.clone().invert();
  const rayStartAboveBaseM = 0.0005, rayMaximumDistanceM = 0.001;
  function surfaceBoundary(host, elevation) {
    const cacheKey = `${host.uuid}:${elevation.toFixed(5)}`;
    if (boundaryCache.has(cacheKey)) return boundaryCache.get(cacheKey);
    const edges = new Map(), data = walkingData.find(d => d.mesh === host);
    for (const tri of data.triangles) {
      const normal = new THREE.Triangle(...tri).getNormal(new THREE.Vector3());
      if (normal.dot(up) < 0.999999 || tri.some(p => Math.abs(p.dot(up) - elevation) > 2e-5)) continue;
      for (let i = 0; i < 3; i++) {
        const a = tri[i], b = tri[(i + 1) % 3], key = [keyPoint(a.toArray()), keyPoint(b.toArray())].sort().join('|');
        const record = edges.get(key) ?? {a, b, count: 0}; record.count++; edges.set(key, record);
      }
    }
    // Internal triangulation diagonals occur twice. Only actual surface/hole
    // perimeter edges occur once, including individual tread/riser boundaries.
    const boundary = [...edges.values()].filter(edge => edge.count === 1);
    boundaryCache.set(cacheKey, boundary); return boundary;
  }
  for (const post of derived.posts.filter(p => p.effectiveEnabled)) {
    const mesh = group.getObjectByName(post.solidId), host = walking.find(m => m.name === post.support.hostGeometryId);
    if (!host) {supports.push({supportId: post.solidId, hostGeometryId: post.support.hostGeometryId,
      supported: false, reason: 'actual named support host mesh absent'}); continue;}
    const expectedBase = new THREE.Vector3(...post.start).applyMatrix4(group.matrixWorld);
    const position = mesh.geometry.attributes.position, unique = new Map();
    const vertices = Array.from({length: position.count}, (_, i) => vertex(mesh, i));
    const actualBottomPlane = Math.min(...vertices.map(p => p.dot(up)));
    for (const p of vertices) if (Math.abs(p.dot(up) - actualBottomPlane) < 2e-6) unique.set(keyPoint(p.toArray()), p);
    const cap = [...unique.values()], base = cap.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / cap.length);
    const samples = [base, ...cap], normalMatrix = new THREE.Matrix3().getNormalMatrix(host.matrixWorld);
    const geometryBaseErrorM = expectedBase.distanceTo(base);
    let supported = cap.length >= 4 && geometryBaseErrorM <= contactToleranceM, maxErrorM = 0, minimumNormalDot = 1;
    let minimumHitElevationM = Infinity, maximumHitElevationM = -Infinity;
    for (const p of samples) {
      // Exactly the declared host, never the complete scene or a lower fallback.
      // A 1 mm ray cannot catch a lower tread/slab and pass as intended support.
      const hit = new THREE.Raycaster(p.clone().addScaledVector(up, rayStartAboveBaseM), up.clone().negate(),
        0, rayMaximumDistanceM).intersectObject(host, false)[0];
      const error = hit ? hit.point.distanceTo(p) : Infinity;
      const normalDot = hit ? hit.face.normal.clone().applyNormalMatrix(normalMatrix).dot(up) : -1;
      maxErrorM = Math.max(maxErrorM, error); minimumNormalDot = Math.min(minimumNormalDot, normalDot);
      if (!hit || hit.object !== host || error > contactToleranceM || normalDot < 0.999999) supported = false;
      if (hit) {const h = hit.point.clone().applyMatrix4(groupInverse).y;
        minimumHitElevationM = Math.min(minimumHitElevationM, h); maximumHitElevationM = Math.max(maximumHitElevationM, h);}
    }
    const boundary = surfaceBoundary(host, expectedBase.dot(up));
    const centerBoundaryDistanceM = boundary.length ? Math.min(...boundary.map(edge =>
      new THREE.Line3(edge.a, edge.b).closestPointToPoint(base, true, new THREE.Vector3()).distanceTo(base))) : null;
    // Use the complete circular cap radius, not the smaller projected 12-sided
    // polygon width. This leaves a conservative retained-support margin.
    const fullCapRadiusM = Math.max(post.radius * mesh.matrixWorld.getMaxScaleOnAxis(), ...cap.map(p => p.distanceTo(base)));
    const retainedMarginM = centerBoundaryDistanceM === null ? null : centerBoundaryDistanceM - fullCapRadiusM;
    if (retainedMarginM === null || retainedMarginM < -contactToleranceM) supported = false;
    supports.push({supportId: post.solidId, hostGeometryId: host.name, supportKind: post.support.supportKind,
      expectedBaseLocalEastUpSouth: copy(post.start), actualBaseLocalEastUpSouth: base.clone().applyMatrix4(groupInverse).toArray(),
      supported, sampleCount: samples.length, maximumContactErrorM: Number.isFinite(maxErrorM) ? maxErrorM : null,
      geometryBaseErrorM, minimumHostTopNormalDot: minimumNormalDot,
      actualHostHitElevationRangeM: Number.isFinite(minimumHitElevationM) ? [minimumHitElevationM, maximumHitElevationM] : null,
      surfaceBoundaryEdgeCount: boundary.length, fullCapRadiusM, centerBoundaryDistanceM, retainedMarginM,
      boundaryBasis: 'actual_named_host_upward_coplanar_mesh_triangle_perimeter_excluding_internal_diagonals'});
  }
  let triangleTests = 0, broadPhasePairs = 0;
  const insideClosedMesh = (point, tris) => {
    const ray = new THREE.Ray(point, new THREE.Vector3(0.912817, 0.203117, 0.354971).normalize()), hits = [];
    for (const t of tris) {
      const p = ray.intersectTriangle(...t, false, new THREE.Vector3());
      if (p) {const d = p.distanceTo(point); if (d > contactToleranceM && !hits.some(n => Math.abs(n - d) < contactToleranceM)) hits.push(d);}
    }
    return hits.length % 2 === 1;
  };
  for (const guard of group.children.filter(m => m.userData.effectiveEnabled)) {
    const bounds = new THREE.Box3().setFromObject(guard), tris = triangles(guard), center = bounds.getCenter(new THREE.Vector3());
    const planes = [], keys = new Set();
    for (const t of tris) {
      const plane = new THREE.Plane().setFromCoplanarPoints(...t);
      if (plane.normal.lengthSq() < 0.5) continue;
      if (plane.distanceToPoint(center) > 0) plane.negate();
      const key = [...plane.normal.toArray(), plane.constant].map(n => n.toFixed(5)).join(',');
      if (!keys.has(key)) {keys.add(key); planes.push(plane);}
    }
    for (const obstacle of walkingData) {
      if (!bounds.intersectsBox(obstacle.bounds)) continue;
      broadPhasePairs++;
      let overlap = false;
      for (const tri of obstacle.triangles) {
        triangleTests++; let polygon = tri.map(p => p.clone());
        for (const plane of planes) {
          const next = [];
          for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const da = plane.distanceToPoint(a) + contactToleranceM, db = plane.distanceToPoint(b) + contactToleranceM;
            if (da <= 0) next.push(a);
            if ((da < 0) !== (db < 0)) next.push(a.clone().lerp(b, da / (da - db)));
          }
          polygon = next; if (!polygon.length) break;
        }
        if (polygon.length >= 3) {overlap = true; break;}
      }
      if (!overlap && obstacle.bounds.containsPoint(center)) overlap = insideClosedMesh(center, obstacle.triangles);
      if (overlap) collisions.push({guardId: guard.name, walkingSolidId: obstacle.mesh.name});
    }
  }
  const unsupported = supports.filter(p => !p.supported);
  const result = {valid: !unsupported.length && !collisions.length, actualMeshesChecked: true,
    supportContactCount: supports.length, supportSampleCount: supports.reduce((n, p) => n + (p.sampleCount ?? 0), 0),
    supportContacts: supports, unsupported, collisions, triangleTests, broadPhasePairs, contactToleranceM,
    rayStartAboveBaseM, rayMaximumDistanceM, intendedNamedHostOnly: true,
    minimumRetainedMarginM: supports.length && supports.every(p => p.retainedMarginM != null) ? Math.min(...supports.map(p => p.retainedMarginM)) : null,
    minimumHostTopNormalDot: supports.length ? Math.min(...supports.map(p => p.minimumHostTopNormalDot ?? -1)) : null,
    basis: 'actual_guard_convex_triangle_planes_vs_actual_walking_triangles_plus_full_post_base_support_rays',
    structuralCertification: false, intendedPostRailAssemblyJointsExcluded: true};
  if (reject && !result.valid) throw Error(`Guard geometry rejected: ${unsupported.length} unsupported bases, ${collisions.length} unintended walking-solid overlaps`);
  group.userData.geometryAudit = copy(result); return result;
}
