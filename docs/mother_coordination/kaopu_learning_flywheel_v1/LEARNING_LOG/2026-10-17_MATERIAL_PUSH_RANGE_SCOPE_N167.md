# N167 — Material push-range scope integrity

## One bounded question

Can `git diff --name-only HEAD^ HEAD` safely determine all regressions required by an existing-branch GitHub `push` event?

## Current production observation

- `main` workflow `.github/workflows/material-master-r01-check.yml` computes bounded regression scope with `git diff --name-only HEAD^ HEAD`.
- Main commit `a9d2a45c5ad3b913d64d131332622c2b71daa029` triggered run 10 at `2026-10-16T21:26:47Z`; it completed success at `2026-10-16T21:29:52Z`.
- The run passed R04 ceramic and R03 ceramic-entry checks while R03 atlas, R02 street, and R01 wall steps were skipped. This is evidence of the selector being operational, not evidence that run 10 itself omitted an earlier commit.
- Run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38969423377

## External method / evidence

Official GitHub documentation says existing-branch push path filtering is evaluated with a two-dot comparison between the pushed head and base SHAs. The push webhook payload exposes `before` as the SHA before the push and `after` as the SHA after it.

- Workflow path diff semantics: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#git-diff-comparisons
- Push payload `before` / `after`: https://docs.github.com/en/webhooks/webhook-events-and-payloads#push
- Source/provenance: GitHub official documentation and its public `github/docs` repository.
- Maintenance: the documentation repository has current commits; exact document truth remains pinned to the URLs and retrieval date `2026-10-17`.
- Reproducibility: the claim is independently testable with local Git; no model, training data, paid API, GPU, or closed binary is required.
- License: GitHub Docs content is published under CC BY 4.0; code examples have separate MIT terms where applicable.
- Cost / dependency risk: low for the bounded method; the production integration still depends on correct event payload handling and explicit policy for new branches/force pushes.

## What does this teacher know beyond KAOPU Current Best View?

On one precise question—**which commit range defines an existing-branch push**—GitHub's event model supplies an explicit `before -> after` range. The current Material workflow knows only `HEAD^ -> HEAD`. R2 already requires freshness, traceability, and fail-closed gates, but the inspected rules and applicable regression cases do not encode this push-range identity.

Teacher status: `TEACHER_CANDIDATE` for push-range semantics only. It is not an `ACTIVE_TEACHER`, is not in `referenceSet`, and has not been acknowledged by Material Mother.

## Falsifiable hypothesis and replay

Hypothesis: if a fast-forward push contains two relevant commits, one touching R04 and the last touching R03, `HEAD^..HEAD` will select R03 only, while `before..after` will require both R03 and R04.

The probe creates real temporary Git histories, compares both ranges, and maps changed files to R01–R04 scopes.

| Fixture | Full pushed range | `HEAD^..HEAD` | Verdict |
|---|---|---|---|
| one commit: R04 + R03 | R03, R04 | R03, R04 | `SCOPE_VERIFIED` |
| two commits: R04 then R03 | R03, R04 | R03 | `HOLD_PUSH_SCOPE_INCOMPLETE` |
| two commits: R02 then docs | R02 | none | `HOLD_PUSH_SCOPE_INCOMPLETE` |
| two commits: docs then R03 | R03 | R03 | `SCOPE_VERIFIED` |

Result: 4/4 expected verdicts matched; two multi-commit counterexamples reproduced the omission. Hypothesis was not falsified.

## Comparison with existing KAOPU controls

- `CANDIDATE_CI_GREEN_SKIPPED_CLAIM_001` checks whether declared required steps ran. It does not guarantee that the required-step set was derived from the complete pushed change range.
- `CANDIDATE_FINAL_CLAIM_CLOSURE_001` checks named claim closure, not event-range selection.
- This mechanism therefore receives a separate deduplicated Candidate regression: `CANDIDATE_PUSH_RANGE_SCOPE_NOT_LAST_COMMIT_001`.

## Candidate, not adoption

For one Material workflow trial only:

1. Add Task Anchor fields for change event, `before`, `after`, range policy, and ancestry status.
2. For an existing-branch fast-forward push, compute scope from the complete `before..after` range.
3. Record required, selected, and uncovered regression scopes in the Delivery Receipt.
4. HOLD when required scope is uncovered.
5. Keep new-branch, force-push/non-ancestor, and GitHub diff-limit cases `UNKNOWN/HOLD` until separately tested.

No production workflow or Mother branch was modified. No global OS rule was changed.

## Routing state

- Material Mother / Coordinator: `NOT_QUERIED` at log creation.
- Teacher lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE -> AUDITION` (local Git replay completed).
- `ACKNOWLEDGED`: no.
- `IMPLEMENTED`: no.
- `GATE-RUN`: local probe only; no production gate run.
- `ADOPTED`: no.
- `USER-ACCEPTED`: no.

## Metrics

First-candidate pass rate, user correction count, same-error recurrence, rejected-lineage inheritance, stale delivery count, accepted-delta iterations, and instruction-to-candidate latency: `UNKNOWN` (no reliable measurement supplied).
