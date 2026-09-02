# Weather Mother 新窗口启动入口

## 当前续接优先级

继续工作时先读取：

1. `UNIFIED_STUDIO_POLICY.json`
2. `studio-v040/MANIFEST.json`
3. `research/WEATHER_MOTHER_OFFICIAL_SOURCE_REGISTRY_V1.json`
4. `research/EASY_RAIN_DISTILLATION_V1.md`
5. `rain-v040/MANIFEST.json`
6. `rain-v040/QA.json`
7. 本文件下面保存的 V1.1.0 全量包记录

当前唯一公开工作平台：

`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/`

根入口默认进入 World。左侧常驻 `WEATHER MOTHER` 小拉块用于进入 Rain、Snow、Fog、Cloud、Storm 和 World。所有天气系统都是 Weather Mother 壳层中的模块，不得重新包装成独立 Mother 或独立公开平台。

当前 Rain 版本为 `0.4.0-visual-truth-candidate`，运行目录为 `weather-mother/rain-v040`。它从 EasyRain 公开资料中蒸馏功能组织和视觉质量目标，同时保持独立实现，没有复制商业 Blueprint、Niagara 图、材质图、贴图、Flipbook、模型、音频或二进制资产。

Rain V0.4 当前包含：

1. 世界空间近景与中景雨滴。
2. 由终端速度和快门时间控制的细雨线。
3. 三层远景雨幕。
4. 屋檐滴流和地面、瓦面撞击飞溅。
5. 程序化板瓦、筒瓦和烧结砖试验对象。
6. 瓦槽汇水、砖体吸水、湿润、积水、涟漪、排水和蒸发的统一时间状态。
7. 缓存方向阴影、冷暖局部光、湿表面反射和雨雾空气层。
8. 成片、瓦面、檐口、砖墙、水洼和水珠六个镜头。

Rain V0.2 与 V0.3 只保留为失败和阶段对照，禁止回退为当前候选。V0.4 已通过真实 Chromium WebGL2 的源文件、压缩载荷、着色器、连续帧、多渲染通道、六镜头和诊断检查。公开页面像素验收、用户显卡原生 2K 与 4K 性能、人工视觉批准、3A 批准和生产批准继续为 false。

## V1.1.0 全量重启包记录

最新全量重启包：`weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

首次发布提交：`3e3d0867963f24391a5f8c064226722616958850`

ZIP SHA256：`9ea41a888fe8e0bd39fe03152602a66b4e98dc3a396ae704c8b1894b0702c7b8`

ZIP 字节数：`55652`

公开下载：`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

解压后先读包内 `START_HERE.md`。包内包含全天气运行代码、当前状态、统一规则快照、接入说明、测试记录和下一窗口指令。没有图片、模型、旧运行版、构建缓存或其他生产线资产。

Weather Mother 原始全天气运行版为 `1.1.0-world`，运行提交 `fa75a338f406bebfefa3ea0458366831fef7de48`，公开证据提交 `970aa25814e5d5f98cf10091da69666f62dbcd28`。人工视觉、3A 与生产批准保持 false。
