# KAOPU Mother 每日协调会｜Car R127 独立复核不可移植门禁

- 日期：2026-11-09（北京时间）
- 实际会议：2026-11-09 02:30—02:43 +0800
- 会议边界：只处理一个跨模块问题；未修改 Car、任何生产 Mother 分支、main、托管、排程或学习飞轮
- 强制协议：R2 `LOCK → EXECUTE → VERIFY → PROMOTE`

## 本轮唯一问题

Car 私有恢复链 R127 的 source-profile 候选已经有完整包校验和独立复核记录，但这些记录能否在脱离原共享工作区的新环境中重新执行？

## 会前读取与权威状态

- 协调仓库 `main@6a003f0fafb9ae27d71e95963728461288c14edb`
- 根 `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 Production OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- Reference Replication Gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- Freshness Gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 最新为 N254 provider ambient-authority bypass audition；只有 CPU teacher audition，没有 Car Mother 的 `ACKNOWLEDGED / ADOPTED`
- #63 最新仍为 N49 Coast 公网运行失败记录；没有本问题的新 Mother 回执
- 新候选包：`CAR_RECOVERY_R127_SOURCE_PROFILES_PRIVATE_DELTA.zip`
  - archive SHA-256 `59c6dd88d0e57b2cd03a3314c93257e58cb6446ecb5c669a50deb7bee51af585`
  - 状态 `RECOVERY-R127 / FROZEN_SOURCE_PROFILES_WITH_LEGACY_ASSOCIATIONS_GPU_DISABLED`
  - 基于 R126；没有发布、GPU、浏览器或生产替换

## R2 九项核对

1. **唯一 taskId / targetObject / targetDefect**  
   包内没有 R2 Task Anchor，`taskId=UNKNOWN`。本轮只锁定 R127 source-profile 独立复核；缺陷是复核脚本依赖原主机绝对路径，无法从交付包在新环境直接重跑。

2. **accepted baseline / baseSha**  
   没有 Delivery Receipt 声明 accepted baseline，故 `accepted baseline=UNKNOWN`。恢复说明固定官方 R108 commit `525b6889d703c4eeae6a2dde2836153ba02871b0` 并要求 R120—R126 链；这是恢复前提，不等于用户接受基线。

3. **用户最后约束**  
   复刻默认 `REPLICATION_LOCKED`、`CREATIVE_AUTHORIZATION=false`；测试与压缩包存在不等于通过；validation-only 必须有 dispatch 后新 run 并绑定准确对象；跨 Mother 知识只有接收端真实回执和本地验证后才算采用。

4. **referenceSet 与 UNKNOWN**  
   referenceSet 是包内受限 source triangles、R126 predecessor manifest、R127 package manifest 与静态/运行时审计。真实零件身份、物理制造语义、f32、GPU、ray query、全局 overlap、视觉外观、性能均为 `UNKNOWN`。

5. **forbidden routes**  
   不得把四个 C26/C27 精确重建 profile 与既有 LOFT aliases 009/010/020/021 双计数或同时激活；不得启用 R120 failed query 或 R127 WGSL probe；不得把 CPU/source/static 结果冒充 GPU、浏览器、视觉或生产替换；不得把历史共享目录 PASS 冒充新环境复跑。

6. **fresh head delta**  
   R127 相对 R126 声明 4,213 个文件字节不变、8 个 runtime 文件新增；2 个新 source constructions、4 个 precision reconstructions、20 个 source components、116 charts；`activeReplacementEnabled=false`、`newActiveGeometryIDs=0`。本轮验证绑定上述 archive SHA，未产生生产 source diff。

7. **applicable regression cases**  
   复发模式与候选 `RUN-SUCCESS-NOT-RERUN-REPRODUCIBILITY-001` 相同：历史成功不能证明新环境可重跑。该 case 当前只写 Fish browser rerun、`global=false`，所以本轮只记录跨 Mother recurrence 并提出受限扩展，不宣称它已全局适用，也不建立近义新 case。

8. **machine / reference / browser gates**
   - Contract：缺 Task Anchor、Delivery Receipt、accepted baseline，未通过。
   - Freshness：R127 archive 身份已绑定；根 `SHA256SUMS` 全量校验通过。
   - Machine：dispatch 后在 Node `v24.22.1` 执行。根 manifest 通过；`verify-seal.mjs` 因读取 `/workspace/shared/car-r127-independent-review/SHA256SUMS.json` 得到 `ENOENT`，exit 1；`run-all.sh` 因同一绝对目录不存在，exit 1。
   - Reference Fidelity：source association 与 alias 禁止关系有包内证据；独立复核的新环境执行闭环未通过。
   - Browser / GPU：未运行；桌面与 390×844 证据不适用本轮 validation-only，但任何后续视觉晋级仍必须补齐。

9. **状态**  
   `HOLD_GATE_FAIL / UNKNOWN_RERUN_REPRODUCIBILITY_TOOLCHAIN_UNSEALED / BLOCKED_VALID`。  
   不标 `REJECTED_CREATIVE_SUBSTITUTE`；不标 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`；R127 仍是冻结的私有 source 候选，不能晋级 `CANDIDATE_READY` 或 `ACCEPTED_BASELINE`。

