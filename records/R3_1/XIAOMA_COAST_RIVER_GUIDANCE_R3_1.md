# 温州R3.1：海陆分类、海域与河道知识指导

版本：WZ-COAST-RIVER R0.1，2026-09-09。按用户已认可R3后的新需求形成；固定R3与R2系列保留。小妈本轮只读已有数据身份/来源/报告，核对必要官方定义并写知识；没有生产海域掩膜、修改代码、下载向量或部署，不处理其他项目。温州在现有授权下并行实施，不新增等待或回签要求。

## 1. 本次问题和必须纠正的推论

当前海边“大框”来自DEM数据/裁切范围而非已建立的海陆分类。它不能被解释成可靠海岸，给矩形涂蓝或降低透明度也没有补齐海域语义。**低于某高程不等于海，NoData不等于海，有效零值不等于缺测，绘制在地表的线不等于水面或水文连接。**

已有资料足以定位部分有来源的岸线、水道和水体面，支持尽快改善展示；但旧范围、缺节点引用、岸线/水体面未联合、未知水位与垂直基准，使“立即得到完整可通水的真实海河系统”不能由现有文件推出。本轮目标是有依据的海陆边界与河道可见，不扩大成洪水、潮流、侵蚀或水深模拟。

正确顺序是：固定向量身份和覆盖 → 建立带未知状态的海陆分类 → 依据面与源DEM分别生成显示 → 标出有来源的河道 → 独立描述水位/连接的未知 → 数值、可视、体积检查。近地1.6m仅登记为后续视角目标，本轮不以更大放大或增加虚构细节满足它。

## 2. 已找到且可以定位的资料

以下三个载荷本轮由root和独立只读审读重新检查文件长度与SHA-256，均与旧记录一致。数量与既有验证范围来自报告；本轮未重新验证全部几何或执行GIS处理。

| 内容 | 真实文件路径 | 类型、数量、字节 |
|---|---|---|
| 海岸线 | [WENZHOU_COASTLINE_EPSG32651.geojson](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm/WENZHOU_COASTLINE_EPSG32651.geojson) | LineString，1,064段，8,699,726字节 |
| 水道中心线 | [WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm/WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson) | LineString，6,797段，16,890,175字节 |
| 水体面 | [WENZHOU_OSM_WATER_POLYGONS_EPSG32651.geojson](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm_water_polygons/WENZHOU_OSM_WATER_POLYGONS_EPSG32651.geojson) | 7,386个polygon parts，35,012,447字节；不是已验收海洋总掩膜 |

按表序的文件SHA-256：

```text
coast: f805bf3fd993639452c2cc79c548357bedd4d6dfb91204688f6f113de3be7eb6
river: be9ff893b26a24dad9808aac5b76625997c0f8b747b0721424b094449115c297
water: 1eba98cdbd1ec2c4be2e1526fd844bb6a2c080d446c282aea0a84ecf174310f2
```

三者显式记录EPSG:32651。不要把已投影E/N当经纬度再次投影或交给默认只接受WGS84的读取路径。需要重新裁切/核对源时，有对应原始坐标文件：

- [OSM_COASTLINE_SOURCE_WGS84.geojson](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm/OSM_COASTLINE_SOURCE_WGS84.geojson)。
- [OSM_WATERWAYS_SOURCE_WGS84.geojson](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm/OSM_WATERWAYS_SOURCE_WGS84.geojson)。
- [WENZHOU_OSM_WATER_POLYGONS_WGS84.geojson](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/data/hydrology/osm_water_polygons/WENZHOU_OSM_WATER_POLYGONS_WGS84.geojson)。

### 2.1 线资料的已验证部分与缺口

[R1水系QA](G:/DEM/Wenzhou_Knowledge_Lab_R1_20260909/evidence/HYDROLOGY_QA.json)记录42文件哈希匹配，海岸92,719个、河道146,345个派生顶点均与独立重投影源way或其裁切线段核对；无缺sourceWayId、重复partId或无效要素记录。81个岸线顶点、1,666个河道顶点在当前DEM矩形外。此结果证明已检范围的来源/投影一致性，不证明现今岸位精度、左右岸、河口连通或新AOI完整。

