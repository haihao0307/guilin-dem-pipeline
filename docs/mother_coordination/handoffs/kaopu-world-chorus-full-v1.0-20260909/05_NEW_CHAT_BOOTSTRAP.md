# 新对话启动词

把下面整段作为新对话的第一条消息。

```text
你现在接管“小妈靠谱世界大合唱 V1.0”。

仓库：haihao0307/guilin-dem-pipeline
交接分支：handoff/kaopu-world-chorus-full-v1.0-20260909
全量包：KAOPU_WORLD_CHORUS_FULL_HANDOFF_V1.0_2026-09-09.zip

先完整读取包内：
00_START_HERE.md
01_HANDOFF_STATE.md
02_SOURCE_LOCKS.json
03_ARCHITECTURE.md
04_PENDING_AND_NEXT.md
06_PACKAGE_SCOPE.md
07_PACKAGE_CHECKLIST.json

然后运行：
python verify_package.py

必须保留以下事实：

1. 这套共同语义与度量体系正式叫“靠谱”，机器标识暂用 KAOPU。
2. 世界是一场持续发生的大合唱。小妈是总指挥与 Judgment，各 Mother 是声部长，各 AGO 负责独立搜索、实验、质疑和验证。
3. 项目中的“造波”统一指完整的世界生成与重建算子体系，包含基础波、噪波、相位、频率、振幅、方向、旋转、尺度、域变换、调制、耦合、随机种子、时间演化、边界条件和必要残差。
4. 连续场进入带类型造波、场和残差。离散身份、事件、关系和证据依赖进入 Object Graph、Event Graph 和 Evidence Graph。
5. R1 语义章程冻结点为 cd9160ce90cd1c6c6a49f4fbb2ae1f2c55470330，只能追加新版本，禁止静默覆盖。
6. OpenAI Pilot Round 01 在 db985c179fafc50fb5bba9a88712f2194a9c9e49，Draft PR #69，Verifier 16/16 PASS。
7. 靠谱世界大合唱 AGO 对话实验在 65cb81d8f66ac2d2a08151d128bb52bd36f72da4，Draft PR #70，Verifier 20/20 PASS。
8. 两个实验仍是候选。真实温州谱页没有完成，正式靠谱 R2、productionReady 和 visualAcceptance 都是 false。
9. 当前不调用 Anthropic 或 Claude Code，不使用 Make 作为长期学习基础，不修改生产 Mother。
10. 研究节奏为小时级探索、当天判断、每日合并、每周大升级、达到条件随时冻结。

接管后直接从温州开始第一份真实靠谱地区谱。先选一个很小且来源清楚的真实谱页或对象，同时接入一个连续场、一个离散对象、两个独立 Observation Root、一个冲突或 Unknown、一个时间变化、一次带类型造波、一个公开 policy 的 Current Best View 和一个回滚点。

先报告包的 SHA-256、文件数量、验证结果、冻结点和 Draft PR 状态，再列出当天立即执行的第一批小问题。不要只回复接管成功。不要把候选状态说成正式完成。
```
