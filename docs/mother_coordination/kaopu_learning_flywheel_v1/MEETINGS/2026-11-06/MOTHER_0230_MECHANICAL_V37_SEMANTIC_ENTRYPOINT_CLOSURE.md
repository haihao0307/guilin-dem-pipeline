# KAOPU Mother 协调会｜Mechanical v37 语义入口闭包共同根因

- 会议编号：`KAOPU-MOTHER-20261106-MECHANICAL-SEMANTIC-CLOSURE-001`
- 实际核查开始：2026-11-06 02:26:14 +08:00
- 实际核查结束：2026-11-06 02:29:12 +08:00（2 分 58 秒；完成即结束）
- 协调分支前一固定纪要：`26a83bfa885fce8836647442269328c34cece138`
- main：`34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- 强制协议 blobs：AGENTS `251b6646…338f5`；R2 `d942d44b…b2bf`；Reference gate `8c0a49c7…8278`；Freshness gate `4754a90a…9021`
- 范围：一个最高价值问题——Mechanical v37 的旧 hash 测试能否安全 supersede，及其替代权威是否覆盖真实执行入口
- 参与：小妈主持并独立 fresh replay；#91 N246/N247 是学习飞轮回流。未取得本轮 Mechanical Mother 回复，不把候选 probe 记作 ACKNOWLEDGED 或生产采用。

## 会前状态

#91 在昨日 Mechanical v37 公网交付 HOLD 后新增 N246、N247：

- N246 证明当前 7/8 的末项是 stale legacy assertion：它把每个单文件 hash 与 aggregate contract hash 比较；但同时发现 `render.mjs` 未进入 `displayPolicy.dependencies`。
- N247 以 Node.js `vm.SourceTextModule.moduleRequests` audition，从显式 `app.mjs` root 派生静态 ESM request graph。它只到 `TEACHER_CANDIDATE / AUDITION / POSTED`，未被 Mechanical 接收。
- #63 仍无新于 Coast N49 的生产回流；main 没有新 Mechanical 提交；Library 没有新 Mechanical package。

本轮不重复昨日“无公网入口”结论，而只核查替代 hash 权威是否足以让 v37 machine gate 通过。

## 精确对象与独立 fresh replay

- Library：`libfile_6321c7c1c3588191a3127681b6da5f50`
- 文件：`Mechanical-Mother-v37-offline.zip`
- ZIP SHA-256：`d4f19a70a743e8c78b859cb5c69c26543ed3b59cc4c3a7bd20cf12199b086b81`
- declared source：v37 / commit `b7281661a7f05ee8a4d9710e80f55c36a339cdfe`
- targetObject：`site/app.mjs` 驱动的 Mechanical display semantic runtime entrypoint closure
- targetDefect：手工显示依赖权威既 stale 又 incomplete；真实执行的 `render.mjs` 未归入显示合同，`app.mjs` 登记 hash 与包内字节不一致
- 当前状态：`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW / HOLD_SEMANTIC_ENTRYPOINT_AUTHORITY_STALE_INCOMPLETE`

本轮实际结果：

1. `python3 CHECK-PACKAGE.py`：311/311 PASS；
2. `node --test site/tests/own.test.mjs`：7/8，仍在旧 module-hash 断言失败；
3. Node v24.22.1 + `--experimental-vm-modules`，显式 root `site/app.mjs`：
   - static closure：42 modules；
   - static edges：63；
   - unresolved：0；
   - external：0；
   - `app.mjs -> render.mjs` 存在；
4. `render.mjs` SHA-256 `089666f6d5a97cdb356c8f054d5a516b59f9c47ea2ecba3344d0e5508d07f53a`，不在 `displayPolicy.dependencies`；
5. `app.mjs` declared SHA `37f4297dea140ad5d81854906bc95678b0506460a903c4f02ccea7e29b0d9941`，delivered SHA `b34c4dc808f8fcb6fa87e07880aeba76f6e1cceeb088abe3f61321aeb69548b5`；
6. `boot.js` 使用 `import('./app.mjs')`，但 static `moduleRequests` 为空；所以 42-module 结果不覆盖 dynamic import、workers、HTML roots、浏览器 import-map 或非 JS 资源。

## R2 九项账

| R2 项 | 本轮观察 | 判定 |
|---|---|---|
| taskId / targetObject / targetDefect | 无 producer R2 taskId；本纪要限定 app display closure 与 stale/incomplete semantic authority | CONTRACT HOLD |
| accepted baseline / baseSha | 无用户 accepted baseline、Git baseSha 或生产 head；包 hash 可核 | UNKNOWN / HOLD |
| 用户最后约束 | R2 强制；代码/test/包存在不等于通过；最终网页仍需固定 HTTPS、desktop、390×844 | 未由正式 Anchor 绑定 |
| referenceSet / UNKNOWN | exact ZIP、manifest、version.json、app/render hashes、42-module closure；dynamic imports/workers/browser roots 仍 UNKNOWN | BOUNDED |
| forbidden routes | 禁止静默删除失败测试、只补手工 hash、用 package integrity 冒充 semantic closure、用 static closure 冒充 dynamic/runtime closure | 当前需阻断 |
| fresh head delta | 本轮是 validation-only 新 run，绑定 exact ZIP；main/生产 head 无 delta | FRESH VALIDATION / HEAD NONE |
| regression cases | 适用 `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001` N246 版本，case SHA `30eef19c…38a`；不建重复 case | RECURRENCE / GATE-RUN |
| machine / reference / browser | integrity PASS；current test 7/8；static closure derived；semantic authority stale/incomplete；browser/public/390 继续未运行 | HOLD |
| 状态 | 与 A4 Player 的未消费运行闭包同源，已跨不同执行尝试复发 | `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW` |

Bird、Fish、Boat、Terrain 四类既有回归与本对象不相同，本轮不误套用。

## 明确决定

保留 v37 包的 311/311 完整性、现有函数几何、离线入口和昨日恢复证据。旧 7/8 断言不能证明 production bytes 已变，因此不标 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`，也不标 `REJECTED_CREATIVE_SUBSTITUTE`。

