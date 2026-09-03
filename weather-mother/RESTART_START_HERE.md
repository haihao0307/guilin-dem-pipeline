# Weather Mother 新窗口启动入口

## 当前唯一公开工作平台

`https://haihao0307.github.io/guilin-dem-pipeline/weather-mother/`

根入口默认进入 World。左侧 `WEATHER MOTHER` 拉块进入 Rain、Snow、Fog、Cloud、Storm 和 World。所有天气系统均为 Weather Mother 壳层中的模块。

## 当前续接顺序

1. `UNIFIED_STUDIO_POLICY.json`
2. `studio-v060/MANIFEST.json`
3. `liquid-rain-v100/LIQUID_CORE_V1.md`
4. `liquid-rain-v100/MANIFEST.json`
5. `liquid-rain-v100/QA.json`
6. `research/WEATHER_MOTHER_OFFICIAL_SOURCE_REGISTRY_V1.json`
7. 本文件下面保存的 V1.1.0 全量包记录

## 当前 Rain / Liquid 基线

当前 Rain 候选为 `1.0.0-liquid-core-candidate`，运行目录为 `weather-mother/liquid-rain-v100`。

它把降雨通量、接收面液态水、吸收、积水、檐口转移、蒸发、排水、撞击涟漪、水花、程序化声音和温度相变放入同一液体状态体系。场景采用 1940 年代村落语境，并支持三维镜头、环境倒影、移动端安全区和沉浸观景。

旧运行目录 `weather-mother/rain-puddle-study-v030` 已从发布分支删除。工作台不得重新路由到该版本，也不得在当前模块列表并列保留失败运行版。需要保存的研究结论只能合并到当前知识文档或 `research` 目录。

```text
visualApproved=false
aaaQualityApproved=false
productionReady=false
```

## V1.1.0 全量重启包记录

最新全量重启包：`weather-mother/handoffs/Weather_Mother_Full_Restart_Handoff_2026-09-02_V1.1.0.zip`

首次发布提交：`3e3d0867963f24391a5f8c064226722616958850`

ZIP SHA256：`9ea41a888fe8e0bd39fe03152602a66b4e98dc3a396ae704c8b1894b0702c7b8`

ZIP 字节数：`55652`

Weather Mother 原始全天气运行版为 `1.1.0-world`，运行提交 `fa75a338f406bebfefa3ea0458366831fef7de48`。人工视觉、3A 与生产批准保持 false。
