# 嘴唇局部修正的证据与回归判据

ID：KAOPU-MOTHER-20261020-LIP-RESPONSE-VS-CORRECTION

## 决定与责任端

保留 R04 已有的限定人工图审结论和技术通过证据，但不把“画面发生变化”晋级成“缺陷自动检查通过”。本轮只处理 Human/Lip PR308 的这一跨材质与验证问题。责任端为现有 Lip Mother；Human/Skin 是有实际接入任务时的后续接收端，不给服装、其他 Mother 新派生产。

相对 N173/N174 的增量有两点：补充完整程序末尾的非零响应断言，防止把单项测试误说成整个工作流；提供机械校验独立图审回执的有限路径，避免为赶进度发明通用美感阈值。既有 USER-CORRECTION-REGRESSION-BINDING-001 保持 Candidate，不新增重复 case、不改全局门禁。

## 实际时间与参与

会前读取开始于 2026-10-20 02:26:22 +08:00；正式主持核对开始于 02:30:15。结束时间见本记录末尾。只作主持整理，没有本轮真实 Mother 回复，没有独立专家或临时扮演参会者。

已读 main 5543f756ca3af1428323696324303fa70b8de850 根 AGENTS、R2 Production OS、Reference Replication、Task Freshness、Real 3D、Public Web Delivery 门禁。#91 仍到 N170，#63 仍到 N49；这些不是新回执。昨日协调纪要已读取，不重开完整存档入口问题。PR308 的 N173/N174 是学习留言，不是执行端 ACK。

## 九项核对

| 核对项 | 实际记录 |
|---|---|
| 唯一任务与目标 | TASK_ANCHOR version 为 LIP-INNER-R04；未另列 taskId 字段，不杜撰。对象是原人物口内回折皮肤，缺陷是开口时浅肤色楔面失去口内材质职责。 |
| baseline 与 baseSha | PR base 为 main 5543f756ca3af1428323696324303fa70b8de850；任务继承 R02 receipt 9684ffdda08cbec6afc01c69c2cebc37c9f76c9b，source01cfde47476b7be6764e9c6a79d925462511539b，buildba0c4eb337e03997878aecaf477d8ec3fe8b7231。此为技术父版本，非整体嘴唇用户接受基线。 |
| 最后约束 | 原人物、几何、变形、R02 外唇算法保留；不侵入并行 PR305/307，不以局部颜色修复关闭整体拟真。完整外部网页交付要求继续有效。 |
| referenceSet 与 UNKNOWN | 固定 R02 页面、原生 oral_skin_ids、live uniforms、真实对照与回执。组织光学未测量，剩余口角变形归因、动态连续性及其他人物覆盖未知；本轮没有读取到新的用户参考图。 |
| forbidden routes | REPLICATION_LOCKED，CREATIVE_AUTHORIZATION=false。禁止替代头模、生成图、凭审美平滑几何、强推/合并生产、套用砖或服装颜色算法、旧图冒充本轮新渲染。 |
| fresh head delta | 当前 head ab2641ef0bfe038aafd3956611590c9e4ab9d09e；source9d855c6051e76a20f052c95f0dda95103d946ef7；buildf70e40b301ea964956d9915ab820e4efe1105549。它们是 10月18日已有生产，本轮不冒称新产出。MucosaSurface.js、InnerLip.js、verify-inner.cjs 的 source/head Git blob 分别一致。 |
| regression 执行 | 生产已做状态保护、语义域、15 个 uniform 同对象、旧版关闭对照、三入口下载与新 context 恢复。N174 的10/10是隔离分类器报告，非缺陷图像 oracle 运行；本轮未重跑它。Bird/Fish/Boat/Terrain 旧 case 不假称执行。 |
| machine/reference/browser | Actions39110407426 API 为 completed/success，head 绑定上述 source，实际运行 2026-10-18。QA 为12/12；人工图审另有固定图身份绑定。受检自动浏览器视口1280×900，手工截图1338×1112；本轮查到的该套证据不含390×844，物理手机未验证。本轮不新开浏览器、不授予完整交付通过。 |
| 状态 | 针对“可执行缺陷回归闭合”保持 HOLD_GATE_FAIL；已有技术 IMPLEMENTED/GATE-RUN 及限定人工观察保留。整体拟真、完整交付和用户接受不晋级。今天新增生产工件为 NO_NEW_ARTIFACT，不表示研究无增量。 |

## 原始依据与本轮检查

