# N169 Current Best View — Neural handoff dual plane

状态：`Candidate partial; local structural probe 8/8; GPU/production/user evidence UNKNOWN`

1. 机器之间可以用 tensor、latent 或其他紧凑二进制表示传递**大规模数值载荷**，但不得因此删除显式 Task Anchor、Delivery Receipt、Canonical Truth、冻结项、状态语义和 acceptance gate。
2. learned/tensor payload 必须被显式 `representationContract` 约束：格式与 IR、operator set、model/decoder version + digest、dtype、shape、semantic denotation、payload digest、请求与实际 execution provider、fallback policy、fidelity metric/threshold。
3. control plane 与 data plane 分离：控制面保持可审计、可 diff、可由独立 Verifier 判定；数据面可以为了带宽/吞吐采用二进制或 learned representation。
4. ONNX 的新增启发是三层版本分离（IR / operator set / model）与 typed graph/tensor schema；ONNX Runtime 的新增启发是 requested provider 不等于 actual execution，unsupported subgraph 可能落到其他 provider，故生产收据必须记录 actual provider，禁止 silent fallback。
5. 本地 probe 只证明 8 类状态可以 fail-closed，并证明相同 float payload 的 raw binary 比 JSON 数组更小、CPU view 构造更轻；它没有执行 neural encoder/decoder、GPU kernel、device transfer 或任务 fidelity 测量。
6. 因而“GPU 解码一定更快”“latent 可以替代函数/变量/契约”均保持 `UNKNOWN / NOT AUTHORIZED`。必须在一个真实 Mother 的同一 payload、同一硬件上做 end-to-end A/B，计入 encode、transfer、decode、fallback、误差和 verifier 成本。
7. 适用候选：hair guides、vertex/texture fields、embedding/feature maps 等 bulk numeric payload。禁止用于隐藏用户指令、验收条件、lineage、Frozen/Rejected 状态或 Producer/Verifier 权责。
8. 不修改 R2、main 或任何生产 Mother；仅保留为 Coordinator 定向试验候选。
