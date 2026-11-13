import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prepareTileFrame, prepareTileFrustum, aabbIntersectsTile, transformBounds } from '../whole-building-mobile-r01/tile-visibility.mjs';
import { deriveStairRails, createRailInstance, railToWorld } from '../whole-building-interaction-r01/rails.mjs';
import { deriveMeasuredCase } from '../r07/cases.mjs';
import { deriveWholeBuilding } from '../whole-building-interaction-r01/tower.mjs';

const norm = a => { const l = Math.hypot(...a); return a.map(v => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b) => a.map((v, i) => v + b[i]);
const pointAt = (o, d, t) => o.map((v, i) => v + t * d[i]);
const box = (p, half = [0, 0, 0]) => ({ min: p.map((v, i) => v - half[i]), max: p.map((v, i) => v + half[i]) });
const camera = (extra = {}) => ({ eye: [0, 0, 0], target: [0, 0, -1], fov: Math.PI / 2, width: 512, height: 512, ...extra });
const fullTile = c => ({ x: 0, y: 0, width: c.width, height: c.height });
const frustum = (c, tile = fullTile(c)) => prepareTileFrustum(prepareTileFrame(c), tile);
const contains = (b, p, epsilon = 0) => p.every((v, i) => v >= b.min[i] - epsilon && v <= b.max[i] + epsilon);
const near = (a, b, e = 1e-12) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
let seed = 0x1a2b3c4d;
function random() { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }

// Independent reference implements the GLSL equation, not exported basis/planes.
// Float32 mode rounds each arithmetic operation to sample shader-style drift.
function referenceRay(c, x, y, float32 = false) {
  const q = float32 ? Math.fround : v => v;
  const normalize = a => { const l = q(Math.sqrt(q(q(a[0] * a[0]) + q(q(a[1] * a[1]) + q(a[2] * a[2]))))); return a.map(v => q(v / l)); };
  const cp = (a, b) => [q(q(a[1] * b[2]) - q(a[2] * b[1])), q(q(a[2] * b[0]) - q(a[0] * b[2])), q(q(a[0] * b[1]) - q(a[1] * b[0]))];
  const eye = c.eye.map(Math.fround), target = c.target.map(Math.fround);
  const f = normalize(target.map((v, i) => q(v - eye[i])));
  const r = normalize(cp(f, Math.abs(f[1]) > .999 ? [0, 0, 1] : [0, 1, 0])), u = cp(r, f);
  const sx = q(q(q(2 * x) - c.width) / c.height), sy = q(q(q(2 * y) - c.height) / c.height), t = q(Math.tan(q(Math.fround(c.fov) * .5)));
  return normalize(f.map((v, i) => q(v + q(t * q(q(sx * r[i]) + q(sy * u[i]))))));
}

// Independent closed ray/AABB slab oracle. No invented near plane or epsilon.
function slabHit(origin, direction, bounds) {
  let lo = 0, hi = Infinity;
  for (let i = 0; i < 3; i++) {
    if (direction[i] === 0) { if (origin[i] < bounds.min[i] || origin[i] > bounds.max[i]) return false; continue; }
    const a = (bounds.min[i] - origin[i]) / direction[i], b = (bounds.max[i] - origin[i]) / direction[i];
    lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b));
    if (lo > hi) return false;
  }
  return true;
}

