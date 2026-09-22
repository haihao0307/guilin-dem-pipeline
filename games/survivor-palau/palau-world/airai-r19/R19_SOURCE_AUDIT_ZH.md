# Stone Money Island / Survivor Palau — R19 严格重启源审计

日期：2026-09-22

## 本次实际执行

R19 已从封存的 R11 固定提交 `c47f7cc62d864e95117bd5548ca9ffa3f1d770a8` 新建独立分支：

`work/palau-airai-r19-authority-locked-restart-20260922`

R12–R18 的可见地形、岸线、岛形、故事锚点、三维网格和画面全部禁止继承。只允许回看失败原因，不允许作为几何基线。

## 已核实的唯一用户权威输入

### 完整 Palau 总图

- 原文件：`IMG_7975.jpeg`
- 规范名：`01_PALAU_FULL_FRAME_USER_ORIGINAL.jpeg`
- 字节数：109,929
- 尺寸：581 × 1260
- SHA-256：`5b6e1d716bfa66f204aac9240944fe5d1526444d981ccb8a3f23875633d73312`

第一视图必须完整显示这张图定义的范围。禁止裁剪、重画、卡通化、替换或改变整体地理框架。

### Stone Money 黄色故事区域

- 原文件：`IMG_7974.jpeg`
- 规范名：`02_STONE_MONEY_YELLOW_AREA_USER_ORIGINAL.jpeg`
- 字节数：285,719
- 尺寸：1284 × 2778
- SHA-256：`4fad4cd637fd556044fec5cfd56f6ef29eb8859a72a543788feb7084c4daeb47`

黄色手绘区域整体才是故事 AOI。它不是单一坐标点，不允许重新猜岛名、自动选中心或继承旧候选锚点。

## 当前源文件缺口

已检查：

1. R11 GitHub 分支目录；
2. R11 ZIP 全量文件清单；
3. 当前 `/mnt/data` 工作区及现有 ZIP 内部目录；
4. 私有 `haihao0307/KAOPU-REFERENCE-CACHE` 中两个权威 SHA-256；
5. 当前可访问的 Palau 派生数据包。

结果：

- R11 文档记录了两张权威图的身份，但 R11 包没有包含两张 JPEG 原始字节；
- 私有 Reference Cache 当前也没有这两个 SHA-256 对象；
- R11 文档声称收集了两张原始 Palau DEM GeoTIFF，但当前 R11 包没有包含 GeoTIFF 本体；
- 当前找到的 `.tif` 仅为后续 Airai 水深候选派生网格，不能替代原始 Palau DEM；
- R15 Copernicus GLO-30 数据属于此前被否决的替代路线，R19 禁止使用；
- R11 的 `airai-r01/workbench` 只保存约 8 × 8 km 的聚焦波场，不是完整 Palau DEM，而且包含旧候选定位，不得充当总世界真值。

因此，当前不能合法生成新的 Palau 三维地理画面。继续画岛、补岸线或放置故事点都将再次构成编造。

## R19 当前允许做什么

- 冻结权威身份和哈希；
- 恢复并校验现成 Ocean Mother R018 V0.3.6 代码身份，但不把测试岛带入故事世界；
- 清点 NOAA / NCEI / GMRT / Allen / Sentinel / OSM 证据；
- 建立输入验证、坐标合同、NoData 合同和叠加误差门禁；
- 恢复权威原始字节后，先做逐像素／逐坐标叠加 QA，再允许生成三维工作台。

## R19 当前禁止做什么

- 禁止使用 R12–R18 任何可见地理结果；
- 禁止以 Copernicus、程序波、手绘轮廓或通用岛形替代用户 DEM；
- 禁止把卫星截图直接变成高度；
- 禁止根据文字描述猜测 White Sand、Rock Island、Turtle House、Power Tree 或日军据点的精确坐标；
- 禁止在权威图和 DEM 原始字节缺失时交付所谓“下一版三维”；
- 禁止把源审计、静态图、二维地图、加载页或 QA 截图包装成三维进展。

## 重新开放视觉生产的硬条件

只有以下条件全部满足，`visualBuildAllowed` 才能置为 `true`：

1. 两张权威 JPEG 原始字节可读，字节数、尺寸和 SHA-256 全部一致；
2. 两张原始 Palau DEM GeoTIFF 本体可读，原文件名、字节数、CRS、像元大小、范围、NoData 和 SHA-256 全部冻结；
3. 完整 Palau 总图与 DEM 完成坐标配准，并保存误差报告；
4. 黄色故事 AOI 完整映射为多边形，不缩成点；
5. NOAA 岸线、礁盘、水深与 KB Bridge / Toachel Mid channel 连续性完成证据 QA；
6. Ocean Mother 只复用冻结版本，不重新设计；
7. 新工作台使用真实生产源码、实时三维运行时和固定公网 HTTPS；
8. 桌面和 390 × 844 手机真实浏览器均通过，控制台 0 致命错误；
9. 新版公网回读和浏览器关键交互通过后，才允许向用户展示。

## 当前状态

- `sourceModified=true`
- `interactive3D=false`
- `staticImageSubstitute=false`
- `authorityOverlayPassed=false`
- `visualBuildAllowed=false`
- `publicHttpsPassed=false`
- `browserPassed=false`
- `shareAllowed=false`
- `visualAcceptance=false`
- `productionReady=false`
- `status=BLOCKED_SOURCE_BINARIES`

## 真实三维与公开交付检查

- [x] 本任务没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码／门禁文件，而不是只做视觉提案；
- [ ] 用户看到的是可交互三维工作台，不是静态图片、视频或占位页；
- [ ] 画面来自实时三维运行时；
- [ ] 镜头、控制和用户要求的交互可以实际操作；
- [ ] 公网固定链接已回读并通过真实浏览器检查；
- [x] 当前只有源审计和门禁，没有工作台，因此本轮不作为视觉交付。
