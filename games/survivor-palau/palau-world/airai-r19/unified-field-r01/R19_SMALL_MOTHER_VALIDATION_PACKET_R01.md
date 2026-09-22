# Stone Money Island / Survival Palau R19
# 小妈验证包 R01：统一场、潮位、水深与造波表达

日期：2026-09-22  
状态：`VALIDATION_REQUESTED_NOT_APPROVED`  
生产分支：`work/palau-airai-r19-authority-locked-restart-20260922`  
Draft PR：`#136`

## 1. 验证对象

本包不请求小妈批准画面，不请求批准三维资产，也不请求把任何候选升级为 Canonical Truth。

本包只请求验证以下共同方法是否符合 World Kernel / World Score：

1. 完整帕劳、Airai、黄色故事 AOI、DEM、NOAA 岸线、水下观测、Allen 礁盘语义、区域潮位、Airai 局部修正、Ocean Mother 波面是否已经被正确拆成独立但共用同一世界的谱页；
2. 是否正确采用 `Time -> Identity -> Truth/State -> Strategy -> Precision -> Query -> Function -> Evidence`；
3. 是否正确保留 Unknown、NoData、冲突和不同垂直基准；
4. 是否正确限制“造波”为已验证源场的可逆压缩候选，而非替代地理真值；
5. 是否具备未来形成一个三维工作台的共同查询接口，而不产生第二套海面、潮位、岸线或水深。

## 2. 需要读取的文件

- `R19_MOTHER_LEARNING_HOLD_AND_KAOPU_REEXPRESSION_20260922.md`
- `R19_KAOPU_WORLD_SCORE_CANDIDATE_R01.json`
- `unified-field-r01/R19_UNIFIED_FIELD_REGISTRY_R01.json`
- `unified-field-r01/unified_field.cjs`
- `unified-field-r01/unified_field.test.cjs`
- `unified-field-r01/validate_registry.cjs`
- `R19_CURRENT_STATE.json`

小妈共同依据：

- `WORLD_KERNEL_CORE_CHARTER_R1.md`
- `WORLD_SCORE_TLO_SEMANTIC_CHARTER_R1_20260909.md`
- `KAOPU_WORLD_CHORUS_CLOSED_LOOP_R1_20260909.md`

## 3. 当前统一场结构

本轮没有把所有资料压成一张无类型高度图。统一场由一个世界身份和多条 typed field 组成：

```text
WorldTime
  -> User Authority Observations
  -> Land / Bed Elevation Evidence
  -> Shoreline / Land-Area Evidence
  -> Sounding / Contour / Depth-Area / Quality Evidence
  -> Reef Geomorphic / Benthic Semantics
  -> Regional Tide
  -> Airai Local Tide Transfer (Unknown)
  -> 1944 Non-tidal Residual (Unknown)
  -> Ocean Mother Wave Surface
  -> Instantaneous Free Surface (derived only if compatible)
  -> Water Depth / Wet-Dry State (derived only if compatible)
```

所有字段共享同一个世界身份、时间语义和查询入口，但保留自己的类型、来源、基准和不确定度。

## 4. 已执行的反猜想门

纯逻辑内核已经明确阻止：

- 把缺失的 Airai 局部潮位修正自动填成 0；
- 把缺失的 1944 风暴/气压/风生水位自动填成 0；
- 把 NOAA ENC 本地测深基准直接与 EGM96 正高相减；
- 把不同代表时间的样本静默合成；
- 把 NoData 变成数值；
- 把波系数候选升级为源真值；
- 丢弃不能由波基重建的 residual channel。

执行命令：

```bash
node games/survivor-palau/palau-world/airai-r19/unified-field-r01/unified_field.test.cjs
node games/survivor-palau/palau-world/airai-r19/unified-field-r01/validate_registry.cjs
```

本地实际结果：

```text
R19 unified field contract tests: PASS
R19 unified field registry validation: PASS (14 pages)
```

## 5. 请求小妈判断的七项问题

### A. 一个世界、多字段的边界

当前做法是一个 World ID、一个世界时间和一个查询体系，多条 typed field 不互相覆盖。请判断是否符合“世界总谱 + 声部”的原则。

### B. 垂直基准图

当前显式区分：

- ASF RTC 椭球高；
- EGM96 正高；
- NOAA ENC local sounding datum code 24；
- Malakal station datum；
- Malakal MSL；
- 瞬时自由水面。

已验证的边只允许 `ASF RTC ellipsoid -> EGM96 orthometric`。其他边保持 Unknown。请判断是否遗漏必要节点或错误建立关系。

### C. 潮位分解

当前采用：

```text
freeSurface
= referenceLevel
+ Malakal regional astronomical tide candidate
+ Airai local transfer
+ 1944 non-tidal residual
+ Ocean Mother wave displacement
```

其中 Airai local transfer 与 1944 non-tidal residual 当前保持 Unknown，不用 0 代替。请判断分解是否正确，是否需要增加 wave setup/runup、river/groundwater 或其他独立声部。

### D. 水下证据等级

当前保留 NOAA SOUNDG、DEPCNT、DEPARE、M_QUAL、SBDARE、UWTROC、OBSTRN，Allen 仅作礁盘/底栖遥感语义，GMRT 仅作区域背景，插值面永远是 Candidate。请判断等级与覆盖关系是否正确。

### E. 造波表达门

波形式只能在来源、CRS、时间、垂直基准、NoData、残差和重建误差全部明确后生成。波表达不能替代源数据。请判断这是否足以进入下一步真实数据波分解实验。

### F. 三维表示边界

普通地形与有证据的海床可在有效范围内使用高度场；Rock Island 悬垂、洞穴、负角和拱门必须由独立三维隐式场/体积场/实体证据支持。请判断该边界是否正确。

### G. 进入三维工作台的放行条件

建议必须同时通过：

1. 小妈对统一场和垂直基准图的 Judgment；
2. 两张用户地图与 DEM/NOAA/Allen 的地理叠加通过；
3. 第一组真实数据波表达完成回解误差验收；
4. 一套 `surfaceAt / bedElevation / waterDepth / wetDry / evidenceAt` 同源查询；
5. 三维工作台只读取这套查询，不携带第二张私有地图或第二个海面。

请判断门槛是否完整。

## 6. 验证结果记录规则

小妈的验证是 Judgment，不自动修改生产分支，也不代替用户验收。

只接受以下四种结果：

- `PROMOTE_METHOD`：方法可进入下一阶段实验；
- `CONTINUE_WITH_CORRECTIONS`：列明必须修正的具体关系；
- `PARK`：证据不足，保持 Unknown；
- `REJECT`：方法或语义错误，禁止进入三维生产。

没有明确 Judgment 前，当前状态保持：

```text
smallMotherValidation=REQUESTED_NOT_APPROVED
waveDecompositionAdopted=false
visualBuildAllowed=false
interactive3D=false
productionReady=false
```
