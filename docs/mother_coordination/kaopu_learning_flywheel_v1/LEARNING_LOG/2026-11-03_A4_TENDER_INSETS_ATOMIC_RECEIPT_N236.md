# N236 — A4 rear-inset source receipt atomicity

## Decision

`HOLD_A4_TENDER_INSETS_SOURCE_RECEIPT_ATOMICITY_FAIL_OPEN`

本轮只问一个 bounded question：`new-source.py` 的冻结输入校验是否与 PASS receipt 发布构成原子提交，能否覆盖“最后一次哈希之后、receipt 落盘之前”的并发改写？

答案是否定的。包内冻结门能说明它曾拒绝过一次计算期间改写，但当前脚本仍存在可执行的 TOCTOU 窗口。

## Subject and pristine facts

- Subject: `A4_ORIGINAL_TENDER_REAR_INSETS_INSTALLED_R01.zip`
- Library identity: `libfile_9184da0dfb408191905357ecc8b6ee05`
- SHA-256: `3490556a2147b199675b9b8a96cc5fff6045c077595139913fa0e9caae271ae8`
- Manifest: 339/339 PASS
- `native.test.mjs`: 648 planned / 632 valid / 16 finite rejects; local D1/C0 PASS
- `repeat.test.mjs`: 54 checks, max delta 0
- Parent binding exists through `priorCheckpoint`: `libfile_219e62c5563c819199985fd5368e72bd`, SHA `6209e369776667f7f784e60e9003151514cbc3ce1b816d47fa73770e5a1899ef`

The package preserves `SOURCE_FIRST_FREEZE_GUARD_FAILURE.json` and `SOURCE_REPLAY_RECEIPT.json`: an earlier source query was rejected after a module change, then the exact frozen module was restored and the same 324-coordinate plan replayed.

## Independent negative replay

The archive omits `current/qa/reference_observe.py` and its source asset closure, so the original production source query is not independently executable from this archive. The replay therefore kept the packaged `new-source.py` unchanged and supplied only a deterministic verifier adapter in an isolated copy; this tests receipt ordering, not source-shape truth.

The packaged order is:

1. verify frozen module hashes;
2. perform 324-row accounting;
3. verify frozen module hashes again;
4. call `TeacherObservation.assert_unchanged()`;
5. write canonical `NEW_SOURCE_QA.json` PASS.

The verifier paused at step 4, after the second module-hash loop, and appended one comment to `panel-mother.mjs` before step 5.

- Frozen module SHA: `d3a82dbc6e7049de1e22ffd85d0fe6b27c58fb05a2e3ad46bc6d2ab5548a8841`
- Mutated module SHA: `b48ea8d9f1d03eae6f1b91ca8fa8e007d3441821b65e326d1352911b1062f0eb`
- Process exit: 0
- Canonical PASS written: yes
- Written receipt SHA: `6adfc7fdac814d7c00a0e49db6e9843911f164f6f381bdb184ad52f57e65139c`

Exact byte restore to the frozen SHA followed by the same plan passed 324/324 with zero unknowns in the verifier-adapter scope.

## Root cause

Validation and publication are separate operations. The final module check occurs before later verifier work and before receipt write; there is no immutable snapshot, lock, staged receipt bound to a final hash set, or atomic compare-and-commit. Therefore “double hash” is necessary but insufficient for authoritative PASS.

## Candidate delta

New deduplicated regression: `CANDIDATE_ATOMIC_EVIDENCE_COMMIT_001`.

Candidate verifier rule:

- validate from an immutable input snapshot, or stage the receipt and atomically compare-and-commit it against the full frozen input set;
- place the last complete input check inside the commit critical section;
- on any mismatch, exit nonzero and leave no authoritative PASS at the canonical receipt path;
- require a negative test that mutates a frozen byte after validation but before publication.

Task Anchor fields: `frozenInputSnapshotId`, `receiptCommitProtocol`, `concurrentWriteNegativeTest`.

Delivery Receipt fields: `preRunInputHashes`, `preCommitInputHashes`, `stagedReceiptSHA256`, `atomicCommitStatus`, `concurrentWriteRejected`.

## Boundaries and lifecycle

This does not reject the rear-inset geometry, native continuity, pristine GLES render, or archived source metrics. It does not establish that the archived first failure was false. It says only that the current executable gate cannot yet authorize a PASS across every concurrent-write timing window.

Lifecycle: `POSTED / Candidate IMPLEMENTED / GATE-RUN`; `ACKNOWLEDGED / production IMPLEMENTED / ADOPTED / USER-ACCEPTED = false`.

POST receipt: `haihao0307/guilin-dem-pipeline#91 comment 6594948827`.
