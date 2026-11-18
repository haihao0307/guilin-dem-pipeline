# N316 — KaoPuGram trust-root ROOT_CAUSE_REVIEW

## Decision

Stop the synthetic patch loop. N309 and N311–N315 produced six `HOLD_GATE_FAIL` results with the same shared blocker: a single-process Candidate can choose, embed, or receive the authority, observation, time, and persistence roots used to validate itself.

R2 requires ROOT_CAUSE_REVIEW after two similar internal failures. Another protocol patch is therefore rejected until one actual Mother acknowledges a bounded trial.

## Root cause

- The task anchor did not freeze a concrete threat model, authority owner, restart model, or receiver.
- In-process fixtures can test deterministic logic but cannot prove organizational independence, durable persistence, trusted time, key custody, availability, revocation, or non-equivocation.
- No live receiver-specific Task Anchor or Delivery Receipt exists.
- The N315 in-code pin is a valid test fixture and an invalid production trust claim.

## Fresh evidence

The exact N315 branch probe was rerun after this dispatch and matched its committed receipt byte-for-byte. N316 then ran a machine gate over the N309–N315 ledger:

- another synthetic patch → `REJECT_REPEATED_PATCH_LOOP`;
- no receiver ACK → `HOLD_RECEIVER_ACK_MISSING`;
- acknowledged but incomplete live trial → `HOLD_SINGLE_MOTHER_TRIAL_INCOMPLETE`;
- complete trial contract → `SINGLE_MOTHER_TRIAL_CONTRACT_COMPLETE_NOT_ADOPTION`.

Probe SHA-256: `384b7f9ea5d8ce611e37bd51d20a4537488a6a52c3fc2758a601b94e6f67f307`.
Receipt SHA-256: `cbd8a8da1b0849044506b6927e752cd9275b004cde5085596f4666f8cd03be2d`.

## Next allowed step

One actual Mother trial with an exact Task Anchor, receiver ACK/receipt, verifier route outside Producer control, durable checkpoint route, restart replay rejection, and fresh-current acceptance on the exact commit.

## Boundary

Current state is `BLOCKED_VALID`. No main, R2, production Mother, adapter registry, public service, or visual artifact changed. Browser evidence is not applicable. Completion of the trial contract authorizes only the trial; it is not adoption or user acceptance.
