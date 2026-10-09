# Live procedural comparison contract R01

`live_program_schedule.mjs` is an independent, data-only protocol. It does not change `arena_schedule.mjs` or `native_packet.mjs`, evaluate a rig, run a neural model, or manufacture native packets. A live program is executable choreography plus reviewed evidence. It is **not an offline clip**. Offline `bakes`, `bakeHash`, `canonicalClipSha256` and packet SHA fields are rejected.

## Async API

- `await validateLiveProgramInventory(library, characters, options)` validates a complete inventory. The result is an immutable snapshot, including the checked inventory and cast.
- `await createLiveComparisonRound(library, characters, round, options)` validates before planning a round. It returns `kaopu-live-program-comparison-round/1`.
- Hash helpers: `sha256Bytes`, `fingerprintJSON`, `programDefinitionFingerprint`, `semanticDefinitionFingerprint`, `sourceBundleFingerprint`, `liveQABinding`, and `numericQAFingerprint` are async. `canonicalJSON`, `semanticDefinition` and `programSourceManifest` are synchronous.
- Works with browser WebCrypto in a secure context and current Node. The validator never fetches URLs or executes source strings. The host supplies exact UTF-8 source bytes in `options.sourceFiles`.

The default is 18 fixed pairs, supplied in a stable 36-character array. Each character is `{id, restFingerprint}`. The rest fingerprint must describe the actual shape-specific rest rig, not just a shape label. The host is responsible for computing it from the current rig and for executing the exact source bytes it supplies to this validator.

### Scheduling

`comparisonMode: 'diverse-round'` is the default. Arena `a` gets program `(a + round) % 18`. Pairs never change. Rounds 0–17 cover every program; rounds 18–35 repeat them with A/B exchanged. Both actors reference the same pair clock, start at zero, have the same FPS and duration, and have no individual phase or speed offset.

`comparisonMode: 'same-program', selectedProgramId: '…'` runs that one validated program across all 18 pairs. Every arena and actor references `global-comparison-clock`; `globalClock` supplies its common FPS/duration. A/B still exchange after 18 rounds. This enables the same-action, cross-shape comparison. It still requires the complete reviewed inventory and every shape/partner/role measurement, not copies of one character's evidence.

All clocks are non-looping canonical clocks. A controller may apply one global transport speed or restart a round, but must not alter the canonical per-pair timing or inject phase offsets. A shared source file is allowed. Eighteen distinct program definitions do **not** need eighteen different JavaScript file hashes.

## Minimum program fields

A wrapper around an existing authored definition has these fields:

```js
const definition = {
  events: authored.events,
  movements: authored.movements,
  durationSeconds: authored.durationSeconds,
};
const programDefinitionHash = await programDefinitionFingerprint(definition);
const programSourceSha256 = await sha256Bytes(actualProgramSourceBytes);
const program = {
  schema: 'kaopu-live-motion-program/1',
  programId: authored.id,
  semanticMotionId: authored.semanticMotionId,
  programDefinition: definition,
  programDefinitionHash,
  programSourcePath: 'MotionPrograms.mjs',
  programSourceSha256,
  sourceDependencies: [{path: 'MotionR03.mjs', sha256: await sha256Bytes(actualEvaluatorBytes)}],
  sourceRevision: 'boxing-motion-r03',
  source: {kind: 'self-authored-live-procedural', neuralInferenceExecuted: false},
  actorCount: 2, fps: 30, durationSeconds: 16,
  executionConfig: {contactIK: true, footLock: true},
  redistributionApproved: true, // set only after actual rights review
  qualityStatus: 'numeric-reviewed', // honest candidate; not visually reviewed
  semanticReviewEvidence: {
    status: 'pending',
    evidenceRef: actualReviewDocumentReference,
    distinctnessRationale: authored.description,
    programDefinitionHash,
    programSourceSha256,
  },
  numericQA: [], // fill with the 72 REAL measured records; empty is rejected
};
program.semanticReviewEvidence.sourceBundleFingerprint = await sourceBundleFingerprint(program);
program.semanticReviewEvidence.sourceRevision = program.sourceRevision;
```

