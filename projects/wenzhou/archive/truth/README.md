# 温州清江 22000 平方公里权威 DEM 归档

本目录用于长期保存温州清江任务的完整 12.5 米输出网格 COG 与校验记录。

## 权威文件

```text
文件名
WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif

目标仓库路径
projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif

字节数
54638031

SHA-256
8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e

尺寸
11866 × 11866

像元
12.5 m × 12.5 m

坐标系
EPSG:32651

范围
239645.652694, 3054965.110786, 387970.652694, 3203290.110786
```

## 归档判定

只有同时满足以下条件，才可将状态改为 `archived_verified`。

1. 上述目标路径已经由 Git LFS 管理。
2. GitHub LFS 中存在完整二进制对象。
3. 从 GitHub 重新下载后文件大小仍为 54,638,031 字节。
4. 重新下载文件的 SHA-256 与权威值完全一致。
5. `git lfs fsck` 通过。

当前状态记录在 `archive-manifest.json` 中。任何仅包含文件名、LFS 指针、缩略图、2048 高度纹理或校验值的提交，都不能单独视为完整 DEM 归档。

## 数据保护规则

权威 COG 保持只读。后续水系、侵蚀、岩石、生态、农业、历史覆盖和程序化微地形均使用独立派生层，不得覆盖此文件。

`.gitattributes` 已配置 `*.tif` 和 `*.tiff` 由 Git LFS 管理。Windows 上传入口为仓库根目录的 `09_UPLOAD_WENZHOU_DEM_TO_GITHUB_LFS.cmd`。