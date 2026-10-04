# KAOPU 羽毛结构与运动案例

独立原创的浏览器 WebGL 2 羽毛模块，无外部运行依赖。羽轴为管状网格，羽枝、细羽枝和根部绒羽为三维 Bezier 曲线，细曲线在 GPU 中展开为面向相机的抗锯齿条带。没有图片平面或透明羽毛片，未使用第三方模型、纹理、视频或 HIP/HDA。

## 参考核对

已直接打开并目视检查用户两个原始链接：

- https://www.behance.net/gallery/196401535/Red-Wing-TruGuard-Lite （FutureDeluxe，Red Wing 工作靴广告，2024-04-17）。R&D 区展示五枚鸟类羽毛，浅色羽轴、灰黑羽片、羽片分束、根部绒羽及羽毛聚团动画。它不是蝴蝶翼鳞片项目。页面标注 All Rights Reserved。
- https://afdian.com/a/tinywang （当前显示 tinyHan）。为付费工程/HDA 会员页；未登录、购买或下载其文件。
- 同作者公开教程 https://www.bilibili.com/video/BV15ypozFEDY/ 的文字说明确认为 Houdini 21.0.440、Redshift、羽毛系统需 20.5 及以上。浏览器视频显示无法播放媒体，未声称完整观看教程。公开 Behance 的实际静态羽毛图已目视核对。

本模块从观察到的公开羽毛形态独立实现结构与受光，不复制其成片、素材或专有工程。Houdini 版本仅为参考来源；输出不是 HIP 或 HDA，也没有执行该应用。各向异性高光与动画均为实时近似，非 Redshift 离线渲染或 Vellum 仿真。

## 构建与测试

- `python3 build.py` 从 src 构建自包含 `index.html`
- `node --check src/study.js`
- `node tests/geometry.cjs` 仅验证 CPU 几何生成、有限数值、参数往返与生命周期；使用桩对象，不代表实际 GPU 成功
- `tests/qa.cjs` 导出 async(browser,url,out,check)。宿主提供真实 Chromium / SwiftShader，检查 GL 编译、像素、参数反应、前/侧/背/微距、结构视图、恢复、风动、宿主暂停恢复、窄屏及释放。产生结果 JSON 和截图；`thumbnail.jpg` 直接截图实际 WebGL canvas
- GPU 截图必须目视验收。浏览器手机尺寸模拟不等于实体 iPhone 验证

## 宿主接口

`window.FeatherStudy` 提供 ready / errors / stats / pause / resume / resize / dispose / reset / exportState / importState / set / diagnostics / renderAt。默认风动暂停，参数变化按需重绘。pause 取消 RAF 并保留用户播放意图，resume 按意图恢复，dispose 终止并释放 GPU 资源。

只处理同源 parent 发来的 `{kaopuFeather:true,type:'pause'|'resume'|'resize'|'dispose'|'reset'|'export'|'import',requestId?,data?}`；返回同标识的 ready/error/state/paused/resumed/disposed 等消息。宿主仅在点击时懒加载，退出即 pause。

状态导出格式为 kaopu-feather-study v1，包含参数、种子、相机、时间与播放状态。导入先完整校验后更新，拒绝非有限数值与超出上限数据。截图为用户当前 WebGL 图像。

建议隔离发布到现有工作台的 `qa/feather-study/`，第五目录卡与发布由统一负责人处理。不得改动或替换现有兔子、海葵、C4D 毛束及 Houdini 分区梳理。
