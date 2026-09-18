# Stone Money Island / Survivor: Palau — 新对话从这里接手
交接日期：2026-09-18。当前可运行版本：**v0.2.2**。本次完整项目归档只整理和验证已有成果，不更改玩法、排程或冻结源。

## 唯一当前入口
仓库：https://github.com/haihao0307/guilin-dem-pipeline
游戏开发分支：work/stone-money-island-v0220-reef-reference-20260918
已验证固定源码与证据提交：bff5069a9ede793b8714fd9f327903872021a3b8
本次交接分支：handoff/stone-money-island-v022-20260918
当前在线候选：https://haihao0307.github.io/guilin-dem-pipeline/games/stone-money-island/v0.2.2-d37d6fcb/index.html
草稿PR：#82，未合并；#81为此前鱼退水修复。默认分支和其他Mother生产分支不是本次接续起点。

先读本文件、HANDOFF_STATE.json和REFERENCE/GAME_LIVING_ISLAND_G05.md，再读源码。包内旧README、docs/START_HERE.md、STONE_MONEY_ISLAND_START_HERE.md及早期release文档是历史背景；其“当前入口”不能覆盖本文件。源码目录名仍叫v0200，当前build.py实际生成v0.2.2。

## 用户目标与已明确的方向
在既有Ocean/天空/海岛基础上推进单人生存、探索、钓鱼与隐蔽求救游戏。原创岛屿从用户提供的Stone Money Island/Palau实景学习，可更奇幻、更丰富，不做测绘复刻，不把虚构故事冒充史实。
近期视觉重点：岛岸接宽浅礁盘；白沙和珊瑚覆盖区别；大小不一、部分相连的深潭与水道；外礁缘碎浪带与向深海外坡；之后丰富有层次的热带林冠、珊瑚、鱼群、海鸟和互动乐趣。Microscope/连续噪声/warp用于真实表面起伏与有条件的材质表达，不能只画黑斑冒充深洞，也不能以噪声关联宣称真实物理机制。
故事候选：1944年10月盟军侦察机飞行员遇机械故障后漂到原创海岛，生存、抓鱼/钓鱼、椰子和食物、避开巡逻；无线电初坏，后续修复并发出求救，最终PBY营救。首版不要飞机残骸。半年经历、二十组鱼、海鸟/海龟/植物/珊瑚、无线电修复和营救均不是当前全部实现的功能。
用户授权持续推进并作阶段回报，但不能把其他对话的母体状态、后台执行或已发通知自行编造。

## 本版实际做到了什么
- 现有第一章：第一人称行走、物品拾取、木矛制作与几何命中抓鱼、椰子使用、背包、洞穴休息与天数、本地存档；巡逻视线/失败为有限候选，无线电只有损坏检查。
- 鱼退水：替换原固定轨迹+错误高度钳制；根据当前水域净空和局部前瞻移动。保留12个稳定鱼ID；捕获、暂停、时间推进和恢复存档回归通过。
- 五个既有礁坑由reef_reference.py统一CPU与近岸GLSL参数/轮廓；原CPU海床形状保持。
- 原始冻结Ocean、天空与worker内嵌字符串逐字不变，没有换海、降网格、减少原几何精度。
- 整片照片式礁盘、真实悬顶/拱洞、新增林木与珊瑚、完整鱼鸟群生态和救援章节尚未完成。别把“包已完整”写成“游戏内容已完整”。

