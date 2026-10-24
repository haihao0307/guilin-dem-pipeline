# N190 — “颜色以后再换”只能放宽颜色

## Bounded question

用户说建筑先迅速做、颜色不准以后可换，但仍要求查清墙面究竟是涂料、瓷砖还是其他材料；执行端能否把这句话解释成整栋建筑都可以“差不多”？

答案：不能。该指令只把 `colorTone` 降为可逆的 `PROVISIONAL`，没有放宽建筑身份、参考照片时效、立面/窗洞结构或材料类别。

## 与 Current Best View 的比较

`REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md` 已规定局部授权不得扩散；N189 已要求 `featureLedger` 与 `toleranceSource`。因此本轮不新建 regression，也不改 R2。新增的是把这条原则转成逐字段、可执行的状态合同，避免 Production Mother 用一个全局 `relaxed=true` 绕过严约束。

## Task Anchor Candidate

每个可见属性单列：

- `fieldPath`
- `mode: STRICT | PROVISIONAL | UNKNOWN`
- `sourceDigest`
- `allowedClaim: CANDIDATE | FINAL`
- `reviewTrigger`

本次建筑任务的最小策略：

- `buildingIdentity = STRICT`
- `referenceRecency = STRICT`（用户明确要求找维修后的最新照片）
- `facadeGeometryAndOpenings = STRICT`
- `materialClass = STRICT`（涂料、瓷砖或其他，必须有来源）
- `colorTone = PROVISIONAL`（允许先近似，只能标 Candidate，之后可替换）

没有用户给出的数值容差时，不发明色差阈值；只记录“颜色尚未最终确认”。

## Delivery Receipt / verifier

- 每个字段单独给出 `VERIFIED / PROVISIONAL / UNKNOWN / MISMATCH`；
- `PROVISIONAL` 必须绑定最新用户指令 digest，并禁止宣称 `FINAL`；
- 任一 `STRICT` 字段不是 `VERIFIED + matches=true`，整体 fail closed；
- 禁止全局 `relaxed=true`，禁止从颜色可变推导出材质可猜、旧照片可用、窗洞可泛化；
- 用户后续只纠正颜色时，保留已验证材质和几何，不重开整栋建筑。

## 最小可反驳回放

10 个合成夹具覆盖：颜色明确 provisional、错误材质、旧照片、错误建筑、泛化窗洞、全局放宽、未绑定用户指令、把 provisional 冒充 final、把材质降级 provisional，以及全部字段验证完成。

预期只有“严字段全过且颜色明确 provisional”和“全部字段 verified”进入 Candidate；其余拒绝。该 probe 只验证合同语义，不证明真实建筑或材料已验证。

## 外部老师与状态

- 外部老师：`NO_NOVELTY`。字段级约束/局部 override 的原则已被当前 KAOPU gate 覆盖，本轮价值来自把最新用户指令实例化为可运行合同。
- N189 regression：沿用，不重复创建。
- OS / main / 生产 Mother：未修改。
- 精确 Architecture/Materials Mother：仍 `UNKNOWN`；只通过 #91 根协调入口定向路由。
- KPI：unknown。
