# KAOPU Mother 每日协调会 — N280 Excavator v169 ZAXIS runtime-startup gate

- 日期：2026-11-13（北京时间）
- bounded task：只核 Site v169 成功部署后，ZAXIS 85USB 是否在同一版本原工作台进入可交互三维运行态。
- read set：`main@2573fb0b928feabfe528fe4901e88ef8b3a80a13`；R2 / Reference Replication / Freshness gates；#91 N279；#63 无新相关 receipt。
- 模式：`REPLICATION_LOCKED`；`CREATIVE_AUTHORIZATION=false`。

## 任务锚点核对

| 字段 | 核对结果 |
|---|---|
| 唯一 taskId | `UNBOUND_ZAXIS_85USB_V169_RUNTIME_STARTUP`；无生产 Task Anchor |
| targetObject | v169 原工程机械工作台中的 ZAXIS 85USB 完整挖机运行时 |
| targetDefect | 目录部署成功，但 ZAXIS 的模型导入/首帧/主要交互没有同版本运行回执 |
| accepted baseline / baseSha | `UNKNOWN`；v169 Site commit 不冒充 accepted excavator baseline |
| 用户最后约束 | 恢复正常推进；逐项保全细节；完整挖机回原工作台并可实际交互；最终提供外部浏览器直开链接 |
| referenceSet / UNKNOWN | ZAXIS 条目存在；canonical asset digest → route 映射、accepted parent 仍 UNKNOWN |
| forbidden routes | 目录缩略图冒充 live 3D；pre-v169 截图冒充 v169；相同字节改名冒充新资产；owner-only URL 冒充外部可达 |
| fresh head delta | v134→v169 有真实新 Site commit 和成功 deployment；没有绑定 v169 的 ZAXIS runtime receipt |
| applicable regression | N269 `WHOLE-MACHINE-NOT-PARTIAL-DELIVERY-001`；不建近义新 case |
| 当前状态 | `HOLD_GATE_FAIL` |

## exact version 与新证据

| 项 | 结果 |
|---|---|
| Site | `工程机械 · 整机图形总台` |
| fixed URL | <https://kaopu-excavator-function-workbench.sunhaihao.chatgpt.site> |
| v169 commit | `7d20d9611f509d24880c4ddd051bdc5120a2c149` |
| deployment | `appgdep_6af5fea312588191b9d5ef773c722a58` |
| deployment status | `succeeded` |
| v169 screenshot | 1200×750；SHA-256 `5cfc3164712dcd3e2233816017ab4f56e8dcc2ad8c030c3000d8cac9cad019d8` |
| access | `custom`；external visitor count 0；外部浏览器显示 `Sign in required` |

v169 screenshot 显示 19 个整机条目、17 张函数几何图及 ZAXIS 85USB 卡片。这证明目录页已发布，不证明 ZAXIS live scene 已启动。

### 运行证据时间边界

- `IMG_8637.png`：SHA-256 `6f4fbbf9f3c33fc64c66963713cff3e5988b43f7c45fee1209962e1dd9ac30a3`；ZAXIS 页面报 `Module name, 'three' does not resolve to a valid URL.`
- `IMG_8640.png`：SHA-256 `1ab71dedea27d30366afae281cc3c2a158f0158640c770090a65f4500b99caab`；仍停在“读取模型 2/2…”。
- 两图早于 v169 deployment，只能作为近期失败证据，不能证明 v169 当前状态。用它们宣称 v169 已完成时，判 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`。
- `excavator (6).zip` SHA-256 `0a6aa78c69afd24d3594f1f01d3f8f06cfd783ed304623555993e2bc51ebd91b`，与此前 `excavator (2).zip` 完全同字节，不构成 fresh reference delta。
- 独立铲斗的 7215 ms / `frame cancelled; last GPU completion unknown` 属另一 runtime route，本轮不混入 ZAXIS 通过判定。

## Gate 结果

| Gate | 结果 |
|---|---|
| Contract | FAIL：无唯一 Task Anchor / Delivery Receipt |
| Freshness | Artifact PASS：v169 fresh；Runtime evidence FAIL：没有 v169-bound ZAXIS run |
| Reference Fidelity | FAIL：canonical digest、route identity、accepted parent 未绑定 |
| Machine | FAIL：没有 exact-version import/ready/interaction/GPU completion receipt |
| Browser | FAIL：固定入口需登录；无 v169 ZAXIS 桌面 + 390×844 live run |

命中 N269：`HOLD_WHOLE_MACHINE_CAPABILITY_MISSING`、`HOLD_ORIGINAL_WORKBENCH_NOT_PUBLISHED`。没有足够证据判为创意替代。

## 明确决定与有限方法

**决定：只做一个 ZAXIS exact-version startup slice。** 不继续扩充目录，不用缩略图、旧截图或重复 archive 填充进度。

责任端：
- Excavator Mother：绑定 ZAXIS asset/import/runtime；
- Site publisher：绑定 exact version/route；
- independent verifier：执行 Machine/Browser gate。

最小验证：
1. Task Anchor 绑定 ZAXIS canonical digest、accepted parent、exact Site commit/version/route；
2. clean browser 从固定入口打开 ZAXIS；裸模块通过 import map 或打包 URL 解析；首帧 ready，console 零致命错误；
3. 实测旋转、选件、调整三项主要交互，并记录 draw/submit completion；
4. 同一 exact version 提供桌面与 390×844 浏览器证据，未登录外部浏览器可直开；390×844 只标 viewport；
5. Delivery Receipt 分列 package/runtime/browser/device/user 与 known limitations。

## 未完成边界

不声称 v169 ZAXIS live runtime、canonical asset mapping、accepted baseline、外部可达、桌面/390×844 pair、GPU completion、实机或用户接受已闭合。本轮未改生产 Mother、Site、access、main、baseline 或 R2。

## 学习飞轮继续研究

如何让目录页每个整机条目携带机器可读的 `route + assetDigest + servedVersion + runtimeReady + lastCompletedFrame`，使“目录已发布”和“该整机已启动可交互”成为两个不能混淆的状态？

生命周期：协调记录 `POSTED=true / IMPLEMENTED=true / GATE-RUN=true`（[#91 comment 6832497697](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6832497697)）；生产 `ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED=false`。
