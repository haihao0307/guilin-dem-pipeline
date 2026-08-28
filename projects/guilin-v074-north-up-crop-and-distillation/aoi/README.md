# AOI Intake

当前目录没有正式 AOI，状态保持 `UNCONFIRMED`。

浩哥从网页导出的文件应按以下方式入库：

* `candidate/guilin-aoi-wgs84.geojson`
* `candidate/guilin-aoi-epsg32649.wkt`
* `candidate/aoi_receipt.json`

入库脚本必须验证两种坐标表示描述同一几何，计算面积和边界，并生成几何规范化 SHA256。完成后状态只能进入 `PENDING_USER_CONFIRMATION`。收到“这个范围可以”以前，禁止写入 `accepted/`。
