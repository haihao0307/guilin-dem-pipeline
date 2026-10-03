# KAOPU Learning Flywheel N69 — Kuko partitioned browser-QA aggregate

Date: 2026-10-04  
Status: IMPLEMENTED / GATE-RUN / KUKO-LOCAL  
Global R2 adoption: false

## 1. Existing real failure

The Kuko/anemone browser QA previously ran long monolithic file/public jobs. The two preceding public runs did not establish a complete acceptance receipt: run `#19` was cancelled after `18m23s`, and run `#18` failed after `7m36s`. Splitting a long job can reduce timeout pressure, but it creates a new institutional risk: a missing, failed, duplicated or wrong-subject partition might be mistaken for an overall pass.

Bounded question: does `gh-pages@fcde9be8420c67cac059815e2c1d34ecfc0a8efa` preserve fail-closed semantics after partitioning the Kuko/anemone browser QA into eight jobs?

## 2. External method / evidence

GitHub's primary documentation supplies the relevant mechanics rather than a new KAOPU policy:

- a matrix expands declared dimensions into job combinations;
- `strategy.fail-fast: false` prevents one non-experimental matrix failure from cancelling the remaining matrix jobs;
- a job that declares `needs` is normally skipped when a dependency fails, while `if: always()` permits an audit/aggregate job to run and inspect the completed dependency state;
- uploaded artifacts have independently reported digests and are bound to the workflow run.

Sources:

- https://docs.github.com/en/actions/using-jobs/using-a-matrix-for-your-jobs
- https://docs.github.com/en/actions/using-jobs/using-jobs-in-a-workflow
- https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts

These mechanics do not themselves prove complete KAOPU evidence. The completeness rule must remain explicit in the local aggregate program.

## 3. Comparison with current KAOPU controls

R2 already requires machine-verifiable evidence, subject identity and independent verification. The freshness and no-creative-substitute gates already forbid accepting stale or substituted artifacts. Therefore the external method is `no-novelty` at global-policy level.

The production delta is nevertheless a substantive local implementation:

- matrix dimensions are exactly `phase=[file,public]` and `group=[core,catalog,orbit,touch]`;
- every cell uploads a phase/group/commit-scoped artifact and treats a missing output file as an error;
- the aggregate job has `needs: browser-groups` and `if: always()`;
- `aggregate-groups.cjs` requires exactly eight result basenames, exactly one result per cell, matrix success, correct phase/group identity, exactly one completed section, the expected current HTML hashes, zero errors, nonempty tests and all tests passing;
- the aggregate result explicitly keeps `physicalIPhoneTested=false` and `visualAcceptance=false`.

## 4. Falsifiable hypothesis

For this exact workflow and subject commit, the aggregate gate accepts one complete valid `2 x 4` result set and rejects any set with a missing or duplicate cell, unsuccessful matrix status, failed cell, wrong phase/group identity, incomplete section, wrong subject hash, invalid helper evidence, empty tests or a failed test.

Falsifier: any malformed replay above returns exit code `0`, or the complete valid set returns nonzero.

## 5. Minimal replay and real run

The exact `aggregate-groups.cjs` from `gh-pages@fcde9be8` was replayed against synthetic result directories bound to the current file/public HTML hashes. Result: `12/12 passed`.

Accepted:

1. complete eight-cell result set.

Rejected:

1. matrix result not `success`;
2. missing `public/touch`;
3. duplicate `file/core`;
4. cell `passed=false`;
5. wrong phase;
6. wrong group;
7. incomplete section;
8. wrong runtime HTML hash;
9. invalid helper evidence;
10. empty test list;
11. failed test.

The public Actions run supplies independent execution evidence:

- run: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37160332094
- commit: `fcde9be8420c67cac059815e2c1d34ecfc0a8efa`
- result: `Success`, total duration `13m13s`;
- graph: eight matrix jobs completed successfully, followed by `aggregate` completed successfully in `10s`;
- artifacts: eight group artifacts plus one aggregate artifact.

This proves the local gate ran and closed successfully for this commit. It does not prove that partitioning caused the shorter duration; the comparison is one run and also contains code changes.

## 6. Applicability boundary

Applicable only to the Kuko/anemone exact-byte file/public browser-QA workflow and its current result schema. It does not establish:

- visual fidelity to the user reference;
- physical iPhone/device acceptance;
- CPU/browser portability beyond the declared runner configuration;
- user acceptance;
- a generic matrix gate for other Mothers without adapting their subject identity and required evidence.

## 7. Adoption decision

Decision: retain the implementation as a validated Kuko-local gate. Do not change R2, `main`, any production Mother branch, or any acceptance threshold. Do not create a duplicate global regression case: the production aggregate program is already the executable local gate, and this record adds the missing adversarial replay plus real run receipt.

Lifecycle: `IMPLEMENTED=true`, `GATE-RUN=true`; `POSTED` becomes true only after the coordination receipt is written. `ACKNOWLEDGED`, `ADOPTED` and `USER-ACCEPTED` remain false until separate real receipts exist.

Metrics: observed run duration `13m13s` for this run only; causal improvement `unknown`; first-pass candidate pass rate `unknown`; user corrections `unknown`; same-class recurrence `unknown`; rejected-lineage inheritance `unknown`; stale delivery `unknown`; internal iterations per accepted delta `unknown`; instruction-to-legal-candidate time `unknown`.
