import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// Pure arithmetic review of the historical records. It does not rerun a CPU
// performance measurement, invoke a browser, or require npm dependencies.
const sourceURL = new URL('./evidence/recorded-shoe-sharing.json', import.meta.url);
const clothURL = new URL('../cloth/cloth-component-bench-r02.json', import.meta.url);
const shoeBytes = await fs.readFile(sourceURL);
const clothBytes = await fs.readFile(clothURL);
const shoes = JSON.parse(shoeBytes), cloth = JSON.parse(clothBytes);
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
assert.equal(sha(shoeBytes), '70a2ecc0862783e425af2f32dbaf36e9ed3ca393f9966708f8464b09b71ac396');
assert.equal(sha(clothBytes), 'bf6c2f6497a60b7911cd274154cb30148a3338ce0a4ddef7e009f5a0df612476',
  'Use the archived R02 record; a fresh timing run has a different identity.');

const clothRows = [];
assert.equal(cloth.schema, 'native-cloth-component-benchmark@2');
assert.equal(cloth.scope.rendering, false);
assert.equal(cloth.scope.gpuMeasured, false);
assert.equal(cloth.scope.latestR07Fit, false);
assert.deepEqual(cloth.settings.roundPopulationOrders, [[1, 2, 4], [4, 2, 1]]);
assert.equal(cloth.scenarios.length, 6);
for (const scenario of cloth.scenarios) {
  const samples = [...scenario.timingMS].sort((a, b) => a - b);
  assert.equal(samples.length, 120);
  assert.ok(samples.every(x => Number.isFinite(x) && x >= 0));
  const computed = {n: samples.length, mean: samples.reduce((n, x) => n + x, 0) / samples.length,
    p50: samples[Math.floor(samples.length * .5)],
    p95: samples[Math.ceil(samples.length * .95) - 1], min: samples[0], max: samples.at(-1)};
  for (const [key, value] of Object.entries(computed))
    assert.ok(Math.abs(value - scenario.frameMS[key]) < 1e-8, 'R02 statistic drift: ' + key);
  assert.equal(scenario.completedWarmupSteps, 60);
  assert.equal(scenario.completedMeasuredSteps, 120);
  assert.equal(scenario.actualActorSteps, 180 * scenario.population);
  assert.ok(Math.abs(scenario.actualActorSimulationSeconds - 3 * scenario.population) < 1e-8);
  assert.equal(scenario.failure, null);
  assert.equal(scenario.gates.newRollbacks, 0);
  assert.equal(scenario.gates.newSafetyTrips, 0);
  assert.equal(scenario.gates.wearingQualityAccepted, false);
  assert.equal(scenario.gates.penetrationObservedAtStartOrEnd, true);
  assert.equal(scenario.endState.length, scenario.population);
  for (let i = 0; i < scenario.population; i++) {
    const start = scenario.startState[i], end = scenario.endState[i];
    assert.ok(Math.abs(end.simulationSeconds - start.simulationSeconds - 3) < 1e-8);
    assert.ok(Math.abs(end.motionSeconds - start.motionSeconds - 3) < 1e-8);
    assert.equal(end.frameSequence - start.frameSequence, 180);
    assert.ok(start.pairMinimumSampleMM < 0, 'Starting fixture already has a negative contact sample');
    assert.ok(end.garments.every(g => g.finite));
  }
  clothRows.push({round: scenario.round, actors: scenario.population,
    cpuStepWallMS: computed, simulatedSecondsPerActor: 3, measuredSteps: 120,
    wearingQualityAccepted: false});
}

const shoeRows = [];
assert.equal(shoes.allChecksPassed, true);
assert.equal(shoes.rows.length, 16);
assert.equal(shoes.runtime.gpuContextCreated, false);
assert.equal(shoes.scope.nativePairAlreadyShared, true);
for (const row of shoes.rows) {
  const original = shoes.styles.find(s => s.id === row.style).originalOneShoe;
  const a = row.nativePerActorGeometrySharedMaterials, b = row.sharedAcrossActors;
  assert.ok([1, 4, 8, 16].includes(row.actors));
  assert.equal(row.shoes, row.actors * 2);
  assert.equal(a.retainedGeometryArrayBufferBytes, original.retainedGeometryArrayBufferBytes * row.actors);
  assert.equal(b.retainedGeometryArrayBufferBytes, original.retainedGeometryArrayBufferBytes);
  assert.equal(a.uniqueGeometryCount, original.uniqueGeometryCount * row.actors);
  assert.equal(b.uniqueGeometryCount, original.uniqueGeometryCount);
  assert.equal(a.meshCount, b.meshCount);
  assert.equal(a.object3DCount, b.object3DCount);
  assert.equal(a.uniqueMaterialCount, b.uniqueMaterialCount);
  assert.equal(a.uniqueTextureCount, b.uniqueTextureCount);
  const savingPercent = 100 * (1 - b.retainedGeometryArrayBufferBytes / a.retainedGeometryArrayBufferBytes);
  assert.equal(row.geometrySavingPercent, savingPercent);
  assert.equal(row.geometryBytesSaved, a.retainedGeometryArrayBufferBytes - b.retainedGeometryArrayBufferBytes);
  assert.equal(row.checks.worldTransformsExactlyEqual, true);
  assert.equal(row.checks.sharedSourceBuffersUnchangedAfterTransforms, true);
  assert.equal(row.checks.sourceMaterialsUnchanged, true);
  assert.equal(row.checks.sharedChecks.byteExactGeometry, true);
  assert.equal(row.checks.sharedChecks.materialParametersAndGeneratedShaderSourceEqual, true);
  assert.equal(row.checks.sharedIsolation.otherShoeUnchanged, true);
  assert.equal(row.checks.sharedIsolation.otherActorUnchanged, row.actors > 1 ? true : 'not-applicable');
  shoeRows.push({style: row.style, actors: row.actors, shoes: row.shoes,
    geometryArrayBufferBytesBefore: a.retainedGeometryArrayBufferBytes,
    geometryArrayBufferBytesAfter: b.retainedGeometryArrayBufferBytes,
    savingPercent, geometryObjectsBefore: a.uniqueGeometryCount,
    geometryObjectsAfter: b.uniqueGeometryCount, meshObjectsUnchanged: b.meshCount,
    materialObjectsUnchanged: b.uniqueMaterialCount});
}

const summary = {schema: 'native-component-record-review@1',
  verification: 'Independent arithmetic and recorded-assertion review; no performance run',
  inputSha256: {shoes: sha(shoeBytes), clothR02: sha(clothBytes)},
  clothRows, shoeRows,
  conclusions: {completeNpcSceneFpsMeasured: false, gpuFpsMeasured: false,
    clothCPUOnly: true, clothFitInitializationSkipped: true, clothWearingQualityAccepted: false,
    shoeSavingAppliesOnlyToReachableGeometryArrayBufferPayload: true,
    primaryBaselineAlreadySharesLeftRightShoesAndMaterials: true,
    shoeDrawCountAndTriangleCountReduced: false, shoePhysicalSolverAdded: false},
  allReviewedAssertionsPassed: true};
await fs.mkdir(new URL('./results/', import.meta.url), {recursive: true});
await fs.writeFile(new URL('./results/review-latest.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({allReviewedAssertionsPassed: true, clothScenarios: clothRows.length,
  clothRawTimeSamples: 720, shoeCases: shoeRows.length, completeSceneFps: 'not measured'}));
