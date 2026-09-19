# Mother 共用临时参考资产生命周期协议 R1.1

日期：2026-09-20
适用：所有 Mother / 子工作台 / Codex 执行分支
目标：用户只上传一次；后续可重复读取；生产仓库不被临时模型、图片、视频和大二进制长期污染；最终产品优先由自然观察、科学测量与独立实现形成。

## 1. 核心原则

用户上传的模型、图片、视频、录音、参考包，默认先视为“参考输入”，不是生产资产，也不是最终 KAOPU 数据。

每个输入必须在第一次可读时立即建立不可变身份：

- sha256
- 原始文件名
- 字节数
- 接收日期
- 来源类别（user_upload / external_reference / natural_observation / scientific_source / generated_test）
- rightsStatus（user_owned / public_domain / licensed_reference / unknown / restricted）
- sourceLocator（可重新取得时的 URL、DOI、馆藏号或用户来源说明）
- 用途
- 使用它的 Mother
- retentionClass
- distilledStatus
- lastAccessAt
- ingestAt
- purgeEligibility

相同 SHA256 的输入不得重复保存。

## 2. 三类资料

### A. REFERENCE_TEMP
临时参考。用于测量、观察、骨骼/动画学习、材质分析、比对。

规则：
- 不作为最终运行依赖。
- 不默认进入公开生产仓库的 Git 历史。
- 原始文件进入独立 PRIVATE Reference Cache。
- 生产仓库只保存 manifest、SHA256、测量结果和独立重建后的数字 DNA。
- 允许最终删除原始文件，但不删除最小来源账本。

### B. EVIDENCE_KEEP
需要长期保留的证据，例如用户原创基准图、权威测量表、许可证、来源记录、关键自然观察证据。

规则：
- 可长期保存，但必须记录来源与权利边界。
- 与生产资产分离。
- 默认不公开第三方受限原始内容。

### C. PRODUCTION_ASSET
明确批准作为最终产品依赖的资产。

规则：
- 必须明确标记；不能因为“文件在 GitHub”就自动升级为生产资产。
- 如果生产成果仍需要第三方参考文件才能运行，则不能标为 source-independent。

## 3. Reference Cache 结构

使用独立 PRIVATE GitHub repository，且与生产代码仓库分离。

建议仓库名：
haihao0307/KAOPU-REFERENCE-CACHE

路径规范：

refs/<sha256-prefix>/<sha256>/<original-filename>

例如：

refs/c1/c1b964...ee64/model_67a_-_largemouth_bass.glb

每个目录同时保存 manifest.json。

Reference Cache 中的二进制文件不可变；内容变化即生成新的 SHA256 和新对象，不覆盖旧身份。

大二进制走 Git LFS 或其他私有对象层；不要把它们写进公开生产仓库的普通 Git 历史。

## 4. 为什么不能把所有临时二进制直接塞进生产仓库

- guilin-dem-pipeline 是 public repository；临时参考不应默认公开。
- 普通 Git 删除文件不会自动把旧 blob 从历史中消失。
- 大二进制反复修改会不断扩大仓库历史。
- LFS/对象存储也不是无限垃圾桶，需要独立清理策略。
- 生产代码、最终数字 DNA 与一次性参考物应有不同生命周期。

因此生产仓库与 Reference Cache 必须分离。

## 5. Mother 读取协议

任何 Mother 开始任务时：

1. 先读当前项目的 REFERENCE_MANIFEST.json。
2. 用 SHA256 而不是文件名确认身份。
3. 从 Reference Cache 读取原始文件。
4. 本地重新计算 SHA256。
5. 不一致则停止，不得用“同名文件”替代。
6. 可访问且哈希一致时，不得再次要求用户上传同一对象。
7. 每次读取更新 lastAccessAt，并追加 ledger 记录。
8. 不能访问时必须报告具体阻塞：repo/ref/path、权限、LFS、工具下载能力或对象不存在；不得笼统说“需要重新授权”。

## 6. 临时仓库定期清理规则

默认工程阈值，可后续按实际容量调整：

### 周期
- 每周做一次 inventory sweep。
- 不自动删除 EVIDENCE_KEEP 或 PRODUCTION_ASSET。

### 普通清理
REFERENCE_TEMP 只有满足全部条件才进入可删除队列：
- distilledStatus = COMPLETE；
- numericQA = true；
- visualQA = true；
- independentRuntime = true；
- provenanceRecorded = true；
- userKeepRequested = false；
- 连续 30 天没有被读取。

