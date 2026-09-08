# World Kernel / Object DNA / TLO 桥接

## World Kernel

2026-09-07 已形成候选核心顺序：

`Time -> Identity -> Truth/State -> Strategy -> Precision -> Query -> Function -> Evidence`

核心思想：

- 时间第一；
- 保存最小充分状态；
- 相机只改变查询深度，不改变世界身份；
- 观察带宽代替“世界存在多套 LOD 资产”的本体论；
- 熟悉问题应压缩为函数，经验增加不应让同类任务计算量同步膨胀；
- Blender/Houdini/Substance/UE/3GS/WebGPU 都是学习和执行工具，不是世界本体。

固定来源：

`f35e3f264157171af93183834f5b00d2ebb99365`

`docs/mother_coordination/world_knowledge_lab_v1/core/WORLD_KERNEL_CORE_CHARTER_R1.md`

## Object DNA

Object DNA 位于 World Kernel 之下，回答：

- 这个对象是谁；
- 哪些部分和关系构成它；
- 哪些真值必须保存；
- 哪些状态需要历史；
- 哪些细节可以按需重建；
- 哪些证据支持结构、材料和行为结论。

2026-09-07 同时存在两套互补资料：

1. 小妈 World Knowledge Lab 的 `OBJECT_DNA_CORE_CHARTER_R1.md`。
2. 独立 Object DNA Kernel 交接分支 `handoff/object-dna-kernel-v0.1-20260907`，commit `20ef9c600128a35511056d6fb991ce05080c73f9`。

后者进一步明确 Identity、Semantics、FunctionGraph、EvidenceGraph、MeasurementGraph、GeometryProgram、SurfaceCoordinateProgram、MaterialProgram、LifecycleGraph、EvolutionGraph、BehaviorGraph、EventHistory、World Interface、ApprovalLedger。

## TLO

TLO 可以被理解为更靠近“世界文件/交换格式”这一层：

`T = 何时`

`L = 哪里`

`O = 谁/什么对象`

然后 O 内部引用 Object DNA，World Kernel 决定当前如何查询、推进、分配精度和计算预算。

候选关系：

```text
TLO Container
  T: world/event/state time
  L: world location/reference frame
  O: Object identity + ObjectDNA ref + current state ref
      -> World Kernel query/advance
      -> runtime compiler
      -> WebGPU / other backend
```

因此 TLO 不是替代 Object DNA；TLO 给对象一个明确的世界时空位置和通信入口，Object DNA 提供对象内部的最小可重建描述。
