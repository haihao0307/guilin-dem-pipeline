# 小温州 DEM 干净重启与按需重构系统 R1

日期：2026年9月7日

用途：只面向“小温州”当前 DEM 生产线。它不是新的大而全教材，也不替换 World Kernel、Object DNA、Ocean 或 Weather 教材。本文件只回答一件事：小温州怎样把现有杂乱运行时清干净，只保留真实数据和必要接口，然后用可逆多尺度与按需查询重新建立 DEM 核心。

状态：`reviewed_candidate`。当前不直接删除生产文件，不改变人工验收状态。

## 1. 先认清当前真值

当前新温州陆地真值身份来自 17 片源数据裁出的 COG：

`WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif`

`bytes=136760745`

`sha256=c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43`

`grid=17555 × 17918`

`spacing=12.5 m`

`CRS=EPSG:32651`

`dtype=int16`

`NoData=-32768`

旧 Qingjiang 22,000 km² 高程已经退役，只保留历史，不再进入新温州活动计算。

当前 V0.6.0 分支已经做过真值预检、七级确定性抽点金字塔和局部真实 12.5 米实验，但完整 17 片 COG 二进制在该分支运行环境中仍记录为未挂载。这个状态不能被“假装已经全域重算”覆盖。

## 2. 新系统先做减法

新温州活动核心只允许读取 `projects/wenzhou/...` 下明确绑定为温州的数据。共享仓库根目录里的桂林合同、EPSG:32649 AOI、桂林水文或其他项目文件不得因为路径方便而被温州自动读取。

清理分三类。

### 永久保留

陆地 DEM 真值、源包身份、AOI、坐标系、NoData、哈希、覆盖 QA。

来源可追踪的海底数据及其质量标记、垂直基准说明和哈希。

来源可追踪的海岸线、岛屿、河流、溪流、运河、潮沟等水文数据，以及 OSM way ID、原始查询和许可记录。

已经算过且能回溯到真实来源的水文、海底、潮位数值和 QA 记录。未完成基准统一或实测验证的潮位结果继续标成 `candidate/blocked`，不能升级为真值。

### 只保留为历史参考，不进入新运行时

V0.5.9 和 V0.6.0 旧网页、旧视觉着色、旧海面显示代码、旧实验截图、旧天气和云实现、旧方块海面、旧视觉湿润区、旧调色、旧大气效果、旧生成地貌细节。

原有七级抽点金字塔和 Clipmap 可以作为性能对照，但不再被当作最终世界模型。

### 新运行时直接不带

旧 Weather/Cloud 模型，包括 R13 云合成、十云属渲染、旧云影、天气调色和相关控制。Weather Mother 完成新系统以后再通过只读接口接回。

旧 Ocean 表面、静态海平面、合成水面、为了遮挡问题而存在的海面残渣。Ocean Mother 完成新水体系统以后再接回。

任何 30 米替代、旧 Qingjiang 高程、合成填洞、手工河流、手工海岸线、为了遮粗糙而加的几何噪声。

注意：这里的“删除”首先指从小温州新的活动构建、运行时和依赖图中删除。共享仓库历史和冻结分支保留恢复能力，不为清理温州而误删其他项目资料。

## 3. 小温州新的 DEM 核心只分四层

### A. Canonical Truth

原始 12.5 米高程永远只读。

核心函数：

`heightTruth(x,y)`

它只回答真实 DEM，不加天气、不加海浪、不加 Microscope、不加视觉噪声。

### B. Constraint Anchors

用少量点、线、掩膜保护最重要的地貌语义。

点：峰顶、鞍部、必要控制点。

线：山脊、谷线、河道、左右岸、海岸线、断崖等。

掩膜：陆地、海域、NoData、特殊保护区。

其中从 DEM 自动提取的峰脊谷线属于 `derived constraint`，必须记录算法版本；OSM 海岸和河道属于外部来源约束。二者不能混成同一种“真值”。

### C. Reversible Multiscale Store

候选目标：把规则 DEM 写成可逆二维多尺度表达：

`H = H_coarse + Σ D_level`

第一轮优先测试整数到整数的可逆二维 lifting wavelet。系数计算用足够宽的整数类型，避免 int16 中间溢出。所有残差完整保留时，必须做到：

`decode(encode(H)) == H`

逐像元误差严格为零。

随后才允许对系数做无损熵编码并测真实字节数。

不承诺 300 MB 一定压成多少。压缩率只由真实温州数据实验给出。

### D. Observation Reconstruction

运行时不再使用“几套 LOD 世界”的概念。

相机、屏幕像素覆盖范围、焦点、交互和物理需求共同提出 `PrecisionRequest`。系统只解码当前需要的频带。

