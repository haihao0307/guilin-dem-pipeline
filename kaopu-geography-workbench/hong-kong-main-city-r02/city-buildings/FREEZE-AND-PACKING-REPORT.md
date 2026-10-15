# 香港建筑增量谱：冻结与可选小块包

本轮仅本地文件。旧 `hong-kong-main-city-r01` 与原研究源均未写入；没有发布或继续转换。运行 manifest 状态为 `frozen_partial_scope`，转换状态为 `stopped`，`backgroundExtractionInProgress=false`。

## 范围账本

| 项目 | 数量 | 含义 |
|---|---:|---|
| 完整运行索引 | 113 幅 | 包含尚未形成谱的对象；没有缩小到已完成瓦片 |
| 原源模型 | 23,414 | 其中 1 个官方 glTF 含 NUL 字节，明确排除 |
| 可用源模型 | 23,413 | 全部在索引中 |
| 已有可运行谱 | 5,386 | 3,462 完整测量规则 + 1,924 含显式残余；残余不冒充已抽取规则 |
| 提取失败 | 0 | 与官方坏源、待谱、加载失败为不同状态 |
| 严格全 bbox 高程门禁 | 5,276 | 已全部拥有 recipe；只表示最大可入场数，不代表已加载/渲染 |
| 已有谱但仍待高程 | 110 | 保留在完整索引与谱包中，禁止域外外推 |
| 可用源中待高程 | 18,137 | 包括上述 110 个 ready 对象 |
| 可用源中待谱 | 18,027 | 本轮没有继续抽取 |

门禁直接调用旧 r01 的 `createHKPDDatumLookup().boundsCovered()`，逐一检查 23,413 个对象完整 EPSG:2326 bbox。bbox 必须全部落在同一个有效控制矩形内，不用锚点代替、不 clamp、不外推、不虚构常量、不吸附地面。使用的 lookup/controls SHA-256 在原冻结 scope audit 中。

## 字节账本

| 项目 | 原冻结 data/ | 可选小块 data-packed/ |
|---|---:|---:|
| chunk 数量 | 61 | 310 |
| chunk gzip bytes | 159,192,895 | 152,523,871 |
| chunk JSON bytes | 772,683,811 | 769,945,174 |
| 索引 gzip bytes | 4,787,226 | 4,596,161 |
| 包内文件数，含 receipt | 247 | 739 |
| 总文件 bytes，含 receipt | 167,781,596 | 163,566,545 |
| 最大单块 JSON bytes | 78,580,882 | 21,317,480 |

独立 receipt 包含每文件 exact SHA-256、bytes、分类与总账。receipt 不记录自己的递归 hash，但计入自身稳定字节数。外部测试脚本、本文与 `SNAPSHOT-INTEGRITY-QA.json` 不计入上述数据包总字节。

## 小块包的精度与内存边界

- 每块最多 32 个完整对象；4 MiB（4,194,304 bytes）为 JSON 目标。
- 293 块满足目标，正常块最大 4,180,498 JSON bytes。
- 17 个对象单独已经超目标，完整单独成块，详见 `data-packed/evidence/packed-equivalence-audit.json` 的 `singleObjectOversizeExceptions`。不切三角，不拆操作，不改任何字段或数字精度。
- 最大对象 `B368441814902063C0`：块 JSON 21,317,480 bytes，gzip 3,789,893 bytes，位置/法线最终 Float32 buffer 6,295,896 bytes。它决定当前 whole-object 分块的实际下限。
- 5,386 个原对象与实际写出并重新读回的对象 canonical JSON SHA-256 全相同。canonical 采用递归排序键、保持数组顺序、binary64 round-trip 数字串，并显式保留 `-0`；没有量化、简化、删除字段或切三角。
- 所有新块的 bbox、bytes、SHA-256、源三角数、重建三角数、显式残余对象数均重算；新索引 `readyChunk` 指向实际新块，其他索引字段及 extractionStatus 保留。两个 runtime 文件逐字节相同。
- 这是减少单次 decode 工作量的传输分块，不是浏览器峰值实测，也不是压缩率宣传。gzip、文本、JSON 对象树、三角化临时 number 数组、Float32 CPU buffer 和 GPU buffer 可能同时存在；GPU bytes 不能代替 CPU 峰值预算。
- 后续接入应限制并发解码、按可见/近距加载、及时释放远端 buffers，并且在重建前逐对象做 datum 门禁。混合覆盖块不可用锚点放行；整块 bbox 拒绝也可能误伤可用对象。

## 验证与内容边界

原 61 块及 5,386 对象已有几何 validation 被保留复用：源 patch 投影面积、方向法线、bbox、有限坐标和重复 buffer hash。小块证据按对象原样继承；本轮未重做全部几何重建，也不把该证据称为严格全局 Hausdorff 证明。

所有原冻结解压 JSON/text、runtime 均扫描，没有 secret query key；存在的 URL 查询字段仅为公开 catalog 参数。包中没有 glTF/BIN 原文件、源 ZIP、照片/贴图、下载脚本或需要发布受限原素材的新增内容。glTF/BIN 相对路径与 hash 仅为 provenance 元数据；runtime 不读取或下载 source glTF，只接收 recipe 和调用方已有的 Three.js ShapeUtils/Earcut。原出处、条款链接保持。此为技术内容检查，不替代新的法律权利判断。

## 文件入口

- `data/FROZEN_RECEIPT.json`：原 61 块逐文件冻结账本
- `data/evidence/frozen-scope-audit.json`：完整索引门禁、5,276 IDs、110 待高程 ready IDs
- `data/evidence/chunk-memory-audit.json`：原块及最大对象成本机会分析
- `data/evidence/frozen-security-audit.json`：secret/runtime/原素材检查
- `data-packed/PACKED_RECEIPT.json`：可选小块总账
- `data-packed/evidence/packed-equivalence-audit.json`：5,386 canonical hashes 与 17 单对象例外
- `SNAPSHOT-INTEGRITY-QA.json`：独立全文件 hash、总 bytes、引用、gzip bytes、索引与 validation 复核
- `../tests/freeze-city-buildings-snapshot.mjs`、`../tests/pack-city-buildings-snapshot.mjs`：本轮可复现本地脚本
