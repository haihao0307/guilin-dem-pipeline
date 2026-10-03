# KAOPU · KuKo Day 123 分枝语法老师 R01

这是“分形造波”知识体系中的一个独立、可回归的小环节。

## 当前阶段

- 目标：先百分之百复刻用户提供的 KuKo Day 123 Shader 行为。
- 当前只增加 WebGL2 / Shadertoy 兼容壳；老师算法完整保存在 `teacher-original.glsl`。
- 固定参考分辨率：960 × 540，与用户提供的视频一致。
- 未进行三维化、参数化改写、性能重写或造型创新。

## 结构

- `index.html`：小工作台与固定 16:9 老师画面。
- `runtime.js`：WebGL2 运行壳，只提供 `iTime`、`iResolution` 和全屏三角形。
- `teacher-original.glsl`：用户提供的老师 Shader 原文。
- `SOURCE_LOCK.json`：锁定参数、来源和阶段边界。
- `LEARNING_MAP_ZH.md`：说明它能教给分形造波体系什么，以及不能直接证明什么。

## 后续学习方向（本版不执行）

把这段算法拆解为“分枝寻址语法、仿射变换链、SDF 枝段/叶端、视域剪枝、风相位”五个可继承声部，再决定如何进入三维生长乐器。
