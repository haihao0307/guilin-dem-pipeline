# Stone Money Island / Ocean Master
# 动态水线相机与水下视觉执行令 R01

日期：2026-09-21
任务类型：REFERENCE_METHOD_TRANSFER / BOUNDED_IMPLEMENTATION
用户参考：
- https://discourse.threejs.org/t/is-it-possible-to-have-a-camera-partially-submerged-in-water/68689
- Martin Upitis water/underwater shader lineage
- achrefelouafi/WaterThreeJS (MIT) 作为现代 Three.js 架构参考

## 0. 小妈判断：有价值，但不能照抄“整屏切换”

这个方向对 Stone Money Island 有高价值，尤其适用于：
- 玩家涉水，眼睛靠近波面；
- 头部一半在水上、一半在水下；
- 游泳/潜水时穿越动态波面；
- 观察浅礁、鱼、珊瑚和水下地形；
- 鱼、钓线、飞沫与玩家视角共享同一水面。

真正值得学习的是：
1. 水上/水下使用不同光学路径；
2. Beer–Lambert 吸收/颜色消光；
3. 水下体积散射与 god-rays；
4. 海床/物体 caustics；
5. 从水下向上看的折射、Snell window / total internal reflection；
6. 相机穿越水面时连续过渡；
7. 同一个动态水面同时驱动视觉、物理与 camera medium state。

但不允许直接照抄一个全局 bool：
`underwater = cameraY < surfaceHeight`
然后整屏一帧切成“水下模式”。

现代 WaterThreeJS 参考本身就采用 camera center 的二值 immersion test，再把 `underwater` bool 送入整屏后处理。这个结构适合“完全在水上 / 完全在水下”，但不能独立满足用户要求的“相机部分浸水、同一帧同时看见水上和水下”。

R01 的核心必须是：
**PER-PIXEL WATERLINE MASK + authoritative dynamic surface**
而不是全屏模式开关。

---

## 1. 权威输入不能另造

Ocean Master 必须消费既有 Stone Money authoritative surface contract：

`surfaceAt(x,z,worldTime) -> eta, normal, surfaceVelocity, bed, depth, breaker, clarity`

禁止：
- 新建静态 `y=0` water plane 当真值；
- 为相机单独写第二套 wave function；
- 为水下视觉另造时间；
- 用屏幕水平线假装动态波面；
- 改冻结 Ocean source 来迁就效果。

允许：
- adapter；
- GPU/CPU mirror，但必须有同源性测试；
- screen-space/depth-based pass；
- derived waterline mask。

---

## 2. 单一 primary defect

本轮只解决：

**当相机穿越动态波面时，同一帧能够连续显示水上区域和水下区域，且分界线来自 authoritative water surface。**

本轮不顺手：
- 重做 Ocean 全部海浪；
- 重做天空；
- 重做珊瑚；
- 重做岸线；
- 加大量水下生物；
- 改游戏剧情；
- 改鱼的行为。

---

## 3. 推荐渲染结构

### Pass A — Scene linear HDR + depth
保持当前场景线性 HDR 输出和 depth。

### Pass B — Dynamic Waterline Mask
生成每像素水/空气介质 mask。

mask 必须由当前帧动态 surface 得出。
它要能出现：
- 0：空气像素
- 1：水下像素
- 0–1 transition/AA：水线边缘

不能只看 camera center。

建议实现：
- 渲染 authoritative displaced water surface 的 depth / front-back relation；
- 或重建 view ray 与 dynamic surface 的交点；
- 用 scene depth 判断当前可见 fragment 的 ray segment 是否位于水下体积；
- mask 的时间参数严格使用 shared worldTime。

### Pass C — Above-water branch
沿用/消费现有 Ocean：
- atmosphere / sky
- surface reflection
- surface refraction
- above-water color
- existing foam

不要为了本任务替换现有已认可深海/云。

### Pass D — Underwater branch
只在 mask=underwater 区域作用：

1. Beer–Lambert absorption
   `T = exp(-sigma_a * pathLength)`
2. in-scattering / fog
3. caustics on submerged geometry
4. optional volumetric sun shafts
5. upward surface optics:
   - water→air refraction
   - Snell window
   - total internal reflection
6. restrained underwater particles / bubbles for scale

### Pass E — Interface band
水线附近单独处理：
- thin foam / micro bubbles only when actual breaker/contact/splash supports it；
- crossing droplets only after real surface exit/entry event；
- no permanent white ribbon；
- no fixed screen-space foam strip。

---

## 4. Game Mother 数据接口

Ocean Master 输出：

```js
cameraMediumSample = {
  worldTime,
  cameraPosition,
  surfaceEta,
  surfaceNormal,
  signedDistanceToSurface,
  immersionFraction,
  waterlineVisible,
  clarity,
  depth,
  breaker
}
```

Game Mother只消费，不重算第二套水面。

Game 可以由它派生：
- PLAYER_HEAD_ABOVE
- PLAYER_HEAD_PARTIAL
- PLAYER_HEAD_SUBMERGED

以及事件：
- camera_surface_enter
- camera_surface_exit

注意：
`immersionFraction` 是 visual/gameplay camera state。
它不能替代 Fish 的 `immersionFraction` 或实体水体碰撞状态。

---

## 5. 必须保留的 Stone Money 现有门禁

- one authoritative Ocean surface
- shared worldTime
- no permanent underwater x-ray camera
- frozen Ocean source byte-stable；adapter优先
- existing fish crossing discontinuity <= 0.15 m 不改变
- fish/splash contact <= 0.20 m 不改变
- shoreline first-cell contact gap <= 0.05 m 不改变
- desktop 与 390×844 分开验收
- physical iPhone / productionReady 不得自动置 true

