# R10 动态布料共同原因核查

本轮只处理 Tailor MP05 R10 的裆部变形、折叠与身体穿插。决定维持动态布料 `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW`，保留已完成界面与现有生产边界；下一项为同一物理步的逐阶段联合测量，不批准更换求解架构或第五轮盲调。

- 记录 ID：KAOPU-MOTHER-20261017-CLOTH-RCA-01。
- 实际核查开始：2026-10-17 02:30:29 +08；核查及定向回流结束：02:34:13 +08。归档在后，未为凑时延长会议。
- 主持：小妈协调端；真实 Mother 新参与及新回执：0；独立专家：0。本轮是主持核查与定向回流，不模拟会话。
- 生产代码、main、生产 Mother 分支、冻结、日程与学习飞轮均未修改。

## 当前证据与去重

已读 main `1e09ffec5b6b74d89b25e48afc4c487451db4e34` 的根 AGENTS、R2 OS、Reference Replication Gate、Freshness Gate。协调基线 `ff3d27236b6fb4eb3f55126687e648566d920d26`。昨日拒绝后代隔离议题不重复发。

#91 新增 N164/N165 是能力承诺及“目录不等于原件”候选回流，仍仅 POSTED，不算生产采用；#63 最新仍为 N49 Coast 公开运行失败。本轮不重复其学习，不外推到 R10。PR #301/#302 头发更新已用于选题比较，未作为参会或完成证据。

