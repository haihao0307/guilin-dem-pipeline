# N148 — Human Skin Fold Causal-State Gate

状态：`Candidate / Human-Skin-local / classification replay only / no production change`

## Bounded question

ET21 R02 是否已经证明可见褶皱由表情造成的局部皮肤压缩/松弛因果驱动，还是只证明了去纹理后仍存在静态几何位移？

## 现有真实失败

用户最新纠正是：皱纹不能只是颜色、法线、凹凸或静态雕刻冒充，必须体现皮肤在收缩/压缩时形成、拉伸时展平。分支 `feature/skin-fold-cinematic-r02-20261013` 的 tested subject 为 source `16248d4d24eea363fe55bd7756e30ef6acd254dd`、build `65c6310d12e4c2667747a7943ba09dfd2629b9f1`；workflow run `38341871199`、artifact `11787177486`、digest `sha256:605d98ae0d3eb5ee457ab6e78a342adffc67df54259e4872ce9f24a1def01ae5`。

现有证据有真实增量：灰模/无纹理 on-off 哈希不同，显示网格 192,459 vertices / 384,424 triangles，loose preset 改动 76,807 display vertices；纹理 wrinkle channel 为零。因此“只是贴色/凹凸纹理”这一替代路径已被当前 subject 拒绝，可记 `SCOPED_GEOMETRIC_FOLD_PROVEN`。

但 README/BUILD 同时明确它是 art-directed geometric buckling，不是非线性皮肤 FEM；`compression` 是艺术控制标量。当前 verify 只比较静态 clay on/off 与控制滑杆的像素差，没有在同一 subject、同一材质/相机/灯光下绑定 rest/compressed/stretched 表情状态、局部应变测量、正确区域响应以及返回 rest 的恢复误差。因此不能把“真实几何”升级成“局部压缩因果驱动”。当前状态为 `SCOPED_GEOMETRIC_FOLD_PROVEN__HOLD_FOLD_DRIVER_IDENTITY_UNBOUND`。

## 外部方法 / 证据

Disney Research Studios 2024 的 *Fast Dynamic Facial Wrinkles* 给出可反驳的方向性语义：仅处理与应力轴垂直的皱纹；拉伸时更宽更浅，压缩时更窄更深，并提供逐帧高质量路径与按拉伸方向分桶的预计算位移图近似。

它比当前 CBV 多知道的明确内容不是“用位移图做皱纹”，而是把 wrinkle response 与 stress direction、stretch/compression state 和宽/深单调关系绑定。该方法页面/论文可读且有对照，但本轮未发现可运行代码、测试、数据、明确软件 license 或 KAOPU 可直接复现包，因此 teacher 状态为 `UNKNOWN`，不进入 Registry/AUDITION；只采用其可检验的响应语义作为候选门禁灵感。

## 与当前制度比较

R2、reference gate 与 freshness gate 已覆盖 tested-subject、禁止 creative substitute、真实来源和交付新鲜度；现有 ET21 证据也已覆盖 texture-free geometry。缺口是“原因—局部测量—状态响应—恢复”的链式证据，现有回归没有去重同类 case。

## 可反驳假设与最小回放

假设：如果 fold 的确由局部压缩驱动，则在同一 exact subject 上，适用区域的 measured in-plane compression 上升时 fold 应更深/更窄，stretch/tension 时应更浅/更宽；错误区域不得同步响应，返回 rest 后必须在 Mother 预先声明的误差内恢复。任何一环缺失只能保留 scoped geometry，不得声称 causal skin fold。

新增 `HUMAN-SKIN-FOLD-CAUSAL-STATE-001` Candidate，八类 fixture 覆盖：subject 未绑定、纹理替代、当前静态几何、无局部应变、跨状态不响应、错误区域响应、rest 不恢复、完整因果通过。隔离 Node 分类回放 8/8；这只验证状态语义，不是生产浏览器/设备/物理 gate。

## 适用边界与决定

只适用于宣称“由表情/压缩产生”的 Human Skin folds；不否定 art-directed static fold 作为 scoped visual geometry，也不要求现阶段实现 FEM。阈值由 Human Skin Mother 在试验前声明；学习飞轮不替代实现、不修改生产分支、不降低 R2。

决定：保留 `Candidate`，定向给 Human Skin Mother 做单 Mother 最小试验。`POSTED=false`（写入时）；`CLASSIFICATION-GATE-RUN=true (8/8)`；`ACKNOWLEDGED / IMPLEMENTED / HUMAN-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

效果指标：首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、stale delivery 次数、accepted delta 内部迭代数与指令到合法 candidate 时间均为 `unknown`。
