# N197 — 建筑学习结果不能退化为外壳

日期：2026-10-27  
状态：CANDIDATE / synthetic GATE-RUN  
范围：Building / Architecture 表示完整性；不等于结构安全、建筑法规或真实施工认证。

## Bounded question

当任务声称已经吸收建筑知识时，Verifier 如何在用户审阅前拒绝“只有外壳，梁、柱、门、楼层/地下室关系没有进入候选”的结果，同时避免在资料不足时擅自补造地下室？

## 真实失败

用户最新纠正指出：当前结果仍是外壳，已经学习过的柱、梁、门和地下室关系没有进入可见/可检查的候选。这个失败不能只归类为“细节少”，因为问题在于：

1. 知识只存在于文字或对话，没有实例化为对象与关系；
2. 外壳/立面可以看起来完成，却无法证明内部系统存在；
3. Producer 可以用“已学习”或截图自证，用户仍成为第一层 QA。

main 基线：`47d416556dc6bcb4bac4078a9c81bd64faa8f70a`。本轮已复读的固定基线 blob：
- root AGENTS：`251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS：`d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate：`8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate：`4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #63 latest production feedback：comment `5910449798`
- #91 latest feedback before this run：comment `6425719357`

## 去重与新增边界

N189 `REFERENCE-OBSERVED-NOT-INCORPORATED-001` 已覆盖“照片里的可见特征没有逐项进入几何”，包括窗洞、分格、空白墙面、相机/材质冒充变化。

本轮不重复 N189。新增仅限于：**学习声明涉及不可由外壳截图证明的系统与关系时，必须有对象图和关系边；文档、标签和外壳不能代替实例化。**

## Candidate 合同

### Task Anchor

增加：

- `systemRequirementLedger[]`
  - `systemId`
  - `requirementState = REQUIRED | NOT_APPLICABLE | UNKNOWN`
  - `requirementSource`
  - `expectedRelations[]`
- `systemCoverageScope`
- `creativeAuthorization=false`

系统示例只按当前任务/参考选择，不作为通用强制清单：envelope、columns、beams、slabs/floors、walls、doors/openings、stairs/lifts、roof、foundation/basement。

### Delivery Receipt

增加：

- `systemNodes[systemId] -> candidateObjectIds[]`
- `systemRelations[relationId] -> typedEdges[]`
- `coverageEvidence[]`
- `systemVerdict = VERIFIED | MISSING | UNKNOWN | NOT_APPLICABLE`
- `independentVerifier`

### Fail closed

- envelope 存在，但任一 `REQUIRED` 系统没有 candidate object 和证据；
- 梁、柱、门、地下室只出现在文档/标签，未进入对象图；
- 对象存在但关键关系缺失，例如 column→beam、door→opening host、basement→ground floor；
- `NOT_APPLICABLE` 没有来源证据；
- Producer 自批。

### Unknown 保留

资料不足时，`UNKNOWN` 必须 HOLD；不得为了让矩阵全绿而补造地下室、柱网或门洞。只有来源明确支持 `NOT_APPLICABLE` 才能跳过。

## 可反驳假设与最小回放

假设：若每个 REQUIRED 系统都必须绑定 `object ids + evidence`，每个必需关系都必须绑定 typed edge，且 UNKNOWN fail closed，则 shell-only 与“文字学会但几何未实例化”会在用户审阅前被拒绝。

合成回放 8/8 命中预期：

1. 外壳 + 梁柱文字标签：REJECT_SHELL_ONLY；
2. 立面很细但无系统图：REJECT_REQUIRED_SYSTEM_MISSING；
3. 梁柱对象存在但没有支承关系：REJECT_RELATION_MISSING；
4. 门对象存在但无 opening host：REJECT_RELATION_MISSING；
5. 地下室需求未知：HOLD_REQUIREMENT_UNKNOWN；
6. 来源证明无地下室：CANDIDATE_READY；
7. 完整图但 Producer 自批：REJECT_PRODUCER_SELF_APPROVAL；
8. 完整对象/关系图 + 独立 verifier：CANDIDATE_READY。

这只是 schema/probe 验证，不证明任何真实 Building 候选已经具备梁柱、门或地下室，也不证明结构安全。

## 外部老师

`NO_NOVELTY`。本轮新增来自真实失败对 N189 边界的暴露；没有外部来源在这个 bounded question 上提供超过“显式节点、typed relation、需求可追溯、独立验证”的必要新增，因此不扩充老师名单。

## 路由与状态

只路由到 #91 的实际 Building / Architecture 生产协调入口，不群发。请求对应 Mother 只回答四项：真实相关性、现有结构是否已覆盖、哪些字段值得吸收、最小真实源码试验。

当前：候选文件已保存，synthetic `GATE-RUN=true`。  
尚未：`ACKNOWLEDGED / IMPLEMENTED(production) / ADOPTED / USER-ACCEPTED`。  
未修改：main、R2 OS、公网页、任何生产 Mother 分支。  
KPI：unknown。
