import {projectFrame} from './bounds-zoom.mjs';
import {verticalFov} from './anchored-zoom.mjs';

// Exact stable belt dimensions in production world.mjs at 6562c467.
export const WORLD_PROXY = Object.freeze({halfRun: 18, radius: 3.8,
  width: 12.2, nearEdge: 7.6, farEdge: -4.6, centerX: -8});
export const HORIZONTAL_PROJECTION = Object.freeze({kind: 'horizontal', referenceAspect: 16 / 9});

export function pathFrame(worldX, elevation = 0, z = 0, world = WORLD_PROXY) {
  const a = world.halfRun, r = world.radius, l = 2 * a, c = Math.PI * r;
  const length = 2 * l + 2 * c;
  const s = ((worldX - world.centerX + a) % length + length) % length;
  let x, y, tx, ty;
  if (s < l) { x = s - a; y = 0; tx = 1; ty = 0; }
  else if (s < l + c) { const t = (s - l) / r; x = a + r * Math.sin(t); y = -r + r * Math.cos(t); tx = Math.cos(t); ty = -Math.sin(t); }
  else if (s < 2 * l + c) { x = a - (s - l - c); y = -2 * r; tx = -1; ty = 0; }
  else { const t = (s - 2 * l - c) / r; x = -a - r * Math.sin(t); y = -r - r * Math.cos(t); tx = -Math.cos(t); ty = Math.sin(t); }
  return {position: [world.centerX + x - elevation * ty, y + elevation * tx, z], normal: [-ty, tx, 0]};
}

export function makeTerrainProxy(vector, {world = WORLD_PROXY, arcSegments = 128} = {}) {
  const green = [], rails = [], returnSurface = [], fence = [];
  function add(list, x, elevation, zs) {
    for (const z of zs) list.push(vector.clone().fromArray(pathFrame(x, elevation, z, world).position));
  }
  // Elevation .16 conservatively includes the flat grass surface and tiny
  // static tufts; .35 includes the rail head. No trees/stations/CPU terrain box.
  for (let i = 0; i <= arcSegments; i++) for (const side of [-1, 1]) {
    const angle = i / arcSegments * Math.PI / 2;
    const x = world.centerX + side * (world.halfRun + world.radius * angle);
    add(green, x, .16, [world.farEdge, world.nearEdge]);
    add(rails, x, .35, [-.835, .835]);
    add(fence, x, 1.13, [-3.1]);
    const lowerX = world.centerX + side * (world.halfRun + world.radius * (angle + Math.PI / 2));
    add(returnSurface, lowerX, -.12, [world.farEdge, world.nearEdge]);
  }
  return {green, rails, main: [...green, ...rails], fence, returnSurface};
}

export function framePixels(camera, points, width, height) {
  const b = projectFrame(camera, points);
  if (!b) return null;
  return {left: (b.left.x + 1) * width / 2, right: (b.right.x + 1) * width / 2,
    top: (1 - b.top.y) * height / 2, bottom: (1 - b.bottom.y) * height / 2,
    centerX: (b.x + 1) * width / 2, centerY: (1 - b.y) * height / 2,
    width: b.width * width / 2, height: b.height * height / 2,
    horizontalFraction: b.width / 2};
}

function translate(camera, target, column, amount) {
  const delta = target.clone().setFromMatrixColumn(camera.matrixWorld, column).multiplyScalar(amount);
  camera.position.add(delta); target.add(delta); camera.updateMatrixWorld();
}

function balanceHorizontally(camera, target, points) {
  for (let i = 0; i < 12; i++) {
    const f = projectFrame(camera, points);
    if (!f) throw new Error('Fit proxy is not in front of the camera');
    if (Math.abs(f.x) < 1e-12) return;
    const derivative = camera.projectionMatrix.elements[0] * .5 * (1 / f.left.depth + 1 / f.right.depth);
    translate(camera, target, 0, f.x / derivative);
  }
  throw new Error('Horizontal fit did not converge');
}

function permittedVerticalTranslation(camera, constraints) {
  camera.updateMatrixWorld();
  let lower = -Infinity, upper = Infinity;
  const py = camera.projectionMatrix.elements[5];
  for (const {points, top, bottom, height} of constraints) {
    const maxNdc = 1 - 2 * top / height, minNdc = 1 - 2 * bottom / height;
    for (const point of points) {
      const p = point.clone().project(camera), depth = -point.clone().applyMatrix4(camera.matrixWorldInverse).z;
      if (!(depth > camera.near)) return null;
      lower = Math.max(lower, (p.y - maxNdc) * depth / py);
      upper = Math.min(upper, (p.y - minNdc) * depth / py);
    }
  }
  return {lower, upper, feasible: lower <= upper + 1e-11};
}

