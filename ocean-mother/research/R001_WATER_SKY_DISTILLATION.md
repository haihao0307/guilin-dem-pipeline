# R001：海浪制作与水天性能知识蒸馏

记录日期：2026-09-01。归属：Ocean Mother。用途：指导生产流程，不替换已认可天气内核。

## 阅读范围与证据分级

用户给出的连续字符串已拆为两个独立链接：S01 与 S02。S01 正文经 web.open 多次请求返回 HTTP 403，搜索索引可确认标题、2026-08-19 日期和部分性能片段。未完整读取该文章，未核实全部基准条件。S02 只读取公开预览，未登录、未取得付费章节或课程下载包。

为继续研究，补充读取同作者 Sky Pro 官方指南、Three.js 官方手册、Three.js Journey 后续课程公开预览及 NVIDIA GPU Gems 的相关章节。补充资料和本项目推导均单独标识，不充当 S01 未读正文。未采用中文网站信源，未复制商业库实现或整份教学代码。

证据标签：SOURCE 表示来源明确写出；DERIVED 表示根据已读内容作出的分析；PROJECT_RULE 表示本项目选择的执行约束；UNVERIFIED 表示尚无足够原文或运行证据。

## S01：用户指定性能文章

URL：`https://threejsroadmap.com/blog/water-pro-sky-pro-performance-update`
标题：Water Pro + Sky Pro Performance Update。
状态：metadata_and_search_snippets_only；fullArticleRead=false。

SOURCE：检索索引显示发表日期为 2026-08-19，内容涉及 Water Pro 与 Sky Pro 的性能更新和按设备、分辨率报告的帧率。
UNVERIFIED：完整优化清单、各表格的完整前后条件、浏览器和后端配置没有取得。片段中的帧率与提升比例不写成本项目性能承诺，也不据此声称完成性能复现。
下一次取得作者公开正文或用户合法提供的内容后，再补记原文方法与测试条件，不改写本次读取记录。

## S02：用户指定 Raging sea

URL：`https://threejs-journey.com/lessons/raging-sea`
状态：public_preview_read；paidContentRead=false。

SOURCE，保留公开章节顺序：Introduction 提出动画海面和调试参数；Setup 使用旋转平面与 128×128 细分，并提醒可能需要更多顶点；Base 把材质改为 ShaderMaterial，分离顶点和片元着色器；Big waves 用模型变换后的水平位置产生正弦高程；Elevation 把振幅交给 uniform。公开页还要求正确的最终 sRGB 输出。

PROJECT_RULE：第一件海洋样件先保证位移可见、参数可调、坐标明确。128×128 不作为大海全域分辨率标准。公开部分没有提供完整反射、潮汐或真实海况求解证据。

## S03：后续课程公开预览，属于补充来源

URL：`https://threejs-journey.com/lessons/raging-sea-shading-shaders`
标题：Raging Sea Shading。
状态：public_preview_read；paidContentRead=false。

SOURCE：公开准备代码展示两个方向正弦项相乘的大波、叠加多次取绝对值的 Perlin 小波，以及根据 elevation 混合深浅颜色；课程用 smoothstep 调整渐变，准备 tone mapping 与 colorspace 两个输出步骤。公开文字将进一步光照列为后续工作。

DERIVED：负向叠加绝对值噪波会引入非正的位移贡献，改变强度或层数可能影响平均水位；按高程着色也不能单独证明水下深度、泡沫或光学真实性。
PROJECT_RULE：海洋平均水位单独控制，需核对位移均值。噪波只在标注的外观实验范围内使用，不能自动充当风谱。教学颜色不直接作为真实海水标定。

## S04：Sky Pro 官方性能指南，属于补充来源

URL：`https://docs.threejsskypro.com/guide/tuning-performance.html`
文档观察版本：2.2.0。

SOURCE：static / dynamic 分 16 帧刷新完整采样，ultra-dynamic 分 4 帧；同画质级别的后者每帧云射线数量为前者四倍。历史重建仍每帧输出图像。低档会降低云重建分辨率，并关闭部分效果；噪声体分辨率主要涉及加载与内存。

PROJECT_RULE：区分画面输出频率、全体新采样刷新时间、实际分辨率和每条射线步数。减少射线数量不能直接等价为总 FPS 按同倍数增长。以上方法仅列入未来 Ocean 集成实验，不改冻结云采样。

## S05：Sky Pro 官方版本迁移，属于补充来源

URL：`https://docs.threejsskypro.com/guide/migrating-2.1-to-2.2.html`

SOURCE：2.2 用 cloudRenderingMode 替代 cloudAmortization。默认 dynamic 对 high / ultra 的响应行为与 2.1 默认值有差异；保持此前快速响应需明确选择 ultra-dynamic。模式在创建系统时确定。

PROJECT_RULE：A/B 记录确切版本与实际模式，不只写 high。禁止把第三方 2.1 和 2.2 API 混为同一套接口。不得把这些第三方方法名描述为当前 WeatherMother 已有方法。

