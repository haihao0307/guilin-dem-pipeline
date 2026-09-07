# Farmland Object DNA examples

## traditional-paddy-v001.json

这是最早的机器可读候选，只用于格式历史和失败对照。它包含过度简化的单田块、田埂环和占位水路，不能作为结构、尺度、水力或视觉生产基线。

状态：superseded_for_research

允许用途：schema 历史对照

禁止用途：程序化几何基线、公开工作台基线、田埂拓扑、水力拓扑、水稻形态和 3A 视觉基线

## traditional-paddy-v002-research.json

这是 V0.1.1 严谨规则下的研究占位对象。它明确保留未知项、来源卡状态、闭合水路目标、截面状态、作物阶段状态和 debug 限制。

状态：research_only

ready_for_structural_prototype=false

ready_for_public_candidate=false

执行者必须先补齐来源卡、截面、水力、高程、水量、劳动和作物阶段字段，再申请结构原型。