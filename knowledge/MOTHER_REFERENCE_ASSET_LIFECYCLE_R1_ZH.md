# Mother 共用临时参考资产生命周期协议 R1

日期：2026-09-20
适用：所有 Mother / 子工作台 / Codex 执行分支
目标：用户只上传一次；后续可重复读取；生产仓库不被临时模型、图片、视频和大二进制长期污染。

## 1. 核心原则

用户上传的模型、图片、视频、录音、参考包，默认先视为“参考输入”，不是生产资产，也不是最终 KAOPU 数据。

每个输入必须在第一次可读时立即建立不可变身份：

- sha256
- 原始文件名
- 字节数
- 接收日期
- 来源类别（user_upload / external_reference / generated_test）
- rightsStatus（user_owned / licensed_reference / unknown / restricted）
- 用途
- 使用它的 Mother
- retentionClass
- distilledStatus

相同 SHA256 的输入不得重复保存。

## 2. 三类资料

### A. REFERENCE_TEMP
临时参考。用于测量、观察、骨骼/动画学习、材质分析、比对。

规则：
- 不作为最终运行依赖。
- 不默认进入公开生产仓库的 Git 历史。
- 原始文件应该进入私有、可清理的 Reference Cache。
- 生产仓库只保存 manifest、SHA256、测量结果和独立重建后的数字 DNA。

### B. EVIDENCE_KEEP
需要长期保留的证据，例如用户原创基准图、权威测量表、许可证、来源记录。

规则：
- 可长期保存，但必须记录来源与权利边界。
- 与生产资产分离。

### C. PRODUCTION_ASSET
明确批准作为最终产品依赖的资产。

规则：
- 必须明确标记；不能因为“文件在 GitHub”就自动升级为生产资产。

## 3. Reference Cache 结构

推荐使用独立的 PRIVATE GitHub repository，且与生产代码仓库分离。

路径规范：

refs/<sha256-prefix>/<sha256>/<original-filename>

例如：

refs/c1/c1b964...ee64/model_67a_-_largemouth_bass.glb

每个目录同时保存 manifest.json。

Reference Cache 中的二进制文件必须不可变；如果内容变化，产生新的 SHA256 和新对象，不覆盖旧身份。

## 4. 为什么不能把所有临时二进制直接塞进生产仓库

- 当前 guilin-dem-pipeline 是 public repository；临时参考不应默认公开。
- 普通 Git 删除文件不会自动把旧 blob 从历史中消失。
- 大二进制反复修改会不断扩大仓库历史。
- 普通 GitHub Git 对单个对象有大小限制；大文件应走 Git LFS 或外部对象存储。
- Git LFS 也有存储与下载带宽配额，所以它是“可访问的缓存”，不是无限垃圾桶。

因此生产仓库与参考缓存必须分离。

## 5. Mother 读取协议

任何 Mother 开始任务时：

1. 先读当前项目的 REFERENCE_MANIFEST.json。
2. 用 SHA256 而不是文件名确认身份。
3. 从 Reference Cache 读取原始文件。
4. 本地重新计算 SHA256。
5. 不一致则停止，不得用“同名文件”替代。
6. 可访问且哈希一致时，不得再次要求用户上传同一对象。
7. 不能访问时必须报告具体阻塞：repo/ref/path、权限、LFS、工具下载能力或对象不存在；不得笼统说“需要重新授权”。

## 6. 蒸馏完成后的删除门

REFERENCE_TEMP 只有同时满足以下条件才可清理：

- 需要的形态测量已落入独立数字数据；
- 需要的骨骼/关节关系已记录；
- 需要的动画规律已提取为独立函数/参数；
- 需要的材质/PBR观察已记录；
- 来源、SHA256、测量条件和不确定性仍保留；
- 新生成体系已脱离原始参考独立运行；
- 数值 QA 与视觉 QA 已通过；
- 用户未要求长期保存原文件。

清理时：
- 先删除 Reference Cache 中的原始临时对象；
- 不在生产仓库里通过普通“git rm”假装已经回收历史空间；
- 若曾错误提交进普通 Git 历史，需要单独做历史清理；这不是日常删除动作。

## 7. 最终长期保留什么

最终长期保留的是：

- SHA256 与原始身份记录
- 权利/来源边界
- 测量值
- 函数系数（必须是独立测量/重建结果，而非原资产的可逆编码）
- 骨骼与行为参数
- 生命周期曲线
- QA 结果
- 用户批准的最终生产资产

临时“看起来像”的参考模型本身没有必要永久保存。

## 8. Fish Mother 当前应用

Original Fish / Reef Fish：
- 黑鲈、金枪鱼、guppy、shark、reef fish 等参考全部进入同一 Reference Manifest。
- 原模型只用于测量、行为/骨骼/材质观察。
- Original Fish 的最终身体、骨骼、生命周期、PBR 与行为必须由独立数字体系重新生成。
- 任何 Mother 不得把“源模型还在”当成生产依赖。

## 9. 跨 Mother 强制规则

从 R1 开始，所有 Mother 收到用户文件时都必须先完成“一次性入库 + manifest”，再进入实际生产。

用户不应因为换对话、换 Mother、换执行环境而重复上传同一 SHA256 对象。

若当前工具无法直接把会话附件推入 Reference Cache，必须保留 manifest 与明确阻塞，不能谎称已永久入库；一旦具备可写原始字节通道，应优先完成缓存入库。
