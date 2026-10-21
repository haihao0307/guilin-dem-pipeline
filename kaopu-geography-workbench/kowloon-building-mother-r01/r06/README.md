# R06 · 原创函数场建筑试验（候选版）

入口：[r06.html](../r06.html)。这是独立于旧版网格链路的直接函数求值实现，不是把 Three.js 的 Mesh 改名为“函数场”，也不是完整 BIM、建筑实测复原或安全认证模型。R01–R05 与相邻三个原案例应保留不动。

**当前状态：候选实现，待最终同版本 CPU、真实浏览器和发布后复验。** 实测面适配器、有符号设计场和混合求交函数已在源码中分离；结构解析求交与扶手局部保守追踪的渲染器接线正在更新。不能把先前纯步进版本、旧版页面、历史工作流的截图或性能数字当作本候选的完成证据。精确数据与证据级别见 [evidence-ledger.json](./evidence-ledger.json)。

## 1. 两种场，不能混成同一个事实

### A. 三个实测外表面的无符号场

[cases.mjs](./cases.mjs) 读取既有 measured-plane-boundary 配方。每个 wallStrip、wallProfile、roofPlane、undersidePlane 都转为自己的解析平面、正交局部坐标和有限多边形域，保留原面 ID、所有边界及洞。没有三角化、对象顶点缓冲、对象索引缓冲、体素化或 marching cubes。

点查询的定义是：点先投影到面；投影在外环内且不在洞内时，用到平面的垂距；否则用垂距与到最近有限边界线段距离的平方和开方。所有面的最小值就是有限源表面并集的精确无符号距离（浮点误差另计）。BVH 只用包围盒距离下界排除不可能更近的面，不改变源形状。完整遍历版本保留为比较基线。

直接射线路径对同一组平面作 ray/plane 求交，再以外环/洞谓词检验有限域；BVH 用射线与包围盒的相交区间剪枝。它是解析平面与边界函数的求交，不是向 GPU 提交多边形来光栅化。有限边界坐标是函数定义数据，不是渲染顶点；没有因此声称“无坐标”“无限压缩”或“没有任何离散数据”。

此场的 inside 始终未定义。零厚度外皮不自动成为闭合实体，塔楼底面也不补假封口。不能用它断言室内占用、墙厚、房间、楼板、基础、可行走区域或碰撞安全。它保留的是既有数据派生形状，并非重新现场测量。

### B. KCC 宿主内的两层有符号设计场

[field.mjs](./field.mjs) 是另外一套原创、有符号的设计函数：沿已知凹轮廓挤出的两块楼板、两跑阶梯轮廓、平台、连续扶手管、墙体减去门洞。min / max 进行并集与差集；物体 ID、材质角色和米制局部坐标随查询一起返回。

- 楼梯不是一摞互相遮盖的箱子：闭合台阶剖面包含踏面、立面和连续斜底，再沿梯宽挤出。默认每跑 10 级高差、9 个独立踏面，最后一级由相连平台或楼板闭合。
- 扶手由精确直线和有限圆弧组成一条母线，距离到母线减管半径得到管场。rounded 模式在坡段、平台和转角作解析圆弧切线衔接（G1，不冒充曲率 G2 连续）；angular 模式故意保留 C0 硬折点，不是降低网格细分。
- 墙开洞是同一有符号场内的布尔差，不是贴一张“门”图片。这里只有通道开口，没有据此宣称已做门扇、五金或防火门。
- 此场有有符号占用定义，但 min / max 组合后并非任意内部位置都给出精确欧氏距离。源码承诺是 1-Lipschitz 保守距离界；场值命中容差不等于所有 CSG 角点都具备同等欧氏精度证明。

[host.mjs](./host.mjs) 保留源身份、世界坐标、刚性变换和关系图，不依赖渲染器生成几何。楼层、楼板、核心筒分组、跨层楼梯、墙和洞口有独立拥有关系。这里的“设计核心筒”与公开平面里的真实核心筒关系记录不是同一对象，不能因为名称相似就合并。

