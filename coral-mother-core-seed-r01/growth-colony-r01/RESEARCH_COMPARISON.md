# 珊瑚生长：两条独立研究路线

## 视觉学习目标

参考为 Iman Vafaei 的 [Houdini Coral Growth and Grain Simulation](https://www.youtube.com/watch?v=icN9z23F1ag)。本案例聚焦珊瑚：低连通基底、多高低芽、几根主枝、向外展开并折返的密集层片。原视频、其模型缓存和付费工程未包含在候选文件内。

## 保留的 R03 网格求解研究

固定检查点：[236ded1](https://github.com/haihao0307/guilin-dem-pipeline/tree/236ded1eecaf6acc442698f68ba4763a30579ffc/coral-mother-core-seed-r01/growth-lab-r03/research)。该目录全部原字节保留。

阅读源码核查到的能力：
- 连通种子上的法向生长、当前三角形的定向光线遮挡
- 边分裂、合并、翻边及材料应变传递
- 点–三角形相对运动约束；每次增长和重网格后的严格相交回退
- 检查共享顶点的三角扇在顶点外发生的交叉

原 README 明确记录：生成物仍偏尖、偏厚或密度不足，未达到参考的薄密嵌套卷层。碰撞检查也不包含共面接触和完整连续碰撞检测。本次对其代码做了阅读对照，没有重新运行并冒称通过。

这些局部应变传递和交叉回退方法比只查近邻点更完整，可以继续作为网格路线的研究基础。它们没有被混称为当前导向模型已实现的功能。

## 当前 JS 导向组织前沿

自写谱系先定义低基底、母枝、分叉、冠部支撑和每片组织的出生时间。前沿沿固定材料坐标推进；已生成组织的位置不靠成熟模型整体缩放。层片逐段外展和回折，沿其真实中面法线形成厚度。独立随机流让种子、密度和回折参数可复现。

当前已验证：
- Node 十项几何/时序测试通过
- 同种子逐字节确定、倒放重播一致，旧材料顶点固定
- 子组织出生不早于父枝到达；参数修改真正改变几何
- 默认成熟实时预览有 479 个原始分件、366,734 顶点、731,552 三角面
- 每个分件的边关联闭合与定向检查；可查看谱系并导出当前阶段 OBJ/JSON

当前明确限制：
- 这是独立导向式构建法，不能称作恢复了原作者的物理求解器
- 原始组织分件存在重叠及交穿；实时导出没有执行布尔并集，也不保证全体水密、无自交或可制造
- 原片成熟层冠更薄、更密且局部连接更自然；本候选仍有较多外露主柱与基底
- 离线并集的单连通、闭合检查不能代替几何相交检查；未通过完整几何验证的并集不作为合格一体化输出发布
- 浏览器、移动视口、性能与真实返回导航由独立 Chromium/WebKit QA 记录；Node 通过不代表这些项目通过

## 一手方法参考

- [Konstantin Magnus：Simulating Growth on Meshes](https://procegen.konstantinmagnus.de/simulating-growth-on-meshes)，方向带、曲率、曝光和持续重网格的研究参考
- [Horikawa：HoudiniHowtos](https://github.com/jhorikawa/HoudiniHowtos/tree/ebafabe0f2b3559e729b6561153e879cf7d03125)，MIT 公开研究工程；当前候选未分发其 HIP 或内含的工具定义
- [SideFX：Mask by Feature](https://www.sidefx.com/docs/houdini/nodes/sop/maskbyfeature.html)，方向、阴影和 AO 的官方区分

该目录独立添加，既有母台、旧案例与早期研究的 SHA 由 tests/preservation.json 锁定核查。
