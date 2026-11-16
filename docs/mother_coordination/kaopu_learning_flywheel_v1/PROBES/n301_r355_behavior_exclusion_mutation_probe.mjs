import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const packageDir = process.env.R355_PACKAGE_DIR;
if (!packageDir) throw new Error('R355_PACKAGE_DIR_REQUIRED');
const runtimeUrl = pathToFileURL(path.join(packageDir, 'tests', 'node-runtime.mjs')).href;
const { read, T, createLearningSystem } = await import(runtimeUrl);

function snapshotMatrices(objects) {
  return objects.map((object) => object.matrixWorld.toArray());
}

function countChanged(objects, before) {
  return objects.filter((object, index) =>
    object.matrixWorld.elements.some((value, element) => value !== before[index][element]),
  ).length;
}

function createFixture() {
  const system = createLearningSystem(read, { THREE: T });
  const pair = system.whole.model.machine.lower.pair;
  const frozen = system.packageWheelPolicy.nodes;
  const frozenPoses = frozen.map((object) => object.quaternion.toArray());
  const nonTargets = [];
  pair.root.traverse((object) => {
    if (object.isMesh && !frozen.includes(object)) nonTargets.push(object);
  });
  pair.root.updateMatrixWorld(true);
  return { system, pair, frozen, frozenPoses, nonTargets };
}

function targetGuard(frozen, frozenPoses) {
  return frozen.every((object, index) =>
    object.quaternion.toArray().every((value, element) => value === frozenPoses[index][element]),
  );
}

function baseline() {
  const fixture = createFixture();
  const before = snapshotMatrices(fixture.nonTargets);
  fixture.pair.setTravel(123, 321);
  fixture.pair.root.updateMatrixWorld(true);
  const result = {
    targetFrozen: targetGuard(fixture.frozen, fixture.frozenPoses),
    nonTargetChanged: countChanged(fixture.nonTargets, before),
  };
  fixture.system.dispose();
  return result;
}

function adjacentMotionDisabledMutant() {
  const fixture = createFixture();
  const before = snapshotMatrices(fixture.nonTargets);
  const guardedSetTravel = fixture.pair.setTravel;
  fixture.pair.setTravel = () => {};
  fixture.pair.setTravel(123, 321);
  fixture.pair.root.updateMatrixWorld(true);
  const result = {
    targetFrozen: targetGuard(fixture.frozen, fixture.frozenPoses),
    nonTargetChanged: countChanged(fixture.nonTargets, before),
  };
  fixture.pair.setTravel = guardedSetTravel;
  fixture.system.dispose();
  return result;
}

function targetDriftMutant() {
  const fixture = createFixture();
  fixture.frozen[0].quaternion.x += 0.01;
  const result = {
    targetFrozen: targetGuard(fixture.frozen, fixture.frozenPoses),
  };
  fixture.system.dispose();
  return result;
}

const result = {
  baseline: baseline(),
  adjacentMotionDisabledMutant: adjacentMotionDisabledMutant(),
  targetDriftMutant: targetDriftMutant(),
};

assert.equal(result.baseline.targetFrozen, true);
assert(result.baseline.nonTargetChanged > 1000);
assert.equal(result.adjacentMotionDisabledMutant.targetFrozen, true);
assert.equal(result.adjacentMotionDisabledMutant.nonTargetChanged, 0);
assert.equal(result.targetDriftMutant.targetFrozen, false);

console.log(JSON.stringify(result, null, 2));
