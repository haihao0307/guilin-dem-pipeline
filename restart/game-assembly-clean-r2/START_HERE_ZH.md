# Stone Money Game Assembly Clean R2 — START HERE

接受 Game 基线：`c07eec73616f613acde90881ac642b0972f12391`
总纲：`knowledge/KAOPU_ASSET_COMPILER_R1_ZH.md` @ `cc2243928ac6e35cfb7e516a80b9ddf4ffb33214`

Game Assembly 不生产 Fish / Coral / Human / Boat / Ocean 真值。

## 唯一装配规则
只消费：
`VERIFIER_PASSED`

未通过：
`NO_CANDIDATE`

禁止：
- generic fish
- generic coral
- toy placeholder
- 第二套 Ocean
- 为了场景好看自己造替代资产

## 第一阶段
保持 accepted world/game core。
逐项注册可用模块。
Domain 未通过不阻塞 Game 其他独立部分。

## 第一件可见成果
一个 `Stone_Money_Island_R2.html` standalone heartbeat：
- current real world
- 当前已通过模块
- HOLD/NO_CANDIDATE slot 明示
- current head
- no stale fallback

Fish/Coral/Patrol Crew 新 R2 通过 verifier 后再装入。
Game 不再接旧错误路线的 visual candidate。