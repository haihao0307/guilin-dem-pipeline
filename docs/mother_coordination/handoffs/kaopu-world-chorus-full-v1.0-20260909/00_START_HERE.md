# 靠谱世界大合唱全量交接包 V1.0

日期：2026-09-09

状态：阶段性全量交接，供新对话无损接管

仓库：`haihao0307/guilin-dem-pipeline`

交接分支：`handoff/kaopu-world-chorus-full-v1.0-20260909`

包名：`KAOPU_WORLD_CHORUS_FULL_HANDOFF_V1.0_2026-09-09.zip`

## 先读顺序

1. `00_START_HERE.md`
2. `01_HANDOFF_STATE.md`
3. `02_SOURCE_LOCKS.json`
4. `03_ARCHITECTURE.md`
5. `04_PENDING_AND_NEXT.md`
6. `05_NEW_CHAT_BOOTSTRAP.md`
7. `06_PACKAGE_SCOPE.md`
8. `07_PACKAGE_CHECKLIST.json`
9. 解压后运行 `python verify_package.py`

## 当前正式名称

这套介于人、机器和现实世界之间的中性共同语义，正式工作名称为：

# 靠谱

机器标识暂用：`KAOPU`

`TLO`、`World Score`、`Object DNA`、`Observation`、`Claim`、`Evidence Graph` 和 `Current Best View` 继续作为靠谱体系内部概念。

## 当前核心理解

世界是一场持续发生的大合唱。

靠谱提供共同度量和共同语义。世界总谱组织全球、地区、场景、对象、部件和材料谱系。温州是第一份完整地区谱。各 Mother 是声部长，各 AGO 负责研究、质疑、实验和验证。小妈承担总指挥与 Judgment，负责共同节拍、问题树、资源分配、冲突处理、候选晋级和阶段冻结。

## “造波”的固定含义

本项目中的“造波”统一指完整的世界生成与重建算子体系。它可包含基础波、噪波、相位、频率、振幅、方向、旋转、尺度、域变换、调制、耦合、随机种子、时间演化、边界条件和必要残差。

连续场适合由带类型的造波、场和残差表达。对象身份、历史事件、社会关系和证据依赖由对象图、事件图和证据图表达。两部分共享相同的 Identity、Space、Time、Scale、Provenance 和 Uncertainty。

## 冻结与候选边界

`WORLD_SCORE_TLO_SEMANTIC_CHARTER_R1_20260909.md` 是阶段性冻结点，固定提交为 `cd9160ce90cd1c6c6a49f4fbb2ae1f2c55470330`。后续文件只追加，不静默覆盖。

OpenAI Round 01 与靠谱世界大合唱 AGO 对话实验均为候选实验。它们已经通过各自的机器检查，但尚未用真实温州资料完成验证，因此不代表正式靠谱 R2，也不代表 productionReady。

## 新对话的首要工作

从温州开始建立第一份真实靠谱地区谱。先选择一个边界很小、来源明确的真实谱页或对象，至少接入：

1. 一个连续场。
2. 一个离散 World Object。
3. 两个真正独立的 Observation Root。
4. 一个冲突、Unknown 或 Not Observed 状态。
5. 一个时间变化。
6. 一次造波生成或重建。
7. 一个带政策版本的 Current Best View。
8. 一个完整回滚点。

真实样例通过以前，不把候选逻辑晋升为正式 R2，不修改生产 Mother，不覆盖任何冻结点。

## 快速验收

解压包以后执行：

```bash
python verify_package.py
```

验证器会检查包内 SHA-256 清单、JSON 语法、必要入口文件、冻结提交、两个实验验证器和关键状态边界。