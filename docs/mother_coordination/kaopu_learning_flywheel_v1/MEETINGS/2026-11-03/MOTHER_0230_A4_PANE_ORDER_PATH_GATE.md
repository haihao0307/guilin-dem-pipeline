# KAOPU Mother 协调会｜A4 双玻璃：真实像素验证与生产排序路径分裂

- 会议编号：`KAOPU-MOTHER-20261103-A4-PANE-ORDER-PATH-001`
- 实际核查开始：2026-11-03 02:32:16 +08:00
- 协调分支读取基线：`806a05a550625861b5a46082902e545f1c6de331`
- main：`34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- 范围：一个最高价值问题——A4 前后两块玻璃的真实 GL 证据是否执行了拟交付页面的同一排序门
- 参与：小妈主持并独立回放最新私有工件；未取得本轮 Train Mother 回复，不把包内作者自述记作会议 ACKNOWLEDGED。

## 会前强制协议

已在 main 读取根 `AGENTS.md`、R2 Production OS、Reference Replication gate、Freshness gate。#91 最新真实回流到 N233（A4 Side A stale-geometry lock，POSTED 未 ACKNOWLEDGED）；#63 无新生产回流。

## 精确对象

- Library：`libfile_8956662ffa54819195b5ccdd9778c7b8`
- 文件：`A4_ORIGINAL_REAR_PANE_TWO_PANE_ASSEMBLY_R01.zip`
- ZIP SHA-256：`b5a1d9ee18782aa4cab1cfa760dbc2ceea2b31dedbc2492f4f89f6ee0aae3cf0`
- targetObject：`train88/A6/A4/cab_shell/glass/side-front/right` 与 `.../side-rear/right`
- targetDefect：透明玻璃在观察方向变化时，必须按真实远近顺序合成；重叠区间、重复 pane、陈旧 interval/shader 或不支持的投影必须在 draw 前拒绝
- 当前状态：`HOLD_GATE_FAIL`

## 新增可核查事实

包内排序方法本身有明确边界：

- `pane-order.mjs` 只接受 orthographic + 两个互不重叠的 source-Z interval；
- `pane-order.test.mjs` 的 5 个方向与 7 个拒绝门，本轮 fresh extraction 重新执行通过；
- `ui-protocol.test.mjs` 通过 `app.mjs` 间接执行生产排序门，10 种模式通过，但 WebGL 是 mock；
- 桌面 GL / GLES 的真实像素结果和前后方向 53/73 个重叠像素证据可保留。

但关键路径没有闭合：

1. 拟交付页面 `app.mjs` 实际调用 `orderDrawRecords`；
2. 三个真实像素 verifier——`render-current-assembly.py`、`render-two-panes.py`、`render-two-panes-gles.py`——都没有导入或调用该函数，而是各自内联排序；
3. 本轮在一次性 fresh extraction 中把后窗的 `zRange` 改成与前窗重叠，生产 `orderDrawRecords` 按设计应拒绝；但 `render-current-assembly.py` 仍成功完成，实际结果为 `OVERLAP_NEGATIVE_REAL_GL_PATH=ACCEPTED_UNEXPECTEDLY`。

因此“生产排序逻辑通过”和“真实 GL 像素通过”目前是两段证据，不能合并声称生产路径已通过。

## R2 九项账

| R2 项 | 本轮观察 | 判定 |
|---|---|---|
| taskId / targetObject / targetDefect | 包内无 R2 taskId；本纪要限定双 pane 排序路径 | CONTRACT HOLD |
| accepted baseline / baseSha | 有 package/module hashes；无用户 accepted baseline、Git baseSha 或生产 head | UNKNOWN / HOLD |
| 用户最后约束 | 玻璃应透明、复刻默认锁定；物理光学不得凭空补完 | 有语义来源，未由正式 Anchor 绑定 |
| referenceSet / UNKNOWN | 两个独立原始窗框边界、物理 pane ID、source 坐标、未知厚度/IOR/安装均有记录 | PASS |
| forbidden routes | duplicate pane、stale shader/material/order、overlap interval、perspective 均应拒绝 | 生产门有；真实像素 verifier 未同门 |
| fresh head delta | 新 Library v0 和 ZIP SHA 可核；无 Git head/source diff | PRIVATE FRESH / HEAD UNKNOWN |
| regression cases | 新增 `VERIFIER-PRODUCTION-PATH-EQUIVALENCE-001` Candidate | GATE-RUN |
| machine / reference / browser | native/source/GL/GLES 局部检查存在；真实 GL 路径分裂；browser、桌面与 390×844 均未运行 | HOLD |
| 状态 | 生产路径端到端证书缺失 | `HOLD_GATE_FAIL` |

## 决定

保留前后窗的独立 identity、共享边界关系、几何/材质 hashes、局部 GL/GLES 结果与有限 orthographic 排序方法；不把它标为 creative substitute，也不否定已有几何工作。

停止把“排序单测 + mock UI + 另一套真实 GL 排序”合并成生产门通过。当前私有包不能晋级 `CANDIDATE_READY` 或成为用户可见工作台基线。

## 责任端与最小验证

责任端：Train/A4 display integrator；独立 verifier 只验证，不改形体。

最小验证：

1. 由真实 WebGL2/GL harness 调用**同一份** `orderDrawRecords`（或 byte-identical shared executable authority）后再提交 draw；
2. trace 绑定 exact archive、`app.mjs`、`pane-order.mjs`、两 pane ID、shader/material hash、interval authority 与 camera；
3. overlap interval、stale order hash、duplicate pane、perspective 四个负控必须在任何 pane draw 前失败；
4. 正向和反向相机保留实际重叠像素的 far-to-near 检查；
5. 再以准确当前版本分别执行桌面与 390×844 浏览器；手机视口不冒充实机；
6. 用一份 R2 Task Anchor + Delivery Receipt 引用上述证据，不复制整包说明。

## 未完成边界

- 无用户 accepted baseline、Git baseSha、生产分支绑定或 Mother 新回执；
- alpha .2 仍是用户透明目标下的显示候选，不是测得 IOR、厚度、吸收或 refraction；
- eave、下侧板、前斜面、后门口、内衬与整车仍未完成；
- 无固定公网、真实浏览器、桌面/390×844 或实机验收；交付未完成；
- 未修改生产分支、main、冻结成果、排程或学习飞轮。

## 生命周期

- `POSTED`：待 #91 写入后更新
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true`：私有局部装配
- `GATE-RUN=true`：source/native、排序单测、mock UI 与离线 GL/GLES 分项
- `production-path GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 学习飞轮下一题

怎样让所有关键 verifier 直接消费生产模块和生产数据合同，使“真实像素运行”与“生产 fail-closed 逻辑”来自同一路径，而不再用各自重写的 Python/JS 近似实现拼接成证书？
