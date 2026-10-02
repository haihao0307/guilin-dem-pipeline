# R04 交付复核 · 2026-10-02

## 本轮交付范围

沿用已建立的材质总台与 R04，不重建、不覆盖 R03。R04 是用户授权的材质衍生实验：十种配色、六种表面预设、独立滑块、GGX PBR 模式、七个观察通道、材质谱导入/导出、同镜头十色图集。

固定入口：
- 材质总台：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/
- R04：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-wet-stone-material-workbench/r04-20261002/
- 老师原视频对照 R03：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-wet-stone-material-workbench/r03-20261002/

## 源码连续性

本轮从 GitHub 读取并在工作容器核对 Git blob SHA，五个执行文件全部一致：

| 文件 | Git blob SHA |
|---|---|
| index.html | 2903fefbb02a3316bcce0dd476aeaa20f1d8eb9e |
| app.js | b079ac6edc227dcb32bc2d4bb6bb59e2aa467a33 |
| material.glsl | 9d2a6e0b4f5a3a1f3d83c79a3756e5b7dd75c18f |
| teacher.frag | fa564ebdf4a5642289e6123c54ae6c58d9bc6201 |
| style.css | cb17ee9bcf3f8c06191ef121257cfb711a70a8e9 |

老师片元 SHA-256：f03a5c354f54bef8d9c7d3e9b1b406e34e8a93759e592fb4d30ef1558a09e4db。

## 本轮实际重跑

环境：Chromium 144、Xvfb、ANGLE SwiftShader。执行与 GitHub 字节一致的 JS/GLSL，使用内存资源加载和 SHA-256 计算桥接。网络和 localhost 导航在此浏览器环境受限，未伪称浏览器在线访问 Pages。

发布源码默认左右缓冲区均为 960×540。默认画面、苔裂画面及最终十色图集均实际以该缓冲区渲染再截图。批量功能回归临时使用 320×180 测试缓冲区，没有修改发布默认值，也没有处理/降质老师录像。

通过的检查：
- 十种配色得到十份不同的渲染结果。
- 仅切换颜色时，白模几何检查结果保持不变。
- 六种表面预设均产生不同结果。
- 七个观察通道均可切换。
- 裂纹深度和苔层厚度能改变白模表面，不仅是底色变化。
- PBR/老师光照词汇切换、光源角度控制产生不同结果。
- 反复修改右侧后，左侧复刻基线保持不变。
- 右侧还原基线检查通过。
- 材质谱序列化往返、文件导出和文件导入检查通过。
- 非法石材金属度谱被拒绝。
- 十色图集生成十张，生成后恢复原材质谱。
- 鼠标拖动和开始/暂停旋转按钮通过。
- 用户原片 capture (11).webm 实际载入为 960×540、10.767 秒；返回基线画面操作通过。
- 390px 移动布局没有横向溢出。
- 两个 WebGL 上下文错误码均为 0；运行没有 JS/控制台错误。

## 部署检查

R04 的 gh-pages 发布提交为 8c05ca08e93722d7296b5e1ea91a95c12a784f8f；GitHub Pages workflow 36987095797 已完成，结论 success。总台主入口已经指向 R04，同时保留 R03 入口。

此检查确认源码、功能回归及服务端部署状态，不等于目标用户设备性能或完整线上浏览器端到端测试。目标 GPU 帧率未测。材质细节、青苔形态和 PBR 物性仍需用户视觉验收及后续标定。

## 保留边界

GGX/Smith/Schlick 用于直接光；环境是程序摄影棚近似，不是完整预过滤 HDRI/全局光照。裂纹和青苔是可调艺术规则，不是断裂/生态模拟。原老师高频颗粒仍属于法线层。当前不是独立通用材质生成器，也未声称已训练/运行 DINOv3、DensePose 或 Gram anchoring。

TDM / Alexander Alekseev《Wet stone》(2014) 的 CC BY-NC-SA 3.0 署名与非商业限制继续保留。未取得商用授权。
