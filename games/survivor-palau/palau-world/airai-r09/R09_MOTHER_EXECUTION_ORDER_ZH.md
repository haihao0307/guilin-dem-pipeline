# Airai / Stone Money Island R09 — 给执行 Mother 的硬执行单

这不是规划任务。不要重新设计路线。不要解释为什么困难。只按顺序交付五项。

## 0. 当前唯一父版本

- R09 基线：`f11da1423356115e8bb2e7d078d10a7a493bc9ff`
- 用户完整帕劳原图：`IMG_7975.jpeg`
  - SHA-256：`5b6e1d716bfa66f204aac9240944fe5d1526444d981ccb8a3f23875633d73312`
- 用户 Stone Money 黄色故事区域原图：`IMG_7974.jpeg`
  - SHA-256：`4fad4cd637fd556044fec5cfd56f6ef29eb8859a72a543788feb7084c4daeb47`

旧 R01 / R03 / R03C / R05 / R06 的工作台、位置、截图、结构猜图都不能作为当前父版本。

## 1. 第一张：完整帕劳总图

必须原样显示用户完整总图。

不允许：
- 先裁 Airai；
- 先放大故事岛；
- 重画一张相似地图；
- 用程序底图替代用户原图；
- 把旧 AOI 图当第一张。

如果精确原始字节当前不可读，立即报 `SOURCE_BYTES_NOT_READABLE`，列出真实 repo/ref/path 或挂载缺口；此时禁止继续产出伪“第一张”。

## 2. 第二张：故事岛唯一定位图

必须使用用户后来圈定的黄色 Stone Money 故事区域。

这是一个区域，不是旧单点。

必须确认：
- 旧候选数量 = 0；
- Boracay / Orrak / Ngellil = 0；
- 没有旧坐标针；
- 没有把别的岛重新命名成故事岛。

如果画面上还同时存在“新区域 + 旧点”，本轮直接 FAIL。

## 3. 第三张：结构分离图——现在是强制项

R07 里“不要再做结构分离图”的旧句子，到这里被用户当前指令覆盖。

但覆盖的意思不是允许猜画。

必须做一张**由实际证据派生的结构分离图**，至少分成：

- LAND：陆地
- BEACH：沙滩 / 明确岸带
- REEF：礁盘
- CHANNEL：水道
- DEEP_OCEAN：礁盘外深海
- UNKNOWN / NODATA：证据不足区

硬规则：

### LAND
优先从 LNDARE / COALNE / DEM 等陆地证据得到。
陆地边界不是礁盘边界。

### BEACH
只在有岸带、光学或地形证据时表达。
证据不足不要补一圈“漂亮沙滩”。

### REEF
用 Allen Coral Atlas、Sentinel 光学、NOAA 深度与其他可追溯证据约束。
不能把陆地 polygon 放大几百米后称为 reef。

### CHANNEL
必须是一条独立水体拓扑。
强制验证 Koror–Babeldaob Bridge / Toachel Mid 下方连续。
不能为画面好看把水道截断。

### DEEP_OCEAN
必须与 reef 外缘、水深/背景海域关系一致。
不能只用深蓝颜色猜深海。

每个 class 在图例或 sidecar JSON 中写出 source。
不确定区必须留下 UNKNOWN / NoData。

## 4. 第四张：当前工作台截图

前三张过门以后，才允许进入工作台。

高精度区域只允许：
- Airai；
- 用户故事岛整个圈定区域；
- 两者直接相关的 channel / reef / nearshore transition。

框内其他岛：
- 保留；
- 位置关系正确；
- 只做基础形体；
- 不和 Airai / 故事岛抢同等级细节预算。

截图必须来自当前 head，图上或旁边能看到：
- version / taskId；
- head SHA；
- capture time；
- desktop 或 390×844 类型。

旧截图换标题不算新截图。

## 5. 第五项：只说一句当前最大错误

格式固定：

`CURRENT_LARGEST_ERROR: <一个具体问题>`

合格示例：
- `CURRENT_LARGEST_ERROR: north-side reef edge still has UNKNOWN evidence gaps.`
- `CURRENT_LARGEST_ERROR: beach class is not yet separated from LAND on the southwest shore.`

不合格：
- “还需要优化。”
- “整体不错。”
- “后续继续完善。”

## 6. 每轮只允许一个 primary defect

如果第三张还错，本轮就不许去精修树、珊瑚、水面、岩洞或人物。

优先级固定：
1. frame
2. story region
3. structure
4. workbench
5. local detail

上游 FAIL，下游全部 HOLD。

## 7. 交付状态只允许三种

- `CANDIDATE_READY`
- `BLOCKED_VALID`
- `NO_NEW_ARTIFACT`

不再使用：
- thinking
- almost done
- progressing
- looks good

没有四张新鲜图，不得说“已推进”。

## 8. 失败处理

第一次发现错误：
- 只修当前 primary defect；
- 不换体系。

同一错误第二次再次出现：
- 停止继续微调；
- 进入 ROOT_CAUSE_REVIEW；
- 检查是不是使用了旧锚点、错误 mask、旧截图、错误来源或旧工作台。

如果两个执行尝试都卡在同一个输入：
- 升级共同输入/合同/工具问题；
- 不继续换 worker 假装会好。

## 9. 给小妈的最终回执

只需要：

1. 01 图 SHA / 文件
2. 02 图 SHA / 文件
3. 03 图 SHA / 文件
4. 04 图 SHA / 文件
5. current head
6. executed QA command/result
7. `CURRENT_LARGEST_ERROR`
8. known limitations

缺一项 = HOLD。
