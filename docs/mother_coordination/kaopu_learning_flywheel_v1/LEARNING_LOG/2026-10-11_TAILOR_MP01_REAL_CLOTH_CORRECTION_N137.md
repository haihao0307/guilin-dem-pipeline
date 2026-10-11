# N137 — Tailor MP01 “真实布料”用户纠正回放

- 日期：2026-10-11
- Mother：Tailor
- 类型：技术目标/规格保真；既有制度回归
- Bounded question：MP01 的公网静态材质展示能否继承为用户要求的“真实针织/皮革/牛仔布料版本”？
- 当前结论：不能。公网外观事实保留；“真实布料”目标判定为不合格并 HOLD。
- 状态：`MP01_PUBLIC_APPEARANCE_FIELDS_VERIFIED__REJECTED_AS_REAL_CLOTH_TARGET__HOLD_STRUCTURAL_TEXTILE_THICKNESS_PHYSICS_USER_ACCEPTANCE`

## 1. 现有真实失败

PR [#215](https://github.com/haihao0307/guilin-dem-pipeline/pull/215) 已把 12 套针织、皮革、牛仔外观字段发布到固定公网入口：

- [MP01 K02](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-tailor-workbench/material-products/mp01-ff151f3bf29e/?look=K02)
- 40 张 2048×2048 material maps；
- 原 vertices/index/panels/seams 不变；
- `garmentVerticesChanged=false`；
- `materialPhysicsCalibrated=false`；
- `jointOutfitCollisionCertified=false`；
- `physicalWearAccepted=false`；
- `userVisualAccepted=false`。

其后用户明确纠正：不要再用纸样、无厚度衣形或只换纹理来冒充真实布料；直接制作真实针织、皮革、牛仔版本，远近景都必须保留真实结构与厚度。

失败不是公网断链，而是**测试通过的对象与最新用户目标不同**：MP01 证明外观字段能加载，却没有证明真实纺织结构、厚度或材料物理。

## 2. 外部方法/证据

本轮没有引入新的外部制度方法。R2、`REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE`、`TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE` 已要求：

- 用户纠正优先于旧目标；
- 外观/浏览器/公网/物理/用户验收分层；
- 不得用 creative substitute 代替指定目标；
- 证据必须绑定 exact subject；
- 被拒版本不得静默成为下一版父节点。

因此制度比较为 `NO_NOVELTY`。本轮新增的是用户纠正后的**真实反例、失败机制和去重回归证据**，不是新制度。

## 3. 与 KAOPU 当前制度比较

| 项目 | MP01 已验证 | 最新“真实布料”目标要求 | 裁决 |
|---|---|---|---|
| 公网可达/浏览器运行 | 是 | 必须但不充分 | 保留 |
| 贴图/材质字段字节一致 | 是 | 必须但不充分 | 保留 |
| 原衣形/solver 几何 | 不变 | 不能以纸片/无厚度替代 | 失败 |
| 针织线圈/纱线/孔隙/轮廓结构 | 无完整 receipt | 必须 | HOLD |
| 牛仔经纬/斜纹/缝线/边缘结构 | 无完整 receipt | 必须 | HOLD |
| 皮革厚度/层/边缘/里层结构 | 无完整 receipt | 必须 | HOLD |
| 材料物理 | 未校准 | 声称用途必须 subject-bound | HOLD |
| 用户验收 | false | 必须独立获得 | HOLD |

## 4. 可反驳假设

如果新的 Task Anchor 强制 `targetMode=REAL_CLOTH_STRUCTURE_NOT_APPEARANCE_ONLY`，并要求材料族特定的非零厚度或纱线/线圈/经纬/层结构，以及与 exact subject 绑定的弯曲、拉伸、摩擦、质量/面密度、回弹、碰撞 receipt，那么：

1. 当前 MP01 即使 28/28 公网检查通过，也必须在“真实布料”门禁失败；
2. 合法后继必须从新的结构/物理父节点产生；
3. 后继不得继承 MP01 的公网通过为结构、物理或用户验收。

任何能在相同规则下证明当前 MP01 已具备上述结构和物理 receipt 的证据都可反驳该假设；目前没有这种证据。

## 5. 最小历史回放

回放 12 项，12/12 观察一致：

1. 公网 workflow 成功；
2. 固定公网 URL 存在；
3. 40 张 maps 已验证；
4. 原 vertices/index/panels/seams 不变；
5. `garmentVerticesChanged=false`；
6. `materialPhysicsCalibrated=false`；
7. `jointOutfitCollisionCertified=false`；
8. `physicalWearAccepted=false`；
9. `userVisualAccepted=false`；
10. 针织无完整真实结构 receipt；
11. 牛仔/皮革无完整真实结构 receipt；
12. 最新用户纠正明确拒绝纹理化纸片替代。

回放结果：保留 appearance-only Observation，阻止其被提升为 real-cloth Candidate；预防 1 个 rejected-parent 继承。

## 6. 可执行 Candidate

### Task Anchor

- `targetMode=REAL_CLOTH_STRUCTURE_NOT_APPEARANCE_ONLY`
- `forbiddenParentClaim=MP01_APPEARANCE_ONLY_IS_REAL_CLOTH`
- 针织：可核验纱线/线圈/孔隙/轮廓结构与非零厚度，或验证过的等价体积结构；
- 牛仔：可核验经纬/斜纹、缝线/边缘/磨损结构与非零厚度；
- 皮革：可核验厚度/层、边缘/里层与材料响应；
- physics receipt：对每项声称绑定 bending/stretch/friction/mass-or-areal-density/rebound/collision；
- LOD：远近景均不得把纸片或静态贴图当结构证据；代理表示必须明确标注且不能作为验收依据。

### Verifier gate

Producer 不能自批。Verifier 必须核对：

1. 结构源与 exact candidate 一致；
2. 材料族结构与物理参数真实绑定到 garment；
3. 当前 browser/public receipt 对应同一 exact subject；
4. static PNG/baseColor/normal/roughness/AO 不计作结构证据；
5. 用户验收保持独立。

### 回滚点

保留当前 MP01 固定公网 URL 和报告，作为 appearance-only 且被当前目标否定的基线；不删除、不覆盖，不从它继承 real-cloth acceptance。

## 7. 适用边界

只适用于 Tailor PR #215 与最新真实布料纠正。不否定 MP01 的公网、浏览器、材质 map 或原几何事实；不实现替换资产，不证明物理设备，不把本轮分类当成 Producer/Verifier 或用户验收。

## 8. 是否采用

- 回归用例：更新既有 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`，不新建重复 case。
- 制度变化：`NO_NOVELTY`，不改全局 OS。
- 局部 Candidate：已 POSTED 到 [PR #215 回执](https://github.com/haihao0307/guilin-dem-pipeline/pull/215#issuecomment-6107690124)。
- `POSTED=true`
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- `GATE-RUN=true`（历史回放/分类）
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 9. 指标

- 首次候选通过率：false（MP01 不满足最新真实布料目标）
- 用户纠错次数：1（本轮可证）
- 同类错误复发率：unknown
- rejected lineage 继承阻止数：1
- stale delivery promotion 阻止数：1
- 每个 accepted delta 的内部迭代数：unknown
- 从用户指令到合法 candidate 的时间：unknown（尚无合法 real-cloth candidate）
