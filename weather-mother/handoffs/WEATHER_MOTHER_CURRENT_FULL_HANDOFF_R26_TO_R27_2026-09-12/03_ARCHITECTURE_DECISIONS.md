# 03 · 已确认的架构决定

## 1. 银边不是一种独立云

“银边”必须由同一朵云的光学关系产生：

`density × wet rim × sun direction × phase function × optical path → silver lining`

太阳方向改变，银边应在同一 Cloud Object 上移动；不能建立名为 `silver cloud` 的独立生产对象。

## 2. 观云和飞行只允许一个世界

观云、地面仰望、飞机远看、飞到云缘、进入厚区、穿出云层，只是不同 Observer / Camera。

长期主链必须统一为：

`CloudEnvelope → CloudState → CloudDetail → CloudTransport → CloudOptics`

当前 R27 首轮可先统一 Envelope / Detail / Optics 与观察者，不得冒充 Transport 已完成。

## 3. YOHEI 只保留方法，不保留画面笔迹

可以继承：

- 相关三角频带；
- log-spherical / domain transform；
- 频率逐层展开、幅度逐层衰减；
- 低频前缀稳定；
- 观察距离决定读取带宽；
- 局部坐标折叠只用于受控细节组织。

不可以继承：

- 原作可辨识的具体常数组合；
- 原作具体画面构图；
- 原作银边/云海作为生产对象；
- 把艺术射线累积当作真实气象或统一密度场。

## 4. Cloud DNA 必须有双种子

每个云对象至少包含：

- `genus`
- `objectSeed`：决定主云瓣、空洞、左右不对称、塔体和层断口；
- `detailSeed`：决定局部侵蚀、湿边、高频褶皱和丝状细节；
- `envelopeParameters`
- `densityState`
- `opticsParameters`
- `objectId`
- `timeOrigin`

种子必须是固定整数、可输入、可保存、可导出、可复现；不得随帧或相机移动变化。

UI 至少应有：

- Seed 输入；
- 上一颗；
- 下一颗；
- 随机生成；
- 锁定对象；
- 导出当前 Cloud DNA。

## 5. 观察带宽是精度读取，不是换云

近距读取完整频带，中距连续减少高频，远距只读稳定低频。新增或关闭高频不得重新归一化低频主体，也不得换 Seed。

R26 已证明这个方向可行，但目前只作用在移动端简化飞行云。R27 要把同一规则移到真正的十云属 Cloud DNA。

## 6. 移动端安全原则

真实 iPhone 曾因高风险深度/离屏路径只显示纯色背景。后续必须：

1. 先保证云体可见；
2. 能力检测；
3. 高级路径逐级启用；
4. 任一高级路径失败立即 fail-open 回到 cloud-first；
5. 不允许飞机系统让整片云消失。

R25 的 CPU 光学透射可继续作为安全层，但它不是共享深度的最终替代。

## 7. 性能与启动原则

十云属工作台的低帧率主要来自单一云的全屏体积 ray march，而不是十种云同时计算。成本近似：

`pixels × view steps × density cost + cloudy samples × light steps`

必须采用：

- 内部动态分辨率；
- 空区大步跳跃；
- 低透射提前退出；
- 运动时低采样、静止后累积；
- 太阳透射缓存；
- 按观察带宽读取频带；
- 真实设备帧率门禁。

R14/R21 启动慢主要来自 shader 编译、3D noise、3D light cache 和 temporal history 初始化。R27 应分阶段启动：先天空/低频云，再增量建 cache，再开放高频和高级光学。
