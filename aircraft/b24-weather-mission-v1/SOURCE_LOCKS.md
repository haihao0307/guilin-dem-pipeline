# B-24 V010 与 Weather Mother 合并工作台 R2

本目录保存用于公开发布的可复现源材料。发布流程从 AIRCRAFT 仓库读取用户确认过的 V010 HTML，核对字节数与 SHA-256，再叠加 Weather Mother、夯实土跑道、任务循环、螺旋桨一致旋转和起落架状态控制。

## V010 权威基线

- 仓库：`haihao0307/AIRCRAFT`
- 提交：`51929b3dc0a55c34315c2e822f6e0e13eaafb87a`
- 路径：`handoff/2026-08-29-b24-v010-ridged-noise-v002/current_v010/B24_V010_RIDGED_LOCAL_DAMAGE_REVIEW.html`
- 字节数：`12550988`
- SHA-256：`1b5b860ca78a7d55ea25d0d972a1d323125a57982d09452e7f7e0cb55d64a949`

## 权威 B-24 锁

- GLB 字节数：`23085972`
- GLB SHA-256：`541c3dcfb98ab590cdb1bc90d6ddcdfe80bce2a4b937f3bccefab0c7efe8be0d`
- V010 内嵌数字机体与原始动画保持原样
- 禁止程序化替代飞机

## Weather Mother

- 版本：`1.0.0-clean`
- 运行基线：`0.6.2-loop`
- 作为同一页面内的背景环境运行

## R2 修正范围

- 工作台构建编号：`B24_V010_WEATHER_MISSION_RECOVERY_R2`
- 跑道表面：`compacted-earth`
- 跑道标线：`false`
- 停机、启动、滑跑和着陆阶段起落架状态受任务时间线控制
- 15 个识别到的螺旋桨根节点统一连续旋转
- 原 V010 几何、贴图、材质和动画数据不改写
- `visualAcceptance=false`
- `productionReady=false`

## 运行时载荷

`runtime.parts/` 中的八个文件按文件名顺序拼接后进行 Base64 解码，得到 `runtime.tar.gz`。

- `runtime.tar.gz` 字节数：`42741`
- `runtime.tar.gz` SHA-256：`cac414871097f6da636ab9d7275407b0dacb4e99001e3d5054089117b2fe18d3`

压缩包内包含：

- `runtime/mission-v010.js`
- `runtime/mission-v010.css`
- `runtime/weather/index.html`
- `tools/build_from_v010.py`

公开入口继续使用：

`https://haihao0307.github.io/guilin-dem-pipeline/aircraft/b24-weather-mission-v1/`
