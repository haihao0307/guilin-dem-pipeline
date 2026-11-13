# N284 — first cross-project Method Anchor trial and exemplar revision gate

Date: 2026-11-13  
Status: **existing regression refinement / local Candidate / not adopted**  
Target: first observed Train trial after the ZX85USB method approval

## One bounded question

Does the updated ZX85USB checkpoint plus the new “88号函数火车 · 总装候选” prove that the N283 `METHOD_ANCHOR` has been implemented on the first real target?

## Fresh baseline and feedback

Current main remains `8aec1b1dca9619c0b59fc8fa480f65f226be7145`. Required baselines are unchanged:

- root AGENTS `251b664646a489e9292748f1d41998ee62a338f5`
- R2 `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 contains N283 routing at issue comment `6851876886` and no later ACK. #63 is unchanged. No Mother receipt establishes `ACKNOWLEDGED`, `ADOPTED` or `USER-ACCEPTED`.

The user repeated that Automobile, Train, Mechanical Door Lock, Air Conditioner and other mechanical assets must actually use the newly approved reliable method and deliver real results. This makes the Train artifact a real target observation, not a hypothetical method design.

## New source facts

### Mutable source exemplar

The same Library identity and filename used in N283 changed again:

- filename: `zx85usb-5a-functional-whole-checkpoint-20261113-r01.zip`
- Library ID: `libfile_841f9900a5ec81918f2df377bf8e292f`
- current version: `9`
- current size: **2,882,934 bytes**
- current modified time: 2026-11-13 23:31 Asia/Shanghai
- N283 audited size: **217,885 bytes**
- N283 audited SHA-256: `b7eae72e30e6b761e41dd1f9467d7ebc5b07cc713565e58e43e9bac87103a2e5`

The current revision is over 13 times larger while preserving the same filename and Library identity. Its current SHA-256 and executable dependency replay are `UNKNOWN_NOT_REAUDITED`. Therefore the N283 digest cannot be silently treated as the digest of version 9.

### First target candidate

Library artifact:

- filename: `88号函数火车 · 总装候选.txt`
- Library ID: `libfile_9aff9f5528f08191a47e5ba0a6e801ed`
- version: `138`
- size: 5,601 bytes
- modified: 2026-11-13 23:03 Asia/Shanghai
- reported current revision: R300

Its own current receipt says:

- scope is “六轮箍与三轴验证例（非整车）”;
- WebGPU exists but no usable adapter was obtained;
- GPU image is not accepted and there is no verified compatible 3D fallback;
- complete heavy train loading was stopped rather than replaced by a static image;
- installation axes, fit clearances, manufacturing dimensions, mechanical closure and real dynamics remain unaccepted or unknown;
- some source-fragment animation and inspection offsets are explicitly non-physical.

These are useful honest limitations. They prevent a stale/static fallback claim, but do not prove method transfer.

## Current Best View comparison

N283 already requires a target Task Anchor to bind:

- `methodAnchorId`;
- exact accepted/rejected target baseline;
- one bounded subsystem;
- target reference and dimensions;
- portable invariant used;
- object-specific data excluded;
- dependency BOM/digests;
- before/after gate, replay result and rollback point.

The R300 Train receipt binds none of those fields. It also provides no independent verifier receipt. The source exemplar itself has changed revision without a new digest or re-audit receipt.

Therefore the first real target does not pass N283's own falsifiable Candidate.

## New failure mechanism

A `METHOD_ANCHOR` can become stale even when its filename and Library identity do not change. If a mutable exemplar is revised under the same name, a target can unknowingly inherit a different dependency graph or asset body while still claiming the old approved method.

This is not a new regression case. It is fresh evidence refining `MOTHER-NO-METHOD-INVENTION-001-N283-METHOD-ANCHOR`.

## Falsifiable Candidate increment

Add a local `sourceArtifactRevisionGate` to the existing Candidate:

1. bind `libraryFileId + versionId + sha256 + sizeBytes + modifiedAt`;
2. fail closed when any observed revision field differs;
3. require the new bytes to pass dependency, manifest and representative whole replay;
4. record `revisionDisposition` and `reauditReceipt`;
5. forbid target implementation claims until both the exemplar revision and target replay are pinned.

Historical replay:

- expected N283 subject: 217,885 bytes + audited digest;
- observed N284 subject: version 9 + 2,882,934 bytes;
- result: **FAIL / changed revision not pinned**.

Target replay:

- expected: Train target fields and independent gate receipt;
- observed: prose/page receipt with explicit non-whole, non-GPU-accepted scope and no anchor binding;
- result: **FAIL / target trial not bound**.

## Decision

`HOLD_TARGET_TRIAL_UNBOUND_AND_EXEMPLAR_REVISION_UNAUDITED`

This does not reject the user's method approval and does not reject the Train team’s honest non-fallback behavior. It blocks only these unsupported claims:

- version 9 is the same audited exemplar as N283;
- R300 has implemented the portable method;
- the Train is a complete or accepted target output.

## Teacher disposition

No new teacher entered audition. The CMU/SEI production-plan teacher remains `TEACHER_CANDIDATE` in lifecycle `AUDITION`; this run produced a real counterexample supporting its attached production-plan and variation/dependency discipline, but did not complete a new external reproduction.

## Lifecycle and routing

- existing regression Candidate: `IMPLEMENTED=true` on this learning branch;
- revision and target historical replay: `GATE-RUN=true`;
- coordinator routing: `POSTED=true` at [#91 issuecomment-6857763983](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6857763983);
- Mother response: `ACKNOWLEDGED=false`;
- production implementation: `IMPLEMENTED=false`;
- adoption: `ADOPTED=false`;
- user acceptance: `USER-ACCEPTED=false`;
- KPI effect: `UNKNOWN`.

No main, R2, production Mother, Site, public route or Train/Vehicle/Door-Lock/Air-Conditioner asset was modified.
