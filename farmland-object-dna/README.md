# Farmland Object DNA

Farmland Object DNA 是 guilin-dem-pipeline 中面向传统农业对象的独立领域系统。它与 Weather Mother、Ocean Mother、Landscape Mother、DEM 等并列协作，负责农田对象自身的结构、关系、生命周期、水力、劳动约束和可重建参数。

## 当前状态

当前规则版本：V0.1.1

当前生产阶段：研究与结构真值重启

人工视觉接受：false

生产批准：false

公开工作台 `FARMLAND_DNA_WB_V0.1.0_20260907` 已被用户明确否决，只保留为失败对照。它的圆管渠道、圆管田埂、假水深、孤立进排水节点、机械格网和圆锥水稻禁止回归。

## 强制入口

每次开工按顺序读取：

1. 仓库根目录 `AGENTS.md`
2. `FARMLAND_PRODUCTION_RULES.md`
3. `V001_FAILURE_REGISTER.md`
4. `RESTART_START_HERE.md`
5. `HANDOFF.json`
6. `OBJECT_DNA_CONTRACT.md`
7. `INTERFACE_CONTRACT.md`
8. `QUALITY_GATES.json`

## 已建立

1. 独立工作分支 `feature/farmland-object-dna-v001`。
2. 强制严谨生产规则与失败基线登记。
3. 十二层 Object DNA 合同。
4. 跨 Mother 输入输出合同。
5. 机器可读 schema 与传统人工水田候选样例。
6. 证据、截面、水力、生命周期、Microscope 和 3A 质量门禁。
7. V0.1 技术发布与浏览器验证记录，明确限定为已否决样板的技术状态。

## 第一对象族

水田是第一重点。基础构件已经扩展为：

watershed_forest、spring_or_stream_source、intake、main_channel、branch_channel、divider、field_cell、bund、terrace_step、inlet、outlet、spillway、drainage_channel、water_surface、crop_stand、footpath、settlement_link 和 downstream_receiver。

水田对象需要同时回答：

1. 它在哪里，为什么适合形成水田。
2. 森林、水源、村落、道路和田块怎样组织。
3. 水从哪里来，经过哪些渠道、分水点、田块和出水口，最终到哪里。
4. 田埂、田坎、渠道、田面和进排水构件的真实截面是什么。
5. 谁在什么时候以什么工具和劳动强度维护它。
6. 当前田面水深、土壤和水稻处于什么状态。
7. 插秧、分蘖、孕穗、抽穗、灌浆、成熟、收割和残茬怎样形成不同结构。
8. 哪些事实有来源，哪些属于推断、程序生成、未知或冲突。

## 元阳专项

第一项区域系统研究为元阳和红河哈尼梯田。研究对象覆盖山顶及上部森林、水源保护、泉水、溪流、干渠、支渠、传统分水、村落高程带、梯田序列、下游河谷、共同维护和综合稻作系统。

传统木刻、木柱或木棍分水的构造、比例和管理制度仍需继续核验。证据不足的部分只登记为 research_target，不进入正式装置生成。

## 下一候选

下一候选从水田结构真值台开始，先完成渠道、田埂、田坎、田面、进水口、出水口和分水设施的平面、横断面、纵断面与真实尺寸，再完成平坝和梯田的闭合水力图、水深、水量守恒和独立水稻阶段模型。

Microscope 在宏观系统、中观拓扑和截面通过后使用，负责土块、石头、草根、裂缝、湿润线、淤积、泥浆、叶片、分蘖、稻穗和籽粒等微观细节。

## 后续扩展

水田通过结构、水力、生命周期和 3A 门禁以后，再依次扩展旱地、菜地、果园、苗圃和休耕地，并建立田块组合到聚落农业系统的聚合规则。