---
name: ocean-function-source-review
description: 从三份真实海洋源码中区分函数配方、频谱合成、显示细节和近岸状态，保留输入坐标与可复现边界。
---

# 小妈海洋函数体系：三份源码核读

日期：2026-09-06。当前处于用户指定的讨论与学习阶段。本轮只新增协调知识和隔离CPU检查，没有替换Ocean Mother生产代码、改动DEM或批准状态，没有启动其他会话、网站生成服务或自动化。

## 固定来源与读取范围

A. dli/waves，固定提交1313f464c2df7d1c69852577248b58fa29074c38。
https://github.com/dli/waves/blob/1313f464c2df7d1c69852577248b58fa29074c38/simulation.js
本轮读取目录及simulation.js中的初始频谱、相位推进、频谱演化、Stockham GPU变换、位移、法线、渲染、GPU缓冲和初始随机相位部分；未运行浏览器，不声称全面审计全部交互代码。

B. Seth-arc/3D-Ocean，固定提交b09db1611b439ea7fa765b5d4e3dfd640f559121。
https://github.com/Seth-arc/3D-Ocean/blob/b09db1611b439ea7fa765b5d4e3dfd640f559121/simulation.html
读取import map、场景、水面、着色器替换、循环、波纹事件和参数监听；另通过公开仓库README核对作者宣称。对照其依赖的Three.js r158官方Water.js顶点程序：
https://github.com/mrdoob/three.js/blob/r158/examples/jsm/objects/Water.js
未运行页面，未核实该页面在任何设备的视觉表现和性能。

C. baditaflorin/threejs-water-free，固定提交4a2dd82ed4391395553ca1e1c0a39ead0020ae88。
https://baditaflorin.github.io/threejs-water-free/
实际读取主页与仓库树，并深入以下固定源码：src/core/ocean.js、cascade.js、spectrum.js、src/material/waterMaterial.js、src/physics/buoyancy.js、src/presets.js前128行。docs/lib与src在本轮树记录中指向相同tree，不由此推定公网运行时已核验。
https://github.com/baditaflorin/threejs-water-free/tree/4a2dd82ed4391395553ca1e1c0a39ead0020ae88/src
未运行其FFT代码、Three.js、WebGPU或页面，不判断其全部功能正确与否。

补充原始参考：NVIDIA GPU Gems第1章正文中波分量、几何/表面细节、Gerstner横向位移及采样限制的说明。
https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models
p5.js noiseDetail官方说明用于区分噪声octave与功能分层：
https://p5js.org/reference/p5/noiseDetail/
截图关联OpenProcessing 992700仍未取得完整作品源码。不能从截断的noise调用或宣传段落确认八层独立实现，截图的60FPS也未实测。

本地批量取公开源文件的尝试因DNS失败，没有取得本地完整仓库；以上源码内容来自已成功的GitHub连接读取。未执行任何第三方下载脚本。

## 结论一：函数和参数可以成为海面主表达

A以风与尺度等参数构造频谱，按时间推进相位，再用GPU FFT生成位移与法线。它的主海面没有以粒子位置列表为核心。相关GPU数据由运行时计算，并不要求离线保存整片海逐帧顶点。

C使用带固定种子的随机发生器和高斯采样构造JONSWAP方向频谱，用时间直接求每个频率的相位，再做逆变换。presets中常见结构是两个FFT尺度加若干解析Gerstner涌浪；material层又叠加fBm细纹、域扭曲泡沫图案、反射折射和深度相关表现。它提供了分层函数体系的具体参考，不能称为已经证实的八层柏林噪声。

随机过程可以用规则和种子定义；FFT是批量合成频率分量的计算方法。两者可以组合，不需要对立。需要区分固定种子生成的合成海况与复原某次真实海洋观测。

## 结论二：从源码看各自价值与缺口

A优先学习主波面求值链和GPU计算组织。初始相位实际来自Math.random，当前原实现没有可传入的固定种子接口；要按同一配方复原，需增加受控随机初始化或保存相位身份。波形中使用了纵向和横向位移，法线根据位移后邻域构造。已读部分没有完整岸线、浮力、泡沫历史和飞溅系统，不能当整套海岸成品。

A另有一处应复核的表达差异：初始频谱omega函数使用square(k/KM)，相位程序使用k*k/KM*KM。后者按通常运算顺序不等于前者；重复出现的同名函数也不能直接认定语义一致。本轮只做了代数对照，没有确认作者意图或观察GPU故障。保留原文件，接入前重新核对所用模型与单位。

B的核心依赖Three.js Water及外部waternormals.jpg，PlaneGeometry只传宽高。它更适合作水面外观、天空和交互界面参考。Wave Speed事件仅更新显示文字，animate仍直接给time赋elapsedTime，没有使用滑条值；Wave Height写size，Wave Length和Surface Detail共同改distortionScale，界面名称不能直接视为真实波谱参数。

B的位移替换目标字符串在其固定r158依赖的顶点程序中不存在。源依赖使用mirrorCoord及position进行投影，B寻找含transformed的另一条语句。这次静态字符串比对说明拟插入的高度调用未由该replace落入目标位置；未执行页面，不能据此声称已经看到实际故障。该项目需要先做依赖与控制生效检查，不直接作为主海面基线。

