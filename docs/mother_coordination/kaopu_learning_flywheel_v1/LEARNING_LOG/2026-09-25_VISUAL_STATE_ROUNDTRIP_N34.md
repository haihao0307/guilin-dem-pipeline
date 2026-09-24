# N34 — 绿色最终状态不能证明可逆视觉控制已恢复原状

- 状态：Candidate partial / Fish R007 真实历史回放通过 / 未实施
- 范围：Fish R007 ghost 显示控制；只研究状态切换后的视觉恢复 oracle
- 不修改：生产 Mother、main R2 OS、Canonical Truth、现有公网发布、用户冻结与会议分工

## 一个 bounded question

当 workflow、最终浏览器、数值与交互检查全部通过时，是否足以证明一个可逆视觉控制在 `on → off` 后恢复了原始材质和实际画面？

## 现有真实失败 / Observation Roots

1. **Observation / R2 基线：**R2 已把 Machine 与 Reference Fidelity 分成独立门禁，并要求用户不做第一层 QA；本轮不推翻这些规则。
2. **Observation / 第一绿色 run：**精确对象 [`2ae157f09512db7505ff64a1f78dfce4a97f039b`](https://github.com/haihao0307/guilin-dem-pipeline/commit/2ae157f09512db7505ff64a1f78dfce4a97f039b) 的 run [`35890512697`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35890512697) 为 success。源码重建、209 时刻数值检查、旧回归、故障恢复、截图、发布、公网字节与最终公网浏览器等步骤全部成功。
3. **Observation / 独立像素检查：**随后实际查看浏览器截图发现：关闭 ghost 后，右侧候选仍保持半透明。该失败不否定第一 run 确实执行并通过的数值/发布证据，但否定“视觉状态已经完整恢复”的更强主张：[Fish R007 回执](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5799348980)。
4. **Observation / 失败机制：**旧显示层把 ghost 参数写入了之后用于恢复的可变默认材质；恢复读取的已经不是最初 baseline，因此 UI boolean 虽回到 off，`opacity / transparent / depthWrite` 没有可靠恢复依据。
5. **Observation / 修正与回归：**提交 [`d1e9b56f6456673d214ed165a8801a0beca0d249`](https://github.com/haihao0307/guilin-dem-pipeline/commit/d1e9b56f6456673d214ed165a8801a0beca0d249) 在变更前保存并冻结原始三字段 tuple，恢复后逐项比较，并再执行一次 ghost on/off 循环。修正 run [`35891489740`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35891489740) 同样完成全部步骤。
6. **Observation / 边界：**R007 的人工审图是内部有限证据；`manualVisualAcceptance=false`、`userDeviceRetested=false`，不能扩大为用户视觉批准或全设备稳定。

这些 Observation Roots 保持分离：workflow success、数值相等、UI 状态、渲染 tuple、像素画面和用户验收不是同一证据。

## 外部方法 / 一手证据

- ECMAScript `Object.freeze` 通过 `SetIntegrityLevel(obj, frozen)` 固定对象自身属性；R007 对数组与每个 tuple 分别冻结，避免把可变运行态继续当作恢复基准：[ECMAScript Object.freeze](https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-object.freeze)。
- Three.js 的 material `opacity`、`transparent` 与 `depthWrite` 都会影响最终可见性/混合/深度行为，不能用单一 ghost boolean 代替这些状态：[Three.js Material](https://threejs.org/docs/#api/en/materials/Material)。
- Playwright 官方支持把实际页面截图与 versioned golden 比较，也明确提醒渲染会受 OS、浏览器版本、设置、硬件及 headless 模式影响，因此 visual baseline 必须绑定执行环境：[Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)。

由这些来源推导出的 KAOPU 方法是：不可变状态元组验证“已知变量恢复”，固定环境像素比较验证“实际输出恢复”；二者互补，不能互相替代。

## 与 KAOPU 当前制度比较

### No-novelty

- R2 已正确要求机器门与视觉/参考门分开，失败应在用户看到前被内部发现。
- R007 修正版已经实际采用不可变 tuple 和往返断言；N34 不冒充新算法，只把成功的局部修复提炼为候选制度对象。
- Playwright visual golden 是成熟测试功能，不等于 KAOPU 要把所有页面都改成严格像素逐位相等。

### 新缺口

- Gate 2/3 尚未明确要求可逆控制执行完整 transition sequence，而不是只测最终默认状态或单次按钮响应。
- 若恢复 oracle 与运行态共享可变对象，测试可能比较“被污染值 == 被污染值”并伪通过。
- UI boolean 正确不能证明渲染器/material/camera/overlay 等下游状态正确。
- 只比较已知状态字段会漏掉未建模输出；只看截图又难以定位根因并受环境变化影响。
- 第一绿色 run 可保留技术 success，但不能把它升级为视觉往返 success；两种 claim 尚需显式分账。

## 可反驳假设

对下一次 Fish 可逆视觉控制变更，如果候选门禁同时要求：

1. 在第一次 transition 前保存 claim-relevant baseline tuple，并冻结/哈希该 receipt；
2. 记录并执行 `baseline → alternate → baseline` 的有序 sequence；
3. 返回后比较所有 claim-relevant 状态字段，而不是只检查 toggle boolean；
4. 至少重复一次循环，确认 baseline 没被第一次切换污染；
5. 在固定浏览器/视口/renderer/容差下保存返回后的实际 paint evidence；
6. 技术 run 与 visual round-trip 使用独立 claim state；

则会保留 R007 第一 run 的技术成功，同时拒绝其视觉恢复主张，并接受加入不可变 baseline 与往返回归后的修正版。

## 最小历史回放

`visual_state_roundtrip_gate_n34.py` 对固定 fixture 执行 `8/8`：

1. 第一 run 的不可变 subject、workflow 与最终 ready：`CLAIM_VERIFIED`。
2. 实际半透明观察：`REJECTED_BY_VISUAL_OBSERVATION`。
3. 只检查 toggle 最终 boolean：HOLD。
4. 没有不可变 baseline tuple：HOLD。
5. tuple 相等但没有 painted evidence：HOLD。
6. 有像素证据但缺完整 tuple equality：HOLD。
7. 修正版的不可变 tuple、完整 sequence、重复循环与固定画面：`ROUNDTRIP_VERIFIED`（Candidate replay）。
8. 失败签名、修复 diff 与反证回放绑定：该 R007 显示泄漏的 bounded root cause confirmed；不扩大为其他视觉故障通因。

## Current Best View / 是否采用

- **Candidate partial：**下一次 Fish 可逆显示控制变更可局部试验 `VISUAL-STATE-ROUNDTRIP-001`；尚不修改全局 R2。
- **Current Best View：**保存 `TECHNICAL_RUN_COMPLETE` 与 `VISUAL_STATE_ROUNDTRIP_VERIFIED` 两个独立状态；真实视觉失败只否定后者。
- 候选回执字段：`testedSubjectSha`、`controlId`、`baselineStateTuple`、`baselineTupleFrozen`、`transitionSequence`、`returnedLogicalState`、`returnedStateTuple`、`tupleEqualityDecision`、`repeatCycleDecision`、`paintedEvidenceBefore`、`paintedEvidenceAfterReturn`、`visualEnvironment`、`visualDiffDecision`、`failedTransition`。

## Rejected

- workflow 全绿即可宣称全部可逆视觉状态正确。
- toggle boolean 回到 false 即证明画面恢复。
- 从运行态可变默认对象读取恢复值。
- 只测每个状态的孤立 final screenshot，不测有序 transition。
- 只做 state tuple equality，不看实际像素输出。
- 只做截图差异，不绑定状态字段、subject 与环境。
- 因修正版成功就删除第一绿色 run 的失败证据。

## 适用边界与 Unknown

- 候选适用于声称“关闭/恢复后回到原状”的控制；单向、不可逆的明确操作不自动要求同一 round-trip。
- baseline tuple 必须按 claim 选择；N34 的三个材质字段不是所有 Mother 的固定全局 schema。
- 像素容差、mask 和环境必须按任务固定；跨 GPU 的逐位像素一致不在本轮证明范围。
- 实际下一次 Mother 实施、独立 verifier、跨浏览器/硬件、制度 KPI、跨 Mother 适用性与用户验收均为 Unknown。
- 第一梯队专家 AI 未调用；本轮不是专家会。

