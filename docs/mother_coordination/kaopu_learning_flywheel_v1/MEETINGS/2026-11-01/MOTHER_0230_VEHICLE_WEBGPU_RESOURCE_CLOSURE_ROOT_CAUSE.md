# KAOPU Mother 每日协调会｜Vehicle WebGPU 资源闭包根因复核

- 记录 ID：`KAOPU-MOTHER-20261101-VEHICLE-WEBGPU-CLOSURE-R1`
- 实际开始：2026-11-01 02:34:15 +08:00
- 实际结束：2026-11-01 02:36:13 +08:00
- 会议边界：只处理 Vehicle 私有 checkpoint 的 WebGPU 可执行资源闭包；未修改生产 Mother、main、私有包、排程或学习飞轮
- 参与证据：协调端读取 main、R2 OS、reference/freshness gates、#91/#63、N223 及 Vehicle Library 当前第 22 版；未取得 Vehicle Mother 新回复
- main：`4f59489d3a399034e82190cae9b41d3e92a5942b`（本轮新增仅 Weather R36，与 Vehicle 无关）
- 会前 coordination head：`c003c26da13e98c6b2075e68b6522b32fa39c7ed`

## 本轮最高价值问题

N223 已对 Vehicle 私有 checkpoint 第 18 版判定：

`HOLD_VEHICLE_WEBGPU_ROUTE_DELIVERY_RESOURCE_CLOSURE_FAILED`

本轮读取同一 Library 身份的最新第 22 版，确认该缺口仍未解除：

- 文件：`KAOPU_VEHICLE_FUNCTION_REBUILD_R01_PRIVATE.zip`
- version：22
- modified：2026-11-01 02:30:49 +08:00
- archive SHA-256：`9060196f166be86d9abcddb992c9fd7178d227b6ac63692c600d8a2715a730b6`
- manifest createdUTC：`2026-10-31T18:30:16.786670Z`
- archive：8,056 entries，展开约 234,841,650 bytes
- `runtime/gpu-experiment/index.mjs` 仍执行 `fetch(new URL('./compute.wgsl', import.meta.url))`
- 第 22 版仍没有任何 `.wgsl` 文件
- `CHECKPOINT_MANIFEST.json` 仍未登记 `compute.wgsl`
- 包内没有 R2 `TASK_ANCHOR` 或 `DELIVERY_RECEIPT`
- CPU/fail-closed test 仍明确输出 `gpuExecuted:false / shaderCompiled:false`
- device test 依赖同一个缺失 shader；README 仍诚实标明 WGSL 未在实际 adapter 编译或执行

因此第 18 版后的更新没有修复同一 bounded blocker。按 R2 两次失败边界，本轮升级为：

`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW / HOLD_VEHICLE_WEBGPU_ROUTE_DELIVERY_RESOURCE_CLOSURE_FAILED`

这不否定当前数学函数、CPU renderer、零件候选或 GPU 设计；只拒绝“当前交付包已经包含可运行 WebGPU compute 路线”的更强声明。

## R2 九项核对

