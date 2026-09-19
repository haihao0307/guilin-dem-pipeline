# Farmland Mother R041 · 小妈学习与工程采用

日期：2026-09-16

## 实际读取

本轮实际读取 `feature/landscape-microscope-geometry-lab-r1-20260916`：

- `landscape-mother/SKILL.md`
- `landscape-mother/platform.json`
- `landscape-mother/src/policy.js`
- `handoffs/landscape-mother/LEARNING_CURRENT.md`

并继续保留 Farmland 已有水量、田块拓扑、水稻生命周期与小妈 TLO/DEM 接入边界。

## 采用的原则

1. Macro / Meso / Micro 是形成尺度，不是相机或设备降档机制。
2. 先稳定大地形和水系，再形成田块群，再进入田埂、泥面和稻株；高频噪声不能替代田块关系。
3. Source Field → Shape Field → Data / Mask Field → Color Field → Render Field → QA。
4. 田埂、沟渠等影响轮廓、接触、行走和水流的对象必须有几何结构。
5. 输入事实只读；合成参数继续标记为候选，不自动升级为地方真值。
6. 对象身份、参考架、时间、状态和事件独立保存；镜头与显示精度不能改变田块身份或水网关系。

## R041 的工程采用

- 平坝田改为确定性的受约束 power-cell 分区：56 块，共享边只生成一次，覆盖域完整且不重叠。
- 坡地梯田按等高层和横向分段形成 81 块，保留大地形与坡面层级。
- 137 块田全部拥有进水口、出水口、上游来源与下游受体。
- 建立 285 条水力关系，图验证要求每块田均可从 SOURCE 到达，并可继续到 RIVER。
- 农人和水牛的运动限定在其所属田块内部，并持续从同一 `terrainY` 取地面高度。

## 未升级为事实的内容

- 田块尺度是合成候选，不代表特定 1940 年代地区的实测产权或劳动力规模。
- 渠槽截面、田口高程、品种、播期、土壤与地方水权仍未标定。
- 动作是任务驱动的行为样板，不是完整历史农业劳动仿真。
- `visualAcceptance=false`；`productionReady=false`。
