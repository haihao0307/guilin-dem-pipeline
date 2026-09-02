# Weather Mother Easy Rain 技术蒸馏 V1

日期：2026-09-02

适用模块：`Weather Mother / Rain`

当前实现候选：`rain-v030 / 0.3.4-candidate`

## 1. 研究边界

这份档案把来源分成三层：

1. Easy Rain 官方公开资料能够直接确认的产品结构。
2. Epic Games 官方文档能够直接确认的引擎机制。
3. Weather Mother 为 WebGL2 环境独立设计并经过浏览器实验的实现。

商业产品没有公开的 Blueprint 图、Niagara 图、材质节点图、贴图、Flipbook、模型、声音和二进制资产均不进入 Weather Mother。无法从公开资料确认的商业内部参数保持未知，不使用视觉猜测冒充源码事实。

## 2. 官方来源

### 2.1 Easy Rain 官方资料

- Fab 产品页：
  https://www.fab.com/listings/274c81ae-3554-4801-8ec0-04f93212da06
- William Faucher 官方教程：
  https://www.youtube.com/watch?v=SHLCj1SwSSU
- 官方更新记录：
  https://docs.google.com/document/d/1SDxztZKled2rSgKw4_H74oa35KmEbSNiYdEJbsO_ZfQ/edit?usp=drive_link
- Epic Developer Community 产品讨论：
  https://forums.unrealengine.com/t/william-faucher-easyrain/2422456
- 作者项目页：
  https://will_faucher.artstation.com/projects/QKWx2l

Fab 官方页面直接确认：

- Blueprint 负责整体控制。
- Niagara 粒子负责空中降雨。
- 支持小雨到强烈夏季暴雨。
- 同时面向游戏、实时和离线渲染。
- Movie Render Queue 用于获得高质量运动模糊。
- 提供世界水洼 Material Function。
- 提供模型滴水、漏水和水珠 Material Function。
- 水洼具有涟漪、数量、衰减和破碎形态控制。
- 依赖 Mesh Distance Fields，并在教程中提供解决方法。
- 提供 `L_EasyRain_Showcase_Demo` 与 `L_EasyRain_ExampleDemo` 两个演示关卡。

官方讨论进一步表明，空中降雨状态与表面材质状态可以保持独立。Path Tracing 视口中快速雨滴的即时显示不等同于 Movie Render Queue 的最终时间采样结果。

公开资料没有支持以下结论：

- Easy Rain 的精确雨滴网格、Flipbook 内容和采样尺寸。
- Niagara 每个模块的完整参数。
- Blueprint 与 Material Function 的完整节点连接。
- 商业包内部用于遮挡、碰撞、飞溅或滴流的精确公式。

这些项目继续登记为未知。

### 2.2 Epic Games 官方技术资料

- Niagara Motion Blur：
  https://dev.epicgames.com/documentation/en-us/unreal-engine/setting-up-motion-blur
- Niagara Render Module Reference：
  https://dev.epicgames.com/documentation/en-us/unreal-engine/render-module-reference-for-niagara-effects-in-unreal-engine
- Utility Material Expressions：
  https://dev.epicgames.com/documentation/unreal-engine/utility-material-expressions-in-unreal-engine

Epic 文档直接支持以下技术判断：

1. 实时运动模糊通常读取 Velocity GBuffer。一个像素只保存一条速度向量，快速对象交叉、阴影和反射等次级运动会产生局限。
2. Movie Render Queue 可以在快门开放时间内均匀渲染多个时间样本，再合成为高质量帧。
3. Niagara Mesh Renderer 可以依据粒子速度、相机位置或相机平面对粒子网格定向。
4. DistanceFieldGradient 经过归一化后可以提供液体流动方向。
5. DistanceToNearestSurface 可以在世界空间查询最近遮挡表面的有符号距离。
6. Distance Field 表达需要在项目中启用 Generate Mesh Distance Fields。

## 3. 蒸馏后的 Rain 结构

Weather Mother 将 Rain 拆成六个共享时间、相互隔离的子系统：

```text
PrecipitationFlux
FallingDropField
RainCurtainField
ShelterAndImpactField
SurfaceWaterState
MaterialWaterResponse
```

### 3.1 PrecipitationFlux

这是所有雨效果共同读取的降雨质量输入。它控制空中雨滴数量、远景雨幕、撞击频率、飞溅、屋檐滴流、表面湿润和水洼增长。

```text
flux = intensity × temporalVariation × spatialWeatherMask
```

禁止让雨滴、水洼和湿润分别使用互不相关的随机强度。

### 3.2 FallingDropField

单个雨滴由世界空间位置、速度、尺寸、年龄和随机身份组成。

```text
velocity = gravityTerminalVelocity
         + altitudeWind
         + gust
         + boundedTurbulence
```

雨滴的可见拖尾读取快门时间：

```text
streakLengthWorld = |velocityRelativeToCamera| × shutterOpenSeconds
```

渲染约束：

