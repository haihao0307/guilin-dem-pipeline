# KAOPU Mother 有限协调纪要：毛发与牛仔布的暗部辨因交流
ID: KAOPU-MOTHER-KX-20261011-01
状态：Candidate 方法已定向 POSTED；未宣称生产问题解决。

## 实际时间、参与与范围
- 准备与核查开始：2026-10-11 02:35:24 +08（实读时钟）。
- 核查/定向投递结束：2026-10-10 18:39:46 UTC；对应北京时间次日 +08。保存和固定回读另计。
- 主持：本任务助手；真实 Mother 回复 0；独立专家调用 0。不模拟会议发言。
- 唯一问题：如何把 Hair R03 已实现的“暗部来源隔离观察”，迁移给当前 Denim R06 的硬条纹/管状纱束偏差诊断，并把 Denim 的“控制有效≠真实”边界回流给 Hair。
- 本轮只是知识核查与定向交流，不改生产分支、不启动资产制作或新部署，不修改日程/飞轮/本地计划。
- 昨日用户要求每天交换各线学到的可共用知识。此次使用一张交流卡与两个相关 PR 的回读链接，不广播、不要求全体回签。

## 会前权威与去重
当前 main：5bdd2d6aa4989ac6acedb99411c207c267b8937b。已实际读取根 AGENTS、R2 OS、REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE、TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE。
当前 gh-pages：e10ab0d1995edcc72b8abc7353250f8ccee65a65。
协调分支读到 1ce2a013ed62dcb0f82c241f0ad2bac75e8a19d1；完整 tree 非 truncated，本轮路径尚不存在。
#91 全页返回138条，末条 N75（https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5979603278）；#63 全页30条，末条 N49（https://github.com/haihao0307/guilin-dem-pipeline/issues/63#issuecomment-5910449798）。它们是历史反馈，不计本轮 Mother ACK。
已读可见最新已完成专家纪要 EXPERT_FARMLAND_ASPECT_0300（2026-09-18）及最新窗口外状态（2026-09-25）；保留“有限观察不外推完整域”的边界，不复开旧议题。
已读工作台方法论 V1.1 固定 39cff1cbaf9f903b2cbfde628e30b80ab4d51519：先忠实复现、保住效果，再单层观察和参数实验。该文档仍在 Draft PR35；本轮使用与当前用户要求一致的观察方法，不以草案自动替换强制 R2 或其他任务授权。

## R2 九项核对（只涉及 Hair、Denim）
| 项 | Hair 来源端 | Denim 接收端/主要责任端 |
|---|---|---|
| taskId/object/defect | 本轮审读 ID KX-20261011-01 不伪装生产taskId；生产 R03 的独立 R2 taskId未在所读目录发现。对象耳后阴影；已实现 caster 分离 | 真实 TASK_ANCHOR: denim-r06-layered-scatter-20261010；对象牛仔纱束；缺陷 rigid fibers/regular weave/insufficient scattering |
| baseline/baseSha | R02-ANCHOR 标 merge 64f45cc54670f32f651c25b1ceb623eb13429123；记录不等同完整用户接受 | R05 cca5466b1e58b09a9a5c1ce75ea47ee142eafbcb；属于继承源码基线，不冒称视觉已验收 |
| 用户最新约束 | 保留R02/R01，现有授权内观察与改善；本轮要求交换知识 | 保留R01–R05、灰棚/透视/几何纱线/断尾与预设；影视级目标尚未达标，不能降目标 |
| referenceSet/Unknown | GNM固定资产与原光学代码、R03测试截图；真实光学、实机、用户接受 Unknown | 锚点列Weave、Disney、Jensen等；本轮只核查仓库原始实现/报告，不声称重新研读这些论文；实测棉纤维参数 Unknown |
| forbidden routes | 以补发/删合理接触影掩盖问题、将PCF当面积光、搬资产禁令跨域 | 搬毛发PCF参数/双灯映射到棉布、画黑洞、替换几何、冒称全BSSRDF或影视级 |
| fresh delta | ee98711c→74eb86fc增加同镜头caster对照与PCF控制；精确运行74eb86fc | R06新增分层光学与独立控制；测试build f8a0e0ab75ca5b8ea4dd345d8f3e7b847eccf2b3，当前文档head 5e007a63061715f285c03a4cf564d93d172ce7d8 |
| regression | 适用VISUAL-STATE-ROUNDTRIP-001；现有测试有恢复调用，但没有看到该序列不可变状态+恢复像素相等判据 | 同例适用；已有scatter/transmission像素响应检查；本轮建议的caster迁移尚未执行 |
| gates | exact-head CI成功、artifact实读；CI localhost/SwiftShader，不能称公网验收。R03完整R2 receipt覆盖尚不足 | run 38045137467 success已核对；VALIDATION_REPORT记录file/public各42状态及390x844；这些为源端报告，本轮未下载其全部artifact或独立复跑 |
| 当前审读状态 | VERIFYING：来源方法有局部证据；最终生产接受未确认 | VERIFYING：保留tested candidate；本轮方法迁移仍Candidate，未进入Accepted baseline |

未发现本议题对象替代或旧产物冒充，因此不硬套 REJECTED_CREATIVE_SUBSTITUTE / STALE；也不因新知识卡已发送而升格生产。
四类 Bird/Fish/Boat/Terrain回归不直接对应本次对象，不重复建例。沿用现有视觉恢复例及R2；未把这些门禁谎称本轮都已执行。

