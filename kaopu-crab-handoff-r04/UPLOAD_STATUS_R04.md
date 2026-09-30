# KAOPU Crab R04 上传状态

## 已建立的权威位置

- 仓库：`haihao0307/guilin-dem-pipeline`
- 分支：`handoff/kaopu-crab-full-context-r04-20260930`
- 目录：`kaopu-crab-handoff-r04/`

现有螃蟹项目已经有独立工作线，因此本轮没有转去人物项目，也没有在人形项目中另开分支。

## 已经可直接浏览的协调资料

- `README.md`：代理起点、两套老师的角色与冻结规则；
- `coordination/PROJECT_STATE_R04_ZH.md`：R01—R03 状态与用户最新裁决；
- `coordination/EXECUTION_ORDER_R04_ZH.md`：普通螃蟹一比一重构、骨架蒸馏、椰子蟹修正顺序；
- `coordination/BINARY_SOURCE_ASSET_GATE.md`：禁止虚报的大文件边界；
- `source_registry/SOURCE_REGISTRY_R04.json`：所有上传原件、工作台和全量包的尺寸、角色与 SHA-256；
- `animated_teacher/ANIMATED_CRAB_SUMMARY_R04.json`：普通螃蟹老师的网格、skin、126 个 joints、66 条动画通道及许可摘要。

## 文本全量包状态

`core_handoff/` 用于保存完整文本资料、脚本、审计、骨架层级、inverse bind matrices、权重统计、动画关键帧、glTF JSON 分片以及 R01—R03 的源码、状态和 QA。上传采用带 SHA-256 的可重组分片。

在 `CORE_HANDOFF_MANIFEST.json` 的所有分片都存在并通过归档 SHA-256 校验之前，不得把该归档标记为完成。`text_handoff/` 和 `text_handoff_v2/` 是前两次分片尝试，不是权威全量包，协调代理应忽略它们。

## 尚未进入 GitHub 的大型二进制

当前 GitHub 连接不接受本地挂载文件直接作为附件，因此以下大文件尚未真正进入 GitHub：

- `crab+3d+model.zip`；
- `animated_crab_rigged_free.zip`；
- `scene.bin` 和三张原始纹理；
- R01／R02／R03 全量 ZIP；
- 大型单文件工作台、PBR 图集和二进制表面谱。

它们的准确字节数与 SHA-256 已冻结在 `SOURCE_REGISTRY_R04.json`。后续必须通过 Git LFS、GitHub Release 资产或支持本地二进制上传的连接补齐；仅有同名文件不能视为同一来源。

## 可执行结论

Podas／其他代理现在可以先从本分支读取方向、工程边界、历史代码和老师骨架知识；要执行第二只普通螃蟹的完整一比一表面重构，仍必须取得与登记 SHA-256 相符的原始二进制源。
