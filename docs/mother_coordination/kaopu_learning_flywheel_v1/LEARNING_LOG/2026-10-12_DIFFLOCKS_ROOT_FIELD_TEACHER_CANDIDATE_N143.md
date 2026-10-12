# N143｜DiffLocks 只作为 Hair 根场表示专项老师候选，不作为生产资产

- 日期：2026-10-12
- 类型：外部老师候选 / Hair scalp-root field
- bounded question：DiffLocks 的“独立头皮密度图 + 每个头皮位置的发丝局部编码”是否比 Hair R14.2 当前 Current Best View 多提供一个可反驳的发根分布方法？
- 老师状态：`TEACHER_CANDIDATE`
- 直接模型/代码/数据集成：`REJECTED_LICENSE_AND_RUNTIME_BOUND`
- 当前候选状态：`AUDITION_PENDING_HAIR_MOTHER`
- 生产分支修改：无

## 1. 现有真实失败

Hair R14.2 fixed subject：source `28087e719383b432a9ac7f42c09eaf89588a3bc6`，immutable build `c40a86c92b2fe37179e29a67628bf26303745d60`，Draft PR #228。

R14.2 已有确定性种子、真实 GNM 头皮三角形/重心绑定、连续 `scalpDensity` 函数、局部生长方向和根部间隙控制。N142 也已阻断“总露头皮比例合格但局部秃洞仍存在”。这些能力保留，不得被外部模型替换。

仍缺的是一份独立、可哈希、可比较的 scalp-space 根场收据：当前没有绑定每款发型的头皮 UV 参数化、密度场 digest、方向场 digest、授权分缝 mask、局部低密度连通区和方向不连续统计。现有 `crown-root-field.json` 证明四个抽样根点没有平移并检查后根/中段响应，但不能证明整个头皮局部密度和方向身份。

## 2. 外部老师来源与新增知识

固定 audition source：`Meshcapade/difflocks@fcc73747dc60320c30228b6711000a53fc0c9d84`（2025-10-31 当前可见 main head）。官方 CVPR 2025 项目、论文和仓库一致指向同一实现。

相对 R14.2 的新增不是“从图片自动做发型”，而是明确拆开两个 scalp-space 对象：

1. 独立 density channel 决定哪些 UV texel 可以产生根；
2. 64-channel scalp texture 在每个位置保存发丝局部 latent；
3. 按密度概率采样 root UV，再把局部 latent 解码成 256 点发丝，并通过头皮局部 TBN 放回世界空间；
4. 推断入口显式固定 Torch / NumPy / Python random seed，说明随机根采样必须纳入可重复性身份。

这比 R14.2 多知道的明确问题是：**根在哪里**和**从该根长出什么局部曲线**应当是两个独立、可审计的头皮场，不能只靠总根数、全局 density 滑块或最终屏幕覆盖反推。

## 3. Teacher Candidate 八项筛选

1. `source/provenance`：官方 Meshcapade / MPI 相关仓库、CVPR 2025 论文与项目页一致。
2. `maintenance`：代码 2025-04 发布；2025-08 修过 inference path、抗锯齿 resize 和固定 seed；2025-10 更新许可证。2026-10 观察时未见更新到 2025-10 之后，维护活性只记有限。
3. `runnable evidence`：公开 training/inference code、checkpoint/dataset 下载脚本、40K synthetic dataset 描述；仓库未发现自动测试目录，且公开 issues 有结果不一致、checkpoint 注册、不同 scalp、旧 GPU 和渲染问题。
4. `license/rights`：自定义 Non-Commercial Scientific Research Only；衍生物继续受同一限制，商业使用须联系 Meshcapade。故模型、代码、checkpoint、数据和衍生资产不得进入 KAOPU 生产链，除非另有书面许可。
5. `direct relevance`：只对 Hair 的 root-density / local-strand representation 直接相关；不证明发根生物学、材质、动力学、碰撞或用户参考保真。
6. `novelty over CBV`：R14.2 有连续密度函数和确定性 root sampling，但没有独立可哈希 density/strand field receipt；这里有有限新增。
7. `dependency/cost`：Torch 2.5、CUDA、自定义 NATTEN 与 FlashAttention-2、DINOv2、模型 checkpoint；Blender export 声明针对 4.1.1。浏览器/CPU 生产集成成本高。
8. `demo-only / opacity`：训练数据是 synthetic 40K，单张正面图不能成为隐藏后脑/发旋 Canonical Truth；开放问题还包括长发数据不平衡和换 scalp。输出只能是 Observation/Candidate，不得当 reference fact。

