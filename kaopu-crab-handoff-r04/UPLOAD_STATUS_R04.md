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

## 已完成：两份老师原件入库（2026-10-01）

用户提供的 `KAOPU_CRAB_TWO_TEACHERS_20261001.zip` 已通过 Git LFS 存入既定私有来源分支。总包为 49,939,832 字节，两份内部原始 ZIP 均与冻结清单的字节数和 SHA-256 完全一致。

已完成真实远端验证：
- GitHub 自动老师原件校验通过；
- 在全新验证目录中，独立从 GitHub LFS 下载完整总包；
- 总包 SHA-256 和两个原件成员的 SHA-256、字节数均重新核对通过；
- 本地已读取真实普通螃蟹 BIN，核实 51,686 个顶点、92,491 个三角面、126 个 joints 与 inverse bind matrices、66 条动画通道；
- 修复后的核心交接包全部 11 个分片和归档哈希通过，16 个文件已恢复，内部清单的 15 项文件哈希全部通过。

这次入库保存的是老师原件，不能视为新的程序化螃蟹成果，也不构成静态形体、动作或生产验收。

## 仍缺：历史全量成果 ZIP

R01、R02、R03 的历史全量 ZIP 没有包含在用户提供的双老师总包内，仍保留独立待补状态。老师原件校验与历史快照校验分别记录，不把历史全量包描述成已上传。

## 当前可执行结论

两份老师原件已真实入库并完成远端字节回读。完整表面重构所需的普通螃蟹 glTF、BIN 和三张纹理均已从原始 ZIP 取得并匹配登记哈希，先前的老师原件缺口已解决。

下一步仍按冻结顺序执行：先完成普通螃蟹完整静态表面的一比一程序化重构及误差对照；静态验收后再学习骨架、蒙皮与动作，最终返回椰子蟹自己的外形与连续表面。R03 不得升级为已批准的视觉或动作基线。
