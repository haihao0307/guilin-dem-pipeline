# N163 — 有轨迹数据不等于“穿着复验通过”可复算

- 日期：2026-10-15
- Mother：Clothing / Tailor
- 类型：制度验证 / verifier gate / reproducibility
- Bounded question：PR #299 的 T14 已保存 10 秒撤夹具轨迹时，`physicalWearReviewPassed=true` 能否作为可复算门禁通过？
- 结论：`TRACE_EVIDENCE_PRESENT__HOLD_VERDICT_DERIVATION_UNBOUND`。

## 1. 现有真实失败

PR #299 head `c84b16a0ae022dda9fe22c09df758fcb8095bc07` 的 T14 结果保存了 10 个每秒快照；`pinsAfterWear=0`、`supportsAfterWear=0`，最后三秒四块胸口边缘的平均高度净变化绝对值约为 `0.000005–0.000043 mm`。这些是有效的原始轨迹证据。

同一报告直接写入 `physicalWearReviewPassed=true`，批报告又写入 `wearReviewPassed=true`，README 和界面据此显示“本次静止人物的位置复验通过”。但本 PR 的版本化代码中没有生成这两个布尔值的判定器：

- `verify_identity.mjs` 只校验撤夹具后 pins/supports 为 0、时长至少 10 秒、轨迹恰有 10 个样本；
- `verify_all.py` 只核对结构、有限坐标、接缝和静态门禁；
- `build_backend.py` 只负责每秒记录 `measureFinish`，没有冻结高度、速度、接触连续性或材料状态阈值；
- `qa/finish-report.json` 的 `physicalWearReviewPassed` 与 `data/BATCH_REPORT.json` 的 `wearReviewPassed` 只作为结果字段出现。

因此当前可重放的是“轨迹存在且最后三秒平均高度几乎不漂移”，不是“该轨迹按某个已冻结规则通过”。这不否定 T14 可能稳定，也不推翻 PR 对 `staticPassed=false`、穿插/拉伸/压缩仍待修以及 `wearCertified=false` 的诚实边界。

## 2. 外部方法 / 与 KAOPU 比较

NASA-STD-7009B（2024-03-05）要求模型与仿真的 acceptance criteria 由项目定义并经授权技术方批准；NASA-HDBK-7009B（2026-02-03）提供该标准的实施指导。NIST 的软件 V&V 指南把 acceptance testing 绑定到 V&V acceptance criteria，并要求测试用例规格包含 expected results：

- https://standards.nasa.gov/standard/nasa/nasa-std-7009
- https://standards.nasa.gov/standard/NASA/NASA-HDBK-7009
- https://www.nist.gov/publications/software-verification-and-validation
- https://www.nist.gov/publications/planning-software-validation-verification-and-testing

这些原则与 R2 的冻结标准、Producer/Verifier 分权、证据层级一致，外部方法状态为 `NO_NOVELTY`。本轮新增的是 PR #299 的真实反例：有来源锁和轨迹文件，但 pass verdict 的 derivation 未进入仓库，因此无法由下一位 verifier 复算。

## 3. 可反驳假设

若 T14 的穿着位置“通过”是可复算门禁，则一个只读 verifier 应能仅凭固定 subject 和仓库内容完成：

1. 读取不可变 T14 result SHA；
2. 读取在该次运行前已冻结的 criterion/version；
3. 执行 committed verdict generator；
4. 得到相同 pass/fail 和逐项 reason；
5. 证明 Producer 不能用手改布尔值替代判定；
6. 若声称独立批准，再绑定独立 verifier identity/receipt。

当前满足 1 和原始轨迹存在，不满足 2、3、4、5、6。故“当前字段已构成可复算门禁通过”的假设被反驳。

## 4. 最小历史回放

本轮不新建 regression case；给既有 `VERIFIER-INDEPENDENCE-IDENTITY-001` 增加 N163 证据。隔离分类回放 6/6：缺原始证据、当前 T14、仅手写 pass、运行后补阈值、已冻结自动检查但独立批准待定，以及完整独立回执。

当前合法状态为 `TRACE_EVIDENCE_PRESENT__HOLD_VERDICT_DERIVATION_UNBOUND`。最小单 Mother 试验是在 PR #299 上增加一个只读 verdict generator：输入 exact T14 result SHA 与预先冻结 criterion，输出逐项 reason 和确定性摘要；再由不同 verifier principal 运行一次。不得重写 T14 模型、不得把静态失败抹成穿着通过、不得发明布料真实性阈值。

## 5. 适用边界与是否采用

采用为 Clothing/Tailor 局部 Candidate：

- `wearReviewPassed` 不得手填；必须记录 `criterionId/version`、`criterionFrozenAt`、`subjectSha`、`verdictGeneratorSha`、`verdictDigest`；
- 原始 trace、机器 predicate 执行、独立 verifier decision 三层分开；
- 没有 executable derivation 时可以报告具体观测，不得报告 gate pass；
- 这条局部 Candidate 不修改 R2，不修改 PR #299 生产分支，不改变任何现行阈值。

若 Producer 补齐 committed predicate，只能提升为 `AUTOMATED_CHECK_VERIFIED__INDEPENDENT_APPROVAL_PENDING`；只有身份与权限独立的 verifier 对 exact subject 完成 GATE-RUN，才可进入 `INDEPENDENT_VERIFIER_RECEIPT_VERIFIED`。

## 6. 生命周期与 KPI

- method：`NO_NOVELTY`
- regression：复用 `VERIFIER-INDEPENDENCE-IDENTITY-001`，无重复 case
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/299#issuecomment-6196097579
- ACKNOWLEDGED / IMPLEMENTED / CLOTHING-GATE-RUN / ADOPTED / USER-ACCEPTED：false
- classification replay：6/6
- 当前 pass-verdict derivation 缺失事件：1
- 首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、stale delivery 次数、accepted delta 内部迭代数、从指令到合法 candidate 时间：unknown
