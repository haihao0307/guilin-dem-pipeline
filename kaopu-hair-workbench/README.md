# KAOPU 毛发工作台 · r03 海葵学习样件

同一个工作台包含两个真实实时 WebGL2 模块：

- **海葵**：参考 OIST 的 Heteractis magnifica 照片与公开生物资料，独立程序化口盘、体柱、足盘、360 根默认钝指状触手。可调整数量、长度、半径、静态弯曲、种子、水流方向/节奏/强度/局部噪声；暂停、时间归零、相机、JSON 与 PNG 导出
- **兔子/布片**：保留 r02 的 SEDDI 原始老师与可编辑副本，毛长、Shell/Fins、Perlin 参数、光照、GPU 梳理及复位等行为保持不变

固定入口：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-hair-workbench/

## 当前版本与验证

Build：`2026-10-03-anemone-r03`

单 HTML：14,121,309 字节；SHA-256：`2b0392ab64f1a8c69d92af8cde640348196f9ea630140b18718f6d6fba0108ed`。

候选提交：`8a5d9f682f98d30ab417bd42a683d0f322f3b25f`。同内容的隔离候选在 [Chromium CI 37091142867](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37091142867) 通过 86 项检查；固定主入口的最终公开验证状态单独记录在 `qa/PUBLICATION_PROOF.json`，不能拿旧版记录替代。

已独立检查桌面、390×844 视口与两个时间姿态。当前形态通过“可供观察和操作的海葵学习样件”阶段检查；这不是真实成品、物种一比一复刻或 AAA 验收。

## 能证明什么

- 同一单文件的 file://、HTTP 和候选公网，真实有色三维像素、JS/GL 零错误、file:// 核心外部请求为零
- r02 兔子恢复后的像素仍为原来的 FNV 哈希 1090190271；20 个老师模块、10 个运行资产与全部 78 原档字节未变，host.js/frame.js 也未变
- 海葵按同一口盘三角网格进行重心插值附着，根位置稳定，每条中心线通过逐段单位化保持弧长
- 固定 seed 与 time 可复现；形态参数确实改变三维像素；完整复位和 JSON 状态 roundtrip 恢复原像素
- 自动播放确实推进时间与帧数，暂停冻结；相机与运动独立；反复切换及兔子换模型期间切走不会卡住
- 两种模块均实际下载 PNG；系统文件选择器和触屏手势没有验收

在该 Chromium SwiftShader 测试机，自动播放观测窗口 1.213 秒新增 27 帧，约22.26 fps。这只是测试机观测。drawMs 是 CPU 加 WebGL 提交耗时，不是独立 GPU 时长。没有实体 iPhone/Safari 或硬件性能认证。

## 形态与算法边界

海葵采用参考约束的静态弧线、局部方向组、根部约束、分段定长、圆截面与半球端帽。程序水流是独立实现的平滑标量 value noise 加有界振荡，不是 Perlin/Simplex、流体解算或流固耦合。其数值是形态调参，不是米/秒或实验标定。

真实参考的肉质半透、微表面、密集局部簇、互相接触和礁底附着环境尚未达到；当前仍有光滑硬管感和相互穿插。体柱的个体比例没有量测。没有生成小丑鱼模型、主动收缩/捕食、触手碰撞、人类头发/长发动力学、骨骼蒙皮或 Unity/Unreal 导出。

第一次形态候选虽通过技术检查，但因近直刷毛、过尖端帽、裸露规则口盘与手机裁切未晋级。第二次只修这些参考偏差；两轮证据分别保存，不将旧截图冒充新结果。

## 来源与许可

- SEDDI：[AEspinosaDev/WebGL-RealTimeFur-SEDDI](https://github.com/AEspinosaDev/WebGL-RealTimeFur-SEDDI)，固定 `cca0432bef548a9853f34d89788c5d2761e57d56`，MIT，Antonio Espinosa Garcia；完整许可证和第三方注释在 teacher-original 中保留
- 海葵照片：© OIST (Okinawa Institute of Science and Technology Graduate University), 2022-10-19，[原始来源](https://www.oist.jp/image/heteractis-and-stichodactyla-giant-sea-anemones)，[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。页面显示官方720×240展示图的左1/3，明确标注缩略与CSS裁切；4283×1429原图另行原样归档。没有生成或改画参考
- 形态资料：[Animal Diversity Web](https://animaldiversity.org/accounts/Heteractis_magnifica/)
- 一般运动依据：[SICB 海葵野外水流研究](https://sicb.org/abstracts/sea-anemone-tentacles-flutter-and-flap-in-water-flow-in-the-field-/)，研究对象是另一物种 Aiptasia diaphana；不声称本例获得 H. magnifica 的实测参数
- 视频仅是已核验的可选外链，未打包或宣称逐帧复刻

没有执行或复制新的第三方海葵项目。没有复制 Unity Companion 受限源码。

## 开发文件

- `src/workbench.html`、`src/host.js`、`src/frame.js`：冻结的 r02 兔子模块
- `src/anemone-core.js`：确定性形态、根与定长中心线
- `src/anemone-renderer.js`：独立 WebGL2 网格/管截面/着色器
- `src/anemone-host.js`、`src/anemone-panel.html`、`src/anemone.css`：模块切换与海葵操作界面
- `build.py`：构建时包装两个模块、内嵌所有必需资源，产出一个 HTML
- `tests/static.cjs`、`tests/controller.cjs`、`tests/anemone-core.cjs`、`tests/browser-qa.cjs`：不同层级测试；静态/控制器通过不能代替真实浏览器
- `references/anemone/REFERENCE_COVERAGE.json`：来源对应、未知范围与第一轮纠偏

完整源包可用 Python 3 重建，不需要安装运行依赖：

```sh
python3 build.py
node tests/static.cjs
node tests/controller.cjs
node tests/anemone-core.cjs
```

GitHub在线目录中的 index.html 本身已包含全部核心资源。完整老师原档保留在原始源包；仅克隆在线目录不等于取得完整重建输入。

## 三维交付检查

- [x] 没有用生成图片替代真实三维
- [x] 实际修改生产源码
- [x] 用户操作的画面来自实时三维运行时
- [x] 同内容候选的 file://、HTTP、公网真实浏览器已验证
- [ ] 用户视觉验收与 productionReady

固定主入口是否完成本次晋级，以当前 PUBLICATION_PROOF 为准。若只有截图而没有工作台，本轮不能作为交付。没有同步或修改 ChatGPT Game 项目文件。
