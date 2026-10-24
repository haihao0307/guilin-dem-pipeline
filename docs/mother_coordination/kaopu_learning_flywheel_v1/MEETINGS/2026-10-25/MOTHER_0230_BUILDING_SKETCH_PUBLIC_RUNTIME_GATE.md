# Mother 02:30 — 建筑规则草图公网运行门禁

- 记录 ID：KAOPU-MOTHER-20261025-BUILDING-SKETCH-PUBLIC-RUNTIME-R1
- 实际开始：2026-10-25 02:31:23 +08:00
- 实际结束：2026-10-25 02:34:26 +08:00（3分03秒；完成即结束）
- 唯一主问题：新发布的建筑规则草图虽然有成功 QA，当前固定公网入口却无法产生三维画面，应该如何分类与接续？
- 责任端：Kowloon Building Mother / `trial/lowrise-glass-fix-20261022`
- 协议：R2 Production OS；涉及参考复刻时继续 `REPLICATION_LOCKED / CREATIVE_AUTHORIZATION=false`

## 会前权威状态

1. main 当前 head：`d9d1d1afba3bac007b2ce48c96fb0e6926c572db`，新增隔离目录 `building-rule-sketch-r01`。
2. 强制协议版本未变：
   - 根 `AGENTS.md`：`251b664646a489e9292748f1d41998ee62a338f5`
   - R2 Production OS：`d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
   - Reference Replication Gate：`8c0a49c71865ef76cbc614f8188239bc808a8278`
   - Freshness Gate：`4754a90a94e4a9e7806357b6eb292e5c713e9021`
3. #63 没有新的 Mother 生产回执。#91 新增 N189、N190，均为 `POSTED`；N189 8/8、N190 10/10 只是合成门禁回放，不是本草图或真实建筑的生产 Gate Run。
4. 本工件的 `SKETCH-CONTRACT.md` 和 manifest 明确：
   - `actualBuildingReplica=false`
   - `sourceAssetsIncluded=false`
   - `windowsDemonstrated=false`
   - 假设尺寸、框架原型与内部布局不代表香港三栋真实建筑
   - R09、真实三栋建筑入口和 R10 QA 保留
5. 本次提交与公开目录未提供可见的 R2 Task Anchor 或 Delivery Receipt。唯一 taskId、accepted baseline/baseSha、targetDefect、用户最后约束 digest、referenceSet、UNKNOWN、forbidden routes 和交付状态没有形成一份完整、可独立复核的回执。

## 真实新增证据

- QA 源提交：`7bdab51d4019c01ce53472cd9d892fb058133e3c`
- workflow run：`40049717530`，结论 success；步骤报告包含固定依赖、浏览器安装和 desktop/mobile UI case switching。
- main 发布提交：`d9d1d1afba3bac007b2ce48c96fb0e6926c572db`。
- 当前公网入口：
  `https://haihao0307.github.io/guilin-dem-pipeline/kaopu-geography-workbench/kowloon-building-mother-r01/building-rule-sketch-r01/`
- 2026-10-25 北京时间本轮独立云端 Chrome 直接打开后：
  - 页面、按钮和文字可加载；
  - canvas 为空；
  - 页面明确显示 `草图未完成：WebGL2 Float32 rendering unavailable; no mesh substitute`；
  - 点击“向上长两层”后仍未进入三维运行态；
  - 因桌面三维主功能已失败，本轮没有把 390×844 历史 CI 当作当前公网移动验证，也不冒充手机实机检查。

历史 success 与当前失败可以同时成立：历史 run 证明当时指定 runner 的检查通过；当前 Observation 证明另一独立公网浏览器无法运行。前者不能覆盖后者。

## R2 状态核对

