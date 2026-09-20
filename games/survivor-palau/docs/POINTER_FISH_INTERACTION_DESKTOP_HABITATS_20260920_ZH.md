# Stone Money Game｜手指/指针与鱼交互参考：Desktop Habitats

日期：2026-09-20  
来源仓库：`chaseleantj/desktop-habitats`  
核对 source HEAD：`e6ea239e92bb04dcd3953f80758aef61c72b2146`  
许可：MIT（原仓库 LICENSE，Copyright 2026 Chase Lean）。若直接复制或实质复用代码，保留其 MIT notice；本文件以方法蒸馏为主，不把第三方水族箱数值写成 Stone Money 自然真值。

## 1. 值得迁入的核心不是“鼠标追鱼”，而是 输入运动 → 世界刺激 → 鱼的感知 → 分级反应

Desktop Habitats 的 Riverscape 没有让鼠标直接拖动鱼。它把屏幕指针先变成一个三维“靠近鱼的对象”，保留位置和速度，再让每条鱼自己判断威胁。

其 `main.js` 做法：
- 监听 `pointermove`；
- 用相机 raycaster 把屏幕位置投到鱼缸前方固定平面；
- 保存三维 `pointer.position`；
- 用相邻事件的位移 / 时间得到 `pointer.velocity`；
- 速度用 `lerp(..., 0.5)` 平滑；
- 事件停止后速度指数衰减，而不是突然从高速变零；
- pointer 离开后取消刺激。

这一层非常适合 Stone Money Game：**手指是输入，鱼不读屏幕像素；鱼只读经过 Game 转成共同世界坐标后的刺激状态。**

## 2. Fish 端真正使用的是“逼近率”，不是单纯距离

Riverscape 的 `fish.js` 对每条鱼先计算：
- 指针到鱼的三维距离；
- 是否位于鱼的可感知方向；
- `looming = closingSpeed / distance`，即对象在鱼视野中“放大/逼近”的速度；
- 当前警觉/习惯化状态；
- 是否仍在惊跳冷却期。

因此：
- **慢慢靠近**：鱼给空间、逐渐移开，但不会必然爆发式逃跑；
- **快速冲近**：逼近率超过阈值后，可能触发 C-start 式快速逃逸；
- **重复无害刺激**：阈值会随 alarm / familiarity 提高，避免每次同样手指动作都机械触发；
- **一条鱼惊跳**：邻鱼经过短延迟传播惊群，而不是全鱼同一帧同时转向。

原仓库测试也专门区分这两种情况：
- slow approach：测试要求不触发 C-start，同时近处鱼与刺激源平均距离增加；
- fast lunge：只直接惊到附近一部分鱼，随后 alarm contagion 扩散；鱼经历 escape → settle → hover，而不是永远逃跑。

这套“慢靠近 / 快冲击 / 习惯化 / 群体传播”的**关系结构**值得吸收。原项目的具体 range、速度、C-start thrust 等是淡水鱼缸尺度和作者调参，不能直接登记为帕劳鱼类自然数据。

## 3. Stone Money Game 的正确分工

### Game Mother
负责：
1. 接收 Pointer Events（mouse / touch / pen）。
2. 把屏幕轨迹转换为统一世界刺激 `interactionProbe`。
3. 使用同一个 Game worldTime，不另建鼠标时钟。
4. 在手机上处理 pointerdown / move / up / cancel；必要时读取 coalesced events，让手指速度不会因低事件频率抖动。
5. 决定刺激源的语义：
   - 正常生存游戏：手指只是控制输入，鱼真正感知的是玩家手、鱼叉、钓线、饵、独木舟等**世界对象端点**；
   - 直接生态观察/触摸模式：可允许手指投成一个明确标记的 `DIRECT_TOUCH_PROBE`，用于“手指靠近鱼、鱼作出反应”的交互，但不能偷偷把它伪装成世界里的真实手。