// Offline or explicit-recommendation operation only. Do not run on resize,
// wheel, session changes, or restoration of an existing user profile.
export function fitRecommendedFrame({camera, target, terrainPoints, trainPoints,
  returnPoints = null, returnCropAllowance = 48,
  width = 2048, height = 1016, coverage = .95, hudTop = 200, hudBottom = 130,
  trainPadding = 12, terrainPadding = 8, projection = HORIZONTAL_PROJECTION}) {
  if (!(width > 0 && height > hudTop + hudBottom + 2 * trainPadding)) throw new Error('No usable train-safe viewport');
  camera.aspect = width / height;
  camera.fov = verticalFov(camera.aspect, projection);
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  balanceHorizontally(camera, target, terrainPoints);
  const widthZoom = camera.zoom * (2 * coverage / projectFrame(camera, terrainPoints).width);
  const constraints = [
    {points: trainPoints, top: hudTop + trainPadding, bottom: height - hudBottom - trainPadding, height},
    {points: terrainPoints, top: terrainPadding, bottom: height - terrainPadding, height}
  ];
  if (returnPoints?.length) constraints.push({points: returnPoints, top: -Infinity,
    bottom: height + returnCropAllowance, height});
  function atZoom(zoom) { camera.zoom = zoom; camera.updateProjectionMatrix(); return permittedVerticalTranslation(camera, constraints); }
  let interval = atZoom(widthZoom), constrainedByHeight = false;
  if (!interval?.feasible) {
    // There is no guarantee 95% width and vertical clearance can coexist.
    // Preserve the whole train/upper green surface before the width preference.
    constrainedByHeight = true;
    let low = .001, high = widthZoom;
    if (!atZoom(low)?.feasible) throw new Error('No feasible fitting projection');
    for (let i = 0; i < 52; i++) { const mid = (low + high) / 2; if (atZoom(mid)?.feasible) low = mid; else high = mid; }
    interval = atZoom(low);
  }
  const trainFrame = projectFrame(camera, trainPoints);
  const wantedY = 1 - 2 * ((hudTop + height - hudBottom) / 2) / height;
  const wantedShift = (trainFrame.y - wantedY) /
    (camera.projectionMatrix.elements[5] * .5 * (1 / trainFrame.bottom.depth + 1 / trainFrame.top.depth));
  translate(camera, target, 1, Math.max(interval.lower, Math.min(interval.upper, wantedShift)));
  return {profile: {position: camera.position.toArray(), target: target.toArray(), zoom: camera.zoom,
    projection: {...projection}, manual: false, locked: false},
    referenceViewport: {width, height}, requestedCoverage: coverage, constrainedByHeight,
    terrain: framePixels(camera, terrainPoints, width, height), train: framePixels(camera, trainPoints, width, height),
    returnSurface: returnPoints ? framePixels(camera, returnPoints, width, height) : null,
    returnCropAllowance: returnPoints ? returnCropAllowance : null};
}

// Read-only suggestion for very short/wide windows: evaluate a symmetric
// projection expansion while leaving the saved pose/zoom unchanged. An app can
// use the returned FOV temporarily, but must not persist it into the profile.
export function guardedVerticalFov({camera, trainPoints, width, height,
  terrainPoints = null, returnPoints = null, returnCropAllowance = 48,
  projection = HORIZONTAL_PROJECTION, hudTop = 200, hudBottom = 130, padding = 12}) {
  const horizontalFov = verticalFov(width / height, projection);
  const trial = camera.clone(); trial.aspect = width / height; trial.fov = horizontalFov;
  trial.updateProjectionMatrix(); trial.updateMatrixWorld();
  const upper = 1 - 2 * (hudTop + padding) / height;
  const lower = -1 + 2 * (hudBottom + padding) / height;
  if (upper <= 0 || lower >= 0) return {fov: horizontalFov, status: 'hud-consumes-center', scale: null};
  let scale = 1;
  const constraints = [{points: trainPoints, upper, lower}];
  if (terrainPoints?.length) constraints.push({points: terrainPoints, upper: 1 - 16 / height, lower: -1 + 16 / height});
  if (returnPoints?.length) constraints.push({points: returnPoints, upper: Infinity, lower: -1 - 2 * returnCropAllowance / height});
  for (const {points, upper, lower} of constraints) {
    const b = projectFrame(trial, points);
    if (!b) return {fov: horizontalFov, status: 'invalid-proxy', scale: null};
    if (b.top.y > upper) scale = Math.min(scale, upper / b.top.y);
    if (b.bottom.y < lower) scale = Math.min(scale, lower / b.bottom.y);
  }
  if (!(scale > 0)) return {fov: horizontalFov, status: 'manual-view-outside-guard', scale: null};
  const fov = 2 * Math.atan(Math.tan(horizontalFov * Math.PI / 360) / scale) * 180 / Math.PI;
  return {fov, scale, status: scale < 1 ? 'vertical-clearance-guard' : 'horizontal-fit'};
}
