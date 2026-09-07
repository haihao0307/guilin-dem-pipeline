# Ocean Mother 学习入口

当前学习层包含两项增量：

1. `learning/water-v01/SKILL.md`，接收小妈 V1.1.1 早期资料、依赖组织、泡沫、光学和材料场方法，含三项独立参考函数及 22 项测试。
2. `learning/ocean-coast-r1/START_HERE.md`，接收小妈 2026年9月6日至7日的 Ocean Coast 专包、当前实现十题答卷、WaterBody 分层、自由表面世界查询、潮位海底关系、表面与体积光学、Coast 连续浓烟和观察带宽方法，含 24 项隔离 JavaScript 检查。

原生产入口继续使用 `restart-v0311/START_HERE.md`。R018.11 主运行时、冻结深海、岛体、沙滩、石头、火焰、烟雾、镜头与公开部署均未修改。

复跑命令：

```bash
node ocean-mother/learning/water-v01/test-kernels.mjs
node ocean-mother/learning/ocean-coast-r1/test-kernels.mjs
```

两组测试都不覆盖生产网页、浏览器 GPU、真实设备性能或视觉验收。

生产故障恢复仍先检查真实硬件稳定性、重复求值成本和静态场缓存。海洋算法进入复杂造波、泡沫或近岸流体前，先在固定 `breaker` 小海面建立 `sampleSurfaceWorld`，证明可见表面、法线和世界查询同源。两项工作分别保留恢复点和误差证据。

`runtimeIntegrated=false`

`visualAcceptance=false`

`productionReady=false`
