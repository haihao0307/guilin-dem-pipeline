# N169 — ONNX neural handoff dual-plane Teacher Candidate

状态：`TEACHER_CANDIDATE / AUDITION-LOCAL-STRUCTURAL-PROBE-PASSED / Coordinator-method / no production change`

## Bounded question

机器—机器交接是否应以神经网络/latent/tensor 表达替代显式函数、变量与任务契约，从而减少沟通开销并由 GPU 解码？

## 当前真实关系与既有覆盖

这不是已经发生的生产失败，而是用户明确提出的方法问题。R2 已要求 Task Anchor、Delivery Receipt、Canonical Truth、独立 Verifier 与分层 acceptance；N27/R34 已证明 binary transfer/format 需要 exact digest、envelope 与 semantic replay。现有体系尚未把 learned representation 的 `IR × operator set × model × decoder × tensor schema × execution provider/fallback` 组合变成可判定字段，这是本轮的 bounded gap。因为没有新的用户纠错或生产失败，本轮不新造 regression case。

## Teacher screening

候选老师为 ONNX v1.23.2 与 ONNX Runtime v1.31.0 的**接口/验证方法**，不是其中任何预训练模型。

1. **Source/provenance**：`onnx/onnx` release commit `e1ac8e74b620bbdc7ba07f0440806bd93f651a28`；`microsoft/onnxruntime` release commit `402979ac1bef89dcd55add41eaa7277c407599eb`。
2. **维护活性**：ONNX v1.23.2 于 2026-10-06 发布，仓库 2026-10-16 仍有 push；ORT v1.31.0 于 2026-10-09 发布，仓库 2026-10-17 仍有 push。
3. **代码/测试/可复现性**：ONNX 提供 protobuf IR、checker、shape/type inference 与 pytest；ORT 提供 execution providers、runner 与测试入口。不是 demo-only。
4. **License/rights**：ONNX Apache-2.0；ORT MIT。任何实际 neural codec 的 weights、训练数据与资产权利仍须另审，不能由这两个 license 推导。
5. **当前问题直接相关性**：ONNX 不以 opaque latent 取代契约，而是用显式 computation graph、standard data types、tensor type/shape、IR/opset/model version 与 metadata 实现互操作；ORT 再把可执行 subgraph 分配给 CPU/GPU/NPU provider。
6. **相对 Current Best View 的新增**：把表示兼容性拆成 IR、operator set、model、decoder 与 tensor schema；把 requested accelerator 与 actual execution/fallback 分开记录。
7. **依赖/成本/集成风险**：protobuf/ONNX/ORT 版本、custom ops、动态 shape、模型与 decoder 权重、CUDA/cuDNN/provider 兼容、host-device transfer、warm-up、fallback、fidelity 与供应链成本。
8. **失效边界**：ONNX 是模型 IR，不是 KAOPU 消息总线；ORT 的 GPU 能力不证明某个 KAOPU payload 更快。未经同硬件端到端 benchmark，GPU speedup=`UNKNOWN`。用户提到的 `Cheng Lou / Handwired` 因没有可核验的完整 URL/版本/commit，保持 `UNKNOWN`，未作为证据。

回答“它到底多知道了什么”：**神经系统要可靠互操作，仍必须显式声明可执行图、tensor 类型/形状、三层版本与 producer metadata；硬件加速还必须暴露实际 provider/fallback。opaque latent 本身没有这些可审计语义。**

Primary sources:

- https://github.com/onnx/onnx/blob/e1ac8e74b620bbdc7ba07f0440806bd93f651a28/docs/IR.md
- https://github.com/onnx/onnx/blob/e1ac8e74b620bbdc7ba07f0440806bd93f651a28/docs/Versioning.md
- https://github.com/onnx/onnx/blob/e1ac8e74b620bbdc7ba07f0440806bd93f651a28/onnx/onnx.proto3
- https://github.com/onnx/onnx/releases/tag/v1.23.2
- https://onnxruntime.ai/docs/execution-providers/
- https://onnxruntime.ai/docs/reference/high-level-design.html
- https://github.com/microsoft/onnxruntime/releases/tag/v1.31.0

## 可反驳假设与最小对照

假设：如果 learned/tensor 只进入 data plane，而 control plane 与 representation identity 保持显式，则 gate 能在 decode 前区分缺失任务语义、错 decoder、错 model、错 opset、错 dtype/shape/semantic、payload corruption 与 silent fallback；同时 raw tensor 对 bulk numeric payload 的 byte/CPU parse 开销低于 JSON 数组。

`neural_handoff_dual_plane_probe_n169.mjs` 结果：8/8 classification assertions 通过。100,000 个 float 的同机 micro-probe 中，JSON 1,962,348 bytes，raw float32 400,000 bytes（4.906×）；median JSON parse 3.230551 ms，typed-array view 0.001202 ms。这个数字只覆盖 CPU memory 中的 JSON parse 对 typed-array view construction，不含 transport、encoder/decoder inference、GPU transfer/kernel、warm-up 或 fidelity，因此不能升级成“神经网络/GPU 更快”的结论。

## Candidate translation

只给下一次真实 bulk numeric handoff 增加可回滚 `representationContract` 候选：

- `format / irVersion / operatorSet(domain,version)`
- `modelVersion / modelSha256 / decoderSha256`
- `dtype / shape / semanticDenotation / payloadSha256`
- `requestedExecutionProvider / actualExecutionProvider / fallbackPolicy`
- `fidelityMetric / threshold / benchmarkWindow / environment`

Task Anchor、Delivery Receipt、Regression Case、Frozen/Rejected/Unknown、lineage 与 acceptance 继续走显式 control plane。若一个字段无法被独立 Verifier 判定，则不得以 latent 结果自证。

## 最小 Mother 试验与采用边界

Coordinator 只需回答四件事：

1. 是否存在一个真实、足够大的数值 handoff（如 hair guides/vertex fields/feature maps），使 serialization 成本可测？
2. 现有 binary envelope 是否已经覆盖上述 representation tuple？
3. 哪个 exact payload、encoder/decoder、CPU/GPU/device 与 fidelity metric 可冻结？
4. 同一 payload 的 explicit-current 与 dual-plane-candidate A/B，能否在计入 encode→transfer→decode→verify 全链后同时改善 wall-clock/bytes 且不降低 fidelity/fail-closed？

仅当第 4 项成立且 injected mismatch controls 全部被拒绝，才可从 `AUDITION` 进入 `PROBATION`。小控制消息、用户指令、状态机、验收与治理字段明确不适用。任何 silent fallback 直接 HOLD。

## 决定与状态

决定：`TEACHER_CANDIDATE`，local structural audition 通过；尚无真实 Mother、GPU、production 或 user acceptance 证据。R2、main、生产 Mother、门槛和 Canonical Truth 不变。

生命周期：`RADAR_FOUND=true / TEACHER_CANDIDATE=true / AUDITION=local-structural-only / PROBATION=false / ACTIVE_TEACHER=false / LEARNED_OUT=false`。

路由：`POSTED=true`（#91 comment `6231378151`）；`ACKNOWLEDGED / IMPLEMENTED / PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。指标全部 `unknown`。
