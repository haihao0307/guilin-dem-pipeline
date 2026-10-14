# N159 — Fabric R03 的调度证据成立，但局部计时不能回答秒级首用

- 日期：2026-10-15
- Mother：Human / Fabric
- 类型：制度验证 / 性能可观测性 / 用户纠错回归
- Bounded question：R03 是否证明了用户可感知的秒级首用进展，还是只证明了调度正确且计时边界仍不完整？
- 结论：`SCHEDULING_CORRECTNESS_AND_VISUAL_EQUIVALENCE_VERIFIED__HOLD_END_TO_END_FIRST_USE_LATENCY_ATTRIBUTION_UNBOUND`。

## 1. 现有真实失败

PR #289 的新增证据真实且边界诚实：相同参数不重建、重复选择合并、同一轮只启动最后选择、过期结果拒绝，以及七类默认画布与 R02 同设置 SHA256 一致，均可保留。

但用户要求的是加载/解析降到秒级、操作不再等待数分钟。当前公网软件浏览器的牛仔就绪约 95.86 秒，原生回归约 118.24 秒，皮革约 21.86 秒；两次牛仔运行不是同环境、同缓存状态的配对测量。`denimStartup.compileMs≈184 ms` 又从九个程序已经提交后的 `waitPrograms()` 才开始，不包含此前 `compileShader` / `linkProgram` 调用，也不包含首次使用触发的延迟 GPU 工作。它因此不能解释“选择材料到首个可用画布”的关键路径。

这不是 R03 虚报：其 DELIVERY 已明确披露以上边界。本轮发现的是下一步门禁仍缺一个可执行对象，不能用局部计时替代端到端 readiness。

## 2. 外部方法 / 证据

Khronos 的 `KHR_parallel_shader_compile` 只提供不阻塞的完成状态轮询；官方示例明确提醒，总 link wall time 可能相同。因此它对 R03 属于 `NO_NOVELTY`，不能作为总耗时下降证据。

W3C User Timing 提供单调高精度的 named mark / measure，可把端到端起点、阶段边界和最终 readiness 绑定到同一 run。W3C Long Tasks API 暴露至少 50 ms、可能阻塞输入响应的 UI-thread task。两者有 W3C 规范、持续维护仓库与 Web Platform Tests；本轮把组合方法列为一个 bounded `TEACHER_CANDIDATE`：只教“完整阶段账本 + 阻塞观测”，不教 Fabric 算法，也不证明 GPU 完成。

许可：W3C 仓库使用 W3C Software and Document License；WPT 使用 BSD-3-Clause。风险：Long Tasks 仍是 Working Draft，浏览器必须先探测支持；不支持时记 Unknown，不能静默通过；该 API 也不替代 GPU fence/完成边界。

## 3. 与 KAOPU 当前制度比较

R2、N33 与 N39 已分别要求声明/证据分层、用户可见启动和资源窗口；但 N33 聚焦大 payload 前是否有可见 shell，N39 聚焦资源预算，均不覆盖“局部阶段计时被误当总 first-use readiness”的完整相位账本。因此不是重复 case。

本轮新增 `PHASE-LOCAL-TIMER-NOT-END-TO-END-READINESS-001`，把用户的秒级要求转为下一次 Fabric trial 的 Delivery Receipt 字段：exact subject/run、cache state、同环境 R02/R03 pair、从选择到 material-ready 的无缺口 span ledger、并行区间去重、扩展支持与实际路径、longtask support/entries、正控、预冻结 budget 与 USER-ACCEPTED 分离。

## 4. 可反驳假设

若 R03 已具备合法端到端性能证据，则同一 exact run 应能证明：

1. 起点是用户选择进入系统，而不是某个后置等待函数；
2. top-level span 的并集无未解释空洞地覆盖到 `material-ready`，并避免并行阶段重复计时；
3. shader submit、program completion、first-use deferred work、geometry、sampling、first meaningful canvas 与 interaction-ready 都有边界；
4. 注入的 pre-submit delay、first-use stall、>50 ms main-thread busy loop 会分别增长预期 span / 触发 longtask；
5. 任何 speedup 比例来自同环境、同设备档、同缓存态的 R02/R03 配对；
6. scoped pass 仍不等于 USER-ACCEPTED。

给出这组 receipt 即可反驳当前 HOLD。

## 5. 最小历史回放

11/11：subject 未绑定、scheduler 未证、视觉回归、当前局部计时、遗漏 first-use GPU、非配对 speedup、缺正控、缺 responsiveness、budget 未冻结、scoped pass 用户待验、用户接受，全部按预期分类。当前 R03 exact evidence 分类为 `HOLD_END_TO_END_PHASE_ATTRIBUTION_GAP`。

这只是制度/仪表 probe，没有修改 R03 源码、发布网页、生产 Mother 分支、main 或 R2。

## 6. 适用边界与决策

仅在下一次 Fabric first-use / material-switch latency 声明中单 Mother 试行。R03 的队列合并、stale-result 防护、差分恢复、公开运行与像素等价证据继续成立；本 case 不要求更换渲染算法、不降低质量、不引入固定 LOD 或动作缓存，也不把软件 Chromium 冒充物理 GPU。

决策：`CANDIDATE_ONLY_NEXT_FABRIC_LATENCY_TRIAL`。老师状态：W3C User Timing + Long Tasks 为 `TEACHER_CANDIDATE`；Khronos extension 为 `NO_NOVELTY`。待 Fabric Mother ACK、实现 exact-run span ledger、跑正控和配对 trial 后再决定 PROBATION / RETIRED；当前未进入 Active Teacher。

## 7. 生命周期与 KPI

- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/289#issuecomment-6181044319
- ACKNOWLEDGED / IMPLEMENTED / TARGET-GATE-RUN / ADOPTED / USER-ACCEPTED：false
- learning classifier gate：11/11
- 首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、accepted delta 内部迭代数、从指令到合法 candidate 时间：unknown
- stale delivery 次数：0（R03 exact source/public/runtime 均绑定，且旧版本未冒充）
