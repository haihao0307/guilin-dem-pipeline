# Weather Mother 新窗口启动入口

## 当前续接优先级

继续工作时依次读取：

1. `UNIFIED_STUDIO_POLICY.json`
2. `studio-v060/MANIFEST.json`
3. `rain-puddle-study-v030/FARAZ_RAIN_PUDDLE_DISTILLATION_V3.md`
4. `rain-puddle-study-v030/MANIFEST.json`
5. `rain-puddle-study-v030/QA.json`
6. `research/WEATHER_MOTHER_OFFICIAL_SOURCE_REGISTRY_V1.json`
7. 本文件下面保存的 V1.1.0 全量包记录

当前唯一公开工作平台：

`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/`

根入口默认进入 World。左侧 `WEATHER MOTHER` 拉块用于进入 Rain、Snow、Fog、Cloud、Storm 和 World。所有天气系统均为 Weather Mother 壳层中的模块。

当前 Rain 演示为 `0.3.0-village-liquid-glass-demo`，运行目录为 `weather-mother/rain-puddle-study-v030`。它固定研究 `Faraz-Portfolio/demo-2023-rain-puddle` 的提交 `257066b63d08b227df8f982377e60f91752ddc81`，并将雨滴、水洼、涟漪、飞溅、环境闪光与声音组织转化到 Weather Mother 的独立程序化实现中。

当前场景明确采用 1940 年代村落语境，现代城市天际线已经移除。远景由低矮土墙房、坡瓦屋顶、木构、树木、围栏和暖色窗光组成。道路采用泥石地表与不规则积水。

当前水面增加 Liquid Glass 光学转化，包括环境反射、涟漪折射、Fresnel 视角响应、底色透射、动态镜面高光与轻微光谱边缘。雨滴使用渐缩胶囊形状，水花由冠状环、上冲水柱和次级小滴组成，涟漪使用多中心双频传播。

声音全部由 Web Audio 程序化生成，包含雨声、村落夜间底噪、风、积水击打和延迟雷声。闪光与雷声共用同一事件。

运行采用小型 gzip 载荷，零图片、零外部模型、零外部音频、零 HDR。手机端降低内部渲染比例并限制像素数量，控制面板默认关闭，数秒后自动进入纯画面模式。

许可证边界：Faraz 仓库根 `LICENSE` 为 GNU GPL v3.0。Weather Mother V0.3 采用清洁蒸馏，没有复制该仓库源码、纹理、HDR、模型、翻页图、音频或二进制资产。

当前演示已通过 Chromium WebGL2、着色器、连续帧、程序化声音、村落背景、Liquid Glass 水面、水花和移动端沉浸界面检查。公开页面像素验收、用户硬件性能、人工视觉批准、3A 批准和生产批准继续为 false。

## V1.1.0 全量重启包记录

最新全量重启包：`weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

首次发布提交：`3e3d0867963f24391a5f8c064226722616958850`

ZIP SHA256：`9ea41a888fe8e0bd39fe03152602a66b4e98dc3a396ae704c8b1894b0702c7b8`

ZIP 字节数：`55652`

公开下载：`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

Weather Mother 原始全天气运行版为 `1.1.0-world`，运行提交 `fa75a338f406bebfefa3ea0458366831fef7de48`。人工视觉、3A 与生产批准保持 false。
