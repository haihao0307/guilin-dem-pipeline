# Coral Mother R06 — Pocillopora damicornis 单物种复刻执行令

状态：执行中  
原则：先观察、再复刻、再抽象；本阶段不得扩展成混合珊瑚展示。

## 0. 停止旧路线

R05 的“八类一次铺开”停止继续扩类。它可保留作历史实验，但不能再作为形态真值。

禁止：
- 用同一组圆柱、球体或噪声参数冒充不同珊瑚；
- 以商品模型色彩或干标本色彩作为活体色；
- 在骨架轮廓未通过前用高饱和材质遮盖形体问题；
- 把 Pocillopora、Seriatopora、Acropora 合并为一个 branching 按钮；
- 把海绵、海葵、水草、化石 Rugosa 混入现代珊瑚生产类型。

## 1. 唯一目标

第一件母体只复刻 `Pocillopora damicornis`：

- 紧凑菜花状整体包络；
- 共同附着基底；
- 粗短主枝；
- 密集次级短枝／疣状突起；
- 不规则钝端；
- 枝间保留真实空隙，不互相穿透；
- 开放度随水流暴露条件改变，但仍保持物种级结构边界。

参考对象：`CORAL-GLB-REF-010`  
SHA-256：`76e8fef5da668581a8a59ca93f2975c0d23eb5dd6b272f4196007b11430d5d3a`  
文件：`pocillopora_damicornis.glb`  
许可：Smithsonian CC0  
原始几何：67,851 顶点 / 100,000 三角面  
源坐标包络：0.185019 × 0.125800 × 0.142545（不得直接宣称为实测米制）。

## 2. 观察阶段

必须固定输出同一套正交观察：

1. 正面；
2. 侧面；
3. 顶面；
4. 45° 透视；
5. 中性灰骨骼；
6. 仅轮廓；
7. 枝径分级；
8. 分叉节点与枝端标记；
9. 枝间空隙图；
10. 表面疣突频带。

本阶段只记录：整体长宽高比例、主枝数、分枝级数、枝径分布、枝端密度、空隙率、基底覆盖率、各向异性、表面突起密度。

## 3. 复刻阶段

程序化结构顺序：

`attachment field → colony envelope → primary branch graph → short secondary branchlets → verrucae field → blunt growth tips → branch avoidance → skeletal surface`

每一层必须可单独显示和关闭。不得以最终网格倒推函数名称。

## 4. 颜色防火墙

R06-T01 默认只提供：

- 中性骨骼；
- 活组织占位层；
- 白化检查层；
- 死亡／裸骨层。

活体色彩在形体通过前冻结。后续颜色必须拆成：

`skeleton intrinsic → living tissue pigment → symbiont contribution → polyp state → fluorescent response → underwater spectral attenuation → health state`

参考 GLB 贴图不会进入生产材质。

## 5. 验收门槛

必须同时通过：

- 三视图轮廓与参考对象可直接 A/B；
- 主枝／次枝层级可读；
- 不依赖高饱和颜色也能识别为 Pocillopora，而不是通用“菜花”；
- 无枝体穿插、悬空枝、孤立球体或机械等角分叉；
- 生成器在移除参考 GLB 后独立运行；
- 桌面与 390×844 手机页面均可一按直接打开；
- 浏览器 JavaScript 错误为 0；
- visualAcceptance 在用户确认前保持 false。

## 6. 反例验证

Pocillopora 通过后，才引入 `Seriatopora hystrix` 作为反例：细枝、高阶、鸟巢状、开放网孔。若只改“枝条粗细”就能从 Pocillopora 变成 Seriatopora，说明内核仍然错误，必须回退重做。
