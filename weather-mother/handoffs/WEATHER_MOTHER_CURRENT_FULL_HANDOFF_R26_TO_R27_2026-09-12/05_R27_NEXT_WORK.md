# 05 · R27 下一步工作

## 总目标

把 R0.2 十云属、R21/R22 接受的银边与云间驾驶、R23 iPhone cloud-first、R25 光学遮挡和 R26 观察带宽收束为一个 Weather World。

## 分阶段执行

### Gate 0 · 建立不可回退基线

- 从交接分支创建 `feature/weather-mother-r27-unified-cloud-object-dna`。
- 固定 R21、R22、R23、R25、R26 来源哈希。
- 自动截图并保存当前 R21 银边、R23 iPhone 云、R26 近/中/远频带三组对照。
- 任一后续版本必须能一键回退到 R23 cloud-first。

### Gate 1 · 抽出唯一 Cloud DNA

先只做积云，不立即接十种：

```text
CloudDNA
  objectId
  genus
  objectSeed
  detailSeed
  envelopeParameters
  densityParameters
  opticsParameters
  timeOrigin
```

验收：观云和飞行读取相同对象 ID、相同双种子和相同密度函数。

### Gate 2 · 把银边降为光学结果

- 删除主线 `silver` 作为云类型的语义。
- 用太阳方向、相函数、湿边、光学厚度产生银边。
- 固定 Seed 下移动太阳，银边位置应移动但主云体不变。
- Density 诊断在太阳变化时必须逐值保持不变。

### Gate 3 · 双种子和 Weather Mother 自己的画面

- 加入 Object Seed / Detail Seed 输入与导出。
- 同一 Object Seed 改 Detail Seed：大形近似不变，细节变化。
- 改 Object Seed：主云瓣、空洞、左右关系和塔体显著变化。
- 默认参数不得复现可辨识 YOHEI 构图或原始常数组合。
- 至少生成 12 颗积云联系表，检查重复和“同一朵云换噪声”的假变化。

### Gate 4 · 同一对象的观云与飞行

- Observer 模式：Orbit / Ground / Chase / Free Flight。
- 切换观察者不得重建 CloudDNA、不得换种子、不得清空时间状态。
- 脚本路径必须完成：晴空 → 湿边 → 厚区 → 云内 → 飞出云层。
- 中心射线 optical depth / transmittance 必须连续变化。

### Gate 5 · 性能和启动

性能门禁必须测真实渲染，不只测 UI：

- 390×844 iPhone 级内部动态分辨率；
- 移动时低采样、停止后累积；
- 空区跳步；
- 透射低阈值提前退出；
- 光照缓存按需、分块建立；
- 首帧先出天空和低频云，不能等待完整 cache；
- 记录首个可见云帧时间、首个可交互时间、稳定帧时间。

### Gate 6 · 扩展十云属

积云通过后，按顺序接入：

1. 层积云
2. 层云
3. 高积云
4. 高层云
5. 雨层云
6. 卷云
7. 卷积云
8. 卷层云
9. 积雨云

每类必须有独立 envelope 和光学倾向，不允许只换颜色或 Seed。

## R27 第一版的完成定义

第一版不要求十类全部完成。达到以下条件才可交用户：

- 同一积云对象可观云、地面看、追尾、自由飞行；
- 双种子可调、可导出、可复现；
- 银边是光学结果；
- R23 云体可见底线不退化；
- R25 光学透射连续；
- R26 观察带宽保持；
- 启动时间和稳定帧率有真实数据；
- 固定提交公网链接已实际打开验证；
- `visualAcceptance=false`，等待用户判断。
