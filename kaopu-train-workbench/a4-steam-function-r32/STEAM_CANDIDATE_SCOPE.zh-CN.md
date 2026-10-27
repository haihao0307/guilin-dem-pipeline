# R31 最小蒸汽接口候选（独立新增）

本目录只有自写解析场、安装适配器和测试。`../r31` 与 `r30` 未被本任务写入；不含官方照片、网格、对象三角或点云几何。没有新增机械时钟，不做 CFD、压力认证、实测尺寸或真实 A4 配汽事件宣称。

## 安装和 API

在原有拓扑、outside-crosshead adapters 之后、材质和 app 初始化之前加载 `steam-path.js`、`steam-path-adapter.js`。自动安装到 `DYNAMIC.steamPathCandidate`；Node 可用 `require('./steam-path-adapter')(SCENE,DYNAMIC,require('./steam-path'),TOPOLOGY_PARAMETERS)`。

- `source` 对应新增 `SCENE.sources.steamPath`。`commonSource` 加进 `D.glsl`，让原宿主各 shader 只组合其有限切孔，不需更改任何原 source。
- `parts/byId`：31 个候选实体；每个有解析 AST、保守 AABB、1-Lipschitz 场界、材料说明。流体域不注册为实体。
- `ports(theta,installation)` / `inspection(theta,installation)`：同一机械快照下的端口、三缸工作腔轴向范围及世界端面、显式断点。中缸位置、端口朝向和端面跟随既有 beta；中阀胸仍固定水平。
- `worldScalar(id,p,theta,installation)`：新增实体 CPU 场；`hostCutScalar(hostId,p,theta,installation)`：开孔域。`domainScalar(id,p,theta,installation)` 只做域查询。
- `graph.edges` 有 `label/state/reason`；connected_candidate 表示已构建候选几何，不表示完整汽流、全部邻接验收或压力密封认证。
- `clipExistingDomain('pr_smokebox_combustion_gas_domain',oldScalar,p,theta,installation)`：在查询旧燃烧烟气域时排除新供汽承压外包络，避免将管内蒸汽误当烟箱燃气。它不改原函数。旧单腔 `pr_smokebox_header_live_steam_lumen` 不应用于候选流路，应用两个新 header 域。

`installation` 必须是既有 D.state/D.snapshot 产生的 candidate 快照，beta 范围仍 .11… .16。Time → D.state → theta → D.pose 是唯一运动链。新增实体固定于当前安装配置；中工作连接随 beta 构型改变，不随阀杆平移。已有材质 waves 按既有 train-local 映射着色，不修改几何或建第二材质时钟。

## 实现范围

1. 保留原集箱壳，在原内腔加有限隔板，明确过热前/后两个不相通的查询容积。上游取汽、主汽管、元件去回路和真实内部孔系未建；保留 9 条显式断边，没有单腔短路。
2. 三支路由已证类别组成：钢管、有限法兰、凸 lens-ring、铸铁缸顶管。所有尺寸和路由是 inferred。钢管用 steel 预设，铸铁管是 documented role + 既有 neutral，环材质未知也用 neutral；没有凭颜色当铜。
3. 每段管用真正相切的圆弧与直线中心曲线解析距离，外内等距域相减，并用端平面裁开。不是尖折线、实心连接标签或封帽管。法兰和管壁只在外径界面接触。每接头补4根有限螺柱、双侧六角螺母和环垫，数量/尺寸均推断；两片法兰分别有4贯通孔，孔杆间隙0.5 mm。lens-ring 仍是有限几何接触模型，螺纹仅名义配合，不声称预紧或加载密封能力已验证。
4. 所有工作通道用既有 neutral 材质预设，称推断工作汽道包络，真实铸造通道外形未证，不认定为实车外接弯钢管。短入口的圆弧半径可小于通道外半径，只用于连续解析域，不作为实际弯管制造工艺。两侧工作通道从原短管补过 20.893 mm 缺口，沿缸外绕到后/前站位 4.372/5.128，再穿实际缸壁。不会把原 4.46/4.90 扫掠区直接当恒常前后腔端口。
5. 中阀胸新增供汽和两工作孔。工作管从胸底绕行；中前管先在 y=1.3 绕过前盖螺柱，到 z=5.12 再回到随 beta 的缸端。没有切螺柱、车架或轴。
6. 新工作管壁减去原缸孔及端盖占用，不侵犯原缸盖。原缸盖不改；内腔只接入缸端侧孔。三缸工作腔从同一 `D.pose` 的活塞平面计算，后腔另排除活塞杆。
7. 新宿主孔严格是 `max(oldField, -declaredCut(p))`，只在 candidate 生效。原 sources、parts 元数据、SCENE.hostCuts 表保持原样。11 个宿主限于集箱壳、烟箱外壳、三个缸壁、四个原工作短管、中阀胸和公共铸件腹板。四个原工作短管只扣除新内腔的局部接口，消除转弯处原短管底角侵入，不改其他短管。不会以‘同固定组’豁免未验证的新零件碰撞。

## 证据和局限

依据本地 `steam-evidence` 的两份只读报告和接口清单。公开证据支持集箱→钢管→lens-ring→三路缸顶铸铁管的类别关系，但不提供这些候选尺寸、真实集箱隔墙、三缸排汽汇合或完整配汽事件。图像不打包。源网址在 `parameters.evidence`。

排汽汇合与前后两喷口分配仍缺失；中排汽孔未补。既有阀头会产生几何遮挡，但不据此输出压力、流量或‘正在真实进汽’。此实现不是一条从锅炉到烟囱已经闭合的汽流。

## 复核

`node test-steam-path.js ../r31` 验证 baseline 519 不变、原 source/parts/host-cut 表不变、候选可见性、材质、分隔容积、端口入腔、三缸同 D.pose、beta 范围、有限样本、保守控制点界、跨 atan ±π 圆弧距离以及独立高密度弧真值。仅为局部 CPU 门槛；全车邻接与真实浏览器由主线另跑。

`node build-steam-gpu-samples.js` 只生成真实 GPU 读回所需的诊断数值，不是 GPU 通过报告，也不是几何点云。逐样本使用其 beta/theta。源码变更后必须重建样本并重新浏览器复核。

## 有限夹持增量与保留记录

`frozen-22-field-candidate/` 保留加五金前的22场源和局部QA快照，不是另一个UI开关。`RECOVERED_FAILURE_WITNESSES.json` 保留已修螺柱冲突和旧工作短管侵腔见证。当前31场增量只在6片新增法兰扣孔、加9个分组五金场；11个旧宿主cut AST、所有通道/查询腔和其余16旧候选实体AST精确不变。`node test-steam-joint-hardware.js` 验证该差分、24孔中心及60五金实心见证。

`node test-steam-lumen-stations.js` 另在21个beta上采样312480个通道点，其中22482个进入缸孔内部；未见在活塞扫掠区提前入孔，最小采样轴向余量6.24 mm。只是有界采样回归，不能冒充穷尽连续证明或整车认证。
