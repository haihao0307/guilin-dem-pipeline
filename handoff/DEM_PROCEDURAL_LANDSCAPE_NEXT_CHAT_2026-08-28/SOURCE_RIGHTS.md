# 原始素材与公开仓库边界

用户提供的 `地貌.zip` 包含 18 张参考照片。原图已经用于内部读取和知识蒸馏。

```text
archive bytes: 5,823,315
archive SHA256: 1d2dfb3b3dbb239ba321045bd0125072b49ffd2f3d0b0d250d601fcc292edcf9
image count: 18 JPEG
```

原始图片的公开再分发许可尚未确认，因此：

1. 本地全量交接包包含 `private_sources/地貌.zip`，方便用户在新对话中继续使用。
2. 推送到公开 GitHub 的交接包排除原始照片。
3. GitHub 继续保存来源收据、文件名、SHA256、像素尺寸、逐图观察和蒸馏规则。
4. 参考照片不能替代真实 DEM，也不能移动批准水系。
