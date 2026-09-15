# R023 红河哈尼地区证据合同与田块拓扑

状态：研究实现。继承 R022；没有新视觉候选。

## 本轮纠正

2026-09-10 直接读取 UNESCO/ICOMOS 的 2013 年评估原件与委员会文件。
原件支持的是木柱上的 `wood-cuts` 表示需水量，水少时轮流供水。它没有给出
木棍根数、开口宽度、水头与瞬时流量比例之间的关系。因此用户提供的“两根、
三根木棍分水”继续作为重要现场线索，不升级为已经证实的水力定律。

同一评估原件还明确记录：所评梯田由黑色黏土构筑，没有挡土墙，梯壁是黏土
切面。元阳样板不能默认生成统一石砌挡墙；任何局部石构都要有独立地点、年代
和构件证据。

## 已锁定的地区关系

`HONGHE_PROFILE.json` 把以下事实与来源逐条绑定：

* 森林、水系、村落与梯田组成整体系统；村落通常位于森林下、梯田上。
* 林中溪泉通过重力沟渠等设施服务村落和田块，水路共同维护。
* 分水包括需水标记、轮灌、看沟人和共同规则，不能只画一个装置。
* Bada、Duoyishu、Laohuzui 的坡度等级不同，禁止使用同一重复梯田模板。
* 红米品种与方法随海拔和地方条件改变，评估材料称当地红米多达 48 种。

没有在原件中发现田埂宽高、梯壁高度/坡度、干支渠截面或田口尺寸。这八项在
机器合同中必须保持 `null`；填入无来源的“常见值”会被测试拒绝。

## 田块拓扑内核

`tools/parcel_topology.py` 接收明确给出的二维坐标与田块顶点环，执行：

1. 统一绕向并验证有限坐标、非零面积、无自交简单多边形；
2. 拒绝同坐标多身份、T 形断边、错分段、田块穿越与内部重叠；
3. 每条共享边只生成一个稳定物理身份，同时引用两侧田块；
4. 对每块田作确定性三角化，并复算三角形面积守恒；
5. 不修改输入，田块和字典顺序不影响结果。

这比 R022 仅按顶点名登记共享边前进一步，但仍是平面结构内核。输入坐标可以
来自测量或合成，调用方必须保存来源；本内核不证明真实地形贴合、高程、田埂
截面、梯壁稳定或地区真实性。

## 来源

1. [ICOMOS Advisory Body Evaluation, No. 1111](https://whc.unesco.org/document/151777)，
   重点读取 PDF 第 74–77 页。
2. [UNESCO World Heritage Committee WHC-13/37.COM/8B](https://whc.unesco.org/document/122860)，
   重点读取 PDF 第 22–24 页。
3. [UNESCO property page No. 1111](https://whc.unesco.org/en/list/1111/)。

以上资料证明地区系统、材料和治理关系，不是构件测绘报告。

## 复现

```sh
python farmland-object-dna/tools/regional_profile.py \
  farmland-object-dna/research/r023-honghe-regional-contract/HONGHE_PROFILE.json
python -m unittest discover -s farmland-object-dna/tools -p 'test_*.py' -v
```

下一步仍需取得带尺度的现场截面或测绘资料，并建立独立水稻阶段结构。满足这些
门槛以前，`ready_for_regional_geometry=false`、`visualAcceptance=false`、
`productionReady=false`。
