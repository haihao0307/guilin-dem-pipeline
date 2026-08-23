# 桂林 v0.5 统一工作台 Stage A 交接

## 当前判定

候选版本继续保持 Draft 和发布锁定。Stage A 的目标是让用户在一个网页内检查全域、四核心、GAEA、水文、生态农业、季节和相机，不代表最终 DEM、水文或 GAEA 生产成果已经批准。

禁止在用户完成视觉验收前合并为正式版本。稳定回滚入口仍指向 v0.3.1。

## 已落实的工程合同

- `/web/guilin-v050/index.html` 是单页主入口，不使用 iframe 切换产品。
- 一个 WebGL2 画布、一套共享相机和一份共享状态驱动全域及核心区。
- 主 manifest 动态区分精确任务 AOI、网页上下文矩形、30 m 源 DEM、当前约 104.72 m 网页栅格和四核心包。
- 四个核心包均为 `800 × 800`、`12.5 m`、`10,000 m × 10,000 m`，位于 `web/guilin-v050/assets/cores/<core-id>/`。
- 四个核心显式共享 `verified-12.5m-mosaic-all-10`、`EPSG:32649` 和全局网格原点 `[378787.5, 2906250.0]`；高程与 mask 均为源窗口逐行原码裁切，无空间重采样、无二次量化。
- GAEA 浏览器近似预览和真实 Worker 构建采用两个明确状态。没有已配置且健康的授权 Worker 时，真实构建必须显示 `unavailable`。
- 水文运行时按每个源 LineString 或 MultiLineString part 独立生成中心线、水面、岸线、流向和断点批次，禁止跨段拼接。
- 水位和河宽采用两个独立倍率；水位 `0.15 至 1.5`、河宽 `0.4 至 2`，默认值均为 `1`。
- 春、夏、秋、冬以及 1940 至 1945 年是可操作状态。
- 共享相机提供 50 m、2 m、1.7 m 三个验收高度，移动端保留可见触控方向键。
- 发布门槛在主 manifest 与 `projects/guilin/config/release_gate_v050.json` 中保持关闭。
- 浏览器资源 404 数和控制台错误数在尚未执行 Stage A 浏览器验收时保持 `null`，诊断状态为 `unmeasured-until-stage-a-browser-run`，不预填零。

## 数据真实性状态

| 项目 | 当前事实 | 对批准的影响 |
|---|---|---|
| 精确任务 AOI | `18,831.3276779 km²` | 面积从 manifest 读取，不使用旧的固定 5,000 或 20,000 km² 文案 |
| 连续全域网页地形 | 网页上下文矩形为 `32,575.041 km²`；完整 30 m 源 DEM 经 bilinear 降采样为 `1452 × 2048`，当前网页采样间距为 `104.720882 × 104.728872 m` | 覆盖连续，但当前二进制不是 30 m 像元；连续 12.5 m 任务范围仍缺 `60.45671875 km²` |
| 真宝鼎核心 | 800 × 800；有效像元 639,737；缺失 263 | 缺口由 mask 保留，状态必须显示 incomplete |
| 其余三个核心 | 800 × 800；有效像元各 640,000 | 与真宝鼎共享同一 mosaic、CRS、12.5 m 网格原点，可用于 Stage A 地形检查，仍需用户逐核心视觉确认 |
| GAEA Worker | 默认未配置 | 只能验收浏览器近似预览和真实的 unavailable 状态，不能宣称已获得 GAEA 构建结果 |
| 水文 | 使用现有 OSM 具名河网输入并按源 part 分段 | 漓江、湘江的最终连续性和历史重建仍需视觉及拓扑证据 |
| 生态农业 | 历史重建预览，非测绘植被 | 可检查规则和视觉，不能表述为历史逐株真值 |

## 机器验收

严格门槛位于：

```text
tests/test_guilin_v050_stage_a_workbench.py
tests/test_guilin_v050_recovery_runtime.py
tests/guilin_v050_stage_a_browser.mjs
```

运行：

```bash
python -m unittest discover -s tests -v
python DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/scripts/build_guilin_v050_cores.py --check-only
node --check tests/guilin_v050_stage_a_browser.mjs
```

该测试覆盖：

