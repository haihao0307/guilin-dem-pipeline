# 桂林扩展 DEM 全量本地与 GitHub 生产包

版本：2.0.0

本项目覆盖资源县真宝鼎峰顶向真北十五公里至阳朔县和平乐县共享边界。输出坐标系固定为 `EPSG:32649`。正式目标是 12.5 米输出像元的 ASF RTC 参考 DEM，同时保留约 30 米公开地形的完整范围预览模式。

## 本地入口

在本目录中双击：

1. `00_BUILD_AUTO_NO_FLASH.cmd`：优先使用 Earthdata Token 下载 ASF 数据。Token 缺失或 ASF 下载失败时生成约 30 米完整范围预览。
2. `01_BUILD_ASF_12_5M_NO_FLASH.cmd`：只接受 ASF 12.5 米模式。Token 缺失或下载失败时停止。
3. `02_BUILD_PREVIEW_30M_NO_FLASH.cmd`：直接生成约 30 米完整范围预览。
4. `03_OPEN_LOCAL_WEB_NO_FLASH.cmd`：打开本地网页。
5. `04_SELF_TEST_NO_FLASH.cmd`：运行结构检查、语法检查和合成栅格测试。
6. `05_EXPORT_RESULTS_NO_FLASH.cmd`：把本地成果打成可归档压缩包。

根目录也提供同名编号入口。所有入口都会保留命令窗口并写入日志。

## 数据目录

旧五片可放入 `data/existing_five`。运行过程和大文件统一写入 `C:\HaihaoDEM\Guilin_Extended_DEM_Full_v2_0`，源代码目录保持干净，便于提交 GitHub。

## GitHub

仓库工作流位于仓库根目录 `.github/workflows/guilin-dem-extended.yml`。本地完整包根目录的 `06_PUSH_TO_GITHUB_NO_FLASH.cmd` 默认提交到 `haihao0307/GeoJson2UE` 的 `dem-zhenbaoding-yangshuo-pingle` 分支。

## 数据声明

12.5 米表示输出像元间距。成果名称固定使用“ASF RTC 12.5 米参考 DEM”。公开预览成果保留约 30 米来源标识。源片、哈希、覆盖计数、填补分类和质检报告均分层保存。

## 水面与近景处理

`scripts/download_waterways_osm.py` 使用超出 DEM 边界的 Overpass 搜索包络，下载漓江、湘江、太平河及周边水系的中心线与已制图水面。网页把有原始水面多边形的要素按面渲染；没有面数据的河道才生成宽度感知的水面带，并在每个河段按上游 1 倍到下游 3 倍渐变。所有几何会插入与地图边界的交点，水面不会在边缘内侧自行截断。水系名称只保留在来源元数据，不进入画面。

近景 60 平方公里区域由 `skills/generate-guilin-dem-fine-regions` 管理。`skills/process-dem-with-gaea` 及 `metadata/gaea/terrain-processing-profile.json` 负责 Gaea、Erosion2、Thermal2、Outcrops、喀斯特材质与植被衍生层的可审计接入；这些是可视化层，不会被冒充为实测高程。

12.5 米下载检索已经选出 10 个 ASF 产品，当前唯一阻塞是 `EARTHDATA_TOKEN` 未设置，详情见 `metadata/12_5m_download_status.json`。
