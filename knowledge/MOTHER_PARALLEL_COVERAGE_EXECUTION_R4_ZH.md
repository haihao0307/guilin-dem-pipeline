# KAOPU Mother Parallel Coverage Execution R4
## 复杂资产不允许被一个局部细节卡死

版本：4.2.0
日期：2026-09-22
状态：PERMANENT / CROSS-MOTHER / USER-AUTHORITY

适用：Boat、Aircraft、Human、Clothing、Fish、Coral、Bird、Animal、Tree、Landscape、Ocean、Game 等复杂生产资产。

## 0. 为什么需要 R4

R2/R3 的“一个 Mother 一次只修一个 primary defect”本意是防止一轮乱改很多东西。
但复杂资产如果把“一个资产”误当成“一个唯一串行 lane”，会产生新的系统性错误：

- 一个舵手的手指接触可以占满几十轮；
- 其余船员、帽子、衣服、武器、烟雾、材质全部不动；
- 一个 specimen blocker 卡死整个 Fish/Coral/Boat；
- 用户看到的是长期停留在同一个低质量画面，而不是整体持续收敛。

R4 修正定义：

**一个 lane 一次只做一个 primary defect；一个复杂资产可以并且应该拥有多个互不冲突的 lane。**

R4 与 R3 冲突时：
- “单 lane 单 defect”继续有效；
- “整个复杂资产只能串行做一个 defect”作废。

## 1. Complex Asset Coverage Matrix

复杂资产开工必须先列出主要系统，不允许只盯一个局部。

每个系统状态只允许：
- UNSTARTED
- EXECUTING
- HOLD_LOCAL
- CANDIDATE
- VERIFIER_PASSED
- USER_ACCEPTED

示例 Boat：
- vessel hull/scale/waterline
- propulsion/steering
- crew body/stature
- clothing/headgear
- role pose/contact
- weapon/equipment
- material/weathering
- smoke/exhaust
- assembly/mobile/standalone

示例 Fish：
- identity/source
- macro body
- fins/head
- rig/deformation
- material
- behavior
- game interface
- assembly

示例 Coral：
- identity
- Stage A silhouette
- Stage B topology
- Stage C surface biology
- material
- habitat/contact
- assembly

## 2. Breadth Floor：先把整件东西立起来，再进入微观死磕

任何复杂资产，在进入 MICRO_DETAIL 之前必须达到最低覆盖：

- 所有主要系统至少不是 UNSTARTED；
- 所有角色/实例至少有真实可量测的基础版本或明确 HOLD_LOCAL；
- 不允许 1 个角色已经做 12 轮手指，而另外 3 个角色仍是 capsule/primitive；
- 不允许一个珊瑚表面做到 microscope，而另外两个 archetype 连 Stage A 都没有；
- 不允许一条鱼眼睛/鳍根反复微调而动作/行为/水体接口长期为零。

Coverage floor 未达标时：
**禁止继续在单个局部进入更细一级。**

## 3. Detail Tunnel Budget

同一个 SPECIMEN_LOCAL / CONTACT_LOCAL 问题：

- 最多连续 2 个 bounded increments；
- 若仍未通过视觉/数值门禁，状态改为 HOLD_LOCAL；
- 记录 blocker；
- 立即轮转到下一个独立可生产系统；
- 原问题保留，之后由专门 lane/root-cause review 继续。

这不是降低质量，也不是放弃问题。
这是防止一个局部 monopolize 整条生产线。

只有 DOMAIN_SHARED blocker 才允许同时暂停多个 lane。

## 4. 物理尺寸必须量最终可见产物，不量配置数字

任何“人物 1.64 m”“船 5.0 m”“鱼 30 mm”等声明，都必须区分：

1. target/config value
2. generated geometry world-space measurement
3. visible/deformed geometry measurement
4. accepted physical dimension

不得因为配置里写了 1.64 m，就宣称画面里人物已经 1.64 m。

人物至少要有：
- heel/foot contact plane
- crown/top of visible head or approved headgear-excluded body top
- world-space height
- deck/ground clearance
- body root transform
- camera-independent measurement

最终可见 mesh 不符合 target 时，target 只能叫 TARGET，不叫 PASSED。

## 5. 多工位规则

复杂资产默认 3–5 个独立工位。

每个工位：
- 独立 taskId
- 独立 allowedPaths
- 独立 receipt
- 独立 blocker
- 不同时写同一 authority file

Assembly lane 只做：
- 读取各 lane 的 verifier-passed candidate；
- 装配；
- 冲突检查；
- 当前整体视觉；
- standalone HTML。

Assembly 不重新修各工位内部细节。

