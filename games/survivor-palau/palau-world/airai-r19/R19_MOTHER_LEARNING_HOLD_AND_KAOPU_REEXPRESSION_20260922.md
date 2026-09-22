# Stone Money Island / Survival Palau R19
# 小妈学习暂停单与靠谱语言重表达 R01

日期：2026-09-22  
状态：`LEARNING_HOLD_NO_VISUAL_PRODUCTION`  
适用分支：`work/palau-airai-r19-authority-locked-restart-20260922`

## 0. 用户停止令

从本文件提交起，暂停 Stone Money Island / Survival Palau 的可见生产、三维生成、地图定稿、故事点冻结、连续海床补面和发布。

本轮只做：

1. 阅读小妈共同方法、Ocean/Water 接口边界和现有 Palau 证据；
2. 把所有已有数据线按靠谱语言重新分类、建立关系、标明单位、坐标、时间、垂直基准、来源、不确定度和 Unknown；
3. 找出此前推理错误、冲突和缺口；
4. 形成可审计的世界总谱候选；
5. 不生产新资产，不交二维图，不交三维图，不发布。

所有已下载资料只读保留，不删除、不覆盖、不重新下载。现有证据缓存、原始 NOAA ENC、GMRT、OSM、Allen Coral Atlas 元数据、派生向量和栅格继续冻结。

---

## 1. 已吸收的小妈方法

### 1.1 分工

- 小妈负责：理论、共同知识、跨域关系、方法、语义、证据边界和结果解释。
- 本 Mother 负责：在用户明确授权后执行具体实现、实验、QA 和交付。
- 本轮是知识学习，不等于运行时已实现，不等于物理模型已验证，不等于用户已批准生产。

### 1.2 每条数据必须带的共同字段

每个对象、场、观察或处理结果至少记录：

- `identity`：对象是谁，实例还是类别；
- `representation`：点、线、面、高度场、实体、体积场、隐式场、时间序列或语义分类；
- `spaceFrame`：坐标系、轴向、单位、原点、CRS、是否地理配准；
- `time`：代表时间、观察时间、处理时间、有效时间窗、时区；
- `verticalReference`：垂直基准、测深基准、站零、MSL、EGM96 或 Unknown；
- `quantity`：数值物理含义、单位、范围、正负方向；
- `source`：原始来源、哈希、处理链；
- `epistemicState`：`observed / derived / modelled / candidate / visual-only / rejected / unknown`；
- `uncertainty`：误差、不确定度、质量等级和冲突；
- `absenceState`：`ObservedAbsent / NotCovered / NoData / Occluded / Unknown`，不得把 Unknown 填成 0；
- `adoptionState`：只读学习、候选采用、实现采用、外部验证、用户批准必须分开。

### 1.3 噪波和造波的边界

造波、噪波和函数图只允许承担以下角色：

- 压缩已验证的低频/中频/高频结构；
- 在明确参数域内生成可复现候选；
- 表达现有观测的残差或不确定性；
- 驱动视觉层或经验证的物理近似。

它们不得替代原始地理证据，也不得因为“看起来像”就升级为真实岸线、岛形、海床、潮位或洞穴。

---

## 2. 必须纠正的逻辑错误

### 2.1 “几个波就能描述地图”不是证据

波场可以是已验证地形的压缩语言，但不能从少量波参数反推真实帕劳。正确顺序是：

`原始观测 -> 配准与基准统一 -> 冲突/NoData -> 多尺度分解 -> 波场/函数表达 -> 回解误差门`

错误顺序是：

`先写波 -> 得到像地图的形状 -> 再给形状贴上地名`

后一种路线永久禁止。

### 2.2 两个二维波场相交，不会自动得到完整三维真值

单值高度场只能表达 `z=f(x,y)`，不能表达同一 `(x,y)` 下多个表面、悬垂、负角、洞穴或拱门。

两个二维场的交汇也只有在定义了明确的三维隐式函数、体积占据、距离量和解集之后，才可能表达这类结构。以后表示规则是：

- 普通陆地与海床：证据支持时可用高度场；
- 岩壁、悬垂、洞穴、拱门：需要三维隐式场、体积场或实体几何；
- 表面法线、凹凸贴图不能冒充体积结构。

### 2.3 “海面是 0”必须附带垂直基准

`0 m` 只有在指定垂直基准后才有意义。当前至少存在：

- EGM96 正高；
- ASF RTC 椭球高；
- NOAA ENC 本地测深基准；
- UHSLC/NOAA 潮位站零；
- MSL、MHHW、MLLW；
- 瞬时自由水面。

