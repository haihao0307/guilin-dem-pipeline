# Mother 02:30 Coordination — Skin R02.1 图形能力预算 → Human R06

- ID: `KAOPU-MOTHER-20261014-KX01`
- 实际开始：2026-10-14 02:36:09 +08:00
- 实际收束：2026-10-14 02:38:41 +08:00
- 主持：小妈协调端
- 真实 Mother 参与：0。两条定向留言已写入并回读；截至收束没有 ACK。写入成功不等于理解、执行或采用。
- 生产修改：0；main / gh-pages / 生产分支 / 冻结成果 / 排程 / 学习飞轮修改：0。

## 会前读取与去重

已读取 `main@7ed6ce55684965026188e06436ac91525526e762` 的根 `AGENTS.md`、R2 Production OS、Reference Replication Gate、Freshness Gate，以及 #91/#63 当前评论、PR #265/#267 的 Delivery/README、changed files、测试与已知边界。

- #91 最新为 N148 Human Skin “几何褶皱存在不等于压缩因果已证”问题包，仍仅 `POSTED`；本轮不重复处理其褶皱因果。
- #63 最新仍为 Coast R03 公网运行失败/subject 变化后证据不可继承；与今日程序资源预算相关但不是同一根因，不能拿 “WebGL context unavailable” 代替 sampler/link 诊断。
- 2026-10-11 Hair→Denim、10-12 Denim→Tailor、10-13 EAR→Lip 均未见接收端 ACK；不重复发送。
- 用户最新统一交付要求继续生效：最终应有外部浏览器可直接打开的清晰网页链接并核验真实渲染、关键交互和版本；390×844 视口不得冒充物理手机。今天不发布任何新网页。

## 今日唯一问题

> Skin R02.1 已实证“高预算软件后端通过，仍可能在低预算浏览器后端因着色器资源超限而黑屏”。这个方法能否有限迁移到共享人物/材质载体的 Human R06，而不把 R02.1 的具体修复和数字机械照搬？

## R2 任务核对

| 项目 | Skin R02.1（方法源） | Human R06 C3（接收端） |
|---|---|---|
| taskId / object / defect | Skin R02.1；同一人物皮肤/眼材质；旧 R02 片元采样器 18 超过后端上限 16，程序链接失败黑屏 | `KAOPU-XFER-20261014-SKIN-R021-TO-HUMAN-R06`；R06 最终运行着色器；现有验收未绑定低预算后端逐程序 sampler/link 结果 |
| accepted baseline / baseSha | R02 原人物与皮肤规则；R02.1 source `c1498c0255bd2f065a61e1268c7db5cd035942d0` | 用户 R05 `475ead2759159b83927a1aa8ae6879595e1d18bc`；PR base `9b6644b3210e5ee5f9b4e7fbb583dec98e90b285` |
| fresh exact subject | build `7aec131ba448f5cfa25a7d2edcbad07243340042`；tested public snapshot `7c406b142ac5732c999a87797251e38697b31f17`；head `5fa10e2270abc607c937e50cb90464f98ff23735` | source `8d26fa8b45a0f5285f9ccf4fe53b255572912938`；build `f5017cb7cb9c2024df6a08328564c3f4ae502509`；evidence `eb8680dd8793d4b9bbcaf04b3e5429f9c763903d`；head `68b26263c5c09ab0aa0782c48e895b23e59fb230` |
| 用户最后约束 | 修复黑屏但不删人物/眼/肤质/BioSkin/耳唇/EB1，不把兼容修复冒充影视皮肤提升 | 保留同一人物、R06 C3 24项形体、原眼耳唇皮肤灯光、R05 A/B；用户视觉未接受 |
| referenceSet / UNKNOWN | Windows Chrome154 / ANGLE D3D11 WARP 对照、四份最终报告；用户物理 GPU、Safari/手机及全设备兼容 UNKNOWN | 86项 SwiftShader/公网检查、32张运行证据、R06 Delivery；16-unit 后端逐程序 sampler/link、消费 GPU、物理手机 UNKNOWN |
| forbidden routes | 删除功能换预算、换人/换头、关闭严格像素检查、把 WARP 冒充用户 GPU | 删除眼/皮肤功能、换对象、降低形体/材质目标、照搬 15/18 数字、把 SwiftShader 通过外推所有浏览器 |
| shared / different | 共享 `ContinuityMaterial.adapted.mjs` blob `53e632ad1f2179f430f411fe688fc8ec21d5ba95` | `RegionalSkin.mjs` 与 `UnifiedViewer.mjs` 不同，故必须测 R06 自己最终程序 |
| applicable regression / gates | Windows installed Chrome、Linux、DPR 证据已跑；black-frame root cause 实证 | Contract/Freshness/公网/86项 scoped pass；未见 16-unit capability-budget gate；#63 N49 不能替代这一诊断 |
| 当前状态 | `CANDIDATE_READY`，仅限黑屏兼容修复；`userVisualAccepted=false` | `HOLD_GATE_FAIL`，仅限 capability-budget 身份未绑定；不否定现有形体/公网 scoped 成果 |

