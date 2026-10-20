/**
 * Original bounded hosted-window design experiment.
 * The host boundary is measured; every window dimension, material and motion
 * below is an authored prototype, NOT a survey of this building's windows.
 * No FreeCAD or IfcOpenShell implementation code is copied.
 */
import {validateScore} from '../hk-three-buildings-r01/geometry/reconstruct.mjs';

export const WINDOW_SCHEMA = 'kaopu.hosted-casement-prototype/0.1';
const HOST_MARGIN = 0.15;
const FIT_GAP = 0.012;
const SWEEP_PADDING = 0.02;
const clone = value => structuredClone(value);
const finite = (value, name) => {
  if (!Number.isFinite(value)) throw Error(`${name} must be finite`);
  return value;
};

export function defaultWindowConfig() {
  return {
    enabled: false,
    hostPatchId: 'p003',
    type: 'casement-outward-oneleaf',
    width: 0.68,
    height: 1.2,
    sill: 1,
    centerAlongWall: null,
    frameWidth: 0.08,
    frameDepth: 0.16,
    glassColor: '#78b8c8',
    glassTransmission: 0.82,
    glassRoughness: 0.08,
    angleDegrees: 0,
    showClearance: false,
  };
}

function normalizedConfig(config) {
  if (config == null) config = {};
  if (typeof config !== 'object' || Array.isArray(config)) throw Error('Window config must be an object');
  const c = {...defaultWindowConfig(), ...config};
  for (const key of ['enabled', 'showClearance']) {
    if (typeof c[key] !== 'boolean') throw Error(`${key} must be boolean`);
  }
  if (typeof c.hostPatchId !== 'string' || !c.hostPatchId) throw Error('hostPatchId is required');
  if (c.type !== 'casement-outward-oneleaf') throw Error('Only the bounded outward single-leaf casement is supported');
  for (const key of ['width', 'height', 'sill', 'frameWidth', 'frameDepth', 'angleDegrees', 'glassTransmission', 'glassRoughness']) finite(c[key], key);
  for (const key of ['glassTransmission', 'glassRoughness']) {
    if (c[key] < 0 || c[key] > 1) throw Error(`${key} must be 0–1`);
  }
  if (c.centerAlongWall !== null) finite(c.centerAlongWall, 'centerAlongWall');
  if (c.width <= 0 || c.height <= 0) throw Error('Window width and height must be positive');
  // Bounded single-leaf prototype guide, not code-compliance certification.
  // Source context: https://www.bd.gov.hk/doc/en/resources/codes-and-references/practice-notes-and-circular-letters/pnap/signed/APP116se.pdf
  // Limiting the whole opening to 0.70 m also keeps the smaller sash below it.
  if (c.width > 0.7) throw Error('Single-leaf prototype width must not exceed 0.70 m; wider windows need independently designed multiple leaves');
  if (c.frameWidth < 0.02 || c.frameWidth > 0.3) throw Error('frameWidth must be 0.02–0.30 m');
  if (c.frameDepth < 0.04 || c.frameDepth > 0.5) throw Error('frameDepth must be 0.04–0.50 m');
  if (c.angleDegrees < 0 || c.angleDegrees > 80) throw Error('angleDegrees must be 0–80');
  if (Number.isInteger(c.glassColor) && c.glassColor >= 0 && c.glassColor <= 0xffffff) {
    c.glassColor = `#${c.glassColor.toString(16).padStart(6, '0')}`;
  }
  if (typeof c.glassColor !== 'string' || !/^#[0-9a-f]{6}$/i.test(c.glassColor)) {
    throw Error('glassColor must be a six-digit #RRGGBB tint');
  }
  c.glassColor = c.glassColor.toLowerCase();
  return c;
}

function sourceStrip(op) {
  if (op?.kind === 'wallStrip') return op;
  if (op?.kind === 'wallProfile' && op.authoredHostedOpening?.schema === WINDOW_SCHEMA) {
    return op.authoredHostedOpening.sourceWallStrip;
  }
  throw Error('Window host must be a measured wallStrip or this module’s own hosted wallProfile');
}

function extrema(a, b, angle) {
  // Exact extrema of a*cos(t) + b*sin(t), for 0 <= t <= angle.
  const values = [a, a * Math.cos(angle) + b * Math.sin(angle)];
  const stationary = Math.atan2(b, a);
  for (let k = -2; k <= 2; k++) {
    const t = stationary + k * Math.PI;
    if (t > 0 && t < angle) values.push(a * Math.cos(t) + b * Math.sin(t));
  }
  return [Math.min(...values), Math.max(...values)];
}

