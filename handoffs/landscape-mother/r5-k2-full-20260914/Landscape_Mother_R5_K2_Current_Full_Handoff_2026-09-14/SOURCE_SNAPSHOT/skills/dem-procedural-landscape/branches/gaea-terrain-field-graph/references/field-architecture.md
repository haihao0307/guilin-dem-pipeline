# GAEA 式程序化地形核心

## 1. 把地形看成一组相互关联的场

程序化地形的基础单位应当是连续标量场或向量场。每个节点接收场，输出新的场，或者输出用于后续处理的遮罩。

建议统一维护这些字段：

```text
Z_truth              原始 DEM 高程
Z_delta_macro        低频形态增强
Z_delta_meso         中频地质增强
N_micro              微法线或视觉位移
M_slope              坡度
M_curvature          曲率
M_flow               真实 DEM 推导的流水与汇流
M_cavity             凹地和遮蔽
M_protrusion         凸起、岩脊和露头
M_rock               岩石暴露概率
M_soil               土壤和沉积概率
M_wet                湿润、水痕和低洼积水概率
M_exposure           日照、迎风、风化暴露
M_separation         两种地形事件交界
C_albedo             综合色彩
R_roughness          粗糙度
AO                   环境遮蔽
```

同一个地质事件要同时影响高程、法线、颜色、粗糙度和 AO。这样才能形成有因果关系的表面，避免颜色像贴在地形上的花纹。

## 2. 五层架构

### 2.1 真值层

内容包括 DEM、岸线、河网、湖泊、道路、机场、城市、水深、AOI、CRS、仿射变换、来源许可和哈希。

规则：只读、可追溯、可复算。

### 2.2 形态层

负责可控的低频和中频增强：

```text
Primitives → Warp → Profile → Bounded Combine
```

适合的操作包括多重分形、山脊场、断层场、定向扭曲、Shaper、ThermalShaper、轻度 Terrace。

### 2.3 过程与数据层

负责地质过程和结构遮罩：

```text
Erosion → Fluvial / Hydro → Rugged → Stratify → MicroErosion
        → Slope / Curvature / Flow / Cavity / Protrusion / RockMap
```

真实水文必须由真实 DEM 和水系数据推导。程序化 Flow 只能作为表面风化或颜色辅助场，不能冒充河流真值。

### 2.4 外观层

负责结构驱动的综合色彩：

```text
Data Maps → AutoLevel → Clarity → CLUT5 → Splat → ColorFX
```

色彩应由坡度、曲率、岩石暴露、流水、沉积、湿润、植被和风化共同控制。

### 2.5 运行时与证据层

负责瓦片、LOD、WebGPU 或 WebGL2、确定性种子、性能、截图、DOM 状态和自动 QA。

## 3. 三个尺度必须分开

| 层级 | 推荐波长 | 用途 | 是否可改真值高程 |
|---|---:|---|---|
| Macro | 大于 64 个 DEM 像元 | 山体、盆地、主脊、主谷 | 默认禁止 |
| Meso | 8 到 64 个 DEM 像元 | 岩层、支脊、露头、冲沟、台地 | 仅在批准遮罩与幅度预算内 |
| Micro | 0.5 到 8 个 DEM 像元 | 细沟、碎石感、粗糙度、风化 | 优先进入法线和材质 |
| Subpixel | 小于 0.5 个 DEM 像元 | 砂砾、裂隙、颜色微扰 | 只进入着色器 |

常见错误是用同一类高频噪声铺满所有尺度。自然地形需要大片安静区域、中尺度结构区和少量高频细节区。

## 4. GAEA 式节点链的蒸馏

### 4.1 Primitives

```text
fBm              平滑多尺度起伏
Ridged fBm       山脊、岩脊、沟壑边缘
Worley           板块、碎裂区和细胞分区
Cracks           断裂遮罩，需多尺度叠加和扭曲
Fault / Ridge    定向构造线
Gradient         高度、方向、海陆和区域控制
```

### 4.2 Warp 与 Profile

Warp 负责打破直线、同心环和规则重复。Profile 负责控制总体轮廓。

