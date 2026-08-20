桂林扩展 DEM 旧五片放置目录

把以下五张 GeoTIFF 复制到本目录后再运行本地构建：

AP_13049_FBD_F0480_RT1.dem.tif
AP_13049_FBD_F0490_RT1.dem.tif
AP_14427_FBS_F3110_RT1.dem.tif
AP_14427_FBS_F3120_RT1.dem.tif
AP_15733_FBS_F0500_RT1.dem.tif

程序会按照 config/existing_five_manifest.json 核对文件大小、SHA256、坐标系和覆盖范围。
没有找到旧五片时，自动模式仍可检索完整范围。ASF 12.5 米模式需要 NASA Earthdata Token。
