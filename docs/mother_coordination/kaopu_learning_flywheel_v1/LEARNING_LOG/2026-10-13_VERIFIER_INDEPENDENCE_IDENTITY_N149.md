# N149 — Verifier Independence Is Not Branch Isolation

状态：`Candidate / Human-local / classification replay only / no production change`

## Bounded question

由同一未区分 principal 创建、触发并解释的独立分支/read-only workflow，能否被称为 independent verifier review？

## 现有真实失败

Human R03 PR #244 comment `6140672006` 使用 “Independent visual review” 描述 smoke artifact 的检查；其隔离审计 PR #245 当前 author 为 `haihao0307`，没有 review submission。audit head `24c24c0740d2e17fb89e0284fd1c593715689693` 的 run `38363582672` 由 actor 与 triggering actor `haihao0307` 触发并成功。

PR #245 的 workflow 确有正向价值：`contents: read`，只保存参考截图、请求/错误记录与本仓库固定 R02 资源，不写 active R03 runtime。这证明 scoped audit evidence capture 和 mutation isolation；但相同 GitHub identity 下没有 verifier principal、角色分配、技术独立、决策权或签名决定收据，不能据此证明“独立审查/批准”。当前合法状态是 `AUDIT_EVIDENCE_CAPTURED__HOLD_INDEPENDENT_VERIFIER_IDENTITY_UNBOUND`，不是把已经采集的证据作废。

## 外部方法 / 证据

NASA 将 IV&V independence 分为 technical、managerial、financial 三类；其中 technical independence 要求独立于开发者评估，managerial independence 要求 IV&V 责任与实现组织分离，并由 IV&V 自主选择分析对象、技术、时间和问题。NIST 将 IV&V 定义为 objective third party 的 review/analysis/testing；SP 800-53 AC-5 要求识别、记录需要分离的职责，并用访问授权支持分权。

与 R2 比较：`Producer 不能批准自己` 和独立 verifier 原则已经存在，所以外部原则状态为 `NO_NOVELTY`。新增的是把“独立”从口号变成可审计字段，明确 branch/workflow isolation、自动机器检查和 verifier decision 是三个不同层次。

## 可反驳假设与最小历史回放

假设：如果 review 真正独立，receipt 必须区分 producer/verifier principal，绑定 verifier role assignment，证明 verifier 未创作被测 subject/baseline、可直接读取 exact subject 与授权 reference、criteria 在审查前冻结，且 producer 不能改写最终决定；否则只能报告 evidence capture 或 automated check，不得报告 independent approval。

新增 `VERIFIER-INDEPENDENCE-IDENTITY-001` Candidate。九类 fixture 覆盖：producer 未绑定、R03 当前 audit、仅命名 verifier、同 principal 自批、verifier 参与生产、producer 可覆盖决定、只看 producer 截图、producer 编写的冻结自动检查，以及完整独立收据。隔离 Node 分类回放 9/9；不代表任何真人/外部 agent 已参与，也不是生产视觉 gate。

## 适用边界与决定

这不是要求所有技术检查都由外部人员运行。Producer 写的 CI 仍可证明 frozen predicate 执行，状态是 `AUTOMATED_CHECK_VERIFIED__INDEPENDENT_APPROVAL_PENDING`。只有当结论使用 `independent review/approved/verifier accepted` 时才要求本 Candidate 的 identity/authority receipt。

决定：保留 Human-local `Candidate`，在 PR #245 做一次最小试验；不修改 R2、Human 生产分支或现行门槛。`POSTED=true`（PR #245 comment `6140828357`）；`CLASSIFICATION-GATE-RUN=true (9/9)`；`ACKNOWLEDGED / IMPLEMENTED / HUMAN-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

效果指标：首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、stale delivery 次数、accepted delta 内部迭代数与指令到合法 candidate 时间均为 `unknown`。