[OSM线资料回执](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/reports/OSM_HYDROLOGY_RECEIPT.json)明确来源OpenStreetMap/Overpass，ODbL 1.0、署名`© OpenStreetMap contributors`；复用2026-08-25旧区域并获取18个边缘查询块，2026-08-28完成，`fullFreshSnapshot=false`。不是2026-09-09统一时刻的新测量，更不是1997潮位序列的同期岸线。

[旧水系拓扑QA](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/reports/HYDROLOGY_TOPOLOGY_QA.json)有`projectedSkeletonPassed=true`，但`hydrologyTopologyPassed=false`、`passed=false`、`estuaryConnectivityStatus=pending`；节点引用状态为`not_evaluable_source_omits_node_ids`。尽管采集说明提及node IDs，当前样本的`source_node_count=0`与失败QA不能被那句说明覆盖。

6,797段实际分类为canal 3,438、river 1,469、stream 1,889、tidal_channel 1；应显示为水道网络的不同类别，不能全部命名“河流主干”。OSM水道通常按下游方向记录，但潮汐等可改变实际流向；标签约定也不代签这批派生线的节点顺序完整或当前流量。[OSM waterway定义](https://wiki.openstreetmap.org/wiki/Key:waterway)

### 2.2 水体面的使用条件

[水体面回执](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/reports/OSM_WATER_POLYGONS_RECEIPT.json)记录Overpass来源、9查询块、2026-08-29完成，源元素7,377个、派生面7,386片。[旧面QA](G:/DEM/project/wenzhou-v200-17tile-truth-hydrology-rebuild/projects/wenzhou/v200/reports/OSM_WATER_POLYGONS_QA.json)的`passed=true`只在其旧范围成立，明确保留`source_water_polygons_available_coastline_union_pending`。

[R1环境账本](G:/DEM/Wenzhou_Knowledge_Lab_R1_20260909/evidence/ENVIRONMENT_FILE_LEDGER.json)将这两份面载荷标为`present-not-automatically-accepted`，它们不在前述42文件独立水系核验范围中。不能把旧QA的7,610.2413 km²直接称为海域面积：尚须说明每个面的分类、重叠去重、孔洞与联合口径。本轮没有重新验证这些几何性质。

`natural=water`的通用语义主要是内陆水体，可含河面、湖泊、水库等；海岸另有`natural=coastline`规则。文件名里有water不能推出覆盖整个海洋。[OSM water定义](https://wiki.openstreetmap.org/wiki/Tag:natural%3Dwater)

### 2.3 旧范围不能冒充R3范围

这批投影资料metadata使用旧裁切矩形`[187912.5,3019612.5,407350,3243587.5]`，历史DEM绑定为`c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43`。R3栅格外缘为E=[190475,411250]、N=[2991275,3241862.5]；格心曲面域又比外缘各缩半格，详见[R3原指导第3节](XIAOMA_3D_KNOWLEDGE_R3.md)。

新矩形比旧裁切框向东多约3.9km、向南多约28.3375km；旧框则含部分新框以外的西/北区域。这是矩形范围差，不是新缺失面积的测量。**旧框外无要素不能解释成无河或无岛。**读取未裁切源可找回多少覆盖需实际检查，新边缘不足则只补明确缺口，记录新来源时刻；不要只改`boundToDem`字符串就称R3重新绑定通过。

## 3. 海域掩膜应怎样形成

### 3.1 独立保存分类和高程有效性

至少保留四类独立信息：

| 信息 | 例子 | 不得偷换成 |
|---|---|---|
| 高程查询状态 | 原像元值/规范曲面有效、NoData、域外 | 陆地/海洋分类 |
| 面分类 | land、marine、inlandWater、unknown；另留tidal/间歇属性与冲突状态 | 该时刻一定干燥/淹水 |
| 水面状态 | 源/基准/时间齐备的水位，或explicit visual assumption，或unknown | 海床/河床高程 |
| 关系状态 | 确认/候选的同水体、岸界、上游下游、河口连接 | 图上接触、同色或同父节点 |

分类至少带`classificationRevision, sourceRefs, sourceTime, coverageDomain, boundaryRule, status`。高程有效与分类有效各有自己的mask；一个没有DEM高程的已知海域仍可有marine类别，但海底高程/水深未知；一个有效负高程点仍可位于陆地低洼处。

### 3.2 本轮优先的两条面来源路线

**优先核对覆盖R3及少量外扩缓冲区的已处理海洋面，再裁切到展示域。**一个确有明确语义的来源入口是[OSM派生海洋水面](https://osmdata.openstreetmap.de/data/water-polygons.html)：由coastline组装，专门包含海洋/海域，区别于内陆natural=water；大面会切成轻微重叠的小块，可用WGS84或Mercator版本。执行线若采用，需固定真实下载版本/日期、CRS、许可、哈希与覆盖；本轮小妈只核对发布说明，没有下载或验收温州子集。不得把该来源入口写成已经存在的新本地载荷。

发布方会尝试修复岸线错误，但无法修复时可能不更新。因此“今天下载”不等于“今天海岸实测”。块之间的重叠不能重复累计面积或透明绘制；形成唯一分类可做明确联合/非重叠划分。全局简化版面向小比例尺显示，不能据此满足近地1.6m目标。

**备选为重建已有岸线面，但不能任意连缺口。**保留sourceWayId、原节点顺序、闭环和端点来源；在足够外扩域中检查断线、重复、自交、岛屿及内孔，标记裁切产生的端点。OSM岸线按行进方向陆左海右，并以平均大潮高潮线的制图约定表示海陆边界；这不是当前瞬时潮界。[OSM coastline定义](https://wiki.openstreetmap.org/wiki/Tag:natural%3Dcoastline)

在裁切边界上闭合多边形只可以表达明确的AOI截断：该段须标为`clipBoundary`，保持陆海侧依据。不能将任意两个内域断点直线相连，当作真实岸线；无法恢复的部分保留unknown。OSM河口海岸/内陆水面分界是制图边界，和水动力作用范围不同，不能因某一条线终止就认定真实水流中断。

### 3.3 去掉“大框”的显示办法

保留原DEM与规范曲面不变。派生的陆地显示域可以取：`有效规范曲面域 ∩ 已确认land域`，内陆水体如何覆盖单独定义；已确认marine域生成独立的海域显示面。unknown域不要补作海或陆，可在辅助边界视图中显式显示数据范围，首屏不必把范围画成实体墙。

海面显示的外边缘只代表AOI裁切，可以在视野外截断或使用明确的展示过渡，不伪装成第二条海岸。岛屿与孔洞要从marine面扣除，不能只盖一张大蓝平板压住岛和沿岸地形。片元掩膜可服务显示，但权威分类应有可查询的同版面定义。

粗三角形/LOD不能只检查四角或中心点的海陆类别：小岛、窄海湾或河口可能从单元内部穿过。应做面与显示单元的相交/裁切或有明确误差的边界细化，同时保持共享边界一致。海陆分类的离散误差、矢量简化误差和DEM高程误差分别记录；不能因线画得细就宣称边界精确。

## 4. 河道中心线、河面与DEM关系

### 4.1 先把已知线位标清楚

保留上述4类水道和原sourceWayId/partId，按用户可辨认的层级配色/线宽。未知宽度时可以用屏幕像素宽的符号线，必须叫“河道线位”，不能把它读成实际河宽。已有源width也要确认单位、范围及是否适用于该段，不能给所有支流套同一个实体宽度。

线的E/N来自向量源。若只是贴地标识，可沿原线在有效规范曲面求H，用现有局部映射显示，并加小的**显示抬升**避免闪烁；抬升不进入源位置、原高程或水位。地形粗LOD下若须使线可见，可按实际显示面调整渲染高度，但保留规范曲面查询，不能反写成河水高度。按曲率与显示误差补采样时，保留它只是原线的派生采样，没有新测量精度。

遇NoData、曲面域外或新AOI未覆盖，不允许把端点clamp到DEM边缘、跨洞拉直线、悄悄设H=0。可以断开相应贴地显示并保留原向量，或在明确的图层中显示无高程线位。判断断线原因须能分清：源水道真实终止、源资料缺口、显示裁切、高程不支持。

### 4.2 面与水位是另外两件事

实际河面需有水体多边形/左右岸或带证据的宽度函数；中心线缓冲只能生成**候选示意带**，不能凭它建立真实左右岸。当前7386片water polygons可作为候选面输入，但须完成类型筛选、孔洞/重叠/新范围核验以及与线位的冲突登记。

水面为`S_w(E,N,t)=(E,N,η(E,N,t))`，定义域是对应水体面。`η`需说明高程基准、时间、测量/模型与误差；源只有二维岸界时，η未知。沿中心线取`η=hDEM`会让水面跟随地形凹凸，可能翻坡或形成假落差；这只能是贴地符号，不能称为水面模型。当前DEM也未因覆盖河区就成为已测河床。

需要本轮先有海水外观时，可以采用明确标为`visualAssumption`的固定平面或其他显示规则，记录显示参考值并与真实水位字段分开；例如沿用源数值零作展示基准，不把它命名MSL。发现与岸线附近地形冲突，应记录源基准/年代/分辨率或显示假设冲突，不整体改源DEM、抬低岸位或移动海岸来掩盖它。

既有坎门1997年840小时序列是去均值相对潮位，尚无到DEM的垂直基准转换，也不代表全温州同一潮位。不能用`relativeTide−DEM`求水深；水深还需同架同基准的床面/地形和同一有效时刻，单独显示海水不补足这些量。[已有潮位与水系知识](G:/小妈/知识体系/对象与领域映射.md)

## 5. 连通性必须有关系证据

河道对象、线段、坐标父架、显示分组和实际连接分别保存。一条水道被裁切成多段，不等于它变成多条物理河；两条线在屏幕相交，不等于同层相通。桥、渡槽、涵洞、闸坝和潮汐均可能改变解释，当前资料没有的不能补成已知。

可先保留候选连接记录：双方稳定ID、各自端点/接触范围、关系类别、证据、有效时间、状态；节点ID齐备且来源相容时可据源关联，仍区分制图节点关联与运行中可通水。只有坐标近邻时，阈值要有坐标/源误差依据，输出candidate而非confirmed；不能靠自动吸附让所有段接通。

同一sourceWayId的裁切连续性需保留参数区间与裁切原因；不能把AOI两侧人为闭环。河口与marine/inlandWater面的相交可提供位置候选，不证明交换流量、河口潮界或单向流动。OSM中的tidal/flow_direction等标签只在源实际存在时沿用，缺测时unknown；海流和水波动画不能代替这些状态。

因此本轮可以验收“河道线位已标、相关面已有依据、关系未知清楚”，无须伪造流向才能画图。不要把旧`projectedSkeletonPassed`改写成`hydrologyTopologyPassed`。

## 6. 继续应用R3共同知识与未来视角目标

海岸、岛屿、河面和中心线使用同一EPSG:32651水平架与R3局部原点，先在足够精度下减原点再入Float32。继续使用`x=(E−E0)/s, y=α(H−H0)/s, z=−(N−N0)/s`，α默认1；相机不会改变东西南北。水面采用显示假设时在独立字段里保存其高度来源，不利用父节点混入不明偏移。[R3原知识合同](XIAOMA_3D_KNOWLEDGE_R3.md)

原像元H、规范双线性H、显示三角H仍分开；查询01的801m与802.0m差别保持。分类与水面切换不能改变原DEM查询。拾取接口须能说明命中的是地形、示意水面还是地图符号；实际画面上先碰到蓝水面不能让查询返回伪造的DEM高程。

边界必须同时处理源格心曲面域、NoData域、矢量覆盖、海陆面和显示LOD域。新裁切/边界细化改变了显示划分，R3原有显示近似界需按新保留域/采样规则核对，不能照搬旧片的数值当新边界通过。

离地1.6m是后续相机与接触面目标。默认α=1时，选定有效且可站立的地表位置可定义`Heye=Hground+1.6m`，对应显示偏移1.6/s；不得把水面、NoData或任意远景三角形自动当可站立地面。当前格距12.5m、原信息约30m与未知物理误差不能支持1.6m级场景细节，仅修改相机不提高地物精度。后续若沿实际显示三角面行走，应说明与规范曲面偏差和碰撞规则；本轮只记目标，不要求解决近地精细重建。

## 7. 体积口径与本轮验收

用户要求报告新数据模式的实际体积，由温州对新版本的真实产物清单计量。本轮核对的三份旧投影向量合计60,602,348字节；这是**未压缩投影派生向量文件总量**，不是WGS84来源载荷总量、R3.1传输包大小、当前页面新增体积或GPU内存。

新版本至少分别报告：源数据保全量；新增规范对象/边界/索引载荷；共享解码/规则/库（独立列出首次与可复用部分）；首次页面实际传输及按需数据；解析后CPU峰值和临时GPU缓冲。压缩前后比较使用同一海岸、岛屿、河道与查询范围，不能省掉小岛/支流后只报压缩倍数。透明图层、shader及缓存也计入对应运行口径。

建议本轮收束于以下八项检查，检查是执行线工作，不增加小妈回签门槛：

1. 源三层/新海洋面有实际文件、CRS、时间、长度/哈希和可追溯许可；新数据只有取得并核验后才能登记已采用。
2. 新R3范围中已覆盖与unknown区域可查询，新增东/南边缘不因旧资料无记录就被判成陆地/海洋。
3. 同时看全域和至少河口、海湾、小岛三个边界样本；海域大矩形没有被当岸线，岛屿不被蓝面吞掉，AOI边界与海岸可区分。
4. 选已知陆地、海面、内陆水、NoData和有效零/负高程反例；确认分类与高程有效性独立，未用高程阈值/NoData推岸线。
5. 河道至少分别显示river/stream/canal以及源确有的tidal_channel；源ID/位置可追溯，缺宽/水位/连接不补零，不跨缺测或裁切口假连。
6. α=1与增强/复位后岸线及河道水平对齐不漂；原查询保持，显示抬升、假设水面与真实高程分别记录；检查近远缩放的边界LOD与线闪烁。
7. 成果体积按实际文件和运行阶段列数；保留海陆边界、岛孔和河道的误差/删减/覆盖记录，不以纯JSON小文件代表全部新模式。
8. 固定R3.1版本公网真正打开看图，操作海域/河道图层、查询、旋转/缩放；报告桌面/手机实际验证范围，保留R3。新指南或本地测试不替代公网交付。

## 8. 本轮实际来源与状态

实际读取：R3 AGENTS及已有3D知识合同第3—6节；小妈温州R2接续与对象映射水系/海洋部分；R1 HYDROLOGY_QA、ENVIRONMENT_FILE_LEDGER的水体面条目；两类OSM receipt、线拓扑QA和面QA相关正文/字段。root重算三份投影载荷长度/哈希并读取岸线头部；内部独立审读另核对三份头尾metadata、几何类型/来源。没有重跑投影、拓扑、裁切或全几何有效性验证。

外部只读核对：OSM coastline定义（直接打开超时后读取搜索返回官方正文的方向/高潮线/连续性部分）、waterway的用法/分类/潮汐和分层相关段落、natural=water的内陆水体/多边形说明；osmdata海洋面的完整发布说明。这些来源支持标签与产品语义，不给这批温州几何提供独立实测精度。

本轮知识增量是：确认了可以立即定位的三类资料及不同证据等级，修正“有water polygons即有完整海域”的可能误读，并给出有未知状态的面分类、河道/水面/连接及显示合同。原始文件、R3已固定产物和回执均未修改。具体海域联合、R3绑定与覆盖、河道呈现、新体积与公网质量由温州完成并据结果回流；只在新的失败/来源/明确需求下接续，不扩展为泛化研究。
