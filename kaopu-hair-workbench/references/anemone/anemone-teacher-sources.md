# 海葵形态与运动教师资料

核验日期：2026-10-03。目标是以真实海葵为参考，指导可调参数的实时造型与程序化水流效果；不将噪声变形称为完整流体或生物力学模拟。

## 可直接使用的真实图像

OIST（冲绳科学技术大学院大学）：Heteractis and Stichodactyla giant sea anemones，2022-10-19。

- 来源：https://www.oist.jp/image/heteractis-and-stichodactyla-giant-sea-anemones
- 原图：https://www.oist.jp/sites/default/files/2022-12/20221019-heteractis%20and%20stichodactyla%20sa%20anemones.png
- 原图尺寸：4283 × 1429
- 作者/版权归属：OIST (Okinawa Institute of Science and Technology Graduate University)
- 许可：CC BY 4.0，https://creativecommons.org/licenses/by/4.0/
- 推荐署名：© OIST, 2022. CC BY 4.0. Cropped from the original three-panel image. 若不裁图，删去最后一句
- 原图左：Heteractis magnifica 与 Amphiprion ocellaris；中：Heteractis crispa；右：Stichodactyla gigantea
- 这是冲绳海域相关大学资料，不能据此标成帕劳采样或帕劳已鉴定物种
- 像素已实看：左板为较粗、圆钝末端的长指状触手，稠密但存在簇状朝向与局部遮挡；中板明显更细长、尖端收细；右板是低矮密集地毯型，不能只换颜色当成同一种形态

## 解剖教师

1. University of Michigan, Animal Diversity Web：Heteractis magnifica
https://animaldiversity.org/accounts/Heteractis_magnifica/

足盘黏附硬基底，体柱连续连接口盘，中央口部由触手围绕。近根颜色与口盘连贯，远端可改变颜色。用于口盘、体柱、根尖过渡；不要从球体表面生成等距草丝。

2. Fassbender et al. (2021), Reef benthos of Seychelles – A field guide
https://doi.org/10.3897/BDJ.9.e65970
索引全文：https://pmc.ncbi.nlm.nih.gov/articles/PMC8417027/

图15和相关诊断描述为野外 H. magnifica：扁至轻度起伏的口盘，密集的指状触手，几乎不收尖，末端圆钝或略膨。此来源提供 Seychelles 野外形态，不提供本工作台的物种鉴定。抓取全文页时出现机器人检查，未从该页再取图；生产图像用已确认CC BY的OIST原图。

3. ICAR–CMFRI：Entacmaea quadricolor（2017）
https://eprints.cmfri.org.in/14911/

泡泡海葵可在独立形态预设中参考：足部常藏于礁缝，平滑体柱，口盘较足盘宽，触手近端部膨起并可能有色环。不要把泡泡型强行覆盖到magnifica上。

## 视频教师入口

1. BBC Earth，Amazing Clownfish Teamwork | Blue Planet II
https://www.youtube.com/watch?v=rn6R4ncd2OU
4K同素材：https://www.youtube.com/watch?v=Tyi5S76cZ-s
拍摄说明：https://www.bbcearth.com/news/clownfishs-incredible-show-of-strength

BBC说明地点为Borneo，物种为鞍背小丑鱼与地毯海葵。适合观察动物相对尺度、鱼穿入触手的遮挡关系和礁底栖息环境；不能单靠此片建立长指状海葵解剖。

2. Ocean Futures Society，SeaScope 05 – Clownfish / Anemone
https://www.youtube.com/watch?v=ALchuPgwniM
官方目录：https://www.oceanfutures.org/learning/seascope

独立自然纪录片来源。云浏览器已确认官方发布者、题名和5分钟时长，但播放器未成功加载画面，未声称已观察其连续运动。

3. National Geographic，Clownfish and Sea Anemone Partnership，1:28
https://www.nationalgeographic.com/animals/fish/facts/clownfish

官方页面明确列出嵌入视频。仅核实视频入口与说明，未实看连续帧。

视频均作为观看和学习入口；未取得重新分发视频文件的许可，不应下载打包进公开工作台。

## 水流运动依据

Full, Robinson, Holzman, Shavit & Koehl，Sea Anemone tentacles flutter and flap in water flow in the field
https://sicb.org/abstracts/sea-anemone-tentacles-flutter-and-flap-in-water-flow-in-the-field-/

研究对Gulf of Aqaba的Aiptasia diaphana做野外录像与粒子测速：单向流和波动叠加，触手顺流弯折并颤动；长触手尖端振幅较大，波动主导时有往复弯摆。不同位置相对于水的速度不同。物种不是magnifica，因此只作运动约束来源，不搬用其尺寸或频率。

