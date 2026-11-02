# KAOPU Learning Flywheel N235 — A4 R06 fresh-workspace executable closure

日期：2026-11-03（Asia/Shanghai）

## 本轮唯一 bounded question

`A4_ORIGINAL_SHORT_INNER_RETURN_INSTALLED_R06.zip` 能否从 fresh extraction 仅使用包内字节（或被明确物化的外部前置）复跑它随包交付的全部 current local gates？

## 先读基线

- main：`34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- root `AGENTS.md`：`251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS：`d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference replication gate：`8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate：`4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 最新真实反馈：N234 inner-return R02 bounded install lock；另有 `HOLD_VERIFIER_PRODUCTION_PATH_SPLIT` 尚未解除
- #63 最新真实反馈仍为 N49，无新 ACK/production receipt
- 适用 regression：`CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`

## Exact subject

- Library：`libfile_6bc4b7c511448191843d3fb8801f61f6`
- ZIP SHA-256：`9f214b3965483af25593d4d1406c813691e89ff7af6b8f153598bb7cfdc38d9d`
- archive / manifest：`646 / 645`
- previous checkpoint pointer：`libfile_84c57058845c8191b9e944a7fda8c7a5` / `0f0bfaa4…73dca`

## 正面证据保留

- untouched manifest：**645/645，零 mismatch**
- `analytic-pass.test.mjs`：9 passes / 10 refusal configurations，PASS
- camera math：1,625 cases，PASS
- pane-order：5 directions / 7 refusal gates，PASS
- Node fake-DOM protocol：11 modes，PASS；明确不是 browser
- fresh Mesa GLES：10 members / 11 rows
- 11 个 archived row hash 全部一致；11 张 PNG 全部逐字节一致
- native scene triangles=0；source geometry/textures=false；rejected baseline=false

因此不能把 R06 说成截图工程，也不能把本轮失败外推为 short-return 几何或当前像素错误。

## 真实失败

随包附带的 `display-newton-state.test.mjs` 在 fresh extraction 首次执行即：

```text
ENOENT: .../original-window-frame-r01/window-native.glsl
exit 1
```

测试还引用同目录的 display shader、两份 Float64 diagnostic、`NATIVE_FREEZE.json` 及其文件集；整个 `original-window-frame-r01` 目录不在归档和 manifest 中。

顶层 manifest 确实记录 previous checkpoint 的 Library ID + ZIP SHA，但没有：

- 相对 import 的 path mapping；
- 自动 exact-SHA materializer / merge command；
- fresh-workspace prerequisite receipt；
- 将该外部依赖物化后再跑完整 gate 的结果。

所以“前一 checkpoint 有指针”是 provenance，不等于当前相对 import 已具备可执行资源闭包。

## Decision

`HOLD_A4_R06_FRESH_WORKSPACE_TEST_RESOURCE_CLOSURE_INCOMPLETE`

仅阻止：

- self-contained complete local-gate replay；
- complete executable verification closure；
- 把部分 current renderer replay 扩大为全部随包 gate 已复跑。

不否定：

- manifest 对包内文件的真实性；
- current software-GLES 11/11 deterministic outputs；
- 其余四个独立 gate 的本轮结果。

## 最小可反驳修复

二选一：

1. 将 `original-window-frame-r01` 依赖和 diagnostics 打包并写入 manifest；或
2. 明确 exact external prerequisite、path mapping，并提供自动 exact-SHA materializer。

随后从 clean extraction 运行全部五个 test + actual GLES；不预建作者工作区，不手工拼目录。

## Regression / routing

不新建重复 case；更新 `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`。

当前 lifecycle：`POSTED / Candidate IMPLEMENTED / GATE-RUN`；`ACKNOWLEDGED / production IMPLEMENTED / ADOPTED / USER-ACCEPTED = false`。

POST receipt：`haihao0307/guilin-dem-pipeline#91 comment 6591405050`。

## 边界

- 不评判 source shape、视觉、whole cab/train、browser、hardware GPU、mobile、production 或 user acceptance。
- #91 的 pane verifier/production-path split 继续 HOLD，本轮未重测。
- 未修改 main、生产 Mother、私有包、R2 或全局门禁。
