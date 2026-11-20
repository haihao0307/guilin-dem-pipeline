import assert from 'node:assert/strict';
import fs from 'node:fs';

const candidatePath = new URL('../REGRESSION_CASES/CANDIDATE_ZX85_CONTROL_MAPPING_001_N321.json', import.meta.url);
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const canonical = candidate.canonicalMappings;
const contract = candidate.continuousDemoContract;

function key(device, direction) {
  return `${device}:${direction}`;
}

const expectedJoystick = new Map(canonical.isoJoysticks.map((x) => [key(x.inputDevice, x.inputDirection), x]));

function unique(values) {
  return [...new Set(values)];
}

function validateControlMapping(observation) {
  const holds = [];
  if (!Array.isArray(observation.sourcePdfPages) || observation.sourcePdfPages.length === 0) holds.push('HOLD_CONTROL_MAPPING_SOURCE_MISSING');
  for (const sample of observation.joystickSamples || []) {
    const expected = expectedJoystick.get(key(sample.inputDevice, sample.inputDirection));
    if (!expected || sample.observedTarget !== expected.expectedTarget) {
      holds.push('HOLD_CONTROL_INPUT_TARGET_MISMATCH');
      continue;
    }
    if (sample.observedSemanticDelta !== expected.expectedSemanticDelta) holds.push('HOLD_CONTROL_SEMANTIC_DELTA_MISMATCH');
    if (!sample.declaredCoordinateFrame) holds.push('HOLD_CONTROL_COORDINATE_FRAME_UNDECLARED');
  }
  if (observation.neutralStopObserved !== true) holds.push('HOLD_CONTROL_NEUTRAL_STOP_MISSING');
  if (!observation.machineOrientation) holds.push('HOLD_TRAVEL_ORIENTATION_UNBOUND');
  for (const sample of observation.travelPairs || []) {
    const expected = canonical.travel.paired.find((x) => x.left === sample.left && x.right === sample.right);
    if (expected && sample.observedMotion !== expected.expectedMotion) holds.push('HOLD_TRAVEL_PAIRING_MISMATCH');
  }
  if (observation.pivot?.drivenCrawlerCount !== 1) holds.push('HOLD_PIVOT_ONE_CRAWLER_CONSTRAINT_FAILED');
  if (!(observation.spin?.leftCrawlerDirection && observation.spin?.rightCrawlerDirection && observation.spin.leftCrawlerDirection !== observation.spin.rightCrawlerDirection)) {
    holds.push('HOLD_SPIN_OPPOSED_CRAWLERS_MISSING');
  }
  return unique(holds);
}

