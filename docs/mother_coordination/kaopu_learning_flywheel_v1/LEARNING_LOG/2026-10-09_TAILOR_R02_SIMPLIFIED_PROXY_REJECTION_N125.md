# N125 — Tailor R02 真实 WebGL 仍可能是简化代理成衣

Date: 2026-10-09 15:40 +08:00  
Status: **existing N124 regression updated with a real counterexample / Tailor-only / not adopted**  
Scope: PR #180 三维电子橱柜；不修改 Tailor 生产分支、`main`、`gh-pages`、R2 或现行阈值

## Bounded question

PR #180 已有 60/60 WebGL 缓存缩略图、塑料展示模特、可旋转三维详情和公网浏览器绿色回执。它能否因此证明 N124 的“每个预设来自真实 preset-specific 三维成衣几何”已经满足，并成为后续父节点？

## 现有真实失败

基线仍是 `main@5bdd2d6aa4989ac6acedb99411c207c267b8937b`；根 `AGENTS.md`、R2、reference gate、freshness gate 未发生变化。#91 最新真实反馈仍是 N75 query-scope correction（comment `5979603278`），#63 最新真实反馈仍是 N49 Coast public-browser hold（comment `5910449798`）。

N124 路由之后，Tailor 新建 Draft PR #180。其精确终态为：

- source `4ca3569f763fc4dae361d905c8d4696f2f56709f`；head `a9148f6860b9fa9f892b97456f4601c34ea95e04`；
- run `37896825675` 成功；公网 URL 为 `https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r02/?preset=J06`；
- PUBLIC_REPORT 证明 60 张卡片均为真实 WebGL 缓存图、临时 renderer 已释放、页面保留一个活动 canvas、纸样另页可读、桌面和 390×844 Chromium viewport 无 HTTP/page error；
- 它诚实保留 `clothSimulationRun=false`、`physicalFitAccepted=false`、`dynamicWearCertified=false`。

这些都是合法技术增量，不能回写成“假网页”或“没有做三维”。但 `showcase-3d.mjs` 的三维服装不是从 P01 的纸样裁片、缝边或 R07.4 成衣几何派生：

- `buildGarment(row)` 只按 `category` 选择 `topGarment`、`skirtGarment`、`pantsGarment`；
- 局部差异来自 `row.style` 和少量 design override；
- 可见形体主要由 `SphereGeometry`、`CylinderGeometry`、`ConeGeometry`、`BoxGeometry` 及一个手写 skirt surface 拼装；
- 该 renderer 不读取 `paperAsset`、`recipeHash`、`geometryHash`、panel 或 seam；实际纸样只在独立第二标签读取并画成 SVG；
- QA 断言“60 张 WebGL 图片存在”和“纸样标签可读”，没有断言每张三维几何由对应纸样/成衣生成，也没有逐成员 garment-geometry identity receipt。

公网页面保存的桌面证据也显示大量上装以同一筒状躯干、球/筒关节和简化袖筒表达。用户随后明确纠正：当前这种简易版达不到要求，不要生成替代图片，直接继续修改 GitHub 文件。

所以 R02 的正确状态拆分是：

- `WEBGL_PROXY_CABINET_VERIFIED_SCOPED`：成立；
- `SIXTY_ACTUAL_GARMENT_THUMBNAILS_VERIFIED`：不成立；
- 当前决定：`REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT`；
- 不允许把 R02 的简化代理形体提升为下一版服装几何父节点。

## 外部方法 / 证据

NIST SP 500-93 将 requirements tracing 描述为核对软件是否真正响应每项需求、测试响应是否适当的方法。NASA SWE-053 要求需求变化必须同步追踪到设计、代码和测试。外部方法支持本轮的区分：测试“WebGL 图片存在”不能替代测试“图片中的几何来自指定真实成衣对象”。

## 与 KAOPU 当前制度比较

这不是新制度。N124 已要求逐成员绑定 `presetId → design/paper identity → garment geometry identity → mannequin → render config → thumbnail digest → public readback`，且已明确拒绝 generic substitute。PR #180 是该规则的第一个真实反例：它满足了 WebGL、覆盖数和公网可达性，却没有满足 actual garment-geometry derivation。

因此本轮不新建 regression case，只把真实反例追加到 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`，并新增 `REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT` 状态。

## 可反驳假设

若 N124 的逐成员派生门正确，则：

1. 真实 WebGL + 60/60 + 塑料模特仍不足以自动通过；
2. 若三维 renderer 不消费对应 paper/seam/garment geometry identity，应拒绝为 simplified proxy；
3. 纸样只在第二标签可读，不能建立“纸样 → 三维成衣”派生链；
4. 只有 60 个成员各自提供实际成衣几何 identity、来源绑定、缩略图摘要和网页回读时，才允许 scoped pass；
5. scoped pass 仍不等于布料物理、动态穿着、真机或用户验收。

## 最小历史回放

执行：

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/tailor_r02_simplified_proxy_gate_n125.mjs`

结果 `12/12`。真实 PR #180 subject 得到 `REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT`；技术绿色被保留为 `WEBGL_PROXY_CABINET_VERIFIED_SCOPED`。负控证明仅加入 60 个不同 data URL、不同 preset ID、真实 WebGL 或独立 paper tab 都不能解除 HOLD；只有合成的 60/60 actual garment-geometry derivation receipts 得到 scoped pass。

## 适用边界 / 是否采用

- 决定：更新既有 Tailor-only Candidate；`no-novelty`，不改全局 OS。
- 保留：R02 对公网 WebGL 柜、渲染器生命周期、视口和链接的技术成功。
- 拒绝：把 generic/category-style primitive 代理称为 60 套真实成衣；把它作为下一版真实服装几何父节点。
- 下一合法候选：直接修改 GitHub 源码，让每张卡的 3D 形体读取或生成自对应 preset 的实际纸样/缝合/成衣几何，并提供逐成员不可变 receipt；禁止图像生成替代。
- 不要求：每张卡长期保留 WebGL context；允许缓存缩略图，但缩略图的源几何必须合格。
- 生命周期：R02 生产候选 `IMPLEMENTED=true`、公开门 `GATE-RUN=true`，但本回归判定 REJECT；N125 路由待发布到 PR #180，未收到 Mother 回执，因此 `ACKNOWLEDGED=false`；`ADOPTED=false`、`USER-ACCEPTED=false`。
- KPI：本轮记录 1 次同类错误复发（从纸样替代转为简化三维代理替代）；首次候选通过率、内部迭代数、合法 candidate 时间及后续复发率仍为 `unknown`。
- 第一梯队外部 AI：未调用。
