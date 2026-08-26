# 程序化地貌生产线三地典型生态样板 v0.1

负责人：小华

## 目标

为桂林、温州、昆明各建立一个可点击、可旋转、可缩放、可切换图层的典型地貌生态页面。三个页面统一使用 10 km × 10 km、100 km² 展示框架。

## 地区表达

桂林：喀斯特峰丛、河谷、稻田、田埂、竹林、常绿林与裸岩。保留原桂林 10 km² v0.3.1 样板及 GAEA 证明入口，并明确原验证核心面积。

温州：沿海山地、河口、潮滩、近岸、常绿林、河岸灌丛、坡脚农田与低坡梯田。父级陆地真值保持 12.5 m COG 只读，页面不宣告精确 100 km² 真值裁片已经挂载。

昆明：高原盆地、红土低丘、季节湿地、排水廊道、农田、疏林与聚落边缘。页面保留当前失败检查和来源不确定性提示，手绘水体不得成为真值。

## 事实边界

```text
proceduralPreview=true
native12p5mTruthForEachShowcase=false
native1mSurveyClaim=false
truthOverwrite=false
syntheticGapFill=false
visualAcceptance=false
productionReady=false
publicReleaseApproved=false
```

## 验收

1. 入口页显示三个地区卡片和统一范围。
2. 三个地区均能通过独立 URL 打开。
3. 桌面 1440 × 1000 与移动 390 × 844 共八个页面组合通过 Chromium QA。
4. 图层开关、拖动旋转、滚轮缩放和显示高差控制有效。
5. 控制台错误、页面错误和失败请求均为 0。
6. 桂林原 10 km² 核心、温州父级 12.5 m 真值、昆明失败检查均在页面公开标注。
7. 用户视觉批准前保持 Draft，禁止标记为生产完成或公开发布。
