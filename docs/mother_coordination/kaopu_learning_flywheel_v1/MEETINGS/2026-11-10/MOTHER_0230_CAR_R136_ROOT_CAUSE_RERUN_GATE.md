# KAOPU Mother 每日协调会｜Car R136 复跑闭包第二次同因失败

- 日期：2026-11-10（北京时间）
- 实际会议：2026-11-10 02:30—02:41 +0800
- 会议边界：只处理一个跨模块问题；未修改 Car、任何生产 Mother 分支、main、托管、排程或全局 R2 门禁
- 强制协议：R2 `LOCK → EXECUTE → VERIFY → PROMOTE`

## 本轮唯一问题

Car R136 已从 R127 继续到 bounded GPU admission contract；昨天已证明 R127 的静态绝对导入破坏新环境复跑。R136 是否修复了同一验证闭包，还是不同候选再次共享同一 blocker？

## 会前读取与权威状态

- 协调仓库 `main@6a003f0fafb9ae27d71e95963728461288c14edb`
- 根 `AGENTS.md`、R2 Production OS、Reference Replication Gate、Freshness Gate 与昨日读取的 blob 身份未变化
- #91 最新为 N259 Mechanical mobile blank boot；N256 已明确 R127 的 content-addressed mount map 无法重定向源码中的静态绝对 import
- #63 最新仍为 N49 Coast 公网运行失败；没有 Car / Motor Mother 对 N255/N256 的 `ACKNOWLEDGED / ADOPTED`
- 本轮新对象：`CAR_RECOVERY_R136_BOUNDED_GPU_ADMISSION_PRIVATE_DELTA.zip`
  - archive SHA-256 `970367f8ea22aeed8517b5a86e33c4207526b941ef9e3a9e9a2ddb693597ef9e`
  - checkpoint `RECOVERY-R136 / FROZEN_BOUNDED_INTEGER_ADMISSION_CONTRACT_DISABLED`
  - base `RECOVERY-R135`；官方恢复根仍声明 R108 commit `525b6889d703c4eeae6a2dde2836153ba02871b0`

## R2 九项核对

1. **唯一 taskId / targetObject / targetDefect**  
   包内仍无 R2 Task Anchor，`taskId=UNKNOWN`。本轮只锁定 R136 的 validation replay closure；缺陷是新的独立复核仍静态导入原主机 `/workspace/shared`。

2. **accepted baseline / baseSha**  
   无 Delivery Receipt，`accepted baseline=UNKNOWN`。R135 是声明的恢复前置，R108 是恢复根；两者都不等于用户接受基线。

3. **用户最后约束**  
   validation-only 必须有 dispatch 后的新 run 并绑定准确对象；历史 PASS、压缩包、静态编译与测试数量不能代替可复跑证据；第二个不同尝试共享 blocker 时必须升级共同原因，不得继续换 worker 或凭感觉微调。

4. **referenceSet 与 UNKNOWN**  
   referenceSet：R136 archive、R135 predecessor manifest、受限 `source.private.json`（声明 SHA-256 `fc3eb34d5c60ca5fe308b845a5ec95b2aaa94467b217fe66a1c3ed1356841775`）、48-byte query / 240-byte result ABI、Q149 representation、Naga static proof。GPU 实际输出、contact kernel、world-ray equivalence、浏览器、视觉、性能、物理单位仍为 `UNKNOWN`。

5. **forbidden routes**  
   不得把 integer admission 或 SPIR-V 静态验证说成 GPU execution / contact；不得激活 R120 failed query、R136 probe、renderer 或新 geometry；不得继承独立复核 PASS 而忽略复跑入口失败；不得把 R136 当作昨天 blocker 已解除。

6. **fresh head delta**  
   R136 声明 R135 的 4,257 个文件不变，新增 8 个 isolated runtime files；实现 raw local binary32 ray admission 与 Q149 exact expansion，但 `contactShaderImplemented=false`、`GPUDispatchImplemented=false`、`hardwareValidated=false`、`CPUFrames=0`。无生产 source diff、无发布。

7. **applicable regression cases**  
   精确复用 N256 更新后的候选 `RUN-SUCCESS-NOT-RERUN-REPRODUCIBILITY-001`；R136 是同一 Car / Motor recovery packaging scope 的第二次 recurrence，不建立近义 case。Bird/Fish/Boat/Terrain 四个既有视觉模式不适用本任务；Fish 是该 rerun case 的历史起源，不是把 R136解释成鱼类问题。

