# KAOPU Learning Flywheel N271 — Weather R48 性能声明回执闭包

## 本轮唯一 bounded question

`main@018e401d0b87446eddd6da6c4af34ba931466151` 的 Weather R48，是否提供了一个可取回、绑定 exact subject 的性能回执，足以支持 commit 标题中的 “improve interactive and clear sky frame rates”？

## 先读与精确对象

按轮次前置要求重新读取当前 main 的根 `AGENTS.md`、R2 OS、reference-replication gate、freshness gate、#91/#63 最新评论和适用历史证据。三份门禁与根 AGENTS blob 均未变；#91 尚无对 N265/N270 的 Mother ACK。

- R47 commit: `e3f80e7edff4e161427a0c29c34f0acbce58760d`
- R48 commit: `018e401d0b87446eddd6da6c4af34ba931466151`
- exact subject: `weather-mother/r48-cloud-performance-20261111/`
- R48 exact commit 关联 workflow runs: `0`

## 真实新增

R48 不是空改名，代码差异可精确定位：

| 场景 | R47 | R48 |
|---|---:|---:|
| 互动云体积采样 | 256 | 192 |
| 互动云光照采样 | 12 | 8 |
| 晴空疏云 sun-depth samples | 5 | 4 |
| 晴空疏云 minimum step | 0.045 | 0.055 |

R48 README 也诚实声明：

- 这是画质/性能权衡；
- 未证明视觉等价；
- 测试仅一台设备、960×540、约五秒；
- 用户设备帧率会不同；
- 详情只在“本地测试记录”。

## Closure check

R48 exact commit 共 21 个文件。没有可取回的性能 receipt，也没有声明该记录的 exact path / digest。README 没有给出：

- R47/R48 成对原始测量；
- device / OS / browser / GPU / driver / power state；
- viewport 与实际 render size 的完整绑定；
- warmup、采样窗口、可见性状态；
- raw frame intervals、p95 frame time 或可验证的 GPU timer 样本；
- 固定视角视觉差异结果。

同一候选目录里的旧 R36 `pages/waves.html`（blob `e3670a3c8a60ab99f0e64d083a2c0dc70246b81a`）已经实现 5 秒测量、P95 frame time、像素/steps 记录及 `EXT_disjoint_timer_query_webgl2` 的 disjoint-aware GPU 计时。因此“如何记录基本性能证据”不是新的方法知识；问题是 R48 的 claim 没有把自己的 exact receipt 提交进可审计闭包。

## Decision

`HOLD_R48_PERFORMANCE_IMPROVEMENT_RECEIPT_NOT_RETRIEVABLE`

允许写：

- R48 有真实 source delta；
- 参数方向可能降低每帧工作量；
- README 对视觉等价与设备外推保持诚实。

不得写：

- 已证明 R48 比 R47 更快；
- 已证明视觉等价；
- 已通过 browser / hardware GPU / device / production / user acceptance。

Novelty：`NO_NOVELTY`。这是 R2 + freshness / Delivery Receipt 既有机制的一个新 exact-subject 证据，不新建 regression，不改 OS。

## 最小可反驳修复（仅 Weather R48）

1. 在 exact commit 中提交一个 receipt path + SHA-256，绑定 R47/R48 两组 exact blobs。
2. 同一设备、浏览器、GPU/driver、power state、viewport、render size、scene、参数、warmup 与可见性状态下成对测量。
3. 保存 raw frame intervals，至少给 median FPS + p95 frame time；GPU timer disjoint 时样本作废。
4. 固定视角比较视觉差异；未完成仍写 UNKNOWN。
5. receipt 缺失、hash 不符或环境字段缺失时 fail closed。

## 边界与生命周期

本轮只写学习分支证据；未改 production Mother、main、R2、门禁、公网页或资产。未调用浏览器/硬件 GPU/真实设备，未做生产、视觉或用户验收。

写入时：Candidate evidence `IMPLEMENTED`，exact-subject closure `GATE-RUN`；`ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false`。定向评论发布后才可记 `POSTED=true`。
