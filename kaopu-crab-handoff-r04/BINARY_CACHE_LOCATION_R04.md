# Crab R04 私有来源资料库位置

## 权威位置

- 公共生产与协调仓库：`haihao0307/guilin-dem-pipeline`
- 公共分支：`handoff/kaopu-crab-full-context-r04-20260930`
- 私有老师资产仓库：`haihao0307/KAOPU-REFERENCE-CACHE`
- 私有来源分支：`intake/crab-r04-source-assets-20261001`
- 私有目录：`crab-r04/`

## 已经真正进入私有库的内容

- 两套老师的职责与不可混用规则；
- 全部来源文件名、字节数和 SHA-256；
- Git LFS 路由；
- Linux/macOS 与 Windows 精确上传脚本；
- 自动校验工作流；
- `core-handoff-fixed/`：11 个完整分片、清单、重组脚本和 SHA-256，可恢复 Crab R04 核心源码、审计、glTF JSON、骨架层级、inverse bind matrices、权重统计、动画通道和 R01—R03 状态资料。

`core-handoff-fixed/` 替代并废止本公共分支中不完整的 `core_handoff/`、`text_handoff/` 和 `text_handoff_v2/` 分片尝试。

## 仍需完成的原始大二进制

以下文件只有在私有库对象真实存在，而且字节数与 SHA-256 同时匹配时，才算完成上传：

1. `crab-r04/sources/coconut-crab/crab+3d+model.zip`
2. `crab-r04/sources/animated-ordinary-crab/animated_crab_rigged_free.zip`
3. `crab-r04/history/KAOPU_CRAB_SURFACE_R01_FULL_20260930.zip`
4. `crab-r04/history/KAOPU_CRAB_LIFE_R02_FULL_20260930.zip`
5. `crab-r04/history/KAOPU_CRAB_LIFE_R03_FULL_20260930.zip`

准确哈希以私有分支中的 `crab-r04/SOURCE_ASSET_MANIFEST_R04.json` 为唯一依据。文件名、链接、指针或校验码本身都不能代替文件本体。

## 后续代理入口

Podas 或其他代理应先读取本公共分支的 `kaopu-crab-handoff-r04/README.md`，再读取私有来源分支的 `crab-r04/README.md` 与 `crab-r04/SOURCE_ASSET_MANIFEST_R04.json`。未经哈希验证，不得把同名模型作为权威老师。
