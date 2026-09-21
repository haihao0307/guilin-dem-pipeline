# Landscape Mother｜卡斯特 DEM 函数场生产线 R1

## 目标

当前 P1 / P2 / P3 只作为小尺度算子探针，不作为三个独立石头资产搬进游戏。生产目标是把已经验证的主孔洞、次级溶蚀、海蚀切层、Warp、Microscope 表面和几何裂隙作用到一整座 DEM 连续岩体上。

最终身份：

`KarstField = DEMMacro + KarstStructure + MarineCut + SurfaceCracks + MicroscopeResidual`

批准后，主孔洞、裂隙、海蚀和宏观形体固定；后续运行不再随机改变。

## 五阶段工作线

1. **DEM Canonical Input**
   - 输入统一 CRS、统一像元原点、统一覆盖范围的 DEM。
   - DEM 只负责宏观山脊、谷地、坡面和整座山的地理身份。

2. **Karst Structural Operator**
   - 主孔洞与连通洞体。
   - 次级溶蚀孔、岩壁凹槽与局部掏空。
   - 海水线下部陡切、窄颈下行、底脚平缓外展。
   - 上部真实几何裂隙，限制在表面窄壳层内，不机械切穿整座岩体。

3. **Identity Freeze**
   - 固定随机种子、参数和算子版本。
   - 生成 `fieldIdentityHash = demHash + operatorHash + parameterHash`。
   - 一旦批准，孔洞和裂隙按地质身份冻结。

4. **Multiband Bake**
   - `Band A / DEM Macro`：远景与轮廓。
   - `Band B / Karst Structure`：孔洞、海蚀、主裂隙和中尺度残差。
   - `Band C / Surface Microscope`：仅在近景解码的高频表面残差。
   - 不使用传统多个独立网格 LOD；同一函数场只按观察尺度逐步解码频带。

5. **Game Runtime Consumer**
   - 远处只读取 Band A，投影不足一个像素时作为单点/极低频轮廓处理。
   - 中景读取 Band A + B。
   - 近景读取 A + B + C。
   - Game Mother 消费冻结的场缓存和轻量采样接口，不携带完整生产工作台。

## 缓存原则

- 不保存完整稠密三维体积。
- 只缓存表面附近的稀疏窄带结构残差。
- 法线由场梯度恢复，不单独存储。
- Brick Mother V2.6 材质只保存色板、种子和少量参数，不烘成大贴图。
- 第一次生成允许较慢；之后以 `fieldIdentityHash` 命中缓存快速运行。

## 当前 R2.6 验证门槛

- 默认显示一整座 DEM 连续岩体，而不是三个独立石块。
- P1 / P2 / P3 仍可切换，但仅用于算子回归。
- 裂隙必须改变真实距离场。
- 主孔洞、次级孔洞和海蚀切层必须继续可见。
- Chromium 首帧非黑屏、控制台零致命错误、RGBA8 兼容路径通过。
- `visualApproved` 在用户视觉批准前保持 `false`。
