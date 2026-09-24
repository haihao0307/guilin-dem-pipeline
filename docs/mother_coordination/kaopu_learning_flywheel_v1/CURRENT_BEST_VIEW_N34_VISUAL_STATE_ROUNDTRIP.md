# Current Best View N34 — Visual state round-trip

状态：Candidate partial；Fish R007 历史回放 `8/8`，未实施、未全局采用。

1. workflow 全绿和最终 browser ready 只能证明被执行的路径；不能证明可逆视觉控制恢复了原始画面。
2. 恢复基准必须在第一次状态变更前保存为不可变、版本化的 claim-relevant tuple；从已被变更的“默认对象”恢复是循环自证。
3. 最低回归序列是 `baseline → alternate → baseline`，并至少重复一次；必须保存 transition trace、恢复后的完整状态元组及实际 paint 证据。
4. 只检查 toggle boolean 会漏掉 `opacity / transparent / depthWrite` 等渲染状态污染；只检查已知字段也可能漏掉未建模视觉影响，因此 tuple 与固定环境像素证据必须并存。
5. R007 第一 run 的技术步骤仍为真实 success，但视觉往返主张被实际像素观察否定；修正版才补齐不可变快照与往返断言。
6. N34 只建议下一次 Fish 可逆显示控制变更做局部试验，不修改 main R2 OS 或生产分支。

Unknown：真实下一次 Mother 实施、独立 verifier、跨浏览器/硬件稳定阈值、跨 Mother 适用性、制度 KPI、用户验收。

