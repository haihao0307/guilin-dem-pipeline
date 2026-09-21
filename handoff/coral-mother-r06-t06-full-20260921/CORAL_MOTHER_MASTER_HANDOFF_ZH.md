# Coral Mother 全量交接总账

更新时间：2026-09-21  
状态：执行中；当前停在 R06-T06，下一轮为 T07 微尺度形体函数。

## 1. 项目定位

Coral Mother 是珊瑚程序化生产体系，不是静态 GLB 展示器。目标是把真实珊瑚标本、NOAA 分类、Palau 证据和可调数学函数连接起来，最终形成可复用的珊瑚母体。

核心方法：

`真实标本观察 → A/B 对照 → 生长规律抽取 → 连续函数复刻 → 物种内参数化 → 同类扩展`

用户要求：

- 这是执行平台，不是讨论平台。
- 每次尽快产出一个可一按打开的浏览器工作台。
- 参考模型只负责观察和形态学习，运行时不得依赖模型或外部贴图。
- 分类不得自造，必须按正式生物分类、NOAA 大类／生长形态和 Palau 证据层组织。
- 工作台以干活为主，文字和装饰必须压缩；所有可调参数集中显示。
- 形体、颜色、微表面都应最终落成函数和数据。

## 2. 已否定路线

### R05 八类一次铺开

R05 同时做桌面、鹿角、菜花、脑纹、叶状、海扇、海羽、皮革软珊瑚。该路线的问题是先造通用外形，再靠粗细、密度和颜色冒充不同物种，不能作为形态真值。

R05 仅保留为历史实验，禁止继续从它扩类。

### 逐边圆柱拼接

早期 branching 形体由许多短圆柱／短段拼接，产生分段感、接缝感和节点球感。该方式已被 T05 连续管路径取代。

### Microscope 误当镜头

Microscope 不是近摄按钮或相机概念。它是 U 黑式的微尺度表面／形体函数，用来控制珊瑚杯、杯缘、细脊、颗粒、孔口和局部微起伏。

### 以三角面为核心指标

用户不接受把体系解释成传统三角面堆积。内部 WebGL 仍可使用渲染缓冲，但用户面对的是生长路径、连续场、尺度、密度、半径、分叉和微形体函数。

## 3. 官方分类合同

分类不得由项目自创。

### 正式生物分类

Animalia → Cnidaria → Anthozoa → Scleractinia → Pocilloporidae → Pocillopora → Pocillopora damicornis

### NOAA 层

- Broad type：Hard / stony coral
- Growth form：Branching coral

NOAA 的 Branching、Table、Foliose、Massive 等是生长形态，不是科、属或种。

### Palau 层

Palau 层只保存：

- 物种出现证据
- 礁区、深度和群落语境
- CRRF／PICRC 等来源字段

当前 Smithsonian 标本不是 Palau 出现记录，因此 `Pocillopora damicornis` 的 Palau occurrence 仍为 `UNRESOLVED`。

## 4. 当前唯一参考对象

- Asset ID：`CORAL-GLB-REF-010`
- 文件名：`pocillopora_damicornis.glb`
- SHA-256：`76e8fef5da668581a8a59ca93f2975c0d23eb5dd6b272f4196007b11430d5d3a`
- 来源：Smithsonian museum 3D specimen
- 许可：CC0-1.0
- 原始几何审计：67,851 顶点 / 100,000 面
- 源坐标包络：0.185019 × 0.125800 × 0.142545
- 源坐标单位未验证为米，不得直接宣称真实米制尺寸
- 工作台内嵌：PCA 对齐后的 8,000 个参考观测点

参考颜色不作为活体颜色真值。

## 5. 形体函数路线

当前函数顺序：

`attachment field → colony envelope → primary branch graph → short secondary branchlets → verrucae field → blunt growth tips → branch avoidance → skeletal surface`

T05 已完成的连续管逻辑：

- 从正式枝图提取 junction-to-junction、junction-to-tip 的连续生长路径。
- 对生长路径作连续采样。
- 截面使用 parallel transport，避免逐段重新定向。
- 半径沿弧长连续插值。
- 枝端由管体连续闭合。
- 正式分叉点使用单次平滑连接。
- 疣突作为连接在母管上的短连续侧芽。

T06 当前默认数据：

- 参考点：8,000
- 原始节点：726
- 原始边：725
- 全保留连续路径：216
- 默认细枝保留量：0.22
- 默认显示路径：73
- 最低保留路径：13
- 默认骨架厚度：0.92
- 运行时：0 GLB / 0 texture / 0 fetch

## 6. 颜色合同

颜色不是 NOAA 分类颜色，不能用色彩替代分类。