1. 主入口无 iframe，四个工作区和四核心在同一文档。
2. 主入口实际导入 GAEA、水文、核心加载和生态运行模块。
3. 面积、30 m 源分辨率、约 104.72 m 网页栅格间距、bilinear 降采样和回退状态从 manifest 动态读取。
4. 全域二进制尺寸、SHA-256、全有效 mask，以及 `extent / (grid - 1)` 推导的网页采样间距。
5. 四核心 800 × 800、12.5 m、10 km 方形、同一 mosaic、CRS、全局像元原点和像元中心约定。
6. 核心二进制尺寸、SHA-256，以及 height/mask 两类源窗口逐行字节完全一致。
7. 核心加载器切换两个核心时保留不同 manifest 和高程数组，不把四按钮别名到同一数据。
8. GAEA 无 Worker 时保持浏览器近似预览和 unavailable；模拟 Worker 健康、进度和结果协议时只把真实结果标记为 authoritative。
9. 水文 MultiLineString 分段、批内索引、夏冬水位、水位倍率、河宽倍率、陆生植物排除和零跨段连接。
10. 四季、1940 至 1945 年、生态农业类别、风向风速、根部固定和水文排除。
11. 50 m、2 m、1.7 m 三高度和触控方向键真实事件接线。
12. 发布锁定、Draft、稳定回滚入口、未测错误计数和 JavaScript 直接语法检查。

2026-08-23 在 Python 3.12.13 与 Node 24.19.0 环境执行全量发现，结果为 `Ran 17 tests`，`OK`；四核心构建器 `--check-only`、五个运行时模块和浏览器脚本语法检查均通过。旧 recovery 测试已改为防止回退到 iframe 与源码修补壳的回归门。

浏览器脚本会在 Windows runner 上分别使用系统 Chrome、系统 Edge 和 `390 × 844` 手机视口，强制收集 HTTP 404、请求失败、console error 和 page error，并输出 GAEA 前后、四核心三高度及手机触控截图。只有 GitHub 上真实运行结束后，才可以把这些计数记为零或宣告对应浏览器通过。

CI 文件：

```text
.github/workflows/guilin-v050-stage-a-qa.yml
```

## 仍未完成或不能在本交接中声称通过

- 连续全域 12.5 m DEM 仍有已登记缺口；当前全域网页栅格约 104.72 m，不得以 30 m 当前像元或全域 12.5 m 对外表述。
- 真宝鼎核心仍有 263 个源缺失像元，当前没有填补或伪造。
- 授权 Windows GAEA Worker 未配置，也没有真实构建结果。
- 尚未取得用户视觉批准。
- 首次提交前尚未产生 Windows Chrome、Edge、手机视口的 GitHub Actions 证据和截图；不得提前把计数写成零。
- 匿名验收将使用绑定提交 SHA 的 raw.githack 路线，不触发 Pages 发布；必须在 push 后对真实 SHA 重新验证。
- 水文连续性、河岸排除和四核心 1.7 m 近景质量仍需网页逐项检查。

## 用户网页验收顺序

1. 首次打开确认出现完整全域地形，并核对任务 AOI、网页上下文、30 m 源 DEM、约 104.72 m 网页采样、bilinear 降采样和 12.5 m 缺口文案。
2. 依次进入真宝鼎、桂林古城、秧塘机场、阳朔县城，确认地形互不相同，范围均为 100 km²；真宝鼎明确显示缺口。
3. 在 GAEA 浏览器模式调整垂直强调、喀斯特、侵蚀和沉积，观察同一画布即时变化并复位。
4. 切到 Worker 模式，未配置时必须显示 unavailable；禁止出现假成功。
5. 分别开关漓江、湘江、主要支流、中心线、水面、岸线、流向和断点，检查无跨空直线与跨段水面。
6. 切换春夏秋冬和 1940 至 1945 年，确认稳定地形不移动，植被、农田、风和水位按状态变化。
7. 四核心分别检查 50 m、2 m、1.7 m，确认相机不穿地、不沉水、近景不消失。
8. 手机竖屏打开控制器并使用触控方向键，确认所有验收控件仍可到达。
9. 检查浏览器控制台无错误、网络资源无 404，再保存 Windows Chrome 和 Edge 验收截图。
