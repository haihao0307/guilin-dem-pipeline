# 全部 Mother 共用：任务新鲜度 / 禁止旧产物冒充新交付硬门禁

版本：1.0.0  
状态：PERMANENT / HARD GATE  
适用：全部 Mother / Codex / 子执行端 / Game / Fish / Bird / Boat / Terrain / Coral / Tree / Human / Aircraft / Material 等所有生产线。

## 0. 要解决的问题

用户已经明确交代“今晚做什么、明早看什么”之后，执行端不得第二天拿任务之前就存在的旧模型、旧网页、旧截图、旧视频、旧 release 或旧 QA 结果冒充本轮成果。

旧成果可以作为：
- baseline；
- before 对照；
- 参考；
- 回归样本。

旧成果**永远不能**作为：
- “我昨晚做出来的”；
- “最新版本”；
- “本轮修改结果”；
- “已经完成的新工作”。

没有新成果时，唯一诚实状态是 `NO_NEW_ARTIFACT`，而不是展示一个旧东西填空。

## 1. 每个明确任务必须有 Dispatch Anchor

当用户给出一个可执行的新任务，尤其是“今晚做、明早看”“继续改这个问题”“下一版重点修 X”，执行端必须记录一个短任务锚点：

```
taskId
instructionSummary
dispatchTime
branch
baseSha
targetObject
targetDefectOrChange
expectedArtifact
protectedInvariants
forbiddenSubstitutions
```

这个记录可以是 issue comment、receipt、JSON 或 Markdown，不要求长规划。

`baseSha` 是本任务开始前最后一个合法生产父节点。所有“本轮新成果”必须能证明发生在这个锚点之后。

## 2. Freshness Proof

任何声称“这是本轮新结果”的交付，至少必须给出以下一种可核实证据：

### 代码 / 几何任务
- headSha != baseSha；
- base..head diff 包含与目标对象相关的生产文件；
- 修改发生在 dispatch anchor 之后；
- 本轮测试针对 headSha 执行；
- receipt 中明确 base/head、命令、结果、限制。

### 视觉任务
截图、视频、浏览器页面必须来自当前 head 构建，并能通过至少一个机器可读标记绑定到当前版本，例如：
- `data-build-sha`；
- `sourceHead`；
- `build.json`；
- `PUBLICATION_PROOF.json`；
- 页面内版本标识与 commit 对应。

旧截图重新发送、旧公网 URL 重新打开、旧 release 重新截图，都不属于新视觉成果。

### 验证型任务
若用户本轮只要求“重新检查旧版本”，允许没有源码 diff，但必须有：
- 新执行的测试 / 浏览器 / 数值 run；
- run 时间在 dispatch 后；
- run 精确绑定被验证的 commit；
- 明确写 `VALIDATION_ONLY_NO_SOURCE_DELTA=true`。

不能把旧测试报告复制过来当新验证。

## 3. Target Fidelity：做的必须是用户交代的那个东西

即使有新 commit，如果做错对象，也不算任务完成。

执行端必须核对：
- targetObject 是否一致；
- targetDefectOrChange 是否一致；
- 使用的参考版本是否是用户指定的当前版本；
- 有没有把相邻任务、过去版本或“差不多的对象”替换进来。

例如：
- 用户要求新地形，不得把过去的旧地形重新展示；
- 用户要求修鸟，不得展示另一个旧鸟；
- 用户要求修船尾，不得只换灯光后展示旧船；
- 用户要求鱼的真实头部，不得把旧 generic fish 换颜色后交付。

发生这种情况统一标记：
`REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`

## 4. 禁止 Silent Fallback

如果最新构建失败、最新网页打不开、最新资产缺失，禁止自动回退并展示旧版本，却不告诉用户。

禁止：
- 最新页面 404 后自动打开旧 release 并称“这是当前效果”；
- 新模型加载失败后显示 fallback toy；
- 新地形失败后显示旧缓存地形；
- 新截图生成失败后发送上轮截图；
- mobile 失败后发送 desktop 结果冒充手机结果。

