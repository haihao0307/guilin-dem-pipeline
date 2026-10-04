# Current Best View N71 — Matrix attempt lineage

Status: **Candidate partial**

1. 最终成功与失败历史继续分账；N71 不改变 N31/R2 的方向。
2. 对 matrix workflow，attempt identity 不能停在 run-level scalar；必须下钻到 `matrixJobs[].{jobId,cell,conclusion,failureSignature}`。
3. RCA 覆盖键是 `cell:signature`；normalized signature 可绑定同一 repair delta，但 file/public 或不同 group 的 observation 不能因此消失。
4. Kuko #25–#28 历史回放 `9/9`：#28 技术门禁成立，学习闭环因缺少 machine-readable review 仍 HOLD。
5. 只更新既有 regression `SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001`，不创建同类重复 case。

Unknown: Kuko Mother implementation、独立 verifier、ADOPTED、USER-ACCEPTED、制度 KPI、全局适用性。