function validateContinuousDemo(authority, receipt) {
  const holds = [];
  const expected = authority?.expectedActionIds;
  if (!Array.isArray(expected) || expected.length === 0 || !authority.authoritativeActionInventoryDigest || !authority.sourceHead) {
    holds.push('HOLD_DEMO_AUTHORITY_ACTION_INVENTORY_MISSING');
    return unique(holds);
  }
  if (receipt.authoritativeActionInventoryDigest !== authority.authoritativeActionInventoryDigest || receipt.sourceHead !== authority.sourceHead) {
    holds.push('HOLD_DEMO_INVENTORY_SUBJECT_MISMATCH');
  }

  const traces = receipt.traces || [];
  const observed = traces.map((x) => x.actionId);
  const missing = expected.filter((id) => !observed.includes(id));
  const extra = observed.filter((id) => !expected.includes(id));
  if (missing.length > 0) holds.push('HOLD_DEMO_ACTION_COVERAGE_INCOMPLETE');
  if (extra.length > 0) holds.push('HOLD_DEMO_UNANCHORED_ACTION_ID');

  const runIds = unique(traces.map((x) => x.runId));
  const segmentIds = unique(traces.map((x) => x.segmentId));
  if (runIds.length !== 1 || runIds[0] !== receipt.runId || segmentIds.length !== 1 || segmentIds[0] !== receipt.segmentId || receipt.cutReloadLoopOrReset === true) {
    holds.push('HOLD_DEMO_RUN_FRAGMENTED_OR_STITCHED');
  }
  if (receipt.renderSource !== 'LIVE_3D_RUNTIME') holds.push('HOLD_DEMO_NOT_LIVE_3D_RUNTIME');
  if (receipt.mediaSubstitute === true) holds.push('HOLD_DEMO_MEDIA_SUBSTITUTE');
  if (!receipt.artifactDigest) holds.push('HOLD_DEMO_INVENTORY_SUBJECT_MISMATCH');

  let priorCommand = -1;
  let priorTime = -1;
  for (const trace of traces) {
    if (!Number.isInteger(trace.commandFrame) || !Number.isInteger(trace.observableFrame) || trace.commandFrame <= priorCommand || trace.observableFrame < trace.commandFrame || !(trace.eventTimeMs > priorTime)) {
      holds.push('HOLD_DEMO_NON_MONOTONIC_OR_RESET_CLOCK');
      break;
    }
    priorCommand = trace.commandFrame;
    priorTime = trace.eventTimeMs;
  }

  const byId = new Map(traces.map((x) => [x.actionId, x]));
  const orderedFrames = expected.map((id) => byId.get(id)?.commandFrame);
  if (orderedFrames.some((x) => !Number.isInteger(x)) || orderedFrames.some((x, i) => i > 0 && x <= orderedFrames[i - 1])) {
    holds.push('HOLD_DEMO_CAUSAL_ORDER_INVALID');
  }

  const ignition = byId.get('IGNITION_START');
  const engine = byId.get('ENGINE_FEEDBACK_RUNNING');
  if (!(ignition && engine && engine.commandFrame > ignition.observableFrame && engine.engineRunning === true && engine.engineAudioOn === true && engine.engineVibrationOn === true)) {
    holds.push('HOLD_DEMO_ENGINE_FEEDBACK_CAUSALITY_MISSING');
  }

  const unlock = byId.get('PILOT_UNLOCK');
  const firstMotionFrame = traces.filter((x) => x.motionAction === true).map((x) => x.commandFrame).sort((a, b) => a - b)[0];
  const neutral = byId.get('NEUTRAL_STOP');
  const pilotLock = byId.get('PILOT_LOCK');
  if (!(unlock && engine && unlock.commandFrame > engine.observableFrame && Number.isInteger(firstMotionFrame) && firstMotionFrame > unlock.observableFrame && neutral?.neutralStopObserved === true && pilotLock && pilotLock.commandFrame > neutral.observableFrame)) {
    holds.push('HOLD_DEMO_CAUSAL_ORDER_INVALID');
  }

  for (const trace of traces.filter((x) => x.motionAction === true)) {
    if (!(trace.inputEventId && trace.observableEventId && trace.observableFrame > trace.commandFrame && trace.observedTarget && trace.observedSemanticDelta)) {
      holds.push('HOLD_DEMO_INPUT_TO_OBSERVABLE_LINEAGE_MISSING');
      break;
    }
  }
  return unique(holds);
}

const validMapping = {
  sourcePdfPages: [187, 188, 199],
  machineOrientation: 'FRONT_IDLERS_FRONT_TRAVEL_MOTORS_REAR',
  joystickSamples: canonical.isoJoysticks.map((x) => ({
    inputDevice: x.inputDevice,
    inputDirection: x.inputDirection,
    observedTarget: x.expectedTarget,
    observedSemanticDelta: x.expectedSemanticDelta,
    declaredCoordinateFrame: `${x.expectedTarget}_LOCAL_FRAME`
  })),
  neutralStopObserved: true,
  travelPairs: [
    {left: 'FORWARD', right: 'FORWARD', observedMotion: 'TRANSLATE_FORWARD'},
    {left: 'BACKWARD', right: 'BACKWARD', observedMotion: 'TRANSLATE_REVERSE'}
  ],
  pivot: {drivenCrawlerCount: 1},
  spin: {leftCrawlerDirection: 'FORWARD', rightCrawlerDirection: 'BACKWARD'}
};

