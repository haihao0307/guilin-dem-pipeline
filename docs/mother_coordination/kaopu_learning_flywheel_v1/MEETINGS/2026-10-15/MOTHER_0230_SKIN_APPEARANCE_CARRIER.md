# Mother 02:30 Coordination — Full-body Skin → Skin Paint 外观载体分离

- ID: `KAOPU-MOTHER-20261015-KX01`
- 实际开始：2026-10-15 02:34:33 +08:00
- 实际收束：2026-10-15 02:36:12 +08:00
- 主持：小妈协调端
- 真实 Mother 参与：0。两条定向留言已写入并回读；截至收束没有 ACK。留言成功不等于理解、实现或采用。
- 生产修改：0；main / gh-pages / 生产分支 / 固定成果 / 排程 / 学习飞轮修改：0。

## 会前读取与去重

已读取 `main@7ed6ce55684965026188e06436ac91525526e762` 根 `AGENTS.md`、R2 Production OS、Reference Replication Gate、Freshness Gate、#91/#63 当前回流，以及 PR #284/#288 的 Delivery、研究记录、用户退回说明、浏览器证据与评论。

- 昨日 Human R06 能力预算留言仍无 ACK 或 16-unit 新运行，不重复追催。
- Skin R02.1 收到 N152：原黑屏修复有效，但通用 capability gate 缺故意超限的 TEST_FIXTURE_ONLY 阳性对照；仍仅 `POSTED`，不把 7/7 分类回放说成生产采用。
- #91 最新仍为 N148 Skin fold 因果问题包；#63 最新仍为 Coast R03 公网运行失败/subject 变更证据不可继承。两者均不重复包装。
- Skin Paint R02 收到 N156：R01 用户视觉退回目前只在文字中，尚未绑定一个 exact known-bad crop 和可执行纠错回归。这是本轮边界，不另造“通用写实分数”。
- 用户统一交付规则继续有效：清晰外部网页、真实渲染/交互/版本回读；390×844 仅视口，不是实机。今天不发布新网页。

## 今日唯一问题

> Full-body R02 已经按色素、血色、厚度透光、油膜和灯路分开观察；Skin Paint R02 已能画出可见区域色，但仍主要落入 base-color 路径。怎样迁移“外观载体分离”方法，使“更红”不再被误当成“更真实”？

## R2 任务核对

| 项目 | Full-body Skin R02（方法源） | Skin Paint R02（接收端） |
|---|---|---|
| taskId / object / defect | Full-body R02；同一人物全身皮肤与耳部；头颈材质边界、局部组织色差、耳透光 | `KAOPU-XFER-20261015-FULLBODY-TO-SKINPAINT-CARRIER`；同一人物耳/眼周；区域色已可见，但可见“红”未绑定具体 carrier |
| accepted baseline / baseSha | 冻结 HEAD-PROCEDURAL-R01 C4 public `7ca673bc5f2be9dc2462252ae94580e81f05ab8a`；PR base `7a6c507256bd5ff0f63d7090b947d5ae1a339148` | R01 已被用户视觉退回，不得作为写实 baseline；PR base `7582ac9fe9c7c0496f7b4fd6a6a67432db57d4d9` |
| exact fresh subject | source `1923ee7af9e121c40caa2089a49ed064e05451fe`；build `50f9dd769893584dedb62f0bc62db07ebcb1dcc0`；run `38551485275`；head `60d12161a55907ba0cd2a6fffec781579d41a3c2` | source `03b6b062e8195a1ba935f2e0c95d3fa345e9ae9c`；build `b97e65823d1103d96c78d82fe351fa2d8802a125`；run `38553171915`；head `20649aea99244040e273233e16e191d37e10ccb8` |
| 用户最后约束 | 修复头颈分界、扩展全身并真实表达眼周/鼻翼/耳/唇/下巴色差；保留原人物 | R01效果被退回；必须有真实可见进展；功能检查和微小像素差不能冒充写实 |
| referenceSet / UNKNOWN | 用户两张截图、C4 fixed build、`OBSERVATION_AND_OPTICS.md`、ear-light probe；摄影真实等价和物理组织参数 UNKNOWN | exact public screenshots/receipt、R02 lessons；用户退回的 exact message/crop receipt仍 `UNKNOWN / SOURCE_ENTRY_REQUIRED` |
| forbidden routes | 固定红耳片、把阴影烘进底色、强制遮挡=1、以换灯替材质、外部皮肤替换 | 均匀红眼圈、大片脏斑、高饱和度冒充组织、胡根色冒充毛发、换人/换头、Producer 自批 |
| fresh head delta | 同一原生 skin mesh 连续覆盖；真实灯路探针发现原“背光”位置无响应并修正 | 区域色进入最终底色；坐标改为同人物语义/重心锚点；非规则孔点；Windows/Linux公网功能通过 |
| applicable regression / gates | 28组 scoped public/body/control gates；userVisualAccepted=false；productionReady=false | Windows/Linux 各8组/20 PNG；N156 correction regression仅分类8/8，生产未跑 |
| 当前状态 | `CANDIDATE_READY`，只限 scoped public candidate | `HOLD_GATE_FAIL`，仅限写实/用户纠错闭环；功能证据保留 |

