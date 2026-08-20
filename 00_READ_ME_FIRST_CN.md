# 桂林扩展 DEM 全量本地包

版本：2.0.0

这个压缩包已经把本地下载、边界解析、增量检索、12.5 米拼接、约 30 米预览、COG 输出、质检、三维网页、GitHub Actions、GitHub Pages、测试和推送脚本整合在一起。

## 第一步

解压到本地磁盘。请勿直接在压缩包预览窗口中运行。

## 第二步

根据需要双击根目录入口：

`00_BUILD_AUTO_NO_FLASH.cmd`

`01_BUILD_ASF_12_5M_NO_FLASH.cmd`

`02_BUILD_PREVIEW_30M_NO_FLASH.cmd`

## 第三步

完成本地检查后，双击：

`06_PUSH_TO_GITHUB_NO_FLASH.cmd`

默认仓库为 `haihao0307/GeoJson2UE`，默认分支为 `dem-zhenbaoding-yangshuo-pingle`。脚本只同步 DEM 项目目录和对应工作流。

详细说明位于 `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/docs`。
