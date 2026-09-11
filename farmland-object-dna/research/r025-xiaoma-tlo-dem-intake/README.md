# R025 小妈 TLO 与桂林 DEM 固定来源接入

状态：固定来源回执与候选 TLO checkpoint 完成；数值地形、田块位置、田间测绘和
地区几何均未接入。

## 本轮收到并读取了什么

用户提供的附件只含两个桂林地形门户地址。门户在 2026-09-11 返回登录界面，
受保护内容没有被读取，因此它只作为 URL 收件记录，不能作为事实证据。

可复核资料改从同一 Git 仓库的固定提交读取，而不是从移动分支名推断：

1. 小妈 TLO 交接提交
   `a4e1b79298205f37dd09b5c63cbcfbe88912e6f9`；六个必读文件分别锁定
   Git blob SHA-1 与文件内容 SHA-256；
2. Landscape/DEM 交接提交
   `a77819b949f79f77601e612d6b30fc22873931f7`；八个身份、AOI、清单、水文和真值边界
   文件分别锁定 Git blob SHA-1 与文件内容 SHA-256；
3. canonical DEM 发布标签 `guilin-native-12p5m-single-truth-v001`，对应提交
   `e4906653b705712edb610ee31f91716f18922369`。

完整路径与双哈希锁见 `XIAOMA_TLO_DEM_INTAKE.json`。验证器要求每个来源的
`retrieval_status=read`，任一 commit、Git blob、内容哈希或关键资产身份漂移
都会失败。

## TLO 在 Farmland 中的当前地位

TLO 继续保留小妈原始语义：`T=Time`、`L=Location`、`O=Object`，世界坐标次序
为 `(t,x,y,z)`；Object 是稳定身份与 Object DNA 引用，不是第五个几何维度，
也不等于 mesh。相机、渲染后端和显示精度不得改变对象身份。

R025 只增加通信接口 checkpoint，没有修改或冻结 Farmland 核心 schema。
扩展名、文本或二进制容器、chunk/index、压缩、流式传输、全局 Location、事件
编码和 relation ontology 全部保持未定。`FARMLAND_TLO_CHECKPOINT.json` 显式保存：

- `T`：记录时间与三个固定来源版本时间；世界时间、有效区间和事件时间为空；
- `L`：保留 EPSG:32649 与 accepted AOI 容器，但田块位置和方向为空；
- `O`：保存候选对象身份、Object DNA/状态/证据引用、桂林地形权威关系及与
  红河地区配置分离的关系；
- 七项 unknown：田块位置、边界、采样窗口、田间微地形、田埂截面、渠道截面和
  水控高程。

状态标签沿用原文：`user-confirmed`、`source-confirmed`、`inferred`、`candidate`、
`unknown`。

## 桂林 DEM 能提供什么

固定身份记录为：

- 源文件 `guilin_raw_union_12_5m.tif`，SHA-256
  `9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4`；
- EPSG:32649，`17408 × 18867`，分辨率 `12.5 × 12.5 m`，int16，NoData=0；
- accepted AOI hash
  `36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80`；
- 9 行 × 6 列、共 54 个原生瓦片，2048×2048 存储、2047 样本步长、共享一行/
  一列边样本；不重采样、不填洞、不用 30 m 后备、不修改高程；
- 桂林锚点瓦片 `native-r05-c01` 与不可变 OSM 线性水文文件均有独立 SHA-256。

这套 DEM 在后续实际取得 canonical 数值瓦片并选定桂林田块后，可以提供宏观
高程、坡度、坡向、AOI/CRS 背景和线性水文引用。

## 它不能提供什么

Farmland 当前分支和上述固定 tag 树内没有 54 个数值瓦片文件；R025 没有读取
任何地形样本，也没有实现查询适配器。12.5 m 是米级栅格间距，不是 12.5 cm，
它不能解析田界、田埂/田坎截面、渠槽截面、进出水口底高程或厘米级水深。

桂林 AOI 也不是红河哈尼梯田的区域地形。UNESCO 遗产页把红河对象定位在
云南南部，并给出 `N23 5 35.8 E102 46 47.93`；R025 因而硬性禁止用桂林 DEM
填充 R023/R024 的红河地区尺寸、地形或水稻参数。

Landscape R6 的 QA 自报 `synthetic=true`、`truthApproved=false`、
`visualApproved=false`、`productionReady=false`，所以该视觉候选被明确排除，
不能充当 DEM 真值。

## 复现

```sh
python farmland-object-dna/tools/cross_mother_intake.py \
  farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/XIAOMA_TLO_DEM_INTAKE.json \
  farmland-object-dna/research/r025-xiaoma-tlo-dem-intake/FARMLAND_TLO_CHECKPOINT.json
python farmland-object-dna/tools/probe_cross_mother_intake_r025.py
python -m unittest discover -s farmland-object-dna/tools -p 'test_*.py' -v
```

选定桂林田块、接通 canonical 数值样本并取得田间级测绘以前，
`readyForRegionalGeometry=false`、`readyForStructuralTruthWorkbench=false`、
`visualAcceptance=false`、`productionReady=false`。
