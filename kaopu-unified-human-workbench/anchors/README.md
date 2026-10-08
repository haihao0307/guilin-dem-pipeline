# 人物稳定能力锚点：ac9110f / 2026-10-08

这是修复前版本的可追溯保留点，保护已经工作的独立能力。它继承本目录既有的 SOURCE-LOCK、HEAD-ADAPTER-LOCK、runtime-metadata 和 archive 指纹机制。

**状态：源码/资产完整字节已核；21 个局部数值用例已运行；本包没有合格的整体验收截图。** 这里没有执行 Gram 矩阵、DINO 特征提取或训练，不应将版本/哈希锚点描述为已训练的 Gram loss。若后续增加特征锚点，应另立版本、明确参考图和提取器；不能替换本次已核字节证据。

## 文件

- ANCHOR-MANIFEST-20261008.json：精确提交、93 个工作台文件的 Git blob/SHA-256、运行时模块/资产与教师源版本、保护范围和排除项。
- NUMERIC-BASELINE-20261008.json：默认参数；13 个独立身体驱动用例、8 个独立 GNM 用例的参数变化与浮点数组哈希；档案、复位和固定缓冲区检查。
- DEFAULT-PROFILE-ac9110f.json：该版本默认参数档案。它不是用户私人参数的备份。
- UI-STATE-20261008.json：从源码提取的界面、相机、灯光、初始分类和按钮约定，尚非真实浏览器视觉验收。
- REGRESSION-CHECKLIST.md：修复前后保留要求、待验项和验收证据要求。
- verify_anchor.py：只读、仅 Python 标准库的完整字节检查器。不会下载、安装、修改或发布。
- SHA256SUMS：本锚点包中其他文件的完整字节摘要。

## 保护什么

固定拓扑 25,417 顶点 / 50,624 三角面，原始教师数据和代码，原身体映射，GNM 独立身份/表情通道，参数值保存/恢复，UI 布局及浏览操作，已有最小版入口。BodyDriver 用例在头部语义迁移和颈部处理之前取值，以免把待修头部锁死。独立 GNM 用例同样不包含 Anny/MHR 头部迁移。

必须允许有缺陷的头形来源独占逻辑、年龄/性别/老年和头部局部联动、MHR 头参路径以及不准确的“全参数”说明被修正。原全模型中性几何哈希只作诊断；不能单凭它变化而拒绝正确修复。源码中的历史“已验”字样也不构成本次独立验收。

用户错误截图 SHA-256 1a9d61571fd9d64bb2ecc54f4f2723e1553574f225408cdb291aecb2e8d9531b 仅作为失败证据登记，未复制或公开原图，明确排除合格整体验收锚点。白屏、加载页和生成图片均不能作为视觉通过证据。

## 可恢复指针

精确基线：`ac9110ffe78e2f77d15acd9f5da4d4790a147c36`。

- [精确版本目录](https://github.com/haihao0307/guilin-dem-pipeline/tree/ac9110ffe78e2f77d15acd9f5da4d4790a147c36/kaopu-unified-human-workbench)
- [原始 SOURCE-LOCK](https://github.com/haihao0307/guilin-dem-pipeline/blob/ac9110ffe78e2f77d15acd9f5da4d4790a147c36/kaopu-unified-human-workbench/full/SOURCE-LOCK.json)
- [原始运行时注册表](https://github.com/haihao0307/guilin-dem-pipeline/blob/ac9110ffe78e2f77d15acd9f5da4d4790a147c36/kaopu-unified-human-workbench/full/ui/runtime-metadata.json)

恢复时先在独立目录取该提交的目标工作台，按 manifest 获取既有依赖并检查完整字节。不要 reset/revert 整个 gh-pages 分支，也不要触碰兄弟项目。恢复旧版本会重新带回这里列出的头部缺陷；这是故障排查恢复点，不是推荐的最终交付。

原默认档案需要拓扑 SHA-256 `e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de` 和 adapterFingerprint `f975df925c5586eccaae60f61d888e5b1bcfa6200aad7d1763cb10ae3b736224` 同时匹配。修复版改了适配器后不能伪造旧指纹或静默覆盖用户档案；需要另行验证兼容迁移，保留原文件。

## 本地检查

从锚点目录运行（把示例路径替换为自己的只读副本）：

```sh
python verify_anchor.py --workbench /path/to/baseline/kaopu-unified-human-workbench
python verify_anchor.py --workbench /path/to/baseline/kaopu-unified-human-workbench --asset-cache /path/to/complete/runtime/full
```

第二条要求已有完整缓存，路径结构对应 manifest 的 runtimePath；不包含或上传这些大模型。若只运行第一条，资产阶段会明确报告未检查。检查器针对精确旧版本；修复候选本来就会有合法差异，须按检查表逐项评审，不可要求修复文件继续匹配旧哈希。

数值哈希为 Node v24.19.0、Linux x64、小端运行时下 typed-array 原始字节摘要。跨引擎差异要用相同状态、索引、坐标单位与实际最大/均方差做分析，不能把哈希不同直接等同外观退化。本包未推定跨引擎容差。
