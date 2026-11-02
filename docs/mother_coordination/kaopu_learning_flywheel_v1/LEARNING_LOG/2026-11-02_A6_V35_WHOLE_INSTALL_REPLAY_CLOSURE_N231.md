# KAOPU Learning Flywheel N231 — A6 v35 isolated-install replay closure

Date: 2026-11-02 (Asia/Shanghai)  
Status: **Candidate validation / exact-subject GATE-RUN / not adopted**

## One bounded question

Can the new `whole-v34-install-r01` controller in checkpoint v35 independently restore and rerun the exact isolated v34 whole-locomotive installation stage from the complete archive, after an exact archive-SHA final-GO is bound?

## Required baseline read

Current main blobs were re-read before this replay:

- root `AGENTS.md`: `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference-replication gate: `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: `4754a90a94e4a9e7806357b6eb292e5c713e9021`

Latest real #91 feedback was N230 comment `6565727325`; no later A6 acknowledgement was present. #63 had no newer relevant production feedback.

## Exact subject

- Library identity: `libfile_2cabe4dab46c8191b45f04e641c12ca2`
- version: `35`
- modified: `2026-11-02T03:30:16.171858Z`
- ZIP SHA-256: `30e0a239f2d7cbb96d2d15ed4ea6c5cd007720d6cb5dee036282fe98da8f22c8`
- bytes: `238,516,022`
- entries: `14,034`

The v34 stage already contained real software-GL evidence: 1,096 draws, 374 programs, two user-facing images, and a finite replacement of one right long-casing footprint. It also explicitly preserved `defaultChanged=false`, `wholeTrainComplete=false`, and current authority `tender-top-r01/train.A6-tender-top-r01.KaoPu.json`.

## Fail-closed precondition

The packaged frozen recipe intentionally remained unsigned:

- `finalArchiveReady=false`
- `archiveSHA256=null`
- status: `AWAIT_FINAL_COMPLETE_ZIP_GO`

The first plan attempt failed before archive access with `Candidate is not frozen/final-GO reviewed`. This is correct fail-closed behavior, not a replay defect.

Following the package's own instruction, I created a verification-only derived recipe outside the archive, changing only:

- `finalArchiveReady=true`
- `archiveSHA256=<exact v35 SHA>`
- `pending=[]`

Derived recipe SHA-256: `9fe49927f1649451cda5f9d6effa92636e3d3e3d3f522c2dbbe70248a0fb40c1`. The checkpoint ZIP was not modified.

## Fresh bounded replay

Static preparation tests: **7/7 PASS**.

Pinned plan:

- complete archive entries: 14,034
- selected allowlist: 734 files / 102,500,141 bytes
- previously verified v34 inputs: 346
- selected shader files: 374
- full freeze restored: false

Runtime proof: `PASS_WHOLE_INSTALL_BOUNDED_PARTIAL_RUNTIME`.

- archive integrity verified before use and unchanged afterward
- restoration errors: 0
- Node outside-read negative control: PASS
- Python outside-read/unapproved-write negative control: PASS
- frame gate: 1,005 old draws, 13 views, 26 dynamic same-owner rows, maximum prior inverse difference 0
- implicit probe: 91 programs / 455 checks, archived numeric and domain results bit-identical
- installed render: 1,096 fields / 374 programs
- fresh PNG byte-identical to archive: `defff39c877be0bd72d2a727afc18a034622f3e793f2948101a5bcd3f4f1476b`
- proof SHA-256: `6230e8e0198d669a332059e7de4a88f1c91b4dbe3d8c30dbbee2f9ddb286f8e5`

Shared-CPU render took 295.43 s and total replay 311.69 s. This is Observation only, not a performance gate.

## Decision

`ACCEPT_A6_V34_ISOLATED_INSTALL_REPLAY_CLOSURE_AS_BOUNDED_VERIFIED_NOT_CURRENT_AUTHORITY_INSTALL`

This closes the fresh bounded replay question for this exact isolated stage. It does not resolve N230's different host-preparation package defect.

## Claim boundary

Verified:

- exact v35 complete archive can restore and rerun the isolated v34 installation stage after explicit SHA-bound final-GO;
- the stage executes real frozen native programs and reproduces the archived software-GL image byte-for-byte.

Not verified:

- current/default authority replacement;
- whole train completion;
- full freeze restore;
- old/removal comparison rerender;
- source measurements or long mathematical suites;
- hardware GPU, browser, phone, production, visual acceptance, or user acceptance;
- whole geometry or material acceptance.

The Library image title `A6_WHOLE_NATIVE_V34_INSTALLED.png` is therefore valid only with the explicit qualifier **installed into the isolated whole-locomotive inspection stage**. It is not evidence that current/default authority changed.

## Regression handling

No new regression was created. Existing `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` receives this exact-subject positive control:

- explicit final-GO prerequisite may remain external when declared and SHA-bound;
- the archive, restore allowlist, runtime entries, negative I/O controls, outputs, and before/after archive identity must all be checked;
- a successful bounded replay cannot be promoted beyond its declared installation stage.

## Lifecycle

- POSTED: pending #91 route at first commit
- ACKNOWLEDGED: false for this A6 v35 replay
- IMPLEMENTED: existing package controller; no production code changed
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

No main, production Mother, private package, R2 OS, global gate, current authority, or schedule was modified.
