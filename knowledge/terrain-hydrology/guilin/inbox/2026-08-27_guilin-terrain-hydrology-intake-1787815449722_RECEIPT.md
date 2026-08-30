# 桂林参考图入库收据 2026-08-27

```text
scope: guilin
intake schema: terrain-hydrology-reference-intake@2.0.0
createdAt: 2026-08-27T07:24:09.720Z
file records: 18
reported source bytes: 5,861,260
metadata imported: true
source image bytes received: false
visual review available: false
status: waiting-for-embedded-source-images
```

## 当前事实

工作台导出的旧版 JSON 只保存文件名、媒体类型、字节数和本地修改时间。该文件没有包含 JPEG 原图字节，因此小华能够确认 18 张参考图的清单，暂时无法查看照片中的山形、峰丛、坡脚、河谷、台地和岸线细节。

原始清单保存在同目录：

```text
2026-08-27_guilin-terrain-hydrology-intake-1787815449722.json
```

## 解除阻塞的方法

工作台 v2.1 的资料入口会：

1. 把所选参考图保存在当前浏览器的 IndexedDB 中，刷新后继续显示。
2. 为每张图计算 SHA256。
3. 通过“导出含原图知识包”生成自包含 JSON。
4. 在 JSON 中以 Base64 保存原始图像字节，保持源文件不修改。
5. 用户把该 JSON 上传到 ChatGPT 对话或交给 Codex 后，小华即可解包查看并开始知识蒸馏。

## 蒸馏边界

```text
sourceImagesRemainUnmodified=true
requiresDistillationBeforeProductionUse=true
referenceImagesCannotReplaceRealElevation=true
truthOverwrite=false
```

照片用于提取地区形态知识和约束可逆近景增量。照片不能替代真实 DEM，也不能把视觉推断标成原生测绘精度。