## 有限方法：Appearance Carrier Ledger

同一块“红色”至少要分别记录：

1. base pigment / diffuse albedo；
2. 局部血色外观参数；
3. 厚度与出射遮挡约束的 transmission；
4. oil/specular/roughness；
5. 当前灯位、曝光与白平衡。

只有画面变红，不能证明五者中的任何一个。Full-body R02 的真实反例是：继承的“back”灯在头颅另一侧，正确遮挡使可见耳面 transmission 差异为 0；经过同人物 framebuffer 探针确认后，后上方/外后方灯才产生响应。因此可迁移的是**先证光路，再解释材质**，不是照搬灯位、RGB、强度或阈值。

## 决定与责任端

`KX-20261015-01 = POSTED_CANDIDATE_METHOD`。

- 责任端：Skin Paint Mother / R02。
- Full-body Skin 只提供方法与已知反例，不替接收端实现或批准。
- 不修改两个 fixed build，不合并两条生产线，不冻结新格式。

已写入并回读：

- [Skin Paint R02 接收说明](https://github.com/haihao0307/guilin-dem-pipeline/pull/288#issuecomment-6175565174)
- [Full-body R02 方法边界](https://github.com/haihao0307/guilin-dem-pipeline/pull/284#issuecomment-6175564787)

截至收束：`POSTED=true`；`ACKNOWLEDGED / TRANSFER-IMPLEMENTED / CARRIER-ABLATION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

## 最小可证伪验证

仅选择耳轮/耳垂一个 bounded region，锁定人物、几何、相机、曝光与 EB1：

1. 建立 2×2：regional albedo off/on × transmission off/on。
2. 每格分别在中性正光和已验证几何可见性的背光下运行。
3. 分开保存 diffuse、specular、transmission 区域读数，并验证恢复摘要。
4. 用固定红耳片作为 `TEST_FIXTURE_ONLY` known-bad control；即使“更红”，gate 也必须拒绝。
5. 换光后红色不变只能归为 base-color；transmission 在非背光或厚区同样出现则因果解释失败。
6. 只判断该耳区；不外推整脸、全身、全人群或医学参数。桌面与390×844分列，后者不冒充物理手机。

## 未完成边界

没有 Skin Paint 新实现或新运行，没有 exact 用户退回 crop/receipt，没有独立 verifier，没有 Mother ACK、采用或用户验收。Full-body 的灯位、强度和阈值不适用于 Skin Paint。当前 `gh-pages@d27482fbe04a22ee668e51704c3c2a56cea73d80` 已移动，不用于替代两个 immutable build 身份。

## 交给学习飞轮的唯一问题

如何为程序皮肤建立最小的 appearance-carrier 观测协议：同一可见色变化同时绑定材料 carrier、光路有效性、可见域与恢复性，并用一个 known-bad 固定色片和一个正确 transmission 样本区分“看起来像”与“因果路径正确”？至少需要接收端一次真实 2×2 gate run 和独立 verifier，才考虑晋级为跨 Mother regression case。
