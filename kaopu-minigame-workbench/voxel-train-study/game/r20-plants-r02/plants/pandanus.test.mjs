import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as THREE from '../../../vendor/three.module.js';
import {
  createPandanus, PANDANUS_DEFAULT_PARAMS, PANDANUS_SOURCE_SHA256,
} from './pandanus.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const explicitSourcePath = process.env.PANDANUS_REFERENCE_SOURCE || process.env.PANDANUS_SOURCE_PATH;
const sourcePath = explicitSourcePath || fileURLToPath(
  new URL('../../../../../../sources/pandanus-r05-original.js', import.meta.url),
);
// An explicitly requested reference must be readable; do not silently skip CI.
const source = explicitSourcePath || existsSync(sourcePath) ? readFileSync(sourcePath, 'utf8') : null;
const configurations = [
  {},
  { seed: 50721, params: { age: 36, resource: 0.7, space: 0.55, leafDensity: 0.9 } },
  { seed: 873, params: { age: 52, resource: 0.7, space: 0.55, leafDensity: 0.9 } },
];
// These are native-source-equivalent component hashes, established against the
// SHA-256-pinned original with the same vendored Three r170. No renderer needed.
const GOLDENS = [
  '117358d6ea57b00ba3595a68b04db06e448dec25c5b12e365f76d005262c01e3',
  'f0bd8da719800cbe7a71931503a18f9d4556b65e86294b764c9b066e66dcda72',
  'b2c6fa608977267d8d5811efe39da958694e49c3a33b0f1f62c8deadebb1c75f',
];

function aggregateGeometryHash(meshes) {
  const hash = createHash('sha256');
  for (const name of Object.keys(meshes[0]?.geometry.attributes || {}).sort()) {
    hash.update(name);
    hash.update(String(meshes[0].geometry.attributes[name].itemSize));
    for (const mesh of meshes) hash.update(bytes(mesh.geometry.attributes[name].array));
  }
  let offset = 0;
  const indices = [];
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const count = geometry.getAttribute('position').count;
    for (const index of geometry.index?.array || Array.from({ length: count }, (_, i) => i)) {
      indices.push(index + offset);
    }
    offset += count;
  }
  hash.update(bytes(new Uint32Array(indices)));
  return hash.digest('hex');
}

function instanceHash(mesh) {
  return {
    count: mesh.count,
    geometry: aggregateGeometryHash([mesh]),
    matrix: sha(bytes(mesh.instanceMatrix.array)),
    color: mesh.instanceColor ? sha(bytes(mesh.instanceColor.array)) : null,
  };
}

function materialDescription(material) {
  return {
    color: material.color?.toArray(), vertexColors: material.vertexColors,
    roughness: material.roughness, metalness: material.metalness,
    side: material.side, transparent: material.transparent, opacity: material.opacity,
  };
}

function snapshot(root) {
  const [shoots, roots, leaves, details] = root.children;
  const scarObjects = details.children.filter(object => object.geometry?.type === 'TorusGeometry');
  const scarMatrix = [];
  for (const object of scarObjects) {
    if (object.isInstancedMesh) scarMatrix.push(...object.instanceMatrix.array);
    else {
      object.updateMatrix();
      scarMatrix.push(...new Float32Array(object.matrix.elements));
    }
  }
  const fruit = details.children.find(object => object.isGroup);
  let triangles = 0;
  root.traverse(object => {
    if (!object.isMesh) return;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 *
      (object.isInstancedMesh ? object.count : 1);
  });
  return {
    shoots: aggregateGeometryHash(shoots.children),
    roots: aggregateGeometryHash(roots.children),
    shootMaterial: materialDescription(shoots.children[0].material),
    rootMaterial: roots.children.length ? materialDescription(roots.children[0].material) : null,
    leaves: leaves.children.map(group => ({
      position: group.position.toArray(), quaternion: group.userData.base.toArray(),
      phase: group.userData.phase, ...instanceHash(group.children[0]),
      material: materialDescription(group.children[0].material),
    })),
    scars: scarObjects.length ? {
      geometry: aggregateGeometryHash([scarObjects[0]]),
      matrices: sha(bytes(new Float32Array(scarMatrix))),
      material: materialDescription(scarObjects[0].material),
    } : null,
    fruit: fruit ? {
      position: fruit.position.toArray(), ...instanceHash(fruit.children[0]),
      material: materialDescription(fruit.children[0].material),
    } : null,
    triangles,
  };
}

function originalGenerator(options = {}) {
  assert.ok(source, 'Original source is needed for the direct comparison.');
  assert.equal(sha(source), PANDANUS_SOURCE_SHA256, 'Do not silently compare against changed source.');
  const helpers = source.slice(source.indexOf('function rngFactory'), source.indexOf('function makeGround'));
  const materials = source.slice(source.indexOf('const barkMat'), source.indexOf('const rosettes'));
  const groups = source.slice(source.indexOf('const world'), source.indexOf('scene.add(world)'));
  const common = source.slice(source.indexOf('const clamp'), source.indexOf('const P'));
  const run = new Function('THREE', 'P', 'seed', `
    const $ = () => ({});
    const showRoots = true, showLeaves = true, showDetail = true;
    ${common}
    ${groups}
    ${materials}
    const rosettes = [];
    ${helpers}
    build();
    return world;
  `);
  return run(THREE, { ...PANDANUS_DEFAULT_PARAMS, ...options.params }, options.seed ?? 50721);
}

