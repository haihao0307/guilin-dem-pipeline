# 程序化地貌生产线图层与导数基础 v0.3 执行任务

## 工作范围

继续在 `haihao0307/guilin-dem-pipeline` 的现有分支
`skill/dem-procedural-landscape-v010` 和 Draft PR #51 工作。

开始时重新确认远端 HEAD，从最新远端 HEAD 建立干净工作树并正常快进。保持 PR open、Draft、未合并。禁止强推、改写历史、修改 `main`、`gh-pages` 和其他项目 PR。

本轮只建设可执行图层合同、地形导数合同、可逆增量门槛和只读项目接线。不得修改任何权威 DEM、海底、潮汐、水系、道路、聚落、机场或历史真值。

## 一、图层样例

为以下角色分别建立通过 schema 的机器可读样例：

```text
truth
derived
historical-delta
procedural-delta
visual-delta
categorical-mask
instance-stream
```

每个样例必须记录：

```text
projectId
layerId
source status
source version
source checksum
CRS
transform
pixel origin
resolution
units
vertical datum
NoData
bounds
parent mask
maximum delta
rollback value
runtime role
quality status
```

`truth` 必须 `mutable=false` 且要求源校验和。所有 delta 必须具有父级掩膜、最大绝对增量、回滚值和 `reversible=true`。

## 二、地形导数 manifest

建立以下导数的统一 manifest 与验证规则：

```text
slope
aspect
profile curvature
plan curvature
mean curvature
relative elevation
local relief
topographic position
flow direction
flow accumulation
wetness
distance to water
distance to ridge
distance to road
distance to settlement
landform class
landform confidence
```

每个导数声明算法、窗口尺度、边界策略、单位、NoData、输入校验和和输出校验和。导数缺少真实输入时保持 `planned` 或 `blocked`，禁止生成占位数值。

## 三、温州只读接线

从 Draft PR #49 的已验证事实建立第一组只读 layer manifest：

```text
陆地 12.5 m COG
SHA256 8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e
EPSG:32651
11866 × 11866
truth mutable=false
native12_5mSurveyClaim=false

GEBCO 2026 派生 100 m 海底 COG
SHA256 591e92eef61699088a87e32bfd83417498f89cfe3a6a84f4ce6a2e2ac3b689fc
EPSG:32651
source vertical datum uncertainty retained
land pixels modified=0
```

只引用已经在 PR #49 中存在并通过 QA 的事实。FES2022b、验潮站、湿润干出、河口混合和浏览器水体继续保持未决状态。

## 四、编译门槛

扩展 validator，至少拒绝：

```text
truth 可写
truth 缺少校验和
跨项目源路径
30 m 最终回退
NoData 静默填充
程序化 delta 缺少父级掩膜
增量缺少最大值或回滚值
历史 1 m 输出声称原生测绘
视觉层覆盖真值层
公开候选缺少浏览器 QA、回滚和用户视觉批准
```

增加故障夹具和正常夹具，所有测试必须 fail closed。

## 五、状态网页候选

统一状态网页增加：

```text
图层角色
来源状态
真值校验和
CRS 与分辨率
父级掩膜
增量范围
回滚值
数据 QA
浏览器 QA
当前阻塞
```

继续提供桌面 1440 × 1000 和移动 390 × 844 真实 Chromium 截图。控制台错误、页面错误和失败请求均须为 0。

## 六、交付与事实边界

交付：

```text
layer manifest 样例
地形导数 manifest
扩展 validator
故障夹具与正常夹具
温州只读图层绑定
状态网页候选
Actions artifact
HANDOFF_DEM_PROCEDURAL_LANDSCAPE_LAYER_V030.md
```

完成声明必须区分：

```text
合同通过
图层 manifest 通过
真实数据存在
地形导数已经计算
浏览器通过
用户视觉批准
公开发布
```

保持 `publicReleaseApproved=false`，等待用户视觉批准。