默认层间距 3.2 m、梯宽 1.2 m、平台深 1.2 m、踏深 0.28 m、板厚 0.2 m、扶手高 0.9 m、管半径 0.035 m、转弯半径 0.22 m、门洞 0.9 × 2.1 m，均为可改创作参数，不是 KCC 实测尺寸或规范合规承诺。两层使用 floor-001 / floor-002 设计 ID，不对应公开图里的某两层。宿主中原有 2 × 2 m 服务预留体同样是创作预留，不是发现了一口真实电梯井。

## 2. 求交与显示路径

[renderer.mjs](./renderer.mjs) 使用 WebGL2 片元程序直接查询函数。每次绘制的一个全屏三角形只负责触发屏幕像素，是光栅化基础设施，不是建筑三角面。空 VAO 不承载模型顶点；探针用浮点纹理回读数值，不是体素模型。没有 WebGL2 时明确报错，不偷偷切回对象网格。

本候选的混合路径：

1. 实测外壳：源平面 / 有限域 / BVH 直接求交。
2. 两层设计结构：枚举解析边界平面，与射线求候选位置，再用同一个 CSG 场判断域、剖切和真实并集边界；内部接触面不应变成可见外面。平面方程列表不是面片三角化。
3. 扶手：只在扶手包围域内保守步进，并以最近结构命中限制搜索范围；步长为 abs(distance bound) × 0.85，不加可能跨过薄部件的正最小步长。预算耗尽保留为 unresolved，不得算作正常 miss。
4. 命中后的物体身份、法线与局部米制坐标交给材质函数。微表面高度只改变着色法线，不秘密修改轮廓。

混合路径仍需按最终渲染器版本完成验证。诊断里的“步数”必须说明是扶手场评估次数、结构候选平面测试次数，还是旧版全场步进次数，三者不可混成同一性能指标。所有循环上限、容差及诊断编码以本次实际运行代码和结果为准，不在本文伪装成已经测得的性能。

## 3. 三个确切源对象

来源冻结在提交 `b74929fc9f1c81eaa7e4b529a6bd5361024b035b` 的 `hk-three-buildings-r01/geometry/*.score.json`。坐标单位为米，水平 CRS 为 EPSG:2326，垂直基准为 Hong Kong Principal Datum。源配方为 east/north/up；显示局部坐标为 east/up/south，即 [east, up, -north]。下列高度是源模型锚点，不是街面标高或楼层 FFL。

| 源对象 | 身份与组件范围 | 锚点 E / N / H | 面 / 边界坐标 / 洞 / BVH 节点 |
| --- | --- | --- | --- |
| B367642137201063C0 | 喇沙利道 33 號；不是 31–33 整个共用地块 | 836766.125 / 821374 / 26.288999557495117 | 176 / 684 / 0 / 351 |
| B359971994401063C0 | 龍總大廈 K.C.C. Building 上部塔楼；不含独立裙房对象 | 836004.8125 / 819943.3125 / 20.641998291015625 | 21 / 100 / 0 / 41 |
| B369121858401063C0 | 香港中旅協記貨倉第二倉上部组件；不是街面至屋顶全楼 | 836896.75 / 818601.75 / 17.523000717163086 | 28 / 120 / 1 / 55 |

合计 225 个源面、904 次边界坐标记录、1 个洞、447 个 BVH 节点。边界坐标记录不是唯一顶点计数；上述数字不是渲染三角形数。每案对象网格三角形、模型顶点缓冲均为 0。

- 低层：55 wallStrip、78 wallProfile、27 roofPlane、16 undersidePlane。复杂屋面、倾斜墙剖面和底面保留，不能用普通挤出盒子代替。
- KCC：20 wallStrip、1 roofPlane。保留 p000 的 20 点翼状凹轮廓；没有据此制造地面封口或真实室内。
- 仓库：16 wallStrip、8 wallProfile、3 roofPlane、1 undersidePlane。三个屋面都是水平面，原来的 broad-sloped-roof 只是已纠正的旧分类，不能继续描述成斜屋顶。女儿墙环的洞及较高窄条保留；窄条用途仍未知。

源配方里历史 buildingName / floorCount 的 unknown 不被静默改写；新查到的名称、层数及用途放在独立研究层 [profiles.mjs](./profiles.mjs) 和来源账本。证据新增不等于改变冻结源几何。

## 4. 层数、公开平面与未知量

### 喇沙利道 33 號

