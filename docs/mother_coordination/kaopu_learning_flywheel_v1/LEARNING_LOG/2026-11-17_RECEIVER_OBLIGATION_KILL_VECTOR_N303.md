# N303 — Receiver obligation kill vector

## One bounded question

How can adjacent-function liveness be normalized across Mothers without importing excavator-specific topology, action scale, mesh count, frame count, or sample duration?

## Current production failure and baseline

N302 established that a receiving Mother needs a target-negative oracle, an adjacent-positive oracle, and paired mutants, but explicitly left cross-Mother normalization unresolved. Motor and Train still have no receiver receipt or acknowledgement; this run does not infer either one.

R2 OS and the two existing anti-substitute/anti-stale gates remain the baseline. This Candidate changes no production Mother, no main branch, and no global gate.

## One external method audited

StrykerJS provides an explicit mutant state taxonomy and mutation score model. The official project is an active public TypeScript repository, has unit/integration/e2e checks, uses Apache-2.0, and currently requires Node 22 or 24 in its protected-branch checks. The audited source is exact commit `8f24ef0be3a2119fc44ac48bfce58930ab2c9032`.

Teacher risk matters: release `v10.1.1` is explicitly a re-release after a release-process provenance problem. Therefore any later audition must pin an exact source commit or tag; package name or reputation is not provenance.

### What it knows beyond KAOPU Current Best View

For this bounded problem it contributes machine-readable distinctions among `KILLED`, `SURVIVED`, `NO_COVERAGE`, `TIMEOUT`, runtime/compile errors, and ignored/not-run work. KAOPU already had the two semantic oracles and paired mutants, but did not yet have a cross-Mother receipt rule that treats them as a mandatory obligation-state vector.

## Candidate adaptation

Normalize the semantic obligations, not raw measurements:

1. `O_NEG_TARGET_ABSENT` — the forbidden target behavior is absent; mandatory mutant `M_NEG_REENABLE_TARGET` must be `KILLED`.
2. `O_POS_ADJACENT_LIVE` — the receiver's adjacent required function remains live; mandatory mutant `M_POS_DISABLE_ADJACENT` must be `KILLED`.

The receiver defines its own object, trigger, observation, threshold, and sample window. Counts, distances, frames, and durations remain receiver-local evidence.

Acceptance is deliberately stricter than a generic aggregate mutation score:

- both mandatory mutants exactly `KILLED` → Candidate `PASS`;
- `SURVIVED`, `NO_COVERAGE`, `TIMEOUT`, error, ignored, not-run, or unknown → `HOLD`;
- aggregate score is descriptive only and cannot authorize adoption.

This also deliberately refuses Stryker's generic treatment of `TIMEOUT` as detected: for an acceptance-critical KAOPU obligation, timeout does not prove the intended oracle caught the intended defect.

## Minimal falsifiable replay

The replay compared a 95% aggregate-score threshold with the mandatory vector:

- 99 noncritical kills plus one critical adjacent-liveness survivor produced 99.01%; the score passed, the vector held.
- 99 noncritical kills plus one critical `NO_COVERAGE` also produced 99.01%; the score passed, the vector held.
- a critical timeout produced 100% under the generic detected formula; the vector held.
- only the case where both mandatory mutants were killed passed the vector.

Result: `SUPPORTED` for the bounded hypothesis that semantic obligation states transfer across Mothers more safely than aggregate counts or scores.

## Boundary and next step

This is `TEACHER_CANDIDATE / AUDITION`, not an active teacher and not a global rule. Full StrykerJS integration is not proposed; its Node dependency and repeated-test cost are unnecessary for this two-mutant audition.

Motor and Train remain `NOT_QUERIED/UNKNOWN` until the affected Mother returns an actual receiver receipt answering only:

1. Is the problem real for this receiver?
2. Is the obligation-vector rule already covered?
3. Which semantics and receipt fields are worth learning?
4. What is the smallest receiver-specific falsifiable replay?

No ACK means no claim of implementation, adoption, learning, or user acceptance.
