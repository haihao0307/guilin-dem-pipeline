# Stone Money Island · 石钱岛

本游戏原名 Survivor Palau / Palau Survival。显示名称固定为 Stone Money Island；现阶段继续使用 games/survivor-palau 路径，以免破坏旧版入口与来源链。

## 先读这一条

本项目是靠谱世界体系的首个海洋交响曲实例。世界对象的身份、生成定义、状态、共同时间、空间参考和相互关系是核心。禁止把项目带回传统资产拼接、LOD 或其改名包装路线。不要以删云、减少世界内容、换粗细模型代替研究表达和运行的问题。也不能把“代码生成、文件小、同画布”直接等同于完整靠谱闭环或已经达到手机高帧率。

用户 2026-09-17 指定：先原样接回最老、认可的 Ocean Mother 深海与云；同时建立白沙环岸、沙湾、海蚀岩岸的不同关系。明天提供的资料尚未进入本轮，不得声称已按尚未收到的资料拟合。

## 当前接续位置

- 基础游戏分支：work/survivor-palau-v0150-canoe-control-20260917
- 本轮分支：work/stone-money-island-v0160-original-ocean-20260917
- 构建：source/v0160/build.py，再运行 integration_checks.py
- 桥接：source/v0160/bridge.js
- 沙岸实例：source/v0160/world_patch.py
- 实测：source/v0160/verify.py
- 实时入口：releases/v0.1.6.0/Stone_Money_Island_V0.1.6.0_Direct_Open.html
- 所有旧版 release 与 Ocean Mother 冻结分支保持不变。

## 原版海天来源

从 7b6bba5f9affb9cfcfea5dabfafa5e7931bb492d 的 ocean-mother/restart-v0311/source/inline-0.js 提取 ORIGINAL_DEEP_HTML。

原件 SHA256：3498800d4bb287eadf448f01fb8fa8cf1b1f07eb3eab57f1428d824a62b55fd1。

source/v0160/frozen 保存逐字节一致的原 HTML、两个脚本、云与海面着色器、天气密度生成器及校验值。不得修改冻结资源来迁就游戏。当前适配处理画布、镜头参考 z+8000、共同时间、输出目标以及海岸读取同一云场辐射。原版海色、默认晴日海风参数和着色器保持不变；游戏终端不再对原版输出重复调色。

海岸与深海接续仍是待视觉/关系验证的候选，不得仅凭相同画布宣称所有水体关系完全正确。

## 本轮白沙与岩岸

建立西侧环沙岸、东侧沙湾、南侧环沙岸；其他离岸石灰岩保留直接接海关系。CPU 海床查询和 GLSL 使用同一组沙岸描述。修复原离岸石灰岩用深海海床作为中心高度、主体沉入水下的问题。

位置、数量、沙宽与岛形为可调场景候选，不是帕劳测绘数据。完整海蚀地貌规律及 Landscape Mother 的可采用对象定义仍待证据核对。珊瑚礁盘关系不能用一层颜色替代真实对象关系。

## 故事与乐趣（设计草案，不等于已运行）

用户设定：1944 年 10 月，盟军侦察机驾驶员机械故障迫降，漂流到海岛。玩家逐步学会在自然中生活、探索、钓鱼、利用椰子等资源，躲避巡逻并寻求隐蔽救援，最终由盟军 PBY 水上飞机营救。不恢复开场飞机残骸及残骸无线电零件回收任务。

乐趣主线是发现、理解、操作成功、建立生活能力和获救希望。不同鱼的收获应来自不同栖地、行为、尺寸、用途与观察发现，不是单纯按颜色兑换分数。物种、生态和食用用途需要分别有依据后再登记。

拟采用的奖励关系：首次观察与识别可增加自然笔记；完成一次真实钓获可以选择保留或放回；保留进入真实库存与后续烹饪，放回恢复该个体在世界中的活动。相同个体的反复捕获/放回不能无限刷首次发现奖励，不能既获得食物又把同一条鱼完整放回。奖励事件需要 actionId、objectId、worldTime 和前后状态，以避免重复结算。

椰子应从具体树及具体果实状态出发，采摘、落地、获得、打开和剩余物对应同一对象链。先不虚构成熟速度、产量和物种事实。

鸟、鱼与玩家应读取同一海面、海床、岩体及风场，而不是分别制造一套环境。观察与安静接近本身也应有反馈；不要让每种生物只是围绕玩家领奖而存在。

当前 V0.1.6.0 海天恢复步骤没有新增鱼群、鸟或可玩钓鱼状态机。界面不得把外海相机按钮说成已经进入钓鱼。

## 实际学习与协调记录

已阅读 mrdoob/three.js 的 examples/webgl_gpgpu_birds.html（位置、速度、相位与群体关系），以及 VictorZakharov/beautiful-water 的 src/scene/fish.js，blob 652e5409617784834ba0def0e685e36bed6b9f74（共用海面/海床查询、同群邻接、对移动及安静观察者的不同反应）。这是程序行为学习，不是鱼类生物学真值；没有复制其资产和渲染质量调整体系，也没有改用它的海水替换原版。

来源：
- https://github.com/mrdoob/three.js/blob/dev/examples/webgl_gpgpu_birds.html
- https://github.com/VictorZakharov/beautiful-water/blob/main/src/scene/fish.js
- https://github.com/haihao0307/guilin-dem-pipeline/blob/coordination/kaopu-xiaoma-handoff-r32-20260911/docs/mother_coordination/handoffs/kaopu-xiaoma-r32-20260911/01_COORDINATOR_STATE.md

已向小妈知识总账 Issue #63 提交资源请求 comment 5717038176。状态是 posted / awaiting response，不是 acknowledged / adopted；不得声称已经与另一个 AI 实时开会或获得答复。

## 交付检查

- 本任务没有用生成图片代替真实三维实现。
- 已实际修改生产源码，不是只做视觉提案。
- 页面来自实时三维运行时，镜头与独木舟交互需实际测试。
- 截图只用于内部核对，不能代替三维网页。
- 编译成功、Actions 成功不等于浏览器检查通过；读取 BROWSER_QA 的实际 passed 与 failure。
- 公网固定链接需回读、校验正文哈希，再做真实浏览器桌面/手机检查。
- 只在 PUBLICATION_PROOF 的 shareAllowed=true 后交付试玩网址。
- 手机视口测试不等于真实 iPhone 的 GPU/帧率验证。
- visualAcceptance=false；AAA 与 productionReady 均不得自行批准。
