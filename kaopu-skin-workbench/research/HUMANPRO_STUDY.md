# HumanPro 皮肤学习与复现证据矩阵

调查日期：2026-10-07 UTC。目标：以 Khanh Vo 的 HumanPro 为皮肤老师，学习可核实的材质与形变机制，最终在相同条件下验证效果。本文是研究基线，不是“已完整解析”或“一比一复刻完成”报告。

## 1. 身份、版本与取得状态

- **确定对象**：HumanPro，作者 Khanh Vo / Vokhanh99，BlenderHomie 团队。作者作品页直接链接官方网站和官方商店，身份链吻合。[作者说明](https://khanhh.artstation.com/projects/dye5JQ)
- **可确认版本**：作者本人发布了 **HumanPro 1.4 | Genesis 8 Ready**。这确认 1.4 存在；不代表 1.4 是今天最新版本，也不代表已拿到包。[作者 1.4 页面](https://khanhh.artstation.com/projects/WXJRPy)
- **官方兼容声明**：Blender 4.0–4.3、Daz Genesis 8/9；依赖 Daz Studio、Daz library 和 Diffeomorphic。较早作品页的 Genesis 9-only 说明与后续 1.4 的 Genesis 8 Ready 应按时间区分。[官网](https://sites.google.com/view/khumanpro/home)
- **Superhive**：产品页目前明确显示已无法购买；作者店铺显示无商品。[产品](https://superhivemarket.com/products/humanpro) · [店铺](https://superhivemarket.com/creators/vokhanh99)
- **另一官方入口**：作者原视频说明中有 [Buy Me a Coffee 商品](https://buymeacoffee.com/khanhh/e/353884)。本次只读 HTTP 请求返回 404；不能据此购买或确认仍有文件。来源是 [作者发布视频](https://www.youtube.com/watch?v=OV3OxK3i1to)，不是第三方下载站。
- **当前价格、购买授权、插件代码许可证、贴图许可证、官方 demo**：尚未核实。没有获得安装包、源码仓库或免费原始材质包。搜索出现的非官方下载不作为可用来源。
- **已取得内容**：作者公开网页、两张作者在 Blender Artists 发布的研究截图和一张官网手臂示意图。图片仅留本地私人研究；本文只保留来源链接，不将图片或插件资源放入公开仓库。

## 2. 已核实的功能，不夸大为完整清单

| 模块 | 一手证据 | 当前能确认 | 仍缺什么 |
|---|---|---|---|
| 一键皮肤材质 | 作者主页、作者作品页 | 存在一键创建皮肤 shader 流程 | Python operators、完整 UI、可调参数、失败条件 |
| 8K 皮肤纹理 | 官网 Realistic Skin Texture | 官网宣称皮肤纹理为 8K | 每张图的尺寸/位深/颜色空间/通道用途/覆盖区域 |
| 动态皱纹 | 官网 Wrinkles | 皱纹会配合面部控制与网格形变出现 | 是骨骼、shape key、strain 还是其他驱动；贴图数、组合公式、遮罩 |
| 面部控制 | 官网与作者作品页 | 有面部控制模块，早期描述针对 Gen 9 | G8/G9 分别支持哪些 controls、范围、左右独立性、表情列表 |
| Bendshape / BlendShape | 官网、作者 Jesse 页面 | 作者使用过两种拼写；动作会触发自动计算的声明 | 不从名字推定具体算法或宣称有完整 FACS/ARKit |
| G8 支持 | 作者 HumanPro 1.4 页面 | 有 Genesis 8 Ready 的正式展示 | 8、8.1、男女模型/UV/版本差异的实际支持表 |

功能来源：[官网](https://sites.google.com/view/khumanpro/home)、[首发作品](https://khanhh.artstation.com/projects/dye5JQ)、[1.4](https://khanhh.artstation.com/projects/WXJRPy)、[Jesse 案例](https://khanhh.artstation.com/projects/nJNvK9)。公开信息不足以列出“全部功能”；不把第三方文章列举的 hair library、游戏引擎导出、FACS、ARKit 或任何未经作者证实的能力算入。

## 3. 直接看到了什么

### 3.1 作者眼部 WIP 原始截图

[作者原帖](https://blenderartists.org/t/the-eyes-humanpro-addon/1564188) 标明 Blender Cycles、100 samples。3435×1365 截图中可读到 Blender 4.2.0，物体/材质有 Genesis 9、Head_Female_G9 标识。右侧是实际 shader 图，能辨认 Image Texture、Color Ramp、Mix、Math、Principled BSDF 与大量组输入/连线。部分内容超出画面，文字过小，不能可靠抄出全部参数或完整连接关系。

可学习的**视觉特征**：眼周细纹有明确方向和区域差异；上眼睑、眼下、眉间的尺度不同；反射亮度不是全脸均匀；眼球、眼睑边缘、眉毛共同影响可信度。截图含明显采样噪声，不能把每个颗粒都当成真实毛孔。

[节点与近景原图](https://blenderartists.org/uploads/default/original/4X/0/6/1/061b3a2f8aef32b2a6f38ed6d09d7c35ef8aaf7b.png)

### 3.2 作者线框叠加图

另一张 1546×867 图能观察到围绕眼口鼻的拓扑走向与皮肤渲染叠加；它是线框检查图，不能作为无杂项的像素级美术对照。它说明应同时检查几何、眼睑接触和材质，而不是只调颜色或 noise。

[线框原图](https://blenderartists.org/uploads/default/original/4X/f/1/d/f1d37ccd96ad1c8efbc54e4641ae006cb3bc2ad0.png)

### 3.3 官网手部图

目视官网手部示例：指关节较深沟纹、手背细褶、掌指过渡、局部高光、甲面与皮肤不同的反射响应。这些都是局部结构化细节。**不能由一张图确定**其位移位深、毛孔纹理来源、SSS 方法或灯具功率。[图所在官网](https://sites.google.com/view/khumanpro/home)

## 4. 材质拆解目标：事实与待验证假设分开

| 研究对象 | 目前证据等级 | 拿到原件后必须导出的信息 | 对照检查 |
|---|---|---|---|
| Base color / 色差 | 图中有 Image Texture、颜色处理链；具体资产未知 | 图路径/哈希、颜色空间、连接和每个调色参数 | 单独 albedo 输出；是否烘入高光与阴影 |
| 粗糙度 / 表层反射 | 原图能观察局部反射差异；确切驱动未知 | roughness/IOR/specular 输入与遮罩；是否多层 lobe | 同灯光扫过眉间、鼻翼、眼下、脸颊 |
| SSS | 作者用 Cycles；HumanPro 具体 SSS 方法/半径未知 | method、weight、radius、scale、IOR、anisotropy、单位 | 关闭/开启 SSS；正光/侧逆光/耳缘；看蜡感和细节损失 |
| Normal / bump / displacement | 细节可见，无法从截图分清各层贡献 | 节点组树、normal conventions、height midlevel/scale、subdivision | 分别关闭每一层，检查轮廓、掠射角、阴影和细节重复 |
| 动态皱纹 | 官方明确有；机制未知 | shape keys、drivers、骨骼、attributes、mask、纹理和组合函数 | 中性→单侧→双侧→复合表情→回中性；检查残留和爆纹 |
| 色彩管理 | 图像外观可见；view transform 未展示 | OCIO、view transform、look、exposure、gamma、输出格式 | 同一线性 EXR 走同一显示变换；禁止两边偷偷调曝光 |
| 灯光相机 | 截图有 camera；布光参数未知 | 灯类型/尺寸/功率/位置、HDRI、焦距/距离/DOF | 不把参考图布光差异误判为 shader 改进 |
| 几何和 UV | Genesis 9、G8 支持有来源 | base mesh、UV sets、材质分区、真实尺寸、顶点数 | 贴图接缝、耳鼻厚度、眼睑接触、颈部连续性 |

这里列的是**要核验的技术问题**，不是已发现 HumanPro 使用上述每项功能。尤其“多 lobe”“分层 displacement”“strain-based wrinkles”“Random Walk (Skin)”暂时均不得标为 HumanPro 内部事实。

## 5. 实验协议：先建立老师原样基线，再做单变量实验

以下是我们拟定的验证流程，不是作者声称的工作流：

1. 固定受支持 Blender 版本，记录插件版本、Diffeomorphic 版本、模型/贴图授权来源；原包只读保留 SHA-256。
2. 先用作者原样设置渲染一个中性头部，另保存完整依赖的测试场景；原结果标为 HUMANPRO_REFERENCE，不把自己实现冒充原版。
3. 使用同一模型、UV、实际尺度、灯光、相机、色彩管理；原版与重建轮流渲染，不能分别“美化”。若没有原场景，只能标记“视觉参考近似”，不能叫 matched-lighting ground truth。
4. 近景区域至少包含：额头/眉间、眼下/鱼尾纹、鼻翼/脸颊、嘴唇过渡、耳缘；手部只在相应几何和资产齐备时增加。
5. 三组光照：中性宽面光、掠射侧光、侧逆光。每组同时出原始线性文件、统一显示变换 PNG、采样数和是否降噪。采样收敛后再评毛孔；不能用噪点冒充细节。
6. 渲染消融组：原样、无 SSS、无微 bump、无位移、固定粗糙度、无动态皱纹。一次只改一项，保存完整参数 diff。
7. 动态测试：中性、眉上提、眉间压缩、眼周收缩、微笑/鼻唇沟、左右不对称与复合表情；具体控制名以真实包为准，不能先做假按钮。
8. 在同一裁切区域检查结构方向、尺度、局部反射、色差、透光、接缝、时间连续性。SSIM/误差仅在严格同场景对齐时辅助使用，不将不同人物或不同布光的分数当效果相当。
9. 浏览器展示如采用近似散射，应标明 preview/approximation；Cycles 原生对照和浏览器结果分开评估。仅跑通 WebGL 不构成 HumanPro 级皮肤通过。

Blender 官方机制依据（用于理解实验，不证明 HumanPro 私有实现）：[Principled 4.2](https://docs.blender.org/manual/nb/4.2/render/shader_nodes/shader/principled.html) 描述 SSS 的半径/尺度及 Random Walk 家族；[Displacement](https://docs.blender.org/manual/en/latest/render/shader_nodes/displacement/displacement.html) 区分 bump 与真正几何位移；[Color management 4.0](https://docs.blender.org/manual/en/4.0/render/color_management.html) 说明线性流程、显示变换和曝光。正式实验应以实际锁定版本为准，不能混用新版语义。

## 6. 最小解除阻塞材料

用户若已持有正版，最有价值的是：

- **HumanPro 原安装包 + 配套纹理/资产库**，保留原目录与版本；不要只给插件 Python 文件而缺资产
- 或者：**已经应用 HumanPro 的 `.blend`**，连同它引用的合法可用贴图；最好附中性与一个有动态皱纹的表情，以及所用 Blender 版本
- 如果只想先拆皮肤，带完整节点组和贴图的合法 `.blend` 能先建立材质基线；要解析全部按钮与动态功能，仍需要插件代码及其依赖
- 请不要发送账号密码、付款信息；已有包即可。若没有包，可由用户决定是否联系作者询问恢复下载/演示/许可，目前未代发联系

## 7. 发布边界和当前完成度

- 未购买、未安装、未运行 HumanPro；未获得原插件资产
- 未修改或发布工作台 production；没有创建替代工作台
- 研究结果只做技术摘要、证据链接、可复现实验设计；不公开第三方受限图片、贴图、代码或 `.blend`
- 后续独立实现应使用自有/可公开资产。实际包内代码和纹理的具体权限需逐项检查；不能仅凭“Blender 插件”判断所有资源可公开
- **本阶段完成**：确定正确老师、核实官方版本与销售状态、目视核查原始材质截图、建立功能与未知项矩阵、设计实证对照流程
- **未完成**：下载原插件、完整源码/材质/贴图解析、运行参考场景、同灯光复现、完整功能实现以及质量验收

## 8. 第二轮实证：作者操作教程与可执行检查器

### 新找到并实际阅读的一手教程

作者频道有 [Daz To Blender 教程](https://www.youtube.com/watch?v=-3QOS2AewWE) 和 [越文使用教程](https://www.youtube.com/watch?v=Ukwc-UCnDow)，时长均为 14:53。本轮在云浏览器读到了前者的完整自动字幕。视频画面持续缓冲，因此字幕中的疑似误识别词不当作精确按钮拼写，未从画面确认数字。

作者教程带来的新增可核验行为（概述）：导入需要 DUF 与 DBZ；应用皮肤前须选网格及对应材质槽，否则会警告或产生重复槽；头、身体、腿、臂分别处理，各槽独立调节。随后导入控制 rig。材质使用 linked data-block，打包前要解除链接。教程还说明化妆颜色、肤色变换、接入自备贴图，以及 normal-only 和 normal 配合 displacement 的不同接线。[教程对应段落：2:32–3:17、4:41、7:02、8:38–9:49、10:21–14:28](https://www.youtube.com/watch?v=-3QOS2AewWE&t=152s)

这证明它不只是一个“SSS 强度”滑块。实际复现必须覆盖资产连接、材质分区和驱动工作流；具体控件名和内部算法仍待原件验证。

### 可直接落实的新增验收实验

下列是由观察制定的原创测试方案，不是对作者未展示实现的推断：

| 编号 | 输入/操作 | 应记录的证据 | 失败判据 |
|---|---|---|---|
| HP-01 槽位安全 | 选 armature、选 mesh 无正确槽、选 mesh 正确槽分别应用 | 操作前后材质槽名称/数量、警告原文 | 错对象仍静默成功；未提示而重复材质 |
| HP-02 跨区域一致性 | 头/身/臂/腿依次应用后以统一颜色校准 | 同曝光接缝近景、各槽参数 diff | 颈部/四肢接缝；改头部参数意外影响无关槽 |
| HP-03 链接与打包 | 链接态打开、解除链接、打包、独立目录重开 | missing-files 清单、文件尺寸、材质图差异 | 重开缺图或依赖原机绝对路径 |
| HP-04 自备纹理 | 同几何先保留原纹理，再仅替换颜色图 | 图像用途/颜色空间、与微细节输入的独立性 | 换色图导致几何细节消失；粗糙度误接颜色 |
| HP-05 makeup | 默认色、覆盖色、关闭三态 | mask 与皮肤边界、反射分离 | 改色影响未遮罩区域；默认态无法恢复 |
| HP-06 normal/位移 | normal-only、normal+位移、位移关闭三态 | 三张同条件裁切、实际连接和高度单位 | 把 normal 当 height；只改名称而效果相同 |
| HP-07 回归 | 保存、关开、重复应用、恢复中性 | 数据块数量、drivers、slot 与图像缺失检查 | 数据不断复制；表达式残留；链接不可恢复 |

### 自写只读审计脚本

同目录 `humanpro_scene_audit.py` 是我们新写的检查器，**不包含 HumanPro 源码或素材**。拿到合法场景后可运行：

```sh
blender --background --disable-autoexec /private/authorized-scene.blend \
  --python humanpro_scene_audit.py -- --output /private/audit-humanpro.json
```

它读取节点、连接、输入默认值、Color Ramp、嵌套节点组、贴图尺寸/位深/颜色空间/是否打包、材质槽、shape keys、driver 表达式文本、灯光相机、渲染与显示设置。它不安装插件、不主动求值 driver、不渲染、不保存或修改 blend。输出可能含受限第三方节点结构，必须留私人研究位置，不提交公开仓库。

实际检查结果：Python AST、字节码编译及 scalar/values/空 driver 辅助函数检查通过；**未在 Blender 或 HumanPro 原件上运行**。检查器不覆盖全部 Blender RNA 属性，不能以导出报告替代原件保存或视觉验证。

### 扩展获取渠道的实际结果

- 作者8支相关视频/说明已确认身份链，包括两支教程、G8 展示、手臂展示、首发与早期 WIP；没有新的合法安装包/试用 blend 链接
- Blender Artists 帖子的结构化正文只有3张 PNG 与 Vimeo 演示，未发现 zip/blend 附件；第三张 PNG 已实际检查是静态图，不能当动画帧
- 作者 Buy Me a Coffee 个人页与 ArtStation store 的直接请求返回403；仅记录访问阻塞，不推断账号不存在，不绕过
- GitHub 公开仓库搜索 `humanpro blender`、`HumanPro Khanh`、`BlenderHomie` 均返回0项；这只说明本次查询未发现作者仓库，不证明不存在未索引或私有仓库
- 已检查现有资料库精确名称 HumanPro、Human Pro、Humanify，未找到匹配原包；不将名称近似的其他项目文件认作插件
- 官方完整视频的媒体下载未成功，字幕已经实际读到；尚未取得可解包的插件二进制、Python 包或纹理库
