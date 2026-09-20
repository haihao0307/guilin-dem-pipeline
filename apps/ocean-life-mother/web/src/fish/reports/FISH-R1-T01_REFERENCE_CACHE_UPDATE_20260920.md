# FISH-R1-T01｜Reference Cache 接续回执

日期：2026-09-20  
生产分支：`work/fish-r1-t01-source-gate-20260919`

## 已核验

私有缓存仓库已经创建并可由当前 GitHub 连接读取和写入：

- repository：`haihao0307/KAOPU-REFERENCE-CACHE`
- visibility：`private`
- default branch：`main`
- bootstrap commit：`b43c2d3c6c51d071a1ce4e2f1970bd0ea4d109cd`
- Git LFS 跟踪规则已覆盖 GLB、图片、视频、ZIP 等大型参考类型

已读取并采用：

- `knowledge/MOTHER_REFERENCE_ASSET_LIFECYCLE_R1_ZH.md`
- File Library 中的 `KAOPU_DAOFAXIRAN_ORIGINAL_FISH_CORE_20260920_ZH.md`
- cache repo 的 `README.md`、ingest/cleanup policy、manifest template、ledger template 和 registry

## 本轮实际写入

已在私有 cache 中登记 `FISH-REF-001`：

- SHA256：`c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64`
- manifest：`refs/c1/<full-sha256>/manifest.json`
- intended binary：`refs/c1/<full-sha256>/model_67a_-_largemouth_bass.glb`
- ledger event：`REGISTER_PENDING`
- registry state：`REGISTERED_PENDING_BINARY_INGEST`

原始 GLB 字节尚未写入。没有把历史文件名、旧解析报告或相似鱼替代成实际二进制入库。

## 用户入口

用户可以把模型、图片、视频或压缩包直接发到当前对话，不必进入 GitHub 仓库页面手工组织 SHA 路径。

执行端收到可读字节后先完成：

1. 计算 SHA256；
2. 与现有 registry 去重；
3. 检查文件身份和权利边界；
4. 写 manifest 与 ledger；
5. 在具备 LFS-capable 写入路径时，把原始大二进制放入私有 cache；
6. 生产仓库只保留指针、测量、独立函数和 QA。

当前连接器可写 GitHub 文本与普通 Git 对象，但不能诚实地把一次 REST 二进制写入声称为 Git LFS 上传。因此大型文件的永久二进制入库若受该限制阻断，必须保留精确 manifest 和 blocker，只请求用户补交那个单一文件或使用 LFS-capable Git 客户端；不得要求用户重讲全部项目需求。

## 任务状态

- Reference Cache linkage：`ACTIVE`
- FISH-REF-001 metadata registration：`DONE`
- FISH-REF-001 exact binary ingest：`PENDING`
- FISH-R1-T01 anatomy correction：`BLOCKED_PENDING_EXACT_BYTES_AND_NATIVE_SOURCE`
- generic fish fallback：`PROHIBITED`
- FISH-REF-002 tuna queue：`PRESERVED`
