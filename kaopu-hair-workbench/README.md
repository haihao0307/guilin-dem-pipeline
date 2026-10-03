# KAOPU 毛发工作台 · SEDDI 基线候选 v0.1

## 当前状态

**代码与静态结构检查已完成；真实浏览器/WebGL 验证尚未完成。不要将本候选称为已验收成品。**

当前云端环境启动独立 Chromium 时出现 socket() Operation not permitted；支持的云浏览器内部预览地址返回 502 Connection refused。没有以图片、假模型、替换算法或关闭安全策略绕过验证。

## 文件

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

`tests/smoke.cjs` 需要已安装的 Playwright 与 Chromium。它是本测试环境准备的 file:// 浏览器检查，当前因执行环境权限未能启动。实际运行验证和视觉审查必须继续，不能由静态检查代替。

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
10. `textureDensity`、`shadowsEnabled` 没有有效绘制路径，不提供可操作功能；`diffusePower` 当前着色公式未使用，保留禁用数值并注明；布片 `useColorText=true`，颜色编辑在该预设中禁用

未实现长发物理、毛束碰撞、触手、骨骼/皮肤绑定、Unity/Unreal 导出、独立程序兔子或生产级视觉质量认证。

## 真实浏览器下一验收项

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