const authority = {
  expectedActionIds: contract.expectedActionIds,
  authoritativeActionInventoryDigest: 'sha256:authority-owned-action-inventory-n329',
  sourceHead: 'prod-head-fresh-n329'
};

function makeTrace(actionId, index) {
  const motionAction = !['IGNITION_START', 'ENGINE_FEEDBACK_RUNNING', 'PILOT_UNLOCK', 'NEUTRAL_STOP', 'PILOT_LOCK', 'ENGINE_STOP'].includes(actionId);
  return {
    actionId,
    runId: 'run-n329-one',
    segmentId: 'segment-1',
    commandFrame: index * 10 + 1,
    observableFrame: index * 10 + 2,
    eventTimeMs: index * 100 + 10,
    motionAction,
    inputEventId: motionAction ? `input-${actionId}` : undefined,
    observableEventId: motionAction ? `observable-${actionId}` : undefined,
    observedTarget: motionAction ? 'SOURCE_BOUND_TARGET' : undefined,
    observedSemanticDelta: motionAction ? 'SOURCE_BOUND_DELTA' : undefined,
    engineRunning: actionId === 'ENGINE_FEEDBACK_RUNNING' ? true : undefined,
    engineAudioOn: actionId === 'ENGINE_FEEDBACK_RUNNING' ? true : undefined,
    engineVibrationOn: actionId === 'ENGINE_FEEDBACK_RUNNING' ? true : undefined,
    neutralStopObserved: actionId === 'NEUTRAL_STOP' ? true : undefined
  };
}

const validDemo = {
  authoritativeActionInventoryDigest: authority.authoritativeActionInventoryDigest,
  sourceHead: authority.sourceHead,
  artifactDigest: 'sha256:fresh-standalone-html-n329',
  runId: 'run-n329-one',
  segmentId: 'segment-1',
  renderSource: 'LIVE_3D_RUNTIME',
  mediaSubstitute: false,
  cutReloadLoopOrReset: false,
  traces: authority.expectedActionIds.map(makeTrace)
};

