# N73 — Material R15: workflow definition is not GATE-RUN

Status: evidence update and second-Mother replay of existing Candidate `CI-GREEN-SKIPPED-CLAIM-001`. No production Mother branch, `main`, `gh-pages`, R2 baseline, schedule, Canonical Truth or user-frozen asset is changed.

## Bounded question

Do the three Material R15 commits named `test(...)` prove that the public same-SDF verifier actually ran, or do they only define and edit a workflow that has no run receipt?

## Existing real failure

Material production commit `d6cecae2527a259082b5a5b97d74d4223e4d10f9` introduced R15 and removed the earlier substitute mesh path. `main` then received:

- `2f4639c9d73ff58303072697f5c10e541e0703fa` — adds `.github/workflows/material-r15-same-stone.yml`;
- `c3f0ecb7eed797000c4131d82f3f8c644be73ef0` — comment-only "rerun" edit;
- `4fdc1213914a668e6d63017081c128c7ef3edc4b` — removes a screenshot step to avoid a stall.

Fresh GitHub Actions queries for each exact commit returned `workflow_runs=[]`; combined commit status queries returned `statuses=[]`. Therefore none of the three commits is a `GATE-RUN` receipt. The source inspection does support a narrower observation: R15's draw path uses `iq-merged.frag` before and during interaction, while interaction changes uniforms/resolution. This audit does not reject the source delta; it rejects only any claim that the workflow ran or passed.

## External method / evidence

- GitHub defines a workflow as a configurable process described by YAML and says `on` declares events that can cause it to run; a matching `push` branch/path filter determines execution eligibility: <https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax>.
- GitHub's workflow history documentation says each run has logs containing job and step status and exposes the run through the Actions history / `gh run list`: <https://docs.github.com/en/actions/how-tos/monitor-workflows/view-workflow-run-history>.

Transferred mechanism: `WORKFLOW_DEFINED` and `GATE-RUN` are different states. Promotion requires an exact `runId + headSha + job/step conclusions + proof artifact`; a YAML file, test-like commit subject, or rerun comment cannot synthesize those fields.

## Comparison with current KAOPU rules

R2 already says workflow creation without a run is packaging, not production progress. Existing Candidate `CI-GREEN-SKIPPED-CLAIM-001` already fails closed when claim-critical evidence is missing. Therefore the policy itself is `no-novelty`; creating another regression case would duplicate the same failure class.

The real increment is new Material evidence plus an explicit zero-run precondition replay added to that existing case.

## Falsifiable hypothesis

If the existing claim gate requires an exact run before inspecting job/step results, the current R15 fixture with zero runs will return `HOLD_CLAIM_NO_WORKFLOW_RUN`; a run bound to another head will also hold; an exact successful run missing the required step will return `HOLD_CLAIM_INCOMPLETE`; and a complete exact-run control will return `CLAIM_VERIFIED`.

The hypothesis is falsified if any of those four decisions differs.

## Minimal replay

Executable objects:

- `REGRESSION_CASES/CANDIDATE_CI_GREEN_SKIPPED_CLAIM_001.json` (updated evidence, not duplicated);
- `PROBES/ci_claim_run_precondition_gate_n73.mjs`;
- `PROBES/ci_claim_run_precondition_gate_result_n73.json`.

Result: `4/4 passed`.

## Applicability boundary

Apply only to claims that a GitHub Actions verifier ran or passed. Do not infer that a source implementation is wrong merely because CI did not run. Static inspection may support a source-level observation, but it cannot promote runtime, public-browser, device, performance or user-acceptance claims.

## Decision and routing

`NO_NOVELTY_POLICY / UPDATE_EXISTING_REGRESSION_EVIDENCE`. Keep the regression Candidate inactive and route one bounded Material action through #91: obtain one exact workflow run bound to the current intended subject, then record the run/job/step/artifact receipt. Until that exists, state is `HOLD_CLAIM_NO_WORKFLOW_RUN`; do not rerun unrelated Material work and do not change R15 source merely to manufacture a green status.

Routing lifecycle before receipt: `POSTED=false`, `GATE-RUN=true` for this N73 replay only; downstream `ACKNOWLEDGED`, `IMPLEMENTED`, `ADOPTED`, and `USER-ACCEPTED` remain false. KPI deltas remain `unknown`.

No external AI was claimed or invoked as a participant.
