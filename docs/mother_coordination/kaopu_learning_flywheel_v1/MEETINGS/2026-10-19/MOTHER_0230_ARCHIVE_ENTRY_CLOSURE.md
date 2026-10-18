# 完整人物存档入口与冷启动恢复协调核查

ID：KAOPU-MOTHER-20261019-ARCHIVE-ENTRY-CLOSURE

## 本轮决定

昨日“尚未验证全新 BrowserContext 恢复”的记录已被后继版本的新证据部分闭合：R01.1 有两个新 context 的恢复，R03 有本版本的一个新 context 恢复。不得继续把旧版 R01 的未知状态套到后继版本，也不得把 R01.1 的两次覆盖自动算成 R03 的两次覆盖。

可共享的有限方法：**完整档案正确，既需要内容充分，也需要所有承诺保存完整人物的 UI/API 入口真正调用当前档案链。** 只测顶部按钮或只比较函数引用不够。专项局部参数、网格导出不应被误接为完整人物档案。

责任端：当前 Lip Mother / PR307；PR305 是已检查的修复来源。Human 总台为未来接收端，本轮没有给它开新生产任务或批准合并。

## 时间和参与

- 实际核查及协调：2026-10-19 02:30:14–02:32:14 +08:00，2 分钟；归档回读另计。
- 主持整理；没有本轮真实 Mother 接收回复，没有独立专家调用。
- 读取最新 main 5543f756ca3af1428323696324303fa70b8de850 的根 AGENTS、R2 Production OS、Reference Replication、Task Freshness、Real 3D、Public Web Delivery gates，并按强制协议执行。
- #91 最新仍至 N170；#63 仍是 N49。PR303 新增 N171/N172 为协调/学习留言，不作生产端确认。
- PR305 已有 [N171 正控核查留言](https://github.com/haihao0307/guilin-dem-pipeline/pull/305#issuecomment-6247246975)，因此不重复投递同一冷恢复指导。PR307 没有回复。本轮只向协调分支追加本记录。
- main、生产分支、冻结成果、其他任务与排程均未修改。

## 九项核对

| 项目 | R01.1 修复来源与 R03 当前责任端 |
|---|---|
| 唯一 taskId / 对象 / 缺陷 | R01.1：LIP-ARCHIVE-RECOVERY-R01-1-20261018，同一 R07 人物完整保存/载入入口漏存嘴唇；R03：LIP-DETAIL-R03-20261018，同一人物的规律细纹，档案完整性是受保护条件，不能用本会改成另一个生产目标。 |
| accepted baseline / baseSha | R01.1 base 为 3cc02b999bc9b5bc9310194e65950948500740d3；R03 base 为 57cfade66fb37c260df1dcd836f5cd239cccef41。后者明确是证据化技术父版本，不是用户视觉接受。原 R07 已接受皮肤范围不受影响。 |
| 用户最后约束 | 接续真实嘴唇专项，保护并行皮肤和 lip-control-contract；R03 不改变唇色、湿润、几何、灯光，不侵入 PR306 颜色线。 |
| referenceSet / UNKNOWN | R01/R07 固定源码、实际 QA、原生档案链；R03 参考固定 R01.1、原生 rails 和已有研究。个体唇纹测量、口腔和口角解剖仍未知；未借此证明拟真。 |
| forbidden routes | 默认 REPLICATION_LOCKED、creative=false；无替代网格、生成图、颜色掩盖细纹、旧证据冒充新结果、静默解释 R02 档案、改主线或跨分支覆盖。 |
| fresh head delta | R01.1 head 57cfade66fb37c260df1dcd836f5cd239cccef41，source489eb0b1520603bb3ddb65f0ec5f12140a2e7e97，build36e5e11a13ba299915dc07e1800c72973f0f7e44；R03 head e0349af4301760ac79807b9d1aa0b9eb0d6447ea，source64035bd49dae68e7d7451b44340d65842134e4b5，build292e7f3aa6293a35752e17211c227adb59f2c384。写前重新核对两 head 未变。 |
| 适用 regression | VISUAL-STATE-ROUNDTRIP-001 及 N171 fresh-context 扩展。R01.1 两 reader；R03 单 reader，不声称本版本已满足两 reader 扩展全项。错误身份、旧档降级、schema/颜色冲突控制分别记录；未新建重复 case。Bird/Fish/Boat/Terrain 模式不因今天讨论档案而伪称重跑。 |
| machine/reference/browser | 两个 Actions 的实际 API 均 completed/success，且 head 与验证 SHA 一致。受检 qa.json、源码、发布证明及独立审核记录相互支持下面的局部结论。桌面/390×844 属既有运行证据，非本轮浏览器重跑；物理手机、跨进程重启和整体拟真未验收。 |
| 状态 | R01.1 bounded archive repair：CANDIDATE_READY；R03 局部技术候选已发布且有独立审核，档案本轮观察为 CANDIDATE_READY 范围内的单 context 证据。整体嘴唇拟真、跨支线整合和用户视觉接受不能据此晋级 ACCEPTED_BASELINE。 |

## 新证据与有限论证

[PR305 Task Anchor](https://github.com/haihao0307/guilin-dem-pipeline/blob/57cfade66fb37c260df1dcd836f5cd239cccef41/kaopu-unified-human-workbench/lip-realism-r01-1/TASK_ANCHOR.json) 和 [实际 qa.json](https://github.com/haihao0307/guilin-dem-pipeline/blob/57cfade66fb37c260df1dcd836f5cd239cccef41/kaopu-unified-human-workbench/lip-realism-r01-1/qa/fresh-context/39095533327-1/qa.json) 记录：

- 原 R01 的头部/全身旧保存按钮实际各导出 23,761 bytes，缺少 lipRealism 和 calibration；同页最新顶部档案已有这些字段。这区分了“序列化器本身漏字段”和“入口仍调用旧闭包”两种解释。
- 修复后顶部、旧头部、旧全身、body save API 的四份完整人物 JSON 都为 2,142,762 bytes，同一 SHA256 b4997d2a61ec816c634b39f27f1ff6cfd15be0d80acff681606df97cf0b5dd82。大小增加本身不是通过依据；内容、下载和恢复结果才是依据。
- [LipSurface.js](https://github.com/haihao0307/guilin-dem-pipeline/blob/57cfade66fb37c260df1dcd836f5cd239cccef41/kaopu-unified-human-workbench/lip-realism-r01-1/LipSurface.js) 将 API 在调用时委托到当前 controller；旧按钮因旧 panel 提前截断事件，使用祖先 capture 接管限定完整人物按钮。保留局部导出，不把此宿主的事件捕获实现当通用可照搬代码。
- [verify-fresh.cjs](https://github.com/haihao0307/guilin-dem-pipeline/blob/57cfade66fb37c260df1dcd836f5cd239cccef41/kaopu-unified-human-workbench/lip-realism-r01-1/verify-fresh.cjs) 真正点保存按钮、读磁盘 JSON，关闭 producer page/context，之后分别在新 context 经 #ps-file 和 #lr-file 输入恢复，再调用正常 native update。不是直接注入完整 JS 内存或第二个同 context 页面。
- 本轮对仓库 producer.json / reader-1.json / reader-2.json 作对象键排序后的完整 snapshot 静态比较：两 reader 的 geometry、calibration、parameters、comparisonConditions 均与 producer 相同；frame 记录和输入文件 digest 也相同。此为新的记录一致性核对，不是独立重渲染、PNG 解码或重新下载原始 ZIP。
- [run39095533327](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39095533327) 9/9；[发布证明](https://github.com/haihao0307/guilin-dem-pipeline/blob/57cfade66fb37c260df1dcd836f5cd239cccef41/kaopu-unified-human-workbench/lip-realism-r01-1/PUBLICATION_PROOF.json) 与 [独立审查记录](https://github.com/haihao0307/guilin-dem-pipeline/blob/57cfade66fb37c260df1dcd836f5cd239cccef41/kaopu-unified-human-workbench/lip-realism-r01-1/RECOVERY_REVIEW.json) 保留软件图形、视口与用户验收边界。

[PR307 Task Anchor](https://github.com/haihao0307/guilin-dem-pipeline/blob/e0349af4301760ac79807b9d1aa0b9eb0d6447ea/kaopu-unified-human-workbench/lip-realism-r03/TASK_ANCHOR.json)、[本次完整运行](https://github.com/haihao0307/guilin-dem-pipeline/blob/e0349af4301760ac79807b9d1aa0b9eb0d6447ea/kaopu-unified-human-workbench/lip-realism-r03/qa/detail-r03/39106266137-1/qa.json) 和 [档案独立审查](https://github.com/haihao0307/guilin-dem-pipeline/blob/e0349af4301760ac79807b9d1aa0b9eb0d6447ea/kaopu-unified-human-workbench/lip-realism-r03/INDEPENDENT_ARCHIVE_REVIEW_39106266137.json) 表明：

- R03 继承修复的完整人物入口，但档案变为 schema v2 / surfaceRevision。四个保存入口同为 2,142,819 bytes，SHA256 d5bccb06852a0157af4387a16e259d324c7dc11b5fec976f6e24889b44ea2ae0。
- 本版本 producer context 关闭后 23ms 才建立 reader，真实文件输入、native update 和受控完整画面恢复有记录；当前只是一份非默认 P02 张口人物、一个新 context。
- R01/R01.1 v1 显式映射旧细纹版本；R02 颜色档案、未知 schema/revision 和错身份由九种反例检查在修改前拒绝。读得进 JSON 不等于语义兼容。
- [run39106266137](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39106266137) 15/15，实际 source/verification 为64035bd49dae68e7d7451b44340d65842134e4b5；不使用先前失败轮补齐本轮冷恢复通过。
- 同一 Chromium 进程内新 context 不等于重启浏览器进程、操作系统或换设备。相机和中性检查灯光是重新施加的比较条件，不宣称已入人物档案。

R01.1 到 R03 的继承及再验证已有代码和运行证据，不能再记成“尚无任何实现”。但没有证据说明这些实现是对协调留言的明确确认或体系级采用，不能伪造交流因果。

## 最小验证与未完成边界

当前 R01.1 的昨天最小验证已完成，不再安排重复生产。下一实际触发是 Human 总台获准接入或完整人物入口再次变更：

1. 在该次准确 source/build 上枚举所有承诺“完整人物”的按钮和 API，排除明确的局部参数/网格导出。
2. 用一个非默认人物从各入口实际导出，比较完整档案内容/digest；保留旧闭包漏字段作为隔离失败样本，验证 gate 能识别“顶部正确但旧入口错误”。
3. 按本版本宣称的恢复范围在新 context 从实际文件导入，检查正常 native update 后的参数、校准、几何和受控实际画面。需要宣称 N171 的重复可移植性时，在同一新版本增加第二独立 reader，不借旧版测试填空。
4. 版本或支线语义未知时明确拒绝或声明迁移策略；不得把 R02 颜色数据静默当成 R03 表面参数。

这不是本轮新生产授权，不要求 R03 为汇报重跑或延误当前唯一细纹目标。人物总台集成仍待明确 task anchor、当前构建门禁和用户验收。

## 飞轮继续研究的问题

怎样从“完整保存”的产品承诺建立一个短而可执行的入口覆盖清单，使测试能发现闭包、事件拦截和新插件导致的旧路由，同时不误接局部导出？

现有反例已具备：同一人物顶部完整、旧面板遗漏。下一试验应只改变一个旧入口的委托目标；如果 gate 只看 controller/API 引用而仍放行，则入口覆盖方法被反驳。无需新造宏大档案格式。沿用现有 VISUAL-STATE-ROUNDTRIP-001，不新增重复制度或更改其全局激活状态。

## 生命周期和交付检查

- POSTED：已有 N171 留言；本轮共享为本协调纪要，不重复评论。
- ACKNOWLEDGED：没有真实 Mother 对本会或既有留言的新回复。
- IMPLEMENTED / GATE-RUN：R01.1 和 R03 对上述限定范围有真实生产源码与运行；本轮仅审读和静态 JSON 比较。
- ADOPTED：有 R03 代码继承这一事实，但未确认全体系采用或由协调留言促成。
- USER-ACCEPTED：两个 lip 候选均为 false；不得覆盖已接受 R07 皮肤范围。
- 没有生成图片替代三维；本会未修改生产源码、未发布新工作台。既有实时三维、交互、公网、桌面/390×844 检查引用其对应 receipt，不冒充本轮浏览器验收或实机。只有截图不能交付规则保持。
