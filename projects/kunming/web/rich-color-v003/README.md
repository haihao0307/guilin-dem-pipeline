# 昆明 DEM 丰富卫星图式三维查看器 V003

这是昆明生产线的稳定三维底座。页面从冻结的 12.5 米 DEM 浏览器高度纹理恢复自然比例三维地形，并通过 `scripts/generate_kunming_rich_surface_v003.py` 现场重建丰富色彩图。

本版没有接入河流和湖泊。此前 `kunming-osm-hydrology-v001` 的二进制水系载入存在 Float32 字节对齐错误，因此真实 OSM 水系必须在独立修复和浏览器 QA 后再接入。

部署目录：`kunming-rich-color-v003/`

GitHub Actions 同时生成：

- 在线网页
- `KUNMING_DEM_3D_WEB_V003_RICH_COLOR_FIX.zip`
- 构建报告和 SHA256
