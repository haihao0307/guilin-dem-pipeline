# KAOPU Learning Flywheel N246 — Mechanical v37 module-hash authority replay

- Run date: 2026-11-05 (Asia/Shanghai)
- Scope: one bounded institutional/technical question
- Production mutation: none
- Main/R2/hosting mutation: none

## Bounded question

Is the Mechanical v37 `site/tests/own.test.mjs` 7/8 result evidence that production modules changed, or is it a stale hash-authority comparison that can be safely superseded?

## Current production feedback

Issue #91 comment 6638923180 keeps `Mechanical-Mother-v37-offline.zip` at `HOLD_GATE_FAIL / BLOCKED_VALID / DELIVERY_NOT_COMPLETE`. It names the current 7/8 module-hash test and requires either a fix or a machine-decidable superseding authority before publication work can proceed. N245 remains only `TEACHER_CANDIDATE / POSTED`; no Mechanical acknowledgement exists.

## Exact subject

- Library: `libfile_6321c7c1c3588191a3127681b6da5f50`
- ZIP SHA-256: `d4f19a70a743e8c78b859cb5c69c26543ed3b59cc4c3a7bd20cf12199b086b81`
- Source commit declared by package: `b7281661a7f05ee8a4d9710e80f55c36a339cdfe`
- Fresh extraction package manifest: 311/311 PASS

## Observation

Fresh execution reproduces `own.test.mjs` at 7/8. The last test compares:

- `sha256(site/mother.mjs)` to `version.kernel.sha256`
- `sha256(site/render.mjs)` to `version.displayPolicy.sha256`

The latter two fields are aggregate contract hashes, not the individual file hashes. Therefore `1 != 0` does not prove that either module changed.

The package does contain exact file pins for both modules in `FILE-MANIFEST.json`. `CHECK-PACKAGE.py` passes pristine and rejects verifier-only no-op mutations of both `mother.mjs` and `render.mjs`.

However, the proposed semantic replacement is incomplete:

- `version.kernel.dependencies` declares `mother.mjs` with the correct exact hash.
- `version.displayPolicy.dependencies` does **not** declare `render.mjs`.
- A dependency-only checker rejects a mutated `mother.mjs`, but has no declaration against which to reject a mutated `render.mjs`.

## Decision

`STALE_LEGACY_ASSERTION_CONFIRMED_HOLD_SEMANTIC_ENTRYPOINT_AUTHORITY_INCOMPLETE`

This is not package corruption. The old assertion may be superseded, but only by a composite machine authority that:

1. consumes the exact package manifest before execution;
2. defines aggregate versus per-resource hash semantics and the aggregate derivation rule;
3. maps every required semantic entrypoint to its contract group;
4. proves one-byte/no-op mutation rejection for each required entrypoint.

For this subject, `render.mjs` must be declared under the display contract or explicitly mapped to another named authority. Simply deleting the old test, changing its expected value, or checking only existing dependency entries is not fail-closed.

## Existing regression route

No new regression case was created. This updates `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`: manifest integrity plus a green or superseded test does not establish executable/semantic authority when a required entrypoint is outside the consumed contract map.

## Minimal Mother trial

Mechanical Mother / publisher should answer only:

1. Is `site/render.mjs` a required current display entrypoint?
2. Which exact contract group owns it, and what reproducible rule produces `displayPolicy.sha256`?
3. Does the replacement gate consume `FILE-MANIFEST.json` and reject independent mutations of both `mother.mjs` and `render.mjs` before use?
4. After that bounded gate passes, does the existing public-web HOLD still remain? Expected: yes.

## Boundaries and lifecycle

- This does not publish, modify, or promote v37.
- It does not verify browser, hardware GPU, mobile, fixed HTTPS, visual acceptance, production readiness, or user acceptance.
- `POSTED=false` until the targeted issue comment is created.
- `ACKNOWLEDGED / production IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`.
- The public-web HOLD from comment 6638923180 remains unchanged.
