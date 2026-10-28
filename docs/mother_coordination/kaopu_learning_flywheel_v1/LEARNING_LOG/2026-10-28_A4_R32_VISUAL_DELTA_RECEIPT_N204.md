# KAOPU Learning Flywheel N204 — 多 10 次 draw 不等于产生了可见候选增量

日期：2026-10-28  
类型：制度问题 / exact-artifact historical replay  
状态：`OBSERVATION + CANDIDATE`  
生产修改：无

## 1. Bounded question

成功的 A4 R32 CI artifact 是否证明 R32 候选相对 retained R31 产生了可见增量？

## 2. 精确来源

- subject：`trial/a4-r32-normal-chrome-20261027@580acd1c8b851d0c843826e2b49c7079411473bd`
- workflow run：`40484446930`
- artifact：`12724761571`
- artifact digest：`sha256:99aa6309741366a3d4bee7cdc9bbca41c4750ff4625c236565afd1655bf0b9bc`
- `BROWSER_R32_RESULT.json`：`status=PASS`，tested commit 与 subject 一致。
- backend：ANGLE / Vulkan / `SwiftShader Device`；`hardware_gpu_claim=false`，`phone_verified=false`。

本轮直接下载并解包 artifact；不是根据 workflow 源码推断 artifact 内容。

## 3. 新反例

浏览器 QA 在相同相机、姿态、cut 与 candidate mode 下生成：

- `r32-whole`：703 draws，`nonBackgroundPixels=6930`，`colors=215`；
- `retained-r31`：693 draws，`nonBackgroundPixels=6930`，`colors=215`。

两张 PNG 均为 17,608 bytes，SHA-256 都是：

`23bb932832d6b8ee7f5cb68eb906c7382f06b5e64a466f90784110b985673599`

因此它们不是“看起来接近”，而是 artifact 中逐字节完全相同。R32 增加的 10 次 draw 在该验收视图中产生 0 个可见变化像素。原因可能是遮挡、离开画面、退化、被后续绘制覆盖或其他路径；本轮不凭截图选择根因。

## 4. 现有制度比较

R2 已禁止用文档、分支、截图数量冒充进展，但当前 browser QA 只检查：整帧完成、GL 无错、draw 数、非背景像素和颜色数量。它没有验证候选相对父版本的可见 delta。

这不是 N200/N203 的 invalid-sample 覆盖问题，而是一个独立的 verifier 漏洞：宏观 frame gate 全部通过，candidate/parent 对照仍可以输出完全相同的像素。

## 5. 可反驳假设与回放

假设：`若任务声明 R32 产生了可见增量，则相同相机/姿态且能暴露声明对象的有效对照视图不应与父版本逐字节相同。`

精确 artifact 回放 10/10 PASS：

- 两帧均通过现有 macro gate；
- draw 数确实为 703 / 693；
- pixel-readback 摘要相同；
- PNG bytes 与 SHA-256 相同；
- 不同相机的 `r32-opposite` 具有不同 hash，证明探针不是恒定输出。

结论：`HOLD_COMPARISON_FRAME_PROVES_NO_VISIBLE_DELTA`。

## 6. Candidate gate

新建 `CANDIDATE-VISUAL-DELTA-NOT-PROVEN-BY-DRAW-COUNT-001`：

- Task Anchor 声明 `visualDeltaRequired`、父/候选 subject、changed objects 与 exposure view；
- Delivery Receipt 记录同相机/同状态两侧 hash、changed pixel count/ratio 与 declared mask overlap；
- 同一有效 exposure view 若 hash 完全相同，直接 HOLD；
- 若 changed objects 被遮挡或不在画面，记 `HOLD_COMPARISON_NOT_EXPOSING_DELTA`，不得把该截图算通过；
- hash 不同只是必要条件，不代表质量或正确性，仍需独立 verifier。

## 7. Teacher / routing / boundary

- 外部老师：`NO_NOVELTY`；当前真实 artifact 已足够形成可证伪门禁。
- 路由：A4 FunctionRendering / #91。
- 静态 PNG 不能证明有无时间闪烁。
- 不证明 R32 源码没有差异，只证明该 CI 对照视图没有可见差异。
- 未运行硬件 GPU、公网页、production 或用户验收。
- 未修改 main、A4 trial、生产 Mother、R2 或全局门禁。

## 8. Routing receipt

- #91 comment: `6463513860`
- URL: https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6463513860
- `POSTED = YES`
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED = NO`
