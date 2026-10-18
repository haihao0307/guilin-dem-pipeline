# A4 解剖式函数学习 R03：21站轴毂曲面集成候选

从已冻结 R02 的10个运行文件逐字节复制，再仅增加节点10轴毂曲面函数。R02、完整老师及旧案例均未修改。未复制旧 QA 图、未运行浏览器或发布；本目录待共享相机视觉验收。

## 本轮新增

- 双侧共享21站 `(x,r)` 母线、42个形状标量，生成轴毂已证明的5120个原三角对应位置。
- 与轮辋、全部22方向/44根辐条无一顶点分类重叠；若出现重叠，运行时明确报错。
- 不改变原索引、UV、作者拆分法线、材质、父子层级、相位或摄像机；原R02轮辋/辐条所有已生成位置逐值不变。
- 保留原四个辐条根部敞口；新增轴毂曲面四条边界都是与保留部分相接的接口，没有补盖或贯通孔推测。
- 轴毂余下512个混合过渡三角及384个完全源三角仍保留，中央偏心轴段与非均匀端帽尚未函数化。

## 真正合并测试

执行 `python tests/test_merged_cpu.py`，使用真实 Three.js R170 `BufferGeometry` 克隆适配器，不只是一个数学替身。

- 24588个原三角全部保留，18314个完全由规则位置组成。
- 实测源表面积生成覆盖93.1336673%，不是简单把两个报告百分比相加。
- 最大同三角对应位移及连续双向表面距离严格上界3.2209955e-6源单位；不是精确Hausdorff测量。
- 12480个焊接等价类逐组检查，零拆分、零合并。源264边界边、72非流形边原样保留，零退化三角；没有把源整体声称为水密实体。
- 原索引及全部非position属性（normal、UV等）按字节校验相同，原输入缓冲未改。
- 轴毂局部半径+1%、轴向+1%、半轨距+0.01三项敏感性，每项仅改4248个轴毂拆分顶点；其他顶点零变化，分类稳定。参数变化只证明控制有效，不能当成联接结构已完成工程重新设计。
- 轮总形状参数：轮辋60、辐条263、轴毂42，合计365；另有2个材质缝采样标量、2个源敞口标记。没有把原顶点缓冲作为形状参数。

`MERGED_CPU_TEST_REPORT.json` 为最终合并报告，`CPU_RECONSTRUCTED_WHEEL_R03.json` 含本轮 positions/indices/kinds/spokeIndices/hubStations，供共同截面对照。`kinds`：0原件、1轮辋、2辐条、3轴毂。

## 运行文件与接口

完整12文件及SHA见 `RUNTIME_FILES.json`。原调用 `rebuildSourceWheel(T,{8:g8,9:g9,10:g10},options)` 不变，增加 `fullyHub`、`hubVertices`、`hubOverlapVertices` 和参数计数。

新增模块只有：
- `rules/wheel/hub-lathe-rules.mjs`
- `rules/wheel/hub-profile-data.mjs`

轴毂敏感性使用独立命名空间 `options.hub`，支持 `radiusScale`、`axialScale`、`halfGaugeDelta`。默认值保持源尺寸。既有轮辋/辐条选项不会意外修改轴毂。

外部运行依赖沿用 R02：
- `../a4-full-source-replica-r01/vendor/three.module.js`
- `../a4-full-source-replica-r01/vendor/RoomEnvironment.mjs`
- `../a4-original-loading-r02/original-recovery-loading.mjs` 及其既有老师源资产

槽杆生成器、杆参数、共享相机和视口代码保持R02文件SHA，不重新生成或更改。

## 边界

这仍是完整源网格基础上的局部形状函数候选。拓扑、UV、作者法线、材质及原动画仍有源依赖；不称整轮/整车source-free。源单位未换算为米。CPU通过不代表视觉批准或已发布。

原模型作者 timblewee，CC BY 4.0；出处许可沿用 `a4-full-source-replica-r01/ATTRIBUTION.txt`。
