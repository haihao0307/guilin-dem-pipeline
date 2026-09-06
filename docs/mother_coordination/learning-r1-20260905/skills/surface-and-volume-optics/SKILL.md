---
name: surface-and-volume-optics
description: 从Adobe PBR与OpenPBR原始文档提炼表面、透射和体积光学差异，接续Coast连续浓烟与未来B24流场观察。
---

# 材质光学、连续浓烟与流场观察

日期：2026-09-06。小妈本轮读取协调分支基线a850741be1d4533595a41d7e4dae12f97a25e9f1。归入既有[函数应用图谱](../../FUNCTION_APPLICATION_MAP.md)的材质、Weather/Cloud和Ocean/Coast职责；同一方法按对象选择，不另建世界框架。只写协调知识并向已核实的Ocean/Coast收件区传递要求，不修改生产源码或原模型。

## 用户本轮决策

深化Adobe Substance 3D Designer PBR，理解玻璃、金属、水以及各类材料的细微差别。Multiscale MIP Fluid的油漆/油质观感可以辨识并拆开研究，不能直接转用为云烟外观。Ocean Mother的Coast需要很浓、有层次、受风影响且真实的烟；本轮排除粒子烟、精灵片堆叠和Niagara生产路线。B24风洞式流场观察记录为后续实验构想，未授权本轮覆盖飞机生产线。

保留既有Coast参考要求：强风、长而浓的烟、三处烟火位于岛的不同方向且避开山顶，至少一处体现风吹向岛体时的交互。实际坐标与当前实现由生产执行者核对。用户推测现烟可能使用粒子，本轮未回读当前Coast运行源码，不能将推测升级为已确认缺陷根因。

## 本轮原始来源与阅读范围

S1 Adobe The PBR Guide Part 1：https://www.adobe.com/learn/substance-3d-designer/web/the-pbr-guide-part-1 。读光与物质、微表面、Fresnel、金属/非金属和线性色彩正文。指南中的水1.33、平板玻璃1.52用于下面的示例计算，不当成所有成分、波长与温度的固定真值。

S2 Adobe The PBR Guide Part 2：https://www.adobe.com/us/learn/substance-3d-designer/web/the-pbr-guide-part-2 。读Metal/Roughness、Specular/Glossiness、粗糙度、覆盖层、法线/高度和校验工具正文。旧指南的具体软件默认值、工作流约定和示例色值有范围，不能当成一切PBR渲染器的绝对规律。

S3 Adobe OpenPBR艺术家指南：https://experienceleague.adobe.com/en/docs/substance-3d/general-knowledge/openpbr/openpbr-overview 。读材质行为、层结构、IOR、方向性、透射、薄壁、制作原则。页面显示2026-07-31更新。该来源不证明我们运行时已实现全部OpenPBR。

S4 OpenPBR Surface规范：https://academysoftwarefoundation.github.io/OpenPBR/ 。读取本轮页面v1.1.1、2026-04-17的混合/分层、元数据、Translucent-base以及实现适配边界。重点核对transmission_depth的公式；没有实现完整BSDF。

S5 Designer PBR Dielectric F0：https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/material-filters/pbr-utilities/pbr-dielectric-f0 。预设包含水、冰、玻璃与Custom IOR，可作为起点。

S6 Designer PBR Metal Reflectance：https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/material-filters/pbr-utilities/pbr-metal-reflectance 。记录纯金属反射颜色预设及对应通道，不能用通用灰色代替所有金属。

S7 Designer PBR BaseColor/Metallic Validate：https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/node-library/material-filters/pbr-utilities/pbr-basecolor-metallic-validate 。读取阈值、热图与工具限制。通过色值阈值不等于材质、形状、运动及视觉通过。S5至S7页面显示2026-05-06更新，不据此升级实际软件。

S8 PBRT 4e Volume Scattering Processes：https://www.pbr-book.org/4ed/Volume_Scattering/Volume_Scattering_Processes 。读吸收、发光、散射与消光。厚黑烟作为吸收示例有明确解释；烟源不同，颜色和散射属性需分别设置。

S9 PBRT 4e Transmittance：https://www.pbr-book.org/4ed/Volume_Scattering/Transmittance 。读光学厚度、沿程积分、分段乘法及均匀介质Beer定律。

S10 NVIDIA GPU Gems 3 Chapter 30：https://developer.nvidia.com/gpugems/gpugems3/part-v-physics-simulation/chapter-30-real-time-simulation-and-rendering-3d-fluids 。读三维网格、输运、气体/液体区别、障碍法向边界、体积渲染和性能策略。属于历史技术章节，其硬件性能不作为本项目结果。

S11 SideFX Pyro背景：https://www.sidefx.com/docs/houdini/pyro/background.html 。读速度、密度、温度和燃烧相关场的独立职责及推进。本轮未运行Houdini。

