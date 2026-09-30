# KaoPu Coast Lab R00

这是一个快速验证用的小样，不是最终海洋，也不是已经验证的工程级浅水求解器。

它只测试一条最小因果链：

`Ocean Boundary → Variable Depth → Obstacle → Wet/Dry Contact → Wetness History → Local Splash Patch`

## 当前保留

- 同一海床场；
- 固定世界时间步；
- 外海边界波；
- 一个障碍物；
- 湿度历史；
- 泡沫衰减；
- Camera 只移动高成本局部粒子区，全局波场不中止；
- Composite / Bathymetry / Flow / Wetness / Coupling 五个诊断视图。

## 当前不声称

- 不是完整 Saint-Venant / SWE；
- 未证明质量守恒；
- 未实现真实自然破浪；
- 局部粒子只是事件表达占位，不是 PBF/XPBD 正式接入；
- 不使用老师资产作为 Runtime Truth。

## 清理原则

Active Package 只保留当前有价值版本。旧版不因“旧”自动删除，也不因“新”自动保留：

- 已验证的稳定基础保留为 Anchor；
- 被新版本完整替代且无独立证据价值的文件删除；
- 失败原因只写入一份简短 Ledger，不携带旧 Runtime；
- Teacher 源码/模型只在学习档案层保留，不进入 KaoPu Runtime。
