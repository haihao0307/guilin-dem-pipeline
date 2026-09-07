# Farmland Object DNA 启动入口 V0.1.1

日期：2026-09-07

仓库：haihao0307/guilin-dem-pipeline

工作分支：feature/farmland-object-dna-v001

基线：main @ 301c9c75f765cd6581695025897528c7f1ebe5bd

## 角色

Farmland Object DNA 负责传统农田对象的身份、结构、关系、状态、变化和可重建参数。它与 Weather Mother、Ocean Mother、Landscape Mother、DEM 等作为独立领域协作，通过显式接口交换状态，不接管其他 Mother 的权威数据。

本线第一阶段以传统、低机械化和人工维护农业为主要目标，水稻田是首个重点对象，同时保留旱地、菜地、果园、苗圃和休耕地等类型入口。1940 年代可作为历史配置使用，不写成所有农田的永久默认。

## 强制启动顺序

1. 读取仓库根目录 `AGENTS.md`。
2. 读取 `FARMLAND_PRODUCTION_RULES.md`。
3. 读取 `V001_FAILURE_REGISTER.md`。
4. 读取本目录 `HANDOFF.json`。
5. 读取 `OBJECT_DNA_CONTRACT.md`。
6. 读取 `INTERFACE_CONTRACT.md`。
7. 读取 `QUALITY_GATES.json`。
8. 读取 `schema/farmland-object-dna.schema.json`。
9. 读取 `examples/traditional-paddy-v001.json`。
10. 开工前重新核对当前分支 HEAD、最后人工接受状态、失败对照和本轮目标。

任何执行者未完成前四项读取时，不得开始程序化几何、材质或公开工作台生产。

## 小妈启动规则来源

本线启动方式依据小妈协调分支 `handoff/xiaoma-mentor-v1.1-20260905` 中：

`docs/mother_coordination/mentor-v1.1/README.md`

`docs/mother_coordination/mentor-v1.1/MOTHER_STARTUP.md`

`docs/mother_coordination/learning-r1-20260905/WORLD_CONSENSUS.md`

协调分支只作为学习与协调来源，本线生产开发保持在自己的工作分支。

## 严谨生产边界

1. 每个对象先完成来源卡、平面、横断面、纵断面、尺寸、材料、施工、维护和失效研究。
2. 水田先建立森林、水源、村落、渠道、分水、田块、进水、蓄水、出水、排水、下游与劳动的完整关系图。
3. 真实地形高程、AOI、哈希和 DEM 真值继续由现有权威生产线负责。
4. 天气由 Weather Mother 提供，海洋和潮汐相关边界由 Ocean Mother 提供。
5. 农田可以消费降雨、温度、湿度、太阳辐射、风、水位和地形等输入，也可以输出灌溉需求、排水、地表湿润、作物覆盖、粗糙度和维护事件等状态。
6. 人口与劳动力决定传统农业能够长期维护的面积与复杂度，不允许单户居民无依据地生成无限规模农田。
7. 生成细节、历史事实、推断、未知和冲突必须分开记录。
8. 渠道、田埂、田坎、水深、分水设施和水稻阶段模型未通过结构检查时，禁止进入 3A 材质与 Microscope 微观细化。
9. 简单圆管、锥体、平面贴片、机械格网和无连接节点只能作为带 debug 标识的内部代理体。
10. 人工视觉接受由用户决定。

## 元阳专项研究要求

元阳样板开工前必须完整理解并记录：

1. 上部集水森林和水源保护。
2. 泉水、溪流、干渠、支渠和跨谷关系。
3. 村落所处高程带及其与生活用水、灌溉和道路的关系。
4. 分水制度、木刻或木柱标记、木棍分水装置及其实际构造和比例。
5. 从最上级梯田到坡脚和河谷的进水、保水、溢流与排水。
6. 共同清渠、修埂、护林和用水治理。
7. 水牛、鸭、鱼、鳝、稻作和肥源的综合关系。

取得足够证据以前，具体装置和尺寸保持 `research_target` 或 `unknown`，禁止凭想象补齐。

## Microscope 次序

Microscope 只进入已经通过系统、拓扑、截面和尺度检查的对象。其任务集中在田埂土块、石头、草根、裂缝、踩踏、湿润线、渠道淤积、泥浆、叶片、分蘖、稻穗、籽粒和材料接触。任何宏观或中观错误都必须先修复。

## V0.1 失败状态

`FARMLAND_DNA_WB_V0.1.0_20260907` 已被用户明确否决。

它只作为失败对照保留。禁止继续在圆管渠道、圆管田埂、假水深、孤立节点、机械格网和圆锥秧苗上增加装饰。

## 下一候选顺序

1. 水田结构真值台。
2. 渠道、田埂、田坎、田面、进水口、出水口和分水设施截面。
3. 平坝闭合水力图。
4. 山地梯田闭合水力图。
5. 水深和水量守恒。
6. 独立水稻生育阶段模型。
7. 人体、工具、牲畜和劳动模数。
8. 3A 材质、色彩、风、光照和 Microscope 微观细化。
9. 内部六视角、俯视、地面、剖面、桌面和手机预检。
10. 通过最低发布门槛后再形成公开候选。

## 当前状态

schemaReady=true
runtimeImplementation=true
publicWorkbench=true
browserQA=pass_for_rejected_v001
v001Rejected=true
visualAcceptance=false
productionReady=false
nextCandidate=research_and_structural_truth_stage
