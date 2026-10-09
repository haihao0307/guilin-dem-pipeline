# N127 — Tailor R04 原源谱系 fail-closed 回放

## Bounded question

用户明确否定 R03 的人物与服装来源后，R04 是否真正回到原共同人物、原 60 份纸样和原生材料/求解链，并在缺失或失败时 fail closed；还是仍以 R03 展示壳、合成补件或部分成功冒充完整交付？

## 现有真实失败

- PR #181 的 R03 使用独立 Anny 展示体（13,718 顶点）而不是原共同人物（25,417 顶点）。
- R03 服装是另行生成的展示壳，没有走原 paper → native material → solver 链。
- 先前自动门把“WebGL 真、哈希不同、公开页面可读”误当完成条件，用户成为第一层发现源替换的人。
- PR 标题与分支仍写 R03.4；其 Git base 仍包含被拒绝的 R02/R03 历史，因此谱系与运行时依赖必须分别核验。

## 新证据

- PR #181 comment `6079493932` 明确承认 R03 source substitution，并把 R03 标为不再合格。
- R04 source correction commit `4f9849bc0776ce34d41ecc9c2c63038a77e08955`；当前 retained-evidence head `d31f06cfa51d3af4c6f93e37451d901326ef09db`。
- `SOURCE_AUDIT.json` 把 R03 定性为 `R03_ROUTE_REJECTED_BY_USER`，并列出 `PERSON_SUBSTITUTED`、`GARMENT_PIPELINE_BYPASSED`、`QA_WRONG_SUCCESS_CRITERION`、`TAILOR_BODY_WAS_NEVER_FULL_COMMON`。
- `NATIVE_PERSON_PROOF.json` 固定原共同人物 25,417 顶点、50,624 三角形及 geometry/topology/state/adapter 指纹；没有 display mask/rescale，并重建真实 body field。
- `NATIVE_PARITY.json` 在同一浏览器逐一比较 60 份原 source module 与 adapter：49 个 native material ready，11 个原生拒绝按相同错误保留，没有修补为成功。
- `assets/results/index.json` 只有两个 actual solver records：T01 通过静态门、P01 未通过；J06 为 `NO_FINISHED_RESULT_NOT_REPLACED`。
- `SOURCE_BROWSER_REPORT.json` 16/16 source-scope checks 通过；`CONTRACT_TESTS.json` 12/12 identity mutation checks 通过；换人会清空衣服，拒绝旧绑定；没有请求被拒绝的 R03 runtime dependency。
- run `37920449469` 的原生链失败被保留，artifact `11612331365`，digest `sha256:dac7f213b8058f405bda49179e920a95bd8e6b4e37c20dd1b50ec7f474457b5f`；没有把失败改写成完成。
- 当前仍 `fullClothingCatalogueDelivered=false`、`physicalFitAccepted=false`、`dynamicWearCertified=false`，也没有公开交付。

## 与现行制度比较

这是现有 R2 OS、Canonical Truth、no-creative-substitute、freshness/source identity 和 fail-closed 规则的具体执行，不需要新增全局制度。N126 的“逐成员展示壳回执”问题被更强的用户纠正覆盖：R03 展示壳本身是错源，不能再补回执后复活。

结论：`no-novelty`（制度层）；`new-evidence`（Tailor 局部回归层）。更新既有 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`，不新建同类 case。

## 可反驳假设

若 R04 真正 fail closed，则：

1. 原共同人物、60 份原纸样和原 CommonViewer 均有精确身份；
2. 原生可生成与原生拒绝的 60 项结果逐项一致；
3. 任何人物、纸样、材料、顶点/三角顺序或 rest-UV 身份变化都会使绑定失败；
4. 失败/缺失 solver 输出保持失败/缺失，不生成展示替代物；
5. 部分成功不能产生“60/60 完成”、physical fit、dynamic wear 或 public/user acceptance。

任一条件为假即反驳。

## 最小历史回放

`tailor_r04_source_lineage_fail_closed_gate_n127.mjs` 对提交内的不可变报告做 12 项回放：共同人物与 60 纸样身份、60 项 native parity、49/11 分布、2 个真实 solver record、T01/P01/J06 三种结果、12 个 mutation 拒绝、换人失效、零 R03 runtime dependency、不得全量提升、不得扩大物理/公开/用户接受层级。

回放结果：12/12 通过，判定 `SOURCE_LINEAGE_CORRECTION_VERIFIED_SCOPED__HOLD_FULL_CATALOGUE_INCOMPLETE`。

## 适用边界

- 只验证 R04 的 source lineage 修正与 fail-closed 语义。
- 不证明 60 套成衣已生成；当前只有 49 个 native material ready、11 个原生拒绝、2 个实际 solver record。
- 不证明 P01 合格；P01 当前静态门失败。
- 不证明 J06 有成品；它明确没有 finished result。
- 不证明真机、public delivery、physical fit、self-collision、dynamic wear 或用户接受。
- PR #181 的标题仍描述已被用户拒绝的 R03.4，存在 stale-metadata 风险；本轮不改生产 PR 元数据，只记录并路由。

## 是否采用与路由

- 采用范围：Tailor 单 Mother 候选的 source-lineage/fail-closed gate；不升级为全局强制。
- R03 状态：`REJECTED_WRONG_SOURCE_LINEAGE`，不可通过补旧展示壳回执复活。
- R04 状态：`SOURCE_LINEAGE_CORRECTION_VERIFIED_SCOPED__HOLD_FULL_CATALOGUE_INCOMPLETE`。
- PR #181 已出现真实 Mother 回执并实现/运行门，因此：`ACKNOWLEDGED=true`、`IMPLEMENTED=true`、`GATE-RUN=true`；未采用为 Current Best、未公开、未获用户接受，所以 `ADOPTED=false`、`USER-ACCEPTED=false`。
- 本轮路由：PR #181 comment 待提交后补入；不会声称“各 Mother 已学会”。

## 指标

- 新增用户纠错次数：1（R03 人物/服装源谱系错误）。
- 用户成为第一层 QA：1 次已证实（R03 自动门未拦截错源）。
- branch-level rejected lineage inheritance：1；R04 runtime 对被拒绝 R03 展示依赖请求：0。
- stale delivery：没有公开交付，故本轮公开 stale delivery 为 0；PR 标题 stale 风险单列，不等同于已交付。
- 首次候选通过率、同类错误复发率、每个 accepted delta 的内部迭代数、从指令到合法 candidate 的时间：`unknown`。
- 第一梯队外部 AI：未调用。
