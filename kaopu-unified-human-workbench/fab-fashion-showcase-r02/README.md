# KAOPU · Fab Fashion Showcase R02

独立展示环境比较页，直接复用完整人物运行时，而不是简化人偶。

## 当前接入的真实资产

- 人物：HUMAN-INTEGRATED-R07（当前主线 CURRENT_HUMAN 指向的版本）
- 头发：F13 完整发丝候选
- 服装：T03 上衣 / P02 短裤
- 鞋：R14
- 运行时来源：guilin-dem-pipeline 的 crowd-runtime-r01 固定运行包，SHA-256 `84288be6063fbb378d9b397ceb20a39b76dc13a38c2040aa002908c8ee71233f`
- 原生人物来源包：F13 runtime 8,590,615 bytes，SHA-256 `cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790`

R02 不复制、重建或替换身体、衣物、鞋和发丝几何；加载时校验原生分片及完整运行包。展示环境扩展在同一个 Three.js scene / renderer 中创建。

## 场景

1. 原工作室：中性背景与柔和三点布光。
2. Fab 环形秀场：环形背板、同心装饰圈、侧向结构、暖色主光与冷色轮廓光。
3. Runway：纵深走台、两侧灯带和走台构图。

三种模式共用同一批人物、服装、动作、相机控制和物理状态。切换场景不重建人物。

## 性能观测

页面实时读取原生 renderer 的 draw calls、triangles、geometry 和 texture 计数，并读取运行时已有的统一更新/渲染提交 FPS 与单步时间。提交 FPS 不是 GPU 完成 FPS。R02 不把 GPU 时间写成未经测量的估算值。

已有独立 RTX 4070 Ti SUPER 基线来自 crowd-runtime R01：
- 2 人行走：58.85 ms / step，16.77 submitted FPS
- 4 人转向后行走：92.39 ms / step，10.56 submitted FPS
- 4 人跑步：113.01 ms / step，8.58 submitted FPS

这些不是 R02 三场景的性能结果。R02 场景开销需要在用户目标 GPU 和固定视口下重新采样。

## Fab 原资产取得状态

已核对 Fab 官方页面与公开描述。完整项目是 Unreal Engine 5.8 工程，包含 Runway / Studio / Export 三类关卡、Scene Manager Editor Utility Widget、镜头/动画/灯光/后期预设；官方明确说明不含 MetaHuman，布料模拟依赖 CLO3D 或 Marvelous Designer，运行时打包仅支持 Windows。

Fab 页面提供的 Windows Mannequins standalone demo 指向 Google Drive 登录页；当前没有取得完整工程包或可验证的原始工程文件。因此 R02 是基于页面、预览图和公开功能说明进行的独立场景重建，不宣称原工程一比一移植。

## 边界

- 真实 R07 / F13 / T03 / P02 / R14 运行时已经接入，但用户尚未完成视觉验收。
- R01 多人运行试验的最终固定页交互验收曾被 Browser HTTP 401 阻断；其前一候选有实际浏览器测试，R02 不能继承为自己的验收。
- 衣物仍是原区域物理范围，不是逐纱线完整自由布料；头发与衣物之间没有完整耦合碰撞。
- 鞋仍为足部刚性跟随，不具备独立鞋材力学。
- 本分支独立，不改人物、服装、头发或动作生产线。