S12 Epic Niagara Fluids Reference：https://dev.epicgames.com/documentation/en-us/unreal-engine/niagara-fluids-reference-in-unreal-engine 。只为核对术语与成本读取：Niagara也提供网格气体/液体模拟，三维成本高于二维的说明不能解释成所有粒子一定更昂贵。本项目仍排除该生产路线，不安装或试用。

S13 NASA CFD Verification and Validation：https://www.grc.nasa.gov/WWW/wind/valid/tutorial/overview.html 。读数学实现核查、物理验证、网格收敛与误差、Mach/Reynolds和边界层等范围。只支持未来风洞的证据分级，未进行飞机气动求解。

此前会话已经读取用户的两个MIP Fluid链接。本轮不重新冒称完成其运行复测。此前记录的二维反馈计算、显示颜色/高光与流体状态分离、近似压强和许可边界继续保留。

## 共同材质记录：共享函数，分别保存物质属性

建议现有实例补充可追溯的materialId、配方版本、成分/状态、参考坐标、单位、来源和校准范围。随后分别记录表面响应、内部介质与动力学字段。表面含反射/透射、粗糙度、前向/切线、层厚与覆盖；介质含吸收sigma_a、散射sigma_s、相位方向和发光；动力学含本对象实际需要的密度、黏度、速度、温度、边界与历史。每项按职责提供，避免为每种物体分配整套无用字段。

黏度改变怎样流动，粗糙度改变表面反射的方向分布；折射率改变界面响应，光学浓度决定沿途消光。不能把一个“质感强度”旋钮同时控制这些不同量。程序化函数可输出所需参数，学习Designer不要求导入照片、贴图包、外部模型或整套软件。

颜色、几何缺口、粗糙度、法线和光学厚度分别生成。相关现象通过有含义的字段共享原因，例如同一沉积区可同时改变层厚和反射配方；不复制同一灰度到所有通道。颜色输入明确线性色域和编码，粗糙度/金属度/法线等数据不做颜色伽马解码，输出显示变换与曝光单独处理。[S1至S4]

## 各材料需要保留的差别

玻璃：保留真实厚度或明确薄壁近似、前后界面、IOR、折射、吸收距离、表面粗糙度和污迹。降低opacity无法替代透射/折射。普通透明玻璃可很少散射；磨砂表面的粗糙透射与内部浑浊分开控制。[S3、S4]

金属：裸金属主要由导体反射与微表面决定，传统Metal/Roughness中baseColor编码金属反射颜色。铝、铜、铁等分别采用正确来源；拉丝方向需切线和各向异性。表面不透明油漆、厚污垢或腐蚀物使用自己的介电响应；透明罩光或油膜需要分层与透过关系。横向斑块混合与纵向叠层不同，不能把裸金属、油漆和清漆高光不加能量约束直接相加。[S2、S3、S4、S6]

水：界面光学与透明玻璃可以共享一部分函数，水面的几何、波动与边界仍按液体处理。清水不能用固定蓝色opaque表面替代；入射方向、表面法线、穿过水的距离、底部、吸收与悬浮成分共同影响外观。泡沫需要另外的气泡/散射近似，不能借金属度变亮。浑浊和表面粗糙也须分开。[S1、S3、S8]

油/油漆：油可能有较低散射与有色吸收，油漆的颜料通常有不同散射，透明罩层还改变基底反射。截图看起来油亮只构成显示线索；由光滑表面高光产生的视觉不能反推出黏度或真实油的成分。具体配方以参照为准。[S3、S4；后两句为本团队证据边界]

云、烟与火：烟雾运动可以用气体速度场与浓度/温度推进，体积光学再表达吸光和散光；白亮云团、灰烟和吸收强的黑烟不能共享同一组光学系数。火焰有额外发光与燃烧状态；改烟的颜色为橙色并加泛光不足以建立燃烧因果。普通雾烟的整体轮廓不套油漆式GGX表面高光。[S8、S10、S11]

## 深读后保留的三个反例

1. 粗糙度、微法线与高度不能互相随意替代。法线改变着色方向，几何高度才可能改变轮廓与接触。反射微表面分布改变时，不能靠增加照明来伪装粗糙度正确。[S1、S2]

2. 旧Metal/Roughness示例中常见的非金属F0=0.04是特定模型默认值。用S1示例IOR以及空气n=1，F0=((n-1)/(n+1))^2，水约2.006%，平板玻璃约4.258%。还要区分水到玻璃与空气到玻璃的界面，不能只保存一边的IOR。这是简化无吸收平界面算例，非完整材质验证。[S1、S4]

3. S3中Transmission Depth有一句会令读者理解为“增大参考深度让同样厚的物体更密更暗”，与S4公式方向不一致。固定颜色T_ref、固定光程L、无散射修正且参考深度d>0时，sigma_t=-ln(T_ref)/d，T(L)=T_ref^(L/d)；增大d会减少这一吸收。深度为零在OpenPBR有专门非物理着色约定，不能拿零代入除法。已经以S4原始规范与独立算例核对，不抄录存在歧义的文字。[S3、S4]

