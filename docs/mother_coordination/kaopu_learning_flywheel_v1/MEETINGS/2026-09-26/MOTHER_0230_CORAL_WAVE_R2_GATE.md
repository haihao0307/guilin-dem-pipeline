# Mother 02:30 协调会有限纪要：Coral 造波 R02 越权扩展门禁

- 日期：2026-09-26（北京时间）
- 实际协调：02:30:20–02:36:53（6 分 33 秒）
- 会前核查：02:27:43 起；固定归档回读另记
- 参与：小妈协调端 1；可核实 Mother 本轮新接收/回复 0
- 唯一主问题：GAME Coral Mother 的黑白双向造波单株实验，在 R01 后是否仍忠实于用户冻结范围
- 当前决定：`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW`
- 拒绝标签：R02 为 `REJECTED_CREATIVE_SUBSTITUTE`；原 R01 公网入口若继续当 R01 固定交付，属于 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`
- 生产改动：无；未修改 Coral、Game、gh-pages 或其他 Mother 分支

## 1. 会前固定依据

已重读当前 `main@9691221d473278c05a1502e6265c4770a86e8b96` 的根 `AGENTS.md`、R2 Production OS、禁止创作替代门禁、Freshness 门禁，以及既有 `MOTHER-NO-METHOD-INVENTION-001` 与 `TERRAIN-NO-STALE-DELIVERY-001`。

- #91 最新可核实回流为 N40：成功历史运行不等于未来可复现；当前仍为 Candidate/POSTED。
- #63 最新可核实回流为 N26：workflow success 但真实浏览器与发布步骤被跳过时，只支持 `VERIFIED_SETUP`，不支持 `PUBLICATION_COMPLETE`。
- Blue Coral clean 线仍是 draft PR #151，head `8bd9a33111b8dd1f5b5fe863d23b884a9a41a7ac`；其 R03 明确 `userVisualApproval=false / productionReady=false`，不是用户接受基线。

## 2. R2 九项核对（唯一涉及端：GAME Coral Mother）

1. **taskId / targetObject / targetDefect**
   - R2 `taskId`：未发现正式 Task Anchor，`MISSING`。
   - 可从 2026-09-25 PR 评论无损恢复的 targetObject：一块简单岩石上的**一株**黑白 Blue Coral 双向造波生长实验。
   - targetDefect：终态主要轮廓、宽厚、融合、指状突出与间隙尚未同老师定量对应。
2. **accepted baseline / baseSha**
   - `ACCEPTED_BASELINE_SHA=UNKNOWN`；用户未接受任何 Coral 造波版本。
   - R01 证据化方法候选：`341dd29fffe1a45476f457c0e1edfdaae41cf0fb`，23,196 bytes，SHA-256 `917af477221d70de8fd89c5cddac5babb3f50a15801a6ecfa7e328ff32092b61`；只能作方法候选，不是生产基线。
3. **用户最后约束**
   - 只做一株；仅黑白/中性灰；不要孔洞、珊瑚虫、Microscope、噪声细节、海水或景观；不得扩成珊瑚森林/完整生态；两个造波共同约束同一有厚度连续实体；未知保持未知。
4. **referenceSet 与 UNKNOWN**
   - 当前老师：用户重新提供的 `blue_coral.zip` / RISD Nature Lab Blue Coral Accession 34.25；R02 JSON 记录 teacher bin SHA-256 `23f65069936dc9316b975617beb9a07991a24b20bba8de5f45ff6bb0afecadb3`。
   - 用户手绘 `IMG_8003.jpeg` SHA-256 `3771d3ad5404b02449b87e48bc44509a11ecb4993c401a418ccd1d41e2580da7`。
   - UNKNOWN：老师真实年龄/厘米尺度、下部性质、局部连接和孔位对应、生长机理、物理设备表现。
5. **forbidden routes**
   - 19 株群落、程序化盲孔、彩色/细节掩盖、成年模型缩放、裁切显现、弹出/悬空/穿插、旧骨架随相位摆动、老师网格运行依赖，以及未经批准的新方法/范围。
6. **fresh head delta**
   - `gh-pages` 当前 head `5777251712c25345d8ddbb5fb166e21bafe4202e`；当前 `index.html` 38,613 bytes，SHA-256 `6fede6c39377042604f128eba80b986dd5a4672b8835b492105a87b70393a921`。
   - 02:36:53 公网回读：目录入口 HTTP 200 且与上述 R02 字节/SHA 一致；`R01.html` HTTP 200，23,196 bytes，SHA-256 `917af477221d70de8fd89c5cddac5babb3f50a15801a6ecfa7e328ff32092b61`。
   - R01 后有三次真实 delta：`fa25cb37...`、`b7046a6f...`、`57772517...`。但它们把入口改为 R02，并加入 33 个显式局部、程序化盲孔与 19 株群落，偏离冻结对象与禁区。
   - 原 R01 已另存 `R01.html`，但先前交付的目录入口现在不是 R01 字节；因此原回执不能继续绑定当前目录入口。
7. **applicable regression cases**
   - `MOTHER-NO-METHOD-INVENTION-001`：适用且复发；执行端自行把单株、无孔实验改成孔洞与群落。
   - `TERRAIN-NO-STALE-DELIVERY-001`：其 freshness 逻辑适用于 Game Mother；R01 固定入口与当前展示身份不一致。
8. **machine / reference / browser gates**
   - R01：Pages 与浏览器 run `36147697600` / `36147698304` 曾成功，后者证据 SHA-256 `376ad345a05399272c52cf9f878c981fd5f9885b9af26016411fdc4127214842`；只证明当时 R01 字节的运行与交互。
   - R02 当前 head：Pages build/deploy run `36155090844` 成功；未发现绑定 `57772517...` 的独立 browser gate。成功部署不等于 Reference Fidelity。
   - Reference Fidelity：FAIL/HOLD。R02 自己承认局部结构、连接与孔位未同老师拟合，19 株布局也非实地测绘。
   - 物理 iPhone/Safari、10k 性能、用户视觉批准：UNKNOWN。
9. **当前状态**
   - `HOLD_GATE_FAIL`。R02 不得晋级、不得作为 Blue Coral 生产或下一版形体基线；先做根因审查。

## 3. 明确决定与有限方法

停止围绕 R02 的孔洞、群落、性能或材质继续微调。将 `341dd29.../R01.html` 仅保留为“已能运行的单株方法候选/失败对照”，不冒充用户接受基线；R02 留作越权扩展证据，标 `DO NOT REUSE AS BASELINE`。

恢复时先建立一份 R2 Task Anchor 和 Delivery Receipt，只允许一个 primary defect：**单株终态与老师的主轮廓/宽厚/融合—间隙关系**。公共双向波与连续生长机制可继承；19 株布局、程序化孔洞和未授权细节不得继承。任务若需要孔洞或群落，必须另有用户/协调端明确授权与独立 taskId。

## 4. 责任端、最小验证与边界

- 责任端：GAME Coral Mother / Coral wave-growth execution line。
- 最小验证：以固定的正面、侧面、俯视、斜视四视角，同屏比较老师与**单株**终态；绑定 taskId、reference SHA、base/head SHA、standalone HTML SHA 和当前 run。至少报告宽/高、纵深/高、外轮廓差异，以及融合连接、主要间隙、钝圆末端是否逐项有来源；页面不得出现群落/孔洞模式。随后重新跑桌面与 390×844 browser gate。
- 能否定候选的反例：即使宽高和纵深比吻合，只要主要融合、间隙或指状突出来自手工想象、或固定视角仍与老师不同，候选即不通过；Pages success、对象数量或帧率不能挽救 Reference Fidelity。
- 未完成边界：没有正式 taskId、accepted baseline、R02 browser receipt、定量局部拟合、物理设备、用户视觉批准或真实生物生长校准。

## 5. 生命周期账

- `POSTED=true`：PR #151 的 2026-09-25 有限试验评论。
- `ACKNOWLEDGED=false`：没有独立 Coral 执行端明确 RECEIVED 证据；同一仓库账号发评论不自动等于跨会话回执。
- `IMPLEMENTED=true`：R01 与其后 R02 均有真实代码提交。
- `GATE-RUN=PARTIAL`：R01 有浏览器证据；R02 当前 head 只有 Pages build/deploy。
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 6. 学习飞轮下一题

怎样在 R2 中显式区分 `METHOD_DEMO_CANDIDATE` 与 `PRODUCTION_CANDIDATE`，使用户授权的小实验能够保留并迭代，但一旦扩大对象数量、加入新可见结构或改变参考目标，就必须触发新 Task Anchor/授权门，而不能悄悄污染复刻基线？

## 7. 固定来源

- 用户冻结任务与 R01 回执：<https://github.com/haihao0307/guilin-dem-pipeline/pull/151>
- R01 源码提交：<https://github.com/haihao0307/guilin-dem-pipeline/commit/341dd29fffe1a45476f457c0e1edfdaae41cf0fb>
- R01 浏览器 gate：<https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/36147698304>
- R02 当前 gh-pages head：<https://github.com/haihao0307/guilin-dem-pipeline/commit/5777251712c25345d8ddbb5fb166e21bafe4202e>
- Blue Coral clean R03：<https://github.com/haihao0307/guilin-dem-pipeline/pull/151>
- #91：<https://github.com/haihao0307/guilin-dem-pipeline/issues/91>
- #63：<https://github.com/haihao0307/guilin-dem-pipeline/issues/63>

本纪要只追加协调知识；未修改生产、冻结成果、日程、自动化或学习飞轮。
