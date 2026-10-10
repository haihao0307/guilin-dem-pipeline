# N131 — Tailor R04.3.1 selective-promotion replay

- Date: 2026-10-10
- Mother: Tailor
- Pull request: #181
- State: Candidate / `NO_NOVELTY`
- Decision: `R0431_SELECTIVE_PROMOTION_VERIFIED_SCOPED__HOLD_39_STATIC_FAILURES_VISUAL_PHYSICS_PUBLIC_USER_ACCEPTANCE`

## One bounded question

Did R04.3.1 preserve the failed 24-design numerical trial and promote only complete routes with a strict reduction in failure categories, while rejecting regressions, ties and the incomplete result?

## Existing real failure

The numerical seam trial at `ed3a992b76436f6b207f6059dcac696156d3f764` failed before gallery/outfit execution. It produced 24 trial rows, but J05 did not complete. Treating the failed run, all trial outputs, or the next green run as a single accepted parent would repeat the rejected-lineage and self-approval failures already covered by R2.

## External method / primary evidence

- GitHub Actions artifact metadata binds an artifact to a workflow run and exposes the artifact digest and run/head identity: https://docs.github.com/en/rest/actions/artifacts
- GitHub workflow artifacts are run products and can carry repository, commit SHA and triggering-event provenance: https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts
- NASA's systems-engineering guidance describes regression testing as rerunning accepted tests to check that a change has not damaged accepted function/performance, and requires discrepancies/corrective actions to remain recorded: https://www.nasa.gov/wp-content/uploads/2018/09/nasa_systems_engineering_handbook_0.pdf
- NASA SWE-080 requires recorded evaluation results, impact analyses, actions and decisions for changes: https://swehb.nasa.gov/spaces/SWEHBVD/pages/102695459/SWE-080%2B-%2BTrack%2Band%2BEvaluate%2BChanges

## KAOPU comparison

R2 already requires exact tested-subject identity, preserved rejected lineage, Candidate replay, rollback, independent verification and scoped acceptance. The R04.3.1 mechanism is a concrete Tailor implementation and validation of that rule, not a new global rule. Result: `NO_NOVELTY`.

## Falsifiable hypothesis

If selection requires (1) a complete trial and (2) a trial failure-category set that is a strict subset of the baseline set, then:

1. all 16 strictly improved complete routes will be selected;
2. all 8 regressions, ties or incomplete routes will be rejected;
3. the six selected-but-still-failing routes will remain `qualityPassed=false`;
4. static pass will change only from 11 to 21, leaving 39 failures;
5. thresholds, unaffected material routes, physical-fit, dynamic-wear, public and user acceptance will not be promoted.

## Minimal historical replay

### Failed trial retained

- Exact trial source: `ed3a992b76436f6b207f6059dcac696156d3f764`
- Workflow run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38037173868
- Conclusion: failure
- Artifact: `11664835881`
- Digest: `sha256:98861bb2fb1f8910101d783f07a6b96972ce6e8f577ee5ed5eca1b7bcf23fedd`
- 24/24 trial rows retained; J05 is explicitly incomplete rather than promoted.

### Reviewed promotion

- Exact promotion source: `89396dc9bf2a6ffd4c254a653295dfe15a895fec`
- Retained head: `a6fa594bc4c1ccb9470cbf8571a9f5ce10945ce7`
- Workflow run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38038716284
- Conclusion: success
- Artifact: `11665640308`
- Digest: `sha256:340b4ecb9041ac4059ba66e072f7be72b0c508ff9ade26d699ab8a1ac9ac5821`
- Promoted: 16 complete strict improvements.
- Rejected: 8 regressions, ties or incomplete candidates.
- New static passes: D07, J02, P01, P02, P03, P04, S03, S04, S10, S14.
- Selected but still failed: J01, J04, J06, P05, P08, P10. Each remains `qualityPassed=false`; selection records improvement, not acceptance.
- Final static result: 21 pass / 39 fail across 60 solver records.
- Threshold changes: false.
- Rest-material route changes: false.
- Public delivery: false.
- Physical fit accepted: false.
- Dynamic wear certified: false.
- User accepted: false.

Replay: **19/19 checks passed**.

## Applicable boundary

Only the exact Tailor R04.3.1 trial and reviewed-promotion subjects. This does not certify remaining visible seam/fold/on-body defects, joint outfit collision, continuous cloth physics, other characters/devices, public deployment, or user acceptance. It does not modify main, R2, production Mother branches, or any gate threshold.

## Executable object

Updated the existing deduplicated regression case:

`REGRESSION_CASES/CANDIDATE_TAILOR_PRESET_3D_THUMBNAIL_CORRECTION_001.json`

New audit rule: a failed numerical trial may contribute only complete routes whose failure set is a strict subset of the baseline. Regressions, ties and incomplete trials retain the prior parent. Strictly improved routes that still fail remain failed and cannot enter accepted/front-row claims.

## Lifecycle

- POSTED: true — PR #181 comment 6096219011
- ACKNOWLEDGED: true (Tailor implementation already records the correction boundary)
- IMPLEMENTED: true
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

## Metrics

- First-candidate pass rate: unknown
- User correction count: unknown
- Same-class recurrence rate: unknown
- Rejected-lineage inheritance prevented in replay: 8 candidate routes
- Stale-delivery count: 0 observed in this exact replay
- Internal iterations per accepted delta: unknown
- User instruction to legal candidate time: unknown

## Routing receipt

- PR #181 comment: https://github.com/haihao0307/guilin-dem-pipeline/pull/181#issuecomment-6096219011
- Production branch changed by this learning cycle: false
- Global R2/gate changed: false