test('camera basis matches current shader, including vertical fallback and bottom-left non-square edges', () => {
  const source = fs.readFileSync(new URL('../whole-building-interaction-r01/renderer.mjs', import.meta.url), 'utf8');
  assert.match(source, /uv=\(2\.\*gl_FragCoord\.xy-uResolution\)\/uResolution\.y/);
  assert.match(source, /abs\(f\.y\)>\.999\?vec3\(0,0,1\):vec3\(0,1,0\)/);
  for (const target of [[0, 0, -1], [0, 1, 0], [0, -1, 0], [1e-5, 1, 1e-5], [.03, -.999, .01], [1, 2, 3]]) {
    const c = camera({ target, width: 913, height: 377 }), frame = prepareTileFrame(c), before = structuredClone(c);
    near(Math.hypot(...frame.forward), 1); near(Math.hypot(...frame.right), 1); near(Math.hypot(...frame.up), 1);
    for (const [x, y] of [[0, 0], [913, 377], [111.5, 123.5], [456.5, 188.5]]) {
      const sx = frame.tanHalfFov * (2 * x - c.width) / c.height, sy = frame.tanHalfFov * (2 * y - c.height) / c.height;
      const actual = norm(frame.forward.map((v, i) => v + sx * frame.right[i] + sy * frame.up[i]));
      actual.forEach((v, i) => near(v, referenceRay(c, x, y)[i]));
    }
    assert.deepEqual(c, before);
  }
  const c = camera({ width: 1000, height: 100 }), f = frustum(c);
  assert.equal(aabbIntersectsTile(f, box([50, 0, -10])), true, 'horizontal slope must include aspect ratio');
  assert.equal(aabbIntersectsTile(f, box([0, 50, -10])), false, 'vertical slope must not use viewport width');
  assert.equal(aabbIntersectsTile(frustum(c, { x: 0, y: 50, width: 1000, height: 50 }), box([0, -5, -10])), false);
});

test('closed pixel-edge planes retain boundary and zero-width hits, while rejecting clearly outside boxes', () => {
  const c = camera(), tile = { x: 128, y: 64, width: 192, height: 256 }, f = frustum(c, tile);
  for (const x of [tile.x, tile.x + .5, tile.x + tile.width - .5, tile.x + tile.width]) for (const y of [tile.y, tile.y + .5, tile.y + tile.height - .5, tile.y + tile.height]) {
    for (const depth of [1e-12, 1e-6, 1, 100, 1e8]) for (const float32 of [false, true]) {
      const p = pointAt(c.eye, referenceRay(c, x, y, float32), depth);
      assert.equal(aabbIntersectsTile(f, box(p)), true, `edge lost: ${x},${y},${depth}`);
    }
  }
  assert.equal(aabbIntersectsTile(f, box([100, 0, -10])), false);
  assert.equal(aabbIntersectsTile(f, box([0, 100, -10])), false);
  assert.equal(aabbIntersectsTile(f, box([0, 0, 10])), false);
});

test('camera inside, touching eye, near-plane crossings, degenerate domains and almost-parallel rays are retained', () => {
  const c = camera({ width: 1003, height: 277 });
  for (const tile of [{ x: 0, y: 0, width: 1, height: 1 }, { x: 1002, y: 276, width: 1, height: 1 }, fullTile(c)]) {
    const f = frustum(c, tile);
    assert.equal(aabbIntersectsTile(f, box(c.eye, [3, 4, 5])), true);
    assert.equal(aabbIntersectsTile(f, box(c.eye)), true);
    assert.equal(aabbIntersectsTile(f, { min: [-100, -100, -1e-12], max: [100, 100, 10] }), true);
    assert.equal(aabbIntersectsTile(f, box([0, 0, 10], [1, 1, 1])), false);
  }
  for (const fov of [1e-8, Math.PI - .0001]) {
    const q = camera({ fov }), f = frustum(q);
    for (const [x, y] of [[0, 0], [512, 512], [256, 256], [256 + 1e-7, 256]]) {
      const d = referenceRay(q, x, y), p = pointAt(q.eye, d, 1e6), b = box(p, [1e-8, 1e-8, 1e-8]);
      assert.equal(slabHit(q.eye, d, b), true); assert.equal(aabbIntersectsTile(f, b), true);
    }
  }
});

