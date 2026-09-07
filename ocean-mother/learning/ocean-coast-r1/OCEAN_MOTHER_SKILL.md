---
name: ocean-mother-ocean-coast-r1
version: 1.0.0
status: knowledge-adopted-with-isolated-reference-kernels
runtimeIntegrated: false
---

# Ocean Mother 海洋与近岸技能 R1

日期：2026年9月7日。

## 1. WaterBody 的最小身份

Ocean 以 WaterBody 对象组织以下状态：

1. `waterBodyId`，对象身份和配方版本。
2. `z_bed(x,z)`，海床或水体底部真值。
3. `eta_tide(x,z,t)`，慢时间尺度潮位。
4. `X(q,t)`，自由表面参数曲面。
5. `eta_local(x,z,t)`，有限区域内的局部表面修正。
6. `WaterSurfaceOptics`，空气与水界面的反射、透射、粗糙度和泡沫覆盖。
7. `WaterVolumeOptics`，吸收、散射、悬浮物、光程和底部贡献。
8. `CoastBoundary`，固体占据、边界法线、水深、岸坡和开放边界。

海床和海面分别保存职责。海床来自 DEM、bathymetry 或明确的程序化试验真值。海面由潮位、波和必要局部状态随时间产生。

## 2. 时间合同

统一世界时间记为 `t_world`。Ocean 内部分开记录：

1. `t_tide`，潮位状态时间。
2. `t_wave`，波相位或波谱状态时间。
3. `dt_local`，局部连续流体步长。
4. `t_view`，观察和呈现时间。

这些时间可以使用不同更新频率，同时必须能够映射到同一个世界时刻。暂停、恢复、掉帧和不可见状态需要明确推进规则。动态状态不能遗漏时间依赖，静态岸体不能因相机移动重新生成。

## 3. 同一个自由表面服务画面与物理

推荐保留参数坐标 `q`：

`X(q,t) = (q.x + dx(q,t), eta(q,t), q.z + dz(q,t))`

切线、法线和速度都从同一个 `X` 求导。对外查询接口候选：

```text
sampleSurfaceWorld(worldX, worldZ, absoluteTime, recipeVersion)
```

返回至少包含：

1. 世界位置和高度。
2. 参数坐标 `q`。
3. 水平位移。
4. 世界法线。
5. 表面速度。
6. 查询方法、迭代次数和残差。
7. `approximate` 标记。

存在水平位移时，需要反求 `q`。把世界 XZ 直接当作参数坐标会产生可见高度误差。水平映射接近折叠或 Jacobian 奇异时，查询必须报告失败或近似状态。

## 4. 波的尺度分工

低频负责可辨认的主波群和长涌浪。中频负责波脊、方向差异和局部起伏。高频负责当前观察带宽需要的细波纹和微表面。

增加高频层时保留原有低频系数。禁止重新归一化全部频带后暗改主波。视觉带宽和物理查询带宽可以分别请求，二者共享同一个 WaterBody 身份和波配方。

## 5. 潮位、海底和岸线

总表面可以写成：

`eta_total = eta_tide + eta_wave + eta_local`

瞬时水深：

`h = max(0, eta_total - z_bed)`

测绘或历史时刻的 canonical shoreline 保存为验证约束。当前 wet shoreline 由 `h=0` 动态产生。潮位变化不能改写海底高程，也不能改写 canonical shoreline。

远海可以使用低成本解析波或频谱。近岸增加水深影响、折射、破碎候选和岸线湿润。港湾、礁石、岛体绕流和强交互区域才开启有限局部求解。

## 6. 水面界面、水下介质和泡沫

`WaterSurfaceOptics` 读取世界法线、观察方向、太阳和天空入射光、折射率、微表面粗糙度和泡沫覆盖。

`WaterVolumeOptics` 读取米制光程和每米消光参数。均匀介质的基础束透射为：

`sigma_t = sigma_a + sigma_s`

`T = exp(-sigma_t * pathM)`

它只描述直达束衰减。完整水体还需要入散射、底部材料、折射路径和悬浮物。

泡沫保存独立的产生率、覆盖率、输运来源、消退率和寿命。固定白边、高光涂白或金属度增加不能代替泡沫状态。

## 7. Weather 只读接口

Ocean 从 Weather 读取候选接口：

```text
sunDirection(t)
sunRadiance(t)
sunTransmittance(x,t)
skyRadiance(x,omega,t)
windVelocity(x,t)
```

云光学厚度改变入射光。海面高度、法线、粗糙度和泡沫由 Ocean 自己的状态决定。风改变波谱或泡沫时，需要明确的 Ocean 状态更新和时间尺度。

## 8. Coast 烟的有限连续状态

Coast 浓烟候选使用有限区域内的：

1. 速度 `u(x,t)`。
2. 非负浓度 `c(x,t)`。
3. 温度或浮力代理 `T(x,t)`。
4. 源项 `S(x,t)`。
5. 固体边界和流出边界。

粗浓度和速度承担历史。高频细节只能作为受输运约束的显示细化，并保留 `A_smoke=0` 的恢复路径。离开域边缘的烟不能从另一侧重新进入，岛体附近不能穿透。

先验证一个烟源，再验证热浮升、岛体边界、开放边界，随后扩展到多处烟火。火焰保存自己的燃料、温度、反应、发光和寿命状态。

## 9. 资源与缓存

静态海床、岸线和材料坐标场可以按完整依赖键缓存。动态波、潮位、泡沫和烟需要包含时间语义和状态版本。缓存键至少记录算法版本、输入修订、空间范围、分辨率、精度、时间合同和上下文 epoch。

局部三维域每轴分辨率翻倍时，体素数量约增加八倍。状态、双缓冲、临时场、光学缓存和渲染目标分别计数。禁止逐帧把完整三维场在 CPU 和 GPU 之间往返。

小文件只能说明分发体积。运行时数组、GPU 纹理、射线步数和帧时间必须单独测量。

## 10. 当前 R018.11 映射

1. `shoreDistance` 对应现有隐式岸体边界候选。
2. `terrainHeight` 对应程序化海床与岛体高度。
3. `waterHeightAt` 对应零水平位移的近岸自由表面高度。
4. `waterNormal` 和 `traceWater` 已读取同一高度函数。
5. `foamField` 和 `foamFilament` 对应无历史泡沫外观。
6. `curlDensity` 和 `sprayDensity` 对应卷浪与飞沫显示体积。
7. `shadeWater` 对应当前合并式水面着色。
8. `smokeDensityAt` 对应四个无历史程序化烟源。

## 11. 接入顺序

1. 固定 `breaker` 小海面，建立近岸对外查询。
2. 验证 JavaScript 与 GLSL 的高度、法线和时间一致性。
3. 加入独立潮位层和动态 wet shoreline，保持海床真值。
4. 分开水面界面与水下介质参数。
5. 给泡沫增加产生、输运、寿命和消退状态。
6. 在独立有限域验证一个 Coast 烟源和开放边界。
7. 通过门禁后扩展多处烟火及岛体交互。
8. 在目标 Windows GPU 和移动设备上测帧时间、显存、稳定性和画质。

## 12. 证据边界

本技能已经完成知识吸收、当前代码答卷和 24 项参考内核检查。R018.11 运行时文件没有修改。浏览器、GPU、公开 URL、真实潮汐、近岸动力学、烟流体和用户视觉验收都尚未完成。
