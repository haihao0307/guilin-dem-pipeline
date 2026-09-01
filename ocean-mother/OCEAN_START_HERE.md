# Ocean Mother 启动记录与首项工作

## 当前状态

已完成 Weather Mother Clean V1.0.0 的源文件交接核对，并完成 OM-001 只读环境接入层及 17 项 Node 测试。真实浏览器本次因环境策略阻断，未取得浏览器通过证据。尚无新海洋在线页面，海浪和水天合成尚未实现。visualAcceptance 与 productionReady 保持 false。

## 唯一上游

仓库 haihao0307/guilin-dem-pipeline。

启动入口 weather-mother/OCEAN_START_HERE.md，固定 ref c762658e22d76f9d833c726140831ed257162b75。

交付目录 weather-mother/clean-v1，固定 ref 2619725efe236d2df8f2a55031bdae9e60a51555。版本 1.0.0-clean，渲染基线 0.6.2-loop，渲染来源 bf2aaa5d853af4f114c68d5bbafb99ea47134ef5。

先完整读取 OCEAN_HANDOFF.md、HANDOFF.json、MANIFEST.json、README.md，再读取 index.html、engine.js、field-worker.js、cloud.glsl、motion.js、reuse.js。不要用原 HANDOFF.json 的旧 repositoryReadRef 定位 clean-v1。它保留作来源记录。

vendor/weather-clean-v1 内的 12 个文件直接复用上述固定发布提交的 Git blob，未改写原文件。该副本只用于锁定上游和可复现测试，不构成新天气版本。核验记录见 evidence/HANDOFF_VERIFICATION.json。

原 ZIP 位置 weather-mother/distributions/Weather_Mother_Clean_V1.0.0.zip，使用上述交付 ref。字节数 37906，SHA256 596b963fef0cc2eafe7855178ae9f93c3e2aef2b78bdf98dd5e9e49c1a443bae。

## 本次真实执行记录

GitHub.fetch_file 已明确传入仓库、路径和固定 ref，完整读取启动说明及十份指定文件。较长文件采用完整连续行区间读取。

本次 ZIP 来自实际挂载的用户附件，已经列出全部路径、完成 CRC 检查并解压。没有从 GitHub 重新下载 ZIP。MANIFEST 中 11 项字节数与 SHA256 全通过，全部 12 项 Git blob 身份与固定发布 ref 一致，六个运行文件合计 72337 bytes。MANIFEST 的 baselineSHA256 用于历史比较；当前完整文件身份以 files 字段为准。

cloud.glsl、field-worker.js、motion.js 与锁定渲染基线哈希一致。没有替换天气内核，没有降低采样，没有引入旧生产线资产。包内 59 项自动检查及 60 项公开检查为历史结果，本轮没有重跑并冒领这些结果。

## OM-001

src/weather-bridge.mjs 提供 createWeatherBridge(WeatherMother)。只读 getEnvironment，不调用 set 或 applyConfiguration，不创建画布，不驱动第二套时钟。单位维持米、米每秒及 simulation second；坐标维持 +X 东、+Y 上、-Z 北。

waveWindVelocityMps 只复制 environment.wind.velocityMps。云速保持独立。offsetMetres 已经是米，不再次乘以 1000。日照数据原样传递，不额外生成太阳模型。模拟时间直接采用 simulationSeconds，不重复乘以 timeScale。回放倒退时 clockRewound 为 true，deltaSimulationSeconds 为零，下游应重置历史缓存。采样结果深度冻结，避免下游改写数据。

调用前必须确认 qa.ready；接口、版本、单位、坐标、数值或上游错误不符合约定时明确报错。resetClock 可在配置载入后重置差分基准。dispose 仅释放接入层状态，不销毁上游天气资源。

运行测试：

```sh
WEATHER_CLEAN_DIR=ocean-mother/vendor/weather-clean-v1 node --test ocean-mother/tests/weather-bridge.test.mjs
```

测试从经过 SHA256 核验的真实 engine.js 提取 getEnvironment，再在 Node vm 中执行。17 项通过，0 项失败。此结果只证明参数合同及接入逻辑；不代表完整渲染运行或视觉通过。详情见 evidence/OM001_QA.json。

## 下一项海洋任务

先完成 OM-002 真实浏览器接入验证，再制作独立海面候选。使用同源 HTTP 服务，启动原样 vendor/weather-clean-v1，在初始化及配置切换结束后读取接口。覆盖四种来风方向、风云速度独立、显式 windLink、暂停、timeScale、昼夜数据以及配置保存载入。保存实际浏览器版本、视口、控制参数、consoleErrors、pageErrors、failedRequests 与截图。环境阻断需要单独记录，禁止伪造浏览器结果。

随后再设计海浪谱、独立涌浪、近景细节、泡沫、潮汐、海水光学与海底。上述均为后续范围，没有在 OM-001 中实现。共享相机、真实场景深度、云海合成与天空反射要独立验收，禁止将两个独立画布叠加后宣告水天一体。

保持十种云属、八种天气案例、原连续循环、独立风力和云速及光照。七彩云、台风和新版闪电不并入当前工作。普通晴日保持闪电默认关闭。

## 分支边界

本轮仅添加 ocean-mother/。仓库现有 AGENTS.md 已读取。其他生产线、DEM 数值资产、main、gh-pages 及现有发布页面均不修改；不删除依赖，不改写历史。人工视觉和生产批准由用户决定。