---

## 6. 第一阶段验收，不做大而全

建立一个 10–30 m 的浅礁/沙底测试 cell。

固定相机做三个状态：

### A. Above
相机眼点明确高于 crest。
- underwater mask ≈ 0
- 原水上效果不退化

### B. Partial
相机穿过实际动态波面。
硬要求：
- 同一帧必须同时存在 air pixels 与 underwater pixels；
- waterline 随波面形状弯曲，不是水平直线；
- camera 轻微上下移动时不能整屏突然翻转；
- 水线位置必须来自 shared surface，而不是静态阈值。

### C. Under
相机完整浸水。
- absorption/scattering 可见；
- 向上看能看到受折射约束的明亮水面/天空关系；
- 不能变成纯蓝雾或黑顶。

---

## 7. 数值 / 自动测试

至少要有：

1. `surfaceAt` crest / trough / moving-time samples finite。
2. camera signed distance 使用 shared surface。
3. partial state 必须出现 mask coverage 同时满足：
   - airCoverage > 0
   - underwaterCoverage > 0
4. camera 从 +0.25m 扫到 -0.25m 时至少出现一个真实 partial frame；
   全屏 bool flip 直接 FAIL。
5. mask waterline world samples 回投 authoritative surface：
   `abs(sampleY - eta) <= 0.05m`（第一 cell 工程门）。
6. no static `y=0` assumption test。
7. same worldTime used by Ocean and camera-medium sample。
8. deterministic replay at 30/60/120 fps for camera vertical sweep。
9. no NaN/Inf in mask, refraction, absorption。
10. adapter disabled A/B returns frozen baseline.

---

## 8. 视觉 QA

必须新鲜生成，绑定当前 head：

Desktop：
- above
- partial
- underwater-looking-forward
- underwater-looking-up
- waterline close-up

390×844：
- above
- partial
- underwater-looking-up

每张要带：
- taskId
- head SHA
- worldTime / camera signedDistance
- waterline mask coverage

用户看到前，Verifier先判断：
- 水线是否真随浪；
- 水下是否只是蓝色滤镜；
- caustics 是否贴屏；
- god-rays 是否与太阳方向一致；
- foam/bubbles 是否有物理事件来源；
- 进入/离开水面是否有整屏 pop。

---

## 9. 性能分层

不要把参考实现的 28-step volumetric march 原样带到手机。

建议：
Desktop:
- full mask resolution
- higher volumetric steps
- full caustics

390×844:
- half/quarter-res volumetric buffer
- reduced ray steps
- temporal accumulation only if stable
- caustics lower resolution
- marine snow density reduced

但画质降级不能改变 surface/waterline 几何真值。

---

## 10. 哪些参考效果可以学，哪些先不要

高价值：
- partial waterline
- absorption/extinction
- caustics
- volumetric scattering
- upward refraction / Snell window
- foam/bubbles tied to actual interface events

谨慎：
- lens droplets：只在真实出水/飞溅后短时触发；
- chromatic aberration：极弱，不能当“水下感”主手段。

先禁用：
- 持续 wobble 的“underwater distortion”；
- 全屏蓝滤镜；
- 固定水平水线；
- 水下黑顶；
- 永久镜头水滴；
- 为了效果引入第二套海面。

---

## 11. 来源与许可边界

Three.js forum 是方法讨论入口。

Martin Upitis 旧实现是视觉/光学方法参考；其本人后续公开说明过某些 underwater distortion 是不真实的，因此不要继承为物理真值。

`achrefelouafi/WaterThreeJS` 为 MIT，可学习/复用实现；如果复制 substantial code，保留其 MIT copyright/permission notice。

我们最终生产实现优先：
- 保持 Stone Money 自己的 Ocean surface；
- 只迁移可解释算法关系；
- 不把第三方岛、波谱、颜色、相机参数或水体数值作为 Palau 真值。

---

## 12. R01 交付状态

执行端只能回：

- CANDIDATE_READY
- HOLD_GATE_FAIL
- BLOCKED_VALID
- NO_NEW_ARTIFACT

STARTED 仍要求：
post-dispatch executable code + executed tests + exact base/head + known-limitations receipt。

这个文档本身不是 STARTED。


## 13. 最终用户交付必须是单体 HTML

本任务最终给用户验收的页面必须输出为一个双击即可直接运行的 standalone HTML，例如：

`Stone_Money_Camera_Crossing_R01.html`

该文件必须内含本任务运行所需的全部 JavaScript、Three.js/runtime、shader、CSS、图片、测试场景参数、必要模型/音频/decoder。不得要求用户解压、启动 Vite/npm/Python/local server、配置相对路径、下载额外 asset 或打开第二个工具。

必须真实执行本地 `file://` 双击验收：
- 首帧成功；
- Above / Partial / Under 三状态可切换或实际穿越；
- partial 同帧 air + underwater 成立；
- console 0 error；
- 无缺失资产；
- 无 file:// CORS 核心失败；
- 核心运行所需网络请求 = 0。

开发阶段可保持多文件，但交付构建必须把它们 bundle/inline/编码进单个 HTML。公网链接只能作为同一 standalone HTML 的附加镜像，不能替代双击文件。

Receipt 追加：
```json
{
  "singleFileHtml": true,
  "fileProtocolTested": true,
  "requiresUnzip": false,
  "requiresServer": false,
  "requiresExternalAssets": false,
  "requiresCDN": false,
  "requiredNetworkRequests": 0,
  "consoleErrors": 0
}
```

跨 Mother 永久规则：`knowledge/SINGLE_FILE_DOUBLE_CLICK_HTML_DELIVERY_GATE.md`。
