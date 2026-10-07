# 海羽：真实数据 → 轻量函数骨形

独立研究候选；范围仅鲭鱼 Scomber japonicus、SIO80-267、第2–12椎，非完整鱼。`index.html` 为自包含网页，无外部脚本/网格依赖，可旋转、查看三视、切换原坐标与海羽主轴映射。

默认使用11椎实测派生参数，形状由自写函数生成。每椎19个形状标量；11椎1760个椎体面和977个三维曲线点。对侧镜像、椭圆截面、杆状弓与接到简化椎体的短桥均为明示模型假设，未拟合真实骨壁、杯口、体积或精确孔径。

四锚点插值仅作压缩误差对照：长、高、单侧半宽RMSE约0.041、0.013、0.010 mm；棘尖最大位置误差0.980 mm，不能视作合格的精确骨形拟合。缺少头骨、完整肋、鳍、尾部和关节运动范围。

## 来源

Criswell, K.E.; Head, J.J. (2024). Morphological and morphometric data on the axial skeletons of vertebrates from museum specimens. NERC EDS Environmental Information Data Centre.
https://doi.org/10.5285/1c76e443-da02-4bc4-a041-0f79adc016be

有限派生参数源于 `scomber_vert02_12.txt` 的15点/椎坐标与作者点位定义。v8的原始点与该椎STL表面数值配准已核；不据此声称整个鱼骨或全部11椎配准均有作者确认。

Open Government Licence v3: https://eidc.ac.uk/licences/ogl/plain
Rights holder: University of Cambridge.
Contains data supplied by UK Centre for Ecology & Hydrology.

部分原归档STL来自MorphoSource，该SIO标本精确上游CT编号未核。此网页没有公开CT原扫描、STL原网格或原支持包，不把归档许可扩展到未核原素材。

## 验证与边界

同一几何通过216组选定参数状态；官方Playwright Chromium验证了三视同世界数据、手动旋转、范围/模式切换、控参与复位、390/800px布局。公开版本仅改说明与交付入口；不改海羽母台入口或C01/C02/C03。

已有代码与测试研究分支：`qa/haiyu-pointfields-20261007` 下同名研究目录。所有变形是设计映射，不是活鱼游动或生物力学。
