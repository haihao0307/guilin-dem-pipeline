# Landscape Mother｜R2.6.3 最终封版与生产线关闭交接

## 当前结论

- 用户于 2026-09-22 确认固定在线入口已经恢复正常。
- 本轮 Landscape Mother 生产线按当前成果封版，状态为：`currentLineClosed = true`。
- Landscape 模块本身继续保留，后续由其他工作区或执行线调用、集成和修改；本生产线不再继续视觉迭代。
- 本封版没有改写源工作台，也没有把临时的 M1、M1.1 或 M1.2 版本带入权威基线。

## 唯一权威基线

- 仓库：`haihao0307/guilin-dem-pipeline`
- 最终交接分支：`handoff/landscape-mother-r263-final-closeout-20260922`
- 权威源提交：`14fa478ff4545c2c58656bf57ba5326c03492a33`
- 权威工作台：`workbenches/landscape-karst-dem-field-r2-6-3-production/index.html`
- GitHub 包路径：`handoffs/landscape-mother/LANDSCAPE_MOTHER_R263_FINAL_CLOSEOUT_FULL_HANDOFF_2026-09-22.zip`

## 一按打开

固定在线入口：

`https://raw.githack.com/haihao0307/guilin-dem-pipeline/14fa478ff4545c2c58656bf57ba5326c03492a33/workbenches/landscape-karst-dem-field-r2-6-3-production/index.html`

全量包解压后可双击：

`00_一按打开_LANDSCAPE_MOTHER_R263.url`

这才是当前认可的直接入口。不要把包内源代码 HTML 当作面向用户的一按直开入口。

## 保留的 Landscape 模块能力

- DEM 连续函数场；
- 主孔洞与次级溶蚀；
- 海蚀收腰和礁盘连续连接；
- 真实几何裂缝；
- Ocean Mother 潮位运行时接口；
- R2.5.1 至 R2.6.3 的必要构建链、工作流、合同与运行桥接文件。

## 明确排除

- R2.6.4 cached 路线；
- R263-M1、M1.1、M1.2 临时试验；
- 以低质量普通网格替代当前连续函数场；
- 把本地 `file://` HTML 误称为正式一按入口；
- 合并 main、force push 或改写历史。

## 后续调用规则

新的工作区必须先读本目录全部封版文件。未来修改应从本最终交接分支另开 feature 分支；权威源工作台仍以 `14fa478ff4545c2c58656bf57ba5326c03492a33` 为可追溯起点。