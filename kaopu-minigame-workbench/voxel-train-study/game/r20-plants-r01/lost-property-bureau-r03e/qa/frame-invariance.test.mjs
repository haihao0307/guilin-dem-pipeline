/**
 * Independent component-frame contract tests. Run with:
 *   node --test qa/frame-invariance.test.mjs
 *
 * All matrices in this file are row-major Array(9). The oracle is deliberately
 * independent of renderer/WGSL code. Passing CPU contract tests is NOT a GPU
 * render, a material-mother evaluation, or visual acceptance. The anisotropic
 * witness below is a synthetic scalar, not a CPU port of the wood mother.
 *
 * Scope: rigid orthogonal frames, det = +1 OR -1, measured in metres. For these
 * frames A = inverse-transpose(A), so a polar surface normal transforms by A
 * exactly as a tangent does. Nonuniform scale/shear needs a different contract.
 * Global scene changes use proper rotations R and translations s:
 *   p' = R p + s; origin' = R origin + s; A' = A transpose(R).
 * Local extents are immutable component coordinates, not a world-space AABB.
 * World-anchored weather/noise intentionally does NOT become component-local.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as implementation from '../material-frame.mjs';
import { shaderSource } from '../renderer.mjs';
import { DOMAIN } from '../domain.mjs';
import { WINDOWS } from '../windows.mjs';
import { buildFrameProbe, FRAME_PROBE_TOLERANCES } from './frame-probe.mjs';

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const WEST = [0, 0, 1, 0, 1, 0, 1, 0, 0]; // q = (world.z, world.y, world.x)
const MIRROR = [-1, 0, 0, 0, 1, 0, 0, 0, 1];
const EPS = 2e-10;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const length = v => Math.hypot(...v);
const unit = v => scale(v, 1 / length(v));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const transpose = a => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]];
const mv = (a, v) => [dot(a.slice(0, 3), v), dot(a.slice(3, 6), v), dot(a.slice(6, 9), v)];
const mm = (a, b) => Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3), c = i % 3;
  return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
});
const det = a => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
const maxDifference = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));

function close(actual, expected, label, tolerance = EPS) {
  assert.ok(Number.isFinite(actual) && Number.isFinite(expected), `${label}: finite values required`);
  const error = Math.abs(actual - expected);
  assert.ok(error <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected)), `${label}: ${actual} != ${expected}; error=${error}`);
}
function closeVector(actual, expected, label, tolerance = EPS) {
  assert.equal(actual.length, expected.length, `${label}: vector dimensions`);
  actual.forEach((value, i) => close(value, expected[i], `${label}[${i}]`, tolerance));
}
function orthogonal(a, label) {
  closeVector(mm(a, transpose(a)), I, `${label}: A A^T`);
  close(Math.abs(det(a)), 1, `${label}: |det A|`);
}
function axisAngle(axis, angle) {
  const [x, y, z] = unit(axis), c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [t*x*x+c, t*x*y-s*z, t*x*z+s*y, t*x*y+s*z, t*y*y+c, t*y*z-s*x, t*x*z-s*y, t*y*z+s*x, t*z*z+c];
}
function generator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = generator(0xEB88F00D);
const randomVector = (span = 1) => Array.from({ length: 3 }, () => (random() * 2 - 1) * span);

function cubeRotations() {
  const result = [];
  const permutations = [[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]];
  for (const p of permutations) for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
    const matrix = Array(9).fill(0);
    [x, y, z].forEach((s, i) => { matrix[i * 3 + p[i]] = s; });
    if (det(matrix) === 1) result.push(matrix);
  }
  return result;
}
const CUBE_ROTATIONS = cubeRotations();
const ROTATIONS = [
  ...CUBE_ROTATIONS.map((R, i) => ({ name: `cube-${i}`, R, translation: randomVector(200) })),
  ...Array.from({ length: 64 }, (_, i) => ({ name: `axis-angle-${i}`, R: axisAngle(randomVector(), (random() * 2 - 1) * Math.PI), translation: randomVector(200) })),
  ...[1e-8, Math.PI - 1e-8, Math.PI, -Math.PI / 7].map((angle, i) => ({ name: `edge-angle-${i}`, R: axisAngle([1, -2, 3], angle), translation: randomVector(200) })),
];
const FRAMES = [
  { name: 'identity', worldToLocal: I },
  { name: 'west-x-z-swap-reflection', worldToLocal: WEST },
  { name: 'x-mirror', worldToLocal: MIRROR },
  { name: 'arbitrary-proper-host', worldToLocal: axisAngle([1, 2, -3], 0.617) },
  { name: 'arbitrary-reflected-host', worldToLocal: mm(axisAngle([4, -1, 2], -1.192), MIRROR) },
].map((frame, i) => ({
  ...frame,
  origin: [13.27 + i * 0.713, -4.12 + i * 0.371, 7.89 - i * 1.193],
  extentMin: [-1.73, -0.061, -0.12],
  extentMax: [2.31, 0.149, 0.076],
}));

// CPU oracle: do not import production helpers into these equations.
function referencePoint(frame, p) { return mv(frame.worldToLocal, sub(p, frame.origin)); }
function referenceDirection(frame, v) { return mv(frame.worldToLocal, v); }
function referenceFootprint(frame, dx, dy) { return Math.max(length(referenceDirection(frame, dx)), length(referenceDirection(frame, dy))); }
function worldPoint(frame, q) { return add(frame.origin, mv(transpose(frame.worldToLocal), q)); }
function worldDirection(frame, v) { return mv(transpose(frame.worldToLocal), v); }
function referenceInput(frame, sample) {
  return {
    q: referencePoint(frame, sample.p),
    normal: referenceDirection(frame, sample.n),
    tangent: referenceDirection(frame, sample.tangent),
    bitangent: referenceDirection(frame, sample.bitangent),
    dx: referenceDirection(frame, sample.dx),
    dy: referenceDirection(frame, sample.dy),
    footprint: referenceFootprint(frame, sample.dx, sample.dy),
    eyeDirection: referenceDirection(frame, unit(sub(sample.eye, sample.p))),
    lightDirection: referenceDirection(frame, unit(sub(sample.light, sample.p))),
    cameraDistance: length(sub(sample.eye, sample.p)),
    extentMin: [...frame.extentMin],
    extentMax: [...frame.extentMax],
    worldNoiseP: [...sample.p],
  };
}
function transformed(frame, sample, { R, translation }) {
  const point = p => add(mv(R, p), translation);
  const direction = v => mv(R, v);
  return {
    frame: { ...frame, worldToLocal: mm(frame.worldToLocal, transpose(R)), origin: point(frame.origin) },
    sample: {
      ...sample, p: point(sample.p), n: direction(sample.n), tangent: direction(sample.tangent), bitangent: direction(sample.bitangent),
      dx: direction(sample.dx), dy: direction(sample.dy), eye: point(sample.eye), light: point(sample.light),
    },
  };
}
function sameLocalInput(actual, expected, label) {
  for (const key of ['q', 'normal', 'tangent', 'bitangent', 'dx', 'dy', 'eyeDirection', 'lightDirection', 'extentMin', 'extentMax']) {
    closeVector(actual[key], expected[key], `${label}.${key}`);
  }
  close(actual.footprint, expected.footprint, `${label}.footprint`);
  close(actual.cameraDistance, expected.cameraDistance, `${label}.cameraDistance`);
  // worldNoiseP is deliberately excluded: this is a world-anchored domain.
}
function tangentBasis(n) {
  const helper = Math.abs(n[1]) < 0.8 ? [0, 1, 0] : [1, 0, 0];
  const tangent = unit(cross(helper, n));
  return { tangent, bitangent: unit(cross(n, tangent)) };
}
function planeDifferential(ray, dRay, normal, distance) {
  return scale(sub(dRay, scale(ray, dot(normal, dRay) / dot(normal, ray))), distance);
}
const INCIDENCE = [0, 60 * Math.PI / 180, 89.5 * Math.PI / 180];
const LOCAL_NORMALS = [[1,0,0], [0,1,0], [0,0,1], [-1,0,0], unit([1,2,3]), unit([-2,0.3,1])];
function samples(frame) {
  return LOCAL_NORMALS.flatMap((normal, normalIndex) => INCIDENCE.map((angle, incidenceIndex) => {
    const { tangent, bitangent } = tangentBasis(normal);
    const ray = add(scale(normal, -Math.cos(angle)), scale(tangent, Math.sin(angle)));
    const right = add(scale(tangent, Math.cos(angle)), scale(normal, Math.sin(angle)));
    const q = [0.317 + normalIndex * 0.13, 0.027 + incidenceIndex * 0.019, -0.051 + normalIndex * 0.006];
    const p = worldPoint(frame, q), distance = 6.7, pixelAngle = 0.00017;
    return {
      name: `${normalIndex}/${incidenceIndex}`, q, localNormal: normal, angle,
      p, n: worldDirection(frame, normal), tangent: worldDirection(frame, tangent), bitangent: worldDirection(frame, bitangent),
      dx: worldDirection(frame, planeDifferential(ray, scale(right, pixelAngle), normal, distance)),
      dy: worldDirection(frame, planeDifferential(ray, scale(bitangent, pixelAngle), normal, distance)),
      eye: worldPoint(frame, sub(q, scale(ray, distance))),
      light: worldPoint(frame, add(q, [3.7, 5.3, -2.1])),
    };
  }));
}
const FIXTURES = FRAMES.flatMap(frame => samples(frame).map(sample => ({ frame, sample })));

// Sensitive to anisotropic coordinates and normal classification; NOT a mother.
function syntheticHeight(q) { return Math.sin(2.3 * q[0] + 0.9 * q[2]) + 0.1 * q[1] ** 2 + 0.17 * q[0] * q[2]; }
function syntheticGradient(q) { const c = Math.cos(2.3 * q[0] + 0.9 * q[2]); return [2.3 * c + 0.17 * q[2], 0.2 * q[1], 0.9 * c + 0.17 * q[0]]; }
function derivative(q, direction, epsilon) { return (syntheticHeight(add(q, scale(direction, epsilon))) - syntheticHeight(sub(q, scale(direction, epsilon)))) / (2 * epsilon); }
function syntheticAnisotropicWitness(input) {
  return syntheticHeight(input.q) + (Math.abs(input.normal[0]) >= 0.72 ? 4 : 0) + 0.37 * input.normal[1] + 0.11 * input.normal[2] + 0.3 * input.footprint;
}

test('oracle coverage is deterministic: all 24 proper cube rotations plus arbitrary angles and reflected host frames', () => {
  assert.equal(CUBE_ROTATIONS.length, 24);
  assert.equal(new Set(CUBE_ROTATIONS.map(r => r.join(','))).size, 24);
  assert.equal(ROTATIONS.length, 92);
  for (const { name, R } of ROTATIONS) { orthogonal(R, name); close(det(R), 1, name); }
  for (const frame of FRAMES) orthogonal(frame.worldToLocal, frame.name);
  assert.equal(FRAMES.filter(f => det(f.worldToLocal) < 0).length, 3);
  assert.equal(FIXTURES.length, 90);
  const a = generator(0xEB88F00D), b = generator(0xEB88F00D);
  for (let i = 0; i < 32; i++) assert.equal(a(), b());
});

test('CPU contract: global rigid scene transform preserves all component-local material inputs', () => {
  for (const { frame, sample } of FIXTURES) {
    const expected = referenceInput(frame, sample);
    closeVector(expected.q, sample.q, 'known local point');
    closeVector(expected.normal, sample.localNormal, 'known local normal');
    for (const transform of ROTATIONS) {
      const next = transformed(frame, sample, transform);
      sameLocalInput(referenceInput(next.frame, next.sample), expected, `${frame.name}/${sample.name}/${transform.name}`);
    }
  }
});

test('CPU contract: normal and grazing ray footprints are metric, covariant, tangent to the surface', () => {
  for (const { frame, sample } of FIXTURES) {
    const local = referenceInput(frame, sample);
    close(dot(local.normal, local.dx), 0, 'dx is on surface');
    close(dot(local.normal, local.dy), 0, 'dy is on surface');
    close(length(local.normal), 1, 'normal length');
    close(dot(local.normal, local.tangent), 0, 'normal/tangent orthogonality');
    close(local.footprint, Math.max(length(sample.dx), length(sample.dy)), 'rigid metric footprint');
    close(local.footprint, 6.7 * 0.00017 / Math.cos(sample.angle), 'analytic incidence footprint');
    for (const transform of ROTATIONS) {
      const next = transformed(frame, sample, transform);
      close(referenceFootprint(next.frame, next.sample.dx, next.sample.dy), local.footprint, 'rotated footprint');
    }
  }
  const nominal = samples(FRAMES[0]);
  assert.ok(length(nominal[2].dx) > 100 * length(nominal[0].dx), 'grazing footprint cannot be replaced with normal-incidence pixel scale');
  close(referenceFootprint(FRAMES[1], [0,0,0], [0,0,0]), 0, 'zero footprint');
});

test('CPU contract: finite differences offset local coordinates by A*worldDelta, with equal symmetric footprint', () => {
  const epsilon = 0.00019;
  for (const { frame, sample } of FIXTURES) {
    const input = referenceInput(frame, sample);
    for (const worldTangent of [sample.tangent, sample.bitangent]) {
      const localTangent = referenceDirection(frame, worldTangent);
      closeVector(referencePoint(frame, add(sample.p, scale(worldTangent, epsilon))), add(input.q, scale(localTangent, epsilon)), 'positive local differential');
      closeVector(referencePoint(frame, sub(sample.p, scale(worldTangent, epsilon))), sub(input.q, scale(localTangent, epsilon)), 'negative local differential');
      const expected = derivative(input.q, localTangent, epsilon);
      close(expected, dot(syntheticGradient(input.q), localTangent), 'analytic directional derivative', 1e-7);
      for (const transform of ROTATIONS) {
        const next = transformed(frame, sample, transform);
        const nextInput = referenceInput(next.frame, next.sample);
        const nextDirection = referenceDirection(next.frame, mv(transform.R, worldTangent));
        close(derivative(nextInput.q, nextDirection, epsilon), expected, 'covariant finite difference', 2e-8);
        const plus = { ...nextInput, q: add(nextInput.q, scale(nextDirection, epsilon)) };
        const minus = { ...nextInput, q: sub(nextInput.q, scale(nextDirection, epsilon)) };
        assert.equal(plus.footprint, minus.footprint, 'opposite samples share exactly one filter footprint');
      }
    }
  }
});

test('CPU contract: local extents and local edge distances survive object rotation and translation', () => {
  for (const { frame, sample } of FIXTURES) {
    const before = referenceInput(frame, sample);
    const edgeDistances = [...sub(before.q, before.extentMin), ...sub(before.extentMax, before.q)];
    for (const transform of ROTATIONS) {
      const next = transformed(frame, sample, transform), after = referenceInput(next.frame, next.sample);
      assert.deepEqual(after.extentMin, frame.extentMin);
      assert.deepEqual(after.extentMax, frame.extentMax);
      closeVector([...sub(after.q, after.extentMin), ...sub(after.extentMax, after.q)], edgeDistances, 'component edge distances');
    }
  }
});

test('CPU contract: reflected host frames preserve polar normals without silently flipping tangent handedness', () => {
  for (const { frame, sample } of FIXTURES) {
    const A = frame.worldToLocal, handedness = det(A);
    const input = referenceInput(frame, sample);
    closeVector(cross(input.normal, input.tangent), scale(mv(A, cross(sample.n, sample.tangent)), handedness), 'cross-product determinant identity');
    closeVector(input.normal, sample.localNormal, 'outward polar normal');
    close(dot(input.normal, input.eyeDirection), dot(sample.n, unit(sub(sample.eye, sample.p))), 'normal/view incidence');
    close(dot(input.normal, input.lightDirection), dot(sample.n, unit(sub(sample.light, sample.p))), 'normal/light incidence');
    if (handedness < 0) {
      assert.ok(maxDifference(mv(A, cross(sample.n, sample.tangent)), cross(input.normal, input.tangent)) > 1, 'reflection must expose the cross-product handedness trap');
    }
  }
});

test('CPU contract: world weather/noise coordinate and component material coordinate remain separate', () => {
  const frame = FRAMES[1], sample = samples(frame)[5], before = referenceInput(frame, sample);
  const transform = { R: axisAngle([2,3,5], 1.127), translation: [11, -4, 7] };
  const next = transformed(frame, sample, transform), after = referenceInput(next.frame, next.sample);
  sameLocalInput(after, before, 'component material after scene transform');
  closeVector(after.worldNoiseP, add(mv(transform.R, before.worldNoiseP), transform.translation), 'world noise follows world position');
  assert.ok(maxDifference(before.worldNoiseP, after.worldNoiseP) > 1, 'world-anchored coordinates need not be invariant');
  const rebased = referenceInput({ ...frame, origin: add(frame.origin, [3,0,0]) }, sample);
  assert.deepEqual(rebased.worldNoiseP, before.worldNoiseP, 'same world point retains world noise through a component-origin change');
  assert.ok(maxDifference(rebased.q, before.q) > 1, 'different component origin changes local coordinates only');
});

test('regression witness: west-window q=(z,y,x) requires a local normal at the unchanged wood-mother boundary', () => {
  const frame = { ...FRAMES[1], origin: [0,0,0] }, sample = samples(frame)[2];
  const witness = { ...sample, p: [0.11,0.37,1.23], n: [1,0,0] };
  const correct = referenceInput(frame, witness), legacy = { ...correct, normal: witness.n };
  assert.deepEqual(correct.q, [1.23,0.37,0.11]);
  assert.deepEqual(correct.normal, [0,0,1]);
  assert.equal(Math.abs(correct.normal[0]) >= 0.72, false);
  assert.equal(Math.abs(legacy.normal[0]) >= 0.72, true);
  assert.ok(Math.abs(syntheticAnisotropicWitness(correct) - syntheticAnisotropicWitness(legacy)) > 3, 'old world normal picks the wrong anisotropic face');
  assert.throws(() => closeVector(legacy.normal, correct.normal, 'intentional legacy normal rejection'), /intentional legacy normal rejection/);
  const transform = { R: axisAngle([0,1,0], Math.PI / 2), translation: [3,4,5] };
  const next = transformed(frame, witness, transform), correctNext = referenceInput(next.frame, next.sample);
  close(syntheticAnisotropicWitness(correctNext), syntheticAnisotropicWitness(correct), 'correct sample witness invariant');
  const legacyNext = { ...correctNext, normal: next.sample.n };
  assert.ok(Math.abs(syntheticAnisotropicWitness(legacyNext) - syntheticAnisotropicWitness(legacy)) > 3, 'legacy binding fails rigid rotation covariance');
});

test('regression witness: adding a world tangent directly to local q gives the wrong derivative direction', () => {
  const frame = FRAMES[1], p = worldPoint(frame, [0.317,0.027,-0.051]), worldTangent = [0,0,1], epsilon = 0.001;
  const q = referencePoint(frame, p), localTangent = referenceDirection(frame, worldTangent);
  assert.deepEqual(localTangent, [1,0,0]);
  const correctPlus = add(q, scale(localTangent, epsilon)), legacyPlus = add(q, scale(worldTangent, epsilon));
  closeVector(correctPlus, referencePoint(frame, add(p, scale(worldTangent, epsilon))), 'correct world-to-local offset');
  assert.ok(maxDifference(correctPlus, legacyPlus) > epsilon * 0.9);
  assert.throws(() => closeVector(legacyPlus, correctPlus, 'intentional legacy tangent rejection'), /intentional legacy tangent rejection/);
  assert.ok(Math.abs(derivative(q, localTangent, epsilon) - derivative(q, worldTangent, epsilon)) > 0.1, 'anisotropic finite differences expose the legacy tangent bug');
});

test('regression witnesses reject wrong matrix composition, translating directions, and world-rotated local extents', () => {
  const frame = FRAMES[4], sample = samples(frame)[4];
  const transform = { R: axisAngle([1,2,4], 0.723), translation: [8,-5,3] };
  const next = transformed(frame, sample, transform), expected = referenceInput(frame, sample);
  const badMatrix = { ...next.frame, worldToLocal: mm(frame.worldToLocal, transform.R) };
  assert.ok(maxDifference(referencePoint(badMatrix, next.sample.p), expected.q) > 0.01, 'transpose omission is detectable');
  const badDirection = mv(next.frame.worldToLocal, sub(next.sample.n, next.frame.origin));
  assert.ok(maxDifference(badDirection, expected.normal) > 1, 'directions must not subtract origin');
  assert.ok(maxDifference(mv(transform.R, frame.extentMin), frame.extentMin) > 0.1, 'local extent rotation is detectable');
  const scaleFrame = { ...frame, worldToLocal: [2,0,0,0,1,0,0,0,1] };
  assert.throws(() => orthogonal(scaleFrame.worldToLocal, 'intentional nonrigid rejection'), /intentional nonrigid rejection/);
});

test('implementation binding: all material-frame.mjs CPU exports agree with the independent oracle', () => {
  for (const name of ['toLocalPoint', 'toLocalDirection', 'localFootprint', 'materialInput']) assert.equal(typeof implementation[name], 'function', name);
  for (const { frame, sample } of FIXTURES) for (const transform of ROTATIONS) {
    const next = transformed(frame, sample, transform), expected = referenceInput(next.frame, next.sample);
    closeVector(implementation.toLocalPoint(next.frame, next.sample.p), expected.q, 'implementation point');
    for (const key of ['n', 'tangent', 'bitangent', 'dx', 'dy']) {
      closeVector(implementation.toLocalDirection(next.frame, next.sample[key]), referenceDirection(next.frame, next.sample[key]), `implementation ${key}`);
    }
    close(implementation.localFootprint(next.frame, next.sample.dx, next.sample.dy), expected.footprint, 'implementation footprint');
    const input = implementation.materialInput(next.frame, { point: next.sample.p, normal: next.sample.n, tangent: next.sample.tangent, dx: next.sample.dx, dy: next.sample.dy });
    for (const [actualKey, expectedKey] of [['point','q'], ['normal','normal'], ['tangent','tangent'], ['dx','dx'], ['dy','dy'], ['extentMin','extentMin'], ['extentMax','extentMax'], ['worldNoisePosition','worldNoiseP']]) {
      closeVector(input[actualKey], expected[expectedKey], `materialInput.${actualKey}`);
    }
    close(input.footprint, expected.footprint, 'materialInput footprint');
  }
});

function functionBody(source, name) {
  const clean = source.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const match = new RegExp(`\\bfn\\s+${name}\\s*\\(`).exec(clean);
  assert.ok(match, `WGSL function ${name} exists`);
  const start = clean.indexOf('{', match.index);
  let depth = 1, end = start + 1;
  for (; end < clean.length && depth; end++) { if (clean[end] === '{') depth++; if (clean[end] === '}') depth--; }
  assert.equal(depth, 0, `WGSL function ${name} braces close`);
  return clean.slice(start + 1, end - 1).replace(/\s+/g, '');
}

test('source contract: actual WGSL routes wood normal, metric footprint and symmetric local offsets through one frame', () => {
  const source = shaderSource();
  const vector = functionBody(source, 'componentVector');
  assert.match(vector, /f\.component\.enabled>\.5&&u\.clock\.z>\.5/);
  assert.match(vector, /returnf\.component\.worldToLocal\*v;/);
  assert.match(functionBody(source, 'componentFootprint'), /max\(fp,max\(length\(componentVector\(f,dx\)\),length\(componentVector\(f,dy\)\)\)\)/);
  assert.match(functionBody(source, 'offsetComponent'), /g\.local\+=componentVector\(f,worldOffset\)/);
  assert.match(functionBody(source, 'componentTangent'), /letln=componentVector\(f,n\)/);
  assert.match(functionBody(source, 'componentTangent'), /transpose\(f\.component\.worldToLocal\)\*lt/);
  const raw = functionBody(source, 'surfaceRaw');
  assert.match(raw, /letlocalNormal=componentVector\(f,n\)/);
  assert.match(raw, /kpWoodOriginalSurface\(f\.local,localNormal,/);
  assert.doesNotMatch(raw, /kpWoodOriginalSurface\(f\.local,n,/);
  const normal = functionBody(source, 'materialNormal');
  for (const offset of ['t*e', '-t*e', 'b*e', '-b*e']) assert.ok(normal.includes(`offsetComponent(f,${offset})`), offset);
  assert.match(normal, /surfaceRaw\(fxp,p\+t\*e,n,fp\)\.height-surfaceRaw\(fxm,p-t\*e,n,fp\)\.height/);
  assert.match(normal, /surfaceRaw\(fyp,p\+b\*e,n,fp\)\.height-surfaceRaw\(fym,p-b\*e,n,fp\)\.height/);
  assert.match(functionBody(source, 'surface'), /surfaceRaw\(offsetComponent\(f,offset\),p\+offset,n,tangentFp\*\.25\)/);
  assert.match(functionBody(source, 'resolvedWeather'), /kpV26WaterWeather\(p\*\.10,n,/);
});

test('source contract: complete frame and unchanged local bounds survive gather-to-shade storage', () => {
  const source = shaderSource(), gather = functionBody(source, 'gatherSurface'), shade = functionBody(source, 'shade');
  assert.match(DOMAIN, /component:MaterialFrame/);
  for (let i = 0; i < 3; i++) assert.ok(gather.includes(`r.frame${i}=vec4<f32>(f.component.worldToLocal[${i}],`), `matrix column ${i}`);
  assert.match(gather, /r\.frameLower=vec4<f32>\(f\.component\.lower,0\.\)/);
  assert.match(gather, /r\.frameUpper=vec4<f32>\(f\.component\.upper,0\.\)/);
  assert.match(shade, /MaterialFrame\(mat3x3<f32>\(r\.frame0\.xyz,r\.frame1\.xyz,r\.frame2\.xyz\),r\.frameLower\.xyz,r\.frameUpper\.xyz,r\.frame0\.w\)/);
  assert.match(WINDOWS.replace(/\s+/g, ''), /MaterialFrame\(worldToWindow,vec3<f32>\(-radius\+\.025,0\.,\.01\),vec3<f32>\(radius-\.025,spring\+radius-\.025,\.21\),1\.\)/);
  const renderer = readFileSync(new URL('../renderer.mjs', import.meta.url), 'utf8');
  assert.match(renderer, /shadingBuffer=device\.createBuffer\(\{size:180224,/); // 11 vec4 * 16 bytes * 1024
  assert.equal(11 * 16 * 1024, 180224);
});

test('GPU probe preparation only: real mother closure, f32 record packing and independent input expectations', () => {
  const probe = buildFrameProbe();
  assert.equal(probe.cases.length, 504);
  assert.equal(new Set(probe.cases.map(c => c.group)).size, 18);
  assert.deepEqual(probe.closure.bindings.map(b => [b.group,b.binding,b.name]), [[0,0,'u'],[0,8,'frameProbeInput'],[0,9,'frameProbeOutput']]);
  assert.equal(probe.inputStride, 192);
  assert.equal(probe.outputStride, 112);
  assert.equal(probe.data.byteLength, probe.cases.length * probe.inputStride);
  for (const name of ['surfaceRaw','materialNormal','kpWoodOriginalSurface','kpWoodOriginalSample','componentFootprint','offsetComponent']) assert.ok(probe.closure.functionNames.includes(name), name);
  assert.ok(!probe.closure.functionNames.includes('sceneField'));
  assert.match(probe.closure.code, /let q=a\*\(p-v\.origin\.xyz\)/);
  const values = Array.from(probe.data);
  for (let index=0;index<probe.cases.length;index++) {
    const c=probe.cases[index],offset=index*48;
    const p=values.slice(offset,offset+3),origin=values.slice(offset+4,offset+7);
    const columns=[28,32,36].map(start=>values.slice(offset+start,offset+start+3));
    const matrix=transpose(columns.flat());
    closeVector(matrix,c.A,`${c.name} column-major pack`,2e-7);
    closeVector(mv(matrix,sub(p,origin)),c.expected.q,`${c.name} f32 local point`,FRAME_PROBE_TOLERANCES.localPointM);
    closeVector(values.slice(offset+40,offset+43),c.lower.map(Math.fround),`${c.name} local lower extent`,0);
    closeVector(values.slice(offset+44,offset+47),c.upper.map(Math.fround),`${c.name} local upper extent`,0);
  }
});

test('coverage receipt states the verification boundary', t => {
  t.diagnostic(JSON.stringify({
    scope: 'independent CPU rigid/orthogonal material-input contract and explicit legacy counterexamples',
    seed: '0xEB88F00D', cubeRotations: CUBE_ROTATIONS.length, arbitraryAndEdgeRotations: ROTATIONS.length - CUBE_ROTATIONS.length,
    hostFrames: FRAMES.length, reflectedHostFrames: FRAMES.filter(f => det(f.worldToLocal) < 0).length,
    pointNormalIncidenceFixtures: FIXTURES.length, rigidTransformCases: FIXTURES.length * ROTATIONS.length,
    legacyNormalAndTangentBugsRejected: true,
    gpuMotherExecuted: false, gpuRenderCompared: false, visualAcceptance: false,
    normalMatrixScope: 'orthogonal only; nonuniform scale/shear excluded',
    // Intentional failing assertions in regression witnesses are excluded from
    // any maximum-error claim. Their nonzero error is their expected result.
    tolerance: EPS,
  }));
});
