# START HERE

这是小王负责的 Landscape Mother 全量交接包，版本为 2026-09-04 v2.0.0。

新对话接管顺序：

1. 读取 `FULL_HANDOFF.md`。
2. 读取 `CURRENT_STATE.json`。
3. 读取 `DECISIONS_AND_NONNEGOTIABLES.md`。
4. 读取 `VISUAL_FAILURE_REGISTER.md`。
5. 读取 `KNOWLEDGE/`。
6. 最后读取 `NEXT_TASK.md` 并直接执行。

仓库：`haihao0307/guilin-dem-pipeline`

生产分支：`feature/landscape-mother-field-graph-v002`

本包锁定的生产分支提交：`3110fbaedb5ba65ca5d8ed6c88830653e63acefe`

交接分支：`handoff/landscape-mother-full-20260904-v2.0.0`

当前公开入口仍加载 V016：

`https://haihao0307.github.io/guilin-dem-pipeline/landscape-mother/`

V016 已被用户明确否决。它只能作为失败样本和代码证据，不得作为视觉基线继续润色，也不得声称为阳朔葡萄峰林的合格表现。

当前正式判断：

`visualApproved=false`

`visualAcceptance=false`

`productionReady=false`

下一轮需要停止修补 V016 的旋转柱体语法，从真实峰林结构重新建立小范围彩色三维样板。工作只看主画面是否推进。研究记录、测试数字、提交数量和发布成功均不能替代画面进步。

默认交付真实可交互三维 HTML、程序化几何、函数代码、在线工作台和全量包。除非用户在当前对话明确要求，禁止进入图像生成或图像编辑流程。
