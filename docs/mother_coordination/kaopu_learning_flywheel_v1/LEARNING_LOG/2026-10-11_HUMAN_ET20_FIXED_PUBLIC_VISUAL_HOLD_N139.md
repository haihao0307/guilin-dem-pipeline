# N139 — Human ET20 固定公网功能门通过、视觉验收保持 HOLD

- 日期：2026-10-11
- Mother：Human
- 类型：技术验证 / 视觉 V&V / 生产状态语义
- Bounded question：ET20 的 source 与 fixed-public browser 门、皮肤参数响应、灯光 ablation 和阴影平滑 probe 全部通过，能否证明“影视皮肤”已经视觉合格？
- 结论：不能；这些结果证明 exact candidate 的功能门与若干像素响应成立，但没有授权 visual baseline、独立视觉判定或用户接受。
- 状态：`ET20_FIXED_PUBLIC_FUNCTIONAL_GATE_VERIFIED_SCOPED__HOLD_APPROVED_VISUAL_BASELINE_INDEPENDENT_VISUAL_AND_USER_ACCEPTANCE`

## 1. 现有真实失败 / 新事实

PR #225 的最终精确运行已经完成，不再是“浏览器复核中”：

- workflow run：`38135648318`，conclusion=`success`
- workflow checkout head：`e7a816e6574b50c37f8dbbc206137d113efff39a`
- reviewed source：`8cf2fc0f297602600cb6ed4c6bd4452a0aab0df2`
- immutable build/public：`1cd8904342118639c1dd5cd83322109880bbb7f8`
- evidence head：`ac6279f6f3275db16d0fa4af4377763f12b3c33b`
- artifact：`11701580664`
- artifact digest：`sha256:2d6344a54af8a7170d02f2ea7247ccce90216bd5fe59137c54f0a03759aabdc7`
- fixed public URL：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/1cd8904342118639c1dd5cd83322109880bbb7f8/kaopu-unified-human-workbench/cinematic-r01/preview.html

source/public QA 均为零 page、console、request error；4 套灯光、2×2 lighting/skin ablation、solo light、功率归一、7 个皮肤控制、真实 key-depth occlusion、额头阴影平滑 probe、idle playback 与原人物身份检查均通过。

同时，当前 Delivery Receipt 自己保持：

- `visualReviewPending=true`
- `userVisualAccepted=false`
- `productionReady=false`
- `realPhoneTested=false`
- `karmaRendererPort=false`
- `pathTracing=false`

这不是“测试漏报后仍宣称完成”的失败；相反，它是一个正面对照：功能自动化全绿时，收据仍正确拒绝越级为影视视觉或用户验收。

## 2. 外部方法 / 证据

N128 已用 NASA / NIST 将 verification 与 stakeholder/intended-use validation 分层；N133 已用 Playwright 官方 visual snapshot 方法确认视觉回归结论需要明确 reference，而不是从“截图存在、可解码或参数会改变像素”推导。

- NASA Systems Engineering Handbook：https://science.nasa.gov/wp-content/uploads/2023/04/nasa_systems_engineering_handbook_0.pdf
- NIST validation：https://csrc.nist.gov/glossary/term/validation
- Playwright visual comparisons：https://playwright.dev/docs/test-snapshots

本轮没有发现新的全局制度方法，判定 `NO_NOVELTY_AT_OS_LEVEL`；新增的是 ET20 exact-subject 的验证结果。

## 3. 与 KAOPU 当前制度比较

R2、N128/N133 和 `VISUAL-GOLDEN-UPDATE-SEPARATION-001` 已要求：

1. 功能/运行验证与视觉验证分离；
2. visual golden 有不可变身份、环境、metric、threshold、mask/style 与 diff；
3. Producer 不能自己批准当前 candidate 的 golden；
4. manual visual acceptance 与 USER-ACCEPTED 独立。

ET20 当前收据遵守了这一分层。因此不改全局 OS，不新增重复 case，只更新既有 Visual Golden 回归证据。

## 4. 可反驳假设

如果 fixed-public browser functional pass 与视觉/产品验收保持分层，那么 ET20 可以同时满足：

- 运行、交互、参数像素响应与证据完整性 PASS；
- 缺少授权 baseline / comparator / independent verifier 时保持 `HOLD_NO_APPROVED_VISUAL_BASELINE`；
- 用户未接受时保持 `USER-ACCEPTED=false`。

一个在同一 build `1cd8904342118639c1dd5cd83322109880bbb7f8` 上绑定授权 baseline、固定取景、比较环境、metric/threshold/diff、独立 Verifier 和用户接受的合法回执，可以反驳当前 HOLD。

## 5. 最小历史回放

12/12 一致：

1. source browser gate PASS；
2. immutable fixed-public gate PASS；
3. 证据包 digest 已绑定；
4. source/public 零 page/console/request error；
5. 四套灯光与 luma/clipping 约束有区分；
6. 2×2 lighting/skin ablation 有区分；
7. 七个皮肤控制改变真实 GPU 输出；
8. 阴影平滑 probe：1,845 samples，range=1；
9. inherited idle playback 推进；
10. 原人物身份未替换；
11. 390×844 仅为 viewport，不是实体设备；
12. `visualReviewPending=true`、`userVisualAccepted=false`、`productionReady=false` 未被全绿运行覆盖。

## 6. 局部可执行对象

沿用 `VISUAL-GOLDEN-UPDATE-SEPARATION-001`，Human 下一次 Delivery Receipt 若要把“影视皮肤”提升为视觉合格，必须在同一 exact build 上记录：

- authorized `baselineId` / `baselineImageDigest`
- `currentImageDigest`
- 固定相机、灯光、曝光、色调映射、viewport 与浏览器环境
- forehead / cheeks / nose / eye corners / lip corners 的 reason-bearing crops
- banding、specular clipping、pore scale、albedo change 的 comparator
- metric、threshold、mask/style、actual diff
- independent `verifierIdentity` 与 decision
- manual visual acceptance
- user acceptance

Producer 不得自批 baseline 或最终视觉结论。自动门全绿仍只写 scoped functional pass。

## 7. 适用边界

仅适用于 Human PR #225 / ET20-CINE-R01。本轮不否定已有灯光、皮肤参数、阴影修正、原人物、idle、固定公网或 artifact 证据；不声称未直接完成的截图视觉评审已经失败，也不把 viewport 当实体设备。

不修改生产 Mother 分支，不实现资产，不降低任何门槛。

## 8. 是否采用

`UPDATE_EXISTING_REGRESSION_CASE_NO_NEW_CASE`

- POSTED=true — PR #225 comment 6109647755
- ACKNOWLEDGED=false
- IMPLEMENTED=true（功能门与收据状态分层已经实现）
- GATE-RUN=true（N139 12/12）
- ADOPTED=false
- USER-ACCEPTED=false

路由回执：https://github.com/haihao0307/guilin-dem-pipeline/pull/225#issuecomment-6109647755

## 9. 指标

- 首次候选功能门通过率：true（最终 exact run）
- 首次候选视觉通过率：unknown
- 用户纠错次数：0（ET20 暂无新用户反馈）
- 同类错误复发率：unknown
- rejected lineage 继承次数：0
- stale delivery 次数：0
- 每个 accepted delta 的内部迭代数：unknown（尚无视觉/user accepted delta）
- 用户指令到合法视觉 candidate 时间：unknown