## 6. Assembly Heartbeat

复杂资产不能等“每个细节全部完美”才看整体。

每完成 2–4 个 bounded increments，Assembly 必须生成一次当前整体候选：

- 所有真实已完成组件进入；
- HOLD_LOCAL 的组件保持最后合法候选或明确标 HOLD；
- 未完成组件不得用 generic/toy placeholder 冒充；
- 当前整体图/HTML要说明 CURRENT_LARGEST_DEVIATION。

这样可以尽早发现：
- 比例关系错；
- 人与船不匹配；
- 服装和身体不匹配；
- 设备位置冲突；
- 物种/环境尺度冲突。

## 7. 用户纠错后的优先级

如果用户指出的是“整个生产逻辑卡死”，Coordinator 不应继续只派同一微缺陷。

必须先判断：
- 是 LOCAL defect，还是 SYSTEM throughput defect；
- 如果是 throughput defect，立即重排 lanes；
- 不得继续让旧 Task Anchor 的“protected other components unchanged”把整件资产冻结。

## 8. 禁止路线

禁止：
- 一个局部连续十几轮，其他系统零进展；
- 用“当前任务只改一个人”解释为什么其他三个人永远不做；
- 把配置值当最终几何测量；
- 把 workflow/QA 数量当整体生产完成度；
- Assembly 等所有 lane 完美才开始；
- 一个 LOCAL blocker 扩大为整个 Domain 停工；
- 通过越来越细的数字门禁掩盖整体视觉仍明显错误。

## 9. 交付

仍执行全局 standalone HTML 规则。

用户最终看到的复杂资产必须是一个：
- self-contained HTML
- file:// 双击
- current head
- console 0 error
- 无 CDN / assets / server
- 显示整体真实候选

内部每个 lane 可以有自己的测试页，但不能让用户自己拼装。

## 10. Watchdog 新增检查

Watchdog 每轮增加：

- 是否存在 DETAIL_TUNNEL；
- 同一局部是否连续 >2 bounded increments；
- 其他主要系统是否仍 UNSTARTED；
- Coverage Matrix 是否失衡；
- target dimension 是否被误当 visible measurement；
- Assembly heartbeat 是否长期没有更新；
- blocker radius 是否被错误扩大。

发现 DETAIL_TUNNEL：
状态 = ROUTING_CORRECTION_REQUIRED。

处理：
1. 冻结局部 lane；
2. 不删除历史；
3. 轮转独立工位；
4. 保留局部问题进入专门 backlog；
5. Assembly 继续前进。

## 11. 成功标准

不是“某一只手越来越精细”。

而是：
- 整件资产每个主要系统都有持续进展；
- blocker 被限制在最小半径；
- 用户看到的整体候选不断提升；
- 微观问题不会阻塞帽子、衣服、其他人物、材质、烟雾、动作等独立工作；
- 最终再把局部问题逐一收口。


## 12. Token / Coordination Economy：只为可见产出花上下文

从 2026-09-22 起，复杂资产生产额外执行“低对话开销”规则：

### 12.1 用户不可见的包装工作不得无限增长
以下内容属于 supporting work，不得连续占用多个 production turn：
- 新 Issue；
- 新 branch；
- 新 Task Anchor；
- 新 policy；
- 新 workflow；
- 新 receipt；
- 重新解释同一个 blocker；
- 重复写状态评论。

同一 bounded increment 最多允许一份 Task Anchor + 一份 receipt。若 production delta 未变化，不得因为增加文档/工作流而把版本号继续往前滚。

### 12.2 Silence by default
Watchdog / Coordinator 只在以下情况写新评论或通知用户：
- 新可执行 artifact；
- 新数值/浏览器结果；
- blocker 首次出现或发生实质变化；
- verifier 结论改变；
- routing correction / merge / promotion 决策。

“状态没变”不发重复评论。

### 12.3 Artifact-to-Meta Ratio
每个复杂资产在一个生产窗口内，目标比例：
- 至少 70% 的新增提交服务于 production code / geometry / data / standalone HTML / executed QA；
- policy / docs / workflow / receipt 等元工作原则上不超过 30%。

如果连续 3 个提交都只有 docs / workflow / receipt 而没有 production delta：
状态 = `META_WORK_STALL`，停止继续包装，必须回到 production 或报告精确 blocker。

### 12.4 用户汇报压缩
用户默认只看一张总表：
- CURRENT ARTIFACT
- BASE -> HEAD
- WHAT VISIBLY CHANGED
- TEST
- BLOCKER
- NEXT

不要把每个内部 Mother 的长日志直接复制给用户。

