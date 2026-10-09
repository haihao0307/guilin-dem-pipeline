# 实验 002 · 负曲率回廊 R06

## 当前状态

**改进后的技术试玩候选；整体美术待完善。** 有限光源阴影与三灯构图已修，粗糙度/金属响应有真实图像改善。全场仍像灰色纹理展厅，不能称高质量游戏成品。

- 技术回退基线：commit `1a9cb7d450708f07ed4a801dd938372a3e0eb553`，[R05 完整 QA](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37864714122)。原始技术基线完整保存。
- R06 材质及功能首次验收：[run 37866114769](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37866114769)，实际 16 项浏览器检查通过，已检查全场、局部粗糙度 A/B 和手机截图。
- R06 最终入口、16项浏览器交互和有效性能复测均通过：[run 37867035487](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37867035487)，commit `40df4d9d55324bd52dd6899d6ef6ef69d609bad9`。确切终态、入口 SHA 和计量边界见 [VALIDATION.json](VALIDATION.json)。
- 美术标准见 [QUALITY.md](QUALITY.md)，能力与下一阶段差距见 [CAPABILITIES.md](CAPABILITIES.md)。

## 真实画面证据

以下为同一最终入口在 Chromium/SwiftShader 实际绘制，不是概念图。人看图结论仍为“技术候选，非成品美术”。

- [默认全场](evidence/r06/first-desktop.png)
- [同一表面：粗糙](evidence/r06/first-material-rough-close.png) / [抛光](evidence/r06/first-material-polished-close.png)
- [手机宽度布局](evidence/r06/first-mobile-layout.png)
- [证据校验和](evidence/r06/EVIDENCE.json)

## 要检验的问题

三盏灯到测量中心的真实距离都是 3.60，出发方向相隔 120°。只改变空间曲率，它们之间的最短路程还相同吗？

先猜，再按 A→B→C 走一遍；切换 κ=0 重走。几何规律在这里用来提出、操作和检验具体问题，不包装成神秘发现或新的数学证明。

| 模式 | 灯中心间的边长 | 每个内角 | 内角和 |
| --- | ---: | ---: | ---: |
| 欧氏 κ=0 | 6.235382907 | 60° | 180° |
| 双曲 κ=−0.09 | 6.460494048 | 38.741777931° | 116.225333792° |

控制台目前直接显示计算结果；还没有提交预测或逐项揭示答案的玩法。“走近灯”标记到达，角度来自相同几何内核，并非玩家轨迹的人工测角。

## 操作与行程边界

- 默认从中心后方 6.2 单位、略斜的位置看三灯。拖动转头，WASD 行走；手机按住方向键。
- 走近灯中心 0.48 单位自动点亮。外壁、立柱、门柱、灯座有简化碰撞体。
- “从起点引导试玩”每次重置，再走起点→A→B→C；方向输入随时接管，受阻会停止。复位和切换曲率都会清空旧进度。
- 引导在灯前约 0.35 单位停止，且不走 C→A。累计行程**不是三角形周长**。约 21.08/20.75 单位的两模式引导行程差异仅约 1.6%，当前靠行走时间不能充分表达趣味。

## 数学实现

κ=−k²，负曲率模式 k=0.3。双曲面坐标 p=(x,z,t)，Lorentz 内积 B(p,q)=pt·qt−px·qx−pz·qz，满足 B(p,p)=1、t>0。

    d(p,q) = acosh(B(p,q))/k
    p(s) = cosh(ks) p + sinh(ks) v

方向随运动平行运输，转头是切平面旋转。小地图使用庞加莱投影，像素距离不参与行走。κ=0 直接使用欧氏距离、直线与余弦定理。

空间是 H²×R：水平为双曲几何，竖直为普通高度；光线沿产品空间的测地线步进。不是所有二维截面都同负曲率的 H³。R06 数学内核与 R05 逐字一致。

## 材质与阴影学到了什么

旧材质中的 rough 变量没有真正参与高光形状。R06 在命中点接入 GGX 分布、height-correlated Smith 可见性、Schlick Fresnel，粗糙度实际控制高光。没有把材质运算放进 144 步主射线循环。

- GGX/Smith 改写自已使用的 [three.js r170](https://github.com/mrdoob/three.js/blob/r170/src/renderers/shaders/ShaderChunk/lights_physical_pars_fragment.glsl.js)（MIT）；完整许可内嵌 HTML 并保存在 [THREE-LICENSE.txt](THREE-LICENSE.txt)。
- 暗石/暖金属参数、平滑值噪声及微法线为自有代码；沿 H² 切空间与高度方向采样。不是扫描材质，也不声称纹理在整个双曲面上等距。
- 环境项是解析半球近似，不是 HDRI 预过滤、GI 或真实场景倒影。
- KAOPU 旧 Wet Stone 只作观察；其 CC BY-NC-SA 代码、噪声、材质数据和图像均未复制。
- 有限光源的大片分层阴影已通过单项差分、最小数值复现、新旧公式真图定位和修复。过程见 [DIAGNOSTICS.md](DIAGNOSTICS.md)。AO 尚有弱环状近似误差。

## 运行与测试

试玩最少只需要 `index.html`；支持 WebGL 的浏览器可离线打开。运行时没有外部资源请求，参考链接仅主动点击时联网。

    npm install
    npx playwright install chromium
    npm test
    node tests/shadow-isolation.cjs
    npm run test:browser
    npm run test:performance

数学与应用测试直接提取交付 HTML 的脚本。`geometry.js`、`pbr-hit.glsl` 只是可读副本，不是额外运行依赖。

浏览器验收检查实际 WebGL 编译、原始画布非黑屏、曲率对像素的影响、两模式三灯、真实键鼠/触摸、接管、失焦释放、复位、重复切换和零外部请求。引导路线截图用确定性模拟时钟；真实按键另测，不以快进截图冒充实时帧率。

性能以 Node 单调时钟记录“RPC→绘制→实际像素读回/校验→返回”总成本，并记录两秒真实按键的提交帧数与位移。它包含读回和 RPC 开销，来自 Actions 的 SwiftShader 软件渲染，不是消费设备 GPU 时间或手机 FPS。最早 page performance.now 返回 0 ms 的测量被判无效，没有采用。

实测同步总成本：桌面画布 1103×852 约 7.48 秒，手机尺寸画布 390×498 约 1.53 秒；旧着色分别约 7.49/1.53 秒。小样本中没有可辨识的 PBR 附加拖慢，不能据此宣称更快。软件渲染并不实时。两秒按键期间有移动且松开清空输入；26–28 个提交帧不是最终显示帧率，实际消费 GPU 与手机仍未测。

## 来源及不能扩大的声称

- [HyperRogue 几何编程说明](https://roguetemple.com/z/hyper/dev.php)；不复制原游戏美术或代码。
- [OpenAI math 成果 334](https://github.com/openai/math/blob/main/CONTENTS.md#L6927) 仅作为内在度量与外在嵌入的概念参考。本实验基于既有双曲几何，不是该定理的工程应用或证明复现，没有在此运行 Lean 验证。
- 没有 Houdini 接入、流体模拟、完整无限世界或实际手机硬件验收。资料数量不等于游戏数量承诺。
- 本地环境无法启动 Chromium；云浏览器可以载入公开页面但不具备 WebGL。真实三维证据来自上列 Actions Chromium/SwiftShader，不能冒称该云浏览器已实时试玩。
