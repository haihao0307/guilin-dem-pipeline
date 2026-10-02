# R04 海狼中间场采样：ROOT_CAUSE_REVIEW

任务 `FISH_SCOREMAKER_OCULAR_ORAL_R04_20261002`。本工位只新增 `src/legacy-sampling-r04.js`、数值验证脚本与报告；没有修改 R14 原源码/HTML、鱼载体、冻结眼动模块、app、cranial 或构建脚本。

## 根因与本轮边界

主工位性能调查发现，新嘴部法线增加约 1.5 ms 工作后，较慢 RAF 使原 `instrument.update` 收到更大 delta，积累更多 `1/240 s` 积分子步；每个子步重复完整采样七组鳍场，产生 CPU 工作量与帧间隔相互放大的反馈。1.5 ms 来自主工位调查；本工位没有跑浏览器，不能把它或下列 VM 时间当作已复核的最终网页 FPS。

本轮仅消除中间采样中没有消费者的六个鳍行。积分次数、delta、body 的 129 个采样站、鳍的 129 个采样站、连续插值、浮点精度、力学参数和最终显示场全部保留。原 `Math.min(delta,.12)*speed` 时间规则也原样保留，没有新增时间截断、跳步、低频更新或降采样。不能声称“FPS 已修复”；必须等主工位新的源码冻结及实际浏览器证据。

## 已检查的实际消费者

原 KFC13 每个子步执行：body/pitch 积分→body-only 采样→尾柄计算→七条鳍链积分→完整场采样→尾尖计算/推进→jaw、gill、eye 积分；整个 update 末尾再完整采样。

实际 R14 载体解码后的尾尖是 vertex `441261`，`partInfo[0]=7`，该鳍 `fieldRow=8`，尾鳍权重 channel 11 为 `255`。保留的 `dynamicTip` 位置、法线编码、权重、partInfo 和根坐标逐字节等于完整源顶点的对应数组切片。

在中间完整采样与下一次 body-only 采样/最终完整采样之间，唯一读取 fin field 的调用是 `deformPoint(caudalTipVertex)`。其 `deformMaterial` 读取尾尖绑定的鳍 row 8，再由 source material X 的 `transportSpine` 读取 body rows 0、1。实际 VM 消费者 trace 是 **`[8,0,1]`**。尾柄读取 row 0 已发生在前面的 body-only 采样之后；chainStep、jaw/gill 和 stepNaturalEyes 都没有读取其它鳍行。

因此，中间鳍采样只写 row 8 即可，body/pitch/worldCenters 仍完整计算。下一子步的六条非尾鳍链只读取自身 q/v，而非上一轮渲染场；跳过这些中间行的写入不会改变力学传导。最终所有九行仍在返回 update 前完整写入，GPU/眼位/其它外部调用看到的场没有缺行。

## 精准适配与 fail-closed

`patchLegacySampling(html)` 只适配内嵌的原 KFC13 JS，返回新 srcdoc 字符串，不写原文件。只变更三处：

1. 中间 `sampleFields(h);const tip=...` 改为 `sampleFields(h,false,h.dynamicTip.partInfo[0]);const tip=...`，并检查 retained tip 的源绑定仍为 part 7。
2. `sampleFields` 新增默认 `onlyPart=0`。
3. 鳍行写入循环加 `!onlyPart || part.id===onlyPart` 条件。

`sampleFields(h,true)` 仍写完整 body；最后 `sampleFields(h);return s;` 仍写全部鳍行。reset 的默认完整场采样也不变。适配器匹配原版本/ABI，逐段检查原 update、sampleFields、deformPoint 的完整函数文本，确认 dynamicTip 构造切片仍在；每个替换点必须唯一。未知修改、重复调用、重复 instrument 或缺失绑定都会抛错，不静默猜测或回退。

此等价结论依赖上述实际消费者关系。未来若在尾尖计算之前加入其它 fin-row 消费者，必须重新测量并重新验证，不能沿用“中间其它六行无用”的结论。

## 实际数值证据

脚本：`fish-five-r01/scripts/verify-legacy-sampling-r04.mjs`。报告：`fish-five-r01/evidence/R04_LEGACY_SAMPLING_PARITY.json`。适配器 SHA256：`924455425f68adec86a12274270b5d92a4a830429da46b611c26a88510b978ec`。

原始 VM 与适配后 VM 使用同一份真实 R14 score 解码出的 497701 顶点源 handle。六种模式 REST、CRUISE、BURST、TURN_LEFT、JAW、EYE_TRACK，速度 `.5/1/2.5`，分别测试完整 source arrays 与释放 CPU 源数组后的 retained-tip 路径。36 组每组 240 次 update，前半固定 `1/60 s`，后半交替 `1/120、1/24、1/80、.075、0 s`。

每次 update 后比较 **全部 state**：body/pitch/七鳍的 q/v、time/modeTime/accumulator、phase/frequency、response、peduncle、tailTipPosition/Velocity、swimSpeed/distance、eye/gaze/pupil、jaw/gill，以及 field/worldCenters。Float32 和 Float64 数组均 bit-exact，所有标量最大绝对差为 **0**；重新计算的实际尾尖位置也一致。没有只比较四舍五入 snapshot。

全部 41 项通过，包括实际尾尖 binding、实际中间读行 trace、源载体 byte-identical、ABI 拒绝测试和 30 handle CPU 测量。R14 原文件在本工位没有发生编辑。

## CPU 测量及浏览器待验收

这是同一实际模型、原/适配两份 Node VM 的 30 个 handle 更新耗时，不是浏览器帧时。每组预热 24 帧后采集 120 帧，完整积分继续执行。

| 每演员子步数 | delta / speed | 原 VM 中位耗时 | 适配 VM 中位耗时 | 相对节省 |
| --- | --- | ---: | ---: | ---: |
| 4 | 1/60 s / 1 | 89.959 ms | 58.479 ms | 35.0% |
| 12 | .05 s / 1 | 326.778 ms | 227.205 ms | 30.5% |
| 30 | .05 s / 2.5 | 588.720 ms | 541.448 ms | 8.0% |

原鳍行写入次数为 `7*(子步数+1)`，新次数为 `子步数+7`；body 采样次数均为 `2*子步数+1`。其中没有缩减最终七行采样的精度。VM/JIT/GC 与实际浏览器不同，不能将这些毫秒换算成网页 FPS，也不能承诺总帧时改善比例。

新冻结后仍须独立浏览器确认：实际 r.advance/RAF 时间、cold switch、模式切换、30 条群体、eye/mouth 更新、GPU 场行一致、视觉连续性，以及 standalone/public 当前版本。这些验收由主工位与独立验证工位执行。

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际新增生产适配源码。
- [ ] 用户最终看到的是本轮主工位接入后的可交互三维工作台。
- [ ] 最终画面与性能来自新冻结源码的真实三维浏览器运行。
- [ ] standalone 与公网固定链接由主工位回读验证。
- [x] 只有截图或 VM 数值而没有工作台不能作为完整交付通过。

`visualAcceptance=false`、`productionReady=false`。本工位结论是**中间鳍采样优化已证明状态等价且 VM CPU 测量有节省**；最终 FPS 问题仍需新候选浏览器测量。