## 有限方法

方法不是“所有工作台必须少于 16 个纹理”，而是：

1. 兼容性声明必须绑定 **最终程序 + 实际后端 + 资源上限**，而不是只绑定浏览器名字或一张正常截图。
2. 对 viewer 中每个活动程序记录 `LINK_STATUS`、active fragment samplers、`MAX_TEXTURE_IMAGE_UNITS`、driver、context-lost 和首帧像素范围。
3. 高预算后端通过只能证明该后端；不能替低预算后端，也不能替用户物理 GPU。
4. 若超限，先改变数据组织且逐字节/逐像素核对语义保留；禁止直接删材质功能来换通过。
5. 网络失败、图形链接失败、截图工具失败、视觉质量必须分开记账。

这不是新的全局强制格式。今天只在共享人物/材质载体的 Human R06 上做一次定向试验；通过后仍需独立 verifier，才考虑形成 regression case。

## 决定与责任端

`KX-20261014-01 = POSTED_CANDIDATE_METHOD`。

- 责任端：Human Mother / R06。
- Skin Mother 只提供实证方法与边界，不替 Human 实现或批准。
- R06 形体任务、fixed build 与既有证据不变；当前没有新生产 artifact。

已写入并回读：

- [Human R06 接收说明](https://github.com/haihao0307/guilin-dem-pipeline/pull/265#issuecomment-6152556329)
- [Skin R02.1 边界回流](https://github.com/haihao0307/guilin-dem-pipeline/pull/267#issuecomment-6152556588)

截至收束：`POSTED=true`；`ACKNOWLEDGED / TRANSFER-IMPLEMENTED / 16-UNIT-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

## 最小可证伪验证

锁定 R06 exact build `f5017cb...`、同一人物、形体、相机、灯光与材质：

1. 保留当前 SwiftShader run 作为对照，不重算为新生产。
2. 新增一次实际 16-fragment-unit 后端运行。
3. 遍历最终 viewer 的所有活动程序，保存 driver、上限、`LINK_STATUS`、sampler 数、首帧像素范围、context-lost 与一次关键交互。
4. 桌面与 390×844 分列；390×844 仍不是物理手机。
5. 若 16-unit 后端链接/首帧失败而当前 86 项仍通过，则证明旧验收覆盖不足；若所有程序均通过，则只解除本项 HOLD，不宣布全设备兼容。
6. 若为通过而删除功能或改变人物/画面，本试验自动失败。

## 未完成边界

没有 Human 新运行、没有 16-unit 结果、没有接收 ACK、没有独立 verifier、没有采用或用户验收。Skin 的 18→15 是其自身结果，不是 R06 的预测。当前 `gh-pages@ea04961daab261488023a73d2cb1e1516e2e8fb1` 已继续移动，不用于替代两个 immutable build 的身份。

## 交给学习飞轮的唯一问题

怎样定义一个不依赖单一浏览器品牌、又不把某个固定硬件上限写死的 WebGL “程序能力合同”：在 compile/link 后从活动程序自动提取 sampler/varying/uniform 等真实占用，并把设备上限、驱动身份、首帧与关键交互绑定到同一 receipt？需要至少一个低预算通过样本和一个注入超限反例，才能考虑晋级为跨 Mother regression case。
