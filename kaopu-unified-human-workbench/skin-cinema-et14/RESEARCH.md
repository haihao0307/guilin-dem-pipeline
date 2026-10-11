# ET14 近景皮肤：一手资料、拆解与实现边界

检索与阅读：2026-10-10。目标为同一个原生人物的影视近景皮肤，不允许用另一个漂亮扫描头替换原系统。下列资源不是按链接数量冒充学习完成；区分全文、文档、摘要、实际代码复用及未移植部分。不转载受限论文或第三方素材。

## 先纠正验收方法

细腻不等于磨皮；真实不等于增加密集噪点；影像锐化不等于微几何；扩大散射半径容易变蜡；皮肤滑块改变像素不证明更美或解剖准确。参考成品的光照、几何、材质、摄影机不能混作一个“皮肤参数”。高标准保留，但任何“无可挑剔”须经过指定放大倍率、镜头距离、光照、动作和时间稳定性检查。

## 老师与知识台账

|ID|一手来源／读取程度|真正学习内容|ET14使用／未使用|
|---|---|---|---|
|T01|[Epic MetaHuman Materials and Textures](https://dev.epicgames.com/documentation/metahuman/metahuman-materials-and-textures)，完整短文档|Cine细节、SRMF、多分量材质和动态差值图；LOD舍弃细节应明示|分开新增微表面、反射、颜色；未复制MetaHuman资产/着色器，也未声称实现其动态图|
|T02|[Unreal Subsurface Profile](https://dev.epicgames.com/documentation/en-us/unreal-engine/subsurface-profile-shading-model-in-unreal-engine)，官方文档|皮肤散射与反射分别控制|原ET12近似保留，未移植引擎散射系统|
|T03|[RenderMan Photorealistic Head](https://renderman.pixar.com/photorealistic-head)，全文与图示说明|高位深位移+bump、散射尺度、两反射瓣、绒毛、同光对比|新增16位折纹、直接光凸组合反射；未实现随机游走或真实绒毛；不引入老师头模|
|T04|[SideFX Karma SSS](https://www.sidefx.com/docs/houdini/solaris/support/sss.html)，参数和原理章节|random walk追踪内部光路；薄部位、模型尺度、采样噪声|明确网页屏幕扩散不等同Karma；未加入Houdini运行时|
|T05|[SideFX Skin Properties](https://www.sidefx.com/docs/houdini/nodes/sop/skinproperties.html)，表层/实体层/滑动章节|外壳与四面体实体的弯曲、体积、压缩、附着、滑动约束|当前只做手动剖面，不声称有组织物理；后续物理接口依据|
|T06|[SideFX OpenPBR](https://www.sidefx.com/docs/houdini/nodes/vop/mtlxopen_pbr_surface.html)，材质参数文档|分层表面与可读参数|参数分组借鉴；未翻译MaterialX/Karma节点运行时|
|T07|[Disney 2023 Graph-Based Synthesis](https://studios.disneyresearch.com/2023/07/03/graph-based-synthesis-for-skin-micro-wrinkles/)，正文PDF方法章节及第1/5/6页图已查看|孔节点、定向图边、多尺度模拟；皱纹谷和两侧隆起；交叉非简单叠加|保留老路径并用原创零横截面积剖面替换高度；没有实现CUDA图优化器或论文MellowMax；细层仍为近似网络，不能冒称完整复刻|
|T08|[Disney 2024 Fast Dynamic Facial Wrinkles](https://studios.disneyresearch.com/2024/04/26/fast-dynamic-facial-wrinkles/)，官方摘要，PDF读取失败|皱纹对正交应力的宽深响应；按方向分箱预计算|手动压缩/拉伸试验响应宽深；不是原生表情应力计算，不自动跟随每个演员|
|T09|[Disney Stylize My Wrinkles](https://studios.disneyresearch.com/2024/06/07/stylize-my-wrinkles-bridging-the-gap-from-simulation-to-reality/)，官方摘要|可控模拟+真实扫描皮肤小片风格能减少人工感|原扫描频段保留；未运行风格迁移网络|
|T10|[Meta BioSkin](https://github.com/facebookresearch/BioSkin)，README及许可说明|漫反射输入与生物物性分离；光谱还原不是肤色调节的同义词|低频色素/血色艺术控制独立；未加载神经权重，不叫实测黑色素浓度|
|T11|[NVIDIA FaceWorks](https://github.com/NVIDIAGameWorks/FaceWorks)，README实现说明|曲率/法线频段/阴影边散射及基于厚度的透光|作为散射升级基准；尚未移植D3D11/HLSL，不用背面红光冒充厚度透光|
|T12|[PBRT 4 Image Texture](https://pbr-book.org/4ed/Textures_and_Materials/Image_Texture)，过滤章节|像素覆盖、mip重建与连续域导数|直接复用PR195的图层采样及孔滤波，并让孔尺寸控制同步作用于导数|
|T13|[Autodesk Arnold SSS](https://help.autodesk.com/cloudhelp/ENU/AR-Core/files/ac-shading/ac-surface-shaders/ac-standard-surface/arnold_user_guide_ac_standard_surface_ac_standard_subsurface_html.html)，全文|randomwalk与diffusion不同；闭合几何、内部口腔、法线方向及世界单位重要|记录作为深散射移植前置条件；当前没有运行Arnold|
|T14|[GANtlitz, EG2024](https://diglib.eg.org/items/83da9288-c34d-44a2-b870-21b1b4d7b22f)，出版者摘要与附件清单|多模态纹理之间的毛孔/颜色/皱纹一致性；高分辨率训练与采集成本|未来参数皮肤库的参考；没有下载训练集、训练模型或把样例当自有生成|
|T15|[Spectral SSS from RGB via Biophysical Skin Inversion, 2026](https://arxiv.org/abs/2606.27604)，论文摘要与版本信息|从RGB漫反射预测混合介质光谱物性，再接随机游走路径追踪|新研究跟踪项；未运行模型，不宣称网页完成光谱皮肤|
|T16|[NIST human skin reflectance](https://catalog.data.gov/dataset/reference-data-set-of-human-skin-reflectance)，政府数据目录|可追溯的光谱参考，不以屏幕肉眼颜色代替物理数值|后续光谱验证来源；数据尚未用于当前拟合|
|T17|[SideFX APEX Add Wrinkles](https://www.sidefx.com/docs/houdini/nodes/sop/apex--addwrinkles.html)，概述、几何、约束与碰撞章节|原始/变形几何、距离/弯曲约束、SDF碰撞和法线重算；大strut邻域增加成本|未运行或移植节点，自己的手动剖面不是其求解结果|

T07论文链接：https://studios.disneyresearch.com/app/uploads/2023/07/GraphBasedSynthesisForSkinMicroWrinkles.pdf 。只保留链接和自己的短摘要，不转载论文。其宏观/微观分层、图结构和隆起对照指出：单靠细层Voronoi和固定额纹仍不足以达到影视皮肤。这是本轮必须保留的反例，不用“参考Disney”掩盖实现差距。

## 实际新增代码

Schema：17个严格范围控制、6个表面预设，保留原89个五官和37个身份控制。艺术控制范围不是医学标定。

Shader：原生同材质实例，复用原扫描分区。孔尺寸与滤波导数一致；细层网络、唇纹为受像素覆盖衰减的法线起伏；局部干湿、面颊/鼻区粗糙度、T区油膜；低频色素与血色分别调节；直接光GGX为两个瓣的凸混合，而不是把第二份能量整个叠加。间接光仍走原生响应。

FoldField：2048×2560的全分辨率16位有符号打包高度，低级mipmap仍受RGBA8逐通道量化影响；保留原身份路径，替换皱纹的旧高度，痘点/疤痕等高度仍保留。原创剖面h=A(q²−1)exp(−q²/2)；横向积分为零是剖面数学性质，绝不能称为完整组织体积守恒。曲线之间仍会相加，交汇处没有实现论文里的完整混合器。

Runtime：与原archive/restore、旧档案显式关闭、原生材质生命周期组合，不添加第二个动画循环。压缩滑块为手动试验，没有用表情标签伪造真实应力。原脸层回调先于身份层结束，新增字段必须确认身份设置与字段签名一致，不能用新设置缓存上一代曲线。

## 合作接口与所有权

采样员工PR195固定9289ec5075e2600ff5aed5d6c159995b1032d09e原样继承；独立分支feature/skin-cinema-et14-20261010增量，不覆盖其文件。已在PR195发布协调留言；留言不代表其他员工已应答。原ET13及所有生产入口保持。

## 现实成本和下一条质量门槛

新增折纹及保留痘疤高度原始GPU纹理25MiB，mipmap后约33.3MiB；另有临时Float32栅格和原采样纹理、扫描素材、蒙皮/细分/扩散缓冲。不是一个1MB网页就只占1MB显存。当前纹理只在身份字段或剖面参数变化时重建；实时反复拖动可能产生卡顿，UI在松开滑块时提交昂贵重建。

普通使用者无法把Houdini随机游走渲染、MetaHuman资产和神经皮肤网络直接粘贴进网页并同时获得相同画质：缺的是可合法分发的高精度数据、引擎功能、闭合正确几何、着色器迁移、GPU带宽和严格校准，不只是“多找几个滑块”。本轮不买服务、不导入新头、不声称跨平台GPU帧率。

验收应固定同一头、同一相机、同一光照；整脸、鼻颊、唇部、斜视分别看；中性光、掠射光、逆光分开；看毛孔尺度与时间稳定、沟谷和肩部、肤色层与反射层。哈希和无报错只算功能证据，最终影视自然度必须另判。真实体积、眼周解剖、绒毛、表情应力响应、36身份皮肤配置、全身统一尚未据本轮自动完成。