- 近景雨滴宽度接近或低于一个像素。
- 高亮只在光线、视线与雨滴方向满足条件时增强。
- 雨滴透明度随背景亮度、距离和空气消光变化。
- 速度和尺寸具有分布，避免满屏等长平行白线。
- 近景数量严格受控，避免把暴雨解释成高亮划痕。
- 雨滴方向优先与世界速度对齐，摄影机只参与面向控制和透视投影。

### 3.3 RainCurtainField

远景降水由三个深度层构成，每层拥有独立尺度、速度、透明度和相位。远景层承担体量、空间纵深和空气消光，单个雨滴承担近景瞬时信息。

```text
near curtain   = sparse + higher contrast + faster apparent motion
middle curtain = moderate density + lower contrast
far curtain    = broad veil + strong atmospheric integration
```

三层需要读取同一风向和降雨通量，同时使用不同空间频率，避免出现同步滚动的透明平面。

### 3.4 ShelterAndImpactField

雨滴与屋面、砖墙、器物和地面共享遮挡场。遮挡结果同时控制空中雨滴终止、表面撞击和下方干燥区。

```text
exposure = 1 - shelterMask(worldPosition)
impactEnergy = dropMass × |normalVelocity|² × exposure
```

屋面下方保持较低直达降雨。屋檐和瓦槽汇水达到阈值后生成滴流。飞溅的半径、方向和寿命读取撞击能量与表面法线。

### 3.5 SurfaceWaterState

表面水是有记忆的状态：

```text
waterNext = waterCurrent
          + directRain
          + upstreamRunoff
          + splashTransfer
          - drainage
          - absorption
          - evaporation
          - edgeDischarge
```

停雨后，空中降水快速减少，地表仍持续排水、滴落和干燥。这个状态分离遵循 Easy Rain 官方公开的空中降雨与表面材质可独立控制关系。

### 3.6 MaterialWaterResponse

不同材料读取同一水量，产生不同结果。

#### 烧结砖

- 孔隙吸收优先于连续镜面水膜。
- 砖体颜色随含水量逐渐变暗。
- 孔洞、裂隙、灰缝和下缘保水时间更长。
- 竖向水路由重力、孔隙和表面起伏共同控制。
- 停雨后干燥速度低于瓦和金属。

#### 板瓦与筒瓦

- 板瓦凹面形成主排水槽。
- 筒瓦覆盖相邻板瓦纵缝并改变水路。
- 搭接、手工成型起伏和边缘缺损扰动水膜。
- 水量沿坡向向檐口输送。
- 檐口累计水量超过阈值后形成滴流或局部水帘。

#### 石板地面

- 低洼区储存水量。
- 接缝和坡度决定排水方向。
- 水深场控制反射、粗糙度、涟漪幅度和边界。

#### 金属或釉面器物

- 吸收较低。
- 微小附着珠能够合并、滑动和脱落。
- 反射与亮边受法线、接触角和光线方向控制。

## 4. Rain V0.3.4 独立实现

当前候选由 Weather Mother 独立实现，主要结构为：

- WebGL2 程序化场景。
- 世界空间实例化雨带。
- 快门时间控制拖尾长度。
- 近景与中景雨层。
- 三层远景雨幕。
- 缓存方向阴影图。
- 程序化板瓦与筒瓦几何。
- 程序化手工烧结砖墙。
- 瓦面遮雨、坡向汇水与檐滴。
- 砖体吸水、变暗和水路。
- 地面撞击、飞溅、水洼和涟漪状态。
- 水珠观察器物。
- 四套冷暖光照候选。
- 最终边缘平滑。

Rain V0.3.4 没有导入 Easy Rain 商业资产。砖瓦部分分别读取 Brick Mother 与 Tiles Mother 的权威程序化资料，重新适配到 Weather Mother 的降雨合同中。

## 5. 浏览器实验结论

真实 Chromium WebGL2 实验已确认：

- 压缩载荷能够完成 Base64 解码、gzip 解压和页面装入。
- 顶点与片元着色器能够编译和链接。
- 连续帧能够运行。
- Courtyard、Roof、Eave、Brick、Puddle 和 Water Bead 六个镜头能够渲染。
- 成片、湿润、积水、材质编号和遮雨区域五种诊断能够切换。
- 雨量、湿润和水洼状态能够连续推进。
- 控制台错误与页面错误为空。

软件渲染环境只用于功能验证。用户显卡上的原生 2K 和 4K 性能尚未验证。

## 6. 视觉门

Rain V0.3.4 当前属于可查看候选，仍需用户视觉检查。以下状态必须保持：

```text
visualApproved=false
aaaQualityApproved=false
productionReady=false
```

后续视觉验收重点：

1. 雨滴是否足够细、自然并具有距离层次。
2. 远景雨幕是否形成空间深度且不暴露平面重复。
3. 冷暖光是否形成可信的阴雨气氛。
4. 瓦槽、搭接和檐口排水是否读得清楚。
5. 砖体是否呈现吸水与缓慢干燥，避免塑料亮膜。
6. 水洼边缘、涟漪和器物水珠是否具备自然尺度。

只有人工视觉验收后，Rain 才能进入后续 3A 收敛和真实地形联调。
