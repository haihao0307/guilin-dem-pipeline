# KAOPU Learning Flywheel N43 — declared runnable source closure

Date: 2026-09-29 (Asia/Shanghai)

## Bounded question

Can an exact-head static source-closure gate prevent a branch from being counted `STARTED`, `BUILDABLE` or `TESTABLE` when its declared build/test entrypoints or their local source inputs do not exist?

## 1. Existing real failure

The new project branch `work/kaopu-score-instrument-r01-20260929` is real and is three commits ahead of main. Its exact head is `49dbcffe70ee2014efb6f563610bcbf8ee1a7062`. The three commit messages claim a clean R01 build, a bundled standalone instrument and a standalone 3D workbench shell.

The exact-head net delta contains only:

- `kaopu-score-instrument-r01/package.json`
- `kaopu-score-instrument-r01/scripts/build.mjs`
- `kaopu-score-instrument-r01/src/index.template.html`

`package.json` declares `node scripts/build.mjs` and `node tests/smoke.mjs`. `build.mjs` reads `src/app.js` and `src/index.template.html`. At the exact head, `tests/smoke.mjs` and `src/app.js` are both absent. The head has no status checks. Therefore branch existence, three commits and a plausible HTML shell are true observations, but `STARTED`, `BUILDABLE`, `TESTABLE`, bundled output, browser result and user-visible 3D behavior are not established.

This is not an inference from a missing receipt alone: the declared executable graph is structurally open before execution can begin.

Repository evidence:

- https://github.com/haihao0307/guilin-dem-pipeline/commit/49dbcffe70ee2014efb6f563610bcbf8ee1a7062
- https://github.com/haihao0307/guilin-dem-pipeline/blob/49dbcffe70ee2014efb6f563610bcbf8ee1a7062/kaopu-score-instrument-r01/package.json
- https://github.com/haihao0307/guilin-dem-pipeline/blob/49dbcffe70ee2014efb6f563610bcbf8ee1a7062/kaopu-score-instrument-r01/scripts/build.mjs

## 2. External method and primary evidence

- npm defines `package.json` scripts as executable commands invoked by `npm run`.
- Node defines `ERR_MODULE_NOT_FOUND` as failure to resolve a module file while importing or loading the program entrypoint.
- Bazel's hermeticity guidance treats source identity and a known input set as prerequisites for reproducible builds; its sandboxing guidance restricts actions to declared inputs.

Primary sources:

- https://docs.npmjs.com/cli/using-npm/scripts/
- https://nodejs.org/api/errors.html#err_module_not_found
- https://bazel.build/versions/6.3.0/basics/hermeticity
- https://docs.bazel.build/versions/main/guide.html#sandboxed-execution

The transferable method is narrower than adopting Bazel: enumerate the exact-head runnable entrypoints and local source inputs, prove that each path is present inside the project root, and bind the receipt to the same head.

## 3. Comparison with current KAOPU rules

Issue #91 already says a lane is `STARTED` only after code + test + receipt + known limitations exist, and that branch/issue creation is not execution evidence. N42 already prevents a broader promotion claim from bypassing required gate receipts. N40 already separates a historical successful run from reproducible rerun toolchain closure.

N43 does not repeat those rules. It fills the earlier machine gap: a tree may contain some code and declarative scripts yet still have no closed executable source graph. The candidate receipt records:

- exact `subjectHeadSha`;
- project-root-relative script entrypoints;
- project-root-relative local imports/read inputs;
- missing paths and path escapes;
- explicit `UNKNOWN_DYNAMIC_SOURCE_CLOSURE` when static enumeration is incomplete;
- derived verdict only.

## 4. Falsifiable hypothesis

If `BUILDABLE` / `TESTABLE` / `STARTED` requires exact-head source closure, the gate will hold the historical head and separately identify its missing test target and missing build input. It will also hold stale-head receipts, path escapes and a generated artifact whose source graph is incomplete; preserve dynamic dependencies as Unknown; and pass only a fully closed synthetic control with a narrow `SOURCE_CLOSURE_VERIFIED_ONLY` verdict.

