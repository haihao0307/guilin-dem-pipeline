import assert from 'node:assert/strict';
import * as T from '../vendor/three.module.js';
import {applyAcceptanceCamera} from '../src/orthographic-acceptance.mjs';

const axes = {
  side: {direction: [-1, 0, 0], up: [0, 1, 0]},
  front: {direction: [0, 0, -1], up: [0, 1, 0]},
  top: {direction: [0, -1, 0], up: [0, 0, -1]}
};
const close = (actual, expected, label, tolerance = 1e-8) => {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${label}: expected ${expected}, received ${actual}`);
};
const projectPixel = (point, camera, width, height) => {
  const p = point.clone().project(camera);
  return new T.Vector2((p.x + 1) * width / 2, (1 - p.y) * height / 2);
};
const pixelLength = (center, axis, length, camera, width, height) => {
  const start = center.clone().addScaledVector(axis, -length / 2);
  const end = center.clone().addScaledVector(axis, length / 2);
  return projectPixel(start, camera, width, height).distanceTo(projectPixel(end, camera, width, height));
};

// Test actual projected lengths, axes and effective scale, not only camera type.
// Unequal viewport sizes and independent centers are intentional: each source pair
// must have identical units per CSS pixel without relying on identical matrices.
const results = [];
for (const [view, expected] of Object.entries(axes)) {
  for (const worldUnitsPerPixel of [.0125, .05, .2]) {
    const panels = [
      {name: 'a4', center: [1, 2, 3], width: 899, height: 451, worldUnitsPerPixel},
      {name: 'a6', center: [-11, 5, 18], width: 900, height: 453, worldUnitsPerPixel},
      {name: 'mark3', center: [10, 4, -8], width: 391, height: 311, worldUnitsPerPixel: worldUnitsPerPixel * 1.8},
      {name: 'coach', center: [-4, -3, 11], width: 392, height: 310, worldUnitsPerPixel: worldUnitsPerPixel * 1.8}
    ].map(spec => {
      const center = new T.Vector3(...spec.center);
      const camera = new T.OrthographicCamera();
      applyAcceptanceCamera(T, camera, {...spec, view, center});
      camera.updateMatrixWorld(true);
      const direction = camera.getWorldDirection(new T.Vector3());
      const screenUp = new T.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      const screenRight = new T.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      direction.toArray().forEach((value, i) => close(value, expected.direction[i], `${view}/${spec.name} direction ${i}`));
      screenUp.toArray().forEach((value, i) => close(value, expected.up[i], `${view}/${spec.name} up ${i}`));
      const projectedCenter = center.clone().project(camera);
      close(projectedCenter.x, 0, `${view}/${spec.name} target center X`);
      close(projectedCenter.y, 0, `${view}/${spec.name} target center Y`);
      const xUnits = (camera.right - camera.left) / camera.zoom / spec.width;
      const yUnits = (camera.top - camera.bottom) / camera.zoom / spec.height;
      close(xUnits, spec.worldUnitsPerPixel, `${view}/${spec.name} horizontal units per pixel`);
      close(yUnits, spec.worldUnitsPerPixel, `${view}/${spec.name} vertical units per pixel`);
      assert.ok(camera.near >= 0 && camera.far > camera.near, 'valid clipping range');
      const depthSpan = camera.far - camera.near;
      const length = Math.min(spec.width, spec.height) * spec.worldUnitsPerPixel * .1;
      const longitudinalOffset = Math.min(depthSpan, spec.width * spec.worldUnitsPerPixel, spec.height * spec.worldUnitsPerPixel) * .1;
      const probes = [];
      for (const [depthName, fraction] of [['near', .2], ['middle', .5], ['far', .8]]) {
        const depthCenter = camera.position.clone().addScaledVector(direction, camera.near + depthSpan * fraction);
        for (const [positionName, sign] of [['rear', -1], ['middle', 0], ['front', 1]]) {
          // Train front/rear is world Z, independent of which view is selected.
          const location = depthCenter.clone().add(new T.Vector3(0, 0, longitudinalOffset * sign));
          for (const [axisName, axis] of [['horizontal', screenRight], ['vertical', screenUp]]) {
            const pixels = pixelLength(location, axis, length, camera, spec.width, spec.height);
            close(pixels, length / spec.worldUnitsPerPixel, `${view}/${spec.name}/${depthName}/${positionName}/${axisName} projected length`);
            probes.push({depth: depthName, position: positionName, axis: axisName, pixels});
          }
        }
      }
      return {name: spec.name, xUnits, yUnits, probes};
    });
    for (const [a, b] of [[panels[0], panels[1]], [panels[2], panels[3]]]) {
      close(a.xUnits, b.xUnits, `${view}/${a.name}-${b.name} horizontal scale`);
      close(a.yUnits, b.yUnits, `${view}/${a.name}-${b.name} vertical scale`);
    }
    results.push({view, worldUnitsPerPixel, panels});
  }
}
console.log(JSON.stringify({status: 'PASS', views: Object.keys(axes), configurations: results.length,
  projectedSegments: results.reduce((n, result) => n + result.panels.reduce((sum, p) => sum + p.probes.length, 0), 0),
  crossSourceMetricCalibration: false,
  assertions: ['axis-aligned direction and up', 'target-centered projection', 'units per pixel',
    'near/far and front/rear equal projected lengths', 'equal horizontal/vertical scale', 'same-source pair scale']}, null, 2));
