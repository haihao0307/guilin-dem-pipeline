# Landscape Mother｜R2.6.3 生产候选版重启交接

## 唯一有效基线

- 仓库：`haihao0307/guilin-dem-pipeline`
- 交接分支：`handoff/landscape-mother-r263-production-full-20260921`
- 恢复源提交：`14fa478ff4545c2c58656bf57ba5326c03492a33`
- 权威工作台：`workbenches/landscape-karst-dem-field-r2-6-3-production/index.html`
- 状态：`visualApproved = false`，继续视觉迭代，不得声称生产批准。

## 强制回退结论

R2.6.4 冻结缓存生产版已被用户否决，不属于本交接，不得继续、迁移或作为默认入口。Git 历史保留，但活动工作线从 R2.6.3 恢复。

被否决的方向包括：

- 把连续函数场过早转成量化索引表面缓存；
- 用普通索引表面运行时替换当前 R2.6.3 函数场验证；
- 因显卡稳定性问题而改写已经确认的形体与工作方式。

## 本次保留内容

- DEM 连续函数场；
- 主孔洞与次级溶蚀；
- 海蚀收腰、礁盘连续连接；
- 真实几何裂缝；
- Ocean Mother 潮位运行时接口；
- R2.6.3 单文件三维工作台及其构建脚本、生产合同、运行桥接文件；
- R2.5.1 至 R2.6.2 的必要源链，用于重新构建 R2.6.3。

## 下一位执行者的第一步

1. 解压唯一全量包。
2. 先读 `START_HERE.md`、`NEW_CHAT_BOOTSTRAP.md`、`CURRENT_BASELINE.json`。
3. 只从 `workbenches/landscape-karst-dem-field-r2-6-3-production/` 继续。
4. 不读取、不恢复、不重新实现 R2.6.4 缓存路线。
5. 保持 Draft、禁止改写历史、禁止 force push、禁止合并 main。
