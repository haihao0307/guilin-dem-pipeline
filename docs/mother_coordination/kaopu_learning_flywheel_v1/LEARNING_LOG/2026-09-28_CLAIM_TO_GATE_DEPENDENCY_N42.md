# KAOPU Learning Flywheel N42 — claim-to-gate dependency

Date: 2026-09-28 (Asia/Shanghai)

## Bounded question

Can a minimal machine-readable claim contract prevent a green startup/browser/Pages workflow from being interpreted as a promotable Coral candidate when Task Anchor, scope, reference-fidelity or standalone-delivery prerequisite gates are missing, skipped, failed, stale or self-approved?

## 1. Existing real failure

Coral R03/R03.1 current head `509f95b359f9c29349da3c63612a58b9f304f821` is fresh and its public startup workflow run `36202544305` plus Pages run `36202543641` succeeded. Those results preserve valid narrow evidence: the exact public bytes loaded, a first frame completed, failure UI appeared, and the hosted page ran in managed Chromium.

The same startup workflow explicitly requires `groupStillWorks` and `poreStillWorks` to be true. The public candidate still offers `single`, `patch9`, `patch25` and `pore`; runtime instance counts include 9 and 25. This directly preserves the object-count and pore expansion already held by N41. There is no formal Task Anchor, N41 scope-gate run, independent reference-fidelity run or standalone-single-HTML run. Thus startup success is true but cannot support the broader promotion claim.

The failure mechanism is not merely “a missing test.” Independent workflows and checks have no semantic relationship unless a promotion claim explicitly names them as prerequisites. A green downstream runtime check can therefore coexist with an unrun upstream scope gate, and may even celebrate a forbidden feature's survival.

## 2. External method and primary evidence

GitHub Actions `jobs.<job_id>.needs` makes prerequisite jobs explicit: a dependent job runs only after named jobs complete successfully. GitHub also warns that a skipped job reports `Success`, so a promotion verifier must inspect each required gate's actual conclusion rather than trust an overall green check name. Protected branches enforce only checks configured as required; unrelated green checks do not substitute for a missing required check.

NASA product verification ties evidence back to the approved requirement set and defines verification as proof that the product conforms to those requirements. This supports a claim-scoped dependency contract, not a claim that any successful test proves the whole product.

Sources:

- GitHub Actions workflow syntax — `jobs.<job_id>.needs`: https://docs.github.com/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idneeds
- GitHub status checks — skipped jobs report success: https://docs.github.com/en/pull-requests/reference/status-checks
- GitHub protected branches — required checks must pass: https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- NASA Product Verification: https://www.nasa.gov/reference/5-3-product-verification/

The transferable method is explicit prerequisite closure and requirement-linked evidence. KAOPU does not adopt GitHub or NASA processes wholesale.

## 3. Comparison with current KAOPU rules

R2 already requires Task Anchor, Producer/Verifier separation, Gate 1–3, exact current-head evidence and HOLD on any failed gate. N41 already defined the Coral scope fields and correctly remains only `POSTED`; `MOTHER-NO-METHOD-INVENTION-001` already rejects the underlying unauthorized direction change. Therefore no new rule is needed for “scope matters,” “Producer cannot approve itself,” or “green deployment is not user acceptance.”

The executable gap is the dependency edge between a claim and its required gate receipts. The R03.1 workflow is internally correct for `PUBLIC_STARTUP_READY`, but no machine object prevents that narrow truth from being promoted to `PROMOTABLE_CORAL_METHOD_CANDIDATE`.

Candidate `ClaimContract` fields:

- `claimId` and canonical `claimContractDigest`;
- exact `subjectHeadSha`;
- `requiresTaskAnchor` and exact `taskAnchorDigest`;
- ordered `requiredGates` with `independentVerifierRequired`;
- gate receipts bound to the same head, with actual conclusion and producer/verifier identities;
- derived verdict only; no producer-authored promotion flag.

For the next Coral candidate, the minimum promotion prerequisites are `SCOPE_AUTHORIZED`, `REFERENCE_FIDELITY`, `STANDALONE_HTML` and `PUBLIC_STARTUP_READY`. A missing Task Anchor or any missing/skipped/failing prerequisite yields HOLD. `PUBLIC_STARTUP_READY` remains a valid narrower claim and is not erased.

## 4. Falsifiable hypothesis

If promotion is computed only from the exact claim contract and exact-lineage prerequisite receipts, the gate will:

- preserve R03.1's narrow startup truth;
- reject its promotable-candidate claim because the Task Anchor is missing;
- reject skipped, failed, stale-head and self-approved scope gates;
- pass only the counterfactual control with all required current-head receipts.

If any control is misclassified, reject the Candidate.

## 5. Minimal historical replay

`claim_gate_dependency_n42.mjs` ran ten cases from `claim_gate_fixture_n42.json`; result: `10/10` expected verdicts.

- historical R03.1 promotion claim → `HOLD_TASK_ANCHOR_MISSING`
- anchor exists but scope/reference/standalone receipts are absent → `HOLD_REQUIRED_GATE_MISSING`
- a skipped scope job whose check appears green → `HOLD_REQUIRED_GATE_NOT_RUN`
- failed scope gate → `HOLD_REQUIRED_GATE_FAIL`
- passing receipt from another head → `HOLD_GATE_SUBJECT_MISMATCH`
- Producer self-approval → `HOLD_SELF_APPROVED_GATE_RUN`
- full exact-lineage independent control → `CLAIM_VERIFIED`
- historical narrow startup claim → `CLAIM_VERIFIED`
- forbidden group/pore checks green but no scope receipt → `HOLD_REQUIRED_GATE_MISSING`
- changed Task Anchor → `HOLD_TASK_ANCHOR_MISMATCH`

This is a state-machine replay, not a real Mother workflow run. It proves the Candidate distinguishes the cases; it does not prove implementation or adoption.

## 6. Applicability boundary

Use only for claims whose prerequisite evidence can be enumerated: promotion, publication, baseline advancement, handoff completeness or device/runtime readiness. Do not force unrelated gates onto narrow claims. For example, `PUBLIC_STARTUP_READY` need not prove biological fidelity, but it cannot authorize promotion.

GitHub `needs` is an implementation option, not the policy itself. A separate verifier may also consume immutable gate receipts. Because skipped checks may appear successful, the verifier must require an explicit `conclusion=success` for every named gate and bind it to the exact candidate head.

## 7. Adoption decision

Decision: `CANDIDATE_SINGLE_MOTHER_TRIAL_ONLY`.

Route only to GAME Coral Mother through PR #151 for the next related candidate. Do not edit the current R03/R03.1 production branch or gh-pages. Do not modify R2, root `AGENTS.md`, mandatory gates or Canonical Truth. The trial should emit one promotion receipt after the formal Task Anchor and N41 scope gate exist; rollback is removal of the candidate verifier/workflow edge.

Lifecycle before targeted routing: `POSTED=false`, `ACKNOWLEDGED=false`, `IMPLEMENTED=false`, `GATE-RUN=false`, `ADOPTED=false`, `USER-ACCEPTED=false`.

Institutional KPI effect: `Unknown`; no real trial or post-adoption sample exists.
