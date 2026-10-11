# Mother 02:30 Coordination — Denim R10 → Tailor MP02 中远景连续表达

- ID: `KAOPU-MOTHER-20261012-KX01`
- 实际开始：2026-10-12 02:30:05 +08:00
- 实际收束：2026-10-12 02:32:44 +08:00
- 主持：小妈协调端
- 真实 Mother 参与：0。两条定向留言均已写入；截至收束没有 ACK。写入成功不算参会、理解或采用。
- 生产修改：0；排程、飞轮、冻结成果修改：0。

## 会前基线与去重

已完整读取当前 `main@5bdd2d6aa4989ac6acedb99411c207c267b8937b` 的根 `AGENTS.md`、R2 Production OS、Reference Replication Gate 和 Freshness Gate，并回读 #91/#63 最新可见记录、相关 Task Anchor、Delivery Receipt 与评论。

- #91 最新 N75 撤回了“0 run”误判：查询表面未覆盖 push workflow 时，空结果不能作为“不存在”的证据。它不直接解决本轮材质问题。
- #63 最新可见结论仍是 Coast R03 固定入口的公开浏览器运行失败；未把旧 URL/旧 subject 证据迁移到今天对象。
- 2026-10-11 Hair→Denim 的 KX-20261011-01 仍只有 `POSTED`，无 ACK；今天不重复发送。
- 当前 `gh-pages@2eacc2f45637ad1063efebec40087b2fb795f857` 已较 MP02 发布提交继续移动；本轮未把可变 Pages 根头当作 MP02 新成果。

## 今日唯一问题

用户要求各 Mother 每日交流可通用知识。今天只处理：

> Denim R10 已验证的“按最终像素足迹连续表达同一材料载体”方法，能否有限迁移到 Tailor MP02 的“稍远透明网/破碎”失败，同时避免把布样阈值、代理物理和软件浏览器结果冒充整衣真值？

## 两端 R2 任务核对

| 项目 | Denim R10（方法源） | Tailor MP02-S1（接收端） |
|---|---|---|
| task / object / defect | `fix/denim-r10-distance-lod-20261011`；R09.1 布样；中景 1–3 px 纱距仍闪烁 | MP02-S1；现有 K02 等实体纱线成衣；远景透明网/破碎 |
| accepted/evidence baseline | parent `ecbd381...`；固定 source `3ae1189...`、build `3daabc3...` | MP01 `c8e9b7b...`；MP02 source `23c34ca...`、evidence head `71900b7...` |
| 用户最后约束 | 保留 R08 近景、R09.1 风吹/惯性/锚点物理和双面针脚；不可关运动或用图片替代 | 保留 12 套缩略图；真实布料/重力/正反面/防穿模；连续缝线；远景不透明网；线径与针距可调；毛衣可双层 |
| referenceSet / UNKNOWN | 固定父构建和同一 YarnGraph；整衣、实机 FPS、自碰撞、用户批准 UNKNOWN | 固定七款 native garment、R11 knit、R09 denim、R12/R10 leather 来源；真实动态整衣、联合碰撞、视觉接受 UNKNOWN |
| forbidden routes | 固定世界距离硬切、随机抽稀、冻结/重置 solver、图片替代 | 纸片/图片/不透明背板替代、删缩略图、静态闭合几何冒充防穿模、Producer 自批 |
| fresh delta | PR head `a274226...` 仅追加 fixed-subject receipt；run 绑定 source `3ae1189...` | head `71900b7...` 仅补公开字节/文档；无用户纠正后的新物理或视觉实现 |
| regression / gate | run 38133622400 success；三 artifact；fixed local/public browser与运动局部对照；物理手机 false | N138 已执行 14 项历史回放；3,508 数值/GLSL/29 公网文件字节 scoped pass；视觉、物理、seam、collision 仍 fail/unknown |
| 当前状态 | `CANDIDATE_READY`（仅 R10 固定布样方法）；`USER-ACCEPTED=false` | `HOLD_GATE_FAIL`；`visualVerified=false`、`deliveryComplete=false`、`materialPhysicsCalibrated=false` |

## 新增证据与有条件方法

R10 fixed subject 的 Actions [38133622400](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/actions/runs/38133622400) 在 `3ae1189...` 成功。其 receipt 将近景显式纱线与中远景的覆盖率/覆盖加权法线/线性色连续混合，边缘、破口、松散纱和针脚另保可分辨路径，且 R09.1 `dynamics.js` 字节不变。固定局部四分之一像素移动实验中，R10/R09 的中景、远景、物理破损残差比约为 0.283、0.261、0.396。

这只支持一个有边界的 Current Best View：

1. MP02 可学习“按局部屏幕足迹切换表达、同一 carrier 生成过滤量、结构边界单独保留、动力学状态不随距离重置”。
2. 不能复制 R10 的 2.8/7/4/9 px 阈值、475 节点布样、显存数值或软件 Chromium 结论。
3. 单独降低亮度残差不是通过；如果衣物覆盖、轮廓或 seam 消失，低残差是错误优化。

## 明确决定

`KX-20261012-01 = POSTED_CANDIDATE_METHOD`。

责任端为 Tailor / MP02，只在现有 K02 对象内验证；Denim R10 作为方法源，不代做、不自批，不改 fixed subject。

已定向写入：

- [MP02 接收说明](https://github.com/haihao0307/guilin-dem-pipeline/pull/220#issuecomment-6112292060)
- [Denim R10 边界回流](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/pull/57#issuecomment-6112292239)

截至收束：`POSTED=true`；`ACKNOWLEDGED / IMPLEMENTED / GATE-RUN(下游) / ADOPTED / USER-ACCEPTED=false`。

## 最小验证

锁定 K02、同一人物/姿态/灯光/曝光/种子/材质参数：

- A：当前仅 3/5/8 管面边数切换；
- B：由同一针目/纱线 carrier 生成的局部像素足迹过滤；
- 近/中/远三个固定镜头，各 6 帧四分之一像素移动；
- 同时记录 ROI 重投影残差、总覆盖率、轮廓面积和 seam 可见连续性；
- 做 A→B→A′ 往返；桌面与 390×844 视口分开记录并绑定 exact head、固定公网 URL；
- 若残差下降但衣物变薄、轮廓收缩或 seam 消失，失败；若仍透明，转查覆盖不足、针目拓扑或透射，不继续盲调 LOD。

## 未完成边界

本轮没有 MP02 实现、没有新浏览器 gate、没有物理手机、没有布料物理/seam/collision receipt，也没有用户接受。MP02 仍不得交付为完成品；R10 成功也不证明整衣可直接采用。

## 交给学习飞轮的唯一问题

怎样为多尺度材料建立一组“反消失”联合指标，使抗闪烁改善必须同时保持覆盖、轮廓、结构边界和动力学身份，而不能靠变薄、删细节或换 carrier 获得更低残差？需在另一个真实接收端完成一次固定对照后，才考虑从 Candidate 晋级。
