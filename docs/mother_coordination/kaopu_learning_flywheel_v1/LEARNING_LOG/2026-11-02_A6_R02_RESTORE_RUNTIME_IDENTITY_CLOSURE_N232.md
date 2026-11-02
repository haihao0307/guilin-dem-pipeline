# KAOPU Learning Flywheel N232 — A6 R02 restore runtime identity closure

Date: 2026-11-02 (Asia/Shanghai)  
Status: **Candidate validation / exact-subject GATE-RUN / not adopted**

## One bounded question

Does `A6_WHOLE_CPU_INSPECTION_R02.zip` fail closed on any executable runtime byte change before `RESTORE_DISPLAY.mjs` declares PASS, rather than binding only cached data and expected frame hashes?

## Required baseline read

Current `main` was re-read before the probe:

- root `AGENTS.md`: `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference-replication gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 still ended at N231 comment `6568630822`; there was no later A6 acknowledgement. #63 had no newer applicable production feedback. Existing `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` was selected; no duplicate case was created.

## Exact subject

- Library identity: `libfile_430c3c55f5248191b61df60c6d64e150`
- version: `1`
- created: `2026-11-02T10:48:41.917686Z`
- modified: `2026-11-02T11:15:38.373233Z`
- ZIP SHA-256: `3eade028f95b9fec427ba55da7243ec101afa64b032c132a83a1560f01f3afa1`
- bytes: `28,694,906`
- archive entries: `561`
- manifest entries: `560`
- claimed private Site commit: `a3027b41cadad23e01e4ff50c3e8dacaa884b782`

The package is not screenshot-only. It contains the CPU runtime, WASM, cache bytes, exact-wheel layer, 375 shader programs, site files, failure evidence, and two expected-frame hashes. Its README also preserves important limits: this is a fixed display/runtime checkpoint, not full train, full source regeneration, hardware GPU, or user acceptance.

## Positive control

Independent manifest verification: **560/560 entries, 0 mismatch**.

Fresh extraction command:

```text
node RESTORE_DISPLAY.mjs
```

Result: `PASS_INDEPENDENT_HYBRID_DISPLAY_RESTORE`.

- 2/2 actual 320×180 CPU frames reproduced byte-identically
- Time 0 hash: `cd0ae8035b42a90a20888e280ad3f5cad074a9b8eeaa911a9e4f62f797cb32f0`
- Time 0.53 hash: `af740a9e2ad6c71d654193dd2c44deed83c1efb735a4e397cbf06c20a6a36ab6`
- exact wheel replacements: 596
- source draws: 1,097
- display entries: 820
- Time authority: `a6/current-native-common-Time-world-frame/1`
- `additionalStaticComposition=false`
- `wholeGeometryAccepted=false`

This is real positive evidence. It is not rejected.

## Exact negative control

Only one verifier copy was changed. The archive and production package were not modified.

Mutation:

```text
site/cpu-whole/cache-runtime.mjs
append one no-op comment
```

Identity change:

- expected SHA-256: `e12248b47a0c3cb673fa8d4fcd4e15c78aeedd6a7727588db7134229cd62fb16`
- mutated SHA-256: `c5b9da360fe14014e218356893e85387360741d2418348e49dc8bf4ceb96b8cf`
- bytes: `8,417 -> 8,511`

The package manifest correctly detected exactly one mismatch at that path. But `node RESTORE_DISPLAY.mjs` still returned `PASS_INDEPENDENT_HYBRID_DISPLAY_RESTORE`, and both frame hashes remained unchanged.

The reason is specific: the restore entry verifies canonical JSON, packet JSON, cache metadata, wheel bindings, decompressed jets, and expected output hashes. It does not consume `MANIFEST.json` before importing the executable JS/WASM closure.

## Decision

`HOLD_A6_R02_RESTORE_RUNTIME_RESOURCE_IDENTITY_NOT_FAIL_CLOSED`

The display repair and deterministic frame replay remain valid for the exact untouched bytes. The narrower claim “fixed runtime/hash binding” is not yet executable fail-closed evidence for all imported runtime resources.

## Candidate fix and falsifiable trial

Minimal fix:

1. validate all 560 manifest entries before any packaged JS module or WASM executes;
2. use a separate preflight wrapper, or replace static runtime imports with dynamic imports after full validation;
3. stop before render and do not write a PASS receipt if any imported JS/WASM byte differs.

A top-level manifest check placed after static ESM imports is too late because static dependencies execute first.

Pass condition: untouched archive validates and both frame hashes reproduce.  
Fail condition: any one-byte imported JS/WASM mutation causes pre-render rejection.

## Claim boundary

Verified:

- exact archive integrity against its manifest;
- fresh deterministic two-frame CPU replay;
- bounded display/runtime checkpoint with honest limitations.

Not verified:

- pre-execution identity closure of all imported JS/WASM;
- current/default authority promotion;
- whole geometry/material acceptance;
- full source regeneration or all historical tests;
- hardware GPU, browser, mobile, production, visual acceptance, or user acceptance.

## Regression and lifecycle

No new regression case. `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` receives this exact-subject negative control and the pre-import manifest rule.

- POSTED: false (pending #91 routing)
- ACKNOWLEDGED: false
- IMPLEMENTED: verifier-only mutation/check; production fix false
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

No main, production Mother, private package, current authority, R2 OS, global gate, or schedule was modified.
