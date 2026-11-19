import assert from 'node:assert/strict';
import fs from 'node:fs';

const candidatePath = new URL('./CANDIDATE_ZX85_CONTROL_MAPPING_001_N321.json', import.meta.url);
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const canonical = candidate.canonicalMappings;

function key(device, direction) {
  return `${device}:${direction}`;
}

const expectedJoystick = new Map(canonical.isoJoysticks.map((x) => [key(x.inputDevice, x.inputDirection), x]));

function validate(observation) {
  const holds = [];
  if (!Array.isArray(observation.sourcePdfPages) || observation.sourcePdfPages.length === 0) {
    holds.push('HOLD_CONTROL_MAPPING_SOURCE_MISSING');
  }

  for (const sample of observation.joystickSamples || []) {
    const expected = expectedJoystick.get(key(sample.inputDevice, sample.inputDirection));
    if (!expected || sample.observedTarget !== expected.expectedTarget) {
      holds.push('HOLD_CONTROL_INPUT_TARGET_MISMATCH');
      continue;
    }
    if (sample.observedSemanticDelta !== expected.expectedSemanticDelta) {
      holds.push('HOLD_CONTROL_SEMANTIC_DELTA_MISMATCH');
    }
    if (!sample.declaredCoordinateFrame) {
      holds.push('HOLD_CONTROL_COORDINATE_FRAME_UNDECLARED');
    }
  }

  if (observation.neutralStopObserved !== true) {
    holds.push('HOLD_CONTROL_NEUTRAL_STOP_MISSING');
  }

  if (!observation.machineOrientation) {
    holds.push('HOLD_TRAVEL_ORIENTATION_UNBOUND');
  }

  for (const sample of observation.travelPairs || []) {
    const expected = canonical.travel.paired.find((x) => x.left === sample.left && x.right === sample.right);
    if (expected && sample.observedMotion !== expected.expectedMotion) {
      holds.push('HOLD_TRAVEL_PAIRING_MISMATCH');
    }
  }

  if (observation.pivot && observation.pivot.drivenCrawlerCount !== 1) {
    holds.push('HOLD_PIVOT_ONE_CRAWLER_CONSTRAINT_FAILED');
  }

  if (observation.spin && !(
    observation.spin.leftCrawlerDirection &&
    observation.spin.rightCrawlerDirection &&
    observation.spin.leftCrawlerDirection !== observation.spin.rightCrawlerDirection
  )) {
    holds.push('HOLD_SPIN_OPPOSED_CRAWLERS_MISSING');
  }

  return [...new Set(holds)];
}

const valid = {
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

const fixtures = [
  {name: 'canonical mapping passes', mutate: (x) => x, expected: []},
  {name: 'left-forward cannot drive boom', mutate: (x) => { x.joystickSamples[0].observedTarget = 'BOOM'; return x; }, expected: ['HOLD_CONTROL_INPUT_TARGET_MISMATCH']},
  {name: 'right-left cannot roll bucket out', mutate: (x) => { x.joystickSamples[6].observedSemanticDelta = 'ROLL_OUT'; return x; }, expected: ['HOLD_CONTROL_SEMANTIC_DELTA_MISMATCH']},
  {name: 'numeric sign requires coordinate frame', mutate: (x) => { x.joystickSamples[2].declaredCoordinateFrame = ''; return x; }, expected: ['HOLD_CONTROL_COORDINATE_FRAME_UNDECLARED']},
  {name: 'release must stop target function', mutate: (x) => { x.neutralStopObserved = false; return x; }, expected: ['HOLD_CONTROL_NEUTRAL_STOP_MISSING']},
  {name: 'travel orientation must be bound', mutate: (x) => { delete x.machineOrientation; return x; }, expected: ['HOLD_TRAVEL_ORIENTATION_UNBOUND']},
  {name: 'paired-forward cannot translate reverse', mutate: (x) => { x.travelPairs[0].observedMotion = 'TRANSLATE_REVERSE'; return x; }, expected: ['HOLD_TRAVEL_PAIRING_MISMATCH']},
  {name: 'pivot drives exactly one crawler', mutate: (x) => { x.pivot.drivenCrawlerCount = 2; return x; }, expected: ['HOLD_PIVOT_ONE_CRAWLER_CONSTRAINT_FAILED']},
  {name: 'spin requires opposed crawlers', mutate: (x) => { x.spin.rightCrawlerDirection = 'FORWARD'; return x; }, expected: ['HOLD_SPIN_OPPOSED_CRAWLERS_MISSING']},
  {name: 'source pages cannot be omitted', mutate: (x) => { x.sourcePdfPages = []; return x; }, expected: ['HOLD_CONTROL_MAPPING_SOURCE_MISSING']}
];

const results = [];
for (const fixture of fixtures) {
  const observation = fixture.mutate(structuredClone(valid));
  const actual = validate(observation);
  assert.deepEqual(actual, fixture.expected, fixture.name);
  results.push({name: fixture.name, status: 'PASS', holds: actual});
}

const output = {
  probe: 'N321_ZX85_CONTROL_MAPPING_GATE',
  fixtureOnly: true,
  sourcePages: [187, 188, 199],
  passed: results.length,
  total: fixtures.length,
  results,
  productionReplayVerified: false,
  decision: candidate.decision
};

console.log(JSON.stringify(output, null, 2));
