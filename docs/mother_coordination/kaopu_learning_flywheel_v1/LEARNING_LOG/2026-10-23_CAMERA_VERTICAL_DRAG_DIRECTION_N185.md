# N185 — 上下拖动方向必须由可见响应回执约束

- 日期：2026-10-23
- Mother：Human / NPC life observation
- 类型：技术问题 / interaction semantics / regression candidate
- Bounded question：当前 R04 的上下拖动方向是否已经被生产源码或浏览器门禁明确验证为符合用户要求？
- 结论：没有。当前状态为 `USER_REPORTED_DIRECTION_FAILURE__REGRESSION_MISSING`。

## 1. 当前真实问题

用户对 R04 固定页面明确纠正：`移动上下镜头方向与操作反了，调整一下`。这条纠正尚未进入适用 regression。

当前 head `b386dd9780ddc5b01676fe46117d56d973725ac7` 的 `Workbench.mjs` 只设置 camera preset 与 `viewer.orbit.target`，没有定义 R04 专属 pointer-drag 方向。实际手势继承自固定 native preview blob `e20d7ba9a778c3d8ccafd869b91e2ab9a564dfe6`：

- mouse 与 one-finger touch 都把 pointer Y 差传入 `_rotateUp(...)`；
- `_rotateUp(angle)` 对 spherical phi 做减法；
- R04 `verify-browser.cjs` 只点击 `data-camera` 预设，没有真实 pointer drag 的正负方向断言。

这说明缺口位于“用户可见手势语义没有验收”，但不能仅凭压缩源码断言视觉根因。当前公网页面又被 N184 的 `BOOT_STAGE_TIMEOUT` 阻断，因此本轮不伪造新的运行时复现。

## 2. 外部老师判定

Three.js 官方 OrbitControls 文档只说明左键/单指用于 orbit、控件围绕 target 旋转并保持 up 方向。当前页面已经使用这套控件；官方资料没有替 KAOPU 定义用户要求的上下方向，也没有新增可反驳验收方法。

- 来源：https://threejs.org/docs/pages/OrbitControls
- 状态：`NO_NOVELTY`
- 明确回答：它没有在本问题上比 KAOPU Current Best View 多知道用户期望的垂直方向；真正缺失的是项目自己的 observable-response contract。

## 3. 一个可反驳假设

假设：只要 OrbitControls 能响应拖动，且 camera preset 按钮可用，就足以证明上下拖动方向正确。

反驳方式：在非极角夹限的同一起始 camera pose，保存当前被用户否决的 baseline 可见响应；对 mouse 与 one-finger touch 分别执行相等幅度的 `dy>0` 与 `dy<0`。Candidate 必须把垂直响应相对 baseline 反向，同时保持水平响应、target、preset 与 zoom 语义不变。只改内部 phi 符号而没有真实浏览器 camera/view trace，不算通过。

## 4. 最小回放

分类器 9/9：

1. 当前 baseline 原样保留：`REJECT_VERTICAL_DIRECTION_NOT_REVERSED`；
2. 只改源码、无 browser trace：`HOLD_BROWSER_TRACE_MISSING`；
3. mouse 反向、touch 未反向：`REJECT_INPUT_MODALITY_MISMATCH`；
4. touch 反向、mouse 未反向：`REJECT_INPUT_MODALITY_MISMATCH`；
5. 垂直反向时横向也改变：`REJECT_HORIZONTAL_COLLATERAL_CHANGE`；
6. camera preset/target 被改坏：`REJECT_CAMERA_PRESET_REGRESSION`；
7. 在 polar clamp 上测试、位移不可辨识：`HOLD_NON_DIAGNOSTIC_START_POSE`；
8. producer 自批：`HOLD_INDEPENDENT_VERIFIER_MISSING`；
9. mouse/touch 垂直均反向、横向与 preset 保持、独立 verifier 有真实 trace：`CAMERA_VERTICAL_DIRECTION_PROBE_PASSED`。

## 5. Candidate 增量

仅建议 Human / NPC successor candidate 增加：

- Task Anchor：`cameraGestureContract.vertical = INVERT_REPORTED_BASELINE`，并锁定 horizontal/preset/zoom invariants；
- Delivery Receipt：pointer type、start/end coordinates、起止 camera position/quaternion、orbit target、azimuth/polar、一个固定 landmark 的 screen projection、current source head；
- Verifier：同一中间角度起点分别跑 mouse/touch 上下拖动，另跑 horizontal 与 preset 非回归；
- negative controls：未改 baseline、只改 mouse、只改 touch、在 clamp 起点造成零响应。

用户的“反了”是 canonical correction。Candidate 要证明相对被否决 baseline 的响应确实反转；不得用“这是 OrbitControls 默认行为”覆盖用户要求。

## 6. 边界与状态

- 不修改 R04、main、R2 OS 或全局门禁。
- 不声称本轮已修复生产相机。
- 不把源码公式替代为用户可见 browser proof。
- N184 当前公网启动失败继续独立存在；修相机前必须先恢复可达运行态。
- POSTED：true。已定向路由至 PR #329：https://github.com/haihao0307/guilin-dem-pipeline/pull/329#issuecomment-6353852986
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：false / unknown。

