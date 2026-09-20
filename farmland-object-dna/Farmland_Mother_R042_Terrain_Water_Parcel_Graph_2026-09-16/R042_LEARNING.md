# Farmland Mother R042 · 小妈与 Yohei 多尺度知识采用

日期：2026-09-16

## 实际读取

本轮读取：

- `feature/landscape-microscope-geometry-lab-r1-20260916/landscape-mother/SKILL.md`
- `feature/landscape-microscope-geometry-lab-r1-20260916/landscape-mother/platform.json`
- `feature/landscape-microscope-geometry-lab-r1-20260916/handoffs/landscape-mother/LEARNING_CURRENT.md`
- 小妈固定来源中的 `MACROSCOPIC_MICROSCOPE_ROCK_DETAIL.md`
- 小妈固定来源中的 `NISHITSUJI_CLTUV8OS.md`

## 对 R041 的纠错

R041 把“细胞式组织”过度解释为 power-cell / Voronoi 外形。这个映射错误：参考图中的水田不是细菌菌落，也不是均匀蜂窝。真实可读关系是地形、水源、田埂、道路、劳动力与历史分割共同形成的田块图。

因此 R042 取消以距离场直接决定田界的做法。田块首先是约束图中的面：先建立山谷、主水路、田组管理边界和劳作方向，再递归分割为可维护的小田块。

## 对 Yohei 知识的采用边界

R042 只采用“固定参考坐标、多尺度倍频、幅度递减、共享空间组织”的方法，用于：

- 调节目标田块尺度；
- 调节分割线角度与位置；
- 给共享田界增加低幅度连续曲率；
- 保持粗、中、细尺度来自同一世界坐标。

没有把原作的径向世界、折叠 IFS、光线累计或视觉亮边直接当作稻田几何。多尺度函数不能替代农业关系，也不能改变山谷、水网和田块身份。

## R042 的对象顺序

`Macro terrain → water/access skeleton → management zones → recursive parcel faces → shared bund graph → per-field inlet/outlet → crop and actor state → rendering → QA`

这对应小妈的：

`Source Field → Shape Field → Data/Mask Field → Color Field → Render Field → QA`

## 证据边界

- 田块形态来自用户参考图的结构阅读与程序化候选，不是某个 1940 年代村庄的实测地籍。
- 平坝田块面积、田埂宽度、渠槽断面和劳动规模仍需具体地区、年代和测绘资料标定。
- `visualAcceptance=false`
- `productionReady=false`
