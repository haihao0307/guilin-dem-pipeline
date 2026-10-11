# ET20：影视布光 / 皮肤 Lookdev 学习与迁移

固定父版本：人物总平台 ET19-IDLE-R01，网页构建 `be54aaa728f8f4ffd22786b82cfa3f8efbd99b11`，完整源/交付头 `fcc12621054981ee9aaf153888968cf932c697b0`。本轮只新增 cinematic-r01 与专用工作流；ET19、原五官/体型/骨骼/嘴唇/眼睛/待机源码均不覆盖。不把其他分支的未集成工作偷偷称为本轮已有能力。

## 原版问题的源码依据

`full/ui/Viewer.mjs`：半球光强度1.6、暖方向主光3.2、冷方向轮廓光2.6。原相机31度、Three r170 WebGLRenderer、ACESFilmicToneMapping、曝光1.05。上述是代码量，不是现场测光/曝光值。没有原生面积灯，也未设置阴影投射，强半球光容易填满暗侧。旧界面缺少主/补/轮廓的独立混合和相同机位的光/材质交叉对照。

原皮肤叠加了 CommonSkin、FaceSkin、身份标记、自然眼球、LipMaterial、IdleSkin；不能再堆一层全脸噪声或新皮肤覆盖模型。新层必须组合原材质实例，不改变肤色/身份档案，不把动态播放写入静态几何。

## 一手来源及证据范围（2026-10-11 查阅）

1. Arvid Schneider / SideFX, Light Like A Pro — Cinematic Portrait，Houdini20.5课程页，2025-01-14：
   https://www.sidefx.com/tutorials/light-like-a-pro-cinematic-portrait/
   用于确认影视人像布光课程与作者。公开网页只提供课程介绍；没有声称完整观看嵌入视频或取得付费场景，也不把本版参数说成课程作者的原值。
2. SideFX, Karma User Guide — Lights：
   https://www.sidefx.com/docs/houdini/solaris/kug/lights.html
   采用矩形光尺寸、方向、色温和以2为底的曝光档位；调整面积时保持设定总功率。保持总功率不等于面部照度不变。Diffuse/Specular multiplier 被官方明确列作非物理艺术修正，不冒称全部实现都是真实光学。
3. SideFX, Light Mixer：
   https://www.sidefx.com/docs/houdini/nodes/lop/lightmixer.html
   迁入命名灯组、曝光混合、solo分灯检查。不是移植Qt/USD界面，也不是缓存AOV的离线LightMix。
4. SideFX, Color management in Houdini：
   https://www.sidefx.com/docs/houdini/solaris/ocio.html
   采用输入/线性工作空间/显示转换的分离；保留原Three线性sRGB工作空间及ACESFilmic近似。没有安装OCIO，没有把ACESFilmic函数冒称完整ACEScg/ACES2管线。相机曝光乘2^EV，只在最后显示转换前应用一次。
5. SideFX, MtlX Standard Surface 与 Subsurface scattering：
   https://www.sidefx.com/docs/houdini/nodes/vop/mtlxstandard_surface.html
   https://www.sidefx.com/docs/houdini/solaris/support/sss.html
   区分镜面、粗糙度、次表面散射和绒感。颜色/法线/粗糙度不是同一个信号。采用分区参数，保留原RGB屏幕扩散并开放半径倍率；没有新增Karma Random Walk，也没有厘米级半径冒充皮肤毛孔尺度。
6. Pixar RenderMan, Louise；Photorealistic Head（Leif Pedersen；后者由Christophe Hery审阅批注）：
   https://renderman.pixar.com/louise
   https://prod.renderman.pixar.com/photorealistic-head
   学习宽/窄两个镜面瓣、在不同照明下检查粗糙度、微细法线优先影响表面镜面而不是把漫反射变成砂纸；绒感必须克制且分区。实际在现有Three GGX/LTC函数上实现权重和为1的两个瓣，不复制RenderMan着色器或扫描资产。毛孔为项目原创定静息坐标函数；没有导入这些教程的头模、贴图或付费素材。
7. Three.js RectAreaLight 官方实现与限制：
   https://threejs.org/docs/pages/RectAreaLight.html
   https://github.com/mrdoob/three.js/tree/r170/examples/jsm/lights
   复用与宿主一致的r170 LTC查找表，保留MIT许可。RectAreaLight本身不支持阴影；本版明确增加的是主光中心深度投影+16次PCF采样近似，不是完整面积光可见性积分或光线追踪。补光/轮廓未实现独立投影阴影。

## 学习后固定的工作方法

先确定光源动机和主光方向，单灯看骨性/体积；再按档位加必要补光和轮廓，不从“四处放亮灯”开始。光源尺寸、距离、总功率与最终相机曝光分开控制。先在中性灯光看肤色、粗糙度和毛孔，之后才做窗侧/低调/暖室内的镜头表达。

每次看四种组合：旧灯旧皮肤、新灯旧皮肤、旧灯新皮肤、新灯新皮肤。相机、人物、种子与待机时间保持一致。再单独看主/补/轮廓，以及漫反射、镜面、法线、无光照底色、粗糙度、主光可见性。诊断视图不是原作者的AOV文件，也不是观测到的真实皮肤参数。

灯光/材质状态单独保存为`kaopu/cinematic-look@1`；人物档案携带它，但调灯不重新求解身体、不重建待机缓存、不改相机。旧档案缺少新字段时关闭新灯/新材质，避免静默换外观。换人物时根据实际生成的头部边界重新定位灯具，光源不跟着镜头绕。

## 已实现与尚缺

CineRig：三盏矩形灯、世界空间定位、总功率归一、色温近似、曝光、分灯、环境填充、主光深度阴影。CineSkin：保留原材质上叠加双GGX/LTC瓣、分区镜面/粗糙度/微表面、原RGB扩散控制和有界sheen。CineUI：4组灯光配方、独立对照、21个连续光/材质参数、诊断与完整人物保存。新增LTC是查找表，不是皮肤照片。

光照半径过滤是实时近似，不保证所有接触/鼻侧阴影都等同面积光追踪。头部投影之外的身体未获新阴影；任意动态遮挡、全局光反弹和场景真实负补光尚未实现。绒感不是发丝几何，毛孔不是扫描微位移。原眼睑/唇角结构以及缺失的眉毛、睫毛、细毛会继续限制真实感。

现实成本：本系统是浏览器光栅渲染，不是Karma。原15组人物待机缓存及其约54MB CPU数组成本继承；新增1024平方颜色/深度阴影目标、LTC查找表和每帧一次脏阴影渲染，有显存和GPU成本。阴影只在形体人物模式启用，原动作/多人模式恢复旧照明。不承诺手机实机或消费显卡帧率，也不把软件GPU截图当性能认证。没有花钱购买素材，没有授权转授第三方素材。

- [x] 未生成图片替代真实三维。
- [x] 已编写真实派生运行源码，旧人物管线保留。
- [x] 参数、相机和待机仍读取原人物运行时。
- [ ] 实際源码/固定公网浏览器测试：以本轮evidence为准，不能由文档自动宣布通过。
- [ ] 用户视觉验收：只能由用户决定。