不同基准之间没有已验证转换时，不能直接相加或相减。

### 2.4 Malakal 潮位不能直接冒充 Airai 每个水道的局部潮位

Malakal 可作为区域潮汐观察根和边界强迫候选，但 Airai 礁盘、水道和泻湖会产生局部相位、振幅、摩擦、蓄泄和波浪增水差异。

没有 Airai 本地潮位观测、经过验证的转移函数或水动力模型时：

- `Malakal observed/predicted tide` 是区域源；
- `Airai local tide correction` 保持 Unknown；
- 不允许把 Malakal 曲线逐点复制成 Airai 全域真值。

### 2.5 连续海床候选不能冒充连续实测海床

NOAA `SOUNDG` 是离散测深观察，`DEPCNT` 是等深线，`DEPARE` 是水深区间，`M_QUAL` 是质量，Allen 是遥感语义/浅水产品，GMRT 是区域背景。

任何插值面必须同时携带：

- 来源观测；
- 插值方法；
- 最大证据距离；
- NoData；
- 不确定度；
- 质量区；
- 垂直基准；
- 与 DEPARE/等深线冲突。

---

## 3. Palau / Airai 已有数据线重新分类

### 3.1 用户位置权威线

- 完整帕劳总图：首屏与全域导航权威；
- 红色 Airai 框：宽范围上下文和连续进入区域；
- 黄色手绘圈：Stone Money 故事核心 AOI，属于区域，不是点；
- 状态：用户权威观察；
- 禁止：猜岛名、缩成点、替换成自动候选。

### 3.2 陆地高程线

- 两个 ASF ALOS PALSAR RTC 辅助 DEM；
- 存储 posting：12.5 m；
- 有效高程来源：SRTMGL1 名义 30 m；
- CRS：EPSG:32653；
- 已派生 EGM96 正高共同格网；
- 原 ZIP/GeoTIFF 为只读原件；
- 不能宣称原生 12.5 m 测量真值。

### 3.3 岸线与陆地区域线

- NOAA ENC `COALNE`：岸线证据；
- NOAA ENC `LNDARE`：陆地区域证据；
- OSM：语义/辅助证据，不升级为水文测绘真值；
- 用户卫星图：形态和相对关系证据；
- 任何来源冲突必须保留，不能通过程序平滑自动消失。

### 3.4 水下观察线

- `SOUNDG`：离散测深点；
- `DEPCNT`：等深线；
- `DEPARE`：水深区间；
- `M_QUAL`：测量质量；
- `SBDARE`：海底性质；
- `UWTROC`：水下岩石；
- `OBSTRN`：障碍物；
- NOAA NCEI 多波束：当前只证明航迹/覆盖语境，不自动成为礁盘内部连续海床；
- 当前 AOI 的测深基准 code 24 为 `local datum`，没有到 MSL 的已验证转换。

### 3.5 礁盘与浅水语义线

- Allen Coral Atlas geomorphic/benthic：遥感分类和浅水语义；
- Allen 浅水 bathymetry：卫星反演产品；
- 这些层可说明 reef flat、lagoon、slope、benthic class 等候选语义；
- 不得替代 NOAA 离散测深、正式航海图或现场测量；
- 深水、浑水、陡坡和局部岸水交界存在已知遗漏或分类误差。

### 3.6 区域海底背景线

- GMRT：区域背景和形态上下文；
- 不作为近岸礁盘厘米/米级海床真值；
- 与 NOAA/Allen 冲突时不能覆盖高等级观察。

### 3.7 潮位与海面状态线

- NOAA CO-OPS `1841367 Malakal Harbor`：区域潮位参考站；
- NOAA `1841281 Koror`：以 Malakal 为参考的 subordinate station；
- UHSLC Malakal A/B：潮位观察与站零/基准资料；
- 历史 1944：若无当年实测，只能由潮汐调和常数或全球潮汐模型重建“天文潮候选”；
- 1944 风暴增水、气压、风生水位和局部 Airai 水动力修正保持 Unknown，除非获得相应证据。

### 3.8 Ocean Mother 动态海面线

Ocean Mother 只负责在明确边界内提供：

- 波面位移；
- 法线/坡度；
- 白沫/光学候选；
- 同源查询；
- 性能状态。

它不拥有海床真值、岸线真值、潮位基准或局部 Airai 水动力事实。

---

## 4. 靠谱世界总谱候选

世界查询必须拆成独立根，再由显式关系组合：

