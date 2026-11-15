# KAOPU Learning Flywheel N294 — ZX85 v168 final seal / scoped mirror replay

- observedAt: `2026-11-15T19:44:04+08:00`
- candidateId: `PHYSICAL-SYMMETRY-REUSE-001-N290-DEPENDENCY-CLOSURE`
- lifecycle: `POSTED / GATE-RUN`
- production Mother changed: `false`
- main / R2 / Site / asset changed: `false`

## One bounded question

v168 是否已经通过“所有写入完成后再封印”并物化 exact mirror-gate dependency，关闭 N293 的 post-seal mutation 与 clean replay 阻塞；同时是否避免把一个入口的 PASS 误报为整个 external runtime closure 已闭合？

## Exact subject

- Library version: `168`
- modified: `2026-11-15T19:39:15+08:00`
- bytes: `153676069`
- SHA-256: `ffcb305c9d23c8e778c98cc32db76edf2d8ac7d2280f2975b8743add752d174b`
- archive entries: `3589`
- files excluding `CHECKSUMS.json`: `3588`

## Fresh validation

### Final seal: PASS for exact v168

- actual files excluding manifest: `3588`
- manifest entries: `3588`
- missing targets: `0`
- unmanifested files: `0`
- digest mismatches: `0`

`build-zx5a-checkpoint.py` now performs the final integrity sequence after content mutations: rebuild manifest, write `.next.zip`, reopen and verify every digest, then atomic `os.replace`. `RECOVERY_1100_INTEGRITY.json` explicitly records the prior 11 stale cabin entries and says the manifest was rebuilt without changing those source bytes.

### Generic mirror gate: PASS for this entrypoint

Clean extraction command:

`node zx5a-cab-source-r25/cabin-complete/parameter-mirror-check.mjs`

Result: exit `0`; 3 axes; exact roundtrip; oriented volume preserved; max kinematic error `1.7763568394002505e-15`; `evidenceRequired=true`.

The mirror helper/check/stored receipt remain byte-identical to v81. The difference is dependency materialization: the exact hidden-path `three.module.js` is now present and manifest-covered.

### Broader closure: still HOLD

`RESTORE_RUNTIME_CLOSURE.json` still declares 18 external files. Exact v168 contains only 1/18; 17 remain absent. The ledger still lacks per-file external digests, immutable source identity, license/provenance, materialization commands and receipts.

The clean replay therefore proves only this named generic mirror entrypoint. It does not prove the entire external runtime closure.

### Concrete user correction: still HOLD

- `realPartsMirrored=0`
- `symmetryPairId` references: `0`
- concrete rear-view mirror pair: absent
- whole binding for a mirrored pair: absent

## Candidate delta

The same Candidate is refined in place. New executable distinction:

1. exact final-seal integrity may PASS;
2. a named entrypoint dependency closure may PASS;
3. broader external-runtime closure remains HOLD until its own complete ledger and replays pass;
4. generic mirror math cannot satisfy the user's concrete mirror-pair implementation requirement.

## Decision

`PARTIAL_PASS_FINAL_SEAL_AND_MIRROR_REPLAY_HOLD_EXTERNAL_RUNTIME_AND_CONCRETE_BINDING`

Rollback remains deletion of this Candidate refinement branch only. No production Mother, main, R2, Site or asset was modified.

## Routing receipt

- target: `#91`
- commentId: `6893825323`
- state: `POSTED`
- acknowledged: `false`
