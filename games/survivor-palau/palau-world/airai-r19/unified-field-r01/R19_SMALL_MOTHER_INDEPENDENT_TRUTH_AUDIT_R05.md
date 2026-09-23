# Stone Money Island / Survival Palau R19
# 小妈独立真实性审计请求 R05

日期：2026-09-23  
审计对象分支：`work/palau-airai-r19-authority-locked-restart-20260922`  
冻结审计提交：`e8a6838b500aace2f102dfb6c08870c673de2c0d`  
基线：`c47f7cc62d864e95117bd5548ca9ffa3f1d770a8`  
Draft PR：`#136`  
小妈验证入口：`#138`  
状态：`INDEPENDENT_TRUTH_AUDIT_REQUESTED_NOT_YET_JUDGED`

## 1. 用户要求

用户要求本执行线主动交给小妈独立检查，确认没有撒谎、没有把候选冒充真值、没有自行编地图、编潮位、编水深或编历史事实。只有依据正确的信息并得到明确 Judgment 后，才允许继续真实数据波表达和最终三维工作台。

本文件不是自我批准，也不是小妈 Judgment。它只提供一份可复核的审计清单。

## 2. 审计原则

小妈不得依据本执行线的文字自证通过。请直接读取源文件、哈希、处理回执、CI 日志和状态门，并寻找反例。

请重点判断：

1. 每个“已验证”是否真的有原始来源、处理链和可重复检查；
2. 每个“候选／阻断／未知”是否仍保持候选／阻断／未知；
3. 是否存在把现代证据写成 1944 年直接观察的情况；
4. 是否存在把 NOAA 本地测深基准、EGM96、Malakal 站零或 MSL 静默混算的情况；
5. 是否存在把 Malakal 区域潮位直接复制为 Airai 局部潮位的情况；
6. 是否存在把插值海床、遥感语义或 GMRT 背景冒充连续实测海床的情况；
7. 是否存在把波表达、程序生成或视觉结果冒充真实地图的情况；
8. 是否隐藏失败测试、降低门槛或用成功 CI 掩盖未验证的事实结论；
9. 是否存在未声明的 R12–R18 错误成果继承；
10. 是否存在“已经三维／可以生产／可以发布”的虚假状态。

## 3. 当前允许称为“有证据支持”的项目

以下项目只能在其声明范围内审计，不能扩大含义。

### 3.1 分支与治理

- R19 从封存 R11 基线建立；
- R12–R18 被用户否决的地形、岸线、故事坐标、网格和视觉结果不得作为生产基线；
- 当前状态必须保持 `productionStopped=true`、`visualBuildAllowed=false`、`interactive3D=false`、`productionReady=false`。

核查：

- `R19_CURRENT_STATE.json`
- `R19_AUTHORITY_LOCK.json`
- Draft PR `#136`

### 3.2 用户位置观察

- 完整 Palau 图只承担首屏、全局上下文与相对定位观察；
- 红色 Airai 框只承担宽范围上下文，不是故事核心；
- 黄色手绘区域承担完整故事核心 AOI 的用户语义，不是一个点；
- 两张图之间的像素配准可以作为派生结果；
- 完整图像素到最终 WGS84 地理多边形仍是 Candidate，不得称为通过。

核查：

- `R19_USER_LOCATION_AUTHORITY_20260922.json`
- `R19_LOCATION_TO_DEM_REGISTRATION_CANDIDATE_20260922.json`
- `R19_TRANSFER_GRAPH_R04.json`

### 3.3 DEM

允许主张的范围：

- 两个 ASF RTC ancillary DEM 来源身份和哈希被登记；
- 12.5 m 是存储 posting，不能宣传为原生 12.5 m 地形测量；
- 有效高程信息来源被归类为 SRTMGL1 名义 30 m；
- ASF 椭球高到 EGM96 正高的转换，只能在两幅 exact source hash 和已记录处理链的 scope 内使用；
- EGM96 派生共同格网是 derived product，不覆盖原始源身份；
- 现代 DEM 应用于 1944 宏观地形仍属于候选时间转移，不是 1944 测量。

核查：

- `R19_DEM_CLASSIFICATION_AND_NORMALIZATION_ZH.md`
- `R19_INPUT_BINDINGS.json`
- `R19_KAOPU_CORE_LEDGER_R03.json`
- `R19_TRANSFER_GRAPH_R04.json`

### 3.4 岸线、礁盘与水下证据

允许主张的范围：

- 已找到并保存 NOAA ENC、GMRT、OSM、Allen Coral Atlas 的既有证据包及其清单；
- NOAA `COALNE/LNDARE/SOUNDG/DEPCNT/DEPARE/M_QUAL/SBDARE/UWTROC/OBSTRN` 各自保留原语义；
- 黄色 AOI 内的要素数量、测深点数量和派生格网统计只能视为当前处理结果；
- 连续海床始终是 `CANDIDATE_NOT_SURVEY_TRUTH`；
- NoData、证据距离、不确定度和 DEPARE 冲突不得抹去；
- NOAA 2025 航海图、Allen 产品和 GMRT 不能自动升级为 1944 精确岸线或海床。

核查：

- `R19_EXISTING_COAST_HYDRO_ASSET_LOCK_20260922.json`
- `evidence-cache/airai-reef-bathy-r01/**`
- `user-aoi-evidence-r01/**`
- `R19_KAOPU_CORE_LEDGER_R03.json`

