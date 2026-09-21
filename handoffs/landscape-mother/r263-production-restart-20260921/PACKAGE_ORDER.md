# Landscape Mother R2.6.3 全量包生成单

输出文件：

`LANDSCAPE_MOTHER_R263_PRODUCTION_FULL_HANDOFF_2026-09-21.zip`

全量包必须包含：

- `START_HERE.md`
- `NEW_CHAT_BOOTSTRAP.md`
- `CURRENT_BASELINE.json`
- `REJECTED_R264.md`
- `SHA256SUMS.txt`
- `workbenches/landscape-small-karst-field-r2-5-1-gpu-compat/`
- `workbenches/landscape-karst-dem-field-r2-6-cracks/`
- `workbenches/landscape-karst-dem-field-r2-6-1-driver-safe/`
- `workbenches/landscape-karst-dem-field-r2-6-1b-final/`
- `workbenches/landscape-karst-dem-field-r2-6-2-compact/`
- `workbenches/landscape-karst-dem-field-r2-6-3-production/`
- 与 R2.6.0—R2.6.3 对应的 GitHub Actions 工作流

硬门槛：

1. 恢复源必须是 `14fa478ff4545c2c58656bf57ba5326c03492a33`。
2. 包内不得出现 `r2-6-4-cached`、`R264` 或其工作流。
3. R2.6.3 的 `index.html`、`build_r263.py`、`production_contract.json`、`karst_field_runtime_bridge.js` 必须存在。
4. 生成 SHA-256 清单，并在提交前验证。
5. Git 历史保留，不 force push，不合并 main。
