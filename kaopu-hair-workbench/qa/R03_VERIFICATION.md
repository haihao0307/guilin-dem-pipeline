# r03 海葵候选验证记录

目标：同一工作台接入参考驱动的海葵，保留 r02 兔子/布片渲染与编辑行为。

当前候选：2026-10-03-anemone-r03。未完成当前真实浏览器检查以前，不将本记录标记为通过。

## 已执行

- 原 SEDDI 78 文件、20 个运行模块、10 个运行资产仍保持字节不变
- r02 的 host.js、frame.js 与冻结快照逐字节一致
- 4 个内联脚本可解析，没有核心外部脚本或图片依赖
- 34 项独立几何数值检查：确定性种子、时间变化、长短与数量极限、根位置、离散弧长、实际口盘三角面附着
- 19 项原兔子状态控制器回归通过；不等于实际渲染通过
- OIST 原图与官方720×240展示图均查看真实像素，来源和 CC BY 4.0 已核对。构建嵌入官方展示图原始字节；完整版保持归档

## 当前真实浏览器候选

- Commit: 8a5d9f682f98d30ab417bd42a683d0f322f3b25f
- SHA-256: 2b0392ab64f1a8c69d92af8cde640348196f9ea630140b18718f6d6fba0108ed
- HTML bytes: 14,121,309
- GitHub Actions: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37091142867
- Status: 86 项真实 Chromium 检查通过，候选实际 file://、HTTP 与公网零 JS/GL 错误。同一 HTML 已晋级固定主入口，最终 run 37091747115 再次通过全部 86 项。

## 清楚的边界

- 海葵是程序化几何和定长运动学样件。噪声是独立的平滑标量 value noise，不称 Perlin、Simplex、流体或流固求解
- 一般运动关系参考 Aiptasia diaphana 的野外研究；并非 H. magnifica 的实测幅度、频率或个体重建
- OIST 照片提供形态与颜色参照。局部触手分簇、口盘个体轮廓、隐藏体柱尺度仍未量化重建
- 没有小丑鱼模型、触手碰撞、主动捕食/收缩、人类头发动力学、引擎蒙皮或 Unity/Unreal 导出
- 桌面 Chromium 的 390×844 viewport 不等于物理 iPhone、Safari、触屏手势或设备性能验收
- 本轮不更改任何 ChatGPT Game 项目文件

## 真实三维交付门

- [x] 没有用生成图片代替真实三维实现
- [x] 已实际修改生产源码
- [x] 可见候选由原生 WebGL2 几何和着色器实时绘制
- [x] 当前头的公网固定入口与真实浏览器已验证
- [x] 当前头 file:// 首帧和交互、零核心网络依赖验证
- [x] 独立 first-look：仅“可操作学习样件”阶段通过
- [ ] 用户视觉验收；productionReady=false

只有截图而没有工作台，本轮判定失败。QA 截图只用于运行与对照证据。

自动播放观测：在此 Chromium SwiftShader 测试机，1.213 秒窗口新增 27 帧，约 22.26 fps；不是实体手机性能。drawMs 是 CPU 加 WebGL 提交耗时，不是隔离 GPU 时长。

最终固定入口提交 e4d7cc80edd6e268b633a05d21be599f36843f86；Pages 37091746377成功；QA https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37091747115。HTTP200完整字节与SHA一致。最终测试机观察约15.72fps，前一轮约22.26fps，均非手机性能承诺。
