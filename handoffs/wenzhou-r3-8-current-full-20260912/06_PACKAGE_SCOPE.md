# 全量包范围

本交接包的目标是：**在新窗口不依赖旧对话即可直接继续小温州生产线。**

## 包内包含

1. R3.2 冻结全量重启底座（约 1.03 GB）的全部内容；
2. 当前仓库里的 R3.3–R3.8 运行时/浏览器数据；
3. R3.3–R3.8 相关 `records/`、`tools/`；
4. 当前 SoilGrids 0–5 cm 16 个浏览器层；
5. 当前 R3.8 WRB 浏览器上下文及审计数据；
6. WorldCover/OSM 等当前浏览器派生数据；
7. 本交接目录全部状态、下一步、单一世界谱规则、永久证据索引；
8. 当前 Wenzhou R3.x 相关 GitHub Actions 工作流；
9. `inputs/knowledge-r2-2` 中当前仍参与证据边界/对象语义的锁定输入；
10. 完整 `MANIFEST.json`、SHA-256、包生成报告和可离线运行的 `verify_package.py`。

## 大型永久证据为什么不重复塞进同一个 ZIP

WorldCover、JRC、OSM 和完整 SoilGrids 原始/对齐证据已经分别作为永久 GitHub Release 锁定，总量接近 1 GB。若再次把这些 ZIP 嵌进 1.03 GB 重启底座，会让单一 Release 资产逼近 GitHub 单文件上限，并形成同一证据的重复存储。

因此本包采取：
- **运行所需派生数据放包内；**
- **大型源证据放永久 Release；**
- 包内 `02_SOURCE_LOCKS.json` / `05_EVIDENCE_ARCHIVES.json` 固定 tag、asset、bytes、SHA-256，可一键恢复并复核。

这不等于“缺文件”：生产运行/继续开发所需当前状态在包内；源证据作为独立永久原件不做二次嵌套。

## 包外但永久锁定

- `wenzhou-r3.4-environment-evidence-20260910`
- `wenzhou-r3.5-osm-object-evidence-20260910`
- `wenzhou-r3.7-soilgrids-evidence-20260911`

## 版本边界

- R3.7 是最后 verified visual candidate；
- R3.8 是 in-progress handoff，WRB data 已构建，但显示整合/完整 QA 未做完；
- 包名中的 `CURRENT` 表示“当前工作全量交接”，不是宣称 R3.8 已 production ready。
