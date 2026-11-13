# KAOPU Mother 02:30 协调会 — ZX85USB v16 方法样板运行闭包门

日期：2026-11-14  
范围：Mother Coordinator → Excavator / Mechanical reusable-method boundary  
会议状态：`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW`

## 唯一问题

同名 ZX85USB-5A 检查包已更新到 version 16，工程机械 Site 已更新到 v205 并成功部署。二者是否已经共同证明：用户认可的“新 KAOPU 路线”形成了可移植、可执行、可公网验证的方法样板，可据此向汽车、火车、门锁、空调等项目扩散？

## 决定

**否。执行 `HOLD_METHOD_EXEMPLAR_RUNTIME_AND_PUBLICATION_CLOSURE`。**

保留用户对挖机方法的认可，也保留 v16 的真实新源码与验证资产；停止把同名可变检查包、离线软件预览或未绑定的 Site 新版本解释为方法已经可移植、整机已经运行或各 Mother 已经采用。

这不是 `REJECTED_CREATIVE_SUBSTITUTE`：包内是实际函数几何、装配与测试证据，且主动披露未知项。若把 v205、离线预览或旧版运行证据说成 v16 的外部运行证明，则该**交付主张**按 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY` 处理。

## R2 九项核对

1. **taskId / targetObject / targetDefect**  
   `UNBOUND_ZX85USB_V16_METHOD_EXEMPLAR_RUNTIME_CLOSURE` / ZX85USB-5A functional-whole checkpoint v16 / 可变样板缺少可执行依赖闭包、版本绑定与公网运行回执。
2. **accepted baseline / baseSha**  
   用户认可的是挖机“方法”，不是这个可变 zip 的整机接受。当前 main 为 `8aec1b1dca9619c0b59fc8fa480f65f226be7145`；accepted production artifact/baseSha 仍为 `UNKNOWN`。
3. **用户最后约束**  
   汽车、火车、门锁、空调和其他机械项目都应按新的 KAOPU 路线重做/核查，必须实际执行、持续检查并最终明确交付；交互/三维工作台必须提供用户外部浏览器直开的清晰链接，并核验内容、交互和版本。
4. **referenceSet 与 UNKNOWN**  
   v16 Library identity：`libfile_841f9900a5ec81918f2df377bf8e292f@16`；SHA-256 `e3438ea83dba851c8c54c132342b9f6db622439d41d8797381163a51d2def5d1`；5,868,869 bytes。包内明确：未发布、不是整机完工；原始 PDF/场景像素、部分 vendor/tool environment、张紧器、驱动轮毂、销轴止退、轴承、全整机质量、浏览器/设备验收等保持 UNKNOWN 或未完成。
5. **forbidden routes**  
   禁止以同文件名或 Library ID 证明字节连续；禁止把 Site v205 成功部署等同 v16 已上线；禁止把离线 EGL 软件预览等同浏览器/硬件 QA；禁止把多文件 checkpoint 当单体 HTML；禁止把方法认可滚升为目标项目采用或用户验收。
6. **fresh head delta**  
   N284 观察的是 version 9 / 2,882,934 bytes；当前为 version 16 / 5,868,869 bytes / 新 digest。Site 从 v169 推进到 v205，commit `b7eee14e8297c32cbe2ef0f15a66b20f71bbf7e0`，deployment `appgdep_6af756df72b0819195bd805ea4c7644e` succeeded。两条都是真实新变化，但没有相互绑定。
7. **applicable regression cases**  
   继续执行 `MOTHER-NO-METHOD-INVENTION-001-N283-METHOD-ANCHOR` 的 sourceArtifactRevisionGate，并执行 `WHOLE-MACHINE-NOT-PARTIAL-DELIVERY-001`。本轮是复发/深化，不新建近义案例。
8. **gates**  
   Contract FAIL；Freshness PASS for new bytes / FAIL for delivery binding；Reference Fidelity PARTIAL；Machine dependency-closure FAIL；single-file FAIL；Browser FAIL；Public access FAIL。
9. **当前状态**  
   `HOLD_GATE_FAIL`，同一根因已跨 N283、N284、本轮复发，进入 `ROOT_CAUSE_REVIEW`。

## 新鲜证据

- zip 安全解包：1,035 entries；无绝对路径、`..` 或 symlink。
- 包内清单：1,034/1,034 SHA-256 全匹配，0 missing、0 mismatch。包没有损坏。
- 静态相对导入闭包：扫描 1,244 个相对导入，377 个目标缺失。代表缺口包括 Three、OrbitControls、认可前装置 assembly 与 registry；README 要求从精确 Site v201 恢复依赖。
- 包含 12 个 HTML，但没有 standalone 单体 HTML。R05 入口外链 `style.css`、`viewer.mjs`、`preview.png`，并运行时 `fetch(parameters.json)`。
- 未发现 R2 Task Anchor、Delivery Receipt 或 `PUBLICATION_PROOF.json`。
- 软件预览为 1200×840，画面文字明确标注 `partial whole-drive`、`approximate offline lighting`、`NOT browser/hardware QA`。
- Site v205 部署成功，但 access_mode 仍为 `custom`、external visitor count 0；未登录外部浏览器实际看到 `Sign in required / Log in to access`。v205 无 v16 package/version receipt。

## 有限方法与责任端

**责任端：Mother Coordinator + Excavator method-exemplar packaging owner + Site publisher；独立 verifier 执行最后门。**

仅做一个 `METHOD_EXEMPLAR_RELEASE` 闭包，不向其他 Mother 扩散：

1. 冻结 `libraryFileId + versionId + sha256 + size + modifiedAt`；
2. 建立 Task Anchor，分离 portable invariants 与 excavator-specific constants/geometry/frames；
3. 把所有运行依赖封装进同一可移植闭包，生成 standalone HTML；
4. 绑定同一 digest 到 Site servedVersion、route 和 Delivery Receipt；
5. 独立 verifier 在空目录和外部浏览器运行，Producer 不自批。

若下一次仍因相同依赖或版本漂移失败，不生成 version 17/18 绕过，应直接检查构建器为何默认输出“restore checkpoint”而不是可执行方法发布件。

## 最小解除验证

同一精确 digest 必须同时满足：

- manifest 全匹配，静态与运行时 dependency closure 为 0 missing；
- 空目录、无隐式 Site v201 工作树条件下启动；
- standalone HTML 以 `file://` 首帧成功、核心网络请求 0、零致命错误；
- 外部固定 URL 无登录门，HTTP/正文版本匹配；
- 桌面与 390×844 对同一 servedVersion 完成首帧、旋转、选件/部件隔离、一个机械动作、GPU completion；
- Task Anchor、Delivery Receipt、known limitations 与独立 verifier receipt 齐全。

## 未完成边界

当前没有 accepted production baseline、完整 reference identity、可执行依赖闭包、单体 HTML、v16→v205 绑定、公网访问、桌面/390×844 当前版本交互、手机实机、ADOPTED 或 USER-ACCEPTED。**交付未完成。**

## 学习飞轮问题

如何让频繁追加的研究 checkpoint 与可移植方法发布件成为两个机器可区分的 artifact class：前者允许明确外部 restore inputs，后者必须拥有 content-addressed dependency closure、不可变 exemplar digest、portable-invariant contract、target-variation contract 与可撤销的 adoption receipt？

## 生命周期

- coordination artifact：`IMPLEMENTED=true`
- dependency/public gate：`GATE-RUN=true`
- #91 routing：待本记录发布后置 `POSTED=true`
- Mother：`ACKNOWLEDGED=false`
- production method release：`IMPLEMENTED=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

未修改生产 Mother 分支、Site、访问策略、main、R2、固定会议安排或排程。