8. **machine / reference / browser gates**
   - Contract：Task Anchor、Delivery Receipt、accepted baseline 缺失，未通过。
   - Freshness：archive SHA 与 R136 metadata 已绑定；根 `SHA256SUMS` 新跑通过。
   - Machine：Node `v24.22.1`；package-relative `test-contract.mjs` 与 `prove-representation.mjs` 新跑通过。
   - Independent replay：`test-static.mjs` 因静态导入共享目录 Naga 得到 `ERR_MODULE_NOT_FOUND`，exit 1；`test-independent.mjs` 因静态导入共享目录 R136 runtime 得到同错误，exit 1。
   - Path audit：21 个文本/可执行文件含 53 次 `/workspace/shared/`；其中独立复核、QA、arithmetic proof、source table compiler 均受影响。
   - Reference Fidelity：原始 source digest 和 alias/geometry边界有历史记录；新环境独立复核未闭合。
   - Browser / GPU：未运行；不能由静态 Naga、JS mirror 或 recording device 替代。

9. **状态**  
   `ROOT_CAUSE_REVIEW / HOLD_GATE_FAIL / BLOCKED_VALID / HOLD_STATIC_IMPORT_ROOT_UNSEALED`。  
   不标 `REJECTED_CREATIVE_SUBSTITUTE`；不标 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`；R136 保持冻结，不能晋级 `CANDIDATE_READY` 或 `ACCEPTED_BASELINE`。

## 共同根因

R127 与 R136 的共同问题不是缺少更多哈希，也不是 worker 不会写测试，而是**验证表示把原生产工作区布局当成了交付合同**：

- runtime/source/toolchain 通过源码静态绝对路径绑定；
- package manifest 只能证明包内字节，不能改变 ESM/Python 的路径解析；
- 独立复核结果在原主机成立，但交付包没有一个真正消费 logical input root 的入口；
- 后续版本继承历史 evidence 时也继承了 ambient authority。

因此继续追加 recovery 版本、mount map 字段或更多历史 PASS 都不能解除 blocker。

## 明确决定 / 有限方法

冻结 R136 的晋级与“独立复核通过”继承；允许其他不依赖该声明的 source 研究另行推进，但不得把 R136 review 当作其父级通过证据。Car / Motor recovery packaging owner 只做一次有限闭包修正：

1. 提供唯一 package-relative `verify-r136` 入口。
2. JS/ESM 全部使用相对 URL 或由入口显式动态加载的声明路径；Python 全部通过 `--input-root` 解析。源码扫描必须为零个 host-absolute literal。
3. Naga、R135 predecessor 与受限 source 都进入 caller-supplied manifest；入口实际消费 manifest，不能只记录不使用。
4. 新 receipt 绑定 command digest、logical input root、runtime/loader identity、dependency inventory 和完整退出码。
5. 若一次修正仍以同因失败，保持 `BLOCKED_VALID`，不再生成 R137/R138 来绕过这一验证任务，直至合同或工具链表示方法改变。

## 最小验证

在一个不含 `/workspace/shared` 的空目录中，仅放 R135→R136 声明输入及 verifier dependency：

- `verify-r136` 正向跑完 static、scalar、mother、geometry、baseline 五类检查；
- 静态扫描确认 executable/source 中 host-absolute path 为 0；
- 删除 R135、篡改 source byte、替换 Naga module、注入绝对 import 四个负控分别 fail-closed；
- 新 receipt 精确绑定 archive SHA `970367…`、result manifest、Node/Naga、loader、平台和退出码。

通过只解除 rerun closure；GPU、contact、浏览器、视觉、性能仍保持未完成。

## 责任端、未完成边界与下一学习题

- 责任端：Car / Motor Mother recovery packaging owner；独立 verifier 在空目录复跑。Producer 不拥有自我批准权。
- 未完成边界：Task Anchor、Delivery Receipt、accepted baseline、single entrypoint、零绝对路径、依赖闭包、contact shader、真实 GPU、浏览器、桌面/390×844、公网页面、性能与用户验收均未完成。
- 学习飞轮下一题：如何让 ESM、Python 与 shader toolchain 共享同一个 content-addressed input-root resolver，并机器证明每个文件访问都来自声明闭包，而不是环境 ambient authority。

## 生命周期账

- `POSTED=true`（本纪要与 #91 记录）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true`（R136 admission delta）；`portable verifier IMPLEMENTED=false`
- `GATE-RUN=true`（manifest / contract / representation PASS；两个 independent entrypoint FAIL）
- `ADOPTED=false`
- `USER-ACCEPTED=false`

没有真实 Mother 回执，不声称 Car、Motor 或其他 Mother 已学会、采用或完成。