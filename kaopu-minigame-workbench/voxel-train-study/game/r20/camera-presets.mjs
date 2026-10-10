import {CONSIST_BOUNDS,CONSIST,COACH_LAYOUT} from './metre-scale.mjs';
// R17 metre-unit observer positions. Prototype-certified and authoring dimensions remain separately labelled.
// These poses never rotate the world or alter train geometry.
const freeze = value => { if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };
const horizontal = {kind: 'horizontal', referenceAspect: 16 / 9};
export const CAMERA_LIMITS = freeze({minHeight: .7, minRadius: 5.5, maxRadius: 130,
  minTargetHeight: .35, maxTargetHeight: 18, minTargetX: -70, maxTargetX: 12, minTargetZ: -12, maxTargetZ: 12,
  minPhi: .12, maxPhi: 1.50, minZoom: .4, maxZoom: 3,
  trainClearance: {min: [CONSIST_BOUNDS.min[0]-.5, -.5, -1.9], max: [6, 4.8, 1.9]}});
export const TRAIN_FOCUS_BOUNDS = freeze({min: [...CONSIST_BOUNDS.min], max: [...CONSIST_BOUNDS.max]});
export const CAMERA_PRESETS = freeze({
  overview: {label: '全景', focusBounds: TRAIN_FOCUS_BOUNDS,
    landscape: {position: [9, 19, 70], target: [-24, 2, 0], zoom: 1, projection: horizontal},
    portrait: {position: [39, 31, 62], target: [-24, 2, 0], zoom: .9}},
  front: {label: '车前', focusBounds: {min: [CONSIST.tenderRearX, 0, -1.6], max: [5.5, 4.65, 1.6]},
    landscape: {position: [23, 6.7, 10], target: [-3.5, 1.7, 0], zoom: 1.1, projection: horizontal},
    portrait: {position: [23, 6.7, 10], target: [-3.5, 1.7, 0], zoom: 1.1}},
  rear: {label: '车后', focusBounds: {min: [CONSIST_BOUNDS.min[0], 0, -1.6], max: [CONSIST.tenderRearX, 4.35, 1.6]},
    landscape: {position: [-77, 10, 24], target: [-34, 2.2, 0], zoom: 1.1, projection: horizontal},
    portrait: {position: [-77, 10, 24], target: [-34, 2.2, 0], zoom: 1.1}},
  detail: {label: '近看', focusBounds: {min: [-2.1, .25, -1.2], max: [5.5, 4.65, 1.6]},
    landscape: {position: [1.5, 3.8, 10.5], target: [1.5, 1.85, 0], zoom: 1.03, projection: horizontal},
    portrait: {position: [10, 5, 12], target: [1.5, 1.85, 0], zoom: .95}},
  city: {label: '街景', focusBounds: {min: [-8, .1, -8], max: [6, 12, 1.3]},
    landscape: {position: [14, 5.6, 15], target: [-1, 5, -4], zoom: .88, projection: horizontal},
    portrait: {position: [16, 8, 18], target: [-1, 7, -4], zoom: .70}},
  platform: {label: '月台', focusBounds: {min: [COACH_LAYOUT[0].rearDoor-2, .05, -1.6], max: [5.5, 4.65, 6.15]},
    landscape: {position: [7, 7.5, 31], target: [-17, 2.3, 1.2], zoom: .78, projection: horizontal},
    portrait: {position: [14, 12, 39], target: [-18, 2.5, 1.2], zoom: .55}}
});
export const CAMERA_PRESET_IDS = Object.freeze(Object.keys(CAMERA_PRESETS));
export function getCameraPreset(id, layout = 'landscape') {
  if (!Object.hasOwn(CAMERA_PRESETS, id) || !['landscape', 'portrait'].includes(layout)) return null;
  const preset = CAMERA_PRESETS[id];
  return {...structuredClone(preset[layout]), presetId: id, focus: id,
    label: preset.label, focusBounds: structuredClone(preset.focusBounds)};
}
export function getFocusBounds(focus = 'overview') {
  return structuredClone((Object.hasOwn(CAMERA_PRESETS, focus) ? CAMERA_PRESETS[focus] : CAMERA_PRESETS.overview).focusBounds);
}

// Pure safety clamp, also used after pinch panning. Zoom is optical: moving in
// never pushes the camera through the cab. The clear box protects free orbits.
export function boundCameraPose(position, target, limits = CAMERA_LIMITS) {
  if (![position, target].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) return null;
  const p = position.slice(), t = target.slice();
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const boundedTarget = [clamp(t[0], limits.minTargetX, limits.maxTargetX),
    clamp(t[1], limits.minTargetHeight, limits.maxTargetHeight),
    clamp(t[2], limits.minTargetZ, limits.maxTargetZ)];
  for (let i = 0; i < 3; i++) p[i] += boundedTarget[i] - t[i];
  const offset = p.map((v, i) => v - boundedTarget[i]);
  const radius = Math.hypot(...offset), safeRadius = clamp(radius, limits.minRadius, limits.maxRadius);
  const phi = radius < 1e-9 ? limits.maxPhi : Math.acos(clamp(offset[1] / radius, -1, 1));
  const safePhi = clamp(phi, limits.minPhi, limits.maxPhi);
  if (radius < 1e-9 || radius !== safeRadius || phi !== safePhi) {
    const theta = Math.atan2(offset[0], offset[2]);
    offset.splice(0, 3, safeRadius * Math.sin(safePhi) * Math.sin(theta),
      safeRadius * Math.cos(safePhi), safeRadius * Math.sin(safePhi) * Math.cos(theta));
  }
  for (let i = 0; i < 3; i++) p[i] = boundedTarget[i] + offset[i];
  p[1] = Math.max(limits.minHeight, p[1]);
  const box = limits.trainClearance;
  if (p.every((v, i) => v > box.min[i] && v < box.max[i])) p[2] = p[2] < 0 ? box.min[2] : box.max[2];
  // Moving sideways out of the train can shorten the radius toward a panned
  // target. Lift only when needed to retain the minimum orbit clearance.
  const horizontalSq = (p[0] - boundedTarget[0]) ** 2 + (p[2] - boundedTarget[2]) ** 2;
  if (Math.hypot(...p.map((v, i) => v - boundedTarget[i])) < limits.minRadius)
    p[1] = boundedTarget[1] + Math.sqrt(Math.max(0, limits.minRadius ** 2 - horizontalSq));
  return {position: p, target: boundedTarget};
}
