# Storm Orb · 实时视觉学习案例 02

参考来源：[Q. / @qornflex — Storm Sample, 2019-01-28](https://x.com/qornflex/status/1089870266526846976)。原参考为 11 秒、720×720、30fps 动画。此目录不包含原作视频、截图、模型或源码，也未声称取得原作的再发布授权。

此案例独立实现程序化实时云体、地形、草叶、雨幕、房屋、闪电，以及近到远的观察镜头。暂停、时间轴、重置及自由相机为新增学习控件，不是原视频的游戏规则。原作使用 Houdini / Redshift 等离线制作工具；本实现不应描述为同等保真。

复用兄弟目录 `voxel-train-study/vendor/` 中 Three.js r170 和 OrbitControls，不复制依赖。MIT 许可随原依赖存于其 `licenses/`。

本地运行：从仓库根目录 `python3 -m http.server 8765`，访问 `/kaopu-minigame-workbench/storm-orb-study/`。

验证：`node --check app.mjs`、`node --check scene.mjs`。安装官方 Playwright 后，从仓库根目录运行 `node kaopu-minigame-workbench/storm-orb-study/tests/browser.cjs`；设置 `STORM_BROWSER=webkit` 可测试 WebKit，`STORM_URL` 指定目标，`STORM_QA_DIR` 指定证据输出。

待实际浏览器验证和视觉对照通过后才可发布。本目录首轮版本为本地候选，不能将语法通过视为视觉验收。
