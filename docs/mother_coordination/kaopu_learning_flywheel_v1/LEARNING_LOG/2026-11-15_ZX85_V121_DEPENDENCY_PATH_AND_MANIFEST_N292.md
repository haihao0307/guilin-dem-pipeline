# N292 — ZX85 v121 dependency path and manifest integrity

- Observed: 2026-11-15T11:46:54+08:00
- Baseline: R2 OS + reference-replication gate + freshness gate
- Scope: learning branch only; no production Mother, main, Site, asset, or global gate changed
- Refines: `PHYSICAL-SYMMETRY-REUSE-001-N290-DEPENDENCY-CLOSURE`
- State at authoring: `IMPLEMENTED_CANDIDATE / GATE-RUN`; routing pending; `ACKNOWLEDGED=false / ADOPTED=false / USER-ACCEPTED=false`

## One bounded question

Does v121's newly vendored, licensed Three.js copy close the N290 clean-extraction mirror replay; if not, is the hidden development-path import the sole replay blocker, and can that copy count as package closure while `CHECKSUMS.json` omits it?

## Current evidence

The exact Library subject was version 121, modified 2026-11-15T11:24:59+08:00, 76,140,687 bytes, SHA-256 `39600bdd2b44940b34ec77affb701312c4d44fbf7660818e34bff02e695893b4`, with 3,036 ZIP entries.

The mirror method, mirror check and stored receipt are byte-identical to v81. Fresh clean extraction still exits 1 with `ERR_MODULE_NOT_FOUND` because the check imports `../../front-r04-release/.sites-checkout/dist/boom-functional-r05/vendor/three.module.js`, a development path absent from the checkpoint.

Unlike v81, v121 does contain `door-pull-r45-package/vendor/three.module.js`, `three.core.js`, and `THREE-LICENSE.txt`. A temporary-copy counterfactual changed only that import to the packaged copy. It exited 0 and reproduced the stored generic claims: three axes, exact roundtrip, oriented volume preserved, maximum kinematic error `1.7763568394002505e-15`, evidence required, and zero real parts mirrored. No production file was patched.

This supports only the narrow inference that the hidden import path is the sole blocker for the generic mirror-math replay.

## New failure mechanism

The working counterfactual dependency is not covered by `CHECKSUMS.json`. The extracted checkpoint has 3,035 files excluding the manifest, but the manifest has only 2,598 entries: 437 archive files are unmanifested. Eleven listed cabin files also have digest mismatches. Therefore presence in the ZIP is not dependency closure; the runtime is a dependency island whose identity, owning package and exact digest are not bound to the gate receipt.

The checkpoint still has no concrete user-named rear-view mirror pair, no `symmetryPairId`, no whole-cabin binding for that pair, and the generic receipt still reports `realPartsMirrored=0`. README also still labels v96 as latest while the Library subject is v121.

## Falsifiable trial and boundary

Hypothesis: if only the hidden development path blocks the generic test, pointing an otherwise unchanged temporary runner at the existing packaged Three.js copy will pass.

Result: supported in the temporary counterfactual only.

Boundary: do not promote until one canonical package-relative dependency locator is declared with digest, license/provenance and owner; every executable dependency is manifest-covered; the manifest has zero omissions and zero digest mismatches; and one physically eligible concrete mirror pair is consumed by the current whole.

## Decision

`PROBATION_COUNTERFACTUAL_PATH_FIX_PASS_HOLD_EXACT_PACKAGE_MANIFEST_AND_CONCRETE_MIRROR_INTEGRATION`

This is a refinement of the existing Candidate, not a new regression case. KPI effects remain `unknown`; no production adoption or user acceptance is claimed.
