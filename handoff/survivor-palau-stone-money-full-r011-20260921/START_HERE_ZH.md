# Survivor Palau / Stone Money Island 全量交接 R11

日期：2026-09-21

这是当前执行线的完整重启入口。新对话必须从本文件开始，不要从 main、R05、旧定位或旧工作台开始。

## 项目方向

- 游戏主名：**Stone Money Island**
- 副名：**Survivor Palau**
- 核心：1944 年帕劳荒岛生存、捕鱼、建设、躲避日军巡逻艇并最终求救。
- 世界驱动：统一 `PalauWorld.sample()` / 靠谱世界场；禁止重新回到传统 LOD。

## 唯一用户权威输入

### 完整 Palau 总图

文件：`01_USER_AUTHORITY/01_PALAU_FULL_FRAME_USER_ORIGINAL.jpeg`

SHA-256：`5b6e1d716bfa66f204aac9240944fe5d1526444d981ccb8a3f23875633d73312`

- 第一视图必须完整显示这张图定义的范围。
- 不得裁掉、重画、卡通化或替换。
- Airai 细节视图是在完整世界关系上进入细节，不是删除周边。

### Stone Money Island 黄色故事区域

文件：`01_USER_AUTHORITY/02_STONE_MONEY_YELLOW_AREA_USER_ORIGINAL.jpeg`

SHA-256：`4fad4cd637fd556044fec5cfd56f6ef29eb8859a72a543788feb7084c4daeb47`

- 黄色手绘圈出的整个区域才是故事区域。
- 不是单一坐标点。
- Boracay、Orrak、Ngellil 与过去所有自动猜测候选全部作废。

## 必须复用的现成资产

用户明确要求：**不重新设计云、海水、海面、海滩。**

必须从历史 Survivor Palau / Ocean Mother 生产代码恢复已经做好的版本。任何新做的卡通海面、卡通岛体、示意云层都不算进展。

## 地理与海洋关系

- 框内全部岛屿保留。
- Airai 与黄色故事区域做高精度；其他岛屿保持真实整体形状，但不做同等级细节。
- 岛体、沙滩、礁盘和近岸水深属于一个连续系统，不能割裂成卡通块面。
- 礁盘内恢复真实浅水、泻湖、channel 与海底起伏。
- Channel 必须与 KB 大桥 / Toachel Mid 水道保持连续。
- 礁盘外逐渐下切为深海背景，不作为主要探索区。
- NOAA 海图深度保留原始图表基准；不得把插值冒充测绘真值。
- 证据不足区保持 UNKNOWN / NoData。

## 数据来源

全量包构建时会收入：

- 用户上传的两张原始 Palau DEM GeoTIFF；
- NOAA ENC / NCEI / GMRT / Allen Coral Atlas / Sentinel / OSM 的已有数据与来源账本；
- NOAA `SOUNDG`、`DEPCNT`、`DEPARE`、`COALNE`、`LNDARE`、`M_QUAL`、`M_SDAT`、海床性质、障碍物、水下岩石和航道相关数据；
- Survivor Palau v0.1.0–v0.2.3 历史代码、Ocean Mother、海滩、飞行视角和游戏循环代码。

## 明确禁止

- R05 已删除，禁止复活。
- R06 自行创作的结构分离图已删除，禁止引用。
- R08/R08.1 只能作证据载入工具，不能当游戏世界。
- R10 的新做云、新做海面与卡通化地形方向已否决，只允许回收技术代码。
- 禁止旧工作台冒充当前进展。
- 禁止重新猜故事岛位置。
- 禁止重新设计 Ocean Mother 已完成的云、水、海面和海滩。
- 禁止卡通化 Palau DEM 或岛群。
- 正式验收必须是 GitHub Pages 一按直开，不能要求下载、解压或经过中转页。

## 当前真实状态

- 用户权威图：冻结。
- 原始 Palau DEM：已收集。
- NOAA / Allen / Sentinel / OSM 来源与派生证据：已收集。
- Ocean Mother 与海滩历史组件：存在，待正确恢复复用。
- 当前没有用户视觉批准的新三维世界。
- `visualAcceptance=false`
- `productionReady=false`

## 下一执行顺序

1. 从已有正式生产代码恢复原 Ocean Mother 云、海水、海面和海滩，不重新制作。
2. 以完整 Palau DEM 建立真实、非卡通的总世界。
3. 第二视图进入 Airai 细节，同时保留外围世界上下文。
4. 将黄色故事区域作为完整 AOI 映射，不缩成点。
5. 接入 NOAA 水深、等深线、深度区、质量区与 NoData。
6. 验证 KB 大桥下 channel 连续。
7. 将地形、海床、海面、鱼、珊瑚、人物、巡逻艇和碰撞统一接入 `PalauWorld.sample()`。
8. 生成桌面与 390×844 手机真实浏览器截图，控制台 0 错误。
9. 只在有新截图和直接在线工作台时汇报进展。
