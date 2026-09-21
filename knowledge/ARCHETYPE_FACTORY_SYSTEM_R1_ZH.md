# KAOPU Archetype Factory System R1
## 研究驱动的母型工厂：Research → Archetype → Slot → Workbench → Comparison → Variant

版本：1.0.0
日期：2026-09-21
状态：PERMANENT CANDIDATE / USER-APPROVED DIRECTION
适用：Coral、Fish、Bird、Tree、Animal、Geoform、Habitat Cover、Dynamic Process、Game Assembly。

## 0. 第一性原则

KAOPU 不以“逐个物种手工做完”为基本生产单位，而以“自然中反复出现的少量结构/行为母型”为基本研究和生产单位。

原因：
- Palau 珊瑚、鱼类、鸟类数量远超过逐个生产可承受范围；
- 逐个物种从零研究会让单一 blocker 占满整条车间；
- 大量自然对象共享几何、骨架、运动、材质、生长、栖息和环境响应规律；
- 先做母型，再做受约束变体，可以同时保持准确性和规模化。

总原则：先开一个对的头，然后无限逼近事实。

未知保持 UNKNOWN，不用卡通、玩具、generic placeholder 填空。

## 1. 组织分层

### Research / Xiaoma
负责：
- 查 NOAA / CRRF / 一手资料；
- 确定母型分类；
- 选择一个身份图；
- 建 Reference Card；
- 标 UNKNOWN；
- 冻结 Task Anchor；
- 定义 confusion set；
- 定义 acceptance gate；
- 组织短会和跨模块比较。

### Production Slot / Mother
负责：
- 读取唯一 archetype card；
- 一次只做一个 stage；
- 修改生产源码/函数/几何；
- 自检；
- 提交；
- 不自己重新分类；
- 不广泛研究；
- 不为了完整补画。

### Assembly / Game or Domain Workbench
负责：
- 把各工位真实候选装进同一个工作台；
- 不重新造一个简化版对象；
- 没候选的 slot 显示 NO_CANDIDATE，不生成假对象；
- 提供 A/B/C 横向比较；
- 最终输出单体双击 HTML。

## 2. 每个母型必须有 Identity Card

最小字段：
- archetypeId
- commonName
- domain
- identityImageSource
- identityImageCredit
- primaryMorphology
- confusionSet
- knownNaturalRelations
- unknowns
- allowedStage
- accepted/evidence-backed parent
- forbidden substitutions
- QA views

用户查看 Identity Card 应能直接知道“这个工位究竟在做什么”。

## 3. 固定四阶段

### Stage A — Macro Silhouette
只解决：
- 大形态；
- 主轴；
- 长宽高比例；
- 分枝/块体/扇面/叶片等一眼可见结构。

禁止：
- 用微表面细节掩盖轮廓错误；
- 加漂亮材质冒充形体通过。

### Stage B — Structural Logic
解决：
- 生长拓扑；
- 主/次分枝；
- 共享壁/沟谷；
- 扇网节点；
- 叶片叠置；
- 局部结构生成规律。

### Stage C — Surface Biology
解决：
- polyp/corallite/tissue/skeleton；
- 组织与骨骼的层级关系；
- 表面尺度；
- 近景 Microscope geometry。

### Stage D — Material + Habitat + Motion
解决：
- PBR/material channels；
- 水下光学；
- 风/流响应；
- 接触与栖息；
- Game runtime 接口。

一个 Stage 没过，不跨级“用下一阶段把问题盖住”。

## 4. Blocker Containment Radius

所有 blocker 必须分类：

### SPECIMEN_LOCAL
只影响一个候选或一个具体参考。
动作：
- 当前 slot HOLD；
- 立刻拉下一张 SOURCE_READY 卡；
- 不堵其他工位。

### FAMILY_LOCAL
影响一个母型 family。
动作：
- 该 family 暂停；
- 其他 archetype 继续；
- 协调端做 root-cause。

### DOMAIN_SHARED
影响公共 Core / shader / scale / renderer / contract。
动作：
- 才允许暂停相关多个工位；
- 由小妈协调解决公共根因。

任何 Mother 不得把 SPECIMEN_LOCAL blocker 扩大成“整个 Coral/Fish/Bird 都不能工作”。

## 5. 三工位并行原则

第一轮每个 Domain 默认最多 3 个生产工位并行。

选择原则：
- 形态差异尽量大；
- 共用 Core，但避免同时写同一文件；
- 每条线只改自己的 archetype slot；
- Assembly 只读各 lane 的候选接口。

并行不是让三个 Mother 同时重新设计 Core。

## 6. 10 分钟 Compare Review

每轮短会只允许四项：

1. Identity Card
2. 当前 Stage 的真实画面
3. CURRENT_LARGEST_DEVIATION
4. 决定：CONTINUE / CORRECT / HOLD_LOCAL / PROMOTE_STAGE

禁止：
- master-plan brainstorming；
- 长篇解释；
- 临时改分类；
- 用“整体不错”代替误差描述。

## 7. Variant 规则

母型至少 Stage A+B 通过后，才允许产生 Variant。

Variant 只能改变：
- 已定义 DNA 参数；
- 已定义生长/形态算子；
- 有证据范围的材料/比例/行为 envelope。

不能把随机噪声叫“新物种”。

物种级候选必须记录：
- 来源；
- 尺寸定义；
- 与母型差异；
- 哪些字段是真实测量；
- 哪些是 candidate interpolation。

## 8. 环境也使用同一哲学

### Geoform Archetypes
Karst wall/notch、reef flat、reef crest、beach ramp、channel/pass、lagoon bottom。

### Habitat Cover Archetypes
coral patch、seagrass、rubble、mangrove edge、banyan cluster、coastal scrub、wet/algal rock。

### Dynamic Process Archetypes
wave/swell、breaker/foam、tide、wetness、clarity/depth optics、wind response、camera waterline crossing。

### Assembly
Game/World 只消费上述共享真值，不私自重做第二套。

## 9. Game First

最终目标不是生产模型库，而是 Game。

因此每个 Domain Candidate 都必须最终回答：
- 在 Game 里放在哪里；
- 与玩家/鱼/水/地面有什么接口；
- 对故事/生存/观察/交互有什么作用；
- 性能预算；
- save/restore 身份；
- 是否能进入一个统一 standalone HTML。

## 10. 最终交付

所有用户可见 Workbench / Game Candidate：
- 一个 standalone HTML；
- file:// 双击；
- 不解压；
- 不依赖 CDN/assets/server；
- console 0 error；
- 工作台同时显示 Identity Card + 真实三维候选 + 当前 Stage + CURRENT_LARGEST_DEVIATION。

## 11. KPI

不看“做了多少 commit”。

看：
- archetype Stage throughput；
- blocker containment；
- first-pass fidelity；
- confusion-class error rate；
- 用户纠错次数；
- variant reuse ratio；
- 从 Research Card 到 Game slot 的时间；
- 同一公共 Core 被多少合格 archetype 复用。
