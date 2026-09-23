# Stone Money Island / Survival Palau R19
# 小妈验证包 R03：22 条数据线完整进入靠谱核心语义

日期：2026-09-23  
状态：`VALIDATION_REQUESTED_NOT_APPROVED`  
生产分支：`work/palau-airai-r19-authority-locked-restart-20260922`  
Draft PR：`#136`  
小妈 Judgment：`#138`  
R03 执行：`#145`

## 1. 为什么在 R02 后继续纠偏

R02 已经建立一个世界、一个时间契约、一个 OceanSurfaceState、显式有效期和 Unknown/NoData 门，但 R02 的谱页验证仍主要检查执行顺序：

```text
Time -> Identity -> Truth/State -> Strategy -> Precision -> Query -> Function -> Evidence
```

小妈 `KAOPU_FORMAT_DECISION_R1` 还要求每一条可长期保存的数据线进入完整靠谱核心：

```text
Identity
+ Space/Frame
+ Time
+ Scale
+ Quantity/State
+ Relation
+ Observation
+ Claim
+ Provenance
+ Uncertainty
+ Change
+ View
```

R03 因此没有继续做波或三维，而是先把所有现有字段逐条补全为可追溯谱页。

## 2. R03 已登记的 22 条数据线

1. 完整 Palau 用户总图观察；
2. Airai 黄色故事 AOI 用户观察；
3. 黄色 AOI 地理配准候选；
4. EGM96 Palau DEM；
5. NOAA COALNE / LNDARE；
6. CoastBoundary 候选；
7. NOAA SOUNDG；
8. NOAA DEPCNT / DEPARE；
9. NOAA M_QUAL / SBDARE / UWTROC / OBSTRN；
10. Allen 礁盘地貌与底栖语义；
11. GMRT 区域背景；
12. 黄色 AOI 连续水深候选；
13. Malakal 区域天文潮候选；
14. Airai local tide transfer 缺口；
15. 1944 non-tidal residual 缺口；
16. OceanSurfaceState；
17. WaterSurfaceOptics；
18. WaterVolumeOptics；
19. OceanEnvironmentAdapter；
20. InstantaneousFreeSurface；
21. WorldWaterDepth；
22. WorldWetDryState。

## 3. 重要的时间纠偏

R03 明确拆开：

- Observation 发生或形成的时间；
- Observation 描述的时间；
- 数据处理和重建创建时间；
- 1944 故事世界的应用目标时间；
- 字段自身的有效时间。

因此：

- 用户发来的现代卫星地图截图不是 1944 年观察；
- 2025 NOAA ENC 不是 1944 精确岸线或水深；
- Allen 和 GMRT 保留自己的产品时代；
- DEM 用于 1944 宏观地形只是一项候选时间转移，不是历史测量；
- Malakal 现代站点资料可以支持 1944 天文潮候选方法，但不自动成为 Airai 的 1944 局部潮位。

## 4. Observation 与 Claim 已分离

每条 Observation 只记录：

- 观察或资产是什么；
- 来源资产 ID；
- 观察/代表时间；
- 能力与限制。

它不能直接携带“世界一定是什么样”的断言。

每条 Claim 独立记录：

- 断言的属性；
- `SUPPORTED / CONTESTED / UNKNOWN / REJECTED / NOT_APPLICABLE`；
- 支持和反对 Observation ID；
- epistemic state。

测试会拒绝：

- Observation 内出现 asserted world value；
- Claim 引用不存在的 Observation；
- Claim 携带原始文件哈希或 raw payload。

## 5. Source Asset 与 World Object 已分离

原始 JPEG、GeoTIFF、NOAA ENC、Allen 和 GMRT 是 Evidence Asset；DEM 场、CoastBoundary、Tide、OceanSurfaceState、WaterDepth 等是世界字段或过程候选。

同一文件被复制多次不会增加独立证据。R03 为每个 source asset 记录 `independenceRoot`，并验证：

```text
copy count != independent observation count
```

例如：

