# Mark 3 学生原生车厢主壳 R01

## 范围与状态

本版是可编辑的自有截面与曲面规则研究壳。生成器不读取原模型，不保留原顶点、源点表、全量残差或原材质图片。老师模型只用于离线观察组件名称；没有将它的几何载荷写入此模块。

当前组成：两个有真实窗/门开孔的连续侧壁、光顺肩顶、内衬、窗洞厚度内壁、独立玻璃和胶圈、四片有自身玻璃开孔的可开启门叶、两个有贯通道真开孔的端壁、贯通道胶套、地板上下表面。

不包含底盘、转向架、制动、连杆、完整乘客内饰、端部耦合器/管线或全部历史附件。原机构未被删除；本模块没有替代它们的权限或完成声明。首版代码与几何检查通过不等于视觉质量、车辆工程或完整性批准。

## 接口

文件：`src/coach-shell.mjs`

- `buildMark3Shell(params = {})`，别名 `generateCoachShell`
- 返回 `{schema, parts, parameters, evidence, openings, interfaces, bounds, envelopeCheck, completion}`
- `parts`：`{name, material, category, metadata, positions, normals, uvs, indices, materialGroups, uvUnits, doubleSided}`
- positions/normals 为 Float32Array，uvs 为 Float32Array，indices 为 Uint32Array
- 材质名仅为自有材质工厂的语义入口：`paint`、`blackPaint`、`glass`、`rubber`、`brushedMetal`、`interior`；不在此模块内创建临时材质
- `materialGroups = [{start, count, materialIndex}]` 可直接交给 Three BufferGeometry.addGroup
- Three 适配只需为 position/normal/uv 设 BufferAttribute，设置索引并按 material 取材质；不必重新计算法线
- 所有面的位置、法线、UV及索引在变参时重新构建，没有缓存老师几何
- UV 采用设计米长度坐标，不依赖原贴图展开
- `sampleMark3Section(params, z = 0, samples = 64)` 返回自有截面采样用于视图/检查，不是源点表

坐标：x 横向向右，y 向上，z 向车后；z=0 是裸壳中点。y=0 是轨面参考，未核高度依然是暂定值。不要因数值单位是米，就将全车标为真实米制校准。

## 截面与曲面规律

1. 侧壁最大半宽为 bodyWidth/2。下部收分由 lowerInset 控制，上部微收分由 upperInset 控制；以 waistY 分段，使用五阶 smoothstep 保持连接切线连续。
2. sideTop 到 roofTop 为自有半椭圆肩顶。侧壁在 sideTop 的横向导数为零，与椭圆肩部竖直切线相接；车顶中央切线水平。测试验证接缝坐标与法线连续。
3. 端部通过 endInset、endTaperLength 的五阶平滑纵向收分，并以 endRoofDip 轻微降低肩顶。截面不是挤出方盒。
4. 侧壁按每个圆角矩形开口的精确上下界分带生成。窗洞区域不生成主壳三角形；玻璃是另一部件。移除玻璃和门叶后，窗/门孔仍然存在。
5. 门叶也是独立有孔的曲面。doorOpenAngleDeg 围绕本地竖直铰轴旋转门体、玻璃与胶圈；这是学习版本的铰链演示，不表示已考证某个Mark3改造批次的真实门机构。
6. 端壁跟随同一侧壁/肩顶外轮廓，中央为贯通道圆角真孔；贯通道胶套由重复自有轮廓构成。
7. 法线来自曲面导数/局部几何，随参数重新生成；UV按新曲面尺度更新。

## 推荐编辑参数

