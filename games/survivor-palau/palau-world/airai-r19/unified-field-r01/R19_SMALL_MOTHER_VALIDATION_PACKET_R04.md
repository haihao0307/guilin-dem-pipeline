# Stone Money Island / Survival Palau R19
# 小妈验证包 R04：空间、垂直基准、时间、潮位与造波转换图

日期：2026-09-23  
状态：`VALIDATION_REQUESTED_NOT_APPROVED`  
生产分支：`work/palau-airai-r19-authority-locked-restart-20260922`  
Draft PR：`#136`  
小妈 Judgment：`#138`  
R04 执行：`#146`

## 1. 为什么在 R03 后继续做 R04

R03 已经把 22 条数据线逐条写成完整靠谱核心：

```text
Identity + Space/Frame + Time + Scale + Quantity/State
+ Relation + Observation + Claim + Provenance
+ Uncertainty + Change + View
```

但只记录“有关联”还不够。系统还必须明确回答：

- 哪两个空间参考系之间已经能转换？
- 哪两个垂直基准之间已经有可靠桥梁？
- 现代资料能不能进入 1944 世界？
- 区域潮位能不能变成 Airai 局部潮位？
- 原始场能不能转换成波表达？
- 哪些转换已验证，哪些只是候选，哪些必须阻断？

R04 因此建立一张可执行 Transfer Graph；Canonical 查询只能沿已验证边运行，不能因为“存在一条看起来合理的关系”就生成数值。

## 2. 图的基本规则

节点分为：

- `spatial_frame`
- `vertical_reference`
- `time_state`
- `semantic_identity`
- `observed_state`
- `process_state`
- `representation`

边分为：

- `spatial_transform`
- `vertical_datum_transform`
- `temporal_transfer`
- `semantic_binding`
- `state_transfer`
- `process_transfer`
- `representation_transform`
- `component_relation`

边状态严格区分：

```text
VERIFIED
VERIFIED_SCOPED
CANDIDATE
BLOCKED
REJECTED
```

Canonical traversal 只允许：

```text
VERIFIED + VERIFIED_SCOPED
```

其中 `VERIFIED_SCOPED` 还必须满足来源哈希、站点身份、地区范围或 Context。反向转换不自动存在，必须单独登记和验证。

## 3. Verified 边的最低条件

任何 Verified 边必须同时具有：

1. 明确 operation；
2. operation 必须 deterministic；
3. 非空 Evidence；
4. validRange；
5. 通过的测试和 receipt；
6. `applied=true`；
7. Scoped 边还必须有 scope。

Candidate、Blocked 或 Rejected 边：

- 无权参与 Canonical traversal；
- 无权提供默认值；
- 无权带一个可执行 operation 冒充已经放行；
- 必须记录 reason；
- Candidate 必须记录 approvalGate；
- `applied=false`。

## 4. 当前 30 个节点与 21 条边

R04 当前包含 30 个 typed nodes 和 21 条 typed edges。

### 4.1 已验证路径

#### 用户 Airai 图像像素 → 完整 Palau 图像像素

```text
USER_AIRAI_ZOOM_PIXEL_FRAME
  -- VERIFIED RANSAC homography -->
USER_COMPLETE_PALAU_PIXEL_FRAME
```

证据：

- 两张用户图 exact SHA-256；
- 207 个有效匹配；
- 178 个 RANSAC 内点；
- 0.4575 px 内点 RMSE。

这只证明两张图之间的像素关系，不证明经纬度。

#### 用户黄色区域 → Stone Money 故事语义身份

```text
USER_AIRAI_ZOOM_PIXEL_FRAME
  -- VERIFIED user semantic binding -->
STORY_CORE_SEMANTIC
```

它只绑定“黄色圈是完整故事区域，而不是一个点”，不生成地理坐标。

#### WGS84 ↔ UTM 53N

作为标准 CRS 转换登记为 scoped verified。只有 Palau 地区 Context 下允许进入 Canonical path。

#### ASF RTC 椭球高 → EGM96 正高

```text
H_EGM96 = h_ASF_RTC - N_EGM96
```

只允许两个 exact DEM source SHA-256；没有来源哈希时不能运行。

#### Malakal-B station datum → Malakal-B MSL

只在 `stationId=MALAKAL_B` 范围内有效。它不能自动推广到 Airai，也不能用于 NOAA ENC local datum code 24。

## 5. 当前明确未解决的路径

### 5.1 用户图像 → 最终 WGS84 AOI

黄色图 → 完整图已经 Verified；完整图 → WGS84 仍为 Candidate，因此完整路径不能 Canonical traversal。

### 5.2 NOAA local datum code 24 → EGM96 / Malakal MSL

两条路径都为 Blocked：没有可靠的偏移、网格或水动力/大地测量转换。禁止猜一个常数。

### 5.3 Malakal MSL → Airai local water reference

Blocked。站点平均海平面不能因为距离接近就直接变成 Airai 礁盘和泻湖的本地参考。

### 5.4 现代资料 → 1944 状态

以下均明确 Blocked：

