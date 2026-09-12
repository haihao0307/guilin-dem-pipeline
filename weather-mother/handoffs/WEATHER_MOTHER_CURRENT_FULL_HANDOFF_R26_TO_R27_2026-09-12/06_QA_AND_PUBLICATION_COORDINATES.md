# 06 · QA 与发布坐标

## 固定来源

R21：提交 `d6796df38a2cb872f58ff1f8ce72b5f36d8d2322`，文件 `weather-mother/aircraft-r21-20260908/index.html`。

R22：提交 `8aeb8dac519f8bda851cfc998e07266870d3eaef`，文件 `weather-mother/full-weather-r22-20260909/index.html`。

十云属 R0.2：提交 `029d2e564b65a0874af439232ca8856c42981a14`，文件 `weather-mother/deliveries/weather-mother-yohei-cloud-atlas-r02.html`。

R23：提交 `001a9e3dc028b3a7719ff8ab96bacdd7b8b1cac8`，文件 `weather-mother/full-weather-r23-mobile-cloud-first-20260910/index.html`。

R26：页面提交 `26c1b48fc48172ba64fe2d867f4f59a6584ccb33`，证据提交 `df296367d842e91279a42fc2616b7e0e441ca141`，文件 `weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html`。

## R26 已记录的自动结果

- 390×844 通过。
- 内部渲染尺寸为 242×523。
- 云体 variance 为 12244.25。
- 大尺度结构相关性约 0.9974314。
- 大尺度 MAE 约 0.92205。
- R25 光学探针：晴空 1.0，云缘约 0.5367，厚云约 0.07136。
- 飞行输入、云景切换、零横向溢出通过。
- sharedDepth 为 false。
- depthFBO 为 false。
- realIPhoneAcceptance 为 false。
- productionReady 为 false。

## 解释边界

R0.2 十云属旧 QA 的 WebGL 画布约 216×144；手机项主要验证 UI，不代表真实手机帧率。R21 在 RTX 4060 Laptop 与 Edge 上稳定完成帧间隔约 33.3 ms，并记录了初始化 light cache 的短暂停顿。用户真实 iPhone 的明确接受只到 R23 云体可见。

R27 必须新增首云帧时间、首交互时间、稳定帧时间、真机截图和用户视觉判断。
