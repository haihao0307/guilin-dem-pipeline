# N50 — Tree 发育因果分离门禁（Candidate）

- 日期：2026-10-01
- 对象：Tree Life Grammar R04，单 Mother 试验
- 状态：`Candidate / GATE-RUN`；不是全局制度，不是生产批准
- bounded question：能否用可执行证据区分“真实发育拓扑与状态历史”和“成年树整体缩放／根系倒置分枝替代”？

## 1. 现有真实失败

协调提交 `474c8f842e88cb7887817bf90a9fe300d29db65b` 记录 Tree R03 已被真实 iPhone 用户拒绝：根颈硬断、地下圆柱、根像向下复制的枝条、年龄主要表现为成年语法缩放，并缺少芽竞争、休眠／激活和根冠分配。R03 必须保持 `HOLD_GATE_FAIL / USER_REJECTED / DO_NOT_REUSE_AS_BASELINE`；R04 仍是 `BLOCKED_VALID / NO_NEW_ARTIFACT`。

对 R03 历史产物 `785d0db1f2fbb1a1f543deec422092c2ec589e71` 的源码审计增加了两条可复核事实：

1. `age` 先计算单一 `ageScale`，随后只改写 `trunkLength` 与 `radius`；分枝数量变化可由 `minLength/minRadius` 阈值偶然触发，因此“节点数变多”并不能证明存在发育事件。
2. `rootGrow` 虽单独命名，却仍是固定向下偏转的递归分枝；源码没有土壤湿度场、根器官状态转移或可追溯的出生／激活事件。

R03 证据锚：HTML 29,557 bytes，SHA-256 `d9824aa0d5ec8ebacdd0e25e319463095432a00803759f2c6589c7d0a22449ae`，gh-pages blob `a1868432a3f0f030c1deb91bb576b0675c394ed1`。

## 2. 外部方法与证据

- Godin 与 Caraglio 的 MTG 把植物结构表为多尺度、带属性、随时间变化的拓扑，而不是只把一个静态几何体放大：[PubMed / DOI 10.1006/jtbi.1997.0561](https://pubmed.ncbi.nlm.nih.gov/9593655/)。
- Pałubicki 等人的自组织树模型让形态从芽和枝对光／空间的竞争以及内部信号中产生：[Algorithmic Botany, 2009](https://algorithmicbotany.org/papers/selforg.sig2009.html)。
- Robbins 与 Dinneny 的 hydropatterning 实验表明，局部水可用性会定位侧根分枝，且响应有发育能力窗口：[PNAS / PMCID PMC5789911](https://pmc.ncbi.nlm.nih.gov/articles/PMC5789911/)。
- Metamorphic testing 用输入变换与输出关系缓解难以建立完整真值 oracle 的问题；此处把“翻转非均匀光场／土壤湿度场”转换成可执行关系，而不是把论文结论当视觉评分：[Chen et al., 1998 report reprint](https://arxiv.org/abs/2002.12543)。

## 3. 与 KAOPU 当前制度比较

现有 Tree grammar 已要求年龄不能只是缩放、根不能只是枝条镜像，并要求 Truth／Score／Anchor 分层；`REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE` 与 R2 OS 也已禁止用语义替代和自批。

本轮新增不是这些原则的复述，而是一个可反驳的执行口径：

- 阶段边界必须有来源事实；同阶段邻近时间应为 `NOT_APPLICABLE_STAGE_BOUNDARY`，不能制造误报。
- 拓扑差异必须绑定稳定器官 ID 和状态改变事件；仅分枝数变化不算发育证据。
- 分别翻转非均匀光场与土壤湿度场，检查冠层和根系的专属响应。
- 若根／冠由一个通用递归产生相同或符号反射的响应签名，则判为替代。
- 根颈位置和切向连续性必须单独通过。

因此结论是 `novel Candidate`，不是 `no-novelty`；它只补足 Tree 门禁的机器判定层，不改 R2 OS。

## 4. 可反驳假设

对一次来源支持的阶段跨越，若同时要求：器官谱系／状态事件、正交光场与土壤场干预、冠层光响应、根系水响应以及根颈连续性，则门禁应拒绝 R03 与整体缩放／镜像替代，同时允许一个具备显式发育历史与独立根冠因果通道的合法候选。

反证条件：合法候选被误拒，或任一整体缩放、无事件谱系、根冠镜像、无光响应、无土壤响应、根颈断裂样例被放行。

## 5. 最小历史回放

执行：

```text
node PROBES/tree_developmental_causal_gate_n50.mjs \
  PROBES/tree_developmental_causal_fixture_n50.json \
  PROBES/tree_developmental_causal_result_n50.json
```

结果：`10 / 10 passed`，`0 failed`。

| 回放样例 | 预期／实际首要状态 |
|---|---|
| 历史 Tree R03 | `HOLD_DEVELOPMENT_ONLY_SCALAR` |
| 来源约束的因果候选 | `TREE_CAUSAL_SEPARATION_VERIFIED_ONLY` |
| 分枝数变化但无事件谱系 | `HOLD_TOPOLOGY_WITHOUT_EVENT_LINEAGE` |
| 成年语法整体缩放 | `HOLD_DEVELOPMENT_ONLY_SCALAR` |
| 根冠镜像递归 | `HOLD_ROOT_SHOOT_RESPONSE_CONFLATED` |
| 根不响应土壤场 | `HOLD_ROOT_SOIL_RESPONSE_MISSING` |
| 冠不响应光场 | `HOLD_SHOOT_LIGHT_RESPONSE_MISSING` |
| 根颈断裂 | `HOLD_COLLAR_DISCONTINUITY` |
| 同阶段无事件 | `NOT_APPLICABLE_STAGE_BOUNDARY` |
| 均匀场伪干预 | `HOLD_LIGHT_INTERVENTION_INADEQUATE`（并记录 soil hold） |

## 6. 适用边界

- 仅适用于跨越来源支持的发育阶段边界；同阶段邻近帧不是发育事件测试对象。
- 光／水干预必须非均匀且可翻转；均匀缩放不能证明因果响应。
- 响应阈值必须由 Tree R04 的物种／来源 Anchor 约束，本 Candidate 不提供全局固定生物学阈值。
- 根冠可以耦合，但不得由未声明因果通道的一套递归产生相同或镜像响应。
- 通过只表示“发育因果分离已验证”；不表示物种身份、3A、浏览器交付或用户验收通过。
- R03 继续保留为 rejected lineage；R04 在 Task Anchor、reference set 与独立 verifier 就绪前继续 blocked。

## 7. 是否采用

决定：只作为 Tree R04 单 Mother `Candidate` 路由，等待真实 ACK 和新候选的独立 verifier gate；不全局采用，不修改 main／gh-pages／生产分支。

状态：

- `POSTED`: true（Tree 定向路由：[#91 comment 5918506982](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5918506982)）
- `ACKNOWLEDGED`: false
- `IMPLEMENTED`: true（仅 Candidate 检查器）
- `GATE-RUN`: true（10/10 历史／合成回放）
- `ADOPTED`: false
- `USER-ACCEPTED`: false

## 8. 效果指标

首次候选通过率、用户纠错次数、同类错误复发率、rejected lineage 继承次数、stale delivery 次数、每个 accepted delta 的内部迭代数、从用户指令到合法 candidate 的时间：`unknown`。本轮没有新的生产候选或真实用户验收，不造 KPI。
