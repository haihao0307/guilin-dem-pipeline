# Universal Human 文档关系学习 → 共同人体皮肤 R02

2026-10-08。继承原皮肤体系，在现有参数人体上增加可验证的皮肤质感关系。不重新造人体，不接管小妈的三教师整合，不以肖像图片或另一套扫描头替代共同模型。

## 证据与使用边界

研读 Chris Jones 的 Universal Human 官方 Skin Shader Documentation、Skin Shader 产品页、Head Textures 产品页、Creating Textures 与 License Agreement。仅阅读公开资料，未取得或读取商业 Skin-Shader.blend 节点图或商业贴图。代码是公开输入/输出关系的独立实时实现，不能标为 Universal Human 原版、官方移植或已达到样片质量。

- 文档：https://sites.google.com/view/universalhuman/documentation/skin-shader-docs
- 着色器：https://sites.google.com/view/universalhuman/products/shaders-textures/skin-shader
- 头部贴图：https://sites.google.com/view/universalhuman/products/shaders-textures/head-textures
- 贴图约定：https://sites.google.com/view/universalhuman/documentation/creating-textures
- 授权：https://sites.google.com/view/universalhuman/license-agreement
- Blender：https://docs.blender.org/manual/en/5.0/render/shader_nodes/shader/principled.html
- Three.js：https://threejs.org/docs/pages/MeshPhysicalMaterial.html

商品将着色器与精绘贴图区分售卖；头部贴图有独立的颜色、粗糙度、位移和皱纹层，样片不是单一着色器的独立效果。许可限制将其资产用于竞争性的角色创建/动画软件，也限制向用户暴露可提取资产。因此本版不购买或复制其商业资产，继续使用已有、保留归属的 R02 扫描片段。以下公式和参数为本实验自己的近似设计，非作者未公开的内部算法。

## 已实现的六组关系

### 颜色分层

按公开 Skin Tone / Base Mix / Albedo Mix 的关系，分开肤色底层、覆盖基底与顶部颜色细节，在线性空间合成。

`base = lerp(authoredTone, chosenBaseColor, baseMix)`

`surface = base * lerp(1, scanColor / scanMean, albedoMix)`

扫描均值归一用于保留微变化，避免重新烘入原人肤色。多尺度色素变化附着在原静止表面，是确定性的艺术字段，不是临床黑色素或血红蛋白测量。明暗、暖冷、扫描混合、基底颜色与覆盖量各自可调。

### 局部遮罩属于当前人体

头部油脂、血色和唇区读取现有 GNM regionId，经共同网格 gnmRecipes 插值，沿皮肤邻接平滑；唇区进一步限定固定参考位置，避免把整个鼻唇区涂成口红。掌侧遮罩由参考手指骨面与表面法线估计，不等于精绘掌纹。

属性附着在原顶点ID上，不新增人体几何，不改位置、索引、骨长、参数或颈部算法。原眼球、牙齿、口内非皮肤部分继续排除。

### 粗糙度与微表面联动

公开文档把粗糙度与程序微位移关联。本版让局部实际粗糙度调节扫描微法线振幅，保留独立的中频与高频控制；油润和覆盖区域适当减弱微结构。

`coupling = lerp(1, clamp((roughness - 0.16)/0.40, 0.2, 1.5), amount)`

这些系数是本版视觉参数。网页使用法线/导数扰动，真实顶点不移动，不能称为 Cycles 几何微位移。

### 区域油脂和覆盖层

继承物理材质的反射与清漆层，区域掩码调节额头、鼻部和下巴的油脂。唇部颜色、光泽、均匀哑光覆盖同时作用于颜色、粗糙度、微结构和局部散射，不仅是涂颜色。

本版不是原产品的六组化妆节点：没有闪粉、金属、泪线或眉毛生成。

### RGB 扩散关系

保留原 R02 漫反射/镜面分离、深度保护和25点RGB扩散核。每个通道独立重采样核宽度后归一化，权重和均为1；“上一版处理”恢复原核。

局部散射尺度通过颜色缓冲alpha传递，皮肤覆盖仍在漫反射缓冲中单独保留，不把镜面高光一起模糊，也不把 Subdermis 当作红色发光层。Cycles 与本平台算法和单位不同，不直接照搬文档0.02/0.01等数值。这是米制模型上的屏幕空间近似，不是 Random Walk。

### 张力区分体型与动作

作者文档明确提醒：比例/形态键会误触发静止张力，手臂张力也不能替代专用面部皱纹。本版只在手和前臂实验性联动微表面，不自动雕刻面部皱纹。

测量边长的 `log(currentLength / currentShapeNeutralLength)`，扣除数值噪声后提取压缩和拉伸。刚性旋转或平移不产生张力。体型或参数来源变化使旧参考失效，只有相关动作及表情回到中性才重新校准；在动作中改变体型时清零张力并提示等待。字段只驱动小幅颜色、粗糙度和微法线变化，血色响应明确为艺术近似，不是血流模拟。

## 不能直接照搬的约定

Creating Textures 页面将 Roughness 输入描述为白色更反光，Three.js 标准 roughness 是0光滑、1粗糙。不能只按输入名称连线。本版不读取商业图，保留自身已知的标准粗糙度约定；未来读取该类图必须标记 gloss/roughness 的反转。

公开文档没有完整内部节点图、色素光谱函数或校准数据，这些保持 Unknown。高频微凸、精绘8K位移与局部颜色、光照及体内光传输共同决定样片；512局部样本不能恢复不存在的全身信息。

## 继承和实现入口

原人体基线：c713eb1353cbf75ca57e1d9a80c6a9d0222d55ee。
原材质预览：8683cee4051ad7a1555fa4cd87921ff102cd0676。
原皮肤源SHA-256：372081965924a65852cc499382a60a6e152acf0dba833f6f70dfe64362228fdb。

assemble.cjs 校验并继承旧 SkinLayer，UHLayer.mjs 只增加材质关系。原 skin-r01、全部 full 教师代码和主入口不改。新入口提供“新分层处理 / 上一版处理 / 原白模”，预设不改变相机、灯光或模型。材质保存与导入独立于人物档案。网页释放时清理新增显示属性。

## 验证和成本

unit.mjs 测试核正性与能量、刚性不变、压缩响应、体型变更失效和中性重校准。qa.cjs 在真实原参数工作台测像素、保存恢复、形态与动作，独立加载上一版以相同尺寸比较材质输出；另运行继承的原平台几何回归。

桌面软件渲染不代表用户显卡或手机实机。本版保留原多通道散射显存开销，增加分区、噪声和变形字段计算。精绘面部、眉毛/眼睛、全身薄部透射和真实几何位移没有完成，不用更换人物或商业资产掩盖缺口。实际通过范围及截图审查见交付后的 VERIFICATION.md。
