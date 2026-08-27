# 昆明 ASF 11 张 DEM 连续长方形项目

本目录管理已经下载完成的 11 张 ASF RTC 参考 DEM、连续长方形拼接结果，以及从桂林生产线迁移来的第一版地形技能与浏览器预览流程。

## 当前权威范围

翠湖中心的 20,000 平方公里正方形属于早期规划记录。当前权威范围根据 11 张实际 DEM 的连续覆盖确定：

- 形状：长方形
- 项目投影：`EPSG:32648`
- 投影边界：`209000, 2651625, 344500, 2885125`
- 宽度：`135500 m`
- 高度：`233500 m`
- 面积：`31639.25 km²`
- 输出像元间距：`12.5 m`
- 栅格尺寸：`10840 × 18680`
- 有效覆盖率：`100%`
- NoData 缺口：`0 km²`
- 权威 AOI：`aoi/kunming_asf_11tiles_rect.geojson`

## 真值 DEM

正式标识：

```text
12.5米输出像元的ASF RTC参考DEM
native12_5mSurveyClaim=false
```

真值主文件：

```text
KUNMING_ASF_11TILES_RECT_12P5M_COG.tif
```

SHA-256：

```text
af95c47f55ab8ff25d33ddc96d07c6d85fc1fcd4c2a2de9e2bef51a015860c50
```

完整 QA 位于：

```text
reports/KUNMING_ASF_11TILES_QA.json
```

## 桂林技能迁移

昆明项目绑定以下 GitHub 技能：

1. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/skills/process-dem-with-gaea`
2. `skills/dem-ecology-surface`
3. `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/skills/generate-guilin-dem-fine-regions`
4. `skills/process-kunming-dem-first-pass/SKILL.md`

项目遵守三层高度规则：

```text
z_truth_m       只读真值 DEM
z_micro_delta_m 可回滚的 Gaea 或程序化增量
z_visual_m      浏览器显示高度
```

第一版预览没有改写真值 DEM。岩石、侵蚀、湿润度和局部起伏均为单独的视觉派生层。

## 第一版预览

第一版包含：

- 地形
- 高程
- 坡度
- 岩石暴露代理
- 侵蚀代理
- 源片重叠
- 垂直夸张、岩石强度、侵蚀强度和光照方向
- 透视、俯视、平移、旋转、缩放、截图和全屏
- WebGL2 三维显示及二维交互回退

交接文件：

```text
HANDOFF_KUNMING_GUILIN_SKILL_V001.md
```

## 生产边界

该阶段不启用 30 米最终回退，不把浏览器重采样描述为数据精度提升，不把程序化侵蚀写入真值 COG，也不提前宣称未来核心区具有 1 米或更高测绘精度。
