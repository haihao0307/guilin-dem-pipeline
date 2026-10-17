# Mark 3 / BT10 原生静态底盘研究 R01

## 本版做了什么

`src/coach-mechanics.mjs` 独立生成双转向架、8钢轮/4车轴、8一级螺旋弹簧、8套一级液压减振器、4空气簧、8吊杆、4牵引锚杆、双侧架与横梁、枕梁/托板/中心销、盘式制动盘及卡钳、轴箱/盖、防滑检测器、空气管路、底架I形纵梁/横梁、4组设备箱及百叶、端部联挂学习件与软管、4组踏步。

所有结构由自有回转剖面、I形/开口U形截面、圆角截面扫掠、螺旋管与三次曲线组成。车轮有轮毂、盘面、踏面与朝内轮缘；一级弹簧是真螺旋管，不是堆叠圆环贴图；卡钳有开口喉部；设备箱有圆角壳、安装支架、检修盖和独立百叶。重复部件按规则生成，没有老师顶点、残差或贴图依赖。

当前是静态功能结构研究，不是完整可运行底盘。不把238个渲染部件当238个已核工程零件，更不把三角形数量当质量证明。

## API及坐标

- `buildMark3Mechanics(params = {})`，别名 `generateCoachMechanics`
- 返回 `parts / parameters / evidence / checklist / roleCounts / functionalCounts / bounds / interfaces / completion`
- 每part使用与主壳一致的 positions/normals/uvs/indices/materialGroups；无需Three、文件系统或网络
- material使用已有自有材质入口 `blackPaint / dark-iron / brushedMetal / rubber`
- `metadata.role` 为自身功能分类，`metadata.assembly` 为自身装配组；不绑定老师节点
- `roleCounts`数渲染部件；`functionalCounts`把减振器缸体/杆/眼三部分合并成一套，避免24个渲染part冒充24套一级减振器
- 所有未有主证据的轮廓、局部尺度和装配坐标为provisional

与主壳统一：x横向、y向上、z向车后，裸壳中心z=0，轨面参考y=0。标注的是轮胎踏面接触高度；钢轮缘比踏面大0.028m，默认包围盒最低y=-0.028m是轮缘，不表示车轮被错放到地下。踏面/轮缘截面并非已核P8完整踏面标准曲线。

## 第一方历史设计锚与冲突

以下原始报告已实际下载、读表并逐页查看；仅发布数字事实和链接，不打包报告图片或原图：

1. 美国FRA委托Budd编制，FRA/ORD-78/29《Engineering Data on Selected High Speed Passenger Trucks》，1979年4月重印：印刷p82表13（PDF第91页）BT10名义轮径914mm、转向架轴距2600mm、轨距1435mm。印刷p88表17续（PDF第97页）English HST MarkIII / BT10的转向架中心距16000mm。印刷pp55–57（PDF64–66页）说明一级螺旋弹簧、液压减振器、空气簧、吊杆和锚杆等构成。
   https://railroads.dot.gov/sites/fra.dot.gov/files/fra_net/15976/1979_ENGINEERING%20DATA%20ON%20SELECTED%20HIGH%20SPEED%20PASSENGER.PDF
2. British Rail MT288 Issue2 RevA，1996年9月，印刷p54表3（PDF第56页）BT5/BT10行“NEW”轮径914mm作交叉核对。旧标准用于历史尺寸研究，不是今天的运维合规依据。
   https://www.bluebell-railway.co.uk/bluebell/cw/hra_tech/MT288-wheelset-tread-standards-and-gauging-wg4j.pdf

旧学习版2.26m或1.8m轴距、15.3m中心距不能混作实测；新默认采用2.6m/16m/0.914m历史BT10设计锚。914mm是名义新轮踏面径，不是某辆现车磨耗后轮径。修改锚点会写入evidence.editedPublishedAnchors。

没有把FRA的全部车体列照搬成外包络尺寸，其车体宽、高字段与其他运营资料定义不同。主壳宽仍需解决运营方2.740m/2.82m公开数据的测量基准冲突。

## 车体安装、底盘与地板接口

默认interfaces给出：

- 轨面参考0；轴心y=0.457m
- 两转向架中心z=±8m；四轴站位z=-9.3/-6.7/6.7/9.3m
- 地板底面1.175m，沿用主壳接口
- 移动架体及空气簧整体在原主壳暂定2.50m宽、1.10m顶高包络内
- 滑垫/中心销是单列安装区，不混入上述移动净空盒；区间y=1.10–1.175m，几何最高约1.164m，默认静态地板间隙约0.011m
- 每架纵向外轮廓留在中心±1.95m接口中
- 整体默认机械包络约宽2.71m、端间22.98m；这包括踏步和端件，仍为自有学习设计包络，不是整车工程验收

一级弹簧有上下座与通往侧架的支承；轴箱摆臂有通往侧架的枢轴支架；空气簧上承板连接枕梁。Node测试验证这些静态接合及地板间隙。不能因此宣称悬挂行程、曲线过限、动包络或受力已通过。

## 可编辑参数示例

```js
const runningGear = buildMark3Mechanics();
const editedStudy = buildMark3Mechanics({
  wheelDiameter: 0.89,
  bogieWheelbase: 2.8,
  frameLength: 3.8,
  primarySpringHeight: 0.27,
});
const bogiesAndFrame = buildMark3Mechanics({
  includeEndServices: false,
  includeEquipment: false,
  includeSteps: false,
});
```

上例变更名义设计锚，只作编辑能力演示，不能再称2.6m原设计。未知参数、非有限数值、弹簧自交、轮盘不适配、底盘穿地板、旧1.8/2.26轴距等会明确报错。

## 仍未完成

- 原模型匿名复合几何的逐子件身份尚未全部解明。本版不是源逐mesh等价复原，也不需要复制其划分方式。
- 历史批次/改造版本的精确制动盘数量、夹钳几何、完整制动执行链与管线连接尚未工程核实。已生成的是每轮一组盘/卡钳的明确学习方案。
- 端部联挂头是自有静态形体，确切HST联挂型号、联锁/缓冲/拆挂机构未完成；没有因源标签包含Buffer便虚构非缓冲HST的缓冲头。
- 设备箱“电气/空调/辅助/电池”命名是功能学习解释，具体车号位置/用途未核。
- 座椅、桌板、厕所、隔断、灯具、完整内饰、端部所有附件由其它阶段继续处理，未暗中并入“完成”。
- 无制动动作、悬挂运动、受力/载荷、磨耗/疲劳、气路或工程安全验证；材质实际画面尚待候选图验收。

## 测试及冻结状态

```sh
node --test a4-mark3-rule-conversion-r01/student-native-r01/tests/coach-mechanics.test.mjs
```

冻结时14/14通过，约2.18s。检查功能数量、几何有限性/法线/面朝向、圆角壳外法线、真实设计锚、踏面与轮缘高度分离、主壳净空与地板接口、支承接合、变参/UV重建、模块开关、端部包络、未完成状态、错误参数与无运行源依赖。

默认238个渲染部件，134,200三角形。原始资料与逐mesh本地研究库存不加入发布包。旧08、源档、外观R03和冻结的coach-shell均未改动。