- 当前唯一 targetObject：`building-rule-sketch-r01` 隔离教学草图。
- 当前 targetDefect：当前公网浏览器缺少所需 Float32 渲染能力，三维画布和主要交互不可用。
- accepted baseline：真实三栋建筑 R09 / 既有 R10 QA 保留；本草图没有成为真实建筑 baseline。
- 用户最后相关约束：真实建筑可以暂缓精确颜色，但建筑身份、最新参考、窗洞/立面几何和材质类别仍严格；本草图没有真实参考输入，不能继承该有限宽容成为建筑复刻。
- referenceSet：教学草图为 none；真实建筑 referenceSet 不在本工件中。
- UNKNOWN：当前失败浏览器以外的公网成功范围、物理手机、Float32 能力覆盖率、无三角网格前提下可接受的兼容路线。
- forbidden routes：不得把教学草图称为真实建筑；不得用截图、success workflow 或页面外壳替代当前公网三维运行；不得偷偷引入建筑网格替代函数表达；不得由“颜色可后改”推导材质类别、建筑身份或窗洞可猜。
- fresh head delta：50 个文件发布到独立 R01 目录，来源与 manifest 绑定上述 QA 提交。
- applicable regression：
  - N189 `REFERENCE-OBSERVED-NOT-INCORPORATED-001` 未在本工件生产运行；本工件主动声明无真实参考，因此不能用其证明真实建筑 reference fidelity。
  - N190 field-scoped tolerance 仅完成合成回放，未绑定本工件 Task Anchor/Receipt。
- machine gate：历史 workflow success。
- reference gate：真实建筑不适用/未运行。
- browser gate：当前公网桌面失败；当前公网 390×844 未独立重跑。
- 当前状态：公网工作台 `HOLD_GATE_FAIL`；真实建筑目标 `NO_NEW_ARTIFACT`。隔离教学源码可保留为实现 Observation，不升级为 `CANDIDATE_READY` 或 `ACCEPTED_BASELINE`。

## 明确决定

保留该隔离教学草图及其历史 QA 证据，但停止把它作为已完成网页或真实建筑进度继续上推。Kowloon Building Mother 下一步只闭合公网运行与 R2 回执：

1. 为准确的 R01/current head 补齐最小 Task Anchor 与 Delivery Receipt。
2. 新鲜公网会话必须看到非空三维画面，页面运行状态为 ready，错误列表为空。
3. 在同一当前 head 上完成 desktop 与 390×844 浏览器视口：
   - 一个开间、向上两层、横向扩展三种案例切换；
   - 生长阶段切换；
   - 旋转、缩放和点击构件关系；
   - 门、电梯示意交互。
4. 如果浏览器不支持所需能力，页面必须保持明确失败状态；任何兼容方案仍须遵守“建筑形体由函数表达、无建筑三角网格”的已定边界，并单独验证画面与性能。
5. Producer 不能自我批准。通过上述门禁只到 `CANDIDATE_READY`，真实建筑 reference fidelity 与用户接受仍分开。

## 最小验证

用固定公网 URL 从全新浏览器上下文运行一次；回执绑定 source SHA、published bytes digest、浏览器/能力信息、三维 ready 状态和上述交互结果。加入一个禁用 Float32 能力的负控，门禁必须把它分类为 `HOLD_PUBLIC_RUNTIME_UNSUPPORTED`，不能因页面外壳和按钮存在而通过。

## 未完成边界

- 当前公网三维画面与主要交互失败，交付未完成。
- 390×844 仅有历史 runner 检查，本轮没有新的当前公网独立验证；没有手机实机验证。
- R2 Task Anchor、Delivery Receipt、N189/N190 的生产适用回放均未闭合。
- 没有真实建筑材质、窗洞、最新参考或用户视觉接受的新证据。
- 本轮没有 Mother `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED` 回执。

## 状态账

- 新源码与历史 QA：`IMPLEMENTED / historical GATE-RUN`
- 当前公网浏览器：`HOLD_GATE_FAIL`
- 真实建筑新成果：`NO_NEW_ARTIFACT`
- 本轮协调指导：`POSTED`
- Mother ACK：无
- ADOPTED：无
- USER-ACCEPTED：无

## 学习飞轮下一题

在坚持函数直接表达建筑形体、禁止建筑网格替代的前提下，怎样设计可声明能力范围的纯函数渲染后端或降级路径，使 Float32/WebGL2 能力不足时仍能产生可核验画面，同时不隐藏质量、精度与性能差异？

## 接续触发点

仅在准确 R01/current head 出现 Task Anchor、Delivery Receipt、当前公网新会话成功证据，或受约束兼容路线的实际实现与负控结果时接续；否则不重复发布同一指导。
