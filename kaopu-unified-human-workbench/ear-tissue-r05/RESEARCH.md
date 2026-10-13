# R05 — 研究依据与实现边界

核查日期：2026-10-13。采用一手/官方资料；没有复制外部耳朵网格、皮肤贴图或受限研究数据。

## NIH / NHGRI：Anatomy of the Ear

https://elementsofmorphology.nih.gov/anatomy-ear.shtml

该资料区分耳轮、对耳轮、耳甲、耳屏、舟状窝与柔软的耳垂。迁移到本项目的是分区处理的原则：不能把耳朵当作一整块均匀的面颊皮肤，也不能把所有区域的厚薄、粗糙度与颜色设成一个常数。

限制：该网页没有给本模板的逐点光学参数；R05 的区域增益不是从文献测量反推得到的生物参数。软骨存在与否不能单独决定某点透光亮度。

## NVIDIA GPU Gems 3，第14章

Eugene d'Eon、David Luebke：Advanced Techniques for Realistic Real-Time Skin Rendering。
https://developer.nvidia.com/gpugems/gpugems3/part-iii-rendering/chapter-14-advanced-techniques-realistic-real-time-skin

参考表面反射与皮下光传输分别处理、厚度参与透射以及细节不能仅靠模糊法线替代的思路。R05 将耳部粗糙度、微表面与基于当前模型外壳厚度的方向性衰减分开处理；不存在透明 alpha 外壳或恒亮红色发光层。

限制：没有移植该章完整算法；本版的通道衰减系数为人工校准，不是测量的多层皮肤光谱。模型法线射线与圆锥估计不等于医学组织厚度，也不是完整多次散射或全头遮挡求解。

## 本项目自己的可核查工程证据

`SurfaceSamples.mjs` 用面积加权面选择、三角面重心坐标与三维最小间隔拒绝，生成绑定到耳廓表面的采样中心。孔径和微表面核按当前空间毫米求值，避免单一 ZY 投影的伸长。它不是三向投影伪装成表面采样，也没有宣称实现精确测地采样。半径、深度、密度仍是人工设置。

`TissueField.mjs` 对当前模型外壳求射线距离，正法线未命中时的圆锥结果显式降低置信度，未知位置不作深层透光。厚度与置信度的平滑只改变光学属性，保留 R04 耳后头皮几何不动。

`unit.mjs` 用已知厚度测试盒和不同切平面核验证算法性质；`acceptance/{candidate,public}/report.json` 及 PNG 记录实际浏览器参数响应、形变兼容和视觉结果。参数像素变化、单元测试通过与逼真程度是不同证据，不能相互替代。异常耳甲亮弧、偏软/带棱角的形面仍在 README 中列为未消除的视觉缺陷。

## 资产与公开交付

保留原人物、原眼球和原唇部资产的固定加载锚点与署名。无新的外部扫描/图像资产。`ear-r05-asset-audit.yml` 只读取并核对已有固定 GNM 运行资产，不更改资产或改变许可。

网页固定构建：`63e5dfddf2b5ca0d686651804beeba3333b2f41e`。最终交付与保留范围见 README、BUILD.json 和恢复收据；原 R04 网页继续可用。
