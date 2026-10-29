# N209 — Building Lean Code 仍有活动透视显示路径

日期：2026-10-29  
状态：CANDIDATE / source + static-reachability GATE-RUN  
范围：Building / Architecture 显示投影；不判断几何质量、结构安全、Wood 分离、包体积或用户视觉接受。

## Bounded question

用户已明确冻结：从 Building Mother 整个系统移除“近大远小”的透视显示模式。2026-10-29 形成的 `Building-Mother-Lean-Code-20261029.zip` 是否已经让全部活动入口满足该要求？

## 当前基线与输入

- `guilin-dem-pipeline/main`: `3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- root `AGENTS.md`: blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS: blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate: blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate: blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest before this run: comment `6483698029`（N208，仍无外部 Mother ACK）
- #63 latest: comment `5910449798`（N49）
- audited artifact: `Building-Mother-Lean-Code-20261029.zip`
- artifact size: `849144` bytes
- artifact SHA-256: `481b8865137f817bd3a128df52536b6e69afad45d952d159b654fc113afa0a8f`
- extracted manifest SHA-256 and entrypoint SHA-256 are recorded in the machine result.

## 去重

N197 `BUILDING-LEARNED-SYSTEMS-NOT-INSTANTIATED-001` 管“外壳或文档不能代替已学习系统的对象与关系”。它不管显示投影。

本轮新增边界仅是：**当用户已冻结禁止透视时，活动入口的依赖闭包中仍可到达透视相机、按 depth 缩放或 FOV 透视射线，即 fail closed；把文件放进 Lean 包、改名、或只删除图片不能算移除。**

## 可反驳回放

探针从 `ENTRYPOINTS.json` 的 8 个入口开始，只沿字面量静态 `script src`、`import/export`、动态 `import()` 与 `new URL(..., import.meta.url)` 建图；共解析 157 个唯一可达文件，静态依赖缺失为 0。

结果：

- 6 / 8 个入口仍可到达透视显示路径；
- 2 / 8 未检出透视 marker，但“未检出”不等于视觉验收或全局合格；
- 系统级冻结要求只需一个活动反例即被证伪，因此总体判定为 `REJECT_ACTIVE_PERSPECTIVE_MODE_STILL_REACHABLE`。

活动反例：

1. `building-mother-workbench-r06`：可达 `shared-display/workbench-ui.mjs -> fitBoundsCamera`，继续可达 `desktop-display.mjs` 的 `Math.tan(fov/2)` 与 `depth` 除法；
2. `tower-mother-r01`：同一路径；
3. `building-language-r01`：活动 UI 使用 `cameraRay`，其相机实现以 `tan(fov/2)` 生成射线；
4. `building-relationship-r01`：同一透视 ray/label projection；
5. `warehouse-analysis-3d-r02`：CPU 路径用 `fovRadians`、`tan(fov/2)` 和按 depth 投影；
6. 香港三栋入口：`semantic-app.mjs` 直接调用 `fitBoundsCamera`，并以 `x/depth`、`y/depth` 更新标签；`desktop-display.mjs` 的注释和错误状态也明确称其为 perspective fit。

未检出 marker 的 `knowledge-lab-r01` 与 `elevator-mother-r02` 只保留 `UNKNOWN`：静态 marker absence 不能晋级为用户接受。

## Candidate gate

### Task Anchor

增加：

- `displayProjectionInvariant = PERSPECTIVE_DISPLAY_FORBIDDEN`
- `allowedProjectionModes = [ORTHOGRAPHIC]`
- `projectionScope = all active Building entrypoints and reachable render/pick/label paths`
- `legacyProjectionHandling = NOT_REACHABLE_FROM_ACTIVE_ENTRYPOINTS`

### Delivery Receipt

要求：

- `entrypointReachabilityManifest`
- `projectionModeByEntrypoint`
- `renderProjectionEvidence`
- `pickRayProjectionEvidence`
- `labelProjectionEvidence`
- `legacyPerspectiveReachable = false`
- `independentVerifier`

### Fail closed

- 任一活动入口可到达 `fitBoundsCamera`、perspective FOV ray、`x/depth` 或等价近大远小投影；
- 仅改 UI 文案，底层 renderer/picker/label 仍为透视；
- 旧透视模块仍被活动入口或 wrapper 重新导出；
- Producer 自批；
- 没有同一精确候选的入口全量回放。

## 最小解除条件

在隔离 Building Candidate 上：

1. 8 个入口（或 Mother 明确确认的当前活动入口全集）全部使用正交相机；
2. renderer、拾取射线、标签定位三条路径一致；
3. 旧透视模块可以保留历史，但不得从任何活动入口可达；
4. 同一对象仅改变相机距离时，屏幕尺寸保持不变；改变正交 scale 时才允许尺寸变化；
5. 独立 verifier 重跑静态闭包与浏览器正/负控；未通过不得称 `IMPLEMENTED / ADOPTED / USER-ACCEPTED`。

## 外部老师

`NO_NOVELTY`。本轮事实来自用户冻结要求与当前 Lean Code 源码。正交/透视定义不是当前缺口；缺口是用户纠正没有形成活动入口级回归与验收语义，因此不增加老师名单。

## 状态

- `POSTED`: false（写本记录时）
- `ACKNOWLEDGED`: false
- `IMPLEMENTED`: false
- source/static `GATE-RUN`: true
- production/browser `GATE-RUN`: false
- `ADOPTED`: false
- `USER-ACCEPTED`: false

未修改 main、生产 Building Mother、R2 OS、全局门禁或公网页。KPI：unknown。
