# 元阳与红河哈尼梯田整体系统研究计划 V0.1

日期：2026-09-07

状态：in_progress

用途：为 Farmland Object DNA 的山地梯田、水利、村落、森林、劳动和文明系统建立证据基础。本页只登记已读到的权威起点、用户提供的现场知识方向和待验证问题，不代表结构已经完成。

## 一、已由权威材料支持的整体结构

UNESCO World Heritage Centre 将红河哈尼梯田描述为森林、供水、梯田和房屋组成的一体化系统。山顶森林捕获并维持灌溉所需水分，雨水经岩石裂隙和地层进入泉水，再由复杂渠道分配到不同山谷和梯田。村落位于山顶森林下方、梯田上方的高程带。

UNESCO 公开页面与评估材料记录了四条干渠、392 条支沟，总长度 445.83 公里，并说明这些水路由社区共同维护。材料也记录了 82 个村落，常见规模约 50 到 100 户，每户耕作一到两块梯田，并描述水牛、牛、鸭、鱼、鳝、蜗牛与红米生产的综合关系。

这些数字只适用于 UNESCO 所述遗产范围和相应统计口径，不能直接套入其他地区。

权威入口：

1. https://whc.unesco.org/en/list/1111/
2. https://whc.unesco.org/document/122860
3. https://whc.unesco.org/document/135098

## 二、用户明确要求纳入的系统关系

以下内容作为强制研究题，不直接登记为已完成事实：

1. 山顶至山脚的连续水路。
2. 水源林、护林规则和禁止破坏水源地的制度。
3. 村落所处位置及其与森林、生活用水、渠道、梯田和道路的关系。
4. 引水渠、干渠、支渠、分水点、田间进水、田内蓄水、田间出水、下游排水的完整拓扑。
5. 木刻、木柱、木棍或其他传统分水设施的本地名称、数量、插设方式、分水比例和水权制度。
6. 每一级梯田的横断面、田埂、田坎、渗水和溢流关系。
7. 清渠、修埂、护林、分水和冲突解决的共同劳动。
8. 暴雨、旱季、滑坡、堵塞和破埂情况下的系统响应。
9. 水到达山脚以后进入的河谷、水塘、溪流或其他受体。
10. 时代、村落和区域之间的差异。

## 三、传统分水装置的当前证据状态

UNESCO 和 ICOMOS 的评估材料在英文摘要中出现以木刻或木柱标记组织水量分配的描述。用户补充了两根、三根或更多木棍参与不同份额分水的现场知识。

当前仍需查明：

1. 当地哈尼语和汉语名称。
2. 木棍或木柱安装在渠槽的具体位置。
3. 它们通过开口宽度、水头、堰高、阻力或轮灌时段中的哪一项控制分水。
4. “三分水”“七分水”等表达对应固定比例、份额单位、农户权利或操作习惯中的哪一种。
5. 装置横断面、纵断面、材料、尺寸和更换周期。
6. 管理者、操作人、纠纷处理和年度维护。
7. 元阳内部不同村落是否采用同一形式。
8. 类似装置在龙脊、紫鹊界、巴厘岛或其他梯田地区的相似与差异。

在上述问题取得可靠来源以前，系统只能创建 `divider_research_target`，禁止生成正式装置。

## 四、需要建立的空间带

研究模型先将山地系统分成可重叠的功能带：

1. 山顶及上部集水森林带。
2. 泉水、溪流和取水节点带。
3. 主干输水和跨谷水路带。
4. 村落及生活生产服务带。
5. 上部梯田带。
6. 中部梯田带。
7. 下部梯田带。
8. 坡脚汇水和河谷受体带。
9. 山脊、沟谷、滑坡和不可耕作保留带。

每个功能带都要保存高程范围、坡度、坡向、地质、土壤、植被、水量、道路、人口、劳动和证据。

## 五、需要建立的有向关系图

最小节点：

watershed_forest
spring
stream
intake
trunk_channel
branch_channel
divider
village_water_node
field_inlet
field_cell
field_outlet
spillway
drainage_channel
slope_toe_receiver
river_valley_receiver
maintenance_group
water_right_holder

最小边：

recharges
feeds
divides_to
supplies_household
supplies_field
spills_to
drains_to
maintained_by
allocated_to
protected_by
crosses
blocked_by
threatened_by

每条水力边都要有方向、高程、长度、截面、容量、流量、维护和证据。每条制度边都要有有效时间、权利主体、责任主体和来源。

## 六、截面研究清单

必须获得或重建有依据的：

1. 山坡原始截面。
2. 梯田切填截面。
3. 田面、泥化层、犁底层和下伏土体。
4. 田埂横断面。
5. 田坎和梯壁横断面。
6. 干渠横断面与纵断面。
7. 支渠横断面与纵断面。
8. 分水设施平面、横断面和纵断面。
9. 进水口与出水口。
10. 跌水、溢流和冲刷防护。
11. 渠道与道路、房屋、田埂相交位置。
12. 山脚排水与河谷受体连接。

## 七、首轮验证场景

### 场景 A：正常旱季供水

检查上部森林和泉水供给、干支渠分水、村落用水、上中下部梯田水位和最终排水。

### 场景 B：短时暴雨

检查渠道超高、分流、溢流、田埂安全、田坎冲刷、坡脚汇水和河谷响应。

### 场景 C：上游渠道堵塞

检查受影响田块、旁路、人工清障需求和下游缺水。

### 场景 D：田埂破口

检查田块失水、下游突增流量、冲刷和维修任务。

### 场景 E：上部森林受损

只在取得生态与水文参数后运行，检查泉水季节性、泥沙、径流峰值和坡面稳定变化。缺少参数时保持 unsupported。

### 场景 F：劳动力不足

检查清渠、修埂、插秧和收割积压怎样改变可维护田块数量和弃耕风险。

## 八、生产准入状态

overall_system_sources=partial
forest_source_relation=partial
village_elevation_relation=partial
trunk_and_branch_channel_inventory=partial
traditional_divider_geometry=unknown
traditional_divider_ratio_mechanism=unknown
channel_sections=unknown
bund_sections=unknown
terrace_sections=unknown
field_level_hydraulics=unknown
mass_balance_model=not_run
labor_governance_model=not_run
ready_for_structural_prototype=false
ready_for_public_candidate=false
visualAcceptance=false
productionReady=false
