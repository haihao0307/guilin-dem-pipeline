# N189 — “看过照片”不等于“把照片做进候选”

## Bounded question

当 Producer 再次交付相同或泛化的建筑/窗洞结构时，Verifier 怎样区分真实的参考驱动变化，与只换截图、相机、材质或文字说明的重复候选？

答案：并排截图仍不够。必须同时证明 **reference feature coverage** 与 **rejected-parent geometry delta**。前者回答“照片中的关键可见事实是否逐项进入候选”，后者回答“提交的是否真是不同几何，而不是同一失败资产的新包装”。

## 真实失败与去重

本轮用户纠正：任务已明确要求查看指定照片，并按照片制作建筑窗子和全部可见细节，但候选仍交付同样的泛化结构。

main 已有的鸟/鱼 creative-substitute 和地形 stale-delivery regression 分别覆盖“自行简化/创作”与“旧结果冒充新结果”，但没有覆盖这个组合漏洞：Producer 可以展示参考并提交新截图，却没有逐项证明参考特征进入候选。因此建立 `REFERENCE-OBSERVED-NOT-INCORPORATED-001`，不是复制现有 case。

## Current Best View 的 Candidate 增量

### Task Anchor

- `referenceSetDigest`、`referenceViewId`、`subjectIdentity`
- `featureLedger[]`: `featureId / sourceRegion / mustMatch|mustRemainBlank|UNKNOWN / relationOrMeasurement / toleranceSource`
- `rejectedParentArtifactId`、`rejectedParentGeometryDigest`
- `protectedRegions[]`
- `creativeAuthorization=false`

没有标定尺度时，只能冻结窗洞数量、相对位置、长宽关系、分格节奏、檐口/窗楣相对高度和明确空白区；绝对尺寸保持 `UNKNOWN`，不得反推或补画。

### Delivery Receipt

- `candidateArtifactId / candidateGeometryDigest / baseSha / headSha`
- `featureMappings[featureId] -> candidateElementId + measuredValue + verifierVerdict`
- `rejectedParentDiff`: 几何、参数、对象标识和可见表型差异
- `matchedViewEvidence`: 同相机/裁切/光照或明确记录差异
- `unauthorizedVisibleFeatures`
- `independentVerifier`

### Fail closed

- 与 rejected parent 相同的几何 digest；
- 只有截图、相机、灯光、材质、网页包装、分支名或时间戳变化；
- 窗洞数量大致相同，但位置、分格节奏或空白墙面与参考不符；
- 用材质/风格变化遮掩结构未改；
- 只有“已看照片”的文字声明，没有逐项 feature mapping；
- Producer 自批。

像素差分只能作为辅助证据：它能发现画面变化，却不能证明变化来自正确对象，也不能阻止相机/光照洗白。语义 feature ledger 是主门禁。

## 最小可反驳试验

`reference_feature_coverage_probe_n189.py` 对 8 个合成夹具回放：

1. 同几何、新截图；
2. 只改相机；
3. 只改材质；
4. 泛化窗洞、错误分格节奏；
5. 在参考空白墙面补窗；
6. 声称匹配但没有候选对象映射；
7. 改了几何但继承 rejected lineage；
8. 逐项映射、真实几何变化、无未授权特征并经独立验证。

预期前七项拒绝、第八项只进入 Candidate。该 probe 只验证门禁逻辑，不证明任何真实建筑资产已通过。

## 外部老师结论

本轮没有外部老师进入 audition。通用截图像素比较、需求 traceability 与现有 R2 的 reference-side-by-side / Task Anchor / lineage 规则相比，对“参考特征是否真的进了几何”没有独立新增知识，记 `NO_NOVELTY`；真正新增来自本轮真实反例对既有规则组合漏洞的暴露。

## 状态与路由

- OS / main / 生产 Mother：未修改。
- Regression：`CANDIDATE`，待真实历史回放或单 Mother 运行后才能采用。
- 精确 Architecture/Openings Mother 入口：`UNKNOWN`；不得猜测为 HOUSE 旧 PR。
- 协调：仅向根协调 issue #91 定向发布，请其路由给真实受影响 Mother；发布后是 `POSTED`，不是 `ACKNOWLEDGED`。
- KPI：首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数均 `unknown`。
