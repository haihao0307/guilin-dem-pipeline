# Weather Mother V1.5.0

公开总入口只有 `weather-mother/index.html`，默认进入 Weather Mother 母板首页。

Weather Mother 是长期主板。左侧导航持续保留以下入口：

- Weather Mother 首页
- World
- Rain
- Fog
- Snow
- Cloud
- Storm

子模块通过 `?module=<id>` 在同一母板内切换。根入口禁止跳转到子模块，禁止 iframe 壳层，禁止任何子模块覆盖 Weather Mother 品牌与返回路径。

Rain 当前运行 Liquid Rain V1.2，包含程序化降雨、板瓦与筒瓦汇水、檐口转移、砖墙受湿、积水、涟漪、水花、程序化声音、玻璃亭、玻璃表面水膜与湿玻璃折射。研发直达页保留为 `direct-rain-v120.html`，它不承担总入口职责。

Fog、Snow、Cloud 与 Storm 已接入母板并提供可运行候选场景。它们的视觉批准、3A 批准与生产批准仍保持 `false`。

继续工作依次阅读 `RESTART_START_HERE.md`、`HANDOFF.json`、`MASTER_SHELL_POLICY.json`、`UNIFIED_STUDIO_POLICY.json` 与各模块研究文件。