test('uncertain up branch, collapsed Float32 cameras and missing bounds fail open', () => {
  for (const y of [.999 - 1e-7, .999, .999 + 1e-7]) {
    const c = camera({ target: [Math.sqrt(1 - y * y), y, 0] }), frame = prepareTileFrame(c);
    assert.equal(frame.sidePlanesReliable, false);
    assert.equal(prepareTileFrustum(frame, { x: 0, y: 0, width: 1, height: 1 }).planes.length, 1);
  }
  const c = camera({ eye: [1e9, 1e9, 1e9], target: [1e9 + 1, 1e9, 1e9] }), f = frustum(c);
  assert.equal(prepareTileFrame(c).valid, false); assert.equal(aabbIntersectsTile(f, box([0, 0, 0])), true);
  for (const bounds of [null, {}, { min: [NaN, 0, 0], max: [1, 1, 1] }, { min: [2, 0, 0], max: [1, 1, 1] }]) assert.equal(aabbIntersectsTile(frustum(camera()), bounds), true);
  assert.throws(() => prepareTileFrame(camera({ height: 0 })), /dimensions/);
  assert.throws(() => prepareTileFrame(camera({ fov: Math.PI })), /FOV/);
  assert.throws(() => prepareTileFrustum(prepareTileFrame(camera()), { x: 0, y: 0, width: -1, height: 1 }), /tile/);
});

test('deterministic sampled rays/AABB intersections have no observed false negatives (sampling, not proof)', () => {
  let intersections = 0, rejected = 0;
  for (let view = 0; view < 48; view++) {
    const eye = Array.from({ length: 3 }, () => (random() - .5) * (view % 7 === 0 ? 1e6 : 400));
    let target = add(eye, norm(Array.from({ length: 3 }, () => random() - .5)).map(v => v * 100));
    if (view % 8 === 0) target = add(eye, [0, view % 16 ? -100 : 100, 0]);
    const c = camera({ eye, target, fov: .15 + random() * 2.6, width: 213 + Math.floor(random() * 1000), height: 191 + Math.floor(random() * 800) }), frame = prepareTileFrame(c), origin = c.eye.map(Math.fround);
    for (let tileIndex = 0; tileIndex < 16; tileIndex++) {
      const x = Math.floor(random() * (c.width - 1)), y = Math.floor(random() * (c.height - 1));
      const tile = { x, y, width: Math.min(128, c.width - x), height: Math.min(96, c.height - y) }, f = prepareTileFrustum(frame, tile);
      const rays = Array.from({ length: 12 }, (_, j) => referenceRay(c, x + (j < 4 ? j % 2 : random()) * tile.width, y + (j < 4 ? Math.floor(j / 2) : random()) * tile.height, j % 2 === 0));
      const boxes = rays.map((d, j) => box(pointAt(origin, d, 10 ** (-4 + random() * 8)), Array.from({ length: 3 }, () => j % 4 ? random() * 2 : 0)));
      boxes.push(...Array.from({ length: 8 }, () => box(add(origin, Array.from({ length: 3 }, () => (random() - .5) * 1000)), [random() * 20, random() * 20, random() * 20])));
      for (const b of boxes) {
        const keep = aabbIntersectsTile(f, b); if (!keep) rejected++;
        for (const ray of rays) if (slabHit(origin, ray, b)) { intersections++; assert.equal(keep, true, `sampled hit lost at view=${view}, tile=${tileIndex}`); }
      }
    }
  }
  assert.ok(intersections > 5000, `only ${intersections} intersecting samples`);
  assert.ok(rejected > 2000, `only ${rejected} boxes culled; test must exercise rejection`);
});

