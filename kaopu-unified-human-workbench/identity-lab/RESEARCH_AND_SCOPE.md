# ET13：身份语义参数与皮肤特征

## 基线与结合方式

继承已交付的 ET12-F1.1 固定构建 `02f596def9d07ebfc187e1eb18ad345a57c8a6b6`（文档头 `d951f601d10400c7ffa9fa3f885f651ba155445a`）。原生总台资产与R05入口固定在 `0b4703359efbae10ffc6c0e5fe3fc081e7eca4fe`。本次新代码位于 `identity-lab/`，不覆盖原控制网格、原GNM/Anny/MHR、原ET11/ET12模块、原入口或旧档案。

`Catalogue.mjs` 将中文五官语义映射到现有 Anny localChanges；每个键都向现有目录验证。左右可联动或单独写入，直接修改原生状态，不维护一份与原生参数打架的第二套形态向量。原生头形来源未激活时明确拒绝，不偷偷切换骨架或来源。

`IdentityModel.mjs` 在既有生成链后增加小幅鼻梁局部高度与睑褶外观修正，保护身体和控制索引。鼻梁数值为模型中的局部设计幅度，不是临床测量。单眼皮/双眼皮和三角眼/桃花眼是可编辑外观倾向，不是严格解剖分类；真实睑板、脂肪、提肌和动态卷入并未据此全部重建。

`TraitMaps.mjs` 与 `FieldRaster.mjs` 构造可复现的色素、泛红、浅色疤痕、正负高度与粗糙度字段。雀斑密度/大小/分布，痘点及痘印，分区皱纹，位置/长度/角度/宽度/深浅可调的疤痕与痣，都固定于原生静息坐标。改变脸型和表情不会重新随机撒点。

`IdentitySkin.mjs` 在同一原材质实例上组合字段；原肤色、唇色与原光照保留。可定位色斑是明确的身份层，不等于泛用随机色差；原“皮肤细节”仍控制新微表面法线。新增高度是微表面法线扰动，不改变轮廓或投影阴影。真实隆起疤痕/大型痘疱的实体体积尚未实现，不以纹理冒称拓扑几何。

档案新增 `faceIdentity`，保存版本、拓扑指纹、随机种子、全部皮肤与补充几何参数；原生五官参数仍在原 `state.anny.localChanges` 中。旧档案没有本扩展时默认关闭新增皮肤与补形。批量身份输出保存可重建的原生档案和真实网格哈希，非静态换头。

## 本轮查阅的一手老师与实际使用边界

### Google GNM（2026）

https://github.com/google/GNM/blob/main/gnm/shape/README.md

保留现有253身份/383表情和眼球/牙齿/舌头的原生模型；没有把PCA序号改名假装为独立“鼻梁高度”。本轮新增命名控制优先使用现有Anny语义及总台已验证的共同头形映射。

### NAVER Anny 与 MakeHuman/MPFB

https://github.com/naver/anny
https://static.makehumancommunity.org/mpfb/docs/assets/concept_targets.html

真实复用既有模型的 localChanges 及其语义形态基底，固定索引、原native state和组合管线不变。没有升级原生库/骨架版本，没有重新下载替换SOMA/SMPL-X资产。Anny代码Apache-2.0；上游MakeHuman数据按现有项目声明保留CC0。来源范围以实际锁定的总台资产为准。

### Disney：Graph-Based Synthesis for Skin Micro Wrinkles（2023）

https://studios.disneyresearch.com/2023/07/03/graph-based-synthesis-for-skin-micro-wrinkles/

学习“可控空间结构→位移字段→微表面”的分层。这里实现的是原创可调曲线场，不是该论文图优化器的移植；没有声称生成数百万根物理仿真皱纹。

### Disney：Stylize My Wrinkles 与 Fast Dynamic Facial Wrinkles（2024）

https://studios.disneyresearch.com/2024/06/07/stylize-my-wrinkles-bridging-the-gap-from-simulation-to-reality/
https://studios.disneyresearch.com/2024/04/26/fast-dynamic-facial-wrinkles/

学习把可控结构与扫描微频分开，继续叠加ET12已有扫描频段。动态按应力方向调宽深、风格迁移网络与压缩守恒尚未接入，不把固定坐标说成皮肤面积或毛孔密度守恒。

### Meta BioSkin（EGSR 2023）

https://github.com/facebookresearch/BioSkin

学习将色素与血色分离控制的思路。当前保留原总台艺术肤色控制，并将局部色素/泛红字段独立组合；未加载BioSkin神经权重，未作光谱反演，不把艺术滑块称为实测黑色素或血红蛋白浓度。

### FDA DIDSR S-SYNTH（2024；2026扩展）

https://github.com/DIDSR/ssynth-release

学习可控皮肤多组件与可标注合成数据的组织方式。其原流程依赖Houdini/Mitsuba，未直接作为当前网页运行时移植。这里只生成虚构人物外观特征，不产生诊断或医疗训练有效性声明。

## 测试与现实限制

验证要检查真实网格变化和真实画布像素，不能仅检查滑块值。覆盖每个已曝光原生键、左右独立编辑、鼻梁和睑褶补形、全部皮肤子控制、72既有预设、版本档案、12身份批量重建，以及原AnimatedHuman材质挂接。最终以对应Actions实际报告为准。

两个1024×1280 RGBA字段的原始纹理约10MiB，另有mipmap和临时栅格缓存；只在设置变化时重建，不能将软件浏览器检查当作手机帧率证明。与ET12的高精度细分/多通道散射并用会增加负载。尚未认证所有极端原生参数组合、全体型精确解剖、皮肤病理、动态折叠、体积散射或多角色高精度性能。

“所有面部特征”是可扩展目标，不是有限面板能够穷尽的人体变化。本轮真实支持范围由目录和测试逐项列出；研究看过、方法启发、实际运行的模块必须分开记录。
