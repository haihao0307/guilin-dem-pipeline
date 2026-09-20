# Farmland Mother R042 · Terrain–Water Constrained Paddy Graph

R042 保留 R039 的山—坡—平坝—河大地形，替换 R041 的 power-cell 田块逻辑。

已实现：

- 107 块平坝水田，面积约 151–405 m²；形态来自连续管理区内的递归农业分割。
- 98 块等高梯田。
- 205 块田全部具备进水口、排水口、上游来源和下游受体。
- 273 条灌排关系；全部田块具备 SOURCE → FIELD → RIVER 路径。
- 平坝田域抽样无重叠、无空洞；共享田埂由单一约束线生成，不再为相邻田重复画边。
- 20 名动态草帽农人、8 头动态水牛、5 个田棚。
- 多尺度函数只调节中尺度分割与低幅度曲率，不直接定义田块拓扑。

数值检查见 `R042_QA.json`。

`visualAcceptance=false`

`productionReady=false`
