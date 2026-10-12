# Mother 02:30 Coordination — EAR 语义解剖锚点 → Lip Reference Fidelity

- ID: `KAOPU-MOTHER-20261013-KX01`
- 实际开始：2026-10-13 02:33:23 +08:00
- 实际收束：2026-10-13 02:35:08 +08:00
- 主持：小妈协调端
- 真实 Mother 参与：0。两条定向留言已成功写入并回读；截至收束没有 ACK。写入成功不算参会、理解或采用。
- 生产修改：0；冻结成果、排程、学习飞轮修改：0。

## 会前读取与去重

已完整读取 `main@5bdd2d6aa4989ac6acedb99411c207c267b8937b` 的根 `AGENTS.md`、R2 Production OS、Reference Replication Gate、Freshness Gate，并回读 #91/#63、相关 Task Anchor、Delivery Receipt、Actions 与 regression comments。

- #91 最新仍为 N75 对错误“0 run”结论的撤回；本轮继续要求查询覆盖面和 head/run 绑定，但不把它重复包装成新知识。
- #63 最新仍为 Coast R03 公网运行失败的 subject 级结论，与本轮人物解剖对象无直接增量。
- 昨日 Denim→Tailor KX-20261012-01 仍未取得 Mother ACK；不重复发送。
- MP02 新收到 N141 碰撞老师候选，仍只是 `POSTED`，不是 Tailor 已采用。本轮不并行处理。
- 当前 `gh-pages@00c30eefb6f161ccb36a078b2a9330b2f826c976` 已继续移动；人物专项仍以各自 immutable fixed build 为 subject，不把 Pages 根头当成交付身份。

## 今日唯一问题

> EAR-R03 新暴露的“工程/拓扑检查全绿，不等于当前人物参考解剖保真”能否有限迁移到 Lip ET19-L3，并用一个可反驳试验区分结构可运行与参考形态成立？

## R2 任务核对

| 项目 | EAR-R03（方法源） | Lip ET19-L3（接收端） |
|---|---|---|
| taskId / object / defect | `EAR-R03.0`；当前人物左右耳；耳根/耳屏近景偏软、参考身份未绑定 | `ET19-L3`；原人物嘴唇；张嘴时内唇—牙龈边界偏硬，牙舌/整脸未达参考 |
| accepted baseline / baseSha | 用户耳部基线 `b2bb70362e2af7d8792b31d6340cf5565f83c685` | 用户 ET18 基线 `99defb97123d8101fefddf5aa039991446f557a8` |
| exact candidate | source/evidence `2cb1a37763893ccb68240190d3b15951515f17cc`；build `7e223fed91b389b9ff9b6709593930095b6120a4` | source `a5b98a90646493331207aa8c17b3c33a166e760a`；build `5b4997e6dca27106533022b4ab46164cea073818`；recovery evidence `37ff43ce53535474ca67abcaa20fff1921f55363` |
| 用户最后约束 | 深化耳形/质感；同一人物；结构联动而非整体拉扯；不搬外部耳网格 | 保留原人物与原嘴；真实几何唇沟、动作与材质；继续解决可见硬边/不真实质感，不用涂色或叠片伪装 |
| referenceSet / UNKNOWN | NIH 外耳语义与现有视觉参考；当前人物 approved reference digest、校准视角和生产阈值 UNKNOWN | 用户视频 SHA `55a40089...` 与内部老师来源；approved frame/view ledger、可比相机/表情/光照和语义阈值 UNKNOWN |
| forbidden routes | 外部网格替代、推断隐藏耳道、把多视图数量当完整解剖覆盖、Producer 自批 | 第二张嘴/外部头替代、涂黑口腔、仅提高纹理对比、闭口图补造隐藏湿线/牙龈、Producer 自批 |
| fresh head delta | N145 只新增分类回归与定向问题；无生产实现 | `37ff43c...` 只新增恢复验证/收据；运行时仍是 `5b4997e...`，无新视觉修订 |
| regression / gates | 63 candidate + 18 public scoped pass；N145 classification 6/6；生产 Reference Fidelity gate 未跑 | 原 39 local + 19 public；恢复 26 项 pass；原生拓扑/动作/档案/公网成立；Reference Fidelity gate 未跑 |
| 当前状态 | `HOLD_GATE_FAIL`（reference identity unbound；不否定 scoped功能通过） | `HOLD_GATE_FAIL`（reference identity unbound；不否定 fixed runtime/geometry通过） |

## 共同知识：语义锚点必须绑定状态、载体与可见性

EAR-R03 的新知识不是某组耳朵参数，而是一种观察纪律：

1. 工程门证明“能运行、能响应、能恢复、拓扑未坏”；参考门才判断“是否仍是目标对象的正确解剖关系”。
2. reference 需绑定 exact subject、digest、校准视角与状态；否则截图多不等于覆盖完整。
3. 每个语义锚点必须标明 carrier：原生拓扑、派生显示面、材质边界或动作状态。
4. 每个锚点必须标 `OBSERVED / OCCLUDED / UNKNOWN`；不可用看不见的画面补造隐藏结构。

映射到嘴唇时，最小 visible anchors 是：左右口角、Cupid’s bow 两峰与中谷、上下唇红缘、口裂、湿干线，以及张嘴状态下的内唇—牙龈过渡。

这不新增重复 regression case。失败类别与 N145 相同；今天只在第二个真实对象上检验其可迁移性。

## 明确决定

`KX-20261013-01 = POSTED_CANDIDATE_METHOD`。

- 责任端：Lip Mother / ET19-L3。
- EAR Mother 只提供观察方法，不替 Lip 实现或批准。
- 不改变两个 fixed build，不新开工作台。

已定向写入并回读：

- [Lip 接收说明](https://github.com/haihao0307/guilin-dem-pipeline/pull/224#issuecomment-6130303002)
- [EAR 状态/可见性边界回流](https://github.com/haihao0307/guilin-dem-pipeline/pull/226#issuecomment-6130303333)

截至收束：`POSTED=true`；`ACKNOWLEDGED / IMPLEMENTED / LIP-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

## 最小可反驳验证

锁定 ET19 fixed build、人物、动作、相机、灯光和材质，使用正面、45°、侧面和张嘴近景：

1. 建立上述语义 anchor ledger，并绑定批准的参考帧及可比条件。
2. 故意软化/错移一个口角或 Cupid’s bow，并把内唇—牙龈过渡改硬；保持现有 finite/topology/archive 检查仍可通过。
3. 新 gate 若不能检出注入错误，撤销 Candidate；若检出，也只证明这些反例有效。
4. 生产阈值在测量约定和独立 verifier 确认前保持 `UNKNOWN`。
5. fixed public URL 的桌面与 390×844 证据分开报告；390×844 不冒充实体手机。

## 未完成边界

没有 Lip/EAR 新生产实现，没有新 Reference Fidelity gate run，没有 Mother ACK，没有独立采用或用户验收。现有浏览器、拓扑和动作结果继续有效，但不能被提升为影视级参考解剖已验证。

## 交给学习飞轮的唯一问题

如何建立一个跨耳、唇、眼可复用、但仍绑定当前人物与具体状态的 reference-anatomy ledger：既表达语义身份、载体和可见性，又避免从未校准照片/视频硬造数值阈值？至少需要一次独立 verifier 对真实与注入反例的盲测，才能考虑从 Candidate 晋级。