test('affine bounds include every transformed corner, tiny boxes, reflection and arbitrary full rotations', () => {
  for (let i = 0; i < 100; i++) {
    const a = random() * 6, b = random() * 6;
    const xAxis = [Math.cos(a), Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b)], yAxis = [-Math.sin(a), Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b)], zAxis = [0, -Math.sin(b), Math.cos(b)];
    if (i % 2) xAxis.forEach((v, k) => xAxis[k] = -2 * v);
    const frame = { origin: [13, -18, 102], xAxis, yAxis, zAxis }, local = box([1, -2, 3], i % 3 ? [2, 7, .4] : [1e-12, 0, 1e-12]), world = transformBounds(local, frame);
    for (let bits = 0; bits < 8; bits++) {
      const p = [0, 1, 2].map(k => local[(bits >> k) & 1 ? 'max' : 'min'][k]);
      const q = frame.origin.map((v, k) => v + xAxis[k] * p[0] + yAxis[k] * p[1] + zAxis[k] * p[2]);
      assert.equal(contains(world, q), true);
    }
  }
  assert.equal(transformBounds(null), null);
  assert.equal(transformBounds(box([0, 0, 0]), { origin: [NaN, 0, 0] }), null);
});

test('rail full local-to-world bounds include all arc bounds, tube radii and embedded support posts', () => {
  const rail = deriveStairRails({ floorHeight: 3.2 });
  for (const angle of [0, .37, Math.PI / 2, 2.4, Math.PI]) {
    const frame = { origin: [30, 19, -17], xAxis: [Math.cos(angle), 0, Math.sin(angle)], zAxis: [-Math.sin(angle), 0, Math.cos(angle)] }, instance = createRailInstance(rail, { frame }), bounds = transformBounds(rail.bounds, frame);
    assert.ok(rail.primitives.some(p => p.component === 'support'));
    assert.ok(rail.primitives.some(p => p.kind === 'arc'));
    for (const p of rail.primitives) for (let bits = 0; bits < 8; bits++) {
      const corner = [0, 1, 2].map(k => p.surfaceBounds[(bits >> k) & 1 ? 'max' : 'min'][k]);
      assert.equal(contains(bounds, railToWorld(corner, frame)), true);
    }
    for (const s of instance.supports) for (const p of [s.startWorld, s.endWorld, s.anchorWorld]) assert.equal(contains(bounds, p), true);
    for (let k = 0; k < 3; k++) { assert.ok(bounds.min[k] <= instance.bounds.min[k]); assert.ok(bounds.max[k] >= instance.bounds.max[k]); }
    assert.ok(bounds.min[1] < frame.origin[1], 'embedded support bottoms must not be replaced by handrail-only bounds');
  }
});

test('sampled real source/archetype/rail domains remain visible across tiles and rotated camera views', () => {
  const score = JSON.parse(fs.readFileSync(new URL('../../hk-three-buildings-r01/geometry/B359971994401063C0.score.json', import.meta.url)));
  const measured = deriveMeasuredCase(score), footprints = JSON.parse(fs.readFileSync(new URL('../r07/sources/official-footprints.json', import.meta.url))), model = deriveWholeBuilding(measured, footprints);
  const bounds = [measured.bounds, ...model.instances.map(i => transformBounds(model.archetypes.find(a => a.id === i.archetypeId).bounds, { origin: i.translation })), ...model.rails.instances.map(i => transformBounds(i.template.bounds, i.frame))];
  let intersections = 0, rejections = 0;
  for (const eye of [[45, 45, -65], [-65, 20, 30], [0, 150, 0], [0, -30, 0], [2, 25, 1]]) {
    const c = camera({ eye, target: [0, 25, 0], fov: Math.PI / 4, width: 390, height: 721 }), frame = prepareTileFrame(c);
    for (let y = 0; y < c.height; y += 128) for (let x = 0; x < c.width; x += 128) {
      const tile = { x, y, width: Math.min(128, c.width - x), height: Math.min(128, c.height - y) }, f = prepareTileFrustum(frame, tile);
      const rays = [0, .5, 1].flatMap(u => [0, .5, 1].map(v => referenceRay(c, x + u * tile.width, y + v * tile.height)));
      for (const b of bounds) {
        const keep = aabbIntersectsTile(f, b); if (!keep) rejections++;
        for (const r of rays) if (slabHit(frame.eye, r, b)) { intersections++; assert.equal(keep, true); }
      }
    }
  }
  assert.ok(intersections > 500); assert.ok(rejections > 1000);
});
