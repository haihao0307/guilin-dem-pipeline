# KAOPU Learning Flywheel N70 — Kuko diagnostic assertion staging

Date: 2026-10-04  
Status: CANDIDATE / POSTED / GATE-RUN / KUKO-LOCAL / NOT-ADOPTED  
Global R2 adoption: false

## 1. Existing real failure

Kuko/anemone workflow run `#23` at `gh-pages@c1a75170` failed both `file/core` and `public/core`; the other six partitioned cells passed and the aggregate rejected the run. The exact failed assertion is not available in this record, so no root cause is claimed.

The source does expose a bounded failure mechanism: `browser-qa.cjs` passed a throwing `check` callback into the lighting helper and immediately checked its final verdict before closing that context and starting the independent first-entry helper. A diagnostic mismatch could therefore reject correctly but stop collection of later safe evidence. This is evidence starvation, not a false pass, and can prolong the “change one thing and rerun” loop.

Bounded question: can independent diagnostic failures continue collecting later evidence without weakening the final fail-closed verdict?

## 2. External method / evidence

Two primary test-framework sources agree on the useful distinction:

- GoogleTest pairs nonfatal `EXPECT_*` assertions, which record failure and continue the current function, with fatal `ASSERT_*` assertions, which abort it. Its primer recommends fatal assertions only when continuing no longer makes sense.
- Playwright documents soft assertions as continuing test execution while still marking the test failed; it also exposes accumulated soft errors for an explicit later stop.

Sources:

- https://google.github.io/googletest/reference/assertions.html
- https://google.github.io/googletest/primer.html
- https://playwright.dev/docs/test-assertions

The external method does not authorize ignoring failures. It separates evidence collection control flow from the final verdict.

## 3. Comparison with current KAOPU controls

R2 already requires independent verification and fail-closed promotion. N69 already verifies that the Kuko aggregate requires all eight cells, all required helpers and `tests.every(pass===true)`. The current gates do not explicitly classify a verifier assertion as either:

- **fatal prerequisite** — later execution would be invalid, unsafe or semantically meaningless; or
- **independent diagnostic** — later safe observations remain useful even after this check fails.

Therefore no global R2 change is justified. The smallest Kuko-local candidate is: record independent diagnostic failures nonfatally, continue only safe independent observations, then retain the existing hard helper verdict and aggregate all-tests-pass rule.

Source comparison:

- before `c1a75170`: no `recordCheck`; the lighting helper receives throwing `check`;
- candidate `21e4a025`: `recordCheck` writes the same test receipt without throwing; lighting and first-entry helpers both run before their final hard checks;
- aggregate remains unchanged in the relevant predicate: every required recorded test must be true and every required helper must exist and pass.

## 4. Falsifiable hypothesis

For the exact Kuko core verifier, staging independent diagnostics as nonfatal will preserve later safe evidence after a diagnostic mismatch while the cell and aggregate still reject every recorded false check, missing helper or failed helper.

Falsifiers:

1. a staged negative diagnostic is accepted;
2. a staged negative prevents the later independent diagnostic from being recorded;
3. a forced Producer `passed=true` hides a recorded failure;
4. a missing or failed required helper is accepted; or
5. an unsafe prerequisite continues into downstream diagnostics.

## 5. Minimal replay / trial

Executable replay:

`PROBES/diagnostic_assertion_staging_gate_n70.mjs`

Saved result:

`PROBES/diagnostic_assertion_staging_result_n70.json`

Results:

- exact-source semantic checks: `8/8 passed`;
- adversarial control-flow cases: `7/7 passed`;
- old fatal negative: rejected, later evidence absent;
- staged diagnostic negative: rejected, later evidence present;
- all checks true: accepted;
- unsafe prerequisite: rejected and later evidence absent;
- forced Producer pass flag with a recorded failure: rejected;
- missing first-entry helper: rejected;
- failed lighting helper: rejected.

The source hashes bound by the replay are:

- before browser QA: `35a573191c000c446cf543fc550b688d40b8b00e2e7d212d045778555fdaf0ac`;
- candidate browser QA: `e6ae7c992f6fa67f204549d823c63619d6e291db41a94f6b81091b6eb602896e`;
- candidate aggregate: `65a50900a7553410d4fa3856652b5d63bb55bff964efa3ee6cc0c2bea6dd5218`.

Public production trial:

- https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37168616478
- run `#24`, exact commit `21e4a025b82fa8a32c1323ed83d3bee186150d76`;
- completed `success` in `15m21s` (`2026-10-04T01:38:22Z` to `01:53:43Z`);
- all eight exact-subject file/public matrix cells completed successfully;
- the aggregate completed successfully;
- nine commit-scoped artifacts were retained: eight cell artifacts plus one aggregate artifact.

This supplies a real Kuko-local production `GATE-RUN`. It still cannot support visual acceptance, physical-device acceptance, user acceptance or global adoption.

## 6. Applicability boundary

Applicable now only as an inactive regression candidate for the Kuko/anemone core browser verifier. A diagnostic may be nonfatal only when later observations are independent and safe. Missing subject identity, unavailable runtime, invalid setup, unsafe state, corrupted input and other prerequisites remain fatal.

The replay does not prove visual fidelity, physical iPhone/Safari behavior, user acceptance, or suitability for every Mother. It does not modify `main`, `gh-pages`, a production Mother branch, R2 or any threshold.

## 7. Adoption decision

Decision: retain the implemented assertion staging as a validated Kuko-local gate and keep `DIAGNOSTIC-CONTINUATION-FAIL-CLOSED-001` inactive for other Mothers. The local replay and exact-subject public run passed, but one Kuko run does not justify a global R2 rule. Require a separately scoped affected-Mother trial before any wider adoption.

Routing receipt: https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5975551770

Gate-run follow-up receipt: https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5975559293

Lifecycle at this commit: `POSTED=true`, `ACKNOWLEDGED=false`, `IMPLEMENTED=true`, `GATE-RUN=true`, `ADOPTED=false`, `USER-ACCEPTED=false`.

Metrics: observed run duration `15m21s` for this run only; user corrections `unknown`; same-class recurrence `unknown`; rejected-lineage inheritance `unknown`; stale delivery `unknown`; internal iterations per accepted delta `unknown`; first-pass candidate pass rate `unknown`; instruction-to-legal-candidate time `unknown`. No causal runtime improvement is claimed.