function sweepEnvelope(dimensions, angleDegrees) {
  const {leafWidth: w, leafHeight: h, sashDepth: d, pivotLocal: pivot} = dimensions;
  const angle = angleDegrees * Math.PI / 180;
  const min = [Infinity, 0, Infinity], max = [-Infinity, h, -Infinity];
  for (const x of [0, w]) for (const z of [-d / 2, d / 2]) {
    const [xmin, xmax] = extrema(x, -z, angle);
    const [zmin, zmax] = extrema(z, x, angle);
    min[0] = Math.min(min[0], xmin); max[0] = Math.max(max[0], xmax);
    min[2] = Math.min(min[2], zmin); max[2] = Math.max(max[2], zmax);
  }
  return {
    label: 'Conservative sash sweep AABB, 0° to selected angle, in host-local basis; not a collision or building-compliance result',
    kind: 'conservative-sash-sweep-aabb',
    fromDegrees: 0,
    toDegrees: angleDegrees,
    paddingMetres: SWEEP_PADDING,
    min: min.map((v, i) => v + pivot[i] - SWEEP_PADDING),
    max: max.map((v, i) => v + pivot[i] + SWEEP_PADDING),
    collisionVerified: false,
    buildingComplianceVerified: false,
  };
}

/** Returns plain validated, derived state. Invalid inputs throw, even if hidden. */
export function validateWindow(score, config = {}) {
  validateScore(score);
  const c = normalizedConfig(config);
  for (const axis of ['scaleEast', 'scaleNorth', 'scaleHeight']) {
    if ((score.edits?.[axis] ?? 1) !== 1) {
      throw Error('Hosted-window trial requires undeformed metre-scale host axes; non-unit score scale is unsupported');
    }
  }
  const selected = score.reconstruction.operations.find(op => op.id === c.hostPatchId);
  if (!selected) throw Error(`Missing window host ${c.hostPatchId}`);
  const host = sourceStrip(selected);
  if (!host || host.kind !== 'wallStrip' || host.id !== c.hostPatchId) throw Error('Invalid source host provenance');
  const [a, b] = host.edge;
  const dx = b[0] - a[0], dn = b[1] - a[1], length = Math.hypot(dx, dn);
  if (length < 1e-9) throw Error('Degenerate window host');
  const tangent = [dx / length, dn / length];
  const center = c.centerAlongWall === null ? length / 2 : c.centerAlongWall;
  const left = center - c.width / 2, right = center + c.width / 2;
  const bottom = host.bottom + c.sill, top = bottom + c.height;
  if (left < HOST_MARGIN - 1e-9 || right > length - HOST_MARGIN + 1e-9) {
    throw Error('Window opening exceeds host width or authored 0.15 m edge margin');
  }
  if (bottom < host.bottom + HOST_MARGIN - 1e-9 || top > host.top - HOST_MARGIN + 1e-9) {
    throw Error('Window opening exceeds host height or authored 0.15 m vertical margin');
  }
  const sashWidth = Math.min(c.frameWidth * 0.65, 0.045);
  const sashDepth = Math.min(c.frameDepth * 0.4, 0.055);
  const leafWidth = c.width - 2 * c.frameWidth - 2 * FIT_GAP;
  const leafHeight = c.height - 2 * c.frameWidth - 2 * FIT_GAP;
  if (Math.min(leafWidth, leafHeight) <= 2 * sashWidth + 0.04) {
    throw Error('Window dimensions leave insufficient room for frame, sash and glass');
  }
  // Surface-mounted outward hinge keeps the authored sash outside the fixed
  // frame front plane. This is a modeling choice, not measured hardware.
  const dimensions = {
    openingWidth: c.width, openingHeight: c.height,
    frameWidth: c.frameWidth, frameDepth: c.frameDepth,
    leafWidth, leafHeight, sashWidth, sashDepth,
    glassWidth: leafWidth - 2 * sashWidth,
    glassHeight: leafHeight - 2 * sashWidth,
    glassThickness: Math.min(0.008, sashDepth * 0.25),
    fittingGap: FIT_GAP,
    pivotLocal: [-c.width / 2 + c.frameWidth + FIT_GAP,
      c.frameWidth + FIT_GAP, c.frameDepth / 2 + sashDepth / 2 + 0.004],
  };
  const originDisplay = [
    a[0] + tangent[0] * center,
    bottom,
    -(a[1] + tangent[1] * center),
  ];
  const state = {
    valid: true, schema: WINDOW_SCHEMA, enabled: c.enabled, config: c,
    evidence: 'authored_design_prototype_on_observed_derived_wall_boundary',
    measuredWindowDimensions: false,
    authoredPolicy: {
      maximumSingleLeafOpeningWidthMetres: 0.7,
      certification: false,
      hingeModel: 'simple single-axis pivot, not four-bar hardware physics',
      buildingUse: 'unknown',
      grilleInferredOrAdded: false,
      glassModel: 'visual optical preset, not measured spectral or safety-glazing data',
    },
    host: {id: host.id, kind: 'wallStrip', length, bottom: host.bottom, top: host.top,
      edge: clone(host.edge), marginMetres: HOST_MARGIN},
    aperture: {left, right, bottom, top, areaSquareMetres: c.width * c.height},
    basis: {
      coordinates: 'renderer east/up/south; local x = wall tangent, y = up, z = outward',
      originDisplay,
      x: [tangent[0], 0, -tangent[1]],
      y: [0, 1, 0],
      z: [tangent[1], 0, tangent[0]],
    },
    dimensions,
    collisionStatus: 'not_verified',
    collisionReason: 'Measured host is a zero-thickness surface; selected-angle collisions, neighboring geometry, hardware and regulatory clearances are not verified',
  };
  state.clearance = sweepEnvelope(dimensions, c.angleDegrees);
  return state;
}

