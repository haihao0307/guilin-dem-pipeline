# Landscape Mother 喀斯特 V013 方法吸收记录

日期：2026-09-03
状态：implementation candidate；visualApproved=false；visualAcceptance=false；productionReady=false。

## 本轮目标

集中修正 V012 的石灰岩色彩、水蚀区域发黑、均匀微噪、孔洞组织、手机界面和返回总台问题。其他地貌继续暂停。

本轮学习 HOUSE 仓库 Brick Mother PR #15 的方法论，只吸收可复用的系统方法和公开工程关系。没有复制其材质代码、几何事件、色板、模型或视觉资产。

## 吸收的方法

### 1. 独立事件 DNA

喀斯特拆为 shape、cavity、water、color、weather、bio、detail 七类确定性种子。一个事件层变化不能重写其他层。相机、光照和界面变化不得重新生成岩体。

### 2. 宏观、中观、微观职责

宏观约占可见结构的 40% 至 50%，负责峰体、岩壁、洞口和主要缺损。中观约占 30% 至 40%，负责溶沟、孔簇、矿物带、局部剥蚀和凹部。微观约占 15% 至 25%，负责晶粒、细坑、微裂和粗糙度。微观必须由宏观和中观事件遮罩约束，禁止全表面均匀砂纸噪声。

### 3. 可检查的中间场

运行链分成 Geometry Field、Process Field、Color Field、Render Field。洞腔、径流、湿润、铁质沉积、锰质暗线、青苔、地衣、新鲜断面、粗糙度和遮蔽均可单独诊断。

### 4. 颜色由数据场驱动

采用宽尺度石灰岩基色、事件场自动拉伸、局部清晰度、边界分离和归一化多权重混合。颜色不会由孤立彩色噪波直接决定。矿物、湿润和生物覆盖共享形成事件，同时保留不同尺度与响应。

### 5. 水相关状态分离

wetness、runoff、cavity、ironDeposit、manganeseDeposit 和 skyAccessibility 独立。湿润主要降低粗糙度并适度压暗；径流控制细长水迹；铁质沉积形成暖色边界；锰质沉积只出现在少量强径流、遮蔽与滞水交集；洞腔暗度由遮蔽和补光共同决定。禁止把所有水相关区域乘成纯黑。

### 6. 洞群语法

实际洞腔分为主洞、拱洞、中型侧壁孔穴和小型溶蚀孔簇。小孔按 cavity seed 确定性生成，并偏向裂隙与雨水通道，尺寸、深度、朝向和聚集度分开变化。干净圆孔和均匀撒点均为失败形态。

### 7. Fail closed 视觉门

网页可运行、种子可复现和拓扑闭合只属于技术门。出现巧克力色、全水迹发黑、微噪先于大形、圆孔、洞口亮圈、材料漂移、手机控件遮挡或无法返回总台时，视觉门保持失败。

## V013 独立实现

V013 使用归一化事件权重混合灰白方解石、暖灰风化面、新鲜断面、铁质沉积、少量锰质暗线、地衣和青苔。湿润状态不会直接替换成黑色材质。微表面只在新鲜断面、溶沟边缘、洞腔和孔蚀邻域增强。

工作台增加总台覆盖层、液态玻璃底部调节面板、六组参数页和十个诊断通道。手机保持 44 CSS px 以上触控目标、真实双指缩放、安全区和同一固定几何。

## 证据来源

1. haihao0307/HOUSE PR #15 当前说明与证据结构。
2. BRICK_MOTHER_V2_COMPOSITE_MATERIAL_DNA.md。
3. BRICK_MOTHER_GAEA_DISTILLATION_V1.md。
4. BRICK_MOTHER_V27_VISUAL_TRUTH_SPEC.md。
5. BRICK_MOTHER_REALTIME_WEATHERING_PBR_DNA_V1.0.md。
6. stone-response-study.js。
7. Landscape Mother R009、R010 和 V012 源码审计。

这些来源用于方法转译和差距诊断。V013 运行代码、参数、色板和函数均为 Landscape Mother 独立实现。
