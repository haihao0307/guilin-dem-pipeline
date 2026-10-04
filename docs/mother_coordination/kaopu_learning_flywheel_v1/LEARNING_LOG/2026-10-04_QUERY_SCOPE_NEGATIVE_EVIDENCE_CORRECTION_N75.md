# N75 — Query-scope mismatch invalidated the N73 zero-run assertion

Status: correction plus Candidate regression. No production Mother branch, `main`, `gh-pages`, R2 baseline, schedule, Canonical Truth or user-frozen asset is changed.

## Existing real failure

N73 used an observation connector documented to return only `pull_request`-triggered workflow runs. Material R15's workflow is triggered by `push`. The empty result was nevertheless promoted to `workflowRunsPerCommit=[0,0,0]` and `HOLD_CLAIM_NO_WORKFLOW_RUN`. Empty combined commit statuses were used as corroboration even though that surface is not an Actions workflow-run query.

The public workflow history falsifies the assertion: runs `37184229167` and `37184666164` failed, while run `37184764939` succeeded at exact head `4fdc1213914a668e6d63017081c128c7ef3edc4b`.

## External method / evidence

GitHub's primary REST documentation states that workflow-run listing can be narrowed by `event` and `head_sha`, returns at most 100 results per page, and requires pagination for larger result sets: <https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28#list-workflow-runs-for-a-repository>. GitHub documents commit statuses and check runs as separate APIs: <https://docs.github.com/en/rest/commits/statuses?apiVersion=2022-11-28> and <https://docs.github.com/en/rest/checks/runs?apiVersion=2022-11-28>.

Transferred mechanism: a negative claim must carry a query-scope receipt. Event coverage, exact workflow/head binding, evidence-surface identity and pagination completeness are preconditions; otherwise the state is a specific `HOLD_*`, not "absent".

## Comparison with current KAOPU rules

R2 requires evidence-bound claims and fail-closed gates, but the N73 failure shows that "exact query coverage" was not executable. `CI-GREEN-SKIPPED-CLAIM-001` gates what an observed run proves; it does not decide whether a filtered empty query may prove that no run exists. This is a distinct, non-duplicate failure mechanism.

## Falsifiable hypothesis

If event/surface/workflow/head/pagination coverage is checked before interpreting an empty result, then:

1. the N73 pull-request-only query for a push workflow returns `HOLD_QUERY_SCOPE_MISMATCH`;
2. empty commit statuses used for an Actions-run claim return `HOLD_EVIDENCE_SURFACE_MISMATCH`;
3. a correct exact query containing run #3 returns `MATCHING_RUN_OBSERVED`;
4. incomplete pagination holds;
5. only a complete empty query returns `NO_MATCHING_RUN_OBSERVED_IN_DECLARED_SCOPE`;
6. a run found without exact head binding holds.

Any different decision falsifies the Candidate.

## Minimal replay

Objects:

- `REGRESSION_CASES/CANDIDATE_QUERY_SCOPE_NEGATIVE_EVIDENCE_001.json`;
- `PROBES/query_scope_negative_evidence_gate_n75.mjs`;
- `PROBES/query_scope_negative_evidence_gate_result_n75.json`.

Result: `6/6 passed`.

The corrected R15 claim also passed the existing claim-specific gate at exact run `37184764939`, job `111384288074`: every recorded step succeeded and artifact `11296088174` reports same-SDF, no substitute canvas, 448 px interaction/static widths and no errors. This promotes only the public HTTPS Chromium 390 px + SwiftShader claim to `CLAIM_VERIFIED_SCOPED`.

## Applicability boundary

Apply to negative conclusions derived from filtered or paginated queries, initially in Coordination and Material workflow audits. It does not turn one workflow run into physical-device, default-GPU, performance, production-wide or user acceptance. It does not require changing Material source or rerunning a passing workflow.

## Decision

`CANDIDATE / HISTORY_REPLAY_PASSED / NOT_ADOPTED`. Explicitly retract N73, preserve its Git history, correct the existing claim evidence, and route only the scoped result to Material via #91. Candidate remains inactive pending one real downstream use and independent verifier receipt. KPIs remain `unknown` except this audit records one corrected false-negative evidence event; no rate is inferred.

Routing receipt: issue #91 comment <https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5979603278>. Lifecycle: `POSTED=true`, Candidate `IMPLEMENTED=true`, Candidate `GATE-RUN=true`; downstream Material `ACKNOWLEDGED`, `ADOPTED` and `USER-ACCEPTED` remain false.

No external AI was claimed or invoked as a participant.
