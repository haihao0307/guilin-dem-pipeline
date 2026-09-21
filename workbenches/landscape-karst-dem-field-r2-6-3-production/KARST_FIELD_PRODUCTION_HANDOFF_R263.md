# Landscape Mother｜卡斯特 DEM 函数场 R2.6.3 生产交接

## 生产对象

本版本生产的是作用于整座 DEM 连续岩体的卡斯特函数场，不是三个独立石块资产。P1 / P2 / P3 只保留为算子回归探针。

最终场：

`KarstField = DEMMacro + KarstStructure + FrozenMarineNotch + OneSidedWedgeCracks + ContinuousReefUnion + SurfaceMicroscope`

## 已冻结与运行时输入

### 视觉批准后冻结

- DEM 宏观山体身份
- 主孔洞、次级孔洞
- 长期海蚀基准与海蚀收腰幅度
- 裂缝骨架、宽度、深度和分叉
- 礁盘与岩体的连续连接
- Macro Warp 与中尺度结构

以上属于地质身份，不随每次游戏启动或潮汐随机变化。

### 运行时可变

- `tideOffset`：由 Ocean Mother 输入，只移动湿痕与礁盘干湿边界
- `wetBand`：控制潮湿黑边强度
- 色彩与观察频带

实时潮汐不会修改已经冻结的岩体几何。海蚀凹槽使用长期海蚀基准冻结；潮水只改变当下可见水位关系。

## 几何裂缝合同

裂缝不是颜色遮罩。R2.6.3 使用单侧楔形空腔从距离场中扣除：

- 表面开口较宽
- 向岩体内部逐渐收窄
- 在用户指定深度闭合
- 裂缝深度、宽度和分叉都会改变轮廓、法线、AO 与阴影
- `?noCracks=1` 仅用于自动 A/B 验证

## 礁盘连接合同

岩体与礁盘使用平滑并集组成一个连续场。岩体底脚与礁盘存在真实重叠和过渡，不允许悬空、穿插或作为两个互不相关的展示对象。

## 多频带运行

- `demMacro`：远景，投影不足一个像素时只保留地理身份与轮廓
- `karstStructure`：中景，加入孔洞、海蚀、主裂缝与礁盘连接
- `surfaceMicroscope`：近景，加入高频岩面残差

这不是多个独立 Mesh LOD，而是同一冻结函数场按观察尺度逐步解码。

## 缓存键

`fieldIdentityHash = demHash + operatorHash + frozenParameterHash + formatVersion`

首次烘焙可以较慢；批准后 Game Mother 只消费冻结缓存和轻量运行时接口。

## 验收门槛

- 浏览器可见三维画面
- 控制台无致命错误
- 默认 DEM 连续岩体，不是三个石块
- 裂缝开/关截图存在真实像素差异
- 实时潮位高低截图存在干湿边界差异
- 岩体与礁盘连续连接
- `visualApproved` 在用户批准前保持 `false`
