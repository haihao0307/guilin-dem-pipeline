# 靠谱世界大合唱完整逻辑链 R2 候选

日期：2026-09-09

状态：六角色对话后的候选闭环，不替代既有冻结稿

## 1. 七层结构

### 第一层：现实层

现实世界独立存在。系统永远只能通过观测、测量、文献、模型和重建逐步接近它。

### 第二层：靠谱语义层

靠谱规定所有参与者怎样说清楚：

`谁，在哪里，什么时候，处于什么尺度，具有何种量或状态，与谁有何关系，依据什么，误差和未知是什么。`

这一层继承已有 SI 单位、时间标准和地理参考体系。编码允许变化，语义保持稳定。

### 第三层：证据与陈述层

稳定数据流为：

`Source Event -> Evidence Asset -> Observation -> Claim -> Evidence Graph`

Source Event 保存拍摄、测量、书写、扫描、计算等产生事件。

Evidence Asset 保存底片、照片、图纸、文本、传感器文件和扫描件。

Observation 保存一次观察覆盖了什么、能看见什么、用什么设备或认知条件完成。

Claim 保存从 Observation、文献或推断中形成的可支持、可反驳陈述。

Evidence Graph 保存复制、派生、共享标定、共享假设、支持和反对关系。

### 第四层：世界总谱层

世界总谱把内容组织为递归谱系：

`World -> Region -> Scene -> Object -> Part -> Material/Microstructure`

温州是首个 Region Score。

横向声部包括 Terrain、Hydrology、Atmosphere、Ocean、Ecology、Built Environment、Human Activity、History、Evidence 和 Time。

每一谱页拥有稳定地址、父子关系、时间范围、尺度范围、共享边、依赖和冻结版本。

### 第五层：造波与图层

连续量使用带类型的造波或场：

`F(x,t,c) = B(x,t,c) + Σ a_k(t,c) φ_k(T_k(x,t,c)) + R(x,t,c)`

其中：

`B` 是稳定低频主体。

`φ_k` 是基础波、噪波或其他生成核。

`T_k` 是坐标、旋转、尺度、域扭曲和局部变换。

`a_k` 是带时间和 Context 的幅值或系数。

`R` 是无法可靠推导的必要残差。

所有项必须绑定 Quantity Kind、Unit、Frame、Domain、Validity Range 和 Uncertainty。

离散身份、事件、社会关系、部件关系和证据关系使用图：

`G = (Objects, Events, Relations, Evidence, IdentityTransitions)`

造波和图通过相同的 Identity、Space、Time、Scale 和 Provenance 对齐。

### 第六层：指挥与演奏层

一个 View 由指挥生成：

`View = Conduct(Score, Query, Time, Space, Scale, Context, PolicyVersion, ResourceBudget)`

指挥可以选择声部、解码尺度、运行模拟、重建历史或生成艺术表现。

指挥不能静默改变原始 Evidence、Object Identity、共同单位、冻结版本和 Claim 来源。

不同指挥允许产生不同 View。每个 View 都必须带 Policy、Evidence Set、Omission、Uncertainty 和 Transaction Time。

### 第七层：学习与治理层

AGO 先继承已有可靠成果，再把大问题拆成可独立验证的小问题。

多 AGO 保持部分隔离，随后交叉质询。

Critic 寻找反例、共享偏差、尺度泄漏和语义偷换。

Verifier 检查单位、坐标、时间、来源、边界、守恒、独立根、Unknown 和回滚。

小妈完成 Judgment：

`Promote, Continue, Park, Reject`

成功结果进入 Candidate Capsule。达到明确门槛时形成新的阶段冻结点。

## 2. 完整更新闭环

`现实或历史痕迹`

产生 Source Event 和 Evidence Asset。

解析为 Observation。

形成一个或多个 Claim。

接入 Evidence dependency graph。

对齐 World Object、Space、Time、Scale、Quantity 和 Relation。

影响局部 World Score 或 Object Score。

连续部分生成局部造波修正，离散部分生成图与事件修正。

Critic 检查过度推断、假独立、共享系统误差和身份混淆。

Verifier 检查机器不变量和领域约束。

小妈决定是否晋级 Current Best View。

达到条件后形成可寻址冻结点。

不同指挥按任务演奏。

新 Observation 到来后只重算受影响的 Claim、谱页、时间区间和 View。

旧证据、旧 Claim、旧 View 和旧冻结点继续保留。

## 3. 与物理相容的条件

1. 每个连续场声明 Quantity Kind 和维度。
2. 只有量纲相容的项可以组合。
3. 守恒量、源项、汇项和边界通量显式。
4. 坐标和参考系转换可追溯。
5. 时间步进、因果关系和稳定条件明确。
6. 随机造波保存种子和概率模型。
7. 数值近似与现实观测保持区分。
8. 近似模型声明适用尺度和区域。

## 4. 与化学相容的条件

1. 组成、相态、浓度、温度和压力分别表达。
2. 反应和传输拥有物质守恒约束。
3. 视觉表面参数不能替代化学组成。
4. 材料老化需要时间、环境和反应路径。
5. 经验材质和实测材料状态保持不同 Claim 类型。
6. 微观谱与宏观有效性质之间保留模型与误差。

## 5. 与时间相容的条件

1. 查询过去和动力学逆演是两件不同操作。
2. 历史 Key State、推断区间、模拟过渡和艺术插值分开。
3. 每个 Change 记录有效时间和证据时间。
4. 不可逆过程不能靠反向滑块冒充真实逆过程。
5. 一个时间点的未知不会被相邻时间自动填满。
6. 新证据只更新受影响时间区间。

## 6. 靠谱与不靠谱的操作边界

靠谱 Observation 可以粗糙，可以带错误，只要身份、来源、时间、范围、限制和误差明确。

靠谱 Claim 必须不超出支持它的 Observation、方法和假设。

不满足来源、身份、时间和可追溯要求的内容不能进入 Current Best View。

来源不明但可能有线索价值的内容进入 Quarantine。

时代中真实产生的错误观察进入 Perceived World。

同源重复资产去重，不增加独立根。

明确伪造且无保留价值的污染可以删除，同时保留必要审计记录。

## 7. 温州谱系首个落地骨架

`World Score`

下面挂接：

`China Region -> Zhejiang Region -> Wenzhou Region`

温州地区谱至少包含：

`Canonical Terrain, Hydrology, Coastline, Ocean Interface, Atmosphere Context, Built Objects, Ecology, Historical Evidence, Time Changes`

第一份真实谱页需要同时拥有：

1. 固定世界地址和外部坐标适配器。
2. 低频 Canonical Truth。
3. 一个可验证连续场。
4. 一个离散 World Object。
5. 两个以上独立 Observation root。
6. 至少一个冲突或 Unknown。
7. 一个局部 Change。
8. 一个 Current Best View。
9. 一个造波或残差重建。
10. 一个 Verifier 和回滚指针。

## 8. 世界大合唱的角色闭环

用户确定世界的方向和价值目标。

小妈维护共同节拍、靠谱语义、问题树、资源和 Judgment。

Mother 维护各自声部，并服从共同 Context 和接口。

AGO 研究、实验、攻击和验证。

Critic 寻找错拍与隐藏偏差。

Verifier 负责校音、计量和机器检查。

Conductor 根据任务演奏，不篡改总谱身份。

最终形成：

`一个世界 + 一套靠谱语义 + 一份可递归总谱 + 多个合法声部 + 多种透明指挥 + 持续证据回流`
