# Weather Mother 当前全量交接包

版本：R26 CURRENT / R27 PENDING  
日期：2026-09-11  
状态：进行中，未完成。

当前最后一份已经实际构建并通过自动公网 QA 的候选是 R26 Observation Bandwidth。页面提交为 `26c1b48fc48172ba64fe2d867f4f59a6584ccb33`，证据分支头为 `df296367d842e91279a42fc2616b7e0e441ca141`。

固定入口：
`https://raw.githack.com/haihao0307/guilin-dem-pipeline/26c1b48fc48172ba64fe2d867f4f59a6584ccb33/weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html`

R26 已完成手机可见云路径、移动端安全飞机层、连续光学遮挡和观察带宽。用户随后确定的 R27 统一架构尚未实现，不能写成已经完成。

重开后依次阅读：

1. `01_CURRENT_STATE.md`
2. `02_SOURCE_LOCKS.json`
3. `03_ARCHITECTURE_DECISIONS.md`
4. `04_KNOWN_ISSUES_AND_FAILURES.md`
5. `05_NEXT_R27_PLAN.md`
6. `06_ACCEPTANCE_GATES.md`

然后运行：

```bash
python verify_package.py
```

当前可执行版本位于 `runtime/index.html`。

下一版必须遵守：银边不是独立云种；观云与飞行共享同一云对象；YOHEI 只保留跨尺度方法；增加 Cloud Seed 与 Detail Seed；十云属按真实设备预算优化；云中自由穿行改为渐进启动。

当前状态：R26 browser QA 已通过；用户已在真实 iPhone 上确认 R23 云体可见；R26 尚未完成真实 iPhone 视觉验收；productionReady=false；R27Implemented=false。
