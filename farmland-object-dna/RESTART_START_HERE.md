# Farmland Object DNA 干净重启入口 V0.2.0

## R022 续接（2026-09-09）

见 `research/r022-hydraulic-sections/README.md` 与构件来源卡。
本轮完成通用截面、共享边身份、理想开口流量和六种合成水力情形。
尚未完成地方实测标定、渠槽非恒定流、正式结构几何与公开候选。
原 V0.2.0 ZIP 和 R021 回执继续作为对应历史版本保留。

## R021 续接（2026-09-09）

小妈专项资料接收回执与首轮数值修复见
`research/r021-water-contracts/SOURCE_NOTE.md`、`RULE_CARD.md`、`COUNTEREXAMPLE.md`。
运行 `python farmland-object-dna/tools/probe_water_contracts.py` 重现验证。
本轮新增地表水量账本并修复验证器，不代表水力六情形、截面或视觉验收通过。
下述 V0.2.0 全量包保留原样，不包含 R021 修改；恢复当前工作需使用本分支当前提交。

日期：2026-09-07

仓库：`haihao0307/guilin-dem-pipeline`

实际生产分支：`restart/farmland-object-dna-v020-20260907`

重启基线：`309695a43dadec8b967c9ec543136dfc1e84addd`

全量包：`farmland-object-dna/distributions/Farmland_Object_DNA_Full_Clean_Restart_2026-09-07_V0.2.0.zip`

## 一、为什么重启

`FARMLAND_DNA_WB_V0.1.0_20260907` 已被用户明确否决。旧页面只允许作为失败对照，用于防止圆管水渠、圆管田埂、假水深、孤立进排水节点、机械格网、重复条带梯田和圆锥水稻再次出现。旧页面不再具有公开候选、视觉接受或生产资格。

V0.2 从研究、系统关系、真实截面和水力闭环重新开始。任何执行者不得沿旧工作台的造型路线继续增添材质、光照、雾或装饰。

## 二、强制读取顺序

1. 仓库根目录 `AGENTS.md`。
2. `farmland-object-dna/FARMLAND_PRODUCTION_RULES.md`。
3. `farmland-object-dna/V001_FAILURE_REGISTER.md`。
4. `farmland-object-dna/HANDOFF.json`。
5. `farmland-object-dna/PRODUCTION_RESTART_TASKS.md`。
6. `farmland-object-dna/OBJECT_DNA_CONTRACT.md`。
7. `farmland-object-dna/INTERFACE_CONTRACT.md`。
8. `farmland-object-dna/QUALITY_GATES.json`。
9. `farmland-object-dna/research/OBJECT_SOURCE_CARD_TEMPLATE.md`。
10. `farmland-object-dna/research/YUANYANG_SYSTEM_RESEARCH_PLAN.md`。
11. `farmland-object-dna/schema/farmland-object-dna.schema.json`。
12. `farmland-object-dna/examples/README.md`。
13. `farmland-object-dna/examples/traditional-paddy-v002-research.json`。
14. 全量包内 `coordination/` 保存的小妈启动规则与世界共识快照。
15. 开工前重新核对当前分支 HEAD、失败对照、最后人工接受状态和本轮任务。

未完成前十项读取时，禁止开始程序化几何、材质、Microscope 微观细化或公开工作台生产。

## 三、V0.2 生产目标

第一阶段只完成传统人工水田的可靠基础。平坝水田与山地梯田共用对象合同和水量守恒规则，分别使用适合自身地形的田块拓扑与水路组织。

必须先回答：

1. 地形为什么允许这里形成水田。
2. 水源在哪里，怎样取水、输水、分水和维护。
3. 每块田从哪里进水，怎样蓄水，从哪里出水。
4. 所有水最终进入哪个下游受体。
5. 田埂、田坎、田面、渠道、进水口、出水口和分水设施的平面与截面是什么。
6. 田块尺度怎样由地形、水力、土壤、人体、工具、牲畜、劳动、距离、产权和历史共同确定。
7. 插秧、返青、分蘖、拔节、孕穗、抽穗、开花、灌浆、成熟、收割和残茬怎样形成不同结构与状态。
8. 元阳配置中的上部森林、水源、村落、梯田、共同维护和坡脚河谷怎样组成一个文明系统。

## 四、不可越过的生产次序

证据和来源卡

→ 森林、水源、村落、道路、田块、渠道、劳动与下游的整体关系

→ 平面、纵断面、横断面和真实尺寸

→ 闭合水力图、高程合法性和水量守恒

→ 水稻种植参数与阶段性形态

→ 内部结构真值台

→ 3A 材质、色彩、光照、空气、风和运动

→ Microscope 土块、石头、草根、湿润线、淤积、叶片、分蘖、稻穗和籽粒

→ 六视角、俯视、地面、剖面、桌面和 390×844 手机预检

→ 公开候选

前一层没有通过时，后一层不得开工。简单代理体只能留在带有 `debug_proxy` 标识的内部诊断区。

## 五、元阳专项边界

元阳和红河哈尼梯田只作为明确地区配置使用，不得成为全球梯田默认模板。正式结构原型以前必须完整研究：

1. 山顶及上部水源林的集水、涵养、坡面稳定和保护制度。
2. 泉水、溪流、取水口、干渠、支渠、跨谷水路和村落生活用水。
3. 村落位于森林下方、梯田上方的空间与社会原因。
4. 木刻、木柱、木棍分水设施的本地名称、平面、截面、插设方式、比例、水权、操作和维护。
5. 上中下部梯田的进水、蓄水、溢流、排水和坡脚河谷受体。
6. 清渠、修埂、护林、轮灌、纠纷处理和劳动力组织。

证据不足的内容必须保持 `unknown` 或 `research_target`。

## 六、Microscope 的位置

Microscope 只处理已经通过系统、拓扑、截面、尺寸和水力检查的对象。它负责有效微观变化，例如田埂土块、石头、草根、裂缝、脚印、牛蹄印、湿润线、渠底淤积、泥浆、叶片、分蘖节点、稻穗、籽粒和材料接触。

Microscope 不得用于掩盖水源、田块拓扑、渠道截面、水深或作物阶段错误。

## 七、当前工作状态

`lineVersion=0.2.0-clean-restart`

`activeBranch=restart/farmland-object-dna-v020-20260907`

`v001Rejected=true`

`researchGate=in_progress`

`structuralTruthWorkbench=not_started`

`activePublicCandidate=none`

`visualAcceptance=false`

`productionReady=false`

下一次公开发布以前，必须重新完成资料、结构、水力、生命周期、3A 预检、技术发布和用户人工接受的全部门禁。
