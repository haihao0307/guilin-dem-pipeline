# R08-P02 根部布局修复

- Microscope 与 Warp 门槛已经通过。
- 失败仅发生在 `2 层 / 18 片`：旧横向间距按每层片数线性扩展，根点跑出共同附着垫。
- 新布局用 `xNorm` 和 `layerNorm` 把所有根点归一化到固定坡面梯田足迹。
- 支持 6–18 片、2–4 层；根部随机扰动保留，但不会随 perLayer 无限扩张。
- 共同附着垫、层片表面、Microscope 与 Warp 参数均不变。
- `visualAcceptance=false`；`productionReady=false`。
