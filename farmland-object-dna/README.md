# Farmland Object DNA

Farmland Object DNA 是 guilin-dem-pipeline 中面向传统农业对象的独立领域系统。它与 Weather Mother、Ocean Mother、Landscape Mother、DEM 等并列协作，负责农田对象自身的结构、关系、生命周期和可重建参数。

## 当前 V0.0.1

已建立：

1. 独立工作分支 feature/farmland-object-dna-v001。
2. RESTART_START_HERE.md 启动入口。
3. HANDOFF.json 状态与边界。
4. OBJECT_DNA_CONTRACT.md 十二层 DNA。
5. INTERFACE_CONTRACT.md 跨 Mother 输入输出。
6. schema/farmland-object-dna.schema.json 机器可读 schema。
7. examples/traditional-paddy-v001.json 首个传统人工水田候选样例。
8. QUALITY_GATES.json 质量门禁。

## 第一对象族

水田是第一重点。基础构件包括 field_cell、bund、terrace_step、inlet、outlet、irrigation_channel、drainage_channel、water_surface、crop_stand 和 footpath。

水田对象需要同时回答五件事：在哪里，为什么能形成这个形状，水从哪里来又到哪里去，谁在什么时候维护它，当前作物与田面处于什么状态。

## 后续扩展

第二阶段依次扩展旱地、菜地、果园、苗圃和休耕地，并建立田块组合到聚落农业系统的聚合规则。

当前没有公开工作台，没有浏览器验收，也没有人工视觉接受。下一步应先完成 schema 验证器与传统水田关系图小规模运行实验，再进入三维工作台。
