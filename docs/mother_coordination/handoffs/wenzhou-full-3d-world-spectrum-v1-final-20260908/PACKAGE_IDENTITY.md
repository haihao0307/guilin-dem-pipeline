# 包身份与恢复说明

## 全量包

```text
WENZHOU_FULL_3D_WORLD_SPECTRUM_V1_0_FULL_HANDOFF_2026-09-08.zip
bytes = 93945078
sha256 = 41d0434b4620fd0838636e1d93d3948b98375e89f1d9fb5c70beda05d474ad22
zip entries = 54
CRC test = passed
```

全量包包含可恢复 Canonical 核心、完整新范围 OSM 水系、GEBCO 海床与 TID、坎门潮位、土壤通路与目录、V0.1 总谱基线、全域三维底板、源码、合同、QA 和 Astra 接续入口。

原始 17 片 `温州DEM(3).zip` 作为外部冷备份，身份已写入 `DATA_PAYLOAD_LEDGER.json`。

## GitHub 基线

```text
V0.1 math baseline commit:
7a0be68a3a71506638c1b425a5bc0872700a3b0b

Environment intake commit:
1bc538f496e2b6b4a9f1eb963bc0a970065976f5
```

本分支承担 Astra 续接入口。大型二进制载荷随全量 ZIP 交付，GitHub 固定保存架构、身份、任务和后续提交历史。
