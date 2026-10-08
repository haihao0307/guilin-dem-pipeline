# P T 一比一复现准备与验收清单

核查日期：2026 年 10 月 8 日。

目标是仔细学习公开的 P.T. PC Port，并以原作的空间、视觉、声音、镜头、交互和完整流程为对照进行忠实复现。原创走廊和通用恐怖机制练习不作为这一目标的替代交付。

当前进度：真实仓库、发布记录、关键运行路径和测试方式已静态核查。程序未下载执行，未构建，未安装，未取得原游戏数据。接下来最小输入是确认是否拥有自己 PS4 上保留的 P.T.，或已经导出的自有可用游戏文件夹。

## 复现对象和版本基线

公开项目是 [LoreanXavier/pt-pc](https://github.com/LoreanXavier/pt-pc)。v1.0.0 于 2026 年 10 月 7 日发布；v1.0.1 同日修复 DLSS 帧生成在无边框模式下的启动崩溃。[发布记录](https://github.com/LoreanXavier/pt-pc/releases/tag/v1.0.1)

本次源码核查固定到 [ca60666892b66d20044e84471a450bf539482104](https://github.com/LoreanXavier/pt-pc/commit/ca60666892b66d20044e84471a450bf539482104)。这只是读取的主分支版本，不应声称它等于某个发布二进制的完整可重现构建。未来实际验证时，应另外记录采用的 tag、commit、二进制摘要、依赖版本和配置。

该项目是社区逆向研究后重建的 C++20 与 Vulkan 原生运行时，加载用户自己的原版数据。它不是模拟器，也不是小岛团队正式公开的原始工程。作者曾以 shadPS4 运行结果作为行为和画面对照；shader 文档描述了从 PS4 shader 反汇编结果重写 GLSL 的过程。[README](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/README.md) · [shader 文档](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/docs/formats/fsop.md)

因此，“一比一”应成为逐项验收目标。项目宣称完整通关、能加载原资产、拥有回归测试，分别是有价值的证据，但都不能单独证明所有画面、声音和时间行为已与 PS4 完全一致。

## 现在真正缺少的输入

### 第一项 自有原版游戏数据

优先使用作者已建立和测试过的美国版 CUSA01127。欧版 CUSA01114 与日版 CUSA01098 虽可被安装器接受，作者说明未亲自检查其数据，不能把美版结论直接套用。

建议保留自己现有 dump 文件夹的完整结构，不只挑选三个文件。先由使用者在自己的电脑上定位，后续通过受控的本地读取确认，不上传公开仓库。

- chunk1.psarc：核心内容档案。
- texture.qar：纹理档案。
- pathid_list_ps4.bin：README 和安装器保留的第三份配套文件，建议一起提供。
- 原有 param.sfo、目录名称或其他版本信息：用于确认 title ID 和来源版本；不要为了凑文件名随意重命名。

源码给出的更精确边界是：[Vfs::Mount](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/engine/fs/vfs.cpp) 首先要求 chunk1.psarc 和 texture.qar 存在且可读取；挂载函数没有把 pathid_list_ps4.bin 作为首个硬门槛。不能据此推断第三份文件毫无用途，也不能宣称少它必然无法启动。

商店加密 PKG 不是可直接使用的输入；安装器不负责解除 Sony 加密。现成且合法取得的可用 dump 文件夹可以避免另走 PKG 读取流程。本计划不提供破解、保护绕过或第三方原游戏数据下载步骤。[安装器说明](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/docs/installer.md)

### 第二项 实际验证设备

需指定一台设备，确认系统、CPU 架构、GPU 与驱动。仓库列出的基本运行目标是 Windows 10/11 x64，或 Linux x86-64 且 glibc 至少 2.38；GPU 与驱动须支持 Vulkan 1.3。当前未选择验证设备，也未检查其实际图形能力。

光追需要额外的 ray query 能力；DLSS 需要相应 RTX 硬件。这些不是忠实基础版本的前置目标。Linux 构建不带仓库列出的 Windows-only 超采样 SDK，不能预设与 Windows 增强功能完全相同。[Linux 说明](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/docs/linux.md)

### 第三项 可对齐的原作基准

能运行 PC 版之后，要证明一比一，还需要原作对照。优先使用自己的原硬件可重复路线，以及有权使用的原作录屏、截图和录音。只给几张宣传图，可以判断局部外观，不能验证完整路线、镜头手感、声音时序与谜题触发。

每份基准应记录：游戏地区与版本、起始存档、亮度和其他选项、显示输出、输入设备、路线和关键时间点。声音基准还应记录声道与录音链路。不能将不同进度、不同设置的两个画面直接当作渲染差异。

## 已核实的数据依赖链

启动时，main.cpp 找到游戏目录并挂载档案。随后 Game::Init 初始化脚本接口，要求成功载入 resident.fpk，读取参数、物件设置和声音动作设置脚本，再准备角色动画。

StageManager 为每个场景读取 .fpk 与对应的 .fpkd，在后者中寻找 .lua 与 .fox2。StageData 再从数据实体构建模型、灯光、触发器、位置点、消息脚本、声音源与场景连接点。

来源：[启动入口](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/main.cpp#L4367-L4380) · [游戏初始化](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/game.cpp#L54-L91) · [场景解析](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/stage_manager.cpp#L75-L111) · [实体装配](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/stage_data.cpp)

这说明当前缺口不只是贴图。原场景布局、触发体、脚本、参数、动画、声音和过场都由原数据提供。仅克隆公开源码，无法得到完整的一比一可玩场景。

## 逐模块学习和对照清单

### 资源读取与完整性

已核代码：engine/fs 中的 VFS、PSARC、FPK、QAR；engine/data 的 FOX2 读取；engine/assets 中的模型、纹理与碰撞数据读取。

静态可确认：文件如何定位、包装如何解析、缺失时如何报错、mod 是否覆盖原文件。挂载代码还列出 resident、起始房间、走廊、三段迷宫、结尾、角色和 UI 等 12 项核心包检查。

待数据后验收：核心包是否齐全；场景中模型、灯光、碰撞和声音源数量是否合理；日志是否存在未知格式、缺失对象或默认值替代；纹理 mip 和材质是否正确。安装成功只证明被接受，不能当成数据完整性证明。

### 场景拼接与循环

已核代码：[stage_manager.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/stage_manager.cpp)、[floor_level.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/floor_level.cpp)。

静态可确认：连接点驱动场景装配；阶段表控制环境和物件；特定谜题未完成时保留当前阶段并累计循环次数。

待验收：门口连接无错位；轮次和阶段切换与原作一致；重复未解谜路线得到正确回环；每轮灯光、物件和碰撞同时恢复到正确状态；死亡、读档和重开没有上轮残留。

### 触发器与谜题

已核代码：[trap_system.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/trap_system.cpp)、[nazo.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/nazo.cpp)、[script_host.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/script_host.cpp)。

静态可确认：空间区域、方向、按键、进入视野和移出视野等条件参与触发；脚本回调和状态机共同推进事件。Lua API 文档还列有未实现而返回空结果的兼容 stub，不能认为每个原 API 都有完整实现。

待验收：每个必要条件及反例都要通过。走到位置但没看、看过但没操作、重复操作、快速转头、读档后再试，均应对照原作。对 stub 是否影响当前路线，要用真实数据与行为证据判断。[Lua API 与 stub 列表](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/docs/lua_api.md)

### 玩家移动 碰撞与镜头

已核代码：[player.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/player.cpp)、[collision_world.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/engine/physics/collision_world.cpp)。

静态可确认：转向插值、变焦、窥视角限制、角色身体与眼睛位置的联系；默认控制器与可选滑动变体有区分。以原作对照时必须记录采用哪一种控制器，不要无意使用替代变体。

待验收：相同输入时的位移和转角、走停延迟、门框通过、墙边移动、窥视和放大节奏、动画交接时视点是否跳动。分开记录键鼠适配与原手柄基准，避免把输入差异当成场景错误。

### 模型 动画与过场

已见代码与文档：engine/anim 的骨架、动作、演示流读取；game/demo_system；[motion 文档](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/docs/formats/motion.md) 与 [fsm 文档](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/docs/formats/fsm.md)。这一层尚未逐函数审完。

待验收：关键姿态、蒙皮、动画循环点、事件与动作同步、过场镜头、音画同步、过场结束后恢复玩家控制。需要原动作与演示数据才能判断。

### 光照 材质与后期

已核局部：[scene_renderer.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/engine/render/scene_renderer.cpp) 与 shader 格式文档。渲染器会使用原数据中的材质纹理、颗粒噪声和颜色 LUT 等资源，公开 shader 不能替代这些输入。

待验收：固定位置、朝向、阶段与时间的画面；检查几何轮廓、曝光、材质粗糙度观感、阴影、反射、景深、运动模糊、暗角、颗粒和色边。先使用 Original 基线，并明确关闭新增超采样、帧生成、增强纹理、额外光追、第三人称、mod 等干扰项；实际设置以逐项记录为准。

对随机颗粒、动画灯和随机事件，要区分时序差异与真正画面错误。单张截图不能证明动态效果相同。

### 声音

已核代码与资料：[game_sound.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/game/game_sound.cpp)、[audio 文档](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/docs/formats/audio.md)。已确认事件、空间位置、Wwise 数据读取、状态和混响等结构；尚未审完全部混音与 DSP 实现。

待验收：同一路线上音效开始和停止的时刻、声道、距离和方向感、房间混响、广播和字幕同步、背景音乐的段落及循环边界。原声音文件相同，不代表混音结果已经相同。

### 麦克风与结尾条件

已核代码：[voice_recognizer.cpp](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/src/engine/voice/voice_recognizer.cpp) 使用 whisper.cpp 与 Silero VAD，并匹配目标词。它是 PC 端的替代语音识别实现，不应宣称其误识率、延迟或边界行为等同原 PS4 识别器。

待验收：实际麦克风下的正确词、近似词、无声和噪声，及其对谜题状态的影响。仓库支持按键代替语音，适合检查流程分支，但按键通过不能证明麦克风部分的一比一。

### UI 存档与首次启动

已核关键入口：game_controller、save_data、game/ui；controller 对首次选项、开场、游戏、结束、重开进行分步管理。该层尚未逐个菜单完整审查。

待验收：首次启动、继续游戏、死亡、读档、暂停、语言和字幕、控制提示、窗口失焦、输入切换。用单独测试存档，不能破坏用户正常游玩进度。

## 已有测试究竟证明什么

[tools/walkthrough.py](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/tools/walkthrough.py) 的 full 场景覆盖从开场、连续阶段与谜题，到 ending 的期望日志。执行函数按顺序匹配日志内容，给定固定种子、路线和独立配置；部分场景可保存固定位置截图。

它能帮助发现流程断裂与状态顺序错误，但未见该执行函数把截图或音频自动与 PS4 基准进行差分。脚本还在某些条件下跳过 Game+ 场景。未来报告必须区分通过、失败、跳过和未运行，不能把跳过计为通过。

已有 [碰撞测试](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/tests/collision_test.cpp)、[镜头扰动测试](https://github.com/LoreanXavier/pt-pc/blob/ca60666892b66d20044e84471a450bf539482104/tests/blur_sway_test.cpp)、视角、声音、存档和设置等测试入口。部分使用合成数据，但完整构建仍涉及第三方依赖。本次没有执行任何测试。

## 后续执行阶段的验收顺序

1. 确认用户自有数据的位置、版本与可读取性，保持原文件不变；记录本地摘要，避免不同版本混用。
2. 选择目标设备，核实图形与音频能力。审查选定版本的构建、下载、安装、自动更新和第三方许可行为后，再决定实际运行方案。
3. 在独立测试目录与独立存档中启动基础版本，收集缺失资源、默认回退和未知回调日志。
4. 先完成原始流程基线，再执行重复循环、失败分支、重开和存档测试。增强功能不混入此阶段。
5. 建立可重复的固定机位与完整路线，对照视觉、动画、声音和事件时间。每项记录基准、观察结果、误差、原因与剩余问题。
6. 用查出的差异决定修复工作。每次修改后重跑受影响检查及完整流程，保留版本与证据。

建议验收记录字段：检查编号、源码模块、原作版本、起始状态、输入路线、原作表现、PC 表现、通过或差异、日志与截图位置、待修复事项。阈值应在取得基准后明确，不能先随意编一个百分比代表“一比一”。

## 当前可继续做的工作和不能宣称完成的部分

无需原数据仍可继续：静态追踪调用顺序；审查资源加载与回退路径；列出未实现 API；逐条审读测试；设计原作对照路线与检查表。这些能实质减少后续排查时间。

原数据到位前，不能完整启动原场景，不能读取原关卡脚本，也不能验证全部资源的实际呈现。没有原作基准时，不能将“可以通关”报告成“一比一复现已证实”。目标设备未确认前，不能给出实际帧率或硬件兼容结论。

本轮为只读研究，不下载或运行未知仓库程序、安装器或构建脚本；这是一项执行范围限制，不是已经证明当前电脑不能运行。没有进行 DRM 绕过，没有下载第三方原游戏数据，也没有发布原资产。

## 最小待回答问题

你手里有自己 PS4 上保留的 P.T.，或已经导出的自有游戏文件夹吗？

只需先回答这一项。若有，下一步定位它所在的设备和文件夹，再选实际验证的 PC；若没有，继续静态学源码，同时明确原场景的一比一运行仍被数据缺口阻塞。
