# 靠谱后续主线与未完成项

## 1. 新对话直接进入温州真实闭环

温州已经拥有全域 Canonical Truth、世界谱页、多尺度瓦片、共享边、海岸、水系、城市和后续历史资料接入条件。下一轮不要继续停留在纯概念讨论，也不要先设计庞大正式格式。

首个真实案例应控制在很小边界内，同时覆盖完整链条。

最低要求：

1. 一个真实温州空间范围、谱页或对象。
2. 一个连续场，例如地形、水面、河岸、植被覆盖或其他有明确 quantity kind 的场。
3. 一个离散 World Object，例如建筑、道路、水渠、桥、岸线设施或可稳定识别的自然对象。
4. 两个真正独立的 Observation Root。
5. 一个同源复制对照，证明复制不会增加独立观察数量。
6. 一个冲突、Unknown、Not Observed 或 Observed Absent 状态。
7. 至少两个明确时间点或一个时间区间变化。
8. 一次带类型造波生成、重建或多尺度展开。
9. 一个公开 policy、query scope、time、scale、budget 和 transaction time 的 Current Best View。
10. 一个可执行 Verifier 和完整回滚点。

## 2. 当天节奏

研究节奏固定为：

`小时级探索 + 当天判断 + 每日合并 + 每周大升级 + 达到条件随时冻结`

每个小时级循环只处理少量可验证问题。结果立即进入小妈 Judgment，状态只能是：

`Promote Candidate`

`Continue`

`Park`

`Reject with Record`

周会负责结构复盘、跨 Mother 方法迁移、失败路线清理和阶段升级。周会不构成日常工作的等待门槛。

## 3. 温州第一轮建议拆分

### AGO A：来源与继承

列出温州当前可直接继承的 Canonical Truth、坐标、谱页、历史影像、测绘和已有验证器。确认哪些是原始证据，哪些是处理产物，哪些是候选。

### AGO B：连续场与造波

选择一个连续场，声明 quantity kind、unit、frame、domain、time semantics、boundary、valid scale、uncertainty 和 residual policy。建立 A=0 恢复和局部修正测试。

### AGO C：对象与时间身份

选择一个离散对象，检查其跨时间身份、同址新建、重建、拆分、合并、partOfAtTime 和 successor 关系。

### AGO D：Observation 与 Evidence

建立 Source Event、Evidence Asset、Observation、Claim 和 Evidence Graph。人工确认独立观测根、共享标定、共享假设和系统误差。

### AGO E：Critic

攻击同源复制、错误地理配准、时间平滑伪历史、现代重建污染、Unknown 被填满、局部规律过度推广和总指挥单点误判。

### AGO F：Verifier

只检查机器不变量，不参与美化和解释。至少检查单位、坐标、时间、对象身份、证据根、来源链、Unknown、残差、View 政策、冻结提交和回滚。

### 小妈 Judgment

判断路线继续、暂停、改派和晋级。发现 AGO 在同一点重复时立即拆散。高希望路线必须安排独立攻击。

## 4. 真实资料进入前的边界

1. 不用 AI 生成内容填补真实资料缺口。
2. AI 重建可以作为 Synthetic 或 Reconstruction 资产进入候选层。
3. 未找到来源的资料进入 Quarantine。
4. 原始证据只追加，不覆盖。
5. 任何派生结果保留算法、版本、参数、输入、输出、时间和执行者。
6. 当前不调用 Anthropic 或 Claude Code。
7. 当前不使用 Make 作为长期学习基础。
8. 当前不修改生产 Mother。
9. 当前不宣布正式靠谱 R2。

## 5. 仍需解决的架构问题

1. 全球世界谱坐标与现有经纬度、投影和垂直基准之间的完全可逆适配。
2. 连续造波场与离散 Object Graph 的最小接口。
3. 相邻航空帧、同一航线和共享相机标定的部分独立性表达。
4. 多个独立 Observation 共享同一上游基准时的有效证据强度。
5. 大规模 Evidence Graph 的索引、增量求解和影响传播。
6. Object Identity 长期 split、merge、successor 和 reconstruction 查询。
7. 时间关键帧、变化事件、区间、模拟插值和艺术过渡的区分。
8. 历史照片的相机内参、外参、镜头畸变、扫描变换、GSD 和姿态不确定性。
9. 地方语言、地方分类和全球共同语义的双向映射。
10. 小妈 Judgment 的可审查性和单点误判防护。

## 6. 晋级靠谱 R2 的最低门槛

只有同时满足以下条件，才可以提出 R2 冻结候选：

1. 至少一个真实温州案例完整通过。
2. 原始证据、Observation 和 Claim 分层成立。
3. 同源复制没有增加独立 Observation Root。
4. Unknown 没有被默认值或生成细节替代。
5. 造波输出具有明确类型和适用范围。
6. Current Best View 可以从同一证据集重算。
7. 新增或撤销一条 Claim 后，影响范围可以追踪。
8. 冻结点和实验可以完整回滚。
9. Builder 与 Verifier 分离。
10. 用户完成阶段性审查。

## 7. 新对话第一个回答应完成的事

新助手读取全量包并运行验证器后，应直接报告：

1. 包名、SHA-256、文件数量与验证结果。
2. 冻结点 F1 和两个 Draft PR 的真实状态。
3. 靠谱、世界大合唱和造波的固定含义。
4. 温州首个真实 fixture 的候选范围。
5. 当天可以开始的第一批小问题。

不得只回复已经接管，也不得把候选说成正式完成。