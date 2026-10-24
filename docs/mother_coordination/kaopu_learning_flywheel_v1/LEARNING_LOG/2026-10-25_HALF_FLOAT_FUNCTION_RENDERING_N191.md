# N191 — Float32 不可用时，不能把所有缓存直接降成半浮点

## Bounded question

Building R01 在公网浏览器因缺少 `EXT_color_buffer_float` 而空白。坚持函数直接表达建筑、禁止建筑网格替身时，能否把 `RGBA32F` 直接换成 `RGBA16F`？

答案：不能直接替换；但 Khronos 的 `EXT_color_buffer_half_float` 支持一个值得单 Mother audition 的混合路径。

## 真实生产事实

当前 `semantic-renderer.mjs`：

- 构造器要求 WebGL2 + `EXT_color_buffer_float`，否则抛出当前公网可见错误；
- 三个 MRT 分别保存 hit、normal、local，均为 `RGBA32F`；
- hit 以 `1e20` 表示未命中；
- object ID 参与最近命中 tie-break 和点击语义，rail ID 明确从 `30000` 起；
- descriptor/registry 的 Float32 texture 只用 `NEAREST` 采样，不是阻断本浏览器的 render target。

## 外部老师筛选

老师：Khronos WebGL `EXT_color_buffer_half_float` + 官方 conformance test。

- provenance：Khronos 官方规范与 `KhronosGroup/WebGL` 官方仓库；
- 维护：仓库未归档，2026-10-21 仍有提交；
- 可复现：官方提供 WebGL2 conformance harness 和 half-float extension test；
- license：仓库 MIT；
- 新增知识：该扩展在 2020 修订后明确暴露给 WebGL2，目标就是支持“只能渲染 16-bit float、不能支持 `EXT_color_buffer_float`”的设备；
- 风险：浏览器仍可能两个扩展都没有；混合 MRT 必须现场检查 framebuffer completeness；半精度会改变深度、法线和局部坐标；
- 当前失败浏览器是否支持 half-float：`UNKNOWN`，页面只暴露完整 Float32 缺失，浏览器自动化接口不能取得扩展列表；
- 状态：`TEACHER_CANDIDATE -> AUDITION`，不能直接进入生产。

它比 KAOPU Current Best View 多知道的明确问题：**Float32 render target 不可用时，WebGL2 仍可能提供标准化的 half-float-only 能力层，而不是只能在“完整 Float32”与“网格替身”之间二选一。**

## 最小数值反例

Python IEEE-754 binary16 回放当前代码语义：

- `1e20` 变成 Infinity；
- `30000/30001/...` 的对象 ID 发生碰撞；
- 近邻 hit distance 也会合并。

所以把三个 `RGBA32F` 纹理机械替换为 `RGBA16F` 必须 `REJECTED`：它会破坏最近命中、稳定 tie-break、点击选择和薄结构。

## Candidate 混合路径

只在设备满足 WebGL2 + `EXT_color_buffer_half_float` 时 audition：

1. hit metric、normal、local 改为 `RGBA16F`；
2. 新增一个 `RGBA8` identity attachment，把 `objectId16 + instanceId8 + materialRole4 + flags4` 精确打包；
3. 总 attachment 数为 4；启动时实际创建混合 FBO 并检查 completeness，不凭扩展名推断；
4. 32F 路线保持 Current Best View，half 路线不得静默覆盖；
5. 两条路线在同一冻结 Building R01 subject 上比较：非空帧、coverage/silhouette、first-hit depth、点击 object identity、case/stage/camera/door/lift、GPU p50/p95 和内存；
6. 任一 identity 不一致、薄结构消失、画面/交互失败或性能无收益，否定该兼容路线；
7. 两种 float 扩展都没有时继续 `HOLD_PUBLIC_RUNTIME_UNSUPPORTED`，不得引入建筑网格替身。

未取得真实模型 object/instance 上界前，16/8-bit packing 只是 Candidate；超界必须 fail closed，不能截断。

## 状态

- 本轮只做数值 method audition；未修改 Building Mother、main、R2 或公网页。
- 当前公网仍 `HOLD_GATE_FAIL`；真实建筑仍 `NO_NEW_ARTIFACT`。
- 沿用 N184/public browser gate，不重复新建 regression。
- Mother：待向 #91 的 Building R01 责任端定向发布后才是 `POSTED`；尚无 ACK。
- KPI：unknown。
