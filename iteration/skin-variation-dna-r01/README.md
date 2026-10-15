# SKIN-VARIATION-DNA-R01 / KAOPU 自然皮肤特征恢复候选

2026-10-15，基于 R03.1 冻结构建 `848ec5b5a13855184a747a2a90466ab283dcfd6d`；知识来源为 `kaopu-unified-human-workbench/knowledge/SKIN_VARIATION_DNA_KB_R01.md`。

这是面部 **生活痕迹 / 区域差异附加层**，保留原人物几何、基础皮肤材质、SSS、原生毛孔、面部造型和冷暖照明。不搬外部参考项目任何网格、贴图或 UV。

## 七种知识域映射

| 领域 | 数据依据 | 当前色彩/材质输出 |
|---|---|---|
| VascularMap | 鼻翼/鼻部/局部面颊+细小血色斑 | 轻度血色 albedo；保留原生 SSS |
| MelaninVariationMap | 分簇小雀斑/日晒斑+PIH | 独立色素 albedo，无额外高度 |
| SebumRoughnessMap | 鼻额颏优先，不额外改变基础肤色 | roughness 改变 |
| UnderEyeMap | 原生下眼睑解剖边界+局部不对称场 | pigment 与 vascular 两层；structural 不烘焙颜色 |
| AcneHistoryMap | 活动丘疹/极少脓疱、PIE、PIH、旧凹痕候选 | albedo、roughness、微法线；PIE/PIH 无高度 |
| FollicleAndBeardMap | 同源可复现根点采样，裁剪到头部原胡须域 | 根部蓝灰色 + 适度剃须残留；根点 API 可以供未来毛发工作台读取 |
| DrynessAndFlakeMap | 鼻翼、口周、颏、少量颊部 | 局部 roughness 和微法线；不全脸泛白 |

## 实现结构

- 原 R03 五层 1024x1024 RGBA8 `sampler2DArray` 保留，增加两层存储独立事件数据：总七层。总纹理基础数据约 28 MiB，含完整 mipmap 粗估约 37.3 MiB，未计 GPU 内部对齐与其他人物资产。新增片元**采样器数**为 0，但每像素确实增加了纹理采样和计算。
- 所有现象在原生 rest-space + 语义脸部锚点下工作，不依赖屏幕空间图像。
- 规则与参数存于 `iteration/skin-variation-dna-r01/dna-kernel.js`；基于固定 R03 HTML 的单值替换构建是 `build.py`。
- API：`window.skinVariationDNA_R01.setEnabled(bool)`, `setPreset('young'|'adult'|'mature')`, `set(key,value)`, `debug(0..8)`, `archive()`, `restore(recipe)`, `report()`, `roots(seed)`。
- 调整 R01 不改变 R02/R03 文件；新功能是 Draft 候选，不自动合并。

## 两个明确未实现边界

1. 目前 `scar` 仅输出 **微法线近似候选**，没有真实的 vertex displacement。只有未来具备准确局部拓扑/位移幅度和跨姿态检查时才适合正式开启旧凹陷疤痕的 displacement。
2. `roots(seed)` 与渲染胡根使用相同算法和数据字段，但独立毛发工作台还未对接种子/纹理空间变换，因此**不可声称已经和真实胡须毛囊资产逐根一致**。下一轮需检验真实毛发生长域、根点坐标转换和脸部形变稳定性。

## 三预设与验收

三套预设是同一人物、同一基础色、同一镜头及灯光下的不同经历，而不是三个换了体型和灯光的面孔：
- young：少量活动性粉刺，轻微胡茬，轻血色。
- adult：少量 PIE/PIH，自然色斑，眼下 pigment+vascular。
- mature：色素/局部血色偏明显，旧凹痕候选和轻干燥。

必须检查 **OFF→ON→OFF/ON 精确恢复**、七类语义蒙版、同一人物几何哈希、公共浏览器真实首帧和交互。自动化截图像素差异只证明效果发生，并不证明人类自然度达到要求。用户视觉认可前维持 `userVisualAccepted=false`。