## S06：Sky Pro 官方反射指南，属于补充来源

URL：`https://docs.threejsskypro.com/guide/reflections.html`

SOURCE：天空与云可烘焙到独立的等距柱状 RGBA16F 环境纹理，屏幕与反射采样设置分开。skipFrames 的单位是跳过 update 调用的次数。水面反射捕获点的 Y 固定在水面附近，X/Z 可跟随相机。文档注明单捕获点视差限制、缺少内建粗糙度预过滤，以及反射不包含屏幕空间 god rays。

PROJECT_RULE：未来 Ocean 反射资源记录 origin、色彩空间、更新时间、对应时钟及失效状态。粗糙度预过滤单独验收，不能把任意模糊纹理宣称为完整 PBR。低频刷新与立即失效后的重建必须分别设计。

## S07：Sky Pro 官方水天与场景接入，属于补充来源

URL：`https://docs.threejsskypro.com/guide/water-integration.html`
辅助 URL：`https://docs.threejsskypro.com/guide/scene-integration.html`

SOURCE：官方示例共用 renderer、scene、camera，先更新 sky 再更新 water；provider 传递日照、雾与反射，后处理读取场景深度。带云 provider 包含环境图更新，provider 应创建后复用。场景指南区分写深度的水面与参与深度测试的云层。

PROJECT_RULE：抽取职责与数据流，不照抄商业库 API。现有桥接只有环境数值。共享相机、线性输出、云辐亮度与深度资源仍需专门接入设计，不能由读取天气参数自动推导成集成已完成。

## S08：Three.js 官方渲染后端说明

URL：`https://threejs.org/manual/en/webgpurenderer.html`

SOURCE：WebGPURenderer 使用节点材质与 TSL，可采用 WebGL2 后端回退。官方明确旧式 ShaderMaterial、RawShaderMaterial 与 onBeforeCompile 自定义材质需要迁移，不能直接使用。

PROJECT_RULE：近期海面验证沿当前 WebGL2 / GLSL 路线隔离实现，避免在首个候选中同时迁移天气后端。将来 WebGPU/TSL 作为独立批准的迁移任务；回退到 WebGL2 不意味着支持旧 ShaderMaterial。若新增 Three.js 依赖，锁定精确版本与许可，禁止浮动 CDN 版本。

## S09：Three.js 官方色彩管理

URL：`https://threejs.org/manual/en/color-management.html`

SOURCE：光照与合成一般在线性空间中完成，显示输出通常为 sRGB；自定义 ShaderMaterial 需处理输出转换。官方列举重复转换造成亮度错误的情形。

PROJECT_RULE：线性反射数据与已显示的画布像素分开标记。不得直接把已曝光、色调映射后的天气画布当线性 HDR 天空使用。冻结天气显示公式保持不变，未来合成接入须定义显示前资源边界。

## S10：NVIDIA GPU Gems 的水面方法

URL：`https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models`
标题：Effective Water Simulation from Physical Models，作者 Mark Finch。
阅读范围：Goals and Scope、Sum of Sines、Normals and Tangents、Geometric Waves。

SOURCE：章节区分几何起伏与动态法线细节，用显式波函数及其导数计算水面方向；Gerstner 通过水平位移形成更尖波峰，过大陡度会导致折叠。
PROJECT_RULE：法线与位移共同验收；几何细节和着色细节分开声明。该历史章节的当年硬件与 FFT 执行位置描述不用于说明当前平台能力。初版无需照搬章节固定波数或历史资源规格。

## U01：本项目原始交接依据

仓库：haihao0307/guilin-dem-pipeline。
文件：weather-mother/clean-v1/OCEAN_HANDOFF.md。
固定 ref：2619725efe236d2df8f2a55031bdae9e60a51555。
当前桥接说明：ocean-mother/bridge-v1/README.md，研究基线 4d497c0d63c251e62e952c2833b8fcc659fc4bd3。

接口单位为米、米每秒和模拟秒，轴为 +X 东、+Y 上、-Z 北；使用 wind.velocityMps 驱动海洋，云速独立。原包未提供海浪、云反射图、共享深度或可直接插入 Three.js 的天气组件。

## 从研究转成流程的决定

立即采用：先大波可视化，参数与单位明确，真实位移和法线一致，风浪与涌浪分层，分阶段视觉检查，性能与画质同时留证。

作为后续实验：反射资源缓存、依赖驱动失效、独立更新预算、带历史有效性检查的时间重建。每项必须给对照与退路，不能顺带更改冻结天气代码。

暂不引入：商业库本体、第三方预烘焙云数据、付费课程未读内容、后端整体迁移、来源未核实的 FPS 承诺、将教学噪波等同于完整海洋物理。

下一任务和完成门槛见 ../tasks/CODEX_O1B_O2A.md。本文没有新增浏览器、渲染或性能通过结论。