远处保留山体主轮廓、山脊、海岸和河谷。

靠近后逐渐加入更短尺度的 DEM 细节。

只有进入测量精度以下时，Landscape/Microscope 才能提供程序化微观层，而且必须满足 `A_micro=0` 精确返回 DEM 运行时基线。

## 4. 海床、水文和海面要彻底拆开

海床是地形数据的一部分，但其来源、分辨率、质量和垂直基准必须单独登记。GEBCO 等海底数据不能在基准未统一时直接与陆地 DEM 熔成一个声称完全同基准的真值面。

水文保存的是河、岸、岛和通道身份及几何来源。

潮汐是：

`eta_tide(x,t)`

海浪是：

`eta_wave(x,t)`

Ocean 完成以后，当前水面由 Ocean 状态产生：

`eta = eta_tide + eta_wave + eta_local`

水深查询才使用：

`depth=max(0, eta-z_bed)`

所以新的 DEM 核心不保存永久海面。DEM 只提供陆地/海床和边界查询。

## 5. 第一轮先别碰全温州

先做一个真实温州子窗口。

优先复用 R12/R13 已经核实过来源身份的真实 12.5 米窗口。如果这个窗口的源像元范围和哈希不能完整恢复，就在精确 17 片 COG 可用后重新裁一个整数像元窗口，重新算没有关系。

第一轮只做三项比较：

1. 原始 int16 窗口。
2. 可逆多尺度编码后完整解码，要求逐像元零误差。
3. 只解码部分频带，检查固定相机下的轮廓、峰顶、脊谷、河岸、海岸误差和运行成本。

同时记录：原始字节数、编码字节数、解码时间、单点高度查询时间、固定视角需要的系数比例、峰顶位移、河岸/海岸偏差。

只有这个实验通过，才扩到完整 17555 × 17918。

## 6. 小温州的干净活动目录建议

新执行线最终只需要类似：

```text
projects/wenzhou/dem-kernel/
  truth/
  marine-truth/
  hydrology-truth/
  constraints/
  transform/
  runtime/
  qa/
  CONTRACT.json
```

`truth/` 只是真值身份和实际真值数据。

`marine-truth/` 只放海底来源和质量信息。

`hydrology-truth/` 只放来源可追踪水文。

`constraints/` 放点线掩膜及其来源。

`transform/` 只负责可逆编码与解码。

`runtime/` 只负责查询、按需频带、缓存和 GPU 上传。

`qa/` 只保存误差、哈希、性能和浏览器证据。

Weather、Ocean、生态、农业、材质都不住在 DEM Kernel 里，只通过接口接入。

## 7. 旧 V0.6.0 合同怎样处理

保留 V0.6.0 合同和 R12/R13 作为历史实验，不覆盖历史。

它已经证明的真值预检、共享边 QA、缓存/取消思路可以复用。

它的固定七层 12.5 到 800 米金字塔属于旧运行策略，可以作为基准比较。新系统如果可逆多尺度更小、更连续、更容易按需查询，就替换它；如果实测不如旧方法，则保留旧方法的有效部分。

V0.6.0 里“冻结旧 Weather/Cloud”这一条对新干净线取消。新 DEM 线明确 `weatherRuntimeIncluded=false`。

## 8. 开工门禁

小温州开工前必须先交一张 `KEEP / ARCHIVE / DROP` 清单，至少覆盖：

17 片 DEM 真值。

海底数据。

海岸和水文数据。

潮位数据及验证状态。

旧地形金字塔。

旧海面。

旧 Weather/Cloud。

旧网页和视觉效果。

任何来源说不清、哈希说不清、用途说不清的运行资产默认 `DROP_FROM_ACTIVE_RUNTIME`，不允许因为“可能以后有用”继续背着。

清理完成后的第一张页面可以非常朴素，只要有真实地形、真实海底/水文诊断、相机和高度查询即可。先把世界关系做干净，再等新的 Weather Mother 和 Ocean Mother 接回来。

## 9. 当前一句话合同

**小温州先退回到真实陆地 DEM、海底和来源可追踪水文，清掉旧天气与旧海面运行时；用可逆二维多尺度保存 12.5 米真值，用点线掩膜保护地貌语义，用观察与物理请求决定当前解码频带；测量分辨率以下的细节以后再交给 Landscape/Microscope，动态水面以后再交给 Ocean。**

当前状态：

`wenzhouCleanRestartGuidance=true`

`truthChanged=false`

`weatherRuntimeIncluded=false`

`oceanRuntimeIncluded=false`

`losslessCompressionRatio=unknown_pending_real_test`

`productionIntegration=false`

`visualAcceptance=false`

`productionReady=false`
