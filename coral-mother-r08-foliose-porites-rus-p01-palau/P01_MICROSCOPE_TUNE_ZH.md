# R08-P01 Microscope 可见性收敛

- 上一轮真实几何位移已存在，但 Microscope 0/1 仅改变约 0.76% 的近景画面。
- 不降低 1.2% 可见差异门槛。
- 杯壁、杯缘和杯坑位移分别提高到 0.0115 / 0.0135 / -0.0185。
- 近景镜头距离由 2.0 收紧至 1.55，并重新对准重叠层片表面。
- 细胞尺度频率不变，避免退回大颗粒或岩石皱褶。
- QA 与 Build 两个运行时对象同步记录同一 microReliefGain。
- `visualAcceptance=false`；`productionReady=false`。
