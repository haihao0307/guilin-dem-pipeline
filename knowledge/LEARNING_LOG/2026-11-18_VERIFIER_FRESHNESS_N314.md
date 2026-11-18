# N314 — Valid signatures can still be stale

## One bounded question

Can a previously valid authorized Verifier attestation be replayed after a later dispatch when the content subject is unchanged?

## Fresh baseline

- `main@ad7b81175df8bc9c54cf40effe1029f86696ba76`
- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- no-stale-delivery gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 read through N313 comment `6972552281`; no acknowledgement or implementation receipt followed it.
- #63 remains unchanged since 2026-09-30.
- applicable regressions reread: `MOTHER-NO-METHOD-INVENTION-001`, `MOTHER-NO-THINKING-STALL-R3-001`, `TERRAIN-NO-STALE-DELIVERY-001`, N312, and N313.

## Real failure

N313 authenticates the Verifier key, checks coordinator authorization, verifies the signature, and binds the statement to an exact subject and predicate type. Its verifier has no current-task challenge, monotonic dispatch sequence, observation time, or expiry rule.

The replay used the same content subject but two dispatches:

- old request: `vrq:20261118-1540-a`, sequence 313;
- current request: `vrq:20261118-1940-b`, sequence 314.

The old authorized signature remained cryptographically valid. N313 returned:

`DEPENDENCY_CLOSURE_VERIFIED`

This is a stale-evidence bypass rather than a signature failure. Content identity answers “what bytes”; it does not answer “was this verified for the current instruction after dispatch.”

## External teacher audition

Candidate: The Update Framework rollback and freeze protections.

The bounded novelty over KAOPU Current Best View is:

- validly signed metadata can still be obsolete;
- clients persist trusted versions and reject lower or equal versions where freshness requires progress;
- expiration is checked against one fixed update-start time;
- persisted client state is necessary to recognize rollback after restart.

Primary sources:

- https://theupdateframework.github.io/specification/latest/
- https://theupdateframework.io/docs/security/
- https://github.com/theupdateframework/specification
- https://github.com/theupdateframework/python-tuf
- https://github.com/theupdateframework/python-tuf/tree/develop/tests

Teacher status: `TEACHER_CANDIDATE`; lifecycle remains `TEACHER_CANDIDATE`; registry state `NOT_ADDED`; Mother query `NOT_QUERIED/UNKNOWN`.

## Eight-part screening

1. **Source/provenance:** official TUF specification, security documentation, and repositories under theupdateframework.
2. **Maintenance:** specification v1.0.37 was released 2026-10-08; specification activity was observed through 2026-10-16. python-tuf v7.0.1 was released 2026-09-01 and repository activity was observed on 2026-11-18.
3. **Runnable evidence:** Python reference implementation, repository simulator, generated and repository test data, API tests, examples, and release verification tooling are present.
4. **License/rights:** specification uses Community Specification License 1.0; python-tuf is dual Apache-2.0/MIT. This probe imports no TUF code or assets.
5. **Direct relevance:** explicitly distinguishes authenticated metadata from fresh metadata and models replay as rollback/freeze.
6. **Novelty:** KAOPU requires post-dispatch validation in prose, but N313 lacks a signed current challenge, monotonic trusted state, and bounded expiry.
7. **Integration risk:** no external dependency in the prototype. Full python-tuf integration would be excessive; real costs are trusted time, persistent state, unique challenge generation, crash recovery, and per-Mother window selection.
8. **Failure risks:** TUF detects possible withholding/freeze but cannot force an update. Clock failure, lost trusted state, malicious version fast-forward, or non-persisted semantics can recreate the bypass.

## Minimal falsifiable trial

The Candidate prototype reuses N313's public test-fixture Verifier key, then adds only dispatch freshness fields.

Results:

- old signed attestation on new request → `HOLD_VERIFIER_CHALLENGE_MISMATCH`
- old signed dispatch sequence → `HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK`
- observation before dispatch → `HOLD_STALE_VERIFIER_ATTESTATION`
- observation outside five-minute trial window → `HOLD_STALE_VERIFIER_ATTESTATION`
- future observation beyond allowed skew → `HOLD_VERIFIER_TIME_INVALID`
- fresh current request and sequence → `DEPENDENCY_CLOSURE_VERIFIED`
- rolled-back task anchor against persisted sequence → `HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK`

Probe SHA-256: `070aa3d2f11f9f05d8872a995f1b7fbd0a99216b70d2450f980fd789a86a0c4f`.

Audit note: the first intended “expired” fixture was seven minutes old under a ten-minute window and correctly passed. The window was then explicitly changed to five minutes before rerunning. No passing case was relabeled as failure.

## Candidate translation

For a bounded Mother trial, add to the Task Anchor:

- unpredictable unique `verificationRequestId`;
- monotonic `dispatchSequence` with persisted prior-state digest;
- `dispatchTime` and named trusted-clock route;
- evidence-type-specific `maxAttestationAgeSeconds`.

The authorized Verifier signs the request ID, sequence, observation time, exact subject, context digest, method, and raw-evidence digest. The verifier fails closed on challenge mismatch, rollback, pre-dispatch evidence, expiry, or invalid future time.

This is not a proposal for one global five-minute rule. The five-minute value is only a deterministic probe fixture.

## Boundaries

- Synthetic request IDs and times do not implement a production challenge or trusted clock service.
- Fresh evidence can still be false, visually wrong, device-wrong, or unaccepted by the user.
- Producer-controlled current time or persisted sequence state does not close the gate.
- Appropriate freshness windows remain `UNKNOWN` until a specific Mother trial.
- The full TUF updater architecture is not adopted.
- No production Mother, main, R2 OS, adapter registry, or public KaoPuGram service changes.

Learning branch status: `HOLD_GATE_FAIL`, Candidate regression `CANDIDATE_INACTIVE`, `GATE-RUN=true`.

Routing: targeted `POSTED=true` to #91 as comment `6977730144`; `ACKNOWLEDGED=false`, production `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. KPI values remain `UNKNOWN`.
