# R03 authored boxing motion library

## Scope and provenance

This is original authored procedural choreography using the accepted native Anny 104-bone skeleton and the R01/R02 analytical FK/IK implementation. It does not execute a neural motion model, contain verified teacher-generated motion clips, change the body/head shape, replace the full skinned mesh, perform per-frame shape evaluation, or claim physical contacts from planned evasions.

18 composed two-person programs use 12 primitive actions. Program count is not primitive count, phase-offset count, actor count, or model-generated clip count. `MotionPrograms.mjs` contains readable attack/response sequences and independent footwork paths with different phrase timings. All use one canonical 16-second clock.

## Controller API

Import `createBoxingRig`, `sampleBoxingPair`, `BOXING_PROGRAMS`, `createProgramRound`, `recommendPairSeparation`, and `RECOMMENDED_PLAYBACK_SPEEDS` from `MotionR03.mjs`.

`createBoxingRig({names, parents, restMatrices, stature, child})` uses the actor's actual neutral shape-specific rest skeleton. Its `evaluate(seconds, options)` supports:

- `pairIndex`: accepted catalogue pair 0–17
- `fighter`: physical actor 0/1
- `programId`: explicit ID or semanticMotionId; overrides automatic round allocation
- `programIndex`: explicit 0–17 index; overrides automatic round allocation
- `roundIndex`: nonnegative integer. Without explicit program, arena i plays `(i + roundIndex) % 18`; rounds 18–35 swap authored A/B roles. The actual physical actor and body shape stay fixed.
- `opponentStature`: actual partner stature, for bounded target-height adaptation
- `child`: use true for BOTH children and teenagers, light non-contact mode
- `intensity`: 0–1.25, default 1
- `contactIK`, `footLock`: default true; disable only for diagnostics
- `poseOutput`: optional complete native local-ref rotation-vector-degrees pose
- `restFingerprint`: opaque actual calibrated rest fingerprint, included in state
- `contactResponse`: optional explicit overlay described below

The output is a cached mutable object. Copy data before retaining a prior frame. `posedMatrices`, `skinMatrices`, and `rootTranslation` are native Z-up, forward -Y, row-major matrices acting on column vectors. Root translation is already included in both matrix arrays. Never apply it a second time. Preserve the model's neutral floor offset; no per-frame bounding-box grounding is needed or allowed.

`state` includes `semanticMotionId`, immutable authored `takeId`, separate `restFingerprint`, `attackPhase`, `defensePhase`, `activeAttackId`, and `plannedResponses[].causedByAttackId`. Responses carry `source:'planned-choreography'`. Semantic identity is never derived from take/seed/rest shape.

Time is never multiplied inside `evaluate`. The controller advances time once using the exported factors `{quicker:1.14, original:1, slow:0.55}`. Same-program comparison means identical canonical time and explicit program for every pair; do not give each body a different speed or phase. A program/role-round boundary is seamless at 0/16 s. Switching programs mid-phrase is not a promised blend and should be deferred to the neutral boundary.

## Numerical scope boundary

All 1,296 source/shape/partner/role bindings cover base choreography with external contact feedback disabled. This is explicit in every inventory program's `executionConfig.contactOverlay`. Neither that inventory nor the base-program review certifies the complete contact-feedback loop. `CONTACT-OVERLAY-BOUNDS-QA.json` is a separate synthetic-input API constraint test, not detected hits or Jolt footage. Real Jolt shape-cast events, continuous feedback/recovery, actual scene transforms and contact-loop visual acceptance must be tested independently by the controller.

## External Jolt overlay

Only the controller/Jolt layer detects contacts and integrates response. This layer accepts:

```js
contactResponse: {
  space: 'native-local-z-up',
  source: 'jolt-shape-cast',
  eventId: '<actual external event id>',
  torsoDisplacementNative: [x, y, z],
  headRotationVectorNativeRadians: [rx, ry, rz]
}
```

The controller converts world-Y-up vectors into each actor's native local basis first. The torso displacement vector is magnitude-capped at 0.065 m. Its horizontal components become distributed bounded spine inclination. Vertical translation is not applied: there is no pelvis/head mesh teleport or limb stretch. Head rotation-vector magnitude is capped at 0.2 radians and composed with authored native head pose. The spine/shoulders/arms/head are evaluated together through the full FK/IK hierarchy. No second event timer, spring, decay or collision test is run here. Invalid spaces or non-finite fields are rejected diagnostically. Child/teen mode ignores collision recoil entirely. A test fixture overlay demonstrates API behavior only and is not recorded as a physical hit.

## Feet, reach and distance

Each program has explicit alternating swing windows, stationary planted targets, and closed-loop reset landings. Swing height is a sin⁴ profile; translation is quintic C2. Root weight-transfer intent moves toward the planted side continuously. Planted toe pivots are maintained by full analytic leg IK. Feet never both swing at once. These are authored support constraints, not a solved physical balance model.

Punch reach is based on each rest skeleton's arm segment lengths; stride on stature. Jab/cross use straight endpoints, hook follows an outward-then-across arc, and clavicles, shoulders, hips, spine and head participate. Actual generated full-body matrices preserve bone lengths and all native bones.

