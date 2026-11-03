# KAOPU Learning Flywheel N238 — A4 Nose R02 final-state authority

Date: 2026-11-03 (Asia/Shanghai)  
Status: **Candidate validation / exact-subject GATE-RUN / not adopted**

## One bounded question

Does `A4_ORIGINAL_NOSE_R02_INSTALLED_ISSUE.zip` expose exactly one machine-readable authority for whether Nose R02 is installed/run/current, with stale pre-install state explicitly superseded?

No. The archive is commendably honest that the geometry remains `INSPECTION_ISSUE_NOT_ACCEPTED`; this result concerns only delivery-state authority.

## Required alignment

Current `main` was re-read before the probe:

- root `AGENTS.md`: `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference-replication gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`

Latest #91 feedback was N237 comment `6598178220`; no later Mother acknowledgement was present. #63 still had no newer applicable production feedback. Existing flywheel regressions were checked: the observed failure requires neither the atomic-publication TOCTOU of `CANDIDATE_ATOMIC_EVIDENCE_COMMIT_001` nor a missing executable resource of `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`.

## Exact subject

- Library identity: `libfile_b1d8c8ceeb208191ad249306005ae666`
- archive SHA-256: `942df017729b65ffe6e93e9de01aa162540b26d8483ad97ae8b37361daa0307e`
- declared title: `A4_ORIGINAL_NOSE_R02_INSTALLED_ISSUE.zip`
- parent archive: `A4_ORIGINAL_DRIVING_MIDDLE_INSTALLED_R01.zip`, Library `libfile_28b6de0680f88191a8151bb830333810`

## Preserved valid evidence

- `ORIGINAL_REBUILD_CURRENT.json` records `large-nose-r02` as `installed inspection ISSUE`.
- Current assembly: 147 programs / 1320 fullscreen analytic draws / 0 native scene triangles.
- `NOSE_R02_INSPECTION_GLES_QA.json`: `ACTUAL_GLES3_LOCAL_ASSEMBLY`, llvmpipe, source geometry/textures false, rejected baseline false.
- Shape truth remains `INSPECTION_ISSUE_NOT_ACCEPTED`; source residual, interface-normal jump, edge rejection, missing pixels and static-only limits remain explicit.
- `ENTRY_SHA_MANIFEST.json`: 4020/4020 files verify exactly.

These facts are not rejected or promoted beyond their bounded scope.

## Exact contradiction

The same verifying `ENTRY_SHA_MANIFEST.json` classifies all of the following as `current noseR02 ISSUE increment`:

1. `ORIGINAL_REBUILD_CURRENT.json` SHA `8ef4fddf...` — installed inspection ISSUE;
2. `INSTALL_RECEIPT.json` SHA `c4c8b4e9...` — `INSTALLED_NOT_YET_GLES_VERIFIED`;
3. `NOSE_R02_INSPECTION_GLES_QA.json` SHA `3a782dcb...` — actual GLES3 local assembly;
4. `FINAL_STATUS.json` SHA `63de5d60...` — `FROZEN_PREPARED_NOT_INSTALLED`, `installed=NO`, `installer=NOT_EXECUTED`, `actualGPU=NOT_RUN`.

No root field names one authority, states precedence, or links the pre-install receipt with `supersededBy`.

The archive also exposes `FINAL_ENTRY_SHA_MANIFEST.json` at root. It declares 2261 files but fails 130 delivered-byte checks, including an older `ORIGINAL_REBUILD_CURRENT.json` identity (`5818ce04...` expected versus `8ef4fddf...` delivered) and the prior `ENTRY_SHA_MANIFEST.json` identity. It likewise has no machine-readable superseded/non-authoritative marker.

Therefore a root-only consumer can choose the apparently final manifest/status path and conclude “not installed/not run,” or choose current/receipt/GLES paths and conclude “installed.” Both are immutable package bytes; path naming and human inference are the only tie-breakers.

## Decision

`HOLD_A4_NOSE_R02_FINAL_DELIVERY_STATUS_AUTHORITY_CONTRADICTORY`

New deduplicated Candidate: `CANDIDATE_SINGLE_CURRENT_STATE_AUTHORITY_001`.

Candidate gate:

- name exactly one machine-readable `currentStateAuthorityPath` and bind its SHA/schema;
- require every top-level manifest to verify, or explicitly mark it superseded/non-authoritative;
- retain historical receipts only under declared history with `supersededBy`;
- require all non-history receipts for the same revision to agree on installed/run/current semantics;
- preserve `INSPECTION_ISSUE_NOT_ACCEPTED` unchanged.

Minimum falsifiable trial: on one repaired A4 Nose R02 ISSUE delivery copy, a root-only consumer must resolve one current authority and one installed/run/current answer; every top-level manifest must verify or be machine-marked superseded. Any second opposite authoritative answer fails.

## Lifecycle and boundaries

- POSTED: true — #91 comment `6603022494`
- ACKNOWLEDGED: false
- Candidate IMPLEMENTED: true
- production IMPLEMENTED: false
- GATE-RUN: true on the exact Library archive
- ADOPTED: false
- USER-ACCEPTED: false

No main, production Mother branch, private package, canonical truth, R2 OS, global gate, or schedule was changed.
