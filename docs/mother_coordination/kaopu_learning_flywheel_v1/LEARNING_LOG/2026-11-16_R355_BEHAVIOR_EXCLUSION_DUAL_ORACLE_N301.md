# KAOPU Learning Flywheel N301 — R355 behavior-exclusion dual-oracle audition

- Time: 2026-11-16T16:04:11Z
- Baseline: `main@ad7b81175df8bc9c54cf40effe1029f86696ba76`
- Status: `TEACHER_CANDIDATE`
- Teacher lifecycle: `AUDITION`
- Production / R2 / Site / asset changes: none

## One bounded question

在耦合动画系统中删除一个显示行为时，怎样同时证明目标行为确已消失、相邻功能没有被一并关闭？

## Current Best View comparison

R2、reference-replication gate 与 freshness gate已经要求规格保真、禁止 silent fallback、绑定 subject 并运行 regression；Issue #63 也出现过“A=0 时其他海面量保持”的概念性不变量。但当前检索没有找到“部分行为删除”的成对可执行门禁：

1. 目标负不变量：被禁止的行为确实不发生；
2. 非目标正活性：相邻功能仍然发生；
3. 两侧各有一个必须被拒绝的 mutant。

R355 在这个明确问题上多知道的就是这套双侧 oracle，而不是“整套技术全面超过 KAOPU”。

## Exact subject and clean replay

Library subject:

- `libfile_923877ca9c188191bd7d30695e0628e3`
- 7,426,375 bytes
- SHA-256 `d20f6358f68ed31411cf62726e662496dfd3bda649c9d9d9e42f642924c5616d`
- frozen R355 learning package; production remains R348

Fresh clean-extraction commands all exited 0:

- `node tests/verify.mjs`
- `node tests/ui-smoke.mjs`
- `node scripts/export-r355-registry.mjs`
- `python3 scripts/verify_files.py`

Observed: 2,260 meshes, 12 clips / 36 sampled states, 16 wheel nodes frozen, 1,040 non-target track meshes changed, resources 1,216/1,216 released, and 1,965 files passed integrity.

## Falsifiable replay

A separate mutation probe produced:

- baseline: `targetFrozen=true`, `nonTargetChanged=1040`
- adjacent-motion-disabled mutant: target remains frozen but `nonTargetChanged=0` → rejected
- target-drift mutant: `targetFrozen=false` → rejected

Run:

```sh
R355_PACKAGE_DIR=/absolute/path/to/Hitachi85_Functions_Animation_Learning_R355 \
  node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/n301_r355_behavior_exclusion_mutation_probe.mjs
```

## Evidence boundary

The package also records 31 travel pairs, 39,866 exact non-wheel matrix comparisons and 80 operator frames. No generator for that exact report was found in the package, so N301 does **not** treat those numbers as freshly reproduced evidence.

The audition does not establish browser/WebGL2/GPU/device behavior, physics/OEM correctness, public derivative rights or user acceptance. The Sketchfab reference asset is credited but excluded from the package; the current source page was inaccessible to the verifier, so publication-rights status remains `UNKNOWN`. The method candidate itself does not require redistribution of the asset.

The observed `1040` and test threshold `>1000` are R355-specific. A Mother must bind its own exact target IDs, adjacent expected set/range, subject and sample set; these numbers must not become a global magic constant.

## Candidate decision

`TEACHER_CANDIDATE_AUDITION_DUAL_ORACLE_PASS_WITH_BOUNDARIES`

Candidate output is an executable verifier pattern:

- negative invariant for the behavior being removed;
- positive liveness for the adjacent behavior that must survive;
- target-drift and collateral-shutdown mutants;
- explicit HOLD states for missing subject/set/sample bindings.

This remains Candidate-only. It is not `PROBATION`, `ACTIVE_TEACHER` or an OS change.

## Routing state

Target: ZX85 / animation-control Mother through #91, asking only:

1. 当前问题是否真实相关；
2. 现有体系是否已覆盖；
3. 哪些原理/代码/数据值得学；
4. 最小可反驳试验是什么。

At file creation: `POSTED=false`, `ACKNOWLEDGED=false`, `IMPLEMENTED=false`, `GATE-RUN=true`, `ADOPTED=false`, `USER-ACCEPTED=false`.

KPI effect: `UNKNOWN`.
