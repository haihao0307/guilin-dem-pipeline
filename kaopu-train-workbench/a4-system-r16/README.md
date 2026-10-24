# A4 整体关系研究 R16

此包用于整体关系、函数接口与验证，不是完整 A4 复刻交付，不是 A6。没有新画外壳，也没有将原作者 mesh 改名为函数。用户要求整体验证后再展示，本包暂为内部研究成果。

## 真正新增

- 煤/火/烟气、锅炉水/给水、蒸汽与过热、配汽、三缸传动、支承导向、排汽抽风、牵引与制动关系分开；SYSTEM_GRAPH.json 每条边有来源和证据等级。
- 三缸主连杆都作用中间驱动曲轴 D2。内侧连杆作用内部曲柄轴颈，左右连杆作用外侧曲柄销。左右耦合杆各连接 D1—D2—D3，而不是三个独立马达。
- 两套外侧 Walschaerts 的控制与中间 Gresley 共轭关系分开；不将配汽杆当作牵引动力杆。
- R14/R15 的曲柄—连杆闭链原理扩展到三条明确的汽缸轴线，以及两侧耦合链。相位与倾角必须显式传入，没有偷偷默认三等分120度。
- HTML 为可旋转的 Canvas 三维投影轴线与关系示意；CPU PNG/GIF 是实际函数计算的整体系示意。都不是实体完整火车。

## 关键来源与可核验位置

1. SNGTrust 2023工程报告：https://www.sirnigelgresley.org.uk/eng-reports/eng-23-a.shtml
   搜索 `middle coupled/driver pads`，下一段为 `middle crank axle webs`。它将中间联动轴明确称为驱动轴，并描述内部曲柄腹板。
2. SNGTrust 2026上半年：https://sirnigelgresley.org.uk/eng-reports/eng-26-a.shtml
   2026年3月13日主连杆装配，外侧大端与驱动曲柄销、小端与十字头关系。
3. SNGTrust 2025下半年：https://www.sirnigelgresley.org.uk/eng-reports/eng-25-b.shtml
   12月拆装耦合杆/knuckle，主连杆另外处理。内外两类杆不能混作同一部件。
4. 1935年9月27日 The Engineer，LNER提供的Silver Link说明，印刷页319—320：
   https://theengineer.markallengroup.com/production/2018/09/Gresley-Silver-Jubilee.pdf
   三缸独立供汽管、外Walschaerts与内等臂/2:1杆、锅炉/调节阀/过热器。此为首批1935配置，不是60009后期逐件清单。
5. NRM维修35：https://blog.railwaymuseum.org.uk/sir-nigel-gresley-overhaul-update-35/
   2018年12月3日周，汽缸中心线通过驱动轴中心，导轨与汽缸轴平行。
6. NRM档案目录：Q104整体平立剖；T220曲轴（后T644）；S319内连杆；S332耦合杆。目录仅证明有这些图，尚未看原图，不能当尺寸已核准。
   https://www.railwaymuseum.org.uk/sites/default/files/2018-05/Doncaster-Locomotive-Drawings-Microfilm-Lists-0518.pdf

## 证据与推定分层

60007维修资料只支持机构关系。60009源模型节点的旧候选对应保存在 source_model_mapping，R16未重载其完整源几何、未新核节点身份。

本轮数值工况 `[0,1.7,4.3]` rad相位、`[0,.11,0]` rad倾角、三杆暂同长、轴距2.5源单位，都是人为测试参数，不是 A4 标定值。R14/R15 的偏置 h 不移植为三缸现实轴线；新求解器在每缸局部轴线上严格闭链。沿用旧曲柄半径与杆长只为复用数值锚点，不等于尺寸吻合。

中缸在外缸后上方的真实布置已有资料，但当前数值工况尚未按其不同杆长/缸位重建。原型倾角、内曲柄相位符号、外缸左右先后需原图校准。共轭 `vM=-vL-vR` 只是等臂/2:1理想纵向关系，未求实际有限长度Walschaerts、阀口、lap、lead和截汽事件。

## 测试与失败

运行：`python validate.py`、`python static_qa.py`、`python render_cpu.py`。

11项数值/拓扑检查通过；3组人为参数各721相位。杆长恒定、导轨轴约束、同侧耦合杆长、周期性、介质分离及并联供汽已测。Node模拟DOM执行5个图层/播放暂停/选择，5角度JS与Python计算差为0。模拟DOM不是浏览器验证。

本地Chromium因socket权限未启动；升级执行环境又在启动阶段失败。云浏览器拒绝file协议。没有网页截图，没有发布，未宣称浏览器验收。后续优先复用已授权独立QA分支的Actions浏览器流程，不绕过拒绝。

CPU首图发现供汽线视觉穿过各阀易误读为串联，已改独立总管分支；改正热流箭头，轴用腹板/轴颈折线路径，不画V形假轴。最终PNG/GIF重新生成。

## 尚未完成与回退

这不是11项检查便等于整车学透。尚缺原图标定、原模型逐件语义对应、实际配汽与热力、各轴悬挂/全周期实体干涉、完整函数形体与整车可交互验收。R15保持不变，可回退到上一局部闭链。自有代码可编辑；原始照片、源mesh与受限图纸未打包。
