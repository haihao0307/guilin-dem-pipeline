import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  LIVE_PROGRAM_SCHEMA, LIVE_QA_SCHEMA, canonicalJSON, sha256Bytes, fingerprintJSON,
  programDefinitionFingerprint, semanticDefinitionFingerprint, numericQAFingerprint,
  liveQABinding, sourceBundleFingerprint, validateLiveProgramInventory, createLiveComparisonRound,
} from '../live_program_schedule.mjs';

const checks = [];
const test = async (name, run) => { await run(); checks.push({name, passed: true}); };
const reject = (name, mutate, pattern, options = {}) => test(name, async () => {
  const input = structuredClone({library, characters});
  await mutate(input);
  await assert.rejects(() => createLiveComparisonRound(input.library, input.characters, 0, {...fixtureOptions, ...options}), pattern);
});
const hash = value => sha256Bytes(String(value));
// These are transparent synthetic contract fixtures, not authored motion assets.
const sourceFiles = {
  'fixture-programs.mjs': '// SYNTHETIC CONTRACT TEST; NOT PRODUCTION MOTION\nexport const fixture = true;\n',
  'fixture-evaluator.mjs': '// SYNTHETIC CONTRACT TEST; NOT A MOTION EVALUATOR\n',
};
const characters = await Promise.all(Array.from({length: 36}, async (_, index) => ({
  id: `fixture-character-${index}`, restFingerprint: await hash(`synthetic-rest-${index}`),
})));
const programSourceSha256 = await sha256Bytes(sourceFiles['fixture-programs.mjs']);
const runtimeSHA = await sha256Bytes(sourceFiles['fixture-evaluator.mjs']);
const harnessSha256 = await sha256Bytes(await readFile(new URL(import.meta.url)));
const library = [];
for (let index = 0; index < 18; index++) {
  const definition = {durationSeconds: 2,
    events: [{id: `fixture-${index}-event`, actor: index % 2, start: 0.2, end: 1.2,
      kind: `synthetic-contract-action-${index}`, response: 'synthetic-response'}],
    movements: [{actor: 0, kind: 'synthetic-step', side: 'L'}]};
  const programDefinitionHash = await programDefinitionFingerprint(definition);
  const program = {schema: LIVE_PROGRAM_SCHEMA, programId: `fixture-program-${index}`,
    semanticMotionId: `fixture-semantic-${index}`, programDefinition: definition, programDefinitionHash,
    programSourcePath: 'fixture-programs.mjs', programSourceSha256,
    sourceDependencies: [{path: 'fixture-evaluator.mjs', sha256: runtimeSHA}],
    sourceRevision: 'synthetic-contract-fixture-r1', actorCount: 2, fps: 30, durationSeconds: 2,
    executionConfig: {contactIK: true, footLock: true}, qualityStatus: 'reviewed', testFixture: true,
    redistributionApproved: true, source: {kind: 'self-authored-live-procedural', neuralInferenceExecuted: false},
    semanticReviewEvidence: {status: 'reviewed', reviewedBy: 'SYNTHETIC TEST ONLY, NOT A HUMAN ART REVIEW',
      evidenceRef: 'tests/live-program-schedule.mjs#synthetic-fixture',
      distinctnessRationale: `Synthetic discriminator ${index}; does not assert real action diversity.`,
      programDefinitionHash, programSourceSha256}, numericQA: []};
  program.semanticReviewEvidence.sourceBundleFingerprint = await sourceBundleFingerprint(program);
  program.semanticReviewEvidence.sourceRevision = program.sourceRevision;
  for (let c = 0; c < characters.length; c++) for (const role of ['A', 'B']) {
    const record = {schema: LIVE_QA_SCHEMA, kind: 'measured-live-program', status: 'passed',
      binding: await liveQABinding(program, characters[c], characters[c ^ 1], role),
      evidenceRef: 'tests/live-program-schedule.mjs#synthetic-fixture', harnessSha256,
      runId: 'synthetic-contract-fixture-r1', measuredAt: '2026-10-09T00:00:00.000Z',
      sampleFps: 30, includesEndpoint: true, sampleCount: 61,
      metrics: {finiteFailureCount: 0, maxFootLockErrorM: 0.00001},
      checks: [{metric: 'finiteFailureCount', max: 0}, {metric: 'maxFootLockErrorM', max: 0.001}],
      testFixture: true};
    record.numericQaFingerprint = await numericQAFingerprint(record);
    program.numericQA.push(record);
  }
  library.push(program);
}
const fixtureOptions = {sourceFiles, allowSyntheticFixtures: true};
await test('reject test fixtures by default', async () => {
  await assert.rejects(() => createLiveComparisonRound(library, characters, 0, {sourceFiles}), /synthetic test fixtures/);
});
await test('validation mode does not implicitly allow fixtures', async () => {
  await assert.rejects(() => createLiveComparisonRound(library, characters, 0, {sourceFiles, mode: 'validation'}), /synthetic test fixtures/);
});
const rounds = [];
await test('36-round schedule keeps fixed pairs, shared clocks and full semantic/role coverage', async () => {
  for (let round = 0; round < 36; round++) {
    const plan = await createLiveComparisonRound(library, characters, round, fixtureOptions);
    assert.equal(plan.validationOnly, true); assert.equal(plan.canPublish, false); assert.equal(plan.productionReady, false);
    assert.equal(plan.neuralInferenceExecuted, false); assert.equal(plan.inventoryKind, 'live-procedural-programs');
    assert.equal(new Set(plan.arenas.map(arena => arena.programId)).size, 18);
    for (const arena of plan.arenas) {
      assert.equal(arena.clock.startSeconds, 0); assert.equal(arena.clock.phaseOffset, 0); assert.equal(arena.clock.speed, 1);
      assert.equal(arena.actors[0].clockId, arena.actors[1].clockId);
      assert.equal(arena.actors[0].partnerId, arena.actors[1].characterId);
      assert.equal(arena.actors[0].characterId, characters[arena.arenaIndex * 2].id);
      assert.equal(arena.actors[1].characterId, characters[arena.arenaIndex * 2 + 1].id);
      assert.equal(new Set(arena.actors.map(actor => actor.role)).size, 2);
      assert(!('bakes' in arena)); assert(!('canonicalClipSha256' in arena));
      assert(arena.actors.every(actor => !('packetSha256' in actor)));
    }
    rounds.push(plan);
  }
  for (let arena = 0; arena < 18; arena++) for (let actor = 0; actor < 2; actor++) {
    assert.equal(new Set(rounds.map(plan => plan.arenas[arena].programId + ':' + plan.arenas[arena].actors[actor].role)).size, 36);
    assert.equal(rounds[0].arenas[arena].programId, rounds[18].arenas[arena].programId);
    assert.notEqual(rounds[0].arenas[arena].actors[actor].role, rounds[18].arenas[arena].actors[actor].role);
  }
});
await test('one shared source file legitimately supplies 18 distinct program definitions', async () => {
  const result = await validateLiveProgramInventory(library, characters, fixtureOptions);
  assert.equal(new Set(result.library.map(program => program.programSourceSha256)).size, 1);
  assert.equal(result.distinctSemanticPrograms, 18); assert.equal(result.measuredQABindings, 1296);
});
await test('same-program mode synchronizes all 18 arenas on a global clock and swaps AB', async () => {
  for (const round of [0, 18, 35]) {
    const plan = await createLiveComparisonRound(library, characters, round, {
      ...fixtureOptions, comparisonMode: 'same-program', selectedProgramId: 'fixture-program-7'});
    assert.equal(plan.distinctSemanticProgramsThisRound, 1);
    assert.equal(plan.distinctSemanticProgramsInInventory, 18);
    assert.equal(plan.globalClock.id, 'global-comparison-clock');
    assert(plan.arenas.every(arena => arena.programId === 'fixture-program-7' && canonicalJSON(arena.clock) === canonicalJSON(plan.globalClock)));
    assert(plan.arenas.every(arena => arena.actors.every(actor => actor.clockId === plan.globalClock.id)));
    assert.equal(plan.arenas[0].actors[0].role, round < 18 ? 'A' : 'B');
  }
});
await test('rounds repeat deterministically with no hidden random phase', async () => {
  const again = await createLiveComparisonRound(library, characters, 0, fixtureOptions);
  assert.deepEqual(again, rounds[0]);
});
await test('output is immutable and detached from caller-owned input', async () => {
  assert(Object.isFrozen(rounds[0])); assert(Object.isFrozen(rounds[0].arenas[0].actors[0]));
  assert.throws(() => { rounds[0].arenas[0].clock.phaseOffset = 1; }, TypeError);
});
await test('async validation snapshots source/definitions/QA before yielding', async () => {
  const input = structuredClone({library, characters});
  const files = {...sourceFiles};
  const pending = createLiveComparisonRound(input.library, input.characters, 0, {...fixtureOptions, sourceFiles: files});
  input.library[0].numericQA[0].metrics.maxFootLockErrorM = 99;
  input.characters[0].restFingerprint = 'a'.repeat(64); files['fixture-programs.mjs'] = 'changed';
  assert.deepEqual(await pending, rounds[0]);
});
await reject('fewer than 18 programs', x => { x.library = x.library.slice(0, 17); }, /at least 18/);
await reject('duplicate program IDs', x => { x.library[1].programId = x.library[0].programId; }, /unique live programId/);
await reject('duplicate semantic IDs', x => { x.library[1].semanticMotionId = x.library[0].semanticMotionId; }, /unique semanticMotionId/);
await reject('same definition renamed as a second program', x => {
  x.library[1].programDefinition = x.library[0].programDefinition;
  x.library[1].programDefinitionHash = x.library[0].programDefinitionHash;
}, /renaming the same program definition/);
await reject('phase seed timing and event IDs cannot inflate action diversity', async x => {
  const p = x.library[1], d = structuredClone(x.library[0].programDefinition);
  d.id = 'renamed'; d.phase = 9; d.seed = 999; d.events[0].id = 'renamed-event';
  d.events[0].start = 9; d.events[0].end = 10;
  p.programDefinition = d; p.programDefinitionHash = await programDefinitionFingerprint(d);
}, /phase\/seed\/timing\/identifier-only/);
await reject('program definition edits invalidate hash', x => { x.library[0].programDefinition.events[0].kind = 'changed'; }, /definition changed/);
await reject('source revision edits invalidate semantic review', x => { x.library[0].sourceRevision = 'changed'; }, /semantic review evidence does not match/);
await reject('dependency replacement invalidates semantic review even with fresh numeric evidence', async x => {
  const program = x.library[0];
  program.sourceDependencies[0].sha256 = await hash('new-evaluator');
  for (const record of program.numericQA) {
    record.binding.sourceBundleFingerprint = await sourceBundleFingerprint(program);
    record.numericQaFingerprint = await numericQAFingerprint(record);
  }
}, /semantic review evidence does not match/);
await reject('semantic review needs entire source bundle fingerprint', x => { delete x.library[0].semanticReviewEvidence.sourceBundleFingerprint; }, /semantic review evidence does not match/);
await reject('target rest shape edits invalidate measured QA', async x => { x.characters[0].restFingerprint = await hash('changed-target'); }, /binding changed/);
await reject('partner rest shape edits invalidate measured QA', async x => { x.characters[1].restFingerprint = await hash('changed-partner'); }, /binding changed/);
await reject('re-pairing characters needs new partner-specific evidence', x => { [x.characters[1], x.characters[3]] = [x.characters[3], x.characters[1]]; }, /numeric QA missing/);
await reject('QA role cannot be reassigned', x => { x.library[0].numericQA[0].binding.role = 'B'; }, /duplicate numeric QA binding/);
await reject('missing opposite-role QA blocks even first round', x => { x.library[0].numericQA.splice(1, 1); }, /both A\/B roles exactly/);
await reject('source bytes mismatch blocks schedule', () => {}, /program source changed/, {sourceFiles: {...sourceFiles, 'fixture-programs.mjs': 'modified'}});
await reject('runtime dependency bytes mismatch blocks schedule', () => {}, /program source changed/, {sourceFiles: {...sourceFiles, 'fixture-evaluator.mjs': 'modified'}});
await reject('source hash edits without new evidence are rejected', async x => { x.library[0].programSourceSha256 = await hash('changed-source'); }, /semantic review evidence does not match/);
await reject('missing real source bytes are rejected', () => {}, /actual source bytes missing/, {sourceFiles: {}});
await reject('source strings cannot stand in for sourceFiles map', () => {}, /actual sourceFiles bytes/, {sourceFiles: 'not a map'});
await reject('execution config changes invalidate QA', x => { x.library[0].executionConfig.footLock = false; }, /binding changed/);
await reject('unreviewed quality is blocked by default', x => { x.library[0].qualityStatus = 'numeric-reviewed'; }, /production requires reviewed/);
await reject('pending semantic review is blocked by default', x => { x.library[0].semanticReviewEvidence.status = 'pending'; }, /production requires reviewed/);
await test('explicit validation preview permits pending art review but never publishing', async () => {
  const input = structuredClone(library);
  input.forEach(program => { program.qualityStatus = 'numeric-reviewed'; program.semanticReviewEvidence.status = 'pending'; delete program.semanticReviewEvidence.reviewedBy; });
  const plan = await createLiveComparisonRound(input, characters, 0, {...fixtureOptions, mode: 'validation'});
  assert.equal(plan.validationOnly, true); assert.equal(plan.canPublish, false); assert.equal(plan.productionReady, false);
});
await reject('reviewed evidence requires identified reviewer', x => { delete x.library[0].semanticReviewEvidence.reviewedBy; }, /production requires reviewed/);
await reject('missing semantic evidence rationale', x => { x.library[0].semanticReviewEvidence.distinctnessRationale = ''; }, /distinctness rationale/);
await reject('semantic review must bind definition', x => { x.library[0].semanticReviewEvidence.programDefinitionHash = 'a'.repeat(64); }, /semantic review evidence does not match/);
await reject('neural inference claim is forbidden', x => { x.library[0].source.neuralInferenceExecuted = true; }, /no neural inference/);
await reject('missing no-inference fact is forbidden', x => { delete x.library[0].source.neuralInferenceExecuted; }, /no neural inference/);
await reject('unapproved rights are forbidden', x => { x.library[0].redistributionApproved = false; }, /rights approval/);
await reject('fake offline bakes are forbidden', x => { x.library[0].bakes = []; }, /offline bakes is forbidden/);
await reject('fake native packet SHA is forbidden', x => { x.library[0].numericQA[0].packetSha256 = 'a'.repeat(64); }, /offline packetSha256 is forbidden/);
await reject('missing explicit live schema', x => { delete x.library[0].schema; }, /explicit live-program schema/);
await reject('phase offsets forbidden', x => { x.library[0].phaseOffset = 0.01; }, /phase offsets/);
await reject('hidden random phase in definitions forbidden', async x => {
  x.library[0].programDefinition.randomPhase = true;
  x.library[0].programDefinitionHash = await programDefinitionFingerprint(x.library[0].programDefinition);
}, /phase offsets/);
await reject('declared duration must match authored duration', x => { x.library[0].durationSeconds = 3; }, /timing must match/);
await reject('contradictory metric sample count rejected', x => { x.library[0].numericQA[0].metrics.sampleCount = 999; }, /sampleCount contradicts/);
await reject('per-program speed offsets forbidden', x => { x.library[0].speed = 1.2; }, /speed offsets/);
await reject('nonpaired program forbidden', x => { x.library[0].actorCount = 1; }, /exactly two roles/);
await reject('FPS changes invalidate measured QA', x => { x.library[0].fps = 60; }, /binding changed/);
await reject('numeric metrics mutation detected', x => { x.library[0].numericQA[0].metrics.maxFootLockErrorM = 0.00002; }, /fingerprint mismatch/);
await reject('numeric QA evidence mutation detected', x => { x.library[0].numericQA[0].evidenceRef = 'different-report'; }, /fingerprint mismatch/);
await reject('recomputed hash cannot hide failing numeric threshold', async x => {
  const record = x.library[0].numericQA[0]; record.metrics.maxFootLockErrorM = 0.3;
  record.numericQaFingerprint = await numericQAFingerprint(record);
}, /threshold failed/);
await reject('all numeric QA metrics must be finite', x => { x.library[0].numericQA[0].metrics.maxFootLockErrorM = NaN; }, /finite numbers/);
await reject('missing full-duration measurement coverage', x => { x.library[0].numericQA[0].sampleCount = 60; }, /entire shared program duration/);
await test('exclusive endpoint sampling is supported and honestly fingerprinted', async () => {
  const input = structuredClone(library);
  for (const program of input) for (const record of program.numericQA) {
    record.includesEndpoint = false; record.sampleCount = 60;
    record.numericQaFingerprint = await numericQAFingerprint(record);
  }
  const plan = await createLiveComparisonRound(input, characters, 0, fixtureOptions);
  assert.equal(plan.arenas.length, 18);
});
await reject('missing measured metrics rejected', x => { x.library[0].numericQA[0].metrics = {}; }, /finite measurements/);
await reject('non-finite sample report rejected', x => { x.library[0].numericQA[0].metrics.finiteFailureCount = 1; }, /non-finite motion samples/);
await reject('missing numeric pass thresholds rejected', x => { x.library[0].numericQA[0].checks = []; }, /measured thresholds/);
await reject('finite sample check cannot be omitted', x => { x.library[0].numericQA[0].checks.shift(); }, /explicitly checked/);
await reject('missing QA harness fingerprint rejected', x => { delete x.library[0].numericQA[0].harnessSha256; }, /harness SHA-256/);
await reject('unexecuted numeric QA rejected', x => { x.library[0].numericQA[0].status = 'pending'; }, /actually passed/);
await reject('duplicate QA binding rejected', x => { x.library[0].numericQA[1] = x.library[0].numericQA[0]; }, /duplicate numeric QA binding/);
await reject('invalid fixture override rejected', () => {}, /fixture override must be boolean/, {allowSyntheticFixtures: 'false'});
await reject('duplicate character IDs rejected', x => { x.characters[1].id = x.characters[0].id; }, /unique character IDs/);
await reject('incorrect cast size rejected', x => { x.characters.pop(); }, /two characters per fixed arena/);
await reject('inadequate arena count rejected', () => {}, /at least 18 arenas/, {arenaCount: 3});
await reject('unknown comparison mode rejected', () => {}, /unknown comparisonMode/, {comparisonMode: 'shuffle'});
await reject('same-program mode needs explicit choice', () => {}, /selectedProgramId/, {comparisonMode: 'same-program'});
await reject('unknown selected program rejected', () => {}, /absent from the validated inventory/, {comparisonMode: 'same-program', selectedProgramId: 'missing'});
await reject('selected program cannot silently change diverse mode', () => {}, /only meaningful/, {selectedProgramId: 'fixture-program-0'});
await test('round integer boundaries are strict', async () => {
  for (const round of [-1, 0.5, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(() => createLiveComparisonRound(library, characters, round, fixtureOptions), /safe-integer round/);
  }
});
await test('strict canonical JSON rejects lossy values and canonicalizes key ordering', async () => {
  assert.equal(await fingerprintJSON({b: 2, a: 1}), await fingerprintJSON({a: 1, b: 2}));
  for (const value of [undefined, NaN, Infinity, {value: undefined}, {value: () => {}}, new Map()]) assert.throws(() => canonicalJSON(value), /canonical JSON/);
  assert.throws(() => canonicalJSON(Array(2)), /sparse arrays/);
  const cyclic = {}; cyclic.self = cyclic; assert.throws(() => canonicalJSON(cyclic), /cycles/);
});
await test('semantic projection preserves authored attacks and drops decorations', async () => {
  const first = {id: 'one', events: [{id: 'x', actor: 0, kind: 'jab', response: 'slip', start: 1, end: 2}]};
  const second = {id: 'two', seed: 7, events: [{id: 'y', actor: 0, kind: 'jab', response: 'slip', start: 3, end: 4}]};
  assert.equal(await semanticDefinitionFingerprint(first), await semanticDefinitionFingerprint(second));
  second.events[0].kind = 'hook';
  assert.notEqual(await semanticDefinitionFingerprint(first), await semanticDefinitionFingerprint(second));
});
await test('legacy offline planner and native packet files stay byte-identical', async () => {
  assert.equal(await sha256Bytes(await readFile(new URL('../arena_schedule.mjs', import.meta.url))), 'b1285b25df5efac514ca2cd29101b35018d3125036dd4a3badb35a745a4ca674');
  assert.equal(await sha256Bytes(await readFile(new URL('../native_packet.mjs', import.meta.url))), 'd3b74316912f520144dec90b9101a84338d3afbfc97813473b43caf1f7c3b34e');
});
console.log(JSON.stringify({schema: 'kaopu-live-program-schedule-contract-qa/1', passed: true,
  generatedAt: new Date().toISOString(), totalChecks: checks.length,
  testFixturesOnly: true, neuralModelsExecuted: [], realMotionQualityValidated: false,
  rounds: 36, arenasPerRound: 18, characters: 36, qaBindingsPerInventory: 1296,
  differentSemanticPrograms: 'synthetic fixture identifiers only; not a real semantic quality claim',
  sharedSourceFileAccepted: true, bothRolesAndEveryProgramCovered: true,
  sameProgramGlobalClockCovered: true, sourceDefinitionRestPartnerRoleAndMetricsMutationRejected: true,
  fixtureProductionPublicationAllowed: false, legacyOfflineFilesUnchanged: true,
  note: 'This run validates integrity, gate behavior and deterministic scheduling only. It runs no motion solver or visual review and creates no offline clip/bake hashes.', checks}, null, 2));
