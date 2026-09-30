# N48 — 公开父产物不是可回放父节点（2026-09-30）

## Bounded question

KaoPu Coast World R03 在一次发布成功后，是否仍能从其声明的父输入 R02 精确重建；还是只依赖一个会被后续发布删除的 `gh-pages` 可变 URL？

## 1. 现有真实失败

当前 main 精确头 [`38513d5410e374a0262bdcd80897dba9a9921c88`](https://github.com/haihao0307/guilin-dem-pipeline/commit/38513d5410e374a0262bdcd80897dba9a9921c88) 新增 R03 publisher，历史运行 [36697100665](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/36697100665) 成功。这个成功只证明第一次运行。

R03 workflow blob 为 `20da9dee95a457dc8240d72966109c47ce30d667`，其构建步骤从以下可变地址读取父版本：

`https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/gh-pages/kaopu-coast-world/r02-20260930/index.html`

同一 workflow 在发布 R03 时执行 `rm -rf kaopu-coast-world/r02-20260930`。发布后的 `gh-pages` 提交 [`d1813855…`](https://github.com/haihao0307/guilin-dem-pipeline/commit/d18138553098e40e1ddcd105376edea9d7c1a23c) 中，该 R02 路径现在返回 404。因此，相同 workflow 当前不能从自己声明的 URL 重新取得父输入。

这不否定 R03 第一次运行成功，也不证明当前 R03 页面不可用；它只证明“父输入可回放”没有闭包。

## 2. 外部方法与证据

- GitHub 官方安全指南说明，完整 commit SHA 才是不可变引用；分支与可移动标签不是。[Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- SLSA Build Provenance 建议把解析后的依赖记录为 server-verified URI 和 digest，而不是只留一个可变别名。[SLSA Build Provenance](https://slsa.dev/spec/v1.2-rc2/build-provenance)
- Reproducible Builds 要求把重建所需输入/环境记录下来，并将 buildinfo 与产物一起发布。[Recording the build environment](https://reproducible-builds.org/docs/recording/)

适用于 KAOPU 的最小转译不是引入完整供应链平台，而是在 Task Anchor / Delivery Receipt 增加：

- `parentResolvedRevision`
- `parentContentDigest`
- `parentReadbackAtResolvedRevision`
- 清理后 verifier 再读一次不可变父路径并核对 digest

## 3. 与现有 KAOPU 制度比较

R2 OS 已禁止 rejected lineage 继续成为父节点，N40 已区分一次成功与工具链可重跑，`PARTIAL-TRANSFER-NOT-PARENT-001` 已拦截残缺分片成为父节点，`TESTED-SUBJECT-NOT-MUTABLE-HEAD-001` 已绑定被测源码身份。

本失败仍有新增：父产物在第一次运行时完整且合法，但构建只记录了可变公开别名，发布后又删除该别名；现有三条 Candidate 都没有要求“生成型父输入在清理后仍可按不可变修订回读”。

## 4. 可反驳假设

如果要求每个生成型父产物绑定不可变 revision + content digest，并在清理公开别名后执行一次独立 readback，那么：

1. 已成功的 R03 历史运行仍保持 `HISTORICAL_RUN_VERIFIED_ONLY`；
2. 当前可变且已删除的 R02 引用会被判为 `HOLD_PARENT_REFERENCE_MUTABLE` 或 `HOLD_PARENT_ARTIFACT_NOT_REPLAYABLE`；
3. 固定到 R02 发布提交并匹配 blob digest 的对照可以通过；
4. 普通网页归档清理不会被误判为失败，只要它不是下一版的唯一父输入。

## 5. 最小历史回放

真实只读回放：

- 当前 `gh-pages`：`kaopu-coast-world/r02-20260930/index.html` = 404；
- R02 发布提交 [`42ce957c…`](https://github.com/haihao0307/guilin-dem-pipeline/commit/42ce957cb5b24ca2ae1b0ffaf91d40b8760fd7b4)：同路径仍存在；
- immutable parent blob = `b214b91798dc71e96215d947198c5188bbb24e85`；
- R03 输出提交仍存在，说明第一次发布完成。

可执行门禁对真实案例和 9 个正反例回放，结果 `10/10`。它能区分：

- 可变分支引用；
- immutable revision 缺 digest；
- immutable revision 已丢失；
- digest mismatch；
- 公开别名删除但不可变父节点仍可读；
- 历史失败不能被父输入闭包反向升级。

## 6. 适用边界

仅适用于“下一版需要读取上一版生成产物”的版本链，当前先限 Coast Mother 单点试验。

不适用于：

- 仅供用户浏览、从不作为构建输入的旧页面；
- 已由源代码和固定输入可完全重建、无需上一版产物的构建；
- 用户要求清理公开旧版 URL 本身；
- 视觉质量、物理正确性或用户接受判断。

## 7. 是否采用

结论：`Candidate / local-only / not globally adopted`。

不修改 main、`gh-pages`、生产 Mother、R2 OS 或现有门禁。建议 Coast Mother 下一次相关任务把 R03 parent URL 改为精确提交 URL，并记录 blob/SHA-256；完成清理后由独立 verifier 回读。真实单 Mother 试验和回执完成前不得全局强制。

状态：

- `POSTED=true`（Ocean / Coast 总账 #63，comment `5908816995`）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED(candidate)=true`
- `GATE-RUN=true`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

KPI：没有可靠观测，全部为 `unknown`。第一梯队专家 AI 未调用。
