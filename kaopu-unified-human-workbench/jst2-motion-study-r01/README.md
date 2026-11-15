# 动作研究室 · JST-2 独立实验 R01

独立网页：回放官方公开的6种JST-2骨骼动作，并试验重定向到原有R07完整人物。没有调用付费生成接口；没有替换自有人物；尚未综合到现有平台。

## 来源

- 官方介绍及交互样本：https://viggle.ai/jst2#motion
- 官方动作研究：https://viggle.ai/research/jst2-motion
- 自有人物固定源：haihao0307/guilin-dem-pipeline @ 5543f756ca3af1428323696324303fa70b8de850 / kaopu-unified-human-workbench/human-integrated-r07/preview.html
- 原始hot数据、皮肤纹理源及SHA256见 native-runtime/SOURCE_LOCK.json。原始文件未修改。
- 6个官方样本URL由官方交互页面实际加载资源核对，完整URL见 app.mjs。样本保留于官方CDN，页面从公开地址读取；页面无法保证第三方CDN永远可用。

## 运行

Python 3 与 Node.js 18+，无需 npm 依赖。

```sh
python3 native-runtime/prepare.py
node native-runtime/build.cjs --dist
python3 build-study.py
```

静态产物在 dist/。正式页面需要 HTTPS 和 WebGL2。浏览器读取 gzip/GLB 的骨骼轨道；本地导入只接受内嵌buffer的GLB，不上传文件。

## 功能

- 闪避下蹲、前踢、旋转、扫描行走、刷牙、快速打字。
- 源骨架与自有完整人物同步播放，暂停、30fps时间步进、0.25x/0.5x/1x、拖动时间轴。
- 源骨架旋转/缩放，完整人物正面/侧面/复位，骨架叠加。
- 按目标原始104骨层级与骨长做语义映射，保留266098显示顶点和完整CSR权重。
- 真实数据诊断、映射列表、每帧骨长和有限值检查。

## 边界

这是动作输入与骨架适配实验。没有接入在线文字/视频生成、脚锁定、物体接触、碰撞或行为状态机。人物面部辅助骨、未映射辅助骨随父级运动；不宣称完整复现源MetaHuman的全部矫正骨。循环直接回到起点，不代表已经解决过渡。手部和肩髋变形需要视觉判断。

## 文件

- ui/: 交互界面与样式。
- app.mjs: 播放控制、骨架绘制、状态与本地导入。
- motion-data/: 独立GLB动画解析、插值和语义重定向。
- native-runtime/: 原有R07运行时装配与静态资源准备。
- NativeBinding.mjs / NativeRig.mjs: 已有自有代码的冻结版本。

完整人物、渲染材质与权重采用项目原有版本。官方动作不标为自有原创，也不标为本次实时生成。