C的模块划分最适合当前学习。需要同时保留以下约束：

1. FFT在CPU中计算，再逐帧上传Float32位移与坡度纹理；WebGPU/TSL负责渲染链。不能把网站WebGPU宣传解释为整个模拟都在GPU上运行，也未测移动端成本。
2. getHeight明确忽略横向位移的逆映射。渲染和查询共享场，但世界坐标查询仍是近似，不能声称任何位置都严格贴合同一曲面。
3. Buoyancy模块是多点取样后调整位置和姿态的轻量运动学跟随，不含完整的受力、质量和刚体动力学。
4. cascade中的泡沫值每次由当前Jacobian重写，未保存上次泡沫历史。材料层叠加噪声和深度带形成外观，不等于已完成漂移、消散和生成事件的状态演化。
5. 近岸白边来自屏幕深度及动画调制，不能凭白边判定绕岛折射、反射、浪冲上滩和退水已求解。固定均匀水深参数也不能独自代表变化的海床。
6. 已读水材质还存在反向smoothstep边界表达，应按此前generated-shader-review技能在目标后端核对；本轮未据此确认GPU不兼容。

本次学习建议顺序为C的模块结构、A的频谱及GPU求值、B的呈现与交互参考。这个顺序只评价本轮研究相关性，没有将任何仓库评为生产已通过。外部代码真正复用前仍需读取各自许可并保留要求，不能只凭公开可读认定可无条件复制。

## 候选八项职责

为了落实用户的分层方向，可以暂分：海况参数与种子、长涌浪、风浪频带、短波/表面细节、破碎源判定、泡沫状态、近岸/障碍关系、光学显示。这是小妈提出的可调整接口划分，未声称任何原作品恰好使用这八项。

统一查询接口候选：sampleSurface(worldX, worldZ, absoluteTime, recipeVersion)，返回曲面位置、法线、速度及查询是否近似。泡沫/事件有历史依赖时，另传事件日志或检查点及时间推进合同。波面、显示、碰撞、浮力和岸线要共享单位、坐标与版本，不能各自实现互不一致的海洋。

形状生成可采用频谱和解析波，噪声继续参与随机初始化、局部扰动和材质细节。先验证主浪几何和采样一致性，再验证岸线与泡沫，不以添加层数本身衡量真实度。

## 存储、计算与确定性

小配方不等于零运行数据。需要区分分发的源码/参数、重建后的工作数组与网格、GPU纹理和临时状态。C的两个128x128尺度仅位移与坡度这四份RGBA Float32输出数组合计1,048,576字节，尚未计初始谱、FFT缓冲、GPU副本、帧缓冲和几何。这是数组类型的计算，不是实测总内存。

为了相同输入重复生成，记录生成器版本、种子及随机序列消费规则、单位、尺度、频带截断、时间原点和数值环境。改变分辨率可能改变采样集合、随机序列及归一化；不能保证只改显示精度后海面身份自动保持。跨CPU/GPU数值允许范围需实测，不能承诺所有设备逐位相同。

对于温州真实地区，合成海况的可复现性不能推出几个坐标能恢复任意历史高程。原有DEM真值、AOI、哈希与禁止项不因本次讨论改变。

## 本轮实际CPU反例

源码为同目录ocean_contract_probe.py，Python3.13.5标准库执行，未运行三个原项目。

用一条不折叠的一维Gerstner截面：振幅0.8米、波长8米、陡度系数0.7、相位0.17。它同时产生横向位移和高度。对33个世界位置、3个时刻共99组查询，先反求原参数坐标再取高度，逆映射残差全部小于1e-12。直接把世界位置当参数位置的近似路线，在这组自建样本中的最大高度差为0.34470018810477404米。把横向位移关闭后，两个查询结果一致。

该差值仅属于自建算例，不是C项目预设的实测误差。它说明共享同一个函数仍需统一输入空间。多波叠加、二维逆映射、折叠与真实船体尚未测试。

同一配方JSON往返后，再查询相同绝对时刻，99项结果在当前Python环境逐值相同；中途查询另一个时刻不影响结果。这只证明这个无历史解析算例可复现，不证明风场演变、泡沫或真实状态可以跳过历史。

A的两个omega写法也做了独立代数比较。在假设相同g、KM和k=2*pi/波长的条件下，选取波长100、10、1，后者/前者分别约1.00197、1.18101、6.36135。只证明表达不同，没有据此完成物理模型或原GPU执行验证。

阈值1e-12只用于CPU双精度算例，不是工程标准、海岸精度或GPU要求。

## 当前状态与最短验证

source_reading=listed_scope_complete；cpu_counterexample=executed；original_demos_run=false；actual_fps=unknown；visual_comparison=not_run；production_adoption=false；other_mother_acknowledgements_to_this_card=not_checked。

建议最短实验为隔离的一小块海面和一个简单岸边对象：固定版本/种子，检查同一时刻回放、共同位置的显示与高度查询、相机移动后的场稳定性、两个不同帧率的时间一致性、泡沫停止生成后的状态，以及岸边遮罩和真实运动的区别。几何、平台与LOD约束先读取Ocean本线当前合同；不自动将外部库的跟随相机或LOD路线移植进本项目。此处是建议，尚未执行，也未向生产线发替换指令。
