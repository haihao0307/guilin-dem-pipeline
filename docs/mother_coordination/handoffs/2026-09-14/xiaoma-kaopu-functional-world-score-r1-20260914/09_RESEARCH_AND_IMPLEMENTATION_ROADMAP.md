# 09｜研究与实现路线

## Phase 0｜概念冻结（本包）

完成条件：核心命题、边界、架构、Farmland 翻译和下一步任务被写入可追溯全量包。

## Phase 1｜Yohei 证据化学习

输出：

- 原始资料索引和许可证；
- shader 展开版；
- 数学符号版；
- 每一行代码的功能说明；
- 坐标变换图；
- 尺度/振幅表；
- 隐式场、ray marching、几何与 shading 分离报告；
- 未知项清单。

禁止：只凭视频观感或二手文章宣布“已经学会”。

## Phase 2｜Function Kernel 最小 API

建议模块：

```text
world-function-kernel/
  domain/
  basis/
  compose/
  scale/
  field/
  constraint/
  interaction/
  process/
  history/
  evidence/
  evaluate/
  diagnostics/
```

每个节点必须声明输入单位、输出类型、稳定坐标、尺度职责、证据等级、性能预算和可逆性。

## Phase 3｜三类反证 Probe

### A. 小地形 patch

验证多尺度真实形体、尖点诊断、DEM 保护、稳定访问和性能。

### B. 瓦/石材

验证相同数学骨架能服从不同材料过程，不产生同质外观。

### C. Farmland

验证地形流形上的增长、竞争、土方、水路、边界和历史，而不是平面细胞贴图。

任何一类失败都应回到内核修正，不允许用对象特例掩盖。

## Phase 4｜World Score Schema

把 Object DNA、TLO、函数图、约束、关系、历史、观测和缓存正式序列化。要求：

- 编码与语义分离；
- 版本迁移；
- 来源和置信度；
- 可局部加载；
- 可回滚；
- 可导出 Mesh/PBR 但不丢失主乐谱。

## Phase 5｜跨 Mother 接入

优先顺序建议：

1. Landscape / Wenzhou；
2. Tiles / Brick / Stone；
3. Farmland；
4. Ocean / Weather / Soil；
5. HOUSE、村落与道路；
6. 植物、动物和人物。

共享内核由小妈维护，各 Mother 只维护自己的材料、过程和参数谱，避免重复造轮子。

## Phase 6｜持续学习飞轮

每次对象实践都应回写：

- 新函数原语；
- 失败案例；
- 参数范围；
- 观测证据；
- 性能记录；
- 可复用约束；
- 不可跨对象复用的特例。

这样体系才会逐渐逼近世界乐谱，而不是不断堆项目资产。
