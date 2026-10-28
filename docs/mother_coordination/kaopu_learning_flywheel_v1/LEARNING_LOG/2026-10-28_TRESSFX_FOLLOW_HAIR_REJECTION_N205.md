# N205｜TressFX 4.1 的 follow-hair 半径法不能补上 KAOPU 的根绑定与弧长缺口

- 日期：2026-10-28
- Mother：Hair
- 类型：外部老师雷达 / bounded counterexample
- Bounded question：AMD TressFX 4.1 是否提供了一个比 Hair Current Best View 更可靠、可复现的“稀疏 guide → 高密 follower”方法，同时保持独立毛根、导丝弧长和沿曲线的局部 frame？
- 决策：`REJECTED`
- 生命周期：`RADAR_FOUND -> REJECTED`
- 生产分支、main、R2、现有门禁修改：无

## Current Best View

当前 Hair 分支的 F11/F12 `DenseStrands.mjs` 已把每个面积样本当作一个真实毛根和一条完整发丝：独立保存三角形/重心绑定；从本地 bundle 模型取得随弧长输运的 width/thickness frame；扰动在毛根处严格归零。F13 receipt 进一步固定了 F12 的 13 个参考深度组、43 个子束、114171 条完整路径（每条 49 点），不重新抽样毛根。

N151 已冻结“192 条 guide distinct + 3067 个 emergence probes 不等于 active-root → guide/follower coverage 已绑定”，要求持久化 mapping、carrier-surface coverage、unassigned count 和跨折叠正控。N157 要求逐段 rest-distance/总弧长收据；N161 要求沿真实弧长的 frame transport 与 twist-rate/反转/细化检查。这里不新建 regression，只回放这三个既有 Candidate。

## 外部源码事实

审计对象：AMD 官方 `GPUOpen-Effects/TressFX`，固定 commit `ba0bdacdfb964e38522fda812bf23169bc5fa603`（2020-01-24）。`TressFXAsset::GenerateFollowHairs()`：

1. follower 复用 guide 的同一个 `strandUV`；
2. 只在 guide 根部切平面随机一个非零 offset；
3. 每个 follower 顶点使用 `guideVert + offset * (1 + tipSeparationFactor * k / numVerticesPerStrand)`；
4. `followRootOffsets.w` 记录 guide index，但没有独立 carrier-surface root binding，也没有把 offset frame 沿弯曲 guide 输运。

官方 4.1 Developer Guide 同时明确记录该 radius 法可能在大半径下产生皮肤上方漂浮或皮肤下方嵌入的发丝。这不是推断为生产事实，而是上游公开边界。

## 八项筛选

1. **source/provenance**：AMD 官方仓库、固定 commit、源码函数和官方 Developer Guide，一手来源。
2. **maintenance/release**：默认分支最新 commit 与最新 release 均为 2020-01-24；当前仍可访问但维护/版本活性陈旧。
3. **runnable evidence**：有完整 C++/HLSL 源码、DX12/Vulkan sample、构建说明和二进制；审计 tree 未发现独立 tests 目录。
4. **license/rights**：MIT；本轮不复制代码或资产，只复写公开公式做合成验证。
5. **direct relevance**：直接命中 guide/follower 生成。
6. **novelty**：显式 `numFollowHairs / maxRadius / tipSeparation / guideIndex` 是可读参数语义，但 N151 已要求 guide mapping，F11/F12 已有更强的独立根绑定与 transported frame；对当前缺口没有有效新增。
7. **dependency/cost**：完整 sample 依赖旧 Windows/Visual Studio、DX12 或 Vulkan/Shader Model 6；直接集成成本高且与当前网页 Hair 管线不匹配。
8. **failure boundary**：固定根 frame offset 会造成 root binding 不一致、曲线转弯后的 tangent leakage 与中心线长度改变；官方也披露 floating/embedded hair 风险。不能把 demo 可运行当作 KAOPU 适用证明。

## 它比 KAOPU Current Best View 多知道了什么？

在这个明确问题上，没有新增的合法解法。它把 follower 数、根周半径和 tip separation 变成显式参数，也持久化 guide index；但这些语义已经被 N151 覆盖，且其固定 offset 公式比当前“独立真实毛根 + transported bundle frame + 根部扰动归零”更弱。真正新增的是一个可复现的**反例**：`guideIndex` 存在不等于 follower root/arc/frame 已绑定。

## 可反驳假设与最小回放

假设：若该 radius 法适合作为当前 follower teacher，则同一 guide UV 下不应出现非零独立根位置误差；弯曲 guide 上 follower 的中心线弧长不应被 tip separation 改写；固定 offset 不应在曲线末端泄漏到 tangent。

33 点四分之一圆 synthetic replay 直接复写上游公式，结果：

- root position error：`0.005 m`；
- guide arc：`0.1570638625 m`；follower arc：`0.1633835488 m`；漂移 `4.023641%`；
- tip offset `0.01469697 m` 全部落入 tip tangent，局部 perpendicular separation 为 `0`。

因此回放命中：N151 `REJECT_SHARED_STRAND_UV_WITH_NONZERO_ROOT_OFFSET`、N157 `HOLD_GUIDE_STRETCH_OUT_OF_BOUND`、N161 `HOLD_TRANSPORTED_FRAME_IDENTITY_UNBOUND`。这些数值只来自合成反例，不是生产阈值或 KAOPU 资产观测。

## 适用边界与路由状态

- 仅拒绝 TressFX 4.1 `GenerateFollowHairs()` radius 法作为 KAOPU 当前 root-bound/arc-preserving/frame-transport follower teacher；不评价或否定其渲染、抗锯齿、碰撞或 GPU simulation 其他模块。
- 不新增 Teacher Registry/referenceSet/method candidate，不进入 AUDITION/PROBATION。
- 对 Hair Mother 的建议仅是保留 N151/N157/N161 既有门禁，并把 `shared guide UV + nonzero root offset` 与 `fixed root-frame offset along curved guide` 作为其正控候选；是否采纳仍待 Mother。
- `POSTED=false`（写入前）；`ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED=false`。
- Mother query：`NOT_QUERIED/UNKNOWN`。
- KPI：均 `unknown`；没有新生产运行，不造指标。
