# Farmland R025 ↔ 小妈 TLO / DEM 桥梁包

桥梁 ID：`FARMLAND_XIAOMA_TLO_DEM_BRIDGE_R025_20260911`

接收方：小妈 / TLO、DEM / Landscape、下一位 Farmland 执行者。

## 固定身份

- 源提交：`9fb3c6837bc8358a57450d48758760fa96a51ca8`
- 源树：`5702677fa967895d658b7f4e352c065388344f2b`
- R025 基线：`082d2ae692f9fae3811531a847d2cb53e8ff348f`
- ZIP：`Farmland_Object_DNA_Xiaoma_TLO_DEM_Bridge_R025_2026-09-11.zip`
- ZIP 字节数：`222262`
- ZIP SHA256：`815a599044ea3717d1c5cc4e399c1ca211485db9b9aa9551b017f454227e8010`
- 载荷文件：`79`
- 构建与解包后测试：`118/118 PASS`

## 包含与排除

包内保存当前 Farmland R021–R025 的合同、证据回执、源码、探针、测试、桥梁
任务卡，以及必需的仓库级生产规则。R025 所引用的 14 个上游文件以固定 Git
blob SHA-1 和内容 SHA-256 锁定；桥梁包不复制这些上游仓库文件本体。

包内不含历史 ZIP、被否决的 V0.1 视觉工作台、TIFF、canonical 数值 DEM
瓦片、受保护门户内容、凭据或无关 Mother 资产。

## 验收

在仓库根目录运行：

```bash
python farmland-object-dna/tools/verify_bridge_package_r025.py
```

验收器会检查单根安全 ZIP、外部回执、全部逐文件 SHA256、manifest 覆盖、
固定 Git 源字节，并在临时目录解包后重跑 R025 validator 与全部单元测试。

## 确定性重建

```bash
rebuild_dir=$(mktemp -d)
python farmland-object-dna/tools/build_bridge_package_r025.py \
  --source-ref 9fb3c6837bc8358a57450d48758760fa96a51ca8 \
  --output-dir "$rebuild_dir"
```

CI 会把重建的 ZIP、receipt、SHA256 和 `LATEST.json` 与已提交成品逐字节比较。

当前仍为：`numericTerrainConnected=false`、`visualAcceptance=false`、
`productionReady=false`。
