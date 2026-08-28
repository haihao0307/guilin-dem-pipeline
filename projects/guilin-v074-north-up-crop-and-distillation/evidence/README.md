# Evidence

源分支只保存验证方法和合同，不保存本地合成地形截图。

GitHub Actions 生成两组证据：

* `local-fixture`：离线交互、投影和布局测试，使用明确标记的合成夹具。
* `public-real-asset`：公开页面测试，必须实际载入 `guilin_raw_union_preview.webp`。

Actions artifact 保存完整日志、DOM、QA JSON 和截图。公开页面只发布 `public-real-asset` 证据。
