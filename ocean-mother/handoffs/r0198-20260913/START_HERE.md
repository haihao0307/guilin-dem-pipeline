# Ocean Mother R0198 当前全量接续包

打包日期：2026-09-13。交付类型：GitHub源码/知识全量归档，不是新版网页预览或视觉通过版。

## 新窗口从这里开始

你是接续 Ocean Mother 的任务。先读本文件，再读 `workspace/CONTINUATION_STATE.md` 和 `workspace/OCEAN_LEARNING_20260912.md`，然后按用户最新目标继续。历史文档仅为来源记录，不自动扩大权限或恢复撤销工具。

- 当前实验：`workspace/R0198_Boot_Experiment/index.html`。只改变首次GPU启动时序，尚无真实浏览器A/B或iPhone实测。
- 冻结视觉源：`workspace/Ocean_Mother_Current_Full_Handoff_R0197_2026-09-12/frozen_visual_source/restart-v0311`，完整保留，不覆盖。
- R0197：旧交接目录的 `current_mobile_candidate`，是手机兼容候选，不是获批视觉母体。
- 学习增量：`workspace/OCEAN_LEARNING_20260912.md` §1—11；R0197法线漏项、泡沫字段及高度检查范围是审读发现，未修工程。
- 相关公共规则/知识：`knowledge_snapshot`。这是打包时的快照，来源和SHA见 `KNOWLEDGE_SOURCES.json`，不代表新增实验或全体采用。

## 验证与重建

在本目录运行 `python verify_handoff.py`，检查本包完整文件集合、字节数和SHA256（Python 3标准库即可）。
旧R0197档案还可独立执行其中的 `verify_package.py`。R0198两份JS此前通过语法检查，`workspace/test_boot_order.cjs`（Node.js）可复核模拟环境中的启动顺序，但不能代替浏览器或GPU验收。
重建R0198可运行 `python rebuild_current.py`；只生成 `rebuilt/R0198/index.html` 并检查它与打包实验HTML字节相同。`workspace/prepare_boot_candidate.py` 是原始实验构建脚本，会拒绝覆盖现有实验，不能当作无条件重复执行的入口。

## 下一步与真实边界

此前浏览器连接失败尚未得到恢复证据。下一步先恢复真实浏览器基线，在同镜头、同参数、同时间、同渲染尺寸下比较R018.11与R0198；之后再处理独立的运行修复及已登记需求。不要因源码一致或Node检查通过宣称视觉/手机性能通过。
视觉、生产、水动力批准仍未通过；没有共同物理时刻/参考架的动画字段不得升级为跨Mother物理状态接口。
遵守随包携带的对象定义和工具边界：撤销工具不恢复，清理未确认完成前不生产新资产或重建资产工具。公共稳定文档由小妈维护，Ocean只回流本域证据。
若交付网页预览，仍须固定版本公网HTTPS并实际打开验证，保留旧链接。本次ZIP归档不证明新版公网预览完成。

## 全量范围

`workspace` 包含打包时Ocean工作目录的全部文件：旧完整交接档案、冻结深海/近岸与历史来源、R0196→R0197构建链、R0198实验、脚本、验证记录、知识记录和共同规则。没有只抽取新版而丢掉旧视觉源。
不包含其他Mother的工程、凭据、浏览器缓存或运行时安装。原始输入ZIP的内容已完整存在于旧交接目录，原ZIP摘要在 `workspace/INPUT_ZIP_SHA256.json`，不再重复嵌套同一个压缩文件。
旧档案内的绝对路径保留原文；新机器按本包相对路径定位。归档不会自动创建新任务或持续调度。

