# R3.9 轻量交接包范围

目标：新窗口可以准确继续“小温州”当前生产状态，但不搬运历史大包，也不重复携带当前运行二进制 payload body。

## 默认包内包含

1. 当前 `START_HERE / STATE / SOURCE_LOCKS / WORLD_SCORE / NEXT_STEPS / EVIDENCE_ARCHIVES / PACKAGE_SCOPE / CHECKLIST`；
2. 当前 R3.8 页面上运行的 R3.9 关键 HTML/CSS/JS，包括 `soil-pair-loader.js` 与 `evidence-gzip-loader.js`；
3. SoilProfile / WRB / JRC 当前语义索引与压缩 transport 索引 JSON；
4. `records/R3_9/CURRENT.json`、两份清理报告和保留的可重复 QA；
5. `tools/r3-8` 与 `tools/r3-9` 中仍然有效、每个不超过 1 MiB 的文本型验证文件；
6. `AGENTS.md`；
7. 自动生成的 `LEAN_HANDOFF_LOCK.json`，记录源提交、文件 SHA-256、内容去重 alias 和体积统计。

包内文本按 SHA-256 去重。相同内容只保存一个 canonical 文件，其他逻辑路径记录 alias，不重复占用 ZIP。

## 明确不进入默认随身包

- R3.1 / R3.2 约 1.03 GB 全量重启 ZIP；
- 完整无损 DEM 归档；
- 历史固定网页版本；
- WorldCover / JRC / OSM / SoilGrids 永久证据 ZIP；
- 当前 48 个 Soil `.s2gz` payload body；
- 当前 41 个 WRB/JRC `.gz` payload body；
- Windows Python wheels 和其它离线依赖；
- 已完成使命的一次性 benchmark / materialize / cleanup 脚手架。

当前运行二进制并没有被当作真值删除：固定 R3.9 运行提交 `d591713f236107f7db5a24fb9d74e087550e688a` 保留它们；完整源证据仍由永久 Releases 锁定。lean 包只不重复搬运。

## 当前活动运行载荷已经实际减小

### SoilProfile

- 语义：96 层不变；
- 旧活动分裂载荷：80 文件 / `141,864,320` bytes 已退出 R3.8 活动树；
- 当前无损双通道：48 文件 / `34,571,806` bytes；
- codec：`i16le-pair-byte-shuffle-gzip-v1`；
- `Q0.5` 与 `uncertainty` 语义都保留，解码后原 SHA 全部一致。

### WRB + JRC

- 逻辑 payload：41 不变；
- 旧活动原始载荷：41 文件 / `37,239,384` bytes 已退出活动树；
- 当前逐层 gzip：41 文件 / `3,424,064` bytes；
- WRB 30 个概率面仍然独立按需读取，没有为了文件少而合并成一个大常驻包；
- 解码后原 SHA 全部一致。

### 合计

- 旧活动 payload：`179,103,704` bytes；
- 当前活动 payload：`37,995,870` bytes；
- 净减：`141,107,834` bytes；
- 减少约 `78.79%`；
- 信息损失：false。

## 为什么旧交接包会膨胀到约 2.05 GB

旧链路先完整解压 R3.2 的约 1.03 GB 重启底座，再叠加 R3.3–R3.8；R3.2 自身又继承 R3.1 大底座。旧 ZIP 构建器还把多种二进制设为 `ZIP_STORED`，因此每次新增数据都会原尺寸继续滚雪球。这个机制已经删除。

## 体积门

R3.9 lean handoff 的唯一未压缩内容硬上限仍为 8 MiB；ZIP 本体也必须 <= 8 MiB。超过即失败，不允许恢复历史整包继承方式。

## 冷档案

历史 verified candidate、GB 级 restart Release 和永久证据 Release 继续保留，不覆盖、不删除；恢复必须使用固定 Git commit、Release tag、asset 名、bytes 与 SHA-256。
