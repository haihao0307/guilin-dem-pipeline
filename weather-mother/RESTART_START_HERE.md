# Weather Mother 新窗口启动入口

## 当前续接优先级

继续工作时依次读取：

1. `UNIFIED_STUDIO_POLICY.json`
2. `studio-v040/MANIFEST.json`
3. `research/WEATHER_MOTHER_OFFICIAL_SOURCE_REGISTRY_V1.json`
4. `rain-puddle-study-v010/FARAZ_RAIN_PUDDLE_DISTILLATION_V1.md`
5. `rain-puddle-study-v010/MANIFEST.json`
6. `rain-puddle-study-v010/QA.json`
7. 本文件下面保存的 V1.1.0 全量包记录

当前唯一公开工作平台：

`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/`

根入口默认进入 World。左侧 `WEATHER MOTHER` 拉块用于进入 Rain、Snow、Fog、Cloud、Storm 和 World。所有天气系统均为 Weather Mother 壳层中的模块。

当前 Rain 研究候选为 `0.1.0-distilled-candidate`，运行目录为 `weather-mother/rain-puddle-study-v010`。它固定读取 `Faraz-Portfolio/demo-2023-rain-puddle` 的 `main` 分支提交 `257066b63d08b227df8f982377e60f91752ddc81`，并完成雨滴、水洼、涟漪、飞溅、环境闪光与声音组织的清洁蒸馏。

许可证边界：仓库根 `LICENSE` 为 GNU GPL v3.0，作者项目页页脚当前写 GNU AGPL v3.0。道路贴图、HDR、贴花和音频没有独立来源收据。Weather Mother 运行时没有复制该仓库的源码、纹理、HDR、模型、翻页图、音频或二进制资产。

当前演示包含：

1. 五秒共享降雨状态渐入。
2. 世界空间近景与中景雨带，以及三层远景雨幕。
3. 终端速度与快门时间控制的可见雨线。
4. 连续水洼场、多中心涟漪和程序化飞溅。
5. 湿润、积水和涟漪的阶段演化。
6. 程序化雨声、积水击打、夜间底噪、风声和雷声。
7. 环境闪光与按距离和声速延迟的雷声事件。
8. 手机控制面板默认关闭，观景后 Weather Mother 顶栏和抽屉离开画面，只留下低透明度 WM 返回入口。

Rain V0.2、V0.3 与 V0.4 只保留为阶段对照。当前演示已通过本地 Chromium WebGL2、着色器、连续帧、程序化声音和移动端沉浸界面检查。公开页面像素验收、用户硬件性能、人工视觉批准、3A 批准和生产批准继续为 false。

## V1.1.0 全量重启包记录

最新全量重启包：`weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

首次发布提交：`3e3d0867963f24391a5f8c064226722616958850`

ZIP SHA256：`9ea41a888fe8e0bd39fe03152602a66b4e98dc3a396ae704c8b1894b0702c7b8`

ZIP 字节数：`55652`

公开下载：`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

Weather Mother 原始全天气运行版为 `1.1.0-world`，运行提交 `fa75a338f406bebfefa3ea0458366831fef7de48`。人工视觉、3A 与生产批准保持 false。
