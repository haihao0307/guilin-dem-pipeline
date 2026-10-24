# N188 — held-out 场景不能继续由 Producer 手挑

## Bounded question

N181 已要求门角、台阶、物体位姿/质量和障碍布局的 held-out 变化；但若这些变化仍由 Producer 手工挑选，能否证明环境条件动作在合法输入域内可靠？

答案：不能。手挑样本可以全部避开交互边界，形成“held-out 洗白”。当前缺口不是再加一张固定动作清单，而是冻结输入域生成器、缩减语义和反例重放。

## 外部老师筛选：Hypothesis 6.170.9

- 来源/provenance：HypothesisWorks 官方仓库与官方文档。
- 维护：`v6.170.9` 于 2026-10-23 发布；仓库同日仍有 push，未归档。
- 可运行性：Python 包、完整 tests、GitHub Actions、文档、失败 example database；本轮在隔离目录实际安装并运行 6.170.9。
- License：MPL-2.0；本候选不复制其源码，只在学习 probe 中以依赖运行。
- 依赖/成本：Python >=3.11，核心依赖 `sortedcontainers>=2.1,<3`；实际 1.2 MB wheel，CPU 即可。
- 新增知识：相对 N181 的固定 held-out 清单，增加结构化合法输入生成、自动缩减最小反例、失败保存/重放和确定性 CI 语义。
- 风险/边界：它只能探索 Task Anchor 明确编码的输入域；不会发现未建模变量，也不能判断动作是否自然。真实仿真慢且可能非确定，必须冻结随机源/外部状态；版本、Python、test function 变化会改变 `derandomize` 的样本序列。
- 状态：`TEACHER_CANDIDATE`。尚未由 Motion Mother 回答相关性，也未在真实控制器上 audition，不能进入 Registry。

它比 KAOPU Current Best View 多知道的明确问题：**如何把“挑几个 held-out 场景”变成由声明式输入域驱动、能自动找出并缩减最小失败场景、可被 CI 重放的 verifier。**

## 最小可反驳对照

本轮用真实 Hypothesis 6.170.9 对一个合成 controller 做方法对照：

1. 六个手挑合法变化全部通过；
2. 同一合法域交给 property search；
3. 自动找到失败交互并缩减为最小反例；
4. 禁用 example database、开启 `derandomize`，独立运行两次，最小反例一致。

这是方法语义验证，不是生产动作系统验证。若真实 Motion Mother 的控制器/仿真不能做到相同输入可重复、生成成本不可接受、或缩减后的场景不再满足物理/任务约束，则否定本候选在该链路的适用性。

## N181 的 Candidate 增量（不新增重复 regression）

沿用 `MOTION-ENVIRONMENT-CONDITIONED-GENERATION-001`，候选增加：

### Task Anchor

- `variationDomainSchema`
- `variationGeneratorVersion`
- `constraintPredicateVersion`
- `requiredExplicitExamples`
- `generationBudget`
- `shrinkBudget`
- `determinismPolicy`

### Delivery Receipt / verifier

- `generatedCaseCount`
- `validCaseCount / rejectedByConstraintCount`
- `generatorVersion + HypothesisVersion + PythonVersion`
- `seedOrDerandomizedTestDigest`
- `minimalCounterexample`
- `shrinkTraceDigest`
- `counterexampleReplayCount`
- `flakyOutcome: true|false`

### Fail closed

- 只报告手挑 held-out 列表；
- 输入域、约束谓词或生成器版本未绑定；
- 失败反例无法在冻结 subject 上重放；
- 非确定 rollout 被当成确定性反例；
- 把 property test 通过表述为“动作自然”或 `USER-ACCEPTED`。

## 状态

- OS / main / 生产 Mother：未修改。
- 回归：沿用 N181，不重复创建。
- Teacher：`TEACHER_CANDIDATE`。
- Mother：`NOT_QUERIED/UNKNOWN`；定向发布后才可写 `POSTED`。
- KPI：真实首次候选通过率、用户纠错与同错复发均 `unknown`。
