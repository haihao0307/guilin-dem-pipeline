# KAOPU TREE FRACTAL WAVE｜White Oak Teacher R07 研究与实现记录

日期：2026-10-01

## 1. 本轮纠偏

此前 R03–R06 的主要问题不是“参数没调好”，而是没有先选择真实树种老师：根冠比例、主干长度、树冠形态、根系阶段与年龄逻辑均被随意编排。R07 改为先学习北美白栎（Quercus alba），再把资料翻译为 Score 和函数关系。

本轮不是白栎的精确三维测绘复刻，也不是植物生理学仿真；它是“真实物种资料 → Life Grammar → 函数工作台”的第一轮闭环。

## 2. 权威资料提取

### USDA Silvics of North America｜White Oak

来源：
- https://www.srs.fs.usda.gov/pubs/misc/ag_654/volume_2/quercus/alba.htm
- https://research.fs.usda.gov/silvics/white-oak

可冻结事实：

1. 白栎大型、长寿，常见高度约 24–30 m，记录个体可达约 600 年。
2. 开放环境中常形成短而粗壮的主干和宽阔、崎岖的树冠；林内个体倾向更高、更直的主干和紧凑树冠。
3. 幼苗具有明显、发达的主根；随年龄增长，主根逐渐不再占主导，转为发达的渐细侧根与纤维根系统。
4. 观测中多数远离主干的主要根分布在相对浅的土层；细根常集中在上层土壤。
5. 根系面积与树冠面积比例在资料中给出约 3.4:1–5.8:1 的范围。
6. 白栎幼年较耐阴，随体量增长耐阴性下降；释放空间后直径生长可明显提高。

### Self-organizing Tree Models

来源：
- https://algorithmicbotany.org/papers/selforg.sig2009.html

保留方法：

树形可以由芽和枝条对光/空间的竞争，加上内部信号调节，自组织形成；不是预先写死一组分叉角。

### Space Colonization

来源：
- https://algorithmicbotany.org/papers/colonization.egwnp2007.html

保留方法：

利用空间吸引点控制枝条占领目标体积；该方法适合作为“冠层空间声部”，但不能冒充完整生理过程。

## 3. R07 Score 翻译

### Habitat / 环境模式

- `open`：短主干、宽而不规则的树冠。
- `forest`：高直主干、较小且更高的树冠。

这是同一个 Life Score 在不同竞争环境中的两种表达，不是两个模型。

### Shoot / 冠层

- 先建立随年龄变化的 trunk/clear bole。
- 在目标 crown envelope 中生成 attractor field。
- 枝条读取空间吸引、历史方向、向上偏向、光偏向和 competition 参数。
- 拓扑只存节点与父子关系；线宽由下游 terminal load 反算。

### Root / 根系

- 幼年保留主根阶段。
- 随年龄增长，主根段数减少，结构侧根增加。
- 根 attractor 以浅层分布为主，另保留少量较深目标。
- 水分偏向只影响地下 root field，不直接扭曲地上 crown。
- 根系显示尺度遵循资料给出的 root-area / crown-area 范围，而不是复制树冠形状。

### Time / 年龄

- 1–200 年通过同一函数图求值。
- 低年龄只显示当时已经出生的节点。
- 年龄增长增加可见拓扑、负载和径向粗细，而不是整体缩放成年树。

### Rings / 年轮

- 当前年轮视图是 History 声部示范。
- 使用周期性“干旱年”产生窄增量，仅证明历史可以进入径向记录。
- 这不是某棵真实白栎的年轮数据，不得作为科学重建。

### Leaves / 叶片

- 当前叶片为 terminal function marks，用于表达树冠占领与季节颜色。
- 尚未实现白栎真实叶形、叶脉和物候时间，不得称叶片复刻完成。

## 4. 当前工作台

路径：
`kaopu-tree-fractal-wave-lab/white-oak-r07/index.html`

固定入口：
https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tree-fractal-wave-lab/white-oak-r07/

主要功能：

- 手机三维旋转与缩放；
- 1–200 年生命播放；
- 开放地 / 林内树冠对照；
- 光偏向、土壤水分偏向、历史资源、冠层竞争；
- 独立 Root 显示；
- terminal leaf marks 与春夏秋冬；
- 可关闭函数色，回到灰白结构观察；
- 年轮 History 观察框。

## 5. 本地浏览器验证

在 390×844 移动视口使用 Chromium 实测：

- 页面启动无脚本异常；
- 默认 80 年开放地状态生成约 721 个 shoot nodes、398 个 root nodes、1176 个 leaf marks；
- 5、25、80、160 年均能独立生成并显示不同阶段；
- Root、Leaves、函数色、年轮、旋转等控件可切换；
- 该验证不是实体 iPhone/Safari 验收。

## 6. 仍未完成

1. 白栎精确 branch order、芽序和真实叶序。
2. 分枝连接处的连续隐式体表达。
3. 枝条死亡、断枝、愈伤和 epicormic sprouting。
4. 年度天气序列对每一年生长增量的真实驱动。
5. 根与邻树的 root graft / 竞争关系。
6. 真实白栎树皮、叶片函数与风载耦合。
7. 3A 视觉质量。

## 7. 下一阶段质量门

下一阶段不再新建无老师树种。沿同一白栎老师继续完成：

- dormant bud / release / branch death；
- storm break → wound → callus / weathering；
- year-by-year climate history；
- leaf lifecycle；
- bark age/warp 的函数场；
- 相邻树竞争对同一白栎 Score 的改变。

一句话：

**R07 的进步不是“树更漂亮”，而是第一次能指出每一项结构选择来自哪一条真实白栎资料、哪一个通用算法声部，以及哪些仍只是工程假设。**