[完整来源账本](./sources/33-lasalle-evidence.json)；[官方 GeoRefNo 3676421372 记录](https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0/query?where=GeoRefNo%3D%273676421372%27&outFields=%2A&returnGeometry=false&f=json)；[物业资料](https://hk.centanet.com/estate/en/33-La-Salle-Road/2-UJFDFRSSRO)。

官方 Storeys=2，物业层表佐证 G/F、1/F，只适用于 No.33。照片的 31–33 共用街门不是 No.33 室内主入口；屋顶围合物不能自行算第三个已证实居住层。BaseHeight 26 / TopHeight 33.7 的属性高差 7.7 m 与源形状竖向范围约 10.913 m 分别留存，不强行调成一致。楼梯、电梯有无、后门、房间、窗开启方式和窗框进深均未知。

### 龍總大廈 / K.C.C. Building

[完整来源账本](./sources/kcc-evidence.json)；[官方 GeoRefNo 3599719944 记录](https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0/query?where=GeoRefNo%3D%273599719944%27&outFields=%2A&returnGeometry=false&f=json)；[九龍總商會历史](https://hkkcc.org.hk/about-kcc/introduction?lang=zh)。

塔楼记录 24 层；另一裙房组件记录 4 层及 1 层地下；业主独立称全楼 28 层。保留三个记录的来源与范围，28 不是从塔楼模型高度猜出来，也不把地下层与层标签混入一条自行相加的“总层数”。官方塔楼 BaseHeight 22.4 / TopHeight 90.9 的高差 68.5 m，不等于源模型约 70.203 m 的竖向跨度，不据任一数值反推标准层高。

公开的 [5/F–17/F 平面](https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152441SSHJHSQR.jpg) 与 [18/F–26/F 平面](https://hkfloorplan.centanet.com/img/img.aspx?dir=202203&name=22cpal00152442GYWTOAVC.jpg) 显示 A–F 六户、3 部标注电梯、梯厅与中央楼梯关系。图无已验证比例、尺寸表和绘制日期；只记录拓扑，不从像素推断实测核心筒尺寸、精确坐标、层高、停靠表或防火分隔。电梯归属跨层核心筒，以停靠关系关联楼层，不独占归某一层。本两跑设计楼梯不是公开图所示相对两端楼梯路线的实测三维复原。商会带招牌入口不自动等同住宅大厅。

### 香港中旅協記貨倉第二倉

[完整来源账本](./sources/warehouse-evidence.json)；[官方组件记录](https://portal.csdi.gov.hk/server/rest/services/common/landsd_rcd_1637211194312_35158/FeatureServer/0/query?f=pjson&where=GeoRefNo%20IN%20(%273691218584%27,%273690318597%27)&outFields=*&returnGeometry=true&outSR=2326)。

上部记录 12 层，独立裙房 2 层和 2 层地下，不宣称 12+2+2=16 层。2021–2022 历史法院文字另记 G/F、1/F–12/F、两层地下及局部夹层，属于不同日期与定义范围；不能无条件复制成等高全层楼板。完整内部平面、货梯位置和楼梯布局未获得；经纪资料所称 9 部货梯仍为经纪描述，不是官方核准数量或几何布局。

车辆入口与人员入口应分开记录。外立面圆形开口可能为通风口，不自动套住宅窗格或指定窗扇铰链；门窗数量、精确位置、开法与框深仍未测。

三案 CSDI 的 DateStamp 2020-09-09 是记录时间，不是现场测量日；2026-10-21 是本轮资料核查日，不是这些建筑的竣工或最新改建日。

## 5. 材质、归属与公开边界

[material.mjs](./material.mjs) 内的 MOTHER_GLSL 与相邻案例 `viewer/mothers/kaopu-original.glsl` 保持逐字一致，SHA-256：

`9529e503f97be77a9f24fa00489e702f792417be07f60add7ee917d20c451ed8`

它是既有 KAOPU 自有材质函数的 GLSL 闭包，不是下载的老师 shader 或第三方演示重新命名。混凝土调用 kpConcreteStation，抹灰调用 kpPlasterOriginalField；金属扶手为明确创作参数。几何命中提供 materialRole 和局部米制坐标，同一物体刚性放置不改变材质尺度。材质选择、色彩、老化、湿度和微纹理不作为真实建筑饰面证据。原函数来源及翻译边界见相邻案例 [LICENSE_SCOPE.md](../../hk-three-buildings-r01/LICENSE_SCOPE.md) 和 [材质来源记录](../../hk-three-buildings-r01/viewer/provenance/material-sources.json)。

源几何归香港特别行政区政府地政总署 / CSDI 及相关机构，遵循 [CSDI Terms and Conditions](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)，不改称 CC0、自有测绘或政府认可的复原。

照片与公开平面只保留来源 URL、文字观察与证据范围，**不把原照片、图纸或私下研究副本打包到公开仓库**。公开可看不等于获准转载；本试验未取得这些图片的再发布许可。可查看 [31–33 街门/外观来源页](https://www.oneday.com.hk/en_US/buildings/31-33-la-salle-road/)、[KCC 物业来源页](https://hk.centanet.com/estate/en/Kowloon-Chamber-Of-Commerce-Building/2-MDZSTHZAHN)、[仓库实际外观来源页](https://property.jll.com.hk/en/industrial-lease/hong-kong/hung-hom/china-travel-hip-kee-godown-hk-ltd-godown-no2-hk-p-3408)。

## 6. 验证工作流与证据要求

运行 CPU 测试：在本建筑目录执行 `node --test tests/*.test.mjs`。R06 专项包括 [实测面](../tests/implicit-cases.test.mjs)、[设计场](../tests/implicit-field.test.mjs)、[宿主关系](../tests/implicit-host.test.mjs)、[身份资料](../tests/implicit-profiles.test.mjs)、[渲染与材质来源](../tests/implicit-renderer.test.mjs)。测试文件存在、静态计数或某次局部通过都不能替代最终整套报告。

浏览器入口是 [tests/implicit-browser.py](../tests/implicit-browser.py)。从包含相邻源案例的仓库根目录启动 HTTP 服务后，向脚本传入本候选的 r06.html URL 和输出目录；不使用截图合成图冒充实际 WebGL。现有 [候选 QA 工作流](../../../.github/workflows/kowloon-building-mother-r01-qa.yml) 预期输出 `evidence/r06-browser/results.json` 与实际截图，artifact 只短期保留。该路径是预期工作流产物，不表示本候选已通过或产物已经存在。

最终证据至少应记录：

- 同一份已测试源码/提交及服务文件哈希；三个完整源形状与洞的保留；BVH 与穷举结果一致。
- CPU / GPU 距离、身份、材质角色、局部坐标与法线对照；普通视角、实体内部、剖切、扶手转角、楼梯底部和墙洞口。
- 参数联动、非法参数拒绝且原状态不变、刚性放置后材质尺度不变。
- WebGL 审计的模型缓冲和 indexed draw 数；全屏 drawArrays 的 3 顶点；没有隐藏网格回退。
- hit / miss / unresolved 分开；结构平面测试量与扶手步数分开，预算耗尽不掩盖。
- 浏览器与实际 GPU 名称、分辨率、计时方法、样本、median / P95、错误与截图；本地成功与 HTTPS 发布后成功分别留证。

`benchmark()` 的测量口径为 draw 加 gl.finish 的 wall-clock 同步等待，不是独立 GPU timer。SwiftShader 等软件 GPU 可能很慢；“模型三角形 0”不是速度证明。此候选尚不报告最终耗时、帧率、浏览器通过数或“比网格更快”。

## 7. 已知缺口与止步线

- 扶手没有锚固、支撑柱、固定件、完整洞口护栏或全套防坠系统；连续母线不等于可施工安全构造。
- 三案真实室内、核心筒精确尺寸、实际层高和大多数门窗构造未知；设计参数不得写回成为实测事实。
- 无符号源外皮不保证水密、闭合占用或真实墙厚；设计有符号场的接触关系也不证明承重、耐火或疏散能力。
- 尚无结构、消防、无障碍或法规认证；不是施工、审批、逃生导航或安全判断依据。
- 没有基础、完整建筑内装、门扇五金、电梯机械或全楼可行走碰撞系统。
- 混合追踪仍须验证掠射、薄壁、边界、域判断及未决像素；有限精度与预算不能被“解析”二字抹去。
- 仅此 R06 候选的架构与来源文档，不授权额外发布、采购、扩大权限或传播受限图片；旧案例与其他项目保持不变。
