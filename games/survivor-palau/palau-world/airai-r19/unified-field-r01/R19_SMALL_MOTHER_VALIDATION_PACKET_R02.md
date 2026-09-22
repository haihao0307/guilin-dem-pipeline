# Stone Money Island / Survival Palau R19
# 小妈验证包 R02：统一场有效时间、单一 OceanSurfaceState 与分层边界

日期：2026-09-23  
状态：`VALIDATION_REQUESTED_NOT_APPROVED`  
生产分支：`work/palau-airai-r19-authority-locked-restart-20260922`  
Draft PR：`#136`  
小妈验证入口：`#138`  
内部纠偏：`#140`  
R02 执行跟踪：`#142`

## 1. 本轮不是三维生产

R02 只修正统一场的共同语义、查询契约和错误拒绝门：

- 没有生成新地图；
- 没有生成三维地形；
- 没有冻结黄色故事区最终坐标；
- 没有生成真实数据波系数；
- 没有把 Unknown 或 NoData 填成零；
- 没有把航海图测深基准偷偷转换为 EGM96 或 MSL；
- 没有修改已冻结的 Ocean Mother 主波。

## 2. R01 自查发现的两个真实缺口

### 2.1 标量 `waveDisplacement` 不足以成为唯一海面

R01 只检查了一个垂直波位移标量。小妈 `OCEAN_COAST_ADAPTER_R1` 明确要求可见波面、水位、法线、速度、浮力和接触查询来自同一个参数化自由表面：

```text
X(q,t) = (q.x + dx(q,t), eta(q,t), q.z + dz(q,t))
```

因此 R02 将 Ocean 自由表面固定为一个 typed `OceanSurfaceState`：

```text
surfaceStateId
parameterCoord = [q.x, q.z]
horizontalDisplacement = [dx, dz]
eta
normal
surfaceVelocity
representedTime / validTime
spaceFrame
verticalReference
source / evidence / adoptionState
```

任何法线、速度或接触消费者都不得从第二套波函数重新推导另一张海面。

### 2.2 所有时间戳逐字相等会错误拒绝静态地形

R01 要求海面和海床 `representedTime` 完全相等。这会错误拒绝“在 1944 年 10 月有效的静态地形”与某一瞬时时刻海面的合法组合。

R02 增加显式有效期：

```text
validTime.kind = instant | interval | timeless
```

规则：

- 瞬时 OceanSurfaceState 只能在同一查询时刻使用；
- 静态 DEM/海床只有在查询时刻位于其有效区间内时才能参与计算；
- 查询超出有效区间时返回 `CONFLICT`，不静默沿用；
- 没有 `representedTime` 或 `validTime` 的样本为非法输入。

## 3. 未知分量不再只返回模糊失败

R02 新增 `PARTIAL` 状态，用于显示已知分量和仍未解决的分量：

```text
freeSurface evidence
= known(referenceLevel + regionalTide + waveEta + ...)
+ unresolved(Airai local transfer, 1944 non-tidal residual, ...)
```

`PARTIAL` 的含义：

- 可以审查已知分量；
- 明确列出 unresolved components；
- `finalSurfaceAvailable=false`；
- 不允许继续计算最终水深、湿干状态、浮力或碰撞；
- 未知分量不被替换成零。

## 4. Ocean / Coast 五层已分离

R02 注册并验证五个独立身份：

1. `OCEAN_SURFACE_STATE`
   - 唯一自由表面几何权威；
   - 拥有 eta、dx、dz、normal、surfaceVelocity；
2. `WATER_SURFACE_OPTICS`
   - 只读法线、太阳、天空、粗糙度与泡沫；
   - 无权写海面几何、海床或潮位；
3. `WATER_VOLUME_OPTICS`
   - 只读水面交点、光程、介质和海床；
   - 无权写自由表面或海床；
4. `OCEAN_ENVIRONMENT_ADAPTER`
   - 只读 Weather 的太阳、天空、风和降水；
   - 无权直接写波高、法线或水材质；
5. `COAST_BOUNDARY`
   - 提供固体、边界法线、海床坡度和流出边界；
   - 无权创建第二套波或第二套潮位。

测试会拒绝 optics 或 environment adapter 获得写海面几何的能力。

## 5. R02 World Score 谱页

R02 将一个世界下的数据线扩展为独立 typed pages，包括：

