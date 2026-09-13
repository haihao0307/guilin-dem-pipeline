# 下一步继续顺序 · R3.9 轻量运行态之后

R3.8 的六深度 SoilProfile、WRB、JRC、统一世界地点索引已经完成；R3.9 又完成了运行载荷的无损轻量化和旧活动二进制清理。不要再重复这些工作。

## 1. 收束最终 lean handoff

- 用 `tools/r3-handoff/build_current_lean_handoff.py` 生成 R3.9 当前接续包。
- 包内只带当前代码、状态、世界总谱规则、语义/transport 索引、来源/Release/SHA 锁和可重复 QA。
- 不携带 37.996 MB 当前浏览器 payload body，不携带历史 GB 级底包，也不携带永久证据 ZIP。
- 内容按 SHA-256 去重；唯一未压缩内容和 ZIP 本体都必须 <= 8 MiB。

## 2. 回到小温州主画面与交互验收

轻量化闭环后，不继续为了压缩而压缩。以 R3.9 固定运行态为基础，重新做完整视觉/交互巡检：

- 山地近景主形与真实比例；
- 三处河流近景，确认水体证据与地形/河网语义没有混淆；
- 移动前后相机与显示曲面的 `1.600 m` 关系；
- 2 m 人尺度移动、路径安全阻挡、越界阻挡和复位；
- 390×844 布局；
- SoilProfile / WRB / JRC / WorldCover / OSM 切换时没有视觉错位或旧状态残留。

只有实际画面和交互值得保留，才继续向新的视觉候选推进。

## 3. 做运行性能而不是继续堆数据

当前两套新 transport 已无损通过本地与固定公网 QA。下一步性能关注点应是：

- 首次交互时间；
- 切换 property/depth/WRB/JRC 时的峰值内存；
- gzip 解码与 SHA 校验成本；
- 手机端连续切换时的缓存上限与回收；
- 是否有必要把某些高频索引预取，而不是新增更多常驻数据。

没有真实性或体验收益时，不新增大型证据声部。

## 4. 真实 iPhone 仍是独立门

390×844 Chromium 已通过，但它不是真实 iPhone Safari/GPU/CPU。当前压缩 transport 依赖 `DecompressionStream('gzip')`；在真实 iPhone 完成验证前：

- `realIphoneVerified = false`；
- `productionReady = false`；
- 不把浏览器仿真当真机证据。

## 5. 历史与恢复边界

R3.1–R3.7 冻结运行目录与永久证据 Release 不删除、不覆盖。活动树只保留当前运行所需内容；历史大包和完整源证据按固定 commit / Release tag / asset / bytes / SHA-256 精确恢复。
