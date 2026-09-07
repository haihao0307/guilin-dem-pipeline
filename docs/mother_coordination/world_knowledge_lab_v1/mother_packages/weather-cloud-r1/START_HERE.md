# Weather Mother / Cloud 启动知识包 R1

日期：2026年9月7日

角色：这是小妈为 Weather Mother 准备的启动知识包。它负责知识灌输、方法边界和第一批实验设计，不替 Weather Mother 完成后续专业研究，也不修改 Weather 生产基线。

## 先读顺序

1. `KNOWLEDGE_CORE.md`
2. `MULTISCALE_FIELD_AND_WAVE.md`
3. `TRANSPORT_AND_OPTICS.md`
4. `TESTS_AND_GATES.md`
5. `HANDOFF_TO_WEATHER_MOTHER.md`

同时必须回读：

- `../../core/WORLD_KERNEL_CORE_CHARTER_R1.md`
- `../../core/OBJECT_DNA_CORE_CHARTER_R1.md`
- `../../adapters/WEATHER_CLOUD_ADAPTER_R1.md`
- `../../../learning-r1-20260905/skills/macroscopic-microscope-masterclass/SKILL.md`

## 本包解决什么

本包把这两天形成的知识收成一条 Weather/Cloud 可执行路线：

`Time -> Weather Identity -> Cloud Envelope -> Coarse State -> Multiscale Detail -> Transport -> Volume Optics -> Observation Query -> Evidence`

核心目标不是把云做得“更复杂”，而是让每种复杂度都有职责、时间语义和恢复路径。

## 当前硬边界

云的大形、内部状态、细节、运动和光学分别验证。

程序化时间变化不能冒充真实输运。

多尺度函数可以生成结构，但不能自动证明云物理。

体积密度不能直接翻译成表面 PBR 粗糙度、金属度或法线。

Lumen、泛光或高对比不能替代体积光学和密度验证。

相机只改变观察请求，不能改变云团身份和静态参考坐标。

所有细节必须有 `A=0` 恢复路径。

## 本轮 Mother 的第一任务

不要先重做整片天空。选择一团现有云、固定相机、太阳、曝光、粗密度和风，只增加一个受门控的多尺度细节参数 `A_detail`。

`A_detail=0` 时必须严格回到原粗状态。这个实验通过以后，才允许进入光照变化和真实输运。

## 状态

`package=weather-cloud-r1`

`knowledge_distilled=true`

`mother_self_research_required=true`

`productionIntegration=false`

`visualAcceptance=false`

`productionReady=false`
