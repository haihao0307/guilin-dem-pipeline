# R3.8：同一地点的土壤与历史水体证据

R3.7 只有 0–5 cm 土壤属性。R3.8 在同一工作台加入六层 SoilProfile、WRB 官方分类/单类概率/派生分类/差异，以及 JRC 六类历史水体指标。查询入口返回同一 EPSG:32651 地点下的八类证据引用；引用不等于该点已存在有效观测，使用时仍须检查来源掩膜和时间。

## 来源与语义

- 从永久 Release 校验恢复 physical_texture、chemical_carbon、hydraulic、JRC 四个 ZIP。source bytes/hash 见 SOURCE_RETRIEVAL.json。
- 土壤六深度 × 八属性 × 中位数/相对 uncertainty，共 96 层。0–5 cm 直接引用 R3.7 文件；其余从锁定对齐 TIFF 无损输出 int16。合计 170,237,184 字节，默认只读两个所选文件。
- WRB 官方分类、30 个概率分数及原差异审计原封保留；不会强制概率和为 100%。R3.7 CURRENT 的旧 bilinear 指控已被交接审计纠正，不沿用。
- JRC 固定来源为 30 m 对齐栅格；本工作台使用 250 m nearest 抽样，合计 5,319,912 字节。这是稀疏显示抽样，可能漏掉小水体，不能代表 250 m 面积比例或原生 30 m 全量浏览。
- JRC occurrence/recurrence/transitions/change 为 1984–2024，seasonality/extent 保留 2022–2024 部分标签。图例来自官方 QML，包括 change 253/254/255 的非水体/无法计算/NoData。来源说明 https://global-surface-water.appspot.com/download 。Source: EC JRC/Google。
- 环境覆盖仅贴在已有地形曲面上，不生成当前水面或修改 DEM。JRC 在当前海域没有地形曲面时不会被显示，不据此宣称那里没有历史水体。

## 运行时

一个环境模式选择器；土壤时提供 property/depth，概率时提供 class，水体时提供 product。非当前声部不预加载。两个运行时各保留最多四个原始数组，快速切换会中止过期请求并释放覆盖网格、材质和纹理。网络/哈希错误给出可见失败和重试，错误不能留下旧证据冒充新结果。

## 复核

静态校验全部浏览器载荷、栅格参考架、WRB argmax/difference、时间范围与历史文件冻结。
继承 QA 保留 R3.7 的八属性、道路建筑计数、海面、WorldCover、1.600 m 相机和 390×844 回归。
新增浏览器 QA 包括六深度、四种 WRB 模式、概率切换、六水体指标、独立二进制点查询、真实像素开关、快速切换、引用可达性、手机布局、网络失败重试。

## 重建

Python requirements: numpy==2.5.3, rasterio==1.5.1。先按 handoffs/ 下 SOURCE_LOCKS 获取并校验四个源 ZIP，把 tools/r3-8/reference/*.qml 放在同一 evidence 目录，再执行：

    python tools/r3-8/build_profile_water.py --evidence <evidence-directory>

WRB 不需重建。浏览器 QA 使用 Playwright；可设置 CHROME_CHANNEL=chrome 使用已安装 Chrome。R38_URL 指定目标，QA_OUTPUT 指定报告和截图目录。

本地 Chrome 成功不等于公网成功，也不等于真实 iPhone 或用户视觉验收。PUBLIC_BROWSER_QA 和 CURRENT 只在固定提交实际通过后更新。