Include **every source dependency capable of changing motion evaluation** in `sourceDependencies`, not merely the program list file. Also bind relevant solver settings in `executionConfig`. Any source bytes, dependency, definition, revision, FPS, duration, execution setting, current target rest, partner rest or role change invalidates the old numeric-QA binding.

The definition hash is SHA-256 of strict, key-sorted canonical JSON. Definitions, program IDs and semantic IDs must be unique across the inventory. A second semantic-content hash removes known ID/label/seed/phase/timing decorations, so renamed or phase-only copies cannot inflate the count. The hash checker cannot decide artistic meaning or stop a dishonest author inventing new semantic fields. A real semantic review with evidence is mandatory for production.

## Measured numeric evidence

Each program needs exactly 72 records: 36 current characters × roles A/B, with each character's fixed partner. Live IK may use the actual partner shape. Such measured live evaluation is valid evidence; it is not a bake.

```js
const record = {
  schema: 'kaopu-live-program-numeric-qa/1',
  kind: 'measured-live-program', status: 'passed',
  binding: await liveQABinding(program, character, partner, role),
  evidenceRef: actualPerCaseQAReference,
  harnessSha256: await sha256Bytes(actualHarnessBytes),
  runId: actualRunId, measuredAt: actualRunTimestamp,
  sampleFps: actualSampleFps,
  includesEndpoint: false,
  sampleCount: actualSampleCount,
  metrics: actualMeasuredNumericMetrics,
  checks: actualThresholdChecks,
};
record.numericQaFingerprint = await numericQAFingerprint(record);
```

`metrics` contains finite numeric values, including `finiteFailureCount: 0`, and at least one additional measured metric. `checks` contains explicit thresholds such as `{metric:'finiteFailureCount', max:0}` and `{metric:'maxFootLockErrorM', max:0.001}`. Use the project's genuinely chosen thresholds; this example is not a universal safety or motion-quality standard. Every stated check must pass. Additional observational metrics may remain unthresholded.

The sample count must cover the full duration at the **actual measurement FPS**: `durationSeconds * sampleFps`, plus one if the endpoint is included. Measurement FPS may differ from playback FPS, and must not be misrepresented. The fingerprint covers the entire QA record except its own digest, including metrics, limits, source/rest/role binding and evidence references. It detects stale or edited records. A hash cannot prove the harness really ran, that a reviewer is authentic, or that a coarse sample caught every discontinuity. Preserve the real run artifact and disclose sampling limits. This module does not grant collision, comfort or art-quality certification.

## Gates and fixture policy

Production is the default. It requires `qualityStatus:'reviewed'`, semantic evidence with `status:'reviewed'`, a nonempty `reviewedBy`, and all measured QA checks. The source/definition/bundle hashes and source revision must match the review. Replacing an evaluator dependency invalidates semantic review even if numeric QA is rerun. Pending semantic review is rejected, regardless of the numeric pass.

Explicit `mode:'validation'` permits a candidate with pending visual/semantic review, but still requires real source bytes, complete measured QA and matching fingerprints. It always returns `validationOnly:true`, `canPublish:false`, `productionReady:false`. A candidate preview must retain these labels.

`testFixture:true` on a program or QA record is rejected by default, **including in validation mode**. Tests may separately opt into `allowSyntheticFixtures:true`; every such result is validation-only and never publishable. Never remove fixture flags to promote synthetic records.

```js
const plan = await createLiveComparisonRound(library, characters, 0, {
  mode: 'validation',
  sourceFiles: {'MotionPrograms.mjs': actualProgramSourceBytes, 'MotionR03.mjs': actualEvaluatorBytes},
  comparisonMode: 'same-program', selectedProgramId: authored.id,
});
```

`canPublish` describes this inventory gate only; it does not authorize deployment or certify the surrounding application. Publishing remains the host's separately authorized workflow. `neuralInferenceExecuted:false` is an explicit fact; this module contains no inference path.

## Verification

Run `node motion-architecture/tests/live-program-schedule.mjs` from the workbench root. `LIVE-PROGRAM-SCHEDULE-QA.json` records the synthetic contract test result. It tests 36-round coverage, same-program synchronization, source/definition/rest/partner/role/metric mutation rejection, review gates, fixture rejection, and preservation of the two legacy offline files. It does not claim that the 18 real boxing motions were visually reviewed or that the live rig's numeric QA passed.
