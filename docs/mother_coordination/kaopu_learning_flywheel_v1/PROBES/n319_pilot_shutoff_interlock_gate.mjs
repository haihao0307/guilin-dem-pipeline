import assert from 'node:assert/strict';

const REQUIRED_DOMAINS = ['FRONT_ATTACHMENT', 'SWING', 'TRAVEL'];

function validate(receipt) {
  const holds = [];
  const domains = new Set(receipt.controlledDomains ?? []);

  if (REQUIRED_DOMAINS.some((domain) => !domains.has(domain))) {
    holds.push('HOLD_PILOT_INTERLOCK_DOMAIN_INCOMPLETE');
  }

  if (receipt.requestStart && receipt.lockPosition !== 'LOCK_UP' && receipt.engineStarted) {
    holds.push('HOLD_PILOT_START_INTERLOCK_BYPASSED');
  }

  if (receipt.lockPosition === 'LOCK_UP' && receipt.motionObserved) {
    holds.push('HOLD_PILOT_LOCKED_MOTION');
  }

  if (receipt.transition === 'LOCK_UP_TO_UNLOCK_DOWN' && !receipt.controlsNeutral) {
    holds.push('HOLD_PILOT_UNLOCK_WITH_NON_NEUTRAL_CONTROL');
  }

  if (receipt.lockPosition === 'UNLOCK_DOWN' && receipt.controlsNeutral && receipt.motionObserved) {
    holds.push('HOLD_NEUTRAL_ACTUATOR_MOTION');
    if (!receipt.immediateLockAndStopReceipt) {
      holds.push('HOLD_PILOT_FAILSAFE_RECEIPT_MISSING');
    }
  }

  if (receipt.claim === 'INTERLOCK_VERIFIED' && !receipt.sourcePages?.length) {
    holds.push('HOLD_PILOT_INTERLOCK_SOURCE_MISSING');
  }

  return [...new Set(holds)];
}

const valid = {
  controlledDomains: REQUIRED_DOMAINS,
  sourcePages: [179, 184, 187, 188, 199, 200],
  requestStart: true,
  lockPosition: 'LOCK_UP',
  engineStarted: true,
  controlsNeutral: true,
  motionObserved: false,
  claim: 'INTERLOCK_VERIFIED',
};

const fixtures = [
  { name: 'locked start with all motion domains inhibited', candidate: valid, expected: [] },
  {
    name: 'engine starts while lever is unlocked',
    mutate: (c) => { c.lockPosition = 'UNLOCK_DOWN'; },
    expected: ['HOLD_PILOT_START_INTERLOCK_BYPASSED'],
  },
  {
    name: 'motion occurs while locked',
    mutate: (c) => { c.motionObserved = true; },
    expected: ['HOLD_PILOT_LOCKED_MOTION'],
  },
  {
    name: 'unlock attempted with non-neutral controls',
    mutate: (c) => { c.requestStart = false; c.engineStarted = true; c.transition = 'LOCK_UP_TO_UNLOCK_DOWN'; c.controlsNeutral = false; },
    expected: ['HOLD_PILOT_UNLOCK_WITH_NON_NEUTRAL_CONTROL'],
  },
  {
    name: 'neutral actuator motion lacks immediate lock-and-stop receipt',
    mutate: (c) => { c.requestStart = false; c.lockPosition = 'UNLOCK_DOWN'; c.motionObserved = true; },
    expected: ['HOLD_NEUTRAL_ACTUATOR_MOTION', 'HOLD_PILOT_FAILSAFE_RECEIPT_MISSING'],
  },
  {
    name: 'travel omitted from interlock coverage',
    mutate: (c) => { c.controlledDomains = ['FRONT_ATTACHMENT', 'SWING']; },
    expected: ['HOLD_PILOT_INTERLOCK_DOMAIN_INCOMPLETE'],
  },
  {
    name: 'verified claim lacks frozen-source page binding',
    mutate: (c) => { c.sourcePages = []; },
    expected: ['HOLD_PILOT_INTERLOCK_SOURCE_MISSING'],
  },
];

const results = fixtures.map((fixture) => {
  const candidate = structuredClone(fixture.candidate ?? valid);
  fixture.mutate?.(candidate);
  const holds = validate(candidate);
  for (const expected of fixture.expected) assert(holds.includes(expected), `${fixture.name}: missing ${expected}`);
  if (fixture.expected.length === 0) assert.deepEqual(holds, [], `${fixture.name}: unexpected ${holds}`);
  return { fixture: fixture.name, pass: true, holds };
});

console.log(JSON.stringify({ caseId: 'PILOT-SHUTOFF-INTERLOCK-001-N319', passed: results.length, total: results.length, results }, null, 2));
