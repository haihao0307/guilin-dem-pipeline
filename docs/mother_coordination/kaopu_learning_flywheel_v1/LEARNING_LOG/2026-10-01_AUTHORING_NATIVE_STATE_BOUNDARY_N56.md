# N56 — Separate authoring state synchronization from native substep history

Status: targeted Candidate for the shorts R2.4 Mother. No production branch, `main`, `gh-pages`, R2 baseline, existing production gate, schedule, or other Mother is changed.

## Bounded question

When `requirePreviousClosure` checks a state field named `previous`, must the receipt declare whether the check proves authoring-boundary continuity or exact native-substep history?

## Existing real failure

The current shorts source uses the same particle `previous` field in two semantically different contexts. `continueShortsWaistbands` writes `previous = pos` while placing waistband rows and then calls stitch joins with `requirePreviousClosure: true`. The same function finally resets every particle to `previous = pos` and zero velocity. Source subject: `shorts-r24/ShortsWaistContinuation.js` blob `ee1ea32779afe99bea60d92f0a356591f725e153` on production head `05e6b432efa62b6e2e7156f45b7cb88b50ba66e7`.

Fresh production feedback exposed the ambiguity: the current parent stitch gap was zero, but `parent.previous` still described the pre-blue closure state and caused `Parent waist source stitch failed`. A one-time `previous=current`, `velocity=0` synchronization at the authoring boundary cleared that stale state without advancing physics time or replacing native history. That repair is legitimate only as authoring initialization; it would be invalid if presented as proof that a previous native substep was closed.

## External method and evidence

FMI 3.0.2 defines explicit simulation states rather than treating one mutable state vector as proof of every phase. Initialization Mode computes consistent initial conditions. Step Mode advances time, and iteration in Step Mode restores a previously stored complete state before repeating the step. Official specification: <https://fmi-standard.org/docs/3.0.2/> (sections 2.3.3, 2.2.7.4 and 4.2.1).

Transferred method: type the state evidence by phase. Initialization synchronization and previous accepted step history are both useful, but they prove different claims and cannot substitute for one another.

## Comparison with current KAOPU rules

R2 already enforces `LOCK → EXECUTE → VERIFY → PROMOTE`, Task Anchors, independent verification and explicit lifecycle states. The current reference and freshness gates block creative substitute and stale delivery. None of the three required baseline documents declares whether a `previous` simulation state is an authoring initialization witness or a native-step witness. The new element is therefore an executable state-evidence type boundary, not another general phase paragraph.

## Falsifiable hypothesis

If every previous-closure receipt declares `phaseKind` and `requirePreviousClosurePurpose`, and an authoring reset is accepted only when physics time and substep identity remain unchanged, then the gate will:

1. hold the observed stale-authoring-state failure;
2. accept the bounded authoring synchronization without calling it native evidence;
3. reject the same reset when it is used to claim native continuity;
4. reject any reset inside a native step;
5. accept exact prior-substep history; and
6. fail closed when phase is undeclared.

The hypothesis is falsified if any reset can satisfy a native-history claim, if a clock-advancing authoring reset passes, or if an exact native prior-substep control is held.

## Minimal historical replay

Executable fixtures and evaluator are in `PROBES/authoring_native_state_boundary_*_n56`. Result: `7/7 passed`.

- observed stale authoring previous state → `HOLD_AUTHORING_PREVIOUS_STALE`;
- legal authoring sync → `PASS_AUTHORING_STATE_SYNC_NOT_NATIVE_EVIDENCE`;
- authoring sync claimed as native → `HOLD_NATIVE_EVIDENCE_FROM_AUTHORING_RESET`;
- native step with reset → `HOLD_NATIVE_HISTORY_RESET`;
- exact native prior-substep control → `PASS_NATIVE_PREVIOUS_CLOSURE`;
- missing phase → `HOLD_STATE_PHASE_UNDECLARED`;
- authoring sync that advances clock/substep → `HOLD_AUTHORING_SYNC_CHANGED_CLOCK`.

## Applicability boundary

Apply only to the shorts R2.4 Mother when a closure/join gate reads both current and previous particle states across an authoring/native boundary. This Candidate does not change cloth physics, source paper, UVs, time stepping, strain limits, contact thresholds, browser proof or user acceptance. It does not certify the later W, body-contact, self-contact or native stages. Other Mothers must not inherit it without their own replay.

## Decision and routing

Decision: retain as a local Candidate and route through issue #91 for the next relevant shorts Task Anchor or Delivery Receipt. Required receipt fields are enumerated in `REGRESSION_CASES/CANDIDATE_AUTHORING_NATIVE_HISTORY_SEPARATION_001.json`. Rollback point: coordination commit `bd38212ef1037579fdfba36a35509372ebd8da17`.

Routing receipt: issue #91 comment <https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5928984159>. Lifecycle: `POSTED=true`, `IMPLEMENTED_CANDIDATE=true`, `GATE-RUN=true`; `ACKNOWLEDGED=false`, `ADOPTED=false`, and `USER-ACCEPTED=false`. Reliable KPI deltas are `unknown`.

No external AI is claimed or invoked as a participant.