const fixtures = [
  {name: 'canonical mapping still passes', run: () => validateControlMapping(structuredClone(validMapping)), expected: []},
  {name: 'wrong actuator target still holds', run: () => { const x = structuredClone(validMapping); x.joystickSamples[0].observedTarget = 'BOOM'; return validateControlMapping(x); }, expected: ['HOLD_CONTROL_INPUT_TARGET_MISMATCH']},
  {name: 'wrong semantic delta still holds', run: () => { const x = structuredClone(validMapping); x.joystickSamples[6].observedSemanticDelta = 'ROLL_OUT'; return validateControlMapping(x); }, expected: ['HOLD_CONTROL_SEMANTIC_DELTA_MISMATCH']},
  {name: 'missing coordinate frame still holds', run: () => { const x = structuredClone(validMapping); x.joystickSamples[2].declaredCoordinateFrame = ''; return validateControlMapping(x); }, expected: ['HOLD_CONTROL_COORDINATE_FRAME_UNDECLARED']},
  {name: 'neutral stop still required', run: () => { const x = structuredClone(validMapping); x.neutralStopObserved = false; return validateControlMapping(x); }, expected: ['HOLD_CONTROL_NEUTRAL_STOP_MISSING']},
  {name: 'travel orientation still required', run: () => { const x = structuredClone(validMapping); delete x.machineOrientation; return validateControlMapping(x); }, expected: ['HOLD_TRAVEL_ORIENTATION_UNBOUND']},
  {name: 'paired travel still checked', run: () => { const x = structuredClone(validMapping); x.travelPairs[0].observedMotion = 'TRANSLATE_REVERSE'; return validateControlMapping(x); }, expected: ['HOLD_TRAVEL_PAIRING_MISMATCH']},
  {name: 'pivot still checks one crawler', run: () => { const x = structuredClone(validMapping); x.pivot.drivenCrawlerCount = 2; return validateControlMapping(x); }, expected: ['HOLD_PIVOT_ONE_CRAWLER_CONSTRAINT_FAILED']},
  {name: 'spin still checks opposed crawlers', run: () => { const x = structuredClone(validMapping); x.spin.rightCrawlerDirection = 'FORWARD'; return validateControlMapping(x); }, expected: ['HOLD_SPIN_OPPOSED_CRAWLERS_MISSING']},
  {name: 'source pages still required', run: () => { const x = structuredClone(validMapping); x.sourcePdfPages = []; return validateControlMapping(x); }, expected: ['HOLD_CONTROL_MAPPING_SOURCE_MISSING']},
  {name: 'one uninterrupted causal demo passes', run: () => validateContinuousDemo(authority, structuredClone(validDemo)), expected: []},
  {name: 'producer cannot shrink authority action inventory', run: () => { const x = structuredClone(validDemo); x.traces = x.traces.filter((t) => t.actionId !== 'RIGHT_JOYSTICK_BACKWARD_BOOM_RAISE'); return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_ACTION_COVERAGE_INCOMPLETE', 'HOLD_DEMO_CAUSAL_ORDER_INVALID']},
  {name: 'unanchored action is rejected', run: () => { const x = structuredClone(validDemo); x.traces.push({...makeTrace('RADIO_PLAYBACK', x.traces.length), runId: x.runId, segmentId: x.segmentId}); return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_UNANCHORED_ACTION_ID']},
  {name: 'stitched segment is rejected', run: () => { const x = structuredClone(validDemo); x.traces[8].segmentId = 'segment-2'; return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_RUN_FRAGMENTED_OR_STITCHED']},
  {name: 'clock reset is rejected', run: () => { const x = structuredClone(validDemo); x.traces[9].commandFrame = 2; return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_NON_MONOTONIC_OR_RESET_CLOCK', 'HOLD_DEMO_CAUSAL_ORDER_INVALID']},
  {name: 'pre-recorded video is rejected', run: () => { const x = structuredClone(validDemo); x.renderSource = 'VIDEO'; x.mediaSubstitute = true; return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_NOT_LIVE_3D_RUNTIME', 'HOLD_DEMO_MEDIA_SUBSTITUTE']},
  {name: 'engine sound and vibration cannot precede ignition', run: () => { const x = structuredClone(validDemo); x.traces[1].commandFrame = 1; return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_NON_MONOTONIC_OR_RESET_CLOCK', 'HOLD_DEMO_CAUSAL_ORDER_INVALID', 'HOLD_DEMO_ENGINE_FEEDBACK_CAUSALITY_MISSING']},
  {name: 'motion needs input-to-observable lineage', run: () => { const x = structuredClone(validDemo); delete x.traces[3].inputEventId; return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_INPUT_TO_OBSERVABLE_LINEAGE_MISSING']},
  {name: 'inventory subject substitution is rejected', run: () => { const x = structuredClone(validDemo); x.sourceHead = 'different-head'; return validateContinuousDemo(authority, x); }, expected: ['HOLD_DEMO_INVENTORY_SUBJECT_MISMATCH']}
];

const results = [];
for (const fixture of fixtures) {
  const actual = fixture.run();
  assert.deepEqual(actual, fixture.expected, fixture.name);
  results.push({name: fixture.name, status: 'PASS', holds: actual});
}

const output = {
  probe: 'N329_ZX85_CONTINUOUS_CAUSAL_DEMO_GATE',
  fixtureOnly: true,
  passed: results.length,
  total: fixtures.length,
  results,
  productionReplayVerified: false,
  productionSourceHead: 'UNKNOWN',
  teacherStatus: candidate.novelty.teacherStatus,
  decision: candidate.decision
};

console.log(JSON.stringify(output, null, 2));
