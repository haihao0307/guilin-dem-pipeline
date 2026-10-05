# 高斯泼溅 × 分形噪波 — 老师效果实验 R01

2026-10-05。原工作台的增量页签，不创建另一套工作台。R02/R03 的原始 HTML、运行时代码和语法契约不修改。入口仍是 `kaopu-tree-fractal-wave-lab/`，新增 `#gaussian-noise` 页签。没有 Houdini 运行时、授权或插件依赖。

## 先说清楚是否一比一

**不是一比一完成。** 本轮实现的是相同表现类型的程序化效果实验，默认树体是程序化替身。用户视频未提供原始扫描 PLY、摄影机、节点图或动画缓存；原片树冠、树皮、枝结、苔藓、细丝轨迹和镜头仍与本实验不同。不能将颜色近似、能运行或测试通过写成“视觉一比一”。

## 视频证据与未知

用户上传视频：1920×1080、25 fps、约 10.944 秒。逐时检查到：开始是彩色细丝局部卷动的枝干特写；中间退去彩丝、逐渐看见裸枝；约 8.5 秒之后出现完整绿叶冠层。视频里有镜头变化，没有展示 Houdini 节点网络。

能够确认：同一类树体上的局部高斯/细丝视觉、显隐、卷动、裸枝与绿叶两个状态。
不能仅凭视频确认：作者使用 curl noise、特定 VEX 表达式、代理网格、某个 GSplat 插件、实际树木生长、生物资源流或确切几何重建管线。本实验选择的方法属于可检验的工程假设，而不是“已读出作者源码”。

## 官方资料中真正可以继承的结构

SideFX 的 Bake GSplats 文档要求先将常见 PLY 表示转换为可正确变换的属性：位置、尺度、四元数方向、透明度和颜色；原始 PLY 常见 opacity 需要 sigmoid、尺度采用指数还原、方向需要归一化。Rasterize GSplats 接收相应点属性再进行渲染。改变点位置时，椭球方向和尺度也必须一起考虑，不能把高斯简化成固定大小的圆点。

来源：
- SideFX, Bake GSplats: https://www.sidefx.com/docs/houdini/nodes/sop/bakegsplat.html
- SideFX, Rasterize GSplats: https://www.sidefx.com/docs/houdini/nodes/cop/rasterizegsplats.html
- Kerbl et al., 3D Gaussian Splatting for Real-Time Radiance Field Rendering, 2023: https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/
- Bridson, Hourihan, Nordenstam, Curl-noise for procedural fluid flow, 2007: https://doi.org/10.1145/1276377.1276435

资料只用于相应技术知识，不作为原视频作者/具体实现的证据。

## 本次已经写成程序的部分

1. `gaussian-model-r01.js`：确定性 rest 点场。程序化枝干只作为采样坐标来源；最终树皮、叶、苔藓状部分和细丝均为带位置、三轴尺度、方向、颜色、透明度的各向异性高斯。没有用视频平面冒充三维。
2. `gaussian-noise-proof-r01.js`：原生 WebGL2。三维协方差通过相机投影转为屏幕椭圆，片元按高斯函数衰减，alpha 合成。新模块不依赖 Three.js CDN。
3. 保存 rest，不逐帧积累位移。局部 mask × 时间衰减 × 四尺度 curl 场作用于点中心；噪波归零可以回到相同 rest 坐标。
4. 采用局部微分近似更新高斯的方向/尺度，再投影成椭圆，避免仅改变中心而让椭球方向固定。
5. 彩色束是沿 curl 场积分生成的独立效果载体，不是额外树枝。它们不是从原视频扫描资产直接变形得到，必须保留这个区别。
6. 11 秒效果显隐：彩丝 → 卷流退去 → 裸枝 → 绿叶。绿叶是效果时间线，不是植物生理模拟。
7. 可暂停、逐时间查看、旋转、缩放、特写、关位移、关拉伸、调整 mask/频率、点/高斯比较、保存参数。
8. 本机导入常见 Gaussian PLY。支持 ASCII 和 binary_little_endian；默认处理 log scale、sigmoid opacity、wxyz 四元数。方向坐标约定为常见 3DGS Y/Z 翻转到 Y-up，颜色只读取 DC，不支持全部球谐外观。导入用户 PLY 不等于证明它就是原视频资产。
9. 原视频可在浏览器本机选入同步对照；离线交接包包含原视频。没有将用户原视频上传到公开仓库。

## 数学关系与边界

基本点场：`G=(p_rest, q_rest, s_rest, alpha, color, semantic_mask)`。

`Sigma = R(q) diag(s*s) R(q)^T`

`p(t) = p_rest + m(p_rest) a(t) curl(A(p_rest,t))`

`Sigma'(t) ≈ F Sigma F^T`，随后使用透视投影 Jacobian 得到二维椭圆。

本实现的 A 是多尺度三角向量势。其 curl 原场无散度，但加入归一化、局部遮罩或引导项以后不能继续宣称完整变形/轨迹严格无散度。本版本 Jacobian 未包含语义遮罩梯度；它不是守体积或流体物理求解器。末端细丝也不参与树木的真实分枝拓扑。

透明高斯按静止中心的视深排序，视角明显改变时重排；动画变形中的精确每帧排序、SH 高阶颜色、扫描训练、真实遮挡/阴影不是本轮完成项。宽椭圆采用有限像素截断，性能与原片离线渲染不同。

## 性能和运行条件

默认原始程序点场约 32.8 万高斯；桌面最多绘制 24 万，窄视口最多 11 万，采用确定性抽样。真实数量由页面状态和采样代码计算。需要 WebGL2；没有该能力时明确报错，不以截图或原视频假扮运行结果。PLY 文件限制 100 MB，并限制渲染抽样，以免内存暴涨。具体设备帧率不保证，移动视口验证不等于手机实机验证。

## 不破坏旧台的接法

原入口的旧脚本之后追加：

```html
<script src="./gaussian-model-r01.js"></script>
<script src="./gaussian-noise-proof-r01.js"></script>
```

打开原路径 `#gaussian-noise`，或点原工具栏的“高斯噪波老师”。切回其他按钮时隐藏新模块，旧入口/旧脚本继续保留。不得替换 R02/R03，不恢复已被用户否定的乱线算法。

## 验收要看真实结果，不看写死的布尔值

同一 restHash 下：时间改变应改变实际 canvas；amp=0 与 amp=1 的早期效果应有可测像素差；相机改变应有视差但 restHash 不变；7.8 秒到9.6秒应实际出现叶的显隐差异；视口不溢出，按钮可用。必须截图核看形态，不把“页面非黑”“脚本无错”当成与视频相同。

最终视觉判断仍由参考视频对照决定。下一步最能缩小差距的是换入原片 Gaussian PLY 并校准摄影机与局部遮罩，而不是重新改树的生长语法。
