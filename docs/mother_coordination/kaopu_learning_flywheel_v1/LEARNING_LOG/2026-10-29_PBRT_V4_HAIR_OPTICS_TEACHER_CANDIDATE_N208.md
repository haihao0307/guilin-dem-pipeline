# N208｜PBRT v4 只作为 Hair 光学参数与验证老师候选

- 日期：2026-10-29
- Mother：Hair
- 类型：外部老师候选 / optics parameter semantics and validation
- Bounded question：PBRT v4 是否在一个明确问题上比 F13 Current Best View 多知道可复现知识——把纵向/方位角粗糙度、角质层倾角、黑色素吸收和散射余项拆成独立参数，并以能量与采样测试约束？
- 结论：`RADAR_FOUND -> TEACHER_CANDIDATE`；尚未进入 `AUDITION`
- 生产分支、main、R2 修改：无

## 1. KAOPU 当前真实能力

审计 F13 subject `haihao0307/guilin-dem-pipeline@2175d53de12a44dbedb989d3e8b34837f6315dcb` 的 `FiberOptics.mjs` 与 `PlannedFiberView.mjs`：

- 已有 R / TT / TRT 三个光学瓣、Fresnel、透射吸收、三盏灯、阴影、coverage 与 tone mapping；不能把它误写成“没有毛发光学”；
- 折射率固定为 1.55；
- 单一 `roughness` 同时控制三个纵向 Gaussian 宽度；
- 方位角 wrapped Gaussian 宽度固定为 `0.70 / 0.70 / 0.85`，没有独立 azimuthal roughness；
- lobe shift 固定为常数，没有显式 cuticle tilt 参数；
- `black/brown/auburn/blonde` 是四组手写 RGB absorption preset，没有 eumelanin / pheomelanin 浓度语义；
- 当前 evidence 未发现 white-furnace、sampling-weight、sampling-consistency 或 angle-grid finite gate。

## 2. 老师来源与八项筛选

固定一手源码：`mmp/pbrt-v4@b4ce9687e6c695f5582997c61b0c66cf064bdb4a`。

1. **source/provenance**：PBRT 作者官方仓库；HairBxDF 位于 `src/pbrt/bxdfs.h/.cpp`，测试位于 `src/pbrt/bsdfs_test.cpp`。
2. **maintenance**：exact head 提交日期 2026-09-08，仓库未归档；本轮读取时仓库 metadata 更新至 2026-10-28。没有 release tag，不能用 release cadence 冒充维护证据。
3. **runnable evidence**：完整 C++/CPU/GPU 实现；Hair tests 包含 active white-furnace、sampled white-furnace、sampling weights 与 sampling consistency。Reciprocity test 位于 `#if 0`，不得宣称它正在运行。
4. **license**：Apache-2.0。只学参数、公式边界与测试法；任何复制代码仍需保留 notice 并单独审查。
5. **direct relevance**：只针对 F13 fiber scattering，不替代发型几何、动力学、碰撞、coverage 或用户视觉验收。
6. **novelty**：存在明确局部新增，见下节。
7. **dependency/cost**：整个 PBRT 是离线 path tracer，直接集成会带来 C++/CUDA/OptiX、谱采样和场景系统成本；本 Candidate 禁止整包导入。
8. **risk/boundary**：PBRT 的离线能量/采样正确性不等于 WebGL 实时性能，也不保证 F13 外观一定更好；必须先做隔离 CPU reference 或 shader lab。

## 3. 它到底多知道了什么

PBRT HairBxDF 提供 F13 当前不能独立表达的四件事：

1. `beta_m` 单独决定纵向 variance，`beta_n` 单独决定方位角 logistic scale；
2. `alpha` 显式控制 cuticle tilt，而不是固定三组 lobe shift；
3. `ce/cp`（eumelanin / pheomelanin）确定性映射到 `sigma_a`；
4. `p=0/1/2` 后保留 `p>=3` residual，并用 white-furnace 与 sampling consistency 测试约束能量和采样。

最小参数回放固定 `beta_m=0.38`，只把 `beta_n` 从 0.2 改为 0.8：PBRT azimuthal scale 从 `0.063142` 变为 `0.636557`，纵向 variance 不变；F13 在相同 scalar roughness 下三个方位角宽度仍是 `0.70/0.70/0.85`，变化为 0。结构性参数缺口成立。老师分类器 9/9。

这只证明“值得 audition”，没有证明 PBRT 输出更美、实时可用或应取代 F13。

## 4. 最小可反驳 audition

建议 Hair Mother 仅建立隔离 CPU reference evaluator 或独立 shader lab，不修改 F13 生产分支。冻结：

`tangent / viewDirection / lightDirection / eta / h / sigmaA / betaM / betaN / alpha / lightEnergy / angleGrid / errorThresholdBasis / evaluatorCommit / verifierIdentity / runId`

必须能反驳以下假设：

- 固定 `betaM` 时，`betaN` sweep 只改变方位角宽度；
- 固定 `betaN` 时，`betaM` sweep 只改变纵向宽度；
- eumelanin / pheomelanin 浓度确定性映射到 absorption；
- 冻结角度网格全部 finite；
- white-furnace 误差阈值在运行前冻结；
- 与 retained F13 使用完全相同光照、相机与曝光比较；不同图像不等于质量通过。

若无法建立独立参数影响与能量正控，则降为 `NO_NOVELTY` 或 `REJECTED`，不得进入 Teacher Registry。

## 5. 给 Hair Mother 的四项问题

1. 当前任务是否真实需要独立纵向/方位角 roughness、cuticle tilt 或 melanin 语义？
2. F13 是否已有未被发现的等价参数与 energy/sampling tests？
3. 哪些 PBRT 公式、参数命名与测试设计值得进入隔离 audition，哪些 path-tracer 依赖必须排除？
4. 最小可反驳试验是否采用上述冻结 angle grid + white-furnace + retained F13 对照？

## 6. 状态与边界

- `RADAR_FOUND=true / TEACHER_CANDIDATE=true / AUDITION=false / PROBATION=false / ACTIVE_TEACHER=false`。
- `POSTED=false`（写入前）；learning semantic `GATE-RUN=true`；`ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`。
- 不创建 production regression；只有 audition 暴露真实 F13 failure 或通过单-Mother trial 后，才决定更新 Delivery Receipt / verifier gate。
- KPI 全部 `unknown`；9/9 是老师分类器，不是生产质量或性能 KPI。
