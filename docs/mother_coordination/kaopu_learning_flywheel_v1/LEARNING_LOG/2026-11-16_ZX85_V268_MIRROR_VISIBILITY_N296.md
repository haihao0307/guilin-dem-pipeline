# KAOPU Learning Flywheel N296 — ZX85 v268 mirror visibility gate

- observedAt: `2026-11-16T03:43:41+08:00`
- candidateId: `PHYSICAL-SYMMETRY-REUSE-001-N290-DEPENDENCY-CLOSURE`
- lifecycle: `POSTED / GATE-RUN`
- production Mother changed: `false`
- main / R2 / Site / asset changed: `false`

## One bounded question

v268 是否首次实现具体后视镜 pair（`symmetryPairId + object IDs + whole binding`）；若没有，新加入的制造商操作手册是否提供了可执行的功能验收约束，同时不授权凭空补全镜面形体和安装位置？

## Exact subject

- Library version: `268`
- modified: `2026-11-16T03:31:27+08:00`
- bytes: `336337928`
- SHA-256: `84ce10ebc6e25c6c724a2d795f999cf35969bd07cd9667ec35b8c7b806c40d82`
- archive entries: `4878`
- integrity: `4877/4877 manifest-covered; 0 missing; 0 unmanifested; 0 mismatch`

## Existing gate replay

The generic mirror test still exits 0 and remains byte-identical to v81, but it still reports `realPartsMirrored=0`.

Search of the exact package found:

- `symmetryPairId`: 0
- concrete rear-view mirror object IDs: 0
- whole binding for a mirror pair: absent

Therefore version/file growth is not concrete mirror progress.

## New manufacturer source fact

The package now retains Hitachi Operator Manual ENMDED-1-2 (March 2014), scoped to ZX85USB-5A serial 100001 and up:

- PDF SHA-256: `7444d0e9a7abf912a54b73277e647d0cabe145ab5e9bc361dbb1237b8ae1fcda`
- printed page 1-115: mirrors must be adjusted so a person within 1 m of the machine—or an object 1.5 m high and 0.3 m diameter—is recognizable from the operator seat; visibility-affecting modifications require the visual field to be checked again.
- printed page 12-3: ZX85USB-5A overall width is 2260 mm **excluding back mirrors**.

This adds a functional V&V target, not mirror geometry. The manual gives no mirror surface size, mount coordinates/axis, complete width including mirrors, or proof that both mirror assemblies are identical.

## Candidate verifier delta

For the first concrete mirror candidate:

1. freeze a calibrated operator-eye anchor and machine envelope;
2. sample the manual's 1 m witness zone with a 1.5 m × 0.3 m target;
3. trace visibility through declared reflective surfaces with self-occlusion;
4. bind results to concrete mirror object IDs and whole entrypoint;
5. invalidate and rerun the receipt after any visibility-affecting change.

Current trial state: `NOT_RUN_NO_CONCRETE_PAIR`.

## Decision

`HOLD_NO_CONCRETE_MIRROR_PAIR_ADD_SOURCE_BACKED_VISIBILITY_GATE_CANDIDATE`

No production Mother, main, R2, Site or asset was modified.

## Routing receipt

- target: `#91`
- commentId: `6900215394`
- state: `POSTED`
- acknowledged: `false`
