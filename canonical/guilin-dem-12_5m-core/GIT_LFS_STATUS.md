# Git LFS 状态

当前目录只保留一个 12.5 米 DEM 的 Git LFS 指针。

文件：`data/raw/asf/AP_10613_FBS_F0480_RT1.dem.tif`

对象 SHA256：`ff968e6f826d7b02605466fcbf8fa1a29f72033767361786c33539cd20342747`

大小：71398860 字节

`lfs_object_uploaded` 已为 `true`。GitHub LFS 实体对象已上传，并已通过远端 LFS 批量接口确认可下载；对象 SHA256 与本目录指针一致。随后可在全新目录执行 `git lfs pull` 并运行 `tools/verify_dem.py`。

另外十张源 DEM 的实际字节文件尚未进入当前运行环境，不能伪造为已上传。
