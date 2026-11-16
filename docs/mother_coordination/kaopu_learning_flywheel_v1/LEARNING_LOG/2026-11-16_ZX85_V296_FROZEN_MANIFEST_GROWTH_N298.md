# KAOPU Learning Flywheel N298 — ZX85 v296 冻结 manifest 持续增长

## 唯一 bounded question

精确 v296 是否关闭 N297 的 256 个未封印文件，还是归档继续在冻结的 manifest 背后增长？

## Exact subject

- Library version: 296
- modified: 2026-11-16T11:10:19.785205+08:00
- bytes: 439244483
- ZIP SHA-256: 67f5f99145284d5de7cf3f320dc1b5b69eea8362188075602d557aadebeb0c00
- archive entries: 5679
- files excluding manifest: 5678

## Fresh replay

- manifest entries: **4973**
- missing manifest targets: **0**
- digest mismatches among covered files: **0**
- unmanifested archive files: **705**
- key-set equality: **FAIL**

相对 v282，归档增加 449 个文件，manifest 增量为 0；未封印文件也正好增加 449。CHECKSUMS.json SHA-256 与 v282 完全相同。这不是“清单补得慢一点”，而是当前精确 subject 在冻结清单之后继续增长。

新增未封印范围主要包括 whole-runtime-audits 336、whole native R275 42、live fetch R281 17、whole interactive R276 13、whole load R280 10，以及 publication preparation/display audit/mechanical increments。它们可能含有有价值的 QA，但在重封印前不能作为当前 subject 的 sealed evidence。

build-zx5a-checkpoint.py 仍保留 final manifest、reopen verify 与 atomic replace，且 SHA 未变。因此更窄的根因候选是：该脚本不是最终 writer，或后续 R275–R294/overlay/handoff 写入绕过了最终封印。

Generic mirror replay 仍 exit 0，但 realPartsMirrored=0；单入口 PASS 继续不能覆盖 exact subject integrity failure。

## Decision

HOLD_V296_FROZEN_MANIFEST_705_UNMANIFESTED_FILES

这是既有 N293/N297 失败的证据更新，不新增 regression case，也不改变 R2 OS。解除条件：找到真正最终 writer，把所有新增写入移到封印前，重建清单并对 exact final bytes 做 key-set/digest 重放。

## Lifecycle boundary

仅 POSTED / GATE-RUN；ACKNOWLEDGED / IMPLEMENTED_PRODUCTION / ADOPTED / USER-ACCEPTED 均为 false。未改 main、生产 Mother、资产或全局门禁。
