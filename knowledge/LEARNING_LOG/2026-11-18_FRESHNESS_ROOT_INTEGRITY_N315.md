# KAOPU Learning Flywheel N315 — Freshness root integrity

## One bounded question

Can N314 be bypassed after verifier restart by resetting its trusted sequence state and rewinding its trusted clock, then replaying the complete old dispatch and authorized attestation bundle?

## Baseline read

- `main`: `ad7b81175df8bc9c54cf40effe1029f86696ba76`
- root `AGENTS.md`: `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- no-stale-delivery gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest production/coordination feedback before this run: N314 comment `6977730144`
- #63: 30 comments; no newer production acknowledgement since 2026-09-30
- applicable regressions re-read: `MOTHER-NO-METHOD-INVENTION-001`, `MOTHER-NO-THINKING-STALL-R3-001`, `TERRAIN-NO-STALE-DELIVERY-001`, N314 `ANCHOR_STALE_VERIFIER_ATTESTATION_REPLAY_001`

No baseline file changed since N314. No Mother acknowledgement was found.

## Existing failure → executable counterexample

N314 correctly rejects an old verifier attestation when it is compared with a later request, later dispatch sequence, persisted sequence state, and trusted current time. However, the prototype function accepts both `state` and `now` as ordinary arguments.

The N315 replay restores the whole N313 bundle:

- old dispatch sequence `313`;
- old request `vrq:20261118-1540-a`;
- its valid authorized verifier signature;
- reset state `{ highestAcceptedDispatchSequence: 0 }`;
- rewound `now = 2026-11-18T15:48:00+08:00`.

N314 returns `DEPENDENCY_CLOSURE_VERIFIED`. The signature is valid and the challenge matches because the attacker replayed the old task anchor too. The sequence and time checks pass because their roots were reset by the same caller.

This is a new executable failure mechanism, not a new policy principle.

## External method comparison

Teacher decision: `NO_NOVELTY`.

The Update Framework evidence audited in N314 already says that rollback/freeze detection depends on persisted trusted version state and a fixed trusted time. N315 does not add a second teacher or a broader framework. It shows that KAOPU recorded the boundary but did not transfer it into N314's executable input provenance.

## Falsifiable hypothesis

If the verifier refuses caller-provided freshness roots and instead requires an independently pinned, coordinator-signed checkpoint with monotonic sequence, fixed trusted time, and predecessor digest, then reset/rewind replay will fail without breaking a fresh current attestation.

## Minimal trial

The prototype treats an out-of-band constant as the independent pin and validates a signed checkpoint before invoking N314 logic:

| Trial | Result |
|---|---|
| reset state + rewound time + entire old bundle | vulnerable `DEPENDENCY_CLOSURE_VERIFIED` |
| missing checkpoint after initialization | `HOLD_FRESHNESS_ROOT_MISSING` |
| older valid coordinator checkpoint | `HOLD_FRESHNESS_CHECKPOINT_ROLLBACK` |
| Producer-signed checkpoint | `HOLD_PRODUCER_FRESHNESS_ROOT` |
| same sequence, wrong predecessor digest | `HOLD_FRESHNESS_CHECKPOINT_LINEAGE_MISMATCH` |
| old bundle against current checkpoint | `HOLD_VERIFIER_DISPATCH_SEQUENCE_ROLLBACK` |
| fresh request/attestation against current checkpoint | `DEPENDENCY_CLOSURE_VERIFIED` |

## Candidate transfer

Candidate-only additions:

- Task Anchor: `freshnessScopeId`, `freshnessCheckpointSequence`, `freshnessCheckpointDigest`, `freshnessCheckpointAuthorityPolicyDigest`, `freshnessCheckpointRoute`.
- Checkpoint: `scopeId`, `checkpointSequence`, `highestAcceptedDispatchSequence`, `trustedTime`, `previousCheckpointDigest`, `coordinatorKeyId`, signature.
- Missing state after initialization fails closed; it never silently becomes genesis.
- Producer cannot sign or choose the freshness root used to validate its own evidence.

## Boundary and decision

`HOLD_GATE_FAIL`.

The probe only proves protocol behavior with deterministic fixture keys and an in-code pin. A real independently controlled durable store, restart recovery, coordinator availability, checkpoint equivocation detection, trusted-time route, and key rotation remain `UNKNOWN`. No production Mother, `main`, R2 OS, registry, or public service is changed.

Lifecycle after routing: `POSTED`; `ACKNOWLEDGED=false`; `IMPLEMENTED=CANDIDATE_PROBE_ONLY`; `GATE-RUN=true`; `ADOPTED=false`; `USER-ACCEPTED=false`.
