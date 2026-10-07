# KAOPU 小游戏生产线 · 失物招领局

记录日期：2026-10-07。
状态：已登记用户需求及可核验风格基线；Codex 先前玩法讨论尚未取得；未实现、未发布可玩游戏。

## 用户本轮明确指令

> 接着刚才在 Codex 上面的探讨，把小游戏工作台再加一个“失物招领局”的游戏。先阅读前面的讨论，用“铁路老司机”、原来“铁速列车”的风格来做。

用户随后提供了一张截图。当前记录没有取得可核对的截图讨论正文，不能把推测写成图片中的内容。

已明确：
- 新游戏名称为“失物招领局”。
- 加到原小游戏工作台，不另造总台或新仓库。
- 视觉沿用用户指定的原列车风格。
- 实现应承接此前 Codex 讨论；不能自行编一套规则替代它。

## 已读取的现有工程

仓库：`haihao0307/guilin-dem-pipeline`。
原发布分支：`gh-pages`。
本次开发分支起点：`dbc450fab6c15d85e5d97fcf3a823502d73c2343`。
本次开发分支：`work/minigame-lost-found-intake-20261007`。

原总台：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/
原列车：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/
原列车沉浸入口：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/?layout=immersive
原列车参考构图：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-minigame-workbench/voxel-train-study/?layout=reference

总台现有入口是“体素列车”和“风暴球体”；两个入口、路径、运行文件均须保留。

读取来源（固定提交）：
- 总台 HTML：`https://github.com/haihao0307/guilin-dem-pipeline/blob/dbc450fab6c15d85e5d97fcf3a823502d73c2343/kaopu-minigame-workbench/index.html`
- 列车 README：`https://github.com/haihao0307/guilin-dem-pipeline/blob/dbc450fab6c15d85e5d97fcf3a823502d73c2343/kaopu-minigame-workbench/voxel-train-study/README.md`
- 列车渲染代码：`https://github.com/haihao0307/guilin-dem-pipeline/blob/dbc450fab6c15d85e5d97fcf3a823502d73c2343/kaopu-minigame-workbench/voxel-train-study/app.mjs`

必须区分：上述 README 将现有列车定义为实时三维循环场景，明确尚无驾驶、任务、得分玩法。读取这份场景代码，不等于已经取得 Codex 中“铁路老司机”的完整游戏实现或“失物招领局”的讨论。

## 可继承的风格与技术锚点

以下为原代码的观察记录，不是新游戏已达到的效果：
- 实时三维体素造型，不用二维示意图或视频播放冒充三维。
- 页面与场景背景为 `#1b2425`；原总台使用暗绿灰、低饱和金色按钮、中文界面。
- 原渲染：Three.js r170，ACESFilmicToneMapping，曝光 1.0，sRGB 输出，PCFSoftShadowMap。
- 原透视相机视场约 25.051271 度，固定参考角度；自由观察为显式开关。
- 原半球光：天空 `0xd5e6ec`，地面 `0x273d30`，强度 1.4。
- 原主光：`0xffebc4`，强度 2.3，位置 `[1,18,12]`，阴影贴图 2048×2048。
- 原轮廓光：`0xc3dce4`，强度 0.7，位置 `[-14,8,-14]`。
- 原交互已有相机复位、自由观察、全屏/沉浸布局、响应式适配等可研究复用实现。

新场景的具体构图、物件尺寸和相机距离必须按实际内容验证；不能机械复制列车坐标。列车的六秒卷曲地景是该案例的场景逻辑，不自动变成“失物招领局”的玩法。

## 尚未取得的关键内容

在当前可访问的项目文件、历史聊天检索以及本仓库相关搜索中，未取得此前 Codex 讨论的可核验正文。

因此以下保持 Unknown，不填假设：
- 玩家身份、操作方式、核心玩法循环。
- 如何发现物件、如何辨认失主、如何交付物件。
- 成功/失败条件、是否有时限或计分。
- 场景布局、角色、关卡、物品清单及进度保存约定。
- 截图里的具体布局和讨论文字。

不得把其他项目的海岛求生、捕鱼、生物行为或人物系统检索结果当成这个游戏的需求。
不得先做限时找物、猜失主、经营柜台等自编规则，再声称它们来自用户或 Codex。

## 接续实施边界

取得原 Codex 讨论后，将原话和确定决定追加在本文件；不覆盖本轮记录。先区分用户决定、实施建议与未确认内容，再实现对应玩法。

修改范围仅限新游戏目录，以及通过测试后的原小游戏首页新增入口；原列车和风暴运行文件不改。

本次仅增加本记录，不改原首页，不显示虚假的“开始游戏”按钮，不替换在线旧版本。

Git 纪律：保留开发分支，Draft PR，不合并、不强推、不改写历史。

## 交付门槛

必须提供用户外部浏览器可直接打开的公开 HTTPS 页面；下载包、内部地址、仅本机地址和截图不替代网页。

验收分别记录：实际三维渲染、主要输入和玩法、版本标识、从原总台进入/返回、旧列车/风暴回归、桌面与手机视口、真实手机是否测试。

不得把 HTTP 200、文件存在、源码检查或发布成功当成视觉与交互全通过。

当前交付未完成：缺少 Codex 已确认玩法正文，游戏尚未实现，未进行新游戏浏览器或手机验证。
