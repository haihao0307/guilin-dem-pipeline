# KAOPU Learning Flywheel N297 — ZX85 v282 最终封印复发

## 唯一 bounded question

精确 v282 在加入 R270–R274 内容后，是否仍保持 v268 已通过的最终封印不变量：归档中除 CHECKSUMS.json 外的文件集合必须与 manifest key set 完全相等，且所有 digest 匹配？

## Exact subject

- Library version: 282
- modified: 2026-11-16T07:28:57.547179+08:00
- bytes: 422871859
- ZIP SHA-256: 66f36568355b31bfb4104c7ee0f6610d48001319ee9240774dbf61f5af203a3a
- archive entries: 5230
- files excluding manifest: 5229

## Fresh replay

最终封印审计：

- manifest entries: **4973**
- missing manifest targets: **0**
- digest mismatches among covered files: **0**
- unmanifested archive files: **256**
- key-set equality: **FAIL**

相对 v268：归档文件增加 352，manifest 只增加 96，差额正好是 256 个未封印文件。分布为：zx5a-cab-source-r25 241、zx5a-whole-cabin-seat-r274 5、RECOVERY_RESET_2040_R270 3、zx5a-whole-cabin-seat-r272 3、四个 mechanical handoff 各 1。

代表性未封印内容包括 cabin transmission R271、seat connections R273、whole cabin-seat R272/R274 与恢复合同。这里不判断这些文件本身技术质量；只判断它们不能作为已被当前 manifest 封印的交付证据。

build-zx5a-checkpoint.py 仍保留“最终生成 manifest → 写 next ZIP → reopen 校验 → atomic replace”代码，SHA 与 v168 相同。但当前精确归档不满足该代码声称的不变量；build intent 不能覆盖 exact bytes。

Generic mirror clean replay 仍 exit 0，3 轴、roundtrip、oriented volume 与最大运动误差 1.7763568394002505e-15 均重现；但 realPartsMirrored=0。单入口 PASS 不能修复整个 subject 的 seal failure。

## Decision

HOLD_V282_SUBJECT_INTEGRITY_256_UNMANIFESTED_FILES

这是 N293 同类失败的精确 subject 复发，更新既有 Candidate，不新增 regression case。解除条件只有：所有 R270–R274 / handoff 写入完成后重建 manifest，重新打开 exact ZIP 验证 key-set equality 与 digest，再重跑命名入口。

## Boundary

仅为 POSTED / GATE-RUN 候选证据。未改 main、生产 Mother、R2 OS、全局门禁或资产；没有 ACKNOWLEDGED / ADOPTED / USER-ACCEPTED 回执。
