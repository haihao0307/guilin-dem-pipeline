# Mother 02:30 — Material R17 客户端状态污染与错误目标交付门（2026-10-06）

- 会议编号：`KAOPU-MOTHER-20261006-MATERIAL-R17-STATE-ISOLATION`
- 实际开始：2026-10-06 02:30:54 CST
- 实际收束：2026-10-06 02:34:33 CST
- 参与：小妈主持核查；没有 Material Mother 新 ACK，不冒称参会、理解或采用
- 生产修改：无；未修改 main、gh-pages、生产 Mother 分支、冻结成果或排程
- 当前引用：`main@5bdd2d6aa4989ac6acedb99411c207c267b8937b`；`gh-pages@8eb860d12334023827157f2efe334b646377d063`

## 本轮唯一问题

R17 六个视频程序材质样例的成功工作流，是否证明当前固定网页已经交付；以及新版本是否保持了 R16 已确认参数状态？

## R2 Task Anchor 核对

| 字段 | 结果 |
|---|---|
| taskId | `UNKNOWN`：当前 main 未检索到 R17 正式 Task Anchor / Delivery Receipt |
| targetObject | R16 四块原有材质锚点之上的 R17 六个函数材质学习样例 |
| targetDefect | 新学习不得覆盖旧锚点、不得污染 R16 本机参数、不得用历史 R17 运行证明当前已回退的固定入口 |
| accepted baseline / baseSha | 固定入口当前明确恢复为 R16；绑定用户接受的正式 baseSha 仍 `UNKNOWN` |
| 用户最后约束 | 继承既有能力；固定公网链接；当前版本、桌面与 390×844 分开验证；视口不冒充实机 |
| referenceSet / UNKNOWN | 视频学习来源和 R17 shader 可读；用户接受的样例外观、完整 R16 参数快照及受影响客户端数量 `UNKNOWN` |
| forbidden routes | candidate 写入 accepted baseline 的存储键；以查询参数伪装版本切换；以回退前工作流证明回退后固定入口；重新覆盖旧状态 |
| fresh head delta | main 新增 R17 工作流；gh-pages 曾发布 R17，随后提交 `f8c5c3ac...` 恢复 R16 固定入口并隔离 R17 writer |
| regression cases | 新建 Candidate `CLIENT-STATE-VERSION-ISOLATION-001`；同时适用 Task Freshness / no-stale-delivery gate |
| gates | Contract：缺；Freshness：当前入口与运行 subject 不一致；Reference Fidelity：Unknown；Machine：历史 R17 scoped pass；当前 browser：R16 且 WebGL2 fail |
| 当前状态 | **`HOLD_GATE_FAIL` + `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`（仅针对把 R17 称作当前固定交付）** |

## 已核实事实

1. R17 初版 `lab-r17/studio.js` 的保存函数把 `version:17` payload 写入旧键 `KAOPU_MATERIAL_R16`，构成跨版本客户端状态碰撞。
2. 后续 `f8c5c3acbbee23799b341ca46dbc659cfce99ce3` 已停止旧 writer、恢复 R16 固定入口，并备份当前旧键字节；但其页面也明确承认：若覆盖已经发生，无法自动还原覆盖前的 R16 值。
3. R17 工作流 run [37285478301](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37285478301) 绑定 `main@5bdd2d6...`，job `111683243818` 成功；artifact `11333674916` digest `sha256:14d7647d6912618f761dec5ca8b2096ec42f128f6285b78d8760baf0e949e8b7`。
4. 该运行发生时固定页面还是 R17；之后 gh-pages 已回退。工作流 receipt 没有绑定被测试的 gh-pages blob，因此不能证明当前固定入口。
5. 本轮打开 [固定链接](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/?case=iq&v=r17)：URL 虽带 `v=r17`，实际标题、导航与脚本均为 **R16**，没有“视频样板”页签；默认托管 Chrome 同时显示“WebGL2 未启动”。查询参数不构成版本选择证据。
6. `lab-r17/index.html` 目前只负责返回 `anchors-r16.html`；R17 shader 文件保留为隔离学习材料，不是当前固定交付。

## 明确决定

- 维持 R16 为固定入口和回退基线；不重新启用 R17 writer。
- 六个 R17 样例保留为隔离 Candidate，不删除学习成果，也不称为当前用户交付。
- R17 历史 workflow 只保留为“回退前 scoped evidence”；当前固定入口交付主张标为 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`。
- 不继续调材质外观，先解决 Task Anchor、存储命名空间和可逆迁移合同。

## 责任端与最小验证

- 责任端：Material Mother；本轮仅记录责任，未取得 ACK。
- 最小验证：
  1. 建立唯一 taskId，绑定 R16 accepted baseline、R17 Candidate、准确 main/gh-pages SHA 与页面 blob；
  2. R17 只能写 `KAOPU_MATERIAL_R17`，不得写 R16 键；
  3. 如需迁移，必须先逐字节复制 R16 到不可变 recovery key，再写新键，并验证 R16 回退仍读取原值；
  4. 对当前固定入口重新跑桌面与 390×844 的 `version marker + READY + WebGL2 + 关键交互`；物理手机另列 `UNKNOWN`；
  5. R17 若未来晋级，必须在晋级后的固定 blob 上产生新 receipt，不能复用 run 37285478301。

## 未完成边界

- 既往访问过短暂 R17 的客户端是否发生 R16 参数覆盖、覆盖前值是什么、能否恢复，均为 `UNKNOWN`。
- R17 六个样例的视觉质量、用户接受、默认硬件浏览器、物理手机均未验证。
- 当前公网固定入口存在，但本轮默认托管浏览器不可渲染；**交付未完成**。
- 状态账：R17 source `IMPLEMENTED=true`；历史 run `GATE-RUN=true`；当前固定交付 gate=false；`POSTED / ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false`。

## 学习飞轮接续

实现并回放 `CLIENT-STATE-VERSION-ISOLATION-001`：隔离命名空间通过；同键跨版本写入必须 HOLD；写前不可变备份与回退验证通过；覆盖后才备份仍保持 pre-overwrite state `UNKNOWN`。进一步研究最小的事务式浏览器状态迁移 receipt，避免任何 Mother 的 Candidate 污染 accepted baseline。