允许 fallback 仅用于保持服务不中断，但 UI / receipt 必须明确：
`FALLBACK_ACTIVE=true`
并且这个 fallback 不能作为本轮验收成果。

## 5. 昨晚任务 / 次日检查的冻结规则

如果用户在一天结束前已经明确：
- 今晚继续做的对象；
- 不允许改变的方向；
- 明早要看的结果；

那么次日开工第一步不是重新“理解任务”，而是读取最新 task anchor 与用户最后指令。

除非用户后来改了方向，否则不得：
- 重启一个新创意；
- 回退到更早路线；
- 重新选择目标；
- 重新规划一个不同版本；
- 拿旧版本给用户“先看”。

如果夜间没有完成，早晨必须返回：
`NO_NEW_ARTIFACT`
加真实 blocker / 未完成项；不得用旧产物掩盖。

## 6. 新结果必须是“变化后的对象”，不是“重新包装的对象”

以下都不算新的生产结果：
- 只改 README / task note / branch 名；
- 只重新发布同一字节；
- 只把旧 HTML 复制到新版本目录；
- 只换版本号；
- 只换截图裁切；
- 只换相机角度而用户要求的是形体变化；
- 只换灯光 / 背景而用户要求的是结构修复；
- 只重新运行旧测试且任务要求生产修改。

这些可以是运营 / QA 活动，但不能冒充目标生产进展。

## 7. Morning Review / 用户验收显示规则

给用户看的“最新效果”必须默认只显示：
1. 当前任务之后产生的新候选；
2. 必要时并排一个明确标注的 BEFORE baseline。

不得把 BEFORE 单独发给用户而不写清它是旧版本。

如果只有 baseline 而无新候选，直接报告：
`NO_NEW_ARTIFACT — baseline available, new candidate not produced`

## 8. 被发现旧产物冒充新交付时

一旦审计发现：
- artifact 早于 dispatch；
- screenshot 来自旧 head；
- public URL 指向旧 release；
- 当前 head 与展示结果不一致；
- targetObject 不是本轮对象；

执行以下处理：

1. 标记 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`；
2. 本轮“完成/进展”声明作废；
3. 旧产物降回 BASELINE_ONLY；
4. 不围绕这个错误交付继续做审美微调；
5. 回到 task anchor；
6. 若已有新代码，重新生成与 head 精确绑定的证据；
7. 若没有新代码，诚实标记 NO_NEW_ARTIFACT；
8. 保留失败证据，不 force push，不删历史。

## 9. 与 REPLICATION_LOCKED 的组合

参考复刻任务同时必须满足：
- `REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md`
- 本 `TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md`

因此一个有效的新复刻成果必须同时：
- 不是擅自创造；
- 不是旧产物复用；
- 是用户当前目标；
- 有 dispatch 后的真实生产变化；
- 有与当前 head 绑定的 QA / 视觉证据。

## 10. 强制交付回执

每次声称“这是最新结果”时，必须可以回答：

- [ ] taskId / dispatch anchor 是什么；
- [ ] baseSha 是什么；
- [ ] headSha 是什么；
- [ ] 哪些生产文件在 base..head 中改变；
- [ ] 改变是否直接对应 targetObject / targetDefect；
- [ ] 本轮测试是否在 head 上重新执行；
- [ ] 视觉证据是否来自 head，而不是旧截图/旧 URL；
- [ ] 是否发生 fallback；
- [ ] 是否存在 NO_NEW_ARTIFACT；
- [ ] 是否有任何旧版本被误写成“新版本”。

任一关键项无法证明，则不得向用户宣称“已更新”“这是今天的新版本”“已经做完”。

## 11. 核心原则

**旧东西可以保存，可以比较，可以回退，但不能冒充新工作。**

**没有新结果是一个诚实状态；拿旧结果充数是验收失败。**

**任务执行的第一责任是忠实完成用户已经明确交代的目标，而不是维持“我一直有东西可以展示”的表象。**