本轮原始生产来源是 [PR #283](https://github.com/haihao0307/guilin-dem-pipeline/pull/283) 的固定 head `bd430222b3c62819bdf38d2c84d4bf3eec8ac5be`，2026-10-16 06:24:07Z 新提交；PR 仍 Draft。以下数字为生产端提交的报告，协调端核对源码及 JSON，**没有重跑浏览器或物理求解**。

| R2 检查 | 本轮真实状态 |
| --- | --- |
| 唯一 taskId / targetObject / targetDefect | 可见称谓 MP05 R10；当前对象为原生人物上的 P01/P02/P04 裤型；缺陷为动态布面过拉、压缩与穿插。未找到完整 R2 taskId/dispatch anchor，不能自造已接收任务。 |
| accepted baseline / baseSha | R10_STUDIO 报告工作分支基线 3c1d96911dd5add759a7b71a3aa72c1a58161b64；R09 runtime tree 1fb8036d09d96f6eac307946cd3a4991202a1614；PR base 7ed6ce55684965026188e06436ac91525526e762。均不是完整动态衣物的用户接受证明。 |
| 用户最后约束 | 生产报告记录用户追加实际检查裤裆、折叠、拉伸；保留已有 UI、原人物动作与原纸样。当前聊天未提供该生产会话完整原文。 |
| referenceSet / UNKNOWN | 原二维材料 UV、原人物、原动作及固定运行时；物理材料标定、完整接触/自接触、用户验收 UNKNOWN 或明确未通过。 |
| forbidden routes | 遮洞层、隐藏人体、预烘焙动作、改纸样/对象、降低门槛、未经批准改架构、把材质/帧率当物理通过。REPLICATION_LOCKED；无新增创作授权。 |
| fresh head delta | R09→R10 的新界面/缩略图及实际失败报告；A/B/C/D 试验未替换公开运行时。固定公开 runtime tree 3fc034fa91efc77c31656493d7638ef5ff6047c3 与报告 head 分开记录。 |
| applicable regressions | MOTHER-NO-METHOD-INVENTION-001 强制边界保留；SOLVER-FAILURE-NOT-INFEASIBILITY-001 和 FINAL-CLAIM-CLOSURE-001 仅复用其候选方法边界，不宣布全域采用。没有这些案例针对当前 head 的新执行回执。本轮不新增同义案例。 |
| machine / reference / browser | 已有刚体、各向异性、剪切测量校验 3 项报告通过；UI 检查不能覆盖物理。动态变形和全裤接触失败；独立本轮浏览器、390×844、手机实机及 reference fidelity 未执行/未确认。 |
| 状态 | 动态布料 HOLD_GATE_FAIL + ROOT_CAUSE_REVIEW；UI 可用范围保留，不提升为整衣 CANDIDATE_READY 或 ACCEPTED_BASELINE。 |

## 核对后的反例与方法

[动态复查](https://github.com/haihao0307/guilin-dem-pipeline/blob/bd430222b3c62819bdf38d2c84d4bf3eec8ac5be/kaopu-tailor-workbench/material-products/continuous-demand-r10/docs/R10_DYNAMIC_CLOTH_REVIEW.md)、
[主应变原报告](https://github.com/haihao0307/guilin-dem-pipeline/blob/bd430222b3c62819bdf38d2c84d4bf3eec8ac5be/kaopu-tailor-workbench/material-products/continuous-demand-r10/qa/r10-deformation-review.json)、
[全裤接触原报告](https://github.com/haihao0307/guilin-dem-pipeline/blob/bd430222b3c62819bdf38d2c84d4bf3eec8ac5be/kaopu-tailor-workbench/material-products/continuous-demand-r10/qa/r10-whole-contact-review.json)：

- 跑步第45物理帧，裆部对原二维纸样最大主拉伸的面积加权95分位：P01 1.64294、P02 1.83247、P04 1.70851；1 表示原长度，不是百分比。
- 局部接缝采样约为正4mm；另一全裤接触报告在 P02/run45 测到最小重心距离 -43.063mm，53 个重心及29个显示顶点为负。两份报告为各自运行，不冒称逐字节相同帧快照；它们已足以反驳“局部通过能覆盖全裤”的推理。
- A/B/C/D 均被执行端拒绝，报告已开始根因复查；不能只凭四个标签认定四次同一 bounded task 违规，也不能以继续换标签逃避 R2 两次失败升级。现在不再开第五条盲调路线。
- [ReducedCloth](https://github.com/haihao0307/guilin-dem-pipeline/blob/bd430222b3c62819bdf38d2c84d4bf3eec8ac5be/kaopu-tailor-workbench/material-products/continuous-demand-r10/r10-studio/reduced-cloth.mjs) 的邻域项比较 delta 差；expand 重建为 fineRef 加插值 delta，随后地面截断及 projectFine。报告指出原 UV 材料膜/二面角未在这条实时路径完整求解。源码支持这一结构性缺口，尚不支持量化哪一步贡献最大。

可跨材质、服装及人体接口复用的是：**在同一材料载体、同一身体时间上检查各阶段的联合误差，而非借用材质外观成功或接缝局部成功。** 原二维 UV 是材料度量来源，初始试穿仅为额外对照。三项理想校验不证明全部退化网格或真实布料标定正确；测量代码会跳过极小面积/退化项，须显式记录未测范围而非算作通过。

## 一个责任端与最小验证

责任端：Tailor / MP05 R10。Human 人物及材料源只是受保护输入，本轮不派给其他 Mother 改代码。

仅需固定 P02、当前人物和 run，从 reset 回放至第45步；不新增资产或替换生产算法：
1. 冻结 task anchor、原纸样/材料与人物身份、runtime tree、步长、初值和身体 revision。
2. 在参考随动、区域求解、细网格重建、地面截断、projectFine、最终输出处保存对齐状态；中间表示不同则声明只读重建方式，不能为了记录再执行一次接触。
3. 用同一材料三角形 ID，同步记录主拉伸、面积比、全裤接触、接缝残差、退化/未测范围、模拟秒与墙钟。找首次恶化并保留后续残差，不以单指标下降授予通过。
4. 正控复用刚体/已知伸长/剪切；记录开启与关闭应保持最终物理状态一致，排除测量扰动。阈值事先声明，真实布料阈值未标定则保持 UNKNOWN。
5. 对比解释：参考先坏→查绑定/基准；接触改好而度量恶化→查约束竞争；阶段记录不复现→查时序/度量。此为判别设计，未执行、未认定唯一根因。

技术修复仍未完成；公开页面存在也不等于动态衣物交付完成。视觉候选须另有 exact head 的固定公开入口、桌面及390×844新证据；手机视口不能冒充实机。不存在本轮公开工作台交付。

## 定向回流与接续

[PR #283 定向留言](https://github.com/haihao0307/guilin-dem-pipeline/pull/283#issuecomment-6222200420) 已写入并全文比对回读。仅 POSTED；ACKNOWLEDGED、本方法 IMPLEMENTED、本方法 GATE-RUN、ADOPTED、USER-ACCEPTED 均无。原生产报告的历史测试不挪作本方法测试。

交给飞轮的一个问题：在受保护原纸样与人物动作下，如何用最小阶段残差证据区分“参考随动已损坏度量”和“接触修正破坏度量”，并判断局部膜/弯曲/接触协调是否足够，而不提前决定全局重写或误宣称纸样不可行？接续触发是上述一次可复放 trace 或现有等价证据，不是新增会议、全员回签或重发旧截图。

## 交付检查

- 没有生成图片代替三维实现：是。
- 实际修改生产源码：否，本轮仅协调核查与知识回流。
- 可交互三维工作台与实时画面：未作为本轮交付，不声明通过。
- 公网固定链接与真实浏览器：本轮未重验，动态成品交付未完成。
- 只有截图不能通过：保留。
