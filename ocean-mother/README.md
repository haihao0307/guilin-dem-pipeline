# Ocean Mother 数字化生产流程

知识版本 R002 / 1.0.0，补充研究 R003，共同方法论接收评估 0.1.0。日期 2026-09-01。

## 开工必读

读取 AGENTS.md、adoption/UNIFIED_METHOD_V1_INTAKE.json、adoption/UNIFIED_METHOD_V1_MAPPING.md、skills/ocean-math-physics/SKILL.md、contracts/OCEAN_KNOWLEDGE_CONTRACT.json 和 bridge-v1/UPSTREAM_LOCK.json。

延续 work/ocean-mother-handoff-20260901。起始 head 为 f85f0332f4056dc401e7186a7895114cc53dbf33，执行前重新核对远端并正常快进。main、gh-pages、冻结资产、DEM 真值和其他生产线均不修改。

唯一天气上游为 Weather Mother 1.0.0-clean / 0.6.2-loop，交付 ref 为 2619725efe236d2df8f2a55031bdae9e60a51555。保留十种云属、八种天气案例、独立风云速度、时钟、光照和原采样。旧 repositoryReadRef 不用于定位交付目录。

## 当前状态

已存在的运行代码只有 O1A 只读环境桥接。共同规范目标版本为 1.0.0，仍保持候选身份；目前只能取得文件库正文片段与 JSON 条目，整份原始文件、原字节身份、严格 Schema 和校验脚本未齐。正式共同规则接入阻断，禁止重建替代核心或声称完整原文已读。

本轮新增的是八项数学物理技能、知识合同、静态检查、来源边界和接入评估。没有新增 OceanState、历史重演、因果求解、海面、浮力或碰撞运行实现。生成、参数更新、导出和发布入口均未调用共同规则校验。所有计划路径在接收记录中明确为 not_implemented。

## 本线知识与制作顺序

OM-M01 统一时钟；OM-M02 数值波面；OM-M03 稳定坐标；OM-P01 浮力；OM-P02 力矩与阻力；OM-P03 碰撞筛选；OM-P04 接触与连续检测；OM-R01 数值光照与证据。每项列明公式、适用条件、限制和待执行测试，知识整理不等于物理验证。

后续先完成 O1B 浏览器参数接入，再做 O2A 单波与共享查询、O2B 多尺度浪、O3A 法线和光照、O3B 水天资源合成、O4 泡沫潮汐海底。浮力和碰撞在波面查询可核验后另立任务。当前 tasks/CODEX_O1B_O2A.md 仅为待授权执行指令。

展示必须同时具有 neutral_inspection、studio_beauty、diagnostic。三者目前都未实现。固定中性对照条件，独立控制工作室主光、辅光、轮廓光，诊断必须有图例。展示切换不可回写对象状态或共享天气。

## 无图与来源

不加载、生成、保存或内嵌图片贴图、法线图、噪声图、图集或预烘焙环境图。形状、法线与细节由函数和数值生成。临时 GPU 深度、历史帧和当前反射缓存仅服务运行，不作为可分发图片或物理真值。冻结天气保持原样。

本线旧资料中的外部产品、课程和演示标签已从当前知识入口排除；共同规则原字段与原始引用不擅自改写。来源边界见 research/R002_SOURCE_BOUNDARIES.json，新增讨论转译见 research/R003_SURFACE_CONTINUITY.md。来源哈希依赖研究对话还原地址，独立来源回溯尚不完整。资料中的线程数、LOD 和后端经验未作为本线已实施方案。

## 测试与验收

```sh
python -B ocean-mother/tools/validate_knowledge.py --root ocean-mother
python -B ocean-mother/tools/validate_intake.py
python -B -m unittest discover -s ocean-mother/tests -p 'test_*.py'
```

知识静态扫描可用 --upstream-dir 指向精确原件，额外核验六个运行文件、MANIFEST 和 HANDOFF。当前本地检查尚未接入远端 CI、运行时或发布门禁。回执有效时仍输出正式接入 BLOCKED，不能误读为共同规范验收通过。

后续性能按桌面与移动视口各三个预热后的 6 秒窗口记录全部结果、代码身份、参数、完成帧率、P50/P95、分辨率、DPR 和实际设备。降频、降采样与降低分辨率均需独立对照，不自动宣称无损。模拟移动视口和软件渲染不代表用户硬件性能。

验收截图只保存在专属证据 artifact，不能被程序加载作材质。当前没有新的公开 Ocean 网页；visualApproved=false、productionApproved=false。用户批准须有记录并绑定精确构建。