| 项目 | 当前证据 |
|---|---|
| 1. taskId / targetObject / targetDefect | 包内未找到正式生产 Task Anchor，`taskId=UNKNOWN`。对象是 Vehicle function rebuild checkpoint v22；唯一缺陷是 WebGPU runtime 的 transitive resource closure 不完整。协调记录 ID 不能冒充生产 taskId。 |
| 2. accepted baseline / baseSha | 没有用户接受的整车或 WebGPU baseline/baseSha。当前包声明 `wholeVehicleComplete=false / publicDeliveryComplete=false`；main 的 Vehicle 路线仍是历史 Motor 内容，不是本包 baseSha。 |
| 3. 用户最后约束 | 完整一比一函数重建后交付三维 HTML 工作台；不再把局部 demo 当成完成；必须核验真实渲染、交互和版本。GPU 路线不得用 CPU/mock 证据替代。 |
| 4. referenceSet / UNKNOWN | 原始 Mercedes archive 身份和 SHA 已记录；私有参考不得公开重分发。整车、隐藏域、物理尺度、WebGPU 实机覆盖与完整参考保真仍有大量 UNKNOWN。 |
| 5. forbidden routes | `REPLICATION_LOCKED / CREATIVE_AUTHORIZATION=false`；禁止 generic/toy/placeholder、隐藏面补造、用 CPU/mock 冒充 GPU、用 manifest 成功掩盖缺失资源、用公开来源资产或三角网格替代自有函数。 |
| 6. fresh head delta | v22 是 dispatch 后的新包，SHA 与 N223 v18 不同；但同一 shader 资源缺口复发。main 新 head 只含 Weather R36，不能作为 Vehicle fresh delta。 |
| 7. regression cases | N223 的 resource-closure Candidate 已对 v18 做 13/13。v22 直接回放再次发现：resource absent、manifest unpinned、delivered-byte load 不可能。该回放是 exact v22 artifact evidence，不是 GPU 执行。 |
| 8. machine / reference / browser gates | CPU/schema gate 有证据；WebGPU shader compile/dispatch/readback 未运行。Contract gate 因 Anchor/Receipt 缺失而 FAIL；Resource Closure FAIL；Reference Fidelity、固定公网、桌面、390×844、实机均未完成。**交付未完成。** |
| 9. 当前状态 | `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW`。包可保留为私有 partial checkpoint；WebGPU route 不能晋级 `CANDIDATE_READY`，整车也不是 `ACCEPTED_BASELINE`。 |

## 明确决定：停止继续打同类包，先修 builder 资源闭包

同一 blocker 已跨 v18→v22 复发。Vehicle Mother 下一步只处理一个 bounded root-cause task：

1. checkpoint builder 的 allowlist 必须包含所需 `.wgsl`；
2. `compute.wgsl` 必须实际存在于交付包；
3. manifest 必须记录 shader 路径、字节数和 SHA-256；
4. static closure checker 必须从 delivered `index.mjs` 解析 import/fetch/new URL，拒绝缺失或未 pin 的资源；
5. 至少一个非替换测试必须从交付字节加载真实 shader；mock 空 shader 或绕过 fetch 不计；
6. 生产 Receipt 分开记录：
   - package closure；
   - shader compile；
   - compute dispatch/readback；
   - exact runtime subject；
   - browser/device 与 viewport 范围。

包闭包修复后，如果当前环境无 adapter，可合法进入 `BLOCKED_VALID`，但不能把 closure PASS 写成 GPU runtime PASS。

## 责任端、最小验证与未完成边界

- 责任端：Vehicle Mother 的 checkpoint builder / GPU experiment owner。
- 最小验证：对 exact v22 后继包重跑 closure；篡改/删除 shader、manifest 漏项、测试替换 fetch 三个负控必须失败；真实交付字节加载 shader 后才进入浏览器 adapter compile/dispatch。
- 未完成边界：不判断整车形体、零件覆盖、性能、WebGPU 优势、参考一比一、固定 HTTPS、手机实机或用户接受；不公开私有参考资产。
- 本轮状态账：`POSTED=true`（[#91 comment 6547524817](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6547524817)）；`ACKNOWLEDGED=false`、`IMPLEMENTED=false`（生产修复）、`GATE-RUN=true`（v22 exact package closure only）、`ADOPTED=false`、`USER-ACCEPTED=false`。

## 学习飞轮下一题

研究 standalone HTML 中如何内联 WGSL 与模块依赖，同时保留每个 runtime resource 的 digest、command-route trace 和“零隐藏 render pass”可验证性。目标是让单文件交付闭包与 triangle-free compute claim 同时可审计；不把打包成功当 GPU 正确性。

## 来源与边界

- [N223 定向证据](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6545548001)
- [N223 learning branch](https://github.com/haihao0307/guilin-dem-pipeline/tree/automation/n223-vehicle-webgpu-delivery-closure-20261031)
- 当前 v22 复核基于同一 Library 文件身份的最新版本；未把 N223 v18 SHA 当成 v22。
- #63 无 Vehicle 新回执；最新 Coast 历史状态不影响本轮结论。
