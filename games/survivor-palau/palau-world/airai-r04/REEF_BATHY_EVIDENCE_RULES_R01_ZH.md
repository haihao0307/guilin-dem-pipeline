# Airai 礁盘内水深证据规则 R01

## 一个总指挥

所有陆地、海床、水面、人物、鱼、珊瑚、巡逻艇、碰撞与渲染只能读取：

```text
PalauWorld.sample(E, N, Z, time, observationBand)
```

NOAA ENC、NOS 水深测量、多波束、GMRT、Allen Coral Atlas、Sentinel-2、OSM 都只是证据声部，不允许各自形成一套互相冲突的世界。

## 用户锁定的空间关系

- `AIRAI_CONTEXT_R01`：框内岛屿全部保留；除 Airai 核心外只需低频/中频背景形状。
- `AIRAI_STORY_REEF_CORE_R01`：故事岛及 Airai 邻近岛群，使用低频、中频、高频与局部甚高频共同恢复。
- 礁盘外：快速下切为深海背景，不扩展玩法探索。
- 礁盘内：真实标注水深；用户当前工作假设为 channel 约 60–70 m、礁盘内通常不超过 100 m，但必须由实际证据检验，不得反向强迫数据符合假设。

## 证据优先级

1. NOAA/NOS 实测水深、BAG、数字 sounding 与明确垂直基准。
2. NOAA ENC `SOUNDG`、`DEPCNT`、`DEPARE`，同时读取 `M_QUAL` 与 `M_SDAT`。
3. 近岸实测/校准线，例如 ATL24 或可信单波束/众包航迹。
4. 经过实测点校准的卫星浅水水深。
5. Allen Coral Atlas reef extent、geomorphic、benthic 与 bathymetry。
6. GMRT measured mask / topo-mask。
7. GEBCO、ETOPO 等低频背景。

低质量背景不得平均稀释高质量实测数据。

## 垂直基准

- NOAA ENC 深度相对于图幅 chart datum；在 `M_SDAT` 完整解析前不得与陆地正高或 WGS84 椭球高直接合并。
- 上传 DEM 的原始分支仍保留 WGS84 椭球高身份。
- 所有未知 datum 数据进入隔离层。

## 允许的候选表达

可根据 `SOUNDG + DEPCNT` 生成稀疏证据插值面，但必须同时输出：

- 最近证据距离；
- 参与插值的证据类别；
- 局部离散度/不确定度；
- 无证据区的 NoData；
- 不得把插值结果标成测绘真值。

## 今夜目标

1. 找齐覆盖 Airai 核心的 NOAA ENC 图幅并提取水深、等深线、深度区、底质、质量和基准。
2. 查询 NOAA NOS hydrographic survey 与 multibeam 覆盖。
3. 获取 GMRT context 与 measured mask。
4. 查询 Sentinel-2 低云场景与 Allen Coral Atlas habitat/reef 服务。
5. 生成第一份礁盘内水深证据总账、覆盖缺口、统计和候选插值面。
