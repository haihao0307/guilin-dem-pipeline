# 香港主地图 R07：原88驾驶控制恢复与地形谱

独立新增版本，R06及其海岸、隧道、原建筑与车辆母体保留。

## 游戏控制

恢复已有88号游戏控制：原出发、惰行、急停、汽门与制动滑杆，原暂停/继续、1×/5×及原审看重置。没有替换物理器或用相机轨迹模拟运行。原120Hz DrivingPhysics、汽压/燃料/车轮状态、同路线纵坡与4节完整客车继续共用；顶部游戏按钮、驾驶暂停按钮与宿主时钟同步。

原问题有两处：驾驶面板被旧 map-panels-folded 样式隐藏；顶部按钮只控制天气时钟，列车有独立暂停门。现在驾驶面板常驻，其他地图面板仍可折叠；首次“启动游戏”调用原出发动作，之后暂停/继续不重置里程、速度或游戏进度。

游戏采用热机起动和既有集总设计参数，不是完整冷炉点火模拟。中心轨仍无贴邻站台，未接上下客或侧线信号联锁。车型/质量是原游戏设计参数。

## 截图中的黄色细矩形

它是旧R03的 boundaryMesh 数据域边框，不是实体铁轨，也不是R06已关闭的黄色宽规划带。R07仅取消该边框的绘制；原地理数据和真实轨道保持。工程诊断也不再重现这条边框。

## 地形

地形转换总账、共享重建函数与逐值往返检查将在本版 terrain-kaopu 包记录。既有R02外围30m谱和R03四块CEDD谱复用。不会将源网格改后缀冒充函数谱，也不把无损重打包自动称为运行速度提升。

## 本轮用户指定排除

本轮暂不接红磡局部高精地形，2m/5m两包及运行引用全部排除；该区显示已有30m背景，并在页面状态注明高精待补。原红磡数据保留本地，未改名、重编码或从旧宿主暗载。完整归档账与本轮实际公开/加载账分列，不能把排除后体积称为全量完成。其他地形字段保持无损，R06海岸与狮子山洞口仍需同机位验证。

## 验证边界

真实原物理器CPU回归已覆盖开始、暂停不推进、恢复、汽门、制动、惰行、急停、重复出发无重置和审看定位重置。DOM/GPU/冷启动与实际浏览器操作另行记录，未运行前不称通过。保留642个历史证据灰建筑候选，未完成全九龙和贴图。

以下保留R06空间与海岸实现说明：

## 海岸

旧陆地只渲染三顶点均为非海面的三角形，水面却按最近单节点裁切，混合网格存在双重漏画。本版水面裁切与同一陆地三角形精确互补；原高程、分类、Ocean 造波/光照母体不变。沿实际粗地形海岸边补竖向显示连接面，下缘 -2m，仅适配当前海面预设，不是实测海底或挡土墙。保留原30m海岸阶梯，不声称获得更高精度海岸。

## 线路与站场

最终暂行线路 34,672.317183m，最大纵坡5.836679‰（可编辑游戏上限15‰）。旧九龙中央新增通过轨，原六股及站体保持；钟楼仍用此前缓存官方POI，整站历史精确朝向未独立认证。天后站位向西北调整，站轨顶9.85m；同谱驱动站场、列车和坡度力。只修改六段平面多项式，后段世界坐标保持。

旧九龙与天后中心轨均无贴邻站台，只展示/通过，不提供上下客。137.60m旧台长度对四节编组的8.52m双端余量仅为纵向容纳，不是可上下客认证。原靠台侧线保留，动态道岔/侧线驾驶未接。仍有11个既有建筑bbox潜在命中（含1个新增），未完成精确三维避让。

## 狮子山

同一路线采样建立弯曲开挖体积，实际剪切背景及2m/5m显示地形三角，保留覆土上表面。按实际覆土逐段分封顶隧道和露天接近槽，提供开放门户、内衬、地板与门户显示封边。尺寸属于作品设计，不是历史铁路测绘或工程认证；原地形高程采样仍保留，列车只沿轨运行，非任意体积物理碰撞。

## 范围

沿用642个前1997证据候选部件，71个待地面/支撑核查的候选不进场。没有新增官方未读原包、没有全九龙贴图。保留原完整机车和客车，蒸汽是显示粒子，仍可能穿建筑，不是流体模拟。私人参考照片不随包发布。

原官方建筑/地形来源为香港特区政府地政总署/CSDI及CEDD；原许可与署名沿固定依赖保留。公共证据见 route/candidate-spatial-audit.json、route/candidate-runway-audit.json、yard/current-scene-ground-review.json、tunnel/CPU-EVIDENCE.json、tests/COAST-CPU-QA.json。CPU通过不等于实际画面通过，浏览器截图与冷启动记录单独验收。

## Portal repair follow-through
The first browser run exposed north-portal residual terrain and an invalid south review eye. The tunnel now queries actual source triangles, and open cuttings extend vertically instead of stopping at a nearest-node height. Original DEM arrays remain unchanged. QA preserves all three original camera transforms, then separately checks public portal buttons from the adjacent open approach at rail+2.2m. The old south camera is deliberately retained as an invalid-eye diagnostic, not a successful outside view. See tunnel/portal-fix/ for source-mesh regression.
