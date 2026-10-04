# Living 3D Tree R05 — 器官生命周期与 Source–Sink 证据映射

## 1. 叶片不是永久装饰，而是 source organ

成熟叶片能够输出光合同化碳，而根、茎、果实等非光合或快速生长器官是 sink。R05 因此把叶片从“显示用叶子”提升为资源源头：只有进入 mature 状态的通用叶才贡献主要 carbon source；primordium / unfolding / senescent 状态贡献较少，abscised 状态不再贡献。

证据：
- Osorio et al., *An update on source-to-sink carbon partitioning in tomato*, Frontiers in Plant Science, 2014. PMC4186278.
- Fernie et al., source–sink physiology reviews; R05 只吸收 source / sink 关系，不照搬作物特定参数。

## 2. 果实是强 sink，会与营养生长竞争

果实发育需要从 source 组织输入光合同化物；果实负载改变 source–sink 平衡，也会与营养器官竞争资源。R05 因此把“结果”做成资源决策，不是随机挂球：只有成熟阶段、允许 reproduction 且 reproductive budget 足够时，才生成通用 flower / fruit sink；这部分预算会在 Root/Shoot 分配之前扣除。

证据：
- Ludewig & Flügge / source–sink reviews summarized in *Sugar Metabolism in Stone Fruit: Source-Sink Relationships...*, 2020. PMC7691294.
- *An update on sugar allocation and accumulation in fruits*, Plant Physiology, 2023.

工程边界：R05 的花果几何只是 sink 逻辑占位，不能冒充任何物种的花或果实。

## 3. 顶端分生组织连续产生器官

Shoot apical meristem 持续产生新的组织、叶原基和后续器官。R05 保留 R04 的 apical meristem zone，并让叶器官以 primordium → unfolding → mature → senescent → abscised 的生命周期出现，而不是一次性生成永久叶。

证据：
- Murray et al., *Systems Analysis of Shoot Apical Meristem Growth and Development*, The Plant Cell, 2012. PMC3517227.
- Cleland, *Unlocking the mysteries of leaf primordia formation*, PNAS, 2001. PMC58667.

## 4. 叶序是物种 Score，不是 Core 的唯一答案

不同植物存在螺旋、对生、轮生等不同叶序。R05 因此只保存多个 phyllotaxis voice（spiral / opposite / whorl-3），不把任何一种设为“植物默认事实”。未来 Species Score 明确选择哪一个声部及其参数。

## 5. 储备碳是缓冲，不应该每一轮全部花掉

树木会在即时生长、维护、储存与后续 sink 之间分配非结构性碳水化合物。R05 新增 reserve pool：当前源过剩时保留部分储备，下一轮 source 不足时仍可以支持维护与生长。

参考：
- tree carbon allocation reviews and pulse-labelling literature, e.g. Epron et al., *Pulse-labelling trees to study carbon allocation dynamics*, Tree Physiology, 2012.
- Recent reviews describe NSC as source–sink–storage balance; R05 只实现概念缓冲池，不冒充细胞级代谢。

## 6. 次生加粗与年龄 / 支撑历史相关

SAM 负责延长，而木本植物还有 secondary growth 使轴向器官逐渐加粗。R05 暂时把“形成层 voice”表达为：segment age + downstream support demand + carbon availability → radius increase，再回写 continuous implicit skin。

边界：这不是实际形成层细胞、年轮、导管或木材组织模型；后续要单独学习年轮、风化、伤口与木材解剖。

## R05 生命链

Seed
→ Root + Shoot
→ mature leaves become Source
→ root tips contribute water/mineral uptake
→ maintenance cost
→ reproductive sink / reserve set-aside
→ Root/Shoot budget
→ fine twigs consume remaining resources
→ secondary thickening uses age/support history
→ leaf lifecycle + generic reproductive organs
→ continuous implicit skin
→ next pass

所有“物种形态”仍然留给 Species Score。
