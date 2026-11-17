# KAOPU Learning Flywheel N310 — Exclusion Policy Revision Migration

## One bounded question

How can an adapter exclusion-policy upgrade avoid silent permission inheritance without forcing unrelated anchors to migrate?

## Real failure and current baseline

N309 proved a real bypass in N308: an observed undeclared input could be moved into an unhashed exclusion set after the run. N309 correctly hashes preauthorized exclusion rules and returns `HOLD_UNAUTHORIZED_EXCLUSION`, but leaves policy migration unresolved.

This record refines N309. It does not create a duplicate regression and does not clear N309's `HOLD_GATE_FAIL`.

## Teacher audition

Teacher: Open Policy Agent policy bundles, scoped roots, activation status, and decision-log revision binding.

What it knows beyond the current KAOPU Candidate:

- a policy bundle has an explicit revision and owned roots;
- delta updates cannot change roots;
- a new bundle activates only after validation/verification succeeds;
- activation failure keeps the previous active revision;
- each decision log records the exact bundle revision used.

Teacher state: `TEACHER_CANDIDATE / AUDITION`. OPA is an Apache-2.0, actively maintained, public implementation with bundle schemas, activation tests, signed-bundle fixtures, decision-log tests, and recent releases. KAOPU does not adopt OPA or Rego; it transfers only the revision/scope/activation method.

## Minimal replay

Two anchors were used:

- `garment/front-shell-v7`, whose known inputs intersect the Weather exclusion rule and the observed runtime material override;
- `terrain/tile-42`, whose known inputs do not intersect the Garment exclusion policy.

Results:

1. Same-scope v2 with an exact Garment replay activated; Terrain required no replay and remained bound to its original revision.
2. Adding `runtime/material-override` to roots while claiming `PATCH` returned `HOLD_POLICY_SCOPE_CHANGE_REQUIRES_SNAPSHOT`.
3. A scope-changing snapshot without replay returned `HOLD_POLICY_MIGRATION_UNREPLAYED`.
4. A failed replay returned `HOLD_POLICY_ACTIVATION_FAILED` and retained `garment-exclusions/v1` as the last successful revision.

## Candidate contract

- Every anchor decision binds exact `policyRevision + policyDigest`.
- Existing receipts are never reinterpreted under the latest adapter policy.
- PATCH cannot widen or shrink policy roots.
- Scope change requires a new immutable snapshot policy, explicit authorization, affected-anchor replay, and independent activation receipt.
- Only anchors whose recorded inputs intersect changed rules need replay. Unrelated anchors remain pinned to their original immutable policy revision.
- Activation failure retains the prior revision and reports HOLD; it is not a successful fallback.

## Boundaries

- Impact selection depends on complete recorded inputs; hidden dependencies remain an N308/N309 risk.
- Revision binding does not prove semantic correctness or user authorization.
- Historical policy bundles must remain retrievable for legacy anchors.
- A same-root text change can alter meaning and still requires intersecting-anchor replay.
- No production adapter, registry, Mother, R2 rule, or public service changes before a single-Mother trial.

## Truth status

Learning branch: `GATE-RUN`.

Routing: pending targeted `POSTED` to #91. `ACKNOWLEDGED=false`, `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. KPI values remain `UNKNOWN`.
