# N135 — R04.3.4 事务切换与精确公网候选验证

## Bounded question

R04.3.4 是否关闭了 N134 的精确公网失败，并在 503、404、身份不符、取消请求和迟到 Worker 失败下保证旧异步任务不能污染当前服装，同时不把展示成功外推为视觉、物理或用户验收？

## 现有真实失败

N134 的 R04.3.3 仅有本地 60/60、432/432 展示成功；精确当前-head 公网 workflow 因 source-hash mismatch 正确 fail closed，`publicVerified=false`。此外，快速切换时旧 fetch/Worker 若迟到，存在清空或覆盖新服装的状态污染风险。

## 新证据

- PR #211 base：`5a0770741e6ecc35c41a66c7320d7390028d7fe4`
- 当前 evidence head：`36ce375dd0c2fc6f419b627899ecce1aa6849e7e`
- runtime source：`8c8245dd87e5fdf0e2a7720a96776743134ab17a`
- publication commit：`5d641c4fc105db205c0a1d860a4927cc8dadaa8e`
- 固定公网：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/presets/r0434-8c8245dd87e5/?preset=T01-P01
- 独立 native replay run 38113321537：success；artifact 11692209416；digest `sha256:d7dc6450242b04112ef075d29a11756fbaf212e88b8962a920c530d9f995bd9d`
- 最终公网 run 38113488943：success；artifact 11692503213；digest `sha256:4e2654fcf60edac9160ec9e5ec715a8bea495ca1bc3177b92a9f609ef7b27890`
- 真实公网浏览器：31/31；fresh-native：8/8；故障注入：10/10
- 739 个公网路径与 492 个当前三维预览通过；60/60 款、432/432 套系展示通过
- 503 可有界重试；永久 404 保留上一件真实服装、标签与深链接；身份不符不缓存、不推广；新选择取消旧 fetch；迟到的已取消 Worker rejection 不能清空最新套系
- `58dd8def...` 到 `36ce375d...` 仅 1 个证据提交，132 个变更均为 R0434 报告或 QA 截图，无 runtime/solver 变更

## 与当前制度比较

R2 tested-subject、task freshness、no-stale-delivery 和 explicit failure 已要求精确主体绑定、失败保留与禁止旧状态冒充当前交付。本轮是这些规则在 Tailor 异步 UI 上的可执行验证，制度结论为 `NO_NOVELTY`，不修改全局 OS 或门槛。

## 可反驳假设

若服装选择只能由仍为 current 的 request token 提交，并且公网推广必须绑定独立重放的精确 source chain，那么 503/404/身份不符/旧 Worker 故障不会覆盖最新合法服装；固定公网展示可以通过，但 38 款静态失败、视觉、物理和用户验收仍保持 HOLD。

## 最小回放

22/22 checks passed。结果：

`R0434_TRANSACTIONAL_PUBLIC_DISPLAY_VERIFIED_SCOPED__HOLD_38_STATIC_FAILURES_VISUAL_PHYSICS_USER_ACCEPTANCE`

## 适用边界

仅 PR #211 与固定 `r0434-8c8245dd87e5` 快照。390×844 仍只是浏览器 viewport，不是物理手机；也不认证物理 GPU、38 款失败、全部视觉质量、连续碰撞、动态穿着、套系联合物理或用户接受。

## 是否采用

更新既有 Tailor regression case；不新增重复 case，不改生产分支。当前状态：

POSTED=false / ACKNOWLEDGED=false / IMPLEMENTED=true / GATE-RUN=true / ADOPTED=false / USER-ACCEPTED=false。