## 下一步的有限任务
先在当前地形上落实一个连续可读的“岸—浅礁—不规则连通深潭—礁缘—外坡”场景段，再加林冠/珊瑚与玩法。保留现有相机、鱼ID、捕获和存档；不要从零另起岛或回退至v0.1.4.1。
Ocean/Game负责水域、潮位、鱼可达性和交互；Landscape/岩体工具负责真实凹凸、通道与需要时的三维洞顶；Plant负责有尺度依据的树冠分布。相关知识已入G05，**没有其他Mother接收/采用回执，也没有任意会话主动投递接口证明**。不得把临时子代理算成Mother。
鱼不是在变浅时压低到海床中：提前退向有足够水深且可达的水域。本实现只作0.8米/2秒前瞻与采样检查，无真实水流速度场，不是任意地形全局路径保证。继续改地形必须重验退路。
照片无测深/树高标定。用户高潮覆水一米多、不足两米是礁面局部描述，不是全海域潮差；不同深度范围分开记录。树高、洞剖面和具体树种未知时保留Unknown。原始照片不在公开包内；已观察结论和逐图说明见G05，下一对话需看原图时由用户重附或在其有权访问的文件中定位，不能假称已看图。

## 包内结构与构建
完整包含games/survivor-palau目录的源码、既有release依赖与文档；另含相关发布/验证脚本、仓库约束、当前G05、文件清单和固定版本状态。
**不可删的构建依赖**：
games/survivor-palau/releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html
SHA256 dac1a80440d731488546b317ff8f286c55c8c63d5a2e9f1da3f8c900bbbc4710
当前入口HTML SHA256 d37d6fcbbb89184f3a4db40bff3a3a06fb3fb45d15c0c738b4bec8a47e099505
冻结HTML为当前生成链输入，不因它版本旧就删除。完整Guilin DEM、TIFF和整个单仓库其他项目不是本游戏的构建依赖，未装包。contracts/PRODUCTION_CONTRACT.json属于桂林真值约束，不能当Palau实测坐标/高程。

需要Python 3与Node。从解包根目录执行：
```bash
node games/survivor-palau/source/v0200/fish_wet_navigation.test.cjs
python games/survivor-palau/source/v0200/build.py
python games/survivor-palau/source/v0200/verify_reef_reference.py
```
输出 games/survivor-palau/releases/v0.2.2/index.html。包内MANIFEST.json列明每个输入文件sha256。
当前浏览器回归入口为verify_fish_browser.py和.github/scripts/stone-money-public022.py，依赖Python Playwright与Chromium/Chrome；普通入口与QA鱼回归必须分别检查。旧v0200/verify.py写死旧v0.2.0，不当当前验证器。
发布脚本/工作流硬编码原仓库和分支，能写gh-pages：新对话先读后运行，不盲目搬到其他仓库或直接触发。包内保留源码，不意味着自动化计划也被迁移。
构建会把BUILD_RECEIPT.publicVerified写为false，这是构建状态；最终公网状态读取PUBLICATION_PROOF.json，不以一个字段相互覆盖。本地构建不替代固定公网与真实浏览器，用户不接受localhost/下载HTML预览。

## 已验证及边界
11项确定性鱼导航测试；21,025个CPU孔洞等价坐标（620有效点）；真实Chromium桌面及触屏模拟：普通行走、蹲下、背包、音频、WebGL；魚捕获、暂停、连续120秒桌面/30秒触屏采样、每端另180秒推进及准确存档恢复。捕获1条后仍为11条活鱼，原ID不变。
证据位于releases/v0.2.2/。实际成功运行35321546695，归档35321849294。先前取消运行不算通过。GPU软件渲染/触屏模拟不是实体iPhone/Safari或硬件性能验收；CPU/GPU浮点与解析床面/三角插值不宣称完全一致。visualAcceptance与productionReady保持false。

## 真实三维状态（继承已核查v0.2.2；本轮仅归档，不新增玩法）
- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；（继承v0.2.2已有修改）
- [x] 用户看到的是可交互三维工作台；
- [x] 画面来自实时三维运行时；
- [x] 镜头、控制和现有交互可以实际操作；
- [x] 公网固定链接和真实浏览器已验证；（桌面与触屏模拟，非手机实机）
- [x] 如果只有截图而没有工作台，本轮判定失败。
人工visualAcceptance=false，productionReady=false；不能自动改为已接受。

