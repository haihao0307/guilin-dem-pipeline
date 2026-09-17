# Noise N01 — 造波生产接入与侵蚀学习
日期：2026-09-17

## 授权与实际状态
用户明确批准基础噪声、细胞噪声、多尺度组合、domain warp、连续/可平铺噪声进入靠谱生产体系，不再只停留为外部参考。本文件是生产方法登记与接入说明；并未宣称已替换各Mother运行代码。允许采用不等于设备验收、真实机理证实或用户视觉接受。
照片重建/COLMAP/Open3D退出本轮学习；外部海浪频谱项目不采用。此决定不删除既有Ocean、不暂停飞轮、不改变排程或冻结真值。Shader继续学习；LYGIA代码须遵守其实际许可，不因方法授权自动获得商业许可。

## 与当前最好成果接续
已读根AGENTS、PRODUCTION_CONTRACT、PUBLIC_WEB_DELIVERY_GATE、00_START_HERE、Y04。保留Canonical数值、固定形体与既有生产分工。
Y04说明当前限幅保留约3.75%位移平方能量且可能掩盖接缝问题。新增噪声不可继续被同一限幅吞掉后称“效果完成”；检查限幅前后分布、轮廓与接缝。不要重新从旧模型开工。

## 乐器分工（生产方法已获用户许可；各线实现未核实）
| 模块 | 作用 | 可服务现有任务 | 关键限制 |
|---|---|---|---|
| Perlin/OpenSimplex | 连贯标量变化 | Landscape岩土、Brick/Tiles表面 | 输出不是测量或地质因果；种子、坐标、单位稳定 |
| Cellular | 颗粒、分区、距离场 | 岩石颗粒、泥土团块、表面区域 | CellValue可能跳变；距离连续不等于梯度处处光滑；不自动生成真实裂缝或可耕田 |
| 多尺度组合 | 大小细节分工 | Microscope既有尺度层 | 不强制17层、不强制零均值；幅度/频率/导数及采样共同预算 |
| Domain warp | 改变取样坐标 | 弯曲、扭动与不规则组织 | 不是侵蚀状态律；实际形体须显式位移，法线/碰撞共同更新 |
| psrdnoise | 周期与连续动画、解析梯度 | 周期场与有条件的动态细节 | 平铺须核实际周期与组合；动画不代表物质守恒 |
| 模块化Shader | 小函数按需组合 | 各线现有材质 | 几何、状态、光学、显示色分开；许可与GLSL/WGSL实现分别核 |

来源：
https://github.com/Auburn/FastNoiseLite/wiki/Documentation
https://github.com/stegu/psrdnoise
https://raw.githubusercontent.com/stegu/psrdnoise/main/src/psrdnoise2.glsl
https://github.com/patriciogonzalezvivo/lygia/blob/main/DESIGN.md
https://github.com/patriciogonzalezvivo/lygia#license

## Warp的具体知识
q(p)=p+a*w(p)，h(p)=n(q(p))。在可微域，grad_p(h)=(I+a*Dw)^T grad_q(n)。漏掉warp的导数会让着色法线不匹配实际形态。没有可逆性证明时不能把warp当材料身份映射。固定点p的函数值不应依赖顶点编号。
基础噪声与warp分别配置，避免共享实例设置意外改变噪声核。尺度记录重排与逐级warp复合顺序不是一回事；复合算子通常不可交换。

## 新侵蚀候选：先学两份，不继续扩清单
1. https://github.com/dandrino/terrain-erosion-3-ways （MIT）
已读README、domain_warping.py、simulation.py。仓库比较扰动/脊状外观与侵蚀过程；其模拟明确自称semi-physically-based。domain_warping.py构造两个偏移分量后重新采样；simulation.py保存terrain/water/sediment/velocity，反复降雨、计算输运、侵蚀沉积、蒸发。
吸收：区分静态外观算子与有历史的状态演化；水土状态不能藏在颜色里。
限制：二维高度场不表达悬挑与洞穴，不足以独立处理喀斯特溶蚀洞穴。最后normalize改变绝对高程范围，禁止用于覆写冻结DEM。apply_slippage只对选中陡坡应用Gaussian平滑，没有质量守恒证明；不能把示例直接当水土守恒生产求解器。
2. https://github.com/SebLague/Hydraulic-Erosion （MIT，Unity项目）
已核README和作者给出的演示入口，尚未复现。学习水滴侵蚀/沉积的有限过程，不搬整个Unity工程进Three.js。
演示：https://sebastian.itch.io/hydraulic-erosion
两项目只是侵蚀学习候选；其结果不构成具体岛屿/河床的真实历史。

## 下一项可验证接入
责任小妈：先在既有获准小样上整理同域的基础噪声→warp→细胞混合接口及单独开关，不增加生产目标。
Landscape：沿当前对象检查固定坐标/顶点重排、真实轮廓、限幅前后差异、法线和碰撞。冻结DEM只读；合成细节明确区分。
Brick/Tiles：只在已有授权表面范围使用颗粒/warp，保留尺度、搭接及固定部件；不能只换色声称改变形体。
Farmland：可用噪声表现土表细节，田块连通、田埂边界和水量关系仍由现有拓扑/状态决定。
上述是共享知识职责映射，不是已发送、已收到或已采用的证明。本轮未召集/广播Mother。

## 验证与限制
本轮是源代码审读与方法登记。侵蚀存在有限数学反例见PROBES/noise_n01_erosion_counterexample.json；不是完整项目运行。
实际噪声接入渲染、各Mother代码消费、GPU/iPhone性能、用户视觉验收仍待执行，不虚报已完成。