### 容量高水位
- 当 Reference Cache 可计费/实际占用达到 8 GiB 时进入高水位清理。
- 按 lastAccessAt 从旧到新处理“已满足删除门”的 REFERENCE_TEMP。
- 清理到约 6 GiB 以下再停止。
- 如果 LFS/普通 Git 历史仍占空间，使用缓存仓库轮换/重建或受控历史清理，而不是只做 git rm 后宣称空间已经回收。

### 删除前保留
即使删除原始文件，也保留：
- sha256
- originalFilename
- bytes
- sourceLocator
- rightsStatus
- ingestAt / lastAccessAt / deletedAt
- usedBy
- extractedKnowledge
- derivedOutputs
- QA receipt
- 删除原因

不能保证任何网络源永久存在，所以 sourceLocator 是“可重新寻找线索”，不是“永远可恢复”的承诺。

## 7. 蒸馏完成后的删除门

REFERENCE_TEMP 只有同时满足以下条件才可清理：

- 需要的形态测量已落入独立数字数据；
- 需要的骨骼/关节关系已记录；
- 需要的动画规律已提取为独立函数/参数；
- 需要的材质/PBR观察已记录；
- 来源、SHA256、测量条件和不确定性仍保留；
- 新生成体系已脱离原始参考独立运行；
- 数值 QA 与视觉 QA 已通过；
- 用户未要求长期保存原文件。

## 8. Nature-first / 道法自然

最终生产数据优先分为三层证据：

N0 NATURAL_DIRECT
- 用户自己拍摄/测量的自然对象；
- 我们对自然对象直接测量得到的数据。

N1 SCIENTIFIC_NATURE
- 权威科研论文、博物馆/研究机构数据、NOAA 等科学资料；
- 公开领域或许可允许的自然影像/测量；
- 记录事实和测量，不复制受保护表达。

N2 TRANSITIONAL_REFERENCE
- 第三方模型、商业/社区模型、动画、参考艺术、网络素材；
- 只用于快速理解、找问题、建立临时测量假设；
- 不能作为最终 source-independent 结果的唯一依据。

最终公开成果如果标记 NATURE_DERIVED，必须能在不读取 N2 原文件的情况下：
- 独立生成；
- 由 N0/N1 数据重新验证关键比例与行为；
- 通过 source-removal QA。

“看过第三方模型”与“最终数据来源于自然测量”不是同一件事。只有完成独立复测和替换后，才能把最终数据标成 nature-derived。

## 9. 关于公开仓库与来源痕迹

公开生产仓库中：
- 不放第三方临时 GLB、贴图、视频、受限图片；
- 不放可逆还原第三方资产的高维编码、残差、顶点/纹理复制；
- 不把第三方作者特有的错误、拓扑或动画曲线当作最终标准；
- 只公开独立生成代码、自然/科研测量数据、必要的公开来源说明和 QA。

但是：
- 不以规避追溯为目的销毁来源记录；
- 私有 provenance ledger 必须保留；
- 若发生来源争议，完整的“输入是什么 → 测了什么 → 如何独立替换 → 什么时候删除”记录是保护项目的重要证据。

## 10. 最终长期保留什么

最终长期保留：
- SHA256 与最小身份记录
- 权利/来源边界
- 自然/科学测量值
- 独立重建函数
- 骨骼与行为参数
- 生命周期曲线
- QA 结果
- provenance ledger
- 用户批准的最终生产资产

临时“看起来像”的第三方参考模型本身没有必要永久保存。

## 11. Fish Mother 当前应用

Original Fish / Reef Fish：
- 黑鲈、金枪鱼、guppy、shark、reef fish 等旧参考统一视为 N2 TRANSITIONAL_REFERENCE，除非有单独证据升级。
- 原模型只用于过渡性测量、行为/骨骼/材质观察。
- Original Fish 的最终身体、骨骼、生命周期、PBR 与行为必须由 N0/N1 自然/科学证据独立重建。
- 任何 Mother 不得把“源模型还在”当成生产依赖。
- 未来有足够自然影像/科研数据时，逐项替换 N2 派生假设。

## 12. 跨 Mother 强制规则

所有 Mother 收到用户文件时必须先完成“一次性入库 + manifest + ledger”，再进入实际生产。

用户不应因为换对话、换 Mother、换执行环境而重复上传同一 SHA256 对象。

若当前工具无法直接把会话附件推入 Reference Cache，必须保留 manifest 与明确阻塞，不能谎称已永久入库；一旦具备可写原始字节通道，应优先完成缓存入库。
