# N146 — Human semantic anchor state×view coverage Candidate

状态：CANDIDATE / Human-local / no production change

## Bounded question

在参考锁定的人体局部复刻中，语义锚点若未绑定 `(anchor, state, view)` 与实际 carrier，是否会让多张截图错误冒充解剖覆盖？

## 真实失败与新增机制

EAR PR #226 的 63/18 检查与 Lip PR #224 的 39/19 检查都不等于主体级解剖保真。KX-20261013-01 新增边界：同一锚点在闭口/张口、正面/背面间会改变 OBSERVED/OCCLUDED/UNKNOWN；重复单一状态截图不能覆盖其他格，隐藏格不得补值。

R2 与 reference-replication gate 已禁止 UNKNOWN 创作替代；N145 已有 visible/occluded 列表。本轮只扩展原 case，加入 state×view matrix 与 anchor carrier identity，不创建重复 case、不修改 R2。

## 可反驳假设与回放

若每个必需 `(anchor,state,view)` 格记录 OBSERVED/OCCLUDED/UNKNOWN/NOT_APPLICABLE，且 OBSERVED 绑定 `evidenceFrameDigest + carrierKind`，则重复截图、缺 carrier、隐藏格被补值都会 HOLD，完整矩阵才进入冻结阈值与独立 verifier 比较。

新增四个控制并保留六个旧控制；隔离 JavaScript 分类回放 10/10。所选 exec-server 不可用，因此不冒充生产 CPU/browser/device 证据；`HUMAN-PRODUCTION-GATE-RUN=false`。

## 适用边界与决策

仅用于参考锁定、需要多状态或多视角的人体局部（当前证据为 Ear/Lip）。不提供生产阈值、不证明视觉质量、不全局采用。

决策：Human-local `CANDIDATE`。下一次相关 Ear/Lip Task Anchor 应冻结 state/view 集合与 carrier ledger 做单 Mother 试验；当前保持 `HOLD_STATE_VIEW_COVERAGE_INCOMPLETE` 或 `HOLD_ANCHOR_CARRIER_UNBOUND`。

生命周期：`POSTED=true`（KX 已定向发布）；`CLASSIFICATION-GATE-RUN=true (10/10)`；`ACKNOWLEDGED / IMPLEMENTED / HUMAN-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

未修改 main、生产 Mother、公开网页或生产资产。
