# KAOPU Crab R04 上传状态

## 已建立的权威位置

- 公共生产与协调仓库：`haihao0307/guilin-dem-pipeline`
- 公共分支：`handoff/kaopu-crab-full-context-r04-20260930`
- 公共目录：`kaopu-crab-handoff-r04/`
- 私有老师资产仓库：`haihao0307/KAOPU-REFERENCE-CACHE`
- 私有来源分支：`intake/crab-r04-source-assets-20261001`
- 私有目录：`crab-r04/`

现有螃蟹项目已经有独立工作线，因此没有转去人物项目。

## 已完成

### 公共协调层

以下资料可直接读取：

- `README.md`：代理起点、两套老师角色与冻结规则；
- `coordination/PROJECT_STATE_R04_ZH.md`：R01—R03 状态及用户最新裁决；
- `coordination/EXECUTION_ORDER_R04_ZH.md`：普通螃蟹一比一重构、骨架蒸馏、椰子蟹修正顺序；
- `source_registry/SOURCE_REGISTRY_R04.json`：当前会话中所有关键原件和成果的字节数、角色与 SHA-256；
- `animated_teacher/ANIMATED_CRAB_SUMMARY_R04.json`：普通螃蟹老师的网格、skin、126 个 joints、66 条动画通道和许可摘要；
- `BINARY_CACHE_LOCATION_R04.md`：私有来源资料库和后续代理入口。

### 私有来源缓存层

已经完成：

- 独立私有分支；
- 两套老师及历史全量包的准确路径、字节数和 SHA-256 清单；
- Git LFS 路由；
- Linux/macOS 和 Windows 精确上传脚本；
- 自动校验工作流；
- `core-handoff-fixed/` 完整核心交接包：11 个分片全部存在，清单声明 86,092 个 Base64 字符，可恢复 64,568 字节归档；归档 SHA-256 为 `4619d1a1589344979ef299e1fbcf83576c191a6a475b44b9435e1d9d2e54b0b3`。

这个完整核心包取代公共分支里此前不完整或尺寸不一致的 `core_handoff/`、`text_handoff/` 与 `text_handoff_v2/`。后续代理必须忽略旧分片。

## 尚未完成：原始大二进制本体

以下文件仍未成为 GitHub 中真实存在且通过 SHA-256 校验的对象：

- `crab+3d+model.zip`；
- `animated_crab_rigged_free.zip`；
- R01、R02、R03 三个全量 ZIP。

当前聊天 GitHub 写入接口只接受文本内容，不接受 `/mnt/data` 本地文件参数，也没有 Release 资产上传动作。因此不能把本地大二进制直接送进 GitHub。私有分支已经准备好 Git LFS 接收路径、校验脚本和 CI；必须由能够同时访问这些本地文件和 Git 凭据的环境执行一次 LFS push。

任何“同名文件”“下载链接”“LFS 指针”或“SHA-256 记录”都不能被描述成二进制已经上传。只有私有库中的对象存在，并且自动校验通过，才算闭环。

## 当前可执行结论

Podas 或其他代理现在已经可以完整读取项目方向、历史代码、审计、glTF JSON、骨架层级、inverse bind matrices、皮肤权重统计、动画通道和执行顺序。要重新从老师原始完整表面取样，仍需补齐与清单 SHA-256 完全一致的原始 ZIP 本体。
