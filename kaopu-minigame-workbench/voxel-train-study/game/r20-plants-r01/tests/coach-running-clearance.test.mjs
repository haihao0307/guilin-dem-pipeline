import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../vendor/three.module.js';
import {createGameTrain} from '../train-model.mjs';
import {TRACK, COACH_DIMENSIONS} from '../metre-scale.mjs';
import {coachWheelSection, RETAINED_COACH} from '../wheel-rail-profile.mjs';
import {wheelBodyIntersections} from '../native-a4/adapter.mjs';

// Straight-track geometry regression, not suspension/load or curve certification.
const train = createGameTrain();
const flangeHeight = RETAINED_COACH.flangeHeightM;
const axialHalfWidth = Math.max(
  -RETAINED_COACH.innerEnvelopeOffsetM, RETAINED_COACH.outerFaceOffsetM,
);
const tolerance = 3e-6; // Float32 instance translations at the rear coach.

function nativeTriangles(mesh) {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.attributes.position, index = mesh.geometry.index;
  const triangles = [];
  for (let i = 0; i < (index ? index.count : position.count); i += 3) {
    const points = [0, 1, 2].map(j => {
      const p = new T.Vector3().fromBufferAttribute(
        position, index ? index.getX(i + j) : i + j,
      ).applyMatrix4(mesh.matrixWorld);
      return [p.x, p.z, p.y - TRACK.railHead];
    });
    triangles.push({points, part: mesh.name});
  }
  return triangles;
}

function wheelEnvelopes(coach) {
  return coach.wheels.map((wheel, i) => ({
    id: `${coach.root.name}/wheel-${i}`,
    xM: wheel.position.x,
    yM: wheel.position.z,
    radiusM: wheel.userData.radius,
    // The checker expands both axes by margin. Retain the nominal centre/R.
    halfWidthM: axialHalfWidth - flangeHeight,
  }));
}

function maxRadiusInAxialInterval(section, lo, hi) {
  const radii = [];
  for (let i = 0; i < section.length; i++) {
    const a = section[i], b = section[(i + 1) % section.length];
    if (a[1] >= lo && a[1] <= hi) radii.push(a[0]);
    if (Math.abs(a[1] - b[1]) < 1e-15) continue;
    for (const axial of [lo, hi]) {
      const u = (axial - a[1]) / (b[1] - a[1]);
      if (u >= 0 && u <= 1) radii.push(a[0] + u * (b[0] - a[0]));
    }
  }
  assert(radii.length, 'Pad axial range must actually overlap the wheel profile');
  return Math.max(...radii);
}

function padClearances(coach, pressure) {
  coach.updateHardware(0, pressure);
  coach.root.updateMatrixWorld(true);
  const pads = coach.root.getObjectByName('Coach brake shoes');
  assert(pads?.isInstancedMesh);
  assert.equal(pads.count, coach.wheels.length);
  const position = pads.geometry.attributes.position;
  return coach.wheels.map((wheel, i) => {
    const matrix = new T.Matrix4();
    pads.getMatrixAt(i, matrix);
    matrix.premultiply(pads.matrixWorld);
    const axial = [], longitudinal = [];
    for (let j = 0; j < position.count; j++) {
      const p = new T.Vector3().fromBufferAttribute(position, j).applyMatrix4(matrix);
      axial.push(Math.sign(wheel.position.z) * (p.z - wheel.position.z));
      longitudinal.push(p.x - wheel.position.x);
    }
    const lo = Math.min(...axial), hi = Math.max(...axial);
    const minX = Math.min(...longitudinal);
    assert(minX > 0, 'This front-of-wheel pad bound requires positive X');
    const maxR = maxRadiusInAxialInterval(coachWheelSection(wheel.userData.radius), lo, hi);
    // Every box point has radial distance >= minX, at every wheel phase.
    return {lo, hi, gap: minX - maxR, centrelineGap: minX - wheel.userData.radius};
  });
}