但不能把它简单标为 legacy 后删除。替代权威必须覆盖真正执行的 semantic entrypoints。当前 `displayPolicy.dependencies` 漏掉 `render.mjs`，且 `app.mjs` hash 已 stale；因此 v37 仍不能晋级 `CANDIDATE_READY`。

A4 Player 与 Mechanical 两条不同执行线已出现共同原因：**清单或 hash metadata 存在，但没有从真实执行入口派生、也没有在 import/use 前消费完整运行闭包。** 本轮按 R2 升级共同 `ROOT_CAUSE_REVIEW`，停止继续靠手工补 hash 或增加更多测试数量微调。

## 责任端与有限方法

责任端：Mechanical Mother / publisher。独立 verifier 只验证，不改形体、材质或生产架构。

有限方法：

1. Task Anchor 显式列出 HTML/module roots、dynamic imports、workers 与非 JS runtime resources；
2. 对每个静态 ESM root 从 parser-derived request graph 派生 closure，并对所有 resolved bytes 绑定 hashes；
3. dynamic import、worker、runtime-only loader 另做可执行 trace；不把 static closure 外推；
4. package manifest 和 semantic group map 必须在任何 import/use 前由实际 preflight 消费；
5. Delivery Receipt 记录 derived closure、unclassified entrypoints、stale hashes、dynamic/worker trace 和 mutation rejection；
6. Node `vm.SourceTextModule.moduleRequests` 为 experimental teacher，只作 bounded method；未来若 API 改变，保留同一 contract 语义而非绑定工具品牌。

## 最小验证

同一 fresh extraction：

1. pristine package：manifest + root ledger + static closure + dynamic/worker trace 全部 PASS；
2. `app.mjs` 一字节 verifier-only mutation：执行前 FAIL；
3. `render.mjs` 一字节 mutation：执行前 FAIL；
4. 一个 dynamic-import target 和一个 worker 各一字节 mutation：执行/绘制前 FAIL；
5. 恢复原字节后同一命令与同一 closure plan PASS；
6. old legacy test 只有在上述唯一 machine authority 生效并保存 supersession receipt 后才可 retired。

修复闭包不解除独立公网 HOLD；固定 HTTPS、desktop 与 390×844 当前 subject 浏览器验证仍需另跑，手机视口不冒充实机。

## 未完成边界

- 无 producer Task Anchor、Delivery Receipt、accepted baseline、Git baseSha、生产分支绑定或 Mechanical 新回执；
- dynamic imports、workers、HTML/import-map、非 JS runtime resource closure 尚未实现；
- 无生产 preflight、mutation negative receipt 或 production GATE-RUN；
- 无固定公网、desktop、390×844、硬件 GPU、实机或用户验收；交付未完成；
- 未修改生产 Mother 分支、main、包、托管、R2、冻结成果、排程或学习飞轮。

## 生命周期

- `POSTED=true`：[#91 comment 6665924603](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6665924603)
- `ACKNOWLEDGED=false`（Mechanical）
- `IMPLEMENTED=true`：offline package + Candidate probe only
- `GATE-RUN=true`：integrity、current Node test、static closure
- `production semantic closure GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 学习飞轮下一题

怎样在浏览器端建立同一份可审计 root ledger，统一覆盖 HTML module scripts、`import()`、workers、fetch/WGSL/WASM 与 import maps，并让构建产物、preflight、浏览器 trace 和 Delivery Receipt 都从它派生，而不是再次形成四份会漂移的手工清单？
