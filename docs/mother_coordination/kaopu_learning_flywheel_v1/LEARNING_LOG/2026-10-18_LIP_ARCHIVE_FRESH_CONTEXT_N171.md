# N171 — Lip archive fresh-context portability

Date: 2026-10-18 (Asia/Shanghai)  
Track: institution / external teacher candidate  
Bounded question: **Does exact restoration in one page or BrowserContext prove that a persisted lip archive restores in a clean-slate BrowserContext after the producer context is closed?**

## Baseline read

- Main baseline: `5543f756ca3af1428323696324303fa70b8de850`.
- R2 OS and both reference-replication / freshness gates remain the governing baseline.
- #91 latest applicable coordinator state remains N170; #63 has no newer applicable production feedback.
- PR #303 head inspected: `3cc02b999bc9b5bc9310194e65950948500740d3`.
- New PR #303 comment `6238614482` is explicitly `POSTED only`: it reports exact calibration, geometry, settings and framebuffer restoration but no fresh-context rerun or independent reproduction.

## Existing failure and code observation

PR #303's verifier constructs one Playwright `BrowserContext`; the archive save/restore checks occur on the same page inside that context, and cleanup closes pages/context only after the test. This is valid evidence for same-session round-trip restoration, but it leaves a distinct leakage channel: non-archived page/context memory can complete the restore.

Current evidence state:

`SAME_CONTEXT_ROUNDTRIP_VERIFIED__HOLD_FRESH_CONTEXT_PORTABILITY_UNTESTED`

This is a scope hold, not a rejection of the archive implementation.

## External method and teacher screening

Candidate: Microsoft Playwright browser-context isolation.

1. Source/provenance: official Playwright documentation and Microsoft repository.
2. Maintenance: release `v1.64.1` published 2026-10-14.
3. Reproducibility: runnable open-source framework, test runner and repository tests.
4. License: Apache-2.0.
5. Direct relevance: BrowserContext is the isolation boundary for cookies, local/session storage and other browser-profile state.
6. Novelty versus KAOPU Current Best View: N34 checked reversible state tuples and painted pixels but did not require the producer context to die before archive import.
7. Cost/risk: one or two extra full context/page loads; already within the PR's Playwright dependency. It can expose session leakage but cannot prove cross-browser, cross-device or future-version compatibility.
8. Demo/closed-data risk: none for this method; it is infrastructure rather than a trained model.

Status: `TEACHER_CANDIDATE`  
Lifecycle: `RADAR_FOUND -> TEACHER_CANDIDATE`

**What exactly does it know beyond KAOPU Current Best View?** A clean-slate BrowserContext is a stronger, executable isolation oracle than UI reset or a second page in the same context; it makes browser-profile and in-memory state leakage falsifiable.

Sources:
- https://playwright.dev/docs/browser-contexts
- https://github.com/microsoft/playwright
- https://github.com/microsoft/playwright/releases/tag/v1.64.1

## Falsifiable hypothesis

If the archive contains or deterministically rebuilds every output-affecting state component, then after the producer page and context are closed, importing the exact archive bytes in a clean-slate consumer context will reproduce calibration, canonical state, topology, final geometry, settings and painted pixels; repeating in a second clean-slate context will do so again.

## Minimum trial

1. Save archive A; bind archive byte digest and producer subject SHA.
2. Close producer page and BrowserContext.
3. Create a clean-slate BrowserContext without copied storage or page objects.
4. Load the same subject and import only A plus declared immutable inputs.
5. Compare calibration, canonical state, topology, final geometry, settings and pixels.
6. Repeat in a second clean-slate context.
7. Negative controls:
   - legacy archive missing calibration: explicit degraded compatibility only;
   - wrong subject identity: reject before any mutation.

## Candidate artifact and historical replay

Existing `VISUAL-STATE-ROUNDTRIP-001` was extended instead of creating a duplicate regression. A deterministic evidence classifier was replayed against nine fixtures; 9/9 passed. This is classifier evidence only and is not a production browser run.

## Boundary and routing

- No PR #303 production files or Mother branches were modified.
- No user acceptance, production acceptance or fresh-context gate result is claimed.
- Mother routing: `POSTED` to PR #303 comment https://github.com/haihao0307/guilin-dem-pipeline/pull/303#issuecomment-6239864720.
- Lifecycle: `POSTED=true; ACKNOWLEDGED=false; IMPLEMENTED=false; GATE-RUN=false; ADOPTED=false; USER-ACCEPTED=false`.
