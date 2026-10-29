# N210 — Disney skin micro-wrinkle graph method：TEACHER_CANDIDATE

日期：2026-10-29  
状态：`RADAR_FOUND -> TEACHER_CANDIDATE`；独立参数语义回放 `GATE-RUN`；`AUDITION=false`。  
范围：面部皮肤 microrelief（毛孔与 tens-to-hundreds-of-micrometers 微皱纹）；不评价完整皮肤 BRDF、皮下散射、血色、汗液、毛发、表情宏皱纹或最终人像质量。

## Bounded question

Disney Research Studios 2023 的 **Graph-Based Synthesis for Skin Micro Wrinkles** 是否在一个明确问题上比 KAOPU Current Best View 多知道了可迁移、可反驳的知识：**怎样让皮肤微结构不是均匀噪波，而成为“毛孔为节点、微皱纹为边、方向随面部 flow 与区域变化”的可控场？**

## 当前基线与真实观察

- `guilin-dem-pipeline/main`: `3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- root `AGENTS.md`: blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate: blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest before this record: N209 comment `6487414042`，无 Mother ACK；#63 latest仍为 N49 `5910449798`。
- main 对 `skin / pore / wrinkle / subsurface` 未返回实现或 regression；Current Best View 在这一 bounded domain 记为 `UNKNOWN / NOT_IN_MAIN`，不能说 KAOPU 已覆盖。
- 本轮读取的三张 2026-10-29 参考图只支持视觉 Observation：鼻翼、面颊、眼睑、胡须区的孔隙密度与方向明显不同；掠射光强化微表面阴影/高光；耳廓红色透射属于皮下散射维度，不能用 displacement 单独解释。图片未披露生成器、贴图或 renderer，不能反推具体生产实现。

## 老师到底多知道了什么

官方论文把宏观与微观尺度分开：macro wrinkle 为毫米级；microrelief 是毛孔/毛囊和它们之间 tens-to-hundreds-of-micrometers 的微皱纹。它不是把噪波直接乘到法线，而是：

1. 以 Poisson-disk 采样毛孔节点，并用空间变化半径补偿 UV 拉伸；
2. 连接 k-nearest 邻居形成 wrinkle candidate graph；
3. 用无向轴向概率 `P(theta) ∝ alphaBase + exp(-angularDistance(theta, flow)^2 / sigma^2)` 控制局部 facial-flow 方向与随机成分；
4. 通过 continuation、crossing penalty、deposit/decay 选择并雕刻边；
5. 多尺度重复，最后把节点/边以 shape functions 写成 displacement map。

这比“统一 pore noise + 统一 roughness”多了三项明确语义：**端点归属（wrinkle 在 pore 处连接）、区域方向场、尺度分层**。它直接解释了参考图为什么不同面区的纹理不是同一张均匀噪波。

来源：

- Disney 官方项目页与论文：https://studios.disneyresearch.com/2023/07/03/graph-based-synthesis-for-skin-micro-wrinkles/
- 2024 官方后续明确指出 simulation-only 仍可能显得 synthetic，并用真实扫描 displacement patch 做 style transfer：https://studios.disneyresearch.com/2024/06/07/stylize-my-wrinkles-bridging-the-gap-from-simulation-to-reality/

## 八项 Teacher Candidate 筛选

1. **source/provenance**：Disney Research Studios 官方项目页、正式 Eurographics/CGF 论文与 supplement，原始来源成立。
2. **维护/活性**：不是软件仓库，无 release/issue 活性可查；研究线在 2024 有官方 follow-up。软件维护性为 `UNKNOWN`。
3. **代码/测试/数据/复现**：官方页只给论文、supplement 与视频；未发现官方代码或数据。论文给出数据结构、公式、参数与消融，可做独立语义复现，但不能称官方实现可运行。
4. **license/rights**：项目页版权声明限制非商业传播，未给代码/数据许可；只学习公开方法与参数语义，不复制资产、supplement 图或未授权代码。
5. **直接相关性**：直接对应当前三张参考图最显眼的毛孔—微皱纹网络与区域差异。
6. **新增知识**：main 未见等价 skin microrelief 表达；pore-node / wrinkle-edge / regional flow 明确新增。
7. **依赖/成本/集成风险**：原方法假设 UV face mesh，目标可达 16k displacement；论文实现用 CUDA 并行模拟 50,000 edges。WebGPU/纯函数引擎集成、内存和实时成本仍未知。
8. **demo/不透明/失效风险**：无公开实现是主要风险；2024 follow-up 还证明纯模拟可能过于规整，最终自然度不能由 2023 graph 结构自动保证。

结论：`TEACHER_CANDIDATE`，但因无 Mother 回执、无官方代码和无最终图像复现，不能进入 `AUDITION / PROBATION / ACTIVE_TEACHER`。

## 独立最小语义回放

固定种子在单位 UV patch 上生成 190 个 Poisson-disk pores、535 条 5-NN candidate edges，仅复写论文的 pore-node binding 与轴向 orientation sampler：

- graph edge 的端点到 pore 最大误差：`0`；
- 随机开放线段端点落入 pore tolerance 的比例：`0.003738`；
- `alphaBase=0.05` 时 axial resultant：`0.690256`，±15° 权重占比 `0.640826`；
- `alphaBase=1.0` 时 axial resultant 降为 `0.108554`；
- classifier：`8/8 PASS`。

这只证明参数语义能产生“端点归 pore + 可调各向异性”，不证明完整 Disney CUDA 模拟、皮肤自然度或生产性能。

## 若 Mother 确认相关，最小 audition

只做一个 20–30 mm 面颊 patch，不先做整张脸：

### Task Anchor candidate

- `detailScaleBands = [MACRO_MM, MICRO_TENS_TO_HUNDREDS_UM]`
- `microreliefRepresentation = PORE_NODE_WRINKLE_EDGE_GRAPH`
- `regionalFields = [poreDensity, poreRadius, primaryFlow, baseStrength, wrinkleDepth]`
- `uvDistortionCompensation = REQUIRED`
- `materialSeparation = [microGeometry, roughness/specular, subsurface/blood]`
- `sourceRights = METHOD_ONLY_NO_ASSET_COPY`

### Delivery Receipt candidate

- fixed seed + parameter manifest；
- pore-node / edge manifest 与 endpoint-binding census；
- patch physical size、displacement texel size、depth range；
- 同一相机/同一掠射光下 `noise-only`、`graph-only`、`roughness-only`、`SSS-only`、`combined` 五组消融；
- exact output hash、GPU/CPU/browser/device 分层与独立 verifier。

### 可反驳 gate

- graph 路线出现非 pore 开放端点；
- facial-flow 参数变化却没有方向统计变化；
- UV 拉伸使相同物理区域孔距失真；
- 用 displacement 冒充 roughness/SSS，或用 SSS 掩盖结构缺失；
- 只交 beauty render，无消融、物理尺度或 exact candidate receipt。

## 去重与保存决策

本轮没有发现 main 中等价 skin regression，也没有一个已运行的 Skin Mother candidate，因此不建立“生产失败”回归；只保存老师候选、独立语义 probe 与适用边界。若 Mother 回答现有体系已有等价 pore graph、区域 flow 与消融 gate，则本候选转 `NO_NOVELTY`。

## 状态

- `POSTED`: false（写本记录时）
- `ACKNOWLEDGED`: false
- parameter-semantics `GATE-RUN`: true
- `AUDITION`: false
- `IMPLEMENTED`: false
- production/browser/device `GATE-RUN`: false
- `PROBATION / ACTIVE_TEACHER / ADOPTED / USER-ACCEPTED`: false

未修改 main、生产 Skin/Humanoid Mother、R2 OS、全局门禁或公网页。KPI：unknown。