### 12.5 夜间/长时间生产的结果门
如果用户说“晚上继续、明早看”：
最终只允许汇总为：
- `CANDIDATE_READY`
- `BLOCKED_VALID`
- `NO_NEW_ARTIFACT`

夜间可以有很多内部试验，但早晨必须压缩成少量真正有意义的 artifact。大量中间提交不能替代一个用户可见候选。

### 12.6 停止条件
出现下列任一情况时，不继续消耗 token 做同类尝试：
- 同一 LOCAL defect 连续两次失败；
- 只有元工作，没有 production delta；
- 当前候选已经需要人工视觉判断而不是更多数字微调；
- 下一步依赖另一个 lane 的真实输入；
- 当前执行端缺少必要浏览器/GPU/file:// 能力。

此时 HOLD / ROUTE / VERIFY，而不是继续生成更多解释。


## 13. Reference-First / First-Look Gate：先把“像不像”锁住，再允许往下做

从 2026-09-22 起，所有可见自然对象、人物、船、飞机、建筑、服装和生物 Mother 都执行这个门。

### 13.1 Production Mother 不负责规划
Production Mother 不重新分类、不重新选参考、不重新发明路线。
Coordinator / 小妈先给：
- 唯一对象/母型；
- 唯一 reference set；
- 当前只做哪个 Stage / defect；
- 第一轮看什么。

Mother 收到后直接生产。

### 13.2 第一屏必须同时看到 Reference 与 Candidate
凡是 Coral / Fish / Bird / Animal / Human / Clothing / Boat / Aircraft 等形体任务，工作台第一屏必须至少同时显示：
- LEFT / TOP：冻结 reference（用户图、已授权模型截图、权威身份图或测量图）；
- RIGHT / BOTTOM：当前 candidate；
- identity / source / current head；
- CURRENT_LARGEST_DEVIATION。

不能让用户先看一个脱离参考的孤立候选，再靠文字解释它“应该像什么”。

如果 reference 是 3D：
- 固定一个同视角截图或同一相机投影；
- 必要时增加 overlay / silhouette difference；
- 参考只做比较，不成为运行时依赖。

### 13.3 First-Look Gate
每个新对象/新母型第一轮只判断：
1. identity 对不对；
2. 大轮廓对不对；
3. 长宽高 / 身高 / 主轴比例对不对；
4. 基本角色/物种/时代/服装类别有没有跑偏；
5. 有没有明显卡通 / toy / generic substitute。

这个 Gate 没过：
- 禁止进入手指、眼睛、corallite、micro-surface、旧化、复杂材质等微观工作；
- 禁止靠细节把错误的大形盖住；
- 直接 CORRECT Stage A / identity。

目标是第一轮很快就暴露方向错误；在可连续执行环境中，首个 first-look artifact 目标为约 10 分钟级，而不是数小时后才第一次看到整体。

### 13.4 人物身份门
历史人物必须先通过“身份 + 时代 + 岗位” reference gate，再做局部动作：
- 目标国别/军种/时期由任务资料冻结；
- 面部、发型、帽型、制服轮廓、装备组合必须与冻结 reference set 比较；
- 不允许 generic Western/default avatar、现代人物或卡通头部作为历史日本船员等任务的继承基线；
- 不根据程序默认肤色/脸型自动宣称身份正确；
- 若身份视觉未通过，人物状态 = HOLD_IDENTITY，而不是继续抠手指。

### 13.5 Coral / Fish / Bird 的固定第一轮
Coral：
- 每个 lane 先放一张该母型真实 reference；
- 旁边只做 Stage A 大轮廓；
- 通过后才进入 topology / surface biology。

Fish：
- reference fish / source model 与 candidate 同屏；
- 先看 body envelope、头/吻、尾柄、鳍位置和整体比例；
- 通过后再做 rig / material / behavior 细化。

Bird：
- identity reference 与 candidate 同屏；
- 先看体轴、翼展/翼形、腿、颈、头喙比例和站姿/飞行大形；
- 通过后再做羽毛微表面和复杂动作。

### 13.6 船 / 复杂设备的固定第一轮
先比较：
- reference silhouette；
- 总长/宽/高；
- 水线/吃水关系；
- 人/设备与船体比例；
- 主要机械/武器/桅杆位置。

这些没有通过以前，不准让一个 crew 手指或一个螺栓成为主生产任务。

### 13.7 用户只看工作台
用户默认不看内部计划、Issue、Task Anchor、receipt 细节。
用户可见汇报优先只有：
- 当前 standalone HTML；
- reference vs candidate 画面；
- CURRENT_LARGEST_DEVIATION；
- 是否 PASS / CORRECT / HOLD。

文字解释不能替代工作台。
