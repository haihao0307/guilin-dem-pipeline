# Stone Money Island — Fishing Gameplay V0.2.3

本目录把用户提供的《Fishing Planet - Official Trailer | PS4》拆解为可迁移的方法，并将它转换为 Stone Money Island 的海岛生存垂钓生产计划。

基线：Stone Money Island / Survivor Palau V0.2.2 全量交接包。

本轮实际完成：

- 对 114.136 秒、1280×720、29.97 fps 视频逐段抽帧分析；
- 提炼水面—水下—出水—回水的刺激链；
- 明确哪些内容不能从宣传片直接推成真实玩法；
- 建立 Fish / Ocean / Game / Coral-Habitat / Human-Tool-Audio / QA 六条并行工作线；
- 建立统一跨介质鱼体合同与垂钓事件合同；
- 提供可运行的纯逻辑 `fishing_core.cjs` 原型与测试。

本轮没有冒充已经完成可玩的垂钓系统。原型只验证状态连续、鱼体出水、落水和断线等核心事件，不含最终画面、人物动画与真实物种。

## 先纠正四个容易走偏的判断

1. 宣传片里的“水上镜头 + 水下镜头 + 鱼跃出水面”不等于一个已经证明可连续控制的系统。视频使用大量剪辑、焦段变化和近景特写。
2. 视觉刺激不能替代玩法。真正的刺激来自收线、放线、抬线、改变站位、避开珊瑚和承担断线、脱钩或暴露的后果。
3. Fishing Planet 的主要语境是现代运动垂钓；Stone Money Island 是 1944 年海岛生存。现代商品钓具、比赛和奖杯展示不能直接搬入。
4. 鱼跃出水不能成为所有鱼的通用动画；必须由物种、体型、水深、线角、体力、浪况和受惊状态共同决定。

## 不可妥协条件

- 一条鱼从水下到出水、落水、上岸始终使用同一个 `fishId`，禁止换模型、瞬移或生成替身。
- Ocean Mother 提供唯一水面查询；鱼、线、飞沫、船、相机和声音不得各自发明一张水面。
- 鱼体与线的状态必须可保存、可恢复、可重放。
- 正常游戏不提供永久“透视水下镜头”。
- 原 Ocean Mother 冻结海天源不被破坏。新增飞沫、局部扰动、入水环波和水下视觉以适配层接入。
- 1944 装备来源需要证据。未核实的材料只能标为候选。
- 手机目标优先；不靠替代网格 LOD 掩盖问题。

## 文件

- `VIDEO_ANALYSIS.md`：视频逐段拆解和可迁移边界。
- `MASTER_PLAN.md`：完整玩法与生产阶段。
- `CROSS_MEDIUM_CONTRACT.json`：机器可读跨介质合同。
- `MOTHER_WORK_PACKAGES.md`：各 Mother 职责、边界与验收。
- `ACCEPTANCE_TESTS.md`：身份、水面、张力、出水、移动端和存档测试。
- `../../source/v0230/fishing_core.cjs`：纯逻辑原型。
- `../../source/v0230/fishing_core.test.cjs`：确定性测试。
