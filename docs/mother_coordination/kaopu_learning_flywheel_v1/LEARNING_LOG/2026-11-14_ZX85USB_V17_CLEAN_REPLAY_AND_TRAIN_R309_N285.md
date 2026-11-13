# N285 — ZX85USB v17 clean-room replay evidence and Train R309 binding check

Date: 2026-11-14  
Status: **existing regression evidence update / local Candidate / not adopted**  
Target: current method exemplar revision v17 and the first observed Train target

## One bounded question

Has ZX85USB checkpoint v17 now crossed the N284 `sourceArtifactRevisionGate` and produced a replayable Method Anchor that Train R309 can legitimately claim to implement?

## Required fresh reads

Current main remains `8aec1b1dca9619c0b59fc8fa480f65f226be7145`. Required baseline blobs remain unchanged:

- root AGENTS `251b664646a489e9292748f1d41998ee62a338f5`
- R2 `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 now contains Mother coordination comment `6861656094`, which audited checkpoint v16 and held runtime/publication closure. It is coordination evidence, not a Mother ACK. #63 remains unchanged.

Applicable existing regression: `MOTHER-NO-METHOD-INVENTION-001-N283-METHOD-ANCHOR`. No duplicate case is created.

## Exact fresh subject

Current Library checkpoint:

- Library ID: `libfile_841f9900a5ec81918f2df377bf8e292f`
- version: `17`
- modified: 2026-11-14 03:27:10 Asia/Shanghai
- bytes: 7,778,432
- SHA-256: `d244dd3961a6f96f88db573b25f5bf4351975c3f4078f8520085974e95de5e07`

This supersedes both N284 v9 and the coordination meeting's v16 subject.

Independent byte and structure audit:

- extracted files: 1,205
- manifest entries: 1,204
- manifest missing: 0
- manifest digest mismatch: 0
- scanned JS/MJS/HTML/CSS files: 513
- relative references observed: 908
- unresolved relative targets: 453
- named Task Anchor files: 0
- named Delivery Receipt files: 0
- named publication proof files: 0
- named Method Anchor files: 0

The archive is internally checksum-consistent, but not runtime-closed.

## One falsifiable replay

The new R05 viewer carries `TEST_RESULT.txt` reporting three tests passed. Its README also says the tests use actual whole factories while explicitly withholding browser/WebGL/device acceptance.

Clean-room command against the extracted v17 bytes:

`node --test zx5a-whole-viewer-r05/weather-integration.test.mjs`

Observed result:

- process exit: 1
- tests passed: 0
- tests failed: 1
- fatal error: `ERR_MODULE_NOT_FOUND`
- first missing dependency: `front-r04-release/.sites-checkout/dist/boom-functional-r05/vendor/three.module.js`

The test source directly imports that omitted path. Therefore the carried three-pass text proves only that the test ran in another dependency environment. It is not a replay receipt for the delivered digest.

## First target observation

Current Train Library projection:

- Library ID: `libfile_9aff9f5528f08191a47e5ba0a6e801ed`
- version: `145`
- modified: 2026-11-14 01:21:13 Asia/Shanghai
- bytes: 11,744
- reported current revision: R309

R309 reports a real bounded construction delta: 515 built partial items, twin external cylinders, crossheads, main rods and a removable guide assembly. Its own scope remains “非完整列车”.

The current target still provides no:

- `methodAnchorId`;
- bound ZX85USB version or digest;
- target-specific dependency BOM;
- accepted/rejected parent baseline;
- target replay receipt;
- independent verifier receipt.

Thus R309 is `Observation` of target progress, not proof of Method Anchor implementation.

## Current Best View comparison

N284 already required a revision gate and target binding. Mother coordination then required empty-directory startup, zero missing dependencies and an exact served-version/publication receipt.

v17 adds source, tests and a new viewer revision, but fails the first executable replay before any browser or target acceptance question is reached. The Train target advances in quantity and subsystem scope, but remains unbound to the exemplar revision.

## Candidate refinement

The existing Candidate is refined in place with `cleanRoomReplayReceipt`:

- `subjectSha256`
- `entrypoint`
- `dependencyResolution`
- `environment`
- `startedAt`
- `exitCode`
- `fatalErrors`
- `testCounts`
- `verifier`

Audit rule: an embedded `TEST_RESULT` is `Observation` only until the current digest passes a clean-room replay with dependency resolution and an exit-code receipt.

This does not create a new global rule. It makes the existing Method Anchor Candidate executable against the new real counterexample.

## Decision

`HOLD_V17_CLEAN_REPLAY_FAILED_AND_TRAIN_R309_UNBOUND`

Boundaries:

- v17 manifest integrity: **PASS**
- v17 portable runtime closure: **FAIL**
- carried R05 pass log as current replay proof: **FAIL**
- Train R309 real construction progress: **OBSERVED**
- Train R309 Method Anchor implementation: **NOT PROVEN**
- method adoption / production acceptance / user acceptance: **NOT GRANTED**

## Teacher disposition

No new teacher entered audition. CMU/SEI remains `TEACHER_CANDIDATE` in lifecycle `AUDITION`. The v17 clean-room failure is new evidence for the already-auditioned attached production-plan/dependency discipline, not new teacher knowledge.

## Lifecycle

- coordinator routing: `POSTED=true` at [#91 issuecomment-6863088650](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6863088650);
- local Candidate: `IMPLEMENTED=true`;
- v17 clean-room replay: `GATE-RUN=true`;
- Mother response: `ACKNOWLEDGED=false`;
- production implementation: `IMPLEMENTED=false`;
- adoption: `ADOPTED=false`;
- user acceptance: `USER-ACCEPTED=false`;
- KPI effect: `UNKNOWN`.

No main, R2, production Mother, Site, public route, Train asset or ZX85USB asset was modified.