## 明确决定 / 有限方法

保留 R127 包及其历史审计，不回退 source 工作；停止把当前 `evidence/independent-review` 当作可移植复核。

Car packaging owner 只补一个闭包层：

1. 把输入改为 package-relative content-addressed manifest，或提供显式 `mountMap`；运行器不得内置 `/workspace/shared`。
2. 把 Naga、Node 与其他 verifier 依赖写入版本/哈希清单；不能随包分发的受限 source 只记录 digest 和调用方提供的位置。
3. 历史 evidence 与本轮 rerun receipt 分开；新 receipt 必须绑定 R127 archive、R126 predecessor、runner、依赖和完整退出码。
4. 保持全部 geometry/profile 激活开关关闭；本任务只修复验证可重放性，不修改函数、对象、外观或生产入口。

## 最小验证

在一个空临时目录中，只放声明的 R120—R127 恢复链和明确列出的 verifier 依赖，执行 package-relative `verify-seal` 与 `run-all`：

- 不出现主机绝对路径；
- 正向运行全部通过并生成新 receipt；
- 删除 R126 predecessor、篡改一个 source triangle、替换一个 Naga binary 三个负控分别 fail-closed；
- receipt 记录 archive SHA、subject/result manifest、Node/Naga 版本、依赖 inventory、时间和退出码。

通过后只能把 rerun closure 升为 `GATE-RUN PASS`；仍不能据此声称 GPU、浏览器、视觉或用户验收通过。

## 责任端、未完成边界与下一学习题

- 责任端：Car / Motor Mother 的 recovery packaging owner；独立 verifier 负责在新目录复跑，Producer 无自我批准权。
- 未完成边界：Task Anchor、Delivery Receipt、accepted baseline、package-relative runner、依赖闭包、f32、ray/global overlap、GPU、浏览器、2K、桌面/390×844、固定公网入口、用户验收均未完成。
- 学习飞轮下一题：怎样用 content-addressed mount map 表达“受限源文件由调用方提供、验证器仍可独立复跑”，同时避免绝对路径、环境 ambient authority 和受限资产再分发。

## 生命周期账

- `POSTED=true`（本协调纪要与 #91 记录）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true`（R127 私有 source-profile delta）；`portable rerun IMPLEMENTED=false`
- `GATE-RUN=true`（本轮 root manifest PASS；两个 package-supplied independent-review entrypoints FAIL）
- `ADOPTED=false`
- `USER-ACCEPTED=false`

没有真实 Mother 回执，不声称 Car、Motor 或其他 Mother 已学会、采用或完成。