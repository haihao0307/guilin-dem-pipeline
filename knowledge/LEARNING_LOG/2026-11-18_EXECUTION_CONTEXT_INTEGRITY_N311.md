# N311 — Execution-context integrity regression

## One bounded question

Can an anchor remain verified when a declared execution-context constraint changes outside the dependency-closure digest?

## Fresh baseline

- `main@ad7b81175df8bc9c54cf40effe1029f86696ba76`
- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- no-creative-substitute gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- no-stale-delivery gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest production/coordination feedback read through N310; #63 remains unchanged since 2026-09-30.
- applicable regressions reread: `MOTHER-NO-METHOD-INVENTION-001`, `MOTHER-NO-THINKING-STALL-R3-001`, `TERRAIN-NO-STALE-DELIVERY-001`, `BIRD-NO-SIMPLIFIED-SUBSTITUTE-001`, `FISH-NO-WEIRD-SUBSTITUTE-001`, N308, N309, and N310.

## Real failure

N308's Candidate JSON lists `environmentConstraints` as a required field and its Bazel teacher evidence explicitly says command identity contains environment and platform semantics. But N308's executable `makeAnchor()` hashes only the component, declared inputs, and adapter. N309 fixes exclusion-policy hashing but repeats the same omission.

The fresh counterexample changed only the Chromium launch arguments by removing `--use-angle=swiftshader`. The vulnerable baseline and changed-context closure roots were both:

`sha256:80c5fa5723cdde675d965e3d3ecff402133c531edcb188d8ff5f16b7dc178f22`

The vulnerable verifier returned `DEPENDENCY_CLOSURE_VERIFIED`.

This is a transfer-to-gate failure: the external principle was already known, but it stayed in prose instead of entering executable identity and comparison logic.

## Minimal correction

Add a versioned, bounded execution-context profile. The profile selects identity-bearing paths and observation-only paths. Bind the profile digest plus resolved identity values into the closure. Fail closed when required values are missing or changed.

Do not hash the whole host. The affected Mother and coordinator must justify the profile; Producer cannot self-approve context relevance or completeness.

## Replay result

- changed profile-selected browser launch arguments → `HOLD_EXECUTION_CONTEXT_CHANGED`
- changed observation-only run ID and timestamp → `DEPENDENCY_CLOSURE_VERIFIED`
- missing required timezone → `HOLD_EXECUTION_CONTEXT_INCOMPLETE`

The corrected context roots differed:

- baseline: `sha256:a80cf9acbbf069565ea8dde22e56e5361ff83c8886384ccdc7d697b563a0ad44`
- changed: `sha256:47c8d8ec529db76b62fb947613b1393a2ed17a3ac8cb88072ecd2e6a5f119f19`

## Teacher decision

`NO_NOVELTY` for Bazel Remote Execution API in this round. N308 had already captured the relevant command environment/platform principle. N311 contributes a new local counterexample and executable correction, not new external teacher knowledge.

## Boundaries

- Network responses stay declared dependencies.
- Secret values never enter receipts; use only approved descriptors or digests.
- Physical-device and user acceptance remain separate evidence layers.
- This does not prove visual, physical, scientific, adoption, or user-acceptance status.
- No production Mother, main, R2 OS, adapter registry, or public KaoPuGram service changes.

Learning branch status: `HOLD_GATE_FAIL`, Candidate regression `CANDIDATE_INACTIVE`, `GATE-RUN=true`.

Routing: targeted `POSTED=true` to #91 as comment `6964373040`; `ACKNOWLEDGED=false`, production `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. KPI values remain `UNKNOWN`.
