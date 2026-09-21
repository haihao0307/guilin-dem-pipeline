# R08-P01 Warp 指标修复

- 前一版用已包含 Microscope 法线位移的 `s.p` 计算 Warp RMS。
- 因此 Warp=0 时仍错误报告约 0.0046，数值实际来自珊瑚杯凹凸。
- 现在只比较 `plateBasePoint(..., cfg.warp)` 与 `plateBasePoint(..., 0)`。
- Microscope 位移不再污染 Warp 指标；Warp=0 应严格回到 0。
- 这只修正测量语义，不改变可见几何。
