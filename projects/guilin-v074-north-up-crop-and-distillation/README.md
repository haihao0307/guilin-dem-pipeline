# Guilin DEM v0.7.4 North Up Crop and Distillation Gate

本目录是桂林 DEM 清洁重启后的第一交付。当前只负责让浩哥在完整 12.5 米原始联合范围上重新绘制并导出唯一活动 AOI。

## 当前状态

* AOI 状态为 `UNCONFIRMED`。
* 正北永久朝上，页面没有旋转或三维透视入口。
* 原始 DEM 合同保持只读、12.5 米、EPSG:32649、垂直比例 1.00。
* NoData 原样保留，禁止补洞，禁止 30 米替代数据。
* 页面可绘制多边形或矩形，可编辑顶点、删除和清空。
* 页面实时显示面积、WGS84 范围和 EPSG:32649 范围。
* 页面可导出 WGS84 GeoJSON、EPSG:32649 WKT，并复制两套坐标。
* 漓江、湘江中心线和 12 张源片范围仅作辅助核对，不改变 AOI。

## 真值与网页预览

交接包锁定的原始联合 TIFF 合同为：

* 文件：`guilin_raw_union_12_5m.tif`
* SHA256：`9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4`
* 大小：124,348,471 bytes
* 网格：17,408 × 18,867
* 范围：`[349862.5, 2703012.5, 567462.5, 2938850.0]`
* 有效覆盖：86.64660094539486%
* NoData：13.353399054605147%

网页使用旧选区页保留下来的正北高程预览图，只承担范围判断。仓库旧工作流中存在另一条原始联合 TIFF 哈希记录。该差异已在 `docs/SOURCE_HASH_RECONCILIATION.md` 中冻结为阻断项。正式裁切和程序地形蒸馏前，必须重新实体化 12 张锁定源片、重建原始联合 TIFF 并复算哈希。

## 验收口令与后续门禁

浩哥明确说出“这个范围可以”之后，AOI 才允许从 `PENDING_USER_CONFIRMATION` 进入 `ACCEPTED`。在此之前：

* `distillation_allowed` 必须保持 `false`。
* 禁止生成正式裁切 DEM。
* 禁止宣告 1 米程序地形已经放行。
* 禁止使用旧 AOI 或猜测边界代替用户确认。

## 本地验证

```bash
node projects/guilin-v074-north-up-crop-and-distillation/tests/static_contract_test.mjs
python -m http.server 8000 --directory projects/guilin-v074-north-up-crop-and-distillation/web
```

浏览器自动 QA 由 `tests/browser_cdp.py` 执行。`?qa=1&fixture=1` 只用于离线交互和布局测试。公开页面 QA 必须使用 `?qa=1` 并验证真实的 `guilin_raw_union_preview.webp` 已载入。
