# N213｜DiffLocks 固定单一 seed：可复现不等于隐藏面已确定

## 0. 唯一 bounded question

DiffLocks CLI 把 Torch、NumPy、Python random seed 都固定为 `5`，一次只输出一个 hairstyle。若同一输入反复得到相同输出，是否足以把背面/遮挡 strands 从 `INFERRED_PRIOR_CANDIDATE` 晋级为唯一 `CURRENT_TRUTH`？

结论：**不够。** 固定 seed 解决的是 execution repeatability；它没有提供 occluded geometry 的 epistemic certainty。重复同一个 sample 不能把单视图逆问题变成唯一解。

本轮沿用并增强 N212：`HAIR-SINGLE-VIEW-OCCLUDED-PRIOR-NOT-REFERENCE-TRUTH-001`，不重复创建 regression。

## 1. 现有真实来源

固定上游 `Meshcapade/difflocks@fcc73747dc60320c30228b6711000a53fc0c9d84`：

- `inference_difflocks.py` blob `544ff03c7b3fc83251429c14da4ffe4ba52e31a3` 明确执行 `torch.manual_seed(5)`、`np.random.seed(5)`、`random.seed(5)`；
- 每次 CLI 只调用一次 `file2hair()`，只保存一个 `difflocks_output_strands.npz`；
- 官方 issue #11 中作者明确回复：模型是 diffusion，因此有轻微随机性，seed 不同会得到略有不同结果；
- 代码没有 uncertainty map、multi-hypothesis receipt、posterior variance 或“该 sample 是唯一真值”的证明。

因此需要分开记录：

1. `singleSeedRepeatability`：同 seed 是否重现同一字节/几何；
2. `posteriorAmbiguity`：换 seed 后不可观测区域是否变化；
3. `referenceTruth`：哪一个 hypothesis 有独立 reference evidence。

第 1 项通过不能推出第 2、3 项。

## 2. 外部方法比较

ICCV 2023 DiffPose 针对单图 2D→3D lifting 明确指出：单图高度 ambiguous，因此 diffusion 应预测 multiple hypotheses，而不是给一个过度自信的 3D 解。这个原则对 hair 的 bounded question 有方法学相关性，但 N212 已建立同一 ambiguity 约束，所以本轮外部老师状态为 `NO_NOVELTY`；新增价值来自 DiffLocks 固定 seed 的源码事实与可执行 receipt。

## 3. 最小可反驳回放

合成 posterior 保持 N212 的 8×41 strands 与同一 front projection，只让 `OCCLUDED` 区域随 seed 变化：

- seeds：`1..7`；
- 7 个 hypothesis 的 front projection hash 完全相同；
- 7 个 side projection hash 全部不同；
- `OBSERVED_FRONT` ensemble variance 为数值零：`9.14e-37 m²`；
- `OCCLUDED` ensemble variance 为 `5.7089e-5 m²`，标准差 **7.556 mm**；
- seed 5 重复三次，完整几何 hash 完全相同，deterministic runtime gate `PASS`；
- 但 single-sample truth gate 给 `REJECT_SINGLE_SAMPLE_PROMOTED_AS_UNIQUE_TRUTH`；
- 把“seed 5 可重复”当真值确定性时给 `REJECT_REPEATABILITY_MISUSED_AS_EPISTEMIC_CERTAINTY`；
- 多 seed 只能给 `HOLD_POSTERIOR_AMBIGUITY_DISCLOSED`，仍需 side/back/scan 选择 reference-bound hypothesis；
- classifier `10/10 PASS`。

这是 synthetic posterior replay，没有运行 DiffLocks checkpoint；数值不是模型性能结论。它验证的是状态语义与 gate，而不是 DiffLocks 实际 seed variance。

## 4. 可反驳假设

若 audition 同时记录单 seed 重复性和多 seed 的 observed/occluded ensemble variance，并禁止把 repeatability 解释为 truth certainty，则生成模型仍能提供稳定初始化，同时不会把隐藏面 prior 静默晋级为唯一参考真值。

反证条件：若额外 side/back/scan 或批准约束使一个 hypothesis 在隐藏区域被独立验证，则它可以按对应证据晋级；此时多 seed 不是永久阻断。

## 5. 对 N212 Candidate regression 的增量

### Task Anchor 新增字段

- `hypothesisSeedSet`
- `hypothesisCount`
- `uncertaintyAuditRequired`

### Delivery Receipt 新增字段

- `singleSeedRepeatability`
- `observedRegionEnsembleVariance`
- `occludedRegionEnsembleVariance`
- `posteriorAmbiguityDecision`

### Verifier 语义

- fixed seed 重复 hash 一致，只能记 `REPRODUCIBLE_SAMPLE`；
- front-only + one sample 不能记 `UNIQUE_TRUTH`；
- multi-seed variation 用于发现 uncertainty，不以平均、众数或“最好看”自动选真值；
- 无 withheld evidence 时，全部 hidden hypotheses 仍为 Candidate/Unknown；
- 若用户明确授权背面设计，另按 creative scope 记账，不能伪装成 reference match。

## 6. 去重与边界

- N211：DiffLocks 是否值得成为 image-to-strand teacher；
- N212：单视图 occluded prior 不得冒充 reference truth；
- N213：固定一个 seed 得到稳定 sample，也不能解除 N212 的 ambiguity。

不新增 regression、不修改 R2；只向现有 Candidate case 增加 source-backed negative control 与 receipt 字段。

## 7. 状态

- main baseline：`3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- Candidate parent：`automation/n212-single-view-hair-occluded-provenance-20261029@91670e2605b91ae2981c1ec7094096b59fa91d62`
- source + synthetic uncertainty `GATE-RUN=true`
- `POSTED=true`（Hair Mother 定向路由：#91 comment `6506582603`）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- Hair production `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`
- external teacher：`NO_NOVELTY`

未修改 main、生产 Hair Mother、R2 OS 或全局门禁；Candidate lineage 保留回滚点。