推荐流程：

```text
低频 Warp 定大方向
中频 Warp 打破重复
很轻的高频 Warp 只修边界
```

域扭曲强度过高会移动山峰和河谷，必须受真值遮罩和幅度预算约束。

### 4.3 多次低强度处理

多次低强度 Rugged、Erosion、MicroErosion 通常更自然：

```text
Rugged A：大尺度、低强度
Rugged B：半尺度、低强度、不同种子
MicroErosion：只处理交界、凹地和细沟
```

每次处理都应保留独立输出，便于调试和回退。

### 4.4 Process Mask

所有重要节点都应接受 0 到 1 的处理遮罩：

```text
output = mix(input, process(input), mask)
```

遮罩来源可以是坡度、曲率、岩石暴露、海拔区间、流域、地类、人工保护区或用户批准区域。

### 4.5 Separation Mask

Combine 除了输出合成结果，还应输出两种场的交界：

```text
M_separation = sharpen(abs(A - B))
```

交界可以驱动岩屑、土石过渡、湿边、崩塌带、植被变化和综合色彩。

## 5. 数据图层怎样工作

### Slope

控制裸岩、土壤、植被、积雪和沉积。不要单独依赖坡度完成全部着色。

### Curvature

凸曲率适合岩脊高亮、干燥暴露和薄土层。凹曲率适合积湿、沉积、阴影和植被聚集。

### Flow

真实 Flow 来自 DEM 水文。视觉 Flow 可以辅助冲刷痕、湿润色和粗糙度变化。

### Cavity 与 Occlusion

控制凹地暗化、湿润、沉积和 AO。强度需要克制，避免所有沟谷变黑。

### Protrusion 与 RockMap

用于识别岩脊、露头、碎石坡和岩层结构。适合作为石材色、法线强度和粗糙度的主驱动。

### Soil 与 Sediment

控制谷底、缓坡和冲积区。要与坡度、汇流和曲率共同使用。

## 6. 色彩系统

### 6.1 先做结构场，再做颜色

推荐建立五段综合色盘：

```text
c0 深色湿岩或阴影
c1 冷色岩石或湿土
c2 区域基色
c3 暖色氧化、裸土或日照区
c4 浅色矿物、干燥沉积或高反照区
```

任意灰度结构场都可以进入 CLUT5。输入前先使用 AutoLevel 和 Clarity，让有效范围占满 0 到 1，同时保留局部对比。

### 6.2 Splat 必须归一化

```text
w_i = pow(max(mask_i, eps), sharpness)
W_i = w_i / sum(w)
color = sum(W_i * palette_i)
```

归一化可以避免颜色相加后过亮，也能让不同地质区之间形成可控竞争。

### 6.3 丰富色彩的来源

综合色彩来自多个宽尺度事件：

```text
岩性基色
湿润与流水
氧化与风化
矿物和盐析
土壤与沉积
植被覆盖
日照和迎风
凹凸结构
```

细噪声只允许提供轻微色差。高饱和颜色要局部出现，并且由结构遮罩约束。

### 6.4 锐度控制

```text
宽色块保持柔和
岩层交界适度锐利
裂隙和露头边缘局部锐利
远景自动降低锐度
```

## 7. 随机种子结构

建议至少拆分八类种子：

```text
master
shape
warp
geology
erosion
hydrology_visual
color
micro_detail
```

`master` 变化时派生全部子种子。单独修改某个子种子时，其余结构保持稳定。

种子必须使用全局坐标和稳定哈希。瓦片局部坐标会导致接缝。

## 8. 重要的反模式

1. 用程序噪声重写真实 DEM
2. 用视觉 Flow 冒充真实河流
3. 每个像元都叠加同等强度高频噪声
4. 用海拔单独决定所有颜色
5. 用一次高强度侵蚀完成全部结构
6. 颜色、粗糙度、法线和 AO 各自随机
7. 在瓦片局部坐标中取样
8. 用平均 FPS 掩盖单个窗口失败
9. 把自动 QA 当作人工视觉批准
10. 缺少来源、哈希、参数、种子和截图证据
