# Git LFS 状态

当前目录只保留一个 12.5 米 DEM 的 Git LFS 指针。

文件：`data/raw/asf/AP_10613_FBS_F0480_RT1.dem.tif`

对象 SHA256：`ff968e6f826d7b02605466fcbf8fa1a29f72033767361786c33539cd20342747`

大小：71398860 字节

`lfs_object_uploaded` 当前仍为 `false`。GitHub 连接器可以提交指针和文本，无法上传 Git LFS 实体对象。需要在持有本地 DEM 文件且已经登录 GitHub 的电脑上执行一次 Git LFS 推送，随后在全新目录执行 `git lfs pull` 并运行 `tools/verify_dem.py`。

另外十张源 DEM 的实际字节文件尚未进入当前运行环境，不能伪造为已上传。
