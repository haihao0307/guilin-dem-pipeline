# KAOPU Learning Flywheel N175 — Tailor garment re-entry atomicity

## Bounded question

When an outer garment is unloaded and later re-added after retained garments have advanced, which state must remain live or be staged so the new member cannot corrupt the last accepted active world?

## Exact subject and real failure

Current `main` is `5543f756ca3af1428323696324303fa70b8de850`. R2, the replication gate, freshness gate, root `AGENTS.md`, #91/#63 and applicable regression cases were read before selecting this question.

The exact production subject is draft PR #315 at `93021f352c0fedc53709edd46c30a91235190fee`, workflow run `39386779708`, re-entry artifact `12248830128` with digest `sha256:19753026ae4153ba1ead664b9828f9c82e3ce6c2a05222feb213283cffe3769a`.

After `outer` is removed, `pants` and `inner` complete 28 steps / 0.233333 seconds. Re-adding `outer` produces a step-0 world with zero reported discrete middle-surface crossings. Three steps are accepted; step 4 then fails with 1.044 mm cloth-contact residual against the unchanged 0.5 mm limit, maximum edge stretch 1.442 against 1.45, and zero body-envelope gap. The failed step is correctly rolled back; R02 remains unpublished.

## Finding

`GLOBAL_REINITIALIZATION_NOT_RESUME__HOLD_REENTRY_NOT_ATOMIC`

This failure is not caused by render-demand deferral. The display/demand path says the solver remains unchanged, and its jobs pass. The membership path is different:

1. `add(outer)` enters `world.add()` and calls the all-garment `initialize()` path.
2. That path redresses every current garment, copies current positions into `saved`, `initial` and `old`, zeros velocities, resets garment/world time and steps, and clears contact caches/history.
3. The re-entry test explicitly expects `completedSteps=0` and `simulationSeconds=0`, so the present contract is a global reset, not retained-state resume.
4. The initial independent geometry audit explicitly does not check thickness clearance or continuous time. Zero triangle crossings at step 0 therefore cannot authorize continued dynamics.
5. Step rollback protects the start of the failed fourth step. It does not prove that the pre-reentry two-garment active world remains available unchanged if the entire insertion attempt is rejected.

## Follow-up positive control at current PR head

PR #315 advanced to `5186f8a5d71a5e75059539f83a31b2ba1e53042b`. Workflow `39391889463` and re-entry artifact `12251619456` (`sha256:69fb34accaa6b561f7fdf1667df922754fe7d4aaa7f5235f6d74fc94f7ef0297`) pass the required six-job matrix. The re-entry member completes three remove/restart cycles with 34, 31 and 32 accepted restored steps and 48 selected full geometry checks.

The source and test contract remain explicit: `world.add()` calls the all-garment `initialize()` path, and the test expects garment/world clocks to return to zero. The corrective change scopes dynamic strain repair to garments whose edges violate the hard limit; it does not introduce a staging world, preserve the accepted two-garment state, or resume its clock.

Updated finding: `GLOBAL_REDRESS_RESTART_VERIFIED_SCOPED__RESUME_STILL_HOLD`.

This is a genuine positive control and narrows N175: a product may intentionally implement `GLOBAL_REDRESS_RESTART`, reset every garment and clock, and pass a restart gate. It may not call that operation retained-state resume. Atomic staging remains necessary only if the intended semantic is `REMOVED_AND_REINSERTED` with continuity of the accepted inner world.

## State contract candidate

| Operation | State obligation | Decision |
| --- | --- | --- |
| `HIDDEN_RENDER_ONLY` | Keep `p/v/old`, constraints, contact participation, clock and member set live; defer only beauty upload/atlas work where shadow demand allows. | Existing direction is valid. |
| `PHYSICS_DORMANT` | Preserve exact state and declare contact-history invalidation/rebuild; require scoped clearance proof before resume. | Candidate only; no such proof observed. |
| `REMOVED_AND_REINSERTED` | Stage the new member against a frozen snapshot outside the active world; run intersection plus thickness gates and a delayed-failure window; atomically commit or leave the old world unchanged. | Required for PR #315's semantics; not implemented. |
| `GLOBAL_REDRESS_RESTART` | Declare that all garments and clocks restart; build a new lineage; run the full restart and geometry gate; make no retained-state continuity claim. | Implemented and gate-run at current PR head, scoped to the published re-entry scenario. |

State custody for retained garments includes at least position, velocity, previous position, rest/constraint identity, material/thickness parameters, contact-history policy, clock/substep, member-set digest and exact body pose. A topology/member-set change is not an uninterrupted continuation merely because the visible garment IDs match again.

## Minimal falsifiable single-Mother trial

From one frozen two-garment accepted snapshot, compare current global reinitialization with a staged re-entry candidate:

1. Hash the active member set and all retained state before staging.
2. Build and settle `outer` in an isolated staging world referencing the frozen retained/body snapshot.
3. Require independent surface-intersection and thickness-clearance checks, then at least 24 accepted steps (longer than the observed three-step false window) across three remove/reinsert cycles, without relaxing 0.5 mm contact or 1.45 stretch.
4. Before commit, prove the active-world hash is unchanged. On any staging failure, discard staging and prove the same again.
5. Commit the complete new member set once, with a new lineage/state digest. Only post-commit time may advance as the new world.

The isolated historical classifier reproduces the original hold, three earlier controls, the current restart positive control, and a false resume claim: 6/6. It keeps `TAILOR-REENTRY-ATOMICITY-001` inactive because the product semantic choice has not been acknowledged by the Tailor Mother.

## Boundaries and lifecycle

This does not implement a solver, relax thresholds, prove arbitrary motion, certify continuous collision, modify PR #315, or authorize R02 publication. It is local to Tailor garment re-entry until the Mother trial passes.

- Production failure: `OBSERVED`.
- Candidate regression historical replay: `GATE-RUN=true` only for the classifier, not the production gate.
- Mother route: `POSTED=true`; directed receipt: <https://github.com/haihao0307/guilin-dem-pipeline/pull/315#issuecomment-6286171974>.
- Positive-control follow-up: `POSTED=true`; directed receipt: <https://github.com/haihao0307/guilin-dem-pipeline/pull/315#issuecomment-6290174634>.
- For `GLOBAL_REDRESS_RESTART` only: `IMPLEMENTED=true`, `GATE-RUN=true` at workflow `39391889463`.
- For atomic retained-state reinsertion: `IMPLEMENTED / GATE-RUN=false`.
- `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false` for the N175 contract; the Mother has not answered the semantic choice.
