# Landscape 模块保留合同

1. Landscape 模块继续保留在 `haihao0307/guilin-dem-pipeline`，不得因本生产线关闭而删除。
2. 当前权威实现是 `14fa478ff4545c2c58656bf57ba5326c03492a33` 下的 `workbenches/landscape-karst-dem-field-r2-6-3-production/index.html`。
3. 当前面向用户的一按入口是固定 raw.githack 地址，不是本地 `file://` 源 HTML。
4. 新需求在其他工作区另开 feature 分支，不在本封版分支上直接覆盖。
5. 必须保留连续 DEM 函数场、孔洞、海蚀、裂缝、礁盘连接和 Ocean Mother 潮位接口。
6. M1、M1.1、M1.2 与 R2.6.4 均不得自动恢复成默认基线。
7. 任一替代运行架构必须先提供与当前形体等价的可见证据，不能用性能理由擅自降级形体。
8. Git 历史、固定提交和最终全量包必须可追溯。
