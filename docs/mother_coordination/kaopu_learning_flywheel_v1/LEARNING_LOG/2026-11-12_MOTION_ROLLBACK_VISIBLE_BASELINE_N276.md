# KAOPU Learning Flywheel N276 — source rollback is not visible-baseline restoration

Date: 2026-11-12 (Asia/Shanghai)  
Scope: Animation Mother / Humanoid Mother  
R2 baseline: unchanged  
Production branches/assets: untouched

## One bounded question

After the user's correction — **“退回你这次修改的内容，我看不到任何以前的好效果了”** — does PR #344 current head prove that the previous good **visible** result was restored, or only that source history was reset?

## Required pre-read and priority choice

Re-read current `main@73452580929bc9cc37a8e57d79da69af994af808`:

- root `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference-replication gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91/#63 latest production feedback and applicable candidate regressions

The baseline documents are unchanged. #91 has no Mother acknowledgement of N275; #63 has no new applicable acceptance. This correction is more urgent than another IK experiment because it is a direct user-visible claim about rollback and stale delivery.

## Exact replay

### 1. Source rollback did occur

PR #344 moved from:

- previous head: `b6395634f0598aac144c4054aa5119f884f27722`
- current rollback head: `50c284deae700803e3817fb8e284a7f117dfb799`

Git history establishes that the old head is **17 commits ahead** of the rollback head and that the rollback head is their merge base. The reset removed the three-clip packaging/selector line, including:

- `.github/workflows/motion-atlas-package.yml`
- `cmu-sample-pack.json`
- the three-clip selector/package changes

The current source therefore represents a single CMU 16_33 preview again.

Exact-head source QA also succeeded:

- workflow run: `43139278590`
- conclusion: `success`

Decision at this layer: **`SOURCE-RESET = IMPLEMENTED`**.

### 2. The declared visible result is not restored

Expected public preview:

`https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/motion-atlas-r03/index.html`

Live browser replay result:

- HTTP surface: GitHub Pages **404 / File not found**
- no visible candidate identity
- no fixed-view comparison to a bound previous-good target

The source JSON itself is available:

`https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/full/activity-r01/CMU-WALK-SOURCE.json`

Observed identity:

- schema: `cmu16-33-source-positions/1`
- clip: CMU `16_33`
- 285 frames
- 31 joints
- 120 Hz

A live source file does not substitute for a live visible delivery.

### 3. The rollback target identity is unbound

The user correction names a perceptual state — “以前的好效果” — but the available receipt does not bind that state to one exact:

- accepted artifact digest,
- accepted commit plus rendered screenshot,
- fixed-view golden,
- public URL,
- or `USER-ACCEPTED` event.

Therefore neither source reset nor successful source CI can establish that the user's prior good visible baseline was restored.

## New failure mechanism

**A fresh exact source rollback can coexist with a missing or unbound visible result.**

This is not a duplicate of freshness, rejected-lineage quarantine, provenance disclosure, or reference fidelity. It separates two states that had been collapsed:

- `SOURCE-RESET`
- `VISIBLE-BASELINE-RESTORED`

Decision:

`HOLD_SOURCE_RESET_WITHOUT_VISIBLE_BASELINE_RECEIPT`

## Candidate regression

Created:

`CANDIDATE_ROLLBACK_SOURCE_RESET_NOT_VISIBLE_BASELINE_RESTORED_001`

Minimum fields:

- Task Anchor: `rollbackTargetArtifact / rollbackTargetCommit / rollbackTargetScreenshotOrGolden / rollbackTargetPublicUrl / rollbackTargetAcceptanceState / candidateHeadSha`
- Delivery Receipt: `rollbackOperation / sourceResetFromSha / sourceResetToSha / exactHeadCiRun / publicHttpStatus / renderedCandidateIdentity / renderedTargetIdentity / fixedViewEvidence / visibleBaselineMatch / userAcceptance`

Fail-closed states:

- `HOLD_ROLLBACK_TARGET_IDENTITY_UNBOUND`
- `HOLD_ROLLBACK_PUBLIC_URL_UNAVAILABLE`
- `HOLD_ROLLBACK_RENDERED_TARGET_MISMATCH`
- `HOLD_SOURCE_RESET_MISSTATED_AS_VISIBLE_RESTORATION`
- `HOLD_ROLLBACK_USER_ACCEPTANCE_UNKNOWN`

## Falsifiable hypothesis and minimum Mother trial

Hypothesis: if rollback truly restores the previous good visible result, then a target-bound public URL at the rollback head will render the same accepted subject in a fixed view. A missing URL, unbound target, or identity mismatch falsifies restoration.

Single-Mother trial only:

1. Bind one exact previous-good visible target.
2. Publish that rollback candidate with an exact candidate identity.
3. Run exact-head source CI and a browser gate on the declared URL.
4. Compare the rendered subject and fixed view to the bound target.
5. Keep verifier pass separate from user acceptance.

No R2 or global-gate change is authorized by this replay.

## Lifecycle and boundary

- `POSTED=true` — routed only to #91 in this run
- `ACKNOWLEDGED=false`
- candidate regression `IMPLEMENTED=true`
- exact history / exact-head CI / public browser `GATE-RUN=true`
- production visible restoration `IMPLEMENTED=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

This round did not change PR #344, a production Mother branch, main, R2, the public deployment, or any global gate. Motion quality, contact locking, IK, and reference fidelity are outside this bounded question.
