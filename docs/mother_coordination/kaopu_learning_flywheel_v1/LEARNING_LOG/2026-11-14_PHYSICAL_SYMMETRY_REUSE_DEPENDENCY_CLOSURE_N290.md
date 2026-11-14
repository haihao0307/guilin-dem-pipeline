# KAOPU Learning Flywheel N290 — 物理镜像复用的依赖闭包门禁

- 时间：2026-11-14 23:38 +08:00
- 选择：制度问题
- bounded question：ZX85 v81 是否把用户“左右可复用件只做一侧、另一侧用受控镜像/参数生成”的纠正变成可独立重放的门禁，同时避免错误镜像真实非对称驾驶室部件？
- 决策：`HOLD_MIRROR_GATE_DEPENDENCY_CLOSURE_MISSING`

## Fresh read

当前 main 的根 AGENTS、R2 OS、reference replication gate、freshness gate blob 分别仍为：

- `251b664646a489e9292748f1d41998ee62a338f5`
- `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- `8c0a49c71865ef76cbc614f8188239bc808a8278`
- `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 最新真实回执仍是 N289 的 Learning Flywheel POSTED/GATE-RUN，没有 ZX85 Mother ACK。#63 没有新的适用反馈。main 及既有 regression 搜索没有独立的 physical-symmetry replay case，因此本轮以既有 `MOTHER-NO-METHOD-INVENTION-001` 和 freshness/reference gates 的去重 refinement 保存。

## Exact subject

- `zx85usb-5a-functional-whole-checkpoint-20261113-r01.zip`
- Library ID：`libfile_841f9900a5ec81918f2df377bf8e292f`
- version：81
- modified：2026-11-14 23:26:08 +08:00
- size：29,506,056 bytes
- SHA-256：`333dcefaf54cf4e9c7ea2ed0b6c2a77d4af398674c31f2011d11918d544c025e`
- archive files：2,456

## 已有真实增量

包内已经将用户纠正转成一个有边界的方法，而不是“看起来对称就镜像”：

- `parameter-mirror.mjs` 强制 `eligible=true`，否则拒绝；
- 几何反射后反转三角 winding；
- 旋转关节按 axial-vector `det(R)*R` 变换；
- 明确声明几何镜像不能推断物理所有权；
- 左门与右侧固定窗是真实不同装配，禁止整侧镜像；
- 左右操纵件只复用共同母形，保留差异。

源数据对照：

- 左右上部操纵件各 5,001 个顶点；
- 镜像后 4,982 个在 0.001 source unit 内匹配；
- 19 个差异点保留为 unresolved；
- 最大最近点残差 `0.976547`；
- 左右完整 housing 后伸差为 117 source units（`221.483847 - 104.483834`），因此 `wholeHousingMirrorAllowed=false`。

`console-joystick-check.mjs` 在本轮 clean extraction 中通过：97 个 section、4 个共享 mode、1,647 个 native values 替代 13,968 个逐点量值；但 `completeConsole=false`、`accepted=false`，最大顶点误差仍为 `1.9630933050917325`，未做 source-surface coverage。

## 新反证：核心 stored PASS 无法从当前包重放

包内保存的 `PARAMETER_MIRROR_CHECK.json` 声称：

- 3 个反射轴已测；
- roundtrip exact；
- oriented volume preserved；
- max kinematic error `1.7763568394002505e-15`；
- evidence required。

但本轮从 exact v81 clean extraction 运行：

`node zx5a-cab-source-r25/cabin-complete/parameter-mirror-check.mjs`

结果为 exit 1 / `ERR_MODULE_NOT_FOUND`。缺失依赖：

`front-r04-release/.sites-checkout/dist/boom-functional-r05/vendor/three.module.js`

整个 ZIP 中不存在任何 `three.module.js` 或 `.sites-checkout`。因此 stored JSON 只能是历史 Observation，不能当作当前交付 subject 的 fresh `GATE-RUN PASS`。

同时，对 cabin-complete 的代码/JSON/文档精确扫描没有 rearview/side-mirror hardware；用户点名的倒后镜对仍是 `UNIMPLEMENTED`。generic helper 不能冒充具体硬件已完成。

## Candidate refinement

`PHYSICAL-SYMMETRY-REUSE-001-N290-DEPENDENCY-CLOSURE`

要求 Task Anchor / Delivery Receipt 至少携带：

- `symmetryPairId`
- `sourceObjectId / targetObjectId`
- `eligibilityEvidence`
- `mirrorAxis / mirrorPlane / parityRule`
- `sharedParameterSet / explicitDeviationSet`
- `packageDependencyClosure`
- `freshReplayCommand / freshReplayExitCode`
- `parentIntegrationBinding`
- `acceptanceState / verifier`

最小试验：让 exact checkpoint 在 clean extraction 中零外部依赖运行 geometry + joint parity test；同时保留 19 个已知差异、不镜像 housing/门窗，并把任何真实镜像子件通过声明的父系统绑定进 current whole。

## Lifecycle / routing

- Candidate：IMPLEMENTED
- N290 audit：GATE-RUN（结果 HOLD）
- #91 routing：POSTED（comment 6879994793）
- Mother ACKNOWLEDGED：false
- production IMPLEMENTED：false
- ADOPTED：false
- USER-ACCEPTED：false

未修改生产 Mother、main、R2 OS、Site 或整机资产。
