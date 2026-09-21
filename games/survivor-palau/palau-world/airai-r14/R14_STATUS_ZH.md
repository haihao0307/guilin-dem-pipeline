# Stone Money Island / Airai R14 连续帕劳地图

## 本轮修正

- 唯一主交付为单体 HTML；双击即可直接打开，无外部脚本、样式、图片或网络依赖。
- 第一视图改为完整帕劳主群岛工作范围（Kayangel—Babeldaob—Koror/Rock Islands—Peleliu—Angaur）。
- Ocean Mother 校准小岛已从默认世界完全撤除。
- 在地图上点击 Airai / 爱来州，镜头在同一个坐标世界内连续放大；再次点击黄色故事区域，继续靠近 Stone Money 工作区域。
- Airai 和 Stone Money 不再切换成孤立方块；Koror、Babeldaob 南部、外礁、深海和周边岛屿仍保留在同一世界中。
- 证据/测深工具默认隐藏，只在主动点击“证据”后显示。
- `traditionalLOD=false`；当前使用连续视图尺度与同一坐标场。

## 浏览器实测

- Chromium 桌面 1536×960：通过。
- Chromium 移动端 390×844：通过。
- 地图点击进入 Airai：通过。
- Airai 点击继续进入 Stone Money 区域：通过。
- 连续过渡中间帧：通过。
- 控制台错误：0。
- 页面错误：0。
- 外部依赖：0。

## 证据边界与不能冒充的内容

- 完整帕劳主群岛轮廓使用本地 GSHHS 中等精度岸线。
- Airai 近区陆地和岸线使用 NOAA ENC `LNDARE` / `COALNE`。
- 礁盘语义使用 Allen Coral Atlas 派生矢量。
- 测深点使用 NOAA ENC `SOUNDG`，S-57 垂直基准仍是 code 24 `local datum`，没有擅自换算为 MSL。
- 黄色虚线圈是用户故事工作区域的范围提示，不是测绘精度边界，也不是一个猜测坐标点。
- 固定 R11 交接包没有包含用户完整帕劳原图和黄色手绘区域原图的二进制，因此 R14 先恢复正确的交互结构和连续地图逻辑，尚不能声称已原样恢复两张权威图片。
- NOAA ENC 在 Babeldaob 北侧存在图幅覆盖边界，当前放大视图中的北侧陆地区仍是候选表达；不能当作最终地形真值。

当前状态：`visualAcceptance=false`、`userAcceptance=false`、`productionReady=false`。
