# KAOPU Learning Flywheel N26 — Green CI claim-scope gate

Status: **Candidate partial / historical replay verified / not adopted**  
Bounded question: **Can an overall green GitHub Actions workflow, by itself, support a publication-complete claim when claim-critical steps were skipped?**

## 1. Existing real failure

Stone Money workflow run [35936763006](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35936763006), job `107435412791`, completed with workflow/job conclusion `success`. However:

- `Install real Chromium verification tools` was `skipped`;
- `Verify every byte, perform real browser tests, publish, and reread HTTPS` was `skipped`;
- the saved proof reported `SOURCE_TRANSFER_REQUIRED`, `shareAllowed=false`, `deployed=false`, and `publicBrowserPassed=false`;
- the current public artifact was still R009.

The workflow itself preserved this truth, and the latest #91 audit correctly classified the result as `VERIFIED_SETUP / REPRODUCIBLE_SOURCE_TRANSFER_BLOCKER / PUBLICATION_NOT_RUN`. The failure mechanism is therefore not dishonest workflow code; it is that an overall green signal can be detached from the narrower claim it actually verifies and later be over-promoted by a human or downstream agent.

## 2. Independent Observation Roots

### O1 — KAOPU current main policy

R2 OS already separates `LOCK -> EXECUTE -> VERIFY -> PROMOTE`, independent verification, public HTTP/browser checks, stale delivery, and user acceptance. The current Delivery Receipt stores tests, browser state, failed gates, freshness, and readiness, but it does not require a named claim, a claim-specific required-step manifest, or an automatically derived claim state.

### O2 — Exact production history

The GitHub run/job/step conclusions and saved proof above are direct execution evidence at commit [`7d60191`](https://github.com/haihao0307/guilin-dem-pipeline/commit/7d60191bd8cf2d7e5138dab30873d8e59cca044b). The #91 comment is a correct interpretation of this root, not a second independent root.

### O3 — Platform semantics

GitHub documents that conditionally skipped jobs can report `Success` and do not block merging, and its contexts expose each step conclusion separately, including `skipped`. Therefore a green overall conclusion does not entail that every conditional outcome step executed:

- [GitHub — Control jobs with conditions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions)
- [GitHub — Contexts reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)

### O4 — N26 executable historical replay

The N26 probe binds two claims to different step manifests and proof predicates, then replays the exact history fixture.

## 3. Comparison with current KAOPU制度

No-novelty: R2 already says publication, HTTP, browser, device, visual, and user acceptance are different states; it already prohibits stale or substitute delivery.

Novel gap: this separation is currently semantic/manual at the receipt boundary. There is no small executable object that answers: “Which named claim does this green run support, which exact steps were required, and were any of those steps skipped?”

## 4. Falsifiable hypothesis

> A green workflow may support only the named claims whose required steps all concluded `success` and whose proof predicates match. A skipped claim-critical step must hold the stronger claim, without invalidating unrelated weaker claims.

This hypothesis would be falsified if the rule rejected a fixture in which all publication-required steps and proof predicates passed, or if it could not distinguish setup from publication in the real history.

## 5. Minimal replay result

Local deterministic gate result: **passed**.

- Actual history + claim `VERIFIED_SETUP`: `CLAIM_VERIFIED`.
- Same history + claim `PUBLICATION_COMPLETE`: `HOLD_CLAIM_INCOMPLETE`.
- The two publication-required steps were both preserved as `skipped`.
- Proof mismatches were exactly `shareAllowed`, `deployed`, and `publicBrowserPassed`.
- Falsification control changed those two steps and three predicates to successful values; `PUBLICATION_COMPLETE` then became `CLAIM_VERIFIED`.

The gate is therefore not “always reject” and not “all skipped steps fail everything.” It enforces only the current claim contract.

## 6. Transferable executable object

Candidate receipt extension for one affected Mother trial:

- `claimType`
- `claimScope`
- `requiredStepManifest`
- `stepResults`
- `skippedClaimCriticalSteps`
- `proofPredicates`
- `claimState = CLAIM_VERIFIED | HOLD_CLAIM_INCOMPLETE`

The overall workflow conclusion remains provenance/transport metadata and cannot directly set `shareAllowed`, `deployed`, `publicBrowserPassed`, `productionReady`, or `USER-ACCEPTED`.

## 7. Decision and boundaries

### Current Best View / Candidate

Adopt only as a **Candidate single-Mother trial** for the next Stone Money exact-source publication attempt. Require an independent verifier receipt before promotion.

### Rejected

- `workflow conclusion = success` therefore publication succeeded;
- every skipped step is automatically a global failure;
- another meeting or prose reminder without an executable claim object;
- immediate global R2/template mutation from one historical replay.

### Frozen

- Production Mother branches and assets;
- R2 OS, current publication status, Canonical Truth, and all existing public/browser/device/user gates;
- current source-transfer blocker.

### Unknown

Actual effect on first-pass acceptance, user correction count, recurrent errors, stale delivery, rejected-lineage inheritance, internal iterations, and time-to-valid-candidate. These require a live Mother trial; no KPI is inferred from this replay.

## 8. Next real gap

Run the candidate once on the next applicable Stone Money publication attempt, preserve the exact claim manifest in its Delivery Receipt, and obtain an independent verifier decision. Only then consider activating regression case `CI-GREEN-SKIPPED-CLAIM-001` or changing the shared R2 template.

First-tier external expert AI: **not called**. This was primary-source research plus deterministic historical replay, not an expert meeting.
