# DEM 桂林参考图约束喀斯特近景细节 v1.0

## 任务状态

```text
仓库: haihao0307/guilin-dem-pipeline
分支: skill/dem-procedural-landscape-v010
PR: 51
负责人: 小华
状态: implementation-contract
合并: 禁止
visualAcceptance: false
productionReady: false
```

## 一、目标

在现有桂林 10 km × 10 km、12.5 m 原像元真实地貌片区上，使用用户提供的 18 张阳朔与桂林参考照片和 DEM-M03 程序化地表技能，建立一块约 1 km² 的参考图约束喀斯特近景校准瓦片。

本轮只处理地形、台地、峰脚、崖壁、河岸、滩地、水系和地表材质。植被继续由独立生产系统负责。

## 二、只读输入

```text
z_truth_m
现有桂林 12.5 m 真实 DEM 裁片

approved_hydrology
经过批准的河流、水体和岸线

reference receipt
knowledge/terrain-hydrology/guilin/inbox/2026-08-27_guilin-geomorphology-photo-set-v001_RECEIPT.json

reference profile
knowledge/terrain-hydrology/guilin/distilled/GUILIN_KARST_REFERENCE_PROFILE_V1.json

visual grammar
knowledge/terrain-hydrology/guilin/distilled/GUILIN_YANGSHUO_KARST_VISUAL_GRAMMAR_V1.md

evidence matrix
knowledge/terrain-hydrology/guilin/distilled/GUILIN_KARST_IMAGE_EVIDENCE_MATRIX_V1.json
```

## 三、方法绑定

使用 `dem-procedural-surface-ecology@0.1.0` 的以下部分：

```text
可序列化 SurfaceNodeGraph
真实 DEM 导数
真实水文约束
世界坐标稳定字段
可逆 height_delta
程序化颜色、法线、粗糙度、AO 和受限视差
按观察距离展开细节
构建报告、对照包和回滚
```

禁用：

```text
森林
树冠
树干
灌木
草地
农作物
生态实例
```

## 四、输出层

```text
terrain_derivatives
slope, aspect, profile_curvature, plan_curvature, local_relief, TPI

karst_peak_fields
peak_footprint, crown_class, saddle, notch, interpeak_corridor

cliff_fields
cliff_core, cliff_edge, ledge, rock_exposure, footslope

hydrology_fields
approved_channel, derived_flow_diagnostic, gorge, floodplain, bar, low_island

z_micro_delta_candidate_m
默认值 0，带父级掩膜、最大幅度和回滚值

surface_material_fields
base color, normal, roughness, AO proxy, wetness, bounded parallax

comparison_bundle
truth, diagnostics, each candidate layer, final visual candidate
```

## 五、强制规则

1. `z_truth_m` 像元修改数必须为 0。
2. 垂直比例固定 1.0。
3. 主峰、主河谷和批准主河道位置保持不变。
4. NoData 不允许插值填洞，也不允许形成垂直墙。
5. 峰体不得生成针刺、规则阵列、统一圆锥或蜂窝重复。
6. 宽谷底与峰间低廊道必须保持可读和连续。
7. 河道必须顺低廊道连续前进并避开峰体核心。
8. 岩壁暴露采用斑块、竖向条带和台肩组合，禁止全坡均匀铺满。
9. 天然拱洞仅允许专门证据掩膜，数量默认为 0。
10. 微位移默认 0，未取得用户批准前不得作为默认画面。
11. 所有随机字段使用世界坐标、稳定种子和瓦片边界缓冲。
12. 参考照片不得直接投影为地形高度或材质贴图。

## 六、第一块校准瓦片

从桂林真实片区选择约 1 km² 范围，优先包含：

```text
一个或多个独立塔状峰
连续峰间低地
一段批准河道
一个峰脚转折
至少一处崖壁候选
一段低岸或滩地候选
```

选择理由、坐标、CRS、像元窗口、源 DEM 哈希和水系版本写入 manifest。

## 七、浏览器验收

提供同一相机和同一数据状态下的：

```text
真值 DEM
双线性连续显示
地貌诊断
材质细节
候选微地形
真值与候选 A/B
```

关键镜头：

1. 高视点峰丛。
2. 谷底与孤峰。
3. 峰脚。
4. 崖壁。
5. 河岸。
6. 峡谷或河道收缩段。
7. 贴地近景。
8. 俯视河流与峰体基座关系。

验收门槛：

```text
桌面 1440 × 1000
移动 390 × 844
控制台错误 0
页面错误 0
失败请求 0
近景无大方块突跳
真值与视觉细分密度分别显示
z_truth_m 修改数 0
所有微地形一键回退为 0
```

## 八、停止条件

出现以下任一情况时停止宣告通过，并提交阻塞证据：

```text
无法确认参考图对应范围
真实水系与参考关系冲突
微地形改变主峰或主河道
近景仍有明显方块
NoData 被填充
产生针刺峰或规则峰阵
视觉细分被误标为测绘精度
自动 QA 通过但关键镜头明显失败
```

## 九、交付

```text
节点图与 schema
源与输出 manifest
参数、种子和缓存键
八类关键截图
真值与候选 A/B
性能报告
QA 报告
回滚 manifest
下一步 Codex handoff
```
