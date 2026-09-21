# R2.2 接入 R11 现役世界基线说明

日期：2026-09-21

## 正确的继承关系

- 世界与场景权威基线：`handoff/survivor-palau-stone-money-full-r011-20260921`
- 飞行员故事主控：本目录 `01_MASTER_SPEC_ZH.md`
- 旧玩法原型：`work/survivor-palau-v0170-pilot-survival-20260921`
- 可回收游戏组件：`work/smi-v0230-game-fishing-loop-20260918`

旧 V0.1.7.0 原型和 V0.2.3.0 组件都不是当前世界权威，不能覆盖 R11 的完整 Palau、用户黄色故事区域、Ocean Mother、真实 DEM、NOAA 水深或 `PalauWorld.sample()`。

## 已锁定的故事事实与分叉

历史原型为 Carroll E. McCullah、VMF-122、Goodyear FG-1 Corsair BuNo 14053，日期为 1944-11-21。真实事件中他完成受控水上迫降、放出救生筏并很快获救。游戏必须把虚构分叉明确放在“救援失败或被打断”之后，不能把长期漂流冒充真实结局。

## 当前执行边界

只允许把旧原型中已经证明有价值的水面观察、短呼吸管、可见鱼饵鱼钩、有限手线物资与真实咬钩状态机重新接到现役世界。禁止直接移植旧岛位、旧地形、旧海面或旧相机世界。

航空眼镜／镜片只作为水面或极浅水观察工具，不是深潜面镜；自由潜放在后期，禁止过度换气和单人深潜。精确航空眼镜型号、当天实际求生包组合、FG-1 单人筏固定位置和释放步骤仍属待核查项。

## 验收状态

- `visualAcceptance=false`
- `productionReady=false`
- `publicShareAllowed=false`

故事包进入现役仓库并不等于场景、交互或历史装备已经完成。下一步只能在 R11 世界关系上做隔离式接入和真实浏览器验收。
