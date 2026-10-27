# N202 — A4 R32 invalid 状态打包与可见帧阶段门禁

- 日期：2026-10-28
- 类型：技术问题 / 真实生产源码契约回放
- bounded question：N200/N201 要求的 invalid 状态，能否在 A4 R32 当前 2-bit 状态与两阶段渲染契约中被真实保存、汇总，并在可见帧提交前阻断？
- subject：`trial/a4-r32-normal-chrome-20261027@580acd1c8b851d0c843826e2b49c7079411473bd`
- runtime blob：`9a3e04b76f2e6281d1feb8cb6b4f2bb9160cc101`
- 结论：`SPARE_BITS_EXIST_BUT_PHASE_AND_DECODE_CHANGES_REQUIRED`
- 决策：`HOLD_STATUS_CAPACITY_AND_PREVISIBLE_GATE_MISSING`
- 适用 regression：沿用 `FUNCTION-SURFACE-INVALID-SAMPLE-FLICKER-001`；不重复建 case
- 生产状态：学习分支；未修改 main、A4 生产分支、R2 OS、公网页或全局门禁

## 1. Canonical Truth 与新鲜度

本轮复读 main `3ccae4bde0c91973adbb81f99ec4d54bc9357ce0` 的根 AGENTS、R2 OS、reference-replication gate、freshness gate，并核对 #91/#63 最新反馈。

- #91 最新 Mother 协调记录处理的是 Motor R02；N201 没有 Mother ACK。
- A4 R32 branch head 仍是 `580acd1c...`，N201 后没有新提交。
- 因此本轮不重复判断黑点根因，也不声称已修复；只验证 N200/N201 建议在现有 runtime 数据布局中是否可实施。

## 2. 真实源码契约

`gpu-interval-runtime.js` 明示：

`B: depth6/status2/visited13`

实际布局：

- depth：bits 0..5；
- status：bits 6..7；
- visited：从 bit 8 开始，声明为 13 bits；
- JS 汇总：`n = meta >>> 8`，没有 13-bit mask；
- status 四值：`active / hit / miss / exhausted`，2 bits 已全部占满；
- frozen node budget：4096；
- 当前写路径不会写 bits 21..31。

因此：

1. 不能直接增加第五个 terminal status；
2. 32-bit word 确有 11 个当前未写高位；
3. 若直接把 invalid reason 放入高位，现有 `meta >>> 8` 会把 reason 混入 visited，导致节点计数、budget invariant 和 receipt 污染；
4. 必须先把 visited 解码改为 `(meta >>> 8) & 0x1fff`，才能安全使用高位。

## 3. 更关键的阶段缺口

当前流程先完成 interval search，把 `searchComplete=true`，再执行 tail：

1. step pass 写 `hitStateA/hitStateB`；
2. JS readPixels 汇总 active/hit/miss/exhausted；
3. search complete；
4. tail 把 hitState 作为只读 texture，计算有限差分 normal，直接写默认可见 framebuffer；
5. tail 后没有 invalid state attachment、readback 或 pre-visible commit gate。

所以即使高位能够编码 invalid reason，`INVALID_GRADIENT` 仍在错误阶段才被发现：tail 无法回写 state，且可见颜色已经提交。仅“增加一个枚举值”不会满足 N200 gate。

## 4. 最小兼容性回放

探针：`PROBES/a4_invalid_state_packing_probe_n202.js`  
结果：`PROBES/a4_invalid_state_packing_result_n202.json`

9/9 PASS：

1. 2-bit status 已被四个 operational states 占满；
2. 4096 budget 下旧格式保持 bits 21..31 为 0；
3. 直接写高位 reason 会污染当前 visited 解码；
4. 13-bit mask 恢复准确 visited；
5. invalidReason 0..5 可在原 32-bit word 中往返；
6. legacy word 在新 decoder 中保持兼容；
7. invalid gradient 可在写 HIT 前拒绝；
8. 合法样本仍可进入 HIT；
9. exhaustion 与 invalid reason 保持正交。

## 5. Candidate（仅 A4 单 Mother，未实施）

最小表示候选：

- bits 6..7 保留 operational status：active/hit/miss/exhausted；
- bits 21..23 新增正交 `invalidReason`：
  - 0 NONE
  - 1 NONFINITE_INTERVAL
  - 2 NONFINITE_FIELD
  - 3 UNCONVERGED_RESIDUAL
  - 4 INVALID_GRADIENT
  - 5 DOMAIN_MAYBE_NAN
- visited 必须显式 mask 为 13 bits；
- bits 24..31 保留，不在本 Candidate 使用。

阶段候选二选一，需 Mother 用真实 GPU benchmark 决策：

A. 在 step 写 HIT 之前执行 residual/finite/gradient validation，invalid 时只写 reason，不写 HIT；优点是不增加第三 pass，代价是 step 与 tail 可能重复求梯度。  
B. 增加 validity pass/attachment + readback，只有 invalidCount=0 才提交 visible tail；优点是阶段清晰，代价是额外 draw/readback。

不得采用“tail 发现后仍画黑色/透明色”作为 gate；那只是换一种 silent fallback。

## 6. 可反驳试验与 Receipt

同一精确 subject 做 A/B：

- 冻结相机、时间、噪波与 120 帧；
- 注入四类 invalid fault；
- 每类必须得到独立 reason，且 `hit=0`、visible tail 未提交；
- 正常样本与 exhaustion 正控保持原行为；
- legacy meta fixture 必须逐值兼容；
- 分别测 A/B 的 GPU time、readback stall、物理设备与软件 renderer，不用一方替代另一方。

Task Anchor / Delivery Receipt 建议增加：

`metaLayoutVersion, statusBits, invalidReasonBits, visitedMask, validityPhase, invalidCountsByReason, visibleTailSubmitted, subjectCommit, runtimeBlob`

这只是 Candidate；未运行真实浏览器/GPU 前不得 ADOPT。

## 7. 外部证据与 Teacher 状态

Khronos OpenGL ES / GLSL ES 只确认 fragment shader 输出更新当前 framebuffer/texture，WebGL 对读写同一纹理的 feedback loop 会拒绝或产生未定义行为；因此不能让当前 tail 一边采样 hitState、一边原地回写同一附件。该规范没有比 KAOPU Current Best View 多提供新的失效状态设计，状态为 `NO_NOVELTY`。

- https://registry.khronos.org/OpenGL/specs/es/3.0/es_spec_3.0.withchanges.pdf
- https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf
- https://registry.khronos.org/webgl/specs/latest/1.0/#6.24

libfive 继续保持 `TEACHER_CANDIDATE`，未获 Mother ACK，不进入 AUDITION/Registry。

## 8. 状态语义

- SOURCE-INSPECTED：是
- synthetic GATE-RUN：是，9/9 PASS
- POSTED：是，#91 comment `6451985431`
- ACKNOWLEDGED：否
- IMPLEMENTED：否
- browser/device GATE-RUN：否
- ADOPTED：否
- USER-ACCEPTED：否
- KPI：UNKNOWN
