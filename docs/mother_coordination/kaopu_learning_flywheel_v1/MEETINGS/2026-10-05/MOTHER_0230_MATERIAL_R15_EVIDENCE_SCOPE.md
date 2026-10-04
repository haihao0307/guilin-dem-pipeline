# Mother 02:30 — Material R15 证据范围与公网交付门（2026-10-05）

- 会议编号：`KAOPU-MOTHER-20261005-MATERIAL-R15-EVIDENCE-SCOPE`
- 实际开始：2026-10-05 02:30:44 CST
- 实际收束：2026-10-05 02:34:07 CST
- 参与：小妈主持核查；本轮未取得 Material Mother 新回执，未冒称 Mother 参会或采用
- 协议：R2 Production OS、Reference Replication No Creative Substitute Gate、Task Freshness Gate、Public Web Delivery Gate
- 生产修改：无；未修改 main、gh-pages、生产 Mother 分支、冻结成果或排程

## 本轮唯一问题

Material R15 的精确 Actions 成功，是否足以解除当前最终交付阻断？

## 当前任务锚点核对

| 字段 | 本轮可核对结果 |
|---|---|
| taskId | `UNKNOWN`：未在当前 main 默认分支检索到 Material R15 的正式 R2 Task Anchor / Delivery Receipt |
| targetObject | 固定公网入口中的 IQ 岩石 R15 交互态 |
| targetDefect | 运动时不得切换替代 canvas/mesh；同时最终公网必须在普通外部浏览器真正进入可交互态 |
| accepted baseline / baseSha | `UNKNOWN`：没有发现绑定用户接受基线的正式 receipt，不把 R15 自称为 accepted baseline |
| 用户最后约束 | 必须给用户可直接打开的清晰固定网页，并分别说明桌面、390×844 视口和物理手机的实际验证范围；阻碍时写“交付未完成” |
| referenceSet / UNKNOWN | 当前代码、固定 URL 和工作流证据可读；视觉目标参考集合及用户接受基线仍 `UNKNOWN` |
| forbidden routes | 替代 canvas/mesh；用旧运行、错误事件范围或空 commit status 冒充当前 Actions 结论；把视口模拟冒充物理手机 |
| fresh head delta | `main@4fdc1213914a668e6d63017081c128c7ef3edc4b`；`gh-pages@0dfa0ab7875b84a5d4310140ad38fb7940dd3694`；固定入口加载 `lab-r15/app.js` blob `7a34f165396407868b64197298d1468936e5efde` |
| regression cases | 适用：`CI-GREEN-SKIPPED-CLAIM-001`、`QUERY-SCOPE-NEGATIVE-EVIDENCE-001`（Candidate）、现有 `PUBLIC_WEB_DELIVERY_GATE`；本轮不重复新建 |
| gates | Contract：缺正式 anchor/receipt；Freshness：当前 head 已绑定；Reference Fidelity：Unknown；Machine：SwiftShader 精确运行 scoped pass；默认托管浏览器：fail |
| 当前总状态 | **`HOLD_GATE_FAIL`**；其中 same-SDF/no-substitute 子主张是 `CLAIM_VERIFIED_SCOPED`，不能提升为最终交付通过 |

## 新证据与纠错

1. 撤回 N73 的“0 workflow run”结论。该结论只查到了 `pull_request` 触发面，而 R15 工作流由 `push` 触发；空 commit status 也不能代替 Actions workflow-run 查询。
2. 精确运行 [37184764939](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37184764939) 绑定 `main@4fdc121...`，job `111384288074` 成功；artifact `11296088174`（digest `sha256:bcf2959b15b9e771e9121be3ec572b9781be980e8ce2b40a527027b3abd5d6df`）记录 `sameSdf=true`、`noSubstituteCanvas=true`、motion/static width 均 448、无 errors。
3. 该运行只证明：public HTTPS + Chromium + 390px viewport + SwiftShader 下，同一 SDF、无替代 canvas 的交互成立。
4. 本轮对同一固定 URL [Material R15](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/?case=iq&v=r15) 做默认托管 Chrome 回读：标题与脚本确认为 R15，但页面显示“WebGL2 未启动”，`KAOPU10.ready=null`、`performance=null`，所有按钮 disabled，无法执行关键交互。

## 明确决定

- 不重跑、不改动已经通过的 R15 source 来制造更多绿色记录。
- 不因一条 SwiftShader 成功而宣布最终网页交付完成。
- Material R15 保留为 scoped implementation evidence；总任务进入 `HOLD_GATE_FAIL`，直到正式 Task Anchor/Receipt 和默认外部浏览器门满足。
- 这不是 creative substitute 复发；本轮不标 `REJECTED_CREATIVE_SUBSTITUTE`。问题是证据范围与最终运行环境不一致。

## 责任端与最小验证

- 责任端：Material Mother（实际 ACK 未取得）。
- 最小验证：
  1. 为当前 R15 写入唯一 taskId、目标、用户接受基线/baseSha、referenceSet、forbidden routes、current main/gh-pages subject；
  2. 对固定 URL、当前 `lab-r15/app.js@7a34f165...` 分别运行默认桌面浏览器与 390×844 视口：`READY + WebGL2 + zero fatal error + 自动旋转一次 + same-SDF/no-substitute`；
  3. 将运行环境、准确 head/blob、截图/机器结果及 known limitations 写入 Delivery Receipt；
  4. 物理手机单列为 `UNKNOWN`，不得由 390×844 视口代替。

## 未完成边界

- 默认硬件加速路径、跨浏览器/设备性能、桌面实际交互、物理手机、视觉参考忠实度、用户接受均未完成。
- 当前可公开 URL 存在，但在本轮默认托管浏览器不可交互；按用户最终交付规则，**交付未完成**。
- Material Mother 的 `ACKNOWLEDGED / ADOPTED / USER-ACCEPTED` 均为 false；本轮无新生产提交。

## 学习飞轮接续问题

怎样把“环境能力矩阵 + 精确 subject + named claim”写入最小 receipt，使 SwiftShader 的 scoped pass、默认 WebGL2 fail、物理设备 unknown 可以并存而不被错误压扁为一个全局 pass/fail？同时，任何“未找到/不存在”的结论必须先声明 event coverage、evidence surface、workflow/head 绑定和分页完整性。
