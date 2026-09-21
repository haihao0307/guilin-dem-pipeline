# Stone Money Game Assembly Mother R1
## Game 是总装车间，不是另一个资产 Mother

日期：2026-09-21
状态：ACTIVE PRODUCTION ROLE

## 0. 最终目标

所有 Coral / Fish / Bird / Landscape / Ocean / Weather / Human / Boat 等 Mother 最终不是为了各自展示，而是为了进入 Stone Money Game。

Game Mother 的职责是：
- 故事与玩法；
- world/runtime assembly；
- player interaction；
- save/restore；
- module contract consumption；
- acceptance integration；
- 一个最终 standalone HTML。

Game Mother 不重新生产各 Domain 的资产真值。

## 1. Game 只消费已注册接口

Coral:
- archetypeId
- habitat/contact field
- snag/cover interface
- render candidate

Fish:
- fishId
- body/rig/behavior profile
- perception
- water constraint

Ocean:
- surfaceAt
- cameraMediumSample
- shore/intertidal interfaces

Landscape:
- land/reef/channel/bed truth

Bird:
- birdId
- flight/landing/perching behavior

Weather:
- one environment frame / one clock owner

## 2. Story Placement Contract

每个进入 Game 的 archetype/variant 必须有：
- WHY_IN_STORY
- WHERE_IN_WORLD
- PLAYER_INTERACTION
- ECOLOGICAL_ROLE
- TIME/STATE
- SAVE_IDENTITY
- PERFORMANCE_CLASS

不能“模型做好了就随机摆”。

## 3. Game Assembly Pipeline

1. REGISTER
2. PLACE
3. CONNECT
4. TEST
5. STORY JUSTIFY
6. SAVE/RESTORE
7. MOBILE
8. SINGLE_HTML

任何 Domain 尚未合格：
- 不造 generic substitute；
- 用 NO_CANDIDATE/UNKNOWN；
- Game 继续做不依赖该对象的部分。

## 4. 当前近期装配优先级

### G1 Ocean Camera Crossing
消费 #118：
- same Ocean above/partial/under；
- one authoritative surface；
- player camera states；
- final standalone HTML。

### G2 Fish Interaction
消费 interactionProbe + Fish perception：
- hand/pointer/world stimulus；
- slow give-way / fast startle；
- no direct fish.position push。

### G3 Fishing
保持 #83–#89：
- one fishId；
- handline；
- surface crossing；
- habitat snag；
- catch transaction。

### G4 Coral Habitat
当 Coral Factory archetype Stage 至少 A/B 可用后：
- 不随机铺满；
- 根据 reef/substrate/depth/exposure；
- visible coral = habitat/contact/snag same identity。

### G5 Story Ecology
把鱼、珊瑚、鸟、潮水、巡逻、玩家行为串成故事：
- 观察；
- 获取食物；
- 风险；
- 隐蔽；
- 生存；
- 时间变化。

## 5. Game Mother 禁止

- 自己造第二套 Fish；
- 自己造第二套 Coral；
- 自己造第二套 Ocean；
- 为了场景丰满放 toy/generic assets；
- 在 Domain blocker 时停整个 Game；
- 等所有物种做完再开始 Game。

## 6. 工厂关系

Domain Mother = 零件车间。
Game Mother = 总装车间。
Xiaoma = 研究院 / 总调度 / 质量制度。

一间零件实验室爆炸：
- 对应 slot HOLD；
- Game 继续装其他已经合格的零件；
- 不停整个工厂。

## 7. 最终用户交付

始终一个：
Stone_Money_Island_<version>.html

必须：
- double-click / file://；
- all runtime/assets embedded；
- no unzip/server/CDN；
- console 0 error；
- current head；
- no stale fallback。