```text
WorldTime
  -> WaterBodyIdentity
  -> SpatialFrame / CRS
  -> VerticalReferenceGraph
  -> BedAndLandTruth
  -> ShorelineAndReefEvidence
  -> TideObservation / AstronomicalTideCandidate
  -> LocalTideTransfer(Unknown until verified)
  -> NonTidalResidual(Unknown unless observed/modelled)
  -> WaveSurface
  -> InstantaneousFreeSurface
  -> WetDryState / WaterDepthQuery
  -> Optics / Coast Interaction / Ecology
  -> Evidence and Uncertainty
```

建议的同源查询：

```text
bedElevation(x,y,t,datum)
landOrWaterEvidence(x,y,t)
reefSemantic(x,y,t)
tideRegional(t,datum)
localTideCorrection(x,y,t) -> Unknown or verified field
nonTidalResidual(x,y,t) -> Unknown or observed/modelled field
waveDisplacement(x,y,t)
freeSurface = referenceLevel + tide + localCorrection + residual + wave
waterDepth = freeSurface - bedElevation
```

只有各项处于同一坐标、同一时间语义和可转换垂直基准时，最后两个式子才允许求值。

---

## 5. 潮位学习结论

### 5.1 已知

- Malakal Harbor 是 NOAA 潮汐参考站；
- UHSLC Malakal-B 示例给出相对于 station datum 的 MHHW、MLLW、MSL，并说明需通过减去 MSL 转成 MSL 参考；
- 潮位站零、MSL、MLLW、航海图 datum、EGM96 不是同一个概念；
- NOAA 可提供潮汐预测和调和信息；UHSLC 提供 fast-delivery 和 research-quality 海平面序列。

### 5.2 1944 必须拆分

```text
1944 instantaneous water level candidate
= 1944 astronomical tide model
+ local Airai transfer
+ atmospheric/ocean residual
+ wave setup/runup
```

当前只能可靠建立第一项的候选方法；后三项没有证据时保持 Unknown。绝不把现代某一天潮位平移为 1944 真值，也不把现代平均基准误当成 1944 瞬时海面。

### 5.3 最小必备元数据

- 位置；
- UTC 与本地时区；
- 历法和闰秒处理；
- 站/模型身份与版本；
- 参考 datum；
- 调和常数或模型网格；
- 相位约定；
- 插值方法；
- 与 Airai 的空间转移状态；
- 不确定度和缺失项。

---

## 6. 水下学习结论

### 6.1 观察与候选必须分层

```text
Observation roots:
  SOUNDG points
  DEPCNT lines
  DEPARE intervals
  M_QUAL polygons
  SBDARE / UWTROC / OBSTRN
  Allen semantic classes
  GMRT context

Derived candidates:
  interpolated bathymetry
  uncertainty field
  nearest-evidence distance
  support class
  reef semantic field
```

### 6.2 当前黄色 AOI 已知边界

现有 R19 证据包只能证明：黄色 AOI 内已有岸线、陆地区域、43 个测深点、等深线、水深区间、礁盘语义和不确定度候选。它不能证明每个 25 m 单元都被测量，也不能证明插值深度与 DEPARE 一致。

### 6.3 以后“弄不懂就画出来”的执行方式

遇到不清楚的关系，先画**证据图**，不能画成完成地图：

- 原始观察用实线/点；
- 派生候选用虚线/半透明；
- Unknown/NoData 留空并明确标识；
- 冲突两边同时显示；
- 每个图层显示 datum、时间、来源、质量和处理版本；
- 图只用于审查，不自动进入运行时。

---

## 7. 重开生产的硬门槛

只有以下条件全部满足，才允许继续三维生产：

1. 小妈方法学习记录完成并回流；
2. `identity / space / time / vertical datum / evidence / uncertainty / Unknown` 全部进入总谱；
3. 用户位置图与 DEM/岸线/礁盘的最终配准通过；
4. Airai 潮位采用策略明确区分 Malakal 区域源和局部修正；
5. 航海图 datum 到世界垂直基准的关系明确，或明确保持未转换；
6. 水下观察根、候选面和冲突层完全分离；
7. 生成表示方式通过边界审查：高度场不能承担悬垂/洞穴；
8. 没有任何自动猜岛、补岸、补水道、填 NoData 或把视觉近似升级为真值；
9. 用户或小妈批准从“学习保持”切回“生产”。

当前结论：

```text
productionStopped=true
learningOnly=true
existingEvidencePreserved=true
redownloadRequired=false
visualBuildAllowed=false
interactive3D=false
visualAcceptance=false
productionReady=false
```