- 用户现代地图影像 → 1944 精确物理状态；
- 现代 NOAA ENC → 1944 精确岸线或海床；
- Allen 现代礁盘分类 → 1944 礁盘状态；
- GMRT compiled product → 1944 局部海床。

现代资料可以约束候选，但必须通过独立 TemporalTransfer 谱和 Evidence 才能进入历史世界。

### 5.5 Malakal regional tide → Airai local tide

Blocked。需要 Airai 本地观测、经过验证的转移函数或水动力模型。

### 5.6 DEM / Bathymetry → 波表达

两条边都只是 Candidate：

- canonical DEM → Palau DEM wave basis；
- AOI bathymetry candidate → bathy wave basis。

没有小妈 Judgment、真实系数、回解 RMSE、最大误差、覆盖率、NoData 和 residual receipt 以前，不得应用。

### 5.7 OceanSurfaceState → 最终自由水面

仍为 Candidate。OceanSurfaceState 是必要分量，但 Airai local tide、1944 non-tidal residual 和共同水位 datum 未解决，因此不能生成最终 free surface。

## 6. 运行时查询行为

`findVerifiedPath` 只看 Verified 边。

`resolveCanonicalTransfer` 如果发现一条声明过但未验证的路线，只返回：

```text
UNRESOLVED_TRANSFER
+ candidate / blocked / scope mismatch edge
+ reason
+ approval gate
```

它不会：

- 自动选择候选边；
- 把 blocked edge 当恒等转换；
- 用 0 填补偏移；
- 暗中推断反向转换；
- 因为两节点距离近就建立桥梁。

## 7. 实际 CI 与失败闭环

### 首次 R04 运行

```text
run 35801350100
job 106992161685
conclusion=failure
```

失败原因不是 Transfer Graph 模型失败，而是一个对抗测试的期望顺序错误：测试把 Candidate 只改成 `VERIFIED`，却没有先补全 verified edge 所需的 `validRange/tests/applied`，所以 validator 正确地先返回 `MISSING_KEYS`，而测试期待 `VERIFIED_OPERATION`。

### 修正

提交：

```text
1c2ccb811c157fcd0edb0602e9544c1751b590be
```

修正后的 fixture 先补全 verified contract 的其他字段，只故意留下 `operation=null`，从而准确测试 `VERIFIED_OPERATION` 门。没有放松任何门槛。

### 修正后通过

```text
Palau R19 transfer graph R04
run 35801403720
job 106992333757
conclusion=success

R01 unified-field regression
run 35801403732
job 106992333852
conclusion=success

R19 authority gate
run 35801403746
job 106992333835
conclusion=success
```

## 8. 对抗门

R04 会拒绝：

- blocked edge 携带 `defaultValue=0`；
- verified edge 没有 evidence；
- verified edge 没有 passing receipt；
- candidate edge 被标记为 applied；
- candidate edge 暴露可执行 operation；
- blocked datum bridge 获得猜测 operation；
- candidate 直接改 status 而不满足完整 verified contract；
- edge 指向不存在节点；
- 重复节点；
- 隐式反向转换；
- scope 不匹配时运行 verified-scoped edge；
- candidate 图像配准边进入 Canonical path。

## 9. 请求小妈 Judgment

请重点判断：

### A. Transfer Graph 是否应成为谱页之间唯一合法转换入口

当前任何空间、基准、时间、过程或表示转换，都必须经过有状态、有证据、有 valid range 的边。请判断是否还需区分 `calibration / assimilation / temporal persistence / reconstruction` 等 edge kind。

### B. VERIFIED_SCOPED 是否足够表达局部有效规律

例如：

- Malakal-B station datum → Malakal-B MSL；
- 两个 exact ASF DEM hash → EGM96；
- Palau 地区的 EPSG 转换。

请判断 scope 是否还必须包含软件版本、算法版本、时间有效期和 uncertainty propagation。

### C. 现代 → 1944 是否必须建立独立 TemporalTransfer 谱页

R04 目前将这些边 Blocked，等待历史证据或模型。请判断下一阶段是否应先建立：

```text
SourceTimeState
+ ChangeEvents
+ PersistenceAssumption
+ CounterEvidence
+ OutputHistoricalCandidate
+ Uncertainty
```

再允许任何现代数据进入 1944 View。

### D. 是否允许开始第一轮真实 DEM 波表达

如果小妈认为 R02/R03/R04 已经形成足够的防错闭环，请返回：

```text
PROMOTE_METHOD
```

并限定只允许第一轮 DEM 波表达实验，不自动放行 bathymetry、潮位或三维。

如果仍有缺口，请返回：

```text
CONTINUE_WITH_CORRECTIONS
```

并列出必须新增的 node、edge、scope、uncertainty propagation 或 tests。

证据不足时 `PARK`；结构错误时 `REJECT`。

## 10. 当前门禁

```text
smallMotherValidation=REQUESTED_NOT_APPROVED
transferGraphValidated=true
verifiedOnlyCanonicalTraversal=true
waveDecompositionAdopted=false
visualBuildAllowed=false
interactive3D=false
visualAcceptance=false
productionReady=false
```
