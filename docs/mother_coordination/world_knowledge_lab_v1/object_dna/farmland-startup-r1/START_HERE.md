# Farmland Object DNA 启动入口 R1

日期：2026年9月7日

父系统：`World Kernel -> Object DNA`

用途：给即将独立工作的 Farmland Object DNA 执行者提供第一批知识、边界、问题框架和研究任务。这个目录是小妈的启动知识，不是最终 Farmland DNA，也不代替后续执行者自己继续查资料、做试验和建立地方参数。

## 一句话定义

Farmland 不是“绿色地表贴片”，而是一个被人持续组织和维护的社会生态基础设施系统。

对稻田尤其如此：地形、水、土体封水、田块边界、田埂、作物生命周期、人畜劳动、聚落、道路、储藏、产权、水权、地方知识、仪式、生态关系和天气共同决定它在某时某地是什么样子。

## 先读顺序

1. `FARMLAND_OBJECT_DNA_STARTUP_R1.md`
2. `FARMLAND_OBJECT_DNA_SEED_SCHEMA.json`
3. `SOURCE_LEDGER_R1.md`
4. `RESEARCH_MISSION_R1.md`
5. `HANDOFF_TO_FARMLAND_DNA.md`

父级框架：

`../../core/WORLD_KERNEL_CORE_CHARTER_R1.md`

`../../core/OBJECT_DNA_CORE_CHARTER_R1.md`

## 本轮已经吸收的五组启动资料

1. `1940s_Guilin_Northern_Suburbs_Traditional_Paddy_Knowledge_Pack_V0_1.zip`
   - 包含23个ZIP条目，其中22个载荷文件列入内部清单并已逐项SHA256核对通过。
   - 重点贡献：桂林北郊/北广西1940年代传统水田的地形、水、田块、田埂、泥化、季节、人口、牛力、村落和证据分级框架。

2. `云南人口较少民族稻作仪式探究.pdf`
   - 重点贡献：稻作仪式会沿播种、插秧、除草、收获、入仓和尝新等农事节点展开；文化事件可以影响劳动时序、种质保存和社会协作。

3. `稻作文化与傣族传统伦理道德.pdf`
   - 重点贡献：稻作农业不仅受自然和技术影响，还会形成劳动、村社合作、水利组织、生态保护、长者知识和信仰制度等社会结构。

4. `云南红河哈尼梯田生态系统的资源植物多样性与传统知识.pdf`
   - 重点贡献：农田系统边界不应只停在田块，多种传统农业系统实际由森林、村寨、梯田、水系和资源植物共同维持；地方知识和生态功能是系统稳定的一部分。

5. `j-2607.pdf`
   - 重点贡献：作为二次文献与思想材料，强调稻田应按作物、害虫、天敌、土壤、水、管理和残体循环来理解，并提醒现代化、单一化和过度化学干预会改变原有生态关系。它不作为1940年代桂林地方硬参数。

## 本轮最重要的架构决定

Farmland DNA 分成两层：

`Generic Farmland Core`

保存跨地区可复用的对象结构、接口、状态和证据规则。

`Regional / Historical / Cultural Profile`

保存某地点、某年代、某族群、某农业制度的具体参数与行为。

云南材料不能直接变成1940年代桂林真值；1940年代桂林资料也不能冒充所有中国传统稻田的通用真值。

## Farmland 是复合对象

建议至少区分：

`AgroSystem`

`FieldParcel`

`WaterNetwork`

`SoilBody`

`CropPopulation`

`FieldBoundary/Bund`

`LaborUnit`

`DraftAnimal/Tool`

`SettlementLink`

`StorageAndResidueCycle`

`OwnershipAndWaterRights`

`LocalKnowledgeAndRitual`

`AgroecologicalContext`

这些对象可以互相引用，但不能全部压成一个随机种子或一张材质。

## 开工底线

所有 Farmland 执行者开工时先回答：

1. 地点、年代和农业制度是什么？
2. 这块田的水从哪里来，往哪里走？
3. 田面为何能保持当前高程和水深？
4. 谁维护它，劳动力和役畜是否足够？
5. 当前日期对应哪一农事阶段？
6. 田块与村落、道路、仓储、肥力循环是什么关系？
7. 哪些规则是本地史实，哪些只是跨地区机理或类比？
8. 相机移动、精度变化和程序重建是否仍保持同一块田的身份？
9. 如果天气、水量、人口或管理改变，它怎样随时间演化？
10. A=0、零输入或恢复基线是什么？

## 状态

`startupKnowledgeIntegrated=true`

`genericFrameworkSeeded=true`

`regionalParametersFinal=false`

`farmlandExecutorResearchRequired=true`

`productionIntegration=false`

`runtimeImplementation=false`

`visualAcceptance=false`

`productionReady=false`
