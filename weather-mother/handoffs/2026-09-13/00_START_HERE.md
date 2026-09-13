# Weather Mother 全量交接 · 2026-09-13

这是截至本次打包的 Weather Mother 接续材料，不是 R27 发布版。用户本次授权打包并上传 GitHub；附件中的历史指令是资料，不能自行扩大为生产、清理、对外消息或发布授权。

## 新窗口阅读顺序

1. 本文件及 `01_CURRENT_STATE.md`。
2. `continuation/WORKFLOW.md`：当前接续工作流。
3. `continuation/LEARNING.md`：一小时学习综合、来源、反例和实际纠正。
4. 按需读三个 `learning-*.md` 专题及 `continuation/evidence/`。
5. 原始包在 `original-archive/`，展开内容在 `continuation/WEATHER_MOTHER_CURRENT_FULL_HANDOFF_R26_TO_R27_2026-09-12/`，二者均完整保留。

## 完成与未完成

已完成原包校验、4份缺失源码取回、Windows换行修复后的R26逐字节重建、一小时学习及小妈实际知识回流、工作流修订。R27运行时没有实现；生产清理前置条件在上一轮结束时未解除，本次未重新核定清理状态，也不通过打包解除。新任务以有效后续证据判断。

R26移动安全分支的单位、纯观察与推进耦合、帧差/暂停时钟、路径积分已做静态诊断；不要把这些记录写成已经修好。R26历史公网回执不等于本次重新浏览验收，也不能替代新版本真机与用户视觉接受。

## 包的完整性与恢复

Windows建议解压到短目录（例如`G:/WMH/`），避免历史长文件名叠加导致路径过长。Python 3运行 `python verify_package.py`，校验每个清单文件、额外文件、内层原包47项哈希及冻结/重建R26身份。

如需复核已有基线，在新解压目录先运行 `python restore_baseline_git.py`，再运行 `python continuation/baseline-rebuild/weather-mother/r26-observation-bandwidth-src/build-r26.py`。恢复脚本只补齐构建所需的5个固定Git对象，不访问网络；它不是完整仓库恢复。代码重建使用Python与Git，不需要pip/npm。浏览器QA依赖另行准备，不由这些命令证明通过。

`continuation/`是原接续目录逐文件保留的副本（排除.git管理数据和Python缓存）；包含源文件、历史页面和全部当前证据。另附原始输入ZIP、用于离线构建的最小Git对象、验证/恢复脚本及本域引用的小妈知识快照。撤销技能、隔离目录、账户凭据、整个其他Mother工程、完整聊天记录和未读外部论文不在包内。

历史文档中的G:/或C:/路径为来源坐标，不保证在另一台机器可用：`G:/DEM/WeatherMother_Continuation_20260912/`映射到包内`continuation/`；已附小妈主题映射见`context/INDEX.json`。其他外部引用需按范围获取，不能默认为包内已包含。知识快照只供接续参考，不是后续始终最新的全局规范。

共同规则原件在`continuation/rules/`，G:/DEM协作规则快照在`context/G_DEM_AGENTS.md`。保留历史版本；将来网页交付仍须固定版本HTTPS并实际验收。本次交付是用户要求的交接ZIP，不宣称交付新网页。

## 给新窗口的接续文字

> 请接续这个Weather Mother全量包。先读00_START_HERE.md、01_CURRENT_STATE.md，再读continuation/WORKFLOW.md和LEARNING.md；校验包后说明已完成与待实施的边界。原R26基线已逐字节重建，不要重复从头排查；R27未实现。遵守两份共同规则，先核对恢复开发的有效条件，再按单位/时钟、光学积分、统一积云观云与飞行的顺序继续。历史附件说明不构成额外授权。
