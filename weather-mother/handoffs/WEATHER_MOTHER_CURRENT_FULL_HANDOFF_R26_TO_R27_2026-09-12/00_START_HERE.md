# Weather Mother · R26 → R27 全量交接

日期：2026-09-12

仓库：`haihao0307/guilin-dem-pipeline`

交接分支：`handoff/weather-mother-r26-to-r27-full-20260912`

全量包：`WEATHER_MOTHER_CURRENT_FULL_HANDOFF_R26_TO_R27_2026-09-12.zip`

## 先做什么

1. 解压全量包。
2. 依次读取：
   - `00_START_HERE.md`
   - `01_CURRENT_STATE.md`
   - `02_SOURCE_LOCKS.json`
   - `03_ARCHITECTURE_DECISIONS.md`
   - `04_USER_JUDGMENT_AND_CORRECTIONS.md`
   - `05_R27_NEXT_WORK.md`
   - `06_QA_AND_PUBLIC_LINKS.md`
   - `07_PACKAGE_SCOPE.md`
   - `08_PACKAGE_CHECKLIST.json`
3. 运行：

```bash
python verify_package.py
```

## 当前真实状态

- 最后完成并通过自动公网 QA 的候选是 **R26 Observation Bandwidth**。
- R26 固定页面提交：`26c1b48fc48172ba64fe2d867f4f59a6584ccb33`。
- R26 证据头：`df296367d842e91279a42fc2616b7e0e441ca141`。
- 用户已在真实 iPhone 上确认 **R23 云体可见**；R26 尚未获得真实 iPhone 人眼接受。
- **R27 统一十云属、观云与飞行、双种子 Cloud DNA 尚未实际实现。** 不得把讨论或计划写成已完成。

## 下一条唯一主线

不要再建立独立的“银边云”或飞行专用简化云。R27 必须让观云、地面观察、飞机远看、进入云缘、云内穿行、飞出云层读取同一份：

`CloudEnvelope → CloudState → CloudDetail → CloudOptics`

YOHEI 只保留跨尺度相关场、稳定低频前缀和观察带宽方法；不得继续复制其具体画面、具体常数组合或可辨识的视觉笔迹。

## 绝对保护

- 不覆盖 R21、R22、R23、R25、R26 固定版本。
- 不把自动测试通过冒充用户视觉接受。
- 不重新启用曾导致真实 iPhone 空屏的高风险深度 FBO 路径，除非独立能力检测和真机回退已完成。
- 不把程序相位变化冒充真实 CloudTransport。
- 不因镜头移动而改变 Cloud Object 身份或随机种子。
