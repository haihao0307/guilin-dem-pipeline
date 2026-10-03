# KAOPU 毛发工作台 · SEDDI 基线候选 v0.1

## 当前状态

**SEDDI 基线工作台已发布，并通过真实 Chromium 的 56 项运行检查。**

在线入口：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/

本次验证包括同一单文件的 file://、HTTP 与公网运行，桌面 1440×1000 和手机尺寸 390×844，真实像素一致性、毛长、重置、相机、GPU 梳理及还原、参数状态导入与 PNG 下载。JS 与 WebGL 错误为 0；file:// 核心外部网络请求为 0。

版本：2026-10-03-seddi-baseline-r02。HTML SHA-256：`a232020fc17beacaa66899a8d4f901ff2e9b6783b8542decaeaac9e440b931c8`。

验证工作流：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37085184854

这是老师原始算法与参考资产的运行基线及编辑工作台，不是完整毛发生产平台。没有完成实体 iPhone/Safari、触摸手势、GPU 梳理持久化、长发动力学或生产级视觉验收。

## 文件

下面列出完整源码 ZIP 的目录。GitHub 在线目录保存单文件、适配源码和清单；完整未改动的老师原档位于随交接保存的源码 ZIP 中。

- `dist/KAOPU-毛发工作台.html`：单文件候选，原始兔子/布片、所需纹理、20 个原始渲染模块与新界面内嵌
- `src/workbench.html`：中文工作台界面
- `src/host.js`：参数、双视口同步、状态与导入/导出
- `src/frame.js`：隔离的 WebGL 运行、资源加载和输入适配
- `teacher-original/`：固定提交的全部 78 个原始文件，保持字节不变
- `source-manifest.json`：所有原档 SHA-256
- `qa/static-checks.json`：静态构建检查
- `qa/controller-checks.json`：最小 DOM 模拟的控制器状态测试，非浏览器测试
- `qa/VERIFICATION.md`：明确的已验证/未验证边界

## 重建与检查

Python 3 即可重建，无 npm 安装步骤：

```sh
python3 build.py
node tests/static.cjs
node tests/controller.cjs
```

`tests/browser-qa.cjs` 是已执行的真实浏览器检查，使用 Playwright 1.55.0 与 Chromium 140。测试机安装 Noto CJK 字体用于可靠检查中文布局。`tests/smoke.cjs` 保留最初不可用执行环境的检查草稿，不代表通过记录。运行主测试时指定 HAIR_HTML 为 dist 中的单文件路径。

## 实现与准确边界

本次保留原始 bunnyUV.json（5,508 顶点、10,108 三角面）、cloth.json 和原始纹理；两边使用同一份老师原始 WebGL2 渲染/着色模块。左边是基线，右边是同源可编辑工作副本，不是独立重写且已达到老师效果的引擎。

工作台适配层改动如下：

1. 用中文界面替换外围 jQuery/Bootstrap UI，原始 main.js 不在运行路径中
2. 原始模块由内嵌 AMD 适配器装载；原始 JSON 和 PNG 字节内嵌；模型加载和纹理 URL 在适配层重定向到内存数据
3. 两个独立 iframe 隔离原项目全局 gl；相同伪随机种子固定 Fin UV 生成顺序，用于可重复对照
4. 保留原始相机与光照，双视口相机始终同步；灯光参数同步，形态参数只改工作副本
5. 按需绘制；原始 animate() 没有真实发丝动力学，因此没有将其包装成动态物理
6. 以 1:1 CSS 像素渲染，明确避免原项目 DPR backing-store 与 CSS FBO 尺寸不一致。此适配不能被称为所有 DPR 下的未改动原行为
7. Pointer Events 提供旋转/双指缩放/梳理输入；梳理仍调用原项目 Transform Feedback
8. GPU 梳理方向可以还原，但当前不会序列化到 JSON；导入明确还原梳理
9. 模型切换串行处理，等待两边同一模型 ready；切换期间禁止专注视图隐藏老师，以避免原 drawScene 内部提交预设的状态停顿
10. 真实 Chromium 测试发现原 FullModel 会把无效属性位置 -1 交给 WebGL。适配层仅绑定整数且非负的 active attribute；原始模块文字、着色器、材质公式与模型仍保持不变。初始化时设置老师后续帧本就使用的透明混合规则，并完成两帧后检查，避免第一帧 Fin 使用默认混合造成左右显示不一致
11. `textureDensity`、`shadowsEnabled` 没有有效绘制路径，不提供可操作功能；`diffusePower` 当前着色公式未使用，保留禁用数值并注明；布片 `useColorText=true`，颜色编辑在该预设中禁用

未实现长发物理、毛束碰撞、触手、骨骼/皮肤绑定、Unity/Unreal 导出、独立程序兔子或生产级视觉质量认证。

## 真实浏览器检查范围

1. 两个 WebGL2 上下文成功创建，兔子实际出现，没有 JS/GL 错误
2. 同 viewport、DPR=1、种子、参数与相机，比较左右像素
3. 与未改动原项目默认 Rabbit 在相同条件下比较，并记录原始随机 UV 差异
4. 改变每个有效控制确认像素确实变化；禁用参数不假装有效
5. 梳理方向变化、还原、兔子/布片来回切换、快速重复点击
6. 相机同步、灯光同步、源码默认完整还原
7. 导出 JSON → 修改 → 导入 roundtrip；非法文件、重复导入、切换中导入
8. PNG 下载实际成功
9. file:// 零核心外部网络请求；HTTP 内部预览不等于 file:// 验证
10. 桌面与手机尺寸无溢出、手势可用；模拟手机 viewport 不等于真实 iPhone/Safari 验收

## 来源与许可

- Source: https://github.com/AEspinosaDev/WebGL-RealTimeFur-SEDDI
- Commit: `cca0432bef548a9853f34d89788c5d2761e57d56`
- Copyright (c) 2023 Antonio Espinosa Garcia, MIT
- 完整许可证位于 `teacher-original/LICENCE.md`
- 原档内 gl-matrix 等第三方许可注释原样保留

没有复制 Unity Companion 受限源码，也没有以 Unity/Unreal 标签声称实现对应引擎功能。

## 真实三维交付检查

- [x] 没有用生成图片代替真实三维实现
- [x] 已实际修改工作台适配源码
- [x] 工作台显示实时可交互 WebGL 兔子
- [x] 公网固定链接与真实浏览器已验证
- [x] 源码、单 HTML 与运行证据保持同一内容哈希
- [ ] 实体 iPhone/Safari 与触摸手势验收
- [ ] 用户视觉验收与生产级批准

若只有截图而没有工作台，不能作为本次交付。截图仅是运行 QA 证据。