原始文件：[Task Anchor](https://github.com/haihao0307/guilin-dem-pipeline/blob/ab2641ef0bfe038aafd3956611590c9e4ab9d09e/kaopu-unified-human-workbench/lip-inner-r04/TASK_ANCHOR.json)、[最终回执](https://github.com/haihao0307/guilin-dem-pipeline/blob/ab2641ef0bfe038aafd3956611590c9e4ab9d09e/kaopu-unified-human-workbench/lip-inner-r04/FINAL_AUDIT_RECEIPT.json)、[表面职责](https://github.com/haihao0307/guilin-dem-pipeline/blob/ab2641ef0bfe038aafd3956611590c9e4ab9d09e/kaopu-unified-human-workbench/lip-inner-r04/SURFACE_CONTRACT.json)、[源码](https://github.com/haihao0307/guilin-dem-pipeline/blob/ab2641ef0bfe038aafd3956611590c9e4ab9d09e/kaopu-unified-human-workbench/lip-inner-r04/MucosaSurface.js)、[检查器](https://github.com/haihao0307/guilin-dem-pipeline/blob/ab2641ef0bfe038aafd3956611590c9e4ab9d09e/kaopu-unified-human-workbench/lip-inner-r04/verification/verify-inner.cjs)、[实际 QA](https://github.com/haihao0307/guilin-dem-pipeline/blob/ab2641ef0bfe038aafd3956611590c9e4ab9d09e/kaopu-unified-human-workbench/lip-inner-r04/evidence/candidate-03/qa.json)、[图审绑定](https://github.com/haihao0307/guilin-dem-pipeline/blob/ab2641ef0bfe038aafd3956611590c9e4ab9d09e/kaopu-unified-human-workbench/lip-inner-r04/research/final-visual-binding.json)。

源码中的口内语义是连续的 vL19State.x，经 skin coverage、type 和原生 lip enable 限定；牙齿、牙龈、舌头不归此修复。颜色、roughness、clearcoat、内部可见度复用原有参数；并不等于实测黏膜光学。可共享的是“替换材质时保留表面身份及其职责，并在同一对象、姿态、灯光下区分影响”，不是直接复制这一套颜色系数。

N173 的限定图审报告：jaw/macro、jaw/oblique、speak/macro 有局部改善；neutral 无实际收益，pucker 弱。这是已有审核者对固定画面的观察，不是本主持本轮重新看图或新生产验收。

检查器第204–212行只保护同一状态、记录绝对像素差。第306行还要求 jaw/oblique 的 changedPixels > 0。因此：
- “每个成对测试本身没有方向判据”成立；
- “所有图都零变化也能通过完整工作流”不成立；
- “存在非零变化就证明浅楔面改善”也不成立。

本轮直接取该 difference() 函数做一个像素的隔离 CPU 计算，保留 alpha255：

| RGB变化 | changedPixels | 最大差值 | 平均最大差值 | 斜视响应谓词 |
|---|---:|---:|---:|---|
| 128→128 | 0 | 0 | 0 | false |
| 128→112 | 1 | 16 | 16 | true |
| 128→144 | 1 | 16 | 16 | true |

这仅反驳“绝对变化统计能区分方向”的解释；不是整套工作流重跑，也没有宣称实际 R04 更差或 synthetic pixel 就是组织。另一反例候选是把内壁压成黑色平面：浅色面积可能减少，但组织层次和接缝可能更坏。此反例尚未制作或渲染。

## 最小验证与有限方法

沿用一个现有 case，限定三个有明确改善报告的视图，保留 neutral/pucker 的不扰动观察，不把它们强行记成正向收益。两种判据分开：

1. **独立图审加机械回执校验，优先候选。** 在下一获准候选的验证中绑定精确 source/build、三对原始图摘要、缺陷描述、实际独立审核者身份、各对判定及 R02 known-bad 判定。机器只能检查回执完整、身份与图匹配、审核范围和决策；不能冒称自动评判美感。Producer 自签不能代替独立审核。相同字节可沿用对应旧观察但必须保留原日期/范围，不能当新生产；新像素必须重新审核。
2. **ROI及方向指标，待校准候选。** 固定语义域/ROI与比较条件后，才研究指标和阈值；必须同时拒绝旧浅楔面和压黑/平涂等反例，保护域外状态。阈值、重复性、硬件容差及成本当前未知，不以高饱和度或变化像素数替代。

最小可反驳检查是：正确且限定范围的独立回执可被校验；错图摘要、缺少一对、只审旧版本、Producer 自批、没有 known-bad 判定均不得放行。该检查是建议，尚未实现或运行。若回执仍能对错误图放行，说明证据绑定方案失败；即使绑定全部通过，也不自动证明视觉意见正确，更不等于用户接受。

## 未完成边界和学习接续

外唇蜡感、内壁平面感、薄过渡、机械接缝、口角牵拉、牙齿、连续动画、其他人物、390×844与实机仍未闭合。不得为解决这些未授权项重写几何或合并并行版本。

两次生产失败的原始原因已保留：初始化 GPU 等待、未渲染 draw cache 比较；不能从 candidateIteration=3 单独推断无限调参或同因复发，也不能删除失败历史。后续若同类失败再次发生，按原 R2 根因审查，不换 worker 碰运气。

飞轮接续一个问题：**如何把有理由、限定视图的独立人工判定接入现有回执，既能拒绝错图与自我批准，又不把人工判断伪装成自动视觉 oracle？** 沿用 N174 和现有 case，不扩为新格式工程。下一触发是 Lip 的实际回签或获准的新候选；不为今天汇报重跑生产。

## 实际回流与交付边界

已向 PR308 追加且逐字回读[增量澄清](https://github.com/haihao0307/guilin-dem-pipeline/pull/308#issuecomment-6274356026)，不重复 N174 的四个问题。POSTED=true；本轮没有真实 ACKNOWLEDGED、ADOPTED 或 USER-ACCEPTED。既有生产技术 IMPLEMENTED/GATE-RUN 与新建议未实现分别记录。本轮仅托管知识纪要，不称任何 Mother 已学会。

本任务没有生成图片替代三维，没有修改生产源码、发布新工作台或修改 main/冻结/排程。既有三维运行、交互与公网结果只引用其准确回执；本轮没有新的公网浏览器或设备验收。截图不代替工作台规则保持。纪要按照写作技能收窄结论和来源范围，保存到既有 GitHub 协调目录。

实际主持核对结束：2026-10-20 02:31:51 +08:00（UTC 2026-10-19 18:31:51）。正式阶段1分36秒，加会前来源读取；归档另计，不冒称30分钟会议或生产问题已解决。
