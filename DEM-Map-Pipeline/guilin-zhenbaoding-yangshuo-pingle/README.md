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