### 3.5 潮位与海面

允许主张的范围：

- Malakal 只作为区域潮位来源或边界候选；
- Airai 局部潮位转移保持 Unknown；
- 1944 非潮残差保持 Unknown；
- NOAA local sounding datum code 24 到 EGM96/MSL 的桥保持 BLOCKED；
- `OceanSurfaceState` 只建立一个同源查询契约，提供 `eta / dx / dz / normal / surfaceVelocity / q`；
- 最终自由水面仍未成立，未知分量返回 `PARTIAL`，不得填零。

核查：

- `unified_field_r02.cjs`
- `unified_field_r02.test.cjs`
- `R19_UNIFIED_FIELD_REGISTRY_R02.json`
- `R19_TRANSFER_GRAPH_R04.json`

### 3.6 靠谱核心与转换图

允许主张的范围：

- 22 条数据线已写入完整 KAOPU Core 结构；
- Observation 与 Claim、Evidence Asset 与 World Field、Unknown 与 NoData、View 与 Evidence 在 schema/validator 层被要求分离；
- Transfer Graph 有 30 个 typed nodes、21 条 typed edges；
- Canonical traversal 只允许 `VERIFIED` 和满足 scope 的 `VERIFIED_SCOPED`；
- Candidate、Blocked、Rejected 边不能进入正式路径；
- 当前这些属于方法与契约候选，不等于真实三维或最终世界已经完成。

核查：

- `R19_KAOPU_CORE_SCHEMA_R03.json`
- `R19_KAOPU_CORE_LEDGER_R03.json`
- `kaopu_core_r03.cjs`
- `R19_TRANSFER_GRAPH_SCHEMA_R04.json`
- `R19_TRANSFER_GRAPH_R04.json`
- `transfer_graph_r04.cjs`

## 4. 必须保持“没有通过”的项目

小妈若发现下列任何一项被写成已完成，应直接判为不诚实或语义越级：

- 最终黄色 AOI 的 WGS84 多边形；
- 精确 Stone Money 岛名或最终故事坐标；
- NOAA code 24 到 EGM96/MSL 的垂直基准转换；
- Malakal 到 Airai 的局部潮位转移；
- 1944 年风、气压、风暴增水和非潮残差；
- 1944 年精确岸线与精确海床；
- 真实 DEM 波系数或水深波系数；
- 最终瞬时自由水面；
- 三维工作台；
- 视觉批准；
- 生产就绪；
- 公网发布。

## 5. 要求小妈进行的主动反证

请不要只阅读摘要。至少执行以下反证：

1. 搜索分支是否存在：
   - `productionReady=true`
   - `visualBuildAllowed=true`
   - `interactive3D=true`
   - Candidate 被写成 `CANONICAL_TRUTH`
   - Blocked/Unknown 边携带 `defaultValue=0`
   - R12–R18 旧坐标或旧岛名被重新启用
2. 重跑 R02、R03、R04 与 authority gate；
3. 核对成功回执对应的 exact run/job，而不是只看文字报告；
4. 核对首次失败是否被保留，以及修复是否降低门槛；
5. 核对每条 `VERIFIED` edge 是否有 evidence、operation、scope/validRange 和 passing test；
6. 随机抽查至少五条 Claim，沿 Observation、Source Asset、Transformation 和 Independence Root 回溯；
7. 对水深、潮位、历史状态和图像地理配准各选择一个最危险的越级路径，证明系统会阻断；
8. 对 PR #136 做一次反向审查：找出任何文字比代码/证据更强的陈述。

## 6. 已公开的失败，不得隐藏

当前至少保留以下失败：

- R02 首次测试因浮点严格相等断言失败；
- R03 首次测试因 validator 内部 `Set` 被 JSON clone 破坏而失败；
- R04 首次测试因对抗夹具未补全其他 verified 字段、错误期待后续错误码而失败。

小妈需确认修复只纠正测试/验证器实现，不曾放宽事实、证据、基准或 Unknown 门槛。

## 7. 请求小妈返回的双重 Judgment

请分别返回两项，不得只给笼统评价。

### A. 真实性审计

只接受：

- `PASS_NO_UNSUPPORTED_PROMOTION_FOUND`
- `CONTINUE_WITH_TRUTH_CORRECTIONS`
- `PARK_INSUFFICIENT_AUDIT_EVIDENCE`
- `FAIL_UNSUPPORTED_OR_FABRICATED_CLAIM_FOUND`

若不是 PASS，必须列出 exact 文件、字段、陈述和修正动作。

### B. 方法放行

只接受：

- `PROMOTE_METHOD`
- `CONTINUE_WITH_CORRECTIONS`
- `PARK`
- `REJECT`

即使真实性审计通过，也不自动允许波实验或三维。小妈必须明确说明允许进入的最小下一步，例如“只允许 EGM96 DEM 可逆波表达；禁止水深、潮位、历史岸线与最终海面”。

## 8. 当前硬状态

```text
truthAudit=REQUESTED_NOT_JUDGED
smallMotherValidation=REQUESTED_NOT_APPROVED
waveDecompositionAdopted=false
visualBuildAllowed=false
interactive3D=false
visualAcceptance=false
productionReady=false
```

在小妈完成双重 Judgment 前，本执行线不得开始真实波系数生产，不得生成三维工作台。