Malul, Holzman & Shavit (2020)，Coral tentacle elasticity promotes an out-of-phase motion that improves mass transfer
https://pmc.ncbi.nlm.nih.gov/articles/PMC7329047/
补充资料：https://doi.org/10.6084/m9.figshare.c.5018438

主研究是珊瑚；补充野外测量包含A. diaphana，支持弹性附肢与波流存在相位差。可以据此设计滞后和弹性回正，不能把珊瑚物种直接当海葵或宣称本程序获得该实验标定。

实现建议（艺术近似）：
- 全体共享低频流向，局部簇保留相干，避免每根独立乱抖
- 根部约束为零位移，柔性和位移向末端渐增
- 长短不同产生不同幅度，微小相位差与受限回正形成拖曳感
- 形体拓扑、根部位置、口盘身份在动态中不变化
- 如未计算长度约束、碰撞或水压力，应明确叫程序化流场/噪声变形

## GitHub 源码教师（已只读检查）

### A. stegu/psrdnoise：推荐的成熟噪声基础

固定提交：419175a270862ce7ae692038fafafb42ec0427e9

- 3D：https://github.com/stegu/psrdnoise/blob/419175a270862ce7ae692038fafafb42ec0427e9/src/psrdnoise3.glsl
- 2D：https://github.com/stegu/psrdnoise/blob/419175a270862ce7ae692038fafafb42ec0427e9/src/psrdnoise2.glsl
- 许可说明：https://github.com/stegu/psrdnoise/blob/419175a270862ce7ae692038fafafb42ec0427e9/README.md
- 许可：GLSL代码MIT，版权 Stefan Gustavson and Ian McEwan (2021)

代码实现周期simplex noise、旋转梯度、解析导数；适合连续旋涡样流场与flow-noise。它不是液体解算器，也不包含海葵模型。原作者说明为WebGL 1兼容GLSL，WGSL端仅做过有限测试。3D周期每轴最长289；非周期可关闭wrap。若复制实现须保留完整版权和MIT许可。

### B. ashima/webgl-noise：Perlin / Simplex 对照

固定提交：6abed1e77ed1e18b181627c35f688eb30c9fe75e

- 真正经典Perlin：https://github.com/ashima/webgl-noise/blob/6abed1e77ed1e18b181627c35f688eb30c9fe75e/src/classicnoise3D.glsl
- Simplex：https://github.com/ashima/webgl-noise/blob/6abed1e77ed1e18b181627c35f688eb30c9fe75e/src/noise3D.glsl
- 带解析导数的Simplex：https://github.com/ashima/webgl-noise/blob/6abed1e77ed1e18b181627c35f688eb30c9fe75e/src/noise3Dgrad.glsl
- 许可：https://github.com/ashima/webgl-noise/blob/6abed1e77ed1e18b181627c35f688eb30c9fe75e/LICENSE
- 许可：MIT，Ashima Arts / Stefan Gustavson

无纹理噪声函数。fBm是多八度组合方法，不应把其每一项当成不同物理现象；Curl是从势场导数构造向量场，不等于任意三路噪声向量。是否宣称curl需对应实际实现。

### C. travisbreaks/anemone-chorales：有价值但不是自然模拟模板

固定提交：feab444247fa08fa684d45818dbcd4bca074bcc8

- 几何与shader：https://github.com/travisbreaks/anemone-chorales/blob/feab444247fa08fa684d45818dbcd4bca074bcc8/src/shaders/anemoneShader.ts
- 场景：https://github.com/travisbreaks/anemone-chorales/blob/feab444247fa08fa684d45818dbcd4bca074bcc8/src/components/AnemoneScene.tsx
- 许可：https://github.com/travisbreaks/anemone-chorales/blob/feab444247fa08fa684d45818dbcd4bca074bcc8/LICENSE

已读代码：音频FFT驱动膨胀、卷曲和flutter；noise2D实际为三层正弦近似，不是Perlin实现。运动使用pow(h,2.2)根尖权重，根部集中于单一圆环，基体是压扁球，且有明显发光/音频美术设定。可学习参数和shader管线的分离，不能照搬解剖或称为成熟海葵生物物理。

双重许可：TypeScript、GLSL和构建源代码MIT（Travis Bonnet, 2025–2026）；音乐及原始画作CC BY-NC-ND 4.0。不得把整个仓库的素材误当MIT。

## 边界

未执行、安装或运行上述第三方程序。没有找到并验证可直接满足真实长触手、口盘、碰撞、水动力与物种形态的成熟“整套海葵模拟器”。Aurelia是水母项目，不能改名冒充海葵教师。当前最稳妥方案是大学真实图像＋真实生物力学约束＋独立形态生成＋有明确许可的噪声基础。

