# R10｜2026-09-24 全量本地包快照

> 本文件是封包说明，不新增或修改 R9 已锁定的故事、生态、玩法与运行时规则。R10 的目的，是把截至 2026-09-24 的全部权威资料固定成一个可下载、可校验、可继续生产的本地全量包。

## 1. 权威基线

- 仓库：`haihao0307/guilin-dem-pipeline`
- R9 权威起点提交：`fbe1f8641c698aa063b59e3e7125c5bc8aca8211`
- R10 封包分支：`handoff/survivor-palau-pilot-survival-full-r010-20260924`
- 游戏统一起点：`1944-12-31 05:00`，Palau 本地时间
- 历史原型事件日期：`1944-11-21`
- 当前实现状态：规则与运行时合同已锁定；完整可玩代码、连续浏览器证据和实体 iPhone 验收尚未完成

## 2. 当前最新内容

R10 完整继承 R5—R9 的全部权威内容，包括：

- 单一世界、单一物理、单一 `worldTime`；
- Stone Money Island 的晨昏鸟潮、果蝠、天堂鸟、暮蜥鸣、夜海和大型海洋生命；
- 洞穴住所、橡皮艇雨水系统、椰壳雨水过滤、持续余烬与熄火一日代价；
- 高生物量、战时低捕捞、捕鱼时窗、手工鱼钩、浅水插鱼和后期自由潜；
- 芋头、木薯、椰子蟹、椰子油、海漂木、旧舟、稀有金属和耐火容器；
- Blue Girl 的特殊梦境边界；
- 野猫迟到出现、夜间偷鱼、独立来去与非报警角色；
- 礁台、潮池、贝床、根茎地和诱饵点的轮换与恢复；
- 人类脚印、拖痕、血水、鱼鳞、骨头、灰、纤维、植被与常用路线的持久痕迹；
- 每次沙滩活动后的 `TraceSweep`、鱼尸与骨头完整去向；
- 日军从海上观察、登陆检查到逐步形成住所假设的 `PatrolInferenceState`；
- 分钟、日、周、月和半年尺度的 `DeferredConsequenceGraph`；
- 每晚纸面日记、原始记录与后来边注。

## 3. 当前权威阅读顺序

1. `01_MASTER_SPEC_ZH.md`
2. `12_R6_FOOD_ABUNDANCE_CROP_CAT_DRIFTWOOD_LOOP_ZH.md`
3. `13_R6_EVIDENCE_LEDGER_AND_RISKS_ZH.md`
4. `17_R7_WARTIME_REEF_FISHING_CAUSALITY_LOOP_ZH.md`
5. `18_R7_EVIDENCE_LEDGER_AND_RISKS_ZH.md`
6. `21_R8_BLUE_GIRL_CAT_EMERGENCE_PATCH_ROTATION_CAUSALITY_ZH.md`
7. `22_CURRENT_IMPLEMENTATION_STATE_R8_ZH.md`
8. `24_R9_HUMAN_TRACE_ECOLOGY_DETECTION_LOOP_ZH.md`
9. `25_R9_CAUSALITY_CHAINS_ZH.md`
10. `26_CURRENT_IMPLEMENTATION_STATE_R9_ZH.md`
11. `27_R9_CHANGELOG.md`
12. 本文件
13. `manifest.json`

## 4. 本地包要求

本次本地包必须：

- 包含 R10 固定提交的完整仓库快照，而不是只复制单个 Markdown；
- 保留目录结构和所有相关代码、文档、测试、资产索引与历史交接；
- 在 ZIP 根目录新增本地生成的 `LOCAL_PACKAGE_INFO_20260924.txt`；
- 在 ZIP 外同时提供 SHA-256 校验值；
- 打包后执行 ZIP 完整性测试并核对 R10 权威文件存在；
- 不把“已封包”误写成“可玩实现已完成”。

## 5. 当前一句话状态

截至 2026-09-24，Stone Money Island 已经形成从岛屿生态钟、食物和火水循环，到野猫、资源轮换、人类痕迹、日军长期推断与跨月因果的完整生产合同；这次 R10 只负责把全部成果固定为一个可下载、可校验的本地全量包。
