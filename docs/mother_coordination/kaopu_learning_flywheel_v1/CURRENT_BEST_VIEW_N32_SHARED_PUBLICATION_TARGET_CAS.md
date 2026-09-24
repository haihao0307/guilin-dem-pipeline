# Current Best View N32 — Shared Publication Target CAS

状态：Candidate partial；Fish 历史回放 `8/8`，未实施、未全局采用。

1. 本地验证只产生 `VERIFIED_LOCAL_CANDIDATE`，不自动产生共享入口写权限。
2. 每个可变共享入口必须有稳定 `targetKey`，并在变更紧邻步骤比较精确的 expected/observed subject tuple。
3. 目标已推进时进入 HOLD。header 白名单、更高版本号、较晚时间戳、non-force push 或 pull-rebase 都不是 CAS。
4. concurrency group 应覆盖同一 `targetKey` 的所有 writer；它减少并发窗口，但不替代 mutation-time CAS。
5. 合流候选必须包含所有 required predecessor subjects，并重跑每条被合入 lineage 的适用回归。
6. N32 只建议下一次 Fish 固定入口发布做单 Mother 试验，不修改 main R2 OS 或生产分支。

Unknown：真实 workflow 实施、独立 verifier、真实 gate-run、跨 Mother 适用性、制度 KPI、用户验收。

