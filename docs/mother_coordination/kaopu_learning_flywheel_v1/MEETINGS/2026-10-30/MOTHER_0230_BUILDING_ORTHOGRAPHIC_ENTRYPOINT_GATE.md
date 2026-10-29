# KAOPU Mother 每日协调会：Building 全入口正交显示门禁

- **记录 ID**：KAOPU-MOTHER-20261030-BUILDING-ORTHOGRAPHIC-ENTRYPOINT-R1
- **实际开始**：2026-10-30 02:33:20 +08:00
- **实际结束**：2026-10-30 02:34:13 +08:00
- **范围**：只核对 Building Lean Code 是否落实用户冻结的“整个系统移除近大远小”
- **实际参与**：小妈主持核查；未取得 Building Mother 本轮 ACKNOWLEDGED 或回复
- **生产修改**：无
- **协议**：R2 Production OS、Reference Replication Gate、Freshness Gate 均作为强制门禁

## 新增事实

main 仍为 `3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`，自上一轮没有新生产提交。

N209 对外部产物 `Building-Mother-Lean-Code-20261029.zip` 做了入口级静态可达性回放：

- 文件：849,144 bytes；
- SHA-256：`481b8865137f817bd3a128df52536b6e69afad45d952d159b654fc113afa0a8f`；
- 从 `ENTRYPOINTS.json` 的 8 个活动入口出发，共解析 157 个唯一可达文件，静态依赖缺失 0；
- 6/8 个入口仍可到达透视显示路径；
- `knowledge-lab-r01` 与 `elevator-mother-r02` 未检出 marker，只能记 UNKNOWN，不能晋级为通过。

活动反例包括：

1. workbench、tower、香港三栋仍可达 `fitBoundsCamera`，底层使用 `tan(fov/2)` 与 depth 除法；
2. building-language / building-relationship 仍使用 perspective `cameraRay`，relationship 还按 depth 投影 label；
3. warehouse-analysis-3d-r02 仍使用 `fovRadians`、`tan(fov/2)` 与 depth projection。

因此“Lean Code 已从整个 Building Mother 移除近大远小”被当前精确包证伪。该包未进入当前仓库，仓库搜索未找到包名或 SHA；正式生产 branch、Task Anchor 与 Delivery Receipt 均未绑定。

## 九项核对

| 项 | 当前记录 |
|---|---|
| taskId / targetObject / targetDefect | `BUILDING-ORTHOGRAPHIC-ALL-ENTRYPOINTS-20261030` / Building display pipeline / 6/8 活动入口仍可达 perspective render/pick/label |
| accepted baseline / baseSha | 用户接受基线：UNKNOWN；仓库 main：`3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`；精确外部包只绑定 SHA-256 |
| 用户最后约束 | 整个 Building Mother 移除“近大远小”；不是只改某个页面或 UI 文案 |
| referenceSet / UNKNOWN | 精确 Lean Code 包、ENTRYPOINTS、157 文件依赖闭包已绑定；实际生产 branch/commit 与当前活动入口权威清单 UNKNOWN |
| forbidden routes | 只改 renderer、不改 picker/label；保留可达 legacy perspective；改文字或相机默认参数；以静态未检出冒充浏览器通过 |
| fresh head delta | main：`NO_NEW_ARTIFACT`；Lean Code 包为新外部产物，但 lineage 未绑定仓库 head |
| regression cases | `BUILDING-PERSPECTIVE-DISPLAY-FORBIDDEN-001` synthetic/source gate 已跑；Candidate、inactive、未采用 |
| machine/reference/browser gates | 入口静态闭包已跑；生产 commit、浏览器正/负控、桌面、390×844、固定公网均未跑 |
| 当前状态 | `HOLD_GATE_FAIL / REJECT_ACTIVE_PERSPECTIVE_MODE_STILL_REACHABLE / HOLD_DELIVERY_LINEAGE_UNBOUND` |

## 决定

**Lean Code 包不能标记“已移除透视”，也不能成为下一版已通过基线。** 保留其中与投影无关的几何、材质和代码整理成果；停止逐页面凭感觉修相机。

Building Mother 应建立一个共享的 `OrthographicDisplayContract`，让所有活动入口的 renderer、picker、label 三条路径都读取同一投影状态。旧透视代码可以留作历史，但不得从任何活动入口或 wrapper 重新导出可达。

这不是要求立刻重写全部建筑几何，也不恢复旧失败版本。

## 责任端与最小验证

- **责任端**：Building Mother；当前实际生产接收 branch/PR 尚未绑定。
- **最小实现**：
  1. Task Anchor 冻结 `displayProjectionInvariant=PERSPECTIVE_DISPLAY_FORBIDDEN`、`allowedProjectionModes=[ORTHOGRAPHIC]`；
  2. 冻结活动入口全集；
  3. renderer、picker、label 统一到共享正交合同；
  4. legacy perspective 从活动依赖图断开；
  5. Delivery Receipt 绑定精确 package/source/base/head 与 known limitations。
- **最小验证**：
  - 全部活动入口静态闭包中 perspective path 为 0；
  - 同一对象仅改变 camera distance 时屏幕尺寸不变；
  - 只有 orthographic scale 改变时允许屏幕尺寸变化；
  - 拾取与标签在同一正交状态下对齐；
  - 注入 legacy perspective import 的负控必须失败；
  - 当前 commit 重新跑桌面、390×844 视口与固定 HTTPS。390×844 只能记视口，不能冒充物理手机。

## 状态账

- **POSTED**：N209 已发布到 #91；本轮协调决定追加到同一入口。
- **ACKNOWLEDGED**：无 Building Mother 回复。
- **IMPLEMENTED**：Lean Code 包存在；共享正交合同未证实实现。
- **GATE-RUN**：source/static reachability 已运行；production/browser 未运行。
- **ADOPTED**：无。
- **USER-ACCEPTED**：无。

## 未完成边界

没有绑定实际生产 branch/commit 的 Task Anchor、Delivery Receipt、修复提交、浏览器证据或固定公网交付。故本轮明确“交付未完成”，不把外部压缩包、静态探针或历史工作台冒充成品。

## 学习飞轮接续题

怎样把“显示投影”提升为跨 renderer / picker / label / overlay 的单一状态合同，并自动生成入口闭包与距离不变量测试，避免某个局部工具重新引入 perspective？

可研究适用于 Building、Road、Object inspection 和 CAD-like workbench 的最小投影状态模型；必须先在 Building 单 Mother 验证，不能直接广播为已采用通则。

## 固定证据

- [N209 定向记录](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6487414042)
- [N209 学习记录](https://github.com/haihao0307/guilin-dem-pipeline/blob/automation/n209-building-perspective-mode-reachability-20261029/docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_LOG/2026-10-29_BUILDING_LEAN_PERSPECTIVE_MODE_REACHABILITY_N209.md)
- [N209 机器结果](https://github.com/haihao0307/guilin-dem-pipeline/blob/automation/n209-building-perspective-mode-reachability-20261029/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/building_perspective_mode_reachability_result_n209.json)
- [Candidate regression](https://github.com/haihao0307/guilin-dem-pipeline/blob/automation/n209-building-perspective-mode-reachability-20261029/docs/mother_coordination/kaopu_learning_flywheel_v1/REGRESSION_CASES/CANDIDATE_BUILDING_PERSPECTIVE_DISPLAY_FORBIDDEN_001.json)
