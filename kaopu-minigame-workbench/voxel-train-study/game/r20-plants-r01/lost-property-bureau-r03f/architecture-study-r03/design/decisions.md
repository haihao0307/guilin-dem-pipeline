# 失物招领局 · 建筑候选 03

这是一个从完整空间关系重建的独立候选。旧 R02 源码保留。它不是某位建筑师作品的精密复刻，也不代表已经达到用户的美术标准。

## 整栋的设计选择

1. 街面以公共钟塔门厅为中轴，左右为两层行政办公室；单一 6 m 开间体系维持尺度，12 m 的较弱立面分组减少满铺白色方格。
2. 通高大厅位于轴线后方，中央为 12 m 跨、三个连续交叉拱单元。公众区在中间，两侧连续签字柜台划定职员工作区。办公室使用成组办公桌、后墙档案柜和会议台，避免把全楼塞成孤立桌子阵列。
3. 中央拱跨有真实 4×4 m 顶部开口。拱面、屋面、光井、采光亭四处共享开口边界；没有在不透光屋顶上贴假天窗。
4. 大厅两侧为两个庭院，外缘是双面开放的连续骑楼。回廊既可从街道进入，也面向院子，不是仅有窗孔的围墙。回廊端部终止于横向转运廊，横廊和回廊端墙不互相堵塞。
5. 仓储设于整栋后部，清晰表达 90×50 m 的横向体量；五个 18 m 跨铁构拱形屋面与 5 m 纵向框架一致。4500㎡是内框分配面积，扣实际0.57 m柱脚16.245㎡后为4483.755㎡，不能冒称4500㎡净无障碍空地。
6. 东侧保留独立可见的蒸汽传送廊：接收筒、铜管、线轴、挂件轨道与行走线分开。本轮没有复杂动画，也不冒称机械、热工或安全设计已成立。
7. 塔楼的钟室改成真实厚墙与百叶开口，时钟和线脚附着于真实立面。后场烟囱服务机械区，与公共钟塔有明确主次。

## 学到的规则如何转成自己的能力

| 来源原则 | 自有表达 | 本案验证 |
|---|---|---|
| Soane Bank Stock Office 的公众/柜台/职员带空间关系 | 连续柜台、两侧职员通道、独立行政房间 | 大厅平面和近景，人员通道射线 |
| Soane 的中央空间与顶光层级 | 中央跨共享开口、光井、采光亭对象关系 | 从模型生成真实空洞，不复刻档案尺寸 |
| BRG compas-RV 筒拱/十字拱示范的支承、跨度、拱高、边界先行 | 12 m 跨、7.7 m 拱脚、4.4 m 拱高、四角支承表；五个18 m仓储跨 | 所有拱单元角点与支承对象自动对应 |
| 原材质母体的字段、尺度和局部坐标 | 保留105个原字段函数，显式材质参数、逐构件局部米制坐标 | 原WGSL哈希、转译清单、GLSL ES实际编译 |
| 平剖立一致性 | 单一几何组装器按对象/层/材质汇总，同时输出模型和证据 | 同一模型导出Blender、射线、构件清单 |

BRG 示例不是整栋建筑老师；没有运行 Rhino 或第三方未知脚本，没有在运行时携带老师的大型原始资产。Soane 档案图片未打包。

## 自有表示的边界

- model.mjs 是可复算源，construction.mjs 是共享构造函数，design/spatial-system.json 是对象与关系清单。
- design/parameters.json 是尺度清单，不是声称改任意 JSON 数字就能自动完成所有建筑更改的 BIM 编辑器。
- 洞口主体与边饰使用同一边界；屋面和中央光井开口同步。
- 自动通行检查只覆盖所列路线1.7 m高、中心及左右0.35 m的射线。它能发现墙/家具阻挡，不是完整人体扫掠、无障碍或消防认证。
- 拱是自有几何构造，本轮没有求推力网或荷载，因此不能从外形推断结构可施工。

## 材质保优与未完成项

原木、砖、石、板岩、灰泥母体的字段公式与默认系数保留，并机械转成 GLSL。wood 使用原粗细纤维、年轮、孔洞、裂纹、节疤、腔隙、粗糙度及清漆响应。brick 使用原烧结变化、孔洞和微观场，另有显式砖缝组装。stone/slate/plaster 的字段公式完整保留。各函数来源哈希见 material-port-receipt.json 与 mother-port-sources.json。

仍需分别验证：WebGL宿主实际编译和运行；GPU画面相对于原WGSL的数值/视觉等价；斜杆精确局部坐标；木材宏位移及视差链。当前没有把这些未完成项混称为完整材质等价通过。Blender图片仅验证同源建筑几何与空间，使用检查材质，不是浏览器材质母体截图。

## 可复用的验收顺序

完整功能分区和关联 → 门洞/轴线/屋顶/支承一致 → 人与物通行 → 外观及室内近景 → 原材质迁移 → 交互与移动端 → 用户美术验收。任一项失败都保留为失败，不用另一项的通过替代。

## 来源

- Soane Museum，Bank Stock Office 家具平面：https://collections.soane.org/OBJECT2589
- Soane Museum，屋顶/剖面/立面：https://collections.soane.org/OBJECT2548
- Soane Museum，帆拱与线脚节点：https://collections.soane.org/OBJECT2588
- BRG compas-RV，barrel-vault：https://github.com/BlockResearchGroup/compas-RV/blob/896f126b8ade7de16fb37d380874d65d936265bd/gitbook/examples/historical-typologies/barrel-vault.md
- BRG compas-RV，cross-vault：https://github.com/BlockResearchGroup/compas-RV/blob/896f126b8ade7de16fb37d380874d65d936265bd/gitbook/examples/historical-typologies/cross-vault.md
- BRG compas-RV MIT LICENSE：https://github.com/BlockResearchGroup/compas-RV/blob/896f126b8ade7de16fb37d380874d65d936265bd/LICENSE
- 三维运行库：随包 vendor/THREE-LICENSE.txt。

版本/许可锁定和逐文件哈希见 source-license-manifest.json；BRG JSON 的只读提取与自有规则对照见 teacher-comparison.json。我们没有声称复现其推力平衡。
