# KAOPU 绞束毛发独立研究

独立、自包含 WebGL 2 模块。根据用户参考截图中的绞束与散开端可见结构，以及 Maxon 官方公开 Hair 指引独立实现。没有原作者工程，也未复用 Maxon 专有代码。默认运行时无第三方依赖或网络请求。

## 构建与验证

运行 `python3 build.py`，生成 `index.html`。本地可直接打开此 HTML。真实 WebGL QA 使用官方 Playwright 1.55 Chromium/SwiftShader：设置 `FIBER_ROOT` 和 `FIBER_QA_OUT` 后运行 `node tests/qa.cjs`。测试产物必须目视查看；脚本通过不自动代表视觉验收。

## 实现

固定 seed 与少量导向规则生成细丝中心曲线；GPU 根据同一中心曲线展开面向相机的细丝带，使用切线方向的各向异性高光近似。绞转、收束、散端、局部扰动、根尖粗细与函数动画由同一组参数控制。不是碰撞仿真，也不是 Redshift 的光线追踪或多次散射。

## 宿主接口

页面就绪后 `window.FiberStudy` 暴露 `ready`、`errors`、`stats`、`pause()`、`resume()`、`resize()`、`dispose()`、`reset()`、`exportState()`、`importState(data)`。`pause()` 取消后台 RAF；`resume()` 保持当前时间与用户播放状态；`dispose()` 删除 GL 程序和 VAO 并断开尺寸观察。

同源父级可发送 `{kaopuFiber:true,type:'pause'|'resume'|'resize'|'reset'|'dispose'|'export'|'import',requestId?,data?}`。子页仅接收 parent 的消息，回传 `ready`、`error`、`paused`、`resumed`、`reset`、`imported`、`state`、`disposed`。`state.data` 是导出的完整描述。

建议宿主点击第三项后才创建 iframe，离开时 pause，永久卸载前 dispose，再移除 iframe；不要首页预加载此模块。真实渲染缩略图需要从 QA 画面生成。宿主最终整合由工作台维护者执行。

推荐候选路径 `kaopu-hair-workbench/qa/c4d-fiber-study/index.html`。只在该目录发布模块，勿覆盖主工作台、其他项目或共用测试工作流。

## 学习来源

- https://help.maxon.net/c4d/2026/en-us/Content/html/OHAIR.html
- https://help.maxon.net/c4d/2026/en-us/Content/html/6255.html
- https://help.maxon.net/c4d/2026/en-us/Content/html/MHAIRMATERIAL-HAIRMATERIAL_GROUP_CLUMP.html
- https://help.maxon.net/c4d/2026/en-us/Content/html/COM_REDSHIFT3D_REDSHIFT4C4D_NODES_CORE_HAIR2.html
