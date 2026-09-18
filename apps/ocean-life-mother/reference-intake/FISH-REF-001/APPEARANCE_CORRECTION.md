# FISH-REF-001 外观转换纠偏记录

日期：2026-09-18。范围：用户给定参考的读取、观察、材质采样与转换门禁。本轮不新增猜测鱼形、不替换 Ocean Life 运行时，不把源模型截图冒充原生生成结果。

## 用户生产约束

所有鱼类精细形态参考由用户供应。Ocean Life Mother 负责按已有靠谱体系提取、约束和转换形态、外观、骨架与动作；不另猜一种鱼，不反复造轮子。参考源与原生输出分开。生产载荷不直接携带来源网格、原模型文件、原贴图文件或完整源蒙皮/关键帧。压缩或改后缀本身不等于语义蒸馏。

## 已核实的直接原因

已检查 R01 工程包内 src/fish-native.js。buildBind 使用手填 stations、33 个截面和20个环向样本生成通用梭形鱼。颜色由 belly、stripe 与 detail 函数和常量生成，眼睛、嘴缝、鳃盖线也由手写简化部件组成。该路径没有读取 FISH-REF-001 的颜色、透明度、粗糙度、法线或自发光图，没有完成源表面到原生载体的形态对应与外观拟合。

所以当前粗糙外观不是一次高保真转换后的不可避免损失，而是形态和外观转换根本没有完成。此前运动/碰撞研究不能被当成物种形态或材质蒸馏成果。原生候选A继续只算通用测试体，不得借 FISH-REF-001 的身份晋级。

## 本次实际读取的源资产

文件：model_67a_-_largemouth_bass.glb。
SHA256：c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64。
总字节数：18,644,040。
文件内标题：Model 67A - Largemouth Bass。
作者：DigitalLife3D。
来源：https://sketchfab.com/3d-models/model-67a-largemouth-bass-e60c457636b640629747c19feac4906c 。
内嵌许可：CC-BY-NC-4.0。记录转换不等于商业清权。

身体网格8556顶点/15904三角形，眼部130顶点/224三角形。33个源蒙皮关节，Swim Cycle 动画74个通道。仅作为源文件结构事实，不等于真实解剖测量。

四张嵌入图像已经解码并逐项核对：

| 源索引 | 实际绑定 | 尺寸 | 文件字节数 |
|---|---|---|---|
| 0 | baseColorTexture：颜色与透明度 | 4096×4096 RGBA PNG | 9,820,274 |
| 1 | metallicRoughnessTexture：粗糙度/金属度 | 4096×4096 调色板PNG | 2,119,778 |
| 2 | emissiveTexture：作者自发光通道 | 2048×2048 RGB JPEG | 130,457 |
| 3 | normalTexture：切线空间法线 | 4096×4096 RGB PNG | 5,625,100 |

四张图的嵌入编码字节合计占原GLB的94.912953415676%。文件体积主要在外观图像，不能把删除外观误称为高效蒸馏。该比例不是显存占用或压缩率预测。

材料 alphaMode=BLEND，metallicFactor=0，KHR_materials_specular.specularFactor=0.42124199697207376。没有指定 occlusionTexture。存在 emissiveTexture 不证明鱼有生物发光能力，也不能把它误标为AO或擅自丢弃。

## 实际看见的内容

本轮已用原源几何和原UV在隔离观察阶段重建两侧带颜色/透明度的静态检查图，并实际检查。可见深橄榄色背部、浅色腹部、侧身不规则暗带、密集鳞片、鳍条、眼部、鳃盖和口颌。该检查使用原模型，不是新的KAOPU鱼；不加入生产运行时，也不冒充源作者的原始灯光场景。未由截图宣称完整PBR或动画复现已验收。

## 已完成的读取与测量代码

隔离脚本 capture_material_observations.py 验证GLB长度、分块和访问器边界，正确解码调色板PNG，使用源UV进行确定性的表面积加权采样。身体32768点、眼部2048点，共34816点。分别记录源局部坐标、源表面法线、颜色/透明度、粗糙度、金属度、切线法线与自发光量。源UV仅用于研究证据。

颜色与自发光按sRGB解码后插值；alpha、粗糙度、金属度和法线数据保持线性语义；粗糙度读取G通道、金属度读取B通道并应用源因子。调色板PNG先恢复颜色值，不能把索引值当粗糙度。参考：Khronos glTF2.0规范 https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html 。

本地已执行11项检查：源哈希、四图解码、调色板解码、采样器假设、线性数据通道与sRGB区分、sRGB已知值、有限采样值、法线归一化、不导出原拓扑/完整蒙皮轨迹、重复采样一致、截断GLB拒绝；全部通过。检查范围只覆盖当前源文件和隔离采样器，不覆盖其他模型或最终视觉质量。

采样输出为研究观察数据，不改成 .kaopu 后缀冒充最终资产；这些样本不是34816个新模型顶点。本轮仍没有完成原生外观函数或源形态约束重建。离线观察完整不等于蒸馏完成。

## 小妈已读取依据与具体采用

1. coordination/kaopu-xiaoma-handoff-r32-20260911 分支的 docs/mother_coordination/KNOWLEDGE_START_HERE.md。
2. 同分支 docs/mother_coordination/learning-r1-20260905/DISTILLATION_CORE.md：共用规则、版本、身份和输入；先主形与作用关系；体积核算包括核心、参数、必要观测/修正、状态和依赖。该文件明确是设计草案，不能宣称有现成且已验收的鱼类自动转换器。
3. handoff/kaopu-world-chorus-full-v1.0-20260909 分支的 docs/mother_coordination/handoffs/kaopu-world-chorus-full-v1.0-20260909/03_ARCHITECTURE.md：StableLowFrequency + LocalCorrections + EventDeltas + RequiredResiduals；无法从规则推导的真实差异必须保留必要残差；禁止用默认网格代替Unknown。

本次是读取已有文档，不是已经与另一位AI召开会议或取得回复。待核问题：本地曲面坐标转换中的退化退出规则；形态对应误差预算；颜色/法线/粗糙度/透明残差的既有编码和Reader兼容要求。未擅自宣布新的通用KAOPU文件标准。

## 下一道唯一生产门

先以这条源鱼为基准建立原表面到本体系的可验证对应，保住头口、体侧轮廓、尾柄、鳍缘和眼鳃位置；再表达源约束的色区、鳞片/鳍条结构与必要非规则残差，保持多材质通道独立。对照必须使用同机位、同尺度和相同照明设置，分别检查近景头部、两侧、背腹、鱼鳍透明、静止与运动。不能仅在错误通用鱼体上贴上更花的颜色就算完成。

不为追求预设KB数先砍掉这些特征。不保证任意源资产都能无损压到任意小体积。原数据只在学习/验证阶段使用；最终输出规则、参数、必要残差及证据关系，具体编码继承现有体系并接受兼容检查。

吞拿鱼：用户已明确说曾提供，保持“已提供、原件待定位”，本次File Library及既有上下文检索仍未定位可读二进制；不是让用户重新寻找，不虚报为已蒸馏，也不拿通用鱼改色替代。

状态：sourceVisualInspection=true；materialIntake=true；nativeShapeReconstruction=false；nativeAppearanceReconstruction=false；visualAcceptance=false；gameIntegrationAcceptance=false；productionReady=false；commercialClearance=false。旧工作台与Game Mother未因本次审查被替换。
