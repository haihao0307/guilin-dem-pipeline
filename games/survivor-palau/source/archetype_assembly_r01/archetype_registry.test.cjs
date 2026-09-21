'use strict';

const assert = require('node:assert/strict');
const { createArchetypeRegistry } = require('./archetype_registry.cjs');

let assertions = 0;
function ok(condition, message) { assert.ok(condition, message); assertions += 1; }
function eq(actual, expected, message) { assert.equal(actual, expected, message); assertions += 1; }
function throws(fn, pattern, message) { assert.throws(fn, pattern, message); assertions += 1; }

const registry = createArchetypeRegistry();

// Missing archetype remains explicit; no placeholder is synthesized.
const missing = registry.resolve('CORAL_SEAFAN_GORGONIAN');
eq(missing.status, 'NO_CANDIDATE');
eq(Object.keys(missing).sort().join(','), 'archetypeId,status');

// Unverified candidate cannot become active.
registry.registerCandidate({
  archetypeId: 'CORAL_BRANCHING_STAGHORN',
  domain: 'Coral',
  version: 'R1-A',
  sourceHead: '1111111111111111111111111111111111111111',
  status: 'CANDIDATE',
});
throws(() => registry.activate('CORAL_BRANCHING_STAGHORN'), /not verifier-passed/);

// Verifier-passed candidate can become ACTIVE and preserves source identity.
const massive = registry.registerCandidate({
  archetypeId: 'CORAL_MASSIVE_BRAIN',
  domain: 'Coral',
  version: 'R1-A',
  sourceHead: '2222222222222222222222222222222222222222',
  status: 'VERIFIER_PASSED',
});
eq(massive.sourceHead, '2222222222222222222222222222222222222222');
const active = registry.activate('CORAL_MASSIVE_BRAIN');
eq(active.status, 'ACTIVE');

// Placement requires story and world semantics.
throws(() => registry.place('CORAL_MASSIVE_BRAIN', {
  runtimeIdentity: 'coral:massive:001',
  saveIdentity: 'world/coral/massive/001',
  WHY_IN_STORY: '',
  WHERE_IN_WORLD: 'reef-flat-a',
}), /WHY_IN_STORY/);

const placed = registry.place('CORAL_MASSIVE_BRAIN', {
  runtimeIdentity: 'coral:massive:001',
  saveIdentity: 'world/coral/massive/001',
  WHY_IN_STORY: 'Visible reef habitat and line-snag object once habitat gate is passed.',
  WHERE_IN_WORLD: 'reef-flat-a',
});
eq(placed.saveIdentity, 'world/coral/massive/001');

// Duplicate runtime identity and duplicate save identity are both rejected.
throws(() => registry.place('CORAL_MASSIVE_BRAIN', {
  runtimeIdentity: 'coral:massive:001',
  saveIdentity: 'world/coral/massive/002',
  WHY_IN_STORY: 'duplicate runtime probe',
  WHERE_IN_WORLD: 'reef-flat-b',
}), /duplicate runtimeIdentity/);
throws(() => registry.place('CORAL_MASSIVE_BRAIN', {
  runtimeIdentity: 'coral:massive:002',
  saveIdentity: 'world/coral/massive/001',
  WHY_IN_STORY: 'duplicate save probe',
  WHERE_IN_WORLD: 'reef-flat-b',
}), /duplicate saveIdentity/);

// Duplicate archetype registration is rejected rather than silently replacing truth.
throws(() => registry.registerCandidate({
  archetypeId: 'CORAL_MASSIVE_BRAIN',
  domain: 'Coral', version: 'R1-B', sourceHead: '333', status: 'VERIFIER_PASSED',
}), /duplicate archetypeId/);

// Snapshot order is deterministic and restore preserves stable save/runtime identities.
const snapA = registry.snapshot();
const snapB = registry.snapshot();
eq(JSON.stringify(snapA), JSON.stringify(snapB));
const restored = createArchetypeRegistry();
const snapRestored = restored.restore(snapA);
eq(JSON.stringify(snapRestored), JSON.stringify(snapA));
eq(restored.resolve('CORAL_MASSIVE_BRAIN').status, 'ACTIVE');
eq(snapRestored.placements[0].runtimeIdentity, 'coral:massive:001');
eq(snapRestored.placements[0].saveIdentity, 'world/coral/massive/001');

// A non-active candidate cannot be placed.
throws(() => registry.place('CORAL_BRANCHING_STAGHORN', {
  runtimeIdentity: 'coral:branching:001',
  saveIdentity: 'world/coral/branching/001',
  WHY_IN_STORY: 'should not place',
  WHERE_IN_WORLD: 'reef-crest-a',
}), /not ACTIVE/);

ok(assertions >= 14, 'expected at least 14 assertions before final count');
console.log(`archetype_registry tests: PASS (${assertions} assertions)`);