建议最小数据：
```js
interactionProbe = {
  probeId,
  sourceKind,      // PLAYER_HAND | LURE | SPEAR | CANOE | DIRECT_TOUCH_PROBE
  pointerId,
  active,
  worldPosition,   // metres
  worldVelocity,   // metres / second
  worldTime,       // shared authoritative seconds
  pressure,        // optional, input-only
  confidence
}
```

### Fish Mother
负责：
- sight / lateral-line 等感知；
- distance、closing speed、looming；
- flight zone；
- C-start / give-way / inspect 等行为；
- habituation / refractory；
- shoal contagion；
- 物种和尺寸差异。

**Game 不得直接改 fish.position 来做“鱼跟手指互动”。** Game 只提供世界刺激；鱼自己产生动作。

### Ocean / Habitat
负责：
- `surfaceAt(x,z,worldTime)`；
- 水深、流速、浑浊度、障碍；
- 是否有水体遮挡/岩体阻隔；
- 鱼是否处于同一有效水域。

手指投射和鱼的距离计算不能绕开现有 Stone Money authoritative water/bed/world frame。

## 4. 与现有 Stone Money 跨介质合同的结合

现有 #83 合同保持：
- one `fishId`；
- one authoritative `worldSeconds`；
- one authoritative water surface query；
- 鱼的位置、速度、状态不能因为输入刺激发生瞬移；
- 390×844 是正式移动验收视口；
- 手指停止移动后刺激速度连续衰减，不允许一帧突然从高速归零导致虚假反应。

推荐 Game → Fish 的纯数据调用：
```
updateFishPerception(dt, worldTime, {
  interactionProbe,
  surfaceSample,
  habitatSample
})
```

不要让 DOM PointerEvent 直接进入 Fish 内核。这样浏览器、触摸屏、键鼠和未来控制器都能共享同一个世界刺激协议。

## 5. 第一轮最小验收

只做一块浅水可见鱼区，不扩整个游戏。

必须至少验证：
1. 手指静止在鱼附近：鱼不持续爆发逃逸。
2. 手指缓慢靠近：附近鱼逐渐让位，不能瞬移或全群同步掉头。
3. 手指快速扫近：一部分可感知鱼先惊跳，邻鱼稍后传播。
4. 同样的无害动作重复：反应允许逐渐降低，不能永远同强度。
5. 手指抬起 / pointercancel：worldVelocity 连续衰减并最终清零，无幽灵刺激。
6. 390×844 真触摸路径单独验证，不能用 desktop mouse event 当手机验收。
7. 一条鱼从互动前到互动后保持同一 fishId。
8. 若鱼越过水面，仍服从 #83 的 ≤0.15 m crossing discontinuity gate；这个交互参考不得放宽任何既有门禁。

## 6. 不迁入的东西

- 不迁入其 24 条淡水鱼数量；
- 不迁入鱼缸坐标、固定前玻璃平面或鱼缸范围；
- 不迁入其淡水鱼具体威胁半径、速度阈值、C-start thrust 作为帕劳真值；
- 不迁入桌面壁纸/macOS全局鼠标采集；
- 不把“鱼会躲光标”变成所有帕劳物种的统一行为；
- 不复制其鱼模型、材质或场景资产到 Stone Money；
- 不把该项目的测试通过等同于我们的 Game/Fish 已集成。

## 7. 来源定位

核对文件：
- `README.md`：明确说明 fish react to cursor；浏览器中 move pointer near fish to interact。
- `scenes/riverscape/src/main.js`：pointer raycast、三维位置、速度平滑、停止后衰减。
- `scenes/riverscape/src/fish.js`：looming、flight zone、C-start、habituation、alarm contagion。
- `scenes/riverscape/tests/fish-behavior.mjs`：slow approach 与 fast lunge 分开测试。
- `LICENSE`：MIT。

本文件是 Game/Fish 的方法输入与验收要求，不表示执行端已签收、生产代码已修改或用户已验收。
