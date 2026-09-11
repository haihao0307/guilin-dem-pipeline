# KAOPU Xiaoma Coordinator — R32 handoff

Date: 2026-09-11  
Repository: `haihao0307/guilin-dem-pipeline`  
Authoritative learning branch: `coordination/kaopu-learning-flywheel-r1-20260909`  
Verified state base commit at handoff start: `1a8773bb3d4dc7892eb26a995f278e1aacafec13`  
Handoff-only branch: `coordination/kaopu-xiaoma-handoff-r32-20260911`

## Purpose

This package transfers the KAOPU coordinator/Xiaoma learning state to one new window without starting a second concurrent learning worker.

## Single-owner rule

- The old window stops KAOPU learning work after producing this handoff.
- The new window is the only window authorized by this handoff to continue the coordinator learning cycle.
- Before doing any new research or write, the new window MUST re-read the current remote head of `coordination/kaopu-learning-flywheel-r1-20260909`.
- If the head is newer than `1a8773bb3d4dc7892eb26a995f278e1aacafec13`, read and inherit the newer work instead of replaying R32 or starting a duplicate cycle.
- Do not create a duplicate recurring task or another parallel coordinator loop.
- Do not modify production Mother branches from coordinator learning work.

## Required first reads

1. `docs/mother_coordination/kaopu_learning_flywheel_v1/00_START_HERE.md`
2. `docs/mother_coordination/kaopu_learning_flywheel_v1/KAOPU_FOUNDATIONAL_STATEMENT_R1_20260909.md`
3. `docs/mother_coordination/kaopu_learning_flywheel_v1/CURRENT_BEST_VIEW.md`
4. `docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_QUEUE.json`
5. `docs/mother_coordination/kaopu_learning_flywheel_v1/MOTHER_ROUTING.json`
6. `docs/mother_coordination/kaopu_learning_flywheel_v1/TOOL_ROUTING.json`
7. `docs/mother_coordination/kaopu_learning_flywheel_v1/UNKNOWN_AND_CONFLICTS.json`
8. R30 Tellux files, R31 Tiles filter-response files, and R32 Substance graph-replay files listed in `02_SOURCE_AND_STATE_LOCKS.json`.
9. The additive source-audit checkpoint listed in `02_SOURCE_AND_STATE_LOCKS.json`.

## Status discipline

Preserve the distinct statuses `Observation`, `Candidate`, `Current Best View`, `Frozen`, `Rejected`, and `Unknown`.
Keep independent Observation Roots distinct.
Prepared routing is not acknowledged adoption.
Schema checks, raw-data replay, evidence independence, runtime evidence, and human acceptance are separate gates.
Frozen R1 remains frozen unless the user explicitly authorizes a formal versioned change.

## Governance

External systems and user-supplied links are references, not mandatory integrations.
KAOPU remains the authoritative semantic/architectural baseline, while contradictory empirical evidence must still be investigated.
Adopt only demonstrated improvements through bounded, reversible verification.
