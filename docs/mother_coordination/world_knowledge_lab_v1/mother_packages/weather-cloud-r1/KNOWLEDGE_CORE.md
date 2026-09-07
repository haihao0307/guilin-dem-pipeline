# Weather / Cloud Knowledge Core R1

## 1. 时间第一

Weather Mother 必须先区分：

`t_world` 世界时间。

`t_weather` 天气状态时间。

`dt` 状态推进步长。

`t_view` 观察时间。

`t_phase` 只用于艺术或程序相位的时间。

所有真正随时间变化的云状态通过显式推进：

`state_next = advanceWeather(state_now, dt, environment)`

只改变噪声相位、颜色或纹理时间，只能证明画面变化，不能证明云被风输运。

## 2. Weather 与 Cloud 的对象身份

Weather 是世界环境系统，Cloud 是其中可具有稳定身份的体积对象或体积群。

每个云团至少应有：

`cloudId`

`referenceFrame`

`envelopeVersion`

`stateVersion`

`seed`

`history/checkpoint`

相机移动、太阳移动和观察精度变化不能让同一团云变成另一团云。

## 3. 云拆成五层

### CloudEnvelope

大尺度位置、整体厚度、云底、云顶、空区和主轮廓。

输出 `B(x,t)`，范围零到一，只承担大形门控。

### CloudState

保存需要历史的粗状态。最小候选：

`rho_sim(x,t)` 非负介质浓度代理。

`u(x,t)` 速度场。

源项 `S`。

消散项 `sink`。

尚未物理标定时，不得把 `rho_sim` 写成真实质量密度单位。

### CloudDetail

只负责中尺度团块、薄边、卷曲和细丝。细节初期应是只读细化：

`rho_render = max(0, B * (rho_sim + A * M * D(q)))`

`A=0` 必须恢复粗状态。

### CloudTransport

负责状态真正被风带动：

`rho_next = Advect(rho_sim, u, dt) + source - sink`

任何输运实验必须同时观察质心、峰值、边缘和总量，不能只看一张漂亮图。

### CloudOptics

负责吸收、散射、相位方向、太阳光、天空光和观察射线。

最小消光：

`sigma_t = k_t * rho_render`

`T = exp(-integral sigma_t ds)`

## 4. Weather 的公共只读接口

Weather 对外提供环境，不让外部系统反写内部状态：

`sunDirection(t)`

`sunRadiance(t)`

`skyRadiance(x,omega,t)`

`sunTransmittance(x,t)`

`windVelocity(x,t)`

`precipitationState(x,t)`

Ocean、Landscape、House、B24 可以查询这些接口，但不能直接改 Weather 的云密度、风场或光学状态。

## 5. 从 World Kernel 继承的原则

观察带宽代替 LOD。远处的云只需要主轮廓、云层关系和整体光学；近处才展开更多中频和微细节。

无人观察时，云仍保留因果所需的最低状态。观察者只决定显示和查询深度。

视觉、物理、交互和故事需求可以分别申请精度。

高频细节集中在有意义区域，必须保留大片安静区和清楚负空间。

## 6. 从 Object DNA 继承的原则

Cloud DNA 长期保存最小充分状态和规则，不保存“永远最高精度的整片体素世界”。

同一 DNA、同一状态、同一时间、同一精度请求应可重复重建。

随机性必须有稳定种子和明确随机域。

## 7. 当前不允许的偷换

噪声动画不等于输运。

白色透明球不等于云体积光学。

PBR 表面通道不等于云介质参数。

更高体素分辨率不等于更正确。

总质量相近不等于细节保持。

漂亮日落不等于密度正确。

画面运动不等于天气状态连续。
