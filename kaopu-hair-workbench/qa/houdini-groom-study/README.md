# KAOPU Houdini 分区梳理案例

原创程序化人头与分区毛发。依据用户视频和 Denis Zen 的 From Hick to Hipster 公开教程学习分区、引导方向、多尺度发束与局部 Frizz，未复制原工程、人头、贴图、付费插件或专有代码。运行时自包含 WebGL 2，无外部网络依赖。

## 构建

运行 `python3 build.py` 得到 `index.html`。JS 静态检查：`node --check src/study.js`。

## 实现

原创参数化头模包含鼻梁、眉弓、眼窝、下颌、眼睑、耳廓、嘴唇、颈部和肩胸。固定种子从头模采样根点，头顶、侧后短发、胡须、上唇胡及眉毛分别生成。GPU 按导向函数、两级聚束和稳定局部细节展开面向相机的发丝带。头顶沿头皮曲面生成侧后梳路径，胡须具有区域长度，上唇胡具有独立外翘曲线。

成稿、同源抽样引导线、分区、分束四个视图共用参数与几何函数；分区开关、侧梳、顶部蓬度、长度、胡须、翘胡、clump、frizz、密度、高光、颜色可调。导出完整对象参数、随机种子、相机及时间，导入有数值和类型校验。

毛根由静态生成约束固定，未实现动画头皮跟随、风场、碰撞或动力学。播放是环绕相机。材质是实时各向异性受光近似，非原生 Houdini 或 RenderMan。默认停止环绕，避免背景持续消耗 GPU。

## 宿主接口

`window.GroomStudy`：`ready`、`errors`、`stats`、`pause()`、`resume()`、`resize()`、`dispose()`、`reset()`、`exportState()`、`importState(data)`、`diagnostics()`、`set(partialState)`、`renderAt(time)`。时间在 `exportState().time`，不在 `stats`。

同源父级发送 `{kaopuGroom:true,type:'pause'|'resume'|'resize'|'reset'|'dispose'|'export'|'import',requestId?,data?}`。子页只处理来自 parent 的消息；响应包含同一标识及 `ready`、`error`、`paused`、`resumed`、`disposed`、`reset`、`imported`、`state`。

离开模块调用 pause，取消 RAF；返回调用 resume，恢复之前的播放状态。dispose 释放 GPU 缓冲、着色程序、VAO 与事件，之后不能再改状态。宿主仅在用户打开时创建 iframe，不应首页预加载。

## 验证

`tests/qa.cjs` 导出 `async(browser,url,outDir,check)`，自建和关闭 context，不关闭传入 browser。真实 GPU 验证由工作台现有 GitHub Actions 路线统一执行。测试包含实际像素、不同视角、参数变化、同源诊断视图、区域显示、导入导出、相机播放、宿主生命周期及手机窄屏。截图需要独立目视验收；代码断言通过不能替代外观验收。

建议发布路径 `kaopu-hair-workbench/qa/houdini-groom-study/`。工作台统一负责人负责接入、缩略图、发布和旧案例回归，本目录不修改现有案例。

## 原始依据

- https://renderman.pixar.com/from-hick-to-hipster
- https://www.sidefx.com/ja/tutorials/from-hick-to-hipster/
- https://www.sidefx.com/docs/houdini/nodes/sop/guideadvect.html
- https://www.sidefx.com/docs/houdini/nodes/sop/hairclump.html

原教程项目下载已找到，但未核实资产商用和再分发许可，因此本实现不使用其资产。用户视频和参考帧不随模块上传。
