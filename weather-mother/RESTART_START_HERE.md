# Weather Mother 新窗口启动入口

## 当前续接优先级

继续工作时先读取：

1. `UNIFIED_STUDIO_POLICY.json`
2. `studio/MANIFEST.json`
3. `research/EASY_RAIN_DISTILLATION_V1.md`
4. `rain-v030/MANIFEST.json`
5. `rain-v030/QA.json`
6. `rain-v030/PUBLICATION_RECEIPT.json`
7. 本文件下面保存的 V1.1.0 全量包记录

当前公开入口只有 Weather Mother：

`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/`

Rain、Snow、Fog、Cloud、Storm 和 World 都是 Weather Mother 壳层下的模块。根入口默认进入 World，左侧常驻小拉块负责返回模块列表。不得再次把 Rain、Snow、Fog 或其他天气案例包装成独立 Mother 或独立公开工作平台。

当前 Rain V0.3.4 为 Easy Rain 官方公开资料蒸馏后的独立程序化候选。它包含世界空间雨带、快门时间拖尾、近中远降雨层、三层远景雨幕、瓦面沟槽汇水与檐滴、烧结砖吸水和水路、地面积水与涟漪，以及四套冷暖光照候选。商业 Easy Rain 资产没有复制进入运行时。

Rain V0.2 已登记为 rejected draft，只保留失败对照。后续不得从 V0.2 回退，也不得用满屏高亮长线代替雨滴和雨幕层次。

Rain V0.3.4 已通过真实 Chromium WebGL2 的压缩载荷、着色器、连续帧、六镜头和五诊断自动检查。公开页面像素验收、用户显卡 2K 与 4K 性能、人工视觉批准、3A 批准和生产批准继续为 false。

## V1.1.0 全量重启包记录

最新全量重启包：`weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

首次发布提交：`3e3d0867963f24391a5f8c064226722616958850`

ZIP SHA256：`9ea41a888fe8e0bd39fe03152602a66b4e98dc3a396ae704c8b1894b0702c7b8`

ZIP 字节数：`55652`

公开下载：`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

解压后先读包内 `START_HERE.md`。包内包含全天气运行代码、当前状态、统一规则快照、接入说明、测试记录和下一窗口指令。没有图片、模型、旧运行版、构建缓存或其他生产线资产。

Weather Mother 运行版为 `1.1.0-world`，运行提交 `fa75a338f406bebfefa3ea0458366831fef7de48`，公开证据提交 `970aa25814e5d5f98cf10091da69666f62dbcd28`。人工视觉、3A 与生产批准保持 false。
