# 靠谱世界大合唱架构摘要

## 1. 七层闭环

### 现实层

现实世界和历史痕迹独立存在。系统只能通过观察、测量、档案、推断与模型逐步接近。

### 靠谱语义层

统一表达 Identity、Space and Frame、Time、Scale、Quantity or State、Relation、Observation、Claim、Provenance、Uncertainty、Change 和 View。

靠谱语义保持中性。它只负责清楚表达，不负责审美和价值判断。

### 证据与陈述层

稳定候选链条为：

`Source Event -> Evidence Asset -> Observation -> Claim -> Evidence Graph`

Source Event 表达按下快门、测量、记录或回忆形成的事件。

Evidence Asset 表达底片、扫描件、地图、文字、数字文件和其他载荷。

Observation 表达某次观察对某个对象或属性的覆盖。

Claim 表达由观察、测量、记录或推断形成的可支持、可反对陈述。

Evidence Graph 保存来源、复制、转换、共享标定、共享假设、支持、反对和独立观测根。

### 世界总谱层

递归结构为：

`World -> Region -> Scene -> Object -> Part -> Material or Microstructure`

世界总谱保存共同基准、语义、索引、规则和低频主体。

地区谱保存本地 Canonical Truth、对象与历史变化。温州是第一份完整地区谱。

场景谱保存城市、街区、村落、山谷、岛屿、机场、建筑群和房间。

对象谱保存建筑、人物、动物、植物、飞机、武器、道路、桥梁和杯子。

部件与材料谱继续深入对象组成与微观结构。

### 造波与图层

造波是完整的世界生成与重建算子体系，包含基础波、噪波、相位、频率、振幅、方向、旋转、尺度、域变换、调制、耦合、随机种子、时间演化、边界条件和必要残差。

连续场通过带类型的造波、场和残差表达。

离散身份、事件、关系和证据依赖通过 Object Graph、Event Graph 和 Evidence Graph 表达。

每个造波输出必须声明 quantity kind、unit、frame、domain、time semantics、valid scale、boundary、source or sink、uncertainty 和 residual policy。

### 指挥与演奏层

指挥根据 Query、Time、Space、Scale、Context、Policy Version 和 Budget 生成 View。

候选表达为：

`View = Conduct(WorldScore, Query, Time, Space, Scale, Context, PolicyVersion, Budget)`

历史指挥、城市指挥、建筑指挥、天气指挥、材料指挥和相机指挥可以展开不同声部。它们不能静默改变原始证据、对象身份、单位、时间和冻结历史。

### 学习与治理层

AGO 负责继承、拆解、探索和实验。

Critic 负责寻找反例、共享偏差、重复路线和隐藏假设。

Verifier 负责检查坐标、单位、量纲、证据根、时间、对象关系、可逆性、不变量和回滚。

小妈负责 Judgment、Context、资源重分配、停止重复、候选晋级、跨域迁移和阶段冻结。

## 2. 靠谱判断门

一条可进入候选世界的 Claim 至少要满足：

1. 对象身份清楚。
2. 时间角色清楚。
3. 空间、尺度和参考系清楚。
4. 数量绑定 Quantity Kind、Unit、Measurement Procedure 和 Uncertainty。
5. 来源与转换链能够回溯。
6. 同源复制不会冒充独立观察。
7. 假设、误差、未知和冲突保持显式。
8. 推断范围不超过证据能力。
9. 可验证部分能够重复检查。
10. 后续发现错误时能够沿依赖图找到受影响结论。

## 3. 不靠谱内容处理

`Reject from Current Best View` 表示拒绝晋级主世界。

纯重复和确认无价值的污染可以去重。

来源不清但可能提供线索的材料进入 Quarantine。

某个时代真实产生的误测、错误回忆、宣传或偏见进入 Perceived World Observation，不能直接决定 Physical World。

## 4. 四种空缺状态

`Unknown`：当前不知道。

`Not Observed`：本次观察没有覆盖或没有识别到。

`Observed Absent`：观测条件足以支持当时不存在。

`Not Applicable`：该属性对对象无意义。

任何机器都禁止用零坐标、单位矩阵、空字符串、默认网格或对称补全替代 Unknown。

## 5. 时间结构

至少区分：

1. World or Valid Time。
2. Observation Time。
3. Evidence Asset Creation Time。
4. Represented Time。
5. Ingest or Transaction Time。
6. Processing Time。

时间滑块可以查询、比较和演奏不同时间状态。历史关键状态、物理推演、统计插值和艺术过渡必须保留不同身份。不可逆过程能否反向恢复由方程、状态保存和证据决定。

## 6. 压缩原则

世界状态可以抽象为：

`World(t) = StableLowFrequency + LocalCorrections + EventDeltas(t) + RequiredResiduals`

可由规则重建的信息尽量不重复存储。

罕见细节、一次性事件和无法推导的真实差异必须进入 residual channel。

压缩不能把证据空缺变成生成细节，也不能把平滑过渡冒充真实历史状态。

## 7. 开放世界

资料库中没有记录，不能自动推出现实中不存在。

只有观测覆盖、检测能力、时间范围和系统误差足以支持时，才可以生成 Observed Absent Claim。

冲突 Claim 可以长期并存。Current Best View 应公开采用的证据集、政策、查询范围、时间、尺度、预算和 transaction time。

## 8. 版本与冻结

冻结点属于 append-only 历史。

旧版本必须保持永久可寻址。后续通过 R2、R3 或候选补丁追加。任何修订都要说明新增、撤销、改变的语义以及转换器版本。

编码可演进，语义必须稳定。