import assert from 'node:assert/strict';
import {readClothObservation, waitForClothIdle, retainClothSteps} from './cloth-observer.mjs';

// Helpers for the regular browser test. They use the visible application
// controls and read the actual Worker responses; they never call LayerWorld.
export async function runContinuousInterval({page, diagnostic, record, capture, waitIdle,
  seconds = 2, timeout = 1_200_000, name = 'sustained', checkpoint}) {
  assert.equal(typeof checkpoint, 'function', 'Continuous acceptance requires an independent geometry checker');
  assert.ok(Number.isFinite(seconds) && seconds >= .1, 'A continuous interval must cover at least 0.1 physical seconds');
  await waitForClothIdle(page);
  const before = await diagnostic();
  assert.equal(before.playing, false, 'Continuous interval must begin from a paused application');
  const from = before.physics.simulationSeconds;
  const target = from + seconds;
  const beforeTraffic = await readClothObservation(page);
  const intervalSteps = Math.ceil(seconds * 120);
  await retainClothSteps(page, [1, 6, 12, 18, 24, 60, 120, 240, intervalSteps]
    .filter(step => step <= intervalSteps).map(step => before.physics.completedSteps + step));
  const began = Date.now();
  // Do not call clickAndWait here: a running simulation need not have an idle
  // presentation queue. The stop action is followed by both worker and GPU idle.
  await page.locator('#layer-app #play').click();
  let failure;
  try {
    await page.waitForFunction(target => {
      const app = document.getElementById('layer-app');
      let value;
      try {value = JSON.parse(app.querySelector('#diagnostics').textContent);} catch {return false;}
      return value.error || value.physics?.simulationSeconds >= target;
    }, target, {timeout, polling: 100});
    const reached = await diagnostic();
    assert.equal(reached.error, null);
    assert.ok(reached.physics.simulationSeconds >= target, 'Wall-clock time is not a substitute for physical time');
  } catch (error) {failure = error;}
  finally {
    try {
      const value = await diagnostic().catch(() => null);
      if (value?.playing) await page.locator('#layer-app #play').click();
      await waitForClothIdle(page);
      await waitIdle();
    } catch (error) {failure ??= error;}
  }
  const after = await diagnostic();
  const traffic = await readClothObservation(page, {geometry: true, checkpoints: true});
  const actualSteps = after.physics.completedSteps - before.physics.completedSteps;
  const actualSeconds = after.physics.simulationSeconds - from;
  const responses = traffic.responses.slice(beforeTraffic.responseCount);
  const stepResponses = responses.filter(row => row.type === 'step');
  const responseIDs = new Set(responses.map(row => row.id));
  const geometryStates = traffic.checkpoints.filter(row => responseIDs.has(row.requestID));
  assert.equal(after.playing, false);
  assert.equal(traffic.pending.length, 0);
  assert.equal(stepResponses.length, actualSteps, 'Completed steps must equal actual Worker step responses');
  assert.ok(actualSteps > 1, 'Continuous regression must contain multiple real solver steps');
  assert.ok(Math.abs(actualSeconds - actualSteps / 120) < 1e-6, 'Reported clock must match the actual nominal solver steps');
  for (const response of stepResponses) {
    assert.equal(response.error, null);
    assert.ok(Number.isFinite(response.audit.simulationSeconds));
    assert.ok(Number.isFinite(response.audit.maxEdgeStretch));
    assert.ok(Number.isFinite(response.audit.seamGapMM));
  }
  const metrics = {requestedSeconds: seconds, actualSeconds, actualSteps, wallMS: Date.now() - began,
    physicalSecondsPerWallSecond: actualSeconds / ((Date.now() - began) / 1000),
    maximumRecordedStretch: Math.max(...stepResponses.map(row => row.audit.maxEdgeStretch)),
    maximumRecordedSeamGapMM: Math.max(...stepResponses.map(row => row.audit.seamGapMM)),
    selectedGeometryStates: geometryStates.map(row => ({requestID: row.requestID, generation: row.generation,
      completedSteps: row.snapshot.audit.completedSteps, simulationSeconds: row.snapshot.audit.simulationSeconds})),
    responseAudits: stepResponses,
    observation: {retainedCheckpointBytes: traffic.retainedCheckpointBytes,
      checkpointReadoutMS: traffic.checkpointCopyMS, droppedCheckpoints: traffic.droppedCheckpoints},
    interpretation: 'Actual visible play/pause controls; selected intermediate responses and final geometry after all completed worker replies, not a continuous-time no-crossing proof'};
  // The caller supplies the independent body/cloth geometry acceptance. A
  // successful clock advance alone is explicitly not physical acceptance.
  try {metrics.geometryChecks = await checkpoint({before, after, metrics, traffic, geometryStates});}
  catch (error) {failure ??= error; metrics.geometryCheckError = String(error);}
  await record(name, {continuous: metrics});
  if (capture) await capture(name);
  if (failure) throw failure;
  return {before, after, metrics, traffic};
}

export async function runRemovalCycles({page, diagnostic, record, capture, waitIdle,
  verifyGarments, checkpoint, initialCheckpoint, afterCycle, cycles = 3,
  secondsAfterRestore = .25, secondsWhileRemoved = .2}) {
  assert.ok(Number.isInteger(cycles) && cycles >= 1);
  const observations = [];
  for (let i = 0; i < cycles; i++) {
    await page.locator('#layer-app #layer-list [data-garment="outer"]').click();
    await page.locator('#layer-app #remove-selected').click();
    await waitForClothIdle(page); await waitIdle();
    const removed = await diagnostic();
    verifyGarments(removed, ['inner', 'pants']);
    assert.equal(removed.physics.contact, null, 'Removal must retire old contact measurements');
    await record(`cycle-${i + 1}-removed`);
    if (secondsWhileRemoved > 0) await runContinuousInterval({page, diagnostic, record,
      capture: null, waitIdle, checkpoint, seconds: secondsWhileRemoved, name: `cycle-${i + 1}-removed-sustained`});
    await page.locator('#layer-app #add-outer').click();
    await waitForClothIdle(page); await waitIdle();
    const restored = await diagnostic();
    verifyGarments(restored);
    assert.equal(restored.physics.completedSteps, 0, 'The current documented add operation reinitializes the garment set');
    assert.equal(restored.physics.simulationSeconds, 0);
    if (initialCheckpoint) await initialCheckpoint({cycle: i + 1, restored,
      traffic: await readClothObservation(page, {geometry: true})});
    observations.push(await runContinuousInterval({page, diagnostic, record,
      capture: i === cycles - 1 ? capture : null, waitIdle, checkpoint,
      seconds: secondsAfterRestore, name: `cycle-${i + 1}-restored-sustained`}));
    if (afterCycle) await afterCycle({cycle: i + 1, result: observations.at(-1)});
  }
  return observations;
}