R03 safe pair distances are calibrated against all 18 programs, both authored roles and the exact accepted 36 shapes. `MotionRangeR03.mjs` and `reports/PAIR-RANGE-QA.json` define the fixed per-pair air-practice separation. The conservative torso/neck/head full-CSR surface bound deliberately ignores lateral clearance, so it can be more spacious than a natural sparring distance. Child/teen desired gap is 12 cm, adult 6.5 cm, plus an empirical temporal allowance. The radius is the R02 main striking-shell bound around its preserved 0.75 wrist-to-knuckle center; the deformable rear cuff is excluded. This is not a swept collision certificate, complete-cuff bound, glove-vs-glove assertion or adult light-contact setting. Actual Jolt shape casts remain the contact authority. New body shapes or a different controller transform require revalidation/recalibration.

## Reproduce validation

Run in this directory:

```sh
node tests/build-fixtures.mjs
node tests/build-surface-bounds.mjs
node tests/calibrate-pair-range.mjs
node tests/test-contract.mjs
node tests/validate-motion.mjs
```

Fixtures are rebuilt read-only from the accepted R02 workbench. Default numeric validation is 60 Hz, 18 programs × 36 shapes × both roles, one complete 16-second cycle plus exact endpoint. It computes every joint's local angular speed/acceleration, finite matrices, matrix continuity, limb-length/orthogonality error, support-foot lock, reach, and paired skeletal broad-phase spacing. Epsilon probes also surround every event/landing and the loop seam. Matrix/source/harness/rest fingerprints must match the tested versions. `FPS=30` is supported for lower-cost complete sampling, clearly recorded as 30 Hz. `START_PROGRAM`, `PROGRAM_LIMIT`, and `REPORT` permit independent partitioned runs with the same harness.

The numerical pass does not assert visual acceptance, anatomically perfect boxing, film-quality motion, true collision response, or whole-surface nonpenetration. The parent must review the complete original skin in a real browser, with camera changes, slow playback, role swaps and actual Jolt tests.

## Delivered evidence

- Deployment: `LIVE-PROGRAM-INDEX.json`, `loadMotionInventory.mjs`, `inventory/*.json.gz`, and `reports/<programId>.json.gz`. Every deployed evidence locator points at an existing report shard.
- Local development only, do not upload the large monolith: `LIVE-PROGRAM-INVENTORY.json` contains 18 live program wrappers and exact accepted36 character fingerprints, with 1,296 measured shape/partner/role bindings. Source refs are `./MotionPrograms.mjs`, `./MotionR03.mjs`, `./MotionRangeR03.mjs`, `./NativeRestFingerprint.mjs`; retain those keys when supplying sourceFiles to the independent scheduler.
- Local development only (deployed as per-program report shards plus `reports/MOTION-QA-SUMMARY.json.gz`): `reports/MOTION-NUMERIC-QA.json` contains complete final 30 Hz release-candidate measurements, 623,376 samples. This report was merged from three complete matching-source/harness partitions.
- `reports/WORST-POSE-REPLAY.json`: per-program worst angular speed and acceleration, exact actor/role/joint/time, and reproduction options/windows.
- `reports/FOOT-SURFACE-QA.json`: 46,512 full-CSR foot-surface poses across all programs, original shapes and both roles.
- `reports/PAIR-RANGE-QA.json`: full-program conservative torso/head air-distance calibration and explicit glove-shell/cuff limitations.
- `reports/LIVE-INVENTORY-QA.json`: 18 distinct semantic definitions, all 1,296 bindings and same-program/role-rotation gates pass; production remains blocked pending browser visual review.
- `reports/DEVELOPMENT-FAILURES.md`: actual problems found, corrected, and explicitly non-acceptance exploratory evidence.

The runtime definitions retain their authored candidate annotation. The independently validated live-inventory wrapper is the authority for measured/reviewed status. Do not treat a code comment or numeric pass as visual acceptance. The wrapper currently says `qualityStatus: numeric-reviewed` and `semanticReviewEvidence.status: pending`.

For lower-memory final coverage, use `node --max-old-space-size=192 --max-semi-space-size=8` with `FPS=30` and the three program partitions, then run `tests/merge-reports.mjs` and `tests/build-live-inventory.mjs`. Do not merge partial runs or change code/thresholds while a measured run is in progress.

## Corrected response direction

The final native torso intent uses `cross(up, offset) = (-dy, +dx, 0)`: pitch is `-dy`, roll is `+dx`. `reports/CONTACT-OVERLAY-DIRECTION-QA.json` measures actual FK head/spine01 displacement projected onto each native ±X/±Y request at both 2 cm and 6.5 cm. All65,280 adult direction samples have positive projection; all32,640 child/teen samples suppress the overlay exactly. The earlier sign failure is recorded transparently in DEVELOPMENT-FAILURES.md.

The entire base-program numeric harness was rerun under the corrected source, not merely rebound to a new hash. `BASE-RERUN-COMPARISON-QA.json` shows all1,296 freshly measured records equal the prior no-overlay records. Range and complete foot-surface diagnostics were also rerun under the corrected source. The `pre-overlay-sign-fix` module and before-fix report are local diagnostic archives, not deployment files.