- F0130 与 F0140 属于同一 ASF/SRTM 产品家族根；
- SOUNDG、DEPARE、M_QUAL 等可能共享同一 NOAA ENC hydrographic root；
- Allen geomorphic 和 benthic 可能共享遥感影像/模型偏差；
- 一个 derived view 不会创造新的独立 Observation。

## 6. 不确定度已经落实到属性

R03 禁止只给对象一个总 confidence score。每条谱页必须具有 `uncertainty.byProperty`。

例：

- 用户黄色区域身份：Known；
- 黄色圈精确边缘：Unknown；
- AOI 候选中心方法离散：Known；
- 1944 岸线：Unknown；
- DEM 原生 12.5 m 真值：ObservedAbsent；
- 洞穴/悬垂：NotObserved；
- 水深候选 NoData：NoData；
- DEPARE 与插值面不一致：Conflict；
- Airai local tide transfer：Unknown。

Unknown、NotObserved、ObservedAbsent、NotApplicable、NoData 和 Conflict 不再混成一个空值。

## 7. Current Best View 不覆盖证据

每条谱页允许形成 View，但必须：

```text
recomputable=true
overwritesEvidence=false
canonicalTruth=false
```

Ledger 级 Current Best View 还必须：

```text
overwritesConflict=false
```

因此未来三维工作台只是对同一世界总谱的一次 Conduct/View，不得修改或替换底层 Observation、Claim 和冲突。

## 8. 实际验证与失败闭环

### 首次 R03 CI

```text
run 35800619086
job 106989881985
conclusion=failure
```

失败原因：validator helper 为了输出 JSON，错误地通过 JSON serialization 复制了内部 `Set`，导致 referential check 的 `observationIds.has` 不存在。

这是验证器实现缺陷，不是谱页语义失败。失败已公开保留。

### 修正

```text
loader commit d0050aae347c5a1057236d87265e23e485219809
validator commit 268dc5c18fbb612c0075c30bb6693f54b11ff04c
```

修正只保留验证器内部 Set；没有降低任何语义门或证据门。

### 修正后通过

```text
Palau R19 KAOPU Core R03
run 35800759464
job 106990319188
conclusion=success

R01 unified-field regression
run 35800759320
job 106990318724
conclusion=success

R19 authority gate
run 35800759331
job 106990318696
conclusion=success
```

R03 还通过了这些对抗测试：

- 缺少 property-level uncertainty：拒绝；
- Claim 引用不存在的 Observation：拒绝；
- Unknown 字段携带数字 0：拒绝；
- copy 数量虚增 independent roots：拒绝；
- View 覆盖 Evidence 或 Conflict：拒绝；
- Observation 混入 Claim：拒绝；
- Claim 混入 raw source hash：拒绝。

## 9. 请小妈判断

### A. 22 条数据线是否已经满足靠谱最小核

请检查是否还有字段缺少：

- Parent；
- Change/Event；
- relation scope；
- valid range；
- Observation capability；
- Claim opposition；
- shared bias；
- quantity kind / unit / datum；
- recovery path。

### B. 现代证据到 1944 世界的时间语义是否正确

当前不把现代资料冒充历史 Observation，只把它们作为候选时间转移输入。请判断是否还需建立独立 `TemporalTransfer` 谱页，而不能只写在 uncertainty 和 time roles 中。

### C. 是否允许进入真实数据波表达实验

进入下一步前仍要求：

1. 小妈 Judgment；
2. 波表达只读取已验证 source field；
3. 每个 basis/band 有来源、空间、时间、datum；
4. 回解 RMSE、最大误差、覆盖率与 residual；
5. NoData 和 Conflict 原样保留；
6. 波表达不得获得源 Observation 身份；
7. Current Best View 可以随时从源场重算。

请返回：

- `PROMOTE_METHOD`
- `CONTINUE_WITH_CORRECTIONS`
- `PARK`
- `REJECT`

## 10. 当前门禁

```text
smallMotherValidation=REQUESTED_NOT_APPROVED
kaopuCoreR03Passed=true
waveDecompositionAdopted=false
visualBuildAllowed=false
interactive3D=false
visualAcceptance=false
productionReady=false
```
