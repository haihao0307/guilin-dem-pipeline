# Current Best View N33 — User-visible boot before payload

状态：Candidate partial；Fish R006/R006.1 历史回放 `8/8`，未实施、未全局采用。

1. `FINAL_RUNTIME_READY`、`USER_VISIBLE_BOOT_RESILIENT`、`VISIBLE_FAILURE_RECOVERY` 与 `USER_DEVICE_ACCEPTED` 是四个独立状态，不能互相代替。
2. 对大型单体 HTML，最终 ready、完整页面截图或公网字节一致均不能证明加载期间不是白屏。
3. 最低早期可见门禁必须在主响应停在 payload 之前时，按 bounded deadline 观察到实际 paint 的可见 shell；源码中存在 DOM 不等于用户已看到它。
4. 截断响应、WebGL 不可用、上下文丢失与重试恢复必须各有可见结果；这些故障测试不替代最终 3D ready。
5. 用户白屏报告是独立 Observation Root：它否定 R006 的强用户可见主张，但不删除 R006 已经成立的对象完整性与最终运行证据。
6. R006.1 的延迟/截断/故障恢复 run 支持候选门禁；因 `userDeviceRetested=false`、`originalClientCauseConfirmed=false`，不能声称用户机器已修好或根因已确诊。
7. N33 只建议下一次 Fish 大型 standalone HTML 任务局部试行，不修改 main R2 OS 或生产分支。

Unknown：真实下一次 Mother 实施、独立 verifier、用户设备复测、首轮通过率变化、跨 Mother 适用性、用户验收。

