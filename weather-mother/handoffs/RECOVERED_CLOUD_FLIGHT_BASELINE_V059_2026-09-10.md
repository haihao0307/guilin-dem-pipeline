# Weather Mother · 恢复旧“云间飞行”母版

日期：2026-09-10

## 用户纠正

用户明确指出：需要的不是新设计一个“云间飞行”，而是 Weather/温州体系过去已经完成、后来在新工作台中消失的云间飞行能力。

## 已定位的真实历史成果

冻结页面来自 `gh-pages` 历史提交：

`f91f830c0f649dbc4229ed009cb7898847e3f075`

页面：

`wenzhou-v7-full/workbench-v059/index.html`

页面标题：

`小温州 V0.5.9 · 温州完整功能恢复工作台`

固定历史页面包含：

- `cloudView`：进入云层；
- `flightView`：飞机高度；
- `ground`：地面 1.61 m；
- 完整范围、正上方、沿海近景、台风海域、旋转观察；
- WMO 十个云属；
- 地形、水面、河流与云共用同一 canvas、同一 WebGL context 与共享深度；
- 云高垂直比例 1:1，altitude offset 0 m。

## 历史浏览器证据

V0.5.9 公网 QA 提交同为 `f91f830c0f649dbc4229ed009cb7898847e3f075`。

`PUBLIC_BROWSER_QA.json` 记录：

- `oneCanvas=true`；
- `oneCamera=true`；
- `sameWebGLContext=true`；
- `sharedDepth=true`；
- `cloudRendered=true`；
- desktop 2560×1600；
- mobile 390×844 @ DPR2；
- 十个云属均完成生成与 settle；
- `cloudView` 和 `flightView` 均纳入 view regression；
- `verticalScale = 1:1 · 0 m`；
- 当时 `visualAcceptance=false`、`productionReady=false`，不得改写这一历史状态。

## 恢复原则

1. 旧 V0.5.9 云间飞行作为冻结母版保留，禁止被新 Atlas 覆盖。
2. Weather Mother 当前 YOHEI Cloud Atlas R0.2 是新的云形态/体积光学候选，不是旧飞行系统的替代品。
3. 下一步应把 R0.2 的更好云质感逐项接回旧 flight/cloudView 世界观察系统。
4. 首先只恢复观察与共享世界关系；不得因接入新云而破坏地形、海洋、米制高度或相机安全关系。
5. 旧成果恢复通过后，再做飞入云、穿薄缘、进入厚区、飞出云、云上/云下和十云属切换的近景验收。

## 固定候选入口

历史固定提交入口：

`https://rawcdn.githack.com/haihao0307/guilin-dem-pipeline/f91f830c0f649dbc4229ed009cb7898847e3f075/wenzhou-v7-full/workbench-v059/index.html`

当前 GitHub Pages 移动入口（非冻结）：

`https://haihao0307.github.io/guilin-dem-pipeline/wenzhou-v7-full/workbench-v059/`

在重新分享给用户前，必须重新执行公网浏览器检查，至少点击 `cloudView` 与 `flightView` 并确认云仍渲染、共享深度仍成立、相机安全状态没有丢失。
