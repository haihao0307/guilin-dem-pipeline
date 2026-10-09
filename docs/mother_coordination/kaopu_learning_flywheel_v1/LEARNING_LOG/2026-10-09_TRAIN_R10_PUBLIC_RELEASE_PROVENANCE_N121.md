# N121 — Train R10 公网发布按精确字节与完整矩阵收口

Date: 2026-10-09 08:00 +08:00  
Status: **new validation result / no-novelty / existing N83 and N71 regressions updated**  
Scope: Train R10 public release verification only；不修改 Train 生产分支、`main`、`gh-pages`、R2 或门槛

## Bounded question

当前公开 R10 是否已取得与精确发布字节绑定的终态通过，且没有用后续绿色掩盖前序失败？

## 现有真实失败

基线读取：`main@5bdd2d6aa4989ac6acedb99411c207c267b8937b`；根 `AGENTS.md`、R2、reference gate、freshness gate 均未变化。#91 最新真实反馈仍为 N75 的查询范围纠正（comment `5979603278`）；#63 最新真实反馈仍为 N49（comment `5910449798`）。

Train R10 的公开验证不是一次即绿：

- [run 37859882917](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37859882917) / `72014758` 的 deterministic public-asset gate 因 `kaopu-minigame-workbench/index.html` 返回 200 但对象哈希不符而失败；浏览器矩阵全部 skipped。
- 失败 artifact `11586036453` / `sha256:26fb19e6...46ad9` 保留这次 `PUBLIC_ASSET_HOME_HASH_MISMATCH`，不能被后续成功删除。
- 原因不是 R10 资产本身陈旧，而是共享 homepage 已由并行发布推进到 blob `d3303611...`；旧 manifest 仍期待 R09-era blob `c40adc50...`。

## 外部方法 / 证据

本轮不引入新外部制度；沿用既有 N83 的 shared-target compare-and-swap / exact-subject 原则与 N71 的 immutable failure lineage。新增的是可复核的 GitHub Actions、artifact 与 Git object 事实：

- `72014758..e8a8027f` 只修改 `game/tests/public-manifest.json`，把共享 homepage 的期待对象更新为 `d3303611...` 并标为 `protected-concurrent-release-baseline`；生产运行时未改。
- [run 37860468924](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37860468924) / `e8a8027f` 的 17/17 required jobs 全部 success。
- public hash artifact `11585857096` / `sha256:9290de54...6796` 在 `2026-10-08T23:38:21.690Z` 检查 `gh-pages@2bba5007`：157/157 匹配，其中 R10 release 140、protected classic 16、并行 homepage 1。
- 独立 Git object 回放得到 release 140/140 与 candidate `7df5da15`、published tree、artifact 三方一致；protected classic 16/16 与 published tree、artifact 一致。
- `gh-pages@2bba5007` 的直接父节点 `ab911ca4` 已含 homepage blob `d3303611...`，发布后仍为同一 blob；证明 R10 发布保留了并行成果，而不是把共享入口回滚为旧基线。

## 与 KAOPU 当前制度比较

- N83 `SHARED-PUBLICATION-TARGET-CAS-001` 已要求共享目标推进后，替代 candidate 必须覆盖并行 delta 并重跑适用测试。
- N71 `SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001` 已要求终态 success 保留每次失败、修复 delta 与重测覆盖。
- 本轮没有形成新失败机制或新门禁语义，因此判为 `NO_NOVELTY_EXISTING_N83_AND_N71_APPLY`；只更新两个既有 case 的证据，不创建重复 case。

## 可反驳假设

若公开验证同时绑定 candidate、release commit、逐文件对象回执、完整 required-job ledger，并保留先前失败，则：

1. 157/157 公网对象匹配且 17/17 required jobs success 时，结论应为 `PUBLIC_RELEASE_VERIFIED_SCOPED`；
2. 任一 required job 缺失应为 `HOLD_MATRIX_JOB_LEDGER_INCOMPLETE`；
3. 任一文件对象不匹配应为 `HOLD_PUBLIC_OBJECT_MISMATCH`；
4. 若删除 run `37859882917` 或其失败签名，应为 `HOLD_FAILURE_LINEAGE_INCOMPLETE`；
5. 此通过不能推出真机、独立视觉审查或用户验收。

## 最小历史回放

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/train_r10_public_release_provenance_n121.mjs`

结果 `12/12`：真实历史为 `PUBLIC_RELEASE_VERIFIED_SCOPED`；三个负控分别拒绝缺 job、对象不匹配、删除失败谱系。结果保存于 `PROBES/train_r10_public_release_provenance_result_n121.json`。

## 适用边界 / 是否采用

- 决定：`PUBLIC_RELEASE_VERIFIED_SCOPED`，解除 N120 针对公开 R10 的技术 HOLD。
- Causal state：`PUBLIC_BYTES_AND_REQUIRED_BROWSER_MATRIX_VERIFIED_WITH_PRIOR_FAILURE_LINEAGE_RETAINED`。
- 仅证明：`candidate@7df5da15` 发布为 `gh-pages@2bba5007` 的 140 个 release 对象、17 个受保护对象，以及 `e8a8027f` workflow 定义的 Chromium/WebKit 矩阵。
- 不证明：独立人工视觉审查、物理设备行为、跨未列明浏览器/设备、用户接受；`USER-ACCEPTED=false`。
- 不路由新制度：Train 已自行 IMPLEMENT manifest 修复与完整 gate；本轮只是 GATE-RUN 验证，未形成需要修改根 AGENTS/R2 的新增规则。
- 生命周期：`POSTED=false`、`ACKNOWLEDGED=false`、`IMPLEMENTED=true`、`GATE-RUN=true`、`ADOPTED=false`、`USER-ACCEPTED=false`。
- KPI：首次候选通过率、用户纠错次数、同类复发率、rejected lineage、stale delivery、accepted delta 内部迭代、合法 candidate 时间均 `unknown`；不从单次 run 造 KPI。
- 第一梯队外部 AI：未调用。
