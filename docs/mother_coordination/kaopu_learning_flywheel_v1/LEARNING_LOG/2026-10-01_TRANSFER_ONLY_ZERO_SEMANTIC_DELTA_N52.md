# N52 — Transfer-only means zero unauthorized semantic delta

Status: `Candidate`; one bounded Coral migration question. No production branch, `main`, `gh-pages`, R2 baseline, existing gate, schedule or other Mother was changed.

## Bounded question

When the user asks to move an existing workbench unchanged before doing anything else, is an exact preserved source snapshot sufficient if the same commit also creates a domain-adapted entrypoint, functions, scores, QA and workflow?

## Existing real failure

The frozen Tree source is [`967f975e2f10e5895b4c8a09005a2d8d6e313dc1`](https://github.com/haihao0307/guilin-dem-pipeline/commit/967f975e2f10e5895b4c8a09005a2d8d6e313dc1). The first Coral commit, [`140866769794646fcebd25de3fa30aded1c2ab01`](https://github.com/haihao0307/guilin-dem-pipeline/commit/140866769794646fcebd25de3fa30aded1c2ab01), did preserve the complete Tree workbench under `source-tree/` with declared Git tree `2086790b58585d483fbdd087e57aceaa28fa7cd7`. It also added a Coral master, `app.js`, `coral-functions.js`, `scores.json`, `qa.py`, a workflow and a Coral wrapper as the active entrypoint.

Five minutes later, [`01ede951e61a83567ba530570936cdd91dfdcfed`](https://github.com/haihao0307/guilin-dem-pipeline/commit/01ede951e61a83567ba530570936cdd91dfdcfed) records the user's renewed instruction: first copy the Tree workbench directly and unchanged; do not add Coral logic yet. It replaces the active entrypoint with the exact Tree R06 blob `e21e138dd313084b13164ef79e392f2936fa3794` and says the earlier Coral drafts remain present but are not loaded.

This establishes a real correction without inventing a visual verdict: source preservation succeeded, but it did not prove the narrower transfer-only contract. The current active entrypoint correction is valid evidence; full transfer-only closure remains unverified because the semantic residue is still present and no independent transfer receipt exists.

## External method and evidence

- NASA SWE-194 requires verification before delivery that delivery requirements are met and approved changes are implemented, and calls for configuration records, traceability and independent review: <https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695529/SWE-194%2B-%2BDelivery%2BRequirements%2BVerification>.
- NASA Requirements Management says proposed requirement changes need impact assessment before approval and implementation: <https://www.nasa.gov/reference/6-2-requirements-management/>.
- NASA's verification-matrix guidance requires each requirement to have a unique identifier and definitive source: <https://www.nasa.gov/reference/system-engineering-handbook-appendix/>.

Transferred method: an exact source snapshot and an authorized delivery configuration are different claims. A `TRANSFER_ONLY` anchor must identify the immutable source configuration and explicitly enumerate allowed deltas; adaptation belongs to a later, separately authorized phase.

## Comparison with current KAOPU rules

R2, the reference-replication gate, N44 disclosed-inference gate and no-method-invention rules already forbid creative substitution and unauthorized inference. Cross-object identity and freshness gates also protect exact subjects and stale delivery. This cycle does not duplicate or weaken them.

The executable gap is narrower: none of those cases makes `source snapshot preserved` insufficient for a `TRANSFER_ONLY` claim when unauthorized semantic siblings and a new active entrypoint are created simultaneously. N52 adds phase-bound configuration accounting, not a new global creative rule.

## Falsifiable hypothesis

If a transfer Task Anchor freezes `taskMode=TRANSFER_ONLY`, source commit/path/tree, source entrypoint blob and an exact `authorizedDeltaPaths` allowlist, then an independent verifier comparing destination tree, active entrypoint and semantic deltas will:

1. hold the premature Coral R01 commit while preserving its valid source-snapshot fact;
2. preserve the latest exact-entrypoint correction without falsely declaring the whole transfer clean;
3. pass an exact-copy control and an allowlisted receipt-only control;
4. treat explicitly authorized adaptation as a different phase, not a transfer-only pass.

The hypothesis is falsified if the gate allows an unlisted semantic delta, erases valid copy evidence, accepts self-verification, or classifies authorized adaptation as unchanged transfer.

## Minimal replay

`PROBES/transfer_only_gate_n52.mjs` executed ten fixtures. Result: `10/10 passed`.

- Historical initial Coral commit: `HOLD_TRANSFER_ONLY_CONTRACT` for entrypoint mismatch, unauthorized semantic delta and missing verifier pass; source snapshot evidence preserved.
- Latest correction: exact source tree and active entrypoint evidence preserved; still held for semantic residue and missing verifier pass.
- Exact copy and allowlisted receipt controls: `TRANSFER_ONLY_VERIFIED_NOT_USER_ACCEPTED`.
- Tree mismatch, entrypoint mismatch, incomplete anchor, self-verification and stale receipt controls were each held.
- Authorized adaptation returned `NOT_APPLICABLE_ADAPTATION_PHASE`.

## Applicability boundary

Apply only to an explicitly declared copy/migration phase. Do not use it to forbid later Coral adaptation, require deletion of historical evidence, or judge biological/visual correctness. A later adaptation phase may reuse the copied workbench, but must carry a new authorized Task Anchor and cannot inherit `TRANSFER_ONLY_VERIFIED` as approval of its Coral semantics.

## Decision and routing

Decision: `Candidate`, not adopted. Route only to the Coral fractal growth line for the next transfer-to-adaptation boundary. Suggested Task Anchor fields: `taskMode`, `sourceCommit`, `sourcePath`, `sourceTreeSha`, `sourceEntrypointBlob`, `destinationPath`, `authorizedDeltaPaths`, `adaptationAuthorized`. Suggested receipt fields: exact subject head, destination tree, active entrypoint blob, semantic delta paths, verifier identity, gate decision and user acceptance state.

Rollback point: coordination head `9cc0613b8f950f63b00028a12e0d3224cb8254a1`. Lifecycle before routing: `GATE-RUN=true`; all of `POSTED`, `ACKNOWLEDGED`, `IMPLEMENTED`, `ADOPTED`, `USER-ACCEPTED` are false. Only one real user correction is counted; all other requested KPIs remain `unknown`.

No external AI was claimed or invoked as a participant.
