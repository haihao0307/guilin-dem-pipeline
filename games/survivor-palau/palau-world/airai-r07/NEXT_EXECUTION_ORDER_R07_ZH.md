# Airai / Stone Money Island 下一执行令 R07

## 输入

仅使用：

- 用户完整帕劳总图身份：`IMG_7975.jpeg` / SHA-256 `5b6e1d716bfa66f204aac9240944fe5d1526444d981ccb8a3f23875633d73312`
- 用户黄色 Stone Money 故事区域身份：`IMG_7974.jpeg` / SHA-256 `4fad4cd637fd556044fec5cfd56f6ef29eb8859a72a543788feb7084c4daeb47`
- 已下载 NOAA ENC / NCEI / GMRT / Allen Coral Atlas / Sentinel / OSM / Palau DEM 证据

## 立即执行

1. 以完整总图为固定底图，先做证据坐标对齐，不重画总图。
2. 以黄色手绘圈的整个区域为故事区域，不再收缩成单点。
3. 从 NOAA ENC 中提取并核对：`COALNE`、`LNDARE`、`SOUNDG`、`DEPCNT`、`DEPARE`、`M_QUAL`、`M_SDAT`、航道与危险物。
4. 把 Koror–Babeldaob（KB）大桥 / Toachel Mid 作为 channel 连通性硬检查点；任何水道结果必须从桥下连续通过。
5. Allen/OSM 只作为礁盘与岸线语义交叉证据；Sentinel 只作为光学证据；不得把它们直接当测深。
6. 下一张新图只能是“用户原图 + 实际证据叠加图”，不得再创作结构分离图。
7. 证据不足区域保持 UNKNOWN / NoData，不凭想象补齐。

## 禁止

- 禁止使用 R05 或其任何衍生截图、参数或位置。
- 禁止 Boracay、Orrak、Ngellil 及旧候选重新进入故事区域。
- 禁止把陆地轮廓扩大成礁盘。
- 禁止把 channel 画成不经过 KB 大桥的封闭或断裂水道。
- 禁止把规划、示意图或配色图称为真实地理进展。

## 首个合格输出

一张可核对的证据叠加图，按顺序同时显示：

1. 原样完整总图；
2. 原样黄色故事区域；
3. NOAA 岸线、陆地、水深点、等深线和深度区；
4. KB 大桥与连续 channel；
5. 数据来源、图幅、垂直基准、NoData 与不确定度。

在这张图通过小妈监督和用户确认之前，不进入新三维世界候选。
