# Ocean / Coast Knowledge Core R1

## 1. 时间第一

Ocean 至少区分：

`t_world` 世界时间。

`t_tide` 潮汐状态时间。

`t_wave` 波面相位或状态时间。

`dt_local` 局部连续流体时间步长。

`t_view` 观察时间。

潮汐、波和局部流体可以使用不同更新频率，但必须映射到同一个世界时间。

## 2. 海底和海面分开

海底：

`z_bed(x,y) = bathymetryTruth(x,y)`

海面：

`eta(x,y,t) = eta_tide + eta_wave + eta_local`

水深：

`h(x,y,t) = max(0, eta - z_bed)`

这个关系决定当前哪里有水、浅水区在哪里，以及动态 wet shoreline。

测绘意义的 canonical shoreline 与当前潮位下的 wet shoreline 必须分开保存。

## 3. Ocean 的四个核心职责

### OceanSurfaceState

自由表面位置、水平位移、高度、速度和法线。

### WaterSurfaceOptics

空气与水界面的反射、透射、粗糙度和泡沫覆盖。

### WaterVolumeOptics

进入水后的吸收、散射、悬浮物、水深和海底贡献。

### OceanEnvironmentAdapter

只读 Weather 的太阳、天空、风、云透射和降水。

## 4. Coast 的职责

CoastBoundary 保存岸线、岛体、海底、固体占据、法线、水深和流出边界。

LocalCoastFluid 只在真正需要连续流体的有限区域工作，例如礁石、港湾、岛体绕流或近岸烟场。

CoastSmoke 保存独立的速度、非负浓度、源项、温度/浮力代理和体积光学。

## 5. 按需计算

远海只需要：

大尺度潮位。

低成本波场。

低频水面光学。

靠近岸线以后，才增加：

水深影响。

小尺度波脊。

泡沫和破碎候选。

局部障碍关系。

真正需要交互的局部范围，才开启更贵的连续流场。

这不是 LOD 资产切换。同一个 WaterBody DNA 只是在当前观察和物理需求下展开不同频带和求值深度。

## 6. 海面和查询必须同源

只要水面存在水平位移，就必须警惕世界位置与参数坐标不一致。

可见高度、法线、速度、浮力、碰撞和水位查询必须来自同一个表面定义。

不能显示一套波、物理再查另一套便宜波。

## 7. 与 Weather 的职责边界

Weather 提供风、太阳、天空和云透射。

Ocean 决定这些环境输入怎样改变自己的波谱、界面光学和水体状态。

Cloud 变暗只能改变入射光，不允许直接改变海面法线或粗糙度。

## 8. 与 DEM/Landscape 的职责边界

Ocean 读取海底、岸坡和地形边界。

Ocean 不修改 DEM 真值。

潮汐上涨改变的是当前水覆盖状态，不是海底高程。

Landscape 的程序化近景细节若影响真实接触或水深，需要显式区分 visual micro detail 与 truth surface。

## 9. 当前硬边界

固定蓝色不等于水。

高光不等于水体光学。

粒子和 Niagara 当前不作为 Coast 浓烟生产路线。

周期边界不适合作为默认岸海流出边界。

MIP Fluid 的油亮显示不能直接当 Ocean 材质。

小文件不自动等于低 GPU 成本。
