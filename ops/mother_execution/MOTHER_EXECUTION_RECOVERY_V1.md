# Mother Execution Recovery Protocol V1

Date: 2026-09-19

## Problem being corrected

A branch, issue, long reasoning response or statement that a Mother is “thinking” is not execution. The only reliable evidence of work is a traceable artifact tied to the assigned branch and acceptance gate.

This protocol is not personal punishment. It removes ownership, scope and merge privilege from a lane that repeatedly produces no verifiable work. Emotional criticism, insults and destructive changes are prohibited because they do not improve execution quality.

## Definition of started

A lane is `STARTED` only when all four exist:

1. a lane-specific executable code commit after dispatch;
2. an automated test or numerical check run against that commit;
3. a work receipt with base SHA, head SHA, exact command and result;
4. a known-limitations / blocker record.

Planning-only commits, branch creation, issue creation, screenshots without source change, or repeated restatements of the task are `NOT_STARTED`.

## Bounded work cycle

### T+0 to T+15 minutes — orientation

Read the assigned branch HEAD and task. Post or commit a start receipt naming:

- exact branch and HEAD;
- first file/function to change;
- first test to run;
- one protected invariant;
- one expected first artifact.

### T+15 to T+45 minutes — smallest executable delta

Implement the smallest behavior-changing vertical slice. Research may support it but may not replace it. If the task is blocked by a missing source asset, implement only source-independent interfaces/tests that are genuinely reusable and mark synthetic fixtures explicitly.

### T+45 to T+90 minutes — prove and record

Run tests, produce visual evidence where appropriate, commit a receipt and identify the next bounded delta.

## Blocked-state contract

“Still thinking,” “investigating,” “planning,” or “waiting” without specifics is invalid.

A valid `BLOCKED` report must include:

- exact missing input or failing command;
- full error or reproducible symptom;
- what was tried;
- what can still be implemented without inventing evidence;
- one decision or asset required from the coordinator/user.

A blocked lane remains useful only by producing a bounded, source-independent artifact or by returning ownership promptly.

## Task fidelity and freshness

Execution evidence must be fresh and target-faithful, not merely executable.

For every bounded task, record a dispatch anchor with at least:
- taskId;
- branch;
- base SHA;
- target object;
- target defect/change;
- expected artifact;
- protected invariants;
- forbidden substitutions.

A claimed new result is invalid if it predates dispatch, comes from an older head/release, or shows a different target. Old artifacts may be used only as BASELINE/BEFORE.

If no new artifact exists after dispatch, report `NO_NEW_ARTIFACT`. Reusing an old screenshot/page/model to create the appearance of progress is `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`.

If the newest build fails, do not silently show a fallback old build as current. Any fallback must be explicitly marked `FALLBACK_ACTIVE=true` and is not acceptance evidence.

Validation-only tasks may have no source diff, but the validation run itself must be new, executed after dispatch, and bound to the exact tested commit.

For overnight / next-morning tasks, the next session must read the latest task anchor and last user instruction before doing anything else. It may not choose a new target, revive an older route, or substitute yesterday's artifact for the requested new result.

## Operational consequences

1. **45 minutes without an executable delta:** mark `AT_RISK`; stop expanding scope; force the smallest testable task.
2. **90 minutes without code + test + receipt:** mark `NOT_STARTED`; reject the progress claim.
3. **Two hours without a valid artifact or blocker:** revoke lane ownership, freeze that branch for integration and reassign the task.
4. **Two consecutive failed cycles:** move the Mother to `REVIEW_ONLY`; it may critique or test but may not own a production lane until it completes two consecutive artifact-bearing recovery cycles.
5. **False claim of completion or hidden failed gate:** reject the entire delivery, reopen the issue and require a clean receipt. No destructive punishment, deletion or humiliation is permitted.
6. **Repeated planning-only commits:** do not merge them into production; keep them as notes only.

## Coordinator duties

The coordinator must not create the illusion of parallel execution. A new branch and issue are only dispatch infrastructure. The coordinator must:

- inspect branch heads and diffs rather than accept chat claims;
- preserve one authoritative contract per shared field;
- reject duplicate water, terrain, fish, collision or identity systems;
- publish explicit merge order;
- report `NOT_STARTED` honestly;
- reassign stalled work instead of waiting indefinitely;
- keep visual acceptance and production readiness false until actually proven.

## Recovery targets on 2026-09-19

- Landscape: move from Formation Event Field planning/QA into the bounded beach-profile executable task.
- Ocean Mother: move from the frozen R0.2.1 handoff into an adapter-based shoreline/swash vertical slice without mutating canonical source.
- Game Mother: the Stone Money fishing lane remains `NOT_STARTED` until it has a post-dispatch code commit, tests and limitations receipt.
- Ocean Life: recent anatomy-interface work is real code/test progress, but it is not a source-bound fish reconstruction or beach-life integration; R04 must now deliver the bounded `intertidalAt` adapter.

## Status vocabulary

Only these states are allowed:

- `NOT_DISPATCHED`
- `DISPATCHED_NOT_STARTED`
- `STARTED`
- `AT_RISK`
- `BLOCKED_VALID`
- `BLOCKED_INVALID`
- `READY_FOR_REVIEW`
- `REVIEW_ONLY`
- `ACCEPTED`

No status called “thinking” exists.