| 参数 | 默认 | 含义/状态 |
|---|---:|---|
| nominalCoupledLength | 23.0 | 第一方公开贯通道间名义长度；不是裸壳长度 |
| bodyLength | 22.57 | 暂定裸壳长度，不能称实测 |
| bodyWidth | 2.740 | 第一方公开宽度；暂按裸壳最大宽解释，宽度测量基准仍待核 |
| bodyBottom / waistY | 0.98 / 2.04 | 暂定下缘/腰部高度 |
| sideTop / roofTop | 3.07 / 3.81 | 暂定肩线/裸壳顶高 |
| lowerInset / upperInset | 0.12 / 0.035 | 自有下、上侧壁收分 |
| endInset / endTaperLength | 0.085 / 1.55 | 自有端部横向收分及作用长度 |
| windowCount | 8 | 每侧主窗数量，变体未核 |
| windowSpan | 14.9 | 首末主窗中心跨度，暂定 |
| windowWidth / windowHeight | 1.65 / 0.86 | 暂定窗洞尺寸 |
| windowBottom / windowRadius | 2.03 / 0.095 | 暂定窗洞下缘/圆角 |
| doorWidth / doorHeight | 0.84 / 1.84 | 暂定侧门孔尺寸 |
| doorOpenAngleDeg | 0 | 0–90°原生门叶外开演示 |
| floorY / floorThickness | 1.24 / 0.065 | 暂定地板接口 |
| bogieCentres | 16.0 | 暂定转向架中心距，仅保留净空，不生成机构 |

安全的可视编辑例子：

```js
const coach = buildMark3Shell();
const lowerRoof = buildMark3Shell({ roofTop: 3.58 });
const widerStudy = buildMark3Shell({ bodyWidth: 2.92, roofTop: 3.96 });
const sevenWindows = buildMark3Shell({ windowCount: 7, windowWidth: 1.45, windowHeight: 0.76 });
const openDoorStudy = buildMark3Shell({ doorOpenAngleDeg: 38 });
const exposedApertures = buildMark3Shell({ includeGlass: false, includeDoors: false });
```

没有 `roofRise` 参数：顶升为 roofTop-sideTop。未知键会报错，避免视图宣称变参成功但实际未变化。所有参数必须有限；窗口相交、门出界、屋顶低于肩部、底盘净空高于地板底等均拒绝生成。单独缩短车长时，必须同时调整窗跨距/端门布局，不能把交叠几何默默输出。

## 权威尺寸与未核尺寸严格分开

2026-10-17核查两项第一方页面，仅使用事实，不携带页面图片：

- Northampton & Lamport Railway 自有10412车厢页写23m为“over coupled gangways”。这支持贯通道间长度，不能用于裸壳长。https://nlr.org.uk/about-nlr/stock-list/coaches/br-mk3a-tsob-coach-10412/
- ROMIC自有Mk3非缓冲HST车队页公开长度23,000mm、宽度2,740mm、高度3,900mm。页面没有定义宽度是否包含胶圈等外凸物，高度也没有标为裸壳顶高。https://www.romicgroup.com/train-charter-hire/mk3-coaches/

因此本版 bodyLength22.57、roofTop3.81、地板、转向架接口、窗/门与截面全为 provisional。evidence.provisional 逐项记录，修改已发布锚点时记录 editedPublishedAnchors。

默认最终包围盒含胶圈约2.758m宽，超过暂按裸壳解释的2.740m；envelopeCheck明确 `not-calibrated-with-trim`，不得标“宽度匹配”。默认贯通道端面到端面为23m，车壳下缘到顶高度2.83m；这也不是3.9m的整车高。所有比较必须带相同测量对象与基准。

## 底盘/地板约定

interfaces.floor 公开地板顶面1.24、底面1.175。两个 provisional 净空盒中心z=±8.0、长度3.9、宽2.5、顶部y=1.10，保留至少0.075m名义地板间距。这是接口占位，不能当实际转向架尺寸或工程净空认证。没有新增、替换或删除原机构。

## Node测试与当前统计

运行：

```sh
node --test a4-mark3-rule-conversion-r01/student-native-r01/tests/coach-shell.test.mjs
```

冻结时14/14通过，约2秒。检查：确定性纯数组接口；所有属性有限、单位法线、合法索引、面朝向；24个真实侧壁窗/门孔及圆角保留；移除玻璃仍有洞；截面/窗数量/窗宽变形；门叶与玻璃同轴外开；肩顶位置/切线；尺寸证据区分；底盘净空；错误参数拒绝；运行时代码无文件/网络/源几何依赖。

默认112个部件、99,952三角形。数量不是质量证明；重复截面后续可共享/优化。本轮不以三角形多声称细节完整。端部细节、全部内饰、机械结构与材质视觉效果仍需各自验收。

旧08、源档与外观R03没有改动。此模块未发布GitHub Pages。
