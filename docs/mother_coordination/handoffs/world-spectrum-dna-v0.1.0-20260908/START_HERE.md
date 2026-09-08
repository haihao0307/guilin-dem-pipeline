# World Spectrum DNA V0.1.0 全量交接包

日期：2026-09-08  
状态：概念体系已收敛，首轮可执行原型已建立，尚未替换任何现有 DEM 或对象生产基线。  
目标使用者：Codex、小妈、Landscape Mother、DEM 生产线、Aircraft / Weapons / House / Vegetation 等对象生产线。

## 一句话定义

地球由两族闭合谱线建立地址。横谱与纵谱的唯一交点确定地表位置，谱对在交点处的耦合值生成高度与自然属性；时间选择世界版本，Object DNA 定义对象类型，实例与父子关系定义具体对象，事件流记录对象从生产、安装、运动、变化到结束的全过程。

## 这次包里已经固定的核心

1. 内部母语言采用谱位、时间、对象和关系，不再把经纬度或引擎 XYZ 当成权威身份。
2. 传统经纬度、DEM、卫星影像、OSM、UE、Three.js 坐标继续保留为边界转换器。
3. 地表地址由 `EarthID + SpectralPage + UPhase + VPhase` 确定。
4. 地表高度由横纵谱在交点处的多尺度耦合、真实锚点和少量残差共同重建。
5. 完整三维位置由地表谱位加局部法线方向的有符号偏移确定。
6. 简单区域使用低复杂度 DNA；复杂山地增加多声部谱、Ridged 细节和真实残差。
7. 每个对象拥有可复用 Type DNA、唯一 Instance、带时间有效期的父子关系和事件历史。
8. 子对象的世界位姿沿父链递归合成。只有 detach、destroy、transfer 等事件能够改变这条关系。
9. 网格、纹理、碰撞体和预览均属于可重建缓存；谱、DNA、锚点、关系、事件、证据和残差属于权威数据。
10. 同类对象采用“公共 DNA + 型号差异 + 变体差异 + 实例差异”蒸馏。学会一挺 M2 后，知识可以向其他枪械迁移；学会一架飞机、一个人、一个建筑后采用相同原则。

## Codex 开工顺序

本分支包含可重建的完整 Codex 源包：

```bash
cd docs/mother_coordination/handoffs/world-spectrum-dna-v0.1.0-20260908/bundle
python3 reconstruct_package.py
unzip ../World_Spectrum_DNA_Codex_Source_V0.1.0_2026-09-08.zip -d ../World_Spectrum_DNA_Codex_Source_V0.1.0_2026-09-08
cd ../World_Spectrum_DNA_Codex_Source_V0.1.0_2026-09-08
cat START_HERE.md
cd prototype && npm test
node demo.mjs
```

包内阅读顺序：

1. `docs/00_EXECUTIVE_SUMMARY.md`
2. `docs/01_WORLD_LANGUAGE_AND_INVARIANTS.md`
3. `docs/02_EARTH_SPECTRAL_COORDINATE.md`
4. `docs/03_SPECTRAL_HEIGHT_AND_DEM_PIPELINE.md`
5. `docs/04_TIME_OBJECT_PARENT_CHILD_MODEL.md`
6. `docs/05_OBJECT_DNA_DISTILLATION.md`
7. `docs/06_WSD_BINARY_FORMAT_DRAFT.md`
8. `docs/07_CODEX_IMPLEMENTATION_PLAN.md`
9. `docs/08_OPEN_RESEARCH_QUESTIONS.md`
10. `schemas/wsd-v0.1.schema.json`

当前原型覆盖：

- 64 位无符号固定点相位。
- 周期相位加法与最短距离。
- 横纵谱耦合高度场。
- 简化的周期 Ridged Multifractal。
- 对象父子关系、槽位、世界位姿递归合成。
- detach 事件前后父链变化。
- WSD0 分块二进制容器写入、CRC32 校验和读取。

## 第一轮严禁事项

- 不得替换温州或桂林现有真实 DEM 基线。
- 不得把 12.5 米 DEM 平滑误差当作真实厘米细节。
- 不得让生成噪声移动真实山峰、河谷、岸线、鞍部和主要坡折。
- 不得把经纬度删除到无法接入旧资料。它只从内部权威身份降级为兼容接口。
- 不得宣称两条全球闭合曲线天然只有一个交点。球面存在双交点、极点和接缝问题，V0.1 用极小 `SpectralPage` 或 branch 标记消歧。
- 不得把型号 DNA、具体实例、当前父级和历史事件混成一个记录。
- 不得用浮点角度作为持久身份。
- 不得把生成网格视为权威源。

## 第一轮验收

Codex 首轮只需完成隔离实验：

1. 从一块小型真实 12.5 米 DEM 窗口提取低频基线和锚点。
2. 将高度场编码成横向剖面族、纵向剖面族与残差。
3. 用谱对重建原分辨率 DEM，记录 RMSE、最大误差、山峰位移、河谷位移和坡度误差。
4. 在 12.5 米以下添加受坡度、曲率、岩性掩膜控制的 Ridged 与旋转衰减细节。
5. 证明加入细节后，真实锚点、主山脊、主河谷和岸线没有漂移。
6. 用同一 WSD 对象语法描述 B24 → 枪位 → Browning M2 → 机匣 → 枪管 / 螺丝。
7. 证明飞机移动时子件随父链移动，detach 之后子件停止继承原父对象。
8. 输出一份可重复运行的指标报告和一个单文件 HTML 观察台，观察台只用于查看，不作为权威数据。

## 完整性

Codex 源包 SHA256：

`04846fbbc31593e680eb976734460b4df4c31f29391236de02c883d9f7751507`

源包包含讨论整理、决策账本、九份体系文档、WSD JSON Schema、DEM 与 B24/M2 示例、JavaScript 原型和十二项测试。三张原始研究截图保存在聊天交付的完整压缩包中。