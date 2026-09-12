# Weather Mother 全量交接 · R26 稳定基线 / R27 候选

日期：2026-09-12  
状态：**R27 已有可运行实现，但尚未获得用户视觉接受，也不是 production ready。**

## 当前真实进度

当前有两条必须同时保留的线：

1. **R26 Observation Bandwidth** 是上一份已完成自动公网 QA 的稳定回退基线。
2. **R27 Cloud Object DNA** 已经形成单文件候选，完成了观云与飞行共享同一云对象、Cloud Seed / Detail Seed、十云属入口以及“银边属于光学结果”的第一轮统一实现。

R27 不是空计划，但也不能写成最终完成：它仍需真实 iPhone Safari 验收、持续帧率与启动时间测量、十云属逐类视觉检查，以及用户最终 Judgment。

## 固定入口

R26 稳定回退：

`https://raw.githack.com/haihao0307/guilin-dem-pipeline/26c1b48fc48172ba64fe2d867f4f59a6584ccb33/weather-mother/full-weather-r26-observation-bandwidth-20260911/index.html`

R27 当前固定候选：

`https://raw.githack.com/haihao0307/guilin-dem-pipeline/d2f4ab4ce0b498c9a28e4b386c29109adbaf2283/weather-mother/full-weather-r27-unified-cloud-dna-20260912/index.html`

## 重开后的阅读顺序

1. `00_START_HERE.md`
2. `01_CURRENT_STATE.md`
3. `02_SOURCE_LOCKS.json`
4. `03_ARCHITECTURE_DECISIONS.md`
5. `04_R27_STATUS_AND_FAILURES.md`
6. `05_NEXT_STEPS.md`
7. `06_ACCEPTANCE_GATES.md`
8. `CURRENT.json`
9. 运行 `python verify_package.py`

## 包内入口

- `stable-r26/index.html`：稳定回退版本。
- `candidate-r27/index.html`：当前 R27 候选。
- `source/`：R23–R26、安全遮挡、观察带宽与 YOHEI Cloud Atlas R0.2 相关源件。
- `reference/`：R21 银边/云中飞行核心与 R22 完整 Weather Mother 包装。
- `workflows/`：R23–R27 构建和验证流程。
- `evidence/`：已存在的 QA、状态和工作流记录。

## 不得丢失的用户决定

- 银边不是独立云种，而是同一云对象在太阳、湿边、相函数和光学厚度条件下的成像结果。
- 观云、地面观察、飞机远看、云缘、云内和穿云后必须读取同一 Cloud Object。
- YOHEI 只继承跨尺度频带组织方法，不继承可识别构图、常数和画面身份。
- `cloudSeed` 管大形身份，`detailSeed` 管局部细节；两者必须可复现，不随镜头或帧变化。
- 十云属性能必须在真实目标设备上测，不能用小画布软件 QA 冒充手机帧率。
- 启动必须渐进：先有可见低频云，再逐步增加高频、光照缓存和历史收敛。
- 任何改动若让真实 iPhone 再次只剩纯色背景，立即回退该改动。
