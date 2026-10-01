# N55 — White Oak R07：2D Canvas 被标成 3D，截图 CI 误绿

日期：2026-10-01  
状态：CANDIDATE / TREE-LOCAL / NOT ADOPTED

## 单一 bounded question

White Oak R07 的公网页面与绿色 CI，是否足以证明它满足 KAOPU 的“真实三维工作台”要求？

## 1. 现有真实失败

- 新公网页面提交：`c3c1a557cfb6c9be219f4fa8e659b05f2e2171a2`。
- 页面标题明确写 `Mobile 3D · function graph`。
- 活动实现有两次 `getContext('2d')`，没有 WebGL、WebGL2、WebGPU 或 Three.js 运行时信号。
- 页面用自定义 `project()` 将三维数值投影后画到 2D Canvas；数学中有三维坐标，不等于交付物是可交互三维运行时。
- QA workflow 提交：`5889f560f28ccc2c8d85cb0d7d9ae2b03f194c4f`。
- workflow run `36814221195` 为 success，但只核对 HTTP 200、固定文案、截图文件非空；Chrome 参数还包含 `--disable-gpu`。没有断言 3D context、scene/camera/mesh、深度缓冲、真实三维拾取或任何关键 3D 交互。
- cache-busted 公网页面实际可达，标题、按钮和滑杆可见。这只能保留为 `PUBLIC_HTTP_AND_UI_REACHABILITY`，不能提升为 `interactive3D=true`。

## 2. 外部方法 / 一手证据

- Khronos 将 WebGL 定义为通过 HTML Canvas 暴露、基于 OpenGL ES 的低层 3D 图形 API：https://www.khronos.org/webgl/
- NASA SWE-068 要求测试结果回到预先定义的验收条件，而不是用不对应需求的输出替代：https://swehb.nasa.gov/spaces/7150/pages/16450548/SWE-068+-+Evaluate+Test+Results
- GitHub 明确用 action 退出码决定 check run 的 success/failure；绿色只代表已执行步骤没有返回失败，不会自动证明步骤未覆盖的产品要求：https://docs.github.com/en/actions/how-tos/create-and-publish-actions/set-exit-codes

## 3. 与 KAOPU 当前制度比较

原则层是 `no-novelty`：根 `AGENTS.md` 与 `REAL_3D_WORKBENCH_ONLY_GATE.md` 已明确禁止 Canvas 假画面替代真实三维，并要求关键交互真实浏览器验证。

执行层存在真实缺口：现有协调回归目录没有“2D Canvas + 3D 标签 + 非空截图 CI”这一组合反例，导致永久门禁没有转成可重放的 Tree 回归。

## 4. 可反驳假设

若在 Tree 的 real-3D claim gate 中同时检查：

1. 当前任务是否要求真实三维；
2. 最终 subject 是否真实取得 3D runtime context；
3. 是否仅有 Canvas2D；
4. CI 是否断言精确 subject 的 3D context；
5. 是否执行至少一个关键 3D 交互；

则 R07 会被稳定判为 `REJECTED_2D_CANVAS_SUBSTITUTE`，而真正具备 WebGL/WebGPU 与交互回执的对照会通过；普通非 3D 图表不受影响。

## 5. 最小历史回放

新增候选回归 `TREE-NO-2D-CANVAS-AS-3D-001` 与可执行 probe。

- White Oak R07 历史 subject：REJECTED；
- 真实 WebGL + 3D context + 关键交互对照：PASS；
- 只有截图的 3D 声明：REJECTED；
- 明确不要求 3D 的普通 Canvas2D 图表：NOT_APPLICABLE。

结果：4/4 passed。

## 6. 适用边界

- 仅适用于 Task Anchor 已声明 `REAL_3D_WORKBENCH_REQUIRED` 的任务。
- 不禁止 Canvas2D 用于图表、年轮辅助视图、HUD 或内部 QA，只禁止它冒充主三维运行时。
- 不以源码字符串单独批准 3D；最终批准仍需运行时 context、精确 subject、关键交互和独立 verifier receipt。
- White Oak 研究文档可保留为 Observation；R07 页面不得作为下一版 3D 生产父节点。

## 7. 是否采用

- Tree 局部 Candidate：是。
- 全局采用：否，待单 Mother 下一次真实 3D Tree 候选试跑。
- 生产分支 / main / gh-pages：未修改。
- 当前 subject：`REJECTED_2D_CANVAS_SUBSTITUTE`。
- 可靠 KPI：unknown。

## Lifecycle

- POSTED: true — https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5925533140
- ACKNOWLEDGED: false
- IMPLEMENTED: true（Candidate checker only）
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false
