# N252 — Yarn shared-frame rerun closure

## Bounded question

Can a clean clone of current KaoPu Engine reproduce and adjudicate the existing shared-frame yarn optimization without relying on the original Windows workstation?

## Baseline and exact subject

- Coordinator current `main`: `6a003f0fafb9ae27d71e95963728461288c14edb`.
- R2 OS, reference-replication gate, freshness gate and root AGENTS blobs are unchanged from N251.
- Current engine subject: `haihao0307/KaoPu-Engine@603682e1c1aa86323154038ccfc7215833afcda9`.
- Current yarn source: `research/display-quality/SourceKnit.glsl`, blob `e748e8eac087eaefd5df029063a0c7aaf92b8884`.
- Existing shared-frame implementation: `research/display-quality/YarnSharedFrameStudy.mjs`, blob `a8df7d678854a190c42125fcff15220ff3ab5acc`.
- Existing oracle source: `qa/shared-yarn-frame-oracle-20261101.cjs`, blob `0571213b4fa759be65eb40961bee398653382d5c`.
- Existing smoke source: `qa/shared-frame-smoke-20261101.cjs`, blob `17bdaf3bb3c5ecc9a4a257cbce0105396424f2f0`.

## Why the algorithm itself is not new

The current source already implements the exact reuse boundary suggested by the 2026-11-04 audit: within one solver iteration, the central yarn point and the two angular finite-difference samples reuse the same `frame(t,lane)`, while `t ± epsilon` longitudinal samples remain separate. The source also retains the original seeds, iteration budget, residual and acceptance test.

Therefore, “share the identical frame across the central and angular samples” is already Current Best View and is not a new optimization proposal.

## New evidence gap

The current repository cannot independently support a rerun decision for that candidate:

1. The current tree contains the implementation and QA source, but not the named outputs `SHARED-YARN-ORACLE.json` or `SHARED-FRAME-SMOKE.json`.
2. Both QA scripts resolve Playwright through an absolute `C:/Users/Administrator/.cache/...` path and launch `C:/Program Files/Google/Chrome/Application/chrome.exe`.
3. The repository tree contains no `package.json`, dependency lock, container/devcontainer or equivalent dependency-closure receipt.
4. The scripts require `http://127.0.0.1:8921`, but the exact server bootstrap command and server identity are not bound in the QA receipt.
5. Consequently, the source proves `CANDIDATE_IMPLEMENTED`; it does not prove `GATE-RUN` for the current engine subject, nor portable rerun reproducibility.

This is a subject-level instance of the existing `RUN-SUCCESS-NOT-RERUN-REPRODUCIBILITY-001` regression family. No duplicate regression is created.

## Falsifiable hypothesis

A rerun-closure gate that separately checks implementation, QA source, committed evidence output, portable runtime resolution, dependency lock, server bootstrap and tested-subject binding will hold the current shared-frame yarn candidate, while passing a control receipt that seals all seven items.

## Minimal static replay

CPU-only deterministic replay over six positive and negative fixtures:

- result: `6/6 PASS`;
- fixture SHA-256: `2846ab6de6b28228cc33c8c4fe62cdc3d81559cd7d7837b96b6c72cc003a39c6`;
- gate SHA-256: `9ec16ff7c63ccfdd9ec90c254b5b08206766086ea021cb0b1256a206b5eda74c`;
- result SHA-256: `62f4fd5a73ac7931593d472ead910dbfa8865f1f5906692bbae055c386e59b82`.

Current-subject holds:

- `HOLD_EVIDENCE_OUTPUT_MISSING`
- `HOLD_NONPORTABLE_RUNTIME_PATH`
- `HOLD_DEPENDENCY_CLOSURE_MISSING`
- `HOLD_SERVER_BOOTSTRAP_UNBOUND`

## Minimal next experiment

Do not invent another yarn algorithm. On one exact engine subject:

1. replace absolute Playwright and Chrome paths with receipt-bound runtime discovery;
2. add a locked dependency closure;
3. bind the server bootstrap command and served source SHA;
4. run the existing 1,024-ray oracle plus four-view smoke;
5. commit the machine-readable output with renderer, GPU/device, browser build, source hashes and pass/fail;
6. only then run the current full-detail WebGPU A/B and moving-camera test.

## Boundary and lifecycle

- This does not claim the shared-frame candidate is fast, visually accepted or production-safe.
- The 2026-11-04 audit remains authoritative that previous fixed-view timing did not establish a reliable net gain.
- No R2, engine, clothing repository, production Mother, artifact or threshold was modified.
- Candidate replay: `IMPLEMENTED / GATE-RUN` for this static closure gate only.
- Mother routing remains `NOT_QUERIED / UNKNOWN` until a real #91 owner receipt exists.
- KPI values remain `unknown`; no synthetic improvement percentage is reported.
