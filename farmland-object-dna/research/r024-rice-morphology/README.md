# R024 水稻器官与生命周期结构合同

状态：物种级结构合同完成；地区数值、几何资产和视觉候选未完成。

## 本轮解决的问题

R024 把水稻从一个可缩放、可换色的代理体拆成十四个必须独立表达的状态：

`nursery → lifting_seedlings → transplanted → establishment → tillering →
stem_elongation → panicle_initiation → booting → heading → flowering →
grain_filling → maturity → harvest → stubble`

每个状态都有独立的未来几何族、拓扑事件、器官显隐、根—秆—分蘖—叶—旗叶
鞘—穗—小穗—籽粒—切割状态，以及对应的色彩依据、田水关系和风响应驱动。
`RICE_LIFECYCLE_CONTRACT.json` 仍是结构规格，不包含网格或渲染资产。

关键结构事件包括：

1. 分蘖从主秆基部节点逐级形成，不是植株整体横向放大；
2. 拔节改变节间和叶片起点的拓扑与比例；
3. 幼穗分化位于分蘖生长点，孕穗期穗仍包在旗叶鞘内；
4. 抽穗要求穗穿过旗叶鞘开口，开花要求小花开放并出现伸长的雄蕊或花药；
5. 灌浆要求受精子房形成籽粒，并出现乳熟到蜡熟、穗负载增加和下弯；
6. 成熟要求硬而干的籽粒和明显衰老的植株器官；
7. 收割必须打断站立作物拓扑，残茬必须是无穗的切断秆基，切茬高度仍未知。

验证器禁止两个阶段复用同一个 `geometry_family_id`、同一拓扑签名或同一组
色彩/田水/风响应说明。它也禁止在阶段对象中偷塞未测的株高、分蘖数或其他
地区数值。

## 证据边界

本轮直接读取澳大利亚政府 Office of the Gene Technology Regulator 的
[The Biology and Ecology of Rice](https://www.ogtr.gov.au/sites/default/files/files/2021-07/the_biology_of_rice.pdf)，
使用其形态、营养生长、生殖发育和籽粒成熟章节建立物种级器官关系。它支持
纤维根、具节与中空节间的秆、基部分蘖、叶鞘与叶片、旗叶鞘内幼穗、抽穗、
小花开放、灌浆和成熟等结构事件。

红河地区仍由
[ICOMOS Advisory Body Evaluation No. 1111](https://whc.unesco.org/document/151777)
限定：当地红米品种和方法随海拔与地方条件变化，不能把一个通用稻株当作元阳
标准品种。

三个既有 IRRI 入口在 2026-09-10 访问时均超时。它们登记在
`unavailable_source_targets`，并由测试保证不能被伪装成已读证据。因此育秧、
起秧、插秧、返青、收割和残茬中的地方作业形式只登记为合同要求，不能冒充
已经证实的元阳实践。

## 仍保持为空的地区参数

合同锁住 24 项地区参数为 `null`，包括品种身份与阶段日历、秧龄、每穴苗数、
株行距、插深与角度、田间水深、株高、分蘖数、秆与节间尺寸、叶与穗尺寸、
籽粒尺寸、割茬高度、倒伏率、风响应系数和校准色板。每一项都有对应的现场
测量或来源要求。

这些空值意味着 R024 不能生成“看似准确”的元阳稻株。它只规定下一步构造
几何时必须出现什么结构变化，以及哪些数值必须等资料。

## 复现

```sh
python farmland-object-dna/tools/rice_morphology.py \
  farmland-object-dna/research/r024-rice-morphology/RICE_LIFECYCLE_CONTRACT.json
python farmland-object-dna/tools/probe_rice_morphology_r024.py
python -m unittest discover -s farmland-object-dna/tools -p 'test_*.py' -v
```

完成地区品种参数、阶段性几何资产和地方构件截面以前，
`ready_for_structural_truth_workbench=false`、`visualAcceptance=false`、
`productionReady=false`。