## 原始证据及小妈实际核查
1. Hair commit 74eb86fc8de937c88987f4d863db5fd304d129f8 的 main.js、HairOpacityShadows.js、browser-regions.cjs 与README已读。
   - casterDiagnostic 默认 headCasts=true/hairCasts=true；head.castShadow 与独立 hairOpacityActive 通道分开。
   - 源代码能执行“只留毛发投影”“只留头部投影”，并标记阴影更新；不是用变暗颜色模拟投影开关。
2. Hair Actions https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38058175742
   - push，head 74eb86fc...；job114230813061 全步骤成功，包括数值/分配检查、styles/head rotation/mobile浏览器。
   - artifact11672281123 已下载；实际ZIP SHA256 = 11aa2c5a63b79096dce34d11d92960289e09046375db013b33b1740b4b20fd18，与GitHub digest一致。
   - 实读browser-regions.json：baseURL=http://127.0.0.1:8767/，errors=[]，有sourceHashes、poseEvidence和独立caster视图。
   - 实际查看side.png、side-hair-shadow-only.png、side-head-shadow-only.png。耳后明显暗区在关闭头部投影时消失，保留头部投影/关闭毛发投影时仍可见；这支持当前镜头下的主要贡献来自头耳不透明投影。不是解剖真实性或所有阴影正确的证明。
   - 没有把CI图包当成本轮新的运行，也没有把localhost测试当公网/实机。
3. Denim TASK_ANCHOR、VALIDATION_REPORT与qa.py固定于5e007a63...已读；run38045137467 success，触发source d199016c8b3a3cb651ec4a5dfc34985ac5d359c3。report说明构建后测试f8a0e0ab...，不能把sourceSha/buildSha混用。
   - qa.py分别切scatter与transmission；像素差阈值只查通道确实影响画面。
   - 报告明确：当前仍可见管状纱束、规律排列和硬线断尾；未达影视级。借用的是诊断办法，非“成功成品”标签。
4. 既有回归：docs/mother_coordination/kaopu_learning_flywheel_v1/REGRESSION_CASES/CANDIDATE_VISUAL_STATE_ROUNDTRIP_001.json；固定协调父提交1ce2a013...。检查明确要求不可变基线、重复恢复、状态元组与画面互补。

## 一项决定 / 有条件方法
采用“保住当前好效果 → 固定条件 → 一次隔离一类贡献 → 恢复并复核 → 再决定改哪层”的短实验作为Candidate交流。
Hair→Denim：先区分不透明几何投影、纤维遮挡、散射、透光；不要看到暗部就补几何/提亮。
Denim→Hair：像素改变证明参数有作用，不等于材质更真；不能让光学补偿掩盖结构缺口。
这里只复用观察方法，不复制物种/材料参数、不另定架构。

反例与边界：
- 几何管状轮廓在关闭投影后仍存在，光学改善不能证明几何已修好。
- 暗区可能混有投影、吸收、法线、AO与色调映射；单个开关不能排除所有替代解释。
- 非线性组合/遮挡/色调映射下，各通道差分通常不可简单相加。
- 陈旧阴影缓存、随机种子、质量档或自动曝光变化会造成假归因；需固定或明确记录。
- PCF radius4→12只改有限纹素滤波，不是物理面积光；不向棉布直接推广。
- 真实世界因果/光学准确需额外实物和测量，软件干预只能说明此实现的贡献。

## 最小验证（未执行的接续）
由Denim Mother在既有R06缺陷任务中，选一处硬条纹ROI：
A完整基线 → B仅关一项当前可控通道 → A′恢复，重复一次；记录几何/种子/镜头/灯光/曝光/色调映射/质量档、caster/material状态及阴影缓存更新。
同条件静态可重复时比较A和A′；动态噪声须固定种子或独立声明容差。不能复原则先查状态/缓存，不解释成新物理。
必要时用一个既有第二灯位区分解释；不可为拍“更好看”换对象、削减质量或隐藏合理接触阴影。仅当前实现可独立控制的通道进入比较，其余Unknown。
费用和实机耗时Unknown；不要求新平台或全场景扫描。

## 实际沟通与回流
- Hair方法已定向发送Denim PR39，并回读正文完全一致：
  https://github.com/haihao0307/Humanoid-Rig-Lab-Next/pull/39#issuecomment-6100878768
- 小妈把Denim已存在报告中的对照方法边界回流Hair PR194，并回读正文完全一致：
  https://github.com/haihao0307/guilin-dem-pipeline/pull/194#issuecomment-6100880944
- 两处投递前读取评论列表均为空，未重复广播。
- “回流”只是读取既有成果后定向传达，不伪装两位Mother实时对话。

生命周期（仅指本次方法迁移）：
POSTED=true；ACKNOWLEDGED=false；IMPLEMENTED=false；GATE-RUN=false；ADOPTED=false；USER-ACCEPTED=false。
源端Hair自身已实现/运行与迁移状态分开；Denim已有测试通过也不能自动算本次迁移通过。

## 飞轮接续与未完成边界
飞轮只研究一题：当投影、透射、散射及缓存相互耦合时，怎样用最少局部开关和恢复对照区分解释，避免“参数有响应”被误写成“材质更真实”。
下一触发点：接收端沿现有任务返回一组绑定版本的ROI与A→B→A′记录，或发现控制非独立的具体反例。无实质新证据不重复开会。
不自动创建新计划；本任务不能直接接通Mother聊天或本地G盘；真实回执仍缺。
昨日本地纪要推送失败的历史仍保留“未共享”事实；本轮不补造它已远端归档。

## 本轮交付性质
知识/协调记录，不是新工作台：未调用生成图片；未改生产源码（三维实现项不适用）；没有新交互三维交付或公网验收声明；源端证据与本轮核查边界如上。公网、手机实机和用户视觉验收不降级。只向获准协调分支追加本文件。