/** Converts only the chosen wall to a polygon with a genuine interior loop. */
export function cutHostedWindow(score, config = {}) {
  const state = validateWindow(score, config), result = clone(score);
  const index = result.reconstruction.operations.findIndex(op => op.id === state.host.id);
  const prior = result.reconstruction.operations[index];
  const strip = clone(sourceStrip(prior));
  const featureId = `prototype-window:${state.host.id}`;
  result.authoredFeatures = (result.authoredFeatures ?? []).filter(f => f.id !== featureId);
  if (!state.enabled) {
    if (prior.authoredHostedOpening?.schema === WINDOW_SCHEMA) result.reconstruction.operations[index] = strip;
    // A disabled uncut source stays byte-for-byte equivalent in content.
    if (!result.authoredFeatures.length && !('authoredFeatures' in score)) delete result.authoredFeatures;
    return result;
  }
  const {left, right, bottom, top} = state.aperture;
  const [a, b] = strip.edge, length = state.host.length;
  const profile = {
    ...strip,
    kind: 'wallProfile',
    origin: a.slice(),
    tangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
    horizontalDriftPerHeight: [0, 0],
    loops: [
      [[0, strip.bottom], [length, strip.bottom], [length, strip.top], [0, strip.top]],
      [[left, bottom], [left, top], [right, top], [right, bottom]],
    ],
    authoredHostedOpening: {
      schema: WINDOW_SCHEMA,
      sourceWallStrip: strip,
      featureId,
      dimensionsMeasured: false,
      config: clone(state.config),
    },
  };
  delete profile.edge; delete profile.bottom; delete profile.top;
  result.reconstruction.operations[index] = profile;
  result.authoredFeatures.push({
    id: featureId, type: state.config.type, hostPatchId: strip.id,
    evidence: state.evidence, config: clone(state.config),
    apertureAreaSquareMetres: state.aperture.areaSquareMetres,
    collisionStatus: 'not_verified',
  });
  validateScore(result);
  return result;
}

function addBar(THREE, parent, material, name, size, position, role) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.userData = {role, evidence: 'authored_prototype', dimensionsMetres: size.slice()};
  parent.add(mesh);
  return mesh;
}

