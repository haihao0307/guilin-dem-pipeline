# Verification Contract

## 静态合同

`tests/static_contract_test.mjs` 检查：

* 原始联合 DEM 文件名、大小、包内锁定 SHA256、CRS、网格、范围、像元统计和高程范围。
* 正北朝上、无旋转、无透视、只读真值、NoData 不填充、无 30 米替代、垂直比例 1.00。
* AOI 状态为 `UNCONFIRMED`，蒸馏未放行。
* 四个地标的 WGS84 到 EPSG:32649 转换误差小于 1 米。
* 12 张源片范围与 12 条源片摘要完全对应。
* 页面不存在远程脚本和远程样式依赖。
* 网页预览仍处于源 TIFF 哈希复核待定状态。

## 浏览器合同

`tests/browser_cdp.py` 在 1600×1000 桌面视口和 390×844 移动视口分别验证：

* DEM 预览成功载入。
* 正北合同与无旋转入口。
* 四个固定地标、透明标签和一行坐标。
* 地标投影误差小于 1 米，南北屏幕顺序正确。
* 多边形、矩形、顶点编辑、删除和清空。
* 始终只有一个活动 AOI。
* GeoJSON、WKT 和面积合同。
* 源哈希、只读真值、预览 provenance 和 `UNCONFIRMED` 门禁。
* 漓江与湘江辅助中心线按需载入。
* 页面控制台、运行时异常和 CDP 错误全部为 0。

## 两级浏览器 QA

本地离线 QA 使用 `?qa=1&fixture=1`。它只验证交互、投影、布局和合同，不构成真实 DEM 预览通过证据。

公开页面 QA 使用 `?qa=1`。它强制要求实际载入 `guilin_raw_union_preview.webp`，再生成桌面和移动端截图。公开 QA 证据随页面发布到 `evidence/public/`，同时作为 Actions artifact 保存。
