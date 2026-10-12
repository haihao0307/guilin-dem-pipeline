# N142｜Hair R14.2 总露头皮比例通过，但局部发根/分缝身份未证明

- 日期：2026-10-12
- 类型：技术问题 / Hair 局部门禁
- bounded question：R14.2 的单一 top-ROI `visibleFraction` 相对改善，能否证明用户指出的“发根没做好、头顶太透”已经解决？
- 结论：不能；总量改善成立，但当前证据不能区分授权自然分缝与非授权连续裸露区。
- 当前状态：`HOLD_SPATIAL_EXPOSURE_IDENTITY_UNBOUND`
- 生产分支修改：无
- Teacher Registry：无新增

## 1. 现有真实失败

Hair R14.2 固定 subject：

- source `28087e719383b432a9ac7f42c09eaf89588a3bc6`
- immutable build `c40a86c92b2fe37179e29a67628bf26303745d60`
- parent frozen build `c0816ec8388195bb79b12fc82e11ce2d3fa07d56`
- Draft PR #228

R14.2 的 `root-study.mjs` 对三种发型只用整个固定顶视 ROI 的总露头皮比例作门，并要求候选/reference ratio < 0.8。真实报告均通过：

| style | R13C visibleFraction | R14.2 visibleFraction | ratio |
|---|---:|---:|---:|
| textured-fringe | 0.101972 | 0.067206 | 0.6591 |
| side-flow | 0.116158 | 0.072200 | 0.6216 |
| curtain-layer | 0.106413 | 0.057457 | 0.5399 |

这证明总裸露采样下降约 34%–46%，但没有证明裸露的位置、形状和身份正确。

固定顶视证据：

- [textured-fringe](https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/c40a86c92b2fe37179e29a67628bf26303745d60/kaopu-hair-workbench/fusion/r14/evidence/root-study/textured-fringe/candidate-textured-fringe-top.png)
- [side-flow](https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/c40a86c92b2fe37179e29a67628bf26303745d60/kaopu-hair-workbench/fusion/r14/evidence/root-study/side-flow/candidate-side-flow-top.png)
- [curtain-layer](https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/c40a86c92b2fe37179e29a67628bf26303745d60/kaopu-hair-workbench/fusion/r14/evidence/root-study/curtain-layer/candidate-curtain-layer-top.png)

人工复核只能做 scoped observation：三张图仍存在连续可见头皮区，位置和形状不相同；它们与用户报告的失败类型一致。由于尚无每个发型的授权 part/whorl mask，不能把所有可见头皮都判错，也不能说用户已经拒绝 exact R14.2。

另一个量化信号：根点间隙约 0.02 mm，但 sampled first-segment gap 的最大值分别达到 3.23 / 4.67 / 6.77 mm。根点贴头不等于第一个可见发段在局部形成足够覆盖。

## 2. 失败机制

当前 gate 会出现两种相反的误判：

1. **局部错误被均值隐藏**：大部分 ROI 更密，可以抵消一个连续秃洞，总 `visibleFraction` 仍下降并通过。
2. **创作替代被奖励**：为了降低总比例而把授权分缝/发旋全部盖住，也可能得到更好分数，却违反 reference identity。

因此 aggregate mean 不能单独承担 scalp-exposure acceptance。

## 3. 外部方法与比较

OpenCV 官方 `connectedComponentsWithStats` 可以对二值图做 4/8 邻域连通域标记，并给出每个区域的面积、边界框和质心：

- https://docs.opencv.org/5.0/main_modules/imgproc_shape.html

这个方法本身属于成熟通用图像测量，对 KAOPU 不是新老师，状态为 `NO_NOVELTY`。本轮新增是把它映射到 Hair exact-subject 门禁：总比例之外，还要检查“不允许裸露区域”的最大连续组件及位置身份。

## 4. 可反驳假设

> 若每个发型先绑定 reference/user-authorized 的 part/whorl allowed mask，再在固定相机、投影、DPR、MSAA 与 exact build 上测量 `visibleScalp ∩ forbiddenMask` 的最大连通组件，并加入一个人为移除 crown 小圆区发丝的 positive control，那么当前 aggregate-pass / local-hole 漏报会被拦截；若真实回放不增加任何检出，只增加脆弱阈值，则本 Candidate 应撤销。

## 5. 最小历史回放

新增去重 regression：

`CANDIDATE-HAIR-SCALP-EXPOSURE-SPATIAL-IDENTITY-001`

执行探针 5/5：

1. 真实 R14.2 aggregate pass、无 mask identity → `HOLD_SPATIAL_EXPOSURE_IDENTITY_UNBOUND`
2. global mean 合格、局部 forbidden hole 过大 → `REJECT_LOCALIZED_SCALP_EXPOSURE`
3. 授权分缝内裸露、forbidden component 小 → scoped pass
4. global exposure 超限 → reject
5. detector 漏掉已知 crown-hole positive control → hold

当前 0.08 / 0.01 只用于合成历史夹具，不得直接成为生产阈值。真实阈值必须来自同一发型的授权 reference / accepted baseline；否则保持 UNKNOWN。

## 6. Hair 局部 Candidate gate

下一次 R14 派生候选至少记录：

- `subjectSha / imageDigest / styleId`
- `cameraProjection / cameraPose / DPR / MSAA / ROI`
- `allowedExposureMaskDigest` 与来源（reference / user / verifier）
- `forbiddenExposureFraction`
- `largestForbiddenComponentArea / bbox / centroid`
- `firstSegmentGapP95 / max`
- `positiveControlDetected`
- `aggregateVisibleFraction`（保留，但不再单独放行）

不得由 Producer 自行画一个“理想分缝” mask；缺授权 mask 就 HOLD。不得为了过门增加黑头皮帽、第二层短毛或透明度替代。

## 7. 适用边界与决策

- 只处理 Hair 固定顶视的局部 scalp exposure；不判断发型整体审美、方向、动态、碰撞或影视级质量。
- 连通域是屏幕空间指标，不能冒充生物毛囊密度或世界空间覆盖。
- 当前浏览器环境无法创建 WebGL context；依据既有 capability-precondition 规则，只记环境 blocker，不归因为 R14.2 artifact failure。本轮视觉读取使用 immutable CI PNG。
- 当前 decision：`CANDIDATE`，只路由 Hair Mother / PR #228。
- `POSTED=false`（定向路由后由外部 comment 状态更新）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- `GATE-RUN=true`（5/5 合成/历史分类）
- `ADOPTED=false`
- `USER-ACCEPTED=false`
- 首次候选视觉通过率、同错复发率、内部迭代数、用户指令到合法 candidate 时间：`UNKNOWN`
