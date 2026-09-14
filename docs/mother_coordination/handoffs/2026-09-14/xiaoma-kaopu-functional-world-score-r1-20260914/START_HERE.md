# 小妈｜靠谱“函数世界乐谱”当前全量交接 R1

日期：2026-09-14  
状态：**CURRENT FULL HANDOFF / CONCEPT FREEZE / RESEARCH ACTIVE**  
上游增量基线：`XIAOMA_MICROSCOPE_CURRENT_FULL_HANDOFF_20260914_1005.md`

## 本包是什么

本包冻结 2026-09-14 用户与“小妈”围绕以下核心问题形成的当前共识：

> 看任何对象时，第一问题不再是“怎样建模、怎样贴图”，而是“哪些函数、场、约束、交互、历史和尺度关系使它成为现在这个样子”。

这不是把世界简化为若干噪声，也不是宣布 Mesh、PBR、贴图无用。它确立的是**信息主次关系**：

- 世界乐谱、Object DNA、TLO、函数图、状态和历史，是可解释、可演化的源表达；
- Mesh、PBR、贴图、碰撞、动画和声音，是面向设备、视角和算力预算编译出来的演奏结果；
- 观测真值必须与程序生成细节严格分层；
- 同一种函数语法可以跨对象复用，但不同对象必须服从不同物理、材料、人类行为和历史约束。

## 阅读顺序

1. `CURRENT_FULL_HANDOFF.md`：新窗口直接接管所需的权威摘要。
2. `01_CORE_THESIS_WORLD_AS_FUNCTIONAL_SCORE.md`：核心命题及其边界。
3. `02_KAOPU_WORLD_SCORE_ARCHITECTURE.md`：靠谱体系的正式分层。
4. `03_FUNCTION_GRAMMAR_AND_COMPOSITION.md`：函数语言、组合方式和统一形式。
5. `04_SCALE_COORDINATES_MICROSCOPE.md`：Yohei / Microscope、多尺度和坐标域研究主线。
6. `05_INTERACTION_COMPETITION_COMPROMISE_HISTORY.md`：相互侵占、妥协、共生与历史。
7. `06_FARMLAND_CELLULAR_GROWTH_TRANSLATION.md`：向 Farmland 的具体迁移。
8. `08_LOGIC_BOUNDARIES_CONSTRAINTS_FAILURE_MODES.md`：必须首先防止的逻辑错误。
9. `09_RESEARCH_AND_IMPLEMENTATION_ROADMAP.md`：从研究到实现的执行顺序。
10. `10_ACCEPTANCE_TESTS.md`：不得用“看起来不错”替代的验收门槛。

## 当前第一任务

不是立即重做温州、海岛或 Farmland，而是：

1. 彻底拆解 Yohei 的 Macroscopic Microscope：坐标转换、尺度递进、函数累加、隐式场、光线步进与真实几何之间的关系；
2. 建立最小、可解释、可测量的 `Function / Microscope Kernel`；
3. 用三类差异极大的对象做反证式验证：小地形 patch、瓦/石材、Farmland；
4. 只有同一内核在不同物理约束下能产生不同且合理的结果，才证明它是通用语法，而不是一种固定外观滤镜。

## 当前禁止事项

- 不把 Worley/Voronoi 图案直接当成稻田布局。
- 不把 Yohei 的视觉结果直接当成地质或材料真值。
- 不把“约 17 个尺度”写成已完整复现的事实；必须回到原始代码和实测证据。
- 不用颜色、法线或 PBR 掩盖形体生成错误。
- 不覆盖已认可的 12.5 m 温州 DEM 大形和 Observation Root。
- 不把“文件小”误判成“运行算力一定小”。
- 不以全局最优替代真实人类的局部决策、产权、劳力、历史和路径依赖。

## 一句话交接

靠谱的核心不是保存世界的一张外观照片，而是保存：**对象是谁、处于何时何地、由哪些函数和过程形成、与谁竞争或共生、受到什么约束、历史留下了什么，以及在不同观察尺度下应当如何演奏出来。**