- 完整 Palau 用户权威图；
- 黄色 Stone Money 故事 AOI 用户权威图；
- EGM96 正高 DEM；
- CoastBoundary；
- NOAA SOUNDG；
- NOAA DEPCNT / DEPARE；
- NOAA M_QUAL / SBDARE / UWTROC / OBSTRN；
- Allen 礁盘地貌与底栖语义；
- GMRT 区域背景；
- Malakal 区域天文潮候选；
- Airai local tide transfer（Unknown）；
- 1944 non-tidal residual（Unknown）；
- OceanSurfaceState；
- WaterSurfaceOptics；
- WaterVolumeOptics；
- OceanEnvironmentAdapter；
- InstantaneousFreeSurface；
- WorldWaterDepth；
- WorldWetDryState。

它们共用一个 World ID 和一个 Observation Request 体系，但不互相覆盖类型、来源、基准和不确定度。

## 6. 实际测试与失败闭环

### 6.1 首次 R02 CI 失败

首次运行：

```text
run 35799792493
job 106987283210
conclusion=failure
```

唯一失败是测试代码使用严格十进制相等：

```text
expected 2.97
actual   2.9699999999999998
```

这属于浮点测试断言缺陷，不是统一场模型缺陷。失败没有隐藏，已写入执行回执。

### 6.2 修正

提交：

```text
250c5b3bb58019e9908119ebe96f708fb193710c
```

将派生浮点值改为显式有限容差检查，没有降低任何物理、基准、NoData 或证据门槛。

### 6.3 修正后全部通过

```text
Palau R19 unified field R02
run 35799870613
job 106987528775
conclusion=success
```

步骤：

```text
R02 typed Ocean surface and valid-time tests: PASS
R02 World Score registry and layer separation: PASS
No visible-production artifacts: PASS
```

同时：

```text
R19 authority-gate
run 35799870379
job 106987528020
conclusion=success

R01 unified-field regression
run 35799870381
job 106987528262
conclusion=success
```

## 7. R02 已证明的内容

1. 静态地形可在明确有效期内与瞬时海面组合；
2. 超出地形有效期的查询被拒绝；
3. Airai 局部潮位与 1944 非潮残差未知时返回 `PARTIAL`，不填零；
4. 一个 OceanSurfaceState 同时拥有 eta、dx、dz、normal、surfaceVelocity；
5. 非单位法线无法进入渲染、接触或浮力消费者；
6. NOAA 本地测深基准与 EGM96 在没有桥接时不能混算；
7. optics、volume、environment、coast boundary 不得写自由表面几何；
8. R01 回归仍通过；
9. R02 包没有 HTML、GLB、PNG、JPEG 或 TIFF 可见生产成果。

## 8. R02 没有证明的内容

- 小妈批准；
- 黄色故事 AOI 最终地理配准；
- Airai local tide transfer；
- 1944 风、气压、风暴增水与波浪 setup/runup；
- NOAA local datum code 24 到 EGM96/MSL 的可靠转换；
- Ocean Mother 真实适配器已经接入；
- 真实 DEM/岸线/海床的波系数；
- 可交互三维工作台；
- 视觉验收或生产可用。

## 9. 本轮请求小妈 Judgment

请依据 World Kernel、World Score、世界大合唱闭环和 Ocean/Coast Adapter 判断：

### A. `validTime` 是否足以表达静态地形、版本化地图和瞬时过程

如不足，请指出还需增加事件时间、采集时间、创建时间或历史有效区间中的哪一层。

### B. `PARTIAL` 是否是正确的未知分量表达

当前禁止用 known partial sum 继续计算最终水深和湿干状态。请判断这一停止条件是否正确。

### C. 一个 OceanSurfaceState 是否已满足同源海面最低门槛

当前同一 identity 提供 eta、dx、dz、normal、surfaceVelocity 和 q。请判断还必须增加哪些量，例如 surface acceleration、Jacobian、inverse q lookup、breaker、curvature 或 uncertainty。

### D. 五层分离是否正确

请判断 OceanSurfaceState、WaterSurfaceOptics、WaterVolumeOptics、OceanEnvironmentAdapter、CoastBoundary 的职责是否完整，是否存在越权或遗漏。

### E. 是否允许进入下一步“真实数据波表达实验”

若允许，建议 Judgment：

```text
PROMOTE_METHOD
```

若需要修正，建议：

```text
CONTINUE_WITH_CORRECTIONS
```

并明确列出必须修正的字段、关系和测试。证据不足则 `PARK`；语义错误则 `REJECT`。

## 10. 当前门禁

```text
smallMotherValidation=REQUESTED_NOT_APPROVED
r02ContractTestsPassed=true
r02RegistryValidationPassed=true
authorityGatePassed=true
waveDecompositionAdopted=false
visualBuildAllowed=false
interactive3D=false
visualAcceptance=false
productionReady=false
```