If any replay case is misclassified, reject the Candidate.

## 5. Minimal historical replay

`declared_source_closure_gate_n43.mjs` evaluated ten cases from `declared_source_closure_fixture_n43.json`; result: `10/10` expected verdicts.

- historical exact head → `HOLD_DECLARED_SOURCE_CLOSURE_INCOMPLETE`, missing `tests/smoke.mjs` and `src/app.js`;
- same-cycle follow-up head `b37d208aa730615b77a2f953f40db8e909276694` contains both previously missing files and receives only `SOURCE_CLOSURE_VERIFIED_ONLY`;
- missing test target only → HOLD;
- missing build input only → HOLD;
- generated `dist/index.html` with missing source → HOLD;
- stale-head receipt → `HOLD_SUBJECT_HEAD_MISMATCH`;
- `../` or absolute-path borrowing → `HOLD_PROJECT_PATH_ESCAPE`;
- unresolved dynamic source inputs → `UNKNOWN_DYNAMIC_SOURCE_CLOSURE`;
- fully closed control → `SOURCE_CLOSURE_VERIFIED_ONLY`.

The follow-up is a real exact-head static source-closure trial, not a build or browser run. It does not repair or implement the 3D instrument.

### Same-cycle exact-head update

After the historical HOLD was recorded, the project branch advanced to `b37d208aa730615b77a2f953f40db8e909276694` with `src/app.js`, `tests/smoke.mjs`, a Task Anchor, README and a workflow declaration. The exact-head declared script targets and the two local build inputs are now present. The prior HOLD is not inherited across the head change.

Workflow run `36518891204` later completed for `b37d208aa730615b77a2f953f40db8e909276694`. Dependency installation, standalone build and standalone-package shape passed; file-protocol desktop/mobile browser QA failed; publication and live verification were skipped. This confirms the Candidate's boundary: source closure may pass while a downstream browser gate still fails. The valid claims for that head are `SOURCE_CLOSURE_VERIFIED_ONLY` plus the named successful workflow steps, not browser readiness or publication.

The branch then advanced to `ffb5bc5ae49e419f9b821dbc4e9797275708fc16`; workflow run `36519120050` was still in progress at observation. No verdict from `b37d208…` is inherited by that new head.

## 6. Applicability boundary

- Local Candidate for the next `kaopu-score-instrument-r01` claim of `STARTED`, `BUILDABLE`, `TESTABLE`, standalone output or browser readiness.
- Do not require generated outputs to exist before a build; require only the source graph needed to generate them.
- Package/tool dependency closure remains N40 territory.
- Passing source closure does not prove install success, runtime, browser, visual fidelity, score compactness, deterministic reconstruction, production readiness or user acceptance.
- Dynamic dependencies that cannot be enumerated remain Unknown rather than silently passing.
- Non-Node projects need an equivalent extractor for their own manifest/build language; do not generalize this parser globally.

## 7. Adoption decision

Decision: `CANDIDATE_SINGLE_PROJECT_TRIAL_ONLY`.

Route only to the execution ledger for the new score-instrument branch. On its next candidate, the producer should emit one exact-head source-closure receipt before claiming `STARTED` or `BUILDABLE`; an independent verifier must run it. Do not patch the project branch, main, R2, Canonical Truth or any existing publication. Rollback is removal of the candidate gate/receipt requirement from this one project line.

Lifecycle after targeted routing and exact-head external trial: `POSTED=true`, `GATE-RUN=true`; `ACKNOWLEDGED=false`, `IMPLEMENTED=false`, `ADOPTED=false`, `USER-ACCEPTED=false`. `IMPLEMENTED` remains false because the project has not integrated the Candidate gate or emitted its own receipt; adding the missing source files is remediation, not gate adoption.

Institutional KPI effect: `Unknown`; no real Mother trial or post-adoption sample exists. First-pass acceptance, user correction count, recurrence, rejected-lineage inheritance, stale delivery, internal iterations and time-to-legal-candidate remain `Unknown`.

No first-tier external expert AI was called.
