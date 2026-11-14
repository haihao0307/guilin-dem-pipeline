# KAOPU Learning Flywheel N288 — Train 拓扑门禁作用域与源拓扑邻接数反例

- 时间：2026-11-14 15:37 +08:00
- 类型：制度问题（由真实 Train 拓扑反例触发）
- bounded question：v39 是否证明 N287 把共享边邻接面数写死为 2 过度泛化，同时证明一个接口族的通过不得转移到另一个接口族？
- 决策：`PROBATION_SCOPED_TOPOLOGY_PASS_HOLD_ORIGINAL_N287_SCOPE_AND_SOURCE_REPLAY`
- 状态：POSTED / GATE-RUN；ACKNOWLEDGED、IMPLEMENTED、ADOPTED、USER-ACCEPTED 均为 false。

## Fresh read

当前 main 仍为 `8aec1b1dca9619c0b59fc8fa480f65f226be7145`；根 AGENTS、R2 OS、reference replication gate、freshness gate 的 blob 分别仍为：

- `251b664646a489e9292748f1d41998ee62a338f5`
- `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- `8c0a49c71865ef76cbc614f8188239bc808a8278`
- `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 最新有效生产反馈仍为 N287；#63 无更新的适用反馈。未发现 Mother ACK。

## Exact subject

- 文件：`train-recovery-notes-r318-20261113.zip`
- Library ID：`libfile_ef5d5fb7f88c81919bcf6359f7acc96a`
- version：39
- modified：2026-11-14 15:36:22 +08:00
- size：16,543,226 bytes
- SHA-256：`9726761aa0c40e0087d5c08f4e8b5883dae83761714f2ff56db1a56be0aee97e`
- extracted files：643

## Replay evidence

### 1. lower-lip middle-event 接口集：局部通过

`check-union-common-functions.mjs`：

- 23,814 derivative checks
- 7,938 samples
- max relative derivative error `1.6238359312817367e-7`
- PASS

`check-union-common-topology.mjs`：

- interfaceSetId：`lip-middle-union-common`
- 18 interfaces / 19 component ports
- 5,038 shared-curve samples
- max gap `1.776573666601473e-15`
- expected shared edges 458 / observed 458
- each observed shared edge has 2 incident faces
- remaining unresolved 0
- `completeAssembly=false`

这是一个真实、可执行的局部拓扑通过，但只覆盖该命名接口集。

### 2. 源参考存在合法三面分支：N287 的硬编码规则被反例推翻

`check-center-component.mjs`：

- 3 parts / 42 triangles
- source junction incident faces = 3
- `manifold=false`
- PASS：源参考本身在该分支处就是三面邻接，不是应被修成两面的错误。

`check-center-parent-component.mjs`：

- 7 parts / 163 triangles
- 30 core-rail shared edges
- source branch incident faces = 3
- shared residual `8.899114524108741e-16`
- `manifold=false`
- PASS

因此，`WELDED_SHARED_EDGE => incidence == 2` 只能适用于简单双面片缝；门禁必须要求“源证据期望邻接数 == 实测邻接数”。否则会把忠实复刻错误地改造成创作替代。

### 3. N287 原接口集仍失败，局部通过不可外推

重新对当前 v39 的 `front + central step + apron` 精确网格执行 N287 probe：

- combined vertices：3,078
- cross-part duplicate vertex coordinates：228
  - front↔step：114
  - step↔apron：114
- topological boundary edges：1,428
- geometrically coincident but index-unwelded edges：616
- 结果：`FAIL_UNCHANGED_FROM_N287`

所以 lower-lip 的 18 接口通过，不能被用来宣称 front-step-apron 或整车拓扑通过。

### 4. Source-fidelity replay 仍不可移植

下列四个源对照入口均以 exit 1 失败：

- `check-union-common-source-3d.py`
- `check-union-common-reverse-3d.py`
- `check-center-component-source.py`
- `check-center-parent-source.py`

共同失败为 `FileNotFoundError`，依赖旧工作区绝对路径：

`/workspace/scratch/2f609cc83d31/train-reference-recovery-2240/A4-original-reference-recovered-20261020.zip`

因此本包可复跑 source-free topology tests，但不能独立复跑 exact source-fidelity checks。

## Candidate refinement

同一去重后的 regression candidate 升为 v1.5，不新建重复 case：

1. 每个拓扑回执必须绑定 `interfaceSetId`。
2. 记录 `sourceExpectedIncidentFaces` 与 `observedIncidentFaces`。
3. 简单双面片缝通常期望 2；源证据确认的分支可以合法期望 3 或更多。
4. 一个接口集的 PASS 不得转移到另一接口集。
5. source-free topology pass 与 source-fidelity replay 继续分层。

## Boundary / routing

- 只路由 Train Mother #91。
- 不修改生产 Mother 分支，不替代资产实现，不修改 R2 OS 或全局门禁。
- 保留回滚：移除 N288 Candidate refinement 即可。
- 未收到 Mother 回执前，状态只能是 POSTED / GATE-RUN。
