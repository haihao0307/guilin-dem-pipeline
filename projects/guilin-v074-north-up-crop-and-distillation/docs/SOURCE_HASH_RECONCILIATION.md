# Source TIFF Hash Reconciliation

状态：`BLOCKED_BEFORE_FORMAL_CROP_AND_DISTILLATION`

## 已冻结的两条记录

全量交接包 v1.0 锁定：

```text
guilin_raw_union_12_5m.tif
bytes   124348471
sha256  9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4
```

旧版 v0.7.2 工作流中的原始联合重建门禁记录：

```text
guilin_raw_union_12_5m.tif
bytes   124348471
sha256  9c9a042fa57a95107012aabd8613158566e3cddc33d99f55903f809adf903aaf
```

两条记录的大小、网格、范围和像元统计相同，SHA256 不同。现阶段没有足够证据说明差异来自元数据、压缩、文件重写或实际像元变化。

## v0.7.4 处理原则

1. 正北裁切页遵循全量交接包，显示 `9490b1bd...` 作为当前包内锁定合同。
2. 网页预览只标记为视觉参考，不宣告已经从该精确 TIFF 重新派生。
3. AOI 保持 `UNCONFIRMED`，程序地形蒸馏保持关闭。
4. 两条哈希不得静默合并、覆盖或选一个冒充已经复核。

## 解除阻断的唯一闭环

1. 从 `canonical/guilin-dem-12_5m-core/catalog/source_manifest.json` 读取精确 12 张源片清单。
2. 实体化每一个 Git LFS 对象。
3. 对 12 张源片逐一核验文件大小和 SHA256。
4. 使用锁定的 nearest-neighbour、first-valid、12.5 米 target-aligned 规则重建未裁切联合 TIFF。
5. 核验宽高、范围、变换、CRS、NoData、有效像元和高程统计。
6. 对重建 TIFF 计算文件 SHA256，同时计算解压像元数组、掩膜、地理变换和关键 TIFF 标签的规范化摘要。
7. 比较两条旧记录并形成机器可读报告。
8. 只有其中一条记录被精确重现，且报告解释另一条记录的来源后，才更新正式锁定合同。

该报告完成前，裁切页面可以供浩哥选择范围，正式裁切 DEM 和后续程序地形蒸馏仍然受阻。
