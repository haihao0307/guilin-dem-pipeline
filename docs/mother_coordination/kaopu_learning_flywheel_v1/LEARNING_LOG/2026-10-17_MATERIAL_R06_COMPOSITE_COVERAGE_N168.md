# N168 — Material R06 composite coverage closure

## One bounded question

Can green run 15 claim broad R06 browser coverage when it executed only a mobile viewport check and names prior runs without binding each coverage claim to an exact evidence atom?

## Real production evidence

- Run 14 (38988373429) tested head 27a7a0731ccbb1598e612be2fdede106ea0232b8 and failed in phase “concrete mobile”.
- Its failure artifact (12083987790, digest sha256:68c32211e7fe68db794602df07b30496a99552cf36ba9a6aad4abb253b643a93) retains three concrete screenshots plus a receipt containing baselineImmutable=true and candidateResponse=true.
- Run 15 (38988902424) tested head 5543f756ca3af1428323696324303fa70b8de850, succeeded, and produced artifact 12083639031 with digest sha256:b9e2526f8bcb889d377023ca6b8a8d1a17c215a129c6e9231b5e5c04cdf76f33.
- Run 15's machine checks contain only one mobile-family record: 390 px viewport, no horizontal overflow, empty runtime error array.
- Its static coverage array nevertheless lists medium/close/side screenshots, baseline pixel invariance, wear/wet response, diagnostic channels, orbit/reset, idle stop and 390 px layout.
- The receipt names priorFullRun=38987502021 and priorConcreteRun=38988373429, but records neither artifact digest, evidence path/digest, claim-to-atom mapping nor partial-step result.
- The road-material.mjs blob changed from 856750e7... in prior full run 13 to 1307b78c... in run 14; run 15 retains 1307b78c.... Therefore run 13 is stale for the corrected road material, while run 14 has potentially reusable partial evidence but is not bound into run 15's receipt.

Run 14: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38988373429  
Run 15: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38988902424

## External method and novelty

GitHub's official workflow-jobs API exposes per-step conclusions, and its artifact API exposes artifact digest plus workflow run and head_sha. These fields make exact evidence binding possible, but GitHub does not infer KAOPU semantic coverage from a custom receipt.

- https://docs.github.com/en/rest/actions/workflow-jobs
- https://docs.github.com/en/rest/actions/artifacts

Teacher decision: NO_NOVELTY. The needed rule already exists in R2 and CI-GREEN-SKIPPED-CLAIM-001: a green job and a named prior run cannot promote a claim without a claim manifest, exact subject and evidence atoms. This round contributes a new real counterexample, not a new teacher or regression.

## Falsifiable replay

Hypothesis: a bare prior run ID cannot close current receipt coverage; exact composite evidence can close it only when every named claim maps to an atom bound to the tested subject, run, artifact digest and evidence path/digest.

Replay result: 5/5 expected classifications matched:

1. run 15 as written -> HOLD_DECLARED_COVERAGE_UNBOUND;
2. exact prior run ID without bindings -> HOLD_PRIOR_EVIDENCE_BINDING_INCOMPLETE;
3. fully bound but stale subject -> HOLD_PRIOR_EVIDENCE_SUBJECT_MISMATCH;
4. fully bound exact composite -> COMPOSITE_COVERAGE_VERIFIED;
5. all claims executed in current run -> CURRENT_RUN_COVERAGE_VERIFIED.

## Current Best View

MOBILE_CHECK_VERIFIED__HOLD_DECLARED_COVERAGE_UNBOUND

The mobile no-overflow fact is retained. The broader static coverage list is not accepted as current-run execution. Run 14's partial concrete facts are not erased, but they require explicit composite closure before promotion.

## Candidate delta, not adoption

Extend existing CI-GREEN-SKIPPED-CLAIM-001; do not create another case. A single-Mother Candidate receipt would require, per inherited claim:

- claim identifier and exact predicate;
- source run/head and tested subject digest;
- artifact ID/digest;
- evidence file path/digest or step conclusion;
- whether the source run was partial/failed and which later failure is excluded;
- current subject equivalence proof;
- final composite state and excluded claims.

No production workflow, Material file, main, R2 or global gate was modified.

## Routing and lifecycle

- Material Mother / Coordinator: POSTED to issue #91 as comment 6229189211: https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6229189211
- No real reply was present when this receipt was recorded; ACKNOWLEDGED remains false.
- Existing regression status remains Candidate/inactive.
- ACKNOWLEDGED / IMPLEMENTED / TARGET-GATE-RUN / ADOPTED / USER-ACCEPTED: false.
- Metrics without reliable measurement remain UNKNOWN.

## N170 follow-up — PR #303 positive control

PR #303 supplied the missing positive control for the N168 hypothesis. Its successful run 39023934981 did not relabel failed origin run 39020723675 as successful. Instead it:

- pinned source commit `544ec81bcef6185a553df138585c7059e832a122`, origin artifact 12096734029 and SHA-256 `0c693546...`, origin QA path and SHA-256 `7a416bda...`, plus module/build/preview signatures;
- retained nine named passed core tests as claim atoms, while explicitly excluding the old performance result, the incomplete cleanup and origin public/share claims;
- rebuilt the same source, reran synchronized performance and bounded cleanup, then verified exact public HTTPS bytes and desktop/mobile viewport interaction;
- preserved `physicalPhone=false`, `visualAcceptance=false`, `userVisualAccepted=false` and `productionReady=false`.

Independent GitHub blob cross-check also found `LipSurface.js` blob `c9bcaf85...` and `build.cjs` blob `581a210d...` unchanged between the source commit, verification commit and final PR head. The generated preview is bound by SHA-256 rather than inferred from the branch head.

Classification: `COMPOSITE_COVERAGE_VERIFIED_SCOPED`. A failed run does not poison every completed atom; reuse is legal only when the failure is downstream/non-dominating for the retained atom, exact subject and evidence bytes are bound, invalid claims are excluded, and all missing atoms are rerun fresh.

This is a real affected-Mother `IMPLEMENTED + workflow GATE-RUN` observation for the candidate semantics, but not proof that Material or Coordinator acknowledged N168. The existing regression remains Candidate/inactive because no independent verifier receipt, adoption decision or user acceptance exists.

N170 routing receipt: POSTED to issue #91 as comment 6233503954: https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6233503954. No reply was present when recorded; ACKNOWLEDGED remains false.
