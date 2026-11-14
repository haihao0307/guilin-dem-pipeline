# KAOPU Learning Flywheel N289 — ZX85 驾驶室父系统所有权门禁

- 时间：2026-11-14 19:39 +08:00
- 选择：制度问题
- bounded question：v68 是否已经把用户“驾驶室是父系统”的纠正转成可执行所有权合同，而不是又一份说明或扁平零件清单？
- 决策：`PROBATION_TREE_CONTRACT_PASS_HOLD_WHOLE_INTEGRATION`

## Fresh read

当前 main 仍为 `8aec1b1dca9619c0b59fc8fa480f65f226be7145`。根 AGENTS、R2 OS、reference replication gate、freshness gate 的 blob 仍分别为：

- `251b664646a489e9292748f1d41998ee62a338f5`
- `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- `8c0a49c71865ef76cbc614f8188239bc808a8278`
- `4754a90a94e4a9e7806357b6eb292e5c713e9021`

#91 最新回执仍为 Learning Flywheel 自己的 N288 POSTED/GATE-RUN，未出现 Mother ACK。#63 无新的适用反馈。

## 真实纠正

用户明确规定：

- 驾驶室是父物理系统；
- 顶、侧面、门、底板、操控台、座椅属于驾驶室；
- 操纵杆、脚踏板、仪表、油门、液压锁属于操控台；
- 发动机和液压系统属于整机的独立系统；
- 控制件可通过有类型的功能关系连接发动机、液压和行走，但不能把占位关系冒充已实现模拟。

这不是“多做几个零件”，而是生产对象的所有权和验收边界纠正。

## Exact subject

- `zx85usb-5a-functional-whole-checkpoint-20261113-r01.zip`
- Library ID：`libfile_841f9900a5ec81918f2df377bf8e292f`
- version：68
- modified：2026-11-14 19:28:44 +08:00
- size：22,864,455 bytes
- SHA-256：`8dedbab710a96c0cbabd53037e39589361b2e6c829fbae2602ac45e69849b6dd`
- extracted files：2,139

## Gate replay

包内 `zx5a-cab-source-r25/cabin-complete/CABIN_OBJECT_TREE.json`：

- schema：`kaopu-physical-object-tree-v1`
- package-original SHA-256：`0d53206cfeabddabccea0bb47f0769b0d15b6c201e703acaa9ab8dd76238a19a`
- 26 physical objects
- 4 typed control relations
- 15 required parent bindings checked
- 0 ownership cycles
- `completeCabin=false`
- `productionReplacementAllowed=false`

父子关系符合本轮用户纠正：

- `ZX85-CAB -> ZX85`
- `ROOF / SIDES / FLOOR / DOOR / WINDOWS / CONSOLE / SEAT -> ZX85-CAB`
- `JOYSTICKS / PEDALS / INSTRUMENTS / THROTTLE / HYDRAULIC-LOCK -> ZX85-CAB-CONSOLE`
- `ENGINE / HYDRAULICS -> ZX85`，不是驾驶室子件。

包内 builder 复跑通过：`validated 26 physical object entries 4 typed control relationships; no completion implied`。

## 关键边界

精确扫描当前整机集成入口：

- `zx5a-whole-integration-r54`
- `zx5a-whole-viewer-r06`
- `zx5a-machine-object-r24`
- `zx5a-whole-reference-r16`
- `zx5a-upper-seat261-snapshot`

对 `CABIN_OBJECT_TREE`、`ZX85-CAB-CONSOLE`、`ZX85-CAB-SEAT` 的绑定命中为 0。

因此：

- 对象树合同：PASS；
- 当前整机真实消费该合同：HOLD；
- 驾驶室完成：false；
- 生产替换许可：false。

当前门/窗/结构虽有真实局部增量，但门仍缺金属框、铰链叶片与销、门锁及整机安装；操控台和座椅仍是 source-recognized/unbuilt 或 unbuilt/unmapped。不能用局部几何、文件数或对象数把父系统升级为完成。

## Candidate refinement

去重地细化既有 `WHOLE-MACHINE-NOT-PARTIAL-DELIVERY-001` 与 `MOTHER-NO-METHOD-INVENTION-001`，新增本地 Candidate：

`WHOLE-MACHINE-NOT-PARTIAL-DELIVERY-001-N289-ASSEMBLY-OWNERSHIP`

核心字段：

- `objectId`
- `parentObjectId`
- `assemblyRole`
- `coordinateFrame`
- `installationParent`
- `requiredChildren`
- `childStatuses`
- `typedRelations`
- `integrationBinding`
- `parentAcceptanceState`

最小可反驳试验：让当前 whole builder 真实消费同一个树；若子件绕过 `ZX85-CAB` 直接挂到整机、缺失子件被隐藏、或对象计数推动父级接受，则失败。

## Lifecycle / routing

- Candidate：IMPLEMENTED
- historical/package gate：GATE-RUN
- #91 routing：POSTED（comment 6876782616）
- Mother ACKNOWLEDGED：false
- production IMPLEMENTED：false
- ADOPTED：false
- USER-ACCEPTED：false

仅路由 ZX85/Equipment Mother #91；未修改生产 Mother、main、R2 OS、Site 或整机资产。
