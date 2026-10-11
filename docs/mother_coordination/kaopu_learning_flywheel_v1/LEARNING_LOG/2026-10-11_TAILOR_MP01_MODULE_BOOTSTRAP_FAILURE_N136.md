# N136 — Tailor MP01 材质联合候选的模块启动失败

## Bounded question

PR #215 是否把用户锁定的针织、皮革、牛仔材质真正接入 R04.3.4 原成衣并通过真实浏览器，同时保持“材质视觉 ≠ 衣形/物理/用户验收”的边界？

## 现有真实失败

R04.3.4 是最近已验证的 Tailor 公网展示；新的 MP01 候选若只证明材质文件存在，或复用 R04.3.4 的通过状态，而没有让当前精确 head 的页面启动并逐套验证，就会形成新的 stale-delivery / wrong-subject promotion。

## 新证据

- PR #215 base：`5c6d0c36535648d8b3d4b61c70d7047258e3a969`
- 精确 head：`8d1e3bec101a097ed4937425443146c48e648000`
- Tailor runtime：`8c8245dd87e5fdf0e2a7720a96776743134ab17a`
- 针织：`20b466073bb458408a078260a018460c81f627b9`
- 皮革：`af389cc216ddd01e3b1aa66c972f42b2587bc797`
- 牛仔：`fa143743b1b0f3d74ff827664d06ff119ef87063`
- 材质导出层：12 个配方、40 张 2048×2048 无光照字段；导出检查通过；未带入私有源码；未迁移完整 Ray/Wave 光学。
- 精确候选 run [38122050774](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38122050774)，job `114418623339`：failure。
- artifact `11695579206`；digest `sha256:13db349a4e444ef334b05dfef88db1efdc49056a137b4c13bb18785341727f36`。
- 浏览器 pageerror：`Failed to resolve module specifier "three". Relative references must start with either "/", "./", or "../".`
- 根因：MP01 入口复用固定 R0434 模块，但依赖图含裸 `three` specifier；MP01 `index.html` 没有相应 import map。
- 门禁直到 300 秒 readiness timeout 才失败；`checks=[]`、`looks=[]`、`passed=false`、`public=false`、`physicalWearAccepted=false`。
- 保留/发布步骤正确跳过，没有合法公网候选。

## 与当前制度比较

R2 的 tested-subject、explicit failure 与 no-stale-delivery 已禁止把材质来源回执或旧 R0434 公网成功冒充为当前 MP01 结果。因此制度结论为 `NO_NOVELTY`。新的技术失败机制是“浏览器模块图未启动但只靠长 readiness timeout 才暴露”，应补入既有 Tailor 回归证据，不需要创建重复 case 或修改全局 OS。

## 可反驳假设

若 MP01 使用与固定 R0434 runtime 一致的精确 import map 或完全限定模块 URL，并且浏览器门禁把 readiness 与首个 pageerror/关键 module-resolution error 竞速，那么故意破坏的裸 specifier 应在 10 秒内 fail closed、保留 0 个 look；修复后的精确 head 则必须先通过 12/12 look、原 garment identity、毫米 UV、真实材质像素变化、快速切换和非法材质不替换，发布步骤才可运行。

## 最小回放

本轮历史/候选回放使用精确 run 38122050774。观察结果：

`MP01_MATERIAL_EXPORT_VERIFIED__MODULE_BOOTSTRAP_FAILED__NO_LOOKS_RETAINED__HOLD_PUBLIC_VISUAL_PHYSICS_USER_ACCEPTANCE`

这验证了“不发布失败主体”，但没有验证建议的 ≤10 秒快速失败，也没有验证修复后 12/12 look；两项均保持 Candidate。

## 修复后最小重放

PR #215 随后产生局部修复与精确正向回放：

- 实现 head：`1ff395d89e0b2e777a028747eadf49c13696bcde`
- 保留证据 head：`5c63ab38b8822cb3e5e097489f1a95d1b46a0088`
- workflow [38122512641](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38122512641)，job `114419985913`：success
- artifact `11695579703`；digest `sha256:9dfefeb9080f1bf81e38db7b5b152d1f4cd580f5388d5ed1825e90a1fe664851`
- 修复：固定 `three` import map；readiness 与 pageerror/初始化失败竞速；只从失败 artifact 恢复获准材质字段，不恢复旧应用源码
- 27/27 checks、12/12 looks 通过；原人物/服装 identity、毫米 UV、真实材质像素变化、快速切换 latest-wins、非法材质不替换、390×844 viewport 均有正向证据
- `public=false`、`physicalWearAccepted=false`，无 page/shader error
- 尚未故意重新破坏 specifier 验证 ≤10 秒负向快速失败，因此该一项仍为 Candidate

正向结果：

`MP01_FIXED_MODULE_BOOT_LOCAL_12_LOOKS_VERIFIED__HOLD_PUBLIC_VISUAL_PHYSICS_USER_ACCEPTANCE`

## 适用边界

覆盖首次失败 head `8d1e3bec...`、修复 workflow head `1ff395d...` 与保留证据 head `5c63ab3...`。正向 CI 回放验证固定原成衣上的 12 套静态材质外观，不是实际 HTTPS、公网浏览器、物理设备、全部视觉质量、材质物理、联合碰撞、动态穿着或用户接受。原 R0434 仍是最后一个已验证公网 Tailor 展示。

## 效果指标

- 首次候选通过：false（run 38122050774）
- 到当前本地合法候选的精确 workflow 迭代：2（首次失败 + 一次修复重放）
- stale delivery 推广：0；失败 run 的保留/发布步骤被跳过
- rejected lineage 继承：0 observed；修复只恢复获准材质字段，并重新生成当前应用/原成衣绑定
- 用户纠错次数、同类错误复发率、从用户指令到合法 candidate 的时间：unknown

## 是否采用

更新既有 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`，不新建重复 regression case；向 PR #215 路由 Tailor 局部 Candidate，不改生产分支、不降低门槛。

状态：POSTED=true / ACKNOWLEDGED=false（无独立文字回执） / IMPLEMENTED=true / GATE-RUN=true（失败与修复正向结果） / ADOPTED=false / USER-ACCEPTED=false。

失败路由回执：[PR #215 comment 6106819576](https://github.com/haihao0307/guilin-dem-pipeline/pull/215#issuecomment-6106819576)。修复重放回执：[PR #215 comment 6106851950](https://github.com/haihao0307/guilin-dem-pipeline/pull/215#issuecomment-6106851950)。