## Coast浓烟：本轮明确的候选路线

选连续三维速度场u、非负烟尘浓度c、温度T和必要压强/障碍数据，显式推进；渲染沿同一密度场查询消光和光照。这里的网格缓冲保存数值；它与照片/序列贴图不同，但不自动解除目标线对texture对象、LOD或表示方式的约束。若目标线有更严格禁令，执行者先选择兼容数值存储并记录，不偷偷换规则。

浓烟目标拆成：烟腹有遮挡厚度，外缘有可透光的不规则卷曲，尾部连续被侧风带走，内部有光照层次。提高浓度不代表把颜色一律涂黑，也不通过油亮高光伪装体积。sigma_t(x)=sigma_a(x)+sigma_s(x)，沿视线T=exp(-integral sigma_t ds)。积分步长变化时保持物理长度单位，避免提高样本数反而把烟变浓。光学厚度3和5时束透射约为5%和0.67%，仅为算例，不作为尚未看过实际场景的固定美术参数。[S8、S9]

世界风场只读共享；局部热浮升、卷曲与地形边界在本烟区处理。碰到海岛时，速度求解的固体边界至少应约束法向穿透，不能仅把山内可见烟裁掉。计算域流出边界需显式定义；不沿用二维演示的周期回绕，使烟从另一侧重现。[S10；具体接入为设计建议]

第一步保留一处已有烟源、固定相机/风/灯光，从同一状态对照浓度和光学层次；随后检查三股烟、长尾和绕岛。关闭火焰、颜色强化和泛光时也要能看清密度结构。需要报告当前源码中真实烟表示，不能只更换版本号或标题为“流体”。本轮未实施这一步。

资源预算：仅在需要烟的有限区域计算，世界其他地方读取较便宜的公共风；候选让粗尺度求解承担主运动，再增加受输运约束的细节。射线限制在实际烟域，可研究空区跳过和透射极低时的提前终止，并分别检查对亮火、后方光源及边缘的误差。避免逐帧全量CPU/GPU往返。是否更快由同设备、同视角和同等质量的GPU时间、显存及整帧数据确认。[S10；策略选择为本团队候选]

新路线不自动保证更省资源。仅一个float32标量场的两份N立方缓冲，在64、128、256网格边长时逻辑存储就分别为2、16、128 MiB；速度、压强、障碍、温度、临时缓冲和分配对齐另加。每轴分辨率翻倍，体素数量增至8倍。[独立算术，见probe.py]

术语记录：Niagara也具有网格流体功能。[S12] 用户本次明确排除Niagara和粒子烟实现，生产路线照此执行；不宣传“所有流体都比所有粒子便宜”。

## B24风洞式观察：后续研究构想

从现有权威机模只读生成单独的计算障碍表示，保持原几何/UV/动画。候选先固定飞机，在受控来流下使用被动示踪浓度与截面速度显示流动；从同一求解场派生显示，不预画绕翼曲线来冒充模拟。示踪用于看见空气运动，其浓度不默认给风场增加热浮力。

观察项包括来流方向变化、机身和机翼绕流、局部后方流动，以及将来单独研究的螺旋桨滑流。求解用代理几何的分辨率和误差必须标出。低成本自由滑移/粗网格仅能作限定的定性探索，不能自动恢复真实边界层、分离、翼尖涡或升阻力。流线是某时刻方向场的曲线，非定常情况下与随时间前进的轨迹分开。

以后分级为“可视化示意、数值求解核查、与实验相符的验证”。需要后一级结论时，单独定义几何、来流、尺度、Mach/Reynolds、边界和收敛检查，并与可信实验比较。[S13] 本轮只记录构想，没有模拟飞机、发布工作台或发出B24改模/气动优化任务。

## 实际检查及采用状态

probe.py已在Python 3.13.5执行，15项标量光学和存储算术检查通过，结果见PROBE_RESULTS.json。覆盖界面IOR、分段透射、浓度、采样步长、米/厘米一致性、参考深度方向和三维存储。无渲染器、着色器积分、流体求解、GPU分配或实机性能测试，不能把数字检查算作烟已变真、PBR已复现或风洞已验证。

采用前在相同几何与中性光、侧逆光、明暗背景下分别检查各材质；再放回Coast实际光照。材质参数、形态、场推进和最终观感分别验收。学习不代表掌握全部Designer，本轮未打开Adobe软件或安装新依赖。

source_reading=completed_for_listed_sections；scalar_probe=passed；productionIntegration=false；browserGPU=not_run；visualAcceptance=false；productionReady=false。消息发布、对方实际阅读和生产实施分开；本轮向guilin-dem-pipeline #61传递Ocean/Coast要求，发送结果另记DELIVERY.json。不启动Make、不唤醒其他会话、不整支合入生产。