test('all sixteen actual rendered coach wheels fit the tested complete swept envelopes', () => {
  assert.equal(train.coaches.length, 2);
  for (const coach of train.coaches) {
    assert.equal(coach.wheels.length, 8);
    assert.equal(coach.wheelBatch.count, 8);
    coach.updateHardware(0, 0);
    coach.root.updateMatrixWorld(true);
    const p = coach.wheelBatch.geometry.attributes.position;
    for (const [i, wheel] of coach.wheels.entries()) {
      const matrix = new T.Matrix4();
      coach.wheelBatch.getMatrixAt(i, matrix);
      matrix.premultiply(coach.wheelBatch.matrixWorld);
      assert(new T.Vector3().setFromMatrixPosition(matrix).distanceTo(wheel.position) < tolerance);
      assert(Math.abs(wheel.position.y - wheel.userData.radius - TRACK.railHead) < tolerance);
      for (let j = 0; j < p.count; j++) {
        const v = new T.Vector3().fromBufferAttribute(p, j).applyMatrix4(matrix).sub(wheel.position);
        assert(Math.hypot(v.x, v.y) <= wheel.userData.radius + flangeHeight + tolerance);
        assert(Math.abs(v.z) <= axialHalfWidth + tolerance);
      }
    }
  }
});

test('complete fixed underframe and bogie triangles clear all sixteen swept wheel envelopes', () => {
  for (const coach of train.coaches) {
    const triangles = nativeTriangles(coach.fixedMesh);
    assert(triangles.length > 0);
    const result = wheelBodyIntersections(triangles, wheelEnvelopes(coach), flangeHeight);
    assert.equal(result.count, 0, JSON.stringify(result.examples));
  }
});

test('old outboard longitudinal beam is detected by the same actual triangle checker', () => {
  const coach = train.coaches[0];
  const geometry = new T.BoxGeometry(COACH_DIMENSIONS.underframeLength, .20, .16);
  const oldBeam = new T.Mesh(geometry);
  oldBeam.position.set(coach.body.position.x, coach.proof.floorY - .19, .72);
  try {
    const result = wheelBodyIntersections(nativeTriangles(oldBeam), wheelEnvelopes(coach), flangeHeight);
    assert(result.count > 0, 'Negative control must catch the former 107 mm wheel overlap');
  } finally {
    geometry.dispose();
    oldBeam.material.dispose();
  }
});

test('full width of every coach brake pad clears the mirrored flange at five pressure inputs', () => {
  let checked = 0;
  for (const coach of train.coaches) {
    const byPressure = new Map();
    for (const pressure of [-1, 0, .5, 1, 2]) {
      const rows = padClearances(coach, pressure);
      byPressure.set(pressure, rows);
      for (const row of rows) {
        assert(row.lo >= RETAINED_COACH.treadInnerOffsetM - tolerance);
        assert(row.hi <= RETAINED_COACH.treadOuterOffsetM + tolerance);
        assert(row.gap > .0004, `Complete pad/flange gap ${row.gap} m at pressure ${pressure}`);
        checked++;
      }
    }
    assert.deepEqual(byPressure.get(-1), byPressure.get(0));
    assert.deepEqual(byPressure.get(2), byPressure.get(1));
    coach.updateHardware(0, 0);
  }
  assert.equal(checked, 80);
});

test('old .14 m-wide pad fails full-profile clearance even though its centreline clears', () => {
  for (const coach of train.coaches) {
    const pads = coach.root.getObjectByName('Coach brake shoes'), original = pads.geometry;
    const oldWidth = new T.BoxGeometry(.13, .30, .14);
    pads.geometry = oldWidth; // In-memory negative control; runtime source is untouched.
    try {
      const rows = padClearances(coach, 1);
      assert.equal(rows.length, 8);
      for (const row of rows) {
        assert(row.centrelineGap > .0004);
        assert(row.gap < -.009, `Old width must penetrate the flange root: ${row.gap}`);
      }
    } finally {
      pads.geometry = original;
      oldWidth.dispose();
      coach.updateHardware(0, 0);
    }
  }
});