/** Actual extruded frame/sash/glass geometry, positioned in the measured basis. */
export function buildWindow(THREE, score, config = {}) {
  const state = validateWindow(score, config), c = state.config, d = state.dimensions;
  const group = new THREE.Group();
  group.name = `hosted-window:${state.host.id}`;
  group.visible = c.enabled;
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...state.basis.x), new THREE.Vector3(...state.basis.y), new THREE.Vector3(...state.basis.z));
  group.quaternion.setFromRotationMatrix(basis);
  group.position.set(...state.basis.originDisplay);
  const fixedFrame = new THREE.Group(); fixedFrame.name = 'fixed-frame'; group.add(fixedFrame);
  const frameMaterial = new THREE.MeshStandardMaterial({color: '#d0d4d2', metalness: 0.55, roughness: 0.38});
  const sashMaterial = new THREE.MeshStandardMaterial({color: '#9faeaf', metalness: 0.5, roughness: 0.4});
  const {width: w, height: h, frameWidth: f, frameDepth: depth} = c;
  addBar(THREE, fixedFrame, frameMaterial, 'fixed-left', [f, h, depth], [-w / 2 + f / 2, h / 2, 0], 'fixed-frame');
  addBar(THREE, fixedFrame, frameMaterial, 'fixed-right', [f, h, depth], [w / 2 - f / 2, h / 2, 0], 'fixed-frame');
  addBar(THREE, fixedFrame, frameMaterial, 'fixed-bottom', [w - 2 * f, f, depth], [0, f / 2, 0], 'fixed-frame');
  addBar(THREE, fixedFrame, frameMaterial, 'fixed-top', [w - 2 * f, f, depth], [0, h - f / 2, 0], 'fixed-frame');
  const pivot = new THREE.Group(); pivot.name = 'outward-hinge-pivot';
  pivot.position.set(...d.pivotLocal);
  pivot.rotation.y = -c.angleDegrees * Math.PI / 180;
  group.add(pivot);
  const leaf = new THREE.Group(); leaf.name = 'moving-sash'; pivot.add(leaf);
  const {leafWidth: lw, leafHeight: lh, sashWidth: sw, sashDepth: sd} = d;
  addBar(THREE, leaf, sashMaterial, 'sash-hinge-side', [sw, lh, sd], [sw / 2, lh / 2, 0], 'moving-sash');
  addBar(THREE, leaf, sashMaterial, 'sash-free-side', [sw, lh, sd], [lw - sw / 2, lh / 2, 0], 'moving-sash');
  addBar(THREE, leaf, sashMaterial, 'sash-bottom', [lw - 2 * sw, sw, sd], [lw / 2, sw / 2, 0], 'moving-sash');
  addBar(THREE, leaf, sashMaterial, 'sash-top', [lw - 2 * sw, sw, sd], [lw / 2, lh - sw / 2, 0], 'moving-sash');
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: '#ffffff', transmission: c.glassTransmission, opacity: 1, roughness: c.glassRoughness,
    metalness: 0, ior: 1.5, thickness: d.glassThickness,
    attenuationColor: c.glassColor, attenuationDistance: 0.035,
  });
  const glass = addBar(THREE, leaf, glassMaterial, 'moving-glass',
    [d.glassWidth, d.glassHeight, d.glassThickness], [lw / 2, lh / 2, 0], 'glass');
  const clearance = new THREE.Group(); clearance.name = 'conservative-sash-sweep';
  clearance.visible = c.showClearance;
  const min = state.clearance.min, max = state.clearance.max;
  const sweepGeometry = new THREE.BoxGeometry(...max.map((v, i) => v - min[i]));
  const envelope = new THREE.Mesh(sweepGeometry,
    new THREE.MeshBasicMaterial({color: '#ffbf69', transparent: true, opacity: 0.1, depthWrite: false}));
  const envelopeEdges = new THREE.LineSegments(new THREE.EdgesGeometry(sweepGeometry),
    new THREE.LineBasicMaterial({color: '#ffbf69', transparent: true, opacity: 0.7}));
  clearance.position.set(...max.map((v, i) => (v + min[i]) / 2));
  clearance.add(envelope, envelopeEdges);
  clearance.userData = clone(state.clearance);
  group.add(clearance);
  const refs = {fixedFrame, leaf, glass, pivot, clearance};
  group.userData = {
    schema: WINDOW_SCHEMA, hostPatchId: state.host.id, evidence: state.evidence,
    dimensionsMeasured: false, state,
  };
  // Runtime references are directly accessible but non-enumerable so Three.js
  // JSON serialization does not recurse through their parent pointers.
  for (const [name, value] of Object.entries({refs, ...refs})) {
    Object.defineProperty(group.userData, name, {value, enumerable: false});
  }
  fixedFrame.userData.role = 'fixed-frame';
  leaf.userData.role = 'moving-leaf';
  pivot.userData = {role: 'hinge', axisLocal: [0, 1, 0], angleDegrees: c.angleDegrees};
  group.updateMatrixWorld(true);
  return group;
}

/** Serializable state; optional scene matrices expose actual rendered motion. */
export function inspectWindow(score, config = {}, group = null) {
  const state = validateWindow(score, config);
  if (group) {
    if (group.userData?.schema !== WINDOW_SCHEMA) throw Error('Not a hosted-window group');
    group.updateWorldMatrix(true, true);
    const refs = group.userData.refs;
    const matrix = object => Array.from(object.matrixWorld.elements);
    state.scene = {
      visible: group.visible,
      hostMatrixWorld: matrix(group),
      fixedFrameMatrixWorld: matrix(refs.fixedFrame),
      leafMatrixWorld: matrix(refs.leaf),
      glassMatrixWorld: matrix(refs.glass),
      hingeWorld: Array.from(refs.pivot.matrixWorld.elements).slice(12, 15),
      displayedAngleDegrees: -refs.pivot.rotation.y * 180 / Math.PI,
    };
  }
  return state;
}
