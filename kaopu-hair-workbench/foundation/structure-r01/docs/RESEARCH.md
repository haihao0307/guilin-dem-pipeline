# 按结构顺序学习 · 2026-10-16

本轮只借鉴公开研究的问题拆分和表示方法。下面区分论文结论、项目选择与尚未实现部分，不复制训练权重、人物或发型资产。

1. [Sketching Hairstyles, Fu et al., 2007](https://hongbofu.people.ust.hk/doc/sbim07_hairstyle_sketching.pdf)：阅读系统概览与第 4、5 节。流线提供切向约束，分割曲线为两侧设置不同方向；全局场在约束间传播，头发沿场生长。**项目选择**：分缝、旋涡与梳理曲线成为显式数据，不能仅画头皮亮线。本轮使用解析连续场与路径跟踪，尚未实现论文的拉普拉斯场求解和增量 Cholesky；不得称为该算法复现。
2. [DeepSketchHair, Shen et al., 2019](https://arxiv.org/html/1908.07198v1)：阅读概览、单视图建模及多视图编辑。轮廓约束与有向发流笔触是不同输入；单视图有深度歧义，多视图可修正三维方向。**项目选择**：轮廓、方向和深度关系分别验收。不训练或接入其网络；本轮不宣称已从照片准确恢复三维背面。
3. [Example-Based Hair Geometry Synthesis, Wang et al., 2009](https://research.lvdi.wang/publications/hairsynthesis/2009_hairsynthesis.pdf)：阅读第 3–5 节。头皮二维排列与三维方向场共同描述发型；局部坐标下比较完整曲线，层级聚类维持束群，邻近发根和空间邻近路径两种一致性都要考虑。**项目选择**：保存完整路径和局部运输坐标、明确三级父链。初版人工分区加位置分组只是初始束图；静态修订 02 改为在语义路线内，以整条曲线的实际弧长采样距离进行 complete-link 层级聚类，并保留各组真实代表曲线。尚未实现论文的变分聚类与例子细节合成，不能把此实现称为论文复现。
4. [Doubly Hierarchical Geometric Representations, Chen et al., NeurIPS 2024](https://proceedings.neurips.cc/paper_files/paper/2024/file/a337c82579ca723415417fdd8ea3a485-Paper-Conference.pdf)：阅读第 2 节及表示消融。低频 Guide 与高频卷曲噪声分开，开放曲线的导数经 DCT 可保留根位置；曲线代表性比头皮网格均匀取点更重要。**项目选择**：本轮关闭高频细节，按语义和形状覆盖选 Guide。已实现分区候选曲线池上的完整曲线距离与三次近似 k-medoids 更新，保留实际曲线作为代表。它只对有限候选池做局部优化，不是论文完整网络，也不宣称全局最优。尚未实现 DCT 与生成网络。
5. [IPHG, Chang et al., SIGGRAPH 2025](https://weschang.com/publications/iphg/) 与[官方幻灯片](https://weschang.com/publications/iphg/iphg-slides.pdf)：散乱重建发丝可转为少量控制 Guide 与可编辑梳理操作。**项目选择**：照片结果未来只是结构约束来源，必须进入统一可编辑数据。已核对[源码说明](https://github.com/facebookresearch/iphg)：CC BY-NC 4.0。本轮不引入该代码或权重，未运行其优化流程。
6. [Digital Salon 官方项目](https://digital-salon.github.io/) 与[代码仓库](https://github.com/digital-salon/Digital-Salon)：区域选择、生成、剪裁、梳理、模拟是可区分操作。仓库标注 MIT，但这不能扩展到论文展示的内部素材。**项目选择**：拆开发型编译、诊断显示与后续模拟接口。已进一步阅读 `extern/hairsim/src/HairGen.h` 的 HairRoot/HairNode、HairGenerator 数据成员，`HairGen.cpp` 的 GenerateRoots、GenerateStrands、GenerateParticles、ComputePFTs，以及 `src/Scene.cpp` 的 GenerateHair、InitHairCut。根/曲线/模拟粒子分开存储、保存 RestLengths 与运输坐标的组织方式值得学习；但 GenerateRoots 的固定 HairsPerTri、GenerateStrands 的法线初始方向和逐步重力累积不能照搬成我们的发型结构。未研读 GPU 求解器细节，也未移植源码。
7. [HairStep](https://github.com/GAP-LAB-CUHK-SZ/HairStep)：保留为照片理解阶段的必学项。本轮暂不做图片重建，未列为已学习或已实现。

## 本轮工程结论

先建立生长域 → 启用毛囊 → 切向方向 → 分区剪裁 → 完整 Guide → 束群 → 静止形态。密集子发丝、根梢质感和物理在结构门禁后进入；论文里的网络、聚类或物理方法未实现时必须如实标记。


## 2026-10-17：从解析规则走向可验证编辑

本轮重新核对 Sketching Hairstyles 第 4–5 节，将“约束的传播”做成独立试验。已实现头皮图上的带筛选先验 Laplacian 迭代求解，不再仅将“解析场平滑”当作求解器。它仍不是论文的体积场和增量分解；完整路径的下半段仍是作者路线。

层级学习进入实际中束几何：运输局部横截面的渐入收束/梢端释放、根/剪裁固定、整曲线接触与折角回退。没有导入例子发型，也没有复现 Wang 的变分聚类或完整细节合成。研究实验、失败原因和所有权见 [发流与中束实验 03](EDITABLE-FLOW-03.md)。
