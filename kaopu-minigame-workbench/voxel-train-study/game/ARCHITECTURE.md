# 火车老司机 · 状态与可复现输入

## 固定步长权威模拟

`Session` 以 30 Hz 固定 tick 更新，拥有速度、位置、站台、车门、乘客、投掷物、分数和局时。渲染只读取快照和事件；帧率不能改变制动距离或奖励。

输入结构为 `{version:1, tick, sequence, actorId, role, type, value}`。当前只有本地司机命令驱动车辆；未来乘客命令使用独立白名单。随机车站、乘客和天气仅由初始 seed 推导。保存配置及输入日志，即可重播同一结果。

## 状态机

`ready → running → doors-opening → unloading → boarding → ready-depart → doors-closing → running`

进站、停稳、停早与补停提示由位置、速度、稳定时间和 `reverse` 标记推导；它们不会把普通驾驶锁死。

- `earlyStop` 是停止时的提示状态：保留前进操作；只有满足步行距离与站台覆盖条件才可开门。
- `missed` 保留正常驾驶与制动。停车后可进入 `recovering`，以受限倒车速度回到停车区；离站超过补救范围才计入不可补救并推进下一站。
- `paused` 冻结模拟，不改变原阶段。
- 达到本局时长后进入 `finishing`；已有上下客安全完成后进入 `summary`。

车门状态与运动互锁，避免车辆载着正在跨门的乘客移动。上车奖励只在乘客抵达座位后确认，下车奖励只在其走出车门、抵达站台后确认，避免重复奖励。

## 可见行走与碰撞

候车乘客保存世界坐标；座位内乘客保存车厢坐标。上下客路径显式经过站台、踏步、门洞、中央过道和座位。坐标系切换发生在同一实际位置，没有传送或穿墙。

石子在权威模拟内按重力积分，与柴油机车、罐车和两节客车的移动包围盒碰撞。每颗石子只结算一次。追赶者限制在站台范围内，成功补停后结束追赶。只有卡通撞击反馈，没有伤人或血腥表现。

## 编组与基线

原编组为 2001 柴油机车＋FUEL 罐车。游戏在后方增加两节有真实门洞、座椅和过道的客车。原车体通过已认可程序化源构建，游戏中把原有轮子分离，换成贴合轨头的 24 边钢轮踏面、内侧轮缘与金属轮毂，以 0.285 米滚动半径计算角速度。轴心按轨顶加滚动半径定位；内侧轮缘略低于轨顶，不把它当作踏面穿轨，再增加可见刹车机构与车顶车灯。经典文件不改写。

## QA 目标

1. 固定 seed 和输入日志重播结果一致；暂停不推进时间。
2. 完成正常停靠、停早补停、偏位步行、漏站追掷、倒回补救、满载和完整一局总结。
3. 乘客路径实际穿过门洞；行驶或关门时不能上下客；分数只结算一次。
4. 真实 Chromium/WebKit 操作按钮与键盘，观察轮转、刹车、灯光、乘客、车门、投掷轨迹及桌面/手机布局。
5. 对经典源文件执行冻结 hash 校验，并检查经典画面没有回退。

后续联网可把 `Session` 放在服务器，由服务器验证角色、命令顺序和输入速率，再向客户端发送带 tick 的快照。当前代码与界面只标注单人，不把本地多角色对象称作在线多人。


## R07 overlay

The prior sections describe the R01–R06 baseline. R07 adds `line: 'kcr1'` while missing/legacy line configuration retains the old seeded six-stop simulation and replay. `timetable.mjs` supplies the player-provided nine-stop plan, separately stored original mileage strings, independent monotonic clock and smoothly varying rate. The model defaults to `steam-model.mjs`; `createGameTrain({legacy:true})` retains the diesel construction. The public parent/classic files are unmodified. Audio is gesture-unlocked, distance-synchronized at four exhaust beats per 0.61m-radius driving wheel revolution, with licensed provenance and a disabled-by-default modern crowd layer.

## R09 flat renderer

`flat-terrain.mjs` reuses the original near geometry with zero vertex displacement, then fills a broad flat world with bounded instanced scenery. Stations and actors receive plain translations, never a belt transform. Chunk recycling occurs beyond 287m; supported camera radius is capped at 65m, fog 45–105m. Continuous rails extend beyond ±244m and broad ground beyond ±1800m. Camera presets and persistence are isolated under `kaopu.train-driver.views.r09`; `game/r08/` owns its original modules and unchanged old camera key. Gameplay `session.mjs`, timetable, route mileage, and audio samples remain shared in behavior but source-independent in the archived entry.

The new driver is a basic original in-cab placeholder, not a production character asset. Tall upper exhaust is an explicit renderer option; lower platform steam preserves R08. Explicit pause also suspends the Web Audio context; canvas gestures only adjust the camera.
