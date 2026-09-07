# Farmland Object DNA 启动入口 V0.0.1

日期：2026-09-07

仓库：haihao0307/guilin-dem-pipeline

工作分支：feature/farmland-object-dna-v001

基线：main @ 301c9c75f765cd6581695025897528c7f1ebe5bd

## 角色

Farmland Object DNA 负责传统农田对象的身份、结构、关系、状态、变化和可重建参数。它与 Weather Mother、Ocean Mother、Landscape Mother、DEM 等作为独立领域协作，通过显式接口交换状态，不接管其他 Mother 的权威数据。

本线第一阶段以传统、低机械化和人工维护农业为主要目标，水稻田是首个重点对象，同时保留旱地、菜地、果园、苗圃和休耕地等类型入口。1940 年代可作为历史配置使用，不写成所有农田的永久默认。

## 启动顺序

1. 读取仓库根目录 AGENTS.md。
2. 读取本目录 HANDOFF.json。
3. 读取 OBJECT_DNA_CONTRACT.md。
4. 读取 INTERFACE_CONTRACT.md。
5. 读取 QUALITY_GATES.json。
6. 读取 schema/farmland-object-dna.schema.json。
7. 读取 examples/traditional-paddy-v001.json。
8. 开工前重新核对当前分支 HEAD、最后人工接受状态和本轮目标。

## 小妈启动规则来源

本线启动方式依据小妈协调分支 handoff/xiaoma-mentor-v1.1-20260905 中：

docs/mother_coordination/mentor-v1.1/README.md

docs/mother_coordination/mentor-v1.1/MOTHER_STARTUP.md

docs/mother_coordination/learning-r1-20260905/WORLD_CONSENSUS.md

协调分支只作为学习与协调来源，本线生产开发保持在自己的工作分支。

## 第一阶段边界

1. 先建立可验证的对象 DNA 与关系图，不先做大而全的农业模拟器。
2. 真实地形高程、AOI、哈希和 DEM 真值继续由现有权威生产线负责。
3. 天气由 Weather Mother 提供，海洋和潮汐相关边界由 Ocean Mother 提供。
4. 农田可以消费降雨、温度、湿度、太阳辐射、风、水位和地形等输入，也可以输出灌溉需求、排水、地表湿润、作物覆盖、粗糙度和维护事件等状态。
5. 人口与劳动力决定传统农业能够长期维护的面积与复杂度，不允许单户居民无依据地生成无限规模农田。
6. 生成细节、历史事实、推断和未知必须分开记录。
7. 人工视觉接受由用户决定。当前 visualAcceptance=false，productionReady=false。

## 当前状态

schemaReady=true
runtimeImplementation=false
publicWorkbench=false
browserQA=not_run
visualAcceptance=false
productionReady=false
