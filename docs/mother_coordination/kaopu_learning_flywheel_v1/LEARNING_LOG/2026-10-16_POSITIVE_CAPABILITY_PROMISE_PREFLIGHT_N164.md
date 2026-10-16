# N164 — 正向能力承诺也必须先过可执行探测

- 日期：2026-10-16
- Mother：Coordinator / cross-Mother agent runtime
- 类型：制度验证 / capability preflight / user-correction regression
- Bounded question：执行端能否在未验证当前音频读取与转写链路时，先向用户承诺“能听懂并整理云南方言录音”？
- 结论：`INPUT_BOUND__HOLD_INPUT_READ_UNVERIFIED`。

## 1. 现有真实失败

用户提供云南方言 WAV 并询问能否整理。执行端先肯定能做，随后才暴露当前链路未证明能读取或识别该音频，用户因此明确纠正“刚才你吹牛”。本记录不复制录音内容或个人转写文本。

这不是音频格式本身已被证明有问题，也不是“所有 OpenAI 模型都不能处理音频”。失败只绑定当前执行时刻的 exact runtime：在承诺前没有成功的 exact-input read probe、没有可调用的 input-audio transcriber、没有输出与该 WAV 的身份绑定，也没有云南方言质量基线。

### 同谱系后续证据（不新建 regression）

用户随后报告“推荐的 app 不行”，询问如何从电脑删除，并明确指出浪费了很多时间。可确认的新增机制不是某个具体 App 一定有缺陷，而是推荐把安装、试错与清理成本转嫁给了用户；当前可检索证据没有给出 App/版本、操作系统、安装源、确切失败点，或推荐前是否说明卸载/回滚路径，因此这些字段保持 `UNKNOWN`，不得补猜。

该事件更新同一 Candidate，而不新建用例：安装型外部路线若被表述为“能用”，除任务能力证据外，还必须绑定 exact app/version、平台、官方安装源、专项 task-fit probe、隐私/费用说明与 uninstall/rollback path。缺失 App 或平台时状态为 `EXTERNAL_ROUTE_RECOMMENDED__HOLD_SUBJECT_UNBOUND`。

## 2. 外部方法 / 与 KAOPU 当前制度比较

NIST AI RMF 1.0 明确提醒，人会假设 AI 在所有环境都能正常工作，并要求理解模型与系统的限制。OpenAI 的 capability-evaluation 方法进一步指出，agent 能力评估必须使用用户实际依赖的同一 agentic interface，并把 tool access 作为评估条件；harness 不同，测得能力会改变。

- https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf
- https://openai.com/index/trustworthy-third-party-evaluations-foundations/

这些原则本身与 KAOPU 的证据分层一致，记为 `NO_NOVELTY`。但当前 `Execution Capability Precheck Policy` 只硬性覆盖“未经探测就错误否认能力”，没有覆盖相反方向的“未经探测就肯定有能力”。本轮新增的是可执行的正向承诺分支。

## 3. 可反驳假设

假设：只要在正向能力承诺前强制绑定以下证据，就能在用户之前拦截此次吹牛及后续无效 App 推荐：

1. exact input handle/digest；
2. 当前 runtime 对 exact input 的真实读取探测；
3. input-audio decoder/transcriber 的可调用身份；
4. 实际 probe 输出与 exact input 绑定；
5. 静音或损坏音频 known-bad control；
6. 若承诺“听懂云南方言”或“按录音校正文本”，还需预冻结的专项质量标准与样本评测。
7. 若改走需安装的外部 App，还需 exact app/version、用户平台、官方安装源、专项 task-fit evidence、隐私/费用说明与卸载/回滚路径。

如果这些字段仍把真实失败判成可承诺，则假设被反驳。若同时能放行完整正控且不把“通用转写可执行”夸大成“方言可靠理解”，则假设获得初步支持。

## 4. 最小历史回放

建立去重 Candidate `CAPABILITY-PROMISE-REQUIRES-EXECUTABLE-PROBE-001`。它不替代既有 negative-denial precheck，而是补上正向承诺方向。后续证据仍归入同一 case。扩展后的隔离分类回放 13/13，新增覆盖：

- 未绑定输入；
- 当前真实纠正（附件存在但 exact read 未验证）；
- output-audio 冒充 input-audio；
- 产品/模型文档能力冒充当前 runtime 路由；
- 转写结果未绑定 exact input；
- 通用转写冒充云南方言能力；
- 有文本但不能对照音频仍声称可校正；
- 静音/损坏正控未拒绝；
- exact-input + executed route + negative control + scoped eval 完整正控。
- 无法恢复 App/平台身份的真实后续纠正；
- App/平台已绑定但未做 exact-task probe；
- task fit 已证但缺卸载/回滚路径；
- App/平台/task-fit/披露/回滚全部绑定的完整正控。

当前只允许诚实说明：可以处理用户提供的文字；是否能对 WAV 做音频依据的整理，在 exact route 未验证前保持 HOLD。不得将未来可能安装的 API、其他模型的音频能力或另一个会话的工具视为当前已具备。

## 5. 适用边界与是否采用

局部采用为 cross-Mother Candidate，先路由根协调 issue：

- 只约束用户可见的正向能力承诺，不阻止低风险的工具发现与只读探测；
- 一个通用转写成功只证明该 subject/route 的通用转写可执行，不证明方言质量、说话人分离、完整准确率或最终验收；
- 同样适用于 OCR、浏览器、GitHub 写入、设备、外部服务等正向能力声称；
- 未经一次未来真实任务试用与独立 verifier 回执，不修改 root AGENTS、不全局强制。

## 6. 生命周期与 KPI

- regression：`CAPABILITY-PROMISE-REQUIRES-EXECUTABLE-PROBE-001`（Candidate）
- classification replay：13/13
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6207593472
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：false
- 已记录用户纠错事件：2；同谱系复发证据：1
- 其余首次候选通过率、同错复发率、stale delivery、accepted delta 内部迭代数及从指令到合法 candidate 时间：unknown
