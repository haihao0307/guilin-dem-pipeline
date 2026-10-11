# N134 — R04.3.3 本地全类别展示通过，但精确公网 head 失败

## Bounded question

R04.3.3 是否已经把全部类别稳定展示出来，同时没有把本地展示成功继承为公网、视觉、物理或用户验收？

## 现有真实失败

N133 已确认 R04.3.2 的静态通过与 PNG 可解码不足以证明视觉合格。用户随后再次要求审核全部类别并直接修复 GitHub 代码。PR #208 是新的生产候选。

## 精确证据

- PR #208 base: `7be34c18a44859e2ce2143c377d2c450e1ad89f5`
- 当前 head: `5a0770741e6ecc35c41a66c7320d7390028d7fe4`
- 本地审计 subject: `fd69f5664cfb015e93e0ac301af58593e944b921`
- 本地 workflow run 38107266439: success
- 本地浏览器报告: 23/23 checks；60/60 styles；432/432 outfits；五类别全覆盖
- 报告明确 `actualPublicBrowser=false`；手机仅 390×844 viewport；renderer 为 SwiftShader
- 精确当前-head 公网 run 38108821701: failure
- 失败点: `finalize_display_r0433.py` 的 source-hash fail-closed assertion 拒绝覆盖已变化的 `qa_r0433.py`
- 证据 artifact: 11690642035，digest `sha256:98f3ccf916aebd2e980d60f1e48131311ec34f3fcc737966e51045562eaa3d20`
- `R0433_RELEASE_STATE.json`: `publicVerified=false`
- 22 static pass / 38 needs repair 不变；视觉、物理、联合碰撞、用户验收仍 false

## 与当前制度比较

R2 tested-subject、freshness 与 no-stale-delivery 门已经要求精确主体绑定并按来源/浏览器/设备/生产/用户验收分层。当前 hash assertion 正确 fail closed，没有把旧本地成功冒充新 head 的公网成功。因此制度结论为 `NO_NOVELTY`。

## 可反驳假设

若本地展示验证与公网交付严格绑定各自 exact subject，R04.3.3 可以保留 60/60 与 432/432 的本地展示成功；但只要精确当前 head 的公网 workflow 失败或 `publicVerified=false`，公网交付、视觉、物理与用户验收必须继续 HOLD。

## 最小历史回放

16/16 checks passed。结果：
`R0433_LOCAL_ALL_CATEGORY_DISPLAY_VERIFIED_SCOPED__HOLD_EXACT_PUBLIC_HEAD_FAILURE_VISUAL_PHYSICS_USER_ACCEPTANCE`

## 适用边界

仅 PR #208 / R04.3.3。不能外推到真实公网、物理设备、38 个静态失败款、套系联合碰撞或用户接受。旧 R04.3.2 固定树与生产分支不改。

## 是否采用

更新既有 Tailor regression case；不新增全局门禁、不降低阈值。当前状态：
POSTED=true / ACKNOWLEDGED=false / IMPLEMENTED=true / GATE-RUN=true / ADOPTED=false / USER-ACCEPTED=false。\n\n路由回执：PR #208 comment `6105119399`。