function disposeOriginal(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    if (object.material) materials.add(object.material);
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.clear();
}

function exactBounds(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  const instance = new THREE.Matrix4(), matrix = new THREE.Matrix4();
  root.traverse(object => {
    if (!object.isMesh) return;
    const positions = object.geometry.getAttribute('position');
    for (let i = 0; i < (object.isInstancedMesh ? object.count : 1); i += 1) {
      if (object.isInstancedMesh) {
        object.getMatrixAt(i, instance);
        matrix.multiplyMatrices(object.matrixWorld, instance);
      } else matrix.copy(object.matrixWorld);
      for (let j = 0; j < positions.count; j += 1) {
        bounds.expandByPoint(point.fromBufferAttribute(positions, j).applyMatrix4(matrix));
      }
    }
  });
  return bounds;
}

for (const [index, options] of configurations.entries()) {
  test(`deterministic source-pinned geometry/instance/material hash ${index}`, () => {
    const first = createPandanus(options), second = createPandanus(options);
    const signature = sha(JSON.stringify(snapshot(first.root)));
    assert.equal(signature, sha(JSON.stringify(snapshot(second.root))));
    assert.equal(signature, GOLDENS[index]);
    assert.deepEqual(first.proof, second.proof);
    first.dispose(); second.dispose();
  });

  test(`direct native source equation equivalence ${index}`, { skip: !source && 'Set PANDANUS_REFERENCE_SOURCE to the pinned original.' }, () => {
    const original = originalGenerator(options), adapted = createPandanus(options);
    assert.deepEqual(snapshot(adapted.root), snapshot(original));
    const before = exactBounds(original), after = exactBounds(adapted.root);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Math.abs(before.min[axis] - after.min[axis]) < 2e-6);
      assert.ok(Math.abs(before.max[axis] - after.max[axis]) < 2e-6);
    }
    let originalDraws = 0;
    original.traverse(object => { if (object.isMesh) originalDraws += 1; });
    assert.ok(adapted.proof.drawCalls < originalDraws, 'Batching reduces calls without deleting triangles.');
    disposeOriginal(original); adapted.dispose();
  });
}

test('source leaf profile keeps 145 folded/toothed vertices and 224 triangles', () => {
  const asset = createPandanus();
  const geometry = asset.root.getObjectByName('rosettes').children[0].children[0].geometry;
  assert.equal(geometry.attributes.position.count, 29 * 5);
  assert.equal(geometry.index.count / 3, 28 * 4 * 2);
  for (let i = 0; i <= 28; i += 1) {
    const u = i / 28;
    const profile = Math.sin(Math.PI * Math.min(0.999, u)) ** 0.62 * (1 - 0.18 * u);
    const width = (0.018 + 0.115 * profile) * (i % 2 ? 1.055 : 0.965);
    const centerY = 0.09 * Math.sin(Math.PI * u) - 0.38 * u * u;
    const xs = [-1, -0.46, 0, 0.46, 1], cross = [0, 0.038, -0.018, 0.038, 0];
    for (let column = 0; column < 5; column += 1) {
      const vertex = i * 5 + column;
      assert.equal(geometry.attributes.position.getX(vertex), Math.fround(xs[column] * width));
      assert.equal(geometry.attributes.position.getY(vertex), Math.fround(centerY + cross[column] * (1 - u * 0.45)));
      assert.equal(geometry.attributes.position.getZ(vertex), Math.fround(u));
    }
  }
  asset.dispose();
});

test('finite nondegenerate topology, normals, instances and metre bounds over age range', () => {
  for (const age of [0, 3, 30, 36, 44, 52, 72, 120]) {
    const asset = createPandanus({ params: { age, resource: 0.7, space: 0.55 } });
    const seen = new Set();
    asset.root.traverse(object => {
      if (!object.isMesh || seen.has(object.geometry)) return;
      seen.add(object.geometry);
      const geometry = object.geometry, position = geometry.getAttribute('position');
      for (const attribute of Object.values(geometry.attributes)) {
        assert.ok([...attribute.array].every(Number.isFinite));
      }
      const indices = geometry.index?.array || Array.from({ length: position.count }, (_, i) => i);
      assert.equal(indices.length % 3, 0);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      for (let i = 0; i < indices.length; i += 3) {
        for (let j = 0; j < 3; j += 1) assert.ok(indices[i + j] >= 0 && indices[i + j] < position.count);
        a.fromBufferAttribute(position, indices[i]);
        b.fromBufferAttribute(position, indices[i + 1]);
        c.fromBufferAttribute(position, indices[i + 2]);
        assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-18, 'No zero-area faces.');
      }
      const normal = geometry.getAttribute('normal');
      for (let i = 0; i < normal.count; i += 1) {
        assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-5);
      }
      if (object.isInstancedMesh) {
        assert.ok([...object.instanceMatrix.array].every(Number.isFinite));
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < object.count; i += 1) { object.getMatrixAt(i, matrix); assert.ok(matrix.determinant() > 0); }
      }
    });
    assert.equal(seen.size, asset.proof.geometries);
    assert.deepEqual(exactBounds(asset.root).min.toArray(), asset.proof.bounds.min);
    assert.deepEqual(exactBounds(asset.root).max.toArray(), asset.proof.bounds.max);
    assert.ok(asset.proof.bounds.size.every(value => value > 0 && value < 20));
    assert.equal(asset.root.scale.x, 1);
    assert.equal(asset.proof.units, 'source-engineering-metres');
    assert.ok(asset.proof.bounds.min[1] < 0, 'Native roots must retain subsurface extensions.');
    asset.dispose();
  }
});

