# Landscape Mother 生产线关闭记录

## 关闭范围

关闭的是当前 Landscape Mother 执行对话中的持续生产与反复改版，不是删除 Landscape 模块。

## 用户决定

- 当前 R2.6.3 在线工作台可以正常打开；
- 重新打全量包并推送 GitHub；
- 当前生产线先视为生产完成；
- 后续在其他位置调用和修改；
- 本处只保留 Landscape 模块生产线资料与可恢复基线。

## 源与封版关系

源工作台保持为固定提交 `14fa478ff4545c2c58656bf57ba5326c03492a33` 的原始 R2.6.3 字节，不因封版记录而修改。源内历史 `visualApproved=false` 字段是该提交生成时的元数据；2026-09-22 的用户确认作为上层封版记录保存，不回写旧提交。

## 网站上下文

- 项目站点：`https://guilin-dem-terrain.sunhaihao.chatgpt.site`
- Gaea proof：`https://guilin-dem-terrain.sunhaihao.chatgpt.site/guilin/gaea-proof`
- 本模块固定直开：`https://raw.githack.com/haihao0307/guilin-dem-pipeline/14fa478ff4545c2c58656bf57ba5326c03492a33/workbenches/landscape-karst-dem-field-r2-6-3-production/index.html`

## Git 约束

- 不改写历史；
- 不 force push；
- 不合并 main；
- 最终包只进入独立 handoff 分支。