当前七套显示候选：

- 电光玫红
- 日落橙金
- 荧光紫
- 孔雀青
- 酸绿黄
- 白化存活
- 裸露骨骼

颜色层应继续分为：

`skeleton intrinsic → living tissue pigment → symbiont contribution → polyp state → fluorescence → underwater spectral attenuation → health state`

健康状态至少包括：

- 健康浸水
- 受压／部分白化
- 白化但存活
- 近期死亡、组织脱落
- 长期干燥风化骨骼

当前用户确认高饱和方向基本正确；活组织应有荧光。

## 7. 硬珊瑚与软珊瑚边界

用户口头常说“硬的和软的两种”，但实现必须服从正式分类和真实支撑系统。

硬珊瑚重点：

- 刚性钙质骨骼
- 连续分枝／块状／片状生长函数
- 珊瑚杯、杯缘、细脊、疣突、颗粒、孔口
- 不应表现为光滑半透明塑料

软珊瑚重点：

- 柔性组织、轴向或水压支撑差异
- 水流响应和组织摆动
- 可能有半透明和开合
- 不能只是硬珊瑚换材质

注意：Heliopora 等是反例，八放珊瑚也可能形成硬骨骼，因此“软珊瑚=全都柔软”不能作为分类规则。

## 8. 当前工作台与 QA

固定在线地址：

https://haihao0307.github.io/guilin-dem-pipeline/coral-mother-r06-pocillopora-t06-compact-parameter-dock/

发布提交：

`b5959e8064480a88ff373b86019735373d7afedc`

工作分支：

`work/coral-mother-r06-t06-compact-parameter-dock-20260921`

工作分支提交：

`dc78512b8992a02e8a3d0062f29862027369f007`

浏览器门禁：

- 2560×1080：通过；主工作区宽度比 1.0；12 个滑条首屏全部可见
- 1536×960：通过；主工作区宽度比 1.0；12 个滑条首屏全部可见
- 390×844：启动通过；无横向溢出；手机不强制所有滑条同屏
- WebGL：通过
- 运行错误：0
- 运行时外部资产：0

## 9. 当前 12 个调节参数

- 骨架厚度
- 细枝保留量
- 枝端钝化
- 表面起伏
- 参考点径
- 表面疣突
- Microscope 尺度
- 杯口阴影
- 骨骼颗粒
- Microscope 凹凸
- 活组织荧光
- 色彩饱和

当前 UI 已把这些参数集中到同一个参数坞。

## 10. 用户最新反馈与未完成项

这是下一轮最重要的真值，不得遗漏：

1. 骨架厚度通常不会特别大；当前 0.92 可继续微调，但不是第一优先级。
2. 枝端钝化目前看不出明显变化，必须增强到肉眼可见的形体变化。
3. 表面起伏／表面 U 图变化过弱，幅度应明显扩大。
4. 表面疣突只有一点点变化，应增强。
5. Microscope 凹凸当前几乎不影响形体，必须改成 U 黑式微尺度形体函数。
6. 骨骼颗粒当前看不出变化，必须可见。
7. 杯口阴影可以更深、更明显。
8. Microscope 尺度只是图形／微结构尺度参数，不能被误解为镜头。
9. 细枝保留最低值必须删除悬空枝；珊瑚不可能出现失去母体连接的孤立悬空结构。
10. 高饱和色和活组织荧光方向继续保留。

## 11. 下一轮禁止事项

- 禁止再做 UI 大改，除非参数无法使用。
- 禁止继续写空泛计划而不实现。
- 禁止用纯 shader 明暗冒充已经影响形体。
- 禁止最低细枝保留后留下悬空、孤立或断裂分支。
- 禁止重新回到逐段圆柱。
- 禁止把参考 GLB 或参考贴图变成运行时依赖。
- 禁止在用户确认前把 `visualAcceptance` 或 `productionReady` 改成 true。

## 12. 参考库

知识与生产回执位于：

`haihao0307/KAOPU-REFERENCE-CACHE`

关键路径包括：

- `knowledge/coral/CORAL_GLB_BATCH_D_20260920.json`
- `knowledge/coral/CORAL_BATCH_D_METHOD_RESET_ZH.md`
- `knowledge/coral/CORAL_R06_POCILLOPORA_T01_PRODUCTION_RECEIPT_20260920.json`
- `knowledge/coral/CORAL_R06_POCILLOPORA_T05_CONTINUOUS_TUBE_RECEIPT_20260921.json`
- 本次交接后新增的 T06 handoff receipt

原始参考二进制的远端完整 LFS 状态必须单独核对；不得把“登记”冒充成“二进制已全部上传”。