## 4. 与 KAOPU 当前制度比较

- R2、参考复刻门与 N142 已经禁止用外部生成结果替代用户参考，因此制度层 `NO_NOVELTY`。
- 技术表示层存在局部新增：把 root density 和 local strand geometry 分离成两个 scalp-space receipt 对象。
- 不复制 DiffLocks 的代码、模型、checkpoint、数据、阈值或生成结果；只学习其可迁移的数据结构和可反驳测试思想。

## 5. 可反驳假设

> 若在同一 R14.2 exact subject 上，从现有真实 roots 导出确定性的 scalp-UV density field 与 root-direction field，并绑定 scalp mesh、UV、seed 和授权 part/whorl mask，那么“保持总根数但挖掉 crown 根，再把根补到其他位置”的假候选，以及“不改密度但制造耳到耳方向环”的假候选，会被 root-field gate 拦下；如果它不能比 N142 screen-space gate 多检出任何真实失败，或字段无法稳定绑定到授权 reference，则撤销该 Candidate。

## 6. 最小历史回放

新增去重 regression：`CANDIDATE-HAIR-SCALP-ROOT-FIELD-IDENTITY-001`。它与 N142 不重复：N142 检查渲染后的屏幕裸露连通域；N143 检查渲染前 scalp-UV/world-space 根密度与根方向身份。

分类探针 6/6：

1. R14.2 exact subject 缺 root-field receipt → HOLD；
2. 总根数不变但 crown 局部低密度 → reject；
3. 密度不变但出现耳到耳方向环 → reject；
4. 授权分缝且 density/flow 连续 → scoped pass；
5. 无商业许可直接导入 DiffLocks 资产 → reject；
6. 概率采样未绑定 seed → replayability HOLD。

夹具中的 `0.01` 和 `35°` 只验证分类逻辑，不是生产阈值。真实阈值只能来自每款发型的授权 reference / accepted baseline。

## 7. Hair 局部 Candidate 对象

下一次单-Mother audition 只要求导出 `ScalpRootFieldReceipt`：

- `subjectSha / styleId / scalpMeshDigest / uvParameterizationDigest`
- `densityFieldDigest / directionFieldDigest / allowedPartMaskDigest`
- `samplingAlgorithmId / seed / rootCount`
- `largestForbiddenUnderdensityComponentArea/bbox/centroid`
- `directionDiscontinuityP95/max`（分缝/发旋授权边界单列）
- `firstSegmentGapP95/max`
- `positiveControls`: crown root removal、root relocation with total count preserved、direction-ring injection

若用户 reference 没有提供后脑或发旋事实，隐藏区域保持 `UNKNOWN`；不得让单张正面图模型补画。

## 8. 适用边界与决策

- Teacher scope：scalp-space root density / local emergence representation and gate design only。
- 不适用：直接生产生成、参考复刻真值、毛发材质、动力学、碰撞、浏览器性能。
- `TEACHER_CANDIDATE`：方法表示值得 Hair Mother 做一次最小 audition。
- `POSTED=false`（定向路由后更新）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- `GATE-RUN=true`（6/6 分类回放）
- `HAIR-PRODUCTION-GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`
- KPI：`UNKNOWN`。
