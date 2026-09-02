# Weather Mother 新窗口启动入口

## 当前续接优先级

继续工作时先读取：

1. `UNIFIED_STUDIO_POLICY.json`
2. `studio/MANIFEST.json`
3. `rain-v020/MANIFEST.json`
4. `rain-v020/QA.json`
5. 本文件下面保存的 V1.1.0 全量包记录

当前公开入口只有 Weather Mother：

`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/`

Rain、Snow、Fog、Cloud、Storm 和 World 都是 Weather Mother 壳层下的模块。左侧常驻小拉块负责返回模块列表。不得再次把 Rain、Snow、Fog 或其他天气案例包装成独立 Mother 或独立公开工作平台。

当前新增 Rain V0.2 为视觉候选，包含雨幕破云光照、银灰阴天、冷锋暴雨、黄昏阵雨，接入 Brick Mother 烧结砖响应候选和 Tiles Mother 板瓦、筒瓦排水候选。人工视觉批准、3A 批准与生产批准继续为 false。

## V1.1.0 全量重启包记录

最新全量重启包：`weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

首次发布提交：`3e3d0867963f24391a5f8c064226722616958850`

ZIP SHA256：`9ea41a888fe8e0bd39fe03152602a66b4e98dc3a396ae704c8b1894b0702c7b8`

ZIP 字节数：`55652`

公开下载：`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

解压后先读包内 `START_HERE.md`。包内包含全天气运行代码、当前状态、统一规则快照、接入说明、测试记录和下一窗口指令。没有图片、模型、旧运行版、构建缓存或其他生产线资产。

Weather Mother 运行版为 `1.1.0-world`，运行提交 `fa75a338f406bebfefa3ea0458366831fef7de48`，公开证据提交 `970aa25814e5d5f98cf10091da69666f62dbcd28`。人工视觉、3A 与生产批准保持 false。