test('breeze exactly follows host seconds, is seekable and stays within conservative envelope', () => {
  const asset = createPandanus();
  const groups = asset.root.getObjectByName('rosettes').children;
  const envelope = new THREE.Box3(new THREE.Vector3(...asset.proof.breezeBounds.min), new THREE.Vector3(...asset.proof.breezeBounds.max));
  for (const seconds of [0, 0.016, 1, 5, 15, 80, 3600, 0]) {
    asset.update(seconds);
    for (const group of groups) {
      const now = seconds * 1000;
      const expected = group.userData.base.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
        0.008 * Math.sin(now * 0.0011 + group.userData.phase), 0,
        0.013 * Math.sin(now * 0.00135 + group.userData.phase * 1.7),
      )));
      group.quaternion.toArray().forEach((value, i) => assert.ok(Math.abs(value - expected.toArray()[i]) < 2e-13));
    }
    assert.ok(envelope.containsBox(exactBounds(asset.root)));
  }
  const once = groups.map(group => group.quaternion.toArray());
  asset.update(0);
  assert.deepEqual(groups.map(group => group.quaternion.toArray()), once);
  assert.throws(() => asset.update(NaN), RangeError);
  assert.throws(() => asset.update(-1), RangeError);
  asset.dispose();
  assert.equal(asset.update(1), false);
});

test('dispose releases shared geometries/materials and instance buffers once, owners remain isolated', () => {
  const asset = createPandanus(), another = createPandanus();
  const resources = new Set();
  asset.root.traverse(object => {
    if (object.geometry) resources.add(object.geometry);
    if (object.material) resources.add(object.material);
    if (object.isInstancedMesh) resources.add(object);
  });
  const counts = new Map([...resources].map(resource => [resource, 0]));
  for (const resource of resources) resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource) + 1));
  const parent = new THREE.Group(); parent.add(asset.root);
  const anotherBefore = sha(JSON.stringify(snapshot(another.root)));
  asset.dispose(); asset.dispose();
  assert.ok([...counts.values()].every(count => count === 1));
  assert.equal(asset.root.children.length, 0);
  assert.equal(parent.children.length, 0);
  assert.equal(sha(JSON.stringify(snapshot(another.root))), anotherBefore);
  another.update(1); another.dispose();
});

test('parameter validation is explicit; seed changes geometry and normalized seeds reproduce', () => {
  for (const params of [{ age: NaN }, { space: Infinity }, { rootSupport: -1 }, { leafDensity: 2 }, { unknown: 2 }]) {
    assert.throws(() => createPandanus({ params }));
  }
  assert.throws(() => createPandanus({ seed: NaN }));
  const first = createPandanus({ seed: 1 }), second = createPandanus({ seed: 2 });
  assert.notEqual(sha(JSON.stringify(snapshot(first.root))), sha(JSON.stringify(snapshot(second.root))));
  const input = { age: 36 }, independent = createPandanus({ params: input });
  input.age = 80;
  assert.equal(independent.proof.params.age, 36);
  assert.ok(Object.isFrozen(independent.proof.params));
  const minus = createPandanus({ seed: -1 }), unsigned = createPandanus({ seed: 4294967295 });
  assert.equal(sha(JSON.stringify(snapshot(minus.root))), sha(JSON.stringify(snapshot(unsigned.root))));
  for (const asset of [first, second, independent, minus, unsigned]) asset.dispose();
});

test('host integration has no private scene, renderer, DOM, clock, animation loop or asset fetch', () => {
  const runtime = readFileSync(new URL('./pandanus.mjs', import.meta.url), 'utf8');
  assert.equal(runtime.match(/from ['"]([^'"]+)['"]/)[1], '../../../vendor/three.module.js');
  for (const pattern of [/new THREE\.(?:Scene|PerspectiveCamera|WebGLRenderer|Clock)\(/, /\b(?:document|window)\./, /\brequestAnimationFrame\s*\(/, /\bperformance\.now\s*\(/, /\bfetch\s*\(/, /\bDate\.now\s*\(/]) {
    assert.doesNotMatch(runtime, pattern);
  }
});
